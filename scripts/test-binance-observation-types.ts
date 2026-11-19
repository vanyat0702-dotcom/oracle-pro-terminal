import { createBinanceObservationProvider, normalizeBinance } from '../core/market/binance.js';
import type { BinanceObservation } from '../core/market/binance.js';
import { readBinanceObservation, startBinancePolling } from '../src/components/binanceObservationData.js';
declare const observation: BinanceObservation;
const denied: false = observation.grantsRuntimeAccess;
const notReady: 'NOT_READY' = observation.readiness;
const tick: null = observation.timing.providerQuoteUpdatedAtMs;
const closed: false = observation.candles[0].isOpen;
const volume: number = observation.candles[0].volume;
void normalizeBinance([], 1);
void readBinanceObservation({});
void startBinancePolling({ onData: () => {}, onError: () => {} });
// @ts-expect-error No client URL is accepted.
createBinanceObservationProvider({ url: 'https://evil' });
// @ts-expect-error No symbol or timeframe selection.
createBinanceObservationProvider().latest({ symbol: 'ETHUSDT' });
// @ts-expect-error Read-only candles.
observation.candles[0].volume = 1;
// @ts-expect-error Diagnostic results cannot authorize runtime access.
const granted: true = observation.grantsRuntimeAccess;
void [denied, notReady, tick, closed, volume, granted];
