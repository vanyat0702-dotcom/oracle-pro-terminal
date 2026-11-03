import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { pairs, timeframe, activeStrategies, filters, mode = 'BALANCED' } = req.body;

    // Если передан массив пар, берем их, иначе запасной вариант
    const targetPairs = Array.isArray(pairs) ? pairs : [req.body.pair || 'EUR/USD'];

    const systemPrompt = `Ты — ультрабыстрый ИИ-скальпер терминала ORACLE PRO.
Твоя задача: провести мгновенный параллельный аудит списка пар: ${JSON.stringify(targetPairs)} на таймфрейме ${timeframe}M.
Режим риска: ${mode}. Активные стратегии: ${JSON.stringify(activeStrategies)}.

Выбери НАИЛУЧШУЮ пару из списка, которая дает четкий сигнал без сильного флэта. Если абсолютно все пары во флэте, верни сигнал SKIP.
Верни СТРОГО JSON-объект без markdown разметки:
{
  "signal": "CALL" | "PUT" | "SKIP",
  "confidence": число от 65 to 98,
  "reasoning": "Краткая причина (до 12 слов) на русском",
  "recommendedExpiration": "1M" | "3M" | "5M",
  "bestPair": "название выбранной пары из списка"
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
          { role: 'user', content: `Просканируй этот пул пар мгновенно и дай лучший сигнал.` }
        ],
        temperature: mode === 'AGGRESSIVE' ? 0.4 : 0.2,
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
