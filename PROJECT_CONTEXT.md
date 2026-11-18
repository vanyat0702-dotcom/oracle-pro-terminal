# PROJECT_CONTEXT — ORACLE PRO TERMINAL v10.5.0

> **Актуализация 2026-11-19: Phase 3B / Increment 4C — process-local регистрация происхождения (§21).**
> Только закрытый фиксированный экземпляр Market Service регистрирует свои observations.
> Публичная DI-фабрика не регистрирует данные. Origin не означает свежесть, Eligibility
> или runtime-допуск; Biquote остаётся DISPLAY-only, Guard — deny-only.

> **Актуализация 2026-11-19: Phase 3B / Increment 4B — изолированные lifecycle contracts и pure state machine (§20).**
> Только неизменяемые модели, явные часы, планирование и применение переходов.
> Issuer/capability не создаются; каждый результат grantsRuntimeAccess=false.
> Runtime Guard и все торговые HTTP-блокировки остаются без изменений.

> **Актуализация 2026-11-19: Phase 3B / Increment 3 — обязательный deny-only Runtime Guard (§19).**
> analyze/Gateway возвращают SKIP, оба торговых AI-адаптера — null до чтения payload,
> API-ключей и сетевых вызовов. Положительный live-допуск не выдаётся. Прямые импорты,
> facade и legacy shim защищены. Ранее описанные обходы этих функций теперь закрыты.

> **Актуализация 2026-11-19: Phase 3B / Increment 2 — server-owned Source Registry и Market Service (§18).**
> Изолированный сервис получает данные через существующий provider, но не включён в
> HTTP/AI/график. Biquote разрешён только для DISPLAY; unknown tick/session дают DENIED.

> **Актуализация 2026-11-19: Phase 3B / Increment 1 — независимые Quality/Eligibility contracts и pure evaluators (§17).**
> Это только оценочные отчёты, без Runtime Guard, контекста допуска или интеграции
> в Core/HTTP/AI. Диагностический Biquote и график не изменены, HTTP-анализ закрыт.

> **Актуализация 2026-11-18: MDE Phase 2 — отдельный локальный график EURUSD M1 (§16).**
> TradingView сохранён; диагностические свечи Biquote не поступают в AI/торговый путь.

> **Актуализация 2026-11-18: MDE Phase 1 — Biquote EURUSD M1, только диагностика.**
> Реализован изолированный provider и opt-in локальный тестовый endpoint (§15).
> Это не полноценный MDE/Eligibility Gate; HTTP-анализ остаётся fail-closed.
> Утверждения более ранних разделов об отсутствии любой реализации MDE — исторические.

> **Актуализация 2026-11-18: 3.6.8-B / HTTP EntryPoints Safety / Increment A выполнен и проверен.**
> Обычная HTTP-ветка Express `/api/analyze` больше не вызывает Core/AI Gateway:
> временно возвращает `SKIP`, как существующий Vercel-обработчик. MDE и обязательный
> Eligibility Gate отсутствуют; прямые вызовы Core этой блокировкой не защищены.
> **Весь этап 3.6.8-B не объявлен завершённым.** Подробности и проверки — §14.
> Разделы 1–13 ниже сохранены как исторический срез 3.6.5-A; утверждения о текущем
> HTTP-пути, fallback CALL, симуляции результатов и отсутствии тестов нужно читать
> с учётом уточнений §14 и фактического кода.

> Единый документ состояния проекта. Описывает **реальное текущее состояние**
> на момент завершения этапа **3.6.5-A** (локальный Express подключён к единому
> оркестратору ядра `core/analyze.js`: запрос -> валидация -> AI Gateway ->
> результат; Vercel-адаптер пока **не** интегрирован).
>
> Обозначения: **[РЕАЛИЗОВАНО]** — существует в коде · **[ЗАПЛАНИРОВАНО]** —
> только спроектировано, в коде отсутствует · **[ТЕХДОЛГ]** — работает, но требует
> переработки.
>
> Ничто в разделах «ЗАПЛАНИРОВАНО» не реализовано и не подключено.

---

## 1. Назначение проекта

ORACLE PRO TERMINAL — ИИ-терминал для анализа бинарных опционов:

- **Frontend**: React-терминал (мультивыбор валютных пар, авто-сканирование,
  история сделок, расширенные отчёты ИИ, графики TradingView).
- **Backend**: Oracle Backend, работающий и локально (Express), и на Vercel
  (Serverless Functions).
- **AI**: две независимые модели (GPT и Gemini) через HTTP API; результат — это
  торговый сигнал `CALL` / `PUT` / `SKIP`.

Целевой архитектурный принцип: единое транспортно-независимое ядро, к которому
локальный Express и Vercel подключаются как тонкие адаптеры. На этапе 3.4.3
заложены только типы и документация этого ядра; на этапе 3.4.4 Express-сервер
перенесён в `server/index.js`; на этапе 3.4.7 реализация аудита перенесена в
зону наблюдаемости `core/observability/audit.js`; на этапе 3.6.0 временный shim
`ai-debugger.js` удалён, а вызывающие модули переведены на прямой импорт из ядра;
на этапе 3.6.1 добавлены базовые runtime-модули ядра (`config`, `errors`,
`validate`, фасад `index.js`) — пока изолированные и не подключённые к backend;
на этапе 3.6.2 торговая/Safe Mode логика перенесена из `safe-strategy.js` в ядро
(`core/trading/safeMode.js`) с сохранением поведения 1:1, а legacy-файл оставлен
тонким compatibility shim; на этапе 3.6.3 AI-интеграция (GPT-4o + Gemini)
перенесена из `ai-consensus.js` в ядро (`core/ai/`: gateway + адаптеры) с
сохранением поведения 1:1, а `ai-consensus.js` оставлен тонким compatibility shim;
на этапе 3.6.4 добавлен единый оркестратор анализа `core/analyze.js`
(валидация -> AI Gateway -> результат), который делегирует существующие модули
ядра; на этапе 3.6.5-A локальный Express (`server/index.js`) подключён к этому
оркестратору и стал тонким адаптером (Vercel-адаптер `api/analyze.ts` пока не
интегрирован).

---

## 2. Стек и версии

| Слой | Технология | Версия / статус |
|---|---|---|
| Runtime | Node.js (цель) | 24 LTS (`.nvmrc` = `24`, `engines: >=24.0.0 <25.0.0`) |
| Runtime (факт машины) | Node.js | v26.13.0 (даёт `EBADENGINE`, не блокирует) |
| Пакетный менеджер | npm | 11.20.0 (запускать через `npm.cmd`) |
| Язык | TypeScript | `^5.5.3` в `package.json`, фактически установлен **5.9.3** |
| Frontend | React | `^18.3.1` (+ `react-dom ^18.3.1`) |
| Frontend | Vite | `^5.3.4` |
| Frontend | Tailwind CSS | `^3.4.1` (+ `postcss`, `autoprefixer`) |
| Frontend | lucide-react (иконки) | `^1.16.0` |
| Backend (локально) | Express | `^5.3.0` |
| Backend (прод) | Vercel Serverless (`@vercel/node`) | `^3.0.0` (devDependency) |
| HTTP-клиент | axios | `^1.21.1` (используется в `core/ai/openai.js` и `core/ai/gemini.js`) |
| CORS / env | cors `^2.8.6`, dotenv `^18.0.10` | — |
| Модульная система | ESM | `"type": "module"` (единая, без CommonJS) |

---

## 3. Актуальная структура проекта

Состояние **после** этапа 3.6.5-A. `[N]` — создано на этапе 3.4.3, `[ПЛАН]` — ещё
не существует.

```
oracle-pro-terminal/
├─ api/                              [РЕАЛИЗОВАНО] Backend-транспорт (Vercel)
│  ├─ analyze.ts                     POST /api/analyze (Vercel)
│  └─ brain.ts                       POST /api/brain — сирота, не вызывается
│
├─ core/                             ядро (типы + runtime 3.6.1/3.6.2 + AI 3.6.3 + оркестратор 3.6.4)
│  ├─ contracts.d.ts                 [N] единый контракт запроса/ответа
│  ├─ index.d.ts                     публичный тип-фасад ядра (+ runtime-типы 3.6.1–3.6.4)
│  ├─ index.js                       [РЕАЛИЗОВАНО] runtime-фасад ядра (этап 3.6.1)
│  ├─ config.js                      [РЕАЛИЗОВАНО] конфигурация ядра (этап 3.6.1)
│  ├─ errors.js                      [РЕАЛИЗОВАНО] система ошибок ядра (этап 3.6.1)
│  ├─ validate.js                    [РЕАЛИЗОВАНО] валидация входа ядра (этап 3.6.1)
│  ├─ analyze.js                     [РЕАЛИЗОВАНО] оркестратор анализа (этап 3.6.4)
│  ├─ ai/
│  │  ├─ gateway.js                  [РЕАЛИЗОВАНО] AI Gateway: консенсус GPT+Gemini (этап 3.6.3)
│  │  ├─ openai.js                   [РЕАЛИЗОВАНО] адаптер OpenAI gpt-4o (этап 3.6.3)
│  │  ├─ gemini.js                   [РЕАЛИЗОВАНО] адаптер Gemini gemini-1.5-pro (этап 3.6.3)
│  │  └─ parse.js                    [РЕАЛИЗОВАНО] разбор ответа модели в JSON (этап 3.6.3)
│  ├─ trading/
│  │  └─ safeMode.js                 [РЕАЛИЗОВАНО] Safe Mode + уровни (этап 3.6.2)
│  └─ observability/                 [РЕАЛИЗОВАНО] зона сквозной диагностики
│     └─ audit.js                    аудит payload/ответов моделей (этап 3.4.7)
│
├─ scripts/
│  └─ dev.mjs                        [РЕАЛИЗОВАНО] launcher: API + Vite
│
├─ server/                           [РЕАЛИЗОВАНО] Backend-транспорт (Express)
│  └─ index.js                       Express-вход (3.4.4); с 3.6.5-A — тонкий адаптер к `core/analyze.js`
│
├─ src/                              [РЕАЛИЗОВАНО] Frontend
│  ├─ components/TerminalChart.tsx   виджет TradingView
│  ├─ config/pairs.ts                список торговых пар (TRADING_PAIRS)
│  ├─ App.tsx                        весь UI/состояние/вызовы backend
│  ├─ index.css
│  └─ main.tsx                       bootstrap React
│
├─ .env.example                      [РЕАЛИЗОВАНО] шаблон переменных окружения
├─ .gitignore                        [РЕАЛИЗОВАНО]
├─ .nvmrc                            [РЕАЛИЗОВАНО] = 24
├─ ai-consensus.js                   [РЕАЛИЗОВАНО] ВРЕМЕННЫЙ shim: re-export из core/ai/gateway.js (этап 3.6.3)
├─ index.html                        [РЕАЛИЗОВАНО] HTML-точка входа Vite
├─ package.json                      [РЕАЛИЗОВАНО]
├─ package-lock.json                 [РЕАЛИЗОВАНО]
├─ postcss.config.js                 [РЕАЛИЗОВАНО]
├─ README.md                         [РЕАЛИЗОВАНО] заглушка
├─ safe-strategy.js                  [РЕАЛИЗОВАНО] ВРЕМЕННЫЙ shim: re-export из core/trading/safeMode.js (этап 3.6.2)
├─ SignalWidget.jsx                  сирота (обращается к /api/get-signal)
├─ tailwind.config.js                [РЕАЛИЗОВАНО]
├─ tsconfig.json                     [РЕАЛИЗОВАНО]
└─ vite.config.ts                    [РЕАЛИЗОВАНО]
```

