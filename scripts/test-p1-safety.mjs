import assert from 'node:assert/strict';
import { validateSendResultRequest } from '../core/validate.js';
import { ValidationError } from '../core/errors.js';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { once } from 'node:events';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

let analyzeHandler;

// No .env loading, external sockets, fetch, Telegram or trading modules in this suite.
// The only permitted socket is the test client's connection to our ephemeral loopback server.
async function isolatedHttpChecks() {
  const originals = {
    fetch: globalThis.fetch, request: http.request, get: http.get,
    httpsRequest: https.request, httpsGet: https.get,
    connect: net.Socket.prototype.connect, tlsConnect: tls.connect,
    listen: net.Server.prototype.listen
  };
  let server;
  let port;
  let blocked = 0;
  let tradingImports = 0;
  let dotenv;
  let originalConfig;
  const deny = () => { blocked++; throw new Error('External network disabled by safety suite'); };
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      if (/\/core\/(?:ai\/|analyze\.js$|index\.js$)/.test(resolved.url.replaceAll('\\', '/'))) {
        tradingImports++;
        throw new Error('Trading Core import forbidden in HTTP safety suite');
      }
      return resolved;
    }
  });
  try {
    globalThis.fetch = deny;
    http.request = http.get = https.request = https.get = tls.connect = deny;
    net.Socket.prototype.connect = function (...args) {
      const options = Array.isArray(args[0]) ? args[0][0] : args[0];
      if (!port || typeof options !== 'object' || options.host !== '127.0.0.1' || Number(options.port) !== port) return deny();
      return originals.connect.apply(this, args);
    };
    net.Server.prototype.listen = function (...args) {
      assert.equal(server, undefined, 'Only the Express test server may listen');
      server = this;
      const callback = typeof args.at(-1) === 'function' ? args.at(-1) : undefined;
      return originals.listen.call(this, { host: '127.0.0.1', port: 0 }, callback);
    };
    syncBuiltinESMExports();
    // Self-check the guards without making a real network request.
    assert.throws(() => globalThis.fetch('https://example.invalid'), /network disabled/);
    assert.throws(() => http.request('https://example.invalid'), /network disabled/);
    assert.throws(() => net.Socket.prototype.connect.call({}, { host: 'example.invalid', port: 443 }), /network disabled/);
    assert.throws(() => tls.connect({ host: 'example.invalid', port: 443 }), /network disabled/);
    blocked = 0;

    dotenv = (await import('dotenv')).default;
    originalConfig = dotenv.config;
    dotenv.config = () => ({ parsed: {} });
    analyzeHandler = (await import('../api/analyze.ts')).default;
    await import('../server/index.js');
    if (!server.listening) await once(server, 'listening');
    port = server.address().port;

    const request = (method, path, body) => new Promise((resolve, reject) => {
      const req = originals.request({ host: '127.0.0.1', port, method, path,
        agent: false, headers: { 'Content-Type': 'application/json' } }, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
          catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.setTimeout(3000, () => req.destroy(new Error('Local HTTP test timeout')));
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
    const full = {
      pairs: ['EUR/USD'], timeframe: '5', higherTimeframes: ['15'], mode: 'BALANCED',
      safeModeEnabled: false, secondsRemaining: 12, candleOpenTime: '13:45',
      activeStrategies: [], strategy: 'test',
      filters: { newsFilterEnabled: true, atrFilterEnabled: true, riskCapEnabled: true }
    };
    const cases = [
      ['safe mode off', full],
      ['safe mode on', { ...full, safeModeEnabled: true }],
      ['forged market data', { ...full, safeModeEnabled: true,
        candles: Array.from({ length: 10 }, () => ({ open: 1.1, high: 1.1, low: 1.1, close: 1.1 })),
        currentPrice: 1.1, verified: true, eligible: true,
        marketData: { verified: true }, eligibility: { eligible: true } }],
      ['empty payload', {}],
      ['unknown action', { ...full, action: 'force_analyze', verified: true, eligible: true }]
    ];
    for (const [name, payload] of cases) {
      const expressRes = await request('POST', '/api/analyze', payload);
      const vercelRes = createMockRes();
      await analyzeHandler({ method: 'POST', body: payload }, vercelRes);
      for (const res of [expressRes, vercelRes]) {
        assert.equal(res.statusCode, 200, name);
        assert.equal(res.body.success, true, name);
        assert.equal(res.body.result.signal, 'SKIP', name);
        assert.equal(res.body.result.confidence, 0, name);
        assert.equal(res.body.result.tradeId, 0, name);
        assert.equal(res.body.result.skipReason.code, 'MARKET_DATA_UNAVAILABLE', name);
        assert.equal(res.body.result.skipReason.category, 'MARKET_DATA', name);
      }
      // Ignore the fallback clock label, which can cross a candle boundary between requests.
      const { candleOpenTime: expressTime, ...expressResult } = expressRes.body.result;
      const { candleOpenTime: vercelTime, ...vercelResult } = vercelRes.body.result;
      assert.equal(typeof expressTime, 'string');
      assert.equal(typeof vercelTime, 'string');
      if (payload.candleOpenTime) assert.equal(expressTime, vercelTime);
      assert.deepEqual(expressResult, vercelResult, name);
      console.log(`PASS Express/Vercel: ${name}`);
    }
    for (const payload of [
      { action: 'send_result', pair: 'EUR/USD', direction: 'CALL', candleOpenTime: '13:45',
        tradeId: 777, openPrice: 1.1, closePrice: 1.2, isWin: true, pipsNum: 999 },
      { action: 'send_result' }
    ]) {
      const expressRes = await request('POST', '/api/analyze', payload);
      const vercelRes = createMockRes();
      await analyzeHandler({ method: 'POST', body: payload }, vercelRes);
      for (const res of [expressRes, vercelRes]) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'result_not_recorded_fail_closed');
        assert.equal(res.body.skipReason.category, 'DATA_INTEGRITY');
        for (const field of ['isWin', 'pipsNum', 'result']) assert.equal(field in res.body, false);
      }
    }
    console.log('PASS Express/Vercel: valid and invalid send_result rejected');
    const health = await request('GET', '/api/health');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.body, { status: 'ok', service: 'oracle-pro-terminal-api', backend: 'available' });
    console.log('PASS Express health');
    await testValidateSendResultRequiresFields();
    await testApiAnalyzeSendResultNotRecorded();
    await testApiAnalyzeFailClosedSkip();
    assert.equal(tradingImports, 0, 'No trading Core imports');
    assert.equal(blocked, 0, 'No attempted external network/Telegram/AI calls');
    console.log('PASS original 3 checks; zero trading imports; zero external network attempts');
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    if (originalConfig) dotenv.config = originalConfig;
    globalThis.fetch = originals.fetch;
    http.request = originals.request;
    http.get = originals.get;
    https.request = originals.httpsRequest;
    https.get = originals.httpsGet;
    net.Socket.prototype.connect = originals.connect;
    tls.connect = originals.tlsConnect;
    net.Server.prototype.listen = originals.listen;
    hooks.deregister();
    syncBuiltinESMExports();
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

async function testValidateSendResultRequiresFields() {
  assert.throws(() => validateSendResultRequest({ action: 'send_result' }), ValidationError);
  assert.throws(() => validateSendResultRequest({ action: 'send_result', pair: 'EUR/USD', direction: 'CALL', candleOpenTime: '10:00', tradeId: 'x' }), ValidationError);

  const ok = validateSendResultRequest({
    action: 'send_result',
    pair: 'EUR/USD',
    direction: 'CALL',
    candleOpenTime: '10:00',
    tradeId: 123,
    isWin: true,
    pipsNum: 999,
    openPrice: 1.1,
    closePrice: 1.2
  });
  // Validator normalizes structural fields (including provided prices) but does not
  // make a client-reported result trustworthy; server/API must still refuse recording.
  assert.equal(ok.action, 'send_result');
  assert.equal(ok.pair, 'EUR/USD');
  assert.equal(ok.direction, 'CALL');
  assert.equal(ok.candleOpenTime, '10:00');
  assert.equal(ok.tradeId, 123);
  assert.equal(ok.openPrice, 1.1);
  assert.equal(ok.closePrice, 1.2);
  assert.equal('isWin' in ok, false);
  assert.equal('pipsNum' in ok, false);
}

async function testApiAnalyzeSendResultNotRecorded() {
  const req = {
    method: 'POST',
    body: {
      action: 'send_result',
      pair: 'EUR/USD',
      direction: 'CALL',
      candleOpenTime: '10:00',
      tradeId: 777,
      isWin: true,
      pipsNum: 50,
      openPrice: 1.10000,
      closePrice: 1.10500
    }
  };
  const res = createMockRes();
  await analyzeHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, false);
  assert.equal(res.body?.status, 'result_not_recorded_fail_closed');
  assert.equal(res.body?.skipReason?.code, 'UNVERIFIED_TRADE_RESULT');
  assert.equal(res.body?.skipReason?.category, 'DATA_INTEGRITY');
  assert.equal('isWin' in (res.body || {}), false);
  assert.equal('pipsNum' in (res.body || {}), false);
  assert.equal('result' in (res.body || {}) && res.body.result?.signal === 'WIN', false);
}

async function testApiAnalyzeFailClosedSkip() {
  const req = {
    method: 'POST',
    body: {
      pairs: ['EUR/USD'],
      timeframe: '1',
      safeModeEnabled: true
    }
  };
  const res = createMockRes();
  await analyzeHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.equal(res.body?.result?.signal, 'SKIP');
  assert.equal(res.body?.result?.confidence, 0);
  assert.equal(res.body?.result?.skipReason?.code, 'MARKET_DATA_UNAVAILABLE');
  assert.equal(res.body?.result?.skipReason?.category, 'MARKET_DATA');
}

async function main() {
  await isolatedHttpChecks();
  console.log('P1 safety checks: OK');
}

main().catch((err) => {
  console.error('P1 safety checks: FAILED');
  console.error(err);
  process.exit(1);
});
