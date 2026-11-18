import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { validateSendResultRequest } from '../core/validate.js';
import { ValidationError, isOracleError } from '../core/errors.js';
import * as aiDebugger from '../core/observability/audit.js'; // аудит: зона наблюдаемости ядра
import { registerMarketDataTestRoute } from './marketData.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
registerMarketDataTestRoute(app);

function makeSkipReason(code, category, publicMessage) {
  return { code, category, publicMessage };
}

function buildSkipResult(reasoning, skipReason, recommendedExpiration = '1M', bestPair = 'EUR/USD') {
  const result = {
    signal: 'SKIP',
    confidence: 0,
    tradeId: 0,
    reasoning,
    recommendedExpiration,
    bestPair,
    skipReason
  };
  return result;
}

// HTTP metadata only: client prices, candles and trust flags never enable analysis.
function skipMetadata(body) {
  const pairs = Array.isArray(body?.pairs)
    ? body.pairs.filter(p => typeof p === 'string' && p.trim()) : [];
  const pair = pairs[0] ?? body?.pair;
  const bestPair = typeof pair === 'string' && pair.trim() ? pair.trim() : 'EUR/USD';
  const parsed = parseInt(String(body?.timeframe ?? '1').trim(), 10);
  const timeframe = Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '1';
  const epoch = Math.floor(Date.now() / 1000);
  const candleOpenTime = typeof body?.candleOpenTime === 'string' && body.candleOpenTime.trim()
    ? body.candleOpenTime
    : new Date((epoch - epoch % (Number(timeframe) * 60)) * 1000)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { bestPair, timeframe, candleOpenTime };
}

// Проверка работоспособности сервера.
// Возвращает только статус, имя сервиса и признак доступности backend —
// без секретов, переменных окружения и внутренних ошибок.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'oracle-pro-terminal-api',
    backend: 'available'
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const marketData = req.body;

    // Безопасный аудит: модуль наблюдаемости может логировать технические поля,
    // но публичные ответы не должны раскрывать секреты/внутренние детали.
    try {
      aiDebugger.auditIncomingPayload(marketData && typeof marketData === 'object' ? marketData : {});
    } catch (_) {
      // Ошибка аудита не должна влиять на fail-closed обработку запроса.
    }

    if (marketData && typeof marketData === 'object' && marketData.action === 'send_result') {
      // Строгая серверная валидация структуры запроса. Результат сделки от клиента
      // не считается доверенным без независимого подтверждения (нет доверенного источника),
      // поэтому запись/фиксация WIN-LOSS и цен отклоняется (fail-closed).
      try {
        validateSendResultRequest(marketData);
      } catch (error) {
        const publicMessage = error instanceof ValidationError
          ? 'Trade result request is invalid and was not recorded.'
          : 'Trade result request could not be verified and was not recorded.';
        return res.status(200).json({
          success: false,
          status: 'result_not_recorded_fail_closed',
          message: 'Trade result not recorded: request validation failed or result is not independently verifiable.',
          skipReason: makeSkipReason(
            error instanceof ValidationError ? 'INVALID_RESULT_REQUEST' : 'UNVERIFIED_TRADE_RESULT',
            'DATA_INTEGRITY',
            publicMessage
          )
        });
      }

      console.log('[send_result] Request rejected: client-reported trade result is not independently verifiable; no WIN/LOSS/prices recorded.');
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

    // 3.6.8-B Increment A: no trading AI via HTTP until trusted MDE/Eligibility Gate exists.
    const { bestPair, timeframe, candleOpenTime } = skipMetadata(marketData);
    return res.status(200).json({
      success: true,
      result: {
        ...buildSkipResult(
          'Торговый анализ временно недоступен (fail-closed): отсутствуют подтверждённые рыночные данные/MDE и Eligibility Gate. Сигнал пропущен.',
          makeSkipReason('MARKET_DATA_UNAVAILABLE', 'MARKET_DATA',
            'Verified market data and eligibility confirmation are unavailable.'),
          `${timeframe}M`, bestPair
        ),
        candleOpenTime
      }
    });
  } catch (error) {
    // Публичный ответ не должен раскрывать секреты/внутренние детали.
    console.error('Ошибка в шлюзе /api/analyze: request processing failed');

    if (error instanceof ValidationError) {
      return res.status(200).json({
        success: true,
        result: buildSkipResult(
          'Запрос анализа отклонён: структура/параметры недействительны. Сигнал пропущен (fail-closed).',
          makeSkipReason(
            'INVALID_ANALYSIS_REQUEST',
            'DATA_INTEGRITY',
            'Analysis request is invalid or missing required verified data.'
          )
        )
      });
    }

    if (isOracleError && isOracleError(error)) {
      return res.status(200).json({
        success: true,
        result: buildSkipResult(
          'Анализ недоступен из-за технической ошибки. Сигнал пропущен (fail-closed).',
          makeSkipReason(
            'ANALYSIS_UNAVAILABLE',
            'TECHNICAL',
            'Analysis could not be completed safely.'
          )
        )
      });
    }

    return res.status(200).json({
      success: true,
      result: buildSkipResult(
        'Внутренняя ошибка сервера. Сигнал пропущен (fail-closed).',
        makeSkipReason(
          'INTERNAL_ERROR',
          'TECHNICAL',
          'A technical error occurred while processing the request.'
        )
      )
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Бэкенд ORACLE PRO запущен на порту ${PORT}, братан!`);
});
