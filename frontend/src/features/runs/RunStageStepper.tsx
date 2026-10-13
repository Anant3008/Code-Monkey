import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  StopCircle,
} from 'lucide-react';
import type { RunStage, AnalysisRun } from '../../types';
import { Badge } from '../../components/common/Badge';

interface RunStageStepperProps {
  run: AnalysisRun;
  isRunning?: boolean;
  onCancelRun?: () => void;
  onReplayRun?: () => void;
}

const STAGES: Array<{ id: RunStage; label: string; description: string }> = [
  { id: 'INTAKE', label: '1. Intake', description: 'UTF-8 validation & SHA-256 hash' },
  { id: 'CONTEXT_SETUP', label: '2. Context', description: 'Snapshot baseline state & invariants' },
  { id: 'GENERATE', label: '3. Generate', description: 'Extract competing interpretation plans' },
  { id: 'COMPILE', label: '4. Compile', description: 'Pydantic schema & allowlist validation' },
  { id: 'SIMULATE', label: '5. Simulate', description: 'Synchronous execution over cloned state' },
  { id: 'EVALUATE', label: '6. Evaluate', description: 'Deterministic invariant checks' },
  { id: 'COMPARE_REDUCE', label: '7. Reduce', description: 'Trace diffs & delta-debugging budget' },
  { id: 'REPAIR_RETEST', label: '8. Repair', description: 'Hypothesis rewrite verification' },
  { id: 'REPORT', label: '9. Report', description: 'Terminal verdict & reproducible manifest' },
];

export const RunStageStepper: React.FC<RunStageStepperProps> = ({
  run,
  isRunning = false,
  onCancelRun,
  onReplayRun,
}) => {
  const currentStageIndex = STAGES.findIndex((s) => s.id === run.stage);

  return (
    <div className="space-y-6">
      {/* Top Status & Controls Bar */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Run ID:</span>
            <span className="text-xs font-mono font-bold text-white bg-white/5 px-2 py-1 rounded border border-white/10">
              {run.run_id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Verdict:</span>
            <Badge status={run.status} />
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Started:</span>
            <span className="text-slate-300">
              {new Date(run.started_at).toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isRunning ? (
            <button
              onClick={onCancelRun}
              className="btn-danger !text-xs !py-1.5 !px-3"
            >
              <StopCircle size={14} />
              <span>Cancel Run</span>
            </button>
          ) : (
            <button
              onClick={onReplayRun}
              className="btn-primary !text-xs !py-1.5 !px-3"
            >
              <RotateCcw size={14} />
              <span>Deterministic Replay (No LLM)</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Horizontal Pipeline Stepper */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock size={16} className="text-sky-400" />
            <span>9-Stage Orchestration Lifecycle</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Stage {currentStageIndex + 1} of {STAGES.length}: {run.stage}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-3">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex || run.stage === 'REPORT';
            const isCurrent = idx === currentStageIndex && run.stage !== 'REPORT';

            return (
              <div
                key={stage.id}
                className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                  isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : isCurrent
                    ? 'bg-sky-950/40 border-sky-400 shadow-lg shadow-sky-500/10 text-sky-200 ring-1 ring-sky-400/50'
                    : 'bg-slate-900/30 border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                      {stage.label}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-sky-400 pulse-indicator" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {stage.description}
                  </p>
                </div>

                <div className="mt-2 text-[9px] font-mono text-slate-500 pt-1 border-t border-white/5">
                  {isCompleted ? '✓ Completed' : isCurrent ? '● Active Processing' : '○ Standby'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Diagnostics Callout */}
      {run.status === 'FAIL' && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/40">
            <XCircle size={20} className="text-rose-400" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-rose-300 text-sm">
              Material Divergence Detected: Hard Invariant Breached
            </h4>
            <p className="text-slate-300 leading-relaxed">
              Orchestrator evidenced an uncontained semantic drift in Candidate 2 targeting production database
              <code className="text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded mx-1">orders-prod</code>.
              Hard invariant <code className="text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded mx-1">production_data_preserved</code>
              failed deterministically during state comparison.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
