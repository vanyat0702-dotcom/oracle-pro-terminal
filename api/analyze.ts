import type { VercelRequest, VercelResponse } from '@vercel/node';

// Секреты читаются только из переменных окружения (значения не логируются).
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('TG Send Error:', e);
  }
}

function normalizePair(pair: unknown): string {
  return typeof pair === 'string' && pair.trim().length > 0 ? pair.trim() : 'EUR/USD';
}

function normalizeTimeframe(timeframe: unknown): string {
  const tf = String(timeframe ?? '1').trim();
  const parsed = parseInt(tf, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '1';
}

function candleTimeLabel(timeframe: string): string {
  const tfMins = parseInt(timeframe, 10) || 1;
  const currentEpochSecs = Math.floor(Date.now() / 1000);
  const candleStartEpoch = currentEpochSecs - (currentEpochSecs % (tfMins * 60));
  return new Date(candleStartEpoch * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function makeSkipReason(code: string, category: string, publicMessage: string) {
  return { code, category, publicMessage };
}

function buildSafeSkipResult(params: {
  reasoning: string;
  bestPair: string;
  timeframe: string;
  candleOpenTime: string;
  tradeId?: number;
  skipReason?: { code: string; category: string; publicMessage: string };
}) {
  const expMins = parseInt(params.timeframe, 10) || 1;
  return {
    signal: 'SKIP' as const,
    confidence: 0,
    tradeId: Number.isFinite(params.tradeId) ? (params.tradeId as number) : 0,
    reasoning: params.reasoning,
    recommendedExpiration: `${expMins}M`,
    bestPair: params.bestPair,
    candleOpenTime: params.candleOpenTime,
    skipReason: params.skipReason ?? makeSkipReason(
      'ANALYSIS_SKIPPED',
      'TECHNICAL',
      'Trading analysis was skipped.'
    )
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const body = (req.body || {}) as any;

    // 1. send_result: не формировать фиктивные результаты. Без подтверждённого механизма результата — fail-closed.
    if (body.action === 'send_result') {
      const pair = normalizePair(body?.pair);
      const direction = body?.direction === 'CALL' || body?.direction === 'PUT' ? body.direction : 'UNKNOWN';
      const tradeId = Number.isFinite(Number(body?.tradeId)) ? Number(body.tradeId) : 0;
      const openPrice = Number(body?.openPrice);
      const closePrice = Number(body?.closePrice);
      const hasNumericPrices = Number.isFinite(openPrice) && Number.isFinite(closePrice);

      // Не отправляем WIN/LOSS и не обновляем счётчики сессии без доверенного подтверждённого результата.
      // (P0: исключение синтетических/случайных исходов.)
      const note = hasNumericPrices
        ? `Результат получен, но не зафиксирован как подтверждённый в fail-closed режиме (P0).`
        : `Результат не зафиксирован: отсутствуют валидные цены (P0 fail-closed).`;

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const text = `ℹ️ <b>send_result (fail-closed)</b>\n\n` +
          `🆔 <b>Сделка:</b> #${tradeId}\n` +
          `💱 <b>Актив:</b> ${pair}\n` +
          `🎯 <b>Направление:</b> ${direction}\n` +
          `📌 <b>Статус:</b> ${note}`;
        await sendTelegramMessage(text);
      }

      return res.status(200).json({
        success: false,
        status: 'result_not_recorded_fail_closed',
        message: 'Trade result not recorded: independent confirmation is unavailable.',
        skipReason: makeSkipReason(
          'UNVERIFIED_TRADE_RESULT',
          'DATA_INTEGRITY',
          'Client-reported trade results are not accepted without independent verification.'
        )
      });
    }

    // 2. Торговый анализ: временный fail-closed режим до доверенного MDE и Eligibility Gate.
    // Исключены синтетические рыночные признаки и торговые AI-запросы без подтверждённой достоверности данных.
    const pairs = Array.isArray(body?.pairs) ? body.pairs.filter((p: unknown) => typeof p === 'string' && p.trim().length > 0) : [];
    const bestPair = normalizePair(pairs[0] ?? body?.pair);
    const timeframe = normalizeTimeframe(body?.timeframe);
    const candleOpenTime = typeof body?.candleOpenTime === 'string' && body.candleOpenTime.trim()
      ? body.candleOpenTime
      : candleTimeLabel(timeframe);

    return res.status(200).json({
      success: true,
      result: buildSafeSkipResult({
        reasoning: 'Торговый анализ временно недоступен (fail-closed): отсутствуют подтверждённые рыночные данные/MDE и Eligibility Gate. Сигнал пропущен.',
        bestPair,
        timeframe,
        candleOpenTime,
        tradeId: 0,
        skipReason: makeSkipReason(
          'MARKET_DATA_UNAVAILABLE',
          'MARKET_DATA',
          'Verified market data and eligibility confirmation are unavailable.'
        )
      })
    });

  } catch (err) {
    const fallbackTimeframe = '1';
    return res.status(200).json({
      success: true,
      result: buildSafeSkipResult({
        reasoning: 'Внутренняя ошибка анализа. Сигнал пропущен (fail-closed).',
        bestPair: 'EUR/USD',
        timeframe: fallbackTimeframe,
        candleOpenTime: candleTimeLabel(fallbackTimeframe),
        tradeId: 0,
        skipReason: makeSkipReason(
          'INTERNAL_ERROR',
          'TECHNICAL',
          'A technical error occurred while processing the request.'
        )
      })
    });
  }
}
