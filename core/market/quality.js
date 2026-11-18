// Pure assessment only: explicit time, no IO, env, clock, mutation or synthesized candles.
const purposes = ['DISPLAY', 'CLOSED_BAR_RESEARCH', 'LIVE_SIGNAL_ANALYSIS', 'EXECUTION'];
const biquoteEndpoint = 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const epoch = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const absent = value => value === null || value === undefined;

/** @returns {value is import('./contracts.js').AnalysisRequirements} */
function validRequirements(value) {
  return object(value) && purposes.includes(value.purpose) && value.pair === 'EUR/USD' && value.timeframe === '1' &&
    Number.isSafeInteger(value.from) && Number.isSafeInteger(value.to) && epoch(value.from * 1000) && epoch(value.to * 1000) &&
    value.from % 60 === 0 && value.to % 60 === 0 && value.from <= value.to &&
    Number.isSafeInteger(value.minCandles) && value.minCandles > 0 && typeof value.allowOpenBar === 'boolean' &&
    ['maxCandleAgeMs', 'maxObservationAgeMs', 'maxQuoteAgeMs', 'maxAcquisitionDurationMs'].every(k => nonnegative(value[k]));
}

/**
 * Strict evidence policy: any unknown check makes the report UNKNOWN (unless another fails).
 * This also applies to DISPLAY/research assessment; the existing diagnostic chart is unaffected.
 * Source identity in a supplied object is not proof of provenance or a runtime capability.
 * @param {unknown} observation
 * @param {unknown} requirements
 * @param {number} nowMs Explicit evaluation epoch milliseconds.
 * @returns {import('./contracts.js').QualityReport}
 */
