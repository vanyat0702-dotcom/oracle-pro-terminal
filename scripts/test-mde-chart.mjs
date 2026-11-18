import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Transpile in memory; no generated files, network, AI or live provider in this suite.
const text = await readFile(new URL('../src/components/mdeChartData.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readChartSnapshot, startChartPolling, localChartAllowed, MDE_CHART_ENDPOINT } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const testNow = Date.parse('2026-11-18T12:03:30Z');
const minute = Math.floor(testNow / 60000) * 60;
const data = () => ({ success: true, diagnosticOnly: true, snapshot: {
  pair: 'EUR/USD', timeframe: '1', source: { provider: 'Biquote' },
  quality: { status: 'VALID', checkedAt: new Date(testNow).toISOString(), tradingEligible: false },
  candles: [minute - 60, minute].map((time, i) => ({ time, open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: i === 1 }))
} });
assert.equal(localChartAllowed(false, 'localhost'), false);
assert.equal(localChartAllowed(true, 'public.example'), false);
assert.equal(localChartAllowed(true, '127.0.0.1'), true);
assert.deepEqual(readChartSnapshot(data(), testNow).candles, data().snapshot.candles);
for (const mutate of [
  d => { d.snapshot.candles.reverse(); },
  d => { d.snapshot.candles[1].time = d.snapshot.candles[0].time; },
  d => { d.snapshot.candles[0].high = 0.5; },
  d => { d.snapshot.candles[0].open = '1.1'; },
  d => { d.snapshot.candles[1].isOpen = false; },
  d => { d.snapshot.quality.status = 'REJECTED'; },
  d => { d.snapshot.quality.tradingEligible = true; },
  d => { d.snapshot.source.provider = 'Other'; },
  d => { d.snapshot.quality.checkedAt = 'bad'; },
  d => { d.snapshot.candles = []; }
]) {
  const d = data(); mutate(d); assert.throws(() => readChartSnapshot(d, testNow));
}
assert.throws(() => readChartSnapshot(data(), testNow + 180000));
console.log('PASS local-only gating, OHLC/UTC/order/open-bar/quality validation, stale rejection');

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
globalThis.fetch = () => { throw new Error('Real network forbidden'); };
Date.now = () => testNow; // Freeze only fixture/validation time; polling timers remain real.
try {
  let calls = 0, active = 0, maxActive = 0, shown = null, errors = 0;
  let errorHandled, watchdog;
  const errorProcessed = new Promise((resolve, reject) => {
    errorHandled = resolve;
    watchdog = setTimeout(() => reject(new Error('Polling did not handle the source error within 2000ms')), 2000);
  });
  let stop;
  try {
    stop = startChartPolling({ intervalMs: 10, timeoutMs: 100,
      onData: s => { shown = s; }, onError: () => { shown = null; errors++; errorHandled(); }, onLoading() {},
      fetchImpl: async (url, options) => {
        assert.equal(url, MDE_CHART_ENDPOINT);
        assert.equal(options.cache, 'no-store');
        assert.equal(options.credentials, 'omit');
        active++; maxActive = Math.max(maxActive, active); calls++;
        await sleep(5); active--;
        return calls === 1 ? Response.json(data()) : new Response('', { status: 503 });
      }
    });
    await errorProcessed;
    clearTimeout(watchdog);
    assert.equal(calls, 2); assert.equal(errors, 1); assert.equal(shown, null); assert.equal(maxActive, 1);
    // Observe three real polling intervals BEFORE stop(); this is a finite no-retry check,
    // not a guarantee against arbitrarily delayed retries or event-loop starvation.
    await sleep(30); assert.equal(calls, 2);
  } finally {
    clearTimeout(watchdog);
    stop?.(); // A synchronous startup failure may not return a cancellation handle.
  }
  console.log('PASS serial refresh; source error clears candles and stops retries');

  for (const response of [new Response('bad json'), new Response('', { status: 404 })]) {
    let failure;
    const cancel = startChartPolling({ onData() { assert.fail('No data on failure'); },
      onError: e => { failure = e; }, onLoading() {}, fetchImpl: async () => response });
    await sleep(15); assert.equal(typeof failure, 'string'); cancel();
  }
  console.log('PASS invalid JSON and disabled endpoint');

  let aborted = false, callbacks = 0;
  const cancel = startChartPolling({ onData() { callbacks++; }, onError() { callbacks++; }, onLoading() {},
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }) });
  cancel(); await sleep(15); assert.equal(aborted, true); assert.equal(callbacks, 0);
  console.log('PASS cleanup aborts in-flight request without post-unmount callbacks');

  let timeoutError;
  const cancelTimeout = startChartPolling({ timeoutMs: 10, onData() { assert.fail(); }, onError: e => { timeoutError = e; }, onLoading() {},
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
  await sleep(30); assert.match(timeoutError, /Таймаут/); cancelTimeout();
  let count = 0;
  const cancelTimer = startChartPolling({ intervalMs: 30, onData() {}, onError() { assert.fail(); }, onLoading() {},
    fetchImpl: async () => { count++; return Response.json(data()); } });
  await sleep(10); cancelTimer(); await sleep(50); assert.equal(count, 1);
  console.log('PASS timeout and cancellation of scheduled refresh');
} finally { globalThis.fetch = originalFetch; Date.now = originalNow; }

// Check the proxy boundary that otherwise hides the original socket from Express.
const viteSource = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const configJs = ts.transpileModule(viteSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  .replace(/import.*from 'vite';/, 'const defineConfig = x => x;')
  .replace(/import.*from '@vitejs\/plugin-react';/, 'const react = () => ({});');
const { default: config } = await import(`data:text/javascript;base64,${Buffer.from(configJs).toString('base64')}`);
let guard;
config.plugins[1].configureServer({ middlewares: { use(handler) { guard = handler; } } });
for (const [host, path, allowed] of [['203.0.113.1', MDE_CHART_ENDPOINT, false],
  ['203.0.113.1', `${MDE_CHART_ENDPOINT}/?x=1`, false], ['203.0.113.1', MDE_CHART_ENDPOINT.toUpperCase(), false],
  ['127.0.0.1', MDE_CHART_ENDPOINT, true], ['203.0.113.1', '/api/health', true]]) {
  let next = false, ended = false;
  const res = { end() { ended = true; } };
  guard({ url: path, socket: { remoteAddress: host } }, res, () => { next = true; });
  assert.equal(next, allowed); assert.equal(ended, !allowed);
}
console.log('PASS proxy rejects remote diagnostics without affecting other routes');
