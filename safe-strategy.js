// safe-strategy.js — ВРЕМЕННЫЙ compatibility shim (этап 3.6.2).
//
// Торговая/Safe Mode логика перенесена в ядро Core: `core/trading/safeMode.js`.
// Этот файл сохранён, чтобы НЕ менять существующие импорты (сейчас — `ai-consensus.js`),
// и реэкспортирует функции под прежними именами и с прежним поведением.
//
// Удаление shim и перевод вызывающих модулей на прямой импорт из `core/trading/*`
// выполняются на отдельном этапе. Здесь поведение не меняется.

export { findKeyLevels, analyzeSafeModeSetup, generateDetailedReport } from './core/trading/safeMode.js';
