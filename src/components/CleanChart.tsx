import React from 'react';

interface CleanChartProps {
  symbol: string;
  interval: string;
  timezone: string;
  lang: string;
}

export const CleanChart: React.FC<CleanChartProps> = ({ symbol, interval, timezone, lang }) => {
  // Очистка и приведение символа к надежному шлюзу OANDA (тик-в-тик с FXCM / Intrade Bar)
  const cleanSymbol = symbol.includes('BTC') ? 'BINANCE:BTCUSDT' : `OANDA:${symbol.replace('/', '')}`;

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 rounded-xl">
      <iframe
        key={`clean-chart-${cleanSymbol}-${interval}-${timezone}`}
        src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_clean&symbol=${cleanSymbol}&interval=${interval}&hidetoptoolbar=0&saveimage=0&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&withdateranges=0&hideideas=1&studies[]=RSI@tv-basicstudies&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
        title="TradingView Clean Chart"
        style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
      />
    </div>
  );
};
