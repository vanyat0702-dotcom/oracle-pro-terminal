export interface TradingPair {
  id: string;
  symbol: string;
  displaySymbol: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: 'audcad', symbol: 'FX_IDC:AUDCAD', displaySymbol: 'AUD/CAD' },
  { id: 'audchf', symbol: 'FX_IDC:AUDCHF', displaySymbol: 'AUD/CHF' },
  { id: 'audjpy', symbol: 'FX_IDC:AUDJPY', displaySymbol: 'AUD/JPY' },
  { id: 'audnzd', symbol: 'FX_IDC:AUDNZD', displaySymbol: 'AUD/NZD' },
  { id: 'audusd', symbol: 'FX_IDC:AUDUSD', displaySymbol: 'AUD/USD' },
  { id: 'cadjpy', symbol: 'FX_IDC:CADJPY', displaySymbol: 'CAD/JPY' },
  { id: 'euraud', symbol: 'FX_IDC:EURAUD', displaySymbol: 'EUR/AUD' },
  { id: 'eurchf', symbol: 'FX_IDC:EURCHF', displaySymbol: 'EUR/CHF' },
  { id: 'eurgbp', symbol: 'FX_IDC:EURGBP', displaySymbol: 'EUR/GBP' },
  { id: 'eurjpy', symbol: 'FX_IDC:EURJPY', displaySymbol: 'EUR/JPY' },
  { id: 'eurnzd', symbol: 'FX_IDC:EURNZD', displaySymbol: 'EUR/NZD' },
  { id: 'eurusd', symbol: 'FX_IDC:EURUSD', displaySymbol: 'EUR/USD' },
  { id: 'gbpaud', symbol: 'FX_IDC:GBPAUD', displaySymbol: 'GBP/AUD' },
  { id: 'gbpchf', symbol: 'FX_IDC:GBPCHF', displaySymbol: 'GBP/CHF' },
  { id: 'gbpjpy', symbol: 'FX_IDC:GBPJPY', displaySymbol: 'GBP/JPY' },
  { id: 'gbpnzd', symbol: 'FX_IDC:GBPNZD', displaySymbol: 'GBP/NZD' },
  { id: 'gbpusd', symbol: 'FX_IDC:GBPUSD', displaySymbol: 'GBP/USD' },
  { id: 'nzdusd', symbol: 'FX_IDC:NZDUSD', displaySymbol: 'NZD/USD' },
  { id: 'usdcad', symbol: 'FX_IDC:USDCAD', displaySymbol: 'USD/CAD' },
  { id: 'usdchf', symbol: 'FX_IDC:USDCHF', displaySymbol: 'USD/CHF' },
  { id: 'usdjpy', symbol: 'FX_IDC:USDJPY', displaySymbol: 'USD/JPY' },
  { id: 'btcusdt', symbol: 'BINANCE:BTCUSDT', displaySymbol: 'BTC/USDT' }
];
