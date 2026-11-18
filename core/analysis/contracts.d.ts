import type { RiskMode } from '../contracts.js';
import type { AnalysisRequirements, MarketObservation, QualityReport, EligibilityDecision } from '../market/contracts.js';
import type { ObservationProvenanceReport } from '../market/service.js';
import type { AuthorizationPolicyVersion } from '../runtime/contracts.js';

export type PrimaryTimeframe = '1' | '5' | '15' | '60' | '240';
export type HigherTimeframe = '5' | '15' | '30' | '60' | '240' | 'D';
/** Untrusted preferences only. No prices, timestamps, sources, decisions or grants. */
export interface AnalyzeIntent {
  readonly pairs: readonly string[];
  readonly timeframe: PrimaryTimeframe;
  readonly higherTimeframes: readonly HigherTimeframe[];
  readonly mode: RiskMode;
  readonly safeModeEnabled: boolean;
  readonly filters: Readonly<{
    newsFilterEnabled: boolean; atrFilterEnabled: boolean; riskCapEnabled: boolean;
  }>;
}
export interface InputDenialReason {
  readonly code: string;
  readonly category: 'DATA_INTEGRITY' | 'MARKET_DATA' | 'ELIGIBILITY';
  readonly publicMessage: string;
}
export type IntentValidationResult =
  | Readonly<{ ok: true; intent: AnalyzeIntent; grantsRuntimeAccess: false }>
  | Readonly<{ ok: false; intent: null; reason: InputDenialReason; grantsRuntimeAccess: false }>;
export type PriceBasis = 'bid' | 'ask' | 'mid' | 'UNKNOWN';
/** A separate upstream quote. Candle close and HTTP receipt cannot fill these fields. */
export interface AnalysisQuote {
  readonly sourceId: string;
  readonly bid: number | null;
  readonly ask: number | null;
  readonly mid: number | null;
  readonly eventAtMs: number | null;
  readonly receivedAtMs: number | null;
  readonly priceBasis: PriceBasis;
}
/** Representational contracts only. Existing market evaluators remain EUR/USD M1-only.
 * Reuse the requirement fields without changing the market module's literal timeframe.
 * Range alignment/coverage for other timeframes requires separate runtime implementation.
 */
type AnalysisRequirementsFor<T extends PrimaryTimeframe | HigherTimeframe> =
  Readonly<Omit<AnalysisRequirements, 'timeframe'> & { readonly timeframe: T }>;
export type PrimaryAnalysisRequirements<T extends PrimaryTimeframe = PrimaryTimeframe> = AnalysisRequirementsFor<T>;
export type HigherAnalysisRequirements<T extends HigherTimeframe = HigherTimeframe> = AnalysisRequirementsFor<T>;
export interface ServerAnalysisRequirements {
  readonly primary: PrimaryAnalysisRequirements;
  readonly higherTimeframes: readonly HigherAnalysisRequirements[];
  readonly requiredFilterEvidence: readonly ('NEWS' | 'ATR' | 'RISK')[];
  readonly strategyVersion: string;
  readonly policy: AuthorizationPolicyVersion;
  readonly requirementsFingerprint: string;
}
export interface AnalysisObservationBundle {
  readonly bundleId: string;
  readonly primary: MarketObservation | null;
  readonly higherTimeframes: Readonly<Record<string, MarketObservation | null>>;
}
declare const trustedInputBrand: unique symbol;
/** Reserved internal contract, not constructible in 4D. Identity must never come from JSON. */
export interface TrustedAnalysisInput {
  readonly [trustedInputBrand]: 'SERVER_ANALYSIS_INPUT';
  readonly schemaVersion: 1;
  readonly grantsRuntimeAccess: false;
  readonly analysisSessionId: string;
  readonly pair: string;
  readonly timeframe: PrimaryTimeframe;
  readonly requiredHigherTimeframes: readonly HigherTimeframe[];
  readonly intent: AnalyzeIntent;
  readonly observations: AnalysisObservationBundle;
  readonly provenance: readonly Extract<ObservationProvenanceReport, { registered: true }>[];
  readonly quote: AnalysisQuote | null;
  readonly priceBasis: PriceBasis;
  readonly marketSession: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  readonly evaluatedAtMs: number | null;
  readonly requirements: ServerAnalysisRequirements | null;
  readonly strategyVersion: string | null;
  readonly policy: AuthorizationPolicyVersion | null;
  readonly quality: QualityReport | null;
  readonly eligibility: EligibilityDecision | null;
  readonly filterEvidence: Readonly<{ news: 'PASS' | 'FAIL' | 'UNKNOWN'; atr: 'PASS' | 'FAIL' | 'UNKNOWN'; risk: 'PASS' | 'FAIL' | 'UNKNOWN' }>;
}
/** Candidates are untrusted objects. Only the canonical 4C identity registry is consulted. */
export interface AnalysisObservationSelection {
  readonly primary: unknown;
  readonly higherTimeframes: readonly unknown[];
}
export interface AnalysisReadinessDenial {
  readonly status: 'DENIED';
  readonly diagnosticOnly: true;
  readonly grantsRuntimeAccess: false;
  readonly input: null;
  readonly intent: AnalyzeIntent | null;
  readonly reasons: readonly InputDenialReason[];
  readonly missingHigherTimeframes: readonly HigherTimeframe[];
  readonly quote: null;
  readonly requirements: null;
  readonly strategyVersion: null;
  readonly analysisSessionId: null;
  readonly quality: null;
  readonly eligibility: null;
  readonly filterEvidence: Readonly<{ news: 'UNKNOWN'; atr: 'UNKNOWN'; risk: 'UNKNOWN' }>;
}
