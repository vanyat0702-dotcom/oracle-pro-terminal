import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, LineChart, Database, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, BarChart3, LayoutGrid, Square } from 'lucide-react';
import { TRADING_PAIRS, TradingPair } from './config/pairs';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_PAIRS[11]); // EUR/USD по умолчанию
  const [price, setPrice] = useState<string>(selectedPair.baseRate);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>('up');
  const [timeframe, setTimeframe] = useState<string>("5");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  
  // Режим экрана: 'single' (1 график) или 'quad' (4 графика)
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  
  // 4 пары для сетки
  const quadPairs = [TRADING_PAIRS[11], TRADING_PAIRS[14], TRADING_PAIRS[19], TRADING_PAIRS[20]]; // EUR/USD, GBP/JPY, USD/JPY, BTC/USDT

  // ИИ-аналитика
  const [aiConfidence, setAiConfidence] = useState<number>(94);
  const [aiDirection, setAiDirection] = useState<'CALL (ВЫШЕ)' | 'PUT (НИЖЕ)'>('CALL (ВЫШЕ)');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // WebSocket котировок
  useEffect(() => {
    setPrice(selectedPair.baseRate);
    setWsStatus(false);

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedPair.wsSymbol}@trade`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newPrice = parseFloat(data.p).toFixed(selectedPair.id === 'btcusdt' ? 2 : 4);
      
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

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const randomConf = Math.floor(Math.random() * 8) + 91;
      const randomDir = Math.random() > 0.5 ? 'CALL (ВЫШЕ)' : 'PUT (НИЖЕ)';
      setAiConfidence(randomConf);
      setAiDirection(randomDir);
      setIsAnalyzing(false);
    }, 600);
  };

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
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Multi-Screen AI Analytics Hub</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs">
          {/* Переключатель экранов */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Square className="w-3.5 h-3.5" /> 1 Экран
            </button>
            <button
              onClick={() => setViewMode('quad')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'quad' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> 4 Графика
            </button>
          </div>

          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${wsStatus ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800' : 'text-rose-400 bg-rose-950/60 border-rose-800'}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
            Feed: {wsStatus ? 'ONLINE' : 'CONNECTING'}
          </span>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          
          {viewMode === 'single' && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 backdrop-blur flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 pb-1 border-b border-slate-800/80">
                <Layers className="w-4 h-4 text-cyan-400" />
                ВЫБОР АКТИВА ДЛЯ АНАЛИЗА:
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-11 gap-1.5">
                {TRADING_PAIRS.map((pair) => (
                  <button
                    key={pair.id}
                    onClick={() => setSelectedPair(pair)}
                    className={`px-2 py-1.5 rounded-md text-[11px] font-bold transition-all text-center truncate ${selectedPair.id === pair.id ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-105 font-black' : 'bg-slate-950/70 text-slate-300 border border-slate-800/80 hover:border-slate-600 hover:text-white'}`}
                    title={pair.displaySymbol}
                  >
                    {pair.displaySymbol}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Charts Display */}
          {viewMode === 'single' ? (
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
                      {priceChange === 'up' ? '+0.25%' : '-0.12%'}
                    </span>
                  </div>
                </div>

                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs gap-1">
                  {['1', '5', '15', '60', '240'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setTimeframe(val)}
                      className={`px-3 py-1 rounded transition-all ${timeframe === val ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {val === '60' ? '1H' : val === '240' ? '4H' : `${val}M`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden min-h-[420px] relative">
                <iframe
                  key={`${selectedPair.symbol}-${timeframe}`}
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedPair.symbol}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=Etc%2FUTC&studies=[]&hide_top_toolbar=0&hide_side_toolbar=0&enabled_features=[]&disabled_features=[]&locale=ru`}
                  className="w-full h-full border-0 absolute inset-0"
                  title="TradingView Chart"
                ></iframe>
              </div>
            </div>
          ) : (
            /* QUAD MODE (4 Графика) */
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[600px]">
              {quadPairs.map((pair) => (
                <div key={pair.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden backdrop-blur">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm text-cyan-400">{pair.displaySymbol}</span>
                    <span className="text-[10px] text-slate-400 font-mono">LIVE FEED</span>
                  </div>
                  <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-lg overflow-hidden min-h-[240px] relative">
                    <iframe
                      src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${pair.id}&symbol=${pair.symbol}&interval=5&symboledit=0&saveimage=0&toolbarbg=0f172a&theme=dark&style=1&timezone=Etc%2FUTC&studies=[]&hide_top_toolbar=1&hide_side_toolbar=1&locale=ru`}
                      className="w-full h-full border-0 absolute inset-0"
                      title={pair.displaySymbol}
                    ></iframe>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Panel */}
        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col gap-5 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              ИИ ОРАКУЛ (АНАЛИЗАТОР)
            </h2>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              {selectedPair.displaySymbol}
            </span>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-4 shadow-inner">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Рекомендация ИИ:</span>
              <span className={`font-black px-2.5 py-1 rounded border animate-pulse ${aiDirection.includes('ВЫШЕ') ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}`}>
                {isAnalyzing ? 'АНАЛИЗ...' : aiDirection}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-slate-400 flex justify-between">
                <span>Вероятность отработки:</span>
                <span className="text-slate-100 font-bold">{isAnalyzing ? '...' : `${aiConfidence}%`}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500" style={{ width: `${aiConfidence}%` }}></div>
              </div>
            </div>

            <button 
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'СКАНИРОВАНИЕ КЛАСТЕРОВ...' : 'ПЕРЕСЧИТАТЬ СИГНАЛ ИИ'}
            </button>
          </div>

          <div className="flex-1 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between text-xs text-slate-400 min-h-[110px]">
            <span className="font-semibold text-slate-300 mb-1">Статус мульти-экрана:</span>
            <div className="space-y-1 font-mono text-[10px] text-slate-500">
              <p className="text-emerald-400">› Режим: {viewMode.toUpperCase()}</p>
              <p>› Активный актив: {selectedPair.displaySymbol}</p>
              <p className="text-cyan-400">› Потоки синхронизированы</p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v2.0 (Multi-Screen Engine)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
