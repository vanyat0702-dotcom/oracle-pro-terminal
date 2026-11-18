import { createBiquoteProvider, MarketDataError, SOURCE } from '../core/market/biquote.js';

function registerMarketDataTestRoute(app, provider = createBiquoteProvider()) {
  app.get('/api/test/market-data/eurusd/m1', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    // Do not trust forwarded headers. Opt-in is a process setting, never an HTTP input.
    if (process.env.ORACLE_MDE_TEST !== '1' || process.env.NODE_ENV === 'production' || !local) {
      return res.status(404).json({ success: false, error: { code: 'TEST_ENDPOINT_DISABLED' } });
    }
    if (Object.keys(req.query).length) {
      return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_QUERY', message: 'This endpoint only supports fixed EURUSD M1.' } });
    }
    try {
      const snapshot = await provider.latest();
      return res.status(200).json({ success: true, diagnosticOnly: true, snapshot });
    } catch (error) {
      return res.status(503).json({
        success: false, diagnosticOnly: true, source: SOURCE, quality: { status: 'REJECTED', tradingEligible: false },
        error: error instanceof MarketDataError
          ? { code: error.code, message: error.message }
          : { code: 'MARKET_DATA_UNAVAILABLE', message: 'Market data is unavailable.' }
      });
    }
  });
}

export { registerMarketDataTestRoute };
