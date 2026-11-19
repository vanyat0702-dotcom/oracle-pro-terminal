import React from 'react';
export interface DisplayCandle {
  readonly time: number; readonly openTimeMs: number;
  readonly open: number; readonly high: number; readonly low: number; readonly close: number; readonly volume: number;
}
const utc = (ms: number) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC');
/** Presentation only; this component cannot acquire data or grant market trust. */
export function ObservationCandles({ candles, mock = false }: { candles: readonly DisplayCandle[]; mock?: boolean }) {
  const last = candles.at(-1);
  if (!last) return <p className="my-6">Свечи не отображаются.</p>;
  const low = Math.min(...candles.map(c => c.low)), high = Math.max(...candles.map(c => c.high));
  const pad = Math.max((high - low) * 0.08, high * 0.000001);
  const y = (p: number) => 250 - (p - low + pad) / (high - low + pad * 2) * 220;
  return <>
    <p className="my-3 font-mono text-sm">{mock ? 'MOCK M1' : 'Последняя M1'}: {utc(last.openTimeMs)} — {utc(last.openTimeMs + 60000)}<br />
      O {last.open} · H {last.high} · L {last.low} · C {last.close} · V {last.volume} BTC</p>
    <svg viewBox="0 0 960 290" role="img" aria-label={mock ? 'MOCK / НЕ РЕАЛЬНЫЕ КОТИРОВКИ · BTCUSDT M1 UTC' : 'Закрытые реальные BTCUSDT M1, UTC'} className="w-full max-w-6xl">
      {mock && <text x="480" y="20" textAnchor="middle" fill="#fbbf24" fontSize="15">MOCK / НЕ РЕАЛЬНЫЕ КОТИРОВКИ</text>}
      {candles.map((c, i) => { const x = 30 + (i + 0.5) * 900 / candles.length, color = c.close >= c.open ? '#34d399' : '#fb7185';
        return <g key={c.time}><title>{mock ? 'MOCK · ' : ''}{utc(c.openTimeMs)} · O {c.open} H {c.high} L {c.low} C {c.close} V {c.volume}</title>
          <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} />
          <rect x={x - 2} y={Math.min(y(c.open), y(c.close))} width="4" height={Math.max(1, Math.abs(y(c.open) - y(c.close)))} fill={color} />
        </g>; })}
      <text x="30" y="280" fill="#94a3b8" fontSize="12">{utc(candles[0].openTimeMs)}</text>
      <text x="930" y="280" textAnchor="end" fill="#94a3b8" fontSize="12">{utc(last.openTimeMs)}</text>
    </svg>
    <details><summary>{mock ? 'MOCK OHLCV' : 'OHLCV'} всех закрытых M1 ({candles.length})</summary><div className="max-h-64 overflow-auto"><table className="text-xs font-mono"><thead><tr><th>UTC</th><th>O</th><th>H</th><th>L</th><th>C</th><th>V BTC</th></tr></thead>
      <tbody>{candles.map(c => <tr key={c.time}><td>{utc(c.openTimeMs)}</td><td>{c.open}</td><td>{c.high}</td><td>{c.low}</td><td>{c.close}</td><td>{c.volume}</td></tr>)}</tbody></table></div></details>
  </>;
}
