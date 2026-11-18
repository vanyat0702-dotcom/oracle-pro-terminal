// core/trading/safeMode.js — движок Safe Mode и ключевых уровней M5/M15.
//
// ЭТАП 3.6.2. Торговая/Safe Mode логика перенесена сюда из legacy
// `safe-strategy.js` БЕЗ изменения поведения: алгоритмы, пороги, значения по
// умолчанию и структуры результатов сохранены 1:1.
//
// Модуль принадлежит ядру Core и транспортно-нейтрален: НЕ зависит от Express,
// Vercel, React/frontend; не читает env; не выполняет сетевых вызовов и не имеет
// побочных действий при импорте (чистые функции).
//
// Legacy `safe-strategy.js` сохранён как тонкий compatibility shim, который
// реэкспортирует эти функции под прежними именами.

function findKeyLevels(candles = []) {
  if (!candles || candles.length < 5) {
    return { support: null, resistance: null, zoneWidth: 0 };
  }
  const highs = candles.map(c => c.high || c.h || 1.08500);
  const lows = candles.map(c => c.low || c.l || 1.08500);

  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const avgPrice = (maxHigh + minLow) / 2;
  const zoneWidth = avgPrice * 0.0005; // 0.05% зона уровня

  return { support: minLow, resistance: maxHigh, zoneWidth };
}

function analyzeSafeModeSetup(marketData) {
  const currentPrice = marketData.currentPrice || 1.08500;
  const candles = marketData.candles || [];

  const levels = findKeyLevels(candles);
  let nearSupport = false;
  let nearResistance = false;
  let activeLevel = null;

  if (levels.support && Math.abs(currentPrice - levels.support) <= levels.zoneWidth) {
    nearSupport = true;
    activeLevel = levels.support;
  }
  if (levels.resistance && Math.abs(currentPrice - levels.resistance) <= levels.zoneWidth) {
    nearResistance = true;
    activeLevel = levels.resistance;
  }

  return {
    isTriggered: nearSupport || nearResistance,
    nearSupport,
    nearResistance,
    activeLevel,
    levels
  };
}

function generateDetailedReport(setupResult, gptResult, geminiResult) {
  return {
    mode: "🛡️ SAFE MODE (Уровни M5/M15)",
    status: setupResult.isTriggered ? "APPROVED" : "SKIPPED_BY_LEVEL",
    levelDetails: setupResult.activeLevel ? `Касание зоны: ${setupResult.activeLevel.toFixed(5)}` : "Цена вне зон уровней",
    aiVerdictGPT: gptResult?.reasoning || "Нет ответа GPT",
    aiVerdictGemini: geminiResult?.reasoning || "Нет ответа Gemini",
    riskLevel: "Минимальный (Снайперский отскок от уровня)"
  };
}

export { findKeyLevels, analyzeSafeModeSetup, generateDetailedReport };
