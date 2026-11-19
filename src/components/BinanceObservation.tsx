import React, { useEffect, useState } from 'react';
import type { BinanceObservation as Snapshot } from '../../core/market/binance.js';
import { readBinanceObservation, startBinancePolling } from './binanceObservationData';
import { MockBinanceObservation } from './MockBinanceObservation';
import { ObservationCandles } from './ObservationCandles';
const utc = (ms: number) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC');

export function BinanceObservation({ mode = 'LIVE' }: { mode?: 'LIVE' | 'MOCK' }) {
  return mode === 'MOCK' ? <MockBinanceObservation /> : <LiveBinanceObservation />;
}

function LiveBinanceObservation() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState('');
  const [running, setRunning] = useState(false), [visible, setVisible] = useState(!document.hidden);
  useEffect(() => { const visibility = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility); }, []);
  useEffect(() => {
    if (!running || !visible) { setSnapshot(null); return; }
    setError('');
    return startBinancePolling({ onData: data => { setSnapshot(data); setError(''); }, onError: message => { setSnapshot(null); setError(message); setRunning(false); } });
  }, [running, visible]);
  useEffect(() => {
    if (!snapshot) return;
    const timer = setInterval(() => {
      try {
        const current = readBinanceObservation({ success: true, diagnosticOnly: true, snapshot });
        if (current.quality.status !== snapshot.quality.status) setSnapshot(current);
      } catch { setSnapshot(null); setError('Ожидание актуальных закрытых M1. Предыдущие свечи скрыты.'); }
    }, 500);
    return () => clearInterval(timer);
  }, [snapshot]);
  const candles = snapshot?.candles ?? [], last = candles.at(-1);
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-200">
    <h1 className="text-xl font-bold text-cyan-300">Oracle Private Alpha · BTC/USDT Spot · M1</h1>
    <p className="my-3 text-amber-300">ALPHA-0 · NOT_READY · Только наблюдение. Нет сигналов, AI и runtime-допусков.</p>
    <p className="text-sm">Источник: Binance Spot · LAST · Только закрытые свечи · Polling 15 с</p>
    <p className="my-3 text-sm">Запускайте только после отдельного разрешения на реальный доступ и проверки применимых условий Binance.</p>
    <button className="rounded border border-cyan-700 px-4 py-2" onClick={() => { setSnapshot(null); setError(''); setRunning(v => !v); }}>
      {running ? 'Остановить' : 'Запустить наблюдение'}
    </button>
    <p role="status" className="my-3">{!visible ? 'Вкладка скрыта — запросы приостановлены' : running ? 'Наблюдение включено' : 'Наблюдение остановлено'} · Качество: {snapshot?.quality.status ?? 'нет актуальных данных'}</p>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {snapshot && last ? <>
      <p className="text-sm">Структура: {snapshot.quality.status} · Пропуски: {snapshot.quality.gaps} · Дубликаты: {snapshot.quality.duplicates}<br />
        Открытых свечей исключено: {snapshot.quality.excludedOpenCandles}<br />
        HTTP-заголовки получены: {utc(snapshot.timing.receivedAtMs)} · Проверено: {utc(snapshot.timing.checkedAtMs)}<br />
        Время последнего тика: UNKNOWN · Часы: локальный сервер, независимая синхронизация не подтверждена</p>
      <ObservationCandles candles={candles} />
    </> : <p className="my-6">Свечи не отображаются. Старые или выдуманные котировки не подставляются.</p>}
  </main>;
}
