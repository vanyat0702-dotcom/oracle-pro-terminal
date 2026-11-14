// ai-debugger.js — Система сквозной диагностики передачи данных и скриншотов

function auditIncomingPayload(reqBody) {
  const hasScreenshot = Boolean(reqBody.screenshot);
  const screenshotLength = hasScreenshot ? reqBody.screenshot.length : 0;
  const screenshotKb = Math.round(screenshotLength / 1024);

  const auditLog = {
    timestamp: new Date().toISOString(),
    pairsCount: reqBody.pairs?.length || 0,
    timeframe: reqBody.timeframe || '1',
    safeMode: Boolean(reqBody.safeModeEnabled),
    screenshotStatus: hasScreenshot ? `🟢 ПЕРЕДАН (${screenshotKb} KB)` : `🔴 ОТСУТСТВУЕТ (Пустой кадр)`
  };

  console.log(`🔍 [AI-DEBUGGER TRACE]:`, auditLog);
  return auditLog;
}

function auditModelResponse(modelName, rawResponse) {
  const success = Boolean(rawResponse && rawResponse.direction);
  console.log(`🤖 [MODEL AUDIT -> ${modelName}]: Статус: ${success ? 'УСПЕХ' : 'ОШИБКА/ПУСТО'}, Вердикт: ${rawResponse?.direction || 'N/A'}`);
  return success;
}

module.exports = { auditIncomingPayload, auditModelResponse };
