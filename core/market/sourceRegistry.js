import { SOURCE } from './biquote.js';

// Server-owned, immutable policy. Request fields cannot register or extend sources.
const REGISTRY_VERSION = 'mde-phase3b-increment2';
const sources = Object.freeze([Object.freeze({
  sourceId: 'biquote', provider: SOURCE.provider, endpoint: SOURCE.endpoint,
  priceBasis: SOURCE.priceBasis,
  instruments: Object.freeze(['EUR/USD']), timeframes: Object.freeze(['1']),
  purposes: Object.freeze(['DISPLAY']),
  diagnosticOnly: true
})]);

function listSources() { return sources; }
function resolveSource(request) {
  const deny = code => Object.freeze({ status: 'DENIED', code, source: null, registryVersion: REGISTRY_VERSION });
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(request))) return deny('INVALID_MARKET_REQUEST');
  const keys = ['sourceId', 'pair', 'timeframe', 'purpose'];
  if (Reflect.ownKeys(request).length !== keys.length || !keys.every(k => {
    const descriptor = Object.getOwnPropertyDescriptor(request, k);
    return descriptor && 'value' in descriptor && typeof descriptor.value === 'string';
  })) return deny('INVALID_MARKET_REQUEST');
  const source = sources.find(s => s.sourceId === request.sourceId);
  if (!source) return deny('SOURCE_NOT_REGISTERED');
  if (!source.instruments.includes(request.pair)) return deny('INSTRUMENT_NOT_APPROVED');
  if (!source.timeframes.includes(request.timeframe)) return deny('TIMEFRAME_NOT_APPROVED');
  if (!source.purposes.includes(request.purpose)) return deny('PURPOSE_NOT_APPROVED');
  return Object.freeze({ status: 'APPROVED', code: 'SOURCE_APPROVED', source, registryVersion: REGISTRY_VERSION });
}

export { REGISTRY_VERSION, listSources, resolveSource };
