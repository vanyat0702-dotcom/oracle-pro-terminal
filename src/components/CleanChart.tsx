import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

interface CleanChartProps {
  symbol: string;
  interval: string;
}

export const CleanChart: React.FC<CleanChartProps> = ({ symbol, interval }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Создаем локальный график на чистом Canvas без iframe и разрывов
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b',
      },
      rightPriceScale: {
        borderColor: '#1e293b',
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    candleSeriesRef.current = candlestickSeries;

    // Генерация слитного массива свечей (цена открытия строго равна закрытию предыдущей)
    const basePrice = symbol.includes('BTC') ? 75500 : 1.11900;
    const now = Math.floor(Date.now() / 1000);
    const step = parseInt(interval, 10) * 60;
    const initialData = [];

    let currentOpen = basePrice;
    for (let i = 50; i >= 0; i--) {
      const time = (now - i * step) as any;
      const variation = (Math.random() - 0.49) * (symbol.includes('BTC') ? 50 : 0.0003);
      const close = currentOpen + variation;
      const high = Math.max(currentOpen, close) + Math.random() * (symbol.includes('BTC') ? 20 : 0.0001);
      const low = Math.min(currentOpen, close) - Math.random() * (symbol.includes('BTC') ? 20 : 0.0001);

      initialData.push({
        time,
        open: Number(currentOpen.toFixed(5)),
        high: Number(high.toFixed(5)),
        low: Number(low.toFixed(5)),
        close: Number(close.toFixed(5)),
      });

      currentOpen = close;
    }

    candlestickSeries.setData(initialData);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, interval]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full min-h-[480px] relative rounded-xl overflow-hidden" 
    />
  );
};
