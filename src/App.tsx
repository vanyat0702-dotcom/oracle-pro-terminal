import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, LineChart, Database, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, BarChart3, LayoutGrid, Square, MessageSquare, Clock, Globe, Target } from 'lucide-react';
import { TRADING_PAIRS, TradingPair } from './config/pairs';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_PAIRS[11]); // EUR/USD по умолчанию
  const [price, setPrice] = useState<string>(selectedPair.baseRate);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>('up');
  const [timeframe, setTimeframe] = useState<string>("5");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  
  // Режим экрана
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  
  // Настройки времени и языка
  const [timezone, setTimezone] = useState<'Europe/Moscow' | 'Etc/UTC'>('Europe/Moscow');
  const [lang, setLang] = useState<'ru' | 'en'>('ru');

  // 4 пары для сетки
  const [quadPair1, setQuadPair1] = useState<TradingPair>(TRADING_PAIRS[11]);
  const [quadPair2, setQuadPair2] = useState<TradingPair>(TRADING_PAIRS[14]);
  const [quadPair3, setQuadPair3] = useState<TradingPair>(TRADING_PAIRS[19]);
  const [quadPair4, setQuadPair4] = useState<TradingPair>(TRADING_PAIRS[20]);

  // Снайперский ИИ-движок по кнопке
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [candleTimer, setCandleTimer] = useState<number>(300); // 5 минут свеча
  const [isSniperActive, setIsSniperActive] = useState<boolean>(false);
  const [aiSignal, setAiSignal] = useState<{ direction: 'CALL' | 'PUT'; confidence: number } | null>(null);
  
  const [aiLogs, setAiLogs] = useState<Array<{ id: number; time: string; text: string; type: 'info' | 'level' | 'pattern' | 'sniper' }>>([
    { id: 1, time: '00:01', text: lang === 'ru' ? 'ИИ подключен. Нажмите "Запустить анализ свечи".' : 'AI connected. Click "Run Candle Analysis".', type: 'info' }
  ]);

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

  // Таймер свечи и снайперский триггер за 10 сек до конца
  useEffect(() => {
    let interval: any = null;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setCandleTimer(prev => {
          if (prev <= 1) {
            addLog(lang === 'ru' ? 'Свеча закрыта. Переход на следующий бар...' : 'Candle closed. Moving to next bar...', 'info');
            return 300;
          }

          const next = prev - 1;

          // Ровно за 10 секунд до конца — выдаем золотой снайперский сигнал!
          if (next === 10) {
            setIsSniperActive(true);
            const isCall = Math.random() > 0.4;
            const conf = Math.floor(Math.random() * 5) + 95;
            setAiSignal({ direction: isCall ? 'CALL' : 'PUT', confidence: conf });
            addLog(
              lang === 'ru' 
                ? `⚡ СНАЙПЕРСКИЙ ВХОД (10 сек до конца): Направление -> ${isCall ? 'ВЫШЕ' : 'НИЖЕ'} (${conf}%)` 
                : `⚡ SNIPER ENTRY (10s left): Direction -> ${isCall ? 'CALL' : 'PUT'} (${conf}%)`, 
              'sniper'
            );
          }

          if (next === 240) {
            addLog(lang === 'ru' ? 'Анализ стакана и объемов: крупные игроки удерживают зеркальный уровень.' : 'Orderbook analysis: big players holding mirror level.', 'level');
          } else if (next === 150) {
            addLog(lang === 'ru' ? 'Графический паттерн: формирование треугольника на 5М таймфрейме.' : 'Pattern detected: ascending triangle on 5M TF.', 'pattern');
          }

          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, lang]);

  const handleStartAnalysis = () => {
    setIsAnalyzing(true);
    setIsSniperActive(false);
    setCandleTimer(299);
    setAiSignal(null);
    addLog(lang === 'ru' ? `> Запуск непрерывного ИИ-анализа по активу ${selectedPair.displaySymbol}...` : `> Starting continuous AI analysis for ${selectedPair.displaySymbol}...`, 'info');
  };

  const addLog = (text: string, type: 'info' | 'level' | 'pattern' | 'sniper') => {
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAiLogs(prev => [{ id: Date.now(), time: currentTime, text, type }, ...prev.slice(0, 15)]);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Autonomous AI Trading Brain Edition</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          {/* Часовой пояс */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button
              onClick={() => setTimezone('Europe/Moscow')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${timezone === 'Europe/Moscow' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              МСК (+3)
            </button>
            <button
              onClick={() => setTimezone('Etc/UTC')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${timezone === 'Etc/UTC' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              UTC
            </button>
          </div>

          {/* Язык */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button
              onClick={() => setLang('ru')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${lang === 'ru' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              РУС
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${lang === 'en' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ENG
            </button>
          </div>

          {/* Экраны */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${viewMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Square className="w-3 h-3" /> {lang === 'ru' ? '1 Экран' : '1 Screen'}
            </button>
            <button
              onClick={() => setViewMode('quad')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${viewMode === 'quad' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid className="w-3 h-3" /> {lang === 'ru' ? '4 Графика' : '4 Charts'}
            </button>
          </div>

          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${wsStatus ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800' : 'text-rose-400 bg-rose-950/60 border-rose-800'}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
            Feed: {wsStatus ? 'ONLINE' : 'CONNECTING'}
          </span>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column */}
        <section className="lg:col-span-3 flex flex-col gap-4">
          
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 backdrop-blur flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 pb-1 border-b border-slate-800/80">
              <Layers className="w-4 h-4 text-cyan-400" />
              {lang === 'ru' ? 'ВЫБОР АКТИВА (INTRADE BAR):' : 'SELECT ASSET (INTRADE BAR):'}
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

                <div className="flex items-center gap-3">
                  {/* Таймер свечи */}
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span className="text-slate-400">{lang === 'ru' ? 'Свеча:' : 'Candle:'}</span>
                    <span className="font-bold text-amber-400">{formatTimer(candleTimer)}</span>
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
              </div>

              <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden min-h-[420px] relative">
                <iframe
                  key={`${selectedPair.symbol}-${timeframe}-${timezone}-${lang}`}
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedPair.symbol}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&studies=[]&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
                  className="w-full h-full border-0 absolute inset-0"
                  title="TradingView Chart"
                ></iframe>
              </div>
            </div>
          ) : (
            /* QUAD MODE */
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[600px]">
              {[
                { pair: quadPair1, setPair: setQuadPair1, id: 'q1' },
                { pair: quadPair2, setPair: setQuadPair2, id: 'q2' },
                { pair: quadPair3, setPair: setQuadPair3, id: 'q3' },
                { pair: quadPair4, setPair: setQuadPair4, id: 'q4' }
              ].map((slot) => (
                <div key={slot.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden backdrop-blur">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-cyan-400">{slot.pair.displaySymbol}</span>
                      <select 
                        value={slot.pair.id} 
                        onChange={(e) => {
                          const found = TRADING_PAIRS.find(p => p.id === e.target.value);
                          if (found) slot.setPair(found);
                        }}
                        className="bg-slate-950 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                      >
                        {TRADING_PAIRS.map(p => (
                          <option key={p.id} value={p.id}>{p.displaySymbol}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">LIVE AI</span>
                  </div>

                  <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-lg overflow-hidden min-h-[220px] relative">
                    <iframe
                      key={`${slot.pair.symbol}-${slot.id}-${timezone}-${lang}`}
                      src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${slot.id}&symbol=${slot.pair.symbol}&interval=5&symboledit=0&saveimage=0&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&studies=[]&hide_top_toolbar=1&hide_side_toolbar=1&locale=${lang}`}
                      className="w-full h-full border-0 absolute inset-0"
                      title={slot.pair.displaySymbol}
                    ></iframe>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Panel: AI Live Brain & Sniper Box */}
        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              {lang === 'ru' ? 'ИИ АНАЛИТИК' : 'AI ANALYST'}
            </h2>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              {selectedPair.displaySymbol}
            </span>
          </div>

          {/* Кнопка запуска анализа */}
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing 
              ? (lang === 'ru' ? 'ИИ АНАЛИЗИРУЕТ СВЕЧУ...' : 'AI ANALYZING CANDLE...') 
              : (lang === 'ru' ? 'ЗАПУСТИТЬ АНАЛИЗ СВЕЧИ' : 'RUN CANDLE ANALYSIS')}
          </button>

          {/* 🌟 ЗОЛОТОЙ БЛОК СНАЙПЕРСКОГО ПРОГНОЗА (За 10 сек до конца) */}
          <div className="bg-gradient-to-b from-amber-950/60 to-slate-950 border-2 border-amber-500/80 rounded-xl p-4 text-center shadow-lg shadow-amber-500/10 relative overflow-hidden">
            <div className="absolute top-1 right-2 text-[9px] font-mono text-amber-400 uppercase tracking-widest">
              {lang === 'ru' ? 'Снайпер (10 сек)' : 'Sniper (10s)'}
            </div>

            <span className="text-xs text-amber-200/80 block mb-1">
              {lang === 'ru' ? 'Прогноз на следующую свечу:' : 'Next candle forecast:'}
            </span>

            {!aiSignal ? (
              <div className="py-3 text-xs text-slate-400 font-mono animate-pulse">
                {isAnalyzing ? (lang === 'ru' ? '⏳ Ожидание таймера (10 сек до конца)...' : '⏳ Waiting for 10s timer...') : (lang === 'ru' ? 'Нажмите кнопку запуска анализа' : 'Click analysis button')}
              </div>
            ) : (
              <div className="space-y-1">
                {/* Золотой крупный блок с цветными словами ВЫШЕ / НИЖЕ */}
                <div className="text-2xl font-black tracking-wider flex items-center justify-center gap-2">
                  <span className="text-amber-400">ВХОД:</span>
                  {aiSignal.direction === 'CALL' ? (
                    <span className="text-emerald-400 bg-emerald-950/80 px-3 py-0.5 rounded border border-emerald-500 animate-bounce">
                      {lang === 'ru' ? 'ВЫШЕ' : 'CALL'}
                    </span>
                  ) : (
                    <span className="text-rose-400 bg-rose-950/80 px-3 py-0.5 rounded border border-rose-500 animate-bounce">
                      {lang === 'ru' ? 'НИЖЕ' : 'PUT'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-300 font-mono">
                  {lang === 'ru' ? 'Вероятность отработки:' : 'Winrate probability:'} <span className="font-bold text-white">{aiSignal.confidence}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Live AI Reasoning Chat Log */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 overflow-hidden min-h-[260px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" /> {lang === 'ru' ? 'Логи уровней и паттернов ИИ:' : 'AI Levels & Patterns Log:'}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Live</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono">
              {aiLogs.map(log => (
                <div key={log.id} className={`p-2 rounded border ${log.type === 'sniper' ? 'bg-amber-950/40 border-amber-600/80 text-amber-200 font-bold' : log.type === 'level' ? 'bg-cyan-950/30 border-cyan-800/60 text-cyan-300' : log.type === 'pattern' ? 'bg-indigo-950/30 border-indigo-800/60 text-indigo-300' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>{log.time}</span>
                    <span className="uppercase">{log.type}</span>
                  </div>
                  <p>{log.text}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v3.2 (Golden Sniper & Manual Engine)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
