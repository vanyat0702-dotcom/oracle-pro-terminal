import React from 'react';
import { Activity, ShieldCheck, Zap, LineChart, Database } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-cyan-400 animate-pulse" />
          <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            ORACLE PRO TERMINAL
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            WS Binance: OK
          </span>
          <span className="flex items-center gap-1 text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-3 py-1 rounded-full">
            <Database className="w-3.5 h-3.5" />
            Oracle AI Core: Ready
          </span>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left/Center Panel - Live Chart */}
        <section className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-cyan-400" />
              <span className="font-semibold text-slate-200">BTC/USDT Realtime Scan</span>
            </div>
            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded">TF: 1M / 5M</span>
          </div>

          <div className="flex-1 min-h-[400px] border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 gap-3">
            <Activity className="w-12 h-12 text-cyan-500/40 animate-bounce" />
            <p className="text-sm">Инициализация модулей TradingView & Scalp Hub...</p>
          </div>
        </section>

        {/* Right Panel - AI Signal Core */}
        <aside className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              ИИ Оракул (DeepScan)
            </h2>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="text-xs text-slate-400 flex justify-between">
              <span>Статус:</span>
              <span className="text-emerald-400 font-bold">ОЖИДАНИЕ</span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between">
              <span>Точность:</span>
              <span className="text-slate-200 font-bold">-- %</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full w-0"></div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-3 text-xs text-slate-500 flex justify-between">
        <span>ORACLE PRO v1.0.0 (High Precision Engine)</span>
        <span>Status: Initializing Core</span>
      </footer>
    </div>
  );
}
