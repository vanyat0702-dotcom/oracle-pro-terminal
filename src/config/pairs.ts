export interface TradingPair {
  id: string;
  symbol: string;
  displaySymbol: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'audcad', symbol: 'CAPITALCOM:AUDCAD', displaySymbol: 'AUD/CAD' },
  { id: 'audchf', symbol: 'CAPITALCOM:AUDCHF', displaySymbol: 'AUD/CHF' },
  { id: 'audjpy', symbol: 'CAPITALCOM:AUDJPY', displaySymbol: 'AUD/JPY' },
  { id: 'audnzd', symbol: 'CAPITALCOM:AUDNZD', displaySymbol: 'AUD/NZD' },
  { id: 'audusd', symbol: 'CAPITALCOM:AUDUSD', displaySymbol: 'AUD/USD' },
  { id: 'cadjpy', symbol: 'CAPITALCOM:CADJPY', displaySymbol: 'CAD/JPY' },
  { id: 'euraud', symbol: 'CAPITALCOM:EURAUD', displaySymbol: 'EUR/AUD' },
  { id: 'eurchf', symbol: 'CAPITALCOM:EURCHF', displaySymbol: 'EUR/CHF' },
  { id: 'eurgbp', symbol: 'CAPITALCOM:EURGBP', displaySymbol: 'EUR/GBP' },
  { id: 'eurjpy', symbol: 'CAPITALCOM:EURJPY', displaySymbol: 'EUR/JPY' },
  { id: 'eurnzd', symbol: 'CAPITALCOM:EURNZD', displaySymbol: 'EUR/NZD' },
  { id: 'eurusd', symbol: 'CAPITALCOM:EURUSD', displaySymbol: 'EUR/USD' },
  { id: 'gbpaud', symbol: 'CAPITALCOM:GBPAUD', displaySymbol: 'GBP/AUD' },
  { id: 'gbpchf', symbol: 'CAPITALCOM:GBPCHF', displaySymbol: 'GBP/CHF' },
  { id: 'gbpjpy', symbol: 'CAPITALCOM:GBPJPY', displaySymbol: 'GBP/JPY' },
  { id: 'gbpnzd', symbol: 'CAPITALCOM:GBPNZD', displaySymbol: 'GBP/NZD' },
  { id: 'gbpusd', symbol: 'CAPITALCOM:GBPUSD', displaySymbol: 'GBP/USD' },
  { id: 'nzdusd', symbol: 'CAPITALCOM:NZDUSD', displaySymbol: 'NZD/USD' },
  { id: 'usdcad', symbol: 'CAPITALCOM:USDCAD', displaySymbol: 'USD/CAD' },
  { id: 'usdchf', symbol: 'CAPITALCOM:USDCHF', displaySymbol: 'USD/CHF' },
  { id: 'usdjpy', symbol: 'CAPITALCOM:USDJPY', displaySymbol: 'USD/JPY' },
  { id: 'btcusdt', symbol: 'BINANCE:BTCUSDT', displaySymbol: 'BTC/USDT' }
];
