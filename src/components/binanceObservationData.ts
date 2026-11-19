import type { BinanceObservation } from '../../core/market/binance.js';
export const OBSERVATION_URL = 'http://127.0.0.1:3001/api/observation/btcusdt/m1';
export function readBinanceObservation(data: any, nowMs = Date.now()): BinanceObservation {
  const s = data?.snapshot, bad = () => { throw new Error('Некорректные, неполные или устаревшие Binance M1. Свечи скрыты.'); };
  if (!Number.isSafeInteger(nowMs) || data?.success !== true || data?.diagnosticOnly !== true ||
    s?.diagnosticOnly !== true || s?.readiness !== 'NOT_READY' || s?.grantsRuntimeAccess !== false ||
    s?.pair !== 'BTC/USDT' || s?.timeframe !== '1' || s?.source?.provider !== 'Binance' ||
    s?.source?.sourceId !== 'BINANCE_SPOT' || s?.source?.symbol !== 'BTCUSDT' || s?.source?.market !== 'SPOT' || s?.source?.priceBasis !== 'last' ||
    !['STRUCTURE_VALID', 'PUBLICATION_DELAY'].includes(s?.quality?.status) || s.quality.tradingEligible !== false ||
    s.quality.gaps !== 0 || s.quality.duplicates !== 0 || s.quality.publicationGraceMs !== 5000 ||
    s.quality.clockEvidence !== 'LOCAL_SERVER_ONLY' || s.quality.quoteFreshness !== 'UNKNOWN' ||
    s?.timing?.providerQuoteUpdatedAtMs !== null || !Array.isArray(s?.candles) || s.candles.length < 2 || s.candles.length > 100) bad();
  const { checkedAtMs, receivedAtMs } = s.timing;
  if (![checkedAtMs, receivedAtMs].every(v => Number.isSafeInteger(v) && v > 0) || receivedAtMs > checkedAtMs ||
    checkedAtMs > nowMs + 2000 || nowMs - checkedAtMs > 20000) bad();
  for (let i = 0; i < s.candles.length; i++) {
    const c = s.candles[i];
    if (!c || !Number.isSafeInteger(c.openTimeMs) || c.openTimeMs <= 0 || c.openTimeMs % 60000 ||
      c.time !== c.openTimeMs / 1000 || c.closeTimeMs !== c.openTimeMs + 59999 || c.isOpen !== false ||
      c.openTimeMs + 60000 > checkedAtMs || c.openTimeMs + 60000 > nowMs + 2000 ||
      !['open', 'high', 'low', 'close'].every(k => Number.isFinite(c[k]) && c[k] > 0) ||
      !Number.isFinite(c.volume) || c.volume < 0 || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close) || c.low > c.high ||
      (i && c.openTimeMs - s.candles[i - 1].openTimeMs !== 60000)) bad();
  }
  const minute = Math.floor(nowMs / 60000) * 60000, last = s.candles.at(-1).openTimeMs;
  const delayed = last === minute - 120000 && nowMs - minute <= 5000;
  if (last !== minute - 60000 && !delayed) bad();
  return { ...s, quality: { ...s.quality, status: delayed ? 'PUBLICATION_DELAY' : 'STRUCTURE_VALID' } };
}

// Serial bounded polling. Error stops the session; the component offers an explicit restart.
export function startBinancePolling({ onData, onError, fetchImpl = fetch, now = Date.now,
  intervalMs = 15000, timeoutMs = 8000, schedule = setTimeout, cancel = clearTimeout }: {
  onData: (s: BinanceObservation) => void; onError: (s: string) => void;
  fetchImpl?: typeof fetch; now?: () => number; intervalMs?: number; timeoutMs?: number;
  schedule?: typeof setTimeout; cancel?: typeof clearTimeout;
}): () => void {
  if (!Number.isFinite(intervalMs) || intervalMs < 1 || !Number.isFinite(timeoutMs) || timeoutMs < 1) throw Error('Invalid polling intervals');
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
  async function poll() {
    if (stopped) return;
    const current = new AbortController(); controller = current;
    let onAbort: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => { onAbort = () => reject(Error('Запрос Binance отменён.')); current.signal.addEventListener('abort', onAbort, { once: true }); });
    const timeout = new Promise<never>((_, reject) => { deadline = schedule(() => { reject(Error('Таймаут Binance. Свечи скрыты.')); current.abort(); }, timeoutMs); });
    try {
      const request = async () => {
        const response = await fetchImpl(OBSERVATION_URL, { signal: current.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          // Never echo arbitrary upstream text; the fixed local error code is diagnostic only.
          const code = body?.error?.code;
          throw Error(`Binance observation HTTP ${response.status}${typeof code === 'string' && /^[A-Z_]{1,64}$/.test(code) ? ': ' + code : ''}. Свечи скрыты.`);
        }
        return readBinanceObservation(await response.json(), now());
      };
      const data = await Promise.race([request(), timeout, aborted]);
      if (!stopped) { onData(data); timer = schedule(() => { void poll(); }, intervalMs); }
    } catch (e) {
      if (!stopped) { stopped = true; onError(e instanceof Error ? e.message : 'Ошибка Binance observation. Свечи скрыты.'); }
    } finally { cancel(deadline); current.signal.removeEventListener('abort', onAbort); current.abort(); }
  }
  void poll();
  return () => { stopped = true; cancel(timer); cancel(deadline); controller?.abort(); };
}
