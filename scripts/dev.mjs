// scripts/dev.mjs — одновременный запуск локального API (server/index.js) и Vite.
// Использует только встроенные модули Node.js (child_process), поэтому новые
// зависимости не требуются. Останавливает оба процесса при завершении любого
// из них или по Ctrl+C (SIGINT/SIGTERM).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(rootDir, 'server', 'index.js');
const viteEntry = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

const processes = [];
let shuttingDown = false;

function start(name, entry, args = []) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`\n[dev] Процесс "${name}" завершился (code=${code}, signal=${signal}). Останавливаю остальные.`);
    shutdown(typeof code === 'number' ? code : 1);
  });

  child.on('error', (err) => {
    console.error(`[dev] Не удалось запустить "${name}": ${err.message}`);
    shutdown(1);
  });

  processes.push({ name, child });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of processes) {
    if (!child.killed) {
      try { child.kill(); } catch (e) { /* процесс уже завершён */ }
    }
  }
  process.exitCode = exitCode;
  // Короткая пауза, чтобы дочерние процессы успели освободить порты.
  setTimeout(() => process.exit(exitCode), 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev] Запускаю локальный API (server/index.js) и Vite...');
start('api', serverEntry);
start('client', viteEntry);