**Ядро `core/` содержит типы, базовые runtime-модули, торговую логику, AI Gateway,
оркестратор анализа и одну реализованную зону.** Реализовано: `contracts.d.ts`,
`index.d.ts` (типы), runtime-модули этапа 3.6.1 (`core/index.js` — фасад,
`core/config.js`, `core/errors.js`, `core/validate.js`), торговая логика этапа 3.6.2
(`core/trading/safeMode.js`), AI Gateway этапа 3.6.3 (`core/ai/*`: `gateway.js`,
`openai.js`, `gemini.js`, `parse.js`), оркестратор анализа этапа 3.6.4
(`core/analyze.js`), а также `core/observability/audit.js` (аудит, этап 3.4.7).
Оркестратор анализа с 3.6.5-A используется локальным Express; Vercel-адаптер ещё
не подключён. Остальные реализации (`core/market/*`, `core/notify/*`,
`core/trading/result.js`) — **[ЗАПЛАНИРОВАНО]** и будут создаваться на отдельных
подэтапах (см. §5).

Временный shim `ai-debugger.js` **удалён на этапе 3.6.0**. Вызывающие модули
импортируют аудит напрямую из ядра; реализация функций находится **только** в
`core/observability/audit.js`.

Временный shim `safe-strategy.js` (этап 3.6.2) реэкспортирует функции из
`core/trading/safeMode.js`. На этапе 3.6.3 AI-логика переехала в `core/ai/*` и
импортирует Safe Mode напрямую из ядра, поэтому **у `safe-strategy.js` больше нет
импортёров**; файл сохранён как shim (удаление — отдельный подэтап).

Временный shim `ai-consensus.js` (этап 3.6.3) реэкспортирует `getJointPrediction`
из `core/ai/gateway.js`. На этапе 3.6.5-A `server/index.js` переведён на прямой
импорт `analyze` из `core/index.js`, поэтому **у `ai-consensus.js` больше нет
импортёров**; файл сохранён как shim (удаление — отдельный подэтап).

Карта импортов аудита (после этапа 3.6.3 — из адаптеров ядра):

| Кто импортирует | Импорт | Что вызывает |
|---|---|---|
| `server/index.js` | `import * as aiDebugger from '../core/observability/audit.js'` | `auditIncomingPayload` |
| `core/ai/openai.js` | `import * as aiDebugger from '../observability/audit.js'` | `auditModelResponse` (`GPT-4o Vision`) |
| `core/ai/gemini.js` | `import * as aiDebugger from '../observability/audit.js'` | `auditModelResponse` (`Gemini 1.5 Pro`) |

---

## 4. Зоны ответственности (восемь)

Разделение зафиксировано как обязательное архитектурное требование.

| Зона | Каталог | Ответственность | Не имеет права |
|---|---|---|---|
| **Frontend** | `src/` | UI, состояние, вызовы Oracle Backend | знать про env/ключи, содержать бизнес-логику |
| **Backend-транспорт (Vercel)** | `api/` | приём HTTP, методы/CORS, маппинг в ядро | содержать бизнес-логику |
| **Backend-транспорт (Express)** | `server/` **[РЕАЛИЗОВАНО]** (с 3.6.5-A анализ идёт через `core/analyze.js`; Vercel пока не унифицирован) | приём HTTP, маршруты, маппинг в ядро | содержать бизнес-логику |
| **AI Gateway** | `core/ai/` **[ЧАСТИЧНО РЕАЛИЗОВАНО]** (gateway + адаптеры, этап 3.6.3) | вызовы моделей, разбор, консенсус | знать про HTTP, генерировать сигналы |
| **Market Data Engine** | `core/market/` **[ПЛАН]** | интерфейс поставщика **реальных** котировок | генерировать искусственные данные |
| **Trading logic** | `core/trading/` **[ЧАСТИЧНО РЕАЛИЗОВАНО]** (Safe Mode + уровни — этап 3.6.2; расчёт результата — план) | Safe Mode, уровни, результат по ценам | использовать `Math.random()` для сигналов/результатов |
| **Observability** | `core/observability/` **[РЕАЛИЗОВАНО]** (этап 3.4.7) | сквозная диагностика и логирование (аудит payload и ответов моделей) | содержать торговую логику, влиять на сигналы |
| **Конфигурация / инфраструктура** | `core/config.js` **[РЕАЛИЗОВАНО]** (этап 3.6.1), `scripts/`, root-конфиги | env, запуск, сборка | смешиваться с бизнес-логикой |

Сегодня зоны частично «размазаны» по legacy-файлам (`server/index.js`,
`api/analyze.ts`). Локальный Express с 3.6.5-A делегирует анализ
`core/analyze.js`; Vercel-адаптер ещё содержит собственную логику. Аудит вынесен в
зону наблюдаемости (`core/observability/audit.js`); Safe Mode/уровни вынесены в
зону торговой логики (`core/trading/safeMode.js`, этап 3.6.2); AI-вызовы вынесены в
зону AI Gateway (`core/ai/*`, этап 3.6.3); разнесение остального по зонам — предмет
будущих подэтапов.

---

## 5. Архитектура единого ядра (частично реализовано)

Принятое решение (этап 3.4.2): **ядро — ESM JavaScript + публичные `.d.ts`,
адаптеры тонкие, новые зависимости не добавляются.**

```
core/
  index.js                   [РЕАЛИЗОВАНО] публичный runtime-фасад ядра (этапы 3.6.1–3.6.4)
  index.d.ts                 публичные типы ядра (контракты + runtime 3.6.1–3.6.4)
  contracts.d.ts             [РЕАЛИЗОВАНО] единый контракт
  analyze.js                 [РЕАЛИЗОВАНО] оркестрация: validate -> AI Gateway -> результат (этап 3.6.4)
  validate.js                [РЕАЛИЗОВАНО] валидация/нормализация входа (этап 3.6.1)
  errors.js                  [РЕАЛИЗОВАНО] коды ошибок и политика «любой сбой -> SKIP» (этап 3.6.1)
  config.js                  [РЕАЛИЗОВАНО] чтение env (только имена/наличие) (этап 3.6.1)
  ai/
    gateway.js               [РЕАЛИЗОВАНО] консенсус GPT+Gemini, Safe Mode, Анти-Тильт (этап 3.6.3)
    openai.js                [РЕАЛИЗОВАНО] адаптер OpenAI gpt-4o (этап 3.6.3)
    gemini.js                [РЕАЛИЗОВАНО] адаптер Gemini gemini-1.5-pro (этап 3.6.3)
    parse.js                 [РЕАЛИЗОВАНО] разбор ответа модели в JSON (этап 3.6.3)
  market/
    provider.d.ts            интерфейс поставщика реальных котировок (только типы)
  trading/
    safeMode.js              [РЕАЛИЗОВАНО] <- safe-strategy.js (поведение 1:1), этап 3.6.2
    result.js                [ПЛАН] расчёт win/pips по фактическим ценам
  observability/
    audit.js                 [РЕАЛИЗОВАНО] <- ai-debugger.js (1:1), этап 3.4.7
  notify/
    telegram.js              уведомления Telegram
```

Правила ядра (обязательные):

- ядро **не импортирует** `express`, `@vercel/node`, `vite`;
- все относительные импорты — с явным расширением `.js`;
- только именованные экспорты, без `export default`;
- ядро транспортно-нейтрально: возвращает `AnalyzeResult`, не HTTP.

### Оркестратор анализа `core/analyze.js` (этап 3.6.4)

- **Сигнатура:** `analyze(request: AnalyzeRequest): Promise<AnalyzeResult>` (именованный экспорт `analyze`; реэкспорт из `core/index.js`).
- **Последовательность:** `validateAnalyzeRequest` (валидация-гейт, `core/validate.js`) -> `getJointPrediction` (AI Gateway, `core/ai/gateway.js`; внутри — Safe Mode, GPT + Gemini, consensus/confidence/CALL-PUT-SKIP) -> `AnalyzeResult`.
- **Модули:** `core/validate.js`, `core/ai/gateway.js`, `core/errors.js`. Safe Mode используется **косвенно** через Gateway (без дублирования AI/Safe Mode/торговой логики).
- **Ошибки:** некорректный вход -> `ValidationError` (ИИ не вызывается); непредвиденная ошибка Gateway -> безопасная `AnalysisError`. Публичная сериализация — `toPublicJSON` (`{code,message}` без stack/секретов). Сигнал `CALL`/`PUT` при ошибке **не создаётся**.
- **Контрактный разрыв:** `AnalyzeRequest` не содержит `candles`/`currentPrice`, нужные Gateway (Safe Mode + промпты), поэтому валидируется вход, а в Gateway передаётся **исходный** объект (см. §11.3).
- **Проверки:** mock-тесты 14/14 PASS + эквивалентность `analyze` ↔ `getJointPrediction` 6/6 (результат, payload, число `Math.random`), `npm.cmd run typecheck` и `npm.cmd run build` — успешно.
- **Интеграция (3.6.5-A):** локальный Express (`server/index.js`) вызывает `await analyze(req.body)`; HTTP-контракты (`GET /api/health`, `POST /api/analyze`, ветка `send_result`, успешный ответ `{ success:true, result }`, `500` + SKIP-fallback) сохранены. Vercel (`api/analyze.ts`) **не интегрирован** — отдельный этап.

Текущее состояние (этап 3.6.5-A): **реализованы `contracts.d.ts`, `index.d.ts`,
runtime-модули `index.js` / `config.js` / `errors.js` / `validate.js`, торговая
логика `trading/safeMode.js`, AI Gateway `ai/*`, оркестратор анализа `analyze.js`
и `core/observability/audit.js`.** Локальный Express использует оркестратор
(`AI Gateway` — косвенно). Аудит вызывают Express и адаптеры ядра. Остальное
(`market/*`, `trading/result.js`, `notify/*`) — план.

---

## 6. Разделение AI Gateway и Market Data Engine

Это два **разных** источника, и их нельзя смешивать.

| | AI Gateway (`core/ai/`) | Market Data Engine (`core/market/`) |
|---|---|---|
| Что делает | спрашивает модели (GPT, Gemini) и сводит вердикты | отдаёт **фактические** свечи/цены |
| Источник | внешние AI API | независимый источник котировок |
| Зависит от ИИ? | да | **нет** |
| Модели | `gpt-4o` + `gemini-1.5-pro` (локально) | — |
| Реализация | **[ЧАСТИЧНО]** `core/ai/*` (gateway + адаптеры, этап 3.6.3) | **[ПЛАН]** — только типы (`MarketCandle`, `MarketDataSnapshot`, `MarketDataProvider`) |
| Синтетика | запрещена | запрещена |

AI Gateway реализован как модули ядра (`core/ai/gateway.js`, `openai.js`,
`gemini.js`, `parse.js`); с 3.6.5-A локальные запросы идут через оркестратор
`core/analyze.js` (Express), а shim `ai-consensus.js` остаётся без импортёров.
Вторая, **расходящаяся** AI-реализация остаётся inline в
`api/analyze.ts` (`gpt-4o-mini`/`gemini-1.5-flash`) — вне этого этапа. Фактического
источника котировок в проекте **нет вообще**.

