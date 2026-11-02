export interface TradingPair {
  id: string;
  symbol: string;
  displaySymbol: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'audcad', symbol: 'FXCM:AUDCAD', displaySymbol: 'AUD/CAD' },
  { id: 'audchf', symbol: 'FXCM:AUDCHF', displaySymbol: 'AUD/CHF' },
  { id: 'audjpy', symbol: 'FXCM:AUDJPY', displaySymbol: 'AUD/JPY' },
  { id: 'audnzd', symbol: 'FXCM:AUDNZD', displaySymbol: 'AUD/NZD' },
  { id: 'audusd', symbol: 'FXCM:AUDUSD', displaySymbol: 'AUD/USD' },
  { id: 'cadjpy', symbol: 'FXCM:CADJPY', displaySymbol: 'CAD/JPY' },
  { id: 'euraud', symbol: 'FXCM:EURAUD', displaySymbol: 'EUR/AUD' },
  { id: 'eurchf', symbol: 'FXCM:EURCHF', displaySymbol: 'EUR/CHF' },
  { id: 'eurgbp', symbol: 'FXCM:EURGBP', displaySymbol: 'EUR/GBP' },
  { id: 'eurjpy', symbol: 'FXCM:EURJPY', displaySymbol: 'EUR/JPY' },
  { id: 'eurnzd', symbol: 'FXCM:EURNZD', displaySymbol: 'EUR/NZD' },
  { id: 'eurusd', symbol: 'FXCM:EURUSD', displaySymbol: 'EUR/USD' },
  { id: 'gbpaud', symbol: 'FXCM:GBPAUD', displaySymbol: 'GBP/AUD' },
  { id: 'gbpchf', symbol: 'FXCM:GBPCHF', displaySymbol: 'GBP/CHF' },
  { id: 'gbpjpy', symbol: 'FXCM:GBPJPY', displaySymbol: 'GBP/JPY' },
  { id: 'gbpnzd', symbol: 'FXCM:GBPNZD', displaySymbol: 'GBP/NZD' },
  { id: 'gbpusd', symbol: 'FXCM:GBPUSD', displaySymbol: 'GBP/USD' },
  { id: 'nzdusd', symbol: 'FXCM:NZDUSD', displaySymbol: 'NZD/USD' },
  { id: 'usdcad', symbol: 'FXCM:USDCAD', displaySymbol: 'USD/CAD' },
  { id: 'usdchf', symbol: 'FXCM:USDCHF', displaySymbol: 'USD/CHF' },
  { id: 'usdjpy', symbol: 'FXCM:USDJPY', displaySymbol: 'USD/JPY' },
  { id: 'btcusdt', symbol: 'BINANCE:BTCUSDT', displaySymbol: 'BTC/USDT' }
];
