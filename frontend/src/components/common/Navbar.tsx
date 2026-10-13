import React from 'react';
import { ShieldCheck, Cpu, Database, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onResetDemo: () => void;
  isRunning?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onResetDemo, isRunning = false }) => {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-amber-500 to-sky-400 p-[1.5px] flex items-center justify-center shadow-lg shadow-rose-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-xl">🐒</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                SEMANTIC CHAOS MONKEY
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                MVP v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono tracking-tight flex items-center gap-1.5">
              <span>Break the meaning, not the code.</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400/90 font-medium">Deterministic Synthetic Simulator</span>
            </p>
          </div>
        </div>

        {/* System Badges & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300">
            <Cpu size={14} className="text-sky-400" />
            <span>Profile:</span>
            <span className="text-white font-medium">deployment-db/1.0</span>
            <span className="text-slate-600">|</span>
            <Database size={14} className="text-amber-400" />
            <span>Seed:</span>
            <span className="text-amber-300 font-medium">41027</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
            <ShieldCheck size={14} />
            <span>Isolated In-Memory State</span>
          </div>

          <button
            onClick={onResetDemo}
            disabled={isRunning}
            className="btn-secondary !text-xs !py-1.5 !px-3"
            title="Reset to initial flagship benchmark scenario"
          >
            <RefreshCw size={13} className={isRunning ? 'animate-spin text-sky-400' : ''} />
            <span>Reset Scenario</span>
          </button>
        </div>
      </div>
    </header>
  );
};
