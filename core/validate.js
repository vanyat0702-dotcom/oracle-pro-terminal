// core/validate.js — централизованная валидация и нормализация входа ядра.
//
// ЭТАП 3.6.1. Модуль ИЗОЛИРОВАН: пока НЕ подключён к Express (`server/index.js`)
// или Vercel (`api/analyze.ts`).
//
// Правила:
//   - валидация НЕ генерирует торговые сигналы и не принимает торговых решений;
//   - оригинальный объект запроса НЕ мутируется — возвращается новый объект;
//   - новые поля в API-контракты не добавляются;
//   - ограничения на значения опираются на `core/contracts.d.ts` и фактическую
//     логику проекта, а не выдумываются.
//
// Нормализация минимальна и не изменяет смысл запроса: строки обрезаются по
// краям (случайные пробелы), массивы и объекты копируются.

import { ValidationError } from './errors.js';

/** Допустимые основные таймфреймы (см. `AnalyzeRequest.timeframe`). */
const TIMEFRAMES = Object.freeze(['1', '5', '15', '60', '240']);

/** Допустимые старшие таймфреймы (см. `AnalyzeRequest.higherTimeframes`). */
const HIGHER_TIMEFRAMES = Object.freeze(['5', '15', '30', '60', '240', 'D']);

/** Допустимые боевые профили (см. `RiskMode`). */
const RISK_MODES = Object.freeze([
  'SAFE',
  'BALANCED',
  'AGGRESSIVE',
  'BREAKOUT',
  'ANTITILT',
  'TRENDSURF'
]);

/** Допустимые направления сделки (см. `TradeDirection`). */
const TRADE_DIRECTIONS = Object.freeze(['CALL', 'PUT']);

/** Время в формате "HH:MM" (24 часа). */
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** @param {unknown} value @returns {boolean} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {string} field
 * @param {string} reason
 * @returns {never}
 */
function fail(field, reason) {
  throw new ValidationError(`Invalid field "${field}": ${reason}`, { details: { field } });
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireString(value, field) {
  if (typeof value !== 'string') fail(field, 'expected a string');
  const trimmed = value.trim();
  if (trimmed.length === 0) fail(field, 'must not be empty');
  return trimmed;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {string[]}
 */
function requireStringArray(value, field, options = {}) {
  const { allowEmpty = true } = options;
  if (!Array.isArray(value)) fail(field, 'expected an array of strings');
  if (!allowEmpty && value.length === 0) fail(field, 'must not be empty');
  return value.map((item, index) => {
    if (typeof item !== 'string') fail(`${field}[${index}]`, 'expected a string');
    const trimmed = item.trim();
    if (trimmed.length === 0) fail(`${field}[${index}]`, 'must not be empty');
    return trimmed;
  });
}

/** @param {unknown} value @param {string} field @returns {boolean} */
function requireBoolean(value, field) {
  if (typeof value !== 'boolean') fail(field, 'expected a boolean');
  return value;
}

/** @param {unknown} value @param {string} field @returns {number} */
function requireFiniteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(field, 'expected a finite number');
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {readonly string[]} allowed
 * @returns {string}
 */
function requireOneOf(value, field, allowed) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(field, `expected one of: ${allowed.join(', ')}`);
  }
  return value;
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireTimeHHMM(value, field) {
  if (typeof value !== 'string' || !TIME_HHMM.test(value)) {
    fail(field, 'expected time in "HH:MM" format');
  }
  return value;
}

/**
 * @param {unknown} value
 * @returns {{ newsFilterEnabled: boolean, atrFilterEnabled: boolean, riskCapEnabled: boolean }}
 */
function validateFilters(value) {
  if (!isPlainObject(value)) fail('filters', 'expected an object');
  return {
    newsFilterEnabled: requireBoolean(value.newsFilterEnabled, 'filters.newsFilterEnabled'),
    atrFilterEnabled: requireBoolean(value.atrFilterEnabled, 'filters.atrFilterEnabled'),
    riskCapEnabled: requireBoolean(value.riskCapEnabled, 'filters.riskCapEnabled')
  };
}

/**
 * Валидировать и нормализовать запрос сканирования (`AnalyzeRequest`).
 * Бросает `ValidationError` при некорректном входе. Не мутирует вход.
 * @param {unknown} payload
 * @returns {import('./contracts.js').AnalyzeRequest}
 */
function validateAnalyzeRequest(payload) {
  if (!isPlainObject(payload)) fail('payload', 'expected an object');

  return {
    pairs: requireStringArray(payload.pairs, 'pairs', { allowEmpty: false }),
    timeframe: requireOneOf(payload.timeframe, 'timeframe', TIMEFRAMES),
    higherTimeframes: requireStringArray(payload.higherTimeframes, 'higherTimeframes').map((tf) =>
      requireOneOf(tf, 'higherTimeframes[]', HIGHER_TIMEFRAMES)
    ),
    mode: requireOneOf(payload.mode, 'mode', RISK_MODES),
    safeModeEnabled: requireBoolean(payload.safeModeEnabled, 'safeModeEnabled'),
    secondsRemaining: requireFiniteNumber(payload.secondsRemaining, 'secondsRemaining'),
    candleOpenTime: requireTimeHHMM(payload.candleOpenTime, 'candleOpenTime'),
    activeStrategies: requireStringArray(payload.activeStrategies, 'activeStrategies'),
    strategy: requireString(payload.strategy, 'strategy'),
    filters: validateFilters(payload.filters)
  };
}

/**
 * Валидировать и нормализовать запрос фиксации результата (`SendResultRequest`).
 * Бросает `ValidationError` при некорректном входе. Не мутирует вход.
 * @param {unknown} payload
 * @returns {import('./contracts.js').SendResultRequest}
 */
function validateSendResultRequest(payload) {
  if (!isPlainObject(payload)) fail('payload', 'expected an object');
  if (payload.action !== 'send_result') fail('action', 'expected "send_result"');

  return {
    action: 'send_result',
    pair: requireString(payload.pair, 'pair'),
    direction: requireOneOf(payload.direction, 'direction', TRADE_DIRECTIONS),
    candleOpenTime: requireTimeHHMM(payload.candleOpenTime, 'candleOpenTime'),
    tradeId: requireFiniteNumber(payload.tradeId, 'tradeId'),
    openPrice: requireFiniteNumber(payload.openPrice, 'openPrice'),
    closePrice: requireFiniteNumber(payload.closePrice, 'closePrice')
  };
}

/**
 * Диспетчер валидации: `action: "send_result"` -> `SendResultRequest`,
 * иначе -> `AnalyzeRequest` (поведение совпадает с текущими обработчиками,
 * которые трактуют запрос без этого `action` как сканирование).
 * @param {unknown} payload
 * @returns {import('./contracts.js').AnalyzeRequest | import('./contracts.js').SendResultRequest}
 */
function validateCoreRequest(payload) {
  if (isPlainObject(payload) && payload.action === 'send_result') {
    return validateSendResultRequest(payload);
  }
  return validateAnalyzeRequest(payload);
}

export {
  TIMEFRAMES,
  HIGHER_TIMEFRAMES,
  RISK_MODES,
  TRADE_DIRECTIONS,
  validateAnalyzeRequest,
  validateSendResultRequest,
  validateCoreRequest
};
