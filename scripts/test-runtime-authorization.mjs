import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
import { createSessionModel, evaluateSessionModel, planSessionTransition, applySessionTransition } from '../core/runtime/stateMachine.js';
import { checkRuntimeAccess } from '../core/runtimeGuard.js';

// Fixture values only. No default production TTL, quote, candle or grant is created.
const START = 1800000000000;
const spec = () => ({ sessionId: 'test-session', scope: { snapshotId: 'test-snapshot', sourceId: 'test-source',
  pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY', requirementsFingerprint: 'test-requirements-v1',
  policyFingerprint: 'test-policy-fingerprint', strategyVersion: 'test-strategy-v1' },
  policy: { version: 'test-policy-v1', fingerprint: 'test-policy-fingerprint', generation: 2 },
  deadline: { issuedAtMs: START, expiresAtMs: START + 100, issuedMonotonicMs: 10,
    deadlineMonotonicMs: 110, maxClockDriftMs: 5 }, revocationGeneration: 3 });
const env = (elapsed = 0) => ({ clock: { epochMs: START + elapsed, monotonicMs: 10 + elapsed },
  policy: { ...spec().policy }, revocationGeneration: 3, revoked: false });
const initial = (s = spec()) => { const r = createSessionModel(s); assert.equal(r.ok, true); return r.session; };
const command = (s, target, stage) => ({ target, stage, expectedRevision: s.revision });
const move = (s, target, stage, e = env()) => applySessionTransition(s, planSessionTransition(s, command(s, target, stage), e), e);
let count = 0, network = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get, httpsRequest: https.request,
  httpsGet: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
const denyNetwork = () => { network++; throw new Error('Network forbidden in lifecycle tests'); };

