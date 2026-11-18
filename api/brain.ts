import type { VercelRequest, VercelResponse } from '@vercel/node';

// Секрет читается только из переменной окружения. Значение по умолчанию отсутствует.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Проверка обязательных переменных окружения.
// Логируются только ИМЕНА отсутствующих переменных, их значения не выводятся.
function getMissingEnvVars(): string[] {
  const missing: string[] = [];
  if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  return missing;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const missingEnv = getMissingEnvVars();
    if (missingEnv.length > 0) {
      console.error(`[brain] Отсутствуют обязательные переменные окружения: ${missingEnv.join(', ')}`);
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const body = (req.body || {}) as any;
    const action = body.action;
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    // Brain API: неторговой мониторинг. Изолирован от торгового анализа.
    // Запрещено использовать для формирования или обходного получения CALL/PUT.
    if (action !== 'monitor_state') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported action',
        nonTrading: true,
        message: 'Brain API supports only non-trading monitor_state requests.'
      });
    }

    const currentPair = typeof payload.currentPair === 'string' ? payload.currentPair : 'N/A';
    const candleTimer = Number.isFinite(Number(payload.candleTimer)) ? Number(payload.candleTimer) : 'N/A';
    const activeTradesCount = Number.isFinite(Number(payload.activeTradesCount)) ? Number(payload.activeTradesCount) : 'N/A';
    const lastSignal = payload.lastSignal && typeof payload.lastSignal === 'object' ? payload.lastSignal : payload.lastSignal ?? null;
    const screenshotBase64 = typeof payload.screenshotBase64 === 'string' ? payload.screenshotBase64 : '';

    const messagesContent: any[] = [
      {
        type: 'text',
        text: `Ты — монитор состояния торгового терминала Oracle Pro (ТОЛЬКО неторговой режим).
Текущее состояние системы:
- Активная пара: ${currentPair}
- Время до конца свечи: ${candleTimer}с
- Активных сделок: ${activeTradesCount}
- Последний известный статус (справочно): ${JSON.stringify(lastSignal)}

Дай краткий системный статус (1-2 предложения) на русском языке.
Строго запрещено: выдавать торговые сигналы или рекомендации (CALL/PUT), предлагать вход/выход из сделки, обходить торговый анализ, Safe Mode или фильтры.`
      }
    ];

    // Допустимая неторговая функция: визуальный мониторинг (если передан скриншот).
    if (screenshotBase64) {
      messagesContent.push({
        type: 'image_url',
        image_url: {
          url: screenshotBase64
        }
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: messagesContent }],
        max_tokens: 150,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        nonTrading: true,
        brainStatus: 'Сервис мониторинга временно недоступен.',
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    const brainStatusRaw = data?.choices?.[0]?.message?.content;
    const brainStatus = typeof brainStatusRaw === 'string' && brainStatusRaw.trim()
      ? brainStatusRaw.trim()
      : 'Система мониторинга активна.';

    return res.status(200).json({
      success: true,
      nonTrading: true,
      brainStatus,
      timestamp: new Date().toISOString()
    });

  } catch (_err) {
    // Публичный ответ не должен раскрывать внутренние детали/секреты.
    console.error('Brain API Error: request failed');
    return res.status(500).json({ success: false, nonTrading: true, error: 'Monitor failed' });
  }
}
