// core/ai/openai.js — адаптер OpenAI (GPT-4o).
//
// ЭТАП 3.6.3. Функция `getGPTAnalysis` перенесена 1:1 из `ai-consensus.js`:
// модель, промпты, параметры запроса, формат ответа и обработка ошибок
// сохранены без изменений.
//
// Модуль принадлежит ядру Core и транспортно-нейтрален: не зависит от Express,
// Vercel, React. Секрет (`OPENAI_API_KEY`) читается ТОЛЬКО в момент вызова из
// `process.env` и нигде не логируется; при импорте модуля env не читается.
// Реальных запросов при импорте нет.

import axios from 'axios';
import { cleanJsonResponse } from './parse.js';
import * as aiDebugger from '../observability/audit.js'; // аудит: зона наблюдаемости ядра

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

export { getGPTAnalysis };
