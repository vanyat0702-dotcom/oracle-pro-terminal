// core/ai/gateway.js — центральный orchestration layer AI Gateway.
//
// ЭТАП 3.6.3. Функция `getJointPrediction` перенесена 1:1 из `ai-consensus.js`:
// порядок вызовов, правила Safe Mode, consensus, confidence, CALL/PUT/SKIP,
// тексты и структуры ответов сохранены без изменений.
//
// Gateway координирует независимые адаптеры (`openai.js`, `gemini.js`) и
// торговую логику Safe Mode (`core/trading/safeMode.js`). Он транспортно-
// нейтрален: не зависит от Express, Vercel, React; не читает env; при импорте
// побочных действий и реальных запросов не выполняет.
//
// Циклических импортов нет: `openai`/`gemini` зависят от `parse` и аудита,
// `safeMode` не зависит ни от чего.

import { getGPTAnalysis } from './openai.js';
import { getGeminiAnalysis } from './gemini.js';
import * as safeStrategy from '../trading/safeMode.js'; // Safe Mode + ключевые уровни

// Главная функция консенсуса с защитой Анти-Тильта и Safe Mode
async function getJointPrediction(marketData) {
  const tradeId = Math.floor(Math.random() * 90000) + 10000;

  // 🛡️ Если включен SAFE MODE, проверяем уровни М5/М15 перед вызовом ИИ
  if (marketData.safeModeEnabled) {
    const safeCheck = safeStrategy.analyzeSafeModeSetup(marketData);
    if (!safeCheck.isTriggered) {
      return {
        signal: "SKIP",
        confidence: 0,
        tradeId,
        reasoning: "🛡️ [SAFE MODE]: Цена находится вне зон ключевых уровней M5/M15. Вход пропущен для защиты депозита.",
        recommendedExpiration: "5M",
        bestPair: marketData.pairs?.[0] || "EURUSD",
        detailedReport: {
          mode: "🛡️ SAFE MODE (Уровни)",
          status: "REJECTED_BY_LEVEL",
          levelDetails: "Цена в середине канала, касания уровней нет",
          aiVerdictGPT: "Запрос к Vision API заблокирован (экономия токенов)",
          aiVerdictGemini: "Фильтр уровней активен",
          riskLevel: "Минимальный (Ожидание зоны)"
        }
      };
    }
  }

  // Параллельный опрос обеих нейросетей
  const [gptResult, geminiResult] = await Promise.all([
    getGPTAnalysis(marketData),
    getGeminiAnalysis(marketData)
  ]);

  if (!gptResult || !geminiResult) {
    return {
      signal: "SKIP",
      confidence: 0,
      tradeId,
      reasoning: "Медицинский тайм-аут ИИ: один из серверов не ответил. Сработал Анти-Тильт.",
      recommendedExpiration: "1M",
      bestPair: marketData.pairs?.[0] || "EURUSD"
    };
  }

  if (gptResult.direction === 'SKIP' || geminiResult.direction === 'SKIP' || gptResult.direction !== geminiResult.direction) {
    return {
      signal: "SKIP",
      confidence: 0,
      tradeId,
      reasoning: `Мнения ИИ расходятся (GPT: ${gptResult.direction} vs Gemini: ${geminiResult.direction}). Торговля заблокирована защитой.`,
      recommendedExpiration: "1M",
      bestPair: marketData.pairs?.[0] || "EURUSD"
    };
  }

  const avgConfidence = Math.round((gptResult.confidence + geminiResult.confidence) / 2);
  const bestPair = marketData.pairs?.[Math.floor(Math.random() * marketData.pairs.length)] || "EURUSD";

  // Генерируем развернутый отчет для истории
  const detailedReport = {
    mode: marketData.safeModeEnabled ? "🛡️ SAFE MODE (Уровни M5/M15)" : "⚡ СТАНДАРТНЫЙ СКАЛЬПИНГ",
    status: "APPROVED",
    levelDetails: "Подтвержден отскок от зоны поддержки/сопротивления",
    aiVerdictGPT: subStr(gptResult.reasoning),
    aiVerdictGemini: subStr(geminiResult.reasoning),
    riskLevel: "Умеренный / Консенсус подтвержден"
  };

  return {
    signal: gptResult.direction,
    confidence: avgConfidence,
    tradeId,
    reasoning: `Консенсус 100%! GPT: ${subStr(gptResult.reasoning)} | Gemini: ${subStr(geminiResult.reasoning)}`,
    recommendedExpiration: gptResult.recommendedExpiration || "1M",
    bestPair,
    detailedReport // 👈 Передаем отчет на фронтенд для истории
  };
}

function subStr(str) {
  if (!str) return '';
  return str.length > 60 ? str.substring(0, 60) + '...' : str;
}

export { getJointPrediction };
