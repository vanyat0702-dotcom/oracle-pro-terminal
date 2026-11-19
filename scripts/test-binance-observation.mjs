// MOCK only: no listeners, external requests, real datasets or files written.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net'; import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
const saved = [globalThis.fetch, http.request, http.get, https.request, https.get, net.Socket.prototype.connect, tls.connect];
let network = 0, groups = 0;
const block = () => { network++; throw Error('NO_NETWORK'); };
globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = block;
syncBuiltinESMExports();
const { normalizeBinance, createBinanceObservationProvider, BINANCE_URL, BinanceObservationError } = await import('../core/market/binance.js');
const { createObservationHandler, OBSERVATION_PATH } = await import('../server/privateAlpha.js');
const text = await readFile(new URL('../src/components/binanceObservationData.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readBinanceObservation, startBinancePolling, OBSERVATION_URL } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const M = 60000, T = Date.parse('2026-11-19T12:03:00Z'), NOW = T + 30000;
const row = t => [t, '100', '102', '99', '101', '0.12345678', t + 59999, '12.4', 3, '0.01', '1.01', '0'];
const rows = () => [row(T - 3 * M), row(T - 2 * M), row(T - M), row(T)];
const snapshot = () => normalizeBinance(rows(), NOW);
const data = () => ({ success: true, diagnosticOnly: true, snapshot: snapshot() });
const response = (body, status = 200, extra = {}) => {
  const r = new Response(body, { status, headers: { 'content-type': 'application/json', ...extra } });
  Object.defineProperty(r, 'url', { value: BINANCE_URL }); return r;
};
const provider = (fetchImpl, extra = {}) => createBinanceObservationProvider({ fetchImpl, now: () => NOW, monotonicNow: () => 100, ...extra });
async function test(name, run) { await run(); groups++; console.log('PASS ' + name); }
const rejectsCode = (run, code) => assert.rejects(run, e => e.code === code);
const flush = () => new Promise(resolve => setImmediate(resolve));
try {
  await test('MOCK fractional volume, exact fixed Spot/M1 source and current open excluded', () => {
    const s = snapshot(); assert.equal(s.candles.length, 3); assert.equal(s.candles[0].volume, 0.12345678);
    assert.equal(s.quality.excludedOpenCandles, 1); assert.equal(s.grantsRuntimeAccess, false); assert.equal(s.readiness, 'NOT_READY');
    assert.equal(s.timing.providerQuoteUpdatedAtMs, null); assert.ok(Object.isFrozen(s.candles[0]));
  });
  for (const [name, mutate, code] of [
    ['fractional timestamp', r => r[0][0] += 0.1, 'INVALID_TIMESTAMP'],
    ['microseconds not REST milliseconds', r => r[0][0] *= 1000, 'INVALID_TIMESTAMP'],
    ['close boundary', r => r[0][6]++, 'INVALID_TIMESTAMP'],
    ['future', r => { r[3] = row(T + M); }, 'INVALID_TIMESTAMP'],
    ['duplicate', r => { r[1] = r[0]; }, 'DUPLICATE_CANDLE'],
    ['gap', r => r.splice(1, 1), 'DATA_GAP'],
    ['descending', r => r.reverse(), 'OUT_OF_ORDER'],
    ['bad OHLC', r => { r[0][2] = '98'; }, 'INVALID_OHLC'],
    ['NaN', r => { r[0][1] = 'NaN'; }, 'INVALID_DECIMAL'],
    ['negative volume', r => { r[0][5] = '-1'; }, 'INVALID_DECIMAL'],
    ['truncated row', r => r[0].pop(), 'INVALID_KLINE']
  ]) await test('reject ' + name, () => { const r = rows(); mutate(r); assert.throws(() => normalizeBinance(r, NOW), e => e.code === code); });
  await test('publication grace at exact minute boundary; stale after 5s, no invented bar', () => {
    const r = rows().slice(0, 2);
    assert.equal(normalizeBinance(r, T).quality.status, 'PUBLICATION_DELAY');
    assert.equal(normalizeBinance(r, T + 5000).quality.status, 'PUBLICATION_DELAY');
    assert.throws(() => normalizeBinance(r, T + 5001), e => e.code === 'STALE_DATA');
    assert.equal(normalizeBinance(rows().slice(0, 3), T - 1).candles.length, 2);
  });
  await test('too few closed, empty, old and invalid clock refused', () => {
    assert.throws(() => normalizeBinance([row(T - M), row(T)], NOW), /INSUFFICIENT_CLOSED_BARS/);
    assert.throws(() => normalizeBinance([], NOW), /INVALID_CANDLE_COUNT/);
    assert.throws(() => normalizeBinance(rows(), NOW + 5 * M), /STALE_DATA/);
    assert.throws(() => normalizeBinance(rows(), NOW, NOW + 1), /INVALID_CLOCK/);
  });
  await test('fixed URL, no credentials, redirect error, bounded successful mock fetch', async () => {
    let calls = 0;
    const s = await provider(async (url, o) => { calls++; assert.equal(url, BINANCE_URL); assert.equal(o.redirect, 'error');
      assert.equal(o.credentials, 'omit'); assert.deepEqual(o.headers, { Accept: 'application/json' }); return response(JSON.stringify(rows())); }).latest();
    assert.equal(calls, 1); assert.equal(s.timing.acquisitionDurationMs, 0);
    await rejectsCode(() => provider(block).latest({ symbol: 'ETHUSDT', url: 'https://evil' }), 'UNSUPPORTED_REQUEST');
  });
  await test('HTTP errors do not leak upstream body', () => rejectsCode(() => provider(async () => response('SECRET_MOCK', 429)).latest(), 'SOURCE_HTTP_ERROR'));
  await test('wrong destination and redirects refused', async () => {
    await rejectsCode(() => provider(async () => { const r = response('[]'); Object.defineProperty(r, 'redirected', { value: true }); return r; }).latest(), 'UNEXPECTED_SOURCE');
    await rejectsCode(() => provider(async () => new Response('[]')).latest(), 'UNEXPECTED_SOURCE');
  });
  await test('malformed JSON and invalid UTF8 refused', async () => {
    await rejectsCode(() => provider(async () => response('{')).latest(), 'INVALID_JSON');
    await rejectsCode(() => provider(async () => response(new Uint8Array([255]))).latest(), 'INVALID_JSON');
  });
  await test('content type and declared/actual body size bounded', async () => {
    await rejectsCode(() => provider(async () => response('[]', 200, { 'content-type': 'text/html' })).latest(), 'INVALID_CONTENT_TYPE');
    await rejectsCode(() => provider(async () => response('[]', 200, { 'content-length': '999999' })).latest(), 'RESPONSE_TOO_LARGE');
    await rejectsCode(() => provider(async () => response(' '.repeat(262145))).latest(), 'RESPONSE_TOO_LARGE');
  });
  await test('timeout bounds even mock fetch ignoring abort; failures never use cached data', async () => {
    await rejectsCode(() => provider(() => new Promise(() => {}), { timeoutMs: 10 }).latest(), 'SOURCE_TIMEOUT');
    let n = 0; const p = provider(async () => { if (n++) throw Error('SECRET_MOCK'); return response(JSON.stringify(rows())); });
    await p.latest(); await rejectsCode(() => p.latest(), 'SOURCE_UNAVAILABLE');
  });
  await test('clock rollback and monotonic regression refused', async () => {
    let n = 0; await rejectsCode(() => provider(async () => response(JSON.stringify(rows())), { now: () => NOW - n++ }).latest(), 'INVALID_CLOCK');
    n = 0; await rejectsCode(() => provider(async () => response(JSON.stringify(rows())), { monotonicNow: () => 100 - n++ }).latest(), 'INVALID_CLOCK');
  });
  const env = { NODE_ENV: 'development', ORACLE_ALPHA_OBSERVE: '1' };
  const req = (extra = {}) => ({ method: 'GET', url: OBSERVATION_PATH, socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3001', origin: 'http://localhost:5173' }, ...extra });
  async function invoke(handler, request = req()) { const headers = {}; let body; const res = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(s) { body = s === undefined ? null : JSON.parse(s); } }; await handler(request, res); return { status: res.statusCode, body, headers }; }
  await test('local opt-in and exact Host/Origin/path/method; no provider on rejection', async () => {
    let calls = 0; const p = { latest: async () => { calls++; return snapshot(); } };
    for (const e of [{}, { NODE_ENV: 'production', ORACLE_ALPHA_OBSERVE: '1' }]) assert.equal((await invoke(createObservationHandler({ env: e, provider: p }))).status, 404);
    const h = createObservationHandler({ env, provider: p });
    for (const r of [req({ socket: { remoteAddress: '192.168.1.1' } }), req({ headers: { host: 'evil:3001', origin: 'http://localhost:5173' } }),
      req({ headers: { host: '127.0.0.1:3001', origin: 'https://evil' } }), req({ headers: { host: '127.0.0.1:3001' } })]) assert.equal((await invoke(h, r)).status, 403);
    assert.equal((await invoke(h, req({ url: OBSERVATION_PATH + '?symbol=ETHUSDT' }))).status, 404);
    assert.equal((await invoke(h, req({ method: 'POST' }))).status, 405);
    assert.equal((await invoke(h, req({ url: '/api/analyze' }))).status, 404); assert.equal(calls, 0);
    const ok = await invoke(h); assert.equal(ok.status, 200); assert.equal(ok.headers['Access-Control-Allow-Origin'], 'http://localhost:5173'); assert.equal(ok.headers['Cache-Control'], 'no-store');
  });
  await test('global rate limit, busy lock, failure release and safe error response', async () => {
    let resolve, t = 0; const h = createObservationHandler({ env, monotonicNow: () => t, provider: { latest: () => new Promise(r => { resolve = r; }) } });
    const pending = invoke(h); assert.equal((await invoke(h)).status, 429); resolve(snapshot()); await pending;
    t = 9999; assert.equal((await invoke(h)).status, 429);
    const fail = createObservationHandler({ env, provider: { latest: async () => { throw Error('SECRET_MOCK'); } } });
    const r = await invoke(fail); assert.equal(r.status, 503); assert.equal(r.body.error.code, 'SOURCE_UNAVAILABLE'); assert.ok(!JSON.stringify(r).includes('SECRET_MOCK'));
  });
  await test('local PNA preflight allows only fixed GET and never acquires data', async () => {
    const h = createObservationHandler({ env, provider: { latest: () => assert.fail('preflight acquisition') } });
    const headers = { ...req().headers, 'access-control-request-method': 'GET', 'access-control-request-private-network': 'true' };
    const r = await invoke(h, req({ method: 'OPTIONS', headers })); assert.equal(r.status, 204); assert.equal(r.headers['Access-Control-Allow-Private-Network'], 'true');
    assert.equal((await invoke(h, req({ method: 'OPTIONS', headers: { ...headers, 'access-control-request-method': 'POST' } }))).status, 403);
    assert.equal((await invoke(h, req({ method: 'OPTIONS', headers: { ...headers, 'access-control-request-headers': 'authorization' } }))).status, 403);
  });
  await test('body timeout cancels a stalled stream; minute transition during acquisition explicit', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    await rejectsCode(() => provider(async () => response(stream), { timeoutMs: 10 }).latest(), 'SOURCE_TIMEOUT');
    assert.equal(cancelled, true);
    const times = [T - 1, T - 1, T + 1];
    const s = await provider(async () => response(JSON.stringify(rows().slice(0, 3))), { now: () => times.shift() }).latest();
    assert.equal(s.quality.status, 'STRUCTURE_VALID'); assert.equal(s.timing.checkedAtMs, T + 1);
  });
  await test('browser validates fractional OHLCV and expires snapshots independently', () => {
    assert.equal(readBinanceObservation(data(), NOW).candles.length, 3);
    assert.throws(() => readBinanceObservation(data(), NOW + 20001));
    const d = data(); d.snapshot = structuredClone(d.snapshot); d.snapshot.candles[0].volume = -1;
    assert.throws(() => readBinanceObservation(d, NOW));
    const minuteEdge = { success: true, diagnosticOnly: true, snapshot: normalizeBinance(rows(), T + 59999) };
    assert.equal(readBinanceObservation(minuteEdge, T + M).quality.status, 'PUBLICATION_DELAY');
    assert.throws(() => readBinanceObservation(minuteEdge, T + M + 5001));
  });
  function timers() { let id = 0; const pending = new Map(); return { pending, schedule(fn, ms) { pending.set(++id, { fn, ms }); return id; }, cancel(i) { pending.delete(i); }, async run(ms) { const hit = [...pending].find(([, v]) => v.ms === ms); assert.ok(hit, 'timer exists'); pending.delete(hit[0]); hit[1].fn(); await flush(); } }; }
  await test('polling serial, explicit errors stop retries and clear shown data', async () => {
    const clock = timers(); let calls = 0, active = 0, peak = 0, shown = null, errors = 0;
    const stop = startBinancePolling({ ...clock, now: () => NOW, intervalMs: 15, timeoutMs: 80, onData: s => { shown = s; }, onError: () => { shown = null; errors++; },
      fetchImpl: async url => { assert.equal(url, OBSERVATION_URL); calls++; active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return new Response(JSON.stringify(calls === 1 ? data() : { error: { code: 'DATA_GAP' } }), { status: calls === 1 ? 200 : 503 }); } });
    try { await flush(); assert.ok(shown); await clock.run(15); assert.equal(calls, 2); assert.equal(errors, 1); assert.equal(shown, null); assert.equal(peak, 1); assert.equal(clock.pending.size, 0); }
    finally { stop(); }
  });
  await test('polling stop aborts pending work and clears all timers, ignoring late response', async () => {
    const clock = timers(); let finish, signal, updates = 0;
    const stop = startBinancePolling({ ...clock, now: () => NOW, onData: () => updates++, onError: () => updates++, fetchImpl: async (_, o) => { signal = o.signal; return new Promise(r => { finish = r; }); } });
    stop(); assert.equal(signal.aborted, true); assert.equal(clock.pending.size, 0);
    finish(new Response(JSON.stringify(data()))); await flush(); assert.equal(updates, 0);
  });
  await test('polling watchdog stops mock request ignoring abort; no retry or timer leak', async () => {
    const clock = timers(); let errors = 0;
    const stop = startBinancePolling({ ...clock, now: () => NOW, timeoutMs: 80, onData: () => assert.fail(), onError: () => errors++, fetchImpl: () => new Promise(() => {}) });
    try { await clock.run(80); assert.equal(errors, 1); assert.equal(clock.pending.size, 0); } finally { stop(); }
  });
  await test('browser malformed JSON stops with no retry', async () => {
    const clock = timers(); let errors = 0;
    const stop = startBinancePolling({ ...clock, now: () => NOW, onData: () => assert.fail(), onError: () => errors++, fetchImpl: async () => new Response('{') });
    try { await flush(); assert.equal(errors, 1); assert.equal(clock.pending.size, 0); } finally { stop(); }
  });
  assert.equal(network, 0); console.log(`Binance observation: ${groups} MOCK groups PASS; real network=0; real datasets=0; grants=0`);
} finally {
  [globalThis.fetch, http.request, http.get, https.request, https.get, net.Socket.prototype.connect, tls.connect] = saved; syncBuiltinESMExports();
}
