# MVP-1E / FIX2 — BTCUSDT historical pilot technical evidence

Review date: 2026-11-19. Base commit: `90c5e4b5e36a2b569fa11d9731c03a31ce4fd3ee`.
Technical report only: no candles, dataset export, legal permission or runtime authority.

## Source and files

- Instrument: BTC/USDT (`BTCUSDT`), Binance Spot, M1, LAST price basis.
- Requested UTC range: `[2025-01-07T00:00:00Z, 2025-01-08T00:00:00Z)`.
- Original URL: <https://data.binance.vision/data/spot/daily/klines/BTCUSDT/1m/BTCUSDT-1m-2025-01-07.zip>.
- CHECKSUM URL: <https://data.binance.vision/data/spot/daily/klines/BTCUSDT/1m/BTCUSDT-1m-2025-01-07.zip.CHECKSUM>.
- Actual download date: **UNKNOWN**. Filesystem modification time and browser-origin
  metadata are supporting clues, not independent evidence of acquisition time.
- ZIP and CHECKSUM remain outside Git, in the local Downloads directory. The
  91-byte CHECKSUM text was downloaded under the misleading `.zip.zip` suffix.
- Extracted CSV remains outside Git under `oracle-research-data/mvp-1e/extracted/`.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Original ZIP | 72057 | `29d7d1ed4a23ca9bcb288f21f9e0cd9784d80c3856cb815714d82466f122576c` |
| Extracted CSV | 228725 | `45810eb4db4e09f583d65de725b7ec95d3a19045836498f8a5a04ff3d4d41381` |

ZIP verification: **PASS against the locally supplied CHECKSUM**. FIX2 rechecked
the ZIP SHA-256 and compared its in-memory decompressed CSV byte-for-byte with the
existing extracted CSV. No extraction or dataset output was written during FIX2.
This proves consistency of these local artifacts, not independent authenticity of
the CHECKSUM, download date, or permission to use the data.

## Format, venue and coverage are separate findings

Official [Binance Public Data documentation](https://github.com/binance/binance-public-data#spot)
classifies these archives as Spot, identifies `/api/v3/klines` as their source,
documents 12 CSV columns and microsecond timestamps from 2025-01-01 onward.
The [Spot API kline specification](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#klines)
documents candle fields, open-time identity and the M1 interval.
These documents support the source-type designation `BINANCE_SPOT`; they do not
authenticate an arbitrary local file or prove rights, runtime provenance or trading suitability.

| Technical check | Result |
| --- | --- |
| Parsed candles | 1440 |
| First candle open, UTC | `2025-01-07T00:00:00.000Z` |
| Last candle open, UTC | `2025-01-07T23:59:00.000Z` |
| Missing minutes in the requested UTC grid | 0 |
| Duplicate / descending timestamps | 0 / 0 |
| Invalid OHLC / malformed rows / non-M1 alignment | 0 / 0 / 0 |
| Timestamp unit | MICROSECONDS |
| Close-time boundary | open time + 60,000,000 microseconds - 1 |

The offline MVP-1D diagnostic returned `PREVIEW_ONLY`, `NOT_READY`, no parser errors,
`grantsRuntimeAccess=false`, `output=null`. Its retained conservative metadata
produced `COVERAGE_UNKNOWN`, `VENUE_UNKNOWN`, `LICENSE_UNKNOWN`.
Coverage UNKNOWN is the evaluator's source/calendar-binding result, distinct from
the complete observed UTC grid. Two internal fragments reflect the 1000-row limit,
not a market gap. The diagnostic transport blockers observed zero network attempts.

The earlier diagnostic supplied an explicitly unverified filesystem-time surrogate
for the API's required `provenance.acquiredAt`; it must not be promoted to verified
acquisition evidence. This report records the actual acquisition time as UNKNOWN.
MVP-1D's `sourceFiles.containerVerification=NOT_VERIFIED` describes its CSV-only
pipeline; the separate local ZIP check above does not change that field.

## License evidence and retained restrictions

Official [Binance Vision Dataset Terms](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md):
version **1.0**, updated **2026-08-26**, reviewed online on 2026-11-19.
The link follows the current upstream branch; it is not an immutable local terms receipt.

- Sections 3.1 and 4.1 specify CC BY-NC-SA 4.0 and limited noncommercial uses:
  academic research, unmonetized education, personal nonproduction historical
  backtesting, and noncommercial open-source data-science evaluation.
- Section 3.4 requires a separate written Binance agreement for commercial use;
  sections 4.2–4.4 restrict commercial products, execution and compensated signals.
- Section 4.5 requires attribution and the same license for redistributed derivatives.
- Section 1.4 distinguishes terms applicable at download from later changes.

No applicable download-time terms receipt, completed purpose review or commercial
Oracle permission has been established. **LICENSE_UNKNOWN remains.** Neither the
archive, checksum, README MIT label nor this report grants commercial rights.
No redistribution permission is issued here.

Archive export remains blocked until applicable license/purpose evidence, a local
reviewed venue evidence record, source-bound calendar metadata and adequate
acquisition/provenance records are provided and reviewed. This report is not an
operator-reviewed license grant and must not be passed to the exporter as one.
No archive export is authorized by FIX2. Production eligibility, Guard and trading
paths remain unchanged; preview validation does not issue a runtime grant.

## FIX2 validation actually performed

On Node v26.13.0: research pilot 55 MOCK groups, archive 67, intake 49, project
TypeScript (`--noEmit`) and strict pilot declarations all PASS. Offline real-file
recheck passed all 1440 rows against the exact UTC M1 grid, parser OHLC rules and
microsecond close boundaries; no network attempts or data output.
Ignore checks passed for 7 MOCK data paths and 7 negative paths; none of 106 tracked
files became ignored. No market-file candidates were found in the checkout scan
(excluding `.git` and dependencies). Diff/whitespace and report secret checks PASS.
Only `.gitignore`, this report and `PROJECT_CONTEXT.md` changed. No production
build or unrelated network regression was needed for these documentation/ignore edits.
