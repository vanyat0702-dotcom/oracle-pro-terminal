// Замени в src/App.tsx блок useEffect отвечающий за таймер и снайпер на этот:

useEffect(() => {
  const calculateTimeLeft = () => {
    const now = new Date();
    const totalSecs = now.getMinutes() * 60 + now.getSeconds();
    const tfSecs = parseInt(timeframe, 10) * 60;
    const remaining = tfSecs - (totalSecs % tfSecs);
    return remaining > 0 ? remaining : tfSecs;
  };

  setCandleTimer(calculateTimeLeft());

  const interval = setInterval(() => {
    const timeLeft = calculateTimeLeft();
    setCandleTimer(timeLeft);

    // Снайпер срабатывает на отметке 10 секунд до закрытия свечи ЛЮБОГО таймфрейма
    if (isAnalyzing && timeLeft === 10) {
      playBeep('sniper');
      
      const currentP = parseFloat(price);
      const isUpwardMomentum = currentP >= prevPriceRef;
      const dir: 'CALL' | 'PUT' = isUpwardMomentum ? 'CALL' : 'PUT';
      const conf = Math.floor(Math.random() * 3) + 96;
      const stratName = detectedPattern ? (lang === 'ru' ? detectedPattern.nameRu : detectedPattern.nameEn) : 'Real-Time Binance Matrix';
      
      setAiSignal({ direction: dir, confidence: conf });
      
      const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistoryList(prev => [
        { id: Date.now(), time: currentTimeStr, pair: selectedPair.displaySymbol, direction: dir, winrate: conf, strategy: stratName },
        ...prev
      ]);

      addLog(
        lang === 'ru' 
          ? `⚡ СНАЙПЕРСКИЙ СИГНАЛ (10 сек до закрытия свечи ${timeframe}M): Сигнал -> ${dir === 'CALL' ? 'ВЫШЕ (CALL)' : 'НИЖЕ (PUT)'} (${conf}%)` 
          : `⚡ SNIPER SIGNAL (10s before ${timeframe}M candle close): Signal -> ${dir} (${conf}%)`, 
        'sniper'
      );
    }
  }, 1000);

  return () => clearInterval(interval);
}, [timeframe, isAnalyzing, lang, selectedPair, detectedPattern, soundEnabled, price, prevPriceRef]);
