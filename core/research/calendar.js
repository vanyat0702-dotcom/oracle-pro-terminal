// Offline, source-bound DECLARED calendar model. Never evidence of a live session.
import { types } from 'node:util';

const MINUTE = 60000, HOUR = 60 * MINUTE, WEEK = 7 * 1440;
function exact(o, keys) {
  if (!o || typeof o !== 'object' || types.isProxy(o) || Array.isArray(o) || Object.getPrototypeOf(o) !== Object.prototype) return false;
  const d = Object.getOwnPropertyDescriptors(o);
  return Reflect.ownKeys(d).length === keys.length && keys.every(k => Object.hasOwn(d, k) && Object.hasOwn(d[k], 'value'));
}
const label = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(s) && s !== 'UNKNOWN';
const validTime = n => Number.isSafeInteger(n) && n > 0 && n % MINUTE === 0 && n <= 253402300740000;

function createResearchCalendar(spec, binding) {
  let format, opening, closing, profile = 'UNKNOWN', reason = 'CALENDAR_UNKNOWN';
  try {
    if (!exact(binding, ['sourceId', 'venue', 'assetClass']) || !label(binding.sourceId) || !label(binding.venue)) throw Error();
    if (exact(spec, ['profile']) && spec.profile === 'UNKNOWN') throw Error();
    const common = ['profile', 'sourceId', 'venue', 'reference', 'exceptions'];
    const forex = spec && !types.isProxy(spec) && Object.getOwnPropertyDescriptor(spec, 'profile')?.value === 'FOREX_WEEKLY';
    if (!exact(spec, forex ? [...common, 'timeZone', 'openMinute', 'closeMinute'] : common) ||
      spec.sourceId !== binding.sourceId || spec.venue !== binding.venue || !label(spec.reference) ||
      !Array.isArray(spec.exceptions) || types.isProxy(spec.exceptions)) throw Error();
    // No public "confirmed" flag can authorize a holiday/outage exemption.
    if (spec.exceptions.length) { reason = 'EXCEPTION_EVIDENCE_UNCONFIRMED'; throw Error(); }
    if (forex && binding.assetClass === 'FOREX' && Number.isInteger(spec.openMinute) && spec.openMinute >= 0 && spec.openMinute < 1440 &&
      Number.isInteger(spec.closeMinute) && spec.closeMinute >= 0 && spec.closeMinute < 1440 && typeof spec.timeZone === 'string') {
      format = new Intl.DateTimeFormat('en-US', { timeZone: spec.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      opening = spec.openMinute; closing = 5 * 1440 + spec.closeMinute;
      profile = 'FOREX_WEEKLY';
    } else if (spec.profile === 'CRYPTO_24_7' && binding.assetClass === 'CRYPTO') profile = 'CRYPTO_24_7';
    else throw Error();
    reason = null;
  } catch { profile = 'UNKNOWN'; }
  function offset(ms) {
    const p = Object.fromEntries(format.formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  }
  function weekMinute(ms, shift) { const d = new Date(ms + shift); return d.getUTCDay() * 1440 + d.getUTCHours() * 60 + d.getUTCMinutes(); }
  function interval(from, to) {
    if (!validTime(from) || !validTime(to) || to < from) return Object.freeze({ status: 'UNKNOWN', tradingMinutes: null, nonTradingMinutes: null, nonTradingIntervals: null });
    if (profile === 'UNKNOWN') return Object.freeze({ status: 'UNKNOWN', tradingMinutes: null, nonTradingMinutes: null, nonTradingIntervals: null });
    if (profile === 'CRYPTO_24_7') return Object.freeze({ status: 'MODELLED', tradingMinutes: (to - from) / MINUTE, nonTradingMinutes: 0, nonTradingIntervals: 0 });
    let t = from, trading = 0, closed = 0, runs = 0, wasClosed = false;
    // Constant memory: walk UTC hours, splitting at weekly boundaries. Only a DST-transition
    // hour needs minute classification. No array/cache grows with the archive duration.
    while (t < to) {
      const end = Math.min(to, Math.floor(t / HOUR) * HOUR + HOUR);
      const shift = offset(t), same = shift === offset(end - MINUTE);
      while (t < end) {
        const w = weekMinute(t, same ? shift : offset(t));
        const active = w >= opening && w < closing;
        const next = w < opening ? opening - w : w < closing ? closing - w : WEEK - w + opening;
        const n = same ? Math.min((end - t) / MINUTE, next) : 1;
        if (active) trading += n;
        else { closed += n; if (!wasClosed) runs++; }
        wasClosed = !active; t += n * MINUTE;
      }
    }
    return Object.freeze({ status: 'MODELLED', tradingMinutes: trading, nonTradingMinutes: closed, nonTradingIntervals: runs });
  }
  return Object.freeze({ profile, confidence: profile === 'UNKNOWN' ? 'UNKNOWN' : 'DECLARED_ONLY', reason, interval });
}
export { createResearchCalendar };
