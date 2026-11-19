// Offline research only. No provider, AI, repair, ambient clocks or runtime authority.
import { types } from 'node:util';
import { getResearchInstrument } from './catalog.js';
import { importHistoricalFile } from './intake.js';

const M = 60000;
const TIMEFRAMES = Object.freeze({ M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 });
const fail = code => { throw Object.assign(new Error(code), { code }); };
const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const iso = t => new Date(t).toISOString();
function plain(o, required, optional = []) {
  if (!o || typeof o !== 'object' || types.isProxy(o) || Object.getPrototypeOf(o) !== Object.prototype) fail('INVALID_SCHEMA');
  const d = Object.getOwnPropertyDescriptors(o), keys = Reflect.ownKeys(d);
  if (required.some(k => !Object.hasOwn(d, k)) || keys.some(k => typeof k !== 'string' ||
    ![...required, ...optional].includes(k) || !Object.hasOwn(d[k], 'value'))) fail('INVALID_SCHEMA');
  return Object.fromEntries(keys.map(k => [k, d[k].value]));
}
function utc(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(s)) fail('INVALID_TIMESTAMP');
  const t = Date.parse(s);
  if (!Number.isSafeInteger(t) || t <= 0 || t > 253402214400000 || iso(t) !== s.replace(/(?:\.000)?Z$/, '.000Z')) fail('INVALID_TIMESTAMP');
  return t;
}
function options(value, fileMode = false) {
  const o = plain(value, fileMode ? ['dataKind', 'instrument', 'asOf'] : ['dataKind']);
  if (!['MOCK', 'REAL'].includes(o.dataKind)) fail('INVALID_DATA_KIND');
  if (fileMode) { if (!getResearchInstrument(o.instrument)) fail('INVALID_INSTRUMENT'); utc(o.asOf); }
  return freeze(o);
}
function candle(value) {
  const c = plain(value, ['instrument', 'sourceId', 'sourceSymbol', 'venue', 'priceBasis', 'timestamp', 'open', 'high', 'low', 'close', 'isOpen'], ['volume']);
  const instrument = getResearchInstrument(c.instrument);
  if (!instrument || ![instrument.pair, instrument.base + instrument.quote].includes(c.sourceSymbol) ||
    ![c.sourceId, c.venue].every(s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(s) && s.toUpperCase() !== 'UNKNOWN') ||
    !['bid', 'ask', 'mid', 'last'].includes(c.priceBasis)) fail('INVALID_SOURCE');
  const t = utc(c.timestamp);
  if (c.isOpen !== false) fail('M1_NOT_CLOSED');
  if (!['open', 'high', 'low', 'close'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k]) && c[k] > 0) ||
    c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close) || c.low > c.high) fail('INVALID_OHLC');
  if (Object.hasOwn(c, 'volume') && (typeof c.volume !== 'number' || !Number.isFinite(c.volume) || c.volume < 0)) fail('INVALID_VOLUME');
  return { c: freeze({ ...c, timestamp: iso(t) }), t };
}
const binding = c => ({ instrument: c.instrument, sourceId: c.sourceId, sourceSymbol: c.sourceSymbol, venue: c.venue, priceBasis: c.priceBasis });
const same = (a, b) => Object.keys(a).every(k => a[k] === b[k]);
const status = dataKind => ({ dataKind, readiness: 'NOT_READY', grantsRuntimeAccess: false, provisional: true });
// Validate synchronous values before async-generator Promise assimilation reads `then`.
// Iterator implementations themselves are executable caller code, not an untrusted DTO.
async function* snapshots(input, parse) {
  if (input && typeof input[Symbol.iterator] === 'function') {
    for (const value of input) yield parse(value);
  } else {
    for await (const value of input) yield parse(value);
  }
}
function incomplete(b, reason) {
  return { timeframe: b.tf, timestamp: iso(b.start), closeTimestamp: iso(b.end), status: 'INCOMPLETE',
    observedMinutes: b.count, expectedMinutes: TIMEFRAMES[b.tf], missingMinutes: TIMEFRAMES[b.tf] - b.count, reason };
}

