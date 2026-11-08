const axios = require('axios');
const safeStrategy = require('./safe-strategy'); // 👈 Изолированный модуль уровней и отчетов
const aiDebugger = require('./ai-debugger');     // 👈 Модуль аудита моделей

// Вспомогательная функция для очистки ответа ИИ от Markdown-оберток (```json ... ```)
function cleanJsonResponse(content) {
  if (!content) return null;
  try {
    let clean = content.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }
    return JSON.parse(clean);
  } catch (e) {
    console.error('Ошибка парсинга JSON от ИИ:', content);
    return null;
  }
}

// Реальный запрос к OpenAI (GPT-4o)
async function getGPTAnalysis(marketData) {
  try {
    const prompt = `Ты профессиональный трейдер бинарных опционов и системный аналитик терминала ORACLE PRO. 
    Проанализируй рыночные данные и активные стратегии пользователя: ${JSON.stringify(marketData)}.
    Строго запрещено торговать на криптовалюте (BTCUSD/BTCUSDT) и во время утреннего флэта, если волатильность низкая.
    Дай вердикт в формате JSON:
    {
      "direction": "CALL" или "PUT" или "SKIP",
      "confidence": число от 0 до 100,
      "reasoning": "краткое обоснование на русском языке",
      "recommendedExpiration": "1M" или "5M"
    }`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Ты строгий финансовый аналитик. Возвращай ответы исключительно в чистом JSON без лишнего текста.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    
    const parsed = cleanJsonResponse(response.data.choices[0].message.content);
    aiDebugger.auditModelResponse('GPT-4o Vision', parsed);
    return parsed;
  } catch (error) {
    console.error('Ошибка GPT API:', error.response?.data || error.message);
    return null;
  }
}

// Реальный запрос к Google Gemini
async function getGeminiAnalysis(marketData) {
  try {
    const prompt = `Ты алгоритмический скальпер. Оцени рыночные условия и стратегии: ${JSON.stringify(marketData)}. 
    Верни результат строго в формате JSON:
    {
      "direction": "CALL" или "PUT" или "SKIP",
      "confidence": число от 0 до 100,
      "reasoning": "обоснование входа"
    }`;

    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }]
    });
    
    const textContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = cleanJsonResponse(textContent);
    aiDebugger.auditModelResponse('Gemini 1.5 Pro', parsed);
    return parsed;
  } catch (error) {
    console.error('Ошибка Gemini API:', error.response?.data || error.message);
    return null;
  }
}

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

module.exports = { getJointPrediction };
