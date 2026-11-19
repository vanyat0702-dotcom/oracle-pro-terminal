// Research-only local conversion. Operator evidence is recorded, never promoted to runtime authority.
import { types } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, lstat, rename, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOfflineAdapterProfile, parseSourceLine } from './sourceAdapters.js';
import { createResearchCalendar } from './calendar.js';
import { scanResearchArchive } from './archive.js';
import { pilotRoot, pilotParts, within, pilotLines, hashPilotFile, failPilot } from './pilotLocalIO.js';

const MINUTE = 60000, MAX_ROWS_PER_FILE = 100000, FRAGMENT_ROWS = 1000;
const projectRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const sha = x => createHash('sha256').update(x).digest('hex');
const label = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(s) && s.toUpperCase() !== 'UNKNOWN';
const digest = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const keys = (o, names) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === names.length && names.every(k => Object.hasOwn(o, k));
function clonePlain(x, depth = 0) {
  if (depth > 10) failPilot('INVALID_OPTIONS');
  if (x === null || typeof x === 'boolean') return x;
  if (typeof x === 'string') { if (x.length > 4096) failPilot('INVALID_OPTIONS'); return x; }
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (!x || typeof x !== 'object' || types.isProxy(x)) failPilot('INVALID_OPTIONS');
  const array = Array.isArray(x);
  if (array ? Object.getPrototypeOf(x) !== Array.prototype : ![Object.prototype, null].includes(Object.getPrototypeOf(x))) failPilot('INVALID_OPTIONS');
  const ds = Object.getOwnPropertyDescriptors(x), names = Reflect.ownKeys(ds);
  if (names.some(k => typeof k !== 'string' || !Object.hasOwn(ds[k], 'value') || ['__proto__', 'constructor', 'prototype'].includes(k))) failPilot('INVALID_OPTIONS');
  if (array) {
    const n = ds.length.value;
    if (n > 32 || names.length !== n + 1 || !Array.from({ length: n }, (_, i) => Object.hasOwn(ds, String(i))).every(Boolean)) failPilot('INVALID_OPTIONS');
    return Array.from({ length: n }, (_, i) => clonePlain(ds[i].value, depth + 1));
  }
  if (names.length > 24) failPilot('INVALID_OPTIONS');
  return Object.fromEntries(names.map(k => [k, clonePlain(ds[k].value, depth + 1)]));
}
function utc(s, aligned = false) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(s)) return null;
  const n = Date.parse(s);
  return Number.isSafeInteger(n) && n > 0 && (!aligned || n % MINUTE === 0) && new Date(n).toISOString() === s.replace(/(?:\.000)?Z$/, '.000Z') ? n : null;
}
function evidence(e) {
  if (!keys(e, ['path', 'expectedChecksum']) || !digest(e.expectedChecksum)) failPilot('INVALID_EVIDENCE');
  pilotParts(e.path);
}
function originPeriod(file, p) {
  let u; try { u = new URL(file.originRef); } catch { failPilot('INVALID_ORIGIN'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port) failPilot('INVALID_ORIGIN');
  if (p.market === 'FOREX') {
    if (!['histdata.com', 'www.histdata.com'].includes(u.hostname)) failPilot('SOURCE_ORIGIN_MISMATCH');
    return null;
  }
  const m = /^\/data\/spot\/(daily|monthly)\/klines\/BTCUSDT\/1m\/BTCUSDT-1m-(\d{4}-\d{2}(?:-\d{2})?)\.zip$/.exec(u.pathname);
  if (u.hostname !== 'data.binance.vision' || !m || (m[1] === 'daily' ? m[2].length !== 10 : m[2].length !== 7)) failPilot('SPOT_ORIGIN_REQUIRED');
  const from = utc((m[2].length === 7 ? m[2] + '-01' : m[2]) + 'T00:00:00Z', true);
  if (from === null) failPilot('INVALID_ORIGIN_PERIOD');
  const d = new Date(from); if (m[1] === 'daily') d.setUTCDate(d.getUTCDate() + 1); else d.setUTCMonth(d.getUTCMonth() + 1);
  return [from, d.getTime()];
}
function optionsData(input) {
  const o = clonePlain(input);
  if (!keys(o, ['inputRoot', 'profileId', 'dataKind', 'files', 'venue', 'license', 'provenance', 'requestedRange', 'closedBarCutoff', 'calendar', 'output'])) failPilot('INVALID_OPTIONS');
  const p = getOfflineAdapterProfile(o.profileId);
  if (!p || !['REAL', 'MOCK'].includes(o.dataKind) || !Array.isArray(o.files) || !o.files.length || o.files.length > 16) failPilot('INVALID_PROFILE');
  if (!keys(o.provenance, ['reference', 'acquiredAt']) || !label(o.provenance.reference) || utc(o.provenance.acquiredAt) === null) failPilot('INVALID_PROVENANCE');
  if (!keys(o.requestedRange, ['from', 'toExclusive'])) failPilot('INVALID_REQUESTED_RANGE');
  const from = utc(o.requestedRange.from, true), to = utc(o.requestedRange.toExclusive, true), cutoff = utc(o.closedBarCutoff);
  if (from === null || to === null || from >= to || cutoff === null || to > cutoff) failPilot('INVALID_REQUESTED_RANGE');
  if (!keys(o.venue, ['id', 'evidence']) || (o.venue.id !== 'UNKNOWN' && !label(o.venue.id))) failPilot('INVALID_VENUE');
  if (o.venue.id === 'UNKNOWN') { if (o.venue.evidence !== null) failPilot('INVALID_VENUE'); }
  else { evidence(o.venue.evidence); if (p.market === 'SPOT' && o.venue.id !== 'BINANCE_SPOT') failPilot('SPOT_VENUE_REQUIRED'); }
  if (!keys(o.license, ['status', 'reference', 'evidence', 'permittedPurposes']) || !Array.isArray(o.license.permittedPurposes)) failPilot('INVALID_LICENSE');
  if (o.license.status === 'UNKNOWN') {
    if (o.license.reference !== null || o.license.evidence !== null || o.license.permittedPurposes.length) failPilot('INVALID_LICENSE');
  } else {
    if (o.license.status !== 'OPERATOR_REVIEWED_PERSONAL_RESEARCH' || !label(o.license.reference) ||
      o.license.permittedPurposes.length !== 1 || o.license.permittedPurposes[0] !== 'CLOSED_BAR_RESEARCH') failPilot('INVALID_LICENSE');
    evidence(o.license.evidence);
  }
  const seen = new Set();
  for (const f of o.files) {
    if (!keys(f, ['path', 'expectedChecksum', 'sourceId', 'sourceSymbol', 'market', 'units', 'originRef']) || !digest(f.expectedChecksum)) failPilot('INVALID_FILE_DESCRIPTOR');
    pilotParts(f.path);
    if (seen.has(f.path)) failPilot('DUPLICATE_INPUT_FILE'); seen.add(f.path);
    if (f.sourceId !== p.sourceId || f.sourceSymbol !== p.sourceSymbol || f.market !== p.market ||
      !(p.market === 'FOREX' ? f.units === 'EST_FIXED_TEXT' : ['MILLISECONDS', 'MICROSECONDS'].includes(f.units))) failPilot('MIXED_SOURCE_PROFILE');
    originPeriod(f, p);
  }
  if (o.output !== null && (!keys(o.output, ['root', 'name']) || pilotParts(o.output.name).length !== 1)) failPilot('INVALID_OUTPUT');
  return { o: freeze(o), p, from, to, cutoff };
}
function initialReport() {
  return { status: 'PREVIEW_ONLY', profile: null, dataKind: null, readiness: 'NOT_READY', grantsRuntimeAccess: false,
    evidenceStatus: 'DECLARED_ONLY', commercialPermission: 'NOT_GRANTED', redistributionPermission: 'NOT_GRANTED',
    metadata: null, candleCount: 0, fragments: 0, skippedOutsideRange: 0, firstCandle: null, lastCandle: null,
    coverage: 'UNKNOWN', missingTradingMinutes: null, gapMinutes: 0, nonTradingMinutes: 0, gapCount: 0, unexpectedClosedCandles: 0,
    gaps: [], preview: [], sourceFiles: [], evidenceFiles: [], blockedReasons: [], errors: [], output: null };
}
async function scan(config, root, onBar = null) {
  const { o, p, from, to, cutoff } = config, r = initialReport();
  r.profile = p; r.dataKind = o.dataKind;
  r.metadata = { venue: o.venue, license: o.license, provenance: o.provenance, requestedRange: o.requestedRange, closedBarCutoff: o.closedBarCutoff };
  const calendar = createResearchCalendar(o.calendar, { sourceId: p.sourceId, venue: o.venue.id, assetClass: p.market === 'FOREX' ? 'FOREX' : 'CRYPTO' });
  r.missingTradingMinutes = calendar.confidence === 'UNKNOWN' ? null : 0;
  let previousAll = null, previous = null, activeCount = 0;
  function gap(a, b) {
    if (a >= b) return;
    const n = (b - a) / MINUTE; r.gapCount++; r.gapMinutes += n;
    if (r.gaps.length < 16) r.gaps.push({ from: new Date(a).toISOString(), toExclusive: new Date(b).toISOString(), minutes: n });
    const q = calendar.interval(a, b);
    if (q.status !== 'UNKNOWN') { r.missingTradingMinutes += q.tradingMinutes; r.nonTradingMinutes += q.nonTradingMinutes; }
  }
  for (const f of o.files) {
    const period = originPeriod(f, p); let row = 0;
    for await (const text of pilotLines(root, f.path, f.expectedChecksum)) {
      row++; if (row > MAX_ROWS_PER_FILE) failPilot('INPUT_ROW_LIMIT');
      const parsed = parseSourceLine(p.id, text, f.units);
      if (parsed.status !== 'PARSED') failPilot(parsed.error);
      const b = parsed.bar, t = Date.parse(b.timestamp);
      if (period && (t < period[0] || t >= period[1])) failPilot('SOURCE_FILE_PERIOD_MISMATCH');
      if (previousAll !== null && t <= previousAll) failPilot(t === previousAll ? 'DUPLICATE_CANDLE' : 'CANDLES_NOT_ASCENDING');
      previousAll = t;
      if (t < from || t >= to) { r.skippedOutsideRange++; continue; }
      if (t + MINUTE > cutoff) failPilot('BAR_NOT_CLOSED');
      if (t + MINUTE > utc(o.provenance.acquiredAt)) failPilot('ACQUIRED_BEFORE_BAR_CLOSE');
      gap(previous === null ? from : previous + MINUTE, t);
      const q = calendar.interval(t, t + MINUTE); if (q.status !== 'UNKNOWN') r.unexpectedClosedCandles += q.nonTradingMinutes;
      const newFragment = previous === null || previous + MINUTE !== t || activeCount >= FRAGMENT_ROWS;
      if (newFragment) { r.fragments++; activeCount = 0; }
      activeCount++; r.candleCount++; r.firstCandle ??= b.timestamp; r.lastCandle = b.timestamp;
      if (r.preview.length < 8) r.preview.push(b);
      if (onBar) await onBar({ bar: b, path: f.path, row, sourceChecksum: f.expectedChecksum, newFragment });
      previous = t;
    }
    if (!row) failPilot('EMPTY_CSV');
    r.sourceFiles.push({ path: f.path, sha256: f.expectedChecksum, originRef: f.originRef, units: f.units, containerVerification: 'NOT_VERIFIED' });
  }
  if (!r.candleCount) failPilot('NO_SELECTED_BARS');
  gap(previous + MINUTE, to);
  r.coverage = calendar.confidence === 'UNKNOWN' ? 'UNKNOWN' : r.missingTradingMinutes || r.unexpectedClosedCandles ? 'FAIL' : 'PASS';
  if (r.coverage !== 'PASS') r.blockedReasons.push('COVERAGE_' + r.coverage);
  if (o.venue.id === 'UNKNOWN') r.blockedReasons.push('VENUE_UNKNOWN');
  if (o.license.status === 'UNKNOWN') r.blockedReasons.push('LICENSE_UNKNOWN');
  for (const [role, e] of [['VENUE', o.venue.evidence], ['LICENSE', o.license.evidence]]) {
    if (!e) continue;
    try {
      if (await hashPilotFile(root, e.path, 1024 * 1024) !== e.expectedChecksum) failPilot('EVIDENCE_CHECKSUM_MISMATCH');
      r.evidenceFiles.push({ role, path: e.path, sha256: e.expectedChecksum });
    } catch { r.blockedReasons.push(role + '_EVIDENCE_UNVERIFIED'); }
  }
  if (o.dataKind === 'REAL' && [o.provenance.reference, o.license.reference, o.venue.id].some(v => typeof v === 'string' && /^MOCK(?:\b|_)/i.test(v))) r.blockedReasons.push('MOCK_REAL_MISMATCH');
  return r;
}
async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function writeArchive(config, root, expected) {
  const { o, p } = config, parent = await pilotRoot(o.output.root), name = o.output.name;
  // Never allow output anywhere in this checkout, including ignored dist/node_modules/.git.
  if (within(projectRoot, parent)) failPilot('OUTPUT_INSIDE_PROJECT');
  const target = join(parent, name); if (await exists(target)) failPilot('OUTPUT_EXISTS');
  const stage = join(parent, 'pilot-stage-' + randomUUID()), lockPath = join(parent, name + '.pilot-lock');
  let lock, index, lineage, madeStage = false, published = false, publication = null;
  const created = [];
  try {
    lock = await open(lockPath, 'wx'); await mkdir(stage); madeStage = true;
    const openNew = async path => { const fd = await open(join(stage, path), 'wx'); created.push(path); return fd; };
    const writeNew = async (path, text) => { const fd = await openNew(path); try { await fd.writeFile(text, 'utf8'); } finally { await fd.close(); } return sha(text); };
    index = await openNew('index.ndjson'); lineage = await openNew('lineage.ndjson');
    const indexHash = createHash('sha256'), lineageHash = createHash('sha256');
    const indexLine = async x => { const text = JSON.stringify(x) + '\n'; indexHash.update(text); await index.writeFile(text, 'utf8'); };
    const source = { sourceId: p.sourceId, symbol: p.sourceSymbol, venue: o.venue.id, priceBasis: p.priceBasis };
    const license = { reference: o.license.reference, permission: 'DECLARED', permittedPurpose: 'CLOSED_BAR_RESEARCH' };
    await indexLine({ type: 'archive', schemaVersion: 1, instrument: p.instrument, kind: o.dataKind, timeframe: '1', source, license,
      provenance: { declaration: o.provenance.reference, evidence: 'DECLARED_ONLY' }, calendar: o.calendar });
    let candles = [], seq = 0;
    async function flush() {
      if (!candles.length) return;
      const path = 'fragment-' + String(++seq).padStart(6, '0') + '.json', period = { from: candles[0].timestamp, to: candles.at(-1).timestamp };
      const text = JSON.stringify({ schemaVersion: 1, kind: o.dataKind, instrument: p.instrument, timeframe: '1', source, license, period, expectedCandles: candles.length, candles });
      const checksum = await writeNew(path, text); await indexLine({ type: 'fragment', path, expectedChecksum: checksum, period, expectedCandles: candles.length }); candles = [];
    }
    const actual = await scan(config, root, async record => {
      if (record.newFragment) await flush();
      const { original, ...b } = record.bar;
      const c = { instrument: p.instrument, sourceId: p.sourceId, sourceSymbol: p.sourceSymbol, venue: o.venue.id, priceBasis: p.priceBasis, ...b };
      candles.push(c);
      const text = JSON.stringify({ sourceFile: record.path, sourceChecksum: record.sourceChecksum, row: record.row, original, normalized: c }) + '\n';
      lineageHash.update(text); await lineage.writeFile(text, 'utf8');
    });
    if (JSON.stringify(actual) !== JSON.stringify(expected) || actual.blockedReasons.length) failPilot('CONVERSION_CHANGED');
    await flush();
    const closingIndex = index; index = null; await closingIndex.close();
    const closingLineage = lineage; lineage = null; await closingLineage.close();
    const indexChecksum = indexHash.digest('hex'), lineageChecksum = lineageHash.digest('hex');
    let audit; for await (const e of scanResearchArchive({ root: stage, indexPath: 'index.ndjson', expectedIndexChecksum: indexChecksum, instrument: p.instrument, asOf: o.closedBarCutoff })) if (e.type === 'coverage') audit = e.report;
    if (!audit || audit.structure !== 'PASS' || audit.coverage !== 'PASS' || audit.candleCount !== expected.candleCount || audit.fragmentCount !== expected.fragments) failPilot('OUTPUT_VALIDATION_FAILED');
    if (await hashPilotFile(stage, 'lineage.ndjson', Number.MAX_SAFE_INTEGER) !== lineageChecksum) failPilot('OUTPUT_LINEAGE_CORRUPTED');
    const conversionChecksum = await writeNew('conversion.json', JSON.stringify({ schemaVersion: 1, report: expected, indexChecksum, lineageChecksum }));
    if (await hashPilotFile(stage, 'conversion.json') !== conversionChecksum) failPilot('OUTPUT_REPORT_CORRUPTED');
    if (await exists(target) || await pilotRoot(o.output.root) !== parent) failPilot('OUTPUT_CHANGED');
    await rename(stage, target); published = true;
    publication = { directory: target, indexChecksum, lineageChecksum, conversionChecksum };
    return publication;
  } finally {
    let cleanupFailed = false;
    const attempt = async operation => { try { await operation(); } catch { cleanupFailed = true; } };
    if (index) await attempt(() => index.close()); if (lineage) await attempt(() => lineage.close());
    if (madeStage && !published) {
      for (const path of created.reverse()) { const full = join(stage, path); if (!within(stage, full)) failPilot('UNSAFE_CLEANUP'); await attempt(() => unlink(full)); }
      await attempt(() => rmdir(stage)); // Nonrecursive: never remove unexpected files.
    }
    if (lock) { await attempt(() => lock.close()); await attempt(() => unlink(lockPath)); }
    if (cleanupFailed) {
      // A completely validated directory may already be visible. Do not falsely report
      // "no output" after publication; expose the artifact plus a cleanup warning.
      if (published) throw Object.assign(Error('cleanup'), { pilotCode: 'OUTPUT_CLEANUP_FAILED', publishedOutput: publication });
      failPilot('OUTPUT_CLEANUP_FAILED');
    }
  }
}
async function convertResearchPilot(options) {
  let report = initialReport();
  try {
    const config = optionsData(options), root = await pilotRoot(config.o.inputRoot);
    report = await scan(config, root);
    if (config.o.output !== null && !report.blockedReasons.length) {
      report.output = await writeArchive(config, root, report); report.status = 'WRITTEN';
    }
  } catch (e) {
    report.status = e?.publishedOutput ? 'WRITTEN' : 'REJECTED'; report.output = e?.publishedOutput ?? null;
    report.errors.push(e?.pilotCode ?? (e?.code === 'ENOENT' ? 'FILE_MISSING' : e?.code === 'EEXIST' ? 'OUTPUT_LOCKED_OR_EXISTS' : 'PILOT_IO_FAILED'));
  }
  return freeze(report);
}
export { convertResearchPilot, MAX_ROWS_PER_FILE, FRAGMENT_ROWS };
