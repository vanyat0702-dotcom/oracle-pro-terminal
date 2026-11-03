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
    const { pair, timeframe, activeStrategies, filters, mode = 'BALANCED' } = req.body;

    const systemPrompt = `Ты — главный ИИ-скальпер и аналитик терминала ORACLE PRO.
Твоя задача: провести аудит пары ${pair} (или пула пар) на таймфрейме ${timeframe}M.
Текущий режим риска: ${mode} (SAFE = редкие идеальные входы, BALANCED = баланс 3-5 мин, AGGRESSIVE = частый импульсный скальпинг).
Активные стратегии: ${JSON.stringify(activeStrategies)}.
Защитные фильтры: ${JSON.stringify(filters)}.

Правила принятия решений:
1. Если режим AGGRESSIVE или включен Импульсный Скальпинг — ищи микро-пробои уровней и всплески объема. Экспирация для скальпинга — СТРОГО 1M.
2. В режиме BALANCED пропускай свечу (SKIP) только при явном флэте или перед важнейшими новостями. Если 3+ стратегии "ЗА", давай сигнал.
3. В режиме SAFE требуй 85%+ уверенности и совпадения минимум 4 стратегий.

Верни СТРОГО JSON-объект без markdown разметки:
{
  "signal": "CALL" | "PUT" | "SKIP",
  "confidence": число от 65 до 98,
  "reasoning": "Краткая причина (до 15 слов) на русском",
  "recommendedExpiration": "1M" | "3M" | "5M",
  "bestPair": "${pair}"
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
          { role: 'user', content: `Сканируй пару ${pair}. Режим: ${mode}. Сформируй сигнал.` }
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
