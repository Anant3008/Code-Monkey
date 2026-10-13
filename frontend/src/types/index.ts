// ==============================================================================
// Semantic Chaos Monkey — TypeScript Domain Contracts & API Models
// Source of truth: TRD Sections 03, 04, 05, 06, 07, 08 & 09
// ==============================================================================

export type RunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'PASS'
  | 'FAIL'
  | 'NEEDS_CONTEXT'
  | 'INCOMPLETE'
  | 'CANCELLED';

export type RunStage =
  | 'INTAKE'
  | 'CONTEXT_SETUP'
  | 'GENERATE'
  | 'COMPILE'
  | 'SIMULATE'
  | 'EVALUATE'
  | 'COMPARE_REDUCE'
  | 'REPAIR_RETEST'
  | 'REPORT';

export type Plausibility = 'SUPPORTED' | 'WEAK' | 'UNSUPPORTED';
export type CompileStatus = 'ACCEPTED' | 'REJECTED' | 'NEEDS_CONTEXT';

export type DivergenceCategory =
  | 'TARGET'
  | 'ACTION'
  | 'ORDER'
  | 'CONDITION'
  | 'SELECTION'
  | 'STATE'
  | 'INVARIANT';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFORMATIONAL';

export interface SourceSpan {
  start: number;
  end: number;
  quote: string;
  step_index?: number;
}

export interface Assumption {
  kind: string;
  value: string;
  source_span_ids: string[];
  is_explicit_in_source: boolean;
}

export interface ActionItem {
  name: string;
  parameters: Record<string, any>;
  preconditions?: Array<{
    id: string;
    passed: boolean;
  }>;
}

export interface CandidateInterpretation {
  candidate_id: string;
  summary: string;
  plausibility: Plausibility;
  compile_status: CompileStatus;
  rejection_reasons?: Array<{
    code: string;
    path: string;
    message: string;
  }>;
  assumptions: Assumption[];
  source_spans: SourceSpan[];
  actions: ActionItem[];
  rationale: string;
  executed?: boolean;
}

export interface TraceEvent {
  sequence: number;
  candidate_id: string;
  action: string;
  parameters: Record<string, any>;
  preconditions: Array<{ id: string; passed: boolean }>;
  state_before_hash: string;
  state_after_hash: string;
  changed_paths: string[];
  handler_version: string;
  timestamp_offset_ms: number;
}

export interface DatabaseState {
  environment_id: string;
  schema_version: string;
  data_revision: number;
  data_present: boolean;
  reset_count: number;
  last_migration_status: 'passed' | 'failed' | 'not_run';
  selected_backup_id?: string;
}

export interface EnvironmentState {
  kind: 'local_dev' | 'staging' | 'production';
  is_disposable: boolean;
  databases: string[];
}

export interface BackupRecord {
  backup_id: string;
  created_at: string;
  schema_version: string;
  compatible_schema_versions: string[];
  data_revision: number;
}

export interface SimulatorState {
  schema_version: number;
  environments: Record<string, EnvironmentState>;
  databases: Record<string, DatabaseState>;
  backups: Record<string, BackupRecord>;
}

export interface InvariantRule {
  invariant_id: string;
  rule_type: string;
  severity: SeverityLevel;
  enabled: boolean;
  parameters: Record<string, any>;
  description: string;
  source: 'profile' | 'user' | 'model-suggested';
  confirmed: boolean;
}

export interface InvariantResult {
  invariant_id: string;
  candidate_id: string;
  passed: boolean;
  severity: SeverityLevel;
  rule_type: string;
  description: string;
  evidence: {
    message: string;
    target_path?: string;
    actual_value?: any;
    expected_value?: any;
  };
}

export interface Finding {
  id: string;
  finding_key: string;
  category: DivergenceCategory;
  severity: SeverityLevel;
  interpretation_ids: string[];
  violated_invariants: string[];
  plain_language_consequence: string;
  minimality: string;
  source_spans: SourceSpan[];
  state_diffs: Array<{
    path: string;
    baseline: any;
    candidate_values: Record<string, any>;
  }>;
}

export interface ReproducibilityManifest {
  procedure_version_id: string;
  procedure_sha256: string;
  profile_id: string;
  profile_version: string;
  initial_state_hash: string;
  seed: number;
  simulator_version: string;
  action_catalog_version: string;
  invariant_pack_version: string;
  prompt_template_version: string;
  normalized_trace_hash: string;
  final_state_hash: string;
}

export interface AnalysisRun {
  run_id: string;
  parent_run_id?: string;
  procedure_id: string;
  procedure_version_id: string;
  procedure_text: string;
  profile_id: string;
  profile_version: string;
  status: RunStatus;
  stage: RunStage;
  seed: number;
  candidate_limit: number;
  started_at: string;
  finished_at?: string;
  candidates: CandidateInterpretation[];
  traces: Record<string, TraceEvent[]>;
  initial_state: SimulatorState;
  final_states: Record<string, SimulatorState>;
  invariant_results: InvariantResult[];
  findings: Finding[];
  manifest: ReproducibilityManifest;
  error_code?: string;
}

export interface RepairProposal {
  id: string;
  parent_run_id: string;
  target_finding_ids: string[];
  proposed_text: string;
  rationale: string;
  resolution_strategy: string;
  verification_run_id?: string;
  verification_status?: 'UNVERIFIED' | 'RUNNING' | 'VERIFIED' | 'FAILED';
}

export interface ScenarioProfile {
  id: string;
  name: string;
  version: string;
  description: string;
  environments: Record<string, EnvironmentState>;
  registered_actions: Array<{
    name: string;
    description: string;
    parameters_schema: Record<string, string>;
  }>;
  invariants: InvariantRule[];
}
