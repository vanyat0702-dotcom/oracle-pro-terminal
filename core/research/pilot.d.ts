import type { PilotOptions, PilotReport } from './sourceAdapterContracts.js';
export const MAX_ROWS_PER_FILE: 100000;
export const FRAGMENT_ROWS: 1000;
export function convertResearchPilot(options: PilotOptions | unknown): Promise<PilotReport>;
