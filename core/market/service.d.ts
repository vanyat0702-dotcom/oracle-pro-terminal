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
export interface MarketService {
  observe(request: unknown): Promise<MarketServiceResult>;
}
declare const trustedServiceBrand: unique symbol;
export interface TrustedMarketService extends MarketService {
  readonly [trustedServiceBrand]: 'TRUSTED_DIAGNOSTIC_SERVICE';
}
/** Compatible diagnostic factory. Its observations never enter the private origin registry. */
export declare function createMarketService(dependencies?: MarketServiceDependencies): Readonly<MarketService>;
/** Fixed process-local service; no caller-supplied dependencies or registration API. */
export declare function getTrustedMarketService(): Readonly<TrustedMarketService>;
export type ObservationProvenanceReport = Readonly<{
  diagnosticOnly: true; grantsRuntimeAccess: false;
}> & (
  | Readonly<{ registered: false; code: 'UNREGISTERED_OBSERVATION' }>
  | Readonly<{ registered: true; code: 'REGISTERED_DIAGNOSTIC_OBSERVATION';
      snapshotId: string; sourceId: 'biquote'; pair: 'EUR/USD'; timeframe: '1'; purpose: 'DISPLAY';
      registryVersion: typeof REGISTRY_VERSION }>
);
/** Read-only origin check. Reports/JSON are never credentials; freshness is not assessed. */
export declare function inspectObservationProvenance(service: unknown, observation: unknown): ObservationProvenanceReport;
