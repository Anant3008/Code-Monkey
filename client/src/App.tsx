import { lazy, Suspense, useEffect, useRef, useState } from "react"

const MultiverseScene = lazy(() => import("./MultiverseScene"))

type IconProps = {
  name: string
  size?: number
}

function Icon({ name, size = 18 }: IconProps) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    branch: (
      <>
        <circle cx="6" cy="5" r="2" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="5" r="2" />
        <path d="M6 7v10M6 13h5a7 7 0 0 0 7-6" />
      </>
    ),
    cube: (
      <>
        <path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8" />
      </>
    ),
    code: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v.1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.branch}
    </svg>
  )
}

const scenarios = [
  { label: "Data cleanup", text: "Delete old user records", category: "data" },
  {
    label: "Access control",
    text: "Give the team access to customer data",
    category: "access",
  },
  {
    label: "System operations",
    text: "Restart services that are not responding",
    category: "system",
  },
]
const branches = {
  data: [
    {
      title: "Time is the boundary",
      interpretation:
        "“Old” means created more than 90 days ago. Delete all matching user records.",
      outcome: "12,408 records deleted",
      detail:
        "Includes 3,216 active customers. Account age is mistaken for inactivity, permanently removing live accounts.",
      risk: "Critical risk",
      metric: "3,216",
      metricLabel: "active users affected",
      code: "DELETE FROM users\nWHERE created_at < NOW() - INTERVAL '90 days';",
    },
    {
      title: "Silence means absence",
      interpretation:
        "“Old” means no activity in the last 90 days. Remove inactive accounts.",
      outcome: "2,184 records deleted",
      detail:
        "Seasonal users and customers on leave lose their accounts. No retention policy or recovery window is applied.",
      risk: "Moderate risk",
      metric: "2,184",
      metricLabel: "accounts without recovery",
      code: "DELETE FROM users\nWHERE last_active_at < NOW() - INTERVAL '90 days';",
    },
    {
      title: "Archive, don’t erase",
      interpretation:
        "“Old” means inactive for a year. Soft-delete records after a retention check.",
      outcome: "846 records archived",
      detail:
        "Records remain recoverable for 30 days. Accounts under a legal hold are excluded, preserving compliance.",
      risk: "Low risk",
      metric: "0",
      metricLabel: "irreversible deletions",
      code: "UPDATE users SET archived_at = NOW()\nWHERE last_active_at < NOW() - INTERVAL '1 year'\nAND legal_hold = FALSE;",
    },
  ],
  access: [
    {
      title: "Everyone is the team",
      interpretation:
        "Grant all organization members unrestricted access to customer data.",
      outcome: "148 users granted access",
      detail:
        "External contractors gain access to personal and financial information with no role restrictions.",
      risk: "Critical risk",
      metric: "32",
      metricLabel: "external accounts exposed",
      code: "GRANT ALL ON customer_data\nTO organization_members;",
    },
    {
      title: "Access means read",
      interpretation:
        "Grant the customer success team read access to all customer records.",
      outcome: "24 users granted access",
      detail:
        "Read-only permissions prevent edits, but sensitive fields remain visible beyond the team’s operational needs.",
      risk: "Moderate risk",
      metric: "8",
      metricLabel: "sensitive fields exposed",
      code: "GRANT SELECT ON customer_data\nTO customer_success;",
    },
    {
      title: "Least privilege first",
      interpretation:
        "Grant approved team members read access to a redacted customer view.",
      outcome: "12 scoped grants created",
      detail:
        "Only approved staff can read necessary fields. Grants expire after 30 days and all access is logged.",
      risk: "Low risk",
      metric: "0",
      metricLabel: "sensitive fields exposed",
      code: "GRANT SELECT ON customers_redacted\nTO approved_support_role;",
    },
  ],
  system: [
    {
      title: "Restart everything",
      interpretation: "Restart every service that fails a single health check.",
      outcome: "18 services restarted",
      detail:
        "Transient network errors trigger simultaneous restarts and interrupt active customer transactions.",
      risk: "Critical risk",
      metric: "1,204",
      metricLabel: "requests interrupted",
      code: "services.filter(s => !s.healthy)\n  .forEach(s => s.restart());",
    },
    {
      title: "Wait, then restart",
      interpretation: "Restart services after three failed health checks.",
      outcome: "6 services restarted",
      detail:
        "Failure is confirmed, but services restart together without draining in-flight requests.",
      risk: "Moderate risk",
      metric: "86",
      metricLabel: "requests interrupted",
      code: "services.filter(s => s.failures >= 3)\n  .forEach(s => s.restart());",
    },
    {
      title: "Recover gracefully",
      interpretation:
        "Confirm failure, drain traffic, then restart one service at a time.",
      outcome: "6 services recovered",
      detail:
        "Rolling recovery preserves availability. Each service must pass a health check before the next restart.",
      risk: "Low risk",
      metric: "0",
      metricLabel: "requests interrupted",
      code: "await drain(service);\nawait restart(service);\nawait verifyHealthy(service);",
    },
  ],
}

