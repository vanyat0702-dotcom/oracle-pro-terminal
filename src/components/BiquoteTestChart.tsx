import React, { useEffect, useState } from 'react';
import { ChartSnapshot, localChartAllowed, readChartSnapshot, startChartPolling } from './mdeChartData';

const utc = (seconds: number) => new Date(seconds * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');

export function BiquoteTestChart() {
  const [snapshot, setSnapshot] = useState<ChartSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const allowed = localChartAllowed(import.meta.env.DEV, window.location.hostname);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!allowed || !running || !visible) { setSnapshot(null); setLoading(false); return; }
    setError('');
    return startChartPolling({
      onData: setSnapshot, onLoading: setLoading,
      onError: message => { setSnapshot(null); setError(message); setRunning(false); }
    });
  }, [allowed, running, visible, attempt]);
  useEffect(() => {
    if (!snapshot) return;
    const expire = setInterval(() => {
      try { readChartSnapshot({ success: true, diagnosticOnly: true, snapshot: { ...snapshot, pair: 'EUR/USD', timeframe: '1' } }); }
      catch { setSnapshot(null); setError('Данные MDE устарели. Свечи скрыты.'); setRunning(false); }
    }, 1000);
    return () => clearInterval(expire);
  }, [snapshot]);

  if (!allowed) return null;
  const candles = snapshot?.candles ?? [];
  const last = candles.at(-1);
  const low = Math.min(...candles.map(c => c.low));
  const high = Math.max(...candles.map(c => c.high));
  const pad = Math.max((high - low) * 0.08, 0.00001);
  const y = (price: number) => 270 - (price - low + pad) / (high - low + pad * 2) * 240;
  const x = (index: number) => 60 + (index + 0.5) * 840 / candles.length;
  const width = Math.min(14, 840 / candles.length * 0.65);
  return <section className="mt-3 rounded-xl border border-cyan-900 bg-slate-950 p-4" aria-label="Тестовый график Biquote EURUSD M1">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-bold text-cyan-300">Biquote · EURUSD · M1 · TEST</h3>
        <p className="text-xs text-amber-300">Только диагностика. VALID не означает пригодность для торговли.</p></div>
      <button type="button" className="rounded border border-slate-600 px-3 py-1 text-sm"
        onClick={() => { if (running) { setRunning(false); setSnapshot(null); } else { setRunning(true); setAttempt(a => a + 1); } }}>
        {running ? 'Приостановить' : 'Повторить / запустить'}
      </button>
    </div>
    <div role="status" className="mt-2 text-xs text-slate-300">
      Источник: Biquote · Качество: {snapshot ? 'VALID' : error ? 'REJECTED / НЕДОСТУПНО' : 'нет данных'} ·
      {!visible ? ' вкладка скрыта, запросы приостановлены' : loading ? ' обновление…' : running ? ' обновление каждые 15 с' : ' обновление остановлено'}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {!last && !error && <p className="py-8 text-sm text-slate-400">{loading ? 'Загрузка реальных свечей…' : 'Свечи не отображаются.'}</p>}
    {last && <>
      <p className="mt-2 text-xs font-mono text-slate-300">Последняя свеча: {utc(last.time)} · {last.isOpen ? 'ОТКРЫТА (незавершённая)' : 'ЗАКРЫТА'}<br />
        O {last.open.toFixed(5)} · H {last.high.toFixed(5)} · L {last.low.toFixed(5)} · C {last.close.toFixed(5)}</p>
      <svg viewBox="0 0 960 310" className="mt-2 w-full min-h-[220px]" role="img" aria-label="Реальные OHLC-свечи EURUSD M1, слева направо по UTC">
        {[0, 1, 2, 3, 4].map(i => {
          const price = low + (high - low) * i / 4;
          return <g key={i}><line x1="55" x2="905" y1={y(price)} y2={y(price)} stroke="#1e293b" />
            <text x="910" y={y(price) + 4} fill="#94a3b8" fontSize="11">{price.toFixed(5)}</text></g>;
        })}
        {candles.map((c, i) => {
          const color = c.close >= c.open ? '#34d399' : '#fb7185';
          return <g key={c.time} data-candle-time={c.time} data-open={c.isOpen}>
            <title>{utc(c.time)} · {c.isOpen ? 'ОТКРЫТА' : 'ЗАКРЫТА'} · O {c.open} H {c.high} L {c.low} C {c.close}</title>
            <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} />
            <rect x={x(i) - width / 2} y={Math.min(y(c.open), y(c.close))} width={width}
              height={Math.max(1, Math.abs(y(c.open) - y(c.close)))} fill={c.isOpen ? 'none' : color}
              stroke={c.isOpen ? '#fbbf24' : color} strokeWidth={c.isOpen ? 2 : 1} />
          </g>;
        })}
        {[0, Math.floor((candles.length - 1) / 2), candles.length - 1].map((i, tick) => <text key={tick}
          x={x(i)} y="300" textAnchor="middle" fill="#94a3b8" fontSize="11">{utc(candles[i].time).slice(11, 16)} UTC</text>)}
      </svg>
      <p className="text-xs text-slate-400">{candles.length} свечей · Открытая свеча: контур янтарного цвета · Время по UTC</p>
    </>}
  </section>;
}
