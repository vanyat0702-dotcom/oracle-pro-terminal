import type { IntentValidationResult, AnalysisReadinessDenial, TrustedAnalysisInput } from './contracts.js';
/** Strict allowlist, normalized deep copy, no financial evidence or authorization. */
export declare function parseAnalyzeIntent(value: unknown): IntentValidationResult;
/** Read-only assessment. No acquisition/AI, input constructor, session binding or live approval. */
export declare function assessAnalysisReadiness(intent: unknown, selection: unknown): Readonly<AnalysisReadinessDenial>;
/** The private identity set is empty in 4D; no writer/factory is exposed or implemented. */
export declare function isTrustedAnalysisInput(value: unknown): value is TrustedAnalysisInput;
