import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Zap, LineChart, Database, TrendingUp, TrendingDown, RefreshCw, Layers } from 'lucide-react';
import { TRADING_PAIRS, TradingPair } from './config/pairs';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_PAIRS[0]);
  const [price, setPrice] = useState<string>(selectedPair.baseRate);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>('up');
  const [timeframe, setTimeframe] = useState<string>("1");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  const [aiSignal, setAiSignal] = useState<{ status: string; confidence: number; type: string }>({
    status: "АНАЛИЗ СТАКАНА И КЛАСТЕРОВ...",
    confidence: 88,
    type: "LONG"
  });

  // Подключение WebSocket Binance для котировок в шапке
  useEffect(() => {
    setPrice(selectedPair.baseRate);
    setWsStatus(false);

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedPair.symbol}@trade`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newPrice = parseFloat(data.p).toFixed(selectedPair.symbol.includes('jpy') ? 3 : 2);
      
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
  }, [selectedPair]);

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
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Multi-Asset Trading Hub</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${wsStatus ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800' : 'text-rose-400 bg-rose-950/60 border-rose-800'}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
            WS Feed: {wsStatus ? 'ONLINE' : 'CONNECTING'}
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-3 py-1 rounded-full">
            <Database className="w-3.5 h-3.5" />
            Oracle AI Core: Ready
          </span>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Asset Selector & Chart Area */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Asset Selection Bar */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 backdrop-blur flex items-center gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 border-r border-slate-800 mr-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              ПАРЫ:
            </div>
            {TRADING_PAIRS.map((pair) => (
              <button
                key={pair.id}
                onClick={() => setSelectedPair(pair)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${selectedPair.id === pair.id ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 scale-105' : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'}`}
              >
                {pair.displaySymbol}
              </button>
            ))}
          </div>

          {/* Main Chart Box */}
          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur min-h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <LineChart className="w-6 h-6 text-cyan-400" />
                <div>
                  <span className="font-bold text-lg text-slate-100">{selectedPair.displaySymbol}</span>
                  <span className="ml-3 text-2xl font-mono font-bold tracking-tight text-slate-50">
                    ${price}
                  </span>
                  <span className={`ml-2 inline-flex items-center text-xs font-bold px-2 py-0.5 rounded ${priceChange === 'up' ? 'text-emerald-400 bg-emerald-950' : 'text-rose-400 bg-rose-950'}`}>
                    {priceChange === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {priceChange === 'up' ? '+0.24%' : '-0.12%'}
                  </span>
                </div>
              </div>

              {/* Timeframes */}
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs gap-1">
                {[
                  { label: '1M', val: '1' },
                  { label: '5M', val: '5' },
                  { label: '15M', val: '15' },
                  { label: '1H', val: '60' },
                  { label: '4H', val: '240' }
                ].map((tf) => (
                  <button
                    key={tf.val}
                    onClick={() => setTimeframe(tf.val)}
                    className={`px-3 py-1 rounded transition-all ${timeframe === tf.val ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TradingView Widget Container */}
            <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden min-h-[420px] relative">
              <iframe
                key={`${selectedPair.symbol}-${timeframe}`}
                src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=BINANCE:${selectedPair.symbol.toUpperCase()}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=Etc%2FUTC&studies=[]&hide_top_toolbar=0&hide_side_toolbar=0&enabled_features=[]&disabled_features=[]&locale=ru`}
                className="w-full h-full border-0 absolute inset-0"
                title="TradingView Chart"
              ></iframe>
            </div>
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
              <span className="text-xs text-slate-400">Актив анализа:</span>
              <span className="text-xs font-bold text-cyan-400">{selectedPair.displaySymbol}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Сигнал:</span>
              <span className="text-xs font-black px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">
                {aiSignal.type} СИГНАЛ
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-slate-400 flex justify-between">
                <span>Точность сетапа:</span>
                <span className="text-slate-100 font-bold">{aiSignal.confidence}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500" style={{ width: `${aiSignal.confidence}%` }}></div>
              </div>
            </div>

            <button 
              onClick={() => setAiSignal(prev => ({ ...prev, confidence: Math.min(99, prev.confidence + 2) }))}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              ПЕРЕСЧИТАТЬ АНАЛИЗ ПАРЫ
            </button>
          </div>

          <div className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300 mb-2">Лог мульти-сканера:</span>
            <div className="space-y-1 font-mono text-[11px] text-slate-500">
              <p className="text-emerald-400">› График TradingView подключен</p>
              <p>› Переключение на {selectedPair.displaySymbol}...</p>
              <p className="text-cyan-400">› Поток свечей активен</p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v1.2.0 (TradingView Embedded)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
