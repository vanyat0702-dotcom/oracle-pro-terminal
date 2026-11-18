import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { checkRuntimeAccess } from '../core/runtimeGuard.js';

const NOW = Date.parse('2026-11-18T12:03:30Z'), MINUTE = Math.floor(NOW / 60000) * 60000;
const URL = 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100';
const request = () => ({ sourceId: 'biquote', pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY' });
const fixture = close => ({ symbol: 'EURUSD', interval: '1m', bars: [0, 1, 2].map(i => ({
  openTime: new Date(MINUTE - i * 60000).toISOString(), open: 1.1, high: 1.2, low: 1,
  close, isOpen: i === 0 })) });
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get,
  httpsRequest: https.request, httpsGet: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
let forbidden = 0, count = 0;
const denyNetwork = () => { forbidden++; throw new Error('External IO forbidden'); };
const channels = new Map();
function channel(label) {
  if (!channels.has(label)) {
    const state = { calls: 0, responder: async () => Response.json(fixture(1.15)) };
    state.dependencies = Object.freeze({ fetchImpl: async (url, options) => {
      assert.equal(url, URL); assert.equal(options.redirect, 'error'); state.calls++;
      return state.responder(url, options);
    }, wallNow: () => NOW, monotonicNow: () => 100, idFactory: () => 'deliberately-repeated-snapshot-id' });
    channels.set(label, state);
  }
  return channels.get(label);
}
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
let hook;
try {
  globalThis.fetch = http.request = http.get = https.request = https.get = tls.connect = net.Socket.prototype.connect = denyNetwork;
  syncBuiltinESMExports();
  // Only the isolated test module copies receive mock transport/clocks. The production
  // module has no injection option or test grant. Its registry rejects all test-copy data.
  globalThis.__marketOriginHarness = { dependencies: label => channel(label).dependencies };
  hook = registerHooks({ load(url, context, next) {
    const result = next(url, context);
    const match = url.match(/\/core\/market\/service\.js\?origin-test=([AB])$/);
    if (!match) return result;
    const source = String(result.source);
    const capture = /const trustedDependencies = Object\.freeze\(\{ fetchImpl: typeof globalThis\.fetch === 'function' \? globalThis\.fetch : unavailableTransport, wallNow: Date\.now,\s*monotonicNow: performance\.now\.bind\(performance\), idFactory: randomUUID \}\);/;
    assert.match(source, capture, 'Test instrumentation must match the closed capture exactly');
    return { ...result, source: source.replace(capture,
      `const trustedDependencies = Object.freeze(globalThis.__marketOriginHarness.dependencies('${match[1]}'));`) };
  } });
  const production = await import('../core/market/service.js');
  const a = await import('../core/market/service.js?origin-test=A');
  const b = await import('../core/market/service.js?origin-test=B');
  const serviceA = a.getTrustedMarketService(), serviceB = b.getTrustedMarketService();
  const originA = observation => a.inspectObservationProvenance(serviceA, observation);
  const originB = observation => b.inspectObservationProvenance(serviceB, observation);
  const prodService = production.getTrustedMarketService(); // No acquisition, no real IO.
  let first;
  await test('only acquisition and inspection exported; no register/factory callback exposed', () => {
    for (const mod of [production, a, b]) assert.deepEqual(Object.keys(mod).sort(),
      ['createMarketService', 'getTrustedMarketService', 'inspectObservationProvenance']);
    assert.deepEqual(Object.keys(serviceA), ['observe']); assert.equal(Object.isFrozen(serviceA), true);
    assert.equal(a.getTrustedMarketService(), serviceA);
    for (const arg of [undefined, {}, channel('A').dependencies, { fetchImpl: denyNetwork }, { register() {} }]) {
      assert.throws(() => a.getTrustedMarketService(arg), /accepts no arguments/);
    }
  });
  await test('closed service registers exact immutable observation despite DENIED diagnostic eligibility', async () => {
    first = await serviceA.observe(request());
    const report = originA(first.observation);
    assert.equal(report.registered, true); assert.equal(report.sourceId, 'biquote');
    assert.equal(report.purpose, 'DISPLAY'); assert.equal(report.snapshotId, first.observation.snapshotId);
    assert.equal(first.status, 'DENIED'); assert.equal(first.eligibility.status, 'DENIED');
    assert.equal(first.observation.timing.providerQuoteUpdatedAtMs, null);
    assert.equal(first.observation.session, 'UNKNOWN');
    assert.equal(report.grantsRuntimeAccess, false); assert.equal(report.diagnosticOnly, true);
    assert.equal(first.grantsRuntimeAccess, false);
    assert.deepEqual(Object.keys(first).sort(), ['status', 'diagnosticOnly', 'grantsRuntimeAccess', 'observation', 'provenance', 'quality', 'eligibility', 'reason'].sort());
  });
  await test('snapshotId, source/provider and public trust claims cannot register a forged observation', () => {
    const fake = { ...structuredClone(first.observation), eligible: true, quality: { status: 'PASS' },
      eligibility: { status: 'ALLOWED' }, provenance: { acquisition: 'SERVER_PROVIDER', sourceId: 'biquote' } };
    assert.equal(fake.snapshotId, first.observation.snapshotId); assert.equal(originA(fake).registered, false);
    assert.equal(originA({ snapshotId: first.observation.snapshotId }).registered, false);
  });
  await test('DTO copying/JSON/structuredClone and forged provenance lose origin identity', () => {
    for (const dto of [JSON.parse(JSON.stringify(first)), structuredClone(first), { ...first, observation: { ...first.observation } }]) {
      assert.equal(originA(dto.observation).registered, false);
    }
    for (const fake of [first, first.provenance, originA(first.observation),
      { ...first.observation }, Object.freeze({ ...first.observation }), JSON.parse(JSON.stringify(first.observation))]) {
      assert.equal(originA(fake).registered, false);
    }
    // Copying an envelope while retaining its exact observation reference preserves only that observation's origin.
    assert.equal(originA(({ ...first }).observation).registered, true);
  });
  await test('no registration through injectable services, even exact private test dependency functions', async () => {
    for (const mod of [production, a, b]) {
      let callback = 0;
      const instance = mod.createMarketService({ ...channel('A').dependencies, registerObservation() { callback++; } }, () => callback++);
      const dto = await instance.observe(request());
      assert.equal(callback, 0); assert.equal(originA(dto.observation).registered, false);
      assert.equal(originB(dto.observation).registered, false);
      assert.equal(production.inspectObservationProvenance(prodService, dto.observation).registered, false);
      assert.equal(a.inspectObservationProvenance(instance, first.observation).registered, false);
    }
  });
  await test('public default factory and later global mock fetch cannot enter closed registry', async () => {
    let mockCalls = 0;
    const previous = globalThis.fetch;
    globalThis.fetch = async () => { mockCalls++; return Response.json(fixture(1.16)); };
    try {
      const instance = a.createMarketService({ wallNow: () => NOW });
      const dto = await instance.observe(request());
      assert.equal(mockCalls, 1); assert.equal(originA(dto.observation).registered, false);
      const acquired = await serviceA.observe(request());
      assert.equal(mockCalls, 1); assert.equal(originA(acquired.observation).registered, true);
      assert.equal(acquired.observation.candles.at(-1).close, 1.15);
    } finally { globalThis.fetch = previous; }
  });
  await test('service/authority identities cannot be exchanged, copied, proxied or supplied via this', async () => {
    const other = await serviceB.observe(request());
    assert.equal(originB(other.observation).registered, true); assert.equal(originA(other.observation).registered, false);
    assert.equal(originB(first.observation).registered, false);
    assert.equal(a.inspectObservationProvenance(serviceB, first.observation).registered, false);
    assert.equal(b.inspectObservationProvenance(serviceA, other.observation).registered, false);
    assert.equal(production.inspectObservationProvenance(prodService, first.observation).registered, false);
    for (const fakeService of [null, {}, { ...serviceA }, new Proxy(serviceA, {}), Object.create(serviceA)]) {
      assert.equal(a.inspectObservationProvenance(fakeService, first.observation).registered, false);
    }
    const borrowed = await serviceA.observe.call(a.createMarketService(channel('A').dependencies), request());
    assert.equal(originA(borrowed.observation).registered, true); // Still the closed acquisition channel, independent of this.
  });
  await test('missing bootstrap transport cannot fall back to a later global mock', async () => {
    const previous = globalThis.fetch;
    let mockCalls = 0;
    try {
      globalThis.fetch = undefined;
      const unavailable = await import('../core/market/service.js?origin-transport-unavailable');
      globalThis.fetch = async () => { mockCalls++; return Response.json(fixture(1.15)); };
      const service = unavailable.getTrustedMarketService();
      const dto = await service.observe(request());
      assert.equal(dto.observation, null); assert.equal(dto.reason.code, 'SOURCE_UNAVAILABLE');
      assert.equal(mockCalls, 0);
      assert.equal(unavailable.inspectObservationProvenance(service, first.observation).registered, false);
    } finally { globalThis.fetch = previous; }
  });
  await test('late WeakMap prototype replacement cannot intercept the closed registry', async () => {
    const get = WeakMap.prototype.get, set = WeakMap.prototype.set;
    const state = channel('A'), responder = state.responder;
    const response = Response.json(fixture(1.15)), writes = [];
    state.responder = async () => response;
    let intercepted = 0;
    try {
      WeakMap.prototype.get = function (...args) { intercepted++; return get.apply(this, args); };
      WeakMap.prototype.set = function (...args) { writes.push(args[0]); return set.apply(this, args); };
      assert.equal(originA(first.observation).registered, true);
      // Inspect alone uses no unrelated library WeakMaps, so registry access cannot be captured.
      assert.equal(intercepted, 0);
      const dto = await serviceA.observe(request());
      assert.equal(writes.includes(dto.observation), false);
      assert.equal(originA(dto.observation).registered, true);
    } finally { WeakMap.prototype.get = get; WeakMap.prototype.set = set; state.responder = responder; }
  });
  await test('proxy/revoked proxy/getters and invalid values are rejected without inspection', () => {
    let traps = 0;
    const poison = new Proxy({}, { get() { traps++; throw Error('private'); }, getPrototypeOf() { traps++; throw Error('private'); },
      ownKeys() { traps++; throw Error('private'); } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const fake of [undefined, null, 0, false, 1n, Symbol(), 'snapshot', [], {}, poison, revoked.proxy,
      new Proxy(first.observation, {}), Object.create(first.observation)]) {
      assert.equal(originA(fake).registered, false);
      assert.equal(a.inspectObservationProvenance(fake, first.observation).registered, false);
    }
    assert.equal(traps, 0);
  });
  await test('registered observation, candles, metadata and reports are deeply immutable', () => {
    const o = first.observation, report = originA(o);
    for (const obj of [first, o, o.candles, o.candles[0], o.source, o.timing, first.provenance, first.provenance.requirements, report]) {
      assert.equal(Object.isFrozen(obj), true);
    }
    assert.throws(() => { o.candles[0].close = 999; }, TypeError);
    assert.throws(() => { o.candles.push(o.candles[0]); }, TypeError);
    assert.throws(() => { report.registered = false; }, TypeError);
    const changed = structuredClone(o); changed.candles[0].close = 1.17;
    assert.equal(originA(changed).registered, false); assert.equal(o.candles[0].close, 1.15);
  });
  await test('client mutation during acquisition cannot change captured scope or closed channel', async () => {
    const state = channel('A'), previous = state.responder;
    let release;
    state.responder = () => new Promise(resolve => { release = resolve; });
    try {
      const input = request(), pending = serviceA.observe(input);
      input.sourceId = 'forged'; input.pair = 'GBP/USD'; input.purpose = 'EXECUTION'; input.fetchImpl = denyNetwork;
      const raw = fixture(1.15), response = Response.json(raw);
      raw.bars[0].close = 999;
      release(response); const dto = await pending;
      assert.equal(dto.observation.pair, 'EUR/USD'); assert.equal(dto.observation.candles.at(-1).close, 1.15);
      assert.equal(originA(dto.observation).purpose, 'DISPLAY');
    } finally { state.responder = previous; }
  });
  for (const [name, respond] of [
    ['network failure', async () => { throw Error('private source details'); }],
    ['HTTP error', async () => new Response('', { status: 503 })],
    ['invalid JSON', async () => new Response('invalid')],
    ['empty candles', async () => Response.json({ symbol: 'EURUSD', interval: '1m', bars: [] })],
    ['invalid OHLC', async () => { const f = fixture(1.15); f.bars[0].high = 0; return Response.json(f); }]
  ]) {
    await test(`${name}: no registration or stale fallback; historical origin is not freshness`, async () => {
      const state = channel('A'), previous = state.responder; state.responder = respond;
      try {
        const failed = await serviceA.observe(request());
        assert.equal(failed.observation, null); assert.equal(failed.provenance, null);
        assert.equal(originA(failed).registered, false); assert.equal(originA(null).registered, false);
        assert.equal(JSON.stringify(failed).includes('private source details'), false);
        assert.equal(originA(first.observation).registered, true); // Historical fact only, no live permission.
      } finally { state.responder = previous; }
    });
  }
  await test('unapproved source/pair/timeframe/purpose and trust fields cannot acquire/register', async () => {
    const before = channel('A').calls;
    for (const input of [{ ...request(), sourceId: 'other' }, { ...request(), pair: 'GBP/USD' },
      { ...request(), timeframe: '5' }, { ...request(), purpose: 'LIVE_SIGNAL_ANALYSIS' },
      { ...request(), purpose: 'EXECUTION' }, ...['snapshot', 'snapshotId', 'fetchImpl', 'provenance', 'quality', 'eligible', 'verified'].map(k => ({ ...request(), [k]: true })),
      null, {}, [], new Proxy({}, { getPrototypeOf() { throw Error('private client details'); } })]) {
      const r = await serviceA.observe(input); assert.equal(r.status, 'DENIED'); assert.equal(r.observation, null);
      assert.equal(JSON.stringify(r).includes('private client details'), false);
    }
    assert.equal(channel('A').calls, before);
  });
  await test('repeated checks are idempotent history, not consumable live grants', () => {
    const firstReport = originA(first.observation);
    for (let i = 0; i < 20; i++) {
      assert.equal(originA(first.observation), firstReport);
      assert.equal(checkRuntimeAccess(first.observation).allowed, false);
      assert.equal(checkRuntimeAccess(firstReport).allowed, false);
      assert.equal(checkRuntimeAccess(serviceA).allowed, false);
    }
    assert.equal(originA(JSON.parse(JSON.stringify(firstReport))).registered, false);
  });
  await test('parallel observations have independent identities even with duplicate snapshot IDs', async () => {
    const state = channel('A'), previous = state.responder, releases = [];
    state.responder = () => new Promise(resolve => releases.push(resolve));
    try {
      const pending = Array.from({ length: 24 }, () => serviceA.observe(request()));
      assert.equal(releases.length, 24);
      for (let i = 23; i >= 0; i--) releases[i](Response.json(fixture(1.10 + i / 1000)));
      const results = await Promise.all(pending);
      assert.equal(new Set(results.map(r => r.observation)).size, 24);
      assert.equal(new Set(results.map(r => r.observation.snapshotId)).size, 1);
      for (let i = 0; i < results.length; i++) {
        const o = results[i].observation;
        assert.equal(o.candles.at(-1).close, 1.10 + i / 1000);
        assert.equal(originA(o).registered, true); assert.equal(originB(o).registered, false);
        assert.equal(originA({ ...o }).registered, false);
      }
    } finally { state.responder = previous; }
  });
  assert.equal(forbidden, 0);
  console.log(`Market provenance: ${count} tests PASS; external IO attempts: 0; canonical registry rejects mock-authority data; no runtime grants`);
} finally {
  hook?.deregister(); delete globalThis.__marketOriginHarness;
  globalThis.fetch = saved.fetch; http.request = saved.request; http.get = saved.get;
  https.request = saved.httpsRequest; https.get = saved.httpsGet;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
}
