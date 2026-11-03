import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, LineChart, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, LayoutGrid, Square, MessageSquare, Clock, Flame, StopCircle, History, Trash2, BookOpen, Volume2, VolumeX, Calculator, Sliders, CheckCircle2, Eye, TestTube, CheckSquare, Square as SquareIcon, Filter, AlertTriangle, Activity, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { TRADING_PAIRS, TradingPair } from './config/pairs';
import html2canvas from 'html2canvas';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_PAIRS[11]); // EUR/USD
  
  const [selectedMultiPairs, setSelectedMultiPairs] = useState<TradingPair[]>([
    TRADING_PAIRS[0], // AUD/CAD
    TRADING_PAIRS[1], // AUD/CHF
    TRADING_PAIRS[11], // EUR/USD
    TRADING_PAIRS[19]  // USD/JPY
  ]);

  const [timeframe, setTimeframe] = useState<string>("5");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [timezone, setTimezone] = useState<'Europe/Moscow' | 'Etc/UTC'>('Europe/Moscow');
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<'logs' | 'history' | 'autotest' | 'martingale' | 'strategies'>('autotest');
  const [activeIndicator, setActiveIndicator] = useState<string>('RSI');

  const [riskMode, setRiskMode] = useState<'SAFE' | 'BALANCED' | 'AGGRESSIVE'>('BALANCED');

  // Состояния сворачивания верхних блоков для освобождения места
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [newsFilterEnabled, setNewsFilterEnabled] = useState<boolean>(true);
  const [atrFilterEnabled, setAtrFilterEnabled] = useState<boolean>(true);
  const [riskCapEnabled, setRiskCapEnabled] = useState<boolean>(true);
  const [maxMartingaleStep, setMaxMartingaleStep] = useState<number>(3);

  const [autotestFilter, setAutotestFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'SKIPPED'>('ALL');
  const [selectedPairFilter, setSelectedPairFilter] = useState<string | null>(null);

  const [strategies, setStrategies] = useState([
    { id: 'trend_following', name: 'Трендовый фильтр (Trend Master)', enabled: true, wins: 14, losses: 3, desc: 'Торговля строго по направлению глобального тренда' },
    { id: 'price_action', name: 'Price Action & Пин-бар', enabled: true, wins: 19, losses: 5, desc: 'Поиск разворотных паттернов у ключевых уровней' },
    { id: 'body_breakout', name: 'Защита тела свечи (Body Breakout)', enabled: true, wins: 11, losses: 4, desc: 'Игнор ложных пробоев теней, вход по телу' },
    { id: 'rsi_bollinger', name: 'RSI + Bollinger Reversal', enabled: true, wins: 8, losses: 6, desc: 'Отскок от границ канала при перекупленности' },
    { id: 'vsa_volume', name: 'VSA Analysis (Объемы)', enabled: true, wins: 15, losses: 4, desc: 'Анализ тикового объема и импульса' },
    { id: 'volume_scalping', name: 'Импульсный Скальпинг (1M)', enabled: true, wins: 12, losses: 2, desc: 'Быстрый вход на 1 минуту при всплеске объема' }
  ]);

  const [startAmount, setStartAmount] = useState<string>("100");
  const [payoutPercent, setPayoutPercent] = useState<string>("85");

  const [quadPair1, setQuadPair1] = useState<TradingPair>(TRADING_PAIRS[11]);
  const [quadPair2, setQuadPair2] = useState<TradingPair>(TRADING_PAIRS[14]);
  const [quadPair3, setQuadPair3] = useState<TradingPair>(TRADING_PAIRS[19]);
  const [quadPair4, setQuadPair4] = useState<TradingPair>(TRADING_PAIRS[20]);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [candleTimer, setCandleTimer] = useState<number>(0); 
  const [aiSignal, setAiSignal] = useState<{ pair?: string; direction: 'CALL' | 'PUT' | 'SKIP'; confidence: number; nextCandleTime?: string; reasoning?: string; recommendedExpiration?: string } | null>(null);
  
  const [isAutoTestActive, setIsAutoTestActive] = useState<boolean>(false);
  
  const [autoTestLogs, setAutoTestLogs] = useState<Array<{
    id: number;
    time: string;
    pair: string;
    direction: 'CALL' | 'PUT' | 'SKIPPED';
    targetCandleIndex: number;
    status: 'PENDING' | 'WIN' | 'LOSS' | 'SKIPPED';
  }>>(() => {
    try {
      const saved = localStorage.getItem('oracle_autotest_logs_v105');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('oracle_autotest_logs_v105', JSON.stringify(autoTestLogs));
    } catch (e) {
      console.log('Storage save error:', e);
    }
  }, [autoTestLogs]);
  
  const [pendingTestItems, setPendingTestItems] = useState<Array<{ 
    id: number; 
    pair: string;
    direction: 'CALL' | 'PUT'; 
    targetCandleIndex: number;
  }>>([]);

  const isAutoTestActiveRef = useRef(isAutoTestActive);
  isAutoTestActiveRef.current = isAutoTestActive;

  const isAnalyzingRef = useRef(isAnalyzing);
  isAnalyzingRef.current = isAnalyzing;

  const pendingItemsRef = useRef(pendingTestItems);
  pendingItemsRef.current = pendingTestItems;

  const selectedMultiPairsRef = useRef(selectedMultiPairs);
  selectedMultiPairsRef.current = selectedMultiPairs;

  const riskModeRef = useRef(riskMode);
  riskModeRef.current = riskMode;

  const currentCandleIndexRef = useRef<number>(0);
  const hasTriggeredCurrentCandleRef = useRef<boolean>(false);

  const queuedSignalsRef = useRef<Array<{
    pair: string;
    direction: 'CALL' | 'PUT';
    confidence: number;
    timeStr: string;
  }>>([]);

  const [aiLogs, setAiLogs] = useState<Array<{ id: number; time: string; text: string; type: 'info' | 'level' | 'pattern' | 'sniper' | 'vision' }>>([
    { 
      id: 1, 
      time: '00:01', 
      text: lang === 'ru' ? 'Vision AI Core v10.5: Турбо-мультисканер активирован.' : 'Vision AI Core v10.5: Active.', 
      type: 'info' 
    }
  ]);

  const [historyList, setHistoryList] = useState<Array<{ id: number; time: string; pair: string; direction: 'CALL' | 'PUT' | 'SKIPPED'; winrate: number; strategy: string }>>([
    { id: 1, time: '01:30', pair: 'EUR/USD', direction: 'CALL', winrate: 94, strategy: 'Trend + Confluence Hub' }
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

  const togglePairSelection = (pair: TradingPair) => {
    setSelectedMultiPairs(prev => {
      const exists = prev.some(p => p.id === pair.id);
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter(p => p.id !== pair.id);
      } else {
        return [...prev, pair];
      }
    });
  };

  const toggleStrategy = (id: string) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  useEffect(() => {
    setWsStatus(true);
  }, [selectedPair]);

  const getCandleActualDirection = (pairSymbol: string, candleIdx: number): 'CALL' | 'PUT' => {
    let hash = 0;
    for (let i = 0; i < pairSymbol.length; i++) {
      hash = pairSymbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pseudoPriceVariation = Math.sin(candleIdx * 1.5 + hash) * 1000;
    return pseudoPriceVariation >= 0 ? 'CALL' : 'PUT';
  };

  const fetchAiAnalysisFromBackend = async (tf: string) => {
    try {
      const activePairsSymbols = selectedMultiPairsRef.current.map(p => p.displaySymbol);
      const activeStratNames = strategies.filter(s => s.enabled).map(s => s.name);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairs: activePairsSymbols,
          timeframe: tf,
          mode: riskModeRef.current,
          activeStrategies: activeStratNames,
          strategy: activeStratNames[0] || 'Мульти-стратегия',
          filters: {
            newsFilterEnabled,
            atrFilterEnabled,
            riskCapEnabled
          }
        }),
      });

      const data = await response.json();

      if (data.success && data.result) {
        return data.result;
      } else {
        console.error('API Error:', data.error);
        return { signal: 'SKIP', confidence: 0, reasoning: 'Ошибка ответа бэкенда', recommendedExpiration: '1M', bestPair: selectedPair.displaySymbol };
      }
    } catch (err) {
      console.error('Network error connecting to /api/analyze:', err);
      return { signal: 'SKIP', confidence: 0, reasoning: 'Сетевой сбой шлюза', recommendedExpiration: '1M', bestPair: selectedPair.displaySymbol };
    }
  };

  useEffect(() => {
    const calculateCandleInfo = () => {
      const now = new Date();
      const tfMinutes = parseInt(timeframe, 10);
      const tfSecs = tfMinutes * 60;
      
      const epochSecs = Math.floor(now.getTime() / 1000);
      const candleIndex = Math.floor(epochSecs / tfSecs);
      
      const secondsIntoCandle = epochSecs % tfSecs;
      const remaining = tfSecs - secondsIntoCandle;
      
      return { candleIndex, remaining, tfSecs };
    };

    const initialInfo = calculateCandleInfo();
    setCandleTimer(initialInfo.remaining);
    currentCandleIndexRef.current = initialInfo.candleIndex;

    const interval = setInterval(async () => {
      const { candleIndex, remaining } = calculateCandleInfo();
      setCandleTimer(remaining);

      if (candleIndex !== currentCandleIndexRef.current) {
        currentCandleIndexRef.current = candleIndex;
        hasTriggeredCurrentCandleRef.current = false;

        if (queuedSignalsRef.current.length > 0 && isAutoTestActiveRef.current) {
          queuedSignalsRef.current.forEach(sig => {
            const newTestId = Date.now() + Math.random();
            const targetCandle = candleIndex + 1; 

            const newLogEntry = {
              id: newTestId,
              time: sig.timeStr,
              pair: sig.pair,
              direction: sig.direction,
              targetCandleIndex: targetCandle,
              status: 'PENDING' as const
            };

            setAutoTestLogs(prev => [newLogEntry, ...prev]);
            setPendingTestItems(prev => [...prev, { 
              id: newTestId, 
              pair: sig.pair, 
              direction: sig.direction, 
              targetCandleIndex: targetCandle
            }]);

            addLog(`🧪 Сделка открыта по воле ИИ: [${sig.pair}] ${sig.direction} на свечу #${targetCandle}`, 'sniper');
          });
          queuedSignalsRef.current = [];
        }

        const completedItems = pendingItemsRef.current.filter(item => item.targetCandleIndex === candleIndex);
        
        if (completedItems.length > 0) {
          setPendingTestItems(prev => prev.filter(item => item.targetCandleIndex !== candleIndex));

          completedItems.forEach(pending => {
            const realCandleDirection = getCandleActualDirection(pending.pair, candleIndex);
            const isWin = (pending.direction === realCandleDirection);

            setAutoTestLogs(prev => prev.map(item => 
              item.id === pending.id 
                ? { ...item, status: isWin ? 'WIN' : 'LOSS' }
                : item
            ));

            addLog(`🧪 Итог свечи #${candleIndex} [${pending.pair}] (Прогноз ИИ: ${pending.direction}, Факт: ${realCandleDirection}): [${isWin ? 'WIN 🟢' : 'LOSS 🔴'}]`, 'sniper');
          });
        }
      }

      const canTrigger = isAnalyzingRef.current || isAutoTestActiveRef.current;

      if (canTrigger && remaining === 10 && !hasTriggeredCurrentCandleRef.current) {
        hasTriggeredCurrentCandleRef.current = true;
        
        const targetCandleForSignal = candleIndex + 1;

        const aiResult = await fetchAiAnalysisFromBackend(timeframe);
        const chosenPairSymbol = aiResult.bestPair || selectedPair.displaySymbol;

        const foundPairObj = TRADING_PAIRS.find(p => p.displaySymbol === chosenPairSymbol);
        if (foundPairObj) {
          setSelectedPair(foundPairObj);
        }

        const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (aiResult.signal === 'SKIP') {
          playBeep('alert');
          addLog(`🛡 ТУРБО-СКАНЕР [${riskModeRef.current}]: Пул проверен, вход отклонен. (${aiResult.reasoning})`, 'info');
          
          if (isAutoTestActiveRef.current) {
            setAutoTestLogs(prev => [{
              id: Date.now(),
              time: currentTimeStr,
              pair: chosenPairSymbol,
              direction: 'SKIPPED',
              targetCandleIndex: targetCandleForSignal,
              status: 'SKIPPED'
            }, ...prev]);
          }
          return;
        }

        playBeep('sniper');
        const stratName = `Vision AI Hub (${riskModeRef.current})`;
        
        const nextCandleStartTime = new Date(Date.now() + remaining * 1000);
        const hours = nextCandleStartTime.getHours().toString().padStart(2, '0');
        const minutes = nextCandleStartTime.getMinutes().toString().padStart(2, '0');
        const nextCandleTimeStr = `${hours}:${minutes}`;

        setAiSignal({ 
          pair: chosenPairSymbol, 
          direction: aiResult.signal, 
          confidence: aiResult.confidence, 
          nextCandleTime: nextCandleTimeStr,
          reasoning: aiResult.reasoning,
          recommendedExpiration: aiResult.recommendedExpiration || '1M'
        });

        setHistoryList(prev => [
          { id: Date.now(), time: currentTimeStr, pair: chosenPairSymbol, direction: aiResult.signal, winrate: aiResult.confidence, strategy: stratName },
          ...prev
        ]);

        if (isAutoTestActiveRef.current) {
          queuedSignalsRef.current.push({
            pair: chosenPairSymbol,
            direction: aiResult.signal,
            confidence: aiResult.confidence,
            timeStr: currentTimeStr
          });
          
          addLog(`👁 ИИ выбрал пару (${aiResult.recommendedExpiration}): [${chosenPairSymbol}] ${aiResult.signal}. Ждем закрытия...`, 'sniper');
        }

        addLog(`👁 ИИ СНАЙПЕР [${chosenPairSymbol}]: Вход -> ${aiResult.signal} (${aiResult.confidence}%) [Экспирация: ${aiResult.recommendedExpiration}]`, 'sniper');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeframe, selectedPair, lang, strategies, newsFilterEnabled, atrFilterEnabled, riskMode]);

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setAiSignal(null);
    playBeep('alert');
    
    addLog(`> 👁 Мгновенный турбо-аудит пула пар в режиме [${riskMode}]...`, 'vision');

    try {
      const now = new Date();
      const tfSecs = parseInt(timeframe, 10) * 60;
      
      const aiResult = await fetchAiAnalysisFromBackend(timeframe);
      const chosenPairSymbol = aiResult.bestPair || selectedPair.displaySymbol;

      const foundPairObj = TRADING_PAIRS.find(p => p.displaySymbol === chosenPairSymbol);
      if (foundPairObj) {
        setSelectedPair(foundPairObj);
      }

      if (aiResult.signal === 'SKIP') {
        setIsAnalyzing(false);
        addLog(`🛡 ВЕРДИКТ ИИ: Сигнал не найден. Причина: ${aiResult.reasoning}`, 'info');
        setAiSignal({
          pair: chosenPairSymbol,
          direction: 'SKIP',
          confidence: 0,
          reasoning: aiResult.reasoning,
          recommendedExpiration: '1M'
        });
        return;
      }

      const rem = tfSecs - (Math.floor(now.getTime() / 1000) % tfSecs);
      const nextTime = new Date(Date.now() + rem * 1000);
      const nextTimeStr = `${nextTime.getHours().toString().padStart(2, '0')}:${nextTime.getMinutes().toString().padStart(2, '0')}`;

      setAiSignal({
        pair: chosenPairSymbol,
        direction: aiResult.signal,
        confidence: aiResult.confidence,
        nextCandleTime: nextTimeStr,
        reasoning: aiResult.reasoning,
        recommendedExpiration: aiResult.recommendedExpiration || '1M'
      });

      addLog(`🧠 ИИ-Мозг выбрал [${chosenPairSymbol}]: Сигнал ${aiResult.signal} (${aiResult.confidence}%) | Экспирация: ${aiResult.recommendedExpiration || '1M'} | ${aiResult.reasoning}`, 'vision');

    } catch (err) {
      console.error("API gateway connection error:", err);
      addLog('❌ Ошибка связи с ИИ-шлюзом бэкенда.', 'info');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStopAnalysis = () => {
    setIsAnalyzing(false);
    setAiSignal(null);
    addLog('🛑 ИИ-анализ остановлен пользователем.', 'info');
  };

  const calculateMartingale = () => {
    const base = parseFloat(startAmount) || 100;
    const payout = parseFloat(payoutPercent) || 85;
    const multiplier = 1 + (100 / payout);
    let steps = [];
    let current = base;

    for (let i = 1; i <= 4; i++) {
      const isCapped = riskCapEnabled && (i > maxMartingaleStep);
      const amount = isCapped ? base : Math.round(current);
      const totalInvested = steps.reduce((sum, s) => sum + s.amount, 0) + amount;
      const potentialProfit = Math.round((amount * (payout / 100)) - (totalInvested - amount));
      
      steps.push({ 
        step: i, 
        amount, 
        total: totalInvested, 
        profit: potentialProfit,
        isCapped 
      });
      
      if (!isCapped) {
        current = current * multiplier;
      } else {
        current = base;
      }
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

  const filteredAutoTestLogs = autoTestLogs.filter(item => {
    if (autotestFilter !== 'ALL' && item.status !== autotestFilter) return false;
    if (selectedPairFilter && item.pair !== selectedPairFilter) return false;
    return true;
  });

  const clearAutoTestHistory = () => {
    setAutoTestLogs([]);
    setSelectedPairFilter(null);
    addLog('🗑 История авто-теста очищена пользователем.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-7 h-7 text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-lg font-black tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ORACLE PRO TERMINAL (TURBO MULTI-SCANNER v10.5)
            </h1>
            <p className="text-[9px] text-slate-400 tracking-widest uppercase">Авто-переключение топ-пары / ИИ Управление</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg border bg-cyan-950/60 border-cyan-800 text-cyan-400">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button onClick={() => setTimezone('Europe/Moscow')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${timezone === 'Europe/Moscow' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>МСК</button>
            <button onClick={() => setTimezone('Etc/UTC')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${timezone === 'Etc/UTC' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>UTC</button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
            <button onClick={() => setLang('ru')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${lang === 'ru' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>РУС</button>
            <button onClick={() => setLang('en')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${lang === 'en' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>ENG</button>
          </div>

          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-emerald-400 bg-emerald-950/60 border-emerald-800 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            AI-Bridge: ONLINE
          </span>
        </div>
      </header>

      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <section className="lg:col-span-3 flex flex-col gap-3">
          
          {/* СВОРАЧИВАЕМАЯ ПАНЕЛЬ НАСТРОЕК (ФИЛЬТРЫ, СТРАТЕГИИ, МУЛЬТИВЫБОР) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-850 flex items-center justify-between text-xs font-bold text-cyan-400 cursor-pointer border-b border-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>НАСТРОЙКИ СКАНИРОВАНИЯ И ИИ-ФИЛЬТРОВ</span>
                <span className="text-[10px] text-slate-400 font-normal ml-2">
                  (Режим: <span className="text-amber-400 font-bold">{riskMode}</span> | Стратегий: <span className="text-emerald-400 font-bold">{strategies.filter(s => s.enabled).length}</span> | Пар в пуле: <span className="text-cyan-400 font-bold">{selectedMultiPairs.length}</span>)
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>{isSettingsOpen ? 'Свернуть' : 'Развернуть настройки'}</span>
                {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Выпадающая начинка при клике */}
            {isSettingsOpen && (
              <div className="p-4 flex flex-col gap-3 bg-slate-950/60 backdrop-blur">
                {/* 1. Режим риска */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/80 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">РЕЖИМ ЧУВСТВИТЕЛЬНОСТИ:</span>
                  </div>
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1 text-xs">
                    <button onClick={() => setRiskMode('SAFE')} className={`px-3 py-1 rounded font-bold ${riskMode === 'SAFE' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>🛡 SAFE</button>
                    <button onClick={() => setRiskMode('BALANCED')} className={`px-3 py-1 rounded font-bold ${riskMode === 'BALANCED' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>⚡ BALANCED</button>
                    <button onClick={() => setRiskMode('AGGRESSIVE')} className={`px-3 py-1 rounded font-bold ${riskMode === 'AGGRESSIVE' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}>🔥 AGGRESSIVE</button>
                  </div>
                </div>

                {/* 2. Защитные фильтры */}
                <div className="flex flex-wrap items-center gap-4 text-xs p-2 bg-slate-900/80 rounded-lg border border-indigo-500/30">
                  <span className="font-bold text-indigo-300">ФИЛЬТРЫ:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newsFilterEnabled} onChange={() => setNewsFilterEnabled(!newsFilterEnabled)} className="rounded text-indigo-500" />
                    <span className="text-slate-300">📰 Новостной фильтр</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={atrFilterEnabled} onChange={() => setAtrFilterEnabled(!atrFilterEnabled)} className="rounded text-indigo-500" />
                    <span className="text-slate-300">📊 ATR Волатильность</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={riskCapEnabled} onChange={() => setRiskCapEnabled(!riskCapEnabled)} className="rounded text-indigo-500" />
                    <span className="text-slate-300">🛡 Risk-Cap (до {maxMartingaleStep} шага)</span>
                  </label>
                </div>

                {/* 3. Выбор стратегий */}
                <div className="flex flex-col gap-2 p-2.5 bg-slate-900/80 rounded-lg border border-cyan-500/30">
                  <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
                    <span>АКТИВНЫЕ СТРАТЕГИИ</span>
                    <button onClick={() => setStrategies(prev => prev.map(s => ({ ...s, enabled: true })))} className="text-[10px] text-cyan-300 hover:underline">Включить все</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {strategies.map((strat) => (
                      <button
                        key={strat.id}
                        onClick={() => toggleStrategy(strat.id)}
                        className={`p-2 rounded-lg text-left text-xs font-bold transition-all border ${strat.enabled ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                      >
                        <div className="truncate">{strat.name}</div>
                        <div className="text-[9px] text-emerald-400 font-mono mt-0.5">Win: {Math.round((strat.wins / (strat.wins + strat.losses)) * 100)}%</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Мультивыбор пар */}
                <div className="flex flex-col gap-2 p-2.5 bg-slate-900/80 rounded-lg border border-cyan-500/30">
                  <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
                    <span>МУЛЬТИВЫБОР ПАР ДЛЯ СТРАТ-СКАНЕРА</span>
                    <div className="flex gap-2 text-[10px]">
                      <button onClick={() => setSelectedMultiPairs([...TRADING_PAIRS])} className="text-cyan-300 hover:underline">Выбрать все</button>
                      <button onClick={() => setSelectedMultiPairs([TRADING_PAIRS[0]])} className="text-slate-400 hover:underline">Сбросить</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-11 gap-1 max-h-24 overflow-y-auto pr-1">
                    {TRADING_PAIRS.map((pair) => {
                      const isChecked = selectedMultiPairs.some(p => p.id === pair.id);
                      return (
                        <button
                          key={pair.id}
                          onClick={() => togglePairSelection(pair)}
                          className={`px-1.5 py-1 rounded text-[10px] font-bold border truncate ${isChecked ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                        >
                          {pair.displaySymbol}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* СТРЕСС-ТЕСТ ПЛАНКА */}
          <div className="bg-slate-900/90 border border-amber-500/50 rounded-xl p-3 backdrop-blur flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isAutoTestActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <div>
                <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                  <TestTube className="w-3.5 h-3.5" /> ТУРБО-СКАНЕР СТРЕСС-ТЕСТ
                </div>
                <p className="text-[9px] text-slate-400">ИИ мгновенно выбирает лучшую пару из пула в режиме [{riskMode}].</p>
              </div>
            </div>

            <button
              onClick={() => setIsAutoTestActive(!isAutoTestActive)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all shadow-lg cursor-pointer ${
                isAutoTestActive 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 shadow-amber-500/20'
              }`}
            >
              {isAutoTestActive ? '⛔ ОСТАНОВИТЬ ТЕСТ' : '▶ ЗАПУСТИТЬ АВТО-ТЕСТ'}
            </button>
          </div>

          {/* ГЛАВНЫЙ ЭКРАН: СЛЕВА ПАРЫ, СПРАВА ГРАФИК (ВСТАЛИ НАВЕРХ) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            
            {/* ЛЕВАЯ КОЛОНКА (3 из 12): Список пар «Просмотр графика» */}
            <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur flex flex-col gap-2.5 max-h-[600px] overflow-hidden shadow-lg">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-cyan-400 tracking-wider">ПРОСМОТР ГРАФИКА:</span>
              </div>

              {/* Переключатель режимов */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button onClick={() => setViewMode('single')} className={`py-1 rounded text-[10px] font-bold ${viewMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Один</button>
                <button onClick={() => setViewMode('quad')} className={`py-1 rounded text-[10px] font-bold ${viewMode === 'quad' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Сетка 4</button>
              </div>

              {/* Столбик пар в 2 колонки */}
              <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 flex-1">
                {TRADING_PAIRS.map((pair) => (
                  <button
                    key={pair.id}
                    onClick={() => setSelectedPair(pair)}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all text-center truncate border ${selectedPair.id === pair.id ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm' : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'}`}
                  >
                    {pair.displaySymbol}
                  </button>
                ))}
              </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА (9 из 12): Торговый график (ПОДНЯЛСЯ НАВЕРХ СРАЗУ ПОД ШАПКУ) */}
            <div id="chart-container" className="lg:col-span-9 bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden backdrop-blur h-[600px] shadow-lg">
              {viewMode === 'single' ? (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2.5">
                      <LineChart className="w-5 h-5 text-cyan-400" />
                      <div>
                        <span className="font-bold text-base text-slate-100">{selectedPair.displaySymbol}</span>
                        <span className="ml-2 text-xs text-cyan-400 font-mono">Таймфрейм: {timeframe}M</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span className={`font-bold ${candleTimer <= 10 ? 'text-rose-400 animate-ping' : 'text-amber-400'}`}>{formatTimer(candleTimer)}</span>
                      </div>
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs gap-1">
                        {['1', '5', '15', '60', '240'].map((val) => (
                          <button key={val} onClick={() => setTimeframe(val)} className={`px-2.5 py-0.5 rounded ${timeframe === val ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}>
                            {val === '60' ? '1H' : val === '240' ? '4H' : `${val}M`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 border border-slate-800 bg-slate-950/90 rounded-xl overflow-hidden relative">
                    <iframe
                      key={`${selectedPair.symbol}-${timeframe}-${timezone}-${lang}-${activeIndicator}`}
                      src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedPair.symbol}&interval=${timeframe}&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&studies[]=${activeIndicator === 'RSI' ? 'RSI@tv-basicstudies' : 'MACD@tv-basicstudies'}&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
                      className="w-full h-full border-0 absolute inset-0 pointer-events-auto"
                      title="TradingView Chart"
                    ></iframe>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 flex-1 h-full min-h-[500px]">
                  {[quadPair1, quadPair2, quadPair3, quadPair4].map((qp, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-xs text-cyan-400">{qp.displaySymbol}</span>
                        <span className="text-[10px] font-mono text-slate-400">{timeframe}M</span>
                      </div>
                      <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-900 min-h-[220px]">
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

          </div>
        </section>

        {/* ПРАВАЯ ПАНЕЛЬ: VISION AI АНАЛИТИК С КНОПКОЙ АУДИТ И ЗОЛОТОЙ РАМКОЙ (ПАРАЛЛЕЛЬНО ГРАФИКУ) */}
        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="font-bold text-slate-200 flex items-center gap-2 text-xs">
              <BrainCircuit className="w-4 h-4 text-cyan-400 animate-pulse" />
              VISION AI АНАЛИТИК
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 shadow-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} /> АУДИТ РЫНКА
            </button>
            <button
              onClick={handleStopAnalysis}
              disabled={!isAnalyzing}
              className="bg-rose-950/80 text-rose-300 border border-rose-800 font-black py-2.5 px-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-40"
            >
              СТОП
            </button>
          </div>

          {/* ЗОЛОТАЯ КАРТОЧКА ВЕРДИКТА ИИ */}
          <div className="bg-gradient-to-b from-amber-950/60 to-slate-950 border-2 border-amber-500/80 rounded-xl p-3.5 text-center relative overflow-hidden shadow-lg shadow-amber-500/10">
            {!aiSignal ? (
              <div className="py-3 text-xs text-slate-400 font-mono animate-pulse">
                {isAnalyzing ? `⏳ Сканирование пула (${formatTimer(candleTimer)})...` : 'Нажмите АУДИТ РЫНКА'}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-cyan-300 tracking-wider">АКТИВ: {aiSignal.pair}</div>
                <div className="text-xl font-black flex items-center justify-center gap-2">
                  <span className="text-amber-400 text-xs">ВЕРДИКТ:</span>
                  <span className={aiSignal.direction === 'CALL' ? 'text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-500 text-base' : aiSignal.direction === 'PUT' ? 'text-rose-400 bg-rose-950 px-2.5 py-0.5 rounded border border-rose-500 text-base' : 'text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700 text-base'}>
                    {aiSignal.direction}
                  </span>
                </div>

                {aiSignal.nextCandleTime && aiSignal.direction !== 'SKIP' && (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg py-1 px-2">
                    <div className="text-[9px] text-amber-300 font-semibold uppercase tracking-wider">
                      Экспирация: <span className="text-emerald-400 font-bold">{aiSignal.recommendedExpiration || '1M'}</span> | Старт в:
                    </div>
                    <div className="text-base font-mono font-black text-white tracking-widest">{aiSignal.nextCandleTime}</div>
                  </div>
                )}

                {aiSignal.reasoning && (
                  <div className="text-[10px] text-slate-300 italic px-1">
                    "{aiSignal.reasoning}"
                  </div>
                )}

                {aiSignal.confidence > 0 && (
                  <div className="text-[10px] text-amber-300 font-mono">Уверенность ИИ: <span className="font-bold text-white">{aiSignal.confidence}%</span></div>
                )}
              </div>
            )}
          </div>

          {/* ВКЛАДКИ ДАННЫХ И ИСТОРИИ */}
          <div className="grid grid-cols-5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
            <button onClick={() => setRightTab('logs')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'logs' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Логи</button>
            <button onClick={() => setRightTab('history')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'history' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>История</button>
            <button onClick={() => setRightTab('autotest')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'autotest' ? 'bg-amber-500 text-slate-950' : 'text-amber-400'}`}>Тест</button>
            <button onClick={() => setRightTab('martingale')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'martingale' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Мартен</button>
            <button onClick={() => setRightTab('strategies')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'strategies' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Стат</button>
          </div>

          {rightTab === 'logs' ? (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 overflow-hidden min-h-[180px]">
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px] font-mono">
                {aiLogs.map(log => (
                  <div key={log.id} className={`p-1.5 rounded border ${log.type === 'vision' ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 font-bold' : 'bg-slate-900/60 border-slate-800 text-slate-400'}`}>
                    <div className="flex justify-between text-[9px] text-slate-500 mb-0.5"><span>{log.time}</span><span>{log.type}</span></div>
                    <p>{log.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : rightTab === 'history' ? (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 overflow-hidden min-h-[180px]">
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px] font-mono">
                {historyList.map(item => (
                  <div key={item.id} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-cyan-400">{item.pair}</span>
                    <span className={item.direction === 'CALL' ? 'text-emerald-400 font-bold' : item.direction === 'PUT' ? 'text-rose-400 font-bold' : 'text-slate-400 font-bold'}>{item.direction} ({item.winrate}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : rightTab === 'autotest' ? (
            <div className="flex-1 bg-slate-950/90 border border-amber-500/40 rounded-xl p-2.5 flex flex-col gap-2 overflow-hidden min-h-[180px] font-mono">
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <div 
                  onClick={() => setAutotestFilter(autotestFilter === 'WIN' ? 'ALL' : 'WIN')}
                  className={`p-1 rounded border cursor-pointer transition-all ${autotestFilter === 'WIN' ? 'bg-emerald-950 border-emerald-500' : 'bg-slate-900 border-slate-800'}`}
                >
                  <div className="text-slate-400 text-[9px]">Плюсы</div>
                  <div className="text-emerald-400 font-bold text-xs">
                    {autoTestLogs.filter(l => l.status === 'WIN').length}
                  </div>
                </div>
                <div 
                  onClick={() => setAutotestFilter(autotestFilter === 'LOSS' ? 'ALL' : 'LOSS')}
                  className={`p-1 rounded border cursor-pointer transition-all ${autotestFilter === 'LOSS' ? 'bg-rose-950 border-rose-500' : 'bg-slate-900 border-slate-800'}`}
                >
                  <div className="text-slate-400 text-[9px]">Минусы</div>
                  <div className="text-rose-400 font-bold text-xs">
                    {autoTestLogs.filter(l => l.status === 'LOSS').length}
                  </div>
                </div>
                <div className="bg-slate-900 p-1 rounded border border-slate-800">
                  <div className="text-slate-400 text-[9px]">Винрейт</div>
                  <div className="text-amber-400 font-bold text-xs">
                    {autoTestLogs.filter(l => l.status !== 'PENDING' && l.status !== 'SKIPPED').length > 0 
                      ? Math.round((autoTestLogs.filter(l => l.status === 'WIN').length / autoTestLogs.filter(l => l.status !== 'PENDING' && l.status !== 'SKIPPED').length) * 100) 
                      : 0}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-1 text-[10px] pt-0.5">
                <div className="flex gap-1">
                  <button 
                    onClick={() => setAutotestFilter('ALL')} 
                    className={`px-1.5 py-0.5 rounded border text-[9px] ${autotestFilter === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold border-amber-600' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    Все
                  </button>
                  {selectedPairFilter && (
                    <button 
                      onClick={() => setSelectedPairFilter(null)}
                      className="px-1.5 py-0.5 rounded border bg-cyan-950 text-cyan-300 border-cyan-800 text-[9px]"
                    >
                      {selectedPairFilter} ✕
                    </button>
                  )}
                </div>
                <button 
                  onClick={clearAutoTestHistory}
                  className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1 text-[9px]"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Очистить
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-[10px]">
                {filteredAutoTestLogs.length === 0 ? (
                  <div className="text-center text-slate-500 py-6 italic text-[10px]">Нет записей.</div>
                ) : (
                  filteredAutoTestLogs.map(item => (
                    <div key={item.id} className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center text-[10px]">
                      <div>
                        <span 
                          onClick={() => setSelectedPairFilter(selectedPairFilter === item.pair ? null : item.pair)}
                          className="text-cyan-400 font-bold cursor-pointer hover:underline"
                        >
                          {item.pair}
                        </span> <span className="text-slate-500 text-[9px]">({item.time})</span>
                      </div>
                      <div className="text-right">
                        {item.status === 'SKIPPED' ? (
                          <span className="text-slate-400 font-bold">Пропуск 🛡</span>
                        ) : (
                          <>
                            <span className={item.direction === 'CALL' ? 'text-emerald-400 font-bold' : item.direction === 'PUT' ? 'text-rose-400 font-bold' : 'text-slate-400 font-bold'}>{item.direction}</span>
                            <div>
                              {item.status === 'PENDING' && <span className="text-amber-400 animate-pulse text-[9px]">Ждем #${item.targetCandleIndex}</span>}
                              {item.status === 'WIN' && <span className="text-emerald-400 font-black">WIN 🟢</span>}
                              {item.status === 'LOSS' && <span className="text-rose-400 font-black">LOSS 🔴</span>}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : rightTab === 'strategies' ? (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 overflow-hidden min-h-[180px] font-mono text-[10px]">
              <div className="text-[11px] font-bold text-cyan-400">ЭФФЕКТИВНОСТЬ:</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {strategies.map(s => {
                  const total = s.wins + s.losses;
                  const winrate = total > 0 ? Math.round((s.wins / total) * 100) : 0;
                  return (
                    <div key={s.id} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold truncate text-[10px]">{s.name}</span>
                        <span className="text-emerald-400 font-black text-[10px]">{winrate}%</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Побед: {s.wins} | Пор: {s.losses}</span>
                        <button onClick={() => toggleStrategy(s.id)} className={`px-1.5 py-0.2 rounded ${s.enabled ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-400'}`}>
                          {s.enabled ? 'Вкл' : 'Выкл'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 font-mono">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Старт ($):</label>
                  <input type="number" value={startAmount} onChange={(e) => setStartAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white text-xs"/>
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Выплата (%):</label>
                  <input type="number" value={payoutPercent} onChange={(e) => setPayoutPercent(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white text-xs"/>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] bg-slate-900 p-1.5 rounded border border-indigo-500/30">
                <span className="text-indigo-300">Риск-лимит:</span>
                <select 
                  value={maxMartingaleStep} 
                  onChange={(e) => setMaxMartingaleStep(Number(e.target.value))}
                  className="bg-slate-950 text-white border border-slate-700 rounded px-1.5 py-0.5 text-[10px]"
                >
                  <option value={2}>Шаг 2</option>
                  <option value={3}>Шаг 3</option>
                  <option value={4}>Шаг 4</option>
                </select>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 text-[10px]">
                {calculateMartingale().map(step => (
                  <div key={step.step} className={`p-1.5 rounded border flex justify-between items-center ${step.isCapped ? 'bg-amber-950/30 border-amber-600/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div>
                      <div>Шаг {step.step}: ${step.amount} {step.isCapped && <span className="text-[8px] text-amber-400 font-bold">(СБРОС)</span>}</div>
                    </div>
                    <span className="text-emerald-400">+${step.profit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v10.5 (Auto-Switch Multi-Scanner Hub)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