function assessQuality(observation, requirements, nowMs) {
  const checks = {};
  const metrics = { selectedCount: null, expectedCount: null, candleAgeMs: null,
    observationAgeMs: null, quoteAgeMs: null, acquisitionDurationMs: null,
    duplicates: null, missingCandles: null };
  const check = (name, status, code) => { checks[name] = { status, code: status === 'PASS' ? `${name.toUpperCase()}_PASS` : code }; };
  const finish = () => {
    const entries = Object.values(checks);
    return {
      schemaVersion: 1,
      snapshotId: object(observation) && typeof observation.snapshotId === 'string' ? observation.snapshotId : null,
      evaluatedAtMs: epoch(nowMs) ? nowMs : null,
      status: entries.some(c => c.status === 'FAIL') ? 'FAIL' : entries.some(c => c.status === 'UNKNOWN') ? 'UNKNOWN' : 'PASS',
      checks, metrics,
      reasons: entries.filter(c => c.status !== 'PASS').map(c => ({
        code: c.code, category: 'DATA_INTEGRITY', publicMessage: 'Required market-data evidence is invalid or unknown.'
      }))
    };
  };
  check('clock', epoch(nowMs) ? 'PASS' : 'FAIL', epoch(nowMs) ? 'CLOCK_VALID' : 'INVALID_CLOCK');
  check('requirements', validRequirements(requirements) ? 'PASS' : 'FAIL', validRequirements(requirements) ? 'REQUIREMENTS_VALID' : 'INVALID_REQUIREMENTS');
  if (!epoch(nowMs) || !validRequirements(requirements)) return finish();
  const r = requirements;
  if (!object(observation)) { check('observation', 'UNKNOWN', 'OBSERVATION_MISSING'); return finish(); }
  const o = observation;
  check('identity', o.schemaVersion === 1 && typeof o.snapshotId === 'string' && o.snapshotId.trim().length > 0 &&
    o.pair === r.pair && o.timeframe === r.timeframe ? 'PASS' : 'FAIL', 'OBSERVATION_IDENTITY');
  const source = o.source;
  if (absent(source)) check('source', 'UNKNOWN', 'SOURCE_UNKNOWN');
  else check('source', source.provider === 'Biquote' && source.endpoint === biquoteEndpoint && source.priceBasis === 'mid'
    ? 'PASS' : 'FAIL', 'SOURCE_NOT_APPROVED');
  check('session', o.session === 'OPEN' ? 'PASS' : o.session === 'CLOSED' ? 'FAIL' : 'UNKNOWN',
    o.session === 'OPEN' ? 'SESSION_OPEN' : o.session === 'CLOSED' ? 'SESSION_CLOSED' : 'SESSION_UNKNOWN');
  const timing = object(o.timing) ? o.timing : {};
  for (const field of ['requestStartedAtMs', 'observationCompletedAtMs', 'providerQuoteUpdatedAtMs']) {
    check(field, absent(timing[field]) ? 'UNKNOWN' : epoch(timing[field]) && timing[field] <= nowMs ? 'PASS' : 'FAIL',
      absent(timing[field]) ? 'TIMESTAMP_UNKNOWN' : 'TIMESTAMP_INVALID');
  }
  const complete = checks.observationCompletedAtMs.status === 'PASS';
  if (complete && checks.requestStartedAtMs.status === 'PASS') {
    check('acquisitionOrder', timing.requestStartedAtMs <= timing.observationCompletedAtMs ? 'PASS' : 'FAIL', 'ACQUISITION_TIME_ORDER');
    check('wallAcquisitionDuration', timing.observationCompletedAtMs - timing.requestStartedAtMs <= r.maxAcquisitionDurationMs
      ? 'PASS' : 'FAIL', 'WALL_ACQUISITION_TOO_SLOW');
  }
  if (complete && checks.providerQuoteUpdatedAtMs.status === 'PASS') {
    check('eventOrder', timing.providerQuoteUpdatedAtMs <= timing.observationCompletedAtMs ? 'PASS' : 'FAIL', 'QUOTE_AFTER_RECEIPT');
  }
  if (complete) {
    metrics.observationAgeMs = nowMs - timing.observationCompletedAtMs;
    check('observationFreshness', metrics.observationAgeMs <= r.maxObservationAgeMs ? 'PASS' : 'FAIL', 'OBSERVATION_STALE');
  }
  if (checks.providerQuoteUpdatedAtMs.status === 'PASS') {
    metrics.quoteAgeMs = nowMs - timing.providerQuoteUpdatedAtMs;
    check('quoteFreshness', metrics.quoteAgeMs <= r.maxQuoteAgeMs ? 'PASS' : 'FAIL', 'QUOTE_STALE');
  }
  // No derivation of quote timestamps or durations from receipt time or candle open time.
  if (absent(timing.acquisitionDurationMs)) check('acquisitionDuration', 'UNKNOWN', 'ACQUISITION_DURATION_UNKNOWN');
  else {
    metrics.acquisitionDurationMs = nonnegative(timing.acquisitionDurationMs) ? timing.acquisitionDurationMs : null;
    check('acquisitionDuration', nonnegative(timing.acquisitionDurationMs) && timing.acquisitionDurationMs <= r.maxAcquisitionDurationMs
      ? 'PASS' : 'FAIL', 'ACQUISITION_TOO_SLOW_OR_INVALID');
  }
  if (!Array.isArray(o.candles)) { check('candles', 'UNKNOWN', 'CANDLES_MISSING'); return finish(); }
  if (!o.candles.length) { check('candles', 'FAIL', 'CANDLES_EMPTY'); return finish(); }
  const candles = Array.from(o.candles); // Sparse input is invalid, never silently skipped.
  const timesValid = candles.every(c => object(c) && Number.isSafeInteger(c.time) && epoch(c.time * 1000) &&
    c.time % 60 === 0 && c.time * 1000 <= (complete ? timing.observationCompletedAtMs : nowMs));
  check('candleTimes', timesValid ? 'PASS' : 'FAIL', 'INVALID_CANDLE_TIME');
  check('ohlc', candles.every(c => object(c) && ['open', 'high', 'low', 'close'].every(k =>
    typeof c[k] === 'number' && Number.isFinite(c[k]) && c[k] > 0) &&
    c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close) && c.low <= c.high) ? 'PASS' : 'FAIL', 'INVALID_OHLC');
  check('volume', candles.every(c => object(c) && ['volume', 'tickVolume'].every(k => absent(c[k]) || nonnegative(c[k]))) ? 'PASS' : 'FAIL', 'INVALID_VOLUME');
  if (!timesValid) return finish();
  const minute = complete ? Math.floor(timing.observationCompletedAtMs / 60000) * 60 : null;
  check('openState', !candles.every(c => typeof c.isOpen === 'boolean') ? 'FAIL' : !complete ? 'UNKNOWN' :
    candles.every(c => c.isOpen === (c.time === minute)) ? 'PASS' : 'FAIL', 'OPEN_STATE_UNCONFIRMED');
  metrics.duplicates = candles.length - new Set(candles.map(c => c.time)).size;
  check('duplicates', metrics.duplicates === 0 ? 'PASS' : 'FAIL', 'DUPLICATE_CANDLES');
  check('order', candles.every((c, i) => i === 0 || c.time > candles[i - 1].time) ? 'PASS' : 'FAIL', 'CANDLES_NOT_ASCENDING');
  const selected = candles.filter(c => c.time >= r.from && c.time <= r.to);
  metrics.selectedCount = selected.length;
  metrics.expectedCount = (r.to - r.from) / 60 + 1;
  const uniqueSelected = new Set(selected.map(c => c.time));
  metrics.missingCandles = metrics.expectedCount - uniqueSelected.size;
  check('coverage', metrics.missingCandles === 0 ? 'PASS' : 'FAIL', 'RANGE_NOT_COVERED');
  check('gaps', selected.every((c, i) => i === 0 || c.time - selected[i - 1].time === 60) ? 'PASS' : 'FAIL', 'CANDLE_GAP');
  check('lookback', uniqueSelected.size >= r.minCandles ? 'PASS' : 'FAIL', 'INSUFFICIENT_LOOKBACK');
  check('openBarPolicy', r.allowOpenBar || selected.every(c => c.isOpen === false) ? 'PASS' : 'FAIL', 'OPEN_BAR_NOT_ALLOWED');
  if (selected.length) {
    metrics.candleAgeMs = nowMs - selected.at(-1).time * 1000;
    check('candleFreshness', metrics.candleAgeMs <= r.maxCandleAgeMs ? 'PASS' : 'FAIL', 'CANDLE_STALE');
  } else check('candleFreshness', 'UNKNOWN', 'SELECTED_CANDLES_MISSING');
  return finish();
}

export { assessQuality };
