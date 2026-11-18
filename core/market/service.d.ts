import type { AnalysisRequirements, MarketObservation, QualityReport, EligibilityDecision, SkipReason } from './contracts.js';
import type { REGISTRY_VERSION } from './sourceRegistry.js';

export interface MarketServiceResult {
  readonly status: 'DENIED' | 'ASSESSED';
  readonly diagnosticOnly: true;
  readonly grantsRuntimeAccess: false;
  /** Present only for a newly acquired observation, including diagnostic DENIED assessments. */
  readonly observation: MarketObservation | null;
  readonly provenance: Readonly<{
    acquisition: 'SERVER_PROVIDER'; sourceId: 'biquote'; registryVersion: typeof REGISTRY_VERSION;
    responseHeadersReceivedAtMs: number; responseTimeMeaning: 'HEADERS_ONLY';
    requirements: AnalysisRequirements;
  }> | null;
  readonly quality: QualityReport | null;
  readonly eligibility: EligibilityDecision | null;
  readonly reason: SkipReason | null;
}
/** Privileged construction-only dependencies; never accept these from a client or deserialize them. */
export interface MarketServiceDependencies {
  fetchImpl?: typeof fetch;
  wallNow?: () => number;
  monotonicNow?: () => number;
  idFactory?: () => string;
}
export declare function createMarketService(dependencies?: MarketServiceDependencies): Readonly<{
  observe(request: unknown): Promise<MarketServiceResult>;
}>;
