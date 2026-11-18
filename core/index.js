// core/index.js — публичный runtime-фасад ядра Oracle Pro Terminal.
//
// ЭТАП 3.6.1 (базовые модули) + 3.6.2 (торговая логика) + 3.6.3 (AI Gateway)
// + 3.6.4 (оркестратор анализа).
// Назначение: централизованный доступ к модулям ядра.
//
// Импорт этого модуля НЕ выполняет побочных действий: ничего не запускает, не
// читает `process.env` на верхнем уровне, не делает сетевых вызовов, не логирует.
//
// Пока НЕ подключены: Market Data Engine (`core/market/*`) и существующий backend.
// Здесь: конфигурация, ошибки, валидация (3.6.1), торговая/Safe Mode логика
// (`core/trading/safeMode.js`, 3.6.2), AI Gateway (`core/ai/*`, 3.6.3) и
// оркестратор анализа (`core/analyze.js`, 3.6.4).
//
// Циклических импортов нет: `config` и `validate` зависят только от `errors`;
// `trading/safeMode` не зависит ни от чего; `ai/gateway` зависит от адаптеров
// `ai/openai`/`ai/gemini` (те — от `ai/parse` и аудита) и от `trading/safeMode`;
// `analyze` зависит от `validate`, `errors` и `ai/gateway` (не от фасада).

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
} from './config.js';

export {
  ERROR_CODES,
  OracleError,
  ValidationError,
  ConfigError,
  AnalysisError,
  InternalError,
  isOracleError,
  toPublicJSON
} from './errors.js';

export {
  TIMEFRAMES,
  HIGHER_TIMEFRAMES,
  RISK_MODES,
  TRADE_DIRECTIONS,
  validateAnalyzeRequest,
  validateSendResultRequest,
  validateCoreRequest
} from './validate.js';

export {
  findKeyLevels,
  analyzeSafeModeSetup,
  generateDetailedReport
} from './trading/safeMode.js';

export {
  cleanJsonResponse
} from './ai/parse.js';

export {
  getGPTAnalysis
} from './ai/openai.js';

export {
  getGeminiAnalysis
} from './ai/gemini.js';

export {
  getJointPrediction
} from './ai/gateway.js';

export {
  analyze
} from './analyze.js';
