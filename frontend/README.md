# Semantic Chaos Monkey — Product UI (Frontend)

> **"Break the meaning, not the code."**  
> Operational Procedure Safety Simulator built with React, TypeScript, and Vite.

---

## 📁 Folder Structure

```
frontend/
├── index.html                 # App entry with Outfit, Plus Jakarta Sans & JetBrains Mono typography
├── package.json               # Dependencies (React 19, Lucide React, Vite, TypeScript)
├── tsconfig.json              # TypeScript root configuration
├── tsconfig.app.json          # Strict type-checking rules
├── vite.config.ts             # Vite bundler configuration
└── src/
    ├── api/                   # Typed REST API Client & Golden Benchmarks
    │   ├── client.ts          # SemanticChaosApiClient (TRD Section 09 REST endpoints)
    │   └── mockData.ts        # Flagship golden scenario (AT-01 through AT-08 fixtures)
    ├── components/
    │   └── common/            # Reusable UI primitives
    │       ├── Badge.tsx      # Severity & status badge pills (CRITICAL, HIGH, PASS, etc.)
    │       ├── Navbar.tsx     # Application header with status telemetry
    │       └── TabNavigation.tsx # Screen switcher across the 6 core workflows
    ├── features/              # Feature modules mapped directly to TRD Section 10
    │   ├── procedures/        # Procedure Intake & Invariant Checklist (TRD Section 04)
    │   │   └── ProcedureEditor.tsx
    │   ├── runs/              # 9-Stage Orchestrator Pipeline Stepper (TRD Section 03 & 05)
    │   │   └── RunStageStepper.tsx
    │   ├── interpretations/   # Competing Candidate Plans Explorer (TRD Section 04.3)
    │   │   └── CandidateComparison.tsx
    │   ├── findings/          # Material Divergence & In-Memory State Diffs (TRD Section 06)
    │   │   └── FindingsAnalyzer.tsx
    │   ├── repairs/           # Guided Rewrite & Child Run Verification (TRD Section 07)
    │   │   └── RepairWorkspace.tsx
    │   └── exports/           # Cryptographic Manifest & Deterministic Replay (TRD Section 07.3)
    │       └── ReproducibilityView.tsx
    ├── types/                 # Pure TypeScript domain contracts
    │   └── index.ts           # Strictly mirrors backend Pydantic models
    ├── App.tsx                # Master orchestration UI wiring
    ├── index.css              # Obsidian glassmorphic dark design system
    └── main.tsx               # React root mounting
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Production Build
```bash
npm run build
```

---

## 🛡️ Core Product Workflows

1. **Procedure Intake & Invariant Suite**: Enter runbook instructions or load curated presets, configure invariant bounds, seed, and candidate counts up to the 32 KiB cap.
2. **Pipeline Orchestrator**: Follow the 9 bounded execution stages (`INTAKE` ➔ `CONTEXT` ➔ `GENERATE` ➔ `COMPILE` ➔ `SIMULATE` ➔ `EVALUATE` ➔ `REDUCE` ➔ `REPAIR` ➔ `REPORT`).
3. **Competing Plans Explorer**: Compare 3-5 grounded interpretations side-by-side with inferred assumptions, character offsets, and ordered action sequences.
4. **Divergence & State Diffs**: Deep-dive into computed state diffs and invariant violations (e.g. wiping protected production data).
5. **Repair Workspace**: Edit guided hardened procedures and trigger verified child simulation runs.
6. **Reproducibility Manifest**: Inspect cryptographic hashes (`sha256`, seed, profile version) and run instant replay without LLM invocations.
