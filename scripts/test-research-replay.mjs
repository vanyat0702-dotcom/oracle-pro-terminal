// Explicit MOCK candles only. Real Binance files are never opened by this suite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net'; import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';

let network = 0, groups = 0;
const saved = [globalThis.fetch, http.request, http.get, https.request, https.get, net.Socket.prototype.connect, tls.connect];
const deny = () => { network++; throw Error('OFFLINE_ONLY'); };
globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = deny;
syncBuiltinESMExports();
const { replayM1, replayHistoricalFiles } = await import('../core/research/replay.js');
const M = 60000, T = Date.parse('2025-01-01T00:00:00Z'), iso = n => new Date(n).toISOString(), opts = { dataKind: 'MOCK' };
const bar = (t, i = 0, extra = {}) => ({ instrument: 'btcusdt', sourceId: 'MOCK_UNIT_TEST', sourceSymbol: 'BTCUSDT',
  venue: 'MOCK_SPOT', priceBasis: 'last', timestamp: iso(t), open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i, isOpen: false, volume: 1, ...extra });
function* rows(start, n, step = M) { for (let i = 0; i < n; i++) yield bar(start + i * step, i % 100); }
async function collect(input, o = opts) { const result = []; for await (const e of replayM1(input, o)) result.push(e); return result; }
async function rejects(input, code, o = opts) { await assert.rejects(async () => { for await (const e of replayM1(input, o)) void e; }, e => e.code === code); }
async function test(name, fn) { await fn(); groups++; console.log('PASS ' + name); }
let root;
try {
  const durations = { M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };
  for (const [tf, n] of Object.entries(durations)) await test('MOCK full ' + tf + ' OHLC, volume and historical close', async () => {
    const events = await collect(rows(T, n)), aggregates = events.flatMap(e => e.type === 'step' ? e.completed.filter(c => c.timeframe === tf) : []);
    assert.equal(aggregates.length, 1); const a = aggregates[0];
    assert.deepEqual([a.timestamp, a.closeTimestamp, a.open, a.high, a.low, a.close, a.volume],
      [iso(T), iso(T + n * M), 10, 12 + Math.min(n - 1, 99), 9, 11 + (n - 1) % 100, n]);
    assert.equal(a.sourceId, 'MOCK_UNIT_TEST'); assert.equal(a.priceBasis, 'last'); assert.equal(a.isOpen, false);
    for (const e of events) if (e.type === 'step') for (const c of e.completed) assert.ok(c.closeTimestamp <= e.replayTimestamp);
  });
  await test('all 1440 UTC bars yield 288/96/48/24/6/1 complete intervals', async () => {
    const totals = Object.fromEntries(Object.keys(durations).map(k => [k, 0]));
    for await (const e of replayM1(rows(T, 1440), opts)) if (e.type === 'step') for (const c of e.completed) totals[c.timeframe]++;
    assert.deepEqual(totals, { M5: 288, M15: 96, M30: 48, H1: 24, H4: 6, D1: 1 });
  });
  await test('partial leading and trailing intervals never appear as completed OHLC', async () => {
    const events = await collect(rows(T + M, 7));
    assert.equal(events.flatMap(e => e.type === 'step' ? e.completed : []).length, 0);
    const partial = events.flatMap(e => e.incompleteIntervals);
    assert.ok(partial.some(x => x.timeframe === 'M5' && x.observedMinutes === 4 && x.missingMinutes === 1));
    assert.ok(partial.some(x => x.reason === 'END_OF_INPUT'));
    for (const x of partial) assert.ok(!Object.hasOwn(x, 'open') && !Object.hasOwn(x, 'close'));
    assert.equal(events.at(-1).replayTimestamp, iso(T + 8 * M));
  });
  await test('missing M1 invalidates every enclosing higher bar, no interpolation', async () => {
    const events = await collect([...rows(T, 1440)].filter((_, i) => i !== 2));
    const last = events.at(-1); assert.equal(last.missingMinutes, 1);
    assert.equal(events.flatMap(e => e.type === 'step' ? e.detectedGaps : []).length, 1);
    for (const tf of Object.keys(durations)) assert.ok(events.flatMap(e => e.incompleteIntervals).some(x => x.timeframe === tf && x.missingMinutes === 1));
    assert.equal(events.flatMap(e => e.type === 'step' ? e.completed.filter(c => c.timeframe === 'D1') : []).length, 0);
  });
  await test('UTC midnight, year boundary and D1 calendar (no broker session)', async () => {
    const start = Date.parse('2024-12-31T23:55:00Z'), events = await collect(rows(start, 10));
    const m5 = events.flatMap(e => e.type === 'step' ? e.completed.filter(c => c.timeframe === 'M5') : []);
    assert.deepEqual(m5.map(c => c.timestamp), [iso(start), iso(T)]);
    assert.ok(events.flatMap(e => e.incompleteIntervals).some(x => x.timeframe === 'D1' && x.timestamp === '2024-12-31T00:00:00.000Z'));
  });
  await test('BTC weekend is continuous; no Forex assumptions', async () => {
    const events = await collect(rows(Date.parse('2025-01-04T00:00:00Z'), 1440));
    assert.equal(events.at(-1).missingMinutes, 0);
    assert.equal(events.at(-1).completedCount, 463);
  });
  await test('Forex weekend gap is explicit UNCLASSIFIED, not filled or silently exempted', async () => {
    const a = Date.parse('2025-01-03T21:59:00Z'), b = Date.parse('2025-01-05T22:00:00Z');
    const fx = t => bar(t, 0, { instrument: 'eurusd', sourceSymbol: 'EURUSD', venue: 'MOCK_FX', priceBasis: 'bid' });
    const events = await collect([fx(a), fx(b)]), gap = events[1].detectedGaps[0];
    assert.equal(gap.missingMinutes, (b - a) / M - 1); assert.equal(gap.classification, 'UNCLASSIFIED');
    assert.equal(events.filter(e => e.type === 'step').length, 2); assert.equal(events[1].completed.length, 0);
  });
  await test('complete prior interval survives a later gap; fully empty buckets summarized by gap', async () => {
    const events = await collect([...rows(T, 5), bar(T + 10000 * M)]);
    assert.equal(events[4].completed[0].timeframe, 'M5');
    assert.equal(events[5].detectedGaps[0].missingMinutes, 9995);
    assert.ok(events[5].incompleteIntervals.length <= 6);
  });
  await test('no read-ahead and upstream closed on early stop', async () => {
    let reads = 0, closed = false;
    async function* source() { try { for (let i = 0; i < 10; i++) { reads++; yield bar(T + i * M); } } finally { closed = true; } }
    const it = replayM1(source(), opts); const first = await it.next();
    assert.equal(reads, 1); assert.equal(first.value.replayTimestamp, iso(T + M)); assert.equal(first.value.completed.length, 0);
    await it.return(); assert.equal(reads, 1); assert.equal(closed, true);
  });
  await test('future suffix cannot affect already emitted prefix', async () => {
    const a = await collect([...rows(T, 5), bar(T + 5 * M, 999)]);
    const b = await collect([...rows(T, 5), bar(T + 5 * M, 2000)]);
    assert.deepEqual(a.slice(0, 5), b.slice(0, 5));
  });
  await test('upstream failure cannot produce a successful end; invalid row closes producer', async () => {
    let closed = false, ends = 0;
    async function* broken() { try { yield bar(T); yield bar(T, 1); } finally { closed = true; } }
    await assert.rejects(async () => { for await (const e of replayM1(broken(), opts)) if (e.type === 'end') ends++; }, e => e.code === 'DUPLICATE_M1');
    assert.equal(closed, true); assert.equal(ends, 0);
    async function* failed() { yield bar(T); throw Error('MOCK_SOURCE_FAILURE'); }
    await assert.rejects(collect(failed()), /MOCK_SOURCE_FAILURE/);
  });
  await test('emitted rows and metadata deeply frozen; no links to caller objects', async () => {
    const c = bar(T); const it = replayM1([c], opts), event = (await it.next()).value;
    c.close = 999; assert.equal(event.completedM1.close, 11);
    assert.throws(() => { event.source.venue = 'changed'; }, TypeError);
    assert.throws(() => { event.completedM1.close = 999; }, TypeError); await it.return();
  });
  await test('duplicate and out-of-order fail without repairing', async () => {
    await rejects([bar(T), bar(T)], 'DUPLICATE_M1'); await rejects([bar(T + M), bar(T)], 'OUT_OF_ORDER_M1');
  });
  for (const [key, value] of [['sourceId', 'OTHER'], ['venue', 'OTHER'], ['priceBasis', 'bid'], ['sourceSymbol', 'BTC/USDT']])
    await test('reject mixed ' + key, () => rejects([bar(T), bar(T + M, 0, { [key]: value })], 'MIXED_SOURCE'));
  await test('reject different instruments', () => rejects([bar(T), bar(T + M, 0, { instrument: 'eurusd', sourceSymbol: 'EURUSD' })], 'MIXED_SOURCE'));
  for (const extra of [{ open: NaN }, { high: Infinity }, { low: 50 }, { volume: -1 }, { isOpen: true }, { timestamp: '2025-01-01T00:00:01Z' }, { eligible: true }])
    await test('reject invalid MOCK input ' + JSON.stringify(extra), async () => {
      await assert.rejects(collect([bar(T, 0, extra)]));
    });
  await test('reject unknown metadata, accessors, proxy without running traps', async () => {
    let hits = 0; const c = bar(T); Object.defineProperty(c, 'open', { get() { hits++; return 10; } });
    await rejects([c], 'INVALID_SCHEMA'); await rejects([new Proxy(bar(T), { get() { hits++; throw Error(); } })], 'INVALID_SCHEMA');
    await rejects([bar(T, 0, { venue: 'UNKNOWN' })], 'INVALID_SOURCE'); assert.equal(hits, 0);
  });
  await test('empty, MOCK-to-REAL relabel and invalid options fail closed', async () => {
    await rejects([], 'EMPTY_INPUT'); await rejects([bar(T)], 'MOCK_REAL_MISMATCH', { dataKind: 'REAL' });
    await rejects([bar(T)], 'INVALID_SCHEMA', { ...opts, eligible: true });
  });
  await test('optional volume never fabricated or summed incompletely', async () => {
    const input = [...rows(T, 5)]; delete input[2].volume;
    const events = await collect(input); assert.ok(!Object.hasOwn(events[4].completed[0], 'volume'));
    const huge = [...rows(T, 5)].map(c => ({ ...c, volume: Number.MAX_VALUE })); await rejects(huge, 'VOLUME_OVERFLOW');
  });
  await test('determinism across repeated and concurrent independent replay', async () => {
    const [a, b] = await Promise.all([collect(rows(T, 100)), collect(rows(T, 100))]); assert.deepEqual(a, b);
    assert.deepEqual(a, await collect(rows(T, 100)));
    for (const e of a) { assert.equal(e.grantsRuntimeAccess, false); assert.equal(e.readiness, 'NOT_READY'); assert.equal(e.dataKind, 'MOCK'); }
  });
  await test('four-year MOCK stream: lazy generator, bounded events and compact long gaps', async () => {
    const n = 4 * 365 * 24; let consumed = 0, result;
    async function* source() { for (const c of rows(T, n, 60 * M)) { consumed++; yield c; } }
    for await (const event of replayM1(source(), opts)) {
      result = event;
      if (event.type === 'step') { assert.equal(consumed, (Date.parse(event.completedM1.timestamp) - T) / (60 * M) + 1);
        assert.ok(event.completed.length <= 6); assert.ok(event.incompleteIntervals.length <= 6); assert.ok(event.detectedGaps.length <= 1); }
    }
    assert.equal(consumed, n); assert.equal(result.candleCount, n); assert.equal(result.completedCount, 0);
    assert.equal(result.missingMinutes, (n - 1) * 59);
  });
  root = await fs.mkdtemp(join(tmpdir(), 'oracle-replay-MOCK-'));
  async function file(name, start, count, alter = {}) {
    const candles = [...rows(start, count)], source = { sourceId: 'MOCK_UNIT_TEST', symbol: 'BTCUSDT', venue: 'MOCK_SPOT', priceBasis: 'last' };
    const d = { schemaVersion: 1, kind: 'MOCK', instrument: 'btcusdt', timeframe: '1', source,
      license: { reference: 'MOCK:personal-unit-test', permission: 'DECLARED', permittedPurpose: 'CLOSED_BAR_RESEARCH' },
      period: { from: iso(start), to: iso(start + (count - 1) * M) }, expectedCandles: count, candles, ...alter };
    const bytes = JSON.stringify(d), path = join(root, name); await fs.writeFile(path, bytes);
    return { path, expectedChecksum: createHash('sha256').update(bytes).digest('hex') };
  }
  const fopts = { dataKind: 'MOCK', instrument: 'btcusdt', asOf: iso(T + 20 * M) };
  await test('existing intake files stream across fragment boundaries', async () => {
    const a = await file('a.json', T, 2), b = await file('b.json', T + 2 * M, 3); const events = [];
    for await (const e of replayHistoricalFiles([a, b], fopts)) events.push(e);
    assert.equal(events.at(-1).candleCount, 5); assert.equal(events[4].completed[0].timeframe, 'M5');
  });
  await test('file adapter is lazy; future fragment not opened before requested', async () => {
    const a = await file('lazy.json', T, 2); let advanced = false;
    async function* files() { yield a; advanced = true; throw Error('UNREQUESTED_FUTURE'); }
    const it = replayHistoricalFiles(files(), fopts); await it.next(); await it.return(); assert.equal(advanced, false);
  });
  await test('file corruption, checksum, source/metadata, overlaps and data kind rejected', async () => {
    const a = await file('good.json', T, 2), b = await file('bad-license.json', T + 2 * M, 2,
      { license: { reference: 'MOCK:different', permission: 'DECLARED', permittedPurpose: 'CLOSED_BAR_RESEARCH' } });
    async function run(files, o = fopts) { for await (const e of replayHistoricalFiles(files, o)) void e; }
    await assert.rejects(run([a, b]), e => e.code === 'MIXED_FILE_METADATA');
    await assert.rejects(run([a, a]), e => e.code === 'OUT_OF_ORDER_M1');
    await assert.rejects(run([{ ...a, expectedChecksum: '0'.repeat(64) }]), e => e.code === 'FRAGMENT_REJECTED');
    await assert.rejects(run([a], { ...fopts, dataKind: 'REAL' }), e => e.code === 'MIXED_DATA_KIND');
    const broken = join(root, 'broken.json'); await fs.writeFile(broken, '{');
    await assert.rejects(run([{ path: broken, expectedChecksum: '0'.repeat(64) }]), e => e.code === 'FRAGMENT_REJECTED');
  });
  assert.equal(network, 0);
  console.log(`Research replay: ${groups} MOCK groups PASS; network=0; real datasets=0; runtime grants=0`);
} finally {
  if (root) {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('oracle-replay-MOCK-'));
    await fs.rm(root, { recursive: true, force: true }); // Verified suite-owned mkdtemp target only.
  }
  [globalThis.fetch, http.request, http.get, https.request, https.get, net.Socket.prototype.connect, tls.connect] = saved;
  syncBuiltinESMExports();
}
