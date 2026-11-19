// MOCK fixtures only. No data here represents real prices, licenses or source schedules.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
import { scanResearchArchive, MAX_INDEX_LINE_BYTES } from '../core/research/archive.js';
import { createResearchCalendar } from '../core/research/calendar.js';
import { listResearchInstruments, getResearchInstrument } from '../core/research/catalog.js';
import { MAX_FILE_BYTES } from '../core/research/intake.js';
import { auditResearchArchives } from './audit-research-archive.mjs';

const hash = x => createHash('sha256').update(x).digest('hex');
const iso = ms => new Date(ms).toISOString();
const minute = 60000, asOf = '2026-11-19T12:03:00Z';
const defaultTime = Date.parse('2026-11-19T12:00:00Z');
const files = [], directories = [], links = [];
let base, root, serial = 0, groups = 0, active = 0, maxActive = 0, maxRead = 0, externalIO = 0, symlinkSkipped = 0;
const saved = { open: fs.open, fetch: globalThis.fetch, hr: http.request, hg: http.get, sr: https.request, sg: https.get,
  connect: net.Socket.prototype.connect, tls: tls.connect };
async function write(path, content) { if (!files.includes(path)) files.push(path); await fs.writeFile(path, content); }
const sourceFor = id => ({ sourceId: 'MOCK_UNIT_TEST', symbol: getResearchInstrument(id).pair.replace('/', ''),
  venue: 'MOCK_OFFLINE', priceBasis: id === 'btcusdt' ? 'last' : 'mid' });
const calendarFor = id => id === 'btcusdt' ? { profile: 'CRYPTO_24_7', sourceId: 'MOCK_UNIT_TEST', venue: 'MOCK_OFFLINE', reference: 'MOCK:calendar', exceptions: [] } :
  { profile: 'FOREX_WEEKLY', sourceId: 'MOCK_UNIT_TEST', venue: 'MOCK_OFFLINE', reference: 'MOCK:calendar', exceptions: [], timeZone: 'America/New_York', openMinute: 1020, closeMinute: 1020 };
