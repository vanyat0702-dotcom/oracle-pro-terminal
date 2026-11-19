import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanResearchArchive } from '../core/research/archive.js';
import { listResearchInstruments, getResearchInstrument } from '../core/research/catalog.js';

// Streaming stdout only. No default dataset, network or output files.
async function* auditResearchArchives(args) {
  if (!args.length) {
    for (const instrument of listResearchInstruments()) yield { type: 'inventory', ...instrument };
    return;
  }
  let asOf; const inputs = [], selected = new Set();
  for (let i = 0; i < args.length;) {
    if (args[i] === '--as-of' && !asOf && typeof args[i + 1] === 'string') { asOf = args[i + 1]; i += 2; }
    else if (args[i] === '--archive' && i + 4 < args.length) {
      const [instrument, root, indexPath, expectedIndexChecksum] = args.slice(i + 1, i + 5);
      if (!getResearchInstrument(instrument) || selected.has(instrument)) throw Error('Invalid or duplicate instrument');
      selected.add(instrument); inputs.push({ instrument, root, indexPath, expectedIndexChecksum }); i += 5;
    } else throw Error('Invalid archive arguments');
  }
  if (!asOf) throw Error('Explicit UTC cutoff required');
  for (const input of inputs) for await (const event of scanResearchArchive({ ...input, asOf })) yield event;
  for (const item of listResearchInstruments()) if (!selected.has(item.instrument)) yield { type: 'inventory', ...item };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for await (const event of auditResearchArchives(process.argv.slice(2))) {
      console.log(JSON.stringify(event));
      if (event.type === 'coverage' && (event.report.structure !== 'PASS' || event.report.coverage !== 'PASS')) process.exitCode = 1;
    }
  } catch { console.error('Use --as-of UTC --archive ID ROOT RELATIVE_INDEX SHA256.'); process.exitCode = 1; }
}
export { auditResearchArchives };
