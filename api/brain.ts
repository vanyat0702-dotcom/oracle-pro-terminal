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

    const { action, payload } = req.body || {};

    if (action === 'monitor_state') {
      const { currentPair, candleTimer, activeTradesCount, lastSignal, screenshotBase64 } = payload;

      let messagesContent: any[] = [
        {
          type: "text",
          text: `Ты — автономный ИИ-мозг торгового терминала Oracle Pro. 
Текущее состояние системы:
- Активная пара: ${currentPair}
- Время до конца свечи: ${candleTimer}с
- Активных сделок: ${activeTradesCount}
- Последний вердикт: ${JSON.stringify(lastSignal)}

Дай краткий системный статусный вердикт по рынку (1-2 предложения) и оцени риски.`
        }
      ];

      // Если прилетел скриншот графика, добавляем его для мультимодального анализа Vision API
      if (screenshotBase64) {
        messagesContent.push({
          type: "image_url",
          image_url: {
            url: screenshotBase64
          }
        });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: messagesContent }],
          max_tokens: 150,
          temperature: 0.2
        })
      });

      const data = await response.json();
      const brainStatus = data?.choices?.[0]?.message?.content || "Система мониторинга активна.";

      return res.status(200).json({
        success: true,
        brainStatus,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });

  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
