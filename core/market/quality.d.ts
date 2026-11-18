import type { QualityReport } from './contracts.js';
/** Pure; explicit epoch milliseconds. Does not authenticate provenance or issue grants. */
export declare function assessQuality(observation: unknown, requirements: unknown, nowMs: number): QualityReport;
