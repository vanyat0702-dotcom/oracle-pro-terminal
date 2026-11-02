export interface TradingPair {
  id: string;
  symbol: string; // Тикер для графика TradingView (теперь FXCM вровень с Intrade Bar)
  wsSymbol: string; // Тикер для WebSocket потока в шапке
  displaySymbol: string;
  baseRate: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'audcad', symbol: 'FXCM:AUDCAD', wsSymbol: 'audusdt', displaySymbol: 'AUD/CAD', baseRate: '0.9050' },
  { id: 'audchf', symbol: 'FXCM:AUDCHF', wsSymbol: 'audusdt', displaySymbol: 'AUD/CHF', baseRate: '0.5820' },
  { id: 'audjpy', symbol: 'FXCM:AUDJPY', wsSymbol: 'usdjpy', displaySymbol: 'AUD/JPY', baseRate: '99.50' },
  { id: 'audnzd', symbol: 'FXCM:AUDNZD', wsSymbol: 'audusdt', displaySymbol: 'AUD/NZD', baseRate: '1.0850' },
  { id: 'audusd', symbol: 'FXCM:AUDUSD', wsSymbol: 'audusdt', displaySymbol: 'AUD/USD', baseRate: '0.6550' },
  { id: 'cadjpy', symbol: 'FXCM:CADJPY', wsSymbol: 'usdjpy', displaySymbol: 'CAD/JPY', baseRate: '110.20' },
  { id: 'euraud', symbol: 'FXCM:EURAUD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/AUD', baseRate: '1.6550' },
  { id: 'eurcad', symbol: 'FXCM:EURCAD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/CAD', baseRate: '1.4980' },
  { id: 'eurchf', symbol: 'FXCM:EURCHF', wsSymbol: 'eurousdt', displaySymbol: 'EUR/CHF', baseRate: '0.9620' },
  { id: 'eurgbp', symbol: 'FXCM:EURGBP', wsSymbol: 'gbpusdt', displaySymbol: 'EUR/GBP', baseRate: '0.8520' },
  { id: 'eurjpy', symbol: 'FXCM:EURJPY', wsSymbol: 'eurjpy', displaySymbol: 'EUR/JPY', baseRate: '165.20' },
  { id: 'eurusd', symbol: 'FXCM:EURUSD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/USD', baseRate: '1.0850' },
  { id: 'gbpaud', symbol: 'FXCM:GBPAUD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/AUD', baseRate: '1.9400' },
  { id: 'gbpchf', symbol: 'FXCM:GBPCHF', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/CHF', baseRate: '1.1280' },
  { id: 'gbpjpy', symbol: 'FXCM:GBPJPY', wsSymbol: 'gbpjpy', displaySymbol: 'GBP/JPY', baseRate: '194.00' },
  { id: 'gbpnzd', symbol: 'FXCM:GBPNZD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/NZD', baseRate: '2.1200' },
  { id: 'nzdusd', symbol: 'FXCM:NZDUSD', wsSymbol: 'audusdt', displaySymbol: 'NZD/USD', baseRate: '0.6050' },
  { id: 'usdcad', symbol: 'FXCM:USDCAD', wsSymbol: 'eurousdt', displaySymbol: 'USD/CAD', baseRate: '1.3550' },
  { id: 'usdchf', symbol: 'FXCM:USDCHF', wsSymbol: 'eurousdt', displaySymbol: 'USD/CHF', baseRate: '0.8850' },
  { id: 'usdjpy', symbol: 'FXCM:USDJPY', wsSymbol: 'usdjpy', displaySymbol: 'USD/JPY', baseRate: '152.30' },
  { id: 'btcusdt', symbol: 'BINANCE:BTCUSDT', wsSymbol: 'btcusdt', displaySymbol: 'BTC/USDT', baseRate: '77732.00' }
];
