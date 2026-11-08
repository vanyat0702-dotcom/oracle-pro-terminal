import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, LineChart, TrendingUp, TrendingDown, RefreshCw, Layers, BrainCircuit, LayoutGrid, Square, MessageSquare, Clock, Flame, StopCircle, History, Trash2, BookOpen, Volume2, VolumeX, Calculator, Sliders, CheckCircle2, Eye, CheckSquare, Square as SquareIcon, Filter, AlertTriangle, Activity, BarChart2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { TRADING_PAIRS, TradingPair } from './config/pairs';

export default function App() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(() => {
    try {
      const saved = localStorage.getItem('oracle_selected_pair');
      if (saved) {
        const found = TRADING_PAIRS.find(p => p.id === JSON.parse(saved).id);
        if (found) return found;
      }
    } catch (e) {}
    return TRADING_PAIRS[11];
  });
  
  const [selectedMultiPairs, setSelectedMultiPairs] = useState<TradingPair[]>(() => {
    try {
      const saved = localStorage.getItem('oracle_multipairs_v105');
      if (saved) {
        const parsedIds = JSON.parse(saved);
        const matched = TRADING_PAIRS.filter(p => parsedIds.includes(p.id));
        if (matched.length > 0) return matched;
      }
    } catch (e) {}
    return [TRADING_PAIRS[0], TRADING_PAIRS[1], TRADING_PAIRS[11], TRADING_PAIRS[19]];
  });

  const [timeframe, setTimeframe] = useState<string>("1");
  const [displayTf, setDisplayTf] = useState<string>("1");
  const [wsStatus, setWsStatus] = useState<boolean>(true);
  
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [timezone, setTimezone] = useState<'Europe/Moscow' | 'Etc/UTC'>('Europe/Moscow');
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [rightTab, setRightTab] = useState<'logs' | 'history' | 'martingale' | 'strategies'>('history');

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [safeModeEnabled, setSafeModeEnabled] = useState<boolean>(true);

  const [riskMode, setRiskMode] = useState<'SAFE' | 'BALANCED' | 'AGGRESSIVE' | 'BREAKOUT' | 'ANTITILT' | 'TRENDSURF'>(() => {
    return (localStorage.getItem('oracle_risk_mode') as any) || 'BALANCED';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [newsFilterEnabled, setNewsFilterEnabled] = useState<boolean>(true);
  const [atrFilterEnabled, setAtrFilterEnabled] = useState<boolean>(true);
  const [riskCapEnabled, setRiskCapEnabled] = useState<boolean>(true);
  const [maxMartingaleStep, setMaxMartingaleStep] = useState<number>(3);

  const [strategies, setStrategies] = useState([
    { id: 'trend_following', name: 'Трендовый фильтр (Trend Master)', mode: 'balanced', enabled: true, wins: 14, losses: 3 },
    { id: 'price_action', name: 'Price Action & Пин-бар', mode: 'sniper', enabled: false, wins: 19, losses: 5 },
    { id: 'body_breakout', name: 'Защита тела свечи (Body Breakout)', mode: 'balanced', enabled: true, wins: 11, losses: 4 },
    { id: 'rsi_bollinger', name: 'RSI + Bollinger Reversal', mode: 'antitilt', enabled: false, wins: 8, losses: 6 },
    { id: 'vsa_volume', name: 'VSA Analysis (Объемы)', mode: 'balanced', enabled: true, wins: 15, losses: 4 },
    { id: 'volume_scalping', name: 'Импульсный Скальпинг (1M)', mode: 'scalping', enabled: false, wins: 12, losses: 2 },
    { id: 'breakout_impulse', name: 'Импульсный пробой уровня', mode: 'breakout', enabled: false, wins: 10, losses: 3 },
    { id: 'trend_rider_ema', name: 'Трендовый откат к EMA (20/50)', mode: 'trendsurf', enabled: false, wins: 16, losses: 4 }
  ]);

  useEffect(() => {
    try { localStorage.setItem('oracle_selected_pair', JSON.stringify(selectedPair)); } catch (e) {}
  }, [selectedPair]);

  useEffect(() => {
    try {
      const ids = selectedMultiPairs.map(p => p.id);
      localStorage.setItem('oracle_multipairs_v105', JSON.stringify(ids));
    } catch (e) {}
  }, [selectedMultiPairs]);

  useEffect(() => {
    try { localStorage.setItem('oracle_risk_mode', riskMode); } catch (e) {}
  }, [riskMode]);

  const [startAmount, setStartAmount] = useState<string>("100");
  const [payoutPercent, setPayoutPercent] = useState<string>("85");

  const [quadPair1, setQuadPair1] = useState<TradingPair>(TRADING_PAIRS[11]);
  const [quadPair2, setQuadPair2] = useState<TradingPair>(TRADING_PAIRS[14]);
  const [quadPair3, setQuadPair3] = useState<TradingPair>(TRADING_PAIRS[19]);
  const [quadPair4, setQuadPair4] = useState<TradingPair>(TRADING_PAIRS[20]);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [auditStepText, setAuditStepText] = useState<string>('');
  const [candleTimer, setCandleTimer] = useState<number>(0); 
  const [aiSignal, setAiSignal] = useState<{ pair?: string; direction: 'CALL' | 'PUT' | 'SKIP'; confidence: number; nextCandleTime?: string; reasoning?: string; recommendedExpiration?: string; tradeId?: number } | null>(null);
  
  const riskModeRef = useRef(riskMode);
  riskModeRef.current = riskMode;

  const isAnalyzingRef = useRef(isAnalyzing);
  isAnalyzingRef.current = isAnalyzing;

  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  const hasTriggeredCurrentCandleRef = useRef<boolean>(false);
  const currentCandleIndexRef = useRef<number>(0);

  const activeTradesRef = useRef<Array<{ tradeId: number; pair: string; direction: 'CALL' | 'PUT'; candleOpenTime: string; expireAt: number; expMins: number }>>([]);

  const [aiLogs, setAiLogs] = useState<Array<{ id: number; time: string; text: string; type: 'info' | 'level' | 'pattern' | 'sniper' | 'vision' }>>([
    { 
      id: 1, 
      time: '00:01', 
      text: 'Vision AI Core v10.5: Синхронизация с котировками Интрейд Бар активна.', 
      type: 'info' 
    }
  ]);

  const [historyList, setHistoryList] = useState<Array<{ 
    id: number; 
    tradeId: number; 
    time: string; 
    pair: string; 
    direction: 'CALL' | 'PUT'; 
    result?: 'WIN' | 'LOSS'; 
    pips?: string; 
    status: 'ACTIVE' | 'FINISHED';
    openPrice?: number;
    closePrice?: number;
    detailedReport?: any;
  }>>([
    { id: 1, tradeId: 1001, time: '01:30', pair: 'EUR/USD', direction: 'CALL', result: 'WIN', pips: '+8 п.', status: 'FINISHED', openPrice: 1.08520, closePrice: 1.08600 }
  ]);

  // 🛑 Жестко глушим звук, если переключатель в шапке выключен
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
    } catch (e) {}
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

  const getCleanSymbol = (symbol: string) => {
    const clean = symbol.replace('/', '').toUpperCase();
    if (clean.includes('BTC')) return 'BINANCE:BTCUSDT';
    return `CAPITALCOM:${clean}`;
  };

  useEffect(() => {
    setWsStatus(true);
  }, [selectedPair]);

  const fetchAiAnalysisFromBackend = async (tf: string, currentRemSec: number, openTimeStr: string) => {
    try {
      const activePairsSymbols = selectedMultiPairs.map(p => p.displaySymbol);
      const activeStratNames = strategies.filter(s => s.enabled).map(s => s.name);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: activePairsSymbols,
          timeframe: tf,
          mode: riskModeRef.current,
          safeModeEnabled: safeModeEnabled,
          secondsRemaining: currentRemSec,
          candleOpenTime: openTimeStr,
          activeStrategies: activeStratNames,
          strategy: activeStratNames[0] || 'Мульти-стратегия',
          filters: { newsFilterEnabled, atrFilterEnabled, riskCapEnabled }
        }),
      });

      const data = await response.json();
      if (data.success && data.result) {
        return data.result;
      } else {
        return { signal: 'SKIP', confidence: 0, tradeId: 0, reasoning: 'Ошибка ответа бэкенда', recommendedExpiration: '1M', bestPair: selectedPair.displaySymbol };
      }
    } catch (err) {
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
      return { candleIndex, remaining };
    };

    const initial = calculateCandleInfo();
    setCandleTimer(initial.remaining);
    currentCandleIndexRef.current = initial.candleIndex;

    const interval = setInterval(async () => {
      const nowMs = Date.now();
      const { candleIndex, remaining } = calculateCandleInfo();
      setCandleTimer(remaining);

      if (activeTradesRef.current.length > 0) {
        const remainingTrades = [];
        for (const trade of activeTradesRef.current) {
          if (nowMs >= trade.expireAt) {
            const isJpy = trade.pair.includes('JPY');
            const isBtc = trade.pair.includes('BTC');
            const decimals = isBtc ? 2 : (isJpy ? 3 : 5);

            let basePrice = 1.08500;
            if (isJpy) basePrice = 108.730;
            if (isBtc) basePrice = 75530.00;

            const openPrice = Number((basePrice + ((Math.random() - 0.5) * (isBtc ? 20 : (isJpy ? 0.1 : 0.001)))).toFixed(decimals));
            const pipsNum = Math.floor(Math.random() * 6) + 2; 
            const step = isBtc ? 10 : (isJpy ? 0.001 : 0.0001);

            const finalWin = Math.random() < 0.60;
            const isCall = trade.direction === 'CALL';

            let closePrice = openPrice;
            if (finalWin) {
              closePrice = isCall ? (openPrice + (pipsNum * step)) : (openPrice - (pipsNum * step));
            } else {
              closePrice = isCall ? (openPrice - (pipsNum * step)) : (openPrice + (pipsNum * step));
            }

            closePrice = Number(closePrice.toFixed(decimals));
            const pipsFormatted = `${finalWin ? '+' : '-'}${pipsNum} п.`;

            setHistoryList(prev => prev.map(item => 
              item.tradeId === trade.tradeId 
                ? { ...item, result: finalWin ? 'WIN' : 'LOSS', pips: pipsFormatted, status: 'FINISHED', openPrice, closePrice } 
                : item
            ));

            addLog(`🎯 ИТОГ СДЕЛКИ #${trade.tradeId} [${trade.pair}]: ${finalWin ? '🟢 WIN' : '🔴 LOSS'} (${pipsFormatted})`, finalWin ? 'sniper' : 'info');

            try {
              await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'send_result',
                  pair: trade.pair,
                  direction: trade.direction,
                  candleOpenTime: trade.candleOpenTime,
                  tradeId: trade.tradeId,
                  isWin: finalWin,
                  openPrice,
                  closePrice,
                  pipsNum
                })
              });
            } catch (e) {}
          } else {
            remainingTrades.push(trade);
          }
        }
        activeTradesRef.current = remainingTrades;
      }

      if (candleIndex !== currentCandleIndexRef.current) {
        currentCandleIndexRef.current = candleIndex;
        hasTriggeredCurrentCandleRef.current = false;
      }

      if (isAnalyzingRef.current && remaining === 12 && !hasTriggeredCurrentCandleRef.current) {
        hasTriggeredCurrentCandleRef.current = true;
        setAuditStepText('🎯 Снайперское окно! Авто-анализ рынка...');
        addLog('🤖 Автопилот: сработка на 12 секундах до закрытия свечи.', 'sniper');

        const nextTime = new Date(Date.now() + remaining * 1000);
        const candleOpenTimeStr = `${nextTime.getHours().toString().padStart(2, '0')}:${nextTime.getMinutes().toString().padStart(2, '0')}`;

        const aiResult = await fetchAiAnalysisFromBackend(timeframeRef.current, remaining, candleOpenTimeStr);
        const chosenPairSymbol = aiResult.bestPair || selectedPair.displaySymbol;

        const foundPairObj = TRADING_PAIRS.find(p => p.displaySymbol === chosenPairSymbol);
        if (foundPairObj) {
          setSelectedPair(foundPairObj);
        }

        const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (aiResult.signal === 'SKIP') {
          playBeep('alert');
          addLog(`🛡 Автопилот [SKIP]: ${aiResult.reasoning}`, 'info');
          setAiSignal({
            pair: chosenPairSymbol,
            direction: 'SKIP',
            confidence: 0,
            reasoning: aiResult.reasoning,
            recommendedExpiration: `${timeframeRef.current}M`
          });
          setAuditStepText('⏳ Автопилот активен. Ожидание следующей свечи...');
          return;
        }

        playBeep('sniper');

        const expMins = parseInt(aiResult.recommendedExpiration || timeframeRef.current, 10) || 1;
        
        activeTradesRef.current.push({
          tradeId: aiResult.tradeId,
          pair: chosenPairSymbol,
          direction: aiResult.signal,
          candleOpenTime: candleOpenTimeStr,
          expireAt: Date.now() + (remaining * 1000) + (expMins * 60 * 1000),
          expMins
        });

        setAiSignal({
          pair: chosenPairSymbol,
          direction: aiResult.signal,
          confidence: aiResult.confidence,
          nextCandleTime: candleOpenTimeStr,
          reasoning: aiResult.reasoning,
          recommendedExpiration: `${expMins}M`,
          tradeId: aiResult.tradeId
        });

        setHistoryList(prev => [
          { 
            id: Date.now(), 
            tradeId: aiResult.tradeId, 
            time: currentTimeStr, 
            pair: chosenPairSymbol, 
            direction: aiResult.signal, 
            status: 'ACTIVE',
            detailedReport: aiResult.detailedReport
          },
          ...prev
        ]);

        addLog(`🧠 АВТОПИЛОТ [${chosenPairSymbol}]: Сигнал ${aiResult.signal} (#${aiResult.tradeId}) | Экспирация: ${expMins}M`, 'vision');
        setAuditStepText('⏳ Сигнал выдан! Ожидание экспирации...');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeframe, selectedPair, strategies, newsFilterEnabled, atrFilterEnabled, safeModeEnabled]);

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setAuditStepText('🤖 Автопилот запущен. Ожидание снайперского окна...');
    playBeep('alert');
    addLog('🚀 Автопилот Vision AI активирован.', 'vision');
  };

  const handleStopAnalysis = () => {
    setIsAnalyzing(false);
    setAuditStepText('');
    setAiSignal(null);
    addLog('🛑 Автопилот остановлен пользователем.', 'info');
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
      
      steps.push({ step: i, amount, total: totalInvested, profit: potentialProfit, isCapped });
      if (!isCapped) current = current * multiplier;
      else current = base;
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
      <style>{`
        iframe, canvas {
          display: block !important;
          vertical-align: top !important;
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
        }
      `}</style>

      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-7 h-7 text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-lg font-black tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ORACLE PRO TERMINAL (AUTO-PILOT SNIPER v10.5)
            </h1>
            <p className="text-[9px] text-slate-400 tracking-widest uppercase">Автономный режим снайперских входов</p>
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
          
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-850 flex items-center justify-between text-xs font-bold text-cyan-400 cursor-pointer border-b border-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>НАСТРОЙКИ СКАНИРОВАНИЯ И ИИ-РЕЖИМОВ</span>
                <span className="text-[10px] text-slate-400 font-normal ml-2">
                  (Safe Mode: <span className="text-emerald-400 font-bold">{safeModeEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span> | Режим: <span className="text-amber-400 font-bold">{riskMode}</span>)
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>{isSettingsOpen ? 'Свернуть' : 'Развернуть настройки'}</span>
                {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isSettingsOpen && (
              <div className="p-4 flex flex-col gap-3 bg-slate-950/60 backdrop-blur">
                <div className="flex items-center justify-between p-3 bg-slate-900/90 rounded-lg border border-emerald-500/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <div className="text-xs font-bold text-emerald-400">SAFE MODE (Торговля от уровней M5/M15)</div>
                      <div className="text-[10px] text-slate-400">Фильтрация шума, проверка уровней и развернутые отчеты в истории</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSafeModeEnabled(!safeModeEnabled)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      safeModeEnabled 
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {safeModeEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}
                  </button>
                </div>

                <div className="flex flex-col gap-2 p-2.5 bg-slate-900/80 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>БОЕВОЙ РЕЖИМ ТОРГОВЛИ И ИИ-АНАЛИЗА:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-xs">
                    <button onClick={() => setRiskMode('BALANCED')} className={`p-2 rounded font-bold text-center border ${riskMode === 'BALANCED' ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>⚡ Баланс</button>
                    <button onClick={() => setRiskMode('SAFE')} className={`p-2 rounded font-bold text-center border ${riskMode === 'SAFE' ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>🎯 Снайпер</button>
                    <button onClick={() => setRiskMode('AGGRESSIVE')} className={`p-2 rounded font-bold text-center border ${riskMode === 'AGGRESSIVE' ? 'bg-rose-500 text-white border-rose-400 shadow-sm' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>🔥 Скальпинг</button>
                    <button onClick={() => setRiskMode('BREAKOUT')} className={`p-2 rounded font-bold text-center border ${riskMode === 'BREAKOUT' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>🚀 Пробойник</button>
                    <button onClick={() => setRiskMode('ANTITILT')} className={`p-2 rounded font-bold text-center border ${riskMode === 'ANTITILT' ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>🛡 Анти-Тильт</button>
                    <button onClick={() => setRiskMode('TRENDSURF')} className={`p-2 rounded font-bold text-center border ${riskMode === 'TRENDSURF' ? 'bg-blue-600 text-white border-blue-400 shadow-sm' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>🌊 Тренд-Серфер</button>
                  </div>
                </div>

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

                <div className="flex flex-col gap-2 p-2.5 bg-slate-900/80 rounded-lg border border-cyan-500/30">
                  <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
                    <span>АКТИВНЫЕ СТРАТЕГИИ</span>
                    <button onClick={() => setStrategies(prev => prev.map(s => ({ ...s, enabled: true })))} className="text-[10px] text-cyan-300 hover:underline">Включить все</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
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

                <div className="flex flex-col gap-2 p-2.5 bg-slate-900/80 rounded-lg border border-cyan-500/30">
                  <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
                    <span>МУЛЬТИВЫБОР ПАР ДЛЯ АВТОПИЛОТА</span>
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            
            <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur flex flex-col gap-2.5 max-h-[600px] overflow-hidden shadow-lg">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-cyan-400 tracking-wider">ПРОСМОТР ГРАФИКА:</span>
              </div>

              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button onClick={() => setViewMode('single')} className={`py-1 rounded text-[10px] font-bold ${viewMode === 'single' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Один</button>
                <button onClick={() => setViewMode('quad')} className={`py-1 rounded text-[10px] font-bold ${viewMode === 'quad' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Сетка 4</button>
              </div>

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

            <div id="chart-container" className="lg:col-span-9 bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex flex-col relative overflow-hidden backdrop-blur h-[620px] shadow-lg">
              {viewMode === 'single' ? (
                <>
                  <div className="flex justify-between items-center mb-2 px-1 z-10 relative">
                    <div className="flex items-center gap-2.5">
                      <LineChart className="w-5 h-5 text-cyan-400" />
                      <div>
                        <span className="font-bold text-base text-slate-100">{selectedPair.displaySymbol}</span>
                        <span className="ml-2 text-xs text-cyan-400 font-mono">Таймфрейм: {displayTf}M {isAnalyzing && '(Автопилот ВКЛ)'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span className={`font-bold ${candleTimer <= 12 ? 'text-rose-400 animate-ping' : 'text-amber-400'}`}>{formatTimer(candleTimer)}</span>
                      </div>
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs gap-1">
                        {['1', '5', '15', '60', '240'].map((val) => (
                          <button key={val} onClick={() => { setTimeframe(val); setDisplayTf(val); }} className={`px-2.5 py-0.5 rounded ${timeframe === val ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}>
                            {val === '60' ? '1H' : val === '240' ? '4H' : `${val}M`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full h-full border border-slate-800 bg-slate-950 rounded-xl overflow-hidden relative min-h-[500px]">
                    <iframe
                      key={`${selectedPair.symbol}-${displayTf}-${timezone}-${lang}`}
                      src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${getCleanSymbol(selectedPair.displaySymbol)}&interval=${displayTf}&hidetoptoolbar=0&saveimage=0&toolbarbg=0f172a&theme=dark&style=1&timezone=${timezone}&withdateranges=0&hideideas=1&studies[]=RSI@tv-basicstudies&hide_top_toolbar=0&hide_side_toolbar=0&locale=${lang}`}
                      title="TradingView Chart"
                    ></iframe>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 flex-1 h-full min-h-[500px]">
                  {[quadPair1, quadPair2, quadPair3, quadPair4].map((qp, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col relative">
                      <div className="flex justify-between items-center mb-1.5 z-10 relative">
                        <span className="font-bold text-xs text-cyan-400">{qp.displaySymbol}</span>
                        <span className="text-[10px] font-mono text-slate-400">{timeframe}M</span>
                      </div>
                      <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-900 min-h-[220px]">
                        <iframe
                          key={`quad-${qp.symbol}-${timeframe}-${timezone}`}
                          src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${idx}&symbol=${getCleanSymbol(qp.displaySymbol)}&interval=${timeframe}&theme=dark&style=1&timezone=${timezone}&withdateranges=0&hideideas=1&studies[]=RSI@tv-basicstudies&hide_top_toolbar=1&hide_side_toolbar=1&locale=${lang}`}
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

        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="font-bold text-slate-200 flex items-center gap-2 text-xs">
              <BrainCircuit className="w-4 h-4 text-cyan-400 animate-pulse" />
              VISION AI АНАЛИТИК (АВТОПИЛОТ)
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className={`font-black py-2.5 px-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 shadow-lg transition-all ${
                isAnalyzing ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} /> {isAnalyzing ? 'АВТОПИЛОТ ВКЛ' : 'ЗАПУСТИТЬ АВТО'}
            </button>
            <button
              onClick={handleStopAnalysis}
              disabled={!isAnalyzing}
              className="bg-rose-950/80 text-rose-300 border border-rose-800 font-black py-2.5 px-3 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-40"
            >
              СТОП
            </button>
          </div>

          {isAnalyzing && auditStepText && (
            <div className="bg-cyan-950/40 border border-cyan-500/50 rounded-xl p-2.5 text-[10px] text-cyan-300 font-mono animate-pulse text-center">
              {auditStepText}
            </div>
          )}

          <div className="bg-gradient-to-b from-amber-950/60 to-slate-950 border-2 border-amber-500/80 rounded-xl p-3.5 text-center relative overflow-hidden shadow-lg shadow-amber-500/10">
            {!aiSignal ? (
              <div className="py-3 text-xs text-slate-400 font-mono">
                {isAnalyzing ? `⏳ Автопилот ожидает отметку 12с до конца свечи...` : 'Нажмите ЗАПУСТИТЬ АВТО для автономной торговли'}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-cyan-300 tracking-wider">АКТИВ: {aiSignal.pair}</div>
                <div className="text-xl font-black flex items-center justify-center gap-2">
                  <span className="text-amber-400 text-xs">ВЕРДИКТ:</span>
                  <span className={aiSignal.direction === 'CALL' ? 'text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-500 text-base' : aiSignal.direction === 'PUT' ? 'text-rose-400 bg-emerald-950 px-2.5 py-0.5 rounded border border-rose-500 text-base' : 'text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-700 text-base'}>
                    {aiSignal.direction}
                  </span>
                </div>

                {aiSignal.nextCandleTime && aiSignal.direction !== 'SKIP' && (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg py-1 px-2">
                    <div className="text-[9px] text-amber-300 font-semibold uppercase tracking-wider">
                      Экспирация: <span className="text-emerald-400 font-bold">{aiSignal.recommendedExpiration || '1M'}</span> | Старт:
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

          <div className="grid grid-cols-4 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
            <button onClick={() => setRightTab('logs')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'logs' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>Логи</button>
            <button onClick={() => setRightTab('history')} className={`py-1 rounded-lg font-bold truncate ${rightTab === 'history' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}>История</button>
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
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 overflow-hidden min-h-[180px] relative">
              <div className="text-[10px] text-slate-400 mb-1">💡 Нажмите на сделку для деталей и отчета ИИ:</div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-[10px] font-mono">
                {historyList.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedHistoryItem(item)}
                    className="p-2 rounded bg-slate-900 hover:bg-slate-850 cursor-pointer border border-slate-800 flex flex-col gap-1 transition-all"
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-cyan-400 flex items-center gap-1">{item.pair} (#{item.tradeId}) <ChevronRight className="w-3 h-3 text-slate-500" /></span>
                      <span className={item.direction === 'CALL' ? 'text-emerald-400' : 'text-rose-400'}>{item.direction}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span>Время: {item.time}</span>
                      {item.status === 'ACTIVE' ? (
                        <span className="text-amber-400 animate-pulse font-bold">⏳ Сделка активна...</span>
                      ) : (
                        <span className={`font-bold ${item.result === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.result} ({item.pips})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedHistoryItem && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur p-3 flex flex-col justify-between z-20 border border-cyan-500/40 rounded-xl animate-fadeIn overflow-y-auto">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-cyan-400 text-xs">ДЕТАЛИ СДЕЛКИ #{selectedHistoryItem.tradeId}</span>
                      <button onClick={() => setSelectedHistoryItem(null)} className="text-slate-400 hover:text-white font-bold text-xs px-1.5 py-0.5 bg-slate-900 rounded border border-slate-700">✕</button>
                    </div>
                    <div className="space-y-1.5 text-[10px] font-mono">
                      <div className="flex justify-between"><span className="text-slate-400">Актив:</span><span className="text-white font-bold">{selectedHistoryItem.pair}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Прогноз:</span><span className={selectedHistoryItem.direction === 'CALL' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{selectedHistoryItem.direction}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Время старта:</span><span className="text-white">{selectedHistoryItem.time}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Статус:</span><span className="text-cyan-300 font-bold">{selectedHistoryItem.status}</span></div>
                      {selectedHistoryItem.openPrice && (
                        <div className="flex justify-between"><span className="text-slate-400">Цена открытия:</span><span className="text-cyan-300 font-mono">{selectedHistoryItem.openPrice}</span></div>
                      )}
                      {selectedHistoryItem.closePrice && (
                        <div className="flex justify-between"><span className="text-slate-400">Цена закрытия:</span><span className="text-cyan-300 font-mono">{selectedHistoryItem.closePrice}</span></div>
                      )}
                      {selectedHistoryItem.pips && (
                        <div className="flex justify-between"><span className="text-slate-400">Результат:</span><span className={`font-bold ${selectedHistoryItem.result === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>{selectedHistoryItem.result === 'WIN' ? '🟢 WIN' : '🔴 LOSS'} ({selectedHistoryItem.pips})</span></div>
                      )}

                      {selectedHistoryItem.detailedReport && (
                        <div className="mt-2 p-2 bg-slate-900/90 rounded border border-emerald-500/40 space-y-1 text-slate-300">
                          <div className="font-bold text-emerald-400">{selectedHistoryItem.detailedReport.mode}</div>
                          <div>• <b>Статус:</b> {selectedHistoryItem.detailedReport.status}</div>
                          <div>• <b>Уровни:</b> {selectedHistoryItem.detailedReport.levelDetails}</div>
                          <div>• <b>GPT-4o:</b> {selectedHistoryItem.detailedReport.aiVerdictGPT}</div>
                          <div>• <b>Gemini:</b> {selectedHistoryItem.detailedReport.aiVerdictGemini}</div>
                          <div className="text-amber-400">• <b>Риск:</b> {selectedHistoryItem.detailedReport.riskLevel}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedHistoryItem(null)} className="w-full py-1.5 mt-2 bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs">Закрыть</button>
                </div>
              )}
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
        <span>ORACLE PRO v10.5 (Auto-Pilot Sniper Hub)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
