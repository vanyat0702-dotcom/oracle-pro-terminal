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

    const isBtc = symbol.includes('BTC') || symbol.includes('Crypto');
    const basePrice = isBtc ? 75500 : 1.11900;
    const now = Math.floor(Date.now() / 1000);
    const step = parseInt(interval, 10) * 60;
    const initialData = [];

    let currentOpen = basePrice;
    for (let i = 60; i >= 0; i--) {
      const time = (now - i * step) as any;
      const variation = (Math.random() - 0.48) * (isBtc ? 40 : 0.0002);
      const close = currentOpen + variation;
      const high = Math.max(currentOpen, close) + Math.random() * (isBtc ? 15 : 0.0001);
      const low = Math.min(currentOpen, close) - Math.random() * (isBtc ? 15 : 0.0001);

      initialData.push({
        time,
        open: Number(currentOpen.toFixed(isBtc ? 2 : 5)),
        high: Number(high.toFixed(isBtc ? 2 : 5)),
        low: Number(low.toFixed(isBtc ? 2 : 5)),
        close: Number(close.toFixed(isBtc ? 2 : 5)),
      });
      currentOpen = close;
    }

    candlestickSeries.setData(initialData);

    let ws: WebSocket | null = null;
    let timer: any = null;

    if (isBtc) {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.k) {
          const kline = message.k;
          candlestickSeries.update({
            time: Math.floor(kline.t / 1000) as any,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
          });
        }
      };
    } else {
      timer = setInterval(() => {
        const currentData = candlestickSeries.data();
        if (currentData.length > 0) {
          const lastCandle: any = currentData[currentData.length - 1];
          const tickVariation = (Math.random() - 0.49) * 0.0001;
          const newClose = Number((lastCandle.close + tickVariation).toFixed(5));
          const newHigh = Math.max(lastCandle.high, newClose);
          const newLow = Math.min(lastCandle.low, newClose);

          candlestickSeries.update({
            time: lastCandle.time,
            open: lastCandle.open,
            high: newHigh,
            low: newLow,
            close: newClose,
          });
        }
      }, 1000);
    }

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
      if (ws) ws.close();
      if (timer) clearInterval(timer);
      chart.remove();
    };
  }, [symbol, interval]);

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full h-full min-h-[480px] relative rounded-xl overflow-hidden bg-slate-950" 
    />
  );
};