function fixture(id = 'eurusd', from = defaultTime, count = 2) {
  const source = sourceFor(id);
  return { schemaVersion: 1, kind: 'MOCK', instrument: id, timeframe: '1', source,
    license: { reference: 'MOCK:unit-test', permission: 'DECLARED', permittedPurpose: 'CLOSED_BAR_RESEARCH' },
    period: { from: iso(from), to: iso(from + (count - 1) * minute) }, expectedCandles: count,
    candles: Array.from({ length: count }, (_, i) => ({ instrument: id, sourceId: source.sourceId, sourceSymbol: source.symbol,
      venue: source.venue, priceBasis: source.priceBasis, timestamp: iso(from + i * minute), open: 1.1, high: 1.2, low: 1, close: 1.15, isOpen: false })) };
}
async function setup(datasets = [fixture()], change = () => {}) {
  const d = datasets[0], header = { type: 'archive', schemaVersion: 1, instrument: d.instrument, kind: d.kind, timeframe: '1',
    source: d.source, license: d.license, provenance: { declaration: 'MOCK:fixture-only', evidence: 'DECLARED_ONLY' }, calendar: calendarFor(d.instrument) };
  const rows = [];
  for (const dataset of datasets) {
    const path = `f-${++serial}.json`, bytes = JSON.stringify(dataset);
    await write(join(root, path), bytes);
    rows.push({ type: 'fragment', path, expectedChecksum: hash(bytes), period: dataset.period, expectedCandles: dataset.expectedCandles });
  }
  change(header, rows);
  const indexPath = `index-${++serial}.ndjson`;
  const content = [header, ...rows].map(x => JSON.stringify(x)).join('\n') + '\n';
  await write(join(root, indexPath), content);
  return { o: { root, indexPath, expectedIndexChecksum: hash(content), instrument: d.instrument, asOf }, header, rows, content };
}
async function collect(o) { const events = []; for await (const event of scanResearchArchive(o)) events.push(event); return { events, r: events.at(-1).report }; }
function invariant(r) { assert.equal(r.grantsRuntimeAccess, false); assert.equal(r.readiness, 'NOT_READY'); assert.notEqual(r.status, 'VALIDATED_FOR_RESEARCH_METADATA'); }
async function bad(a, code) {
  const { r } = await collect(a.o); invariant(r); assert.equal(r.structure, 'FAIL'); assert.equal(r.status, 'NOT_READY');
  if (code) assert.ok(r.errorCodes.includes(code), JSON.stringify(r.errorCodes)); return r;
}
async function test(name, run) { await run(); assert.equal(active, 0, 'all scanner descriptors closed'); groups++; console.log('PASS ' + name); }
function model(id = 'eurusd', modify = () => {}) { const c = calendarFor(id); modify(c); return createResearchCalendar(c, { ...{ sourceId: 'MOCK_UNIT_TEST', venue: 'MOCK_OFFLINE' }, assetClass: id === 'btcusdt' ? 'CRYPTO' : 'FOREX' }); }
const interval = (c, a, b) => c.interval(Date.parse(a), Date.parse(b));
try {
  base = await fs.mkdtemp(join(tmpdir(), 'oracle-archive-mock-')); directories.push(base);
  root = join(base, 'root'); await fs.mkdir(root); directories.push(root);
  const block = () => { externalIO++; throw Error('Network forbidden in offline archive tests'); };
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = block;
  fs.open = async (...args) => {
    const fd = await saved.open(...args); active++; maxActive = Math.max(active, maxActive); let closed = false;
    return { stat: (...a) => fd.stat(...a), read: (...a) => { maxRead = Math.max(maxRead, a[2]); return fd.read(...a); },
      close: async () => { assert.equal(closed, false); closed = true; try { await fd.close(); } finally { active--; } } };
  };
  syncBuiltinESMExports();
  await test('inventory: exactly 22 MISSING instruments, BTC/USDT never BTC/USD', async () => {
    const rows = []; for await (const r of auditResearchArchives([])) rows.push(r);
    assert.equal(rows.length, 22); for (const r of rows) { assert.equal(r.historyStatus, 'MISSING'); invariant(r); }
    assert.equal(rows.at(-1).pair, 'BTC/USDT');
  });
  for (const item of listResearchInstruments()) await test(`MOCK archive ${item.instrument}: declared metadata never genuine history`, async () => {
    const a = await setup([fixture(item.instrument)]), { r, events } = await collect(a.o);
    invariant(r); assert.equal(r.structure, 'PASS'); assert.equal(r.coverage, 'PASS'); assert.equal(r.historyStatus, 'MOCK_ONLY');
    assert.equal(r.fragmentCount, 1); assert.equal(r.candleCount, 2); assert.equal(r.originEvidence, 'DECLARED_ONLY');
    assert.equal(r.licenseEvidence, 'DECLARED_NOT_VERIFIED'); assert.equal(r.indexChecksumVerified, true);
    assert.equal(events.some(e => Object.hasOwn(e, 'candles')), false); assert.equal(Object.isFrozen(r), true);
    const e = events.find(x => x.type === 'fragment'); assert.equal(e.manifest.source.sourceId, 'MOCK_UNIT_TEST'); assert.equal(e.provenance.evidence, 'DECLARED_ONLY');
  });
  await test('contiguous fragments join exactly, inclusive boundaries and monthly/yearly rollups', async () => {
    const t = Date.parse('2023-12-31T23:59:00Z');
    const { r, events } = await collect((await setup([fixture('btcusdt', t, 1), fixture('btcusdt', t + minute, 2)])).o);
    assert.equal(r.coverage, 'PASS'); assert.equal(r.candleCount, 3); assert.equal(r.monthsCovered, 2); assert.equal(r.yearsCovered, 2);
    assert.deepEqual(events.filter(e => e.type === 'year').map(e => [e.key, e.candleCount]), [['2023', 1], ['2024', 2]]);
  });
  await test('multi-year archive has no archive-wide depth cap; gaps explicit, no invented candles', async () => {
    const times = ['1999-01-01', '2010-01-01', '2025-01-01'].map(d => Date.parse(d + 'T00:00:00Z'));
    const { r } = await collect((await setup(times.map(t => fixture('btcusdt', t, 1)))).o);
    assert.equal(r.fragmentCount, 3); assert.equal(r.candleCount, 3); assert.equal(r.yearsCovered, 3); assert.equal(r.monthsCovered, 3);
    assert.equal(r.missingTradingMinutes, (times[2] - times[0]) / minute - 2); assert.equal(r.coverage, 'FAIL'); assert.equal(r.unexplainedGaps, 2);
  });
  for (const reverse of [false, true]) await test(`overlap / duplicate / order rejected without sorting: ${reverse}`, async () => {
    const ds = reverse ? [fixture('btcusdt', defaultTime + minute, 1), fixture('btcusdt', defaultTime, 1)] : [fixture(), fixture()];
    const r = await bad(await setup(ds), reverse ? 'FRAGMENTS_NOT_ASCENDING' : 'FRAGMENT_OVERLAP');
    assert.equal(r.overlaps, reverse ? 0 : 1); assert.equal(r.orderViolations, 1);
  });
  await test('missing weekday minute is not excused by Forex calendar', async () => {
    const { r } = await collect((await setup([fixture('eurusd', defaultTime, 1), fixture('eurusd', defaultTime + 2 * minute, 1)])).o);
    assert.equal(r.coverage, 'FAIL'); assert.equal(r.missingTradingMinutes, 1); assert.equal(r.unexplainedGaps, 1);
  });
  await test('Forex weekend excluded only relative to explicit source-bound model', async () => {
    const fri = Date.parse('2026-01-09T21:59:00Z'), sun = Date.parse('2026-01-11T22:00:00Z');
    const { r, events } = await collect((await setup([fixture('eurusd', fri, 1), fixture('eurusd', sun, 1)])).o);
    assert.equal(r.coverage, 'PASS'); assert.equal(r.missingTradingMinutes, 0); assert.equal(r.nonTradingMinutes, 2880); assert.equal(r.nonTradingIntervals, 1);
    assert.equal(r.calendarConfidence, 'DECLARED_ONLY'); assert.equal(events.find(e => e.type === 'gap').assessment.nonTradingMinutes, 2880);
    assert.equal(r.source.sourceId, 'MOCK_UNIT_TEST'); assert.equal(r.indexChecksum.length, 64);
    console.log('MOCK_COVERAGE_EXAMPLE ' + JSON.stringify(r));
  });
  await test('NY model exact Sunday open / Friday close, winter and summer UTC offsets', () => {
    const c = model();
    for (const [a, b, n] of [['2026-01-11T21:59:00Z', '2026-01-11T22:01:00Z', 1], ['2026-07-12T20:59:00Z', '2026-07-12T21:01:00Z', 1],
      ['2026-01-09T21:59:00Z', '2026-01-09T22:01:00Z', 1], ['2026-07-10T20:59:00Z', '2026-07-10T21:01:00Z', 1]]) assert.equal(interval(c, a, b).tradingMinutes, n);
  });
  await test('DST spring and autumn produce 47h / 49h weekend breaks, no fixed UTC offset', () => {
    const c = model();
    assert.equal(interval(c, '2026-03-06T22:00:00Z', '2026-03-08T21:00:00Z').nonTradingMinutes, 47 * 60);
    assert.equal(interval(c, '2026-10-30T21:00:00Z', '2026-11-01T22:00:00Z').nonTradingMinutes, 49 * 60);
  });
  await test('hour-based calendar aggregation equals independent per-minute Intl classification at DST', () => {
    const c = model(), formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    for (const date of ['2026-03-08T04:00:00Z', '2026-11-01T03:00:00Z', '2026-03-08T19:00:00Z', '2026-11-01T20:00:00Z']) {
      const from = Date.parse(date), to = from + 6 * 60 * minute; let expected = 0;
      for (let t = from; t < to; t += minute) {
        const p = Object.fromEntries(formatter.formatToParts(t).map(x => [x.type, x.value]));
        const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) * 1440 + Number(p.hour) * 60 + Number(p.minute);
        if (w >= 1020 && w < 5 * 1440 + 1020) expected++;
      }
      assert.equal(c.interval(from, to).tradingMinutes, expected);
    }
  });
  await test('source-specific hours respected; calendar cannot migrate to different source/venue/class', () => {
    const c = model('eurusd', x => { x.openMinute = 1080; });
    assert.equal(interval(c, '2026-01-11T22:00:00Z', '2026-01-11T23:00:00Z').tradingMinutes, 0);
    for (const key of ['sourceId', 'venue']) assert.equal(model('eurusd', x => { x[key] = 'OTHER'; }).confidence, 'UNKNOWN');
    assert.equal(createResearchCalendar(calendarFor('eurusd'), { sourceId: 'MOCK_UNIT_TEST', venue: 'MOCK_OFFLINE', assetClass: 'CRYPTO' }).confidence, 'UNKNOWN');
  });
  await test('unknown / invalid calendar and unconfirmed holidays never excuse weekday gaps', async () => {
    for (const calendar of [{ profile: 'UNKNOWN' }, { ...calendarFor('eurusd'), timeZone: 'Invalid/Zone' },
      { ...calendarFor('eurusd'), exceptions: [{ date: '2026-11-19', confirmed: true }] }]) {
      const { r } = await collect((await setup([fixture()], h => { h.calendar = calendar; })).o);
      assert.equal(r.structure, 'PASS'); assert.equal(r.coverage, 'UNKNOWN'); assert.equal(r.calendarConfidence, 'UNKNOWN');
      assert.equal(r.missingTradingMinutes, null); assert.deepEqual(r.calendar, { profile: 'UNKNOWN' }); invariant(r);
    }
  });
  await test('crypto weekend is trading, unknown outage remains unexplained', async () => {
    const t = Date.parse('2026-01-10T12:00:00Z');
    const { r } = await collect((await setup([fixture('btcusdt', t, 1), fixture('btcusdt', t + 2 * minute, 1)])).o);
    assert.equal(r.missingTradingMinutes, 1); assert.equal(r.nonTradingMinutes, 0); assert.equal(r.coverage, 'FAIL');
  });
  await test('actual bars inside a declared closed session are flagged, not discarded', async () => {
    const { r } = await collect((await setup([fixture('eurusd', Date.parse('2026-01-10T12:00:00Z'), 1)])).o);
    assert.equal(r.candleCount, 1); assert.equal(r.unexpectedClosedCandles, 1); assert.equal(r.coverage, 'FAIL');
  });
  await test('index checksum mismatch blocks fragment processing', async () => {
    const a = await setup(); a.o.expectedIndexChecksum = '0'.repeat(64); const r = await bad(a, 'INDEX_CHECKSUM_MISMATCH'); assert.equal(r.fragmentCount, 0);
  });
  await test('fragment checksum tampering rejected, no synthetic fallback', async () => {
    const a = await setup(); await write(join(root, a.rows[0].path), '{}'); const r = await bad(a, 'CHECKSUM_MISMATCH'); assert.equal(r.candleCount, 0);
  });
  await test('missing file rejected with explicit code and closed descriptors', async () => {
    await bad(await setup([fixture()], (_, r) => { r[0].path = 'absent.json'; }), 'FILE_MISSING');
  });
  await test('manifest period/count cannot contradict fragment', async () => {
    await bad(await setup([fixture()], (_, rows) => { rows[0].period = { from: iso(defaultTime), to: iso(defaultTime) }; rows[0].expectedCandles = 1; }), 'FRAGMENT_MANIFEST_MISMATCH');
    await bad(await setup([fixture()], (_, rows) => { rows[0].expectedCandles = 0; }), 'INVALID_FRAGMENT_MANIFEST');
  });
  for (const key of ['sourceId', 'symbol', 'venue', 'priceBasis']) await test(`mixed ${key} across fragments rejected`, async () => {
    const d = fixture('eurusd', defaultTime + 2 * minute, 1);
    const value = key === 'priceBasis' ? 'bid' : key === 'symbol' ? 'EUR/USD' : 'OTHER'; d.source[key] = value;
    for (const c of d.candles) c[{ symbol: 'sourceSymbol' }[key] ?? key] = value;
    assert.equal((await bad(await setup([fixture(), d]), 'MIXED_FRAGMENT_METADATA')).mixedSources, 1);
  });
  await test('mixed instrument and BTC/USD substitution rejected', async () => {
    await bad(await setup([fixture(), fixture('btcusdt', defaultTime + 2 * minute, 1)]), 'INVALID_DATASET_HEADER');
    const d = fixture('btcusdt'); d.source.symbol = 'BTCUSD'; d.candles.forEach(c => { c.sourceSymbol = 'BTCUSD'; });
    await bad(await setup([d]), 'INVALID_ARCHIVE_HEADER');
  });
  await test('license/kind mixing rejected; declaration is never verified permission', async () => {
    const d = fixture('eurusd', defaultTime + 2 * minute, 1); d.license.reference = 'MOCK:different-license';
    await bad(await setup([fixture(), d]), 'MIXED_FRAGMENT_METADATA');
    await bad(await setup([fixture()], h => { h.kind = 'REAL'; }), 'INVALID_ARCHIVE_HEADER');
    await bad(await setup([fixture()], h => { delete h.provenance; }), 'INVALID_ARCHIVE_HEADER');
    await bad(await setup([fixture()], h => { h.calendar = 3; }), 'INVALID_ARCHIVE_HEADER');
  });
  await test('invalid OHLC / duplicate / internal gap remain rejected under MVP-1A', async () => {
    const d = fixture(); d.candles[0].high = 0; await bad(await setup([d]), 'INVALID_OHLC');
    const dup = fixture(); dup.candles[1] = { ...dup.candles[0] }; assert.equal((await bad(await setup([dup]), 'DUPLICATE_CANDLE')).duplicates, 1);
    const gap = fixture('eurusd', defaultTime, 3); gap.candles.splice(1, 1); await bad(await setup([gap]), 'MISSING_M1_CANDLES');
  });
  await test('malformed JSON / duplicate keys / BOM / excessive line / prototype key rejected', async () => {
    for (const text of ['{\n', '{"type":"archive","type":"archive"}\n', '\ufeff{}\n', 'x'.repeat(MAX_INDEX_LINE_BYTES + 2), '{"__proto__":{}}\n']) {
      const a = await setup(); await write(join(root, a.o.indexPath), text); a.o.expectedIndexChecksum = hash(text); await bad(a);
    }
  });
  await test('corrupt index after header is caught by final second-pass hash', async () => {
    const a = await setup(), stream = scanResearchArchive(a.o);
    assert.equal((await stream.next()).value.type, 'header');
    // Same-length valid canonical content, changed during backpressure. First parsed line is buffered.
    await write(join(root, a.o.indexPath), a.content.replace('MOCK:fixture-only', 'MOCK:fixture-edit'));
    let final; for await (const e of stream) if (e.type === 'coverage') final = e.report;
    assert.equal(final.structure, 'FAIL'); assert.ok(final.errorCodes.includes('INDEX_CHANGED'));
  });
  for (const path of ['../outside.json', '/absolute.json', 'C:\\private.json', 'https://host/file', 'a/../b.json', 'x:stream', 'a//b', 'a/%2e%2e/b', 'NUL', 'a.']) {
    await test(`unsafe fragment path rejected: ${path}`, async () => { await bad(await setup([fixture()], (_, r) => { r[0].path = path; }), 'UNSAFE_PATH'); });
  }
  await test('unsafe index path and proxy/accessor options rejected without executing getter', async () => {
    const a = await setup(); await bad({ o: { ...a.o, indexPath: '../outside.ndjson' } }, 'UNSAFE_PATH');
    let invoked = 0; await bad({ o: new Proxy(a.o, { get() { invoked++; throw Error(); } }) }, 'INVALID_ARCHIVE_OPTIONS');
    const getter = { ...a.o }; Object.defineProperty(getter, 'root', { get() { invoked++; throw Error(); }, enumerable: true });
    await bad({ o: getter }, 'INVALID_ARCHIVE_OPTIONS'); assert.equal(invoked, 0);
  });
  await test('symlink/junction escape rejected before reading outside file', async () => {
    const outside = join(base, 'outside'); await fs.mkdir(outside); directories.push(outside);
    await write(join(outside, 'payload.json'), JSON.stringify(fixture()));
    const link = join(root, 'escape');
    try { await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); links.push(link); }
    catch (e) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(e.code)) { symlinkSkipped++; console.log('SKIPPED OS symlink privilege'); return; } throw e; }
    await bad(await setup([fixture()], (_, r) => { r[0].path = 'escape/payload.json'; }), 'SYMLINK_FORBIDDEN');
  });
  await test('per-fragment size limit rejects sparse oversized file before allocation', async () => {
    const a = await setup(), p = join(root, a.rows[0].path); await fs.truncate(p, MAX_FILE_BYTES + 1); await bad(a, 'INVALID_FRAGMENT_SIZE');
  });
  await test('backpressure: second fragment is not opened until consumer resumes; early return closes index', async () => {
    const a = await setup([fixture('btcusdt', defaultTime, 1), fixture('btcusdt', defaultTime + minute, 1)]), stream = scanResearchArchive(a.o);
    while ((await stream.next()).value.type !== 'fragment') { /* consume first only */ }
    assert.equal(active, 1); // index only, first fragment already closed
    await fs.unlink(join(root, a.rows[1].path)); files.splice(files.indexOf(join(root, a.rows[1].path)), 1);
    let r; for await (const e of stream) if (e.type === 'coverage') r = e.report;
    assert.equal(r.fragmentCount, 1); assert.ok(r.errorCodes.includes('FILE_MISSING'));
    const early = scanResearchArchive((await setup()).o); await early.next(); assert.equal(active, 1); await early.return(); assert.equal(active, 0);
  });
  await test('consumer exception and caller mutation cannot leak handle or change copied options', async () => {
    const a = await setup(); const stream = scanResearchArchive(a.o); await stream.next(); a.o.instrument = 'btcusdt'; a.o.root = 'absent';
    let r; for await (const e of stream) if (e.type === 'coverage') r = e.report; assert.equal(r.structure, 'PASS'); assert.equal(r.instrument, 'eurusd');
    try { for await (const e of scanResearchArchive((await setup()).o)) { assert.equal(e.type, 'header'); throw Error('consumer'); } } catch (e) { assert.equal(e.message, 'consumer'); }
    assert.equal(active, 0);
  });
  await test('bounded streaming index spans read chunks; no archive-wide byte/candle limit', async () => {
    const rows = [], ds = fixture('btcusdt', defaultTime, 1), a = await setup([ds]);
    const start = Date.parse('2020-01-01T00:00:00Z');
    // Reuse one local MOCK fragment is forbidden by chronological identity; write small distinct fragments.
    for (let i = 0; i < 320; i++) {
      const d = fixture('btcusdt', start + i * minute, 1), path = `many-${i}.json`, text = JSON.stringify(d);
      await write(join(root, path), text); rows.push({ type: 'fragment', path, expectedChecksum: hash(text), period: d.period, expectedCandles: 1 });
    }
    const content = [a.header, ...rows].map(x => JSON.stringify(x)).join('\n') + '\n'; assert.ok(Buffer.byteLength(content) > 65536);
    await write(join(root, a.o.indexPath), content); a.o.expectedIndexChecksum = hash(content);
    let fragmentEvents = 0, r;
    for await (const e of scanResearchArchive(a.o)) { if (e.type === 'fragment') fragmentEvents++; if (e.type === 'coverage') r = e.report; }
    assert.equal(fragmentEvents, 320); assert.equal(r.candleCount, 320); assert.equal(r.coverage, 'PASS');
    assert.ok(maxActive <= 2); assert.ok(maxRead <= 65536);
  });
  await test('archive exceeds both 100000 candles and 32 MiB while each fragment stays bounded', async () => {
    const a = await setup([fixture('btcusdt')]), rows = []; let totalBytes = 0;
    const start = Date.parse('2021-01-01T00:00:00Z');
    for (let i = 0; i < 8; i++) {
      const d = fixture('btcusdt', start + i * 25000 * minute, 25000), text = JSON.stringify(d), path = `large-${i}.json`;
      assert.ok(Buffer.byteLength(text) < MAX_FILE_BYTES); totalBytes += Buffer.byteLength(text);
      await write(join(root, path), text); rows.push({ type: 'fragment', path, expectedChecksum: hash(text), period: d.period, expectedCandles: d.expectedCandles });
    }
    assert.ok(totalBytes > MAX_FILE_BYTES);
    const content = [a.header, ...rows].map(x => JSON.stringify(x)).join('\n') + '\n';
    await write(join(root, a.o.indexPath), content); a.o.expectedIndexChecksum = hash(content);
    let r; for await (const e of scanResearchArchive(a.o)) if (e.type === 'coverage') r = e.report;
    assert.equal(r.candleCount, 200000); assert.equal(r.fragmentCount, 8); assert.equal(r.coverage, 'PASS'); assert.ok(maxActive <= 2);
    console.log(`MOCK_BOUNDARY_TEST bytes=${totalBytes}; candles=${r.candleCount}; descriptors<=2`);
  });
  await test('repeatability, frozen output and zero external IO', async () => {
    const a = await setup(); assert.deepEqual(await collect(a.o), await collect(a.o));
    const { r } = await collect(a.o); assert.throws(() => { r.candleCount = 900; }); assert.equal(externalIO, 0);
    const c = model(); assert.equal(c.interval(NaN, defaultTime).status, 'UNKNOWN'); assert.equal(c.interval(defaultTime, defaultTime - minute).status, 'UNKNOWN');
  });
  console.log(`PASS research archive: ${groups} groups; network=${externalIO}; descriptors peak=${maxActive}; read chunk max=${maxRead}; symlink SKIPPED=${symlinkSkipped}`);
} finally {
  fs.open = saved.open; globalThis.fetch = saved.fetch; http.request = saved.hr; http.get = saved.hg; https.request = saved.sr; https.get = saved.sg;
  net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
  for (const p of [...links].reverse()) { if (process.platform === 'win32') await fs.rmdir(p); else await fs.unlink(p); }
  for (const p of [...files].reverse()) {
    const r = relative(base, p); assert.ok(r && !isAbsolute(r) && r !== '..' && !r.startsWith('..\\') && !r.startsWith('../'));
    await fs.unlink(p);
  }
  for (const d of [...directories].reverse()) await fs.rmdir(d);
}