---

## 7. Текущий контракт frontend ↔ backend

Контракт зафиксирован в `core/contracts.d.ts` и **не может меняться без
отдельного согласования**. Источник истины — фактический обмен с `src/App.tsx`.

### 7.1. `POST /api/analyze` — сканирование

Запрос (`AnalyzeRequest`):

```jsonc
{
  "pairs": ["EUR/USD", "GBP/USD"],       // displaySymbol
  "timeframe": "1",                      // "1"|"5"|"15"|"60"|"240"
  "higherTimeframes": ["15", "60"],      // "5"|"15"|"30"|"60"|"240"|"D"
  "mode": "BALANCED",                    // SAFE|BALANCED|AGGRESSIVE|BREAKOUT|ANTITILT|TRENDSURF
  "safeModeEnabled": true,
  "secondsRemaining": 12,
  "candleOpenTime": "13:45",             // "HH:MM"
  "activeStrategies": ["..."],
  "strategy": "...",
  "filters": { "newsFilterEnabled": true, "atrFilterEnabled": true, "riskCapEnabled": true }
}
```

Ответ (`AnalyzeResponse`):

```jsonc
{
  "success": true,
  "result": {
    "signal": "CALL",              // CALL | PUT | SKIP
    "confidence": 96,              // 0..100
    "tradeId": 12345,
    "reasoning": "...",
    "recommendedExpiration": "1M",
    "bestPair": "EUR/USD",
    "candleOpenTime": "13:45",
    "detailedReport": {
      "mode": "...", "status": "...", "levelDetails": "...",
      "aiVerdictGPT": "...", "aiVerdictGemini": "...", "riskLevel": "...",
      "requestPayloadJson": "...", "responsePayloadJson": "..."
    }
  }
}
```

### 7.2. `POST /api/analyze` — `action: "send_result"`

Запрос (`SendResultRequest`):

```jsonc
{
  "action": "send_result",
  "pair": "EUR/USD",
  "direction": "CALL",        // CALL | PUT
  "candleOpenTime": "13:45",
  "tradeId": 12345,
  "openPrice": 1.08520,
  "closePrice": 1.08600
}
```

### 7.3. `GET /api/health` (только локальный Express)

```jsonc
{ "status": "ok", "service": "oracle-pro-terminal-api", "backend": "available" }
```

> **Текущее расхождение (техдолг):** локальный Express и Vercel по-разному
> обрабатывают этот контракт. Vercel-ветка (`api/analyze.ts`) использует
> `gpt-4o-mini`/`gemini-1.5-flash`, синтетические данные и при сбое ИИ выдаёт
> `CALL`; локальная (Express -> `core/analyze.js` -> `core/ai/*`) — `gpt-4o`/`gemini-1.5-pro`,
> Safe Mode и `SKIP` при сбое. Унификация — отдельные подэтапы.

---

## 8. Существующие точки входа

| Точка входа | Назначение | Кто запускает |
|---|---|---|
| `index.html` → `src/main.tsx` → `src/App.tsx` | Frontend | `vite` / `vite build` |
| `server/index.js` | Локальный Express API (`/api/health`, `/api/analyze`) | `npm run dev:api`, `npm start`, `scripts/dev.mjs` |
| `scripts/dev.mjs` | Одновременный запуск API + Vite | `npm run dev` |
| `api/analyze.ts` | Vercel Serverless `/api/analyze` | Vercel (file-routing) |
| `api/brain.ts` | Vercel Serverless `/api/brain` — **сирота** | никто |

---

## 9. Команды запуска и проверки

Запускать через `npm.cmd` (PowerShell блокирует `npm.ps1`).

| Команда | Что делает |
|---|---|
| `npm.cmd install` | установка зависимостей |
| `npm.cmd run dev` | API + Vite одновременно (`scripts/dev.mjs`) |
| `npm.cmd run dev:client` | только Vite (порт 5173, прокси `/api` -> API) |
| `npm.cmd run dev:api` | только Express (`server/index.js`) |
| `npm.cmd start` | Express (`server/index.js`) |
| `npm.cmd run build` | production-сборка frontend (`dist/`) |
| `npm.cmd run preview` | предпросмотр сборки |
| `npm.cmd run typecheck` | `tsc --noEmit` |

---

## 10. Завершённые этапы разработки

| Этап | Содержание |
|---|---|
| 1 | Секреты вынесены в переменные окружения (ключи больше не в коде) |
| 2 | Инициализация git, базовый коммит `5f31d90` |
| 3 | Диагностика проекта |
| 3.1 | `package.json` (deps/engines/scripts), `tsconfig.json`, `vite.config.ts`, `.nvmrc` |
| 3.2 | Перевод серверных файлов CommonJS -> ESM |
| 3.3 | `scripts/dev.mjs`, `GET /api/health`, прокси Vite, порт из `PORT` |
| 3.4.1 | Аудит локального и Vercel API (расхождения, риски) |
| 3.4.2 | Архитектура единого ядра + организация проекта (7 зон) |
| 3.4.3 | `PROJECT_CONTEXT.md`, `core/contracts.d.ts`, `core/index.d.ts` |
| 3.4.4 | Перенос `server.js` -> `server/index.js`; обновлены точки запуска (`package.json`, `scripts/dev.mjs`) |
| 3.4.5 | Синхронизация документации и комментариев после переноса сервера |
| 3.4.6 | Аудит `ai-debugger.js` и план переноса в ядро (только аудит, файлы не менялись) |
| **3.4.7** | **Перенос `ai-debugger.js` -> `core/observability/audit.js`; корневой `ai-debugger.js` оставлен временным ESM shim** |
| **3.6.1** | **Базовые runtime-модули ядра: `core/config.js`, `core/errors.js`, `core/validate.js`, фасад `core/index.js` (+ обновлён `core/index.d.ts`); изолированы, не подключены к backend** |
| **3.6.2** | **Перенос торговой/Safe Mode логики `safe-strategy.js` -> `core/trading/safeMode.js` (поведение 1:1); legacy-файл оставлен тонким compatibility shim; экспорты подключены к `core/index.js` / `core/index.d.ts`** |
| **3.6.3** | **Перенос AI-интеграции `ai-consensus.js` -> `core/ai/*` (`gateway.js` + адаптеры `openai.js`/`gemini.js` + общий `parse.js`), поведение 1:1; `ai-consensus.js` оставлен тонким compatibility shim; экспорты подключены к `core/index.js` / `core/index.d.ts`** |
| **3.6.4** | **Оркестратор анализа `core/analyze.js` (`analyze`: validate -> AI Gateway -> результат, ошибки через `core/errors.js`); делегирует существующие модули, не дублирует AI/Safe Mode; подключён к `core/index.js` / `core/index.d.ts`; к backend не подключён** |
| **3.6.5-A** | **Интеграция локального Express с ядром: `server/index.js` вызывает `analyze` из `core/index.js` вместо `getJointPrediction` (shim `ai-consensus.js` больше не импортируется); HTTP-контракты, `send_result`, health и обработка ошибок сохранены; Vercel-адаптер не тронут** |

**[НЕ реализовано]:** унификация API, остальное ядро (`market/*`,
`trading/result.js`, `notify/*`), Market Data Engine, модуль Telegram, тесты.

---

## 11. Известные проблемы и технический долг

### 11.1. Безопасность

- **[ТЕХДОЛГ]** Ранее засветившиеся ключи (OpenAI/Gemini/Telegram) **требуют
  ротации** — отдельная незакрытая задача.
- `npm audit`: 10 уязвимостей в dev/build-инструментах (1 critical `tar`,
  6 high, 3 moderate). В клиентский бандл секреты не попадают.

### 11.2. Поведение и данные

- **[ТЕХДОЛГ]** `api/analyze.ts` (Vercel): синтетические RSI/тренды/свечи,
  `Math.random()` для выбора пары и `tradeId`, при сбое ИИ — `CALL`
  (нарушает правило «ошибка ИИ -> SKIP»).
- **[ТЕХДОЛГ]** `src/App.tsx`: при сетевой ошибке фабрикуется `CALL` 93%;
  результат сделки симулируется через `Math.random()` (WIN/LOSS), а не по ценам.
- **[ТЕХДОЛГ]** `core/ai/gateway.js` (перенесён из `ai-consensus.js` на 3.6.3) и
  `server/index.js` используют `Math.random()` для `tradeId`/выбора пары; Safe Mode
  (`core/trading/safeMode.js`, перенесён из `safe-strategy.js` на 3.6.2) подставляет
  цены по умолчанию (`1.08500`) при отсутствии свечей.
- Локальный API с настройками frontend по умолчанию всегда возвращает `SKIP`
  (Safe Mode включён, а frontend не передаёт `candles`).

### 11.3. Структура и инфраструктура

- **[ТЕХДОЛГ]** Дублирование логики: оркестрация, вызовы GPT/Gemini, Telegram,
  расчёт результата, env-проверка — в двух местах (local vs Vercel).
- **[ЧАСТИЧНО на 3.6.5-A]** Централизованная валидация входа (`core/validate.js` +
  `core/errors.js`) **подключена к локальному Express** через `core/analyze.js`.
  `api/analyze.ts` (Vercel) продолжает валидировать по-своему — отдельный этап.
- **[ТЕХДОЛГ — поведение, 3.6.5-A]** Валидация в Express работает как строгий гейт:
  некорректный/неполный `AnalyzeRequest` теперь даёт HTTP `500` + SKIP-fallback
  (раньше legacy-путь обрабатывал такой вход «как есть» и мог вернуть `200`).
  Это осознанное следствие интеграции; реальный payload frontend (`src/App.tsx`)
  валиден и проходит проверку. Смягчение/маппинг ошибок — отдельная задача.
- **[ЧАСТИЧНО на 3.6.4 / ИНТЕГРИРОВАНО на 3.6.5-A]** Оркестратор анализа
  `core/analyze.js` (`analyze`) централизует последовательность
  `validate -> AI Gateway -> результат`; с 3.6.5-A его вызывает локальный Express.
  Vercel-адаптер пока не использует оркестратор.
- **[ТЕХДОЛГ — контрактный разрыв, 3.6.4]** `AnalyzeRequest` не содержит
  `candles`/`currentPrice`, которые AI Gateway использует для Safe Mode и
  сериализует в промпты. Поэтому `core/analyze.js` валидирует вход как **гейт**, а в
  Gateway передаёт **исходный** объект (иначе поведение Safe Mode/промптов
  изменилось бы). Приведение контракта и типа входа Gateway — отдельная задача.
- **[ТЕХДОЛГ]** Нет таймаутов у локальных запросов к моделям.
- **[ТЕХДОЛГ]** `PORT` из `.env` не виден `vite.config.ts` (виден только
  `server/index.js`); решение — загрузка `.env` в `scripts/dev.mjs` + `loadEnv` в
  `vite.config.ts` (без новых зависимостей) — отдельный подэтап.
- **[ТЕХДОЛГ]** Сироты: `api/brain.ts`, `SignalWidget.jsx`
  (обращается к несуществующему `/api/get-signal`). Не удалены.
