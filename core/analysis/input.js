import { types } from 'node:util';
import { TIMEFRAMES, HIGHER_TIMEFRAMES, RISK_MODES } from '../validate.js';
import { getTrustedMarketService, inspectObservationProvenance } from '../market/service.js';

// Reserved identity boundary. No writer exists while the only source is diagnostic-only.
// No constructor accepts public data and no result from this module grants runtime access.
const inputIdentities = new WeakSet();
const hasInputIdentity = inputIdentities.has.bind(inputIdentities);
const isProxy = types.isProxy;
const reason = (code, category, publicMessage) => Object.freeze({ code, category, publicMessage });
const invalidIntent = () => Object.freeze({ ok: false, intent: null, grantsRuntimeAccess: false,
  reason: reason('INVALID_ANALYZE_INTENT', 'DATA_INTEGRITY', 'Analysis intent contains invalid or unsupported fields.') });

function fields(value, keys) {
  if (!value || typeof value !== 'object' || isProxy(value) || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || !keys.every(key =>
    Object.hasOwn(descriptors, key) && Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function arrayValues(value, maximum) {
  if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const copy = [];
  for (let i = 0; i < length; i++) {
    const d = descriptors[i];
    if (!d || !Object.hasOwn(d, 'value')) return null;
    copy.push(d.value);
  }
  return copy;
}
function normalizePair(value) {
  if (typeof value !== 'string') return null;
  const pair = value.trim().toUpperCase();
  if (/^[A-Z]{6}$/.test(pair)) return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  return /^[A-Z]{3}\/[A-Z]{3}$/.test(pair) ? pair : null;
}
function parseAnalyzeIntent(value) {
  try {
    const v = fields(value, ['pairs', 'timeframe', 'higherTimeframes', 'mode', 'safeModeEnabled', 'filters']);
    if (!v) return invalidIntent();
    const rawPairs = arrayValues(v.pairs, 16), higher = arrayValues(v.higherTimeframes, HIGHER_TIMEFRAMES.length);
    const filters = fields(v.filters, ['newsFilterEnabled', 'atrFilterEnabled', 'riskCapEnabled']);
    if (!rawPairs?.length || !higher || !filters || !TIMEFRAMES.includes(v.timeframe) || !RISK_MODES.includes(v.mode) ||
      typeof v.safeModeEnabled !== 'boolean' || !Object.values(filters).every(f => typeof f === 'boolean')) return invalidIntent();
    const pairs = rawPairs.map(normalizePair);
    if (pairs.some(p => p === null) || new Set(pairs).size !== pairs.length || new Set(higher).size !== higher.length ||
      !higher.every(tf => HIGHER_TIMEFRAMES.includes(tf) && (tf === 'D' || Number(tf) > Number(v.timeframe)))) return invalidIntent();
    return Object.freeze({ ok: true, grantsRuntimeAccess: false, intent: Object.freeze({
      pairs: Object.freeze(pairs), timeframe: v.timeframe, higherTimeframes: Object.freeze(higher),
      mode: v.mode, safeModeEnabled: v.safeModeEnabled, filters: Object.freeze(filters)
    }) });
  } catch { return invalidIntent(); }
}

function denied(intent, reasons, missingHigherTimeframes = []) {
  return Object.freeze({ status: 'DENIED', diagnosticOnly: true, grantsRuntimeAccess: false, input: null,
    intent, reasons: Object.freeze(reasons), missingHigherTimeframes: Object.freeze([...missingHigherTimeframes]),
    quote: null, requirements: null, strategyVersion: null, analysisSessionId: null, quality: null, eligibility: null,
    filterEvidence: Object.freeze({ news: 'UNKNOWN', atr: 'UNKNOWN', risk: 'UNKNOWN' }) });
}
function assessAnalysisReadiness(rawIntent, selection) {
  const parsed = parseAnalyzeIntent(rawIntent);
  if (!parsed.ok) return denied(null, [parsed.reason]);
  const intent = parsed.intent, reasons = [];
  const add = (code, category = 'ELIGIBILITY') => reasons.push(reason(code, category, 'Required server-owned analysis evidence is unavailable or inconsistent.'));
  let selected, higher;
  try {
    selected = fields(selection, ['primary', 'higherTimeframes']);
    higher = selected && arrayValues(selected.higherTimeframes, HIGHER_TIMEFRAMES.length);
  } catch { selected = null; }
  if (!selected || !higher) {
    add('INVALID_OBSERVATION_SELECTION', 'DATA_INTEGRITY');
    return denied(intent, reasons, intent.higherTimeframes);
  }
  if (intent.pairs.length !== 1) add('SINGLE_PAIR_SESSION_REQUIRED');
  // The owning service is chosen internally, never supplied by a caller or an HTTP field.
  const service = getTrustedMarketService();
  const registered = observation => inspectObservationProvenance(service, observation).registered;
  const primary = selected.primary;
  if (!registered(primary)) add('PRIMARY_ORIGIN_UNVERIFIED', 'DATA_INTEGRITY');
  else {
    if (intent.pairs.length === 1 && primary.pair !== intent.pairs[0]) add('PAIR_MISMATCH', 'DATA_INTEGRITY');
    if (primary.timeframe !== intent.timeframe) add('TIMEFRAME_MISMATCH', 'DATA_INTEGRITY');
    // 4C currently registers DISPLAY-only acquisitions; origin does not upgrade their purpose.
    add('DIAGNOSTIC_SOURCE_ONLY');
    if (primary.timing.providerQuoteUpdatedAtMs === null) add('QUOTE_TIMESTAMP_UNKNOWN', 'MARKET_DATA');
    if (primary.session !== 'OPEN') add('MARKET_SESSION_UNCONFIRMED', 'MARKET_DATA');
  }
  const available = new Set();
  for (const observation of higher) {
    if (!registered(observation)) { add('HIGHER_ORIGIN_UNVERIFIED', 'DATA_INTEGRITY'); continue; }
    if (intent.pairs.length !== 1 || observation.pair !== intent.pairs[0]) { add('HIGHER_PAIR_MISMATCH', 'DATA_INTEGRITY'); continue; }
    if (!intent.higherTimeframes.includes(observation.timeframe)) { add('UNREQUESTED_HIGHER_TIMEFRAME', 'DATA_INTEGRITY'); continue; }
    if (available.has(observation.timeframe)) add('DUPLICATE_HIGHER_TIMEFRAME', 'DATA_INTEGRITY');
    available.add(observation.timeframe);
  }
  const missing = intent.higherTimeframes.filter(tf => !available.has(tf));
  if (missing.length) add('HIGHER_TIMEFRAMES_MISSING', 'MARKET_DATA');
  // No strategy requirements, separate quote, session binding or verified filters exist yet.
  // Never invent them, inherit a DISPLAY decision or trust booleans requested in the intent.
  add('SEPARATE_QUOTE_UNAVAILABLE', 'MARKET_DATA');
  add('SERVER_REQUIREMENTS_UNAVAILABLE');
  add('STRATEGY_VERSION_UNAVAILABLE');
  add('ANALYSIS_SESSION_UNBOUND');
  add('FILTER_EVIDENCE_UNKNOWN');
  add('TRUSTED_INPUT_CONSTRUCTION_DISABLED');
  return denied(intent, reasons, missing);
}
function isTrustedAnalysisInput(value) {
  return hasInputIdentity(value);
}

export { parseAnalyzeIntent, assessAnalysisReadiness, isTrustedAnalysisInput };
