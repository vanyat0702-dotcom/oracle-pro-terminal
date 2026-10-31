export interface TradingPair {
  id: string;
  symbol: string; // Тикер для графика TradingView
  wsSymbol: string; // Тикер для WebSocket потока в шапке
  displaySymbol: string;
  baseRate: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'audcad', symbol: 'FX_IDC:AUDCAD', wsSymbol: 'eurousdt', displaySymbol: 'AUD/CAD', baseRate: '0.9050' },
  { id: 'audchf', symbol: 'FX_IDC:AUDCHF', wsSymbol: 'eurousdt', displaySymbol: 'AUD/CHF', baseRate: '0.5820' },
  { id: 'audjpy', symbol: 'FX_IDC:AUDJPY', wsSymbol: 'usdjpy', displaySymbol: 'AUD/JPY', baseRate: '99.50' },
  { id: 'audnzd', symbol: 'FX_IDC:AUDNZD', wsSymbol: 'eurousdt', displaySymbol: 'AUD/NZD', baseRate: '1.0850' },
  { id: 'audusd', symbol: 'FX_IDC:AUDUSD', wsSymbol: 'audusdt', displaySymbol: 'AUD/USD', baseRate: '0.6550' },
  { id: 'cadjpy', symbol: 'FX_IDC:CADJPY', wsSymbol: 'usdjpy', displaySymbol: 'CAD/JPY', baseRate: '110.20' },
  { id: 'euraud', symbol: 'FX_IDC:EURAUD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/AUD', baseRate: '1.6550' },
  { id: 'eurcad', symbol: 'FX_IDC:EURCAD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/CAD', baseRate: '1.4980' },
  { id: 'eurchf', symbol: 'FX_IDC:EURCHF', wsSymbol: 'eurousdt', displaySymbol: 'EUR/CHF', baseRate: '0.9620' },
  { id: 'eurgbp', symbol: 'FX_IDC:EURGBP', wsSymbol: 'gbpusdt', displaySymbol: 'EUR/GBP', baseRate: '0.8520' },
  { id: 'eurjpy', symbol: 'FX_IDC:EURJPY', wsSymbol: 'usdjpy', displaySymbol: 'EUR/JPY', baseRate: '165.20' },
  { id: 'eurusd', symbol: 'FX_IDC:EURUSD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/USD', baseRate: '1.0850' },
  { id: 'gbpaud', symbol: 'FX_IDC:GBPAUD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/AUD', baseRate: '1.9400' },
  { id: 'gbpchf', symbol: 'FX_IDC:GBPCHF', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/CHF', baseRate: '1.1280' },
  { id: 'gbpjpy', symbol: 'FX_IDC:GBPJPY', wsSymbol: 'usdjpy', displaySymbol: 'GBP/JPY', baseRate: '194.00' },
  { id: 'gbpnzd', symbol: 'FX_IDC:GBPNZD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/NZD', baseRate: '2.1200' },
  { id: 'nzdusd', symbol: 'FX_IDC:NZDUSD', wsSymbol: 'audusdt', displaySymbol: 'NZD/USD', baseRate: '0.6050' },
  { id: 'usdcad', symbol: 'FX_IDC:USDCAD', wsSymbol: 'eurousdt', displaySymbol: 'USD/CAD', baseRate: '1.3550' },
  { id: 'usdchf', symbol: 'FX_IDC:USDCHF', wsSymbol: 'eurousdt', displaySymbol: 'USD/CHF', baseRate: '0.8850' },
  { id: 'usdjpy', symbol: 'FX_IDC:USDJPY', wsSymbol: 'usdjpy', displaySymbol: 'USD/JPY', baseRate: '152.30' },
  { id: 'btcusdt', symbol: 'BINANCE:BTCUSDT', wsSymbol: 'btcusdt', displaySymbol: 'BTC/USDT', baseRate: '77732.00' }
];
