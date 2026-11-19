// Pure offline CSV profiles. No IO, clocks, credentials, grants or inferred source authority.
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const profiles = freeze({
  HISTDATA_ASCII_M1_V1: { id: 'HISTDATA_ASCII_M1_V1', version: 1, provider: 'HistData', sourceId: 'HISTDATA', instrument: 'eurusd',
    sourceSymbol: 'EURUSD', market: 'FOREX', priceBasis: 'bid', timezone: 'EST_FIXED_UTC_MINUS_05', format: 'CSV_UNQUOTED', delimiter: ';', timestampPolicy: 'FIXED_OFFSET' },
  BINANCE_SPOT_KLINE_V1: { id: 'BINANCE_SPOT_KLINE_V1', version: 1, provider: 'Binance', sourceId: 'BINANCE_SPOT', instrument: 'btcusdt',
    sourceSymbol: 'BTCUSDT', market: 'SPOT', priceBasis: 'last', timezone: 'UTC', format: 'CSV_UNQUOTED', delimiter: ',', timestampPolicy: 'SPOT_2025_CUTOVER' }
});
const CUTOVER = 1735689600000;
const reject = error => freeze({ status: 'REJECTED', error });
function getOfflineAdapterProfile(id) { return typeof id === 'string' && Object.hasOwn(profiles, id) ? profiles[id] : null; }
function decimal(s, positive = false) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) && (positive ? n > 0 : n >= 0) ? n : null;
}
function parseSourceLine(profileId, line, units) {
  try {
    const p = getOfflineAdapterProfile(profileId);
    if (!p || typeof line !== 'string' || !line.length || Buffer.byteLength(line) > 65536 || /["\r\n\0]/.test(line)) return reject('INVALID_CSV_LINE');
    const f = line.split(p.delimiter);
    if (f.length !== (p.market === 'FOREX' ? 6 : 12)) return reject('INVALID_CSV_COLUMNS');
    let time, closeTimestamp = null;
    if (p.market === 'FOREX') {
      if (units !== 'EST_FIXED_TEXT') return reject('TIMESTAMP_UNIT_MISMATCH');
      const m = /^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(00)$/.exec(f[0]);
      if (!m) return reject('INVALID_HISTDATA_TIME');
      const text = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`, local = Date.parse(text);
      if (!Number.isSafeInteger(local) || local <= 0 || new Date(local).toISOString() !== text) return reject('INVALID_HISTDATA_TIME');
      time = local + 5 * 60 * 60000; // Fixed EST, deliberately no America/New_York DST.
      if (decimal(f[5]) === null) return reject('INVALID_VOLUME');
    } else {
      if (!['MILLISECONDS', 'MICROSECONDS'].includes(units)) return reject('TIMESTAMP_UNIT_MISMATCH');
      if (![f[0], f[6]].every(s => /^[1-9]\d{0,17}$/.test(s))) return reject('INVALID_BINANCE_TIME');
      const open = BigInt(f[0]), close = BigInt(f[6]), scale = units === 'MILLISECONDS' ? 1n : 1000n;
      if (open % (60000n * scale) !== 0n || close !== open + 60000n * scale - 1n) return reject('INVALID_M1_INTERVAL');
      time = Number(open / scale); closeTimestamp = f[6];
      if (!Number.isSafeInteger(time) || time <= 0 || time > 253402300740000 ||
        (time < CUTOVER ? units !== 'MILLISECONDS' : units !== 'MICROSECONDS')) return reject('TIMESTAMP_UNIT_MISMATCH');
      if ([5, 7, 9, 10, 11].some(i => decimal(f[i]) === null) || !/^(?:0|[1-9]\d*)$/.test(f[8]) || !Number.isSafeInteger(Number(f[8]))) return reject('INVALID_KLINE_FIELDS');
    }
    // Keep normalized UTC inside the same four-digit-year domain as MVP-1A.
    // In particular fixed EST +5h must not silently roll into year 10000.
    if (!Number.isSafeInteger(time) || time <= 0 || time > 253402300740000) return reject('NORMALIZED_TIME_OUT_OF_RANGE');
    const [open, high, low, close] = f.slice(1, 5).map(s => decimal(s, true));
    if ([open, high, low, close].some(n => n === null) || low > Math.min(open, close) || high < Math.max(open, close) || low > high) return reject('INVALID_OHLC');
    return freeze({ status: 'PARSED', bar: { timestamp: new Date(time).toISOString(), open, high, low, close, isOpen: false,
      ...(p.market === 'SPOT' ? { volume: Number(f[5]) } : {}),
      original: { timestamp: f[0], closeTimestamp, fields: f, units, timezone: p.timezone, volumeMeaning: p.market === 'SPOT' ? 'BASE_ASSET' : 'UNAVAILABLE' } } });
  } catch { return reject('INVALID_SOURCE_ROW'); }
}
export { getOfflineAdapterProfile, parseSourceLine };
