import type { HistoricalInputCandle, ResearchInstrumentId, ResearchPriceBasis } from './contracts.js';
export type ReplayTimeframe = 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';
export interface ReplayOptions { readonly dataKind: 'MOCK' | 'REAL' }
export interface ReplaySource {
  readonly instrument: ResearchInstrumentId; readonly sourceId: string; readonly sourceSymbol: string;
  readonly venue: string; readonly priceBasis: ResearchPriceBasis;
}
export interface ReplayAggregate extends ReplaySource {
  readonly timeframe: ReplayTimeframe; readonly timestamp: string; readonly closeTimestamp: string;
  readonly open: number; readonly high: number; readonly low: number; readonly close: number;
  readonly isOpen: false; readonly volume?: number;
}
export interface IncompleteReplayInterval {
  readonly timeframe: ReplayTimeframe; readonly timestamp: string; readonly closeTimestamp: string;
  readonly status: 'INCOMPLETE'; readonly observedMinutes: number; readonly expectedMinutes: number;
  readonly missingMinutes: number; readonly reason: 'BOUNDARY_OR_GAP' | 'MISSING_M1' | 'END_OF_INPUT';
}
interface ReplayBase extends ReplayOptions {
  readonly readiness: 'NOT_READY'; readonly grantsRuntimeAccess: false;
  readonly source: ReplaySource; readonly replayTimestamp: string;
  readonly incompleteIntervals: readonly IncompleteReplayInterval[];
}
export interface ReplayStep extends ReplayBase {
  readonly type: 'step'; readonly provisional: true;
  readonly completedM1: HistoricalInputCandle; readonly completed: readonly ReplayAggregate[];
  readonly detectedGaps: readonly Readonly<{ from: string; toExclusive: string; missingMinutes: number; classification: 'UNCLASSIFIED' }>[];
}
export interface ReplayEnd extends ReplayBase {
  readonly type: 'end'; readonly provisional: false; readonly candleCount: number;
  readonly completedCount: number; readonly incompleteCount: number; readonly missingMinutes: number;
}
export type ReplayEvent = ReplayStep | ReplayEnd;
export interface ReplayFile { readonly path: string; readonly expectedChecksum: string }
export interface ReplayFileOptions extends ReplayOptions { readonly instrument: ResearchInstrumentId; readonly asOf: string }
/** Throws a coded Error on invalid input. Steps remain provisional until end; D1 is UTC. */
export function replayM1(input: Iterable<HistoricalInputCandle> | AsyncIterable<HistoricalInputCandle>, options: ReplayOptions): AsyncGenerator<ReplayEvent, void, unknown>;
/** Bounded MVP-1A file validation; files must share instrument, kind, source and license. */
export function replayHistoricalFiles(files: Iterable<ReplayFile> | AsyncIterable<ReplayFile>, options: ReplayFileOptions): AsyncGenerator<ReplayEvent, void, unknown>;
