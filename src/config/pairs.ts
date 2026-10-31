export interface TradingPair {
  id: string;
  symbol: string; // Тикер для графика TradingView
  wsSymbol: string; // Тикер для WebSocket потока котировок в шапке
  displaySymbol: string;
  category: 'forex' | 'crypto' | 'metals';
  baseRate: string;
}

export const TRADING_PAIRS: TradingPair[] = [
  // --- ВАЛЮТНЫЕ ПАРЫ (FOREX) ---
  { id: 'eurusd', symbol: 'FX_IDC:EURUSD', wsSymbol: 'eurousdt', displaySymbol: 'EUR/USD', category: 'forex', baseRate: '1.0850' },
  { id: 'gbpusd', symbol: 'FX_IDC:GBPUSD', wsSymbol: 'gbpusdt', displaySymbol: 'GBP/USD', category: 'forex', baseRate: '1.2740' },
  { id: 'usdjpy', symbol: 'FX_IDC:USDJPY', wsSymbol: 'usdjpy', displaySymbol: 'USD/JPY', category: 'forex', baseRate: '152.30' },
  { id: 'audusd', symbol: 'FX_IDC:AUDUSD', wsSymbol: 'audusdt', displaySymbol: 'AUD/USD', category: 'forex', baseRate: '0.6550' },
  { id: 'usdcad', symbol: 'FX_IDC:USDCAD', wsSymbol: 'eurousdt', displaySymbol: 'USD/CAD', category: 'forex', baseRate: '1.3550' },
  { id: 'usdchf', symbol: 'FX_IDC:USDCHF', wsSymbol: 'eurousdt', displaySymbol: 'USD/CHF', category: 'forex', baseRate: '0.8850' },
  { id: 'nzdusd', symbol: 'FX_IDC:NZDUSD', wsSymbol: 'audusdt', displaySymbol: 'NZD/USD', category: 'forex', baseRate: '0.6050' },
  { id: 'eurgbp', symbol: 'FX_IDC:EURGBP', wsSymbol: 'gbpusdt', displaySymbol: 'EUR/GBP', category: 'forex', baseRate: '0.8520' },
  { id: 'eurjpy', symbol: 'FX_IDC:EURJPY', wsSymbol: 'usdjpy', displaySymbol: 'EUR/JPY', category: 'forex', baseRate: '165.20' },
  { id: 'gbpjpy', symbol: 'FX_IDC:GBPJPY', wsSymbol: 'usdjpy', displaySymbol: 'GBP/JPY', category: 'forex', baseRate: '194.00' },

  // --- МЕТАЛЛЫ ---
  { id: 'gold', symbol: 'OANDA:XAUUSD', wsSymbol: 'paxgusdt', displaySymbol: 'GOLD (Зоолото)', category: 'metals', baseRate: '2745.00' },
  { id: 'silver', symbol: 'OANDA:XAGUSD', wsSymbol: 'paxgusdt', displaySymbol: 'SILVER (Серебро)', category: 'metals', baseRate: '32.50' },

  // --- КРИПТОВАЛЮТЫ ---
  { id: 'btc', symbol: 'BINANCE:BTCUSDT', wsSymbol: 'btcusdt', displaySymbol: 'BTC/USDT', category: 'crypto', baseRate: '77732.00' },
  { id: 'eth', symbol: 'BINANCE:ETHUSDT', wsSymbol: 'ethusdt', displaySymbol: 'ETH/USDT', category: 'crypto', baseRate: '3520.10' },
  { id: 'sol', symbol: 'BINANCE:SOLUSDT', wsSymbol: 'solusdt', displaySymbol: 'SOL/USDT', category: 'crypto', baseRate: '184.25' },
  { id: 'bnb', symbol: 'BINANCE:BNBUSDT', wsSymbol: 'bnbusdt', displaySymbol: 'BNB/USDT', category: 'crypto', baseRate: '610.00' },
  { id: 'xrp', symbol: 'BINANCE:XRPUSDT', wsSymbol: 'xrpusdt', displaySymbol: 'XRP/USDT', category: 'crypto', baseRate: '0.6250' }
];
