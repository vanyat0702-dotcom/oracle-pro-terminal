import React, { useEffect, useState } from 'react';
import type { BinanceObservation as Snapshot } from '../../core/market/binance.js';
import { readBinanceObservation, startBinancePolling } from './binanceObservationData';
const utc = (ms: number) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC');

export function BinanceObservation() {
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
  const low = Math.min(...candles.map(c => c.low)), high = Math.max(...candles.map(c => c.high));
  const pad = Math.max((high - low) * 0.08, high * 0.000001);
  const y = (p: number) => 250 - (p - low + pad) / (high - low + pad * 2) * 220;
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
      <p className="my-3 font-mono text-sm">Последняя M1: {utc(last.openTimeMs)} — {utc(last.openTimeMs + 60000)}<br />
        O {last.open} · H {last.high} · L {last.low} · C {last.close} · V {last.volume} BTC</p>
      <svg viewBox="0 0 960 290" role="img" aria-label="Закрытые реальные BTCUSDT M1, UTC" className="w-full max-w-6xl">
        {candles.map((c, i) => { const x = 30 + (i + 0.5) * 900 / candles.length, color = c.close >= c.open ? '#34d399' : '#fb7185';
          return <g key={c.time}><title>{utc(c.openTimeMs)} · O {c.open} H {c.high} L {c.low} C {c.close} V {c.volume}</title>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} />
            <rect x={x - 2} y={Math.min(y(c.open), y(c.close))} width="4" height={Math.max(1, Math.abs(y(c.open) - y(c.close)))} fill={color} />
          </g>; })}
        <text x="30" y="280" fill="#94a3b8" fontSize="12">{utc(candles[0].openTimeMs)}</text>
        <text x="930" y="280" textAnchor="end" fill="#94a3b8" fontSize="12">{utc(last.openTimeMs)}</text>
      </svg>
      <details><summary>OHLCV всех закрытых M1 ({candles.length})</summary><div className="max-h-64 overflow-auto"><table className="text-xs font-mono"><thead><tr><th>UTC</th><th>O</th><th>H</th><th>L</th><th>C</th><th>V BTC</th></tr></thead>
        <tbody>{candles.map(c => <tr key={c.time}><td>{utc(c.openTimeMs)}</td><td>{c.open}</td><td>{c.high}</td><td>{c.low}</td><td>{c.close}</td><td>{c.volume}</td></tr>)}</tbody></table></div></details>
    </> : <p className="my-6">Свечи не отображаются. Старые или выдуманные котировки не подставляются.</p>}
  </main>;
}