- **[РЕШЕНО на 3.6.0]** Корневой `ai-debugger.js` (временный shim обратной
  совместимости) **удалён**; `server/index.js` импортирует аудит напрямую из
  `core/observability/audit.js`. После 3.6.3 аудит вызывают адаптеры ядра
  (`core/ai/openai.js`, `core/ai/gemini.js`).
- **[ВРЕМЕННО на 3.6.2]** Корневой `safe-strategy.js` оставлен как **тонкий
  compatibility shim** (re-export из `core/trading/safeMode.js`); реализация — только
  в ядре. На этапе 3.6.3 AI-логика переехала в `core/ai/*` и импортирует Safe Mode
  напрямую из ядра, поэтому **у `safe-strategy.js` больше нет импортёров** (файл
  сохранён как shim). Удаление shim — отдельный подэтап.
- **[ВРЕМЕННО на 3.6.3 / БЕЗ ИМПОРТЁРОВ с 3.6.5-A]** Корневой `ai-consensus.js`
  оставлен как **тонкий compatibility shim** (re-export `getJointPrediction` из
  `core/ai/gateway.js`); реализация — только в ядре (`core/ai/*`). После перевода
  `server/index.js` на `analyze` из `core/index.js` **импортёров у shim нет**.
  Удаление shim — отдельный подэтап.
- `README.md` — заглушка; `index.html` ссылается на отсутствующий `/vite.svg`.
- **[ОГРАНИЧЕНИЕ]** Реализация ядра на `.js` **не проверяется типами**
  (`allowJs: false`): `.d.ts` гарантирует корректность использования типов, но не
  соответствие им реализации. Митигация — тесты.

---

## 12. Правила безопасного изменения проекта

1. **Не перемещать, не переименовывать и не удалять файлы** без отдельного
   задания и подтверждения.
2. Перед любым перемещением — проверять **все** импортёры и точки входа.
3. **Не менять** торговую математику, поведение сигналов и frontend-контракт
   без отдельного согласования.
4. Секреты — только на сервере, только через `process.env`; в репозитории
   хранится лишь `.env.example`.
5. **Не добавлять зависимости** без согласования.
6. Каждый подэтап завершается `npm.cmd run typecheck` + `npm.cmd run build`
   и отчётом. Коммиты — только по отдельному запросу.
7. Архитектурные правила (обязательные к соблюдению в будущей реализации):
   - ошибка AI **никогда** не превращается в `CALL`/`PUT` — только `SKIP`;
   - нет достоверных рыночных данных -> `SKIP`;
   - расхождение моделей -> `SKIP`;
   - синтетические RSI/свечи/тренды запрещены;
   - случайная симуляция WIN/LOSS запрещена;
   - результат сделки — по фактическим ценам (`openPrice`/`closePrice`);
   - frontend обращается только к Oracle Backend;
   - GPT и Gemini — независимые адаптеры; отказ одного не ломает систему;
   - источник котировок не зависит от ИИ.

---

## 13. Подэтапы (кратко)

**Завершено:**

- 3.4.4 — перенос `server.js` -> `server/index.js` (см. §10);
- 3.4.5 — синхронизация документации после переноса сервера;
- 3.4.6 — аудит `ai-debugger.js` (только аудит);
- 3.4.7 — перенос `ai-debugger.js` -> `core/observability/audit.js` (+ shim);
- 3.6.0 — удаление временного shim `ai-debugger.js`; `server/index.js` и
  `ai-consensus.js` переведены на прямой импорт аудита из ядра;
- 3.6.1 — базовые runtime-модули ядра: `core/config.js`, `core/errors.js`,
  `core/validate.js`, фасад `core/index.js` (+ обновлён `core/index.d.ts`);
  изолированы, к backend не подключены;
- 3.6.2 — перенос торговой/Safe Mode логики `safe-strategy.js` ->
  `core/trading/safeMode.js` (поведение 1:1); legacy-файл — тонкий shim;
  экспорты подключены к фасаду ядра;
- 3.6.3 — перенос AI-интеграции `ai-consensus.js` -> `core/ai/*` (`gateway.js` +
  адаптеры `openai.js`/`gemini.js` + общий `parse.js`), поведение 1:1; legacy-файл —
  тонкий shim; экспорты подключены к фасаду ядра;
- 3.6.4 — оркестратор анализа `core/analyze.js` (`analyze`: validate -> AI Gateway ->
  результат, ошибки через `core/errors.js`); делегирует существующие модули; экспорт
  подключён к фасаду ядра; к backend не подключён;
- 3.6.5-A — интеграция локального Express с ядром: `server/index.js` вызывает
  `analyze` из `core/index.js` (тонкий адаптер), HTTP-контракты/`send_result`/health/
  обработка ошибок сохранены; `ai-consensus.js` остался без импортёров; Vercel не
  интегрирован.

**Запланировано [НЕ НАЧАТЫ]** (нумерация и содержание уточняются отдельными
заданиями):

- `core/trading/result.js` — расчёт результата по фактическим ценам (Safe Mode/уровни уже перенесены на 3.6.2);
- удаление shim `safe-strategy.js` и `ai-consensus.js` (у обоих больше нет импортёров);
- приведение контракта `AnalyzeRequest` к реальному входу Gateway (`candles`/`currentPrice`, контрактный разрыв 3.6.4);
- тонкий адаптер `api/analyze.ts` (Vercel) — подключение к `core/analyze.js` и унификация с Express (отдельный этап 3.6.5-B+);
- PORT/env: `scripts/dev.mjs` + `vite.config.ts` (`loadEnv`);
- `core/notify/telegram.js`;
- тесты (контракт, parity Express↔Vercel, отсутствие `Math.random()` в ядре);
- аудит legacy/сирот.

---

## 14. 3.6.8-B — HTTP EntryPoints Safety / Increment A (2026-11-18)

**Статус: Increment A выполнен и проверен; остальные инкременты 3.6.8-B не проверены,
весь этап не закрыт.**

Цель: закрыть небезопасный Express HTTP-путь к торговому AI без доверенных рыночных
данных. MDE и обязательный Eligibility Gate ещё не реализованы и в этот инкремент
не входят. До их появления HTTP-анализ намеренно заблокирован.

Изменения текущего инкремента ограничены тремя файлами:

- `server/index.js`: удалены импорт/вызов `analyze` и неиспользуемая обёртка
  `withDefaultSkipReason`. Обычная POST-ветка возвращает HTTP 200, `success:true`,
  `result.signal:SKIP`, `confidence:0`, `tradeId:0`,
  `skipReason.code:MARKET_DATA_UNAVAILABLE`, `category:MARKET_DATA`.
  Метаданные ответа согласованы с существующим Vercel `api/analyze.ts`;
  свечи, цены, Safe Mode и клиентские флаги доверенности не разрешают анализ.
  Существующие `/api/health`, отказ `send_result` и безопасные обработчики ошибок сохранены.
- `scripts/test-p1-safety.mjs`: сохранены три прежние проверки; добавлены реальные
  loopback HTTP-запросы к Express и сравнение с прямыми вызовами Vercel-обработчика.
- `PROJECT_CONTEXT.md`: добавлена эта актуализация без удаления исторического среза.

Ранее внесённые изменения OpenCode сохранены: Vercel уже блокировал анализ;
Express/Vercel отказывались фиксировать недоверенные результаты; Frontend заменял
ошибки на SKIP и не симулировал исход при экспирации. Их полный аудит/доработка,
Brain API и рефакторинг Core не входят в текущую реализацию.

### Фактически выполненные проверки

Среда проверки: установленный Node.js v26.13.0 (целевая версия проекта — Node 24).
Зависимости не устанавливались.

- **PASS** `node scripts/test-p1-safety.mjs`: пять сценариев анализа для Express
  и Vercel — полный валидный payload с Safe Mode off/on; поддельные свечи/цена и
  verified/eligible; пустой payload; неизвестный action. Во всех случаях SKIP с
  ожидаемым кодом/категорией, нулевой уверенностью и tradeId; семантика и метаданные
  ответов совпадают (автоматическое время сравнивается по типу, чтобы исключить гонку часов).
- **PASS** валидный и невалидный `send_result` отклоняются обоими entrypoints без
  результата, WIN/LOSS или pips; сохранено различие кодов ошибки валидации.
- **PASS** настоящий HTTP `GET /api/health` возвращает прежний контракт.
- **PASS** три исходные проверки валидатора/Vercel сохранены и выполнены.
- **PASS** изоляция: dotenv.config подменён до импорта сервера (файл .env не читается);
  fetch, HTTP(S)-клиенты, TLS и внешние TCP-соединения заблокированы в тестовом процессе.
  Разрешён только локальный тестовый клиент к ephemeral-порту на 127.0.0.1.
  Guard-проверки выполнены; при рабочих сценариях — **0 попыток внешних запросов**.
  Импорты торговых `core/index.js`, `core/analyze.js`, `core/ai/*` запрещены hook-ом;
  при выполнении — **0 попыток импорта**. Telegram и реальные AI API не вызывались.
  Сервер закрывается, подмены восстанавливаются после проверки. Стартовый лог сервера
  печатает стандартный PORT, но тест принудительно слушает случайный loopback-порт.
- **PASS** `node --check server/index.js` и `node --check scripts/test-p1-safety.mjs`.
- **PASS** `node node_modules/typescript/bin/tsc --noEmit`.
- **PASS** `git diff --check` для отслеживаемых изменений (эти три файла пока untracked).

### Ограничения проверки и оставшиеся риски

- **SKIPPED** production build: создаёт dist, что выходит за разрешённые три файла.
- **Не проверено:** выполнение на целевом Node 24, настоящий Vercel HTTP runtime,
  deployment и остальные инкременты 3.6.8-B. Vercel проверялся вызовом handler с mock response.
- Прямые вызовы Core по-прежнему не защищены обязательным Eligibility Gate;
  прежние торговые алгоритмы Core не менялись. MDE отсутствует.
- Типы Core не описывают skipReason; эта существующая несогласованность не исправлялась
  в рамках трёх разрешённых файлов. Typecheck не проверяет runtime JS ядра.
- HTTP-анализ временно не выдаёт торговые сигналы. Подключение доверенных данных и
  последующее снятие блокировки требуют отдельного задания и проверок.
- Коммиты, push, деплой и переход к следующему инкременту не выполнялись.

## 15. MDE Phase 1 — Biquote EURUSD M1 (2026-11-18)

**Статус: минимальная диагностическая интеграция реализована; mock и live проверки PASS.**
Торговые алгоритмы, Core orchestrator, AI Gateway, Vercel и Frontend не менялись.
Блокировка `/api/analyze` из Increment A сохраняется. Eligibility Gate отсутствует,
прямые торговые вызовы Core по-прежнему не получают обязательной защиты.

### Файлы и контракт

- `core/market/biquote.js`, `biquote.d.ts`: серверный provider без зависимостей,
  совместимый с `MarketDataProvider` из `core/contracts.d.ts`; `latest()` получает
  фиксированное окно, `getSnapshot/getCandles` возвращают пересечение диапазона
  UTC seconds с доступным валидированным окном (это не архив). Только `EUR/USD`,
  timeframe `1`. Пустое пересечение и неподдерживаемый рынок явно отклоняются.
- `server/marketData.js`: отдельный диагностический маршрут;
  `server/index.js`: только импорт и регистрация маршрута. Торговая ветка не менялась.
- `scripts/test-mde-biquote.mjs`: изолированные mock-тесты и явно выбранный `--live` режим.
- `PROJECT_CONTEXT.md`: этот отчёт.

