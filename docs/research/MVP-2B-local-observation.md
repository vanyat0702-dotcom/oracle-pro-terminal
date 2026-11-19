# MVP-2B — local BTCUSDT M1 observation

Status: **NOT_READY**. MOCK-verified ALPHA-0 foundation only, not live-source validation,
trading eligibility, a license grant or a permission to execute trades.

## Boundary and format

`BinanceObservation` → fixed local URL on 127.0.0.1:3001 → standalone
`server/privateAlpha.js` → `core/market/binance.js` → fixed Binance Spot klines URL.
No production API, Market Service/Registry, Eligibility, runtime owner/Guard or AI imports.
Production Express `/api/analyze` and Vercel stay fail-closed and unchanged.

Official format reference:
<https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klines>.
Configured source:
`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100&timeZone=0`.
This is REST default milliseconds, NOT the archive CSV's post-2025 microseconds.
The array does not echo the symbol; source scope comes from the fixed server URL,
not client data or a DTO claim. No request to Binance was made during implementation.

Response checks: exact destination, no redirect, successful HTTP, JSON content type,
256 KiB declared/decoded body limit, 5s timeout covering headers/body (Abort + race).
Prices and fractional base-asset volume require finite strict decimals; timestamps
require UTC-minute alignment and exact close=open+59999ms. No sorting, deduplication,
interpolation, cache fallback, secret keys or disk dataset writes.

Two to 100 contiguous closed bars are allowed for DISPLAY diagnostics. A forming
current-minute bar is validated then excluded. The latest closed open time normally
must equal server UTC-minute minus 60000ms. One missing latest bar is tolerated only
within the first 5000ms of the new minute, explicitly `PUBLICATION_DELAY`; later it
is STALE_DATA. Other internal gaps/duplicates/order errors fail. These are conservative
diagnostic defaults, not proven Binance publication SLAs or analysis admission rules.

`STRUCTURE_VALID` proves only the checked candle structure and local-clock-relative
freshness. `providerQuoteUpdatedAtMs=null`, quote freshness UNKNOWN, clock evidence
LOCAL_SERVER_ONLY. receivedAtMs means response HEADERS receipt; checkedAtMs follows
body decoding. Acquisition duration uses monotonic clocks. No HTTP timestamp is a tick.
No 4C trusted provenance registration, TrustedAnalysisInput or positive grant is created.

## Local endpoint and panel

Server binds only 127.0.0.1:3001. Both NODE_ENV=development and ORACLE_ALPHA_OBSERVE=1
are required, checked on every request. Exact Host 127.0.0.1:3001 and Origin
http://localhost:5173 or http://127.0.0.1:5173 are mandatory. No forwarded-header trust.
Only the fixed GET path is supported, with narrow local GET/PNA preflight support.
One in-flight request globally; at least 10 seconds between acquisition starts,
including failures. Error bodies contain safe codes only; responses are no-store.
Loopback/Origin filtering is not authentication against other local privileged processes.

The separate React view is selected only in DEV on loopback with `?privateAlpha=1`.
The legacy terminal and its demonstration history/statistics/TradingView do not mount
in that view. Existing terminal behavior outside that view is preserved.
The panel starts STOPPED. Polling is serial, 15 seconds after completion, 8s watchdog,
no credentials or redirects. Errors stop retries. Stop/unmount abort and clear timers;
hidden tabs pause acquisition. An independent 500ms expiry check hides stale data.
It may briefly hide a previous window while awaiting the next regular refresh after
a minute boundary; it never labels that old window current. Recovery clears the error.
SVG candles, full OHLCV table and UTC timestamps use existing React/SVG tools.

## First local launch — no source requests until explicitly started

Use installed project dependencies; do not run an installer. The project declares
Node >=24 <25; this implementation was tested on available Node v26.13.0, not Node 24.
Two PowerShell terminals in the project root:

```powershell
# Terminal 1: binds localhost only; startup itself does not fetch Binance.
$env:NODE_ENV = 'development'
$env:ORACLE_ALPHA_OBSERVE = '1'
node server/privateAlpha.js
```

```powershell
# Terminal 2: fixed allowed UI origin; do not expose with --host 0.0.0.0.
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/?privateAlpha=1** directly. It shows no candles and makes
no observation requests until “Запустить наблюдение” is clicked. Do NOT click during
an offline-only session. Stop with the panel button and Ctrl+C in both terminals.
The opt-in environment variables above are process-local; no .env/config is changed.
The existing production-style API on port 3000 is not needed by this panel.

## Separate authorization required for the first real-source check

Before clicking Start: confirm applicable Binance API/data access terms, jurisdiction
and the specific personal noncommercial purpose. Archived Dataset Terms/evidence
do not automatically settle live API access rights. Keep LICENSE_UNKNOWN until reviewed.
Get explicit approval for a bounded real check (for example one acquisition followed
by Stop); verify actual endpoint/format, UTC clock, publication behavior and network/CORS
availability. Keep raw responses/datasets outside Git. Browser local-network permissions,
actual live latency, source availability and visual browser behavior remain unverified.
No live-source check upgrades NOT_READY or authorizes analysis automatically.

## Verification performed

Node v26.13.0, offline mocks: 30 new groups PASS, including fractions, open bars,
timestamps, ordering/gaps, publication grace, streaming-body timeout, size/HTTP/JSON,
redirect/source restrictions, Host/Origin/opt-in/rate/PNA, serial polling and cleanup.
Fake scheduler used for polling synchronization; no arbitrary sleep assertions.
New tests open no listeners and make zero real network requests.
Regressions PASS: replay 38, intake 49, archive 67, pilot 55, Runtime Guard 6408,
Biquote 35, existing chart 6, HTTP Safety, project TypeScript and strict new declarations.
HTTP/Biquote regressions use isolated loopback only, zero external calls.
Vite production build PASS in memory (write=false, 3 outputs), network blocked.
No runtime permits, market datasets, source downloads, dependency installs or commit/push.
