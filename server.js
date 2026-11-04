const express = require('express');
const { getJointPrediction } = require('./ai-consensus');
const app = express();

app.use(express.json());

app.post('/api/get-signal', async (req, res) => {
  const marketData = req.body; // Сюда передаем текущие свечи, пару, таймфрейм
  
  if (!marketData || !marketData.pair) {
    return res.status(400).json({ error: "Нет данных о валютной паре" });
  }

  // Получаем совместный вердикт от нас с ChatGPT
  const prediction = await getJointPrediction(marketData);
  
  res.json(prediction);
});

app.listen(3000, () => {
  console.log('Бэкенд мини-приложения запущен на порту 3000, братан!');
});
