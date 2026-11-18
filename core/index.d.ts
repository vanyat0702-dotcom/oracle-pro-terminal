/**
 * ORACLE PRO TERMINAL — публичная точка ядра (`core`).
 *
 * ЭТАП 3.6.1 (базовые модули) + 3.6.2 (торговая логика) + 3.6.3 (AI Gateway)
 * + 3.6.4 (оркестратор анализа).
 * Здесь объявлены:
 *   - контракты обмена (`export * from './contracts.js'`);
 *   - публичный runtime-интерфейс базовых модулей ядра 3.6.1
 *     (config / errors / validate), реализованных в одноимённых `.js`-файлах;
 *   - публичный runtime-интерфейс торгового модуля 3.6.2
 *     (`core/trading/safeMode.js`);
 *   - публичный runtime-интерфейс AI Gateway 3.6.3 (`core/ai/*`);
 *   - публичный runtime-интерфейс оркестратора анализа 3.6.4 (`core/analyze.js`).
 *
 * Реализации находятся в `core/config.js`, `core/errors.js`, `core/validate.js`,
 * `core/trading/safeMode.js`, `core/ai/*`, `core/analyze.js`, `core/index.js`.
 * Код ядра написан на `.js` и НЕ проверяется компилятором (`allowJs: false`) —
 * эти объявления описывают публичный контракт вручную и должны поддерживаться в
 * актуальном состоянии.
 *
 * Пока НЕ подключены: Market Data Engine и существующий backend.
 * Существующие API-контракты не изменяются.
 */

import type {
  AnalyzeRequest,
  SendResultRequest,
  AnalyzeResult,
  DetailedReport,
  Signal
} from './contracts.js';
import type { RuntimeContext } from './runtimeGuard.js';

// Phase 3B Increment 3: these existing exports call the same guarded implementations
// as direct imports. Missing/forged contexts deny before payload validation or AI work.
// There is no positive live issuer: analysis/Gateway return SKIP and AI adapters null.

export * from './contracts.js';

/* ============================================================================
 * core/config.js — конфигурация ядра (значения секретов наружу не отдаются)
 * ========================================================================== */

/** Наличие переменных окружения (только boolean, без значений). */
export interface EnvPresence {
  [name: string]: boolean;
}

/** Безопасный снимок конфигурации ядра. */
export interface CoreConfig {
  /** Факт наличия каждой известной переменной (значения не раскрываются). */
  envPresent: EnvPresence;
  /** Известные ядру переменные, которых нет в окружении (или они пусты). */
  missing: string[];
  /** Порт локального API (несекретная настройка). */
  port: number;
}

/** Имена секретных переменных окружения. */
export declare const SECRET_ENV_KEYS: readonly string[];
/** Имена несекретных переменных окружения. */
export declare const PUBLIC_ENV_KEYS: readonly string[];
/** Полный список известных ядру переменных окружения. */
export declare const ENV_KEYS: readonly string[];
/** Порт локального API по умолчанию. */
export declare const DEFAULT_PORT: number;

/** Значение переменной окружения или `undefined`, если её нет/она пуста. */
export declare function readEnv(name: string): string | undefined;
/** Задана ли переменная окружения (непустая). */
export declare function hasEnv(name: string): boolean;
/** Карта наличия переменных: имя -> boolean. Значения не раскрываются. */
export declare function getEnvPresence(names?: readonly string[]): EnvPresence;
/** Список отсутствующих переменных из переданного набора. */
export declare function getMissingEnv(names?: readonly string[]): string[];
/**
 * Требовать наличие переменной. Бросает `ConfigError`, если её нет.
 * В сообщении — только имя переменной, не её значение.
 */
export declare function requireEnv(name: string): string;
/** Безопасный снимок конфигурации ядра. */
export declare function getConfig(): CoreConfig;

/* ============================================================================
 * core/errors.js — единая система ошибок ядра
 * ========================================================================== */

/** Коды ошибок ядра. */
export type OracleErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFIG_ERROR'
  | 'ANALYSIS_ERROR'
  | 'INTERNAL_ERROR';

