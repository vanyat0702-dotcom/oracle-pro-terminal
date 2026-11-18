import type { MarketCandle } from '../contracts.js';

/** Independent, additive contracts. Time units are explicit; no runtime grant is represented. */
export type AnalysisPurpose = 'DISPLAY' | 'CLOSED_BAR_RESEARCH' | 'LIVE_SIGNAL_ANALYSIS' | 'EXECUTION';
export type QualityStatus = 'PASS' | 'FAIL' | 'UNKNOWN';
export interface ObservationCandle extends MarketCandle { readonly isOpen: boolean }
export interface MarketObservation {
  readonly schemaVersion: 1;
  readonly snapshotId: string;
  readonly pair: string;
  readonly timeframe: string;
  readonly candles: readonly Readonly<ObservationCandle>[];
  readonly source: Readonly<{ provider: string; endpoint: string; priceBasis: string }> | null;
  readonly timing: Readonly<{
    requestStartedAtMs: number | null;
    observationCompletedAtMs: number | null;
    /** Actual upstream market-event timestamp, never the HTTP receipt time. */
    providerQuoteUpdatedAtMs: number | null;
    /** Independently measured monotonic acquisition duration, not one-way tick latency. */
    acquisitionDurationMs: number | null;
  }>;
  readonly session: 'OPEN' | 'CLOSED' | 'UNKNOWN';
}
export interface AnalysisRequirements {
  readonly purpose: AnalysisPurpose;
  readonly pair: 'EUR/USD';
  readonly timeframe: '1';
  /** Inclusive M1 candle-open range, Unix seconds UTC. No interpolation. */
  readonly from: number;
  readonly to: number;
  readonly minCandles: number;
  readonly allowOpenBar: boolean;
  readonly maxCandleAgeMs: number;
  readonly maxObservationAgeMs: number;
  readonly maxQuoteAgeMs: number;
  readonly maxAcquisitionDurationMs: number;
}
export interface SkipReason {
  readonly code: string;
  readonly category: 'MARKET_DATA' | 'DATA_INTEGRITY' | 'ELIGIBILITY';
  readonly publicMessage: string;
}
export interface QualityCheck { readonly status: QualityStatus; readonly code: string }
export interface QualityReport {
  readonly schemaVersion: 1;
  readonly snapshotId: string | null;
  readonly evaluatedAtMs: number | null;
  readonly status: QualityStatus;
  readonly checks: Readonly<Record<string, QualityCheck>>;
  readonly reasons: readonly SkipReason[];
  readonly metrics: Readonly<{
    selectedCount: number | null;
    expectedCount: number | null;
    candleAgeMs: number | null;
    observationAgeMs: number | null;
    quoteAgeMs: number | null;
    acquisitionDurationMs: number | null;
    duplicates: number | null;
    missingCandles: number | null;
  }>;
}
export interface EligibilityDecision {
  readonly schemaVersion: 1;
  readonly policyVersion: 'mde-phase3b-increment1';
  readonly purpose: AnalysisPurpose | null;
  readonly snapshotId: string | null;
  readonly status: 'ALLOWED' | 'DENIED';
  /** An informational decision only; cannot authorize Core, AI or execution. */
  readonly grantsRuntimeAccess: false;
  readonly reasons: readonly SkipReason[];
  readonly quality: QualityReport;
}
