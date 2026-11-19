import { listResearchInstruments, getResearchInstrument } from '../core/research/catalog.js';
import { inspectHistoricalBytes, importHistoricalFile } from '../core/research/intake.js';
import type { HistoricalDatasetFile, HistoricalImportOptions, HistoricalManifest, ResearchInstrumentId, HistoricalInputCandle } from '../core/research/contracts.js';
import type { AnalysisRequirements } from '../core/market/contracts.js';
declare const file: HistoricalDatasetFile;
declare const manifest: HistoricalManifest;
declare const candle: HistoricalInputCandle;
declare const options: HistoricalImportOptions;
const btc: ResearchInstrumentId = 'btcusdt';
const missing: 'MISSING' = listResearchInstruments()[0].historyStatus;
const noGrant: false = inspectHistoricalBytes(new Uint8Array(), options).grantsRuntimeAccess;
const notReady: 'NOT_READY' = manifest.readiness;
const purpose: 'CLOSED_BAR_RESEARCH' = manifest.permittedPurpose;
getResearchInstrument(btc); void importHistoricalFile('local-file.json', options);
// @ts-expect-error BTCUSD is not BTC/USDT.
const substitution: ResearchInstrumentId = 'btcusd';
// @ts-expect-error Only M1 intake exists.
const otherTimeframe: HistoricalDatasetFile = { ...file, timeframe: '5' };
// @ts-expect-error No live permission in metadata.
const livePurpose: 'LIVE_SIGNAL_ANALYSIS' = manifest.permittedPurpose;
// @ts-expect-error No positive grant.
const grant: true = manifest.grantsRuntimeAccess;
// @ts-expect-error Immutable returned metadata.
manifest.source.venue = 'changed';
// @ts-expect-error Only closed historical bars.
const open: HistoricalInputCandle = { ...candle, isOpen: true };
// @ts-expect-error No default/unknown price basis is accepted for input.
const unknownBasis: HistoricalInputCandle = { ...candle, priceBasis: 'UNKNOWN' };
// @ts-expect-error Production market requirements stay M1-only.
const oldTimeframe: AnalysisRequirements['timeframe'] = '5';
// @ts-expect-error Production market requirements stay EUR/USD-only.
const oldInstrument: AnalysisRequirements['pair'] = 'BTC/USDT';
void [missing, noGrant, notReady, purpose, substitution, otherTimeframe, livePurpose, grant, open, unknownBasis, oldTimeframe, oldInstrument];
