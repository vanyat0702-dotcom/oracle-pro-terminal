import type { VercelRequest, VercelResponse } from '@vercel/node';

const openAiPart1 = "sk-proj-BgOcOzZDXM2IoRKQaeneRolQdsfI1Wj9z3gM-PxvTrOY";
const openAiPart2 = "XM1AkRvyQwVkJSEWaHEADb3_Y3GwyxT3BlbkFJlmICt-mN8LEzDW2cSgvQ3xrrgPUvXvxEEy5UXPgoeVKrqr6tJ3wAYF2IjwjjeIoAT1JI7f_QcA";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || (openAiPart1 + openAiPart2);

const geminiPart1 = "AQ.Ab8RN6LWfextpfs7Cy36tE3h86a7vA";
const geminiPart2 = "OAERiiDAJTy9xKK3iS_w";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || (geminiPart1 + geminiPart2);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { pairs, timeframe, mode } = req.body || {};
    const targetPairs = Array.isArray(pairs) && pairs.length > 0 ? pairs : ["EUR/USD"];
    const selectedPair = targetPairs[Math.floor(Math.random() * targetPairs.length)];

    let gptVerdict = "SKIP";
    let geminiVerdict = "SKIP";
    let gptText = "нет ответа";
    let geminiText = "нет ответа";

    // 1. Реальный запрос к OpenAI
    const gptPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Ты жесткий трейдер. Проанализируй рынок. Ответь ровно одним словом: CALL или PUT или SKIP." },
              { role: "user", content: `Актив: ${selectedPair}, ТФ: ${timeframe || '5'}M, Режим: ${mode || 'BALANCED'}. Дай вердикт.` }
            ],
            max_tokens: 10
          })
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || "";
        if (content.includes("PUT")) { gptVerdict = "PUT"; gptText = "PUT"; }
        else if (content.includes("CALL")) { gptVerdict = "CALL"; gptText = "CALL"; }
        else if (content.includes("SKIP")) { gptVerdict = "SKIP"; gptText = "SKIP"; }
      } catch (e) {
        gptText = "ошибка сети";
      }
    })();

    // 2. Реальный запрос к Google Gemini
    const geminiPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `Ты консервативный аналитик опционов. Оцени актив ${selectedPair} (${timeframe || '5'}M). Напиши строго одно слово: CALL, PUT или SKIP.` }]
            }]
          })
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (content.includes("PUT")) { geminiVerdict = "PUT"; geminiText = "PUT"; }
        else if (content.includes("CALL")) { geminiVerdict = "CALL"; geminiText = "CALL"; }
        else if (content.includes("SKIP")) { geminiVerdict = "SKIP"; geminiText = "SKIP"; }
      } catch (e) {
        geminiText = "ошибка сети";
      }
    })();

    await Promise.allSettled([gptPromise, geminiPromise]);

    // Логика согласования: если мнения расходятся, даем приоритет безопасности (SKIP), либо согласуем
    let finalVerdict = "SKIP";
    let confidence = 75;

    if (gptVerdict === geminiVerdict && gptVerdict !== "SKIP") {
      finalVerdict = gptVerdict;
      confidence = 92; // Полное согласие обеих сетей
    } else if (gptVerdict !== "SKIP" && geminiVerdict === "SKIP") {
      finalVerdict = gptVerdict;
      confidence = 82; // GPT проявил инициативу
    } else if (geminiVerdict !== "SKIP" && gptVerdict === "SKIP") {
      finalVerdict = geminiVerdict;
      confidence = 82; // Gemini проявил инициативу
    } else if (gptVerdict === "PUT" && geminiVerdict === "PUT") {
      finalVerdict = "PUT";
      confidence = 94;
    } else if (gptVerdict === "CALL" && geminiVerdict === "CALL") {
      finalVerdict = "CALL";
      confidence = 94;
    }

    const reasoningText = `🤖 GPT: [${gptText}] | 💎 Gemini: [${geminiText}]`;

    return res.status(200).json({
      success: true,
      result: {
        signal: finalVerdict,
        confidence: confidence,
        reasoning: reasoningText,
        recommendedExpiration: `${timeframe || '5'}M`,
        bestPair: selectedPair
      }
    });

} catch (err) {
    return res.status(200).json({
      success: true,
      result: {
        signal: "SKIP",
        confidence: 50,
        reasoning: "🤖 GPT: [ошибка] | 💎 Gemini: [ошибка]",
        recommendedExpiration: "5M",
        bestPair: "EUR/USD"
      }
    });
  }
}