/** Pull-driven: never requests a second row before yielding the current row's step. */
async function* replayM1(input, rawOptions) {
  const o = options(rawOptions), active = new Map();
  let source = null, previous = null, count = 0, completedCount = 0, incompleteCount = 0, missingMinutes = 0;
  for await (const { c, t } of snapshots(input, candle)) {
    const s = binding(c);
    if (o.dataKind === 'REAL' && [s.sourceId, s.venue].some(v => /^MOCK(?:\b|_)/i.test(v))) fail('MOCK_REAL_MISMATCH');
    if (source && !same(source, s)) fail('MIXED_SOURCE');
    source ??= s;
    if (previous !== null && t <= previous) fail(t === previous ? 'DUPLICATE_M1' : 'OUT_OF_ORDER_M1');
    const gaps = [], incompleteIntervals = [], completed = [];
    if (previous !== null && t > previous + M) {
      const minutes = (t - previous) / M - 1;
      gaps.push({ from: iso(previous + M), toExclusive: iso(t), missingMinutes: minutes, classification: 'UNCLASSIFIED' });
      missingMinutes += minutes;
    }
    for (const [tf, minutes] of Object.entries(TIMEFRAMES)) {
      const width = minutes * M, start = Math.floor(t / width) * width;
      let b = active.get(tf);
      if (b && b.start !== start) { incompleteIntervals.push(incomplete(b, 'BOUNDARY_OR_GAP')); active.delete(tf); b = null; }
      if (!b) { b = { tf, start, end: start + width, count: 0, open: c.open, high: c.high, low: c.low, close: c.close, volume: 0, hasVolume: true }; active.set(tf, b); }
      b.count++; b.high = Math.max(b.high, c.high); b.low = Math.min(b.low, c.low); b.close = c.close;
      b.hasVolume &&= Object.hasOwn(c, 'volume');
      if (b.hasVolume) { b.volume += c.volume; if (!Number.isFinite(b.volume)) fail('VOLUME_OVERFLOW'); }
      if (t + M === b.end) {
        if (b.count === minutes) completed.push({ ...source, timeframe: tf, timestamp: iso(start), closeTimestamp: iso(b.end),
          open: b.open, high: b.high, low: b.low, close: b.close, isOpen: false,
          ...(b.hasVolume ? { volume: b.volume } : {}) });
        else incompleteIntervals.push(incomplete(b, 'MISSING_M1'));
        active.delete(tf);
      }
    }
    count++; completedCount += completed.length; incompleteCount += incompleteIntervals.length; previous = t;
    yield freeze({ type: 'step', ...status(o.dataKind), source: { ...source }, replayTimestamp: iso(t + M),
      completedM1: c, completed, incompleteIntervals, detectedGaps: gaps });
  }
  if (!count) fail('EMPTY_INPUT');
  const trailing = [...active.values()].map(b => incomplete(b, 'END_OF_INPUT'));
  yield freeze({ type: 'end', ...status(o.dataKind), provisional: false, source: { ...source }, replayTimestamp: iso(previous + M),
    incompleteIntervals: trailing, candleCount: count, completedCount, incompleteCount: incompleteCount + trailing.length, missingMinutes });
}

/** Reads one existing MVP-1A fragment at a time; no archive-sized array or file writes. */
async function* replayHistoricalFiles(files, rawOptions) {
  const o = options(rawOptions, true);
  async function* rows() {
    let original = null;
    for await (const f of snapshots(files, value => plain(value, ['path', 'expectedChecksum']))) {
      const r = await importHistoricalFile(f.path, { instrument: o.instrument, expectedChecksum: f.expectedChecksum, asOf: o.asOf });
      if (r.status !== 'VALIDATED') fail('FRAGMENT_REJECTED');
      const m = r.manifest;
      if (m.dataKind !== (o.dataKind === 'MOCK' ? 'MOCK' : 'DECLARED_REAL')) fail('MIXED_DATA_KIND');
      const meta = { ...m.source, licenseReference: m.license.reference };
      if (original && !same(original, meta)) fail('MIXED_FILE_METADATA');
      original ??= meta;
      for (const c of r.candles) yield { instrument: o.instrument, sourceId: m.source.sourceId, sourceSymbol: m.source.symbol,
        venue: m.source.venue, priceBasis: m.source.priceBasis, timestamp: iso(c.time * 1000),
        open: c.open, high: c.high, low: c.low, close: c.close, isOpen: false,
        ...(Object.hasOwn(c, 'volume') ? { volume: c.volume } : {}) };
    }
  }
  yield* replayM1(rows(), { dataKind: o.dataKind });
}
export { replayM1, replayHistoricalFiles };
