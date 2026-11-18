// core/analyze.js — единый оркестратор анализа ядра Oracle Pro Terminal.
//
// ЭТАП 3.6.4. Оркестратор централизует ПОСЛЕДОВАТЕЛЬНОСТЬ обработки
// `AnalyzeRequest`, делегируя фактическую работу уже существующим модулям ядра:
//
//   1. валидация входа  -> `core/validate.js`  (`validateAnalyzeRequest`)
//   2. анализ/консенсус -> `core/ai/gateway.js` (`getJointPrediction`),
//      который внутри сам вызывает Safe Mode (`core/trading/safeMode.js`),
//      адаптеры OpenAI/Gemini и правила consensus/confidence/CALL-PUT-SKIP;
//   3. ошибки           -> `core/errors.js` (`ValidationError`, `AnalysisError`).
//
// Модуль НЕ дублирует AI-логику, Safe Mode и торговые алгоритмы: он только
// упорядочивает вызовы. Транспортно-нейтрален (нет Express/Vercel/React), не
// читает env, при импорте не выполняет побочных действий и сетевых вызовов.
//
// ВАЖНО (контрактный разрыв, зафиксирован в PROJECT_CONTEXT.md §11.3):
// `AnalyzeRequest` не содержит полей `candles`/`currentPrice`, которые Gateway
// использует для Safe Mode и сериализует в промпты. Поэтому оркестратор
// валидирует вход как ГЕЙТ, а в Gateway передаёт ИСХОДНЫЙ объект без изменений —
// иначе поведение (Safe Mode, содержимое промптов) изменилось бы. Приведение
// контракта и входа Gateway — отдельная задача.

import { validateAnalyzeRequest } from './validate.js';
import { getJointPrediction } from './ai/gateway.js';
import { AnalysisError, isOracleError } from './errors.js';

/**
 * Выполнить анализ сканирования (`AnalyzeRequest`) через ядро.
 *
 * Последовательность:
 *   1. `validateAnalyzeRequest(request)` — проверка/нормализация входа; при
 *      некорректном входе бросает `ValidationError` (до обращения к ИИ);
 *   2. `getJointPrediction(request)` — AI Gateway: Safe Mode, GPT + Gemini,
 *      consensus, confidence, CALL/PUT/SKIP. Передаётся исходный объект
 *      (см. примечание о контрактном разрыве выше), чтобы сохранить поведение 1:1;
 *   3. непредвиденная ошибка Gateway оборачивается в безопасную `AnalysisError`
 *      (без stack trace, деталей и значений секретов). Ошибки ядра пробрасываются
 *      как есть. Оркестратор НИКОГДА не создаёт `CALL`/`PUT` при ошибке.
 *
 * @param {unknown} request Тело запроса `/api/analyze` (форма `AnalyzeRequest`).
 * @returns {Promise<import('./contracts.js').AnalyzeResult>}
 * @throws {import('./errors.js').ValidationError | import('./errors.js').AnalysisError}
 */
async function analyze(request) {
  // 1. Валидация — гейт перед обращением к моделям. Бросает `ValidationError`.
  validateAnalyzeRequest(request);

  // 2. Делегирование AI Gateway (внутри — Safe Mode + GPT/Gemini + consensus).
  try {
    return await getJointPrediction(request);
  } catch (error) {
    // 3. Единая система ошибок ядра. Неизвестные ошибки не пробрасываются наружу
    //    как есть (могут содержать внутренние детали), а заменяются безопасной.
    if (isOracleError(error)) throw error;
    throw new AnalysisError('AI analysis failed');
  }
}

export { analyze };
