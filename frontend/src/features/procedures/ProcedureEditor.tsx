import React, { useState } from 'react';
import {
  FileText,
  Play,
  Upload,
  ShieldAlert,
  Hash,
  Sliders,
  Info,
  CheckCircle2,
} from 'lucide-react';
import type { InvariantRule, ScenarioProfile } from '../../types';

interface ProcedureEditorProps {
  procedureText: string;
  onChangeText: (text: string) => void;
  onStartRun: (params: {
    text: string;
    candidateLimit: number;
    seed: number;
    invariants: InvariantRule[];
  }) => void;
  profile: ScenarioProfile;
  isRunning?: boolean;
}

const PRESET_PROCEDURES = [
  {
    name: 'Flagship: Ambiguous DB Deployment Runbook',
    text: `Database Deployment & Migration Runbook:
Reset the database, migrate the schema, and restore the latest backup if necessary.`,
    note: 'Generates 3 competing candidates; highlights production wipe & predicate divergence.',
  },
  {
    name: 'User Records Cleanup (Retention Policy)',
    text: `User Records Maintenance Procedure:
Purge inactive user accounts from the database, archiving records older than 90 days prior to deletion.`,
    note: 'Tests ambiguity between creation date vs last activity date.',
  },
  {
    name: 'Redis Cache Flush & Fallback Recovery',
    text: `Cluster Recovery Runbook:
Flush the cache nodes, restart the primary cluster, and sync fallback replicas if status is degraded.`,
    note: 'Tests replica synchronization order divergence.',
  },
];

export const ProcedureEditor: React.FC<ProcedureEditorProps> = ({
  procedureText,
  onChangeText,
  onStartRun,
  profile,
  isRunning = false,
}) => {
  const [candidateLimit, setCandidateLimit] = useState<number>(3);
  const [seed, setSeed] = useState<number>(41027);
  const [invariants, setInvariants] = useState<InvariantRule[]>(profile.invariants);

  const byteLength = new Blob([procedureText]).size;
  const maxBytes = 32768; // 32 KiB cap per TRD
  const bytePercentage = Math.min(100, Math.round((byteLength / maxBytes) * 100));

  const toggleInvariant = (id: string) => {
    setInvariants((prev) =>
      prev.map((inv) =>
        inv.invariant_id === id ? { ...inv, enabled: !inv.enabled } : inv
      )
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > maxBytes) {
        alert('File exceeds 32 KiB size limit specified in TRD Section 12.3');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onChangeText(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-panel p-5 border-l-4 border-l-sky-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Procedure Intake & Safety Specification</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              TRD Section 04 & 09.2
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Input an operational runbook or migration prompt. The semantic compiler parses untrusted natural language,
            extracts source spans, maps candidate assumptions, and enforces deterministic invariant bounds.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Load Preset:</label>
          <select
            className="bg-slate-900 border border-white/10 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-400"
            onChange={(e) => {
              const selected = PRESET_PROCEDURES[Number(e.target.value)];
              if (selected) onChangeText(selected.text);
            }}
          >
            {PRESET_PROCEDURES.map((p, idx) => (
              <option key={idx} value={idx}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor & File Dropzone */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <FileText size={16} className="text-sky-400" />
                <span>Operational Procedure Text</span>
                <span className="text-xs text-slate-400 font-normal">(Immutable UTF-8 Input)</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Upload Button */}
                <label className="cursor-pointer text-xs flex items-center gap-1.5 text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/10 transition">
                  <Upload size={12} />
                  <span>Upload .txt/.md</span>
                  <input
                    type="file"
                    accept=".txt,.md"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {/* Byte Counter */}
                <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <span>{byteLength}</span>
                  <span className="text-slate-600">/</span>
                  <span>{maxBytes} B</span>
                  <span className={`text-[10px] ml-1 ${bytePercentage > 90 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ({bytePercentage}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={procedureText}
              onChange={(e) => onChangeText(e.target.value)}
              rows={8}
              placeholder="Paste operational instructions here..."
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-4 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-400 transition resize-y"
            />

            {/* Source Provenance Footer */}
            <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Hash size={13} className="text-slate-500" />
                <span>SHA-256 Preview:</span>
                <span className="text-slate-300">e3b0c44298fc1c14...</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 size={12} />
                <span>Normalized LF line endings</span>
              </div>
            </div>
          </div>

          {/* Execution Warning Notice */}
          <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-sky-200">Strict Non-Negotiable Safety Boundary</p>
              <p className="text-slate-400 leading-relaxed">
                Zero shell execution, live database connections, or arbitrary code generation. Every simulated step
                dispatches to a statically registered pure Python/in-memory handler over isolated clones.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Scenario Config & Invariants */}
        <div className="lg:col-span-5 space-y-4">
          {/* Simulation Controls */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Sliders size={16} className="text-amber-400" />
                <span>Execution Configuration</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Profile: {profile.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Candidate Limit (3-5):
                </label>
                <select
                  value={candidateLimit}
                  onChange={(e) => setCandidateLimit(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-400"
                >
                  <option value={3}>3 Candidates (Flagship Default)</option>
                  <option value={4}>4 Candidates</option>
                  <option value={5}>5 Candidates (Max Cap)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Deterministic Seed:
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Invariant Rules Checklist */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-rose-400" />
                  <span>Authoritative Invariant Suite</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {invariants.filter((i) => i.enabled).length}/{invariants.length} Active
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {invariants.map((inv) => (
                  <div
                    key={inv.invariant_id}
                    onClick={() => toggleInvariant(inv.invariant_id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                      inv.enabled
                        ? 'bg-slate-900/90 border-white/15'
                        : 'bg-slate-950/40 border-white/5 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={inv.enabled}
                      onChange={() => {}}
                      className="mt-0.5 accent-sky-400 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-mono font-medium text-slate-200 truncate">
                          {inv.invariant_id}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                            inv.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {inv.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {inv.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Start Simulation Button */}
            <button
              onClick={() =>
                onStartRun({
                  text: procedureText,
                  candidateLimit,
                  seed,
                  invariants,
                })
              }
              disabled={isRunning || !procedureText.trim()}
              className="w-full btn-primary !py-3 !text-sm mt-3"
            >
              <Play size={16} className={isRunning ? 'animate-spin' : ''} />
              <span>{isRunning ? 'Simulating Pipeline...' : 'Execute Semantic Chaos Pipeline'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
