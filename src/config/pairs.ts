export interface TradingPair {
  id: string;
  symbol: string;
  wsSymbol: string;
  displaySymbol: string;
  baseRate: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'audcad', symbol: 'AUDCAD', wsSymbol: 'audusdt', displaySymbol: 'AUD/CAD', baseRate: '0.9050' },
  { id: 'audchf', symbol: 'AUDCHF', wsSymbol: 'audusdt', displaySymbol: 'AUD/CHF', baseRate: '0.5820' },
  { id: 'audjpy', symbol: 'AUDJPY', wsSymbol: 'usdjpy', displaySymbol: 'AUD/JPY', baseRate: '99.50' },
  { id: 'audnzd', symbol: 'AUDNZD', wsSymbol: 'audusdt', displaySymbol: 'AUD/NZD', baseRate: '1.0850' },
  { id: 'audusd', symbol: 'AUDUSD', wsSymbol: 'audusdt', displaySymbol: 'AUD/USD', baseRate: '0.6550' },
  { id: 'cadjpy', symbol: 'CADJPY', wsSymbol: 'usdjpy', displaySymbol: 'CAD/JPY', baseRate: '110.20' },
  { id: 'euraud', symbol: 'EURAUD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/AUD', baseRate: '1.6550' },
  { id: 'eurcad', symbol: 'EURCAD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/CAD', baseRate: '1.4980' },
  { id: 'eurchf', symbol: 'EURCHF', wsSymbol: 'eurousdt', displaySymbol: 'EUR/CHF', baseRate: '0.9620' },
  { id: 'eurgbp', symbol: 'EURGBP', wsSymbol: 'gbpusdt', displaySymbol: 'EUR/GBP', baseRate: '0.8520' },
  { id: 'eurjpy', symbol: 'EURJPY', wsSymbol: 'eurjpy', displaySymbol: 'EUR/JPY', baseRate: '165.20' },
  { id: 'eurusd', symbol: 'EURUSD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/USD', baseRate: '1.0850' },
  { id: 'gbpaud', symbol: 'GBPAUD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/AUD', baseRate: '1.9400' },
  { id: 'gbpchf', symbol: 'GBPCHF', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/CHF', baseRate: '1.1280' },
  { id: 'gbpjpy', symbol: 'GBPJPY', wsSymbol: 'gbpjpy', displaySymbol: 'GBP/JPY', baseRate: '194.00' },
  { id: 'gbpnzd', symbol: 'GBPNZD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/NZD', baseRate: '2.1200' },
  { id: 'nzdusd', symbol: 'NZDUSD', wsSymbol: 'audusdt', displaySymbol: 'NZD/USD', baseRate: '0.6050' },
  { id: 'usdcad', symbol: 'USDCAD', wsSymbol: 'eurousdt', displaySymbol: 'USD/CAD', baseRate: '1.3550' },
  { id: 'usdchf', symbol: 'USDCHF', wsSymbol: 'eurousdt', displaySymbol: 'USD/CHF', baseRate: '0.8850' },
  { id: 'usdjpy', symbol: 'USDJPY', wsSymbol: 'usdjpy', displaySymbol: 'USD/JPY', baseRate: '152.30' },
  { id: 'btcusdt', symbol: 'BINANCE:BTCUSDT', wsSymbol: 'btcusdt', displaySymbol: 'BTC/USDT', baseRate: '77732.00' }
];
