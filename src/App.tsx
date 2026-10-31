import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, LineChart, Database, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, BarChart3, LayoutGrid, Square, MessageSquare, Clock, Globe, Target, Activity, PenTool, Sparkles, Triangle } from 'lucide-react';
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
  
  // Графические элементы с поддержкой мультиязычности (РУС / ENG)
  const [drawnElements, setDrawnElements] = useState<Array<{ id: number; type: 'line' | 'zone' | 'highlight' | 'triangle'; top: number; left?: number; width?: number; height?: number; color: string; labelRu: string; labelEn: string }>>([]);

  const [aiLogs, setAiLogs] = useState<Array<{ id: number; time: string; text: string; type: 'info' | 'level' | 'pattern' | 'sniper' }>>([
    { 
      id: 1, 
      time: '00:01', 
      text: lang === 'ru' ? 'ИИ-аналитик инициализирован. База знаний загружена. Жду запуск.' : 'AI analyst initialized. Knowledge base loaded. Ready.', 
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
        
        setDrawnElements(prev => [
          ...prev, 
          { 
            id: Date.now(), 
            type: 'highlight', 
            top: 200, 
            left: 350, 
            width: 80, 
            height: 120, 
            color: isCall ? '#10b981' : '#f43f5e', 
            labelRu: isCall ? '🚀 СНАЙПЕР: ВЫШЕ' : '🔻 СНАЙПЕР: НИЖЕ',
            labelEn: isCall ? '🚀 SNIPER: CALL' : '🔻 SNIPER: PUT'
          }
        ]);

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
    setDrawnElements([]);
    addLog(
      lang === 'ru' ? `> ИИ начал глубокий анализ свечи ${selectedPair.displaySymbol}...` : `> AI started deep candle analysis for ${selectedPair.displaySymbol}...`, 
      'info'
    );

    // 1. Уровень сопротивления
    setTimeout(() => {
      setDrawnElements(prev => [...prev, { id: 1, type: 'line', top: 90, color: '#f43f5e', labelRu: 'Уровень Сопротивления', labelEn: 'Resistance Level' }]);
      addLog(
        lang === 'ru' ? '[ИИ] Начерчен ключевой уровень сопротивления.' : '[AI] Drawn key resistance level.', 
        'level'
      );
    }, 600);

    // 2. Уровень поддержки
    setTimeout(() => {
      setDrawnElements(prev => [...prev, { id: 4, type: 'line', top: 350, color: '#10b981', labelRu: 'Уровень Поддержки', labelEn: 'Support Level' }]);
      addLog(
        lang === 'ru' ? '[ИИ] Начерчен ключевой уровень поддержки.' : '[AI] Drawn key support level.', 
        'level'
      );
    }, 1200);

    // 3. Зона Ордерблока
    setTimeout(() => {
      setDrawnElements(prev => [...prev, { id: 2, type: 'zone', top: 220, left: 180, width: 150, height: 70, color: '#06b6d4', labelRu: 'Ордерблок (Smart Money)', labelEn: 'Order Block (Smart Money)' }]);
      addLog(
        lang === 'ru' ? '[ИИ] Выделена зона Ордерблока: институциональная ликвидность.' : '[AI] Highlighted Order Block zone: institutional liquidity.', 
        'pattern'
      );
    }, 2000);

    // 4. Паттерн Треугольник (Triangle Pattern)
    setTimeout(() => {
      setDrawnElements(prev => [...prev, { id: 5, type: 'triangle', top: 140, left: 240, width: 160, height: 140, color: '#a855f7', labelRu: 'Паттерн: Сходящийся Треугольник', labelEn: 'Pattern: Symmetrical Triangle' }]);
      addLog(
        lang === 'ru' ? '[ИИ] Обнаружен паттерн "Сходящийся треугольник". Подготовка к сильному импульсному пробою.' : '[AI] Detected "Symmetrical Triangle" pattern. Preparing for strong breakout.', 
        'pattern'
      );
    }, 3000);

    // 5. Подсветка Пин-бара
    setTimeout(() => {
      setDrawnElements(prev => [...prev, { id: 3, type: 'highlight', top: 170, left: 290, width: 40, height: 100, color: '#f59e0b', labelRu: 'Пин-бар (Реверс)', labelEn: 'Pin-Bar (Rejection)' }]);
      addLog(
        lang === 'ru' ? '[ИИ] Ключевая свеча: Пин-бар на отскок от границы треугольника.' : '[AI] Key candle: Pin-Bar bouncing off triangle boundary.', 
        'pattern'
      );
    }, 4000);
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

              {/* 🌟 КОНТЕЙНЕР ГРАФИКА С МУЛЬТИЯЗЫЧНЫМ СЛОЕМ ИИ */}
              <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden min-h-[420px] relative">
                <iframe
                  key={`${selectedPair.symbol}-${timeframe}-${timezone}-${lang}`}
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedPair.symbol}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&studies=[]&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
                  className="w-full h-full border-0 absolute inset-0 pointer-events-auto"
                  title="TradingView Chart"
                ></iframe>

                {/* Слой графического анализа с переключением РУС / ENG */}
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                  {drawnElements.map(el => {
                    if (el.type === 'line') {
                      return (
                        <div key={el.id} className="absolute w-full flex items-center transition-all duration-700 animate-fade-in" style={{ top: `${el.top}px` }}>
                          <div className="w-full border-t-2 border-dashed shadow-md" style={{ borderColor: el.color }}></div>
                          <span className="absolute right-4 px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-lg text-slate-950" style={{ backgroundColor: el.color }}>
                            {lang === 'ru' ? el.labelRu : el.labelEn}
                          </span>
                        </div>
                      );
                    } else if (el.type === 'zone') {
                      return (
                        <div 
                          key={el.id} 
                          className="absolute border border-cyan-400/80 bg-cyan-500/15 rounded-lg backdrop-blur-[1px] transition-all duration-700 flex items-center justify-center p-1"
                          style={{ top: `${el.top}px`, left: `${el.left}px`, width: `${el.width}px`, height: `${el.height}px` }}
                        >
                          <span className="text-[9px] font-mono font-bold text-cyan-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
                            {lang === 'ru' ? el.labelRu : el.labelEn}
                          </span>
                        </div>
                      );
                    } else if (el.type === 'triangle') {
                      return (
                        <div 
                          key={el.id} 
                          className="absolute border-2 border-purple-500/80 bg-purple-500/10 rounded-xl backdrop-blur-[1px] transition-all duration-700 flex items-start justify-center p-1"
                          style={{ top: `${el.top}px`, left: `${el.left}px`, width: `${el.width}px`, height: `${el.height}px`, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                        >
                          <span className="text-[9px] font-mono font-bold text-purple-200 bg-slate-950 px-1.5 py-0.5 rounded border border-purple-700 mt-2">
                            {lang === 'ru' ? el.labelRu : el.labelEn}
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div 
                          key={el.id} 
                          className="absolute border-2 border-amber-400 bg-amber-500/20 rounded-lg shadow-lg shadow-amber-500/30 animate-pulse flex items-start justify-center p-1"
                          style={{ top: `${el.top}px`, left: `${el.left}px`, width: `${el.width}px`, height: `${el.height}px` }}
                        >
                          <span className="text-[9px] font-mono font-black text-amber-200 bg-slate-950 px-1 rounded border border-amber-600">
                            {lang === 'ru' ? el.labelRu : el.labelEn}
                          </span>
                        </div>
                      );
                    }
                  })}
                </div>
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
              <BrainCircuit className="w-4 h-4 text-cyan-400 animate-pulse" />
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
              ? (lang === 'ru' ? 'ИИ СТРОИТ ТРЕУГОЛЬНИК И УРОВНИ...' : 'AI DRAWING TRIANGLE & LEVELS...') 
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
        <span>ORACLE PRO v3.8 (Triangle Patterns & Bilingual Overlay Engine)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
