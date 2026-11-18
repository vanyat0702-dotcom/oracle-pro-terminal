import type { ModelEvaluation, SessionModelResult, SessionTransitionPlan } from './contracts.js';
/** Creates an immutable diagnostic model, never a capability. LIVE/EXECUTION are rejected. */
export declare function createSessionModel(spec: unknown): SessionModelResult;
/** Explicit clocks/policy only; never authorizes AI. */
export declare function evaluateSessionModel(session: unknown, environment: unknown): Readonly<ModelEvaluation>;
/** Pure proposal; expiration/revocation are recorded as terminal model transitions. */
export declare function planSessionTransition(session: unknown, command: unknown, environment: unknown): SessionTransitionPlan;
/**
 * Pure identity CAS; reassesses explicit clocks/policy at application.
 * The future owner must supply/replace its current model atomically, including a returned
 * EXPIRED/REVOKED session when ok=false. Historical snapshots are not globally invalidated.
 */
export declare function applySessionTransition(current: unknown, plan: unknown, environment: unknown): SessionModelResult;
