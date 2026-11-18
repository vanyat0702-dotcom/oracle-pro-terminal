import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

// Isolated process: fail on any transport, key access, payload inspection or trading effect.
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get,
  httpsRequest: https.request, httpsGet: https.get, connect: net.Socket.prototype.connect,
  tls: tls.connect, env: process.env, random: Math.random, error: console.error };
const effects = { network: 0, keys: 0, payload: 0, serialization: 0, random: 0,
  validation: 0, safeMode: 0, audit: 0, parse: 0, axios: 0, logs: 0, guardCalls: 0 };
globalThis.__oracleGuardEffects = effects;
const fail = name => { effects[name]++; throw new Error(`Forbidden test effect: ${name}`); };
let credentialsPresent = false;
const hook = registerHooks({ load(url, context, next) {
  const result = next(url, context);
  const normalized = url.replaceAll('\\', '/');
  const stub = (names, counter, constants = []) => ({ ...result, format: 'module', source:
    constants.map(n => `export const ${n} = [];`).join('\n') + '\n' +
    names.map(n => `export function ${n}() { globalThis.__oracleGuardEffects.${counter}++; throw new Error('Forbidden ${counter}'); }`).join('\n') });
  if (normalized.endsWith('/core/validate.js')) return stub(['validateAnalyzeRequest', 'validateSendResultRequest', 'validateCoreRequest'],
    'validation', ['TIMEFRAMES', 'HIGHER_TIMEFRAMES', 'RISK_MODES', 'TRADE_DIRECTIONS']);
  if (normalized.endsWith('/core/trading/safeMode.js')) return stub(['findKeyLevels', 'analyzeSafeModeSetup', 'generateDetailedReport'], 'safeMode');
  if (normalized.endsWith('/core/observability/audit.js')) return stub(['auditIncomingPayload', 'auditModelResponse'], 'audit');
  if (normalized.endsWith('/core/ai/parse.js')) return stub(['cleanJsonResponse'], 'parse');
  if (normalized.endsWith('/core/runtimeGuard.js')) return { ...result, source: String(result.source).replace(
    'function checkRuntimeAccess(context) {', 'function checkRuntimeAccess(context) { globalThis.__oracleGuardEffects.guardCalls++;') };
  return result;
} });
let axios, savedPost;
let invocations = 0;
function checkEffects() {
  for (const [name, count] of Object.entries(effects)) if (name !== 'guardCalls') assert.equal(count, 0, name);
}

