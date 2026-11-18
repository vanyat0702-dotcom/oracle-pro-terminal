// Browser-only diagnostic adapter. No trading imports or direct provider access.
export const MDE_CHART_ENDPOINT = '/api/test/market-data/eurusd/m1';
export interface ChartCandle { time: number; open: number; high: number; low: number; close: number; isOpen: boolean }
export interface ChartSnapshot {
  candles: ChartCandle[];
  source: { provider: 'Biquote' };
  quality: { status: 'VALID'; checkedAt: string; tradingEligible: false };
}
export function localChartAllowed(dev: boolean, hostname: string): boolean {
  return dev && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}
export function readChartSnapshot(data: any, nowMs = Date.now()): ChartSnapshot {
  const s = data?.snapshot;
  const reject = () => { throw new Error('Некорректные или устаревшие данные MDE. Свечи скрыты.'); };
  if (data?.success !== true || data?.diagnosticOnly !== true || s?.pair !== 'EUR/USD' || s?.timeframe !== '1' ||
    s?.source?.provider !== 'Biquote' || s?.quality?.status !== 'VALID' || s?.quality?.tradingEligible !== false ||
    !Array.isArray(s?.candles) || s.candles.length < 2 || s.candles.length > 1000) reject();
  const checkedAt = Date.parse(s.quality.checkedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > nowMs + 5000 || nowMs - checkedAt > 120000) reject();
  const minute = Math.floor(checkedAt / 60000) * 60;
  for (let i = 0; i < s.candles.length; i++) {
    const c = s.candles[i];
    if (!c || !Number.isSafeInteger(c.time) || c.time <= 0 || c.time % 60 !== 0 || c.time > nowMs / 1000 ||
      !['open', 'high', 'low', 'close'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k]) && c[k] > 0) ||
      c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close) || c.low > c.high ||
      typeof c.isOpen !== 'boolean' || c.isOpen !== (c.time === minute) ||
      (i > 0 && c.time - s.candles[i - 1].time !== 60)) reject();
  }
  if (nowMs / 1000 - s.candles.at(-1).time > 120) reject();
  return s;
}

// Serial polling: failure stops the session; cleanup aborts pending work and cancels timers.
export function startChartPolling({ onData, onError, onLoading, fetchImpl = fetch,
  intervalMs = 15000, timeoutMs = 8000 }: {
  onData: (s: ChartSnapshot) => void; onError: (message: string) => void;
  onLoading: (loading: boolean) => void; fetchImpl?: typeof fetch; intervalMs?: number; timeoutMs?: number;
}): () => void {
  let stopped = false;
  let next: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  async function poll() {
    controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => controller?.abort(), timeoutMs);
    onLoading(true);
    try {
      const res = await fetchImpl(MDE_CHART_ENDPOINT, { signal, cache: 'no-store', credentials: 'omit' });
      if (!res.ok) throw new Error(res.status === 404
        ? 'Тестовый endpoint выключен. Запустите локальный API с ORACLE_MDE_TEST=1.'
        : `Источник MDE недоступен (HTTP ${res.status}). Свечи скрыты.`);
      const s = readChartSnapshot(await res.json());
      if (!stopped) {
        onData(s);
        next = setTimeout(poll, intervalMs);
      }
    } catch (error) {
      if (!stopped) onError(signal.aborted ? 'Таймаут MDE. Свечи скрыты.'
        : error instanceof Error ? error.message : 'Ошибка сети MDE. Свечи скрыты.');
    } finally {
      clearTimeout(timeout);
      if (!stopped) onLoading(false);
    }
  }
  void poll();
  return () => { stopped = true; clearTimeout(next); controller?.abort(); };
}
