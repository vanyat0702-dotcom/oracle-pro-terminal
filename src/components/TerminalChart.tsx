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

    // Превращаем наши символы в стандартные тикеры TradingView / FXCM / Binance
    let tvSymbol = 'FXCM:EURUSD';
    const clean = symbol.replace('/', '').toUpperCase();

    if (clean.includes('BTC') || clean.includes('CRYPTO')) {
      tvSymbol = 'BINANCE:BTCUSDT';
    } else if (clean.includes('JPY')) {
      tvSymbol = `FXCM:${clean}`;
    } else if (clean.includes('USD') || clean.includes('EUR') || clean.includes('GBP') || clean.includes('AUD') || clean.includes('CAD') || clean.includes('NZD') || clean.includes('CHF')) {
      tvSymbol = `FXCM:${clean}`;
    }

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetId = `tradingview_${Math.random().toString(36).substring(2, 9)}`;
    const innerDiv = document.createElement('div');
    innerDiv.id = widgetId;
    innerDiv.style.height = '100%';
    innerDiv.style.width = '100%';
    widgetContainer.appendChild(innerDiv);

    containerRef.current.appendChild(widgetContainer);

    // Внедряем официальный скрипт виджета TradingView Advanced Real-Time Chart
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: interval === '1' ? '1' : interval === '5' ? '5' : interval === '15' ? '15' : '60',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'ru',
          toolbar_bg: '#030712',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: widgetId,
          background: '#030712',
          gridColor: '#1e293b',
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
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[480px] relative rounded-xl overflow-hidden bg-slate-950" 
    />
  );
};
