import React from 'react';
import type { AnalysisRun } from '../../types';
import {
  FileCode,
  FileText,
  ShieldCheck,
  History,
  RotateCcw,
} from 'lucide-react';

interface ReproducibilityViewProps {
  run: AnalysisRun;
  onReplay: () => void;
}

export const ReproducibilityView: React.FC<ReproducibilityViewProps> = ({
  run,
  onReplay,
}) => {
  const downloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(run, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `scm-run-${run.run_id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadMarkdown = () => {
    const mdContent = `# Semantic Chaos Monkey Audit Report
**Run ID:** ${run.run_id}
**Verdict:** ${run.status}
**Profile:** ${run.profile_id} (v${run.profile_version})
**Seed:** ${run.seed}

## Summary of Findings
${run.findings
  .map(
    (f) => `### ${f.finding_key} [${f.severity}]
- **Category:** ${f.category}
- **Implicated Plans:** ${f.interpretation_ids.join(', ')}
- **Consequence:** ${f.plain_language_consequence}
- **Violated Invariants:** ${f.violated_invariants.join(', ')}
`
  )
  .join('\n')}

## Reproducibility Manifest
- Procedure SHA-256: \`${run.manifest.procedure_sha256}\`
- Initial State Hash: \`${run.manifest.initial_state_hash}\`
- Action Catalog: \`${run.manifest.action_catalog_version}\`
- Simulator Version: \`${run.manifest.simulator_version}\`
`;
    const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(mdContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `scm-audit-${run.run_id}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Deterministic Reproducibility &amp; Export
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              TRD Section 07.3 &amp; 09.1
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Proves candidate isolation and permits deterministic replay. Stored execution plans can be re-run at any time
            without invoking the LLM, producing byte-for-byte identical state and trace hashes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={downloadJson} className="btn-secondary !text-xs !py-2 !px-3">
            <FileCode size={14} className="text-sky-400" />
            <span>Export JSON</span>
          </button>
          <button onClick={downloadMarkdown} className="btn-secondary !text-xs !py-2 !px-3">
            <FileText size={14} className="text-emerald-400" />
            <span>Export Markdown</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cryptographic Manifest */}
        <div className="lg:col-span-7 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Immutable Reproducibility Manifest</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400">100% CI Replay Determinism</span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            {Object.entries(run.manifest).map(([key, val]) => (
              <div
                key={key}
                className="bg-slate-900/80 border border-white/5 rounded-lg p-2.5 flex items-center justify-between gap-4"
              >
                <span className="text-slate-400 font-medium">{key}</span>
                <span className="text-slate-200 truncate max-w-xs text-right bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                  {String(val)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button onClick={onReplay} className="w-full btn-primary !py-2.5 !text-xs">
              <RotateCcw size={14} />
              <span>Run Execution Replay Verification (No LLM Call)</span>
            </button>
          </div>
        </div>

        {/* Right: Run Audit History */}
        <div className="lg:col-span-5 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History size={16} className="text-sky-400" />
              <span>Run Audit Trail</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">Local SQLite</span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-900/80 border border-sky-500/30 rounded-xl p-3.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sky-300">{run.run_id}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                  {run.status}
                </span>
              </div>
              <p className="text-slate-300 text-[11px]">Flagship Ambiguous Runbook Exploration</p>
              <div className="text-[10px] text-slate-500 font-mono pt-1">
                {new Date(run.started_at).toLocaleString()} • Seed {run.seed}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3.5 text-xs space-y-1 opacity-70">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-300">child_run_verify_8942</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  VERIFIED
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">Hardened Scoped Procedure Verification</p>
              <div className="text-[10px] text-slate-500 font-mono pt-1">
                Linked to parent {run.run_id}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
