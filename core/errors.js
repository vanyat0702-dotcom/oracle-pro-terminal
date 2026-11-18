// core/errors.js — единая система ошибок ядра Oracle Pro Terminal.
//
// ЭТАП 3.6.1. Модуль ИЗОЛИРОВАН: пока НЕ подключён к Express (`server/index.js`)
// или Vercel (`api/analyze.ts`) и НЕ меняет текущий формат HTTP-ответов.
//
// Правило безопасности аналитического ядра (документируется здесь, но НЕ
// внедряется на этом этапе): ошибка, делающая анализ недостоверным, в будущем
// должна приводить к безопасному состоянию SKIP, а не к выдуманному CALL/PUT.
//
// Публичная сериализация (`toPublicJSON`) НИКОГДА не включает stack trace,
// значения секретов, API-ключи и прочие внутренние детали.

/** Коды ошибок ядра. */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  ANALYSIS_ERROR: 'ANALYSIS_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
});

/**
 * Безопасные сообщения по умолчанию для публичной сериализации.
 * Внутренний `message` ошибки может быть подробнее, но наружу отдаётся ТОЛЬКО
 * одно из этих сообщений (или явно заданный безопасный `publicMessage`).
 */
const DEFAULT_PUBLIC_MESSAGES = Object.freeze({
  VALIDATION_ERROR: 'Invalid request payload',
  CONFIG_ERROR: 'Server configuration error',
  ANALYSIS_ERROR: 'Analysis could not be completed',
  INTERNAL_ERROR: 'Internal core error'
});

/** Базовый класс ошибок ядра. */
class OracleError extends Error {
  /**
   * @param {string} [message] Внутреннее сообщение (не показывать пользователю как есть).
   * @param {{ code?: string, publicMessage?: string, details?: unknown }} [options]
   */
  constructor(message, options = {}) {
    const code = options.code || ERROR_CODES.INTERNAL_ERROR;
    const fallbackMessage = DEFAULT_PUBLIC_MESSAGES[code] || DEFAULT_PUBLIC_MESSAGES.INTERNAL_ERROR;
    super(typeof message === 'string' && message.length > 0 ? message : fallbackMessage);

    this.name = 'OracleError';
    this.code = code;
    // Безопасное сообщение для публичного API. Значения секретов сюда не попадают.
    this.publicMessage = options.publicMessage || fallbackMessage;
    // Внутренние детали: НЕ сериализуются в публичный ответ (см. toPublicJSON).
    this.details = options.details;
    this.isOracleError = true;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** Ошибка валидации входа ядра. */
class ValidationError extends OracleError {
  constructor(message, options = {}) {
    super(message, { ...options, code: ERROR_CODES.VALIDATION_ERROR });
    this.name = 'ValidationError';
  }
}

/** Ошибка конфигурации (отсутствующие/некорректные настройки окружения). */
class ConfigError extends OracleError {
  constructor(message, options = {}) {
    super(message, { ...options, code: ERROR_CODES.CONFIG_ERROR });
    this.name = 'ConfigError';
  }
}

/** Ошибка анализа (анализ не может быть достоверно завершён). */
class AnalysisError extends OracleError {
  constructor(message, options = {}) {
    super(message, { ...options, code: ERROR_CODES.ANALYSIS_ERROR });
    this.name = 'AnalysisError';
  }
}

/** Внутренняя ошибка ядра. */
class InternalError extends OracleError {
  constructor(message, options = {}) {
    super(message, { ...options, code: ERROR_CODES.INTERNAL_ERROR });
    this.name = 'InternalError';
  }
}

/**
 * Является ли значение ошибкой ядра Oracle.
 * @param {unknown} value
 * @returns {boolean}
 */
function isOracleError(value) {
  return value instanceof OracleError || Boolean(value && value.isOracleError === true);
}

/**
 * Безопасная сериализация ошибки для публичного API.
 * Возвращает ТОЛЬКО код и безопасное сообщение — без stack trace, `details`,
 * значений секретов и прочих внутренних данных.
 * @param {unknown} error
 * @returns {{ error: { code: string, message: string } }}
 */
function toPublicJSON(error) {
  if (isOracleError(error)) {
    const code = error.code || ERROR_CODES.INTERNAL_ERROR;
    const message = error.publicMessage || DEFAULT_PUBLIC_MESSAGES[code] || DEFAULT_PUBLIC_MESSAGES.INTERNAL_ERROR;
    return { error: { code, message } };
  }

  // Неизвестная ошибка: наружу — только безопасная заглушка, без деталей.
  return {
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: DEFAULT_PUBLIC_MESSAGES.INTERNAL_ERROR }
  };
}

export {
  ERROR_CODES,
  OracleError,
  ValidationError,
  ConfigError,
  AnalysisError,
  InternalError,
  isOracleError,
  toPublicJSON
};
