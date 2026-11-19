// Offline archive scanner. No network, trust issuer, repair, sorting or candle synthesis.
import { createHash } from 'node:crypto';
import { open, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { types } from 'node:util';
import { getResearchInstrument } from './catalog.js';
import { inspectHistoricalBytes, MAX_FILE_BYTES, MAX_CANDLES } from './intake.js';
import { createResearchCalendar } from './calendar.js';

const MAX_INDEX_LINE_BYTES = 65536, READ_BYTES = 65536, MINUTE = 60000;
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const abort = code => { throw Object.assign(Error(code), { auditCode: code }); };
function exact(o, keys) {
  if (!o || typeof o !== 'object' || types.isProxy(o) || Array.isArray(o) || Object.getPrototypeOf(o) !== Object.prototype) return false;
  const d = Object.getOwnPropertyDescriptors(o);
  return Reflect.ownKeys(d).length === keys.length && keys.every(k => Object.hasOwn(d, k) && Object.hasOwn(d[k], 'value'));
}
const label = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(s) && s.toUpperCase() !== 'UNKNOWN';
const digest = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
function utc(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(s)) return null;
  const n = Date.parse(s);
  return Number.isSafeInteger(n) && n > 0 && new Date(n).toISOString() === s.replace(/(?:\.000)?Z$/, '.000Z') ? n : null;
}
function relativeParts(p) {
  if (typeof p !== 'string' || p.length > 4096 || !p.length) abort('UNSAFE_PATH');
  const parts = p.split(/[\\/]/);
  if (parts.some(s => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(s) || s.endsWith('.') || s === '.' || s === '..' ||
    /^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(s))) abort('UNSAFE_PATH');
  return parts;
}
function inside(root, p) { const r = relative(root, p); return !!r && !isAbsolute(r) && r !== '..' && !r.startsWith('..\\') && !r.startsWith('../'); }
async function secureOpen(root, path) {
  let fd;
  try {
    let target = root;
    const parts = relativeParts(path);
    for (let i = 0; i < parts.length; i++) {
      target = join(target, parts[i]);
      const s = await lstat(target);
      if (s.isSymbolicLink()) abort('SYMLINK_FORBIDDEN');
      if (i < parts.length - 1 ? !s.isDirectory() : !s.isFile()) abort('REGULAR_FILE_REQUIRED');
    }
    const canonical = await realpath(target);
    if (!inside(root, canonical)) abort('PATH_ESCAPE');
    const before = await lstat(canonical);
    if (before.isSymbolicLink() || !before.isFile()) abort('REGULAR_FILE_REQUIRED');
    fd = await open(canonical, 'r');
    const after = await fd.stat();
    if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino || await realpath(target) !== canonical) abort('FILE_CHANGED');
    return fd;
  } catch (e) { if (fd) await fd.close(); throw e; }
}
async function* chunks(fd) {
  let position = 0;
  while (true) {
    const b = Buffer.alloc(READ_BYTES), { bytesRead } = await fd.read(b, 0, b.length, position);
    if (!bytesRead) return;
    position += bytesRead;
    if (!Number.isSafeInteger(position)) abort('COUNTER_OVERFLOW');
    yield b.subarray(0, bytesRead);
  }
}
async function hashFile(fd) { const h = createHash('sha256'); for await (const b of chunks(fd)) h.update(b); return h.digest('hex'); }
async function* lines(fd, hash) {
  let tail = Buffer.alloc(0);
  for await (const b of chunks(fd)) {
    hash.update(b);
    const data = Buffer.concat([tail, b]); let start = 0, end;
    while ((end = data.indexOf(10, start)) !== -1) {
      let line = data.subarray(start, end); start = end + 1;
      if (line.at(-1) === 13) line = line.subarray(0, line.length - 1);
      if (!line.length || line.length > MAX_INDEX_LINE_BYTES) abort('INVALID_INDEX_LINE_SIZE');
      yield line;
    }
    tail = Buffer.from(data.subarray(start));
    if (tail.length > MAX_INDEX_LINE_BYTES + 1) abort('INVALID_INDEX_LINE_SIZE');
  }
  if (tail.length) {
    if (tail.length > MAX_INDEX_LINE_BYTES) abort('INVALID_INDEX_LINE_SIZE');
    yield tail;
  }
}
function parseLine(b) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b), x = JSON.parse(text);
    // Canonical JSON per NDJSON line rejects duplicate keys, ambiguous escaping and BOM.
    if (JSON.stringify(x) !== text) abort('NON_CANONICAL_INDEX_JSON');
    return x;
  } catch (e) { if (e.auditCode) throw e; abort('INVALID_INDEX_JSON'); }
}
function calendarShape(c) {
  if (exact(c, ['profile']) && c.profile === 'UNKNOWN') return true;
  const common = ['profile', 'sourceId', 'venue', 'reference', 'exceptions'];
  const forex = c?.profile === 'FOREX_WEEKLY';
  return exact(c, forex ? [...common, 'timeZone', 'openMinute', 'closeMinute'] : common) &&
    ['FOREX_WEEKLY', 'CRYPTO_24_7'].includes(c.profile) && label(c.sourceId) && label(c.venue) && label(c.reference) &&
    Array.isArray(c.exceptions) && (!forex || (typeof c.timeZone === 'string' && Number.isInteger(c.openMinute) &&
      c.openMinute >= 0 && c.openMinute < 1440 && Number.isInteger(c.closeMinute) && c.closeMinute >= 0 && c.closeMinute < 1440));
}
function headerValid(h, instrument) {
  const s = h?.source, l = h?.license, p = h?.provenance;
  return exact(h, ['type', 'schemaVersion', 'instrument', 'kind', 'timeframe', 'source', 'license', 'provenance', 'calendar']) &&
    h.type === 'archive' && h.schemaVersion === 1 && h.instrument === instrument.instrument && h.timeframe === '1' && ['REAL', 'MOCK'].includes(h.kind) &&
    exact(s, ['sourceId', 'symbol', 'venue', 'priceBasis']) && label(s.sourceId) && label(s.venue) &&
    [instrument.pair, instrument.base + instrument.quote].includes(s.symbol) && ['bid', 'ask', 'mid', 'last'].includes(s.priceBasis) &&
    exact(l, ['reference', 'permission', 'permittedPurpose']) && label(l.reference) && l.permission === 'DECLARED' && l.permittedPurpose === 'CLOSED_BAR_RESEARCH' &&
    exact(p, ['declaration', 'evidence']) && label(p.declaration) && p.evidence === 'DECLARED_ONLY' && calendarShape(h.calendar) &&
    (h.kind !== 'REAL' || ![s.sourceId, s.venue, l.reference, p.declaration].some(v => /^MOCK(?:\b|_)/i.test(v)));
}
function same(a, b) { return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => a[k] === b[k]); }
function add(a, b) { const n = a + b; if (!Number.isSafeInteger(n)) abort('COUNTER_OVERFLOW'); return n; }

