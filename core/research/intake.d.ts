import type { HistoricalImportResult } from './contracts.js';
export declare const MAX_FILE_BYTES: number;
export declare const MAX_CANDLES: number;
/** Explicit clocks and out-of-band checksum; no network, writes or runtime grant. */
export declare function inspectHistoricalBytes(bytes: unknown, options: unknown): HistoricalImportResult;
/** Reads a bounded regular local UTF-8 JSON file. URLs and UNC shares are rejected. */
export declare function importHistoricalFile(inputPath: unknown, options: unknown): Promise<HistoricalImportResult>;
