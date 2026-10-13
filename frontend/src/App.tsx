import { useState } from 'react';
import {
  TabNavigation,
  type TabId,
} from './components/common/TabNavigation';
import { Navbar } from './components/common/Navbar';
import { ProcedureEditor } from './features/procedures/ProcedureEditor';
import { RunStageStepper } from './features/runs/RunStageStepper';
import { CandidateComparison } from './features/interpretations/CandidateComparison';
import { FindingsAnalyzer } from './features/findings/FindingsAnalyzer';
import { RepairWorkspace } from './features/repairs/RepairWorkspace';
import { ReproducibilityView } from './features/exports/ReproducibilityView';
import type {
  AnalysisRun,
  ScenarioProfile,
  RepairProposal,
  InvariantRule,
  RunStage,
} from './types';
import {
  GOLDEN_DEMO_RUN,
  DEFAULT_SCENARIO_PROFILE,
  DEFAULT_PROCEDURE_TEXT,
  SAMPLE_REPAIR_PROPOSAL,
} from './api/mockData';
import { apiClient } from './api/client';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('intake');
  const [procedureText, setProcedureText] = useState<string>(DEFAULT_PROCEDURE_TEXT);
  const [profile] = useState<ScenarioProfile>(DEFAULT_SCENARIO_PROFILE);
  const [currentRun, setCurrentRun] = useState<AnalysisRun>(GOLDEN_DEMO_RUN);
  const [repairProposal, setRepairProposal] = useState<RepairProposal>(SAMPLE_REPAIR_PROPOSAL);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Execute Simulation Pipeline with visual stage progression
  const handleStartRun = async (params: {
    text: string;
    candidateLimit: number;
    seed: number;
    invariants: InvariantRule[];
  }) => {
    setIsRunning(true);
    setActiveTab('orchestration');

    const stages: RunStage[] = [
      'INTAKE',
      'CONTEXT_SETUP',
      'GENERATE',
      'COMPILE',
      'SIMULATE',
      'EVALUATE',
      'COMPARE_REDUCE',
      'REPORT',
    ];

    let updatedRun: AnalysisRun = {
      ...currentRun,
      run_id: `run_${Date.now()}`,
      procedure_text: params.text,
      seed: params.seed,
      candidate_limit: params.candidateLimit,
      status: 'RUNNING',
      stage: 'INTAKE',
      started_at: new Date().toISOString(),
    };
    setCurrentRun(updatedRun);

    // Progress through pipeline stages
    for (const stage of stages) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      updatedRun = {
        ...updatedRun,
        stage,
        status: stage === 'REPORT' ? 'FAIL' : 'RUNNING',
        finished_at: stage === 'REPORT' ? new Date().toISOString() : undefined,
      };
      setCurrentRun(updatedRun);
    }

    setIsRunning(false);
  };

  const handleReplayRun = async () => {
    setIsRunning(true);
    const replayed = await apiClient.replayRun(currentRun.run_id);
    setTimeout(() => {
      setCurrentRun(replayed);
      setIsRunning(false);
    }, 600);
  };

  const handleVerifyRepair = async (proposedText: string) => {
    const verified = await apiClient.verifyRepair(currentRun.run_id, proposedText);
    setRepairProposal(verified);
  };

  const handleResetDemo = () => {
    setProcedureText(DEFAULT_PROCEDURE_TEXT);
    setCurrentRun(GOLDEN_DEMO_RUN);
    setRepairProposal(SAMPLE_REPAIR_PROPOSAL);
    setActiveTab('intake');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar onResetDemo={handleResetDemo} isRunning={isRunning} />

      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        findingCount={currentRun.findings.length}
        candidateCount={currentRun.candidates.length}
      />

      <main className="flex-1 container-layout py-8">
        {activeTab === 'intake' && (
          <ProcedureEditor
            procedureText={procedureText}
            onChangeText={setProcedureText}
            onStartRun={handleStartRun}
            profile={profile}
            isRunning={isRunning}
          />
        )}

        {activeTab === 'orchestration' && (
          <RunStageStepper
            run={currentRun}
            isRunning={isRunning}
            onCancelRun={() => {
              setIsRunning(false);
              setCurrentRun((r) => ({ ...r, status: 'CANCELLED', stage: 'REPORT' }));
            }}
            onReplayRun={handleReplayRun}
          />
        )}

        {activeTab === 'interpretations' && (
          <CandidateComparison
            candidates={currentRun.candidates}
            onSelectSpan={(span) => {
              alert(`Selected span: "${span.quote}" [Offset: ${span.start}..${span.end}]`);
            }}
          />
        )}

        {activeTab === 'findings' && (
          <FindingsAnalyzer
            findings={currentRun.findings}
            invariantResults={currentRun.invariant_results}
            traces={currentRun.traces}
          />
        )}

        {activeTab === 'repair' && (
          <RepairWorkspace
            originalText={procedureText}
            findings={currentRun.findings}
            initialRepair={repairProposal}
            onVerifyRepair={handleVerifyRepair}
          />
        )}

        {activeTab === 'export' && (
          <ReproducibilityView
            run={currentRun}
            onReplay={handleReplayRun}
          />
        )}
      </main>

      <footer className="border-t border-white/10 bg-slate-950 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Semantic Chaos Monkey • MVP Engineering Specification v1.0</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-mono">Fail-Closed • Evidence Over Prose</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Pure In-Memory Synthetic Simulator • No External Side Effects
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
