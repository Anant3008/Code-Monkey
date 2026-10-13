import React from 'react';
import type { CandidateInterpretation, SourceSpan } from '../../types';
import { Badge } from '../../components/common/Badge';
import {
  GitBranch,
  Terminal,
  Quote,
  Layers,
  ShieldAlert,
} from 'lucide-react';

interface CandidateComparisonProps {
  candidates: CandidateInterpretation[];
  onSelectSpan?: (span: SourceSpan) => void;
}

export const CandidateComparison: React.FC<CandidateComparisonProps> = ({
  candidates,
  onSelectSpan,
}) => {
  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Competing Operational Interpretations
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              TRD Section 04.3
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            The semantic engine synthesized {candidates.length} grounded interpretations of the ambiguous instructions.
            Each candidate represents a distinct operational decision branch executed against identical synthetic initial state.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-white/10">
          <Layers size={14} className="text-sky-400" />
          <span>Plans Evaluated:</span>
          <span className="text-white font-bold">{candidates.length}</span>
        </div>
      </div>

      {/* Side-by-Side Candidates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {candidates.map((cand, idx) => {
          const isCriticalBreach = cand.candidate_id === 'candidate_02';
          return (
            <div
              key={cand.candidate_id}
              className={`glass-panel p-5 flex flex-col justify-between space-y-5 transition-all ${
                isCriticalBreach
                  ? 'border-rose-500/50 bg-rose-950/10 shadow-lg shadow-rose-950/30'
                  : 'hover:border-white/20'
              }`}
            >
              {/* Header */}
              <div className="space-y-2 border-b border-white/10 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white/10 text-white font-mono font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{cand.candidate_id}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge plausibility={cand.plausibility} />
                  </div>
                </div>

                <h3 className="text-base font-bold text-white leading-snug">
                  {cand.summary}
                </h3>

                {isCriticalBreach && (
                  <div className="flex items-center gap-1 text-[11px] text-rose-400 font-semibold bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                    <ShieldAlert size={13} />
                    <span>Breached Production Invariant</span>
                  </div>
                )}
              </div>

              {/* Inferred Assumptions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GitBranch size={13} className="text-amber-400" />
                  <span>Inferred Decision Assumptions</span>
                </h4>
                <div className="space-y-1.5">
                  {cand.assumptions.map((assump, aIdx) => (
                    <div
                      key={aIdx}
                      className="bg-slate-900/90 border border-white/5 rounded-lg p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-sky-300">{assump.kind}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {assump.is_explicit_in_source ? 'explicit' : 'inferred'}
                        </span>
                      </div>
                      <p className="font-mono text-white text-[11px] bg-slate-950/80 px-2 py-1 rounded">
                        &quot;{assump.value}&quot;
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Grounding Spans */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Quote size={13} className="text-sky-400" />
                  <span>Grounding Source Spans</span>
                </h4>
                <div className="space-y-1.5">
                  {cand.source_spans.map((span, sIdx) => (
                    <div
                      key={sIdx}
                      onClick={() => onSelectSpan && onSelectSpan(span)}
                      className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-2 text-xs flex items-center justify-between transition"
                      title="Click to view character offset in runbook"
                    >
                      <span className="text-amber-300 italic font-mono truncate max-w-[200px]">
                        &quot;{span.quote}&quot;
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        [{span.start}..{span.end}]
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ordered Typed Actions Sequence */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal size={13} className="text-emerald-400" />
                  <span>Action Plan Timeline</span>
                </h4>
                <div className="space-y-2">
                  {cand.actions.map((act, actIdx) => (
                    <div
                      key={actIdx}
                      className="bg-slate-950/90 border border-white/10 rounded-lg p-2.5 text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sky-300 font-bold flex items-center gap-1">
                          <span className="text-slate-500">{actIdx + 1}.</span>
                          {act.name}
                        </span>
                        {act.preconditions?.[0] && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              act.preconditions[0].passed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {act.preconditions[0].passed ? 'PRE PASS' : 'PRE FAIL'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 bg-slate-900 p-1.5 rounded overflow-x-auto">
                        {JSON.stringify(act.parameters)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rationale Footer */}
              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 italic leading-relaxed">
                <span className="text-slate-300 font-semibold not-italic">Operator Rationale: </span>
                {cand.rationale}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
