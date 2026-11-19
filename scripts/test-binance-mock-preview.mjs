// Explicit artificial UI fixture tests; no real datasets, listeners or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net'; import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
let network = 0, groups = 0;
const saved = [globalThis.fetch, http.request, http.get, https.request, https.get, net.Socket.prototype.connect, tls.connect];
const deny = () => { network++; throw Error('MOCK_PREVIEW_FORBIDS_NETWORK'); };
globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = deny; syncBuiltinESMExports();
async function module(path) { const text = await readFile(new URL(path, import.meta.url), 'utf8'); const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText; return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`); }
const { MOCK_LABEL, mockPreviewFrame, startMockPreview } = await module('../src/components/binanceMockPreview.ts');
const { readBinanceObservation } = await module('../src/components/binanceObservationData.ts');
const { evaluateEligibility } = await import('../core/market/eligibility.js');
const { createMarketService, inspectObservationProvenance } = await import('../core/market/service.js');
const { isTrustedAnalysisInput } = await import('../core/analysis/input.js');
const { analyze } = await import('../core/analyze.js');
const { getJointPrediction } = await import('../core/ai/gateway.js');
const { getGPTAnalysis } = await import('../core/ai/openai.js');
const { getGeminiAnalysis } = await import('../core/ai/gemini.js');
const { getAnalysisSessionOwner } = await import('../core/runtime/sessionOwner.js');
async function test(name, fn) { await fn(); groups++; console.log('PASS ' + name); }
function timers() { let id = 0; const pending = new Map(); return { pending, schedule(fn) { pending.set(++id, fn); return id; }, cancel(i) { pending.delete(i); }, next() { const entry = pending.entries().next().value; assert.ok(entry); pending.delete(entry[0]); entry[1](); } }; }
try {
  await test('fixture is deterministic, bounded, immutable and permanently MOCK', () => {
    assert.equal(MOCK_LABEL, 'MOCK / НЕ РЕАЛЬНЫЕ КОТИРОВКИ');
    assert.deepEqual([0, 1, 2].map(i => mockPreviewFrame(i).candles.length), [4, 8, 12]);
    assert.deepEqual(mockPreviewFrame(2), mockPreviewFrame(2));
    for (let i = 0; i < 3; i++) { const f = mockPreviewFrame(i); assert.equal(f.kind, 'MOCK_PREVIEW'); assert.equal(f.source, 'OFFLINE_UI_FIXTURE');
      assert.equal(f.instrument, 'BTCUSDT_MOCK'); assert.equal(f.quality, 'MOCK_NOT_MARKET_DATA'); assert.equal(f.grantsRuntimeAccess, false); assert.equal(f.readiness, 'NOT_READY');
      assert.throws(() => { f.candles[0].open = 999; }, TypeError); assert.throws(() => { f.candles.push({}); }, TypeError); }
  });
  await test('all artificial OHLCV and fixed UTC M1 values consistent', () => {
    const c = mockPreviewFrame(2).candles; assert.equal(c[0].open, 100); assert.equal(c.at(-1).close, 108);
    for (let i = 0; i < c.length; i++) { assert.equal(c[i].openTimeMs % 60000, 0); assert.equal(c[i].time * 1000, c[i].openTimeMs);
      assert.ok(c[i].low <= Math.min(c[i].open, c[i].close)); assert.ok(c[i].high >= Math.max(c[i].open, c[i].close)); assert.ok(c[i].volume > 0);
      if (i) assert.equal(c[i].openTimeMs - c[i - 1].openTimeMs, 60000); }
  });
  await test('invalid frame values rejected', () => { for (const v of [-1, 3, 0.5, NaN, '1', null]) assert.throws(() => mockPreviewFrame(v)); });
  await test('exactly three timed frames then completion; no infinite polling', () => {
    const clock = timers(), seen = []; let completed = 0;
    const stop = startMockPreview({ ...clock, onFrame: f => seen.push(f.frame), onComplete: () => completed++ });
    assert.deepEqual(seen, [0]); clock.next(); clock.next(); assert.deepEqual(seen, [0, 1, 2]); assert.equal(completed, 1); assert.equal(clock.pending.size, 0); stop();
  });
  await test('stop/unmount cancels timer and even captured callback cannot update', () => {
    const clock = timers(); let count = 0, completed = 0;
    const stop = startMockPreview({ ...clock, onFrame: () => count++, onComplete: () => completed++ });
    const captured = [...clock.pending.values()][0]; stop(); stop(); captured(); assert.equal(count, 1); assert.equal(completed, 0); assert.equal(clock.pending.size, 0);
  });
  await test('restart has independent deterministic state', () => {
    for (let i = 0; i < 2; i++) { const clock = timers(), seen = []; const stop = startMockPreview({ ...clock, onFrame: f => seen.push(f.frame), onComplete() {} }); clock.next(); stop(); assert.deepEqual(seen, [0, 1]); }
  });
  await test('MOCK cannot pass live browser validator, provenance, input identity or owner', () => {
    const f = mockPreviewFrame(2); assert.throws(() => readBinanceObservation({ success: true, diagnosticOnly: true, snapshot: f }));
    assert.equal(isTrustedAnalysisInput(f), false); const owner = getAnalysisSessionOwner().create(f); assert.equal(owner.status, 'DENIED'); assert.equal(owner.session, null);
    assert.equal(inspectObservationProvenance(createMarketService({ fetchImpl: deny }), f).registered, false);
  });
  await test('Market Service/Eligibility reject MOCK, with zero acquisition', async () => {
    const service = createMarketService({ fetchImpl: deny });
    const r = await service.observe({ sourceId: 'OFFLINE_UI_FIXTURE', pair: 'BTC/USDT', timeframe: '1', purpose: 'DISPLAY' });
    assert.equal(r.status, 'DENIED'); assert.equal(r.observation, null);
    const e = evaluateEligibility(mockPreviewFrame(2), { purpose: 'LIVE_SIGNAL_ANALYSIS' }, Date.parse('2025-01-07T12:15:00Z'));
    assert.equal(e.status, 'DENIED'); assert.equal(e.grantsRuntimeAccess, false);
  });
  await test('Core, Gateway and direct AI adapters remain closed to fixture and JSON clone', async () => {
    for (const f of [mockPreviewFrame(2), JSON.parse(JSON.stringify(mockPreviewFrame(2)))]) {
      assert.equal((await analyze(f, f)).signal, 'SKIP'); assert.equal((await getJointPrediction(f, f)).signal, 'SKIP');
      assert.equal(await getGPTAnalysis(f, f), null); assert.equal(await getGeminiAnalysis(f, f), null);
    }
  });
  await test('MOCK UI imports no acquisition path and renders mandatory labels/actions', async () => {
    const mock = await readFile(new URL('../src/components/MockBinanceObservation.tsx', import.meta.url), 'utf8');
    assert.ok(!/startBinancePolling|readBinanceObservation|fetch\s*\(|axios|\/api\//.test(mock));
    for (const label of ['MOCK_LABEL', 'Смоделировать ошибку', 'Сбросить MOCK', 'Остановить MOCK', 'BLOCKED_PENDING_JURISDICTION_AND_PERMISSION']) assert.ok(mock.includes(label));
    const data = await readFile(new URL('../src/components/binanceMockPreview.ts', import.meta.url), 'utf8'); assert.ok(!/fetch\s*\(|https?:|\/core\//.test(data));
  });
  assert.equal(network, 0); console.log(`MOCK preview: ${groups} groups PASS; live endpoint requests=0; external network=0; grants=0`);
} finally { [globalThis.fetch, http.request, http.get, https.request, https.get, net.Socket.prototype.connect, tls.connect] = saved; syncBuiltinESMExports(); }
