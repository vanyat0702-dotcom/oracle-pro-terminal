import React, { useState, useEffect } from 'react';

export default function App() {
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('5M');
  const [aiVerdict, setAiVerdict] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signals' | 'martingale'>('signals');

  // Параметры для Мартингейла из твоего интерфейса
  const [startAmount, setStartAmount] = useState('10');
  const [payoutPercent, setPayoutPercent] = useState('85');

  // Strategy Hub: Конструктор стратегий с тумблерами
  const [strategies, setStrategies] = useState([
    { id: 'body_breakout', name: 'Защита тела свечи', enabled: true, desc: 'Фильтрация пробоев по телам, игнор теней и шума' },
    { id: 'rsi_bollinger', name: 'RSI + Bollinger Reversal', enabled: true, desc: 'Перекупленность/перепроданность на границах канала' },
    { id: 'macd_trend', name: 'MACD Trend Confirmation', enabled: false, desc: 'Подтверждение импульса по глобальному тренду' },
    { id: 'volume_spread', name: 'VSA (Volume Spread Analysis)', enabled: false, desc: 'Анализ крупных объемов и реакция маркетмейкера' }
  ]);

  const [isGlobalScanning, setIsGlobalScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const ALL_PAIRS = ['BTC/USDT', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/CAD', 'EUR/JPY'];

  // История сигналов
  const [signalHistory, setSignalHistory] = useState([
    { pair: 'BTC/USDT', direction: 'CALL', winrate: 94, time: '12:42' },
    { pair: 'EUR/USD', direction: 'PUT', winrate: 91, time: '12:35' },
    { pair: 'GBP/USD', direction: 'CALL', winrate: 96, time: '12:15' }
  ]);

  // Расчет Мартингейла
  const calculateMartingale = () => {
    let steps = [];
    let current = parseFloat(startAmount) || 10;
    const payout = (parseFloat(payoutPercent) || 85) / 100;

    for (let i = 1; i <= 5; i++) {
      let profit = current * payout;
      steps.push({ step: i, amount: current.toFixed(2), profit: profit.toFixed(2) });
      current *= 2.2; // классический коэффициент мартингейла
    }
    return steps;
  };

  // Одиночный анализ текущей пары
  const handleSingleAnalysis = async () => {
    setIsLoading(true);
    setAiVerdict(null);
    const activeStrategyNames = strategies.filter(s => s.enabled).map(s => s.name);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedPair,
          activeStrategies: activeStrategyNames,
          isGlobalScan: false
        })
      });

      const data = await res.json();
      setAiVerdict(data);

      if (data.signal && data.signal !== 'WAIT') {
        setSignalHistory(prev => [{
          pair: selectedPair,
          direction: data.signal,
          winrate: data.confidence || 95,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev]);
      }
    } catch (e) {
      console.error('Ошибка анализа:', e);
      setAiVerdict({ signal: 'WAIT', confidence: 0, reason: 'Ошибка соединения с бэкендом.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Глобальный сканер по всем парам (поиск 99-100%)
  const handleGlobalScan = async () => {
    setIsGlobalScanning(true);
    setScanProgress('Запуск глобального сканера всех пар...');
    const activeStrategyNames = strategies.filter(s => s.enabled).map(s => s.name);
    let bestSignal = null;

    for (const pair of ALL_PAIRS) {
      setScanProgress(`Сканирование ${pair}... (Поиск точного входа)`);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: pair,
            activeStrategies: activeStrategyNames,
            isGlobalScan: true
          })
        });

        const data = await res.json();

        if (data.signal !== 'WAIT' && data.confidence >= 90) {
          bestSignal = { pair, ...data };
          break; 
        }
      } catch (e) {
        console.error(`Ошибка сканирования ${pair}`, e);
      }
    }

    if (bestSignal) {
      setSelectedPair(bestSignal.pair);
      setAiVerdict(bestSignal);
      setScanProgress(`✅ НАЙДЕНА ИДЕАЛЬНАЯ ПАРА: ${bestSignal.pair} (${bestSignal.confidence}% точность)`);
      
      setSignalHistory(prev => [{
        pair: bestSignal.pair,
        direction: bestSignal.signal,
        winrate: bestSignal.confidence,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...prev]);
    } else {
      setScanProgress('⚠️ Сканирование завершено: Идеальных входов со 100% точностью нет. Рынок шумит.');
    }

    setIsGlobalScanning(false);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-3 md:p-4 font-sans flex flex-col justify-between">
      <div>
        {/* Шапка выбора активов (Intrade Bar стиль) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-3 shadow-lg">
          <div className="text-xs text-slate-400 font-semibold mb-2 flex items-center justify-between">
            <span>ВЫБОР АКТИВА (INTRADE BAR):</span>
            <span className="text-cyan-400 font-mono">ТЕКУЩИЙ: {selectedPair}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ALL_PAIRS.map(pair => (
              <button
                key={pair}
                onClick={() => setSelectedPair(pair)}
                className={`py-1.5 px-2 rounded text-xs font-bold transition-all ${
                  selectedPair === pair 
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {pair}
              </button>
            ))}
          </div>
        </div>

        {/* STRATEGY HUB (Конструктор стратегий и глобальный сканер) */}
        <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-4 mb-3 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between mb-3 gap-3">
            <div>
              <h3 className="text-cyan-400 font-bold text-base flex items-center gap-2">
                ⚙️ Strategy Hub (Мультистратегический фильтр)
              </h3>
              <p className="text-xs text-slate-400">Включай нужные модули для жесткой отсечки рыночного шума</p>
            </div>
            
            <button
              onClick={handleGlobalScan}
              disabled={isGlobalScanning}
              className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white font-bold px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/20 text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGlobalScanning ? '🌐 Сканирование рынка...' : '🔍 ГЛОБАЛЬНЫЙ СУПЕР-СКАНЕР'}
            </button>
          </div>

          {/* Тумблеры стратегий */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {strategies.map((strat) => (
              <div 
                key={strat.id} 
                className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                  strat.enabled 
                    ? 'bg-slate-800/90 border-cyan-500/50' 
                    : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="font-semibold text-white text-xs">{strat.name}</div>
                  <div className="text-[10px] text-slate-400">{strat.desc}</div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={strat.enabled}
                    onChange={() => {
                      setStrategies(strategies.map(s => s.id === strat.id ? { ...s, enabled: !s.enabled } : s));
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            ))}
          </div>

          {scanProgress && (
            <div className="mt-2.5 p-2 bg-slate-950 rounded text-center text-xs font-mono text-cyan-300 border border-cyan-900/50">
              {scanProgress}
            </div>
          )}
        </div>

        {/* Основная рабочая сетка: График, ИИ Вердикт и Правая панель (История / Мартингейл) */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          {/* Левая часть: График */}
          <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[420px]">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-cyan-400 text-base">{selectedPair}</span>
                <div className="flex gap-1">
                  {['1M', '5M', '15M'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${timeframe === tf ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSingleAnalysis}
                disabled={isLoading}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
              >
                {isLoading ? 'Анализ...' : 'Запустить анализ пары'}
              </button>
            </div>

            <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden p-4">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <div className="text-center z-10">
                <div className="text-slate-400 text-xs mb-1">Интерактивный терминал графика</div>
                <div className="text-cyan-400 font-mono text-lg font-bold">{selectedPair} ({timeframe})</div>
                <div className="text-[10px] text-slate-500 mt-2">Мультистратегический фильтр шума активен</div>
              </div>
            </div>

            {/* Блок вердикта ИИ под графиком или в отдельной секции */}
            {aiVerdict && (
              <div className={`mt-3 p-3 rounded-xl border ${
                aiVerdict.signal === 'CALL' ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400' :
                aiVerdict.signal === 'PUT' ? 'bg-rose-950/40 border-rose-500/50 text-rose-400' :
                'bg-amber-950/40 border-amber-500/50 text-amber-400'
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-lg font-black">{aiVerdict.signal}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900">
                    Точность: {aiVerdict.confidence}%
                  </span>
                </div>
                <p className="text-xs text-slate-300">{aiVerdict.reason}</p>
              </div>
            )}
          </section>

          {/* Правая панель: История сигналов / Калькулятор Мартингейла */}
          <aside className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col">
            <div className="flex border-b border-slate-800 pb-2 mb-3 text-xs font-bold">
              <button 
                onClick={() => setActiveTab('signals')}
                className={`flex-1 pb-1 text-center border-b-2 transition-all ${activeTab === 'signals' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
              >
                История сигналов
              </button>
              <button 
                onClick={() => setActiveTab('martingale')}
                className={`flex-1 pb-1 text-center border-b-2 transition-all ${activeTab === 'martingale' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400'}`}
              >
                Мартингейл
              </button>
            </div>

            {activeTab === 'signals' ? (
              <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col">
                <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-wider">Последние сканы:</div>
                <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono">
                  {signalHistory.map((item, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-white font-bold">{item.pair}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{item.time}</span>
                      </div>
                      <span className={item.direction === 'CALL' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {item.direction} ({item.winrate}%)
                      </span>
                    </div>
                  ))}
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
      </div>

      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v6.5 (Vision AI Gateway)</span>
        <span>Environment: Production / Vercel Edge</span>
      </footer>
    </div>
  );
}
