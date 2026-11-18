import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { once } from 'node:events';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { BIQUOTE_URL, MarketDataError, normalizeBiquote, createBiquoteProvider } from '../core/market/biquote.js';
import { registerMarketDataTestRoute } from '../server/marketData.js';

const live = process.argv.includes('--live');
const fixedNow = Date.parse('2026-11-18T12:03:30Z');
function fixture(nowMs = fixedNow) {
  const minute = Math.floor(nowMs / 60000) * 60000;
  return { symbol: 'EURUSD', interval: '1m', bars: [0, 1, 2].map(i => ({
    openTime: new Date(minute - i * 60000).toISOString(),
    open: 1.1, high: 1.2, low: 1, close: 1.15, volume: 0, tickVolume: 10, isOpen: i === 0
  })) };
}
function badFixture(change) { const p = fixture(); change(p); return p; }
let passed = 0;
function pass(name) { passed++; console.log(`PASS ${name}`); }

async function unitChecks() {
  const p = fixture();
  const before = structuredClone(p);
  const snapshot = normalizeBiquote(p, fixedNow);
  assert.deepEqual(p, before, 'Do not mutate upstream');
  assert.deepEqual(snapshot.candles.map(c => c.time), [fixedNow / 1000 - 150, fixedNow / 1000 - 90, fixedNow / 1000 - 30]);
  assert.equal(snapshot.candles.at(-1).isOpen, true);
  assert.equal(snapshot.source.provider, 'Biquote');
  assert.equal(snapshot.quality.tradingEligible, false);
  assert.deepEqual(normalizeBiquote({ ...p, bars: [...p.bars].reverse() }, fixedNow), snapshot);
  pass('UTC seconds, ascending normalization, metadata, no mutation');
  const invalid = [
    ['INVALID_RESPONSE', null],
    ['INVALID_RESPONSE', { ...p, symbol: 'GBPUSD' }],
    ['INVALID_RESPONSE', { ...p, interval: '5m' }],
    ['INSUFFICIENT_DATA', { ...p, bars: [] }],
    ['INSUFFICIENT_DATA', { ...p, bars: [p.bars[0]] }],
    ['INVALID_OHLC', badFixture(x => { x.bars[0].open = '1.1'; })],
    ['INVALID_OHLC', badFixture(x => { x.bars[0].low = 1.19; })],
    ['INVALID_OHLC', badFixture(x => { x.bars[0].high = Infinity; })],
    ['INVALID_OHLC', badFixture(x => { x.bars[0].close = 0; })],
    ['INVALID_TIME', badFixture(x => { x.bars[0].openTime = '2026-02-30T12:03:00Z'; })],
    ['INVALID_TIME', badFixture(x => { x.bars[0].openTime = '2026-11-18T12:03:01Z'; })],
    ['INVALID_TIME', badFixture(x => { x.bars[0].openTime = '2026-11-18T12:03:00'; })],
    ['FUTURE_DATA', badFixture(x => { x.bars[0].openTime = '2026-11-18T12:04:00Z'; })],
    ['INVALID_IS_OPEN', badFixture(x => { x.bars[1].isOpen = true; })],
    ['INVALID_IS_OPEN', badFixture(x => { x.bars[0].isOpen = false; })],
    ['INVALID_IS_OPEN', badFixture(x => { delete x.bars[0].isOpen; })],
    ['INVALID_VOLUME', badFixture(x => { x.bars[0].volume = -1; })],
    ['DUPLICATE_TIME', badFixture(x => { x.bars.push(x.bars[1]); })],
    ['UNORDERED_DATA', badFixture(x => { x.bars = [x.bars[0], x.bars[2], x.bars[1]]; })],
    ['DATA_GAP', badFixture(x => { x.bars.splice(1, 1); })],
    ['STALE_DATA', badFixture(x => { x.bars.forEach(b => { b.openTime = new Date(Date.parse(b.openTime) - 600000).toISOString(); b.isOpen = false; }); })]
  ];
  for (const [code, input] of invalid) {
    assert.throws(() => normalizeBiquote(input, fixedNow), error => error instanceof MarketDataError && error.code === code);
    pass(`reject ${code}`);
  }
  const closed = badFixture(x => { x.bars.shift(); });
  assert.equal(normalizeBiquote(closed, fixedNow).candles.at(-1).isOpen, false);
  pass('recent closed-only window accepted');
  const mock = async (url, options) => {
    assert.equal(url, BIQUOTE_URL);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(fixture());
  };
  const provider = createBiquoteProvider({ fetchImpl: mock, now: () => fixedNow });
  const range = { pair: 'EUR/USD', timeframe: '1', from: fixedNow / 1000 - 180, to: fixedNow / 1000 };
  assert.equal((await provider.getSnapshot(range)).candles.length, 3);
  assert.equal((await provider.getCandles(range)).length, 3);
  await assert.rejects(provider.getSnapshot({ ...range, pair: 'GBP/USD' }), { code: 'UNSUPPORTED_MARKET' });
  await assert.rejects(provider.getSnapshot({ ...range, timeframe: '5' }), { code: 'UNSUPPORTED_MARKET' });
  await assert.rejects(provider.getSnapshot({ ...range, from: range.to }), { code: 'INVALID_RANGE' });
  await assert.rejects(provider.getSnapshot({ ...range, to: range.from + 1, from: range.from - 60 }), { code: 'EMPTY_RANGE' });
  pass('existing MDE interface, fixed scope and range refusal');
  const failures = [
    ['SOURCE_HTTP_ERROR', async () => new Response('', { status: 429 })],
    ['SOURCE_UNAVAILABLE', async () => { throw new Error('private upstream details'); }],
    ['INVALID_JSON', async () => new Response('not json')],
    ['INVALID_RESPONSE', async () => new Response(null)],
    ['RESPONSE_TOO_LARGE', async () => new Response('x'.repeat(262145))],
    ['SOURCE_TIMEOUT', async (_url, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 200);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    })]
  ];
  for (const [code, fetchImpl] of failures) {
    await assert.rejects(createBiquoteProvider({ fetchImpl, timeoutMs: 10 }).latest(), { code });
    pass(`provider ${code}`);
  }
}

