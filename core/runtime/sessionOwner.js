import { performance } from 'node:perf_hooks';
import { types } from 'node:util';
import { evaluateSessionModel, planSessionTransition, applySessionTransition } from './stateMachine.js';
import { isTrustedAnalysisInput } from '../analysis/input.js';

const epochNow = Date.now;
const monotonicNow = performance.now.bind(performance);
const policy = Object.freeze({ version: '4e-model-only', fingerprint: '4e-model-only-deny-all', generation: 0 });
const revocation = Object.freeze({ generation: 0, revoked: false });
const serverDependencies = Object.freeze({
  clock: () => ({ epochMs: epochNow(), monotonicMs: monotonicNow() }),
  policy: () => policy,
  revocation: () => revocation
});
const isProxy = types.isProxy;
const edges = Object.freeze({ ROOT: 'CONSUMED', ANALYSIS: 'ACTIVE', FINALIZATION: 'FINALIZED' });
const closedStages = Object.freeze(['GATEWAY', 'OPENAI', 'GEMINI']);
const terminal = state => ['FINALIZED', 'EXPIRED', 'REVOKED'].includes(state);
const generation = value => Number.isSafeInteger(value) && value >= 0;
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 512 &&
  value.trim() === value && value.toUpperCase() !== 'UNKNOWN';

function fields(value, keys) {
  if (!value || typeof value !== 'object' || isProxy(value) || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).length !== keys.length || !keys.every(k => Object.hasOwn(d, k) && Object.hasOwn(d[k], 'value'))) return null;
  return Object.fromEntries(keys.map(k => [k, d[k].value]));
}
function snapshot(record) {
  if (!record) return null;
  const s = record.current;
  return Object.freeze({ schemaVersion: 1, mode: 'MODEL_ONLY', modelOnly: true, grantsRuntimeAccess: false,
    sessionId: s.sessionId, state: s.state, stage: s.stage, revision: s.revision,
    scope: Object.freeze({ ...s.scope }), deadline: Object.freeze({ ...s.deadline }), terminalReason: s.terminalReason,
    observationCount: record.binding.originalObservations.length, marketEvidence: 'NOT_AUTHORIZING' });
}
const response = (ok, reason, record = null) => Object.freeze({
  status: ok ? 'MODEL_ONLY' : 'DENIED', mode: 'MODEL_ONLY', modelOnly: true, grantsRuntimeAccess: false, ok, reason, session: snapshot(record)
});

