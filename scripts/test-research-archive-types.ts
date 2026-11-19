import { scanResearchArchive } from '../core/research/archive.js';
import { createResearchCalendar } from '../core/research/calendar.js';
import type { ArchiveHeader, ArchiveFragment, ArchiveOptions, ResearchCalendarSpec, ArchiveCoverage } from '../core/research/archiveContracts.js';
const calendar: ResearchCalendarSpec = { profile: 'FOREX_WEEKLY', sourceId: 'SOURCE', venue: 'VENUE', reference: 'declared', exceptions: [], timeZone: 'America/New_York', openMinute: 1020, closeMinute: 1020 };
const header: ArchiveHeader = { type: 'archive', schemaVersion: 1, instrument: 'eurusd', kind: 'REAL', timeframe: '1', source: { sourceId: 'SOURCE', symbol: 'EURUSD', venue: 'VENUE', priceBasis: 'mid' },
  license: { reference: 'declared', permission: 'DECLARED', permittedPurpose: 'CLOSED_BAR_RESEARCH' }, provenance: { declaration: 'declared', evidence: 'DECLARED_ONLY' }, calendar };
const fragment: ArchiveFragment = { type: 'fragment', path: '2020/01.json', expectedChecksum: 'a'.repeat(64), period: { from: '', to: '' }, expectedCandles: 1 };
const options: ArchiveOptions = { root: 'local', indexPath: 'index.ndjson', instrument: 'btcusdt', expectedIndexChecksum: 'a'.repeat(64), asOf: '' };
const scanner = scanResearchArchive(options);
void scanner; void header; void fragment;
const result = createResearchCalendar(calendar, { sourceId: 'SOURCE', venue: 'VENUE', assetClass: 'FOREX' }).interval(1, 2);
const count: number | null = result.tradingMinutes; void count;
function report(r: ArchiveCoverage) {
  const deny: false = r.grantsRuntimeAccess; const readiness: 'NOT_READY' = r.readiness; void deny; void readiness;
  // @ts-expect-error results are immutable
  r.candleCount = 0;
  // @ts-expect-error no grant can be set
  r.grantsRuntimeAccess = true;
}
void report;
// @ts-expect-error BTC/USD must not replace BTC/USDT
const wrong: ArchiveOptions = { ...options, instrument: 'btcusd' }; void wrong;
// @ts-expect-error research M1 only
const wrongTF: ArchiveHeader = { ...header, timeframe: '5' }; void wrongTF;
// @ts-expect-error caller cannot confirm a license
const license: ArchiveHeader['license'] = { reference: 'x', permission: 'VERIFIED', permittedPurpose: 'CLOSED_BAR_RESEARCH' }; void license;
// @ts-expect-error no production purpose
const live: ArchiveHeader['license'] = { reference: 'x', permission: 'DECLARED', permittedPurpose: 'LIVE_SIGNAL_ANALYSIS' }; void live;
// @ts-expect-error exceptions need independent evidence channel, not client flags
const holidays: ResearchCalendarSpec = { profile: 'CRYPTO_24_7', sourceId: 'x', venue: 'x', reference: 'x', exceptions: [{ confirmed: true }] }; void holidays;
// @ts-expect-error provenance cannot be self-verified
const provenance: ArchiveHeader['provenance'] = { declaration: 'x', evidence: 'VERIFIED' }; void provenance;
