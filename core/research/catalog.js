// Research catalog only. A listed instrument does not assert that a dataset/source exists.
const pairs = ['AUD/CAD', 'AUD/CHF', 'AUD/JPY', 'AUD/NZD', 'AUD/USD', 'CAD/JPY', 'EUR/AUD',
  'EUR/CHF', 'EUR/GBP', 'EUR/JPY', 'EUR/NZD', 'EUR/USD', 'GBP/AUD', 'GBP/CHF', 'GBP/JPY',
  'GBP/NZD', 'GBP/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF', 'USD/JPY', 'BTC/USDT'];
const catalog = Object.freeze(pairs.map(pair => {
  const [base, quote] = pair.split('/');
  return Object.freeze({ instrument: (base + quote).toLowerCase(), pair, base, quote,
    assetClass: quote === 'USDT' ? 'CRYPTO' : 'FOREX', sourceId: null, sourceSymbol: null,
    venue: null, priceBasis: 'UNKNOWN', researchTimeframes: Object.freeze(['1']),
    historyStatus: 'MISSING', readiness: 'NOT_READY', grantsRuntimeAccess: false });
}));
function listResearchInstruments() { return catalog; }
function getResearchInstrument(instrument) { return catalog.find(item => item.instrument === instrument) ?? null; }
export { listResearchInstruments, getResearchInstrument };
