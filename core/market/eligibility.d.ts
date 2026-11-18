import type { EligibilityDecision } from './contracts.js';
/** Pure informational decision. UNKNOWN is denied; no runtime authorization is issued. */
export declare function evaluateEligibility(observation: unknown, requirements: unknown, nowMs: number): EligibilityDecision;
