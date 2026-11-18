// Compile-only, never executes network acquisition.
import type { MarketServiceRequest, RegisteredSource } from '../core/market/sourceRegistry.js';
import { listSources, resolveSource } from '../core/market/sourceRegistry.js';
import { createMarketService } from '../core/market/service.js';
import type { MarketServiceResult } from '../core/market/service.js';

declare const request: MarketServiceRequest;
const source: RegisteredSource | undefined = listSources()[0];
const result: Promise<MarketServiceResult> = createMarketService().observe(request);
const resolution = resolveSource(request);
if (resolution.status === 'APPROVED') {
  const purpose: 'DISPLAY' = resolution.source.purposes[0];
  void purpose;
}
declare const observed: MarketServiceResult;
const noGrant: false = observed.grantsRuntimeAccess;
// @ts-expect-error No runtime capability exists.
observed.context;
// @ts-expect-error Registry policy is immutable.
source!.purposes.push('LIVE_SIGNAL_ANALYSIS');
// @ts-expect-error Market observations are immutable.
observed.observation!.timing.providerQuoteUpdatedAtMs = 123;
// @ts-expect-error A request cannot inject its own eligibility.
const forged: MarketServiceRequest = { sourceId: 'biquote', pair: 'EUR/USD', timeframe: '1', purpose: 'DISPLAY', eligible: true };
void [source, result, noGrant, forged];