try {
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = denyNetwork;
  syncBuiltinESMExports();
  await test('complete deterministic lifecycle; all outputs remain non-authorizing', () => {
    const s = initial(), before = JSON.stringify(s);
    let current = s;
    for (const [target, stage] of [['CONSUMED', 'ROOT'], ['ACTIVE', 'ANALYSIS'], ['FINALIZED', 'FINALIZATION']]) {
      const r = move(current, target, stage);
      assert.equal(r.ok, true); assert.equal(r.session.state, target);
      assert.equal(r.session.revision, current.revision + 1);
      assert.equal(r.grantsRuntimeAccess, false); assert.equal(r.session.modelOnly, true);
      current = r.session;
    }
    assert.equal(JSON.stringify(s), before);
    assert.equal(current.revision, 3);
    assert.equal(evaluateSessionModel(current, env()).reason, 'TERMINAL_STATE');
    assert.deepEqual(move(initial(), 'CONSUMED', 'ROOT').session, move(initial(), 'CONSUMED', 'ROOT').session);
  });
  for (const state of ['ISSUED', 'CONSUMED', 'ACTIVE']) {
    let s = initial();
    if (state !== 'ISSUED') s = move(s, 'CONSUMED', 'ROOT').session;
    if (state === 'ACTIVE') s = move(s, 'ACTIVE', 'ANALYSIS').session;
    const edge = { ISSUED: 'CONSUMED', CONSUMED: 'ACTIVE', ACTIVE: 'FINALIZED' }[state];
    for (const target of ['ISSUED', 'CONSUMED', 'ACTIVE', 'FINALIZED', 'EXPIRED', 'REVOKED', 'UNKNOWN']) {
      if (target === edge) continue;
      await test(`reject ${state} -> ${target} without terminal evidence`, () => {
        const r = move(s, target, 'ROOT'); assert.equal(r.ok, false); assert.equal(r.reason, 'INVALID_TRANSITION'); assert.equal(r.session, s);
      });
    }
    await test(`reject incorrect stage in ${state}`, () => {
      assert.equal(move(s, edge, 'OPENAI').reason, 'INVALID_TRANSITION');
    });
  }
  await test('explicit revision and exact base identity prevent replay at application', () => {
    const s = initial(), p = planSessionTransition(s, command(s, 'CONSUMED', 'ROOT'), env());
    const next = applySessionTransition(s, p, env()).session;
    assert.equal(applySessionTransition(next, p, env()).reason, 'REPLAY');
    assert.equal(applySessionTransition(initial(), p, env()).reason, 'REPLAY');
    assert.equal(planSessionTransition(next, command(s, 'ACTIVE', 'ANALYSIS'), env()).reason, 'REPLAY');
  });
  await test('100 competing proposals: sole owner atomically replaces current once', async () => {
    const s = initial(), proposals = await Promise.all(Array.from({ length: 100 }, async () =>
      planSessionTransition(s, command(s, 'CONSUMED', 'ROOT'), env())));
    let current = s;
    const attempts = await Promise.all(proposals.map(p => Promise.resolve().then(() => {
      // Owner-side critical section has no await. The pure module owns no mutable store.
      const r = applySessionTransition(current, p, env()); if (r.ok) current = r.session; return r;
    })));
    assert.equal(attempts.filter(r => r.ok).length, 1);
    assert.equal(attempts.filter(r => r.reason === 'REPLAY').length, 99);
    assert.equal(current.revision, 1);
    // Purity cannot invalidate historical snapshots globally: callers must retain sole ownership.
    assert.equal(applySessionTransition(s, proposals[0], env()).ok, true);
  });
  const cases = [
    ['absolute expiry', e => { e.clock = { epochMs: START + 100, monotonicMs: 109 }; }, 'ABSOLUTE_EXPIRY', 'EXPIRED'],
    ['monotonic expiry', e => { e.clock = { epochMs: START + 99, monotonicMs: 110 }; }, 'MONOTONIC_DEADLINE', 'EXPIRED'],
    ['explicit revocation', e => { e.revoked = true; }, 'REVOKED', 'REVOKED'],
    ['revocation generation increase', e => { e.revocationGeneration++; }, 'REVOCATION_GENERATION_MISMATCH', 'REVOKED'],
    ['revocation generation rollback', e => { e.revocationGeneration--; }, 'REVOCATION_GENERATION_MISMATCH', 'REVOKED'],
    ['policy version', e => { e.policy.version = 'other'; }, 'POLICY_VERSION_MISMATCH', 'REVOKED'],
    ['policy fingerprint', e => { e.policy.fingerprint = 'other'; }, 'POLICY_FINGERPRINT_MISMATCH', 'REVOKED'],
    ['policy generation increase', e => { e.policy.generation++; }, 'POLICY_GENERATION_MISMATCH', 'REVOKED'],
    ['policy generation rollback', e => { e.policy.generation--; }, 'POLICY_GENERATION_MISMATCH', 'REVOKED']
  ];
  for (const [name, change, reason, state] of cases) for (const phase of ['ISSUED', 'CONSUMED', 'ACTIVE']) {
    await test(`${name} terminates ${phase}; irreversible`, () => {
      let s = initial();
      if (phase !== 'ISSUED') s = move(s, 'CONSUMED', 'ROOT').session;
      if (phase === 'ACTIVE') s = move(s, 'ACTIVE', 'ANALYSIS').session;
      const e = env(); change(e);
      assert.equal(evaluateSessionModel(s, e).reason, reason);
      const p = planSessionTransition(s, command(s, 'CONSUMED', 'ROOT'), e);
      assert.equal(p.ok, false);
      const r = applySessionTransition(s, p, e);
      assert.equal(r.ok, false); assert.equal(r.reason, reason); assert.equal(r.session.state, state);
      assert.equal(s.state, phase);
      for (const target of ['ISSUED', 'CONSUMED', 'ACTIVE', 'FINALIZED', 'EXPIRED', 'REVOKED']) {
        const again = move(r.session, target, 'ROOT');
        assert.equal(again.reason, 'TERMINAL_STATE'); assert.equal(again.session, r.session);
      }
    });
  }
  await test('FINALIZED is also irreversible', () => {
    let s = initial(); for (const [target, stage] of [['CONSUMED', 'ROOT'], ['ACTIVE', 'ANALYSIS'], ['FINALIZED', 'FINALIZATION']]) s = move(s, target, stage).session;
    for (const target of ['ISSUED', 'CONSUMED', 'ACTIVE', 'FINALIZED', 'EXPIRED', 'REVOKED']) assert.equal(move(s, target, 'ROOT').session, s);
  });
  await test('queued plan reassesses expiry, revocation and policy before application', () => {
    const s = initial(), p = planSessionTransition(s, command(s, 'CONSUMED', 'ROOT'), env());
    for (const [, change, reason, state] of cases) {
      const e = env(); change(e); const r = applySessionTransition(s, p, e);
      assert.equal(r.ok, false); assert.equal(r.reason, reason); assert.equal(r.session.state, state);
    }
    assert.equal(applySessionTransition(s, p, null).reason, 'INVALID_ENVIRONMENT');
  });
  await test('terminal denial must replace owner state even when ok=false; no stale plan can revive it', () => {
    let current = initial();
    const p = planSessionTransition(current, command(current, 'CONSUMED', 'ROOT'), env());
    const e = env(); e.revoked = true;
    const denied = applySessionTransition(current, p, e);
    assert.equal(denied.ok, false); current = denied.session;
    assert.equal(current.state, 'REVOKED');
    assert.equal(applySessionTransition(current, p, env()).reason, 'REPLAY');
    assert.equal(move(current, 'ACTIVE', 'ANALYSIS').reason, 'TERMINAL_STATE');
  });
  await test('different explicit absolute and monotonic lifetimes use the earliest deadline', () => {
    const a = spec(); a.deadline.expiresAtMs = START + 50;
    assert.equal(evaluateSessionModel(initial(a), env(49)).ok, true);
    assert.equal(evaluateSessionModel(initial(a), env(50)).reason, 'ABSOLUTE_EXPIRY');
    const b = spec(); b.deadline.deadlineMonotonicMs = 60;
    assert.equal(evaluateSessionModel(initial(b), env(49)).ok, true);
    assert.equal(evaluateSessionModel(initial(b), env(50)).reason, 'MONOTONIC_DEADLINE');
    const zero = spec(); zero.deadline.issuedMonotonicMs = 0; zero.deadline.deadlineMonotonicMs = 100;
    const e = env(); e.clock.monotonicMs = 0; assert.equal(evaluateSessionModel(initial(zero), e).ok, true);
  });
  await test('before expiry passes; equality expires; zero drift and fractional monotonic time supported', () => {
    assert.equal(evaluateSessionModel(initial(), env(99)).ok, true);
    assert.equal(evaluateSessionModel(initial(), env(100)).reason, 'ABSOLUTE_EXPIRY');
    assert.equal(evaluateSessionModel(initial(), env(101)).ok, false);
    const s = spec(); s.deadline.maxClockDriftMs = 0;
    assert.equal(evaluateSessionModel(initial(s), env(1)).ok, true);
    const e = env(1); e.clock.monotonicMs += 0.5;
    assert.equal(evaluateSessionModel(initial(), e).ok, true);
    assert.equal(evaluateSessionModel(initial(s), e).reason, 'INVALID_CLOCK');
  });
  await test('drift tolerance inclusive boundary and rollback since last transition', () => {
    const e = env(10); e.clock.monotonicMs += 5;
    assert.equal(evaluateSessionModel(initial(), e).ok, true);
    e.clock.monotonicMs += 0.01; assert.equal(evaluateSessionModel(initial(), e).reason, 'INVALID_CLOCK');
    const s = move(initial(), 'CONSUMED', 'ROOT', env(20)).session;
    assert.equal(evaluateSessionModel(s, env(19)).reason, 'INVALID_CLOCK');
    const p = planSessionTransition(s, command(s, 'ACTIVE', 'ANALYSIS'), env(30));
    assert.equal(applySessionTransition(s, p, env(29)).reason, 'INVALID_CLOCK');
  });
  for (const value of [undefined, null, 'UNKNOWN', NaN, Infinity, -1, true, {}, 1n]) {
    await test(`invalid/unknown epoch and monotonic clocks: ${String(value)}`, () => {
      for (const key of ['epochMs', 'monotonicMs']) {
        const e = env(); e.clock[key] = value;
        const s = initial(); assert.equal(evaluateSessionModel(s, e).reason, 'INVALID_CLOCK');
        const r = move(s, 'CONSUMED', 'ROOT', e); assert.equal(r.ok, false); assert.equal(r.session, s);
      }
    });
  }
  await test('future issued time, unsafe epochs, missing clocks and invalid generations fail closed', () => {
    for (const change of [e => { e.clock.epochMs = START - 1; }, e => { e.clock.monotonicMs = 9; },
      e => { e.clock.epochMs = Number.MAX_SAFE_INTEGER; }, e => { e.clock = {}; }, e => { delete e.clock; },
      e => { e.revoked = 'UNKNOWN'; }, e => { e.revocationGeneration = -1; }, e => { e.policy.generation = null; }]) {
      const e = env(); change(e); assert.equal(evaluateSessionModel(initial(), e).ok, false);
    }
  });
  await test('all missing spec/scope/deadline/policy fields and invalid lifetimes rejected', () => {
    for (const section of [null, 'scope', 'deadline', 'policy']) {
      for (const key of Object.keys(section ? spec()[section] : spec())) {
        const s = spec(); delete (section ? s[section] : s)[key]; assert.equal(createSessionModel(s).ok, false);
      }
    }
    for (const change of [s => { s.deadline.expiresAtMs = START; }, s => { s.deadline.deadlineMonotonicMs = 10; },
      s => { s.deadline.maxClockDriftMs = -1; }, s => { s.deadline.expiresAtMs = Infinity; },
      s => { s.scope.snapshotId = 'UNKNOWN'; }, s => { s.policy.fingerprint = 'other'; }, s => { s.scope.purpose = 'UNKNOWN'; }]) {
      const s = spec(); change(s); assert.equal(createSessionModel(s).ok, false);
    }
  });
  await test('LIVE and EXECUTION models cannot be created; research remains informational', () => {
    for (const purpose of ['LIVE_SIGNAL_ANALYSIS', 'EXECUTION']) { const s = spec(); s.scope.purpose = purpose; assert.equal(createSessionModel(s).reason, 'PURPOSE_NOT_ENABLED'); }
    const s = spec(); s.scope.purpose = 'CLOSED_BAR_RESEARCH'; assert.equal(initial(s).grantsRuntimeAccess, false);
  });
  await test('deep copies, frozen state and plans prevent mutation through input or exposed objects', () => {
    const input = spec(), s = initial(input), p = planSessionTransition(s, command(s, 'CONSUMED', 'ROOT'), env());
    input.scope.snapshotId = 'changed'; input.deadline.expiresAtMs = START + 5000; input.policy.generation = 900;
    assert.equal(s.scope.snapshotId, 'test-snapshot'); assert.equal(s.deadline.expiresAtMs, START + 100); assert.equal(s.policy.generation, 2);
    for (const obj of [s, s.scope, s.policy, s.deadline, s.lastClock, p]) assert.equal(Object.isFrozen(obj), true);
    assert.throws(() => { s.state = 'ACTIVE'; }, TypeError);
    assert.throws(() => { s.scope.snapshotId = 'changed'; }, TypeError);
    assert.throws(() => { p.ok = true; }, TypeError);
    assert.equal(Object.getPrototypeOf(s), null); assert.equal(s.constructor, undefined);
    assert.equal(Object.getPrototypeOf(p), null);
  });
  await test('JSON, clones, lookalikes, prototypes and proxies cannot be models or plans', () => {
    const s = initial(), p = planSessionTransition(s, command(s, 'CONSUMED', 'ROOT'), env());
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const fake of [undefined, null, false, 1, 1n, Symbol(), {}, JSON.parse(JSON.stringify(s)), structuredClone(s), { ...s },
      Object.create(s), new Proxy(s, {}), revoked.proxy]) {
      assert.equal(evaluateSessionModel(fake, env()).reason, 'INVALID_SESSION');
      assert.equal(applySessionTransition(fake, p, env()).reason, 'INVALID_SESSION');
      assert.equal(planSessionTransition(fake, {}, env()).reason, 'INVALID_SESSION');
    }
    for (const fake of [null, {}, { ...p }, JSON.parse(JSON.stringify(p)), structuredClone(p), Object.create(p), new Proxy(p, {}), revoked.proxy]) {
      assert.equal(applySessionTransition(s, fake, env()).reason, 'INVALID_PLAN');
    }
    // Serialized spec may create a new descriptive model, but never recovers an existing identity or permission.
    assert.equal(applySessionTransition(initial(JSON.parse(JSON.stringify(spec()))), p, env()).reason, 'REPLAY');
  });
  await test('accessors, extra keys, symbols and throwing proxies fail without propagating exceptions', () => {
    let getterCalls = 0;
    const getter = Object.defineProperty(spec(), 'sessionId', { get() { getterCalls++; throw Error('Do not read'); }, enumerable: true });
    assert.equal(createSessionModel(getter).reason, 'INVALID_SPEC'); assert.equal(getterCalls, 0);
    const poison = new Proxy({}, { getPrototypeOf() { throw Error('private details'); } });
    for (const bad of [poison, { ...spec(), eligible: true }, Object.assign(spec(), { [Symbol()]: true })]) assert.equal(createSessionModel(bad).ok, false);
    const s = initial(); assert.equal(evaluateSessionModel(s, poison).ok, false);
    assert.equal(planSessionTransition(s, poison, env()).reason, 'INVALID_TRANSITION');
    const e = env(); Object.defineProperty(e.clock, 'epochMs', { get() { getterCalls++; throw Error('Do not read'); } });
    assert.equal(evaluateSessionModel(s, e).reason, 'INVALID_CLOCK'); assert.equal(getterCalls, 0);
  });
  await test('invalid commands and forged positive flags do not alter the original model', () => {
    const s = initial();
    for (const c of [null, {}, { ...command(s, 'CONSUMED', 'ROOT'), allowed: true },
      { ...command(s, 'CONSUMED', 'ROOT'), expectedRevision: NaN }, { ...command(s, 'CONSUMED', 'ROOT'), expectedRevision: 1 }]) {
      const p = planSessionTransition(s, c, env()); assert.equal(p.ok, false);
      assert.equal(applySessionTransition(s, p, env()).session, s);
    }
  });
  await test('Runtime Guard rejects every lifecycle model, plan, result and serialized copy', () => {
    let s = initial();
    for (const [target, stage] of [['CONSUMED', 'ROOT'], ['ACTIVE', 'ANALYSIS'], ['FINALIZED', 'FINALIZATION']]) {
      const p = planSessionTransition(s, command(s, target, stage), env());
      const r = applySessionTransition(s, p, env());
      for (const value of [s, p, r, r.session, JSON.parse(JSON.stringify(s)), { ...s, allowed: true }]) assert.equal(checkRuntimeAccess(value).allowed, false);
      s = r.session;
    }
  });
  await test('restricted VM: no ambient time, IO, imports, secret access, timers or shared store', async () => {
    const source = await readFile(new URL('../core/runtime/stateMachine.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /^import\s/m);
    const expose = source.replace(/^export \{ .* \};$/m, 'globalThis.api = { createSessionModel, evaluateSessionModel, planSessionTransition, applySessionTransition };');
    const sandbox = { Date: undefined, process: undefined, performance: undefined, fetch: undefined, setTimeout: undefined, WeakMap: undefined, WeakSet: undefined };
    vm.runInNewContext(expose + `\nconst input=JSON.parse(${JSON.stringify(JSON.stringify(spec()))}); const environment=JSON.parse(${JSON.stringify(JSON.stringify(env()))});
      const s=api.createSessionModel(input).session; const p=api.planSessionTransition(s,{target:'CONSUMED',stage:'ROOT',expectedRevision:0},environment);
      globalThis.outcome=api.applySessionTransition(s,p,environment);`, sandbox, { timeout: 1000 });
    assert.equal(sandbox.outcome.ok, true); assert.equal(sandbox.outcome.grantsRuntimeAccess, false);
  });
  assert.equal(network, 0);
  console.log(`Runtime authorization models: ${count} tests PASS; 0 network attempts; no runtime grants`);
} finally {
  globalThis.fetch = saved.fetch; http.request = saved.request; http.get = saved.get;
  https.request = saved.httpsRequest; https.get = saved.httpsGet;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
}
