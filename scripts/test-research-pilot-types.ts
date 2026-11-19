import { convertResearchPilot } from '../core/research/pilot.js';
import { parseSourceLine, getOfflineAdapterProfile } from '../core/research/sourceAdapters.js';
import type { PilotOptions, PilotFile, PilotReport, ParsedSourceBar, PilotLicense, OfflineAdapterProfile } from '../core/research/sourceAdapterContracts.js';
declare const options: PilotOptions; declare const report: PilotReport; declare const file: PilotFile;
const denied: false = report.grantsRuntimeAccess; const ready: 'NOT_READY' = report.readiness; void denied; void ready;
void convertResearchPilot(options); void getOfflineAdapterProfile('HISTDATA_ASCII_M1_V1');
const parsed = parseSourceLine('BINANCE_SPOT_KLINE_V1', '', 'MICROSECONDS');
if (parsed.status === 'PARSED') { const b: ParsedSourceBar = parsed.bar; const raw: readonly string[] = b.original.fields; void raw; }
const unknown: PilotLicense = { status: 'UNKNOWN', reference: null, evidence: null, permittedPurposes: [] }; void unknown;
// @ts-expect-error no BTC/USD substitution
const wrongSymbol: PilotFile = { ...file, sourceSymbol: 'BTCUSD' }; void wrongSymbol;
// @ts-expect-error no Futures market
const futures: PilotFile = { ...file, market: 'FUTURES' }; void futures;
// @ts-expect-error units are explicit, not inferred from arbitrary numbers
const units: PilotFile = { ...file, units: 'AUTO' }; void units;
// @ts-expect-error no LIVE purpose
const live: PilotLicense = { status: 'OPERATOR_REVIEWED_PERSONAL_RESEARCH', reference: 'ref', evidence: { path: 'e.txt', expectedChecksum: '' }, permittedPurposes: ['LIVE_SIGNAL_ANALYSIS'] }; void live;
// @ts-expect-error unknown license cannot assert permission
const pretend: PilotLicense = { status: 'UNKNOWN', reference: null, evidence: null, permittedPurposes: ['CLOSED_BAR_RESEARCH'] }; void pretend;
// @ts-expect-error output is immutable
report.status = 'WRITTEN';
// @ts-expect-error no runtime grant
const grant: true = report.grantsRuntimeAccess; void grant;
// @ts-expect-error no commercial grant
const commercial: 'ALLOWED' = report.commercialPermission; void commercial;
declare const profile: OfflineAdapterProfile;
// @ts-expect-error profile may not enable MID fabrication
profile.priceBasis = 'mid';
// @ts-expect-error no public runtime capability
report.runtimeContext;
