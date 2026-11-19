import type { ResearchCalendarSpec, CalendarInterval } from './archiveContracts.js';
export function createResearchCalendar(spec: ResearchCalendarSpec | unknown,
  binding: Readonly<{ sourceId: string; venue: string; assetClass: 'FOREX' | 'CRYPTO' }> | unknown): Readonly<{
    profile: 'UNKNOWN' | 'FOREX_WEEKLY' | 'CRYPTO_24_7'; confidence: 'UNKNOWN' | 'DECLARED_ONLY'; reason: string | null;
    /** UTC epoch milliseconds, aligned to M1; half-open [from,to). */
    interval(from: number, to: number): CalendarInterval;
  }>;
