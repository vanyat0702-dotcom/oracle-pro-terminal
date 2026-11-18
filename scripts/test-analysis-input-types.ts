// Compile-only; no production input or runtime grant can be issued.
import type { AnalyzeIntent, TrustedAnalysisInput, AnalysisQuote, ServerAnalysisRequirements,
  PrimaryAnalysisRequirements, HigherAnalysisRequirements, AnalysisObservationBundle } from '../core/analysis/contracts.js';
import type { AnalysisRequirements, MarketObservation } from '../core/market/contracts.js';
import { parseAnalyzeIntent, assessAnalysisReadiness, isTrustedAnalysisInput } from '../core/analysis/input.js';
import type { RuntimeContext } from '../core/runtimeGuard.js';
declare const intent: AnalyzeIntent;
declare const input: TrustedAnalysisInput;
declare const candidate: unknown;
declare const requirements: ServerAnalysisRequirements;
const parsed = parseAnalyzeIntent(intent);
const denied = assessAnalysisReadiness(intent, { primary: null, higherTimeframes: [] });
const status: 'DENIED' = denied.status;
const absent: null = denied.input;
const noGrant: false = denied.grantsRuntimeAccess;
const quote: AnalysisQuote | null = input.quote;
if (isTrustedAnalysisInput(candidate)) { const future: TrustedAnalysisInput = candidate; void future; }
// @ts-expect-error Intent has no market prices.
intent.currentPrice;
// @ts-expect-error Intent has no market candles.
intent.candles;
// @ts-expect-error Intent has no provenance or source selectors.
intent.sourceId;
// @ts-expect-error A normalized intention cannot become an opaque server input.
const forged: TrustedAnalysisInput = intent;
// @ts-expect-error Data contracts do not grant runtime permission.
const context: RuntimeContext = input;
// @ts-expect-error No live permission can be carried by an input.
const positive: true = input.grantsRuntimeAccess;
// @ts-expect-error Client arrays cannot be mutated through the normalized contract.
intent.higherTimeframes.push('15');
// @ts-expect-error Nested market candles remain immutable.
input.observations.primary!.candles[0].close = 123;
// @ts-expect-error Requirements are server-owned and immutable.
requirements.primary.minCandles = 1;
// @ts-expect-error No caller can supply a trusted service or policy to the readiness API.
assessAnalysisReadiness(intent, {}, { sourceId: 'biquote', eligible: true });
void [parsed, status, absent, noGrant, quote, forged, context, positive];

// D1: all fixtures below are compile-only declarations, not runtime-supported markets.
declare const legacyM1: AnalysisRequirements;
declare const observation: MarketObservation;
const m1: PrimaryAnalysisRequirements<'1'> = { ...legacyM1, timeframe: '1' };
const m5: PrimaryAnalysisRequirements<'5'> = { ...legacyM1, timeframe: '5' };
const m15: HigherAnalysisRequirements<'15'> = { ...legacyM1, timeframe: '15' };
const primaryFrames: readonly PrimaryAnalysisRequirements[] = [m1, m5,
  { ...legacyM1, timeframe: '15' }, { ...legacyM1, timeframe: '60' }, { ...legacyM1, timeframe: '240' }];
const higherFrames: readonly HigherAnalysisRequirements[] = [
  { ...legacyM1, timeframe: '5' }, m15, { ...legacyM1, timeframe: '30' },
  { ...legacyM1, timeframe: '60' }, { ...legacyM1, timeframe: '240' }, { ...legacyM1, timeframe: 'D' }];
const serverRequirements: ServerAnalysisRequirements = { ...requirements, primary: m1, higherTimeframes: higherFrames };
const m5ServerRequirements: ServerAnalysisRequirements = { ...requirements, primary: m5, higherTimeframes: [m15] };
const intentAlignment: AnalyzeIntent = { ...intent, timeframe: m5.timeframe,
  higherTimeframes: m5ServerRequirements.higherTimeframes.map(r => r.timeframe) };
const bundleAlignment: AnalysisObservationBundle = { bundleId: 'compile-only',
  primary: { ...observation, timeframe: m5.timeframe },
  higherTimeframes: { '15': { ...observation, timeframe: m15.timeframe } } };
const unchangedLegacy: AnalysisRequirements = m1;
// @ts-expect-error M30 is higher-only, matching the current AnalyzeIntent contract.
type InvalidPrimaryM30 = PrimaryAnalysisRequirements<'30'>;
// @ts-expect-error D is higher-only, matching the current AnalyzeIntent contract.
type InvalidPrimaryD = PrimaryAnalysisRequirements<'D'>;
// @ts-expect-error M1 cannot be requested as a higher timeframe.
type InvalidHigherM1 = HigherAnalysisRequirements<'1'>;
// @ts-expect-error Unsupported timeframe is not made valid by parameterization.
const unsupportedFrame: HigherAnalysisRequirements = { ...legacyM1, timeframe: '2' };
// @ts-expect-error Numeric aliases do not replace canonical timeframe strings.
const numericFrame: PrimaryAnalysisRequirements = { ...legacyM1, timeframe: 5 };
// @ts-expect-error A specific M15 requirement cannot contain M5 data.
const mismatchedFrame: HigherAnalysisRequirements<'15'> = { ...legacyM1, timeframe: '5' };
// @ts-expect-error The old market contract remains M1-only.
const widenedLegacy: AnalysisRequirements = m5;
// @ts-expect-error The old market contract does not gain D support either.
const legacyDaily: AnalysisRequirements = { ...legacyM1, timeframe: 'D' };
const { maxQuoteAgeMs: omittedQuoteAge, ...incomplete } = legacyM1;
// @ts-expect-error Parameterization does not make required evidence fields optional.
const missingField: PrimaryAnalysisRequirements<'1'> = incomplete;
// @ts-expect-error Lookback retains its original numeric type.
const wrongLookback: HigherAnalysisRequirements<'15'> = { ...legacyM1, timeframe: '15', minCandles: '100' };
// @ts-expect-error Correcting timeframe does not expand supported pair contracts.
const wrongPair: PrimaryAnalysisRequirements<'5'> = { ...legacyM1, timeframe: '5', pair: 'GBP/USD' };
// @ts-expect-error Client trust flags are not added to requirements.
const trustFlag: HigherAnalysisRequirements<'15'> = { ...legacyM1, timeframe: '15', eligible: true };
// @ts-expect-error New requirement projections stay immutable.
m5.timeframe = '5';
// @ts-expect-error The higher requirements array stays immutable.
serverRequirements.higherTimeframes.push(m15);
void [primaryFrames, serverRequirements, m5ServerRequirements, intentAlignment, bundleAlignment, unchangedLegacy,
  unsupportedFrame, numericFrame, mismatchedFrame, widenedLegacy, legacyDaily,
  omittedQuoteAge, missingField, wrongLookback, wrongPair, trustFlag];
