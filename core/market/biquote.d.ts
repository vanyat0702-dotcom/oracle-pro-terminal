import type { MarketCandle, MarketDataSnapshot, MarketDataProvider, MarketDataRequest } from '../contracts.js';

export interface BiquoteCandle extends MarketCandle {
  isOpen: boolean;
  tickVolume?: number;
}
export interface BiquoteSnapshot extends MarketDataSnapshot {
  candles: BiquoteCandle[];
  source: { provider: 'Biquote'; endpoint: string; priceBasis: 'mid' };
  quality: {
    status: 'VALID'; checkedAt: string; ageSeconds: number; maxAgeSeconds: number;
    freshnessBasis: 'latest_candle_open_time'; gaps: 0; duplicates: 0;
    order: 'ascending'; tradingEligible: false;
  };
}
export declare const BIQUOTE_URL: string;
export declare const SOURCE: Readonly<BiquoteSnapshot['source']>;
export declare class MarketDataError extends Error { readonly code: string; constructor(code: string, message: string); }
export declare function normalizeBiquote(payload: unknown, nowMs?: number): BiquoteSnapshot;
export declare function createBiquoteProvider(options?: {
  fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number;
}): MarketDataProvider & {
  latest(): Promise<BiquoteSnapshot>;
  getSnapshot(request: MarketDataRequest): Promise<BiquoteSnapshot>;
  getCandles(request: MarketDataRequest): Promise<BiquoteCandle[]>;
};
