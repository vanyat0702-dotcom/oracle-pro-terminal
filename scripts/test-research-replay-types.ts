import { replayM1, replayHistoricalFiles } from '../core/research/replay.js';
import type { ReplayEvent, ReplayTimeframe, ReplayOptions } from '../core/research/replay.js';
import type { HistoricalInputCandle } from '../core/research/contracts.js';
declare const row: HistoricalInputCandle;
declare const event: ReplayEvent;
void replayM1([row], { dataKind: 'MOCK' });
void replayHistoricalFiles([{ path: 'local.json', expectedChecksum: '0'.repeat(64) }], { dataKind: 'MOCK', instrument: 'btcusdt', asOf: '2025-01-02T00:00:00Z' });
const tfs: ReplayTimeframe[] = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
const denied: false = event.grantsRuntimeAccess;
const notReady: 'NOT_READY' = event.readiness;
if (event.type === 'step') {
  const closed: false = event.completedM1.isOpen;
  void closed;
  // @ts-expect-error Incomplete intervals have no usable price.
  event.incompleteIntervals[0].close;
  // @ts-expect-error Immutable aggregates.
  event.completed[0].open = 1;
}
// @ts-expect-error Unsupported research TF.
const unsupported: ReplayTimeframe = 'W1';
// @ts-expect-error No granting option.
const grant: ReplayOptions = { dataKind: 'MOCK', grantsRuntimeAccess: true };
// @ts-expect-error BTC/USD is not BTC/USDT.
void replayHistoricalFiles([], { dataKind: 'MOCK', instrument: 'btcusd', asOf: '2025-01-02T00:00:00Z' });
void [tfs, denied, notReady, unsupported, grant];
