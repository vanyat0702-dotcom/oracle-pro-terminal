import type { HistoricalSource, HistoricalLicense, HistoricalManifest, ResearchInstrumentId } from './contracts.js';
export type ResearchCalendarSpec = Readonly<{ profile: 'UNKNOWN' }> | Readonly<{
  profile: 'CRYPTO_24_7'; sourceId: string; venue: string; reference: string; exceptions: readonly never[];
}> | Readonly<{
  profile: 'FOREX_WEEKLY'; sourceId: string; venue: string; reference: string; exceptions: readonly never[];
  timeZone: string;
  /** Local minute of Sunday opening / Friday closing. No implicit source schedule. */
  openMinute: number; closeMinute: number;
}>;
export interface ArchiveHeader {
  readonly type: 'archive'; readonly schemaVersion: 1; readonly instrument: ResearchInstrumentId;
  readonly kind: 'REAL' | 'MOCK'; readonly timeframe: '1';
  readonly source: HistoricalSource; readonly license: HistoricalLicense;
  readonly provenance: Readonly<{ declaration: string; evidence: 'DECLARED_ONLY' }>;
  readonly calendar: ResearchCalendarSpec;
}
export interface ArchiveFragment {
  readonly type: 'fragment'; readonly path: string; readonly expectedChecksum: string;
  readonly period: Readonly<{ from: string; to: string }>; readonly expectedCandles: number;
}
export interface ArchiveOptions {
  readonly root: string; readonly indexPath: string; readonly expectedIndexChecksum: string;
  readonly instrument: ResearchInstrumentId; readonly asOf: string;
}
export interface CalendarInterval {
  readonly status: 'MODELLED' | 'UNKNOWN'; readonly tradingMinutes: number | null;
  readonly nonTradingMinutes: number | null; readonly nonTradingIntervals: number | null;
}
export interface ArchiveCoverage {
  readonly instrument: ResearchInstrumentId | null; readonly dataKind: 'MOCK' | 'DECLARED_REAL' | null;
  readonly status: 'NOT_READY' | 'PRESENT_UNVERIFIED' | 'VALIDATED_FOR_RESEARCH_METADATA';
  readonly historyStatus: 'MISSING' | 'UNKNOWN' | 'MOCK_ONLY' | 'PRESENT_UNVERIFIED';
  readonly source: HistoricalSource | null; readonly license: HistoricalLicense | null;
  readonly provenance: ArchiveHeader['provenance'] | null;
  readonly calendar: ResearchCalendarSpec | null; readonly assessedAsOf: string | null;
  readonly permittedPurpose: 'CLOSED_BAR_RESEARCH'; readonly indexChecksum: string | null;
  readonly readiness: 'NOT_READY'; readonly grantsRuntimeAccess: false;
  readonly structure: 'PASS' | 'FAIL'; readonly coverage: 'PASS' | 'FAIL' | 'UNKNOWN';
  readonly originEvidence: 'DECLARED_ONLY' | 'UNKNOWN'; readonly licenseEvidence: 'DECLARED_NOT_VERIFIED' | 'UNKNOWN';
  readonly calendarConfidence: 'DECLARED_ONLY' | 'UNKNOWN';
  readonly firstCandle: string | null; readonly lastCandle: string | null;
  readonly candleCount: number; readonly fragmentCount: number; readonly missingTradingMinutes: number | null;
  readonly nonTradingMinutes: number; readonly nonTradingIntervals: number; readonly unexplainedGaps: number;
  readonly overlaps: number; readonly orderViolations: number; readonly mixedSources: number; readonly duplicates: number;
  readonly unexpectedClosedCandles: number; readonly monthsCovered: number; readonly yearsCovered: number;
  readonly indexChecksumVerified: boolean; readonly errorCodes: readonly string[];
}
/** All intermediate events are provisional until a final structure PASS report. No candles retained/emitted. */
export type ArchiveEvent =
  | Readonly<{ type: 'header'; provisional: true; header: ArchiveHeader }>
  | Readonly<{ type: 'fragment'; provisional: true; path: string; manifest: HistoricalManifest; provenance: ArchiveHeader['provenance'] }>
  | Readonly<{ type: 'gap'; provisional: true; from: string; toExclusive: string; assessment: CalendarInterval }>
  | Readonly<{ type: 'month' | 'year'; provisional: true; key: string; candleCount: number }>
  | Readonly<{ type: 'coverage'; report: ArchiveCoverage }>;
