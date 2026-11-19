// Local research IO only. Root ownership/OS integrity remains a caller responsibility.
import { open, lstat, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
export const MAX_PILOT_INPUT_BYTES = 32 * 1024 * 1024;
export const failPilot = code => { throw Object.assign(Error(code), { pilotCode: code }); };
export function pilotParts(path) {
  if (typeof path !== 'string' || !path.length || path.length > 4096) failPilot('UNSAFE_PATH');
  const parts = path.split(/[\\/]/);
  if (parts.some(s => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(s) || s.endsWith('.') || /^(?:CON|PRN|AUX|NUL|COM\d|LPT\d)(?:\.|$)/i.test(s))) failPilot('UNSAFE_PATH');
  return parts;
}
export function within(root, path) { const r = relative(root, path); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('../') && !r.startsWith('..\\')); }
export async function pilotRoot(path) {
  if (typeof path !== 'string' || !path.length || path.includes('\0') || /^(?:\\\\|\/\/)/.test(path) ||
    (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path) && !/^[A-Za-z]:[\\/]/.test(path))) failPilot('LOCAL_ROOT_REQUIRED');
  const p = resolve(path), s = await lstat(p);
  if (!s.isDirectory() || s.isSymbolicLink()) failPilot('LOCAL_ROOT_REQUIRED');
  const root = await realpath(p); if (/^(?:\\\\|\/\/)/.test(root)) failPilot('LOCAL_ROOT_REQUIRED'); return root;
}
export async function openPilotFile(root, path, limit = MAX_PILOT_INPUT_BYTES) {
  let fd;
  try {
    let p = root; const parts = pilotParts(path);
    for (let i = 0; i < parts.length; i++) {
      p = join(p, parts[i]); const s = await lstat(p);
      if (s.isSymbolicLink()) failPilot('SYMLINK_FORBIDDEN');
      if (i === parts.length - 1 ? !s.isFile() : !s.isDirectory()) failPilot('REGULAR_FILE_REQUIRED');
    }
    const canonical = await realpath(p); if (!within(root, canonical)) failPilot('PATH_ESCAPE');
    const before = await lstat(canonical); fd = await open(canonical, 'r'); const after = await fd.stat();
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino || before.isSymbolicLink() ||
      await realpath(p) !== canonical) failPilot('FILE_CHANGED');
    if (after.size < 1 || after.size > limit) failPilot('INPUT_SIZE_LIMIT');
    return fd;
  } catch (e) { if (fd) await fd.close(); throw e; }
}
export async function* pilotChunks(fd, limit = MAX_PILOT_INPUT_BYTES) {
  let position = 0;
  while (true) {
    const b = Buffer.alloc(65536), { bytesRead } = await fd.read(b, 0, b.length, position);
    if (!bytesRead) break;
    position += bytesRead; if (position > limit || !Number.isSafeInteger(position)) failPilot('INPUT_SIZE_LIMIT');
    yield b.subarray(0, bytesRead);
  }
}
export async function hashPilotFile(root, path, limit = MAX_PILOT_INPUT_BYTES) {
  const fd = await openPilotFile(root, path, limit);
  try { const hash = createHash('sha256'); for await (const b of pilotChunks(fd, limit)) hash.update(b); return hash.digest('hex'); }
  finally { await fd.close(); }
}
export async function* pilotLines(root, path, expectedChecksum) {
  const fd = await openPilotFile(root, path);
  try {
    const first = createHash('sha256'); for await (const b of pilotChunks(fd)) first.update(b);
    if (first.digest('hex') !== expectedChecksum) failPilot('SOURCE_CHECKSUM_MISMATCH');
    const hash = createHash('sha256'); let tail = Buffer.alloc(0);
    const decode = b => { try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b); } catch { failPilot('INVALID_CSV_UTF8'); } };
    for await (const b of pilotChunks(fd)) {
      hash.update(b); const data = Buffer.concat([tail, b]); let start = 0, end;
      while ((end = data.indexOf(10, start)) !== -1) {
        let line = data.subarray(start, end); start = end + 1;
        if (line.at(-1) === 13) line = line.subarray(0, -1);
        if (!line.length || line.length > 65536) failPilot('INVALID_CSV_LINE_SIZE');
        yield decode(line);
      }
      tail = Buffer.from(data.subarray(start)); if (tail.length > 65537) failPilot('INVALID_CSV_LINE_SIZE');
    }
    if (tail.length) { if (tail.length > 65536) failPilot('INVALID_CSV_LINE_SIZE'); yield decode(tail); }
    if (hash.digest('hex') !== expectedChecksum) failPilot('SOURCE_CHANGED');
  } finally { await fd.close(); }
}
