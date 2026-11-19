import type { DisplayCandle } from './ObservationCandles';
// UI fixture only. No imports from providers, Market Service, Eligibility, Core or AI.
export const MOCK_LABEL = 'MOCK / НЕ РЕАЛЬНЫЕ КОТИРОВКИ';
export interface MockPreviewFrame {
  readonly kind: 'MOCK_PREVIEW'; readonly source: 'OFFLINE_UI_FIXTURE';
  readonly instrument: 'BTCUSDT_MOCK'; readonly quality: 'MOCK_NOT_MARKET_DATA';
  readonly readiness: 'NOT_READY'; readonly grantsRuntimeAccess: false;
  readonly frame: number; readonly candles: readonly Readonly<DisplayCandle>[];
}
const start = Date.parse('2025-01-07T12:00:00Z');
const closes = [102, 104, 103, 100, 98, 101, 105, 107, 106, 103, 104, 108];
const candles = Object.freeze(closes.map((close, i) => {
  const open = i ? closes[i - 1] : 100, openTimeMs = start + i * 60000;
  return Object.freeze({ time: openTimeMs / 1000, openTimeMs, open, high: Math.max(open, close) + 2,
    low: Math.min(open, close) - 2, close, volume: (i + 1) / 10 });
}));
export function mockPreviewFrame(frame: number): MockPreviewFrame {
  if (!Number.isInteger(frame) || frame < 0 || frame > 2) throw Error('INVALID_MOCK_FRAME');
  return Object.freeze({ kind: 'MOCK_PREVIEW', source: 'OFFLINE_UI_FIXTURE', instrument: 'BTCUSDT_MOCK',
    quality: 'MOCK_NOT_MARKET_DATA', readiness: 'NOT_READY', grantsRuntimeAccess: false,
    frame, candles: Object.freeze(candles.slice(0, (frame + 1) * 4)) });
}
/** Exactly three frames; no polling/network, clocks or infinite animation. */
export function startMockPreview({ onFrame, onComplete, schedule = setTimeout, cancel = clearTimeout }: {
  onFrame: (frame: MockPreviewFrame) => void; onComplete: () => void;
  schedule?: typeof setTimeout; cancel?: typeof clearTimeout;
}): () => void {
  let stopped = false, index = 0, timer: ReturnType<typeof setTimeout> | undefined;
  function next() {
    if (stopped) return;
    onFrame(mockPreviewFrame(index));
    if (++index === 3) { stopped = true; onComplete(); }
    else timer = schedule(next, 1000);
  }
  next();
  return () => { stopped = true; cancel(timer); };
}
