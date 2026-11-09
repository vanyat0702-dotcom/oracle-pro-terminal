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
        background: { type: ColorType.Solid, color: '#030712' },
        textColor: '#94a3b8',
      },
      watermark: {
        visible: false,
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
        rightOffset: 5,
        barSpacing: 10,
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

    let ws: WebSocket | null = null;
    let timer: any = null;
    let isMounted = true;

    const isBtc = symbol.includes('BTC') || symbol.includes('Crypto');

    const loadChartData = async () => {
      if (isBtc) {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}m&limit=200`);
          const data = await res.json();
          
          if (!isMounted) return;

          const formattedData = data.map((k: any) => ({
            time: Math.floor(k[0] / 1000) as any,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
          }));

          candlestickSeries.setData(formattedData);
          chart.timeScale().fitContent();

          ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.k && isMounted) {
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
        } catch (e) {
          console.error(e);
        }
      } else {
        const isJpy = symbol.includes('JPY');
        const basePrice = isJpy ? 152.500 : 1.11500;
        const stepSize = isJpy ? 0.025 : 0.00025;
        const stepSec = parseInt(interval, 10) * 60;
        
        const nowSec = Math.floor(Date.now() / 1000);
        const totalBars = 150;
        const initialData = [];
        
        let currOpen = basePrice;
        const startTime = nowSec - (totalBars * stepSec);

        for (let i = 0; i < totalBars; i++) {
          const time = (startTime + (i * stepSec)) as any;
          const change = (Math.random() - 0.49) * stepSize;
          const close = currOpen + change;
          const high = Math.max(currOpen, close) + Math.random() * (stepSize * 0.4);
          const low = Math.min(currOpen, close) - Math.random() * (stepSize * 0.4);

          initialData.push({
            time,
            open: Number(currOpen.toFixed(isJpy ? 3 : 5)),
            high: Number(high.toFixed(isJpy ? 3 : 5)),
            low: Number(low.toFixed(isJpy ? 3 : 5)),
            close: Number(close.toFixed(isJpy ? 3 : 5)),
          });
          currOpen = close;
        }

        if (isMounted) {
          candlestickSeries.setData(initialData);
          chart.timeScale().fitContent();

          timer = setInterval(() => {
            const currentData = candlestickSeries.data();
            if (currentData.length > 0 && isMounted) {
              const last: any = currentData[currentData.length - 1];
              const tickChange = (Math.random() - 0.49) * (stepSize * 0.15);
              const newClose = Number((last.close + tickChange).toFixed(isJpy ? 3 : 5));
              const newHigh = Math.max(last.high, newClose);
              const newLow = Math.min(last.low, newClose);

              candlestickSeries.update({
                time: last.time,
                open: last.open,
                high: newHigh,
                low: newLow,
                close: newClose,
              });
            }
          }, 1000);
        }
      }
    };

    loadChartData();

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
      isMounted = false;
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
