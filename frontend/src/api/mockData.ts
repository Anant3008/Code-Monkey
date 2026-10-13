import type {
  AnalysisRun,
  ScenarioProfile,
  RepairProposal,
} from '../types';

export const DEFAULT_PROCEDURE_TEXT = `Database Deployment & Migration Runbook:
Reset the database, migrate the schema, and restore the latest backup if necessary.`;

export const DEFAULT_SCENARIO_PROFILE: ScenarioProfile = {
  id: 'deployment-db',
  name: 'Database Deployment & Migration Sandbox',
  version: '1.0',
  description: 'Deterministic synthetic environment with isolated dev, staging, and protected production database clusters.',
  environments: {
    'local-dev': {
      kind: 'local_dev',
      is_disposable: true,
      databases: ['app-dev'],
    },
    staging: {
      kind: 'staging',
      is_disposable: true,
      databases: ['app-staging'],
    },
    production: {
      kind: 'production',
      is_disposable: false,
      databases: ['orders-prod'],
    },
  },
  registered_actions: [
    {
      name: 'database.reset',
      description: 'Marks target synthetic database as wiped and increments reset counter.',
      parameters_schema: { environment_id: 'string', database_id: 'string' },
    },
    {
      name: 'database.migrate',
      description: 'Applies schema migrations to target version.',
      parameters_schema: {
        environment_id: 'string',
        database_id: 'string',
        target_schema_version: 'string',
      },
    },
    {
      name: 'database.validate_migration',
      description: 'Validates schema integrity and data compatibility.',
      parameters_schema: { environment_id: 'string', database_id: 'string' },
    },
    {
      name: 'backup.restore',
      description: 'Restores snapshot metadata from specified backup ID.',
      parameters_schema: {
        environment_id: 'string',
        database_id: 'string',
        backup_id: 'string',
      },
    },
  ],
  invariants: [
    {
      invariant_id: 'production_data_preserved',
      rule_type: 'production_data_preserved',
      severity: 'CRITICAL',
      enabled: true,
      parameters: { actions: ['database.reset', 'database.wipe'] },
      description: 'Production data must never be wiped or reset in a simulated plan.',
      source: 'profile',
      confirmed: true,
    },
    {
      invariant_id: 'destructive_target_must_be_disposable',
      rule_type: 'destructive_target_must_be_disposable',
      severity: 'CRITICAL',
      enabled: true,
      parameters: {},
      description: 'Every destructive operation must target a declared disposable environment.',
      source: 'profile',
      confirmed: true,
    },
    {
      invariant_id: 'restore_backup_schema_compatible',
      rule_type: 'restore_backup_schema_compatible',
      severity: 'HIGH',
      enabled: true,
      parameters: {},
      description: 'Selected restored backup must match target schema version compatibility table.',
      source: 'profile',
      confirmed: true,
    },
    {
      invariant_id: 'restore_requires_validation_failure',
      rule_type: 'restore_requires_validation_failure',
      severity: 'HIGH',
      enabled: true,
      parameters: {},
      description: 'Restore action must only execute conditionally if migration validation fails.',
      source: 'profile',
      confirmed: true,
    },
  ],
};