try {
  globalThis.fetch = http.request = http.get = https.request = https.get = tls.connect = net.Socket.prototype.connect = () => fail('network');
  syncBuiltinESMExports();
  process.env = new Proxy(saved.env, { get(target, key) {
    if (key === 'OPENAI_API_KEY' || key === 'GEMINI_API_KEY') {
      effects.keys++;
      return credentialsPresent ? 'mock-only-credential' : undefined;
    }
    return Reflect.get(target, key);
  } });
  axios = (await import('axios')).default;
  savedPost = axios.post;
  axios.post = () => fail('axios');
  console.error = () => fail('logs');
  Math.random = () => fail('random');

  const guard = await import('../core/runtimeGuard.js');
  const { analyze } = await import('../core/analyze.js');
  const { getJointPrediction } = await import('../core/ai/gateway.js');
  const { getGPTAnalysis } = await import('../core/ai/openai.js');
  const { getGeminiAnalysis } = await import('../core/ai/gemini.js');
  const facade = await import('../core/index.js');
  const legacy = await import('../ai-consensus.js');
  const { evaluateEligibility } = await import('../core/market/eligibility.js');
  checkEffects();
  assert.deepEqual(Object.keys(guard).sort(), ['checkRuntimeAccess', 'createUnprivilegedContext', 'runtimeGuardSkip']);
  assert.equal(facade.analyze, analyze);
  assert.equal(facade.getJointPrediction, getJointPrediction);
  assert.equal(legacy.getJointPrediction, getJointPrediction);
  assert.equal(facade.getGPTAnalysis, getGPTAnalysis);
  assert.equal(facade.getGeminiAnalysis, getGeminiAnalysis);
  console.log('PASS import safety and facade/legacy identity; no positive issuer');

  const NOW = Date.parse('2026-11-18T12:03:30Z'), MINUTE = Math.floor(NOW / 60000) * 60;
  // Mock-only evidence yielding a public ALLOWED report; it must never become a runtime grant.
  const decision = evaluateEligibility({ schemaVersion: 1, snapshotId: 'mock-only', pair: 'EUR/USD', timeframe: '1',
    source: { provider: 'Biquote', endpoint: 'https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100', priceBasis: 'mid' },
    timing: { requestStartedAtMs: NOW - 200, observationCompletedAtMs: NOW - 100,
      providerQuoteUpdatedAtMs: NOW - 150, acquisitionDurationMs: 100 }, session: 'OPEN',
    candles: [-1, 0].map(i => ({ time: MINUTE + i * 60, open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: i === 0 }))
  }, { purpose: 'DISPLAY', pair: 'EUR/USD', timeframe: '1', from: MINUTE - 60, to: MINUTE, minCandles: 2,
    allowOpenBar: true, maxCandleAgeMs: 120000, maxObservationAgeMs: 1000, maxQuoteAgeMs: 1000, maxAcquisitionDurationMs: 200 }, NOW);
  assert.equal(decision.status, 'ALLOWED');
  const genuine = guard.createUnprivilegedContext();
  assert.equal(Object.getPrototypeOf(genuine), null);
  assert.equal(Object.isFrozen(genuine), true);
  const marker = 'guard-test-sensitive-marker';
  const poison = new Proxy({}, { get() { return fail('payload'); }, ownKeys() { return fail('payload'); },
    getPrototypeOf() { return fail('payload'); }, getOwnPropertyDescriptor() { return fail('payload'); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const contexts = [undefined, null, false, true, 0, 1, 'ALLOW', 1n, Symbol('context'), {},
    genuine, JSON.parse(JSON.stringify(genuine)), structuredClone(genuine), new Proxy(genuine, {}), poison, revoked.proxy,
    decision, JSON.parse(JSON.stringify(decision)),
    { allowed: true, eligible: true, grantsRuntimeAccess: true, purpose: 'LIVE_SIGNAL_ANALYSIS' },
    { runtimeContext: genuine, source: 'Biquote', quality: { status: 'VALID' }, eligibility: decision }];
  for (const context of contexts) {
    const denial = guard.checkRuntimeAccess(context);
    assert.equal(denial.allowed, false); assert.equal(denial.code, 'RUNTIME_GUARD_DENIED');
    assert.equal(Object.isFrozen(denial), true);
  }
  console.log('PASS genuine, copied, serialized, forged, proxy and public-decision contexts all denied');

  const valid = { pairs: ['EUR/USD'], timeframe: '1', higherTimeframes: [], mode: 'BALANCED',
    safeModeEnabled: false, secondsRemaining: 12, candleOpenTime: '12:04', activeStrategies: [], strategy: 'test',
    filters: { newsFilterEnabled: true, atrFilterEnabled: true, riskCapEnabled: true } };
  const getterPayload = Object.defineProperty({}, 'runtimeContext', { get() { return fail('payload'); } });
  const payloads = [undefined, null, [], {}, '', 0, true, 1n, Symbol('payload'), poison, revoked.proxy,
    getterPayload, valid, { ...valid, safeModeEnabled: true },
    { ...valid, source: 'Biquote', quality: { status: 'PASS' }, eligible: true, verified: true, eligibility: decision, runtimeContext: genuine },
    JSON.parse(JSON.stringify({ ...valid, eligible: true, runtimeContext: { allowed: true } })),
    { toJSON() { return fail('serialization'); }, notes: marker }];
  const paths = [
    ['direct analyze', analyze, false], ['direct Gateway', getJointPrediction, false],
    ['facade analyze', facade.analyze, false], ['facade Gateway', facade.getJointPrediction, false],
    ['legacy Gateway', legacy.getJointPrediction, false],
    ['direct GPT adapter', getGPTAnalysis, true], ['direct Gemini adapter', getGeminiAnalysis, true],
    ['facade GPT adapter', facade.getGPTAnalysis, true], ['facade Gemini adapter', facade.getGeminiAnalysis, true]
  ];
  async function invoke(fn, adapter, payload, context) {
    const result = await fn(payload, context);
    invocations++;
    if (adapter) assert.equal(result, null);
    else {
      assert.equal(result.signal, 'SKIP'); assert.equal(result.confidence, 0); assert.equal(result.tradeId, 0);
      assert.equal(result.skipReason.code, 'RUNTIME_GUARD_DENIED');
      assert.equal(result.skipReason.category, 'ELIGIBILITY');
      assert.equal(Object.isFrozen(result), true);
      assert.equal(JSON.stringify(result).includes(marker), false);
    }
  }
  const guardChecksBefore = effects.guardCalls;
  for (const present of [false, true]) {
    credentialsPresent = present;
    for (const [name, fn, adapter] of paths) {
      for (const payload of payloads) for (const context of contexts) await invoke(fn, adapter, payload, context);
      checkEffects();
      console.log(`PASS ${name}: payload/context matrix; API keys ${present ? 'mock-present' : 'absent'}`);
    }
  }
  await Promise.all(Array.from({ length: 32 }, () => paths.map(([, fn, adapter]) => invoke(fn, adapter, poison, poison))).flat());
  assert.equal(effects.guardCalls - guardChecksBefore, invocations, 'Every entrypoint invocation must execute its own guard exactly once');
  checkEffects();
  console.log(`PASS ${invocations} entrypoint calls, including 288 concurrent calls; guard always first`);
  console.log('PASS zero network/axios/API-key reads/Safe Mode/validation/payload access/prompt serialization/random IDs/audit/parse/error logs');
} finally {
  if (axios && savedPost) axios.post = savedPost;
  process.env = saved.env; Math.random = saved.random; console.error = saved.error;
  globalThis.fetch = saved.fetch; http.request = saved.request; http.get = saved.get;
  https.request = saved.httpsRequest; https.get = saved.httpsGet;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls;
  delete globalThis.__oracleGuardEffects;
  hook.deregister(); syncBuiltinESMExports();
}