// Private constructor. No caller of the exported API can supply dependencies, current
// models, policy, clocks, evidence or registration callbacks. No model creation/writer here.
function createSessionOwner(dependencies) {
  const records = new WeakMap();
  const readRecord = records.get.bind(records);
  function environment(record) {
    // Read independently: unavailable clocks/policy must not hide valid revocation evidence.
    const read = (fn, keys) => { try { return fields(fn(), keys); } catch { return null; } };
    const clock = read(() => dependencies.clock(), ['epochMs', 'monotonicMs']);
    const p = read(() => dependencies.policy(), ['version', 'fingerprint', 'generation']);
    const r = read(() => dependencies.revocation(), ['generation', 'revoked']);
    const validPolicy = p && identifier(p.version) && identifier(p.fingerprint) && generation(p.generation);
    const validRevocation = r && typeof r.revoked === 'boolean' && generation(r.generation);
    if (validPolicy && (p.version !== record.current.policy.version ||
      p.fingerprint !== record.current.policy.fingerprint || p.generation !== record.current.policy.generation)) {
      record.latchedPolicy ??= Object.freeze({ ...p });
    }
    if (validRevocation) {
      if (r.revoked) record.revoked = true;
      if (r.generation !== record.current.revocationGeneration) record.latchedRevocationGeneration ??= r.generation;
    }
    if (!clock || !validPolicy || !validRevocation) return null;
    return { clock, policy: record.latchedPolicy ?? p,
      revocationGeneration: record.latchedRevocationGeneration ?? r.generation, revoked: record.revoked || r.revoked };
  }
  function persist(record, plan, env) {
    const r = applySessionTransition(record.current, plan, env);
    // In particular retain terminal denial states even when r.ok is false.
    if (r.session && r.session !== record.current) {
      record.current = r.session;
    }
    return r;
  }
  function checked(record) {
    if (terminal(record.current.state)) return { denial: 'TERMINAL_STATE' };
    let env;
    try { env = environment(record); } catch { return { denial: 'OWNER_ENVIRONMENT_UNAVAILABLE' }; }
    if (!env) return { denial: 'OWNER_ENVIRONMENT_UNAVAILABLE' };
    // Match 4B clock bounds and drift before trusting any observation of time.
    const c = env.clock, d = record.current.deadline;
    if (!Number.isSafeInteger(c.epochMs) || c.epochMs <= 0 || c.epochMs > 8640000000000000 ||
      typeof c.monotonicMs !== 'number' || !Number.isFinite(c.monotonicMs) || c.monotonicMs < 0 ||
      c.monotonicMs > Number.MAX_SAFE_INTEGER) {
      return { denial: 'INVALID_CLOCK' };
    }
    const last = record.lastClock;
    if (last && (c.epochMs < last.epochMs || c.monotonicMs < last.monotonicMs)) {
      record.clockFault = true; // No automatic recovery policy exists for a detected rollback.
      return { denial: 'CLOCK_BACKWARDS' };
    }
    if (Math.abs((c.epochMs - d.issuedAtMs) - (c.monotonicMs - d.issuedMonotonicMs)) > d.maxClockDriftMs) {
      return { denial: 'INVALID_CLOCK' };
    }
    record.lastClock = Object.freeze({ ...c });
    const assessment = evaluateSessionModel(record.current, env);
    if (!assessment.ok && !assessment.terminalState) return { denial: assessment.reason };
    if (!assessment.ok) {
      const plan = planSessionTransition(record.current, { target: 'CONSUMED', stage: 'ROOT',
        expectedRevision: record.current.revision }, env);
      const r = persist(record, plan, env);
      return { denial: r.reason };
    }
    if (record.clockFault) return { denial: 'CLOCK_BACKWARDS' };
    return { env };
  }
  function operate(handle, action) {
    const record = readRecord(handle); // No candidate properties or proxy traps are read.
    if (!record) return response(false, 'UNKNOWN_HANDLE');
    if (record.busy) return response(false, 'OWNER_REENTRANT');
    record.busy = true;
    try { return action(record); }
    catch { return response(false, 'OWNER_OPERATION_FAILED', record); }
    finally { record.busy = false; }
  }
  function advance(handle, command) {
    return operate(handle, record => {
      const check = checked(record);
      if (check.denial) return response(false, check.denial, record);
      const c = fields(command, ['stage', 'expectedRevision']);
      if (!c || typeof c.stage !== 'string' || !Number.isSafeInteger(c.expectedRevision) || c.expectedRevision < 0) return response(false, 'INVALID_COMMAND', record);
      if (c.expectedRevision !== record.current.revision) return response(false, 'REPLAY', record);
      if (closedStages.includes(c.stage)) return response(false, 'STAGE_NOT_ENABLED', record);
      if (!Object.hasOwn(edges, c.stage)) return response(false, 'INVALID_COMMAND', record);
      const plan = planSessionTransition(record.current, { stage: c.stage, target: edges[c.stage],
        expectedRevision: c.expectedRevision }, check.env);
      // Re-read server time/policy immediately before application; no await in this section.
      // Check/persist terminal causes even when the original plan has no next state.
      const latest = checked(record);
      if (latest.denial) return response(false, latest.denial, record);
      const r = persist(record, plan, latest.env);
      return response(r.ok, r.reason, record);
    });
  }
  const owner = Object.freeze({
    create(input) {
      // 4D has no input constructor. Even future genuine data cannot create a session here.
      return response(false, isTrustedAnalysisInput(input) ? 'SESSION_CREATION_DISABLED' : 'TRUSTED_INPUT_REQUIRED');
    },
    inspect(handle) {
      return operate(handle, record => {
        const check = checked(record);
        return response(!check.denial, check.denial ?? null, record);
      });
    },
    consume(handle, expectedRevision) { return advance(handle, { stage: 'ROOT', expectedRevision }); },
    transition(handle, command) { return advance(handle, command); },
    revoke(handle) {
      return operate(handle, record => {
        // Attenuation only, never a caller-supplied revocation flag that can be cleared.
        if (terminal(record.current.state)) return response(false, 'TERMINAL_STATE', record);
        record.revoked = true;
        const check = checked(record);
        return response(false, check.denial ?? 'REVOKED', record);
      });
    }
  });
  return owner;
}

let productionOwner;
function getAnalysisSessionOwner() {
  if (arguments.length) throw new TypeError('Analysis session owner accepts no arguments.');
  if (!productionOwner) productionOwner = createSessionOwner(serverDependencies);
  return productionOwner;
}

export { getAnalysisSessionOwner };
