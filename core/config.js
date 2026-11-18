// core/config.js — централизованное чтение конфигурации ядра.
//
// ЭТАП 3.6.1. Модуль ИЗОЛИРОВАН: пока НЕ подключён к `server/index.js` или
// `api/analyze.ts`.
//
// Безопасность:
//   - `process.env` читается ТОЛЬКО внутри функций (нет чтения на верхнем уровне);
//   - значения секретов НИКОГДА не логируются и не возвращаются в публичные
//     структуры — наружу отдаётся только факт наличия (boolean);
//   - отсутствие переменных НЕ вызывает падения приложения: модуль лишь
//     сообщает об их отсутствии;
//   - `.env` и другие файлы с секретами не читаются и не изменяются;
//   - реальные API-запросы не выполняются;
//   - настройки FXCM / Market Data Engine здесь отсутствуют (не этап).

import { ConfigError } from './errors.js';

/** Имена секретных переменных. Значения наружу не отдаются. */
const SECRET_ENV_KEYS = Object.freeze([
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID'
]);

/** Имена несекретных переменных. */
const PUBLIC_ENV_KEYS = Object.freeze(['PORT']);

/** Полный список известных ядру переменных окружения. */
const ENV_KEYS = Object.freeze([...SECRET_ENV_KEYS, ...PUBLIC_ENV_KEYS]);

/** Порт локального API по умолчанию (совпадает с `server/index.js`: `PORT || 3000`). */
const DEFAULT_PORT = 3000;

/**
 * Безопасное чтение переменной окружения.
 * Возвращает значение как есть (без обрезки — чтобы не изменять секреты) либо
 * `undefined`, если переменная отсутствует или состоит только из пробелов.
 * @param {string} name
 * @returns {string | undefined}
 */
function readEnv(name) {
  if (typeof name !== 'string' || name.length === 0) return undefined;
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return value;
}

/**
 * Задана ли переменная окружения (непустая).
 * @param {string} name
 * @returns {boolean}
 */
function hasEnv(name) {
  return readEnv(name) !== undefined;
}

/**
 * Карта наличия переменных: имя -> boolean. Значения НЕ раскрываются.
 * @param {readonly string[]} [names] По умолчанию — все известные ядру переменные.
 * @returns {Record<string, boolean>}
 */
function getEnvPresence(names = ENV_KEYS) {
  const list = Array.isArray(names) ? names : ENV_KEYS;
  /** @type {Record<string, boolean>} */
  const presence = {};
  for (const name of list) {
    presence[name] = hasEnv(name);
  }
  return presence;
}

/**
 * Список отсутствующих (или пустых) переменных из переданного набора.
 * @param {readonly string[]} [names] По умолчанию — все известные ядру переменные.
 * @returns {string[]}
 */
function getMissingEnv(names = ENV_KEYS) {
  const list = Array.isArray(names) ? names : ENV_KEYS;
  return list.filter((name) => !hasEnv(name));
}

/**
 * Требовать наличие переменной. Бросает `ConfigError`, если её нет.
 * В сообщение попадает ТОЛЬКО имя переменной — не её значение.
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = readEnv(name);
  if (value === undefined) {
    throw new ConfigError(`Missing required environment variable: ${name}`, {
      details: { variable: name }
    });
  }
  return value;
}

/**
 * Безопасный снимок конфигурации ядра. Значения секретов не включаются —
 * только факт наличия и несекретный порт.
 * @returns {{ envPresent: Record<string, boolean>, missing: string[], port: number }}
 */
function getConfig() {
  const envPresent = getEnvPresence(ENV_KEYS);
  const missing = ENV_KEYS.filter((name) => !envPresent[name]);
  const parsedPort = Number(readEnv('PORT'));

  return {
    envPresent,
    missing,
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT
  };
}

export {
  SECRET_ENV_KEYS,
  PUBLIC_ENV_KEYS,
  ENV_KEYS,
  DEFAULT_PORT,
  readEnv,
  hasEnv,
  getEnvPresence,
  getMissingEnv,
  requireEnv,
  getConfig
};
