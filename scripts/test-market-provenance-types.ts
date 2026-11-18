// Compile-only. No observations acquired, no runtime permissions issued.
import { createMarketService, getTrustedMarketService, inspectObservationProvenance } from '../core/market/service.js';
import type { MarketServiceResult, TrustedMarketService, ObservationProvenanceReport } from '../core/market/service.js';
import type { RuntimeContext } from '../core/runtimeGuard.js';
declare const dto: MarketServiceResult;
const trusted: Readonly<TrustedMarketService> = getTrustedMarketService();
const report: ObservationProvenanceReport = inspectObservationProvenance(trusted, dto.observation);
const noGrant: false = report.grantsRuntimeAccess;
if (report.registered) {
  const purpose: 'DISPLAY' = report.purpose;
  const sourceId: 'biquote' = report.sourceId;
  void [purpose, sourceId];
}
// @ts-expect-error An injectable service is not branded as the trusted instance.
const fake: TrustedMarketService = createMarketService();
// @ts-expect-error No trusted dependencies can be supplied by a caller.
getTrustedMarketService({ fetchImpl: fetch });
// @ts-expect-error No public registration operation exists.
trusted.register(dto.observation);
// @ts-expect-error Provenance is informational, never a runtime context.
const context: RuntimeContext = report;
// @ts-expect-error Origin cannot grant runtime access.
const positive: true = report.grantsRuntimeAccess;
// @ts-expect-error The origin report is immutable.
report.registered = true;
void [noGrant, fake, context, positive];
