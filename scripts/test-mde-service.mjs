import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports, registerHooks } from 'node:module';

// Entire suite is offline. Only fetchImpl fixtures are passed to the real provider.
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get,
  httpsRequest: https.request, httpsGet: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
let forbidden = 0;
const deny = () => { forbidden++; throw new Error('External IO forbidden in Market Service tests'); };
globalThis.fetch = http.request = http.get = https.request = https.get = tls.connect = net.Socket.prototype.connect = deny;
syncBuiltinESMExports();
const hook = registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  if (/\/core\/(?:ai\/|analyze\.js$|index\.js$)/.test(resolved.url.replaceAll('\\', '/'))) {
    forbidden++; throw new Error('Trading imports forbidden');
  }
  return resolved;
} });

let count = 0;
async function test(name, fn) { await fn(); count++; console.log(`PASS ${name}`); }
const NOW = Date.parse('2026-11-18T12:03:30Z');
const MINUTE = Math.floor(NOW / 60000) * 60;
const URL = 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100';
const request = () => ({ sourceId: 'biquote', pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY' });
const fixture = () => ({ symbol: 'EURUSD', interval: '1m', bars: [0, 1, 2].map(i => ({
  openTime: new Date((MINUTE - i * 60) * 1000).toISOString(),
  open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: i === 0, volume: 0, tickVolume: 5
})) });
function sequence(values) { let index = 0; return () => { assert.ok(index < values.length, 'Unexpected clock read'); return values[index++]; }; }
function frozen(value) { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }

try {
  const { listSources, resolveSource } = await import('../core/market/sourceRegistry.js');
  const { createMarketService } = await import('../core/market/service.js');
  function setup(fetchImpl = async () => Response.json(fixture()), options = {}) {
    let calls = 0;
    const service = createMarketService({ wallNow: () => NOW, monotonicNow: () => 1000,
      idFactory: () => 'server-mock-id', ...options, fetchImpl: async (url, init) => {
        calls++; assert.equal(url, URL); assert.equal(init.redirect, 'error');
        assert.deepEqual(init.headers, { Accept: 'application/json' });
        return fetchImpl(url, init);
      } });
    return { service, calls: () => calls };
  }

  await test('registry is immutable and diagnostic-only', () => {
    const list = listSources();
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].purposes, ['DISPLAY']);
    assert.deepEqual(list[0].instruments, ['EUR/USD']);
    assert.deepEqual(list[0].timeframes, ['1']);
    assert.throws(() => list.push({}));
    assert.throws(() => list[0].purposes.push('EXECUTION'));
    assert.throws(() => { list[0].endpoint = 'https://example.invalid'; });
    assert.equal(resolveSource(frozen(request())).status, 'APPROVED');
  });
  for (const [field, value, code] of [
    ['sourceId', 'unknown', 'SOURCE_NOT_REGISTERED'], ['pair', 'GBP/USD', 'INSTRUMENT_NOT_APPROVED'],
    ['timeframe', '5', 'TIMEFRAME_NOT_APPROVED'], ['purpose', 'CLOSED_BAR_RESEARCH', 'PURPOSE_NOT_APPROVED'],
    ['purpose', 'LIVE_SIGNAL_ANALYSIS', 'PURPOSE_NOT_APPROVED'], ['purpose', 'EXECUTION', 'PURPOSE_NOT_APPROVED']
  ]) await test(`reject ${field}=${value} before acquisition`, async () => {
    const { service, calls } = setup(); const r = { ...request(), [field]: value };
    assert.equal(resolveSource(r).code, code);
    const result = await service.observe(r);
    assert.equal(result.status, 'DENIED'); assert.equal(result.reason.code, code);
    assert.equal(result.observation, null); assert.equal(calls(), 0);
  });
  for (const field of ['source', 'quality', 'eligible', 'verified', 'timestamp', 'timing', 'session',
    'providerQuoteUpdatedAtMs', 'snapshot', 'candles', 'provider', 'fetchImpl', 'url', 'requirements']) {
    await test(`reject client ${field} without using it`, async () => {
      const { service, calls } = setup();
      const result = await service.observe({ ...request(), [field]: { status: 'PASS', eligible: true, timestamp: NOW } });
      assert.equal(result.reason.code, 'INVALID_MARKET_REQUEST'); assert.equal(result.observation, null); assert.equal(calls(), 0);
    });
  }
  await test('invalid shapes, prototypes, symbols and accessors cannot select a source', async () => {
    const { service, calls } = setup();
    const getter = request(); Object.defineProperty(getter, 'sourceId', { get() { assert.fail('Getter must not run'); } });
    for (const r of [null, [], {}, 'biquote', Object.assign(Object.create({ fake: true }), request()), getter,
      { ...request(), [Symbol('trust')]: true }]) {
      assert.equal((await service.observe(r)).reason.code, 'INVALID_MARKET_REQUEST');
    }
    assert.equal(calls(), 0);
  });
  await test('separate clocks, server provenance, immutable observation; unknown tick/session denied', async () => {
    const { service, calls } = setup(undefined, {
      wallNow: sequence([NOW, NOW + 20, NOW + 30, NOW + 40, NOW + 50]),
      monotonicNow: sequence([1000.1, 1040.2])
    });
    const r = frozen(request()), before = structuredClone(r);
    const result = await service.observe(r);
    assert.equal(calls(), 1); assert.deepEqual(r, before);
    assert.equal(result.status, 'DENIED'); assert.equal(result.grantsRuntimeAccess, false);
    assert.equal(result.quality.status, 'UNKNOWN'); assert.equal(result.eligibility.status, 'DENIED');
    assert.equal(result.eligibility.grantsRuntimeAccess, false);
    assert.equal(result.observation.snapshotId, 'server-mock-id');
    assert.equal(result.provenance.acquisition, 'SERVER_PROVIDER');
    assert.equal(result.provenance.registryVersion, 'mde-phase3b-increment2');
    assert.equal(result.provenance.responseHeadersReceivedAtMs, NOW + 20);
    assert.equal(result.provenance.responseTimeMeaning, 'HEADERS_ONLY');
    assert.deepEqual(result.observation.timing, { requestStartedAtMs: NOW,
      observationCompletedAtMs: NOW + 40, providerQuoteUpdatedAtMs: null, acquisitionDurationMs: 41 });
    assert.equal(result.quality.evaluatedAtMs, NOW + 50);
    assert.equal(result.observation.session, 'UNKNOWN');
    assert.equal(result.quality.checks.providerQuoteUpdatedAtMs.status, 'UNKNOWN');
    assert.equal(result.quality.checks.session.status, 'UNKNOWN');
    assert.equal(result.quality.metrics.quoteAgeMs, null);
    assert.ok(result.observation.candles.every((c, i, all) => !i || c.time > all[i - 1].time));
    assert.throws(() => { result.observation.candles[0].close = 999; });
    assert.throws(() => { result.eligibility.status = 'ALLOWED'; });
    assert.equal('context' in result, false);
    assert.equal('currentPrice' in result.observation, false);
  });
  await test('provider HTTP payload trust claims never become market evidence', async () => {
    const payload = { ...fixture(), source: { provider: 'Other' }, quality: { status: 'PASS' }, eligible: true,
      session: 'OPEN', providerQuoteUpdatedAtMs: NOW, timing: { providerQuoteUpdatedAtMs: NOW } };
    const { service } = setup(async () => Response.json(payload));
    const result = await service.observe(request());
    assert.equal(result.observation.source.provider, 'Biquote');
    assert.equal(result.observation.source.endpoint, URL);
    assert.equal(result.observation.timing.providerQuoteUpdatedAtMs, null);
    assert.equal(result.observation.session, 'UNKNOWN'); assert.equal(result.status, 'DENIED');
  });
  const failures = [
    ['network error', async () => { throw new Error('private secret details'); }, 'SOURCE_UNAVAILABLE'],
    ['HTTP failure', async () => new Response('', { status: 500 }), 'SOURCE_HTTP_ERROR'],
    ['invalid JSON', async () => new Response('bad json'), 'INVALID_JSON'],
    ['empty bars', async () => Response.json({ ...fixture(), bars: [] }), 'INSUFFICIENT_DATA'],
    ['one bar', async () => Response.json({ ...fixture(), bars: fixture().bars.slice(0, 1) }), 'INSUFFICIENT_DATA'],
    ['missing OHLC', async () => { const p = fixture(); delete p.bars[0].high; return Response.json(p); }, 'INVALID_OHLC'],
    ['missing timestamp', async () => { const p = fixture(); delete p.bars[0].openTime; return Response.json(p); }, 'INVALID_TIME'],
    ['stale window', async () => { const p = fixture(); p.bars.forEach(c => { c.openTime = new Date(Date.parse(c.openTime) - 600000).toISOString(); c.isOpen = false; }); return Response.json(p); }, 'STALE_DATA'],
    ['missing open state', async () => { const p = fixture(); delete p.bars[0].isOpen; return Response.json(p); }, 'INVALID_IS_OPEN']
  ];
  for (const [name, fetchImpl, code] of failures) await test(`provider ${name}: no stale/synthetic data or raw error`, async () => {
    const { service } = setup(fetchImpl); const result = await service.observe(request());
    assert.equal(result.status, 'DENIED'); assert.equal(result.reason.code, code);
    assert.equal(result.observation, null); assert.equal(result.provenance, null);
    assert.equal(result.quality, null); assert.equal(result.eligibility, null);
    assert.equal(JSON.stringify(result).includes('private secret'), false);
  });
  await test('a prior fresh observation is never returned after the next provider failure', async () => {
    let first = true;
    const { service } = setup(async () => { if (first) { first = false; return Response.json(fixture()); } throw new Error('offline'); });
    assert.ok((await service.observe(request())).observation);
    assert.equal((await service.observe(request())).observation, null);
  });
  for (const [name, options] of [
    ['unknown wall clock', { wallNow: () => null }],
    ['invalid monotonic clock', { monotonicNow: () => NaN }],
    ['backward monotonic clock', { monotonicNow: sequence([100, 99]) }],
    ['backward receipt clock', { wallNow: sequence([NOW, NOW - 1, NOW, NOW, NOW]) }],
    ['backward evaluation clock', { wallNow: sequence([NOW, NOW, NOW, NOW, NOW - 1]) }]
  ]) await test(name, async () => {
    const { service } = setup(undefined, options); const result = await service.observe(request());
    assert.equal(result.reason.code, 'SERVICE_CLOCK_INVALID'); assert.equal(result.observation, null);
  });
  await test('slow monotonic acquisition reaches unchanged evaluator and is denied', async () => {
    const { service } = setup(undefined, { monotonicNow: sequence([100, 5101]) });
    const result = await service.observe(request());
    assert.equal(result.quality.status, 'FAIL');
    assert.equal(result.quality.checks.acquisitionDuration.status, 'FAIL');
    assert.equal(result.status, 'DENIED');
  });
  await test('invalid observation identity cannot produce a snapshot', async () => {
    const { service } = setup(undefined, { idFactory: () => '' });
    assert.equal((await service.observe(request())).reason.code, 'OBSERVATION_ID_INVALID');
  });
  await test('concurrent acquisitions and later client mutations cannot cross-contaminate observations', async () => {
    const pending = []; let nextId = 0;
    const { service } = setup(() => new Promise(resolve => pending.push(resolve)), { idFactory: () => `server-${++nextId}` });
    const r = request(), first = service.observe(r), second = service.observe(request());
    r.purpose = 'EXECUTION'; r.sourceId = 'unknown';
    const p2 = fixture(); p2.bars[0].close = 1.16;
    pending[1](Response.json(p2)); const b = await second;
    pending[0](Response.json(fixture())); const a = await first;
    assert.equal(a.observation.candles.at(-1).close, 1.15);
    assert.equal(b.observation.candles.at(-1).close, 1.16);
    assert.notEqual(a.observation.snapshotId, b.observation.snapshotId);
    assert.equal(a.eligibility.purpose, 'DISPLAY');
    assert.equal(a.observation.source.provider, 'Biquote');
  });
  assert.equal(forbidden, 0, 'No external IO or trading import attempts');
  console.log(`Market Service/Registry: ${count} deterministic tests PASS; external IO and trading imports: 0`);
} finally {
  globalThis.fetch = saved.fetch; http.request = saved.request; http.get = saved.get;
  https.request = saved.httpsRequest; https.get = saved.httpsGet;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls;
  hook.deregister(); syncBuiltinESMExports();
}
