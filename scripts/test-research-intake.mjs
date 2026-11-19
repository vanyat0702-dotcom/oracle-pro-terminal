// MOCK UNIT FIXTURES ONLY. No prices in this file represent real historical market data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
import { listResearchInstruments, getResearchInstrument } from '../core/research/catalog.js';
import { inspectHistoricalBytes, importHistoricalFile, MAX_FILE_BYTES, MAX_CANDLES } from '../core/research/intake.js';
import { auditResearchDatasets } from './audit-research-data.mjs';

const AS_OF = '2026-11-19T12:03:00Z';
const T = Date.parse('2026-11-19T12:00:00Z');
const hash = b => createHash('sha256').update(b).digest('hex');
const bytes = d => Buffer.from(JSON.stringify(d));
function fixture(id = 'eurusd') {
  const item = getResearchInstrument(id);
  const source = { sourceId: 'MOCK_UNIT_TEST', symbol: item.base + item.quote,
    venue: 'MOCK_OFFLINE', priceBasis: item.assetClass === 'CRYPTO' ? 'last' : 'mid' };
  return { schemaVersion: 1, kind: 'MOCK', instrument: id, timeframe: '1', source,
    license: { reference: 'MOCK:unit-test-only', permission: 'DECLARED', permittedPurpose: 'CLOSED_BAR_RESEARCH' },
    period: { from: '2026-11-19T12:00:00Z', to: '2026-11-19T12:02:00Z' }, expectedCandles: 3,
    candles: [0, 1, 2].map(i => ({ instrument: id, sourceId: source.sourceId, sourceSymbol: source.symbol,
      venue: source.venue, priceBasis: source.priceBasis, timestamp: new Date(T + i * 60000).toISOString(),
      open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: false, volume: 0.5 })) };
}
const opts = (b, instrument = 'eurusd', asOf = AS_OF) => ({ instrument, expectedChecksum: hash(b), asOf });
const inspect = d => { const b = bytes(d); return inspectHistoricalBytes(b, opts(b, d.instrument)); };
function invariant(r) { assert.equal(r.grantsRuntimeAccess, false); assert.equal(r.readiness, 'NOT_READY'); }
function rejected(r, code) {
  invariant(r); assert.equal(r.status, 'REJECTED'); assert.equal(r.candles.length, 0);
  if (code) assert.ok(r.errors.some(e => e.code === code), JSON.stringify(r.errors));
  return r;
}
let count = 0, io = 0, directory;
const tempFiles = [];
const saved = { fetch: globalThis.fetch, hr: http.request, hg: http.get, sr: https.request, sg: https.get,
  connect: net.Socket.prototype.connect, tls: tls.connect };
