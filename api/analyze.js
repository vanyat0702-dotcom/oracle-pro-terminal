export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imageBase64, symbol, activeStrategies, isGlobalScan } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY не установлен на сервере Vercel' });
  }

  // Формируем описание включенных стратегий
  const strategiesList = activeStrategies && activeStrategies.length > 0 
    ? activeStrategies.join(', ') 
    : 'Защищенный пробой тела свечи';

  const systemPrompt = `
Ты — строго институциональный торговый ИИ-сканер высшей точности (ORACLE PRO ENGINE).
Твоя задача — проанализировать график пары ${symbol || 'актива'}.

ВКЛЮЧЕННЫЕ СТРАТЕГИИ И ФИЛЬТРЫ: [ ${strategiesList} ]

ЖЕСТКИЕ ПРАВИЛА И КРИТЕРИИ ОТБОРА (СТРОГО 99-100% ВЕРОЯТНОСТЬ):
1. Сигнал (CALL / PUT) выдается ТОЛЬКО ЕСЛИ ВСЕ включенные стратегии даёт 100% подтверждение и нет противоречий.
2. Если на графике присутствует рыночный шум, боковик/флэт без четкой структуры, длинные тени без пробоя телом или слабый объем — ВЫДАВАЙ СИГНАЛ "WAIT" (Пропуск/Ожидание).
3. Риск ложного входа должен быть сведен к нулю. Лучше пропустить сделку, чем дать неточный сигнал.

ВЕРНИ ОТВЕТ СТРОГО В ФОРМАТЕ JSON (без разметки markdown и без текста вне JSON):
{
  "signal": "CALL" | "PUT" | "WAIT",
  "confidence": число от 0 до 100,
  "timeframe": "1M" | "5M",
  "reason": "Краткое и четкое институциональное обоснование входа или причины пропуска",
  "strategies_matched": ["список совпавших стратегий"]
}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Проанализируй график ${symbol}. Режим сканера: ${isGlobalScan ? 'Глобальный поиск' : 'Одиночный сигнал'}.` },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ],
        temperature: 0.2, // Минимальная температура для исключения галлюцинаций и строгого анализа
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Ошибка OpenAI API' });
    }

    const rawContent = data.choices[0].message.content.trim();
    // Очищаем от возможной markdown-разметки ```json
    const cleanedJson = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsedData = JSON.parse(cleanedJson);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Ошибка обработки бэкенда: ' + error.message });
  }
}