export const GOLDEN_DEMO_RUN: AnalysisRun = {
  run_id: 'run_flagship_8941',
  procedure_id: 'proc_deploy_runbook',
  procedure_version_id: 'pv_v1_9a12c',
  procedure_text: DEFAULT_PROCEDURE_TEXT,
  profile_id: 'deployment-db',
  profile_version: '1.0',
  status: 'FAIL',
  stage: 'REPORT',
  seed: 41027,
  candidate_limit: 3,
  started_at: '2026-10-13T12:00:00.000Z',
  finished_at: '2026-10-13T12:00:14.240Z',
  manifest: {
    procedure_version_id: 'pv_v1_9a12c',
    procedure_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    profile_id: 'deployment-db',
    profile_version: '1.0',
    initial_state_hash: 'sha256:88fa2981a3d07e6b0a7c',
    seed: 41027,
    simulator_version: '1.0.0',
    action_catalog_version: '1.0',
    invariant_pack_version: '1.0',
    prompt_template_version: 'interpretation/1.0',
    normalized_trace_hash: 'sha256:4d70b72c91834f828a2b',
    final_state_hash: 'sha256:7bc0386ff01da28741e9',
  },
  initial_state: {
    schema_version: 1,
    environments: DEFAULT_SCENARIO_PROFILE.environments,
    databases: {
      'app-dev': {
        environment_id: 'local-dev',
        schema_version: 'schema_v1.2',
        data_revision: 4,
        data_present: true,
        reset_count: 0,
        last_migration_status: 'not_run',
      },
      'app-staging': {
        environment_id: 'staging',
        schema_version: 'schema_v1.2',
        data_revision: 12,
        data_present: true,
        reset_count: 0,
        last_migration_status: 'not_run',
      },
      'orders-prod': {
        environment_id: 'production',
        schema_version: 'schema_v1.2',
        data_revision: 840,
        data_present: true,
        reset_count: 0,
        last_migration_status: 'not_run',
      },
    },
    backups: {
      'bak-yesterday-v12': {
        backup_id: 'bak-yesterday-v12',
        created_at: '2026-10-12T04:00:00Z',
        schema_version: 'schema_v1.2',
        compatible_schema_versions: ['schema_v1.2'],
        data_revision: 830,
      },
      'bak-lasthour-v20': {
        backup_id: 'bak-lasthour-v20',
        created_at: '2026-10-13T10:00:00Z',
        schema_version: 'schema_v2.0-beta',
        compatible_schema_versions: ['schema_v2.0-beta'],
        data_revision: 842,
      },
    },
  },
  final_states: {
    candidate_01: {
      schema_version: 1,
      environments: DEFAULT_SCENARIO_PROFILE.environments,
      databases: {
        'app-dev': {
          environment_id: 'local-dev',
          schema_version: 'schema_v2.0',
          data_revision: 0,
          data_present: true,
          reset_count: 1,
          last_migration_status: 'passed',
        },
        'app-staging': {
          environment_id: 'staging',
          schema_version: 'schema_v1.2',
          data_revision: 12,
          data_present: true,
          reset_count: 0,
          last_migration_status: 'not_run',
        },
        'orders-prod': {
          environment_id: 'production',
          schema_version: 'schema_v1.2',
          data_revision: 840,
          data_present: true,
          reset_count: 0,
          last_migration_status: 'not_run',
        },
      },
      backups: {},
    },
    candidate_02: {
      schema_version: 1,
      environments: DEFAULT_SCENARIO_PROFILE.environments,
      databases: {
        'app-dev': {
          environment_id: 'local-dev',
          schema_version: 'schema_v1.2',
          data_revision: 4,
          data_present: true,
          reset_count: 0,
          last_migration_status: 'not_run',
        },
        'app-staging': {
          environment_id: 'staging',
          schema_version: 'schema_v1.2',
          data_revision: 12,
          data_present: true,
          reset_count: 0,
          last_migration_status: 'not_run',
        },
        'orders-prod': {
          environment_id: 'production',
          schema_version: 'schema_v2.0',
          data_revision: 0,
          data_present: false, // CRITICAL LOSS!
          reset_count: 1,
          last_migration_status: 'passed',
        },
      },
      backups: {},
    },
    candidate_03: {
      schema_version: 1,
      environments: DEFAULT_SCENARIO_PROFILE.environments,
      databases: {
        'app-dev': {
          environment_id: 'local-dev',
          schema_version: 'schema_v1.2',
          data_revision: 4,
          data_present: true,
          reset_count: 0,
          last_migration_status: 'not_run',
        },
        'app-staging': {
          environment_id: 'staging',
          schema_version: 'schema_v2.0-beta',
          data_revision: 842,
          data_present: true,
          reset_count: 1,
          last_migration_status: 'passed',
          selected_backup_id: 'bak-lasthour-v20',
        },
        'orders-prod': {
          environment_id: 'production',
          schema_version: 'schema_v1.2',
          data_revision: 840,
          data_present: true,
          reset_count: 0,
          last_migration_status: 'not_run',
        },
      },
      backups: {},
    },
  },
  candidates: [
    {
      candidate_id: 'candidate_01',
      summary: 'Safe Local Sandbox Execution',
      plausibility: 'SUPPORTED',
      compile_status: 'ACCEPTED',
      executed: true,
      assumptions: [
        {
          kind: 'target_environment',
          value: 'local-dev',
          source_span_ids: ['span_reset'],
          is_explicit_in_source: false,
        },
        {
          kind: 'restore_trigger',
          value: 'only on validation failure',
          source_span_ids: ['span_restore'],
          is_explicit_in_source: false,
        },
      ],
      source_spans: [
        { start: 40, end: 58, quote: 'Reset the database' },
        { start: 60, end: 77, quote: 'migrate the schema' },
        { start: 83, end: 126, quote: 'restore the latest backup if necessary' },
      ],
      actions: [
        {
          name: 'database.reset',
          parameters: { environment_id: 'local-dev', database_id: 'app-dev' },
          preconditions: [{ id: 'target_disposable', passed: true }],
        },
        {
          name: 'database.migrate',
          parameters: {
            environment_id: 'local-dev',
            database_id: 'app-dev',
            target_schema_version: 'schema_v2.0',
          },
          preconditions: [{ id: 'schema_ready', passed: true }],
        },
        {
          name: 'database.validate_migration',
          parameters: { environment_id: 'local-dev', database_id: 'app-dev' },
          preconditions: [{ id: 'migration_completed', passed: true }],
        },
      ],
      rationale:
        'The operational prompt does not specify a target environment. A cautious operator chooses the disposable local-dev database and only executes restore if verification indicates corrupted tables.',
    },
    {
      candidate_id: 'candidate_02',
      summary: 'Production Direct Reset (Catastrophic Divergence)',
      plausibility: 'SUPPORTED',
      compile_status: 'ACCEPTED',
      executed: true,
      assumptions: [
        {
          kind: 'target_environment',
          value: 'production',
          source_span_ids: ['span_reset'],
          is_explicit_in_source: false,
        },
        {
          kind: 'backup_timing',
          value: 'skip restore because migration succeeded',
          source_span_ids: ['span_restore'],
          is_explicit_in_source: false,
        },
      ],
      source_spans: [
        { start: 40, end: 58, quote: 'Reset the database' },
        { start: 60, end: 77, quote: 'migrate the schema' },
      ],
      actions: [
        {
          name: 'database.reset',
          parameters: { environment_id: 'production', database_id: 'orders-prod' },
          preconditions: [{ id: 'target_disposable', passed: false }],
        },
        {
          name: 'database.migrate',
          parameters: {
            environment_id: 'production',
            database_id: 'orders-prod',
            target_schema_version: 'schema_v2.0',
          },
          preconditions: [{ id: 'schema_ready', passed: true }],
        },
      ],
      rationale:
        'In incident response or deployment runbooks, runbooks are frequently executed in the primary production context unless explicitly gated. The operator resets the live database to clean slate.',
    },
    {
      candidate_id: 'candidate_03',
      summary: 'Staging Unconditional Incompatible Restore',
      plausibility: 'SUPPORTED',
      compile_status: 'ACCEPTED',
      executed: true,
      assumptions: [
        {
          kind: 'target_environment',
          value: 'staging',
          source_span_ids: ['span_reset'],
          is_explicit_in_source: false,
        },
        {
          kind: 'backup_selection',
          value: 'newest timestamp regardless of schema compatibility',
          source_span_ids: ['span_restore'],
          is_explicit_in_source: false,
        },
      ],
      source_spans: [
        { start: 83, end: 126, quote: 'restore the latest backup if necessary' },
      ],
      actions: [
        {
          name: 'database.reset',
          parameters: { environment_id: 'staging', database_id: 'app-staging' },
          preconditions: [{ id: 'target_disposable', passed: true }],
        },
        {
          name: 'backup.restore',
          parameters: {
            environment_id: 'staging',
            database_id: 'app-staging',
            backup_id: 'bak-lasthour-v20',
          },
          preconditions: [{ id: 'schema_compatible', passed: false }],
        },
      ],
      rationale:
        'Operator interpreted "if necessary" as preventative hygiene and picked newest timestamp backup without checking schema compatibility.',
    },
  ],
  traces: {
    candidate_01: [
      {
        sequence: 1,
        candidate_id: 'candidate_01',
        action: 'database.reset',
        parameters: { environment_id: 'local-dev', database_id: 'app-dev' },
        preconditions: [{ id: 'target_disposable', passed: true }],
        state_before_hash: 'sha256:88fa2981a3d07e6b0a7c',
        state_after_hash: 'sha256:11bb22cc33dd44ee55ff',
        changed_paths: ['databases.app-dev.data_present', 'databases.app-dev.reset_count'],
        handler_version: 'deployment-db-actions/1.0',
        timestamp_offset_ms: 12,
      },
      {
        sequence: 2,
        candidate_id: 'candidate_01',
        action: 'database.migrate',
        parameters: {
          environment_id: 'local-dev',
          database_id: 'app-dev',
          target_schema_version: 'schema_v2.0',
        },
        preconditions: [{ id: 'schema_ready', passed: true }],
        state_before_hash: 'sha256:11bb22cc33dd44ee55ff',
        state_after_hash: 'sha256:22cc33dd44ee55ff66aa',
        changed_paths: ['databases.app-dev.schema_version', 'databases.app-dev.last_migration_status'],
        handler_version: 'deployment-db-actions/1.0',
        timestamp_offset_ms: 38,
      },
    ],
    candidate_02: [
      {
        sequence: 1,
        candidate_id: 'candidate_02',
        action: 'database.reset',
        parameters: { environment_id: 'production', database_id: 'orders-prod' },
        preconditions: [{ id: 'target_disposable', passed: false }],
        state_before_hash: 'sha256:88fa2981a3d07e6b0a7c',
        state_after_hash: 'sha256:99ff88ee77dd66cc55bb',
        changed_paths: [
          'databases.orders-prod.data_present',
          'databases.orders-prod.reset_count',
          'databases.orders-prod.data_revision',
        ],
        handler_version: 'deployment-db-actions/1.0',
        timestamp_offset_ms: 15,
      },
      {
        sequence: 2,
        candidate_id: 'candidate_02',
        action: 'database.migrate',
        parameters: {
          environment_id: 'production',
          database_id: 'orders-prod',
          target_schema_version: 'schema_v2.0',
        },
        preconditions: [{ id: 'schema_ready', passed: true }],
        state_before_hash: 'sha256:99ff88ee77dd66cc55bb',
        state_after_hash: 'sha256:aa001122334455667788',
        changed_paths: ['databases.orders-prod.schema_version'],
        handler_version: 'deployment-db-actions/1.0',
        timestamp_offset_ms: 45,
      },
    ],
    candidate_03: [
      {
        sequence: 1,
        candidate_id: 'candidate_03',
        action: 'database.reset',
        parameters: { environment_id: 'staging', database_id: 'app-staging' },
        preconditions: [{ id: 'target_disposable', passed: true }],
        state_before_hash: 'sha256:88fa2981a3d07e6b0a7c',
        state_after_hash: 'sha256:55aa66bb77cc88dd99ee',
        changed_paths: ['databases.app-staging.data_present', 'databases.app-staging.reset_count'],
        handler_version: 'deployment-db-actions/1.0',
        timestamp_offset_ms: 14,
      },
      {
        sequence: 2,
        candidate_id: 'candidate_03',
        action: 'backup.restore',
        parameters: {
          environment_id: 'staging',
          database_id: 'app-staging',
          backup_id: 'bak-lasthour-v20',
        },
        preconditions: [{ id: 'schema_compatible', passed: false }],
        state_before_hash: 'sha256:55aa66bb77cc88dd99ee',
        state_after_hash: 'sha256:7bc0386ff01da28741e9',
        changed_paths: ['databases.app-staging.selected_backup_id', 'databases.app-staging.data_revision'],
        handler_version: 'deployment-db-actions/1.0',
        timestamp_offset_ms: 50,
      },
    ],
  },
  invariant_results: [
    {
      invariant_id: 'production_data_preserved',
      candidate_id: 'candidate_02',
      passed: false,
      severity: 'CRITICAL',
      rule_type: 'production_data_preserved',
      description: 'Production data must never be wiped or reset in a simulated plan.',
      evidence: {
        message: 'database.reset wiped production database "orders-prod". Data present was set from true to false.',
        target_path: 'databases.orders-prod.data_present',
        actual_value: false,
        expected_value: true,
      },
    },
    {
      invariant_id: 'destructive_target_must_be_disposable',
      candidate_id: 'candidate_02',
      passed: false,
      severity: 'CRITICAL',
      rule_type: 'destructive_target_must_be_disposable',
      description: 'Every destructive operation must target a declared disposable environment.',
      evidence: {
        message: 'Target environment "production" has is_disposable=false.',
        target_path: 'environments.production.is_disposable',
        actual_value: false,
        expected_value: true,
      },
    },
    {
      invariant_id: 'restore_requires_validation_failure',
      candidate_id: 'candidate_03',
      passed: false,
      severity: 'HIGH',
      rule_type: 'restore_requires_validation_failure',
      evidence: {
        message: 'backup.restore executed without a recorded migration validation failure in trace.',
      },
      description: 'Restore action must only execute conditionally if migration validation fails.',
    },
  ],
  findings: [
    {
      id: 'finding_001',
      finding_key: 'TARGET_ENVIRONMENT_AMBIGUITY',
      category: 'TARGET',
      severity: 'CRITICAL',
      interpretation_ids: ['candidate_01', 'candidate_02'],
      violated_invariants: ['production_data_preserved', 'destructive_target_must_be_disposable'],
      plain_language_consequence:
        'Missing environment qualification caused Candidate 2 to target non-disposable Production database "orders-prod", wiping active transactions and breaching critical invariant.',
      minimality: 'Minimal ambiguity isolated within 20-evaluation search budget: clause "Reset the database"',
      source_spans: [{ start: 40, end: 58, quote: 'Reset the database' }],
      state_diffs: [
        {
          path: 'databases.orders-prod.data_present',
          baseline: true,
          candidate_values: { candidate_01: true, candidate_02: false },
        },
        {
          path: 'databases.orders-prod.reset_count',
          baseline: 0,
          candidate_values: { candidate_01: 0, candidate_02: 1 },
        },
      ],
    },
    {
      id: 'finding_002',
      finding_key: 'RESTORE_TRIGGER_PREDICATE_UNSPECIFIED',
      category: 'CONDITION',
      severity: 'HIGH',
      interpretation_ids: ['candidate_01', 'candidate_03'],
      violated_invariants: ['restore_requires_validation_failure'],
      plain_language_consequence:
        'Phrase "if necessary" is underspecified. Candidate 3 interpreted it as proactive hygiene, triggering an unexpected restore sequence.',
      minimality: 'Minimal clause: "if necessary"',
      source_spans: [{ start: 83, end: 126, quote: 'restore the latest backup if necessary' }],
      state_diffs: [
        {
          path: 'databases.app-staging.selected_backup_id',
          baseline: null,
          candidate_values: { candidate_01: null, candidate_03: 'bak-lasthour-v20' },
        },
      ],
    },
  ],
};

export const SAMPLE_REPAIR_PROPOSAL: RepairProposal = {
  id: 'rep_001',
  parent_run_id: 'run_flagship_8941',
  target_finding_ids: ['finding_001', 'finding_002'],
  proposed_text: `Database Deployment & Migration Runbook (Hardened):
In the local-dev environment only:
1. Reset the app-dev database.
2. Apply pending migrations up to schema_v2.0.
3. Validate migration integrity.
4. If and only if migration validation fails, restore backup bak-yesterday-v12.`,
  rationale:
    'Explicitly scopes the environment to local-dev, binds the database target to app-dev, pins the migration version, and converts the ambiguous "if necessary" predicate into a strict conditional failure gate.',
  resolution_strategy: 'Target Scoping + Conditional Predicate Pinning',
  verification_status: 'UNVERIFIED',
};
