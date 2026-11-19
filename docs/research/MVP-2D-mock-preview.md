# MVP-2D — Private Alpha offline MOCK preview

This is artificial UI data, not Binance market history or a signal system.
Permanent label: **MOCK / НЕ РЕАЛЬНЫЕ КОТИРОВКИ** (sticky banner and SVG watermark).
MVP-2C: **BLOCKED_PENDING_JURISDICTION_AND_PERMISSION**.
ALPHA-0 LIVE: **NOT_READY**. ALPHA-1: **NOT_READY**.

## Open locally without Binance

From the project root, using existing installed dependencies:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort
```

Open **http://127.0.0.1:5174/?privateAlpha=mock** directly.
Port 5174 was used because 5173 was already occupied; no existing process was stopped.
If 5174 is occupied, use another explicitly chosen free loopback port and the same
`?privateAlpha=mock` query. Do not launch server/privateAlpha.js or enable its opt-in.
Do not use `?privateAlpha=1`: that is the distinct LIVE panel.
Production builds and non-loopback hosts do not expose this DEV preview route.
No dependencies, .env settings or backend server are required for MOCK.

## Manual verification

1. On opening, see 4 artificial candles, fixed UTC times and the conspicuous MOCK
   labels. There is no automatic animation, HTTP polling or live-source acquisition.
2. Expand MOCK OHLCV: inspect times, O/H/L/C and fractional volume. The artificial
   opening price starts at 100, not a purported real BTC price.
3. Click “Запустить MOCK-показ”: see 4 → 8 → 12 candles, one frame per second.
   The sequence ends automatically after exactly three frames.
4. Start again and click “Остановить MOCK”: candles hide and no later timer frame
   may restore them. Restart always begins at the same first frame.
5. Click “Смоделировать ошибку”: see MOCK_ERROR, zero candles and the same MOCK
   banner. No fallback to live data or live panel occurs.
6. Click “Сбросить MOCK”: the error disappears and the original four candles return.
   Navigating away/unmounting clears the preview timer.

Only this offline UI fixture updates; fixed candle timestamps are not wall-clock
freshness, HTTP receipt times or market-event timestamps.

## Isolation

`binanceMockPreview.ts` imports only a presentation type. It has no network, market,
Eligibility, analysis or AI imports. Its schema uses instrument=BTCUSDT_MOCK,
kind=MOCK_PREVIEW, source=OFFLINE_UI_FIXTURE, quality=MOCK_NOT_MARKET_DATA,
readiness=NOT_READY, grantsRuntimeAccess=false. All frames and candles are frozen.
It is deliberately not a BinanceObservation/MarketObservation. Public copies or
JSON do not obtain trusted identity. There is no conversion into provider DTOs.
`BinanceObservation` mounts either the MOCK or LIVE child; LIVE polling effects
are not mounted in MOCK mode. There is no automatic mode fallback.
The common ObservationCandles component only renders SVG and a table.
Live Binance provider, local endpoint, Guard, existing Market Service/Registry,
Quality/Eligibility, AI, Safe Mode and production routes remain unchanged.

## Verification performed

Node v26.13.0: 10 new MOCK groups PASS with all transport functions blocked; zero
live endpoint requests, external network attempts or grants. Tests cover fixed data,
deep freeze, OHLCV/UTC, frame bounds, finite scheduling, cancellation, captured stale
callback, restart, and rejection by live validator, provenance, owner, Market Service,
Eligibility, Core/Gateway and direct AI adapters (including JSON clone).
Regressions PASS: MVP-2B 30, replay 38, intake 49, archive 67, pilot 55,
Runtime Guard 6408, existing chart 6, HTTP Safety and TypeScript.
HTTP Safety uses isolated loopback, not external services.
In the local in-app browser, visually checked the banner, SVG, completed 12-candle
sequence, expanded OHLCV table, error clearing, stop and reset. Browser network
resource telemetry was unavailable; zero-acquisition guarantees were checked through
module separation and transport-blocked tests, not a browser network trace.
The temporary Vite verification process was stopped after checking; the pre-existing
5173 process was not modified. Node 24 and actual live data were not tested.
