export const BINANCE_URL: string;
export const PUBLICATION_GRACE_MS: 5000;
export const SOURCE: Readonly<{provider: 'Binance'; sourceId: 'BINANCE_SPOT'; symbol: 'BTCUSDT'; market: 'SPOT'; priceBasis: 'last'; endpoint: string}>;
export class BinanceObservationError extends Error { readonly code: string; constructor(code: string) }
export interface BinanceCandle {
  readonly time: number; readonly openTimeMs: number; readonly closeTimeMs: number;
  readonly open: number; readonly high: number; readonly low: number; readonly close: number; readonly volume: number; readonly isOpen: false;
}
export interface BinanceObservation {
  readonly pair: 'BTC/USDT'; readonly timeframe: '1'; readonly source: typeof SOURCE;
  readonly diagnosticOnly: true; readonly readiness: 'NOT_READY'; readonly grantsRuntimeAccess: false;
  readonly candles: readonly BinanceCandle[];
  readonly timing: Readonly<{receivedAtMs: number; checkedAtMs: number; providerQuoteUpdatedAtMs: null; startedAtMs?: number; acquisitionDurationMs?: number}>;
  readonly quality: Readonly<{status: 'PUBLICATION_DELAY' | 'STRUCTURE_VALID'; tradingEligible: false;
    expectedLastOpenMs: number; latestClosedAtMs: number; publicationGraceMs: 5000; gaps: 0; duplicates: 0;
    excludedOpenCandles: number; clockEvidence: 'LOCAL_SERVER_ONLY'; quoteFreshness: 'UNKNOWN'}>;
}
export function normalizeBinance(payload: unknown, checkedAtMs: number, receivedAtMs?: number): BinanceObservation;
export function createBinanceObservationProvider(options?: {fetchImpl?: typeof fetch; now?: () => number; monotonicNow?: () => number; timeoutMs?: number}): Readonly<{latest(): Promise<BinanceObservation>}>;
