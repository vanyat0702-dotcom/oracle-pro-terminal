const axios = require('axios');

// Функция запроса к ChatGPT (OpenAI)
async function getGPTAnalysis(marketData) {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Ты профессиональный трейдер. Оцени рынок и дай прогноз: UP, DOWN или NEUTRAL, а также уровень уверенности (0-100).' },
        { role: 'user', content: JSON.stringify(marketData) }
      ],
      temperature: 0.2
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    
    // Парсим ответ (для примера упрощенно)
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Ошибка GPT:', error);
    return null;
  }
}

// Функция запроса к Gemini
async function getGeminiAnalysis(marketData) {
  try {
    // Здесь вызов твоего эндпоинта Gemini API
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: `Проанализируй данные пары и дай прогноз (UP/DOWN/NEUTRAL) и уверенность: ${JSON.stringify(marketData)}` }] }]
    });
    
    // Возвращаем результат анализа
    return { direction: "UP", confidence: 85 }; // Пример структуры
  } catch (error) {
    console.error('Ошибка Gemini:', error);
    return null;
  }
}

// Главная функция консенсуса
async function getJointPrediction(marketData) {
  const [gptResult, geminiResult] = await Promise.all([
    getGPTAnalysis(marketData),
    getGeminiAnalysis(marketData)
  ]);

  if (!gptResult || !geminiResult) {
    return { status: "ERROR", message: "Один из ИИ не ответил, включен режим безопасности." };
  }

  // Логика сверки (Консенсус)
  if (gptResult.direction === geminiResult.direction) {
    const avgConfidence = (gptResult.confidence + geminiResult.confidence) / 2;
    return {
      status: "CONFIRMED",
      direction: gptResult.direction,
      confidence: avgConfidence,
      recommendation: `Консенсус полный! Направление: ${gptResult.direction}. Уверенность: ${avgConfidence}%`
    };
  } else {
    return {
      status: "CONFLICT",
      direction: "NEUTRAL",
      recommendation: "Мнения расходятся! Срабатывает Анти-Тильт: торговля по данной паре заблокирована."
    };
  }
}

module.exports = { getJointPrediction };
