import type { HistoricalInputCandle, ResearchPriceBasis } from './contracts.js';
import type { ResearchCalendarSpec } from './archiveContracts.js';
export type PilotProfileId = 'HISTDATA_ASCII_M1_V1' | 'BINANCE_SPOT_KLINE_V1';
export type PilotUnits = 'EST_FIXED_TEXT' | 'MILLISECONDS' | 'MICROSECONDS';
export interface OfflineAdapterProfile {
  readonly id: PilotProfileId; readonly version: 1;
  readonly provider: 'HistData' | 'Binance'; readonly sourceId: 'HISTDATA' | 'BINANCE_SPOT';
  readonly instrument: 'eurusd' | 'btcusdt'; readonly sourceSymbol: 'EURUSD' | 'BTCUSDT';
  readonly market: 'FOREX' | 'SPOT'; readonly priceBasis: 'bid' | 'last';
  readonly timezone: 'EST_FIXED_UTC_MINUS_05' | 'UTC'; readonly format: 'CSV_UNQUOTED';
  readonly delimiter: ';' | ','; readonly timestampPolicy: 'FIXED_OFFSET' | 'SPOT_2025_CUTOVER';
}
/** Local documentary evidence. A digest proves bytes, never legal interpretation/authenticity. */
export interface LocalEvidence { readonly path: string; readonly expectedChecksum: string }
export interface PilotFile extends LocalEvidence {
  readonly sourceId: 'HISTDATA' | 'BINANCE_SPOT'; readonly sourceSymbol: 'EURUSD' | 'BTCUSDT';
  readonly market: 'FOREX' | 'SPOT'; readonly units: PilotUnits;
  /** Public origin reference, no credentials/query tokens. Never fetched. */
  readonly originRef: string;
}
export type PilotVenue = Readonly<{ id: 'UNKNOWN'; evidence: null }> | Readonly<{ id: string; evidence: LocalEvidence }>;
export type PilotLicense = Readonly<{ status: 'UNKNOWN'; reference: null; evidence: null; permittedPurposes: readonly [] }> |
  Readonly<{ status: 'OPERATOR_REVIEWED_PERSONAL_RESEARCH'; reference: string; evidence: LocalEvidence;
    permittedPurposes: readonly ['CLOSED_BAR_RESEARCH'] }>;
export interface PilotOptions {
  readonly inputRoot: string; readonly profileId: PilotProfileId; readonly dataKind: 'REAL' | 'MOCK';
  readonly files: readonly PilotFile[]; readonly venue: PilotVenue; readonly license: PilotLicense;
  readonly provenance: Readonly<{ reference: string; acquiredAt: string }>;
  readonly requestedRange: Readonly<{ from: string; toExclusive: string }>;
  readonly closedBarCutoff: string; readonly calendar: ResearchCalendarSpec;
  /** Existing local root outside the project; new single-component directory, never overwrite. */
  readonly output: Readonly<{ root: string; name: string }> | null;
}
export interface ParsedSourceBar {
  readonly timestamp: string; readonly open: number; readonly high: number; readonly low: number; readonly close: number;
  readonly volume?: number; readonly isOpen: false;
  readonly original: Readonly<{ timestamp: string; closeTimestamp: string | null; fields: readonly string[];
    units: PilotUnits; timezone: OfflineAdapterProfile['timezone']; volumeMeaning: 'UNAVAILABLE' | 'BASE_ASSET' }>;
}
export type SourceParseResult = Readonly<{ status: 'PARSED'; bar: ParsedSourceBar }> |
  Readonly<{ status: 'REJECTED'; error: string }>;
export interface PilotReport {
  readonly status: 'PREVIEW_ONLY' | 'WRITTEN' | 'REJECTED'; readonly profile: OfflineAdapterProfile | null;
  readonly dataKind: 'REAL' | 'MOCK' | null; readonly readiness: 'NOT_READY'; readonly grantsRuntimeAccess: false;
  readonly evidenceStatus: 'DECLARED_ONLY'; readonly commercialPermission: 'NOT_GRANTED'; readonly redistributionPermission: 'NOT_GRANTED';
  readonly metadata: Readonly<Pick<PilotOptions, 'venue' | 'license' | 'provenance' | 'requestedRange' | 'closedBarCutoff'>> | null;
  readonly candleCount: number; readonly fragments: number; readonly skippedOutsideRange: number;
  readonly firstCandle: string | null; readonly lastCandle: string | null;
  readonly coverage: 'PASS' | 'FAIL' | 'UNKNOWN'; readonly missingTradingMinutes: number | null;
  readonly gapMinutes: number; readonly nonTradingMinutes: number; readonly gapCount: number;
  readonly unexpectedClosedCandles: number; readonly gaps: readonly Readonly<{ from: string; toExclusive: string; minutes: number }>[];
  readonly preview: readonly ParsedSourceBar[];
  readonly sourceFiles: readonly Readonly<{ path: string; sha256: string; originRef: string; units: PilotUnits; containerVerification: 'NOT_VERIFIED' }>[];
  readonly evidenceFiles: readonly Readonly<{ role: 'VENUE' | 'LICENSE'; path: string; sha256: string }>[];
  readonly blockedReasons: readonly string[]; readonly errors: readonly string[];
  readonly output: Readonly<{ directory: string; indexChecksum: string; lineageChecksum: string; conversionChecksum: string }> | null;
}
export type PilotNormalizedCandle = HistoricalInputCandle;
export type PilotPriceBasis = ResearchPriceBasis;
