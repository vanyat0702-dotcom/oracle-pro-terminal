import type { AnalyzeResult } from './contracts.js';

declare const contextBrand: unique symbol;
/** Opaque process-local identity. All contexts are unprivileged; not an HTTP contract. */
export interface RuntimeContext { readonly [contextBrand]: 'UNPRIVILEGED' }
export interface RuntimeDenial {
  readonly allowed: false;
  readonly code: 'RUNTIME_GUARD_DENIED';
  readonly publicMessage: string;
}
export interface RuntimeGuardSkip extends AnalyzeResult {
  readonly signal: 'SKIP'; readonly confidence: 0; readonly tradeId: 0;
  readonly skipReason: Readonly<{
    code: 'RUNTIME_GUARD_DENIED'; category: 'ELIGIBILITY'; publicMessage: string;
  }>;
}
export declare function createUnprivilegedContext(): RuntimeContext;
/** Always denies; no runtime function can issue a positive grant. Does not inspect input fields. */
export declare function checkRuntimeAccess(context?: unknown): Readonly<RuntimeDenial>;
export declare function runtimeGuardSkip(): Readonly<RuntimeGuardSkip>;
