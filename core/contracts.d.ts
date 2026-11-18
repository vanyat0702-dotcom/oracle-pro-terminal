/**
 * ORACLE PRO TERMINAL — единый контракт Oracle Backend.
 *
 * ЭТАП 3.4.3. В этом файле ТОЛЬКО типы. Реализаций, заглушек и функций здесь нет.
 *
 * Источник истины для формы данных — фактический обмен между frontend
 * (`src/App.tsx`) и Oracle Backend (`/api/analyze`). Поля, которых нет в текущем
 * обмене, здесь не объявляются.
 *
 * ВАЖНО: контракт описывает СОГЛАСОВАННУЮ (целевую) форму обмена.
 * Сегодня локальный Express (`server/index.js`) и Vercel (`api/analyze.ts`) расходятся;
 * их унификация — отдельные подэтапы. Эти типы фиксируют цель, а не текущее
 * расхождение, и не меняют поведение уже работающего кода.
 */

/* ============================================================================
 * Базовые типы-объединения
 * ========================================================================== */

/**
 * Торговый сигнал.
 * Обязательное архитектурное правило: любой сбой, отсутствие достоверных данных
 * или расхождение моделей приводят к 'SKIP' — никогда к 'CALL'/'PUT'.
 */
export type Signal = 'CALL' | 'PUT' | 'SKIP';

/** Направление открытой сделки. 'SKIP' сделкой не является. */
export type TradeDirection = 'CALL' | 'PUT';

/**
 * Боевой профиль торговли.
 * Значения подтверждены `src/App.tsx` (состояние riskMode / кнопки профилей).
 */
export type RiskMode =
  | 'SAFE'
  | 'BALANCED'
  | 'AGGRESSIVE'
  | 'BREAKOUT'
  | 'ANTITILT'
  | 'TRENDSURF';

/* ============================================================================
 * Frontend -> Oracle Backend
 * ========================================================================== */

/**
 * Запрос сканирования: POST /api/analyze без `action`.
 * Соответствует объекту, который формирует `src/App.tsx`
 * (requestPayload в fetchAiAnalysisFromBackend).
 */
export interface AnalyzeRequest {
  /** Валютные пары в формате displaySymbol, например "EUR/USD". */
  pairs: string[];
  /** Основной таймфрейм: "1" | "5" | "15" | "60" | "240". */
  timeframe: string;
  /** Старшие таймфреймы: "5" | "15" | "30" | "60" | "240" | "D". */
  higherTimeframes: string[];
  /** Боевой профиль торговли. */
  mode: RiskMode;
  /** Включён ли Safe Mode (проверка ключевых уровней перед вызовом ИИ). */
  safeModeEnabled: boolean;
  /** Сколько секунд осталось до закрытия текущей свечи. */
  secondsRemaining: number;
  /** Время открытия свечи в формате "HH:MM" (локальное время терминала). */
  candleOpenTime: string;
  /** Имена включённых стратегий. */
  activeStrategies: string[];
  /** Основная стратегия (первая включённая или "Мульти-стратегия"). */
  strategy: string;
  /** Фильтры, управляемые из интерфейса. */
  filters: {
    newsFilterEnabled: boolean;
    atrFilterEnabled: boolean;
    riskCapEnabled: boolean;
  };
}

/**
 * Запрос фиксации результата сделки: POST /api/analyze с `action: "send_result"`.
 * Соответствует телу запроса в `src/App.tsx` (блок завершения активной сделки).
 */
export interface SendResultRequest {
  action: 'send_result';
  /** Валютная пара в формате displaySymbol. */
  pair: string;
  /** Направление сделки. */
  direction: TradeDirection;
  /** Время открытия свечи в формате "HH:MM". */
  candleOpenTime: string;
  /** Идентификатор сделки, выданный при сканировании. */
  tradeId: number;
  /** Фактическая цена открытия. */
  openPrice: number;
  /** Фактическая цена закрытия. */
  closePrice: number;
}

/* ============================================================================
 * Oracle Backend -> Frontend
 * ========================================================================== */

/**
 * Расширенный отчёт для истории терминала.
 * Форма подтверждена `src/App.tsx` (detailedReport) и `ai-consensus.js`.
 */
export interface DetailedReport {
  mode: string;
  status: string;
  levelDetails: string;
  aiVerdictGPT: string;
  aiVerdictGemini: string;
  riskLevel: string;
  /** Добавляется frontend-фолбэком для отображения отправленного запроса. */
  requestPayloadJson?: string;
  /** Добавляется frontend-фолбэком для отображения полученного ответа. */
  responsePayloadJson?: string;
}

/**
 * Результат анализа — поле `result` в ответе /api/analyze.
 * Поля без пометки обязательны во всех текущих ветках ответа;
 * опциональные — присутствуют не всегда и во frontend уже проверяются на undefined.
 */
export interface AnalyzeResult {
  signal: Signal;
  /** Уверенность модели, 0..100. */
  confidence: number;
  tradeId: number;
  reasoning?: string;
  /** Рекомендуемая экспирация, например "1M" | "5M". */
  recommendedExpiration?: string;
  /** Пара, выбранная ядром для сделки. */
  bestPair?: string;
  /** Время открытия свечи, "HH:MM". */
  candleOpenTime?: string;
  detailedReport?: DetailedReport;
}

/**
 * Транспортный ответ /api/analyze.
 * При ошибке конфигурации Vercel возвращает `{ success:false, error }` без `result`;
 * локальный Express при сбое возвращает `{ success:false, result: <SKIP> }`.
 */
export interface AnalyzeResponse {
  success: boolean;
  result?: AnalyzeResult;
  error?: string;
  message?: string;
}

/* ============================================================================
 * Market Data Engine — ТОЛЬКО типы.
 * Реализация поставщика отсутствует и в этом этапе не создаётся.
 * ========================================================================== */

/** Одна свеча OHLC. */
export interface MarketCandle {
  /** Время начала свечи: Unix-время, секунды, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Объём, если источник его предоставляет. */
  volume?: number;
}

/** Снимок рыночных данных по одной паре и таймфрейму. */
export interface MarketDataSnapshot {
  /** Валютная пара, например "EUR/USD". */
  pair: string;
  /** Таймфрейм, например "1" | "5" | "15" | "60" | "240". */
  timeframe: string;
  candles: MarketCandle[];
  /** Текущая цена, если источник её предоставляет. */
  currentPrice?: number;
}

/** Параметры запроса рыночных данных: пара, таймфрейм и временной диапазон. */
export interface MarketDataRequest {
  /** Валютная пара, например "EUR/USD". */
  pair: string;
  /** Таймфрейм, например "1" | "5" | "15" | "60" | "240". */
  timeframe: string;
  /** Начало диапазона: Unix-время, секунды, UTC. */
  from: number;
  /** Конец диапазона: Unix-время, секунды, UTC. */
  to: number;
}

/**
 * Интерфейс поставщика РЕАЛЬНЫХ рыночных данных.
 *
 * Реализации нет: она появится отдельным подэтапом и будет подключена к
 * независимому источнику котировок (не к ИИ). Синтетические свечи запрещены.
 */
export interface MarketDataProvider {
  /** Свечи за указанный диапазон. */
  getCandles(request: MarketDataRequest): Promise<MarketCandle[]>;
  /** Снимок (свечи и, при наличии, текущая цена) за указанный диапазон. */
  getSnapshot(request: MarketDataRequest): Promise<MarketDataSnapshot>;
}