async function main() {
  const originals = { fetch: globalThis.fetch, request: http.request, get: http.get,
    httpsRequest: https.request, httpsGet: https.get, connect: net.Socket.prototype.connect,
    tlsConnect: tls.connect, listen: net.Server.prototype.listen };
  const savedEnv = new Map(['ORACLE_MDE_TEST', 'NODE_ENV'].map(k => [k, process.env[k]]));
  let server, port, dotenv, config;
  let mode = 'valid';
  let sourceCalls = 0;
  let forbidden = 0;
  const deny = () => { forbidden++; throw new Error('External network forbidden in mock suite'); };
  const hooks = registerHooks({ resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    if (/\/core\/(?:ai\/|analyze\.js$|index\.js$)/.test(resolved.url.replaceAll('\\', '/'))) {
      forbidden++;
      throw new Error('Trading module forbidden');
    }
    return resolved;
  } });
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, BIQUOTE_URL, 'Only the fixed public Biquote URL is allowed');
      sourceCalls++;
      if (live) return originals.fetch(url, options);
      if (mode === 'unavailable') throw new Error('private upstream details');
      if (mode === 'empty') return Response.json({ symbol: 'EURUSD', interval: '1m', bars: [] });
      if (mode === 'stale') {
        const p = fixture(Date.now() - 600000);
        p.bars.forEach(b => { b.isOpen = false; });
        return Response.json(p);
      }
      return Response.json(fixture(Date.now()));
    };
    if (!live) {
      http.request = http.get = https.request = https.get = tls.connect = deny;
      net.Socket.prototype.connect = function (...args) {
        const options = Array.isArray(args[0]) ? args[0][0] : args[0];
        if (!port || typeof options !== 'object' || options.host !== '127.0.0.1' || Number(options.port) !== port) return deny();
        return originals.connect.apply(this, args);
      };
      syncBuiltinESMExports();
      assert.throws(() => tls.connect({ host: 'example.invalid', port: 443 }));
      forbidden = 0;
      await unitChecks();
    }
    net.Server.prototype.listen = function (...args) {
      assert.equal(server, undefined);
      server = this;
      return originals.listen.call(this, { host: '127.0.0.1', port: 0 }, typeof args.at(-1) === 'function' ? args.at(-1) : undefined);
    };
    process.env.ORACLE_MDE_TEST = '1';
    process.env.NODE_ENV = 'test';
    dotenv = (await import('dotenv')).default;
    config = dotenv.config;
    dotenv.config = () => ({ parsed: {} });
    await import('../server/index.js');
    if (!server.listening) await once(server, 'listening');
    port = server.address().port;
    const request = (path, method = 'GET', body) => new Promise((resolve, reject) => {
      const req = originals.request({ host: '127.0.0.1', port, path, method, agent: false,
        headers: { 'Content-Type': 'application/json' } }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); } catch (error) { reject(error); } });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('Local test timeout')));
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
    const path = '/api/test/market-data/eurusd/m1';
    const valid = await request(path);
    assert.equal(valid.status, 200, JSON.stringify(valid.data));
    assert.equal(valid.headers['cache-control'], 'no-store');
    assert.equal(valid.data.snapshot.quality.status, 'VALID');
    assert.equal(valid.data.snapshot.quality.tradingEligible, false);
    assert.equal(valid.data.diagnosticOnly, true);
    assert.ok(valid.data.snapshot.candles.length >= 2);
    assert.equal(valid.data.snapshot.source.endpoint, BIQUOTE_URL);
    pass(`${live ? 'LIVE' : 'mock'} actual Express route: validated candles`);
    if (live) console.log(JSON.stringify({ count: valid.data.snapshot.candles.length,
      latest: valid.data.snapshot.candles.at(-1), source: valid.data.snapshot.source, quality: valid.data.snapshot.quality }));
    if (!live) {
      for (const [failure, code] of [['unavailable', 'SOURCE_UNAVAILABLE'], ['empty', 'INSUFFICIENT_DATA'], ['stale', 'STALE_DATA']]) {
        mode = failure;
        const res = await request(path);
        assert.equal(res.status, 503);
        assert.equal(res.data.quality.status, 'REJECTED');
        assert.equal(res.data.error.code, code);
        assert.equal(res.data.snapshot, undefined);
        assert.equal(JSON.stringify(res.data).includes('private upstream'), false);
        pass(`HTTP safe refusal ${failure}`);
      }
    }
    const before = sourceCalls;
    assert.equal((await request(`${path}?pair=GBPUSD`)).status, 400);
    delete process.env.ORACLE_MDE_TEST;
    assert.equal((await request(path)).status, 404);
    process.env.ORACLE_MDE_TEST = '1';
    process.env.NODE_ENV = 'production';
    assert.equal((await request(path)).status, 404);
    process.env.NODE_ENV = 'test';
    // A forged forwarded header must not turn a remote socket into a local client.
    let route;
    registerMarketDataTestRoute({ get(_path, handler) { route = handler; } }, { latest() { throw new Error('Must not fetch'); } });
    const remoteRes = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
    await route({ socket: { remoteAddress: '203.0.113.1' }, headers: { 'x-forwarded-for': '127.0.0.1' }, query: {} }, remoteRes);
    assert.equal(remoteRes.code, 404);
    const analysis = await request('/api/analyze', 'POST', { verified: true, eligible: true, safeModeEnabled: false });
    assert.equal(analysis.data.result.signal, 'SKIP');
    assert.equal(analysis.data.result.skipReason.code, 'MARKET_DATA_UNAVAILABLE');
    assert.equal(sourceCalls, before, 'Disabled route/query and trading analysis must not call Biquote');
    assert.equal(forbidden, 0, 'No external network or trading module attempts');
    pass('opt-in/production/query restrictions, analysis isolation');
    console.log(`MDE ${live ? 'LIVE' : 'MOCK'}: ${passed} checks PASS`);
  } finally {
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (config) dotenv.config = config;
    for (const [k, value] of savedEnv) { if (value === undefined) delete process.env[k]; else process.env[k] = value; }
    globalThis.fetch = originals.fetch;
    http.request = originals.request; http.get = originals.get;
    https.request = originals.httpsRequest; https.get = originals.httpsGet;
    net.Socket.prototype.connect = originals.connect; tls.connect = originals.tlsConnect;
    net.Server.prototype.listen = originals.listen;
    hooks.deregister(); syncBuiltinESMExports();
  }
}

main().catch(error => { console.error('MDE checks FAILED:', error); process.exitCode = 1; });
