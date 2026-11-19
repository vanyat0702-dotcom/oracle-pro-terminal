// All rows and documentary evidence in this suite are MOCK unit fixtures, never real history/licenses.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute, basename } from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net'; import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';
import { parseSourceLine, getOfflineAdapterProfile } from '../core/research/sourceAdapters.js';
import { convertResearchPilot } from '../core/research/pilot.js';
import { MAX_PILOT_INPUT_BYTES } from '../core/research/pilotLocalIO.js';
import { scanResearchArchive } from '../core/research/archive.js';

const hash = s => createHash('sha256').update(s).digest('hex'), M = 60000;
const T = Date.parse('2025-01-07T12:00:00Z'), iso = n => new Date(n).toISOString();
const hist = (stamp = '20250107 070000') => `${stamp};1.10;1.20;1.00;1.15;0`;
function binance(t = T, units = t < Date.parse('2025-01-01T00:00:00Z') ? 'MILLISECONDS' : 'MICROSECONDS') {
  const scale = units === 'MILLISECONDS' ? 1n : 1000n, n = BigInt(t) * scale;
  return `${n},90000,91000,89000,90500,1.25,${n + 60000n * scale - 1n},112500,2,0.5,45000,0`;
}
let base, input, output, seq = 0, groups = 0, active = 0, peak = 0, maxRead = 0, network = 0;
let corrupt = false, writeFault = false, closeFault = false, lockCloseFault = false, mutateOnStage = null;
const links = [];
const saved = { open: fs.open, fetch: globalThis.fetch, hr: http.request, hg: http.get, sr: https.request, sg: https.get, connect: net.Socket.prototype.connect, tls: tls.connect };
async function fixture({ profile = 'HISTDATA_ASCII_M1_V1', text = null, from = T, to = T + 2 * M, units = null } = {}) {
  const p = getOfflineAdapterProfile(profile), day = iso(from).slice(0, 10);
  units ??= p.market === 'FOREX' ? 'EST_FIXED_TEXT' : from < Date.parse('2025-01-01T00:00:00Z') ? 'MILLISECONDS' : 'MICROSECONDS';
  text ??= p.market === 'FOREX' ? hist() + '\n' + hist('20250107 070100') + '\n' : binance(from, units) + '\n' + binance(from + M, units) + '\n';
  const path = `input-${++seq}.csv`; await fs.writeFile(join(input, path), text);
  return { inputRoot: input, profileId: profile, dataKind: 'MOCK', files: [{ path, expectedChecksum: hash(text), sourceId: p.sourceId,
    sourceSymbol: p.sourceSymbol, market: p.market, units, originRef: p.market === 'FOREX' ? 'https://www.histdata.com/download-free-forex-data/' :
      `https://data.binance.vision/data/spot/daily/klines/BTCUSDT/1m/BTCUSDT-1m-${day}.zip` }],
    venue: { id: 'UNKNOWN', evidence: null }, license: { status: 'UNKNOWN', reference: null, evidence: null, permittedPurposes: [] },
    provenance: { reference: 'MOCK:unit-only', acquiredAt: '2026-11-19T00:00:00Z' }, requestedRange: { from: iso(from), toExclusive: iso(to) },
    closedBarCutoff: '2026-11-19T00:00:00Z', calendar: { profile: 'UNKNOWN' }, output: null };
}
async function reviewed(o) {
  const p = getOfflineAdapterProfile(o.profileId), path = `evidence-${++seq}.txt`, text = 'MOCK unit fixture only: operator review of venue and personal research, not an actual license';
  await fs.writeFile(join(input, path), text);
  const evidence = { path, expectedChecksum: hash(text) };
  o.venue = { id: p.market === 'SPOT' ? 'BINANCE_SPOT' : 'MOCK_OTC_VENUE', evidence };
  o.license = { status: 'OPERATOR_REVIEWED_PERSONAL_RESEARCH', reference: 'MOCK:license-only', evidence, permittedPurposes: ['CLOSED_BAR_RESEARCH'] };
  o.calendar = p.market === 'SPOT' ? { profile: 'CRYPTO_24_7', sourceId: p.sourceId, venue: o.venue.id, reference: 'MOCK:calendar', exceptions: [] } :
    { profile: 'FOREX_WEEKLY', sourceId: p.sourceId, venue: o.venue.id, reference: 'MOCK:calendar', exceptions: [], timeZone: 'America/New_York', openMinute: 1020, closeMinute: 1020 };
  return o;
}
function deny(r) { assert.equal(r.readiness, 'NOT_READY'); assert.equal(r.grantsRuntimeAccess, false); assert.equal(r.commercialPermission, 'NOT_GRANTED'); assert.equal(r.redistributionPermission, 'NOT_GRANTED'); }
async function reject(o, code) { const r = await convertResearchPilot(o); deny(r); assert.equal(r.status, 'REJECTED', JSON.stringify(r)); if (code) assert.ok(r.errors.includes(code), JSON.stringify(r.errors)); return r; }
async function test(name, run) { await run(); assert.equal(active, 0, 'all descriptors closed'); groups++; console.log('PASS ' + name); }
async function rewrite(o, text, i = 0) { await fs.writeFile(join(input, o.files[i].path), text); o.files[i].expectedChecksum = hash(text); }
async function outputState() { return (await fs.readdir(output)).sort(); }
async function newOutput(o) { o.output = { root: output, name: `pilot-${++seq}` }; return o; }
async function audit(r) { let final; for await (const e of scanResearchArchive({ root: r.output.directory, indexPath: 'index.ndjson', expectedIndexChecksum: r.output.indexChecksum, instrument: r.profile.instrument, asOf: '2026-11-19T00:00:00Z' })) if (e.type === 'coverage') final = e.report; return final; }
try {
  base = await fs.mkdtemp(join(tmpdir(), 'oracle-pilot-mock-')); input = join(base, 'input'); output = join(base, 'research-output'); await fs.mkdir(input); await fs.mkdir(output);
  const block = () => { network++; throw Error('Offline pilot test forbids external transport'); };
  globalThis.fetch = http.request = http.get = https.request = https.get = net.Socket.prototype.connect = tls.connect = block;
  fs.open = async (...args) => {
    if (mutateOnStage && basename(String(args[0])) === 'index.ndjson' && args[1] === 'wx') { const fn = mutateOnStage; mutateOnStage = null; await fn(); }
    const fd = await saved.open(...args); active++; peak = Math.max(peak, active); let closed = false;
    return { stat: (...a) => fd.stat(...a), read: (...a) => { maxRead = Math.max(maxRead, a[2]); return fd.read(...a); },
      writeFile: async (text, ...a) => {
        if (writeFault && basename(String(args[0])) === 'index.ndjson') { writeFault = false; throw Error('MOCK write fault'); }
        if (corrupt && basename(String(args[0])).startsWith('fragment-')) { corrupt = false; text = String(text).replace('"open":1.1', '"open":0'); }
        return fd.writeFile(text, ...a);
      }, close: async () => {
        assert.equal(closed, false, 'descriptor closed once'); closed = true;
        try { await fd.close(); } finally { active--; }
        if (closeFault && basename(String(args[0])) === 'lineage.ndjson') { closeFault = false; throw Error('MOCK close fault after close'); }
        if (lockCloseFault && String(args[0]).endsWith('.pilot-lock')) { lockCloseFault = false; throw Error('MOCK lock close fault'); }
      } };
  }; syncBuiltinESMExports();
  await test('profiles fixed to EURUSD BID / BTCUSDT Spot LAST and deeply frozen', () => {
    const h = getOfflineAdapterProfile('HISTDATA_ASCII_M1_V1'), b = getOfflineAdapterProfile('BINANCE_SPOT_KLINE_V1');
    assert.equal(h.priceBasis, 'bid'); assert.equal(h.instrument, 'eurusd'); assert.equal(b.market, 'SPOT'); assert.equal(b.instrument, 'btcusdt'); assert.equal(b.priceBasis, 'last');
    assert.equal(getOfflineAdapterProfile('__proto__'), null); assert.equal(Object.isFrozen(h), true);
  });
  for (const [stamp, expected] of [['20250107 070000', '2025-01-07T12:00:00.000Z'], ['20250707 070000', '2025-07-07T12:00:00.000Z'], ['20250107 230000', '2025-01-08T04:00:00.000Z']]) {
    await test(`HistData fixed EST: ${stamp}`, () => { const r = parseSourceLine('HISTDATA_ASCII_M1_V1', hist(stamp), 'EST_FIXED_TEXT'); assert.equal(r.status, 'PARSED'); assert.equal(r.bar.timestamp, expected); assert.equal(r.bar.original.timestamp, stamp); assert.equal(r.bar.volume, undefined); });
  }
  await test('HistData UTC conversion rejects year overflow and preserves last supported M1 boundary', () => {
    const overflow = parseSourceLine('HISTDATA_ASCII_M1_V1', hist('99991231 230000'), 'EST_FIXED_TEXT');
    assert.equal(overflow.status, 'REJECTED'); assert.equal(overflow.error, 'NORMALIZED_TIME_OUT_OF_RANGE');
    const last = parseSourceLine('HISTDATA_ASCII_M1_V1', hist('99991231 185900'), 'EST_FIXED_TEXT');
    assert.equal(last.status, 'PARSED'); assert.equal(last.bar.timestamp, '9999-12-31T23:59:00.000Z');
  });
  for (const t of [Date.parse('2024-12-31T23:59:00Z'), Date.parse('2025-01-01T00:00:00Z')]) await test(`Binance exact unit/close time at ${iso(t)}`, () => {
    const units = t < Date.parse('2025-01-01T00:00:00Z') ? 'MILLISECONDS' : 'MICROSECONDS'; const r = parseSourceLine('BINANCE_SPOT_KLINE_V1', binance(t, units), units);
    assert.equal(r.status, 'PARSED'); assert.equal(r.bar.timestamp, iso(t)); assert.equal(r.bar.original.fields.length, 12); assert.equal(r.bar.volume, 1.25);
    assert.equal(r.bar.original.closeTimestamp, binance(t, units).split(',')[6]);
  });
  await test('wrong ms/us before and after cutover rejected, no magnitude guessing', () => {
    for (const [t, units] of [[T, 'MILLISECONDS'], [Date.parse('2024-12-31T23:59:00Z'), 'MICROSECONDS']]) assert.equal(parseSourceLine('BINANCE_SPOT_KLINE_V1', binance(t, units), units).status, 'REJECTED');
    assert.equal(parseSourceLine('HISTDATA_ASCII_M1_V1', hist(), 'MICROSECONDS').status, 'REJECTED');
  });
  for (const mutate of [f => { f[0] = String(BigInt(f[0]) + 1n); }, f => { f[6] = f[0]; }, f => { f[6] = String(BigInt(f[6]) + 1n); }, f => { f[0] = 'NaN'; }, f => { f[8] = '1.5'; }]) await test('Binance non-M1 / close / malformed fields fail', () => {
    const f = binance().split(','); mutate(f); assert.equal(parseSourceLine('BINANCE_SPOT_KLINE_V1', f.join(','), 'MICROSECONDS').status, 'REJECTED');
  });
  for (const stamp of ['20250230 070000', '20250107 070001', '20250107 240000', '20250107 076000', 'UNKNOWN']) await test(`HistData invalid time ${stamp}`, () => {
    assert.equal(parseSourceLine('HISTDATA_ASCII_M1_V1', hist(stamp), 'EST_FIXED_TEXT').status, 'REJECTED');
  });
  for (const v of ['NaN', 'Infinity', '-1', '0', '1e5', ' 1.1', '"1.1"']) await test(`strict OHLC rejects ${v}`, () => {
    const f = hist().split(';'); f[1] = v; assert.equal(parseSourceLine('HISTDATA_ASCII_M1_V1', f.join(';'), 'EST_FIXED_TEXT').status, 'REJECTED');
  });
  await test('OHLC inequalities and malformed/truncated CSV rejected', async () => {
    for (const text of ['20250107 070000;1.1;1.0;1.0;1.15;0', hist().slice(0, -2), hist() + ';extra', '\ufeff' + hist(), hist() + '\n\n']) await reject(await fixture({ text }));
    await reject(await fixture({ profile: 'BINANCE_SPOT_KLINE_V1', text: binance().split(',').slice(0, 11).join(',') }));
  });
  await test('unknown venue/license produce preview only, no output or research-ready', async () => {
    const o = await newOutput(await fixture()), before = await outputState(), r = await convertResearchPilot(o);
    deny(r); assert.equal(r.status, 'PREVIEW_ONLY'); assert.equal(r.output, null); assert.equal(r.candleCount, 2); assert.ok(r.blockedReasons.includes('VENUE_UNKNOWN')); assert.ok(r.blockedReasons.includes('LICENSE_UNKNOWN'));
    assert.equal(r.preview[0].original.timestamp, '20250107 070000'); assert.deepEqual(await outputState(), before);
    console.log('MOCK_PREVIEW_HISTDATA ' + JSON.stringify({ status: r.status, timestamp: r.preview[0].timestamp, original: r.preview[0].original.timestamp, blockedReasons: r.blockedReasons, grantsRuntimeAccess: r.grantsRuntimeAccess }));
  });
  await test('known venue but unknown license remains preview', async () => {
    const o = await reviewed(await fixture({ profile: 'BINANCE_SPOT_KLINE_V1' })); o.license = { status: 'UNKNOWN', reference: null, evidence: null, permittedPurposes: [] };
    const r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'PREVIEW_ONLY'); assert.ok(r.blockedReasons.includes('LICENSE_UNKNOWN'));
  });
  await test('unknown venue alone still blocks output with reviewed license', async () => {
    const o = await reviewed(await fixture()); o.venue = { id: 'UNKNOWN', evidence: null };
    const r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'PREVIEW_ONLY'); assert.ok(r.blockedReasons.includes('VENUE_UNKNOWN')); assert.equal(r.output, null);
  });
  await test('bad or absent evidence cannot authorize writing', async () => {
    for (const missing of [false, true]) {
      const o = await reviewed(await fixture()); o.license.evidence = { path: missing ? 'missing.txt' : o.license.evidence.path, expectedChecksum: '0'.repeat(64) };
      const r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'PREVIEW_ONLY'); assert.ok(r.blockedReasons.includes('LICENSE_EVIDENCE_UNVERIFIED'));
    }
  });
  await test('source checksum mismatch rejects before parsing, including invalid UTF8', async () => {
    const o = await fixture(); o.files[0].expectedChecksum = '0'.repeat(64); await reject(o, 'SOURCE_CHECKSUM_MISMATCH');
    const b = Buffer.from([255, 254, 10]); await rewrite(o, b); await reject(o, 'INVALID_CSV_UTF8');
  });
  await test('duplicate and descending rows are never deduplicated/sorted', async () => {
    await reject(await fixture({ text: hist() + '\n' + hist() }), 'DUPLICATE_CANDLE');
    await reject(await fixture({ text: hist('20250107 070100') + '\n' + hist() }), 'CANDLES_NOT_ASCENDING');
  });
  await test('source / symbol / market mismatches and Futures origin rejected', async () => {
    for (const [key, value] of [['sourceId', 'HISTDATA'], ['sourceSymbol', 'BTCUSD'], ['market', 'FUTURES'], ['originRef', 'https://data.binance.vision/data/futures/um/daily/klines/BTCUSDT/1m/BTCUSDT-1m-2025-01-07.zip']]) {
      const o = await fixture({ profile: 'BINANCE_SPOT_KLINE_V1' }); o.files[0][key] = value; await reject(o);
    }
    const o = await fixture({ profile: 'BINANCE_SPOT_KLINE_V1' }); o.files[0].originRef = o.files[0].originRef.replace('2025-01-07', '2025-01-08'); await reject(o, 'SOURCE_FILE_PERIOD_MISMATCH');
  });
  await test('query credentials / unrelated origin / duplicate input files rejected', async () => {
    for (const originRef of ['https://user:pass@histdata.com/', 'https://histdata.com/?token=hidden', 'https://example.invalid/']) { const o = await fixture(); o.files[0].originRef = originRef; await reject(o); }
    const o = await fixture(); o.files.push({ ...o.files[0] }); await reject(o, 'DUPLICATE_INPUT_FILE');
  });
  await test('2024/2025 files join in source order and preserve ms/us lineage', async () => {
    const t = Date.parse('2024-12-31T23:59:00Z'), old = await fixture({ profile: 'BINANCE_SPOT_KLINE_V1', from: t, to: t + 2 * M, text: binance(t) });
    const newer = await fixture({ profile: 'BINANCE_SPOT_KLINE_V1', from: t + M, to: t + 2 * M, text: binance(t + M) }); old.files.push(newer.files[0]);
    await reviewed(old); const r = await convertResearchPilot(await newOutput(old)); assert.equal(r.status, 'WRITTEN', JSON.stringify(r)); deny(r);
    assert.equal(r.fragments, 1); assert.equal(r.preview[0].original.units, 'MILLISECONDS'); assert.equal(r.preview[1].original.units, 'MICROSECONDS');
    assert.equal((await audit(r)).historyStatus, 'MOCK_ONLY'); assert.equal(r.sourceFiles[0].containerVerification, 'NOT_VERIFIED');
    console.log('MOCK_PREVIEW_BINANCE ' + JSON.stringify({ status: r.status, coverage: r.coverage, candleCount: r.candleCount, units: r.preview.map(b => b.original.units), readiness: r.readiness }));
    const reversed = structuredClone(old); reversed.files.reverse(); reversed.output = null; await reject(reversed, 'CANDLES_NOT_ASCENDING');
  });
  await test('Forex weekend is separate fragments, never synthesized, declared model only', async () => {
    const from = Date.parse('2025-01-10T21:59:00Z'), to = Date.parse('2025-01-12T22:01:00Z');
    const o = await reviewed(await fixture({ from, to, text: hist('20250110 165900') + '\n' + hist('20250112 170000') }));
    const r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'WRITTEN', JSON.stringify(r)); assert.equal(r.fragments, 2); assert.equal(r.candleCount, 2);
    assert.equal(r.gapMinutes, 2880); assert.equal(r.nonTradingMinutes, 2880); assert.equal(r.missingTradingMinutes, 0); assert.equal((await audit(r)).candleCount, 2);
  });
  await test('missing weekday minute remains FAIL and prevents write', async () => {
    const o = await reviewed(await fixture({ to: T + 3 * M, text: hist() + '\n' + hist('20250107 070200') }));
    const r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'PREVIEW_ONLY'); assert.equal(r.coverage, 'FAIL'); assert.equal(r.missingTradingMinutes, 1); assert.equal(r.fragments, 2); assert.equal(r.candleCount, 2);
  });
  await test('range boundaries, skipped rows, cutoff, and no-selected-bars checked', async () => {
    const o = await reviewed(await fixture()); o.requestedRange.toExclusive = iso(T + 3 * M);
    let r = await convertResearchPilot(o); assert.equal(r.missingTradingMinutes, 1); assert.equal(r.coverage, 'FAIL');
    o.requestedRange.from = iso(T - M); r = await convertResearchPilot(o); assert.equal(r.missingTradingMinutes, 2);
    o.closedBarCutoff = iso(T); await reject(o, 'INVALID_REQUESTED_RANGE');
    const skip = await reviewed(await fixture()); skip.requestedRange.from = iso(T + M); r = await convertResearchPilot(skip); assert.equal(r.skippedOutsideRange, 1); assert.equal(r.candleCount, 1);
    skip.requestedRange = { from: iso(T + 10 * M), toExclusive: iso(T + 11 * M) }; await reject(skip, 'NO_SELECTED_BARS');
  });
  await test('acquisition cannot precede selected bar close; exact boundary valid for both profiles', async () => {
    for (const profile of ['HISTDATA_ASCII_M1_V1', 'BINANCE_SPOT_KLINE_V1']) {
      const o = await newOutput(await reviewed(await fixture({ profile }))), before = await outputState();
      o.provenance.acquiredAt = iso(T + 2 * M - 1000); await reject(o, 'ACQUIRED_BEFORE_BAR_CLOSE');
      assert.deepEqual(await outputState(), before);
      o.provenance.acquiredAt = iso(T + 2 * M);
      const r = await convertResearchPilot(o); assert.equal(r.status, 'WRITTEN', JSON.stringify(r)); deny(r);
      assert.equal(r.candleCount, 2); assert.equal(r.metadata.provenance.acquiredAt, o.provenance.acquiredAt);
    }
  });
  await test('unknown calendar / holiday exemptions and actual closed-session bars block write', async () => {
    const o = await reviewed(await fixture()); o.calendar = { profile: 'UNKNOWN' }; let r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'PREVIEW_ONLY'); assert.equal(r.coverage, 'UNKNOWN');
    const closed = Date.parse('2025-01-11T12:00:00Z'), q = await reviewed(await fixture({ from: closed, to: closed + M, text: hist('20250111 070000') }));
    r = await convertResearchPilot(q); assert.equal(r.coverage, 'FAIL'); assert.equal(r.unexpectedClosedCandles, 1);
  });
  await test('valid output has index, full raw-to-normalized lineage and out-of-band digests', async () => {
    const o = await newOutput(await reviewed(await fixture())), r = await convertResearchPilot(o); assert.equal(r.status, 'WRITTEN', JSON.stringify(r));
    const dir = r.output.directory, lineage = await fs.readFile(join(dir, 'lineage.ndjson'), 'utf8'), manifest = await fs.readFile(join(dir, 'conversion.json'), 'utf8');
    assert.equal(hash(lineage), r.output.lineageChecksum); assert.equal(hash(manifest), r.output.conversionChecksum);
    const row = JSON.parse(lineage.split('\n')[0]); assert.equal(row.original.timestamp, '20250107 070000'); assert.equal(row.normalized.timestamp, iso(T)); assert.equal(row.sourceChecksum, o.files[0].expectedChecksum);
    const a = await audit(r); assert.equal(a.structure, 'PASS'); assert.equal(a.coverage, 'PASS'); assert.equal(a.dataKind, 'MOCK'); assert.equal(a.readiness, 'NOT_READY'); assert.equal(a.grantsRuntimeAccess, false);
    const m = JSON.parse(manifest); assert.equal(m.report.evidenceStatus, 'DECLARED_ONLY'); assert.equal(m.report.commercialPermission, 'NOT_GRANTED'); assert.equal(m.report.evidenceFiles.length, 2);
  });
  await test('corrupted output is refused before atomic publication and staging is cleaned', async () => {
    const before = await outputState(), o = await newOutput(await reviewed(await fixture())); corrupt = true;
    await reject(o, 'OUTPUT_VALIDATION_FAILED'); assert.deepEqual(await outputState(), before);
  });
  await test('write error cleans every file/lock/descriptor and never publishes', async () => {
    const before = await outputState(), o = await newOutput(await reviewed(await fixture())); writeFault = true;
    await reject(o); assert.deepEqual(await outputState(), before);
  });
  await test('close rejection still cleans staging and lock without double close', async () => {
    const before = await outputState(), o = await newOutput(await reviewed(await fixture())); closeFault = true;
    await reject(o); assert.deepEqual(await outputState(), before);
  });
  await test('post-publication lock cleanup fault reports real artifact and explicit warning', async () => {
    const o = await newOutput(await reviewed(await fixture())); lockCloseFault = true;
    const r = await convertResearchPilot(o); assert.equal(r.status, 'WRITTEN'); assert.ok(r.errors.includes('OUTPUT_CLEANUP_FAILED')); assert.equal((await audit(r)).structure, 'PASS'); deny(r);
    assert.equal((await outputState()).some(name => name.endsWith('.pilot-lock')), false);
  });
  await test('source mutation between preview and write invalidates entire transaction', async () => {
    const before = await outputState(), o = await newOutput(await reviewed(await fixture()));
    mutateOnStage = async () => { await fs.writeFile(join(input, o.files[0].path), hist()); };
    await reject(o, 'SOURCE_CHECKSUM_MISMATCH'); assert.deepEqual(await outputState(), before);
  });
  await test('existing output never overwritten; parallel writers cannot share a destination', async () => {
    const o = await newOutput(await reviewed(await fixture())); const first = await convertResearchPilot(o); assert.equal(first.status, 'WRITTEN'); await reject(o, 'OUTPUT_EXISTS');
    const second = await newOutput(await reviewed(await fixture())); const pair = await Promise.all([convertResearchPilot(second), convertResearchPilot(second)]);
    assert.equal(pair.filter(r => r.status === 'WRITTEN').length, 1); assert.equal(pair.filter(r => r.status === 'REJECTED').length, 1);
  });
  await test('output inside checkout, traversal/absolute/ADS input paths refused', async () => {
    const o = await newOutput(await reviewed(await fixture())); o.output.root = process.cwd(); await reject(o, 'OUTPUT_INSIDE_PROJECT');
    for (const path of ['../outside.csv', '/absolute.csv', 'C:\\secret.csv', 'a/../b', 'x:stream', 'a//b', 'NUL']) { const q = await fixture(); q.files[0].path = path; await reject(q, 'UNSAFE_PATH'); }
    const q = await newOutput(await reviewed(await fixture())); q.output.name = '../bad'; await reject(q, 'UNSAFE_PATH');
  });
  await test('actual junction/symlink escape refused', async () => {
    const link = join(input, 'escape'); await fs.symlink(output, link, process.platform === 'win32' ? 'junction' : 'dir'); links.push(link);
    const o = await fixture(); o.files[0].path = 'escape/missing.csv'; await reject(o, 'SYMLINK_FORBIDDEN');
  });
  await test('oversized input and CSV line length bounded', async () => {
    const o = await fixture(); await fs.truncate(join(input, o.files[0].path), MAX_PILOT_INPUT_BYTES + 1); await reject(o, 'INPUT_SIZE_LIMIT');
    await reject(await fixture({ text: 'x'.repeat(65538) }), 'INVALID_CSV_LINE_SIZE');
  });
  await test('more than 100000 rows in one source CSV refused, not silently truncated', async () => {
    const text = Array.from({ length: 100001 }, (_, i) => {
      const s = iso(T + i * M - 5 * 3600000), stamp = s.slice(0, 10).replaceAll('-', '') + ' ' + s.slice(11, 19).replaceAll(':', ''); return hist(stamp);
    }).join('\n');
    await reject(await fixture({ text }), 'INPUT_ROW_LIMIT');
  });
  await test('options proxies/getters/pollution and client authority flags cannot execute', async () => {
    const o = await fixture(); let touched = 0; await reject(new Proxy(o, { get() { touched++; throw Error(); } }), 'INVALID_OPTIONS');
    Object.defineProperty(o, 'venue', { get() { touched++; throw Error(); }, enumerable: true }); await reject(o, 'INVALID_OPTIONS'); assert.equal(touched, 0);
    const q = await fixture(); q.runtimeContext = { eligible: true }; await reject(q, 'INVALID_OPTIONS');
    const polluted = JSON.parse('{"__proto__":{"allowed":true}}'); await reject(polluted, 'INVALID_OPTIONS');
  });
  await test('MOCK cannot be relabelled REAL with MOCK evidence; no live/commercial purpose', async () => {
    const o = await reviewed(await fixture()); o.dataKind = 'REAL'; const r = await convertResearchPilot(await newOutput(o)); assert.equal(r.status, 'PREVIEW_ONLY'); assert.ok(r.blockedReasons.includes('MOCK_REAL_MISMATCH'));
    const q = await reviewed(await fixture()); q.license.permittedPurposes = ['LIVE_SIGNAL_ANALYSIS']; await reject(q, 'INVALID_LICENSE');
  });
  await test('bounded 1000-row fragments, deterministic digests, no all-history array', async () => {
    const from = Date.parse('2025-01-07T00:00:00Z'), text = Array.from({ length: 1001 }, (_, i) => binance(from + i * M)).join('\n');
    const o = await reviewed(await fixture({ profile: 'BINANCE_SPOT_KLINE_V1', from, to: from + 1001 * M, text }));
    const a = await convertResearchPilot(await newOutput(o)); assert.equal(a.status, 'WRITTEN', JSON.stringify(a)); assert.equal(a.fragments, 2); assert.equal(a.preview.length, 8);
    const b = await convertResearchPilot(await newOutput(o)); assert.equal(b.status, 'WRITTEN');
    assert.equal(a.output.indexChecksum, b.output.indexChecksum); assert.equal(a.output.lineageChecksum, b.output.lineageChecksum); assert.equal(a.output.conversionChecksum, b.output.conversionChecksum);
    assert.ok(maxRead <= 65536); assert.ok(peak <= 8);
  });
  await test('pipeline results cannot bypass Core/Gateway or direct AI adapters', async () => {
    const preview = await convertResearchPilot(await fixture()), core = await import('../core/index.js');
    const { getGPTAnalysis } = await import('../core/ai/openai.js'), { getGeminiAnalysis } = await import('../core/ai/gemini.js');
    assert.equal((await core.analyze(preview, preview)).signal, 'SKIP'); assert.equal((await core.getJointPrediction(preview, preview)).signal, 'SKIP');
    assert.equal(await getGPTAnalysis(preview, preview), null); assert.equal(await getGeminiAnalysis(preview, preview), null); assert.equal(network, 0);
  });
  console.log(`Research pilot: ${groups} MOCK groups PASS; external IO=${network}; peak descriptors=${peak}; read<=${maxRead}; real imports=0; grants=0`);
} finally {
  fs.open = saved.open; globalThis.fetch = saved.fetch; http.request = saved.hr; http.get = saved.hg; https.request = saved.sr; https.get = saved.sg; net.Socket.prototype.connect = saved.connect; tls.connect = saved.tls; syncBuiltinESMExports();
  for (const path of links) { if (process.platform === 'win32') await fs.rmdir(path); else await fs.unlink(path); }
  // Every deletion is checked against the test-owned absolute root; no recursive shell deletion.
  async function removeOwned(path) {
    const r = relative(base, path); assert.ok(r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('../') && !r.startsWith('..\\')));
    const s = await fs.lstat(path); assert.equal(s.isSymbolicLink(), false);
    if (s.isDirectory()) { for (const name of await fs.readdir(path)) await removeOwned(join(path, name)); await fs.rmdir(path); }
    else await fs.unlink(path);
  }
  if (base) { assert.ok(resolve(base).startsWith(resolve(tmpdir())) && basename(base).startsWith('oracle-pilot-mock-')); await removeOwned(base); }
}