export declare const ERROR_CODES: {
  readonly VALIDATION_ERROR: 'VALIDATION_ERROR';
  readonly CONFIG_ERROR: 'CONFIG_ERROR';
  readonly ANALYSIS_ERROR: 'ANALYSIS_ERROR';
  readonly INTERNAL_ERROR: 'INTERNAL_ERROR';
};

export interface OracleErrorOptions {
  code?: OracleErrorCode;
  /** Безопасное сообщение для публичного API. Не должно содержать секретов. */
  publicMessage?: string;
  /** Внутренние детали: НЕ попадают в публичную сериализацию. */
  details?: unknown;
}

/** Базовый класс ошибок ядра. */
export declare class OracleError extends Error {
  constructor(message?: string, options?: OracleErrorOptions);
  readonly code: OracleErrorCode;
  readonly publicMessage: string;
  readonly details?: unknown;
  readonly isOracleError: true;
}

/** Ошибка валидации входа. */
export declare class ValidationError extends OracleError {
  constructor(message?: string, options?: Omit<OracleErrorOptions, 'code'>);
}

/** Ошибка конфигурации. */
export declare class ConfigError extends OracleError {
  constructor(message?: string, options?: Omit<OracleErrorOptions, 'code'>);
}

/** Ошибка анализа. */
export declare class AnalysisError extends OracleError {
  constructor(message?: string, options?: Omit<OracleErrorOptions, 'code'>);
}

/** Внутренняя ошибка ядра. */
export declare class InternalError extends OracleError {
  constructor(message?: string, options?: Omit<OracleErrorOptions, 'code'>);
}

/** Является ли значение ошибкой ядра Oracle. */
export declare function isOracleError(value: unknown): value is OracleError;

/**
 * Безопасная сериализация ошибки для публичного API.
 * Возвращает только `code` и безопасное `message` — без stack trace, `details`
 * и значений секретов.
 */
export declare function toPublicJSON(error: unknown): {
  error: { code: OracleErrorCode; message: string };
};

/* ============================================================================
 * core/validate.js — валидация и нормализация входа ядра
 * ========================================================================== */

/** Допустимые основные таймфреймы. */
export declare const TIMEFRAMES: readonly string[];
/** Допустимые старшие таймфреймы. */
export declare const HIGHER_TIMEFRAMES: readonly string[];
/** Допустимые боевые профили. */
export declare const RISK_MODES: readonly string[];
/** Допустимые направления сделки. */
export declare const TRADE_DIRECTIONS: readonly string[];

/**
 * Валидировать и нормализовать запрос сканирования.
 * Бросает `ValidationError`; не мутирует вход.
 */
export declare function validateAnalyzeRequest(payload: unknown): AnalyzeRequest;
/**
 * Валидировать и нормализовать запрос фиксации результата.
 * Бросает `ValidationError`; не мутирует вход.
 */
export declare function validateSendResultRequest(payload: unknown): SendResultRequest;
/**
 * Диспетчер: `action: "send_result"` -> `SendResultRequest`, иначе -> `AnalyzeRequest`.
 */
export declare function validateCoreRequest(payload: unknown): AnalyzeRequest | SendResultRequest;

/* ============================================================================
 * core/trading/safeMode.js — Safe Mode и ключевые уровни M5/M15 (этап 3.6.2)
 * Перенесено 1:1 из legacy `safe-strategy.js` (сохранён как compatibility shim).
 * ========================================================================== */

/**
 * Свеча в форме, которую принимает Safe Mode.
 * Совместимо с `MarketCandle`; поля `h`/`l` поддержаны фактической реализацией
 * (`c.high || c.h || 1.08500`).
 */
export interface SafeModeCandle {
  high?: number;
  h?: number;
  low?: number;
  l?: number;
}

/** Ключевые уровни, рассчитанные по свечам. */
export interface KeyLevels {
  support: number | null;
  resistance: number | null;
  zoneWidth: number;
}

/** Результат проверки Safe Mode. */
export interface SafeModeSetupResult {
  isTriggered: boolean;
  nearSupport: boolean;
  nearResistance: boolean;
  activeLevel: number | null;
  levels: KeyLevels;
}

/** Вход Safe Mode: только фактически используемые реализацией поля. */
export interface SafeModeInput {
  currentPrice?: number;
  candles?: SafeModeCandle[];
}