Источник: https://biquote.io/api/EURUSD/ohlc?interval=1m&limit=100 . Схема проверена
по https://biquote.io/docs/ и реальному HTTP 200: envelope `symbol/interval/bars`,
`openTime` UTC, OHLC, volume/tickVolume, isOpen. Реальный ответ содержал **101** бар
(100 закрытых + открытый), поэтому число 100 не используется как жёсткий размер массива.

Существующие MDE-типы и фасад `core/index.js` сохранены. Специализированный тип
`BiquoteSnapshot` расширяет снимок полями source/quality; свеча добавляет isOpen
и необязательный tickVolume. `time` — Unix seconds UTC, порядок по возрастанию.
Источник обозначен Biquote, priceBasis=mid; конкретный брокер в OHLC не установлен.
`quality.status=VALID` означает только прохождение локальных структурных и временных
проверок, **не** допуск к торговле: `tradingEligible=false`.

### Правила отказа

- Только конечные положительные числовые OHLC, корректные границы high/low.
- Явный UTC ISO timestamp с Z, реальная дата и точное начало минуты; будущие бары запрещены.
- Принимается монотонный вход в обоих направлениях, нормализуется в ascending;
  смешанный порядок, дубликаты и любые разрывы M1 отклоняются, не исправляются.
  Выходные/остановка рынка не исключаются из этой строгой политики: возможен отказ.
- isOpen обязателен и должен совпадать с текущей UTC-минутой сервера;
  старые открытые и текущие закрытые бары отклоняются. Допускается окно без открытого
  бара, если последняя закрытая свеча ещё актуальна.
- Возраст начала последней свечи — не более 120 секунд, минимум два бара.
  Возраст тика этим endpoint не доказывается; при неверных часах сервера возможен отказ.
- volume/tickVolume, если переданы, — неотрицательные safe integers.
- Фиксированный upstream URL, redirects запрещены, timeout 5 секунд, тело не более
  256 KiB. Нет ключей, retries, синтетических баров, интерполяции или резервного источника.
- Ошибки источника/JSON/качества дают HTTP 503, `success:false`, source,
  `quality.status:REJECTED`, безопасный error.code/message, без snapshot и свечей.
  Внутренние ошибки источника клиенту не раскрываются.

### Локальный просмотр

В PowerShell (не изменяет .env):

```powershell
$env:ORACLE_MDE_TEST = '1'
npm.cmd run dev:api
```

Открыть `http://127.0.0.1:3000/api/test/market-data/eurusd/m1` (или фактический PORT).
Только GET, параметры query не поддерживаются. Требуются opt-in и loopback socket;
forwarded headers не учитываются. В NODE_ENV=production маршрут отвечает 404,
как и при выключенном флаге или удалённом клиенте. Cache-Control: no-store.
Это защита диагностического доступа, не полноценная система аутентификации.

### Фактические проверки

- **PASS** `node scripts/test-mde-biquote.mjs`: 35 групп проверок нормализации,
  UTC/OHLC/isOpen, порядка/дубликатов/пропусков/актуальности, диапазона/рынка,
  HTTP ошибки upstream, некорректного JSON, размера ответа и timeout.
  Настоящий Express HTTP проверен с mock Biquote: валидный ответ, 503 при пустом,
  устаревшем/недоступном источнике; query/opt-in/production ограничения,
  отказ удалённому socket даже с поддельным forwarded header, изоляция `/api/analyze`.
  В mock-режиме внешние HTTP(S)/TCP/TLS заблокированы, fetch возвращает только mock;
  .env не читается; 0 попыток торговых импортов и запрещённой сети.
- **PASS** `node scripts/test-mde-biquote.mjs --live` с разрешённой сетью:
  реальный Biquote -> provider -> настоящий локальный Express endpoint -> HTTP 200,
  101 валидированная свеча, source=Biquote, quality=VALID, tradingEligible=false.
  На первой live-проверке: checkedAt `2026-11-18T19:58:56.613Z`,
  последний бар `2026-11-18T19:58:00Z`, ageSeconds=56, isOpen=true.
  Начальная попытка внутри sandbox дала безопасный HTTP 503 SOURCE_UNAVAILABLE;
  после разрешения сети live-проверка прошла. Live-режим не является mock-изоляцией:
  допускается только фиксированный публичный fetch Biquote, без AI/Telegram.
- **PASS** повторная регрессия `node scripts/test-p1-safety.mjs`: HTTP entrypoints
  остаются fail-closed, 0 торговых импортов и внешних запросов.
- **PASS** TypeScript `--noEmit` и синтаксические проверки новых JS-модулей/теста.
  JS ядра не охватывается текущим tsconfig; runtime-валидация проверена mock-тестами.
- Node фактически v26.13.0; Node 24 не проверялся. Production build/deploy не выполнялись.
  Зависимости, секреты, .env, торговые контракты не менялись. Commit/push не выполнялись.

Следующая работа требует отдельного задания: оценка источника/качества для торгового
использования и обязательный Eligibility Gate. Диагностические данные автоматически
не снимают блокировку HTTP-анализа и не передаются моделям.

## 16. MDE Phase 2 — EURUSD M1 test chart (2026-11-18)

**Статус: отдельная диагностическая панель реализована; проверки пройдены.**

Изменения:

- `src/App.tsx`: независимая раскрываемая панель под основным графиком, без изменения
  выбранной пары, таймфрейма, TradingView single/quad или торгового состояния.
- `src/components/BiquoteTestChart.tsx`: SVG OHLC-свечи, источник Biquote, качество,
  последняя свеча/цены UTC; открытая свеча отмечена янтарным контуром. Нет новых зависимостей.
- `src/components/mdeChartData.ts`: валидация диагностического ответа и управляемый
  polling только `/api/test/market-data/eurusd/m1`. Нет прямого запроса к Biquote из браузера.
- `src/vite-env.d.ts`: стандартные Vite-типы для dev-only режима.
- `vite.config.ts`: middleware запрещает удалённым socket доступ к `/api/test/*`
  через dev-прокси, включая варианты регистра и завершающего слеша. Это необходимо,
  поскольку Express за прокси видит loopback самого Vite, а не исходного клиента.
- `scripts/test-mde-chart.mjs`: in-memory TypeScript transpile и mock-проверки без сети.
- `PROJECT_CONTEXT.md`: этот отчёт.

### Включение

```powershell
$env:ORACLE_MDE_TEST = '1'
npm.cmd run dev
```

Открыть `http://localhost:5173` и нажать «Тестовый график Biquote · EURUSD M1» под
основным графиком. Панель доступна только при Vite DEV и hostname localhost/loopback;
production/preview режим её не включает. Backend opt-in/production/loopback проверки
Phase 1 сохранены. Query-параметры, другие пары/таймфреймы не добавлялись.

### Обновление и отказы

Первый запрос при раскрытии; следующий через 15 секунд после завершения предыдущего.
Таймаут 8 секунд, cache=no-store, credentials=omit. Параллельных polling-запросов нет.
При ошибке сети/HTTP/JSON/контракта свечи очищаются, отображается ошибка, автоматические
повторы прекращаются до ручного запуска. При паузе/скрытии панели/размонтировании
запрос отменяется и таймер удаляется; скрытая вкладка приостанавливает polling,
возврат возобновляет его, если сессия не была остановлена.
Данные старше 120 секунд скрываются даже при остановке браузерных таймеров/запросов
после возобновления исполнения. Время и isOpen проверяются относительно checkedAt
сервера; свежесть отображаемого окна дополнительно проверяется по часам браузера.
Поддельные OHLC, неверный порядок/дубликаты/пропуски, пустые данные и неверный источник
не отображаются. Нет генератора цен, интерполяции отсутствующих свечей и fallback котировок.

### Проверки и ограничения

- **PASS** `node scripts/test-mde-chart.mjs`: dev/local gating, OHLC/UTC/order/isOpen/
  quality/stale проверки, последовательное обновление, остановка и очистка после 503,
  невалидный JSON/404, отмена in-flight запроса, отсутствие callback после cleanup,
  таймаут, отмена запланированного обновления, dev-прокси remote guard без влияния
  на обычные маршруты. Все ответы mock, реальные сеть/AI не используются.
- **PASS** повторные `node scripts/test-mde-biquote.mjs` (35 групп) и
  `node scripts/test-p1-safety.mjs`: provider/HTTP regression, fail-closed анализ,
  ноль попыток торговых импортов и запрещённых внешних запросов.
- **PASS** `node node_modules/typescript/bin/tsc --noEmit`.
- **PASS** production Vite build в отдельный каталог артефактов вне проекта;
  существующий dist не перезаписывался. Sandbox блокировал esbuild/config чтение,
  запуск dev и сборка выполнены после разрешения.
- **PASS** ручная browser-проверка реального endpoint: показаны 101 свеча Biquote,
  quality VALID, последняя свеча `2026-11-18 20:05:00 UTC`, одна открытая свеча.
  DOM подтвердил хронологический порядок. Скриншот сохранён в каталоге артефактов
  `mde-phase2-chart.jpg`. Пауза очистила свечи; сворачивание удалило панель,
  src существующего iframe TradingView остался тем же (основной график не перемонтирован).
- Источник и торговые механизмы Core/Express/Vercel/Brain не менялись; новых AI-вызовов нет.
  CALL/PUT не включались, данные не передаются в Gateway. VALID — только качество
  диагностического окна, не торговая пригодность. Eligibility Gate отсутствует.
- Визуальная проверка — desktop; мобильный layout и Node 24 отдельно не проверены.
  Простой SVG не имеет zoom/pan/индикаторов. Свежесть тика неизвестна; часы браузера
  могут привести к безопасному отказу. На закрытом рынке/разрывах Phase 1 вернёт ошибку.
- Dev-процессы остановлены после проверки. Установка зависимостей, commit, push,
  deploy и автоматический переход к следующим фазам не выполнялись.

Следующий рекомендуемый шаг: отдельная приёмка диагностического режима пользователем
на штатном Node 24; дальнейшее подключение данных к торговле требует нового задания
и обязательного Eligibility Gate.

## 17. MDE Phase 3B — Increment 1: contracts and pure evaluators (2026-11-19)

**Статус: первый инкремент реализован и проверен. Phase 3B целиком не завершена.**
Базовое состояние — checkpoint `72e9f9f76ae3c508899840f91b14df3c916a54ab`, ветка
`backup/mde-phase2-checkpoint`. В рамках инкремента ветка/HEAD не менялись,
staging, commit, push, merge и rebase не выполнялись.

### Созданные файлы

- `core/market/contracts.d.ts`: отдельные совместимые типы MarketObservation,
  ObservationCandle, QualityReport, QualityCheck, EligibilityDecision,
  AnalysisRequirements, SkipReason и AnalysisPurpose:
  DISPLAY / CLOSED_BAR_RESEARCH / LIVE_SIGNAL_ANALYSIS / EXECUTION.
- `core/market/quality.js`, `quality.d.ts`: чистая `assessQuality(observation,
  requirements, nowMs)`; явное время, новые отчёты, входные объекты не мутируются.
- `core/market/eligibility.js`, `eligibility.d.ts`: чистая
  `evaluateEligibility(observation, requirements, nowMs)`, которая повторно оценивает
  фактический выбранный диапазон и не принимает supplied quality/eligible как доказательство.
