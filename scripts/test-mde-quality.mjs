import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { assessQuality } from '../core/market/quality.js';
import { evaluateEligibility } from '../core/market/eligibility.js';

const [sourceQuality, sourceEligibility] = await Promise.all([
  readFile(new URL('../core/market/quality.js', import.meta.url), 'utf8'),
  readFile(new URL('../core/market/eligibility.js', import.meta.url), 'utf8')
]);

// Fixtures exist only in this test. Fixed times; no provider, network or AI is imported.
const NOW = Date.parse('2026-11-18T12:03:30Z');
const MINUTE = Math.floor(NOW / 60000) * 60;
const fixture = () => ({ schemaVersion: 1, snapshotId: 'mock-window-1', pair: 'EUR/USD', timeframe: '1',
  source: { provider: 'Biquote', endpoint: 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100', priceBasis: 'mid' },
  timing: { requestStartedAtMs: NOW - 200, observationCompletedAtMs: NOW - 100,
    providerQuoteUpdatedAtMs: NOW - 150, acquisitionDurationMs: 100 }, session: 'OPEN',
  candles: [-2, -1, 0].map(i => ({ time: MINUTE + i * 60, open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: i === 0 }))
});
const requirements = () => ({ purpose: 'DISPLAY', pair: 'EUR/USD', timeframe: '1',
  from: MINUTE - 120, to: MINUTE, minCandles: 3, allowOpenBar: true,
  maxCandleAgeMs: 120000, maxObservationAgeMs: 1000, maxQuoteAgeMs: 1000, maxAcquisitionDurationMs: 200 });
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
function expectCheck(o, r, name, status, now = NOW) {
  const report = assessQuality(o, r, now);
  assert.equal(report.checks[name]?.status, status, JSON.stringify(report));
  assert.equal(evaluateEligibility(o, r, now).status, 'DENIED');
}

test('complete display report is informational, deterministic and immutable-input safe', () => {
  const o = freeze(fixture()), r = freeze(requirements());
  const before = JSON.stringify({ o, r });
  const report = assessQuality(o, r, NOW);
  assert.equal(report.status, 'PASS');
  assert.equal(report.metrics.quoteAgeMs, 150);
  assert.equal(report.metrics.observationAgeMs, 100);
  assert.equal(report.metrics.candleAgeMs, 30000);
  assert.equal(report.metrics.expectedCount, 3);
  assert.equal(report.metrics.missingCandles, 0);
  const decision = evaluateEligibility(o, r, NOW);
  assert.equal(decision.status, 'ALLOWED');
  assert.equal(decision.grantsRuntimeAccess, false);
  assert.equal('context' in decision, false);
  assert.deepEqual(assessQuality(o, r, NOW), report);
  assert.equal(JSON.stringify({ o, r }), before);
  // Mutating a returned report cannot issue or modify any subsequent decision.
  report.checks.clock.status = 'FAIL';
  assert.equal(assessQuality(o, r, NOW).status, 'PASS');
});

for (const [name, change, check, status = 'FAIL'] of [
  ['wrong symbol', o => { o.pair = 'GBP/USD'; }, 'identity'],
  ['wrong timeframe', o => { o.timeframe = '5'; }, 'identity'],
  ['unknown source', o => { o.source.provider = 'Other'; }, 'source'],
  ['wrong source URL', o => { o.source.endpoint = 'https://example.invalid'; }, 'source'],
  ['missing source', o => { o.source = null; }, 'source', 'UNKNOWN'],
  ['closed session', o => { o.session = 'CLOSED'; }, 'session'],
  ['unknown session', o => { o.session = 'UNKNOWN'; }, 'session', 'UNKNOWN'],
  ['zero price', o => { o.candles[0].open = 0; }, 'ohlc'],
  ['negative price', o => { o.candles[0].low = -1; }, 'ohlc'],
  ['NaN price', o => { o.candles[0].high = NaN; }, 'ohlc'],
  ['infinite price', o => { o.candles[0].high = Infinity; }, 'ohlc'],
  ['string price', o => { o.candles[0].open = '1.1'; }, 'ohlc'],
  ['bad high', o => { o.candles[0].high = 1.01; }, 'ohlc'],
  ['bad low', o => { o.candles[0].low = 1.19; }, 'ohlc'],
  ['negative volume', o => { o.candles[0].volume = -1; }, 'volume'],
  ['seconds/milliseconds mixup', o => { o.candles[0].time *= 1000; }, 'candleTimes'],
  ['fractional candle time', o => { o.candles[0].time += 0.5; }, 'candleTimes'],
  ['off-minute candle', o => { o.candles[0].time++; }, 'candleTimes'],
  ['future candle', o => { o.candles[2].time += 60; }, 'candleTimes'],
  ['duplicate', o => { o.candles[1].time = o.candles[0].time; }, 'duplicates'],
  ['descending', o => { o.candles.reverse(); }, 'order'],
  ['interior gap', o => { o.candles.splice(1, 1); }, 'gaps'],
  ['range missing oldest boundary', o => { o.candles.shift(); }, 'coverage'],
  ['range missing newest boundary', o => { o.candles.pop(); }, 'coverage'],
  ['stale open flag', o => { o.candles[0].isOpen = true; }, 'openState'],
  ['closed current candle', o => { o.candles[2].isOpen = false; }, 'openState'],
  ['missing open flag', o => { delete o.candles[0].isOpen; }, 'openState'],
  ['empty candles', o => { o.candles = []; }, 'candles'],
  ['missing candles', o => { delete o.candles; }, 'candles', 'UNKNOWN'],
  ['sparse candles', o => { delete o.candles[1]; }, 'candleTimes'],
  ['null candle', o => { o.candles[0] = null; }, 'candleTimes'],
  ['unknown quote time', o => { o.timing.providerQuoteUpdatedAtMs = null; }, 'providerQuoteUpdatedAtMs', 'UNKNOWN'],
  ['missing quote time', o => { delete o.timing.providerQuoteUpdatedAtMs; }, 'providerQuoteUpdatedAtMs', 'UNKNOWN'],
  ['invalid quote time', o => { o.timing.providerQuoteUpdatedAtMs = '2026-11-18'; }, 'providerQuoteUpdatedAtMs'],
  ['unknown receipt time', o => { o.timing.observationCompletedAtMs = null; }, 'observationCompletedAtMs', 'UNKNOWN'],
  ['unknown start time', o => { o.timing.requestStartedAtMs = null; }, 'requestStartedAtMs', 'UNKNOWN'],
  ['unknown acquisition duration', o => { o.timing.acquisitionDurationMs = null; }, 'acquisitionDuration', 'UNKNOWN'],
  ['negative duration', o => { o.timing.acquisitionDurationMs = -1; }, 'acquisitionDuration'],
  ['start after completion', o => { o.timing.requestStartedAtMs = NOW - 50; }, 'acquisitionOrder'],
  ['quote after receipt', o => { o.timing.providerQuoteUpdatedAtMs = NOW - 50; }, 'eventOrder'],
  ['future event', o => { o.timing.providerQuoteUpdatedAtMs = NOW + 1; }, 'providerQuoteUpdatedAtMs'],
  ['slow acquisition', o => { o.timing.acquisitionDurationMs = 201; }, 'acquisitionDuration'],
  ['slow known wall duration despite short reported monotonic duration', o => { o.timing.requestStartedAtMs = NOW - 301; }, 'wallAcquisitionDuration'],
  ['fresh receipt with stale tick', o => { o.timing.providerQuoteUpdatedAtMs = NOW - 1001; }, 'quoteFreshness']
]) test(name, () => { const o = fixture(); change(o); expectCheck(o, requirements(), check, status); });

test('UNKNOWN timestamp is never replaced by HTTP receipt or candle time', () => {
  const o = fixture(); o.timing.providerQuoteUpdatedAtMs = null;
  const report = assessQuality(o, requirements(), NOW);
  assert.equal(report.status, 'UNKNOWN');
  assert.equal(report.metrics.quoteAgeMs, null);
  assert.equal(evaluateEligibility(o, requirements(), NOW).status, 'DENIED');
});

for (const [name, maxField, age] of [
  ['quote age', 'maxQuoteAgeMs', 150], ['observation age', 'maxObservationAgeMs', 100],
  ['candle age', 'maxCandleAgeMs', 30000], ['duration', 'maxAcquisitionDurationMs', 100]
]) test(`${name}: inclusive limit and 1ms beyond`, () => {
  const r = requirements(); r[maxField] = age;
  assert.equal(assessQuality(fixture(), r, NOW).status, 'PASS');
  r[maxField] = age - 1;
  assert.equal(assessQuality(fixture(), r, NOW).status, 'FAIL');
});

test('selected range reassessed instead of inheriting quality of latest full window', () => {
  const o = fixture(), r = requirements();
  o.quality = { status: 'VALID', tradingEligible: true };
  r.from = MINUTE - 120; r.to = r.from; r.minCandles = 1;
  expectCheck(o, r, 'candleFreshness', 'FAIL'); // selected candle age=150s, although newest age=30s
  r.maxCandleAgeMs = 200000; r.minCandles = 2;
  expectCheck(o, r, 'lookback', 'FAIL');
});
test('range holes cannot be hidden by equal array length or extra out-of-range bars', () => {
  const o = fixture(); o.candles.splice(1, 1); o.candles.unshift({ ...o.candles[0], time: MINUTE - 180 });
  expectCheck(o, requirements(), 'coverage', 'FAIL');
});
test('closed-bar research uses only requested closed range and exact lookback', () => {
  const r = requirements(); r.purpose = 'CLOSED_BAR_RESEARCH'; r.allowOpenBar = false; r.to = MINUTE - 60; r.minCandles = 2;
  assert.equal(evaluateEligibility(fixture(), r, NOW).status, 'ALLOWED');
  r.to = MINUTE; expectCheck(fixture(), r, 'openBarPolicy', 'FAIL');
  r.to = MINUTE - 60; r.allowOpenBar = true;
  assert.equal(evaluateEligibility(fixture(), r, NOW).status, 'DENIED');
});
for (const purpose of ['LIVE_SIGNAL_ANALYSIS', 'EXECUTION']) test(`Biquote ${purpose} always denied, even with all evidence and forged flags`, () => {
  const o = fixture(), r = requirements(); r.purpose = purpose;
  o.verified = true; o.eligible = true; o.quality = { status: 'PASS' }; r.allowLive = true;
  const d = evaluateEligibility(o, r, NOW);
  assert.equal(d.quality.status, 'PASS'); assert.equal(d.status, 'DENIED');
  assert.equal(d.grantsRuntimeAccess, false); assert.ok(d.reasons.some(x => x.code === 'PURPOSE_NOT_APPROVED'));
});

test('minute boundary is evaluated at acquisition, not rewritten at later evaluation', () => {
  const o = fixture(), r = requirements();
  o.timing.requestStartedAtMs = MINUTE * 1000 + 59800;
  o.timing.observationCompletedAtMs = MINUTE * 1000 + 59900;
  o.timing.providerQuoteUpdatedAtMs = MINUTE * 1000 + 59850;
  assert.equal(assessQuality(o, r, MINUTE * 1000 + 60000).status, 'PASS');
  assert.equal(o.candles.at(-1).isOpen, true);
});
test('unknown/malformed requirements and clock fail closed without throwing', () => {
  for (const r of [null, {}, { ...requirements(), from: 1n }, { ...requirements(), minCandles: 0 },
    { ...requirements(), purpose: 'UNKNOWN' }, { ...requirements(), timeframe: '5' },
    { ...requirements(), maxQuoteAgeMs: -1 }, { ...requirements(), to: MINUTE - 180 }]) {
    assert.equal(evaluateEligibility(fixture(), r, NOW).status, 'DENIED');
  }
  for (const now of [undefined, NaN, Infinity, -1, 0, 1.5]) assert.equal(evaluateEligibility(fixture(), requirements(), now).status, 'DENIED');
  assert.equal(evaluateEligibility(null, requirements(), NOW).status, 'DENIED');
});
test('pure modules have no ambient clock/network/env dependency (restricted VM)', () => {
  const qualitySource = sourceQuality.replace(/^export \{ assessQuality \};$/m, 'globalThis.assessQuality = assessQuality;');
  const eligibilitySource = sourceEligibility.replace(/^import .*;$/m, '').replace(/^export \{ evaluateEligibility \};$/m, 'globalThis.evaluateEligibility = evaluateEligibility;');
  const sandbox = { Date: undefined, fetch: undefined, process: undefined, console: undefined, setTimeout: undefined };
  vm.runInNewContext(`${qualitySource}\n${eligibilitySource}`, sandbox);
  assert.equal(sandbox.assessQuality(fixture(), requirements(), NOW).status, 'PASS');
  assert.equal(sandbox.evaluateEligibility(fixture(), requirements(), NOW).status, 'ALLOWED');
});

// Read only source for the VM test; the runtime modules themselves never read files.
console.log(`Quality/Eligibility: ${count} deterministic tests PASS`);
