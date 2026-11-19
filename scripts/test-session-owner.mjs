import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { readFile } from 'node:fs/promises';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

const START = Date.parse('2026-11-18T12:03:30Z');
const policy = () => ({ version: 'offline-policy-v1', fingerprint: 'offline-fingerprint', generation: 2 });
const spec = () => ({ sessionId: 'offline-model', scope: { snapshotId: 'offline-snapshot', sourceId: 'biquote',
  pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY', requirementsFingerprint: 'offline-requirements',
  policyFingerprint: 'offline-fingerprint', strategyVersion: 'offline-strategy-v1' }, policy: policy(),
  deadline: { issuedAtMs: START, expiresAtMs: START + 100, issuedMonotonicMs: 10,
    deadlineMonotonicMs: 110, maxClockDriftMs: 5 }, revocationGeneration: 3 });
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get, httpsRequest: https.request,
  httpsGet: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
let network = 0, count = 0;
const denyNetwork = () => { network++; throw Error('External IO forbidden in session owner tests'); };
async function test(name, run) { await run(); count++; console.log('PASS ' + name); }
const assertModel = r => { assert.equal(r.mode, 'MODEL_ONLY'); assert.equal(r.modelOnly, true); assert.equal(r.grantsRuntimeAccess, false); };
const assertDenied = (r, code) => { assertModel(r); assert.equal(r.ok, false); assert.equal(r.status, 'DENIED'); if (code) assert.equal(r.reason, code); };
let hooks;
try {
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = denyNetwork;
  syncBuiltinESMExports();
  globalThis.__ownerEvidenceDependencies = Object.freeze({ fetchImpl: async () => {
    const minute = Math.floor(START / 60000) * 60000;
    return Response.json({ symbol: 'EURUSD', interval: '1m', bars: [0, 1].map(i => ({
      openTime: new Date(minute - i * 60000).toISOString(), open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: i === 0 })) });
  }, wallNow: () => START, monotonicNow: () => 10, idFactory: () => 'offline-snapshot' });
  hooks = registerHooks({ load(url, context, next) {
    const r = next(url, context);
    if (/\/core\/runtime\/sessionOwner\.js\?owner-test=[AB]$/.test(url)) {
      // This writer and constructor export exist ONLY in this in-memory offline copy.
      let source = String(r.source);
      assert.match(source, /  return owner;\r?\n}/);
      source = source.replace(/  return owner;\r?\n}/, `  return Object.freeze({ api: owner, seedOffline(spec, originalObservations = []) {
        const made = offlineCreateModel(spec);
        if (!made.ok) throw new Error('Invalid offline model spec');
        const handle = Object.freeze(Object.create(null));
        records.set(handle, { current: made.session, busy: false, revoked: false,
          lastClock: made.session.lastClock, binding: Object.freeze({ input: null,
            originalObservations: Object.freeze([...originalObservations]), scope: made.session.scope }) });
        return handle;
      } });
}`);
      source = `import { createSessionModel as offlineCreateModel } from './stateMachine.js';\n` + source +
        '\nexport { createSessionOwner as createOfflineOwner };';
      return { ...r, source };
    }
    if (url.endsWith('/core/market/service.js?owner-evidence-test')) {
      const pattern = /const trustedDependencies = Object\.freeze\(\{ fetchImpl: typeof globalThis\.fetch === 'function' \? globalThis\.fetch : unavailableTransport, wallNow: Date\.now,\s*monotonicNow: performance\.now\.bind\(performance\), idFactory: randomUUID \}\);/;
      assert.match(String(r.source), pattern);
      return { ...r, source: String(r.source).replace(pattern, 'const trustedDependencies = Object.freeze(globalThis.__ownerEvidenceDependencies);') };
    }
    return r;
  } });
  const production = await import('../core/runtime/sessionOwner.js');
  const a = await import('../core/runtime/sessionOwner.js?owner-test=A');
  const b = await import('../core/runtime/sessionOwner.js?owner-test=B');
  const { checkRuntimeAccess } = await import('../core/runtimeGuard.js');
  const { createSessionModel } = await import('../core/runtime/stateMachine.js');
  const core = await import('../core/index.js');
  const origin = await import('../core/market/service.js?owner-evidence-test');
  const evidenceService = origin.getTrustedMarketService();
  const diagnostic = await evidenceService.observe({ sourceId: 'biquote', pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY' });
  const observation = diagnostic.observation;
  assert.equal(origin.inspectObservationProvenance(evidenceService, observation).registered, true);
  const liveIntent = { pairs: ['EUR/USD'], timeframe: '1', higherTimeframes: [], mode: 'BALANCED', safeModeEnabled: false,
    filters: { newsFilterEnabled: true, atrFilterEnabled: true, riskCapEnabled: true } };
  const readiness = (await import('../core/analysis/input.js')).assessAnalysisReadiness(liveIntent, { primary: observation, higherTimeframes: [] });
  function setup(module = a, originalObservations = [observation]) {
    const controls = { elapsed: 0, policy: policy(), revocation: { generation: 3, revoked: false }, clockReads: 0,
      clockHook: null, clockValue: null, policyHook: null };
    const harness = module.createOfflineOwner({
      clock() { controls.clockReads++; controls.clockHook?.(); return controls.clockValue ?? {
        epochMs: START + controls.elapsed, monotonicMs: 10 + controls.elapsed }; },
      policy() { controls.policyHook?.(); return controls.policy; },
      revocation() { return controls.revocation; }
    });
    return { ...harness, controls, handle: harness.seedOffline(spec(), originalObservations) };
  }
  await test('production exports no owner factory, writer or positive creation; all creation denied', () => {
    assert.deepEqual(Object.keys(production), ['getAnalysisSessionOwner']);
    const owner = production.getAnalysisSessionOwner(); assert.equal(production.getAnalysisSessionOwner(), owner);
    assert.equal(Object.isFrozen(owner), true);
    assert.deepEqual(Object.keys(owner).sort(), ['consume', 'create', 'inspect', 'revoke', 'transition']);
    for (const arg of [undefined, {}, { clock: () => START }, { policy: policy() }]) assert.throws(() => production.getAnalysisSessionOwner(arg), /accepts no arguments/);
    for (const candidate of [null, {}, observation, diagnostic, diagnostic.provenance, readiness,
      createSessionModel(spec()).session, { ...spec(), eligible: true, allowed: true }]) {
      const r = owner.create(candidate); assertDenied(r); assert.equal(r.session, null);
    }
  });
  await test('one ROOT consume, no replay even with a new revision; orderly model lifecycle', () => {
    const s = setup(), first = s.api.consume(s.handle, 0); assert.equal(first.ok, true); assertModel(first);
    assert.equal(first.session.state, 'CONSUMED'); assert.equal(first.session.revision, 1);
    assertDenied(s.api.consume(s.handle, 0), 'REPLAY');
    assertDenied(s.api.consume(s.handle, 1), 'INVALID_TRANSITION');
    assert.equal(s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 }).session.state, 'ACTIVE');
    const final = s.api.transition(s.handle, { stage: 'FINALIZATION', expectedRevision: 2 });
    assert.equal(final.ok, true); assert.equal(final.session.state, 'FINALIZED');
    assertDenied(s.api.consume(s.handle, 3), 'TERMINAL_STATE');
  });
  for (const competitors of [2, 100]) await test(`${competitors} concurrent attempts consume at most once`, async () => {
    const s = setup();
    const results = await Promise.all(Array.from({ length: competitors }, () => Promise.resolve().then(() => s.api.consume(s.handle, 0))));
    assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.filter(r => r.reason === 'REPLAY').length, competitors - 1);
    assert.equal(s.api.inspect(s.handle).session.revision, 1);
  });
  await test('stale revision cannot advance or replace current model', () => {
    const s = setup(); s.api.consume(s.handle, 0);
    for (const expectedRevision of [0, 99]) assertDenied(s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision }), 'REPLAY');
    assert.equal(s.api.inspect(s.handle).session.state, 'CONSUMED');
  });
  await test('independent owner, module authority and restart reject original handles', () => {
    const s = setup(), other = setup(), restarted = setup(b);
    for (const owner of [other.api, restarted.api, production.getAnalysisSessionOwner()]) {
      assertDenied(owner.consume(s.handle, 0), 'UNKNOWN_HANDLE'); assertDenied(owner.inspect(s.handle), 'UNKNOWN_HANDLE');
    }
    assert.equal(s.api.consume(s.handle, 0).ok, true); assert.equal(other.api.consume(other.handle, 0).ok, true);
  });
  await test('JSON/clone/prototype/proxy/session DTO and public 4B models cannot forge handles', () => {
    const s = setup(), view = s.api.inspect(s.handle).session;
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    let traps = 0;
    const poison = new Proxy({}, { get() { traps++; throw Error('private'); }, ownKeys() { traps++; throw Error('private'); } });
    for (const fake of [null, undefined, false, 1, 1n, Symbol(), {}, JSON.parse(JSON.stringify(s.handle)), structuredClone(s.handle),
      Object.create(s.handle), new Proxy(s.handle, {}), revoked.proxy, poison, view, JSON.parse(JSON.stringify(view)), structuredClone(view), createSessionModel(spec()).session]) {
      assertDenied(s.api.consume(fake, 0), 'UNKNOWN_HANDLE'); assertDenied(s.api.revoke(fake), 'UNKNOWN_HANDLE');
    }
    assert.equal(traps, 0); assert.equal(s.api.inspect(s.handle).session.state, 'ISSUED');
  });
  for (const phase of ['ISSUED', 'CONSUMED', 'ACTIVE']) {
    await test(`absolute expiry persists terminal denial in ${phase}, including stale requests`, () => {
      const s = setup();
      if (phase !== 'ISSUED') s.api.consume(s.handle, 0);
      if (phase === 'ACTIVE') s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 });
      const before = s.api.inspect(s.handle).session.revision;
      s.controls.elapsed = 100;
      const r = s.api.consume(s.handle, 999); assertDenied(r, 'ABSOLUTE_EXPIRY');
      assert.equal(r.session.state, 'EXPIRED'); assert.equal(r.session.revision, before + 1);
      s.controls.elapsed = 0; const again = s.api.inspect(s.handle);
      assertDenied(again, 'TERMINAL_STATE'); assert.equal(again.session.state, 'EXPIRED'); assert.equal(again.session.revision, before + 1);
    });
  }
  await test('independent monotonic deadline, inclusive expiry and no TTL extension', () => {
    const s = setup(); s.controls.elapsed = 99;
    assert.equal(s.api.inspect(s.handle).ok, true);
    const deadline = s.api.consume(s.handle, 0).session.deadline;
    s.controls.clockValue = { epochMs: START + 99, monotonicMs: 110 };
    const r = s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 });
    assertDenied(r, 'MONOTONIC_DEADLINE'); assert.equal(r.session.state, 'EXPIRED'); assert.deepEqual(r.session.deadline, deadline);
  });
  await test('targeted sticky revocation between stages persists REVOKED and cannot be cleared', () => {
    const s = setup(); s.api.consume(s.handle, 0);
    const r = s.api.revoke(s.handle); assertDenied(r, 'REVOKED'); assert.equal(r.session.state, 'REVOKED');
    assertDenied(s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: r.session.revision }), 'TERMINAL_STATE');
  });
  for (const [name, change, expected] of [
    ['policy version', c => { c.policy.version = 'other'; }, 'POLICY_VERSION_MISMATCH'],
    ['policy fingerprint', c => { c.policy.fingerprint = 'other'; }, 'POLICY_FINGERPRINT_MISMATCH'],
    ['policy generation', c => { c.policy.generation++; }, 'POLICY_GENERATION_MISMATCH'],
    ['policy generation rollback', c => { c.policy.generation--; }, 'POLICY_GENERATION_MISMATCH'],
    ['revocation generation', c => { c.revocation.generation++; }, 'REVOCATION_GENERATION_MISMATCH'],
    ['revocation generation rollback', c => { c.revocation.generation--; }, 'REVOCATION_GENERATION_MISMATCH'],
    ['server revoke flag', c => { c.revocation.revoked = true; }, 'REVOKED']
  ]) await test(`${name} is server-owned and saves terminal state on refusal`, () => {
    const s = setup(); s.api.consume(s.handle, 0); change(s.controls);
    const r = s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 });
    assertDenied(r, expected); assert.equal(r.session.state, 'REVOKED');
    s.controls.policy = policy(); s.controls.revocation = { generation: 3, revoked: false };
    assertDenied(s.api.inspect(s.handle), 'TERMINAL_STATE');
  });
  await test('fresh server checks before apply catch expiry/policy/revocation changes during operation', () => {
    for (const [change, code, state] of [
      [c => { c.elapsed = 100; }, 'ABSOLUTE_EXPIRY', 'EXPIRED'],
      [c => { c.policy.version = 'changed'; }, 'POLICY_VERSION_MISMATCH', 'REVOKED'],
      [c => { c.revocation.generation++; }, 'REVOCATION_GENERATION_MISMATCH', 'REVOKED']
    ]) {
      const s = setup(); s.controls.clockHook = () => { if (s.controls.clockReads === 2) change(s.controls); };
      const r = s.api.consume(s.handle, 0); assertDenied(r, code); assert.equal(r.session.state, state);
    }
  });
  for (const bad of [undefined, null, NaN, Infinity, -1, 'UNKNOWN', true]) await test(`invalid clocks ${String(bad)} refuse without advancing`, () => {
    for (const key of ['epochMs', 'monotonicMs']) {
      const s = setup(); s.controls.clockValue = { epochMs: START, monotonicMs: 10 }; s.controls.clockValue[key] = bad;
      assertDenied(s.api.consume(s.handle, 0), 'INVALID_CLOCK');
      s.controls.clockValue = null; assert.equal(s.api.inspect(s.handle).session.revision, 0);
    }
  });
  await test('rollback between inspections/failed commands and clock drift are rejected', () => {
    const s = setup(); s.controls.elapsed = 20; s.api.inspect(s.handle);
    s.controls.elapsed = 19; assertDenied(s.api.consume(s.handle, 0), 'CLOCK_BACKWARDS');
    s.controls.elapsed = 30; assertDenied(s.api.consume(s.handle, 0), 'CLOCK_BACKWARDS');
    const rejected = setup(); rejected.controls.elapsed = 30;
    assertDenied(rejected.api.transition(rejected.handle, { stage: 'bad', expectedRevision: 0 }), 'INVALID_COMMAND');
    rejected.controls.elapsed = 29; assertDenied(rejected.api.inspect(rejected.handle), 'CLOCK_BACKWARDS');
    const drifted = setup(); drifted.controls.clockValue = { epochMs: START + 40, monotonicMs: 56 };
    assertDenied(drifted.api.inspect(drifted.handle), 'INVALID_CLOCK');
  });
  await test('invalid clocks cannot clear a sticky revoke; terminal state is persisted when time becomes valid', () => {
    const s = setup(); s.controls.clockValue = { epochMs: null, monotonicMs: null };
    assertDenied(s.api.revoke(s.handle), 'INVALID_CLOCK'); s.controls.clockValue = null;
    const r = s.api.consume(s.handle, 0); assertDenied(r, 'REVOKED'); assert.equal(r.session.state, 'REVOKED');
  });
  await test('invalid/missing server dependencies are denied and do not leak raw errors', () => {
    for (const action of [c => { c.policy = null; }, c => { c.revocation.revoked = 'UNKNOWN'; },
      c => { c.policyHook = () => { throw Error('private server value'); }; }]) {
      const s = setup(); action(s.controls); const r = s.api.consume(s.handle, 0);
      assertDenied(r); assert.equal(JSON.stringify(r).includes('private server value'), false);
    }
  });
  await test('DTOs are deep immutable projections; clients cannot substitute current or modify bindings', () => {
    const originals = [observation], s = setup(a, originals), r = s.api.inspect(s.handle);
    originals.length = 0; assert.equal(r.session.observationCount, 1);
    for (const obj of [r, r.session, r.session.scope, r.session.deadline]) assert.equal(Object.isFrozen(obj), true);
    assert.throws(() => { r.session.revision = 99; }, TypeError);
    assert.throws(() => { r.session.scope.snapshotId = 'forged'; }, TypeError);
    assert.throws(() => { r.session.deadline.expiresAtMs += 1000; }, TypeError);
    assert.equal(r.session.originalObservations, undefined); assert.equal(r.session.current, undefined);
    const copy = structuredClone(r); copy.session.state = 'ACTIVE';
    assertDenied(s.api.consume(copy.session, 0), 'UNKNOWN_HANDLE'); assert.equal(s.api.inspect(s.handle).session.state, 'ISSUED');
  });
  await test('commands reject getters/proxies/coercions and caller environment/current overrides', () => {
    const s = setup(); let touched = 0;
    const getter = Object.defineProperty({ expectedRevision: 0 }, 'stage', { get() { touched++; return 'ROOT'; }, enumerable: true });
    const poison = new Proxy({}, { get() { touched++; throw Error('private'); }, ownKeys() { touched++; throw Error('private'); } });
    const coercion = { [Symbol.toPrimitive]() { touched++; return 'ROOT'; } };
    for (const command of [getter, poison, { stage: coercion, expectedRevision: 0 },
      { stage: 'ROOT', expectedRevision: 0, current: createSessionModel(spec()).session },
      { stage: 'ROOT', expectedRevision: 0, policy: policy() }, { stage: 'ROOT', expectedRevision: 0, clock: { epochMs: START } },
      { stage: 'ROOT', expectedRevision: 0, revoked: false }, { stage: 'ROOT', expectedRevision: NaN },
      { stage: '__proto__', expectedRevision: 0 }]) assertDenied(s.api.transition(s.handle, command), 'INVALID_COMMAND');
    assert.equal(touched, 0); assert.equal(s.api.inspect(s.handle).session.revision, 0);
  });
  await test('skipped stages and adapter stages cannot consume root or become permits', () => {
    const s = setup();
    assertDenied(s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 0 }), 'INVALID_TRANSITION');
    for (const stage of ['GATEWAY', 'OPENAI', 'GEMINI']) assertDenied(s.api.transition(s.handle, { stage, expectedRevision: 0 }), 'STAGE_NOT_ENABLED');
    s.api.consume(s.handle, 0); s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 });
    for (const stage of ['GATEWAY', 'OPENAI', 'GEMINI']) assertDenied(s.api.transition(s.handle, { stage, expectedRevision: 2 }), 'STAGE_NOT_ENABLED');
  });
  await test('reentrant clock callback cannot cause a second consume', () => {
    const s = setup(); let inner;
    s.controls.clockHook = () => { s.controls.clockHook = null; inner = s.api.consume(s.handle, 0); };
    const outer = s.api.consume(s.handle, 0); assert.equal(outer.ok, true); assertDenied(inner, 'OWNER_REENTRANT');
    assert.equal(s.api.inspect(s.handle).session.revision, 1);
  });
  await test('operations create no timers or promises in the critical section', () => {
    const s = setup(), set = globalThis.setTimeout, clear = globalThis.clearTimeout;
    try {
      globalThis.setTimeout = globalThis.clearTimeout = () => assert.fail('No owner timers');
      const r = s.api.consume(s.handle, 0); assert.equal(r.ok, true); assert.equal(r.then, undefined);
      assert.equal(s.api.inspect(s.handle).then, undefined);
    } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear; }
  });
  await test('all model handles/views/results denied by Guard and direct Core/AI adapters', async () => {
    const s = setup(), result = s.api.consume(s.handle, 0);
    for (const context of [s.handle, result, result.session, diagnostic, readiness, { allowed: true, ...result }]) {
      assert.equal(checkRuntimeAccess(context).allowed, false);
      for (const fn of [core.analyze, core.getJointPrediction]) assert.equal((await fn({ safeModeEnabled: false }, context)).signal, 'SKIP');
      for (const fn of [core.getGPTAnalysis, core.getGeminiAnalysis]) assert.equal(await fn({ eligible: true }, context), null);
    }
    const source = await readFile(new URL('../core/runtime/sessionOwner.js', import.meta.url), 'utf8');
    const executableSource = source.replace(/\/\/[^\r\n]*/g, '');
    assert.doesNotMatch(executableSource, /\basync\b|\bawait\s+|setTimeout\s*\(|setInterval\s*\(/);
    assert.doesNotMatch(source, /createSessionModel\s*\(|records\.set\s*\(/);
  });
  const originalGroups = count;
  assert.equal(originalGroups, 36);
  const changes = [
    ['expiry', c => { c.elapsed = 100; }, 'ABSOLUTE_EXPIRY', 'EXPIRED'],
    ['policy version', c => { c.policy.version = 'changed'; }, 'POLICY_VERSION_MISMATCH', 'REVOKED'],
    ['policy fingerprint', c => { c.policy.fingerprint = 'changed'; }, 'POLICY_FINGERPRINT_MISMATCH', 'REVOKED'],
    ['policy generation', c => { c.policy.generation++; }, 'POLICY_GENERATION_MISMATCH', 'REVOKED'],
    ['revocation generation', c => { c.revocation.generation++; }, 'REVOCATION_GENERATION_MISMATCH', 'REVOKED'],
    ['server revoked', c => { c.revocation.revoked = true; }, 'REVOKED', 'REVOKED']
  ];
  const activate = s => { s.api.consume(s.handle, 0); s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 }); };
  const restore = s => {
    s.controls.clockHook = null; s.controls.clockValue = null;
    s.controls.policy = policy(); s.controls.revocation = { generation: 3, revoked: false };
  };
  for (const phase of ['ISSUED', 'ACTIVE']) for (const [name, change, reason, state] of changes) {
    await test(`FIX1 D1 ${phase}: invalid ANALYSIS persists second-read ${name}`, () => {
      const s = setup(); if (phase === 'ACTIVE') activate(s);
      const revision = s.api.inspect(s.handle).session.revision, beforeReads = s.controls.clockReads;
      const deadline = s.api.inspect(s.handle).session.deadline;
      const startReads = s.controls.clockReads;
      s.controls.clockHook = () => { if (s.controls.clockReads === startReads + 2) change(s.controls); };
      const r = s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: revision });
      assertDenied(r, reason); assert.equal(r.session.state, state); assert.equal(r.session.revision, revision + 1);
      assert.deepEqual(r.session.deadline, deadline); assert.ok(s.controls.clockReads > beforeReads);
      restore(s); s.controls.elapsed = 0;
      const again = s.api.transition(s.handle, { stage: 'FINALIZATION', expectedRevision: revision + 1 });
      assertDenied(again, 'TERMINAL_STATE'); assert.equal(again.session.state, state);
    });
  }
  await test('FIX1 D1 absence of terminal evidence preserves INVALID_TRANSITION and revision', () => {
    for (const phase of ['ISSUED', 'ACTIVE']) {
      const s = setup(); if (phase === 'ACTIVE') activate(s);
      const revision = phase === 'ACTIVE' ? 2 : 0;
      const r = s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: revision });
      assertDenied(r, 'INVALID_TRANSITION'); assert.equal(r.session.state, phase); assert.equal(r.session.revision, revision);
    }
  });
  await test('FIX1 D2 second-read +50 survives invalid transition; +30 rollback locks owner permanently', () => {
    const s = setup(), deadline = s.api.inspect(s.handle).session.deadline;
    const start = s.controls.clockReads;
    s.controls.clockHook = () => { if (s.controls.clockReads === start + 2) s.controls.elapsed = 50; };
    assertDenied(s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 0 }), 'INVALID_TRANSITION');
    s.controls.clockHook = null; s.controls.elapsed = 30;
    assertDenied(s.api.consume(s.handle, 0), 'CLOCK_BACKWARDS');
    for (const elapsed of [50, 60, 90]) {
      s.controls.elapsed = elapsed; const r = s.api.consume(s.handle, 0);
      assertDenied(r, 'CLOCK_BACKWARDS'); assert.equal(r.session.revision, 0); assert.deepEqual(r.session.deadline, deadline);
    }
    s.controls.elapsed = 100;
    const expired = s.api.inspect(s.handle); assertDenied(expired, 'ABSOLUTE_EXPIRY'); assert.equal(expired.session.state, 'EXPIRED');
  });
  await test('FIX1 D2 rollback of either coherent clock between first and second reads is sticky', () => {
    for (const key of ['epochMs', 'monotonicMs']) {
      const s = setup(); s.controls.elapsed = 20;
      s.controls.clockHook = () => { if (s.controls.clockReads === 2) {
        s.controls.clockValue = { epochMs: START + 20, monotonicMs: 30 }; s.controls.clockValue[key]--;
      } };
      assertDenied(s.api.consume(s.handle, 0), 'CLOCK_BACKWARDS');
      restore(s); s.controls.elapsed = 30;
      assertDenied(s.api.consume(s.handle, 0), 'CLOCK_BACKWARDS');
      s.controls.revocation.revoked = true;
      const r = s.api.inspect(s.handle); assertDenied(r, 'REVOKED'); assert.equal(r.session.state, 'REVOKED');
    }
  });
  await test('FIX1 D2 excessive drift cannot conceal a rollback of bounded numeric clocks', () => {
    const s = setup(); s.controls.elapsed = 50; s.api.inspect(s.handle);
    s.controls.clockValue = { epochMs: START + 30, monotonicMs: 80 };
    assertDenied(s.api.inspect(s.handle), 'CLOCK_BACKWARDS');
    restore(s); s.controls.elapsed = 60;
    assertDenied(s.api.consume(s.handle, 0), 'CLOCK_BACKWARDS');
  });
  for (const bad of [undefined, null, NaN, Infinity, -1, 'UNKNOWN', true]) {
    await test(`FIX1 D2 invalid second-read ${String(bad)} never becomes trusted clock`, () => {
      for (const key of ['epochMs', 'monotonicMs']) {
        const s = setup(); s.controls.clockHook = () => { if (s.controls.clockReads === 2) {
          s.controls.clockValue = { epochMs: START + 50, monotonicMs: 60 }; s.controls.clockValue[key] = bad;
        } };
        assertDenied(s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 0 }), 'INVALID_CLOCK');
        restore(s); s.controls.elapsed = 1;
        assert.equal(s.api.consume(s.handle, 0).ok, true);
      }
    });
  }
  await test('FIX1 D2 inconsistent drift and out-of-range clocks are never remembered', () => {
    for (const value of [{ epochMs: START + 50, monotonicMs: 1000 },
      { epochMs: 8640000000000001, monotonicMs: 10 }, { epochMs: START, monotonicMs: Number.MAX_SAFE_INTEGER + 1 }]) {
      const s = setup(); s.controls.clockHook = () => { if (s.controls.clockReads === 2) s.controls.clockValue = value; };
      assertDenied(s.api.consume(s.handle, 0), 'INVALID_CLOCK'); restore(s); s.controls.elapsed = 1;
      assert.equal(s.api.consume(s.handle, 0).ok, true);
    }
  });
  for (const phase of ['ISSUED', 'ACTIVE']) for (const read of [1, 2]) {
    for (const [name, change, reason] of changes.filter(c => c[0] !== 'expiry')) {
      await test(`FIX1 D3 ${phase}: sticky ${name} with invalid clock at read ${read}`, () => {
        const s = setup(); if (phase === 'ACTIVE') activate(s);
        const revision = phase === 'ACTIVE' ? 2 : 0, start = s.controls.clockReads;
        s.controls.clockHook = () => { if (s.controls.clockReads === start + read) {
          change(s.controls); s.controls.clockValue = { epochMs: null, monotonicMs: null };
        } };
        const command = { stage: phase === 'ACTIVE' ? 'FINALIZATION' : 'ROOT', expectedRevision: revision };
        const first = s.api.transition(s.handle, command); assertDenied(first, 'INVALID_CLOCK');
        assert.equal(first.session.state, phase); assert.equal(first.session.revision, revision);
        restore(s);
        const r = s.api.transition(s.handle, command); assertDenied(r, reason);
        assert.equal(r.session.state, 'REVOKED'); assert.equal(r.session.revision, revision + 1);
        restore(s); assertDenied(s.api.inspect(s.handle), 'TERMINAL_STATE');
      });
    }
  }
  await test('FIX1 D3 malformed policy/revocation cannot create sticky evidence', () => {
    const invalidPolicies = [null, { version: 'changed', fingerprint: 'offline-fingerprint', generation: NaN },
      { version: 'UNKNOWN', fingerprint: 'changed', generation: 2 }, { ...policy(), extra: true },
      new Proxy({ ...policy(), generation: 99 }, {}),
      Object.defineProperty({ ...policy() }, 'generation', { get() { assert.fail('No policy getters'); } })];
    const invalidRevocations = [null, { generation: 99, revoked: 'UNKNOWN' }, { generation: -1, revoked: true },
      { generation: NaN, revoked: true }, { generation: 99, revoked: true, extra: true }, new Proxy({ generation: 99, revoked: true }, {})];
    for (const [key, values] of [['policy', invalidPolicies], ['revocation', invalidRevocations]]) for (const value of values) {
      const s = setup(); s.controls[key] = value; s.controls.clockValue = { epochMs: null, monotonicMs: null };
      assertDenied(s.api.consume(s.handle, 0), 'OWNER_ENVIRONMENT_UNAVAILABLE'); restore(s);
      assert.equal(s.api.consume(s.handle, 0).ok, true);
    }
  });
  await test('FIX1 D3 independent readers retain valid evidence despite another dependency throwing', () => {
    for (const failure of ['clock', 'policy', 'revocation']) {
      const controls = { broken: true, changed: true };
      const harness = a.createOfflineOwner({
        clock() { if (controls.broken && failure === 'clock') throw Error('hidden clock error'); return { epochMs: START, monotonicMs: 10 }; },
        policy() { if (controls.broken && failure === 'policy') throw Error('hidden policy error'); return controls.changed && failure === 'revocation' ? { ...policy(), generation: 99 } : policy(); },
        revocation() { if (controls.broken && failure === 'revocation') throw Error('hidden revocation error'); return { generation: 3, revoked: controls.changed && failure !== 'revocation' }; }
      });
      const h = harness.seedOffline(spec()); const first = harness.api.consume(h, 0);
      assertDenied(first, 'OWNER_ENVIRONMENT_UNAVAILABLE'); assert.equal(JSON.stringify(first).includes('hidden'), false);
      controls.broken = controls.changed = false;
      const r = harness.api.consume(h, 0); assertDenied(r); assert.equal(r.session.state, 'REVOKED');
    }
  });
  await test('FIX1 concurrent consume/transition and stale revisions never restore revoked owner', async () => {
    const s = setup();
    const roots = await Promise.all(Array.from({ length: 32 }, () => Promise.resolve().then(() => s.api.consume(s.handle, 0))));
    assert.equal(roots.filter(r => r.ok).length, 1);
    s.controls.clockValue = { epochMs: null, monotonicMs: null }; s.controls.revocation.generation++;
    assertDenied(s.api.inspect(s.handle), 'INVALID_CLOCK'); restore(s);
    const results = await Promise.all(Array.from({ length: 64 }, (_, i) => Promise.resolve().then(() => i % 2 ?
      s.api.consume(s.handle, 0) : s.api.transition(s.handle, { stage: 'ANALYSIS', expectedRevision: 1 }))));
    assert.equal(results.some(r => r.ok), false);
    for (const r of results) { assertDenied(r); assert.equal(r.session.state, 'REVOKED'); assert.equal(r.session.revision, 2); }
  });
  await test('FIX1 production exports and guards remain deny-only after all correction scenarios', async () => {
    const owner = production.getAnalysisSessionOwner();
    for (const candidate of [setup().handle, {}, { eligible: true, grantsRuntimeAccess: true }, diagnostic, readiness]) {
      const r = owner.create(candidate); assertDenied(r); assert.equal(r.session, null);
      assert.equal(checkRuntimeAccess(candidate).allowed, false);
      assert.equal((await core.getJointPrediction(null, candidate)).signal, 'SKIP');
      assert.equal(await core.getGPTAnalysis(null, candidate), null); assert.equal(await core.getGeminiAnalysis(null, candidate), null);
    }
    assert.deepEqual(Object.keys(production), ['getAnalysisSessionOwner']);
  });
  console.log(`FIX1: ${count - originalGroups} adversarial groups PASS; original 4E: ${originalGroups} groups PASS`);
  assert.equal(network, 0);
  console.log(`Session owner: ${count} tests PASS; production sessions/grants: 0; external IO attempts: 0`);
} finally {
  hooks?.deregister(); delete globalThis.__ownerEvidenceDependencies;
  globalThis.fetch = saved.fetch; http.request = saved.request; http.get = saved.get;
  https.request = saved.httpsRequest; https.get = saved.httpsGet;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
}
