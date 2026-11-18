import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

const NOW = Date.parse('2026-11-18T12:03:30Z'), MINUTE = Math.floor(NOW / 60000) * 60000;
const intent = () => ({ pairs: ['EUR/USD'], timeframe: '1', higherTimeframes: ['5', '15'], mode: 'BALANCED',
  safeModeEnabled: false, filters: { newsFilterEnabled: true, atrFilterEnabled: true, riskCapEnabled: true } });
const fixture = () => ({ symbol: 'EURUSD', interval: '1m', bars: [0, 1, 2].map(i => ({
  openTime: new Date(MINUTE - i * 60000).toISOString(), open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: i === 0 })) });
const request = () => ({ sourceId: 'biquote', pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY' });
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get, httpsRequest: https.request,
  httpsGet: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
let forbidden = 0, providerCalls = 0, count = 0;
const denyNetwork = () => { forbidden++; throw Error('External IO forbidden'); };
const dependencies = Object.freeze({ fetchImpl: async url => {
  assert.equal(url, 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100'); providerCalls++; return Response.json(fixture());
}, wallNow: () => NOW, monotonicNow: () => 100, idFactory: () => 'test-observation-id' });
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
const codes = result => result.reasons.map(r => r.code);
const assertDenied = result => { assert.equal(result.status, 'DENIED'); assert.equal(result.input, null); assert.equal(result.grantsRuntimeAccess, false); };
let hook;
try {
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = denyNetwork;
  syncBuiltinESMExports();
  globalThis.__analysisInputDependencies = dependencies;
  hook = registerHooks({ load(url, context, next) {
    const result = next(url, context);
    if (url.endsWith('/core/market/service.js?analysis-input-test')) {
      const pattern = /const trustedDependencies = Object\.freeze\(\{ fetchImpl: typeof globalThis\.fetch === 'function' \? globalThis\.fetch : unavailableTransport, wallNow: Date\.now,\s*monotonicNow: performance\.now\.bind\(performance\), idFactory: randomUUID \}\);/;
      assert.match(String(result.source), pattern);
      return { ...result, source: String(result.source).replace(pattern, 'const trustedDependencies = Object.freeze(globalThis.__analysisInputDependencies);') };
    }
    if (url.endsWith('/core/analysis/input.js?analysis-input-test')) {
      const source = String(result.source);
      assert.ok(source.includes("from '../market/service.js';"));
      return { ...result, source: source.replace("from '../market/service.js';", "from '../market/service.js?analysis-input-test';") };
    }
    return result;
  } });
  const api = await import('../core/analysis/input.js');
  const isolated = await import('../core/analysis/input.js?analysis-input-test');
  const market = await import('../core/market/service.js?analysis-input-test');
  const { checkRuntimeAccess } = await import('../core/runtimeGuard.js');
  const { getJointPrediction } = await import('../core/ai/gateway.js');
  const trustedService = market.getTrustedMarketService();
  const dto = await trustedService.observe(request()), observation = dto.observation;
  assert.equal(market.inspectObservationProvenance(trustedService, observation).registered, true);
  const selection = () => ({ primary: observation, higherTimeframes: [] });
  await test('exports have no input constructor, registration operation, session issuer or grant', () => {
    assert.deepEqual(Object.keys(api).sort(), ['assessAnalysisReadiness', 'isTrustedAnalysisInput', 'parseAnalyzeIntent']);
    assert.equal(api.isTrustedAnalysisInput(observation), false);
  });
  await test('strict intent normalization copies arrays and all preferences deeply', () => {
    const raw = intent(); raw.pairs = [' eurusd '];
    const result = api.parseAnalyzeIntent(raw);
    assert.equal(result.ok, true); assert.deepEqual(result.intent.pairs, ['EUR/USD']);
    assert.notEqual(result.intent.higherTimeframes, raw.higherTimeframes);
    assert.notEqual(result.intent.filters, raw.filters);
    raw.pairs[0] = 'GBP/USD'; raw.higherTimeframes[0] = 'D'; raw.filters.newsFilterEnabled = false;
    assert.deepEqual(result.intent.higherTimeframes, ['5', '15']); assert.equal(result.intent.filters.newsFilterEnabled, true);
    for (const value of [result, result.intent, result.intent.pairs, result.intent.higherTimeframes, result.intent.filters]) assert.equal(Object.isFrozen(value), true);
    assert.throws(() => { result.intent.pairs[0] = 'GBP/USD'; }, TypeError);
    assert.throws(() => { result.intent.filters.riskCapEnabled = false; }, TypeError);
    assert.equal(result.grantsRuntimeAccess, false);
  });
  for (const field of ['candles', 'currentPrice', 'quote', 'quoteTimestamp', 'sourceId', 'provider', 'provenance',
    'quality', 'eligibility', 'eligible', 'verified', 'runtimeContext', 'capability', 'analysisSessionId', 'requirements',
    'policy', 'strategyVersion', 'secondsRemaining', 'candleOpenTime', '__proto__']) {
    await test(`intent rejects client field ${field}`, () => {
      const raw = intent(); Object.defineProperty(raw, field, { value: field === 'candles' ? [{ close: 999 }] : true, enumerable: true });
      const parsed = api.parseAnalyzeIntent(raw); assert.equal(parsed.ok, false);
      const r = api.assessAnalysisReadiness(raw, selection()); assertDenied(r); assert.deepEqual(codes(r), ['INVALID_ANALYZE_INTENT']);
    });
  }
  await test('missing keys, wrong primitive types, bad pairs/timeframes and strategy preferences fail closed', () => {
    for (const key of Object.keys(intent())) { const raw = intent(); delete raw[key]; assert.equal(api.parseAnalyzeIntent(raw).ok, false); }
    for (const change of [v => { v.pairs = []; }, v => { v.pairs = ['EUR/USD', 'eurusd']; }, v => { v.pairs = ['not-a-pair']; },
      v => { v.pairs = Array(17).fill('EUR/USD'); }, v => { v.timeframe = 'D'; }, v => { v.timeframe = 1; },
      v => { v.higherTimeframes = ['1']; }, v => { v.higherTimeframes = ['5', '5']; }, v => { v.higherTimeframes = ['UNKNOWN']; },
      v => { v.mode = 'UNKNOWN'; }, v => { v.safeModeEnabled = 'true'; }, v => { v.filters.atrFilterEnabled = 1; },
      v => { v.filters.atrVerified = true; }, v => { v.filters = null; }]) {
      const raw = intent(); change(raw); assert.equal(api.parseAnalyzeIntent(raw).ok, false);
    }
  });
  await test('arrays with holes, extra fields, accessors or proxy wrappers are rejected without getter reads', () => {
    let touched = 0;
    for (const change of [v => { v.pairs = Array(1); }, v => { v.pairs.extra = true; },
      v => { Object.defineProperty(v.pairs, 0, { get() { touched++; throw Error('private'); } }); },
      v => { v.higherTimeframes = new Proxy(v.higherTimeframes, {}); },
      v => { Object.defineProperty(v.filters, 'atrFilterEnabled', { get() { touched++; throw Error('private'); } }); }]) {
      const raw = intent(); change(raw); assert.equal(api.parseAnalyzeIntent(raw).ok, false);
    }
    assert.equal(touched, 0);
  });
  await test('proxy, revoked proxy, symbols and invalid objects cannot enter either boundary', () => {
    let touched = 0;
    const poison = new Proxy({}, { get() { touched++; throw Error('private'); }, ownKeys() { touched++; throw Error('private'); }, getPrototypeOf() { touched++; throw Error('private'); } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const bad of [null, undefined, [], 1, 1n, false, Symbol(), poison, revoked.proxy, new Proxy(intent(), {})]) {
      assert.equal(api.parseAnalyzeIntent(bad).ok, false); assert.equal(api.isTrustedAnalysisInput(bad), false);
      assertDenied(api.assessAnalysisReadiness(bad, selection()));
      assertDenied(api.assessAnalysisReadiness(intent(), bad));
    }
    assert.equal(touched, 0);
  });
  await test('registered DISPLAY observation cannot become a TrustedAnalysisInput', () => {
    const r = isolated.assessAnalysisReadiness(intent(), selection()); assertDenied(r);
    for (const code of ['DIAGNOSTIC_SOURCE_ONLY', 'QUOTE_TIMESTAMP_UNKNOWN', 'MARKET_SESSION_UNCONFIRMED',
      'HIGHER_TIMEFRAMES_MISSING', 'SEPARATE_QUOTE_UNAVAILABLE', 'SERVER_REQUIREMENTS_UNAVAILABLE',
      'STRATEGY_VERSION_UNAVAILABLE', 'ANALYSIS_SESSION_UNBOUND', 'FILTER_EVIDENCE_UNKNOWN', 'TRUSTED_INPUT_CONSTRUCTION_DISABLED']) assert.ok(codes(r).includes(code), code);
    assert.equal(r.quote, null); assert.equal(r.quality, null); assert.equal(r.eligibility, null); assert.equal(r.requirements, null);
    assert.equal(r.strategyVersion, null); assert.equal(r.analysisSessionId, null);
    assert.deepEqual(r.filterEvidence, { news: 'UNKNOWN', atr: 'UNKNOWN', risk: 'UNKNOWN' });
  });
  await test('pair/timeframe mismatch and multi-pair session are explicitly denied', () => {
    for (const [change, code] of [[v => { v.pairs = ['GBP/USD']; }, 'PAIR_MISMATCH'],
      [v => { v.timeframe = '5'; v.higherTimeframes = ['15']; }, 'TIMEFRAME_MISMATCH'],
      [v => { v.pairs = ['EUR/USD', 'GBP/USD']; }, 'SINGLE_PAIR_SESSION_REQUIRED']]) {
      const raw = intent(); change(raw); const r = isolated.assessAnalysisReadiness(raw, selection()); assertDenied(r); assert.ok(codes(r).includes(code));
    }
  });
  await test('requested higher timeframes cannot be filled by M1 or by fabricated M5/M15', () => {
    for (const higherTimeframes of [[observation], [{ ...observation, timeframe: '5' }, { ...observation, timeframe: '15' }]]) {
      const r = isolated.assessAnalysisReadiness(intent(), { primary: observation, higherTimeframes }); assertDenied(r);
      assert.deepEqual(r.missingHigherTimeframes, ['5', '15']);
      assert.ok(codes(r).includes('UNREQUESTED_HIGHER_TIMEFRAME') || codes(r).includes('HIGHER_ORIGIN_UNVERIFIED'));
    }
  });
  await test('canonical boundary rejects different authority, injectable service and forged decision objects', async () => {
    assert.ok(codes(api.assessAnalysisReadiness(intent(), selection())).includes('PRIMARY_ORIGIN_UNVERIFIED'));
    const arbitrary = market.createMarketService(dependencies), arbitraryDTO = await arbitrary.observe(request());
    for (const primary of [arbitraryDTO.observation, { ...observation, quality: { status: 'PASS' }, eligibility: { status: 'ALLOWED' },
      quote: { mid: 1.15, eventAtMs: NOW }, session: 'OPEN', verified: true }, dto, dto.provenance]) {
      const r = isolated.assessAnalysisReadiness(intent(), { primary, higherTimeframes: [] }); assertDenied(r);
      assert.ok(codes(r).includes('PRIMARY_ORIGIN_UNVERIFIED'));
    }
    for (const field of ['quality', 'eligibility', 'service', 'requirements', 'quote']) {
      const r = isolated.assessAnalysisReadiness(intent(), { ...selection(), [field]: true });
      assert.deepEqual(codes(r), ['INVALID_OBSERVATION_SELECTION']);
    }
  });
  await test('JSON/clone may carry an intent but never trusted input identity or observation origin', () => {
    for (const copied of [JSON.parse(JSON.stringify(intent())), structuredClone(intent())]) assert.equal(api.parseAnalyzeIntent(copied).ok, true);
    const fakeInput = { schemaVersion: 1, analysisSessionId: 'fake', pair: 'EUR/USD', timeframe: '1',
      observations: { primary: observation }, provenance: dto.provenance, quality: { status: 'PASS' }, eligibility: { status: 'ALLOWED' }, grantsRuntimeAccess: false };
    for (const fake of [fakeInput, JSON.parse(JSON.stringify(fakeInput)), structuredClone(fakeInput), { ...fakeInput }, new Proxy(fakeInput, {}), dto, observation]) {
      assert.equal(api.isTrustedAnalysisInput(fake), false); assert.equal(isolated.isTrustedAnalysisInput(fake), false);
      assert.equal(checkRuntimeAccess(fake).allowed, false);
    }
    for (const copied of [JSON.parse(JSON.stringify(observation)), structuredClone(observation), { ...observation }]) {
      assert.ok(codes(isolated.assessAnalysisReadiness(intent(), { primary: copied, higherTimeframes: [] })).includes('PRIMARY_ORIGIN_UNVERIFIED'));
    }
  });
  await test('request flags never turn requested news/ATR/risk preferences into verified evidence', () => {
    for (const enabled of [true, false]) {
      const raw = intent(); raw.safeModeEnabled = enabled;
      for (const key of Object.keys(raw.filters)) raw.filters[key] = enabled;
      const r = isolated.assessAnalysisReadiness(raw, selection()); assertDenied(r);
      assert.deepEqual(r.filterEvidence, { news: 'UNKNOWN', atr: 'UNKNOWN', risk: 'UNKNOWN' });
    }
  });
  await test('readiness results retain no mutable request/selection arrays or market aliases', () => {
    const raw = intent(), chosen = selection(), r = isolated.assessAnalysisReadiness(raw, chosen);
    raw.pairs[0] = 'GBP/USD'; raw.higherTimeframes.length = 0; chosen.higherTimeframes.push(observation); chosen.primary = null;
    assert.deepEqual(r.intent.pairs, ['EUR/USD']); assert.deepEqual(r.missingHigherTimeframes, ['5', '15']);
    for (const value of [r, r.reasons, ...r.reasons, r.missingHigherTimeframes, r.filterEvidence]) assert.equal(Object.isFrozen(value), true);
    assert.throws(() => { r.missingHigherTimeframes.push('D'); }, TypeError);
    assert.throws(() => { observation.candles[0].close = 999; }, TypeError);
    assert.throws(() => { observation.timeframe = '5'; }, TypeError);
    assert.equal(r.input, null);
  });
  await test('32 parallel readiness requests are isolated and never acquire additional market data', async () => {
    const before = providerCalls;
    const results = await Promise.all(Array.from({ length: 32 }, async (_, i) => {
      const raw = intent(); if (i % 2) raw.pairs = ['GBP/USD'];
      const r = isolated.assessAnalysisReadiness(raw, selection()); raw.pairs[0] = 'USD/JPY'; return r;
    }));
    assert.equal(providerCalls, before); assert.equal(new Set(results).size, 32);
    results.forEach((r, i) => { assertDenied(r); assert.equal(codes(r).includes('PAIR_MISMATCH'), Boolean(i % 2)); });
  });
  await test('direct Gateway remains SKIP for forged inputs, intents and diagnostic readiness objects', async () => {
    const raw = intent(), r = isolated.assessAnalysisReadiness(raw, selection());
    for (const payload of [null, raw, api.parseAnalyzeIntent(raw), r, { ...observation, currentPrice: 1.15, eligible: true, safeModeEnabled: false }]) {
      const result = await getJointPrediction(payload, { allowed: true, trustedInput: payload });
      assert.equal(result.signal, 'SKIP'); assert.equal(result.tradeId, 0); assert.equal(result.confidence, 0);
    }
  });
  assert.equal(forbidden, 0);
  console.log(`Analysis input isolation: ${count} tests PASS; external IO: 0; trusted inputs/grants issued: 0`);
} finally {
  hook?.deregister(); delete globalThis.__analysisInputDependencies;
  globalThis.fetch = saved.fetch; http.request = saved.request; http.get = saved.get;
  https.request = saved.httpsRequest; https.get = saved.httpsGet;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
}