- `scripts/test-mde-quality.mjs`: 58 детерминированных mock-тестов.
- `scripts/test-mde-quality-types.ts`: compile-only проверки публичных контрактов.
- Из существующих файлов изменён только этот PROJECT_CONTEXT.md.

Существующие `core/contracts.d.ts`, `core/index.*`, `biquote.js`/`biquote.d.ts`,
HTTP entrypoints, Safe Mode, AI, frontend и его polling не менялись.
Новые функции не экспортируются через существующий фасад и не подключены к приложению.

### Семантика оценки

MarketObservation содержит собственный snapshotId, EUR/USD M1-свечи с isOpen,
source, session и timing. Время свечи/диапазона — Unix seconds UTC;
все timestamps timing и аргумент nowMs — epoch milliseconds; acquisitionDurationMs
— независимо измеренная длительность получения по монотонным часам. Поля timing
могут быть null, но неизвестность не превращается в успешную проверку.

AnalysisRequirements задаёт явные пороги возраста выбранного последнего бара,
наблюдения, события источника и длительности получения; inclusive диапазон from/to,
minCandles и allowOpenBar. Поддержана только EUR/USD M1. Скрытых порогов, чтения env
и обращения к Date.now нет. Проверки принимают границу порога, превышение на 1 ms
отклоняют. Обе известные длительности — монотонная и completed-started по wall clock —
не должны превышать заданный предел. Неизвестная монотонная длительность не выводится
из HTTP timestamps. Ошибочный порядок acquisition timestamps отклоняется.

Quality проверяет идентичность окна, известный source (Biquote, фиксированный URL,
mid), сессию, timestamps, будущие данные, OHLC, optional volume/tickVolume,
isOpen относительно минуты получения observationCompletedAtMs, ascending order,
дубликаты, пропуски и полное покрытие выбранного M1-диапазона, lookback и свежесть.
Вход не сортируется, свечи не удаляются/не создаются, пробелы в истории не заполняются.
Проверки OHLC/времени/порядка действуют на переданное окно; coverage/lookback/
свежесть выбранного бара пересчитываются по указанному диапазону, без наследования
quality от более свежей части исходного массива. Отсутствующие timestamps остаются
null/UNKNOWN; HTTP receipt, checkedAt и начало свечи не заменяют время тика.

Агрегация отчёта: любой FAIL -> FAIL; иначе любой UNKNOWN -> UNKNOWN;
только все PASS -> PASS. Reasons и metrics показывают причины и раздельные
candleAgeMs / observationAgeMs / quoteAgeMs / acquisitionDurationMs.
Неизвестный источник/метаданные и отсутствие свечей дают неизвестность либо отказ;
неизвестный purpose, неподдерживаемый рынок/диапазон и пустые свечи отклоняются.

Eligibility имеет фиксированную policyVersion `mde-phase3b-increment1`:

- PASS quality и отсутствие дополнительных запретов допускают только информационное
  ALLOWED для DISPLAY или CLOSED_BAR_RESEARCH.
- UNKNOWN и FAIL всегда дают DENIED. CLOSED_BAR_RESEARCH требует allowOpenBar=false
  и выбранное окно без открытых свечей.
- LIVE_SIGNAL_ANALYSIS и EXECUTION всегда DENIED в этом инкременте, даже при полной
  успешной оценке Biquote и любых клиентских verified/eligible/allowLive.
- `grantsRuntimeAccess:false` во всех случаях; внутреннего контекста/токена нет.

**Консервативное ограничение:** все текущие проверки обязательны для новых evaluators,
включая известные quote timestamp и session=OPEN даже для DISPLAY/research.
Поэтому текущий диагностический BiquoteSnapshot нельзя автоматически считать ALLOWED:
нужных observation metadata в нём нет. Это не меняет работающий график: он по-прежнему
использует прежний диагностический quality.status=VALID и tradingEligible=false.
Purpose-specific смягчение требований к историческому research требует отдельного задания.

**Граница доверия:** совпадение source-полей — проверка заявленной идентичности,
не криптографическое/серверное доказательство происхождения. Эти функции не могут
отличить вручную подделанный полный объект от серверного. ALLOWED не является
допуском к Core, AI или исполнению. Server-owned service/registry, Runtime Guard,
неподделываемый контекст, его TTL и интеграция во все пути — последующие инкременты.
Прямые legacy-вызовы Core остаются с прежними рисками; обязательный Gate ещё не установлен.

### Выполненные проверки

- **PASS** `node scripts/test-mde-quality.mjs`: 58 детерминированных тестов, включая
  неправильные/пустые/разреженные данные, NaN/Infinity/строки/нуль в OHLC,
  timestamp units, неизвестные/будущие timestamps, порядок/дубликаты/пропуски,
  границы coverage/lookback, отдельные возраста, пределы и +1 ms, медленное получение,
  границу минуты, поддельные флаги, полный отказ live/execution, frozen inputs и
  одинаковый результат повторного вызова. Restricted VM без Date/fetch/process/
  console/setTimeout подтверждает отсутствие ambient clock/network/env зависимостей.
  Все вымышленные свечи находятся только в тестовых fixtures, не в runtime.
- **PASS** `node scripts/test-p1-safety.mjs`: оба HTTP entrypoints остаются SKIP,
  send_result отклоняется, health сохранён; 0 торговых импортов/внешних запросов.
