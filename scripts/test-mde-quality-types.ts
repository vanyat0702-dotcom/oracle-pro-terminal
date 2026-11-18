// Compile-only contract checks; no provider, HTTP, AI or runtime execution.
import type { MarketObservation, AnalysisRequirements, QualityReport, EligibilityDecision, SkipReason } from '../core/market/contracts.js';
import { assessQuality } from '../core/market/quality.js';
import { evaluateEligibility } from '../core/market/eligibility.js';

declare const observation: MarketObservation;
declare const requirements: AnalysisRequirements;
declare const evaluationEpochMs: number;
const quality: QualityReport = assessQuality(observation, requirements, evaluationEpochMs);
const decision: EligibilityDecision = evaluateEligibility(observation, requirements, evaluationEpochMs);
const noGrant: false = decision.grantsRuntimeAccess;
const reason: SkipReason | undefined = decision.reasons[0];
// @ts-expect-error Explicit evaluation time is mandatory.
assessQuality(observation, requirements);
// @ts-expect-error Decisions never carry a runtime capability.
decision.context;
// @ts-expect-error Existing observations must not be mutated through the contract.
observation.candles.push(observation.candles[0]);
// @ts-expect-error HTTP receipt does not replace the nullable source timestamp.
const fakeTimestamp: number = observation.timing.providerQuoteUpdatedAtMs;
void [quality, noGrant, reason];
