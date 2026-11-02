import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

export default function CleanChart({ pairSymbol = 'EURUSD' }: { pairSymbol?: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Создаем чистый график в стиле терминала
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' }, // Темный фон под стать сайту
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
    });

    // Добавляем серию японских свечей
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',       // Зеленая свеча (рост)
      downColor: '#f43f5e',     // Красная свеча (падение)
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    // Пример загрузки базовых исторических данных (сюда можно подключить ваш WebSocket-поток)
    candlestickSeries.setData([
      { time: 1730000000, open: 1.0820, high: 1.0850, low: 1.0810, close: 1.0840 },
      { time: 1730000300, open: 1.0840, high: 1.0860, low: 1.0835, close: 1.0830 },
      { time: 1730000600, open: 1.0830, high: 1.0845, low: 1.0815, close: 1.0825 },
    ]);

    // Адаптация под размер экрана
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      };
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [pairSymbol]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-800">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