async function* scanResearchArchive(options) {
  const report = { instrument: null, dataKind: null, status: 'NOT_READY', historyStatus: 'UNKNOWN', readiness: 'NOT_READY', grantsRuntimeAccess: false,
    source: null, license: null, provenance: null, calendar: null, assessedAsOf: null, permittedPurpose: 'CLOSED_BAR_RESEARCH', indexChecksum: null,
    structure: 'FAIL', coverage: 'UNKNOWN', originEvidence: 'UNKNOWN', licenseEvidence: 'UNKNOWN', calendarConfidence: 'UNKNOWN',
    firstCandle: null, lastCandle: null, candleCount: 0, fragmentCount: 0, missingTradingMinutes: null,
    nonTradingMinutes: 0, nonTradingIntervals: 0, unexplainedGaps: 0, overlaps: 0, orderViolations: 0, mixedSources: 0, duplicates: 0,
    unexpectedClosedCandles: 0, monthsCovered: 0, yearsCovered: 0, indexChecksumVerified: false, errorCodes: [] };
  let fd;
  try {
    if (!exact(options, ['root', 'indexPath', 'expectedIndexChecksum', 'instrument', 'asOf'])) abort('INVALID_ARCHIVE_OPTIONS');
    // Copy permitted scalars before the first await: later caller mutations have no effect.
    const o = { ...options }, item = getResearchInstrument(o.instrument);
    if (!item || !digest(o.expectedIndexChecksum) || utc(o.asOf) === null || typeof o.root !== 'string' ||
      !o.root.length || /^(?:\\\\|\/\/)/.test(o.root) || o.root.includes('\0') ||
      (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(o.root) && !/^[A-Za-z]:[\\/]/.test(o.root))) abort('INVALID_ARCHIVE_OPTIONS');
    report.instrument = item.instrument;
    report.assessedAsOf = o.asOf;
    const rootInput = resolve(o.root), rs = await lstat(rootInput);
    if (rs.isSymbolicLink() || !rs.isDirectory()) abort('ARCHIVE_ROOT_REQUIRED');
    const root = await realpath(rootInput);
    if (/^(?:\\\\|\/\/)/.test(root)) abort('ARCHIVE_ROOT_REQUIRED');
    fd = await secureOpen(root, o.indexPath);
    const initialStat = await fd.stat();
    // First pass authenticates index bytes against caller-supplied digest before any fragment IO.
    if (await hashFile(fd) !== o.expectedIndexChecksum) abort('INDEX_CHECKSUM_MISMATCH');
    const hash = createHash('sha256');
    let header = null, calendar, previousTo = null, previousFrom = null;
    let month = null, year = null, monthCount = 0, yearCount = 0;
    for await (const line of lines(fd, hash)) {
      const row = parseLine(line);
      if (!header) {
        if (!headerValid(row, item)) abort('INVALID_ARCHIVE_HEADER');
        calendar = createResearchCalendar(row.calendar, { sourceId: row.source.sourceId, venue: row.source.venue, assetClass: item.assetClass });
        // Unknown/unconfirmed calendars are never reflected as an accepted calendar contract.
        if (calendar.confidence === 'UNKNOWN') row.calendar = { profile: 'UNKNOWN' };
        header = freeze(row);
        report.calendarConfidence = calendar.confidence;
        report.source = header.source; report.license = header.license; report.provenance = header.provenance; report.calendar = header.calendar;
        report.dataKind = header.kind === 'MOCK' ? 'MOCK' : 'DECLARED_REAL';
        report.historyStatus = header.kind === 'MOCK' ? 'MOCK_ONLY' : 'PRESENT_UNVERIFIED';
        report.originEvidence = 'DECLARED_ONLY'; report.licenseEvidence = 'DECLARED_NOT_VERIFIED';
        report.missingTradingMinutes = calendar.confidence === 'UNKNOWN' ? null : 0;
        if (calendar.reason) report.errorCodes.push(calendar.reason);
        yield freeze({ type: 'header', provisional: true, header });
        continue;
      }
      if (!exact(row, ['type', 'path', 'expectedChecksum', 'period', 'expectedCandles']) || row.type !== 'fragment' ||
        !exact(row.period, ['from', 'to']) || !digest(row.expectedChecksum) || !Number.isSafeInteger(row.expectedCandles) ||
        row.expectedCandles < 1 || row.expectedCandles > MAX_CANDLES) abort('INVALID_FRAGMENT_MANIFEST');
      relativeParts(row.path);
      const from = utc(row.period.from), to = utc(row.period.to);
      if (from === null || to === null || from % MINUTE || to % MINUTE || to < from || to + MINUTE > utc(o.asOf) ||
        (to - from) / MINUTE + 1 !== row.expectedCandles) abort('INVALID_FRAGMENT_PERIOD');
      if (previousTo !== null && from <= previousTo) {
        report.orderViolations++;
        if (to >= previousFrom) report.overlaps++;
        abort(report.overlaps ? 'FRAGMENT_OVERLAP' : 'FRAGMENTS_NOT_ASCENDING');
      }
      let fragment, data;
      try {
        fragment = await secureOpen(root, row.path);
        const s = await fragment.stat();
        if (s.size < 1 || s.size > MAX_FILE_BYTES) abort('INVALID_FRAGMENT_SIZE');
        const buffers = []; let size = 0;
        for await (const b of chunks(fragment)) { size += b.length; if (size > MAX_FILE_BYTES) abort('INVALID_FRAGMENT_SIZE'); buffers.push(b); }
        data = inspectHistoricalBytes(Buffer.concat(buffers), { instrument: item.instrument, expectedChecksum: row.expectedChecksum, asOf: o.asOf });
      } finally { if (fragment) await fragment.close(); }
      if (data.status !== 'VALIDATED') {
        report.duplicates += data.manifest?.duplicates ?? 0;
        if (data.errors.some(e => e.code === 'MIXED_CANDLE_METADATA' || e.code === 'INVALID_SOURCE')) report.mixedSources++;
        data.errors.forEach(e => { if (report.errorCodes.length < 100) report.errorCodes.push(e.code); });
        abort('FRAGMENT_REJECTED');
      }
      const m = data.manifest;
      if (!same(m.source, header.source) || !same(m.license, header.license) || m.dataKind !== report.dataKind) { report.mixedSources++; abort('MIXED_FRAGMENT_METADATA'); }
      if (utc(m.period.from) !== from || utc(m.period.to) !== to || m.candleCount !== row.expectedCandles) abort('FRAGMENT_MANIFEST_MISMATCH');
      if (previousTo !== null && from > previousTo + MINUTE) {
        const assessment = calendar.interval(previousTo + MINUTE, from);
        if (assessment.status === 'UNKNOWN' || assessment.tradingMinutes > 0) report.unexplainedGaps++;
        if (assessment.status !== 'UNKNOWN') {
          report.missingTradingMinutes = add(report.missingTradingMinutes, assessment.tradingMinutes);
          report.nonTradingMinutes = add(report.nonTradingMinutes, assessment.nonTradingMinutes);
          report.nonTradingIntervals = add(report.nonTradingIntervals, assessment.nonTradingIntervals);
        }
        yield freeze({ type: 'gap', provisional: true, from: new Date(previousTo + MINUTE).toISOString(), toExclusive: new Date(from).toISOString(), assessment });
      }
      const actual = calendar.interval(from, to + MINUTE);
      if (actual.status !== 'UNKNOWN') report.unexpectedClosedCandles = add(report.unexpectedClosedCandles, actual.nonTradingMinutes);
      // Emit calendar buckets sequentially. Keep only the active month/year, never a history map.
      for (const candle of data.candles) {
        const iso = new Date(candle.time * 1000).toISOString(), mk = iso.slice(0, 7), yk = iso.slice(0, 4);
        if (month !== mk) {
          if (month !== null) yield freeze({ type: 'month', provisional: true, key: month, candleCount: monthCount });
          month = mk; monthCount = 0; report.monthsCovered++;
        }
        if (year !== yk) {
          if (year !== null) yield freeze({ type: 'year', provisional: true, key: year, candleCount: yearCount });
          year = yk; yearCount = 0; report.yearsCovered++;
        }
        monthCount = add(monthCount, 1); yearCount = add(yearCount, 1);
      }
      report.candleCount = add(report.candleCount, data.candles.length); report.fragmentCount = add(report.fragmentCount, 1);
      report.firstCandle ??= new Date(from).toISOString(); report.lastCandle = new Date(to).toISOString(); previousTo = to; previousFrom = from;
      yield freeze({ type: 'fragment', provisional: true, path: row.path, manifest: m, provenance: header.provenance });
      data = null; // Release this fragment before allocating the next one; consumers never receive candles.
    }
    if (!header || !report.fragmentCount) abort('EMPTY_ARCHIVE');
    const endStat = await fd.stat();
    if (hash.digest('hex') !== o.expectedIndexChecksum || initialStat.size !== endStat.size || initialStat.mtimeMs !== endStat.mtimeMs) abort('INDEX_CHANGED');
    report.indexChecksumVerified = true;
    report.indexChecksum = o.expectedIndexChecksum;
    if (month !== null) yield freeze({ type: 'month', provisional: true, key: month, candleCount: monthCount });
    if (year !== null) yield freeze({ type: 'year', provisional: true, key: year, candleCount: yearCount });
    report.structure = 'PASS';
    report.coverage = report.calendarConfidence === 'UNKNOWN' ? 'UNKNOWN' :
      report.missingTradingMinutes || report.unexpectedClosedCandles ? 'FAIL' : 'PASS';
    if (report.coverage === 'PASS' && report.dataKind === 'DECLARED_REAL') report.status = 'PRESENT_UNVERIFIED';
  } catch (e) {
    report.structure = 'FAIL'; report.status = 'NOT_READY'; report.coverage = 'UNKNOWN';
    if (e?.code === 'ENOENT' && report.dataKind === null) report.historyStatus = 'MISSING';
    report.errorCodes.push(e?.auditCode ?? (e?.code === 'ENOENT' ? 'FILE_MISSING' : 'ARCHIVE_UNAVAILABLE'));
  } finally {
    if (fd) { try { await fd.close(); } catch { report.structure = 'FAIL'; report.status = 'NOT_READY'; report.errorCodes.push('CLOSE_FAILED'); } }
  }
  yield freeze({ type: 'coverage', report });
}
export { scanResearchArchive, MAX_INDEX_LINE_BYTES };
