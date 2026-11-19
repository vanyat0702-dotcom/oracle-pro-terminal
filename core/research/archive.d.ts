import type { ArchiveOptions, ArchiveEvent } from './archiveContracts.js';
export const MAX_INDEX_LINE_BYTES: 65536;
export function scanResearchArchive(options: ArchiveOptions | unknown): AsyncGenerator<ArchiveEvent, void, unknown>;
