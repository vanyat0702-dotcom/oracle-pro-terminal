// Compile-only; no runtime AI imports/calls are executed by this file.
import { createUnprivilegedContext, checkRuntimeAccess, runtimeGuardSkip } from '../core/runtimeGuard.js';
import type { RuntimeContext } from '../core/runtimeGuard.js';
import { analyze, getJointPrediction, getGPTAnalysis, getGeminiAnalysis } from '../core/index.js';
import type { AnalyzeResult } from '../core/contracts.js';

const context: RuntimeContext = createUnprivilegedContext();
const allowed: false = checkRuntimeAccess(context).allowed;
const skip: 'SKIP' = runtimeGuardSkip().signal;
const results: Promise<AnalyzeResult>[] = [analyze(null), analyze({}, context), getJointPrediction(undefined, context)];
void [allowed, skip, results, getGPTAnalysis({}, context), getGeminiAnalysis(null, context)];
// @ts-expect-error A JSON-shaped object cannot satisfy the opaque context type.
const forged: RuntimeContext = { allowed: true };
// @ts-expect-error The guard cannot grant runtime access.
const positive: true = checkRuntimeAccess(context).allowed;
// @ts-expect-error Client context fields are not accepted as the separate context parameter.
analyze({}, { eligible: true });
void [forged, positive];
