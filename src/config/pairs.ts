export interface TradingPair {
  id: string;
  symbol: string; // Тикер для графика TradingView
  wsSymbol: string; // Тикер для WebSocket потока котировок в шапке
  displaySymbol: string;
  category: 'crypto' | 'forex' | 'metals';
  baseRate: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  // Криптовалюты (через Binance WebSocket)
  { id: 'btc', symbol: 'BINANCE:BTCUSDT', wsSymbol: 'btcusdt', displaySymbol: 'BTC/USDT', category: 'crypto', baseRate: '77732.00' },
  { id: 'eth', symbol: 'BINANCE:ETHUSDT', wsSymbol: 'ethusdt', displaySymbol: 'ETH/USDT', category: 'crypto', baseRate: '3520.10' },
  { id: 'sol', symbol: 'BINANCE:SOLUSDT', wsSymbol: 'solusdt', displaySymbol: 'SOL/USDT', category: 'crypto', baseRate: '184.25' },
  
  // Настоящие Форекс-пары (через FX_IDC / OANDA в TradingView)
  { id: 'eurusd', symbol: 'FX_IDC:EURUSD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/USD (Forex)', category: 'forex', baseRate: '1.0850' },
  { id: 'gbpusd', symbol: 'FX_IDC:GBPUSD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/USD (Forex)', category: 'forex', baseRate: '1.2740' },
  { id: 'usdjpy', symbol: 'FX_IDC:USDJPY', wsSymbol: 'usdjpy', displaySymbol: 'USD/JPY (Forex)', category: 'forex', baseRate: '152.30' },
  { id: 'audusd', symbol: 'FX_IDC:AUDUSD', wsSymbol: 'audusdt', displaySymbol: 'AUD/USD (Forex)', category: 'forex', baseRate: '0.6550' },
  
  // Металлы / Золото
  { id: 'gold', symbol: 'OANDA:XAUUSD', wsSymbol: 'paxgusdt', displaySymbol: 'GOLD / USD', category: 'metals', baseRate: '2745.00' }
];
