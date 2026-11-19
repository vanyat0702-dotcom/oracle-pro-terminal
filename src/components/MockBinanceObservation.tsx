import React, { useEffect, useState } from 'react';
import { ObservationCandles } from './ObservationCandles';
import { MOCK_LABEL, mockPreviewFrame, startMockPreview, type MockPreviewFrame } from './binanceMockPreview';
export function MockBinanceObservation() {
  const [frame, setFrame] = useState<MockPreviewFrame | null>(() => mockPreviewFrame(0));
  const [running, setRunning] = useState(false), [message, setMessage] = useState('MOCK-показ остановлен'), [error, setError] = useState('');
  useEffect(() => {
    if (!running) return;
    return startMockPreview({ onFrame: setFrame, onComplete: () => { setRunning(false); setMessage('MOCK-показ завершён: 12 искусственных свечей'); } });
  }, [running]);
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-200">
    <div className="sticky top-0 z-10 rounded border-2 border-amber-400 bg-slate-950 p-4 text-xl font-bold text-amber-300" role="note">{MOCK_LABEL}</div>
    <h1 className="mt-5 text-xl font-bold text-cyan-300">Oracle Private Alpha · BTC/USDT M1 · OFFLINE PREVIEW</h1>
    <p className="my-3">Источник: OFFLINE_UI_FIXTURE · Качество: MOCK_NOT_MARKET_DATA · NOT_READY</p>
    <p className="my-3">Фиксированная искусственная последовательность: 4 → 8 → 12 свечей, по одному шагу в секунду. Это проверка интерфейса, не рынка.</p>
    <p className="my-3 text-amber-200">Binance не вызывается. HTTP/polling отключены. Допусков, AI, сигналов и результатов сделок нет.</p>
    <div className="flex flex-wrap gap-3">
      <button className="rounded border border-cyan-600 px-4 py-2" disabled={running} onClick={() => { setError(''); setFrame(mockPreviewFrame(0)); setMessage('MOCK-показ выполняется'); setRunning(true); }}>Запустить MOCK-показ</button>
      <button className="rounded border border-slate-500 px-4 py-2" disabled={!running} onClick={() => { setRunning(false); setFrame(null); setMessage('MOCK-показ остановлен'); }}>Остановить MOCK</button>
      <button className="rounded border border-slate-500 px-4 py-2" disabled={running} onClick={() => { setError(''); setFrame(mockPreviewFrame(0)); setMessage('MOCK сброшен: первые 4 свечи'); }}>Сбросить MOCK</button>
      <button className="rounded border border-rose-600 px-4 py-2" onClick={() => { setRunning(false); setFrame(null); setError('MOCK_ERROR: искусственная ошибка интерфейса. Свечи скрыты.'); setMessage('MOCK-показ остановлен'); }}>Смоделировать ошибку</button>
    </div>
    <p role="status" className="my-3">{message} · Кадр: {frame ? frame.frame + 1 : 'нет'} · Свечей: {frame?.candles.length ?? 0}</p>
    {error && <p role="alert" className="my-3 text-rose-300">{error}</p>}
    {frame ? <ObservationCandles candles={frame.candles} mock /> : <p>MOCK-свечи скрыты.</p>}
    <p className="mt-5 text-sm">Время свечей — фиксированное тестовое UTC. Время получения от рынка и свежесть тика: неприменимы.</p>
    <p className="mt-3 text-sm">MVP-2C: BLOCKED_PENDING_JURISDICTION_AND_PERMISSION · ALPHA-0 LIVE: NOT_READY · ALPHA-1: NOT_READY</p>
  </main>;
}
