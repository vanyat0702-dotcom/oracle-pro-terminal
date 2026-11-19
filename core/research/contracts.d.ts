/** Independent research contracts. No live AnalysisRequirements or authorization extension. */
export type ResearchInstrumentId = 'audcad' | 'audchf' | 'audjpy' | 'audnzd' | 'audusd' | 'cadjpy' |
  'euraud' | 'eurchf' | 'eurgbp' | 'eurjpy' | 'eurnzd' | 'eurusd' | 'gbpaud' | 'gbpchf' |
  'gbpjpy' | 'gbpnzd' | 'gbpusd' | 'nzdusd' | 'usdcad' | 'usdchf' | 'usdjpy' | 'btcusdt';
export type ResearchPriceBasis = 'bid' | 'ask' | 'mid' | 'last';
export interface ResearchInstrument {
  readonly instrument: ResearchInstrumentId;
  readonly pair: string;
  readonly base: string;
  readonly quote: string;
  readonly assetClass: 'FOREX' | 'CRYPTO';
  readonly sourceId: null;
  readonly sourceSymbol: null;
  readonly venue: null;
  readonly priceBasis: 'UNKNOWN';
  readonly researchTimeframes: readonly ['1'];
  readonly historyStatus: 'MISSING';
  readonly readiness: 'NOT_READY';
  readonly grantsRuntimeAccess: false;
}
export interface HistoricalSource {
  readonly sourceId: string;
  readonly symbol: string;
  readonly venue: string;
  readonly priceBasis: ResearchPriceBasis;
}
export interface HistoricalLicense {
  readonly reference: string;
  readonly permission: 'DECLARED';
  readonly permittedPurpose: 'CLOSED_BAR_RESEARCH';
}
export interface HistoricalInputCandle {
  readonly instrument: ResearchInstrumentId;
  readonly sourceId: string;
  readonly sourceSymbol: string;
  readonly venue: string;
  readonly priceBasis: ResearchPriceBasis;
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly isOpen: false;
  readonly volume?: number;
}
export interface HistoricalDatasetFile {
  readonly schemaVersion: 1;
  readonly kind: 'REAL' | 'MOCK';
  readonly instrument: ResearchInstrumentId;
  readonly timeframe: '1';
  readonly source: HistoricalSource;
  readonly license: HistoricalLicense;
  /** Inclusive candle-open timestamps; strict, continuous M1 grid in 1A. */
  readonly period: Readonly<{ from: string; to: string }>;
  readonly expectedCandles: number;
  readonly candles: readonly HistoricalInputCandle[];
}
export interface HistoricalImportOptions {
  readonly instrument: ResearchInstrumentId;
  /** SHA-256 of exact file bytes, supplied separately from the file. */
  readonly expectedChecksum: string;
  readonly asOf: string;
}
export interface HistoricalManifest {
  readonly schemaVersion: 1;
  readonly instrument: ResearchInstrumentId;
  readonly pair: string;
  readonly timeframe: '1';
  readonly dataKind: 'DECLARED_REAL' | 'MOCK';
  readonly historyStatus: 'PRESENT_UNVERIFIED' | 'MOCK_ONLY';
  readonly readiness: 'NOT_READY';
  readonly source: HistoricalSource;
  readonly license: HistoricalLicense;
  readonly metadataEvidence: 'DECLARED_ONLY';
  readonly permittedPurpose: 'CLOSED_BAR_RESEARCH';
  readonly period: Readonly<{ from: string; to: string }>;
  readonly actualPeriod: Readonly<{ from: string; to: string }> | null;
  readonly candleCount: number;
  readonly expectedCandles: number;
  readonly missingCandles: number;
  readonly duplicates: number;
  readonly checksum: Readonly<{ algorithm: 'SHA-256'; value: string; matchesExpected: true }>;
  readonly assessedAsOf: string;
  readonly qualityStatus: 'PASS' | 'FAIL';
  readonly grantsRuntimeAccess: false;
}
export interface ResearchCandle {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly isOpen: false;
  readonly volume?: number;
}
export interface HistoricalImportResult {
  readonly status: 'VALIDATED' | 'REJECTED';
  readonly readiness: 'NOT_READY';
  readonly grantsRuntimeAccess: false;
  readonly manifest: HistoricalManifest | null;
  readonly candles: readonly ResearchCandle[];
  readonly errors: readonly Readonly<{ code: string; row: number | null }>[];
}
