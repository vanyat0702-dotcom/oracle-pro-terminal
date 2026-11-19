// ALPHA-0 diagnostics only. Import never acquires data; no registry/AI/runtime imports.
import { performance } from 'node:perf_hooks';
export const BINANCE_URL = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100&timeZone=0';
export const SOURCE = Object.freeze({ provider: 'Binance', sourceId: 'BINANCE_SPOT', symbol: 'BTCUSDT', market: 'SPOT', priceBasis: 'last', endpoint: BINANCE_URL });
export const PUBLICATION_GRACE_MS = 5000;
const M = 60000, MAX_BYTES = 262144;
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
export class BinanceObservationError extends Error {
  constructor(code) { super(code); this.name = 'BinanceObservationError'; this.code = code; }
}
const fail = code => { throw new BinanceObservationError(code); };
const epoch = n => Number.isSafeInteger(n) && n > 0 && n < 253402214400000;
function decimal(s, positive = false) {
  if (typeof s !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)) fail('INVALID_DECIMAL');
  const n = Number(s); if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0)) fail('INVALID_DECIMAL'); return n;
}
/** REST default timestamps are milliseconds; unlike archive CSV, no 2025 unit switch. */
export function normalizeBinance(payload, checkedAtMs, receivedAtMs = checkedAtMs) {
  if (!epoch(checkedAtMs) || !epoch(receivedAtMs) || receivedAtMs > checkedAtMs) fail('INVALID_CLOCK');
  if (!Array.isArray(payload) || payload.length < 2 || payload.length > 100) fail('INVALID_CANDLE_COUNT');
  const minute = Math.floor(checkedAtMs / M) * M;
  let previous = null;
  const all = payload.map(row => {
    if (!Array.isArray(row) || row.length !== 12) fail('INVALID_KLINE');
    const [openTimeMs, o, h, l, c, v, closeTimeMs] = row;
    if (!epoch(openTimeMs) || openTimeMs % M || closeTimeMs !== openTimeMs + M - 1 || openTimeMs > minute) fail('INVALID_TIMESTAMP');
    if (previous !== null && openTimeMs <= previous) fail(openTimeMs === previous ? 'DUPLICATE_CANDLE' : 'OUT_OF_ORDER');
    if (previous !== null && openTimeMs - previous !== M) fail('DATA_GAP');
    previous = openTimeMs;
    const open = decimal(o, true), high = decimal(h, true), low = decimal(l, true), close = decimal(c, true), volume = decimal(v);
    if (low > Math.min(open, close) || high < Math.max(open, close) || low > high) fail('INVALID_OHLC');
    for (const i of [7, 9, 10]) decimal(row[i]);
    if (!Number.isSafeInteger(row[8]) || row[8] < 0 || row[11] !== '0') fail('INVALID_KLINE');
    return { time: openTimeMs / 1000, openTimeMs, closeTimeMs, open, high, low, close, volume, isOpen: false };
  });
  const candles = all.filter(c => c.openTimeMs + M <= checkedAtMs);
  if (candles.length < 2) fail('INSUFFICIENT_CLOSED_BARS');
  const expected = minute - M, last = candles.at(-1).openTimeMs;
  const delayed = last === expected - M && checkedAtMs - minute <= PUBLICATION_GRACE_MS;
  if (last !== expected && !delayed) fail('STALE_DATA');
  return freeze({ pair: 'BTC/USDT', timeframe: '1', source: SOURCE, candles,
    diagnosticOnly: true, readiness: 'NOT_READY', grantsRuntimeAccess: false,
    timing: { receivedAtMs, checkedAtMs, providerQuoteUpdatedAtMs: null },
    quality: { status: delayed ? 'PUBLICATION_DELAY' : 'STRUCTURE_VALID', tradingEligible: false,
      expectedLastOpenMs: expected, latestClosedAtMs: last + M, publicationGraceMs: PUBLICATION_GRACE_MS,
      gaps: 0, duplicates: 0, excludedOpenCandles: all.length - candles.length,
      clockEvidence: 'LOCAL_SERVER_ONLY', quoteFreshness: 'UNKNOWN' } });
}

export function createBinanceObservationProvider({ fetchImpl = globalThis.fetch, now = Date.now,
  monotonicNow = () => performance.now(), timeoutMs = 5000 } = {}) {
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) fail('INVALID_PROVIDER_OPTIONS');
  return Object.freeze({ async latest(...args) {
    if (args.length) fail('UNSUPPORTED_REQUEST');
    const controller = new AbortController(); let timer, reader;
    const startedAtMs = now(), started = monotonicNow();
    if (!epoch(startedAtMs) || !Number.isFinite(started) || started < 0) fail('INVALID_CLOCK');
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); if (reader) void reader.cancel().catch(() => {});
      reject(new BinanceObservationError('SOURCE_TIMEOUT'));
    }, timeoutMs); });
    const work = async () => {
      const response = await fetchImpl(BINANCE_URL, { signal: controller.signal, redirect: 'error',
        credentials: 'omit', headers: { Accept: 'application/json' } });
      const receivedAtMs = now();
      if (response.redirected || response.url !== BINANCE_URL) fail('UNEXPECTED_SOURCE');
      if (!response.ok) fail('SOURCE_HTTP_ERROR');
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) fail('INVALID_CONTENT_TYPE');
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) fail('RESPONSE_TOO_LARGE');
      reader = response.body?.getReader(); if (!reader) fail('INVALID_BODY');
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength; if (bytes > MAX_BYTES) { await reader.cancel(); fail('RESPONSE_TOO_LARGE'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); reader = null; }
      let payload;
      try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { fail('INVALID_JSON'); }
      const checkedAtMs = now(), ended = monotonicNow();
      if (!epoch(receivedAtMs) || receivedAtMs < startedAtMs || checkedAtMs < receivedAtMs ||
        !Number.isFinite(ended) || ended < started || ended - started > timeoutMs || checkedAtMs - startedAtMs > timeoutMs) fail('INVALID_CLOCK');
      const snapshot = normalizeBinance(payload, checkedAtMs, receivedAtMs);
      return freeze({ ...snapshot, timing: { ...snapshot.timing, startedAtMs, acquisitionDurationMs: ended - started } });
    };
    try { return await Promise.race([work(), timeout]); }
    catch (error) { if (controller.signal.aborted) fail('SOURCE_TIMEOUT'); if (error instanceof BinanceObservationError) throw error; fail('SOURCE_UNAVAILABLE'); }
    finally { clearTimeout(timer); controller.abort(); }
  } });
}
