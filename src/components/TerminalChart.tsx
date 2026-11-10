import React, { useEffect, useRef } from 'react';

interface TerminalChartProps {
  symbol: string;
  interval: string;
}

export const TerminalChart: React.FC<TerminalChartProps> = ({ symbol, interval }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    // Форматируем символ под стандарты TradingView Widget
    let cleanSymbol = symbol.replace('/', '').toUpperCase();
    let tvSymbol = cleanSymbol;

    if (cleanSymbol.includes('BTC') || cleanSymbol.includes('CRYPTO')) {
      tvSymbol = 'BINANCE:BTCUSDT';
    } else {
      // Для всех Форекс пар передаем чистое имя (EURUSD, GBPUSD и т.д.)
      tvSymbol = `FX:${cleanSymbol}`;
    }

    // Приводим таймфреймы под TradingView
    let tvInterval = '1';
    if (interval === '5') tvInterval = '5';
    else if (interval === '15') tvInterval = '15';
    else if (interval === '60') tvInterval = '60';
    else if (interval === '240') tvInterval = '240';

    const widgetId = `tv_chart_${Math.random().toString(36).substring(2, 9)}`;
    const widgetDiv = document.createElement('div');
    widgetDiv.id = widgetId;
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      if ((window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: tvInterval,
          timezone: 'Europe/Moscow',
          theme: 'dark',
          style: '1',
          locale: 'ru',
          toolbar_bg: '#030712',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: widgetId,
          backgroundColor: '#030712',
          gridColor: 'rgba(30, 41, 59, 0.5)',
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval]);

  return (
    <>
      <style>{`
        #tv-attr-logo {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `}</style>
      <div 
        ref={containerRef} 
        className="w-full h-full min-h-[500px] relative rounded-xl overflow-hidden bg-slate-950" 
      />
    </>
  );
};
