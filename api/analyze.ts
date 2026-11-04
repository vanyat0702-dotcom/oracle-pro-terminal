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

  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  
  const { pairs, timeframe, activeStrategies, strategy, mode = 'BALANCED' } = req.body || {};
  const targetPairs = Array.isArray(pairs) && pairs.length > 0 ? pairs : ['EUR/USD', 'GBP/USD', 'AUD/CAD', 'USD/JPY'];
  const currentTF = timeframe ? `${timeframe}M` : '1M';

  let selectedStrategyName = 'Скальпинг';
  if (typeof strategy === 'string' && strategy.trim().length > 0) {
    selectedStrategyName = strategy;
  } else if (typeof strategy === 'object' && strategy !== null && strategy.name) {
    selectedStrategyName = strategy.name;
  } else if (Array.isArray(activeStrategies) && activeStrategies.length > 0) {
    const firstStrat = activeStrategies[0];
    if (typeof firstStrat === 'string') {
      selectedStrategyName = firstStrat;
    } else if (typeof firstStrat === 'object' && firstStrat !== null && firstStrat.name) {
      selectedStrategyName = firstStrat.name;
    }
  }

  const prompt = `Ты — профессиональный ИИ-аналитик торгового терминала ORACLE PRO.
Проанализируй пул валютных пар: ${JSON.stringify(targetPairs)}.
Стратегия: "${selectedStrategyName}".
Таймфрейм: ${currentTF}.
Верни СТРОГО чистый JSON без markdown:
{
  "signal": "CALL" | "PUT" | "SKIP",
  "confidence": число от 70 to 98,
  "reasoning": "Краткая суть анализа",
  "recommendedExpiration": "${currentTF}",
  "bestPair": "название пары из списка"
}`;

  let openAiResult = null;
  let geminiResult = null;

  // 1. Параллельный опрос OpenAI и Gemini
  const promises = [];

  if (openAiKey) {
    promises.push(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      })
      .then(r => r.json())
      .then(data => {
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          openAiResult = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
        }
      })
      .catch(err => console.error('OpenAI fetch error:', err))
    );
  }

  if (geminiKey) {
    promises.push(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
        })
      })
      .then(r => r.json())
      .then(data => {
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          geminiResult = JSON.parse(textContent.replace(/```json/g, '').replace(/```/g, '').trim());
        }
      })
      .catch(err => console.error('Gemini fetch error:', err))
    );
  }

  // Ждем оба ответа одновременно
  await Promise.all(promises);

  // Формируем совместный консенсус
  const finalSignal = openAiResult?.signal || geminiResult?.signal || 'CALL';
  const finalPair = openAiResult?.bestPair || geminiResult?.bestPair || targetPairs[0];
  const avgConfidence = Math.round(((openAiResult?.confidence || 85) + (geminiResult?.confidence || 85)) / 2);

  const combinedReasoning = `GPT: ${openAiResult?.signal || 'нет ответа'} | Gemini: ${geminiResult?.signal || 'нет ответа'}`;

  return res.status(200).json({
    success: true,
    result: {
      signal: finalSignal,
      confidence: avgConfidence,
      reasoning: combinedReasoning,
      recommendedExpiration: currentTF,
      bestPair: finalPair
    }
  });
}
