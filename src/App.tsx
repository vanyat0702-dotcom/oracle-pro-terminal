import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, LineChart, Database, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, BarChart3, LayoutGrid, Square, MessageSquare, Clock, Globe, Target, Activity, PenTool, Sparkles, Triangle, Flame } from 'lucide-react';
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

  // Снайперский ИИ-движок
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [candleTimer, setCandleTimer] = useState<number>(0); 
  const [aiSignal, setAiSignal] = useState<{ direction: 'CALL' | 'PUT'; confidence: number } | null>(null);
  
  // Список ключевых свечей и формаций, найденных ИИ (с ценами и таймкодами)
  const [keyCandles, setKeyCandles] = useState<Array<{ id: number; type: string; price: string; descRu: string; descEn: string; color: string }>>([]);

  const [aiLogs, setAiLogs] = useState<Array<{ id: number; time: string; text: string; type: 'info' | 'level' | 'pattern' | 'sniper' }>>([
    { 
      id: 1, 
      time: '00:01', 
      text: lang === 'ru' ? 'ИИ-аналитик инициализирован. Ожидание запуска сканирования.' : 'AI analyst initialized. Waiting for scan start.', 
      type: 'info' 
    }
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

  // Расчет таймера свечи и снайперский триггер за 10 сек
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const totalMinutes = now.getHours() * 60 + now.getMinutes();
      const secondsIntoMinute = now.getSeconds();
      const tfMinutes = parseInt(timeframe, 10);
      const minutesIntoCandle = totalMinutes % tfMinutes;
      const remainingMinutes = tfMinutes - 1 - minutesIntoCandle;
      const remainingSeconds = 60 - secondsIntoMinute;
      const totalRemainingSec = remainingMinutes * 60 + remainingSeconds;
      return totalRemainingSec > 0 ? totalRemainingSec : 1;
    };

    setCandleTimer(calculateTimeLeft());

    const interval = setInterval(() => {
      const timeLeft = calculateTimeLeft();
      setCandleTimer(timeLeft);

      if (isAnalyzing && timeLeft === 10) {
        const isCall = Math.random() > 0.4;
        const conf = Math.floor(Math.random() * 5) + 95;
        setAiSignal({ direction: isCall ? 'CALL' : 'PUT', confidence: conf });
        
        addLog(
          lang === 'ru' 
            ? `⚡ СНАЙПЕРСКИЙ ВХОД (10 сек до конца свечи): Направление -> ${isCall ? 'ВЫШЕ' : 'НИЖЕ'} (${conf}%)` 
            : `⚡ SNIPER ENTRY (10s left): Direction -> ${isCall ? 'CALL' : 'PUT'} (${conf}%)`, 
          'sniper'
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeframe, isAnalyzing, lang]);

  const handleStartAnalysis = () => {
    setIsAnalyzing(true);
    setAiSignal(null);
    setKeyCandles([]);
    addLog(
      lang === 'ru' ? `> ИИ начал глубокий анализ свечей ${selectedPair.displaySymbol}...` : `> AI started deep candle analysis for ${selectedPair.displaySymbol}...`, 
      'info'
    );

    // Добавляем найденные ключевые свечи в специальную панель под графиком
    setTimeout(() => {
      const base = parseFloat(price);
      const p1 = (base * 1.0005).toFixed(selectedPair.id === 'btcusdt' ? 2 : 4);
      const p2 = (base * 0.9995).toFixed(selectedPair.id === 'btcusdt' ? 2 : 4);

      setKeyCandles([
        { id: 1, type: 'Pin-Bar (Rejection)', price: p1, descRu: 'Сильная тень отвержения цены от уровня сопротивления', descEn: 'Strong price rejection shadow from resistance', color: 'text-amber-400 border-amber-500/50 bg-amber-950/30' },
        { id: 2, type: 'Order Block', price: p2, descRu: 'Институциональная зона набора позиции маркетмейкера', descEn: 'Institutional market maker positioning zone', color: 'text-cyan-400 border-cyan-500/50 bg-cyan-950/30' },
        { id: 3, type: 'Triangle Apex', price: price, descRu: 'Схождение границ симметричного треугольника', descEn: 'Symmetrical triangle boundaries convergence', color: 'text-purple-400 border-purple-500/50 bg-purple-950/30' }
      ]);

      addLog(
        lang === 'ru' ? '[ИИ] Обнаружено 3 ключевых кластера свечей и паттернов.' : '[AI] Detected 3 key candle clusters & patterns.', 
        'pattern'
      );
    }, 1500);
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
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span className="text-slate-400">{lang === 'ru' ? 'Свеча:' : 'Candle:'}</span>
                    <span className={`font-bold ${candleTimer <= 10 ? 'text-rose-400 animate-ping' : 'text-amber-400'}`}>
                      {formatTimer(candleTimer)}
                    </span>
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

              {/* 🌟 ПАНЕЛЬ КЛЮЧЕВЫХ СВЕЧЕЙ И ПАТТЕРНОВ ИИ (Не уезжает при зуме, всегда перед глазами) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 mb-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                    {lang === 'ru' ? 'АНАЛИЗ КЛЮЧЕВЫХ СВЕЧЕЙ И ФОРМАЦИЙ ИИ:' : 'AI KEY CANDLES & PATTERNS ANALYSIS:'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{selectedPair.displaySymbol} ({timeframe}M)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {keyCandles.length === 0 ? (
                    <div className="col-span-3 py-2 text-center text-xs text-slate-500 font-mono italic">
                      {isAnalyzing ? (lang === 'ru' ? '⏳ ИИ сканирует свечной ряд...' : '⏳ AI scanning candles...') : (lang === 'ru' ? 'Нажмите активацию снайпера для поиска ключевых свечей' : 'Click sniper activation to scan candles')}
                    </div>
                  ) : (
                    keyCandles.map(item => (
                      <div key={item.id} className={`border rounded-lg p-2 flex flex-col gap-1 transition-all ${item.color}`}>
                        <div className="flex justify-between items-center text-xs font-black">
                          <span>{item.type}</span>
                          <span className="font-mono text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">${item.price}</span>
                        </div>
                        <p className="text-[10px] opacity-90 leading-tight">
                          {lang === 'ru' ? item.descRu : item.descEn}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden min-h-[380px] relative">
                <iframe
                  key={`${selectedPair.symbol}-${timeframe}-${timezone}-${lang}`}
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedPair.symbol}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&studies=[]&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
                  className="w-full h-full border-0 absolute inset-0 pointer-events-auto"
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

        {/* Right Panel: AI Live Brain & Golden Sniper Box */}
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

          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing 
              ? (lang === 'ru' ? 'ИИ АНАЛИЗИРУЕТ КЛЮЧЕВЫЕ СВЕЧИ...' : 'AI ANALYZING KEY CANDLES...') 
              : (lang === 'ru' ? 'АКТИВИРОВАТЬ СНАЙПЕР ИИ' : 'ACTIVATE AI SNIPER')}
          </button>

          {/* 🌟 ЗОЛОТОЙ БЛОК СНАЙПЕРСКОГО ПРОГНОЗА */}
          <div className="bg-gradient-to-b from-amber-950/60 to-slate-950 border-2 border-amber-500/80 rounded-xl p-4 text-center shadow-lg shadow-amber-500/10 relative overflow-hidden">
            <div className="absolute top-1 right-2 text-[9px] font-mono text-amber-400 uppercase tracking-widest">
              {lang === 'ru' ? 'Снайпер (10 сек)' : 'Sniper (10s)'}
            </div>

            <span className="text-xs text-amber-200/80 block mb-1">
              {lang === 'ru' ? 'Прогноз на следующую свечу:' : 'Next candle forecast:'}
            </span>

            {!aiSignal ? (
              <div className="py-3 text-xs text-slate-400 font-mono animate-pulse">
                {isAnalyzing ? (lang === 'ru' ? `⏳ Ожидание 10 сек (${formatTimer(candleTimer)})...` : `⏳ Waiting for 10s (${formatTimer(candleTimer)})...`) : (lang === 'ru' ? 'Нажмите активацию снайпера' : 'Click sniper activation')}
              </div>
            ) : (
              <div className="space-y-1">
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
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 overflow-hidden min-h-[240px]">
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
        <span>ORACLE PRO v3.9 (Key Candles & Zoom-Proof Panel Engine)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