async function test(name, run) { await run(); count++; console.log('PASS ' + name); }
try {
  const block = () => { io++; throw Error('External IO forbidden by research intake unit tests'); };
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = block;
  syncBuiltinESMExports();
  await test('catalog matches exactly 21 Forex and BTC/USDT frontend IDs; all real history MISSING', async () => {
    const list = listResearchInstruments(), frontend = await readFile(new URL('../src/config/pairs.ts', import.meta.url), 'utf8');
    const ids = [...frontend.matchAll(/id: '([^']+)'/g)].map(m => m[1]);
    assert.equal(list.length, 22); assert.deepEqual(list.map(i => i.instrument), ids);
    assert.equal(list.filter(i => i.assetClass === 'FOREX').length, 21);
    for (const item of list) {
      assert.equal(item.historyStatus, 'MISSING'); assert.equal(item.sourceId, null); assert.equal(item.sourceSymbol, null);
      assert.equal(item.venue, null); assert.equal(item.priceBasis, 'UNKNOWN'); invariant(item);
      assert.deepEqual(item.researchTimeframes, ['1']); assert.equal(Object.isFrozen(item), true);
    }
    assert.equal(Object.isFrozen(list), true);
    assert.equal(getResearchInstrument('btcusd'), null); assert.equal(getResearchInstrument('BTCUSDT'), null);
    assert.equal(getResearchInstrument('btcusdt').quote, 'USDT');
  });
  for (const item of listResearchInstruments()) await test(`MOCK valid M1 intake: ${item.instrument}, never real history or READY`, () => {
    const r = inspect(fixture(item.instrument)); invariant(r); assert.equal(r.status, 'VALIDATED');
    assert.equal(r.manifest.dataKind, 'MOCK'); assert.equal(r.manifest.historyStatus, 'MOCK_ONLY');
    assert.equal(r.manifest.qualityStatus, 'PASS'); assert.equal(r.manifest.candleCount, 3);
    assert.equal(r.manifest.missingCandles, 0); assert.equal(r.manifest.duplicates, 0);
    assert.equal(r.candles[0].time, T / 1000); assert.equal(r.candles[0].volume, 0.5);
    assert.equal(r.manifest.metadataEvidence, 'DECLARED_ONLY');
    if (item.instrument === 'eurusd') console.log('MOCK_MANIFEST_EXAMPLE ' + JSON.stringify(r.manifest));
    for (const value of [r, r.manifest, r.manifest.source, r.manifest.license, r.candles, r.candles[0]]) assert.equal(Object.isFrozen(value), true);
  });
  for (const value of [null, -1, 0, '1.1', NaN, Infinity]) await test(`reject invalid MOCK OHLC ${String(value)}`, () => {
    const d = fixture(); d.candles[0].open = value; rejected(inspect(d), 'INVALID_OHLC');
  });
  await test('reject high/low inconsistencies and invalid volume; volume may be absent', () => {
    for (const change of [c => { c.low = 1.16; }, c => { c.high = 1.05; }, c => { c.volume = -1; }, c => { c.volume = '1'; }]) {
      const d = fixture(); change(d.candles[0]); rejected(inspect(d));
    }
    const d = fixture(); d.candles.forEach(c => { delete c.volume; }); assert.equal(inspect(d).status, 'VALIDATED');
  });
  await test('duplicates and missing M1 coverage are counted; never deduplicated/interpolated', () => {
    const d = fixture(); d.candles[1] = { ...d.candles[0] };
    const r = rejected(inspect(d), 'DUPLICATE_CANDLE'); assert.equal(r.manifest.duplicates, 1); assert.equal(r.manifest.missingCandles, 1);
    const gap = fixture(); gap.candles.splice(1, 1);
    assert.equal(rejected(inspect(gap), 'MISSING_M1_CANDLES').manifest.missingCandles, 1);
    const boundary = fixture(); boundary.candles.shift(); rejected(inspect(boundary), 'MISSING_M1_CANDLES');
  });
  await test('descending/mixed timestamps are rejected, not silently sorted', () => {
    const d = fixture(); d.candles.reverse(); rejected(inspect(d), 'CANDLES_NOT_ASCENDING');
    const m = fixture(); [m.candles[0], m.candles[1]] = [m.candles[1], m.candles[0]];
    rejected(inspect(m), 'CANDLES_NOT_ASCENDING');
  });
  await test('timestamps require exact UTC minute alignment, real dates and closed bars at asOf', () => {
    for (const timestamp of ['2026-11-19T12:00:01Z', '2026-11-19T12:00:00+00:00', '2026-02-30T12:00:00Z',
      '2026-11-19T12:00:00.001Z', 'UNKNOWN', '2026-11-19T12:03:00Z']) {
      const d = fixture(); d.candles[0].timestamp = timestamp; rejected(inspect(d), 'INVALID_CANDLE_TIME');
    }
    const d = fixture(); d.candles[2].isOpen = true; rejected(inspect(d), 'HISTORICAL_BAR_NOT_CLOSED');
    const b = bytes(fixture()); rejected(inspectHistoricalBytes(b, opts(b, 'eurusd', '2026-11-19T12:02:59Z')), 'INVALID_COVERAGE_MANIFEST');
    assert.equal(inspectHistoricalBytes(b, opts(b, 'eurusd', AS_OF)).status, 'VALIDATED');
  });
  await test('BTC/USD substitution and wrong expected instrument cannot be accepted as BTC/USDT', () => {
    const d = fixture('btcusdt'); d.source.symbol = 'BTCUSD'; rejected(inspect(d), 'INVALID_SOURCE');
    const b = bytes(fixture('eurusd')); rejected(inspectHistoricalBytes(b, opts(b, 'btcusdt')), 'INVALID_DATASET_HEADER');
  });
  for (const key of ['instrument', 'sourceId', 'sourceSymbol', 'venue', 'priceBasis']) await test(`mixed candle ${key} is rejected`, () => {
    const d = fixture(); d.candles[1][key] = key === 'priceBasis' ? 'ask' : 'other';
    rejected(inspect(d), 'MIXED_CANDLE_METADATA');
  });
  await test('incomplete/extra header, source, license and coverage fields are rejected', () => {
    for (const change of [d => { delete d.period; }, d => { delete d.expectedCandles; }, d => { delete d.license; },
      d => { d.extra = true; }, d => { delete d.source.venue; }, d => { d.source.extra = true; },
      d => { d.license.permission = 'UNKNOWN'; }, d => { d.license.permittedPurpose = 'LIVE_SIGNAL_ANALYSIS'; },
      d => { d.license.reference = ''; }, d => { d.expectedCandles = 4; }, d => { d.period.to = d.period.from; }]) {
      const d = fixture(); change(d); rejected(inspect(d));
    }
  });
  await test('M5/unknown price basis and unclosed historical flags are not coerced', () => {
    for (const change of [d => { d.timeframe = '5'; }, d => { d.source.priceBasis = 'UNKNOWN'; },
      d => { delete d.candles[0].isOpen; }, d => { d.candles[0].isOpen = 'false'; }]) {
      const d = fixture(); change(d); rejected(inspect(d));
    }
  });
  await test('MOCK fixtures cannot be relabelled REAL while retaining their explicit test metadata', () => {
    const d = fixture(); d.kind = 'REAL'; rejected(inspect(d), 'MOCK_REAL_MISMATCH');
  });
  await test('external checksum is mandatory; mismatch and byte tampering are refused', () => {
    const b = bytes(fixture()); const o = opts(b); delete o.expectedChecksum;
    rejected(inspectHistoricalBytes(b, o), 'INVALID_IMPORT_OPTIONS');
    rejected(inspectHistoricalBytes(b, { ...opts(b), expectedChecksum: '0'.repeat(64) }), 'CHECKSUM_MISMATCH');
    rejected(inspectHistoricalBytes(Buffer.concat([b, Buffer.from(' ')]), opts(b)), 'CHECKSUM_MISMATCH');
  });
  await test('strict JSON rejects corruption, invalid UTF-8, BOM, duplicate decoded keys and overflow prices', () => {
    for (const b of [Buffer.from('{'), Buffer.from([255]), Buffer.from('NaN'), Buffer.concat([Buffer.from([239, 187, 191]), bytes(fixture())]),
      Buffer.from(JSON.stringify(fixture()).replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')),
      Buffer.from(JSON.stringify(fixture()).replace('"instrument":"eurusd"', '"instrument":"eurusd","\\u0069nstrument":"eurusd"'))]) {
      rejected(inspectHistoricalBytes(b, opts(b)), 'INVALID_JSON');
    }
    const b = Buffer.from(JSON.stringify(fixture()).replace('"open":1.1', '"open":1e999'));
    rejected(inspectHistoricalBytes(b, opts(b)), 'INVALID_OHLC');
  });
  await test('malformed options/proxy/accessors and invalid byte sizes fail without executing traps', () => {
    let traps = 0; const b = bytes(fixture());
    const proxy = new Proxy({}, { ownKeys() { traps++; throw Error('private'); } });
    const getter = Object.defineProperty({ ...opts(b) }, 'asOf', { get() { traps++; throw Error('private'); } });
    for (const option of [proxy, getter, null, {}, { ...opts(b), asOf: 'UNKNOWN' }, { ...opts(b), instrument: 'btcusd' }]) rejected(inspectHistoricalBytes(b, option), 'INVALID_IMPORT_OPTIONS');
    rejected(inspectHistoricalBytes(proxy, opts(b)), 'INVALID_FILE_BYTES');
    rejected(inspectHistoricalBytes(new Uint8Array(), opts(b)), 'INVALID_FILE_SIZE');
    rejected(inspectHistoricalBytes(new Uint8Array(MAX_FILE_BYTES + 1), opts(b)), 'INVALID_FILE_SIZE');
    const d = fixture(); d.expectedCandles = MAX_CANDLES + 1; rejected(inspect(d), 'INVALID_COVERAGE_MANIFEST');
    assert.equal(traps, 0);
  });
  await test('same bytes/checksum/asOf yield identical immutable results without ambient clocks', () => {
    const b = bytes(fixture()), o = opts(b), now = Date.now;
    try { Date.now = () => assert.fail('No ambient clock'); assert.deepEqual(inspectHistoricalBytes(b, o), inspectHistoricalBytes(b, o)); }
    finally { Date.now = now; }
    const d = fixture(), r = inspect(d); d.candles[0].open = 999;
    assert.equal(r.candles[0].open, 1.1); assert.throws(() => { r.manifest.source.venue = 'changed'; });
  });
  await test('actual local-file reader accepts explicitly MOCK file; reports missing/corrupt/directory safely', async () => {
    directory = await mkdtemp(join(tmpdir(), 'oracle-MOCK-research-'));
    const good = join(directory, 'MOCK-unit.json'), bad = join(directory, 'MOCK-broken.json');
    tempFiles.push(good, bad); const b = bytes(fixture()); await writeFile(good, b); await writeFile(bad, '{');
    const r = await importHistoricalFile(good, opts(b)); assert.equal(r.status, 'VALIDATED'); assert.equal(r.manifest.dataKind, 'MOCK'); invariant(r);
    rejected(await importHistoricalFile(good, { ...opts(b), expectedChecksum: '0'.repeat(64) }), 'CHECKSUM_MISMATCH');
    rejected(await importHistoricalFile(bad, opts(Buffer.from('{'))), 'INVALID_JSON');
    rejected(await importHistoricalFile(join(directory, 'absent.json'), opts(b)), 'FILE_MISSING');
    rejected(await importHistoricalFile(directory, opts(b)), 'INVALID_FILE_SIZE');
    for (const remote of ['https://example.invalid/data.json', 'file:///tmp/data.json', '\\\\server\\share\\data.json', '//server/share/data.json']) {
      rejected(await importHistoricalFile(remote, opts(b)), 'LOCAL_FILE_REQUIRED');
    }
    const report = await auditResearchDatasets(['--as-of', AS_OF, '--dataset', 'eurusd', good, hash(b)]);
    assert.equal(report.instruments.length, 22);
    assert.equal(report.instruments.find(i => i.instrument === 'eurusd').historyStatus, 'MOCK_ONLY');
    assert.equal(report.instruments.filter(i => i.historyStatus === 'MISSING').length, 21);
  });
  await test('no-input inventory is honestly 22 MISSING; CLI rejects unknown/duplicate IDs and no cutoff', async () => {
    const r = await auditResearchDatasets([]); invariant(r);
    assert.equal(r.instruments.length, 22);
    assert.ok(r.instruments.every(i => i.historyStatus === 'MISSING' && i.manifest === null && i.checksum === null && i.sourceId === null));
    for (const args of [['--dataset', 'btcusd', 'file', 'hash'], ['--dataset', 'eurusd', 'file', 'hash'],
      ['--as-of', AS_OF, '--dataset', 'eurusd', 'a', 'hash', '--dataset', 'eurusd', 'b', 'hash'], ['--unknown']]) await assert.rejects(() => auditResearchDatasets(args));
  });
  await test('research metadata and results never authorize Core/Gateway/AI adapters', async () => {
    const { checkRuntimeAccess } = await import('../core/runtimeGuard.js');
    const core = await import('../core/index.js'); const { getAnalysisSessionOwner } = await import('../core/runtime/sessionOwner.js');
    const r = inspect(fixture());
    for (const context of [r, r.manifest, r.manifest.source, { ...r, allowed: true, eligible: true }]) {
      assert.equal(checkRuntimeAccess(context).allowed, false);
      const creation = getAnalysisSessionOwner().create(context); assert.equal(creation.status, 'DENIED'); assert.equal(creation.session, null);
      assert.equal((await core.analyze(null, context)).signal, 'SKIP'); assert.equal((await core.getJointPrediction(null, context)).signal, 'SKIP');
      assert.equal(await core.getGPTAnalysis(null, context), null); assert.equal(await core.getGeminiAnalysis(null, context), null);
    }
  });
  assert.equal(io, 0);
  console.log(`Research intake: ${count} MOCK unit groups PASS; real datasets imported: 0; external IO: 0; grants: 0`);
} finally {
  // Delete only known MOCK files in the mkdtemp directory; never recursively remove a computed tree.
  if (directory) {
    for (const path of tempFiles) {
      const child = relative(directory, path); assert.ok(child && !child.startsWith('..') && !child.includes('\\') && !child.includes('/'));
      try { await unlink(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    await rmdir(directory);
  }
  globalThis.fetch = saved.fetch; http.request = saved.hr; http.get = saved.hg; https.request = saved.sr; https.get = saved.sg;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
}