export default function App() {
  const [instruction, setInstruction] = useState(scenarios[0].text)
  const [category, setCategory] = useState<"data" | "access" | "system">("data")
  const [phase, setPhase] =
    useState<"edit" | "loading" | "explore" | "compare">("edit")
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [modal, setModal] = useState<"about" | "history" | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [analyzedInstruction, setAnalyzedInstruction] = useState("")
  const [sceneReady, setSceneReady] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const realities = [
    branches[category][2],
    branches[category][1],
    branches[category][0],
  ]
  const impactValues = realities.map((reality) =>
    Number(reality.metric.replace(/,/g, "")),
  )
  const maxImpact = Math.max(...impactValues, 1)
  const ready = phase === "explore" || phase === "compare"
  function reset() {
    if (timer.current) clearTimeout(timer.current)
    setPhase("edit")
    setSelected(null)
    setError("")
  }
  const corrected =
    category === "data"
      ? "Archive user accounts with no activity for 365 days, excluding accounts under legal hold. Retain records for 30 days before permanent deletion. Generate a dry-run report and require approval before execution."
      : category === "access"
        ? "Grant approved customer success staff read-only access to the redacted customer view for 30 days. Exclude financial and personal identifiers. Log all access and require manager approval."
        : "Restart a service only after three consecutive failed health checks. Drain in-flight requests first, restart one service at a time, and verify recovery before proceeding."
  function explore() {
    if (instruction.trim().length < 10) {
      setError("Add a little more context — at least 10 characters.")
      return
    }
    setError("")
    setSelected(null)
    setPhase("loading")
    setAnalyzedInstruction(instruction)
    setCategory(
      /access|permission|team|share/i.test(instruction)
        ? "access"
        : /restart|service|server/i.test(instruction)
          ? "system"
          : "data",
    )
    timer.current = setTimeout(() => {
      setPhase("compare")
      setHistory((h) => [instruction, ...h].slice(0, 8))
    }, 1800)
  }
  return (
    <div className={`app phase-${phase}`}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            reset()
          }}
        >
          <span className="brand-symbol">
            <Icon name="cube" size={22} />
          </span>
          <span>
            SEMANTIC<span className="brand-light"> CHAOS MONKEY</span>
          </span>
          <span className="beta">BETA</span>
        </a>
        <nav>
          <button onClick={() => setModal("history")}>
            <Icon name="clock" size={15} /> Run history{" "}
            <span className="nav-count">
              {history.length.toString().padStart(2, "0")}
            </span>
          </button>
          <span className="nav-divider" />
          <button onClick={() => setModal("about")}>
            How it works <Icon name="info" size={15} />
          </button>
          <span className="avatar">JD</span>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="status-dot" /> THE AMBIGUITY EXPLORER{" "}
              <span className="eyebrow-line" /> EXPERIMENT 001
            </div>
            <h1>
              One instruction.
              <br />
              <span>Infinite ways</span>
              <br />
              to go wrong.
            </h1>
            <p>
              Language isn’t a straight line. Explore the space
              <br />
              between what you said and what your AI understood.
            </p>
          </div>
          <div className="intro-note">
            <Icon name="shield" size={16} />
            <span>
              A safe space for dangerous possibilities.
              <br />
              <strong>No real systems. No real consequences.</strong>
            </span>
          </div>
        </section>
        <section
          className={`exploration-stage ${phase === "loading" ? "is-loading" : ""}`}
        >
          <div className="workspace-body">
            <div className="editor-side">
              <div className="section-label">
                <span className="step">01</span> THE INSTRUCTION{" "}
                <span className="plain-label">INPUT</span>
              </div>
              <h2>Start with a few words.</h2>
              <p className="helper">
                We’ll follow them into three different worlds.
              </p>
              <div className={`editor ${error ? "invalid" : ""}`}>
                <div className="editor-head">
                  <span>
                    <Icon name="code" size={14} /> instruction.txt
                  </span>
                  <span>PLAIN TEXT</span>
                </div>
                <div className="textarea-wrap">
                  <span className="line-number">1</span>
                  <textarea
                    aria-label="Instruction to explore"
                    value={instruction}
                    onChange={(e) => {
                      setInstruction(e.target.value)
                      reset()
                    }}
                    disabled={phase === "loading"}
                    spellCheck={false}
                  />
                </div>
                <div className="editor-foot">
                  <span>
                    <span className="small-dot" /> Natural language
                  </span>
                  <span>{instruction.length} characters</span>
                </div>
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="examples">
                <span>TRY AN EXAMPLE</span>
                <div>
                  {scenarios.map((s) => (
                    <button
                      key={s.category}
                      className={instruction === s.text ? "active" : ""}
                      onClick={() => {
                        setInstruction(s.text)
                        reset()
                      }}
                    >
                      {s.label}
                      <Icon name="arrow" size={12} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="explore-button"
                disabled={phase === "loading"}
                onClick={explore}
              >
                <Icon
                  name={phase === "loading" ? "branch" : "bolt"}
                  size={17}
                />
                {phase === "loading"
                  ? "Opening parallel realities…"
                  : "Explore Realities"}
                <span>
                  {phase === "loading" ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="arrow" size={18} />
                  )}
                </span>
              </button>
              <div className="button-note">
                <Icon name="shield" size={12} /> Illustrative simulation · No
                commands executed
              </div>
            </div>
            <div
              className={`visual-side ${sceneReady ? "has-webgl" : ""} ${
                phase !== "edit" ? "awakened" : ""
              } ${selected !== null ? `focused focus-${selected}` : ""} ${
                hovered !== null ? `hover-${hovered}` : ""
              }`}
            >
              <div className="visual-top">
                <span>
                  <span className="status-dot" /> THE POSSIBILITY SPACE
                </span>
                <span className="mono">3 WORLDS / 1 ORIGIN</span>
              </div>
              <Suspense fallback={null}>
                <MultiverseScene
                  selected={selected}
                  hovered={hovered}
                  loading={phase === "loading"}
                  onReady={setSceneReady}
                />
              </Suspense>
              <div className="scene-camera">
                <div className="scene-floor" />
                <div className="scene-haze" />
                <svg
                  className="light-paths"
                  viewBox="0 0 800 680"
                  fill="none"
                  aria-hidden="true"
                >
                  <defs>
                    <filter id="pathGlow">
                      <feGaussianBlur stdDeviation="5" />
                    </filter>
                  </defs>
                  {[
                    "M400 565 C390 390 110 450 155 295",
                    "M400 565 C410 390 435 310 435 200",
                    "M400 565 C510 530 710 490 675 340",
                  ].map((d, i) => (
                    <g key={d} className={`light-path light-path-${i}`}>
                      <path d={d} filter="url(#pathGlow)" strokeWidth="7" />
                      <path d={d} strokeWidth="1.5" />
                    </g>
                  ))}
                </svg>
                <div className="particles" aria-hidden="true">
                  {Array.from({ length: 30 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        left: `${(i * 37 + 9) % 100}%`,
                        top: `${(i * 23 + 7) % 87}%`,
                        animationDelay: `${i * -0.7}s`,
                      }}
                    />
                  ))}
                </div>
                {realities.map((r, i) => (
                  <button
                    key={i}
                    aria-label={`Explore Reality 0${i + 1}: ${r.title}`}
                    aria-pressed={selected === i}
                    disabled={phase === "loading"}
                    className={`world world-${i}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    onClick={() => {
                      if (ready) setSelected(selected === i ? null : i)
                      else explore()
                    }}
                  >
                    <span className="portal-shadow" />
                    <span className="portal-assembly">
                      <span className="portal-aura" />
                      <span className="portal-back" />
                      <span className="portal-ring ring-back" />
                      <span className="portal-interior">
                        <span className="dimension-grid" />
                        <span className="inner-star" />
                        <span className="glass-shard shard-one" />
                        <span className="glass-shard shard-two" />
                        <span className="glass-shard shard-three" />
                      </span>
                      <span className="portal-ring ring-front" />
                      <span className="portal-highlight" />
                    </span>
                    <span className="world-label">
                      <span className="world-index">
                        0{i + 1} <span />{" "}
                        {["INTENDED", "ALTERNATIVE", "DANGEROUS"][i]}
                      </span>
                      <strong>
                        {ready
                          ? r.title
                          : [
                              "A world of intention",
                              "A different reading",
                              "An unintended consequence",
                            ][i]}
                      </strong>
                      <span className="world-preview">
                        {ready ? r.outcome : "Follow this interpretation"}{" "}
                        <Icon name="arrow" size={13} />
                      </span>
                    </span>
                  </button>
                ))}
                <div className="origin-object">
                  <span>
                    <Icon name="branch" size={20} />
                  </span>
                  <div>
                    <small>THE POINT OF DIVERGENCE</small>
                    <p>
                      {phase === "edit" ? instruction : analyzedInstruction}
                    </p>
                  </div>
                </div>
              </div>
              <div className="visual-bottom" aria-live="polite">
                <span>
                  <i />{" "}
                  {phase === "loading"
                    ? "BRANCHING REALITIES…"
                    : selected !== null
                      ? `INSIDE REALITY 0${selected + 1}`
                      : "HOVER TO DISCOVER · CLICK TO ENTER"}
                </span>
                <span>∞ POSSIBILITIES</span>
              </div>
              {selected !== null && (
                <button
                  className="return-worlds"
                  onClick={() => {
                    setSelected(null)
                    setPhase("compare")
                  }}
                >
                  ← Return to all realities
                </button>
              )}
              {selected !== null && ready && (
                <div className={`immersive-preview reality-${selected}`}>
                  <span className="mini-eyebrow">
                    REALITY 0{selected + 1} / SIMULATED OUTCOME
                  </span>
                  <h3>{realities[selected].outcome}</h3>
                  <p>{realities[selected].detail}</p>
                  <span className={`risk risk-${selected}`}>
                    {realities[selected].risk}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
        <section
          className={`realities-section ${
            phase === "explore" || phase === "compare" ? "revealed" : ""
          }`}
        >
          {ready && (
            <p className="simulation-notice">
              <Icon name="shield" size={14} /> Illustrative{" "}
              {category === "data"
                ? "data-cleanup"
                : category === "access"
                  ? "access-control"
                  : "system-recovery"}{" "}
              scenario. These are modeled possibilities, not live AI analysis.
            </p>
          )}
          <div className="results-heading">
            <div className="section-label">
              <span className="step">02</span> PARALLEL REALITIES{" "}
              <span className="reality-count">3 BRANCHES</span>
            </div>
            <span className="results-hint">
              {phase === "edit"
                ? "Your possibilities will unfold here"
                : phase === "loading"
                  ? "Tracing possible consequences…"
                  : "Same words. Different worlds."}
            </span>
            {(phase === "explore" || phase === "compare") && (
              <button
                className="compare-button"
                onClick={() => {
                  setPhase(phase === "compare" ? "explore" : "compare")
                  setSelected(null)
                }}
              >
                {phase === "compare" ? "Explore branches" : "Compare outcomes"}
                <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
          <div className="reality-grid">
            {realities.map((r, i) => (
              <button
                key={`${category}-${i}`}
                disabled={phase === "edit" || phase === "loading"}
                onClick={() => setSelected(selected === i ? null : i)}
                className={`reality-card reality-${i} ${
                  selected === i ? "selected" : ""
                }`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="card-top">
                  <span>
                    <span className="branch-dot" /> REALITY 0{i + 1}
                  </span>
                  <Icon name="branch" size={16} />
                </div>
                {phase === "edit" || phase === "loading" ? (
                  <>
                    <h3>
                      {
                        [
                          "The intended interpretation",
                          "The alternative reading",
                          "The dangerous assumption",
                        ][i]
                      }
                    </h3>
                    <p>
                      {
                        [
                          "A cautious, recoverable path through your instruction.",
                          "A plausible interpretation with unexpected trade-offs.",
                          "A literal reading. An irreversible ripple effect.",
                        ][i]
                      }
                    </p>
                    <div className="card-bottom">
                      <span className="pending-dot" /> Awaiting instruction{" "}
                      <Icon name="arrow" size={14} />
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{r.title}</h3>
                    <p>{r.interpretation}</p>
                    <div className="card-bottom">
                      <span className={`risk risk-${i}`}>{r.risk}</span>
                      <span>
                        {selected === i ? "Close branch" : "Enter reality"}
                        <Icon name="arrow" size={14} />
                      </span>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
          {selected !== null &&
            (phase === "explore" || phase === "compare") && (
              <div className={`branch-detail reality-${selected}`}>
                <div>
                  <span className="mini-eyebrow">
                    INSIDE REALITY 0{selected + 1}
                  </span>
                  <h2>{realities[selected].outcome}</h2>
                  <span className="detail-label">ASSUMPTION</span>
                  <p>{realities[selected].interpretation}</p>
                  <span className="detail-label">SIMULATED CONSEQUENCE</span>
                  <p>{realities[selected].detail}</p>
                </div>
                <pre>
                  <code>{realities[selected].code}</code>
                </pre>
                <div className="branch-metric">
                  <strong>{realities[selected].metric}</strong>
                  <span>{realities[selected].metricLabel}</span>
                </div>
              </div>
            )}
          {phase === "compare" && (
            <div className="comparison">
              <div className="comparison-title">
                <Icon name="branch" />
                <div>
                  <h2>The dangerous divergence</h2>
                  <p>An undefined boundary changes everything.</p>
                </div>
                <span className="risk risk-2">HIGH DIVERGENCE</span>
              </div>
              <div className="comparison-grid">
                {realities.map((r, i) => (
                  <div
                    className={`comparison-world reality-${i}`}
                    key={r.title}
                  >
                    <span className="mini-eyebrow">REALITY 0{i + 1}</span>
                    <h3>{r.outcome}</h3>
                    <div className="impact-meter">
                      <span
                        style={{
                          width: `${(impactValues[i] / maxImpact) * 100}%`,
                        }}
                      />
                    </div>
                    <strong className="impact-number">{r.metric}</strong>
                    <p>{r.metricLabel}</p>
                    <span className={`risk risk-${i}`}>{r.risk}</span>
                  </div>
                ))}
              </div>
              <div className="corrected">
                <div className="corrected-heading">
                  <span>
                    <Icon name="shield" size={17} /> A safer instruction
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(corrected)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      } catch {
                        setError(
                          "Clipboard unavailable. Select the corrected instruction to copy it.",
                        )
                      }
                    }}
                  >
                    <Icon name={copied ? "check" : "code"} size={14} />
                    {copied ? "Copied" : "Copy instruction"}
                  </button>
                </div>
                <p>{corrected}</p>
                <button
                  className="use-instruction"
                  onClick={() => {
                    setInstruction(corrected)
                    setPhase("edit")
                    setSelected(null)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                >
                  Use in editor <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
        <footer>
          <span>
            <Icon name="branch" size={14} /> Break the interpretation. Not
            production.
          </span>
          <span>
            LOCAL SIMULATION <i /> NO DATA LEAVES THIS WORKSPACE
          </span>
          <span className="footer-version">SCM / 001</span>
        </footer>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "about" ? "How it works" : "Run history"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <Icon name="close" />
            </button>
            <span className="mini-eyebrow">SEMANTIC CHAOS MONKEY</span>
            <h2>
              {modal === "about"
                ? "Explore what you didn’t say."
                : "Your previous explorations"}
            </h2>
            {modal === "about" ? (
              <>
                <p>
                  This prototype explores three modeled interpretations of data
                  cleanup, access control, and system operations. Other
                  instructions use the data-cleanup demonstration.
                </p>
                <ol>
                  <li>Write an instruction with room for interpretation.</li>
                  <li>
                    Enter each reality to inspect its simulated consequences.
                  </li>
                  <li>
                    Compare outcomes and take away a more precise instruction.
                  </li>
                </ol>
                <p className="modal-disclaimer">
                  Illustrative simulations, not live AI analysis. No commands
                  are executed and no data is transmitted.
                </p>
              </>
            ) : history.length ? (
              <div className="history-list">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInstruction(h)
                      reset()
                      setModal(null)
                    }}
                  >
                    <span>
                      <small>
                        RUN {String(history.length - i).padStart(2, "0")}
                      </small>
                      {h}
                    </span>
                    <Icon name="arrow" />
                  </button>
                ))}
              </div>
            ) : (
              <p>
                No explorations yet. Your runs will appear here during this
                session.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
