// core/ai/parse.js — разбор текстового ответа модели в JSON.
//
// ЭТАП 3.6.3. Функция `cleanJsonResponse` перенесена 1:1 из `ai-consensus.js`
// (без изменения поведения и текста сообщения об ошибке). Общая для адаптеров
// OpenAI и Gemini — поэтому вынесена в отдельный модуль (без циклов).
//
// Модуль транспортно-нейтрален: не зависит от Express, Vercel, React; не читает
// env; не выполняет сетевых вызовов; при импорте побочных действий нет.

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

export { cleanJsonResponse };
