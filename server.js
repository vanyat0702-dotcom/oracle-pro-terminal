const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getJointPrediction } = require('./ai-consensus-1');
const aiDebugger = require('./ai-debugger'); // 👈 Изолированный модуль диагностики

const app = express();

app.use(cors());
app.use(express.json());

// Единый эндпоинт, к которому стучится фронтенд (App.tsx)
app.post('/api/analyze', async (req, res) => {
  try {
    const marketData = req.body;
    
    // 🔍 Сквозной аудит входящих данных и скриншота через отладчик
    aiDebugger.auditIncomingPayload(marketData);

    // Если пришел запрос на сохранение результата завершенной сделки
    if (marketData.action === 'send_result') {
      console.log(`📊 [РЕЗУЛЬТАТ СДЕЛКИ] #${marketData.tradeId} | ${marketData.pair} | ${marketData.direction} | ${marketData.isWin ? 'WIN' : 'LOSS'} (${marketData.pipsNum} п.)`);
      return res.json({ success: true, message: 'Результат залогирован' });
    }

    // Стандартный запрос на анализ рынка для автопилота
    const prediction = await getJointPrediction(marketData);
    
    res.json({
      success: true,
      result: prediction
    });
  } catch (error) {
    console.error('Ошибка в шлюзе /api/analyze:', error);
    res.status(500).json({ 
      success: false, 
      result: { signal: 'SKIP', confidence: 0, tradeId: Math.floor(Math.random() * 9000) + 1000, reasoning: 'Сбой серверного шлюза', recommendedExpiration: '1M' } 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Бэкенд ORACLE PRO запущен на порту ${PORT}, братан!`);
});
