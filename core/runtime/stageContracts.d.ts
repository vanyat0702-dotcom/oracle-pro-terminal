import type { AuthorizationDeadline, AuthorizationPolicyVersion, RootCapabilityScope, RuntimeStage } from './contracts.js';
import type { OwnerDenialReason } from './sessionOwner.js';

/** Descriptive identities only. No stage handle is a RuntimeContext or AdapterPermit. */
declare const stageBrand: unique symbol;
export interface ModelStageHandle { readonly [stageBrand]: 'MODEL_ONLY_STAGE' }
export type ModelStageState = 'READY' | 'CONSUMED' | 'COMPLETED' | 'EXPIRED' | 'REVOKED' | 'CANCELLED' | 'DENIED';
export type StageDenialReason = OwnerDenialReason | 'UNKNOWN_STAGE_HANDLE' | 'PARENT_MISMATCH' |
  'PARENT_NOT_ACTIVE' | 'PARENT_TERMINAL' | 'STAGE_BINDING_MISMATCH' | 'STAGE_EXPIRED' |
  'STAGE_MISMATCH' | 'STAGE_TERMINAL' | 'STAGE_ALREADY_CONSUMED' | 'STAGE_ORDER' |
  'STAGE_NOT_CONSUMED' | 'FINALIZATION_DISABLED';
export interface ModelStageView {
  readonly mode: 'MODEL_ONLY';
  readonly modelOnly: true;
  readonly grantsRuntimeAccess: false;
  /** Informational only; binding is an internal reference, never this string. */
  readonly parentSessionId: string;
  readonly stage: RuntimeStage;
  readonly revision: number;
  readonly state: ModelStageState;
  readonly reason: StageDenialReason | null;
  readonly scope: RootCapabilityScope;
  readonly policy: AuthorizationPolicyVersion;
  readonly revocationGeneration: number;
  readonly deadline: AuthorizationDeadline;
}
export interface ModelStageResult {
  readonly mode: 'MODEL_ONLY';
  readonly modelOnly: true;
  readonly grantsRuntimeAccess: false;
  readonly status: 'MODEL_ONLY' | 'DENIED';
  /** Successful model bookkeeping only, never proof of an AI result. */
  readonly ok: boolean;
  readonly reason: StageDenialReason | null;
  readonly entry: ModelStageView | null;
}
export interface ModelStageCommand {
  readonly stage: RuntimeStage;
  readonly expectedRevision: number;
}
/** No factory, callback or registration entrypoint. Production has no parent identities. */
export interface ModelStageOperations {
  inspect(parent: unknown, entry: unknown): Readonly<ModelStageResult>;
  consume(parent: unknown, entry: unknown, command: ModelStageCommand): Readonly<ModelStageResult>;
  complete(parent: unknown, entry: unknown, command: ModelStageCommand): Readonly<ModelStageResult>;
  finalize(parent: unknown, entry: unknown, command: ModelStageCommand): Readonly<ModelStageResult> & Readonly<{ ok: false; status: 'DENIED' }>;
}
