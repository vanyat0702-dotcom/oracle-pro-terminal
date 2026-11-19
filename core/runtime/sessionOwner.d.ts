import type { AuthorizationDeadline, AuthorizationDenialReason, RootCapabilityScope,
  RuntimeAuthorizationState, RuntimeStage } from './contracts.js';
import type { MarketObservation } from '../market/contracts.js';
import type { TrustedAnalysisInput } from '../analysis/contracts.js';
import type { ModelStageOperations } from './stageContracts.js';

declare const handleBrand: unique symbol;
/** Identity for a MODEL_ONLY owner record; never a RuntimeContext or AdapterPermit. */
export interface ModelSessionHandle { readonly [handleBrand]: 'MODEL_ONLY_OWNER_HANDLE' }
/** Reserved private binding shape. There is no public registration/creation API for it. */
export interface ModelSessionBinding {
  readonly input: TrustedAnalysisInput | null;
  readonly originalObservations: readonly MarketObservation[];
  readonly scope: RootCapabilityScope;
}
export interface ModelSessionView {
  readonly schemaVersion: 1;
  readonly mode: 'MODEL_ONLY';
  readonly modelOnly: true;
  readonly grantsRuntimeAccess: false;
  readonly sessionId: string;
  readonly state: RuntimeAuthorizationState;
  readonly stage: RuntimeStage;
  readonly revision: number;
  readonly scope: RootCapabilityScope;
  readonly deadline: AuthorizationDeadline;
  readonly terminalReason: AuthorizationDenialReason | null;
  readonly observationCount: number;
  readonly marketEvidence: 'NOT_AUTHORIZING';
}
export type OwnerDenialReason = AuthorizationDenialReason | 'UNKNOWN_HANDLE' | 'INVALID_COMMAND' |
  'STAGE_NOT_ENABLED' | 'OWNER_REENTRANT' | 'OWNER_ENVIRONMENT_UNAVAILABLE' |
  'OWNER_OPERATION_FAILED' | 'CLOCK_BACKWARDS' | 'TRUSTED_INPUT_REQUIRED' | 'SESSION_CREATION_DISABLED';
export interface OwnerModelResult {
  readonly status: 'MODEL_ONLY' | 'DENIED';
  readonly mode: 'MODEL_ONLY';
  readonly modelOnly: true;
  readonly grantsRuntimeAccess: false;
  /** A model operation only; never permission for AI. */
  readonly ok: boolean;
  readonly reason: OwnerDenialReason | null;
  readonly session: ModelSessionView | null;
}
export interface AnalysisSessionOwner {
  /** Immutable, non-enumerable MODEL_ONLY namespace; contains no stage factory. */
  readonly stages: Readonly<ModelStageOperations>;
  create(input: unknown): Readonly<OwnerModelResult> & Readonly<{ ok: false; status: 'DENIED' }>;
  inspect(handle: unknown): Readonly<OwnerModelResult>;
  consume(handle: unknown, expectedRevision: number): Readonly<OwnerModelResult>;
  transition(handle: unknown, command: Readonly<{ stage: RuntimeStage; expectedRevision: number }>): Readonly<OwnerModelResult>;
  /** Sticky attenuation; no caller can clear it or supply clocks/policy. */
  revoke(handle: unknown): Readonly<OwnerModelResult>;
}
/** Production singleton. No session writer, dependency injection or positive creation. */
export declare function getAnalysisSessionOwner(): Readonly<AnalysisSessionOwner>;