/** Минимальный ответ ИИ, из которого Safe Mode берёт обоснование. */
export interface SafeModeAiVerdict {
  reasoning?: string;
}

/**
 * Рассчитать ключевые уровни по свечам.
 * Менее 5 свечей (или отсутствие массива) -> `{ support: null, resistance: null, zoneWidth: 0 }`.
 */
export declare function findKeyLevels(candles?: SafeModeCandle[]): KeyLevels;

/** Проверить близость текущей цены к ключевым уровням (Safe Mode). */
export declare function analyzeSafeModeSetup(marketData: SafeModeInput): SafeModeSetupResult;

/** Сформировать развёрнутый отчёт Safe Mode (структурно совместим с `DetailedReport`). */
export declare function generateDetailedReport(
  setupResult: SafeModeSetupResult,
  gptResult?: SafeModeAiVerdict | null,
  geminiResult?: SafeModeAiVerdict | null
): DetailedReport;

/* ============================================================================
 * core/ai/* — AI Gateway: gateway + адаптеры OpenAI/Gemini (этап 3.6.3)
 * Перенесено 1:1 из legacy `ai-consensus.js` (сохранён как compatibility shim).
 * Секреты читаются только в момент вызова; при импорте env не читается.
 * ========================================================================== */

/** Разобранный вердикт модели (поля, которые реально читает код). */
export interface AiModelVerdict {
  direction?: Signal;
  confidence?: number;
  reasoning?: string;
  recommendedExpiration?: string;
}

/**
 * Вход AI Gateway: рыночные данные, которые передаются моделям.
 * Форма совместима с телом запроса `/api/analyze`; ядро читает только
 * перечисленные поля, остальное передаётся моделям как есть.
 */
export interface AiMarketData {
  pairs?: string[];
  safeModeEnabled?: boolean;
  candles?: SafeModeCandle[];
  currentPrice?: number;
  [key: string]: unknown;
}

/**
 * Разобрать текстовый ответ модели в JSON (снимает Markdown-обёртки ```json```).
 * При пустом/некорректном входе возвращает `null`.
 */
export declare function cleanJsonResponse(content: unknown): unknown;

/** Запрос к OpenAI (gpt-4o). При ошибке/некорректном ответе возвращает `null`. */
export declare function getGPTAnalysis(marketData: unknown, runtimeContext?: RuntimeContext): Promise<AiModelVerdict | null>;

/** Запрос к Google Gemini (gemini-1.5-pro). При ошибке/некорректном ответе возвращает `null`. */
export declare function getGeminiAnalysis(marketData: unknown, runtimeContext?: RuntimeContext): Promise<AiModelVerdict | null>;

/**
 * Главная функция консенсуса GPT + Gemini с защитой Safe Mode и Анти-Тильта.
 * Возвращает структуру, совместимую с `AnalyzeResult`.
 */
export declare function getJointPrediction(marketData: unknown, runtimeContext?: RuntimeContext): Promise<AnalyzeResult>;

/* ============================================================================
 * core/analyze.js — оркестратор анализа (этап 3.6.4)
 * Последовательность: validate (`core/validate.js`) -> AI Gateway
 * (`core/ai/gateway.js`, внутри — Safe Mode + GPT/Gemini + consensus) -> результат.
 * Ошибки — через `core/errors.js`. Не дублирует AI/Safe Mode/торговую логику.
 * ========================================================================== */

/**
 * Выполнить анализ сканирования (`AnalyzeRequest`) через ядро.
 *
 * Валидирует вход (`validateAnalyzeRequest`; некорректный вход -> `ValidationError`)
 * и делегирует AI Gateway. В Gateway передаётся исходный объект запроса без
 * изменений (см. контрактный разрыв: `AnalyzeRequest` не содержит `candles`/
 * `currentPrice`, используемые Safe Mode и промптами). Непредвиденная ошибка
 * Gateway оборачивается в безопасную `AnalysisError`; сигнал `CALL`/`PUT` при
 * ошибке не создаётся.
 */
export declare function analyze(request: unknown, runtimeContext?: RuntimeContext): Promise<AnalyzeResult>;
