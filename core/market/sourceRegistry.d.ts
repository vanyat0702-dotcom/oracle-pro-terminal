import type { AnalysisPurpose } from './contracts.js';
export interface MarketServiceRequest {
  readonly sourceId: string;
  readonly pair: string;
  readonly timeframe: string;
  readonly purpose: AnalysisPurpose;
}
export interface RegisteredSource {
  readonly sourceId: 'biquote';
  readonly provider: 'Biquote';
  readonly endpoint: string;
  readonly priceBasis: 'mid';
  readonly instruments: readonly ['EUR/USD'];
  readonly timeframes: readonly ['1'];
  readonly purposes: readonly ['DISPLAY'];
  readonly diagnosticOnly: true;
}
export declare const REGISTRY_VERSION: 'mde-phase3b-increment2';
export type SourceResolution =
  | Readonly<{ status: 'APPROVED'; code: 'SOURCE_APPROVED'; source: RegisteredSource; registryVersion: typeof REGISTRY_VERSION }>
  | Readonly<{ status: 'DENIED'; code: string; source: null; registryVersion: typeof REGISTRY_VERSION }>;
export declare function listSources(): readonly RegisteredSource[];
/** Accepts exactly four own string data fields. All extra trust/price/URL fields are rejected. */
export declare function resolveSource(request: unknown): SourceResolution;
