import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { readFile } from 'node:fs/promises';
import { registerHooks, syncBuiltinESMExports } from 'node:module';

const T = Date.parse('2026-11-19T12:00:00Z');
const policy = () => ({ version: 'offline-stage-v1', fingerprint: 'offline-policy', generation: 2 });
const spec = () => ({ sessionId: 'same-session-id', scope: { snapshotId: 'same-snapshot', sourceId: 'biquote',
  pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY', requirementsFingerprint: 'offline-requirements',
  policyFingerprint: 'offline-policy', strategyVersion: 'offline-strategy' }, policy: policy(),
  deadline: { issuedAtMs: T, expiresAtMs: T + 100, issuedMonotonicMs: 10,
    deadlineMonotonicMs: 110, maxClockDriftMs: 5 }, revocationGeneration: 3 });
let count = 0, io = 0;
const saved = { fetch: globalThis.fetch, request: http.request, get: http.get, hr: https.request,
  hg: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
const noNetwork = () => { io++; throw Error('External IO forbidden in stage tests'); };
const model = r => { assert.equal(r.mode, 'MODEL_ONLY'); assert.equal(r.modelOnly, true); assert.equal(r.grantsRuntimeAccess, false); };
const deny = (r, reason) => { model(r); assert.equal(r.ok, false); assert.equal(r.status, 'DENIED'); if (reason) assert.equal(r.reason, reason); return r; };
const pass = r => { model(r); assert.equal(r.ok, true); return r; };
const test = async (name, run) => { await run(); count++; console.log('PASS ' + name); };
let hook;
try {
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = noNetwork;
  syncBuiltinESMExports();
  hook = registerHooks({ load(url, context, next) {
    const r = next(url, context);
    if (!/\/core\/runtime\/sessionOwner\.js\?stage-fixture=[AB]$/.test(url)) return r;
    let source = String(r.source); assert.match(source, /  return owner;\r?\n}/);
    // The only fixture creation path: inject into separate in-memory copies, never canonical exports.
    source = source.replace(/  return owner;\r?\n}/, `  return { api: owner, seedOffline(spec, deadline) {
      const made = offlineModel(spec); if (!made.ok) throw Error('Invalid offline spec');
      const parent = Object.freeze(Object.create(null));
      const record = { current: made.session, busy: false, revoked: false, lastClock: made.session.lastClock,
        binding: Object.freeze({ input: null, originalObservations: Object.freeze([]), scope: made.session.scope }) };
      records.set(parent, record);
      const handles = createStageRecords(record, deadline);
      return { parent, handles, duplicate: () => createStageRecords(record),
        corruptBinding: stage => { stageEntries.get(handles[stage]).binding = {}; } };
    } };
}`);
    return { ...r, source: "import { createSessionModel as offlineModel } from './stateMachine.js';\n" + source +
      '\nexport { createSessionOwner as offlineOwner };' };
  } });
  const canonical = await import('../core/runtime/sessionOwner.js');
  const a = await import('../core/runtime/sessionOwner.js?stage-fixture=A');
  const b = await import('../core/runtime/sessionOwner.js?stage-fixture=B');
  const guard = await import('../core/runtimeGuard.js');
  const core = await import('../core/index.js');
  const legacy = await import('../ai-consensus.js');
  function setup({ module = a, active = true, deadline } = {}) {
    const c = { elapsed: 0, reads: 0, hook: null, clock: null, policy: policy(), revocation: { generation: 3, revoked: false } };
    const h = module.offlineOwner({ clock() { c.reads++; c.hook?.(); return c.clock ?? { epochMs: T + c.elapsed, monotonicMs: 10 + c.elapsed }; },
      policy: () => c.policy, revocation: () => c.revocation });
    const seed = h.seedOffline(spec(), deadline);
    if (active) { pass(h.api.consume(seed.parent, 0)); pass(h.api.transition(seed.parent, { stage: 'ANALYSIS', expectedRevision: 1 })); }
    return { ...seed, api: h.api, stages: h.api.stages, c, sibling() {
      const second = h.seedOffline(spec());
      pass(h.api.consume(second.parent, 0)); pass(h.api.transition(second.parent, { stage: 'ANALYSIS', expectedRevision: 1 }));
      return { ...second, api: h.api, stages: h.api.stages, c };
    } };
  }
  const cmd = (stage, expectedRevision) => ({ stage, expectedRevision });
  function prepare(s) {
    for (const stage of ['ROOT', 'ANALYSIS', 'GATEWAY']) {
      pass(s.stages.consume(s.parent, s.handles[stage], cmd(stage, 0)));
      pass(s.stages.complete(s.parent, s.handles[stage], cmd(stage, 1)));
    }
  }
  await test('canonical exports/namespace contain no constructor, issuer, seed or registration', () => {
    assert.deepEqual(Object.keys(canonical), ['getAnalysisSessionOwner']);
    const owner = canonical.getAnalysisSessionOwner();
    assert.deepEqual(Object.keys(owner.stages).sort(), ['complete', 'consume', 'finalize', 'inspect']);
    assert.equal(Object.isFrozen(owner), true); assert.equal(Object.isFrozen(owner.stages), true);
    assert.equal(Object.getOwnPropertyDescriptor(owner, 'stages').enumerable, false);
    assert.equal(Object.getOwnPropertyDescriptor(owner, 'stages').writable, false);
    const s = setup();
    for (const value of [null, {}, s.parent, s.handles.OPENAI, { mode: 'MODEL_ONLY', eligible: true, allowed: true }]) {
      const r = owner.create(value); deny(r); assert.equal(r.session, null);
      deny(owner.stages.consume(value, s.handles.OPENAI, cmd('OPENAI', 0)), 'UNKNOWN_HANDLE');
    }
    assert.throws(() => canonical.getAnalysisSessionOwner({ seed: true }));
  });
  await test('ROOT/ANALYSIS/GATEWAY ordered model bookkeeping, no parent lifecycle mutation', () => {
    const s = setup();
    deny(s.stages.consume(s.parent, s.handles.GATEWAY, cmd('GATEWAY', 0)), 'STAGE_ORDER');
    deny(s.stages.complete(s.parent, s.handles.ROOT, cmd('ROOT', 0)), 'STAGE_NOT_CONSUMED');
    prepare(s);
    assert.equal(s.api.inspect(s.parent).session.state, 'ACTIVE'); assert.equal(s.api.inspect(s.parent).session.revision, 2);
    for (const stage of ['ROOT', 'ANALYSIS', 'GATEWAY']) assert.equal(s.stages.inspect(s.parent, s.handles[stage]).entry.state, 'COMPLETED');
  });
  for (const adapter of ['OPENAI', 'GEMINI']) {
    await test(`${adapter}: independent one-use consume and completion; stale/new revision replay denied`, () => {
      const s = setup(); prepare(s);
      pass(s.stages.consume(s.parent, s.handles[adapter], cmd(adapter, 0)));
      deny(s.stages.consume(s.parent, s.handles[adapter], cmd(adapter, 0)), 'REPLAY');
      deny(s.stages.consume(s.parent, s.handles[adapter], cmd(adapter, 1)), 'STAGE_ALREADY_CONSUMED');
      pass(s.stages.complete(s.parent, s.handles[adapter], cmd(adapter, 1)));
      deny(s.stages.complete(s.parent, s.handles[adapter], cmd(adapter, 2)), 'STAGE_TERMINAL');
      const other = adapter === 'OPENAI' ? 'GEMINI' : 'OPENAI';
      assert.equal(s.stages.inspect(s.parent, s.handles[other]).entry.revision, 0);
    });
    await test(`${adapter}: 100 concurrent consumes succeed at most once`, async () => {
      const s = setup(); prepare(s);
      const results = await Promise.all(Array.from({ length: 100 }, () => Promise.resolve().then(() => s.stages.consume(s.parent, s.handles[adapter], cmd(adapter, 0)))));
      assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.filter(r => r.reason === 'REPLAY').length, 99);
    });
  }
  await test('OpenAI and Gemini can independently consume/complete concurrently without any AI', async () => {
    const s = setup(); prepare(s);
    for (const [action, revision] of [['consume', 0], ['complete', 1]]) {
      const results = await Promise.all(['OPENAI', 'GEMINI'].map(stage => Promise.resolve().then(() => s.stages[action](s.parent, s.handles[stage], cmd(stage, revision)))));
      results.forEach(pass); assert.notEqual(s.handles.OPENAI, s.handles.GEMINI);
    }
  });
  await test('cross-adapter and cross-stage replay cannot advance the target attempt', () => {
    const s = setup(); prepare(s);
    for (const [handle, stage] of [[s.handles.OPENAI, 'GEMINI'], [s.handles.GEMINI, 'OPENAI'], [s.handles.OPENAI, 'ROOT']]) {
      deny(s.stages.consume(s.parent, handle, cmd(stage, 0)), 'STAGE_MISMATCH');
    }
    assert.equal(s.stages.inspect(s.parent, s.handles.OPENAI).entry.revision, 0);
  });
  await test('same textual session/snapshot IDs do not bind foreign parents or independent owners', () => {
    const s = setup(), other = s.sibling(), outsider = setup(), foreign = setup({ module: b }); prepare(s); prepare(other); prepare(foreign);
    deny(s.stages.consume(other.parent, s.handles.OPENAI, cmd('OPENAI', 0)), 'PARENT_MISMATCH');
    deny(s.stages.consume(foreign.parent, s.handles.OPENAI, cmd('OPENAI', 0)), 'UNKNOWN_HANDLE');
    deny(outsider.stages.consume(outsider.parent, s.handles.OPENAI, cmd('OPENAI', 0)), 'UNKNOWN_STAGE_HANDLE');
    assert.throws(s.duplicate, /already exists/);
  });
  await test('JSON/clone/prototype/proxy/getters cannot forge a parent or stage handle', () => {
    const s = setup(); prepare(s); let traps = 0;
    const proxy = new Proxy({}, { get() { traps++; throw Error('private'); }, ownKeys() { traps++; throw Error('private'); } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const view = s.stages.inspect(s.parent, s.handles.OPENAI).entry;
    for (const candidate of [null, undefined, 1, false, Symbol(), {}, JSON.parse(JSON.stringify(s.handles.OPENAI)), structuredClone(s.handles.OPENAI),
      view, structuredClone(view), s.api.inspect(s.parent).session, Object.create(s.handles.OPENAI), new Proxy(s.handles.OPENAI, {}), proxy, revoked.proxy]) {
      deny(s.stages.consume(s.parent, candidate, cmd('OPENAI', 0)), 'UNKNOWN_STAGE_HANDLE');
      deny(s.stages.consume(candidate, s.handles.OPENAI, cmd('OPENAI', 0)), 'UNKNOWN_HANDLE');
    }
    assert.equal(traps, 0);
  });
  await test('commands reject forged revisions, accessors, proxies, result flags and deadline changes', () => {
    const s = setup(); prepare(s); let accesses = 0;
    const accessor = Object.defineProperty({ expectedRevision: 0 }, 'stage', { get() { accesses++; return 'OPENAI'; }, enumerable: true });
    const proxy = new Proxy({}, { ownKeys() { accesses++; throw Error('no'); } });
    for (const c of [accessor, proxy, cmd('OPENAI', NaN), cmd('OPENAI', -1), cmd('OPENAI', '0'),
      { ...cmd('OPENAI', 0), success: true }, { ...cmd('OPENAI', 0), expiresAtMs: T + 1000 },
      { ...cmd('OPENAI', 0), runtimeContext: { allowed: true } }]) deny(s.stages.consume(s.parent, s.handles.OPENAI, c), 'INVALID_COMMAND');
    deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 99)), 'REPLAY'); assert.equal(accesses, 0);
  });
  await test('deep immutable stage DTO has scope, versions, fixed deadline but no parent/chain references', () => {
    const s = setup(), r = s.stages.inspect(s.parent, s.handles.OPENAI);
    for (const obj of [r, r.entry, r.entry.scope, r.entry.policy, r.entry.deadline]) assert.equal(Object.isFrozen(obj), true);
    for (const field of ['parent', 'chain', 'binding', 'handle']) assert.equal(r.entry[field], undefined);
    assert.throws(() => { r.entry.scope.pair = 'GBP/USD'; }); assert.throws(() => { r.entry.deadline.expiresAtMs += 1000; });
    assert.equal(r.entry.policy.fingerprint, spec().policy.fingerprint);
  });
  await test('private child deadline cannot extend parent; no duplicate chain or public DTO constructor', () => {
    for (const d of [{ ...spec().deadline, expiresAtMs: T + 101 }, { ...spec().deadline, deadlineMonotonicMs: 111 },
      { ...spec().deadline, maxClockDriftMs: 999 }, { ...spec().deadline, issuedAtMs: T + 1 }]) assert.throws(() => setup({ deadline: d }), /deadline/);
    const s = setup(); assert.throws(s.duplicate, /already exists/); assert.equal(s.stages.create, undefined);
  });
  for (const clock of ['epoch', 'monotonic']) await test(`child ${clock} expiry is sticky while parent remains ACTIVE`, () => {
    const d = { ...spec().deadline, expiresAtMs: clock === 'epoch' ? T + 50 : T + 100,
      deadlineMonotonicMs: clock === 'monotonic' ? 60 : 110 };
    const s = setup({ deadline: d }); prepare(s); pass(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
    s.c.elapsed = 50; const r = deny(s.stages.complete(s.parent, s.handles.OPENAI, cmd('OPENAI', 1)), 'STAGE_EXPIRED');
    assert.equal(r.entry.state, 'EXPIRED'); assert.equal(s.api.inspect(s.parent).session.state, 'ACTIVE');
    s.c.elapsed = 51; deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', r.entry.revision)), 'STAGE_EXPIRED');
  });
  const changes = [
    ['expiry', c => { c.elapsed = 100; }, 'ABSOLUTE_EXPIRY', 'EXPIRED'],
    ['revoked', c => { c.revocation.revoked = true; }, 'REVOKED', 'REVOKED'],
    ['revocation generation', c => { c.revocation.generation++; }, 'REVOCATION_GENERATION_MISMATCH', 'REVOKED'],
    ['policy version', c => { c.policy.version = 'other'; }, 'POLICY_VERSION_MISMATCH', 'REVOKED'],
    ['policy fingerprint', c => { c.policy.fingerprint = 'other'; }, 'POLICY_FINGERPRINT_MISMATCH', 'REVOKED'],
    ['policy generation', c => { c.policy.generation++; }, 'POLICY_GENERATION_MISMATCH', 'REVOKED']
  ];
  for (const [name, change, reason, state] of changes) for (const when of ['between stages', 'before apply']) {
    await test(`parent ${name} ${when} blocks completion and persists child terminal state`, () => {
      const s = setup(); prepare(s); pass(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
      if (when === 'between stages') change(s.c);
      else { const start = s.c.reads; s.c.hook = () => { if (s.c.reads === start + 2) change(s.c); }; }
      const r = deny(s.stages.complete(s.parent, s.handles.OPENAI, cmd('OPENAI', 1)), reason);
      assert.equal(r.entry.state, state); assert.equal(s.api.inspect(s.parent).session.state, state);
      s.c.hook = null; s.c.elapsed = 0; s.c.policy = policy(); s.c.revocation = { generation: 3, revoked: false };
      deny(s.stages.complete(s.parent, s.handles.OPENAI, cmd('OPENAI', 1)), 'TERMINAL_STATE');
      const sibling = deny(s.stages.consume(s.parent, s.handles.GEMINI, cmd('GEMINI', 0)), 'TERMINAL_STATE');
      assert.equal(sibling.entry.state, state);
    });
  }
  await test('parent identity must be ACTIVE, and legacy FINALIZED cancels pending attempts', () => {
    const s = setup({ active: false }); deny(s.stages.consume(s.parent, s.handles.ROOT, cmd('ROOT', 0)), 'PARENT_NOT_ACTIVE');
    pass(s.api.consume(s.parent, 0)); pass(s.api.transition(s.parent, cmd('ANALYSIS', 1))); prepare(s);
    pass(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
    pass(s.api.transition(s.parent, cmd('FINALIZATION', 2)));
    const r = deny(s.stages.complete(s.parent, s.handles.OPENAI, cmd('OPENAI', 1)), 'TERMINAL_STATE'); assert.equal(r.entry.state, 'CANCELLED');
  });
  await test('FIX1 rollback high-water and irreversible clockFault apply through stage operations', () => {
    const s = setup(); prepare(s); const start = s.c.reads;
    s.c.hook = () => { if (s.c.reads === start + 2) s.c.elapsed = 50; };
    deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('GEMINI', 0)), 'STAGE_MISMATCH');
    s.c.hook = null; s.c.elapsed = 30;
    assert.equal(deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)), 'CLOCK_BACKWARDS').entry.state, 'DENIED');
    s.c.elapsed = 60; deny(s.stages.consume(s.parent, s.handles.GEMINI, cmd('GEMINI', 0)), 'CLOCK_BACKWARDS');
  });
  await test('invalid clock cannot hide sticky server revocation after old generation is restored', () => {
    const s = setup(); prepare(s); pass(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
    s.c.clock = { epochMs: null, monotonicMs: null }; s.c.revocation.generation++;
    deny(s.stages.complete(s.parent, s.handles.OPENAI, cmd('OPENAI', 1)), 'INVALID_CLOCK');
    s.c.clock = null; s.c.revocation.generation--;
    const r = deny(s.stages.complete(s.parent, s.handles.OPENAI, cmd('OPENAI', 1)), 'REVOCATION_GENERATION_MISMATCH'); assert.equal(r.entry.state, 'REVOKED');
  });
  await test('terminal parent evidence on second read overrides replay, wrong adapter and malformed commands', () => {
    for (const command of [cmd('OPENAI', 99), cmd('GEMINI', 0), { ...cmd('OPENAI', 0), success: true }]) {
      const s = setup(); prepare(s); const start = s.c.reads;
      s.c.hook = () => { if (s.c.reads === start + 2) s.c.policy.generation++; };
      const r = deny(s.stages.consume(s.parent, s.handles.OPENAI, command), 'POLICY_GENERATION_MISMATCH');
      assert.equal(r.entry.state, 'REVOKED'); assert.equal(r.entry.revision, 1);
    }
  });
  await test('second-read child expiry blocks consume without expiring parent or extending deadline', () => {
    const s = setup({ deadline: { ...spec().deadline, expiresAtMs: T + 50, deadlineMonotonicMs: 60 } }); prepare(s);
    const before = s.stages.inspect(s.parent, s.handles.OPENAI).entry.deadline, start = s.c.reads;
    s.c.hook = () => { if (s.c.reads === start + 2) s.c.elapsed = 50; };
    const r = deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)), 'STAGE_EXPIRED');
    assert.equal(r.entry.state, 'EXPIRED'); assert.deepEqual(r.entry.deadline, before);
    assert.equal(s.api.inspect(s.parent).session.state, 'ACTIVE');
  });
  await test('second-read rollback and invalid-clock revocation cannot advance the attempt', () => {
    for (const fault of ['rollback', 'revocation']) {
      const s = setup(); prepare(s); s.c.elapsed = 20; const start = s.c.reads;
      s.c.hook = () => { if (s.c.reads === start + 2) {
        if (fault === 'rollback') s.c.elapsed = 19;
        else { s.c.clock = { epochMs: null, monotonicMs: null }; s.c.revocation.generation++; }
      } };
      deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)), fault === 'rollback' ? 'CLOCK_BACKWARDS' : 'INVALID_CLOCK');
      s.c.hook = null; s.c.clock = null; s.c.elapsed = 30; s.c.revocation.generation = 3;
      const r = deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)), fault === 'rollback' ? 'CLOCK_BACKWARDS' : 'REVOCATION_GENERATION_MISMATCH');
      assert.notEqual(r.entry.state, 'CONSUMED');
    }
  });
  await test('unavailable or malformed parent environment denies without exposing raw failures', () => {
    for (const change of [c => { c.policy = null; }, c => { c.revocation = { generation: 3, revoked: 'UNKNOWN' }; },
      c => { c.clock = { epochMs: NaN, monotonicMs: 10 }; }]) {
      const s = setup(); prepare(s); change(s.c);
      const r = deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
      assert.equal(r.entry.revision, 0);
    }
  });
  await test('injected binding corruption fails closed without accepting matching textual scope', () => {
    const s = setup(); prepare(s); s.corruptBinding('OPENAI');
    assert.equal(deny(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)), 'STAGE_BINDING_MISMATCH').entry.state, 'DENIED');
  });
  await test('parent lock prevents reentrant stage consumption and revoke; no timers or async boundary', async () => {
    const s = setup(); prepare(s); let inner, revoked;
    s.c.hook = () => { s.c.hook = null; inner = s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)); revoked = s.api.revoke(s.parent); };
    const r = pass(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
    deny(inner, 'OWNER_REENTRANT'); assert.equal(revoked.reason, 'OWNER_REENTRANT'); assert.equal(r.then, undefined);
    const text = (await readFile(new URL('../core/runtime/sessionOwner.js', import.meta.url), 'utf8')).replace(/\/\/[^\r\n]*/g, '');
    assert.doesNotMatch(text, /\basync\b|\bawait\s+|setTimeout\s*\(|setInterval\s*\(/);
  });
  await test('new finalization always DENIED, even after both model adapters complete; replay stays denied', () => {
    const s = setup(); prepare(s);
    for (const adapter of ['OPENAI', 'GEMINI']) { pass(s.stages.consume(s.parent, s.handles[adapter], cmd(adapter, 0))); pass(s.stages.complete(s.parent, s.handles[adapter], cmd(adapter, 1))); }
    const r = deny(s.stages.finalize(s.parent, s.handles.FINALIZATION, cmd('FINALIZATION', 0)), 'FINALIZATION_DISABLED');
    assert.equal(r.entry.state, 'DENIED');
    deny(s.stages.finalize(s.parent, s.handles.FINALIZATION, cmd('FINALIZATION', 0)), 'REPLAY');
    deny(s.stages.finalize(s.parent, s.handles.FINALIZATION, cmd('FINALIZATION', 1)), 'STAGE_TERMINAL');
    assert.equal(s.api.inspect(s.parent).session.state, 'ACTIVE');
  });
  await test('handles/views/model completion cannot call Core, legacy Gateway or direct adapters', async () => {
    const s = setup(); prepare(s); const result = pass(s.stages.consume(s.parent, s.handles.OPENAI, cmd('OPENAI', 0)));
    for (const context of [...Object.values(s.handles), result, result.entry, structuredClone(result), { ...result, allowed: true }]) {
      assert.equal(guard.checkRuntimeAccess(context).allowed, false);
      for (const fn of [core.analyze, core.getJointPrediction, legacy.getJointPrediction]) assert.equal((await fn(null, context)).signal, 'SKIP');
      assert.equal(await core.getGPTAnalysis(null, context), null); assert.equal(await core.getGeminiAnalysis(null, context), null);
    }
  });
  assert.equal(io, 0);
  console.log(`Stage owner: ${count} offline groups PASS; external IO: 0; production sessions/grants/AdapterPermit: 0`);
} finally {
  hook?.deregister(); globalThis.fetch = saved.fetch;
  http.request = saved.request; http.get = saved.get; https.request = saved.hr; https.get = saved.hg;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
}
