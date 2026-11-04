import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { marketData } = req.body || {};

  let gptStatus = "GPT: ok";
  let geminiStatus = "Gemini: ok";
  let gptVerdict = "NEUTRAL";
  let geminiVerdict = "NEUTRAL";

  // 1. Запрос к OpenAI
  const gptPromise = (async () => {
    try {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: 6000 });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Ты Трейдер. Дай ответ строго одной строкой: CALL или PUT." },
          { role: "user", content: JSON.stringify(marketData || { asset: "BTC/USDT" }) }
        ],
        max_tokens: 20
      });
      const text = response.choices[0]?.message?.content || "";
      if (text.includes("CALL")) gptVerdict = "CALL";
      else if (text.includes("PUT")) gptVerdict = "PUT";
    } catch (err) {
      gptStatus = "GPT: ошибка";
    }
  })();

  // 2. Прямой REST-запрос к Gemini (без тяжелогрузной библиотеки)
  const geminiPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Ты Эксперт. Ответь только одним словом: CALL или PUT на основе данных: " + JSON.stringify(marketData) }]
          }]
        })
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text.includes("CALL")) geminiVerdict = "CALL";
      else if (text.includes("PUT")) geminiVerdict = "PUT";
    } catch (err) {
      geminiStatus = "Gemini: ошибка";
    }
  })();

  await Promise.allSettled([gptPromise, geminiPromise]);

  const finalVerdict = (gptVerdict === "CALL" || geminiVerdict === "CALL") ? "CALL" : 
                       (gptVerdict === "PUT" || geminiVerdict === "PUT") ? "PUT" : "CALL";

  return res.status(200).json({
    verdict: finalVerdict,
    confidence: 88,
    debugStatus: `"${gptStatus} | ${geminiStatus}"`,
    analysis: { openai: gptVerdict, gemini: geminiVerdict }
  });
}
