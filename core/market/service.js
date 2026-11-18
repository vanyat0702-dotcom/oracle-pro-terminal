import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createBiquoteProvider, MarketDataError } from './biquote.js';
import { resolveSource } from './sourceRegistry.js';
import { evaluateEligibility } from './eligibility.js';

const epoch = n => Number.isSafeInteger(n) && n > 0 && n <= 8640000000000000;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function denied(code, message) {
  return freeze({ status: 'DENIED', diagnosticOnly: true, grantsRuntimeAccess: false,
    observation: null, provenance: null, quality: null, eligibility: null,
    reason: { code, category: 'MARKET_DATA', publicMessage: message } });
}

/**
 * Server-only acquisition. Construction dependencies are privileged server/test code,
 * never HTTP input; registry policy, endpoint, tick time and session are not injectable.
 * No cache, retries, AI or runtime grant. Import/construction performs no requests.
 */
function createMarketService({ fetchImpl = globalThis.fetch, wallNow = Date.now,
  monotonicNow = () => performance.now(), idFactory = randomUUID } = {}) {
  async function observe(request) {
    const resolution = resolveSource(request);
    if (resolution.status !== 'APPROVED') return denied(resolution.code, 'Market request is not approved by the server registry.');
    // Capture trusted registry values before awaiting; later caller mutations cannot alter scope.
    const source = resolution.source;
    try {
      const requestStartedAtMs = wallNow();
      const started = monotonicNow();
      if (!epoch(requestStartedAtMs) || !Number.isFinite(started) || started < 0) {
        return denied('SERVICE_CLOCK_INVALID', 'Server acquisition clocks are invalid.');
      }
      let responseHeadersReceivedAtMs = null;
      const provider = createBiquoteProvider({
        now: wallNow,
        fetchImpl: async (url, options) => {
          // Defensive fixed-destination assertion; no URL comes from the request.
          if (url !== source.endpoint) throw new Error('Registry/provider endpoint mismatch');
          const response = await fetchImpl(url, options);
          responseHeadersReceivedAtMs = wallNow();
          return response;
        }
      });
      const snapshot = await provider.latest();
      const ended = monotonicNow();
      const observationCompletedAtMs = wallNow();
      const duration = Math.ceil(ended - started); // conservative whole milliseconds
      if (!Number.isFinite(ended) || ended < started || !Number.isSafeInteger(duration) ||
        !epoch(responseHeadersReceivedAtMs) || !epoch(observationCompletedAtMs) ||
        responseHeadersReceivedAtMs < requestStartedAtMs || observationCompletedAtMs < responseHeadersReceivedAtMs) {
        return denied('SERVICE_CLOCK_INVALID', 'Server acquisition clocks are invalid.');
      }
      const snapshotId = idFactory();
      if (typeof snapshotId !== 'string' || !snapshotId.trim()) return denied('OBSERVATION_ID_INVALID', 'Observation identity is unavailable.');
      // Copy only normalized provider prices/bars, not provider/client quality or trust claims.
      const candles = snapshot.candles.map(c => ({
        time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, isOpen: c.isOpen,
        ...(c.volume === undefined ? {} : { volume: c.volume }),
        ...(c.tickVolume === undefined ? {} : { tickVolume: c.tickVolume })
      }));
      const observation = freeze({ schemaVersion: 1, snapshotId,
        pair: source.instruments[0], timeframe: source.timeframes[0], candles,
        source: { provider: source.provider, endpoint: source.endpoint, priceBasis: source.priceBasis },
        timing: { requestStartedAtMs, observationCompletedAtMs,
          providerQuoteUpdatedAtMs: null, acquisitionDurationMs: duration },
        session: 'UNKNOWN'
      });
      // Provider has neither verified quote-event time nor market-session evidence.
      // HTTP receipt, checkedAt, candle close and client timestamps cannot fill those gaps.
      const evaluatedAtMs = wallNow();
      if (!epoch(evaluatedAtMs) || evaluatedAtMs < observationCompletedAtMs) {
        return denied('SERVICE_CLOCK_INVALID', 'Server evaluation clock is invalid.');
      }
      const requirements = freeze({ purpose: source.purposes[0], pair: source.instruments[0], timeframe: source.timeframes[0],
        from: candles[0]?.time, to: candles.at(-1)?.time, minCandles: 2, allowOpenBar: true,
        maxCandleAgeMs: 120000, maxObservationAgeMs: 5000, maxQuoteAgeMs: 5000, maxAcquisitionDurationMs: 5000
      });
      const eligibility = evaluateEligibility(observation, requirements, evaluatedAtMs);
      return freeze({ status: eligibility.status === 'ALLOWED' ? 'ASSESSED' : 'DENIED',
        diagnosticOnly: true, grantsRuntimeAccess: false, observation,
        provenance: { acquisition: 'SERVER_PROVIDER', sourceId: source.sourceId,
          registryVersion: resolution.registryVersion, responseHeadersReceivedAtMs,
          responseTimeMeaning: 'HEADERS_ONLY', requirements },
        quality: eligibility.quality, eligibility,
        reason: eligibility.reasons[0] ?? null
      });
    } catch (error) {
      // A failed acquisition never returns the previous observation, raw upstream details or secrets.
      return denied(error instanceof MarketDataError ? error.code : 'SOURCE_UNAVAILABLE', 'Market observation could not be acquired.');
    }
  }
  return Object.freeze({ observe });
}

export { createMarketService };