- **PASS** `node scripts/test-mde-biquote.mjs`: существующие 35 групп mock-проверок.
- **PASS** `node scripts/test-mde-chart.mjs`: существующие проверки графика/polling.
- **PASS** `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- **PASS** `node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022
  --module ESNext --moduleResolution bundler --types node scripts/test-mde-quality-types.ts`:
  публичные декларации, обязательное nowMs, readonly candles, nullable quote timestamp,
  отсутствие context и grantsRuntimeAccess=false.
- **PASS** production build через Vite API с текущим конфигом, configFile=false и
  build.write=false; конфиг транспилирован в памяти, dist и другие outputs не записывались.

Проверки выполнены на установленном Node v26.13.0, не на Node 24. Реальная сеть,
Biquote live, AI API, Telegram и сделки не использовались. Текущий tsconfig не
проверяет JS-реализацию ядра: новые декларации проверены отдельно, runtime — тестами.
Зависимости и конфигурация не менялись. В следующем инкременте требуется отдельно
согласовать серверное происхождение данных и Runtime Guard, не разблокируя HTTP/AI автоматически.

## 18. MDE Phase 3B — Increment 2: Source Registry and Market Service (2026-11-19)

**Статус: второй изолированный инкремент реализован и проверен. Полный обязательный
Eligibility Gate и Phase 3B целиком ещё не завершены.**

### Файлы и границы

Созданы `core/market/sourceRegistry.js`, `sourceRegistry.d.ts`, `service.js`,
`service.d.ts`, `scripts/test-mde-service.mjs`, `scripts/test-mde-service-types.ts`.
Из существующих файлов изменён только PROJECT_CONTEXT.md. Работа Increment 1 сохранена
без изменения Quality/Eligibility/contracts и тестов. Biquote provider/декларации,
Express, Vercel, frontend, тестовый график/polling, Safe Mode и торговые модули не менялись.
Сервис не реэкспортируется из core/index.js и никуда не подключён.

### Registry

Фиксированный immutable серверный allowlist версии `mde-phase3b-increment2`:

- sourceId `biquote`, provider Biquote, фиксированный REST URL Phase 1, priceBasis=mid;
- инструмент `EUR/USD`, timeframe `1`, единственное назначение `DISPLAY`;
- CLOSED_BAR_RESEARCH, LIVE_SIGNAL_ANALYSIS, EXECUTION и неизвестные назначения запрещены.

`resolveSource` принимает ровно четыре собственных строковых data-поля
`sourceId/pair/timeframe/purpose`. Лишние source/quality/eligible/verified/timestamp/
timing/session/candles/requirements/provider/fetchImpl/url отвергаются, не используются
для изменения source, политики или provider. Кастомный prototype, symbol-поля и
accessor-поля также отклоняются. Политика и вложенные массивы заморожены; функций
регистрации источника из запроса нет. Отказ происходит до получения данных.

### Market Service

`createMarketService().observe(request)` самостоятельно создаёт существующий
createBiquoteProvider для одобренного запроса и вызывает latest(). URL определяется
registry, дополнительно сверяется перед fetch; клиент не задаёт URL, provider, пороги,
источник или рыночные доказательства. Import/создание сервиса не обращаются к сети.

Новый MarketObservation формируется из копии только нормализованных OHLC/time/isOpen/
volume/tickVolume. Source берётся из server registry, snapshotId создаётся сервером;
observation и все вложенные объекты/массивы, отчёты и результат заморожены.
Supplied provider/client quality/eligible/session/timestamp не переносятся в доказательства.

Временная семантика:

- requestStartedAtMs: серверное начало получения;
- provenance.responseHeadersReceivedAtMs: момент получения HTTP-заголовков fetch,
  responseTimeMeaning=HEADERS_ONLY, не момент последнего тика или завершения тела;
- observationCompletedAtMs: завершение получения и нормализации provider;
- acquisitionDurationMs: Math.ceil разности монотонных performance.now, включает получение
  и нормализацию, не является односторонней задержкой рыночного события;
- quality.evaluatedAtMs: отдельное серверное время оценки после формирования observation;
- providerQuoteUpdatedAtMs=null, session=UNKNOWN: текущий OHLC-контракт не подтверждает
  время последнего тика и торговую сессию; HTTP receipt/checkedAt/close не подставляются.

Некорректные или идущие назад acquisition/evaluation clocks дают SERVICE_CLOCK_INVALID.
После запроса используется захваченный registry scope, а не изменяемый request;
конкурентные получения имеют отдельные timestamps, id и данные.

Серверные диагностические requirements: DISPLAY EUR/USD M1, весь полученный диапазон,
minCandles=2, allowOpenBar=true, maxCandleAgeMs=120000, maxObservationAgeMs=5000,
maxQuoteAgeMs=5000, maxAcquisitionDurationMs=5000. Эти пороги не торговая политика
и не принимаются из client request.

Вызывается неизменённый evaluateEligibility, который сам выполняет assessQuality.
При текущем Biquote даже корректные свежие свечи дают quality UNKNOWN и eligibility
DENIED из-за неизвестных quote timestamp/session. Диагностический свежий observation
может присутствовать в результате DENIED для разбора причин; это не допуск к анализу.
grantsRuntimeAccess=false, diagnosticOnly=true; context/token/capability отсутствуют.
Тип результата резервирует ASSESSED для информационного ALLOWED; текущая реализация
Biquote необходимых доказательств не имеет и такой результат не выдаёт.

При ошибке provider/сети/JSON/неполных данных status=DENIED, observation/provenance/
quality/eligibility=null, безопасный reason. Нет кэша последнего успешного окна,
старого fallback, повторов, искусственных цен или свечей. Raw ошибки не раскрываются.

### Проверки

- **PASS** `node scripts/test-mde-service.mjs`: 42 детерминированных mock-теста:
  immutable allowlist; неизвестный source/инструмент/timeframe; запрет research/live/
  execution; поддельные клиентские поля; invalid prototypes/accessors/symbols;
  server provenance и отдельные часы; null tick/UNKNOWN session -> DENIED;
  fake upstream trust-поля не становятся доказательствами; ошибки сети/HTTP/JSON,
  пустые/неполные/старые данные; отсутствие fallback после предшествующего observation;
  некорректные/обратные часы, медленное получение, invalid id, конкурентные запросы
  и изменение client request во время ожидания. Используется настоящий существующий
  provider с mock fetch; внешние HTTP(S)/TCP/TLS/fetch и торговые импорты запрещены;
  **0 попыток внешней сети/торговых импортов**.
- **PASS** `node scripts/test-mde-quality.mjs`: все 58 тестов Increment 1.
- **PASS** `node scripts/test-p1-safety.mjs`: Express/Vercel анализ остаётся SKIP,
  send_result отклоняется; 0 торговых импортов/внешних запросов.
- **PASS** `node scripts/test-mde-biquote.mjs`: все 35 групп mock-регрессии Phase 1.
- **PASS** `node scripts/test-mde-chart.mjs`: существующие polling/chart проверки.
- **PASS** основной TypeScript --noEmit --incremental false и отдельный strict typecheck
  обоих compile-only файлов Increment 1/2 (ES2022, ESNext, bundler, node).
- **PASS** production build в памяти через Vite API с build.write=false и configFile=false;
  текущий конфиг транспилирован в памяти, dist и прочие outputs не записывались.

### Ограничения

Привилегированные constructor dependencies fetchImpl/wallNow/monotonicNow/idFactory
предназначены только для серверного wiring и offline тестов; принимать их из HTTP
нельзя. Обычный observation/provenance — сериализуемый отчёт серверного пути, не
неподделываемое доказательство для других модулей. Runtime Guard, закрытый контекст,
его сроки действия и защита прямых legacy-вызовов Core не реализуются этим инкрементом.
HTTP fail-closed блокировка не снималась; текущий диагностический маршрут по-прежнему
обращается к своему provider, график не получает новую консервативную оценку DENIED.

Тесты выполнялись на Node v26.13.0, Node 24 и live Biquote в этом инкременте не проверялись.
Декларации проверены TypeScript, JS runtime — mock-тестами; текущий tsconfig не проверяет
JS ядра. Зависимости, env, конфигурация и торговые модули не менялись. Реальных AI,
Telegram-запросов и торговых операций не было. Git-ветка и HEAD сохранены, staging,
commit, push, merge/rebase не выполнялись. Дальнейшая интеграция требует отдельного разрешения.

## 19. MDE Phase 3B — Increment 3: mandatory deny-only Runtime Guard (2026-11-19)

**Статус: блокировка реализована; финальные Guard-тесты, Increment 1–2,
HTTP/Biquote, стабилизированная chart-регрессия, typecheck и build PASS.
История тайминговой нестабильности и её test-only исправления сохранена ниже.**
Положительный live-анализ, CALL/PUT и торговое исполнение не включались.

### Изменения и порядок проверки

- Новые `core/runtimeGuard.js` и `runtimeGuard.d.ts`: process-local WeakSet идентичностей;
  createUnprivilegedContext создаёт только пустой замороженный объект с null-prototype.
  Guard не читает свойства контекста и всегда возвращает immutable отказ
  allowed=false / RUNTIME_GUARD_DENIED, включая собственные зарегистрированные контексты.
  Публичного положительного issuer, env-переключателя или тестового bypass нет.
- `core/analyze.js`: Guard — первая операция, до валидации payload; отказ возвращает
  фиксированный SKIP/confidence=0/tradeId=0 и skipReason категории ELIGIBILITY.
- `core/ai/gateway.js`: собственная проверка до Math.random, Safe Mode, выбора пары,
  моделей и логирования. Отказ — тот же SKIP. Прямой вызов не зависит от analyze().
- `core/ai/openai.js`, `gemini.js`: собственная проверка первой операцией до промпта,
  JSON.stringify, доступа к env/API-ключам, axios.post, аудита и обработки ответа.
  Отказ — null, без логирования payload/контекста или секретов.
- `core/index.d.ts`: optional opaque RuntimeContext вторым аргументом четырёх функций;
  существующие вызовы с одним аргументом сохраняются, неверные параметры безопасно
  отклоняются Guard до legacy validation. Контекст не извлекается из marketData/request.
- Новые `scripts/test-runtime-guard.mjs`, `test-runtime-guard-types.ts`.
- Этот PROJECT_CONTEXT.md: актуализация статуса и ограничений.

Сами `core/index.js` и `ai-consensus.js` не менялись: их re-export ссылается на те же
защищённые функции. Тесты проверили идентичность bindings и вызовы обоих путей.
Прямой импорт каждого файла также защищён. Старое тело анализа/AI сохранено за
проверкой, но недостижимо при текущем deny-only Guard; контекст передаётся отдельно
вниз по цепочке, а не подмешивается в рыночный payload.

### Контекст и границы гарантии

JSON/копия/поддельный объект, context внутри HTTP-полей, source/quality/eligible/
eligibility/runtimeContext, публичный ALLOWED EligibilityDecision не дают доступа.
Даже подлинный context не имеет live-привилегий. Сериализация теряет WeakSet identity,
однако результат отказа одинаков для любого контекста. Проверка ничего не получает
из Market Service или диагностических свечей; Biquote не подключён к AI.

Это намеренный запрет, а не готовая система положительных grants: выдача полномочий,
TTL, отзыв, привязка положительного допуска к snapshot/policy требуют отдельного
проектирования и разрешения. TypeScript-brand дополняет, но не заменяет runtime отказ.
Гарантия относится к поддерживаемым функциям анализа и торговым AI-адаптерам;
произвольный серверный код с возможностью менять модули/loader или делать собственные
сетевые запросы не изолируется этим JavaScript Guard.

### Фактические проверки

- **PASS** `node scripts/test-runtime-guard.mjs`: 6408 entrypoint-вызовов, включая
  288 параллельных. Девять путей: direct analyze/Gateway, facade analyze/Gateway,
  legacy Gateway, оба direct AI-адаптера, оба AI-адаптера через facade.
  Матрица включает отсутствующие/неверные параметры, Safe Mode off/on,
  поддельные клиентские флаги, genuine/JSON-copy/structuredClone/proxy/revoked-proxy
  контексты, настоящий публичный ALLOWED DISPLAY decision. Все дают SKIP либо null.
- **PASS** Guard вызывается ровно один раз на каждый отрицательный entrypoint-вызов,
  до validation/Safe Mode/payload inspection/сериализации/случайных ID/моделей.
  Test-only loader stubs считают вызовы validation/Safe Mode/audit/parse; настоящий
  исходник Guard инструментирован в памяти только счётчиком. Файлы не подменялись.
  axios.post и внешние HTTP(S)/TCP/TLS/fetch заблокированы; API-key reads перехвачены
  до оригинального process.env. Проверены режимы absent и mock-present без чтения
  реальных значений ключей. Все счётчики побочных эффектов равны 0, CALL/PUT отсутствуют.
- **PASS** `node scripts/test-mde-quality.mjs` — 58 тестов Increment 1.
- **PASS** `node scripts/test-mde-service.mjs` — 42 теста Increment 2.
- **PASS** `node scripts/test-p1-safety.mjs` — Express/Vercel остаются SKIP;
  send_result отклоняется, health сохранён, 0 trading imports/external requests.
- **PASS** `node scripts/test-mde-biquote.mjs` — 35 групп mock-регрессии.
- **PASS** основной `tsc --noEmit --incremental false`; отдельный strict typecheck
  test-mde-quality-types.ts, test-mde-service-types.ts, test-runtime-guard-types.ts
  с ES2022/ESNext/bundler/node. Проверены opaque context и невозможность allowed=true
  в публичном контракте. JS ядра не проверяется текущим tsconfig, runtime покрыт тестами.
- **PASS** production Vite build в памяти (configFile=false, build.write=false),
  без записи dist/outputs и без изменения конфигурации.
- **CHART REGRESSION: FLAKY** обычный `node scripts/test-mde-chart.mjs` дал два FAIL
  и один PASS на существующей строке 53: errors=0 вместо 1 в окне 80 ms. Один сбой
  был при параллельной сборке, другой при отдельном запуске. Ни chartData, ни график,
  ни этот тест не менялись и Guard ими не импортируется.
  Дополнительный запуск неизменённого теста после инициализации Node Response
  (`Response.json({}); await import('./scripts/test-mde-chart.mjs')` в отдельном Node
  процессе) прошёл PASS по всем проверкам. Замеренная cold initialization Response
  заняла 47 ms; это согласуется с чувствительностью 80 ms-теста к времени, но не
  заменяет устранение нестабильности. Исходный тест не исправлялся и таймауты не менялись.

### Сохранённые компоненты и ограничения

Не изменены biquote.js/декларации, Market Service/Registry, Quality/Eligibility policies,
Safe Mode, Express/Vercel, frontend, TradingView, тестовый Biquote-график и polling,
существующие тесты, зависимости и production-конфигурация. Реальной сети, AI/Telegram
и сделок не было. Проверки — на Node v26.13.0; Node 24 отдельно не проверен.
Ветка backup/mde-phase2-checkpoint и HEAD fdfe1febf933a2258311359ac35c73d14c9d0d1f
сохранены, staging/commit/push/merge/reset/rebase не выполнялись. Следующее действие
требует отдельного задания; live-допуск автоматически не включается.

### Test-only stabilization после диагностики (2026-11-19)

Этот раздел обновляет исторический статус CHART REGRESSION: FLAKY выше.
Изменён только `scripts/test-mde-chart.mjs`: sleep(80) заменён ожиданием onError,
watchdog 2000 ms ограничивает зависание и очищается; stop() вызывается в finally.
Сохранены calls=2, errors=1, shown=null, maxActive=1 и проверка отсутствия повторов
в течение 30 ms до stop(). Это конечное окно реальных таймеров, а не доказательство
отсутствия произвольно поздних повторов или устойчивости к starvation event loop.
Фиксированные testNow/minute/checkedAt и временная подмена Date.now в тестовом
процессе исключают гонку перехода минуты; реальные polling timers не заменены.

- PASS: 20 последовательных свежих Node-процессов без прогрева Response,
  по 6 проверок; 840–1128 ms на процесс.
- PASS: ещё 9 запусков с задержкой первого Response 100/200/400 ms (по 3).
  Инструментирование только в памяти; файл теста для этих сценариев не менялся.
- PASS: намеренно пропущенное событие завершилось watchdog-ошибкой; намеренно
  неверный assertion завершился assertion-ошибкой. В обоих случаях stop() выполнен
  и Date.now восстановлен (диагностические подмены только в памяти).
- PASS: Runtime Guard (6408 вызовов, 288 параллельных), Quality/Eligibility (58),
  Market Service/Registry (42), HTTP Safety и Biquote mock (35).
  HTTP-анализ остаётся SKIP; внешних сетевых/AI/Telegram/торговых вызовов не было.
- PASS: основной и отдельный strict typecheck тестовых контрактов; production Vite
  build в памяти (configFile=false, build.write=false), без записи dist.
- PASS: git diff --check. Production-код и существующие изменения Increment 3
  сохранены; текущая правка касается только теста и этого раздела документации.

Ограничения: прочие короткие sleep в тесте сохраняются; 20 PASS не гарантируют
стабильность при любой нагрузке. Проверки выполнены на Node v26.13.0, Node 24
отдельно не проверен. Commit/push и изменение ветки/HEAD не выполнялись.

### Финальная проверка перед локальным checkpoint (2026-11-19)

Повторный аудит подтвердил deny-only Guard для direct/facade/legacy вызовов;
положительного issuer нет. Analyze/Gateway дают SKIP, GPT/Gemini — null до эффектов.
В chart-тесте запуск polling перенесён внутрь try/finally: watchdog очищается
также при синхронном исключении запуска. Полученный stop вызывается через stop?.();
если запуск бросил до возврата handle, вызывать ещё нечего. Date.now/fetch восстанавливаются
внешним finally. Production polling и другой production-код при этой проверке не менялись.

- PASS: 10 последовательных chart-запусков с --unhandled-rejections=strict,
  по 6 проверок, 810–973 ms; предварительного прогрева Response нет.
- PASS: 6 in-memory сценариев — обычный, sync throw запуска, throw после получения
  handle, watchdog rejection, assertion failure, rejected fetch. После завершения
  и 50 ms ожидания: 0 отслеживаемых таймеров, 0 unhandled rejection; часы/fetch
  восстановлены, каждый полученный stop вызван. Подмены не записывались в файлы.
- PASS: повторены Runtime Guard (6408/288), Quality/Eligibility (58), Service/Registry
  (42), HTTP Safety, Biquote mock (35), основной и strict typecheck деклараций,
  production build в памяти (write=false). Внешние AI/сеть/сделки не использовались.

Предыдущие записи о неизменном HEAD и отсутствии commit описывают прошлые проверки.
Текущее разрешение — только локальный checkpoint Increment 3; push не разрешён.

## 20. MDE Phase 3B — Increment 4B: runtime authorization contracts and state machine (2026-11-19)

**Статус: фундамент lifecycle реализован изолированно. Положительного runtime-допуска,
issuer, adapter permits, server-owned authority/store или интеграции с AI нет.**
ISSUED/ACTIVE ниже — состояния описательной модели, не выданные полномочия.

### Файлы и контракты

- `core/runtime/contracts.d.ts`: RuntimeAuthorizationState, AnalysisSession,
  RootCapabilityScope, AdapterPermitScope, AuthorizationPolicyVersion,
  AuthorizationDenialReason, AuthorizationDeadline, RuntimeStage и вспомогательные типы.
  Scope связывает snapshotId/sourceId/pair/timeframe/purpose, requirements/policy
  fingerprints и strategyVersion. Deadline содержит явные epoch/monotonic issued/expiry
  и maxClockDriftMs; session — policy/revocation generations, revision и lastClock.
  AdapterPermitScope — только контракт с attempt=1 и согласованными adapter/stage.
- `core/runtime/stateMachine.js` и `.d.ts`: createSessionModel, evaluateSessionModel,
  planSessionTransition, applySessionTransition. Нет imports, IO, системных часов,
  таймеров, mutable глобального store или положительного issuer.
- `scripts/test-runtime-authorization.mjs` и `test-runtime-authorization-types.ts`:
  offline lifecycle/adversarial/concurrency и compile-only проверки.
- Этот PROJECT_CONTEXT.md. Существующие production-файлы не менялись.

### Семантика и пределы гарантии

Путь: ISSUED -> CONSUMED (ROOT) -> ACTIVE (ANALYSIS) -> FINALIZED (FINALIZATION).
Из каждого нетерминального состояния явная оценка срока может привести к EXPIRED,
а отзыв или несовпадение версии/fingerprint/generation политики — к REVOKED.
FINALIZED, EXPIRED и REVOKED необратимы. Неверные команды/UNKNOWN отклоняются.
Absolute/monotonic expiry срабатывают при now >= deadline. Откат часов, превышение
явного maxClockDriftMs, отсутствующие/неверные часы дают отказ. TTL не выбирается:
все сроки заданы явно; числовые mock-параметры находятся только в тестах.

Модели/планы имеют приватные class fields, null prototype и замороженные собственные
данные. JSON, spread, structuredClone, proxy или похожий объект не восстанавливают
их идентичность. JSON spec может создать новую описательную модель, но не вернуть
идентичность старой модели или дать право на AI. Все результаты modelOnly=true /
grantsRuntimeAccess=false; LIVE_SIGNAL_ANALYSIS и EXECUTION даже для моделей отклоняются.
Fingerprints здесь только связываются и сравниваются; их происхождение/вычисление,
рыночные доказательства и права источника модуль не подтверждает.

Переход двухшаговый: план связан с точным исходным экземпляром и revision; применение
сравнивает его с переданным current и заново проверяет часы/политику. Отложенный план
не переносит свежесть. Будущий владелец обязан атомарно заменить единственный current,
включая возвращённый EXPIRED/REVOKED при ok=false. Проверка 100 конкурирующих планов
при таком владельце даёт 1 переход и 99 REPLAY.
Чистая функция не инвалидирует исторические snapshots глобально: передача старого
current повторно позволяет повторное вычисление. Это явно проверенное ограничение,
а не реализация глобальной одноразовости, блокировок или distributed CAS.

### Проверки

На Node v24.22.3 (bundled runtime) и v26.13.0 (основной node):

- PASS новые lifecycle mock-тесты: 75, включая границы времени, независимые сроки,
  отзыв/изменение политики, immutable inputs, JSON/proxy/accessors, replay, concurrency
  и restricted VM без Date/process/performance/fetch/timers/WeakMap/WeakSet.
- PASS Runtime Guard: 6408 entrypoint-вызовов, включая 288 параллельных; 0 торговых
  эффектов/API-key reads/сетевых попыток. Отдельно новые модели/планы отклонены Guard.
- PASS Quality/Eligibility: 58; Market Service/Registry: 42; Biquote mock: 35;
  HTTP Safety: Express/Vercel SKIP, send_result отказ, health доступен; chart: 6 групп.
- PASS основной typecheck и strict compile-only проверки всех четырёх наборов типов.
- PASS production Vite build в памяти: configFile=false, build.write=false.
- PASS git diff --check и whitespace-check новых файлов; запрещённых изменений нет.

В HTTP/Biquote mock suites использовались только изолированные loopback-сокеты;
внешних запросов, реального Biquote, AI, Telegram или сделок не было.
Runtime Guard, Core/AI, Market Service/Registry, Quality/Eligibility, Biquote, Express,
Vercel, Safe Mode, frontend, график/polling, зависимости/env/config не изменены.
Ветка backup/mde-phase2-checkpoint и HEAD e9b30ba50fc9ebd72f1eb29839ae2e0e9b9f98d7
сохранены. Staging/commit/push не выполнялись. Следующая интеграция требует разрешения.

## 21. MDE Phase 3B — Increment 4C: trusted market provenance registration (2026-11-19)

**Статус: внутренняя регистрация происхождения реализована. Runtime issuer/grant,
live-анализ, EXECUTION и интеграция с торговым AI не создавались.**

### Файлы и граница доверия

- `core/market/service.js`: приватный WeakMap observation -> owning service/report.
  Только закрытый callback фиксированного экземпляра регистрирует заново полученный,
  нормализованный и глубоко замороженный observation после формирования результата.
  Публичных register/authority factory или параметров подключения callback нет.
- Существующий createMarketService(dependencies) сохраняет форму результата и DI,
  но никогда не регистрирует observations, даже без DI или при совпадении функций
  зависимостей. buildMarketService и callback не экспортируются.
- getTrustedMarketService() без аргументов возвращает один frozen экземпляр в модуле.
  Fetch/часы/ID захвачены при доверенной загрузке модуля. Поздняя подмена global fetch
  не меняет канал. Если fetch отсутствовал на старте, позднего fallback на mock нет.
  Запросов при импорте/конструировании не выполняется.
- inspectObservationProvenance(service, observation) проверяет точные identity обоих
  объектов, не читая поля кандидатов. SnapshotId/source/provider/SERVER_PROVIDER,
  quality/eligibility, JSON и скопированные reports не являются credentials.
  Отчёт immutable, diagnosticOnly=true, grantsRuntimeAccess=false.
- Чтение/запись WeakMap привязаны при bootstrap; поздние prototype overrides не дают
  перехватить реестр. Exception из request proxy теперь безопасно обрабатывается
  существующим catch сервиса; сырые ошибки наружу не возвращаются.
- `core/market/service.d.ts`: совместимый MarketService, branded TrustedMarketService,
  диагностический union ObservationProvenanceReport; публичного runtime context нет.
- Новые `scripts/test-market-provenance.mjs`, `test-market-provenance-types.ts`.
- Этот PROJECT_CONTEXT.md. Код/тесты 4B и текст §20 сохранены без изменений.

### Семантика и ограничения

Origin подтверждает историческое серверное получение именно этого immutable объекта,
а не истинность рыночной котировки, свежесть или право анализа. Даже диагностический
DENIED observation может иметь подтверждённое происхождение: tick timestamp остаётся
null, session UNKNOWN, Eligibility DENIED. Biquote разрешён только для DISPLAY.
Ошибочная acquisition возвращает observation=null без старых данных или регистрации
ошибочного результата. Ранее удерживаемый observation сохраняет исторический origin;
повторная инспекция идемпотентна и не является consume или продлением свежести.
Копия envelope с той же ссылкой observation сохраняет origin только самого observation;
сериализация/копия observation теряет identity. Идентичные snapshotId не объединяются.

Корень доверия — незакомпрометированный серверный bootstrap, модули и исходный канал.
Произвольный код/loader, контролирующий процесс до загрузки, этим механизмом не
изолируется. Проверка не является криптографической аттестацией provider или сети.
WeakMap локален процессу/экземпляру модуля; worker/restart/другой authority не наследует
регистрации. Registry защищён от HTTP/DI-подделок, но не от переписывания серверного кода.
К Runtime Guard и lifecycle 4B этот реестр не подключён; положительный допуск отсутствует.

### Фактические проверки

На Node v24.22.3 и v26.13.0:

- PASS provenance: 20 offline adversarial тестов, включая DTO/JSON, поддельный origin,
  DI/mock fetch, late global replacement, отсутствие bootstrap fetch, proxy, immutable
  данные, ошибки provider, repeat inspection и 24 параллельных observation с одинаковым ID.
- Положительные origin-сценарии выполнены только в in-memory копиях service.js с
  изолированным mock-каналом через test loader. Production-модуль эти observations
  отклоняет. В production-коде нет test flags/backdoor или публичной mock-регистрации.
- PASS Increment 4B: 75; Runtime Guard: 6408 вызовов (288 параллельных);
  Quality/Eligibility: 58; Market Service/Registry: 42; Biquote mock: 35;
  HTTP Safety: PASS (SKIP/отказ send_result/health); chart: 6 групп.
- PASS основной typecheck и strict declarations всех пяти тестовых наборов.
- PASS production Vite build в памяти на обеих версиях: configFile=false/write=false.
- PASS git diff --check, whitespace/secret-pattern checks и проверка границ изменений.

Внешних запросов/реального Biquote/AI/Telegram/сделок не было. HTTP mock suites
использовали только изолированный loopback. Express/Vercel, frontend/polling, Biquote,
Source Registry, Quality/Eligibility, Guard, Core/AI и Safe Mode не изменены.
HEAD e9b30ba50fc9ebd72f1eb29839ae2e0e9b9f98d7, ветка backup/mde-phase2-checkpoint
и staging сохранены; commit/push/reset/merge/rebase не выполнялись.
