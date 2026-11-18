import type { AnalysisPurpose } from '../market/contracts.js';

/** Internal lifecycle models only. None of these types is a runtime permission. */
export type RuntimeAuthorizationState = 'ISSUED' | 'CONSUMED' | 'ACTIVE' | 'FINALIZED' | 'EXPIRED' | 'REVOKED';
export type RuntimeStage = 'ROOT' | 'ANALYSIS' | 'GATEWAY' | 'OPENAI' | 'GEMINI' | 'FINALIZATION';
export interface AuthorizationPolicyVersion {
  readonly version: string;
  readonly fingerprint: string;
  readonly generation: number;
}
export interface RootCapabilityScope {
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly pair: string;
  readonly timeframe: string;
  readonly purpose: AnalysisPurpose;
  readonly requirementsFingerprint: string;
  readonly policyFingerprint: string;
  readonly strategyVersion: string;
}
/** Reserved contract; no adapter permit factory or issuer exists. */
export type AdapterPermitScope = RootCapabilityScope & Readonly<{
  readonly sessionId: string;
  readonly attempt: 1;
}> & (Readonly<{ adapter: 'OPENAI'; stage: 'OPENAI' }> | Readonly<{ adapter: 'GEMINI'; stage: 'GEMINI' }>);
export interface AuthorizationDeadline {
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly issuedMonotonicMs: number;
  readonly deadlineMonotonicMs: number;
  /** Explicit caller policy, not a default TTL or clock tolerance. */
  readonly maxClockDriftMs: number;
}
export interface AuthorizationClock {
  readonly epochMs: number | null;
  readonly monotonicMs: number | null;
}
export interface AuthorizationEnvironment {
  readonly clock: AuthorizationClock;
  readonly policy: AuthorizationPolicyVersion;
  readonly revocationGeneration: number;
  readonly revoked: boolean;
}
export type AuthorizationDenialReason =
  | 'INVALID_SESSION' | 'INVALID_SPEC' | 'INVALID_SCOPE' | 'PURPOSE_NOT_ENABLED'
  | 'INVALID_DEADLINE' | 'INVALID_CLOCK' | 'INVALID_ENVIRONMENT'
  | 'ABSOLUTE_EXPIRY' | 'MONOTONIC_DEADLINE' | 'POLICY_VERSION_MISMATCH'
  | 'POLICY_FINGERPRINT_MISMATCH' | 'POLICY_GENERATION_MISMATCH'
  | 'REVOCATION_GENERATION_MISMATCH' | 'REVOKED' | 'REPLAY'
  | 'INVALID_TRANSITION' | 'INVALID_PLAN' | 'TERMINAL_STATE' | 'REVISION_EXHAUSTED';
export interface SessionModelSpec {
  readonly sessionId: string;
  readonly scope: RootCapabilityScope;
  readonly policy: AuthorizationPolicyVersion;
  readonly deadline: AuthorizationDeadline;
  readonly revocationGeneration: number;
}
declare const sessionModelBrand: unique symbol;
export interface AnalysisSession extends SessionModelSpec {
  readonly [sessionModelBrand]: 'MODEL_ONLY';
  readonly schemaVersion: 1;
  readonly modelOnly: true;
  readonly grantsRuntimeAccess: false;
  readonly state: RuntimeAuthorizationState;
  readonly stage: RuntimeStage;
  readonly revision: number;
  readonly lastClock: Readonly<{ epochMs: number; monotonicMs: number }>;
  readonly terminalReason: AuthorizationDenialReason | null;
}
export interface SessionCommand {
  readonly target: RuntimeAuthorizationState;
  readonly stage: RuntimeStage;
  readonly expectedRevision: number;
}
export interface ModelEvaluation {
  readonly modelOnly: true;
  readonly grantsRuntimeAccess: false;
  readonly ok: boolean;
  readonly reason: AuthorizationDenialReason | null;
  readonly terminalState: 'EXPIRED' | 'REVOKED' | null;
}
declare const planBrand: unique symbol;
export interface SessionTransitionPlan extends ModelEvaluation {
  readonly [planBrand]: 'MODEL_PLAN_ONLY';
  readonly from: RuntimeAuthorizationState | null;
  readonly to: RuntimeAuthorizationState | null;
  readonly expectedRevision: number | null;
}
export type SessionModelResult = Readonly<{
  modelOnly: true; grantsRuntimeAccess: false;
}> & (
  | Readonly<{ ok: true; session: AnalysisSession; reason: AuthorizationDenialReason | null }>
  | Readonly<{ ok: false; session: AnalysisSession | null; reason: AuthorizationDenialReason }>
);
