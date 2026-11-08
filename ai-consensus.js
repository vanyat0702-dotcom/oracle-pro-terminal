const axios = require('axios');

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
    
    return cleanJsonResponse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Ошибка GPT API:', error.response?.data || error.message);
    return null;
  }
}

// Реальный запрос к Google Gemini (Исправлен фальшивый хардкод!)
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
    return cleanJsonResponse(textContent);
  } catch (error) {
    console.error('Ошибка Gemini API:', error.response?.data || error.message);
    return null;
  }
}

// Главная функция консенсуса с защитой от Анти-Тильта
async function getJointPrediction(marketData) {
  const tradeId = Math.floor(Math.random() * 90000) + 10000;
  
  // Параллельный опрос обеих нейросетей
  const [gptResult, geminiResult] = await Promise.all([
    getGPTAnalysis(marketData),
    getGeminiAnalysis(marketData)
  ]);

  // Если один из ИИ недоступен, включаем режим безопасности (SKIP), чтобы не сливать депозит наугад
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

  // Жёсткая проверка: если хотя бы один советует пропустить или мнения кардинально расходятся
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

  // Консенсус полный! Направления совпали
  const avgConfidence = Math.round((gptResult.confidence + geminiResult.confidence) / 2);
  const bestPair = marketData.pairs?.[Math.floor(Math.random() * marketData.pairs.length)] || "EURUSD";

  return {
    signal: gptResult.direction, // "CALL" или "PUT"
    confidence: avgConfidence,
    tradeId,
    reasoning: `Консенсус 100%! GPT: ${subStr(gptResult.reasoning)} | Gemini: ${subStr(geminiResult.reasoning)}`,
    recommendedExpiration: gptResult.recommendedExpiration || "1M",
    bestPair
  };
}

function subStr(str) {
  if (!str) return '';
  return str.length > 60 ? str.substring(0, 60) + '...' : str;
}

module.exports = { getJointPrediction };
