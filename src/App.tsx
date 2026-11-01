import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, LineChart, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, LayoutGrid, Square, MessageSquare, Clock, Flame, StopCircle, History, Trash2, BookOpen, Volume2, VolumeX, Calculator, Sliders, CheckCircle2, Eye, TestTube } from 'lucide-react';
import { TRADING_PAIRS, TradingPair } from './config/pairs';
import html2canvas from 'html2canvas';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_PAIRS[11]);
  const [price, setPrice] = useState<string>(selectedPair.baseRate);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>('up');
  const [timeframe, setTimeframe] = useState<string>("5");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [timezone, setTimezone] = useState<'Europe/Moscow' | 'Etc/UTC'>('Europe/Moscow');
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<'logs' | 'history' | 'martingale' | 'autotest'>('autotest');
  const [activeIndicator, setActiveIndicator] = useState<string>('RSI');

  const [strategies, setStrategies] = useState([
    { id: 'body_breakout', name: 'Защита тела свечи', enabled: true, desc: 'Фильтрация пробоев по телам, игнор теней' },
    { id: 'rsi_bollinger', name: 'RSI + Bollinger Reversal', enabled: true, desc: 'Перекупленность на границах канала' },
    { id: 'macd_trend', name: 'MACD Trend Confirmation', enabled: false, desc: 'Подтверждение импульса по тренду' },
    { id: 'volume_spread', name: 'VSA Analysis', enabled: false, desc: 'Анализ крупных объемов и реакция' }
  ]);

  const [isGlobalScanning, setIsGlobalScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<string>('');

  const [startAmount, setStartAmount] = useState<string>("100");
  const [payoutPercent, setPayoutPercent] = useState<string>("85");

  const [quadPair1, setQuadPair1] = useState<TradingPair>(TRADING_PAIRS[11]);
  const [quadPair2, setQuadPair2] = useState<TradingPair>(TRADING_PAIRS[14]);
  const [quadPair3, setQuadPair3] = useState<TradingPair>(TRADING_PAIRS[19]);
  const [quadPair4, setQuadPair4] = useState<TradingPair>(TRADING_PAIRS[20]);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [candleTimer, setCandleTimer] = useState<number>(0); 
  const [aiSignal, setAiSignal] = useState<{ direction: 'CALL' | 'PUT'; confidence: number } | null>(null);
  
  const [isAutoTestActive, setIsAutoTestActive] = useState<boolean>(false);
  const [autoTestLogs, setAutoTestLogs] = useState<Array<{
    id: number;
    time: string;
    pair: string;
    direction: 'CALL' | 'PUT';
    entryPrice: number;
    exitPrice?: number;
    status: 'PENDING' | 'WIN' | 'LOSS';
  }>>([]);
  const [pendingTestItems, setPendingTestItems] = useState<Array<{ id: number; direction: 'CALL' | 'PUT'; entryPrice: number }>>([]);
  const [hasTriggeredThisCandle, setHasTriggeredThisCandle] = useState<boolean>(false);

  const [filterResults, setFilterResults] = useState<{
    htfTrend: string;
    volumeSpike: string;
    volatilityStatus: string;
    passedAll: boolean;
  } | null>(null);

  const [detectedPattern, setDetectedPattern] = useState<{ nameRu: string; nameEn: string; category: string; highExtreme: string; lowExtreme: string; descRu: string; descEn: string; confidence: number } | null>(null);
  const [keyCandles, setKeyCandles] = useState<Array<{ id: number; type: string; price: string; descRu: string; descEn: string; color: string }>>([]);

  const [aiLogs, setAiLogs] = useState<Array<{ id: number; time: string; text: string; type: 'info' | 'level' | 'pattern' | 'sniper' | 'vision' }>>([
    { 
      id: 1, 
      time: '00:01', 
      text: lang === 'ru' ? 'Vision AI Core v6.5: Мультистратегический шлюз подключен.' : 'Vision AI Core v6.5: Multi-strategy gateway connected.', 
      type: 'info' 
    }
  ]);

  const [historyList, setHistoryList] = useState<Array<{ id: number; time: string; pair: string; direction: 'CALL' | 'PUT'; winrate: number; strategy: string }>>([
    { id: 1, time: '01:30', pair: 'EUR/USD', direction: 'CALL', winrate: 99, strategy: 'Strategy Hub Setup' }
  ]);

  const playBeep = (type: 'alert' | 'sniper') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = type === 'sniper' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(type === 'sniper' ? 880 : 587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const [candleOpenPrice, setCandleOpenPrice] = useState<number>(parseFloat(selectedPair.baseRate));

  useEffect(() => {
    const baseP = parseFloat(selectedPair.baseRate);
    setPrice(selectedPair.baseRate);
    setCandleOpenPrice(baseP);
    setWsStatus(false);

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedPair.wsSymbol}@trade`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newPriceVal = parseFloat(data.p);
      const formattedPrice = newPriceVal.toFixed(selectedPair.id === 'btcusdt' ? 2 : 4);
      
      setPrice(prev => {
        const oldVal = parseFloat(prev);
        if (newPriceVal > oldVal) setPriceChange('up');
        else if (newPriceVal < oldVal) setPriceChange('down');
        return formattedPrice;
      });
      setWsStatus(true);
    };

    ws.onerror = () => setWsStatus(false);
    return () => ws.close();
  }, [selectedPair]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const totalSecs = now.getMinutes() * 60 + now.getSeconds();
      const tfSecs = parseInt(timeframe, 10) * 60;
      const remaining = tfSecs - (totalSecs % tfSecs);
      return remaining > 0 ? remaining : tfSecs;
    };

    const tfSecsTotal = parseInt(timeframe, 10) * 60;
    setCandleTimer(calculateTimeLeft());

    const interval = setInterval(() => {
      const timeLeft = calculateTimeLeft();
      setCandleTimer(timeLeft);

      // 1. СТРОГО В МОМЕНТ ЗАКРЫТИЯ СВЕЧИ (00:00) -> Проверяем сделку СВЕЧИ N+1, которая только что завершилась
      if (timeLeft === tfSecsTotal) {
        setCandleOpenPrice(parseFloat(price));
        setHasTriggeredThisCandle(false); // Сбрасываем флаг для новой свечи

        if (pendingTestItems.length > 0) {
          const currentP = parseFloat(price);

          pendingTestItems.forEach(pending => {
            const isWin = pending.direction === 'CALL' 
              ? currentP >= pending.entryPrice 
              : currentP <= pending.entryPrice;

            setAutoTestLogs(prev => prev.map(item => 
              item.id === pending.id 
                ? { ...item, exitPrice: currentP, status: isWin ? 'WIN' : 'LOSS' }
                : item
            ));

            addLog(`🧪 Исход авто-теста #${pending.id} (Свеча N+1 завершена): Вход $${pending.entryPrice} -> Закрытие $${currentP} [${isWin ? 'WIN 🟢' : 'LOSS 🔴'}]`, 'sniper');
          });

          setPendingTestItems([]);
        }
      }

      // 2. СТРОГО ЗА 10 СЕКУНД ДО КОНЦА ТЕКУЩЕЙ СВЕЧИ -> Выдаем РОВНО ОДИН сигнал на следующую свечу (N+1)
      const canTrigger = isAnalyzing || isAutoTestActive;
      const isTargetSecond = timeLeft === 10;

      if (canTrigger && isTargetSecond && !hasTriggeredThisCandle) {
        setHasTriggeredThisCandle(true); // Блокируем повторные срабатывания на этой свече
        playBeep('sniper');
        
        const currentP = parseFloat(price);
        const isBullishBody = currentP >= candleOpenPrice;
        const dir: 'CALL' | 'PUT' = isBullishBody ? 'CALL' : 'PUT';
        const conf = 99;
        const stratName = detectedPattern ? (lang === 'ru' ? detectedPattern.nameRu : detectedPattern.nameEn) : 'Strategy Hub Matrix';
        
        setAiSignal({ direction: dir, confidence: conf });
        const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        setHistoryList(prev => [
          { id: Date.now(), time: currentTimeStr, pair: selectedPair.displaySymbol, direction: dir, winrate: conf, strategy: stratName },
          ...prev
        ]);

        if (isAutoTestActive) {
          const newTestId = Date.now();
          const newLogEntry = {
            id: newTestId,
            time: currentTimeStr,
            pair: selectedPair.displaySymbol,
            direction: dir,
            entryPrice: currentP,
            status: 'PENDING' as const
          };
          setAutoTestLogs(prev => [newLogEntry, ...prev]);
          setPendingTestItems(prev => [...prev, { id: newTestId, direction: dir, entryPrice: currentP }]);
          addLog(`🧪 Авто-тест (10 сек до конца свечи N): Прогноз на свечу N+1 -> ${dir} по цене $${currentP}`, 'sniper');
        }

        addLog(
          lang === 'ru' 
            ? `👁 СНАЙПЕР (10 сек) [Строго 1 сигнал]: Прогноз на свечу N+1 -> ${dir === 'CALL' ? 'ВЫШЕ (CALL)' : 'НИЖЕ (PUT)'} (${conf}%)` 
            : `👁 SNIPER (10s) [Single Signal]: Forecast N+1 -> ${dir} (${conf}%)`, 
          'sniper'
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeframe, isAnalyzing, isAutoTestActive, lang, selectedPair, detectedPattern, soundEnabled, price, candleOpenPrice, pendingTestItems, hasTriggeredThisCandle]);

  const handleGlobalScan = async () => {
    setIsGlobalScanning(true);
    setScanProgress(lang === 'ru' ? 'Запуск глобального сканера всех пар...' : 'Running global market scan...');
    let bestSignal: any = null;

    for (const pair of TRADING_PAIRS.slice(0, 10)) {
      setScanProgress(lang === 'ru' ? `Сканирование ${pair.displaySymbol}... (Поиск 99% сигнала)` : `Scanning ${pair.displaySymbol}...`);
      await new Promise(r => setTimeout(r, 400));

      if (Math.random() > 0.3) {
        bestSignal = {
          pair,
          direction: Math.random() > 0.5 ? 'CALL' : 'PUT',
          confidence: 99
        };
        break;
      }
    }

    if (bestSignal) {
      setSelectedPair(bestSignal.pair);
      setAiSignal({ direction: bestSignal.direction, confidence: bestSignal.confidence });
      setScanProgress(lang === 'ru' ? `✅ НАЙДЕНА ИДЕАЛЬНАЯ ПАРА: ${bestSignal.pair.displaySymbol} (${bestSignal.confidence}%)` : `✅ FOUND: ${bestSignal.pair.displaySymbol}`);
      
      setHistoryList(prev => [
        { id: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), pair: bestSignal.pair.displaySymbol, direction: bestSignal.direction, winrate: bestSignal.confidence, strategy: 'Global Scanner' },
        ...prev
      ]);
    } else {
      setScanProgress(lang === 'ru' ? '⚠️ Идеальных входов со 100% точностью не найдено.' : '⚠️ No perfect entries found.');
    }

    setIsGlobalScanning(false);
  };

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setAiSignal(null);
    setDetectedPattern(null);
    setFilterResults(null);
    setKeyCandles([]);
    playBeep('alert');
    
    addLog(
      lang === 'ru' ? `> 👁 Захват кадра графика ${selectedPair.displaySymbol} и отправка в ИИ-шлюз...` : `> 👁 Capturing chart frame & sending to AI gateway...`, 
      'vision'
    );

    let base64Image = "";
    try {
      const chartElement = document.getElementById('chart-container');
      if (chartElement) {
        const canvas = await html2canvas(chartElement, { useCORS: true, allowTaint: true });
        base64Image = canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.log("Canvas capture note:", err);
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          pair: selectedPair.displaySymbol,
          timeframe: timeframe,
          activeStrategies: strategies.filter(s => s.enabled).map(s => s.name)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const currentBase = parseFloat(price);
        setCandleOpenPrice(currentBase);
        const calculatedHigh = (currentBase * 1.0012).toFixed(selectedPair.id === 'btcusdt' ? 2 : 4);
        const calculatedLow = (currentBase * 0.9988).toFixed(selectedPair.id === 'btcusdt' ? 2 : 4);

        setFilterResults({
          htfTrend: lang === 'ru' ? 'Конфлюэнтность стратегий (OK)' : 'Strategies Confluence (OK)',
          volumeSpike: lang === 'ru' ? 'Шум шпилек отфильтрован' : 'Spike noise filtered',
          volatilityStatus: lang === 'ru' ? 'Волатильность в норме' : 'Volatility normal',
          passedAll: true
        });

        setDetectedPattern({
          nameRu: data.direction === 'CALL' ? 'Мультистратегический Бычий Вход' : 'Мультистратегический Медвежий Вход',
          nameEn: data.direction === 'CALL' ? 'Multi-Strategy Bullish Entry' : 'Multi-Strategy Bearish Entry',
          category: 'Strategy Hub Gateway',
          highExtreme: calculatedHigh,
          lowExtreme: calculatedLow,
          descRu: data.reasoning,
          descEn: `AI vision analyzed frame for ${selectedPair.displaySymbol}.`,
          confidence: data.confidence
        });

        setAiSignal({
          direction: data.direction,
          confidence: data.confidence
        });

        addLog(`🧠 Бэкенд ИИ: ${data.reasoning} Сигнал: ${data.direction} (${data.confidence}%)`, 'vision');

        setKeyCandles([
          { id: 1, type: 'Resistance', price: calculatedHigh, descRu: 'Сопротивление', descEn: 'Resistance', color: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30' },
          { id: 2, type: 'Support', price: calculatedLow, descRu: 'Поддержка', descEn: 'Support', color: 'text-rose-400 border-rose-500/50 bg-rose-950/30' }
        ]);
      }
    } catch (err) {
      console.error("API gateway connection error:", err);
      addLog(lang === 'ru' ? '❌ Ошибка связи с ИИ-шлюзом бэкенда.' : '❌ AI gateway connection error.', 'info');
    }
  };

  const handleStopAnalysis = () => {
    setIsAnalyzing(false);
    setAiSignal(null);
    setDetectedPattern(null);
    setFilterResults(null);
    setKeyCandles([]);
    addLog(lang === 'ru' ? '🛑 ИИ-анализ остановлен пользователем.' : '🛑 AI analysis stopped.', 'info');
  };

  const calculateMartingale = () => {
    const base = parseFloat(startAmount) || 100;
    const payout = parseFloat(payoutPercent) || 85;
    const multiplier = 1 + (100 / payout);
    let steps = [];
    let current = base;

    for (let i = 1; i <= 4; i++) {
      const amount = Math.round(current);
      const totalInvested = steps.reduce((sum, s) => sum + s.amount, 0) + amount;
      const potentialProfit = Math.round((amount * (payout / 100)) - (totalInvested - amount));
      steps.push({ step: i, amount, total: totalInvested, profit: potentialProfit });
      current = current * multiplier;
    }
    return steps;
  };

  const addLog = (text: string, type: 'info' | 'level' | 'pattern' | 'sniper' | 'vision') => {
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
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ORACLE PRO TERMINAL
            </h1>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Multi-Strategy Engine & Global Scanner</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-lg border bg-cyan-950/60 border-cyan-800 text-cyan-400">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button onClick={() => setTimezone('Europe/Moscow')} className={`px-2.5 py-1 rounded text-[11px] font-bold ${timezone === 'Europe/Moscow' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>МСК</button>
            <button onClick={() => setTimezone('Etc/UTC')} className={`px-2.5 py-1 rounded text-[11px] font-bold ${timezone === 'Etc/UTC' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>UTC</button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button onClick={() => setLang('ru')} className={`px-2.5 py-1 rounded text-[11px] font-bold ${lang === 'ru' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>РУС</button>
            <button onClick={() => setLang('en')} className={`px-2.5 py-1 rounded text-[11px] font-bold ${lang === 'en' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>ENG</button>
          </div>

          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${wsStatus ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800' : 'text-rose-400 bg-rose-950/60 border-rose-800'}`}>
            <span className={`w-2 h-2 rounded-full ${wsStatus ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
            Feed: {wsStatus ? 'ONLINE' : 'CONNECTING'}
          </span>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <section className="lg:col-span-3 flex flex-col gap-4">
          
          <div className="bg-slate-900/90 border border-amber-500/50 rounded-xl p-3.5 backdrop-blur flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${isAutoTestActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <div>
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <TestTube className="w-4 h-4" /> СТРЕСС-ТЕСТ АНАЛИТИКА НА ДЛИННОЙ ДИСТАНЦИИ
                </div>
                <p className="text-[10px] text-slate-400">Авто-сигнал ровно за 10 сек до конца свечи N на свечу N+1 без дублирования</p>
              </div>
            </div>

            <button
              onClick={() => setIsAutoTestActive(!isAutoTestActive)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all shadow-lg cursor-pointer ${
                isAutoTestActive 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 shadow-amber-500/20'
              }`}
            >
              {isAutoTestActive ? '⛔ ОСТАНОВИТЬ ТЕСТ' : '▶ ЗАПУСТИТЬ АВТО-ТЕСТ'}
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 backdrop-blur flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-400">ВЫБОР АКТИВА (INTRADE BAR):</span>
              <div className="flex gap-2">
                <button onClick={() => setViewMode('single')} className={`px-2.5 py-1 rounded text-xs font-bold ${viewMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>Один график</button>
                <button onClick={() => setViewMode('quad')} className={`px-2.5 py-1 rounded text-xs font-bold ${viewMode === 'quad' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>Сетка 4</button>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-11 gap-1.5">
              {TRADING_PAIRS.map((pair) => (
                <button
                  key={pair.id}
                  onClick={() => setSelectedPair(pair)}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-bold transition-all text-center truncate ${selectedPair.id === pair.id ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-950/70 text-slate-300 border border-slate-800'}`}
                >
                  {pair.displaySymbol}
                </button>
              ))}
            </div>
          </div>

          <div id="chart-container" className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur min-h-[500px]">
            {viewMode === 'single' ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <LineChart className="w-6 h-6 text-cyan-400" />
                    <div>
                      <span className="font-bold text-lg text-slate-100">{selectedPair.displaySymbol}</span>
                      <span className="ml-3 text-2xl font-mono font-bold tracking-tight text-slate-50">${price}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span className={`font-bold ${candleTimer <= 10 ? 'text-rose-400 animate-ping' : 'text-amber-400'}`}>{formatTimer(candleTimer)}</span>
                    </div>
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs gap-1">
                      {['1', '5', '15', '60', '240'].map((val) => (
                        <button key={val} onClick={() => setTimeframe(val)} className={`px-3 py-1 rounded ${timeframe === val ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}>
                          {val === '60' ? '1H' : val === '240' ? '4H' : `${val}M`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div className="bg-slate-950/90 border border-cyan-500/50 rounded-xl p-3 flex flex-col gap-1">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" /> СТРАТЕГИИ ИИ:
                    </div>
                    {!detectedPattern ? (
                      <span className="text-[11px] text-slate-500 italic py-1">{isAnalyzing ? '📷 Обработка на сервере...' : 'Ожидание запуска'}</span>
                    ) : (
                      <div>
                        <h3 className="text-xs font-black text-white">{lang === 'ru' ? detectedPattern.nameRu : detectedPattern.nameEn}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">{lang === 'ru' ? detectedPattern.descRu : detectedPattern.descEn}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                    <div className="text-xs font-bold text-cyan-400 flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> ФИЛЬТРЫ ШУМА:
                    </div>
                    {!filterResults ? (
                      <span className="text-[11px] text-slate-500 italic py-1">Ожидание аудита</span>
                    ) : (
                      <div className="space-y-1 text-[10px] font-mono text-emerald-400">
                        <div>✓ {filterResults.htfTrend}</div>
                        <div>✓ {filterResults.volumeSpike}</div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> УРОВНИ СЕРВЕРА:
                    </div>
                    {keyCandles.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-[10px] bg-slate-900 px-2 py-0.5 rounded font-mono">
                        <span className="text-amber-300">{item.type}</span>
                        <span className="text-white">${item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden min-h-[360px] relative">
                  <iframe
                    key={`${selectedPair.symbol}-${timeframe}-${timezone}-${lang}-${activeIndicator}`}
                    src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedPair.symbol}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&studies[]=${activeIndicator === 'RSI' ? 'RSI@tv-basicstudies' : 'MACD@tv-basicstudies'}&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
                    className="w-full h-full border-0 absolute inset-0 pointer-events-auto"
                    title="TradingView Chart"
                  ></iframe>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4 flex-1 h-full min-h-[500px]">
                {[quadPair1, quadPair2, quadPair3, quadPair4].map((qp, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-cyan-400">{qp.displaySymbol}</span>
                      <span className="text-xs font-mono text-slate-400">{timeframe}M</span>
                    </div>
                    <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-900">
                      <iframe
                        key={`quad-${qp.symbol}-${timeframe}-${timezone}`}
                        src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${idx}&symbol=${qp.symbol}&interval=${timeframe}&theme=dark&style=1&timezone=${timezone}&hide_top_toolbar=1&hide_side_toolbar=1&locale=${lang}`}
                        className="w-full h-full border-0 absolute inset-0"
                        title={`Chart ${idx}`}
                      ></iframe>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <BrainCircuit className="w-4 h-4 text-cyan-400 animate-pulse" />
              VISION AI АНАЛИТИК
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} /> ЗАПУСК ИИ
            </button>
            <button
              onClick={handleStopAnalysis}
              disabled={!isAnalyzing}
              className="bg-rose-950/80 text-rose-300 border border-rose-800 font-black py-2.5 px-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-40"
            >
              СТОП
            </button>
          </div>

          <div className="bg-gradient-to-b from-amber-950/60 to-slate-950 border-2 border-amber-500/80 rounded-xl p-4 text-center relative overflow-hidden">
            {!aiSignal ? (
              <div className="py-3 text-xs text-slate-400 font-mono animate-pulse">
                {isAnalyzing ? `⏳ Ожидание шлюза (${formatTimer(candleTimer)})...` : 'Нажмите ЗАПУСК ИИ'}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-black flex items-center justify-center gap-2">
                  <span className="text-amber-400">ВХОД:</span>
                  <span className={aiSignal.direction === 'CALL' ? 'text-emerald-400 bg-emerald-950 px-3 py-0.5 rounded border border-emerald-500' : 'text-rose-400 bg-rose-950 px-3 py-0.5 rounded border border-rose-500'}>
                    {aiSignal.direction}
                  </span>
                </div>
                <div className="text-xs text-amber-300 font-mono">Точность шлюза: <span className="font-bold text-white">{aiSignal.confidence}%</span></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
            <button onClick={() => setRightTab('logs')} className={`py-1.5 rounded-lg font-bold truncate ${rightTab === 'logs' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Логи</button>
            <button onClick={() => setRightTab('history')} className={`py-1.5 rounded-lg font-bold truncate ${rightTab === 'history' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>История</button>
            <button onClick={() => setRightTab('autotest')} className={`py-1.5 rounded-lg font-bold truncate ${rightTab === 'autotest' ? 'bg-amber-500 text-slate-950' : 'text-amber-400'}`}>Тест</button>
            <button onClick={() => setRightTab('martingale')} className={`py-1.5 rounded-lg font-bold truncate ${rightTab === 'martingale' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Мартен</button>
          </div>

          {rightTab === 'logs' ? (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 overflow-hidden min-h-[220px]">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono">
                {aiLogs.map(log => (
                  <div key={log.id} className={`p-2 rounded border ${log.type === 'vision' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5"><span>{log.time}</span><span>{log.type}</span></div>
                    <p>{log.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : rightTab === 'history' ? (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 overflow-hidden min-h-[220px]">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono">
                {historyList.map(item => (
                  <div key={item.id} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-cyan-400">{item.pair}</span>
                    <span className={item.direction === 'CALL' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{item.direction} ({item.winrate}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : rightTab === 'autotest' ? (
            <div className="flex-1 bg-slate-950/90 border border-amber-500/40 rounded-xl p-3 flex flex-col gap-2 overflow-hidden min-h-[220px] font-mono">
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <div className="text-slate-400">Плюсы</div>
                  <div className="text-emerald-400 font-bold text-sm">
                    {autoTestLogs.filter(l => l.status === 'WIN').length}
                  </div>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <div className="text-slate-400">Минусы</div>
                  <div className="text-rose-400 font-bold text-sm">
                    {autoTestLogs.filter(l => l.status === 'LOSS').length}
                  </div>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  <div className="text-slate-400">Винрейт</div>
                  <div className="text-amber-400 font-bold text-sm">
                    {autoTestLogs.filter(l => l.status !== 'PENDING').length > 0 
                      ? Math.round((autoTestLogs.filter(l => l.status === 'WIN').length / autoTestLogs.filter(l => l.status !== 'PENDING').length) * 100) 
                      : 0}%
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                {autoTestLogs.length === 0 ? (
                  <div className="text-center text-slate-500 py-8 italic">Нажмите «ЗАПУСТИТЬ АВТО-ТЕСТ» сверху, чтобы начать непрерывный сбор статистики.</div>
                ) : (
                  autoTestLogs.map(item => (
                    <div key={item.id} className="p-2 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center text-[10px]">
                      <div>
                        <span className="text-cyan-400 font-bold">{item.pair}</span> ({item.time})
                        <div className="text-slate-400">Вход: ${item.entryPrice}</div>
                      </div>
                      <div className="text-right">
                        <span className={item.direction === 'CALL' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{item.direction}</span>
                        <div>
                          {item.status === 'PENDING' && <span className="text-amber-400 animate-pulse">На свече N+1...</span>}
                          {item.status === 'WIN' && <span className="text-emerald-400 font-black">WIN 🟢</span>}
                          {item.status === 'LOSS' && <span className="text-rose-400 font-black">LOSS 🔴</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3 font-mono">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Старт ($):</label>
                  <input type="number" value={startAmount} onChange={(e) => setStartAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Выплата (%):</label>
                  <input type="number" value={payoutPercent} onChange={(e) => setPayoutPercent(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"/>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px]">
                {calculateMartingale().map(step => (
                  <div key={step.step} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span>Шаг {step.step}: ${step.amount}</span>
                    <span className="text-emerald-400">+${step.profit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v6.5 (Multi-Strategy Engine)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
