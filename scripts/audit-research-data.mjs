import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listResearchInstruments, getResearchInstrument } from '../core/research/catalog.js';
import { importHistoricalFile } from '../core/research/intake.js';

// Read-only local-file audit. No default paths, network, environment loading or output files.
async function auditResearchDatasets(args) {
  const selected = new Map(); let asOf = null;
  for (let i = 0; i < args.length;) {
    if (args[i] === '--as-of' && asOf === null && typeof args[i + 1] === 'string') { asOf = args[i + 1]; i += 2; }
    else if (args[i] === '--dataset' && i + 3 < args.length) {
      const [instrument, path, expectedChecksum] = args.slice(i + 1, i + 4);
      if (!getResearchInstrument(instrument) || selected.has(instrument)) throw Error('Invalid or duplicate dataset ID.');
      selected.set(instrument, { path, expectedChecksum }); i += 4;
    } else throw Error('Expected --as-of UTC and repeated --dataset ID LOCAL_PATH SHA256.');
  }
  if (selected.size && !asOf) throw Error('An explicit --as-of UTC cutoff is required.');
  const instruments = [];
  for (const item of listResearchInstruments()) {
    const input = selected.get(item.instrument);
    const result = input ? await importHistoricalFile(input.path, { instrument: item.instrument,
      expectedChecksum: input.expectedChecksum, asOf }) : null;
    const manifest = result?.manifest;
    instruments.push({ ...item,
      sourceId: manifest?.source.sourceId ?? null, sourceSymbol: manifest?.source.symbol ?? null,
      venue: manifest?.source.venue ?? null, priceBasis: manifest?.source.priceBasis ?? 'UNKNOWN',
      historyStatus: !input || result.errors.some(e => e.code === 'FILE_MISSING') ? 'MISSING' :
        result.status === 'REJECTED' ? 'REJECTED' : manifest.historyStatus,
      qualityStatus: result ? result.status === 'VALIDATED' ? 'PASS' : 'FAIL' : 'UNKNOWN',
      dataKind: manifest?.dataKind ?? null, checksum: manifest?.checksum ?? null,
      manifest: manifest ?? null, errorCodes: result?.errors.map(e => e.code) ?? [] });
  }
  return { schemaVersion: 1, purpose: 'CLOSED_BAR_RESEARCH', readiness: 'NOT_READY', grantsRuntimeAccess: false, instruments };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await auditResearchDatasets(process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
    if (report.instruments.some(i => i.errorCodes.length)) process.exitCode = 1;
  } catch { console.error('Research intake failed: use --as-of UTC and --dataset ID LOCAL_PATH SHA256.'); process.exitCode = 1; }
}
export { auditResearchDatasets };
