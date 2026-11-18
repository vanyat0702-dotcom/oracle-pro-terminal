// Pure lifecycle models. No issuer, capability, store, IO, ambient clock or trading imports.
// Private fields identify model instances without a mutable global WeakMap/WeakSet.
const own = (value, keys) => {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== keys.length || !keys.every(key =>
      Object.hasOwn(descriptors, key) && Object.hasOwn(descriptors[key], 'value'))) return null;
    return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
  } catch { return null; }
};
const identifier = value => typeof value === 'string' && value.length > 0 &&
  value.length <= 512 && value.trim() === value && value.toUpperCase() !== 'UNKNOWN';
const generation = value => Number.isSafeInteger(value) && value >= 0;
const epoch = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
const mono = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const terminal = state => ['FINALIZED', 'EXPIRED', 'REVOKED'].includes(state);
const evaluation = (ok, reason = null, terminalState = null) => Object.freeze({
  modelOnly: true, grantsRuntimeAccess: false, ok, reason, terminalState
});
const result = (ok, session, reason = null) => Object.freeze({ modelOnly: true, grantsRuntimeAccess: false, ok, session, reason });

class SessionModel {
  #data;
  constructor(data) {
    this.#data = Object.freeze(data);
    Object.assign(this, this.#data);
    Object.setPrototypeOf(this, null);
    Object.freeze(this);
  }
  static read(value) {
    return value !== null && typeof value === 'object' && #data in value ? value.#data : null;
  }
}
class TransitionPlan {
  #base;
  #next;
  constructor(base, next, outcome) {
    this.#base = base;
    this.#next = next;
    const data = SessionModel.read(base);
    Object.assign(this, outcome, { from: data?.state ?? null,
      to: SessionModel.read(next)?.state ?? data?.state ?? null, expectedRevision: data?.revision ?? null });
    Object.setPrototypeOf(this, null);
    Object.freeze(this);
  }
  static read(value) {
    return value !== null && typeof value === 'object' && #base in value
      ? { base: value.#base, next: value.#next } : null;
  }
}

function policyData(input) {
  const p = own(input, ['version', 'fingerprint', 'generation']);
  return p && identifier(p.version) && identifier(p.fingerprint) && generation(p.generation) ? Object.freeze(p) : null;
}
function deadlineData(input) {
  const d = own(input, ['issuedAtMs', 'expiresAtMs', 'issuedMonotonicMs', 'deadlineMonotonicMs', 'maxClockDriftMs']);
  return d && epoch(d.issuedAtMs) && epoch(d.expiresAtMs) && d.expiresAtMs > d.issuedAtMs &&
    mono(d.issuedMonotonicMs) && mono(d.deadlineMonotonicMs) && d.deadlineMonotonicMs > d.issuedMonotonicMs &&
    mono(d.maxClockDriftMs) ? Object.freeze(d) : null;
}
function createSessionModel(spec) {
  const s = own(spec, ['sessionId', 'scope', 'policy', 'deadline', 'revocationGeneration']);
  if (!s || !identifier(s.sessionId) || !generation(s.revocationGeneration)) return result(false, null, 'INVALID_SPEC');
  const scope = own(s.scope, ['snapshotId', 'sourceId', 'pair', 'timeframe', 'purpose',
    'requirementsFingerprint', 'policyFingerprint', 'strategyVersion']);
  if (!scope || !Object.values(scope).every(identifier)) return result(false, null, 'INVALID_SCOPE');
  if (!['DISPLAY', 'CLOSED_BAR_RESEARCH'].includes(scope.purpose)) return result(false, null, 'PURPOSE_NOT_ENABLED');
  const policy = policyData(s.policy);
  if (!policy || policy.fingerprint !== scope.policyFingerprint) return result(false, null, 'INVALID_SPEC');
  const deadline = deadlineData(s.deadline);
  if (!deadline) return result(false, null, 'INVALID_DEADLINE');
  return result(true, new SessionModel({ schemaVersion: 1, modelOnly: true, grantsRuntimeAccess: false,
    sessionId: s.sessionId, scope: Object.freeze(scope), policy, deadline, revocationGeneration: s.revocationGeneration,
    state: 'ISSUED', stage: 'ROOT', revision: 0,
    lastClock: Object.freeze({ epochMs: deadline.issuedAtMs, monotonicMs: deadline.issuedMonotonicMs }), terminalReason: null }));
}

function environmentData(input) {
  const e = own(input, ['clock', 'policy', 'revocationGeneration', 'revoked']);
  if (!e || !generation(e.revocationGeneration) || typeof e.revoked !== 'boolean') return { reason: 'INVALID_ENVIRONMENT' };
  const policy = policyData(e.policy);
  if (!policy) return { reason: 'INVALID_ENVIRONMENT' };
  const clock = own(e.clock, ['epochMs', 'monotonicMs']);
  if (!clock || !epoch(clock.epochMs) || !mono(clock.monotonicMs)) return { reason: 'INVALID_CLOCK' };
  return { ...e, policy, clock: Object.freeze(clock) };
}
function inspect(data, env) {
  if (env.reason) return evaluation(false, env.reason);
  const { clock, policy } = env, d = data.deadline;
  if (clock.epochMs < data.lastClock.epochMs || clock.monotonicMs < data.lastClock.monotonicMs ||
    Math.abs((clock.epochMs - d.issuedAtMs) - (clock.monotonicMs - d.issuedMonotonicMs)) > d.maxClockDriftMs) {
    return evaluation(false, 'INVALID_CLOCK');
  }
  if (env.revoked) return evaluation(false, 'REVOKED', 'REVOKED');
  if (env.revocationGeneration !== data.revocationGeneration) return evaluation(false, 'REVOCATION_GENERATION_MISMATCH', 'REVOKED');
  if (policy.version !== data.policy.version) return evaluation(false, 'POLICY_VERSION_MISMATCH', 'REVOKED');
  if (policy.fingerprint !== data.policy.fingerprint) return evaluation(false, 'POLICY_FINGERPRINT_MISMATCH', 'REVOKED');
  if (policy.generation !== data.policy.generation) return evaluation(false, 'POLICY_GENERATION_MISMATCH', 'REVOKED');
  if (clock.epochMs >= d.expiresAtMs) return evaluation(false, 'ABSOLUTE_EXPIRY', 'EXPIRED');
  if (clock.monotonicMs >= d.deadlineMonotonicMs) return evaluation(false, 'MONOTONIC_DEADLINE', 'EXPIRED');
  return evaluation(true);
}
function evaluateSessionModel(session, environment) {
  const data = SessionModel.read(session);
  if (!data) return evaluation(false, 'INVALID_SESSION');
  if (terminal(data.state)) return evaluation(false, 'TERMINAL_STATE');
  return inspect(data, environmentData(environment));
}

function planSessionTransition(session, command, environment) {
  const data = SessionModel.read(session);
  const deny = reason => new TransitionPlan(data ? session : null, null, evaluation(false, reason));
  if (!data) return deny('INVALID_SESSION');
  if (terminal(data.state)) return deny('TERMINAL_STATE');
  const event = own(command, ['target', 'stage', 'expectedRevision']);
  if (!event || !generation(event.expectedRevision)) return deny('INVALID_TRANSITION');
  if (event.expectedRevision !== data.revision) return deny('REPLAY');
  if (data.revision === Number.MAX_SAFE_INTEGER) return deny('REVISION_EXHAUSTED');
  const env = environmentData(environment);
  const assessment = inspect(data, env);
  let state, stage, terminalReason = null;
  if (!assessment.ok) {
    if (!assessment.terminalState) return deny(assessment.reason);
    state = assessment.terminalState; stage = data.stage; terminalReason = assessment.reason;
  } else {
    const edge = { ISSUED: ['CONSUMED', 'ROOT'], CONSUMED: ['ACTIVE', 'ANALYSIS'], ACTIVE: ['FINALIZED', 'FINALIZATION'] }[data.state];
    if (!edge || event.target !== edge[0] || event.stage !== edge[1]) return deny('INVALID_TRANSITION');
    [state, stage] = edge;
  }
  const next = new SessionModel({ ...data, state, stage, terminalReason,
    revision: data.revision + 1, lastClock: env.clock });
  // ok=false can still propose a terminal denial. Applying it records denial, never permission.
  return new TransitionPlan(session, next, assessment);
}
function applySessionTransition(current, plan, environment) {
  const data = SessionModel.read(current);
  if (!data) return result(false, null, 'INVALID_SESSION');
  const proposal = TransitionPlan.read(plan);
  if (!proposal) return result(false, current, 'INVALID_PLAN');
  if (proposal.base !== current) return result(false, current, 'REPLAY');
  if (!proposal.next) return result(false, current, plan.reason);
  const next = SessionModel.read(proposal.next);
  const env = environmentData(environment);
  // Reassess at application too: a queued proposal cannot carry freshness across a delay.
  const assessment = inspect({ ...data, lastClock: next.lastClock }, env);
  if (!assessment.ok && !assessment.terminalState) return result(false, current, assessment.reason);
  const updated = new SessionModel({ ...next, lastClock: env.clock,
    ...(!assessment.ok ? { state: assessment.terminalState, stage: data.stage, terminalReason: assessment.reason } : {}) });
  return result(assessment.ok && plan.ok, updated, assessment.ok ? plan.reason : assessment.reason);
}

export { createSessionModel, evaluateSessionModel, planSessionTransition, applySessionTransition };
