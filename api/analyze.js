import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Разрешаем CORS-запросы
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on Vercel' });
  }

  try {
    const { pair, timeframe, activeStrategies, marketData } = req.body;

    // Формируем строгую системную инструкцию ИИ-аналитика
    const systemPrompt = `Ты — главный ИИ-аналитик торгового терминала ORACLE PRO.
Твоя задача: провести глубокий анализ финансовой пары ${pair} на таймфрейме ${timeframe}.
Входные данные активных стратегий: ${JSON.stringify(activeStrategies)}.

Правила строгого подтверждения сигнала:
1. Проанализируй паттерны: Trend Master, Price Action, Body Breakout, RSI + Bollinger, VSA Volume.
2. Проверь риски (рыночный шум, скачки волатильности).
3. Выдай строго JSON-ответ без лишнего текста и без markdown блоков в формате:
{
  "signal": "CALL" | "PUT" | "SKIP",
  "confidence": число от 60 до 98,
  "reasoning": "Краткое обоснование в 1-2 предложениях на русском языке",
  "recommendedExpiration": "1M" | "3M" | "5M",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Запрос на аудит пары ${pair}. Сформируй точный сигнал.` }
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API Error');
    }

    const content = data.choices[0]?.message?.content;
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    return res.status(200).json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
