export interface TradingPair {
  id: string;
  symbol: string;
  displaySymbol: string;
  category: 'crypto' | 'forex' | 'metals';
  baseRate: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  // Криптовалюты
  { id: 'btc', symbol: 'btcusdt', displaySymbol: 'BTC/USDT', category: 'crypto', baseRate: '67420.50' },
  { id: 'eth', symbol: 'ethusdt', displaySymbol: 'ETH/USDT', category: 'crypto', baseRate: '3520.10' },
  { id: 'sol', symbol: 'solusdt', displaySymbol: 'SOL/USDT', category: 'crypto', baseRate: '184.25' },
  { id: 'bnb', symbol: 'bnbusdt', displaySymbol: 'BNB/USDT', category: 'crypto', baseRate: '610.00' },
  { id: 'xrp', symbol: 'xrpusdt', displaySymbol: 'XRP/USDT', category: 'crypto', baseRate: '0.6250' },
  
  // Популярные Forex-пары (через биржевые тикеры Binance)
  { id: 'eurusd', symbol: 'eurousdt', displaySymbol: 'EUR/USDT (Fx)', category: 'forex', baseRate: '1.0850' },
  { id: 'gbpusdt', symbol: 'gbpusdt', displaySymbol: 'GBP/USDT (Fx)', category: 'forex', baseRate: '1.2740' },
  { id: 'usdjpy', symbol: 'usdjpy', displaySymbol: 'USD/JPY (Fx)', category: 'forex', baseRate: '152.30' },
  
  // Альткоины / Активы
  { id: 'ada', symbol: 'adausdt', displaySymbol: 'ADA/USDT', category: 'crypto', baseRate: '0.4500' },
  { id: 'doge', symbol: 'dogeusdt', displaySymbol: 'DOGE/USDT', category: 'crypto', baseRate: '0.1650' }
];
