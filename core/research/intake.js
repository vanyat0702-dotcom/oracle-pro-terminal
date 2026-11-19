import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { types } from 'node:util';
import { getResearchInstrument } from './catalog.js';

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_CANDLES = 100000;
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const fail = code => freeze({ status: 'REJECTED', readiness: 'NOT_READY', grantsRuntimeAccess: false,
  manifest: null, candles: [], errors: [{ code, row: null }] });
function fields(value, required, optional = []) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!required.every(key => Object.hasOwn(descriptors, key)) || Reflect.ownKeys(descriptors).some(key =>
    ![...required, ...optional].includes(key) || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.keys(descriptors).map(key => [key, descriptors[key].value]));
}
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(value) && value.toUpperCase() !== 'UNKNOWN';
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isSafeInteger(ms) && ms > 0 && new Date(ms).toISOString() === value.replace(/(?:\.000)?Z$/, '.000Z') ? ms : null;
}
function optionsData(value) {
  const o = fields(value, ['instrument', 'expectedChecksum', 'asOf']);
  return o && getResearchInstrument(o.instrument) && typeof o.expectedChecksum === 'string' &&
    /^[a-f0-9]{64}$/.test(o.expectedChecksum) && utc(o.asOf) !== null ? o : null;
}
function parseUniqueJson(text) {
  const value = JSON.parse(text);
  // JSON.parse validates syntax; this additional traversal rejects duplicate decoded keys.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  let i = 0;
  function walk(depth) {
    if (depth > 12) throw Error('JSON depth');
    const token = tokens[i++];
    if (token === '{') {
      const keys = new Set();
      if (tokens[i] !== '}') do {
        const key = JSON.parse(tokens[i++]);
        if (keys.has(key)) throw Error('Duplicate JSON key');
        keys.add(key); i++; walk(depth + 1);
      } while (tokens[i] === ',' && ++i);
      i++;
    } else if (token === '[') {
      if (tokens[i] !== ']') do { walk(depth + 1); } while (tokens[i] === ',' && ++i);
      i++;
    }
  }
  walk(0);
  return value;
}
function inspectHistoricalBytes(bytes, options) {
  try {
    const o = optionsData(options);
    if (!o) return fail('INVALID_IMPORT_OPTIONS');
    if (types.isProxy(bytes) || !(bytes instanceof Uint8Array)) return fail('INVALID_FILE_BYTES');
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) return fail('INVALID_FILE_SIZE');
    const copy = Buffer.from(bytes);
    const checksum = createHash('sha256').update(copy).digest('hex');
    if (checksum !== o.expectedChecksum) return fail('CHECKSUM_MISMATCH');
    let input;
    try { input = parseUniqueJson(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(copy)); }
    catch { return fail('INVALID_JSON'); }
    const d = fields(input, ['schemaVersion', 'kind', 'instrument', 'timeframe', 'source', 'license', 'period', 'expectedCandles', 'candles']);
    if (!d || d.schemaVersion !== 1 || !['REAL', 'MOCK'].includes(d.kind) || d.timeframe !== '1' ||
      d.instrument !== o.instrument) return fail('INVALID_DATASET_HEADER');
    const instrument = getResearchInstrument(d.instrument);
    const s = fields(d.source, ['sourceId', 'symbol', 'venue', 'priceBasis']);
    const l = fields(d.license, ['reference', 'permission', 'permittedPurpose']);
    const p = fields(d.period, ['from', 'to']);
    if (!s || !identifier(s.sourceId) || !identifier(s.venue) ||
      ![instrument.pair, instrument.base + instrument.quote].includes(s.symbol) ||
      !['bid', 'ask', 'mid', 'last'].includes(s.priceBasis)) return fail('INVALID_SOURCE');
    if (!l || !identifier(l.reference) || l.permission !== 'DECLARED' || l.permittedPurpose !== 'CLOSED_BAR_RESEARCH') return fail('LICENSE_EVIDENCE_REQUIRED');
    if (d.kind === 'REAL' && [s.sourceId, s.venue, l.reference].some(v => /^MOCK(?:\b|_)/i.test(v))) return fail('MOCK_REAL_MISMATCH');
    const from = p ? utc(p.from) : null, to = p ? utc(p.to) : null, asOf = utc(o.asOf);
    if (from === null || to === null || from % 60000 || to % 60000 || from > to ||
      !Number.isSafeInteger(d.expectedCandles) || d.expectedCandles < 1 || d.expectedCandles > MAX_CANDLES ||
      (to - from) / 60000 + 1 !== d.expectedCandles || to + 60000 > asOf) return fail('INVALID_COVERAGE_MANIFEST');
    if (!Array.isArray(d.candles) || d.candles.length < 1 || d.candles.length > MAX_CANDLES) return fail('INVALID_CANDLE_COUNT');
    const errors = [], candles = [], times = [], seen = new Set();
    let duplicates = 0;
    const error = (code, row) => { if (errors.length < 100) errors.push({ code, row }); };
    for (let i = 0; i < d.candles.length; i++) {
      const c = fields(d.candles[i], ['instrument', 'sourceId', 'sourceSymbol', 'venue', 'priceBasis', 'timestamp', 'open', 'high', 'low', 'close', 'isOpen'], ['volume']);
      if (!c) { error('INVALID_CANDLE_SCHEMA', i); continue; }
      if (c.instrument !== d.instrument || c.sourceId !== s.sourceId || c.sourceSymbol !== s.symbol ||
        c.venue !== s.venue || c.priceBasis !== s.priceBasis) error('MIXED_CANDLE_METADATA', i);
      const time = utc(c.timestamp);
      if (time === null || time % 60000 || time < from || time > to || time + 60000 > asOf) error('INVALID_CANDLE_TIME', i);
      else {
        if (seen.has(time)) { duplicates++; error('DUPLICATE_CANDLE', i); }
        seen.add(time); times.push(time);
        if (times.length > 1 && time <= times[times.length - 2]) error('CANDLES_NOT_ASCENDING', i);
      }
      if (!['open', 'high', 'low', 'close'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k]) && c[k] > 0) ||
        c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close) || c.low > c.high) error('INVALID_OHLC', i);
      if (c.isOpen !== false) error('HISTORICAL_BAR_NOT_CLOSED', i);
      if (Object.hasOwn(c, 'volume') && (typeof c.volume !== 'number' || !Number.isFinite(c.volume) || c.volume < 0)) error('INVALID_VOLUME', i);
      candles.push({ time: time === null ? null : time / 1000, open: c.open, high: c.high, low: c.low, close: c.close,
        isOpen: false, ...(Object.hasOwn(c, 'volume') ? { volume: c.volume } : {}) });
    }
    const missingCandles = d.expectedCandles - seen.size;
    if (missingCandles !== 0) error('MISSING_M1_CANDLES', null);
    if (d.candles.length !== d.expectedCandles) error('CANDLE_COUNT_MISMATCH', null);
    const manifest = { schemaVersion: 1, instrument: d.instrument, pair: instrument.pair, timeframe: '1',
      dataKind: d.kind === 'MOCK' ? 'MOCK' : 'DECLARED_REAL', historyStatus: d.kind === 'MOCK' ? 'MOCK_ONLY' : 'PRESENT_UNVERIFIED',
      readiness: 'NOT_READY', source: s, license: l, metadataEvidence: 'DECLARED_ONLY', permittedPurpose: 'CLOSED_BAR_RESEARCH',
      period: p, actualPeriod: times.length ? { from: new Date(times.reduce((a, b) => Math.min(a, b))).toISOString(),
        to: new Date(times.reduce((a, b) => Math.max(a, b))).toISOString() } : null,
      candleCount: d.candles.length, expectedCandles: d.expectedCandles, missingCandles, duplicates,
      checksum: { algorithm: 'SHA-256', value: checksum, matchesExpected: true }, assessedAsOf: o.asOf,
      qualityStatus: errors.length ? 'FAIL' : 'PASS', grantsRuntimeAccess: false };
    return freeze({ status: errors.length ? 'REJECTED' : 'VALIDATED', readiness: 'NOT_READY', grantsRuntimeAccess: false,
      manifest, candles: errors.length ? [] : candles, errors });
  } catch { return fail('IMPORT_INVALID'); }
}
const localPath = value => typeof value === 'string' && value.length > 0 && !value.includes('\0') &&
  !/^(?:\\\\|\/\/)/.test(value) && (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || /^[A-Za-z]:[\\/]/.test(value));
async function importHistoricalFile(inputPath, options) {
  let file;
  try {
    if (!optionsData(options)) return fail('INVALID_IMPORT_OPTIONS');
    if (!localPath(inputPath)) return fail('LOCAL_FILE_REQUIRED');
    const path = await realpath(resolve(inputPath));
    if (!localPath(path)) return fail('LOCAL_FILE_REQUIRED');
    file = await open(path, 'r');
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_FILE_BYTES) return fail('INVALID_FILE_SIZE');
    const chunks = []; let size = 0;
    while (true) {
      const buffer = Buffer.alloc(65536), { bytesRead } = await file.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > MAX_FILE_BYTES) return fail('INVALID_FILE_SIZE');
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return inspectHistoricalBytes(Buffer.concat(chunks), options);
  } catch (error) { return fail(error?.code === 'ENOENT' ? 'FILE_MISSING' : 'FILE_UNAVAILABLE'); }
  finally { if (file) { try { await file.close(); } catch { return fail('FILE_UNAVAILABLE'); } } }
}
export { MAX_FILE_BYTES, MAX_CANDLES, inspectHistoricalBytes, importHistoricalFile };
