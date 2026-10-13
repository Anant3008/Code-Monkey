import React from 'react';
import type { Finding, InvariantResult } from '../../types';
import { Badge } from '../../components/common/Badge';
import {
  AlertTriangle,
  ShieldAlert,
  Database,
  Sparkles,
} from 'lucide-react';

interface FindingsAnalyzerProps {
  findings: Finding[];
  invariantResults: InvariantResult[];
  traces?: any;
}

export const FindingsAnalyzer: React.FC<FindingsAnalyzerProps> = ({
  findings,
  invariantResults,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Material Divergence &amp; Invariant Violations
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              TRD Section 06
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Deterministic state differences evidenced across execution traces. Findings are strictly grounded in
            computed facts, violated invariants, and delta-debugging ambiguity minimization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Total Grounded Findings:</span>
          <span className="text-sm font-bold text-rose-400 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/30">
            {findings.length} Discovered
          </span>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-6">
        {findings.map((f) => (
          <div
            key={f.id}
            className={`glass-panel p-6 space-y-5 border-l-4 ${
              f.severity === 'CRITICAL'
                ? 'border-l-rose-500 bg-rose-950/10'
                : 'border-l-amber-500 bg-amber-950/10'
            }`}
          >
            {/* Finding Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Badge severity={f.severity} />
                <span className="text-xs font-mono text-slate-400">{f.id}</span>
                <span className="text-sm font-bold text-white font-mono">{f.finding_key}</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Category:</span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-bold uppercase">
                  {f.category}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Competing:</span>
                <span className="text-sky-300 font-bold">
                  {f.interpretation_ids.join(' vs ')}
                </span>
              </div>
            </div>

            {/* Plain Language Grounded Consequence */}
            <div className="bg-slate-900/90 rounded-xl p-4 border border-white/5 space-y-1">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-400" />
                <span>Grounded Operational Impact</span>
              </h4>
              <p className="text-sm text-slate-100 font-medium leading-relaxed">
                {f.plain_language_consequence}
              </p>
            </div>

            {/* Delta-Debugging Ambiguity Minimization Badge */}
            <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-sky-400" />
                <span className="text-slate-400">Ambiguity Reduction:</span>
                <span className="text-sky-200">{f.minimality}</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Validated Grounded
              </span>
            </div>

            {/* Invariant Violations */}
            {f.violated_invariants.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-rose-400" />
                  <span>Violated Deterministic Invariants</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {f.violated_invariants.map((invId) => {
                    const result = invariantResults.find((r) => r.invariant_id === invId);
                    return (
                      <div
                        key={invId}
                        className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-rose-300">{invId}</span>
                          <span className="text-[10px] text-rose-400 bg-rose-500/20 px-1.5 py-0.2 rounded font-bold">
                            BREACH
                          </span>
                        </div>
                        {result && (
                          <p className="text-[11px] text-slate-300 leading-snug">
                            {result.evidence.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* State Diffs Visualizer */}
            {f.state_diffs && f.state_diffs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-sky-400" />
                  <span>Synthetic State Diffs (Cloned In-Memory Database)</span>
                </h4>
                <div className="bg-slate-950 border border-white/10 rounded-xl overflow-hidden font-mono text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[11px]">
                        <th className="p-3">State Attribute Path</th>
                        <th className="p-3">Initial Baseline</th>
                        <th className="p-3">Candidate 01</th>
                        <th className="p-3 text-rose-300">Candidate 02</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {f.state_diffs.map((diff, dIdx) => (
                        <tr key={dIdx} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-bold text-sky-300">{diff.path}</td>
                          <td className="p-3 text-slate-400">{String(diff.baseline)}</td>
                          <td className="p-3 text-emerald-400 font-semibold">
                            {String(diff.candidate_values.candidate_01 ?? 'unchanged')}
                          </td>
                          <td className="p-3 text-rose-400 font-bold bg-rose-500/5">
                            {String(diff.candidate_values.candidate_02 ?? 'unchanged')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
