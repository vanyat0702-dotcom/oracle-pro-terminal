// Compile-only internal model checks. No executable runtime grants.
import type { AnalysisSession, RootCapabilityScope, AdapterPermitScope, RuntimeAuthorizationState,
  RuntimeStage, AuthorizationPolicyVersion, AuthorizationDeadline, AuthorizationDenialReason } from '../core/runtime/contracts.js';
import { createSessionModel, evaluateSessionModel, planSessionTransition, applySessionTransition } from '../core/runtime/stateMachine.js';
import type { RuntimeContext } from '../core/runtimeGuard.js';

declare const session: AnalysisSession;
declare const scope: RootCapabilityScope;
declare const permitScope: AdapterPermitScope;
declare const policy: AuthorizationPolicyVersion;
declare const deadline: AuthorizationDeadline;
const state: RuntimeAuthorizationState = session.state;
const stage: RuntimeStage = session.stage;
const noGrant: false = session.grantsRuntimeAccess;
const result = createSessionModel({ sessionId: 'model', scope, policy, deadline, revocationGeneration: 0 });
const evaluation = evaluateSessionModel(session, {});
const plan = planSessionTransition(session, { target: 'CONSUMED', stage: 'ROOT', expectedRevision: 0 }, {});
const applied = applySessionTransition(session, plan, {});
const reason: AuthorizationDenialReason | null = applied.reason;
const noPlanGrant: false = plan.grantsRuntimeAccess;
if (result.ok) { const s: AnalysisSession = result.session; void s; }
// @ts-expect-error Lifecycle models cannot serve as Runtime Guard contexts.
const context: RuntimeContext = session;
// @ts-expect-error An ordinary scope is not an opaque model instance.
const forged: AnalysisSession = { ...scope };
// @ts-expect-error Models cannot grant live access.
const positive: true = session.grantsRuntimeAccess;
// @ts-expect-error Public model state is immutable.
session.state = 'ACTIVE';
// @ts-expect-error Evidence binding is immutable.
session.scope.snapshotId = 'other';
// @ts-expect-error Adapter budgets are not unbounded.
const retry: AdapterPermitScope = { ...permitScope, attempt: 2 };
// @ts-expect-error An adapter permit cannot name a different adapter stage.
const wrongAdapter: AdapterPermitScope = { ...scope, sessionId: 'test', attempt: 1, adapter: 'OPENAI', stage: 'GEMINI' };
// @ts-expect-error Application must reassess explicit time/policy.
applySessionTransition(session, plan);
void [state, stage, noGrant, evaluation, reason, noPlanGrant, context, forged, positive, retry, wrongAdapter];
