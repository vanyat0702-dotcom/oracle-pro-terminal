async function fetchAiConsensus(pairData) {
  const response = await fetch('/api/get-signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pairData)
  });
  
  const result = await response.json();
  
  // Обновляем плашки на экране
  const statusEl = document.getElementById('ai-consensus-status');
  
  if (result.status === 'CONFIRMED') {
    statusEl.style.backgroundColor = '#22c55e'; // Зеленый
    statusEl.innerText = `🚀 ${result.recommendation}`;
  } else {
    statusEl.style.backgroundColor = '#ef4444'; // Красный / Желтый (Анти-Тильт)
    statusEl.innerText = `🛡️ ${result.recommendation}`;
  }
}
