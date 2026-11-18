// Server-only diagnostic MDE Phase 1. No connection to trading orchestration.
const BIQUOTE_URL = 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100';
const SOURCE = Object.freeze({ provider: 'Biquote', endpoint: BIQUOTE_URL, priceBasis: 'mid' });
const MAX_AGE_SECONDS = 120;

class MarketDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
  }
}

function refuse(code, message) { throw new MarketDataError(code, message); }

function normalizeBiquote(payload, nowMs = Date.now()) {
  if (!Number.isFinite(nowMs) || nowMs <= 0) refuse('INVALID_CLOCK', 'Invalid server clock.');
  if (!payload || payload.symbol !== 'EURUSD' || payload.interval !== '1m' || !Array.isArray(payload.bars)) {
    refuse('INVALID_RESPONSE', 'Expected Biquote EURUSD 1m bars.');
  }
  if (payload.bars.length < 2) refuse('INSUFFICIENT_DATA', 'At least two candles are required.');
  const now = Math.floor(nowMs / 1000);
  const minute = Math.floor(now / 60) * 60;
  const candles = payload.bars.map(bar => {
    if (!bar || typeof bar.openTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(bar.openTime)) {
      refuse('INVALID_TIME', 'Candle open time must be explicit UTC.');
    }
    const ms = Date.parse(bar.openTime);
    if (!Number.isFinite(ms) || new Date(ms).toISOString() !== bar.openTime.replace(/(?:\.000)?Z$/, '.000Z') || ms <= 0 || ms % 60000 !== 0) {
      refuse('INVALID_TIME', 'Candle time must be valid and aligned to M1.');
    }
    const time = ms / 1000;
    if (time > now) refuse('FUTURE_DATA', 'Future candles are rejected.');
    for (const field of ['open', 'high', 'low', 'close']) {
      if (typeof bar[field] !== 'number' || !Number.isFinite(bar[field]) || bar[field] <= 0) {
        refuse('INVALID_OHLC', 'OHLC prices must be finite positive numbers.');
      }
    }
    if (bar.low > Math.min(bar.open, bar.close) || bar.high < Math.max(bar.open, bar.close) || bar.low > bar.high) {
      refuse('INVALID_OHLC', 'OHLC bounds are inconsistent.');
    }
    if (typeof bar.isOpen !== 'boolean' || bar.isOpen !== (time === minute)) {
      refuse('INVALID_IS_OPEN', 'isOpen disagrees with the server UTC minute.');
    }
    for (const field of ['volume', 'tickVolume']) {
      if (bar[field] !== undefined && (!Number.isSafeInteger(bar[field]) || bar[field] < 0)) {
        refuse('INVALID_VOLUME', 'Volume must be a nonnegative safe integer.');
      }
    }
    return {
      time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
      isOpen: bar.isOpen,
      ...(bar.volume === undefined ? {} : { volume: bar.volume }),
      ...(bar.tickVolume === undefined ? {} : { tickVolume: bar.tickVolume })
    };
  });
  const seen = new Set();
  for (const candle of candles) {
    if (seen.has(candle.time)) refuse('DUPLICATE_TIME', 'Duplicate candles are rejected.');
    seen.add(candle.time);
  }
  const descending = candles[1].time < candles[0].time;
  for (let i = 1; i < candles.length; i++) {
    const delta = candles[i].time - candles[i - 1].time;
    if ((descending && delta >= 0) || (!descending && delta <= 0)) refuse('UNORDERED_DATA', 'Mixed candle order is rejected.');
  }
  for (let i = 1; i < candles.length; i++) {
    if (Math.abs(candles[i].time - candles[i - 1].time) !== 60) refuse('DATA_GAP', 'Missing M1 candles; no interpolation is performed.');
  }
  if (descending) candles.reverse();
  const ageSeconds = now - candles.at(-1).time;
  if (ageSeconds > MAX_AGE_SECONDS) refuse('STALE_DATA', 'Latest candle is stale.');
  return {
    pair: 'EUR/USD', timeframe: '1', candles,
    source: SOURCE,
    quality: {
      status: 'VALID', checkedAt: new Date(nowMs).toISOString(), ageSeconds,
      maxAgeSeconds: MAX_AGE_SECONDS, freshnessBasis: 'latest_candle_open_time',
      gaps: 0, duplicates: 0, order: 'ascending', tradingEligible: false
    }
  };
}

// Fixed URL, no auth, retries, synthetic data, or cross-provider fallback.
function createBiquoteProvider({ fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 5000 } = {}) {
  async function latest() {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchImpl(BIQUOTE_URL, {
        signal, redirect: 'error', headers: { Accept: 'application/json' }
      });
      if (!response.ok) refuse('SOURCE_HTTP_ERROR', 'Biquote returned an unsuccessful HTTP status.');
      // Bounded streaming read; never keep an arbitrarily large upstream body.
      const reader = response.body?.getReader();
      if (!reader) refuse('INVALID_RESPONSE', 'Biquote response body is missing.');
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 262144) {
            await reader.cancel();
            refuse('RESPONSE_TOO_LARGE', 'Biquote response exceeds the size limit.');
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { refuse('INVALID_JSON', 'Biquote returned invalid JSON.'); }
      return normalizeBiquote(payload, now());
    } catch (error) {
      if (signal.aborted) refuse('SOURCE_TIMEOUT', 'Biquote request timed out.');
      if (error instanceof MarketDataError) throw error;
      refuse('SOURCE_UNAVAILABLE', 'Biquote is unavailable.');
    }
  }
  async function getSnapshot(request) {
    if (!request || request.pair !== 'EUR/USD' || request.timeframe !== '1') {
      refuse('UNSUPPORTED_MARKET', 'Only EUR/USD M1 is supported.');
    }
    if (!Number.isSafeInteger(request.from) || !Number.isSafeInteger(request.to) || request.from < 0 || request.from >= request.to) {
      refuse('INVALID_RANGE', 'Expected a valid UTC seconds range.');
    }
    const snapshot = await latest();
    const candles = snapshot.candles.filter(c => c.time >= request.from && c.time <= request.to);
    if (candles.length === 0) refuse('EMPTY_RANGE', 'No validated candles in the requested range.');
    return { ...snapshot, candles };
  }
  return { latest, getSnapshot, async getCandles(request) { return (await getSnapshot(request)).candles; } };
}

export { BIQUOTE_URL, SOURCE, MarketDataError, normalizeBiquote, createBiquoteProvider };
