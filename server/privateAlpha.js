// Standalone ALPHA-0 server; never imported by production Express or Vercel.
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBinanceObservationProvider, BinanceObservationError } from '../core/market/binance.js';
export const OBSERVATION_PATH = '/api/observation/btcusdt/m1';
const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const local = a => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(a);
export function createObservationHandler({ provider = createBinanceObservationProvider(), env = process.env,
  monotonicNow = () => performance.now() } = {}) {
  let last = null, busy = false;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json'); res.setHeader('Vary', 'Origin');
    const send = (code, reason) => { res.statusCode = code; res.end(JSON.stringify(reason)); };
    const error = (code, reason) => send(code, { success: false, diagnosticOnly: true, readiness: 'NOT_READY', grantsRuntimeAccess: false, error: { code: reason } });
    if (env.ORACLE_ALPHA_OBSERVE !== '1' || env.NODE_ENV !== 'development') return error(404, 'OBSERVATION_DISABLED');
    if (!local(req.socket.remoteAddress) || req.headers.host !== '127.0.0.1:3001' ||
      !origins.has(req.headers.origin)) return error(403, 'LOCAL_ORIGIN_REQUIRED');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    if (req.url !== OBSERVATION_PATH) return error(404, 'UNSUPPORTED_REQUEST');
    if (req.method === 'OPTIONS') {
      if (req.headers['access-control-request-method'] !== 'GET' || req.headers['access-control-request-headers']) return error(403, 'UNSUPPORTED_PREFLIGHT');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.statusCode = 204; res.end(); return;
    }
    if (req.method !== 'GET') return error(405, 'GET_ONLY');
    const now = monotonicNow();
    if (!Number.isFinite(now) || now < 0 || (last !== null && now < last)) return error(503, 'INVALID_CLOCK');
    if (busy || (last !== null && now - last < 10000)) { res.setHeader('Retry-After', '10'); return error(429, 'RATE_LIMITED'); }
    last = now; busy = true;
    try { const snapshot = await provider.latest(); send(200, { success: true, diagnosticOnly: true, snapshot }); }
    catch (e) { error(503, e instanceof BinanceObservationError ? e.code : 'SOURCE_UNAVAILABLE'); }
    finally { busy = false; }
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV !== 'development' || process.env.ORACLE_ALPHA_OBSERVE !== '1') {
    console.error('Local observation requires NODE_ENV=development and ORACLE_ALPHA_OBSERVE=1.'); process.exitCode = 1;
  } else {
    createServer(createObservationHandler()).listen(3001, '127.0.0.1', () => console.log('ALPHA-0 observation: 127.0.0.1:3001 (NOT_READY)'));
  }
}
