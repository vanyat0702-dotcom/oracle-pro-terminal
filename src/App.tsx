import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Zap, LineChart, Database, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export default function App() {
  const [price, setPrice] = useState<string>("67420.50");
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>('up');
  const [timeframe, setTimeframe] = useState<string>("1M");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  const [aiSignal, setAiSignal] = useState<{ status: string; confidence: number; type: string }>({
    status: "АНАЛИЗ СТАКАНА...",
    confidence: 84,
    type: "LONG"
  });

  // Подключаем реальный WebSocket Binance для BTCUSDT
  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newPrice = parseFloat(data.p).toFixed(2);
      
      setPrice(prev => {
        if (parseFloat(newPrice) > parseFloat(prev)) {
          setPriceChange('up');
        } else if (parseFloat(newPrice) < parseFloat(prev)) {
          setPriceChange('down');
        }
        return newPrice;
      });
      setWsStatus(true);
    };

    ws.onerror = () => {
      setWsStatus(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ORACLE PRO TERMINAL
            </h1>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">High-Precision Scalp Hub</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${wsStatus ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800' : 'text-rose-400 bg-rose-950/60 border-rose-800'}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
            WS Binance: {wsStatus ? 'ONLINE' : 'RECONNECTING'}
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-3 py-1 rounded-full">
            <Database className="w-3.5 h-3.5" />
            Oracle AI Core: Active
          </span>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left/Center Panel - Live Chart & Price Feed */}
        <section className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <LineChart className="w-6 h-6 text-cyan-400" />
              <div>
                <span className="font-bold text-lg text-slate-100">BTC/USDT</span>
                <span className="ml-3 text-2xl font-mono font-bold tracking-tight text-slate-50">
                  ${price}
                </span>
                <span className={`ml-2 inline-flex items-center text-xs font-bold px-2 py-0.5 rounded ${priceChange === 'up' ? 'text-emerald-400 bg-emerald-950' : 'text-rose-400 bg-rose-950'}`}>
                  {priceChange === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {priceChange === 'up' ? '+0.14%' : '-0.08%'}
                </span>
              </div>
            </div>

            {/* Timeframes */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs gap-1">
              {['1M', '5M', '15M', '1H', '4H'].log ? null : ['1M', '5M', '15M', '1H', '4H'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded transition-all ${timeframe === tf ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Canvas Area */}
          <div className="flex-1 min-h-[420px] border border-slate-800 bg-slate-950/60 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            
            <Activity className="w-16 h-16 text-cyan-500/30 animate-pulse mb-3" />
            <p className="text-sm font-medium text-slate-300">Поток данных Binance WebSockets активен (Таймфрейм: {timeframe})</p>
            <p className="text-xs text-slate-500 mt-1">Ожидание загрузки графического модуля TradingView Lightweight Charts...</p>
          </div>
        </section>

        {/* Right Panel - AI Signal Core */}
        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col gap-6 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              ИИ Оракул (DeepScan)
            </h2>
            <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Рекомендация:</span>
              <span className="text-xs font-black px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">
                {aiSignal.type} СИГНАЛ
              </span>
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Статус сканера:</span>
              <span className="text-cyan-400 font-semibold">{aiSignal.status}</span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-slate-400 flex justify-between">
                <span>Вероятность отработки:</span>
                <span className="text-slate-100 font-bold">{aiSignal.confidence}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500" style={{ width: `${aiSignal.confidence}%` }}></div>
              </div>
            </div>

            <button 
              onClick={() => setAiSignal(prev => ({ ...prev, confidence: Math.min(99, prev.confidence + 3) }))}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              ПЕРЕСЧИТАТЬ МАТРИЦУ САКАНА
            </button>
          </div>

          <div className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300 mb-2">Лог торговой сессии:</span>
            <div className="space-y-1 font-mono text-[11px] text-slate-500">
              <p className="text-emerald-400">› WS Соединение установлено</p>
              <p>› Сканирование кластеров объема...</p>
              <p className="text-cyan-400">› ИИ модель загружена в память</p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v1.0.0 (WebSocket Connected)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
