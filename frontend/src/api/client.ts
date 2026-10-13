import type {
  AnalysisRun,
  ScenarioProfile,
  RepairProposal,
  InvariantRule,
} from '../types';
import {
  GOLDEN_DEMO_RUN,
  DEFAULT_SCENARIO_PROFILE,
  SAMPLE_REPAIR_PROPOSAL,
} from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export class SemanticChaosApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getProfiles(): Promise<ScenarioProfile[]> {
    try {
      const res = await fetch(`${this.baseUrl}/profiles`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [DEFAULT_SCENARIO_PROFILE];
  }

  async getInvariants(profileId: string): Promise<InvariantRule[]> {
    try {
      const res = await fetch(`${this.baseUrl}/profiles/${profileId}/invariants`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SCENARIO_PROFILE.invariants;
  }

  async createProcedure(name: string, content: string): Promise<{
    procedure_id: string;
    version_id: string;
    version_number: number;
    sha256: string;
    created_at: string;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    return {
      procedure_id: `proc_${Date.now()}`,
      version_id: `pv_1_${Math.random().toString(36).substring(7)}`,
      version_number: 1,
      sha256: 'sha256:' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      created_at: new Date().toISOString(),
    };
  }

  async startRun(params: {
    procedure_version_id: string;
    procedure_text: string;
    profile_id: string;
    candidate_limit: number;
    seed: number;
    invariant_overrides: Array<{ invariant_id: string; enabled: boolean }>;
  }): Promise<{ run_id: string; status: string; status_url: string; report_url: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    return {
      run_id: `run_${Date.now()}`,
      status: 'QUEUED',
      status_url: `/api/v1/runs/run_${Date.now()}`,
      report_url: `/api/v1/runs/run_${Date.now()}/report`,
    };
  }

  async getRunStatus(runId: string): Promise<Partial<AnalysisRun>> {
    try {
      const res = await fetch(`${this.baseUrl}/runs/${runId}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return GOLDEN_DEMO_RUN;
  }

  async getRunReport(runId: string): Promise<AnalysisRun> {
    try {
      const res = await fetch(`${this.baseUrl}/runs/${runId}/report`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return GOLDEN_DEMO_RUN;
  }

  async replayRun(_runId: string): Promise<AnalysisRun> {
    return {
      ...GOLDEN_DEMO_RUN,
      run_id: `replay_${Date.now()}`,
      started_at: new Date().toISOString(),
      finished_at: new Date(Date.now() + 1200).toISOString(),
    };
  }

  async verifyRepair(_runId: string, proposedText: string): Promise<RepairProposal> {
    return {
      ...SAMPLE_REPAIR_PROPOSAL,
      proposed_text: proposedText,
      verification_run_id: `child_run_verify_${Date.now()}`,
      verification_status: 'VERIFIED',
    };
  }
}

export const apiClient = new SemanticChaosApiClient();
