// core/ai/gemini.js — адаптер Google Gemini (gemini-1.5-pro).
// Phase 3B Increment 3: direct calls without live access return null before any AI work.
//
// ЭТАП 3.6.3. Функция `getGeminiAnalysis` перенесена 1:1 из `ai-consensus.js`:
// модель, промпты, параметры запроса, формат ответа и обработка ошибок
// сохранены без изменений.
//
// Модуль принадлежит ядру Core и транспортно-нейтрален: не зависит от Express,
// Vercel, React. Секрет (`GEMINI_API_KEY`) читается ТОЛЬКО в момент вызова из
// `process.env` и нигде не логируется; при импорте модуля env не читается.
// Реальных запросов при импорте нет.

import axios from 'axios';
import { cleanJsonResponse } from './parse.js';
import * as aiDebugger from '../observability/audit.js'; // аудит: зона наблюдаемости ядра
import { checkRuntimeAccess } from '../runtimeGuard.js';

// Реальный запрос к Google Gemini
async function getGeminiAnalysis(marketData, runtimeContext) {
  // Must precede prompt serialization, env/API-key access, logging and axios.post.
  if (!checkRuntimeAccess(runtimeContext).allowed) return null;
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

export { getGeminiAnalysis };
