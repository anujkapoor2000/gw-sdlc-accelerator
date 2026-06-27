# GW SDLC Accelerator — Architecture & Productionisation Guide

> Audience: engineering leads, platform/DevOps, and security reviewers preparing
> to take this accelerator from internal demo to a supportable, client-facing or
> production-grade service.
>
> Scope: the whole accelerator — both the **AI web application** (Story Forge,
> Code Review Copilot, Test Strategist, Flow Automator, Test Migrator, Release
> Navigator, Defect Triage) and the **Katalon Flow Automation** project under
> [`/katalon`](../katalon/).

---

## 1. What this is today

Two complementary assets live in one repository:

1. **An AI web application** — a Vite + React single-page app whose modules turn
   Guidewire delivery inputs (requirements, code, defects, flows) into structured,
   reusable artifacts via the Anthropic Claude API. A thin Vercel serverless layer
   keeps the API key server-side and persists saved artifacts to Neon Postgres.

2. **A Katalon Studio automation project** (`/katalon`) — keyword-driven UI
   automation for common Guidewire flows across PolicyCenter, ClaimCenter,
   BillingCenter and Jutro. The web app's **Flow Automator** module generates new
   Katalon scripts in this same style.

The current build is **demo / pilot grade**: it works end-to-end, but it assumes a
trusted single audience, has no authentication, and leans on Vercel + Neon
defaults. Section 5 onward is about closing that gap.

---

## 2. System architecture

### 2.1 High-level view

```
                          ┌─────────────────────────────────────────────┐
                          │                  Browser                     │
                          │  Vite + React 18 SPA (hash-routed modules)   │
                          │  src/App.jsx · src/modules/* · src/lib/*     │
                          └───────────────┬───────────────┬─────────────┘
                                          │ POST /api/chat │ /api/projects
                                          ▼               ▼
                          ┌─────────────────────────────────────────────┐
                          │          Vercel Serverless Functions          │
                          │  api/chat.js        api/projects.js           │
                          │  (Anthropic proxy)  (Neon persistence)        │
                          └───────────────┬───────────────┬─────────────┘
                                          │               │
                       x-api-key (server) │               │ DATABASE_URL
                                          ▼               ▼
                          ┌────────────────────┐  ┌────────────────────┐
                          │  Anthropic Messages │  │   Neon Postgres     │
                          │  API (Claude)       │  │  sdlc_projects      │
                          │                     │  │  sdlc_artifacts     │
                          └────────────────────┘  └────────────────────┘

   ── separate track, run from an engineer's machine or CI ──
                          ┌─────────────────────────────────────────────┐
                          │        Katalon Studio project (/katalon)      │
                          │  Keyword libs → Test cases → Suites → Profiles│
                          │            drives browsers against            │
                          │     PolicyCenter · ClaimCenter · BillingCenter│
                          │            · Jutro digital                    │
                          └─────────────────────────────────────────────┘
```

### 2.2 Request flow (AI modules)

1. A module component (e.g. `src/modules/FlowAutomator.jsx`) builds a prompt and
   calls `callClaude({ system, prompt, maxTokens })` in `src/lib/api.js`.
2. `callClaude` POSTs to `/api/chat`. The browser **never** holds the API key.
3. `api/chat.js` injects `ANTHROPIC_API_KEY`, pins the model
   (`ANTHROPIC_MODEL`, default `claude-sonnet-4-6`), clamps `max_tokens` to 8192,
   and forwards to the Anthropic Messages API.
4. The function flattens text blocks and returns `{ text, usage }`.
5. The module parses the model's JSON with `parseModelJson` (strips stray fences,
   slices the outermost `{...}`) and renders structured output.
6. Optionally, **Save to project** POSTs the artifact JSON to `/api/projects`,
   which `api/projects.js` writes to `sdlc_artifacts` in Neon.

The **Defect Triage** module is the one multi-step agent: it chains four prompts
(intake → investigate → route → plan) client-side, with a confidence-gated loop
back to the investigator (`MAX_LOOPS` in `DefectTriage.jsx`).

### 2.3 Component responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| SPA shell | `src/App.jsx`, `src/main.jsx` | Hash routing, nav, project context |
| Modules | `src/modules/*.jsx` | One per accelerator; prompt-build + render |
| Client lib | `src/lib/api.js` | `callClaude`, `parseModelJson`, `db.*` helpers |
| Prompts | `src/lib/prompts.js` | System prompts; all demand strict JSON |
| Showcase | `src/lib/catalog.js`, `src/modules/Home.jsx` | ROI/taxonomy metadata cards |
| AI proxy | `api/chat.js` | Server-side Anthropic call; key isolation |
| Persistence | `api/projects.js`, `db/schema.sql` | Projects + artifacts (auto-creates schema) |
| Routing | `vercel.json` | SPA rewrites + `/api` passthrough |
| Automation | `katalon/**` | Keyword-driven Guidewire UI tests |

### 2.4 Key design decisions (and their trade-offs)

- **Serverless proxy for the API key** — correct call; the key never reaches the
  browser. Trade-off: no auth in front of the proxy yet, so anyone who can reach
  the deployed URL can spend tokens (see §5.1).
- **Strict-JSON prompts + tolerant parser** — keeps the UI declarative. Trade-off:
  a malformed model response throws; there's no schema validation or repair step.
- **Schema auto-create on first request** — zero-setup demos. Trade-off: not a
  migration strategy; no versioning, no rollback (see §5.4).
- **Dynamic Katalon locators** — one place to fix per product, release-resilient.
  Trade-off: locators target OOTB ids and must be tuned to each customised env.

---

## 3. Technology stack

| Concern | Today | Notes |
|---|---|---|
| Frontend | Vite 5, React 18 | Static build, hash routing |
| Hosting | Vercel | SPA + serverless functions in one project |
| AI | Anthropic Claude (Messages API) | Model pinned via `ANTHROPIC_MODEL` |
| Persistence | Neon Postgres (`@neondatabase/serverless`) | Pooled connection string |
| Automation | Katalon Studio (WebUI), Groovy | Runs separately from the web app |
| Secrets | Vercel env vars | `ANTHROPIC_API_KEY`, `DATABASE_URL`, `ANTHROPIC_MODEL` |

---

## 4. Environments & configuration

| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `api/chat.js` | Server-side Claude auth |
| `ANTHROPIC_MODEL` | `api/chat.js` | Model pin (default `claude-sonnet-4-6`) |
| `DATABASE_URL` | `api/projects.js` | Neon **pooled** connection string (plain var, not a Secret) |

Katalon configuration lives in execution profiles (`katalon/Profiles/default.glbl`,
`qa.glbl`): app URLs, credentials, timeout, screenshot toggle. **No production
secrets belong in committed profiles** — see §6.

---

## 5. Productionising the web application

This is a gap analysis against production-readiness, ordered by priority. Each item
notes the current state and the recommended change.

### 5.1 Security — the critical gaps

| # | Gap | Today | Recommendation |
|---|---|---|---|
| 1 | **No authentication** | `/api/chat` and `/api/projects` are open to anyone with the URL | Put SSO in front (NTT DATA IdP via SAML/OIDC, or Vercel Authentication / Cloudflare Access for a quick win). Validate a session/JWT in every function before doing work. |
| 2 | **No authorization / tenancy** | Any caller can read/write/delete **any** project or artifact | Add `tenant_id`/`owner` columns; scope every query to the authenticated principal. Never trust `id` from the query string alone. |
| 3 | **Token-spend abuse** | Unauthenticated proxy = unbounded LLM cost | Auth (gate calls) + per-user/min rate limiting (Vercel KV / Upstash Redis token bucket) + a hard daily token ceiling. |
| 4 | **Prompt injection** | User text flows straight into prompts; modules also accept pasted code/logs | Treat all input as untrusted. Keep system prompts authoritative, never echo secrets, constrain output to the expected JSON schema, and consider an input/output moderation pass for client data. |
| 5 | **Input validation** | Functions check presence, not size/shape | Enforce max body size, max prompt length, allowed `module` enum, and content-type. Reject oversized payloads before they reach Anthropic or Postgres. |
| 6 | **Data sensitivity / PII** | Requirements, code and defect logs may contain client IP or PII; sent to the model and stored in Neon | Classify data; add a redaction/opt-out path; confirm the chosen model tier's data-handling terms; document residency. Consider a "do not persist" mode for sensitive engagements. |
| 7 | **CORS / headers** | Defaults | Lock CORS to the app origin; add CSP, HSTS, `X-Content-Type-Options`, referrer policy. |
| 8 | **Secrets hygiene** | Env vars in Vercel | Fine for now; for enterprise move to a managed secret store (Vault / cloud KMS) with rotation, and scope keys per environment. |

### 5.2 Reliability & scaling

- **Function timeouts & long generations** — large `max_tokens` calls can approach
  Vercel function limits. Mitigate by **streaming** responses (SSE) instead of a
  single blocking JSON, which also improves perceived latency. The Defect Triage
  chain especially benefits.
- **Retries & idempotency** — add bounded retries with backoff on `429`/`5xx` from
  Anthropic; surface a typed error to the UI (today a failure is a generic string).
- **DB connections** — Neon's serverless driver is HTTP-based and pool-friendly,
  which suits Vercel. Keep using the **pooled** URL; add a statement timeout and
  basic connection-error handling/observability.
- **Caching** — Anthropic **prompt caching** on the long, stable system prompts
  cuts cost and latency materially; cache the catalog/static responses at the edge.
- **Graceful degradation** — if Neon is down, the AI modules should still run
  (persistence is optional); make the "save" path fail soft, which it largely does.

### 5.3 LLM engineering & quality

| Concern | Recommendation |
|---|---|
| Output reliability | Replace the slice-the-braces parser with **schema validation** (e.g. Zod/JSON-Schema) and a one-shot **repair** retry when validation fails. Consider Anthropic **tool use / structured outputs** to force shape. |
| Model governance | Pin exact model versions per environment; add a documented upgrade/eval process before bumping. Keep `ANTHROPIC_MODEL` per-env. |
| Evals | Build a small **golden set** per module (inputs → expected-shape/quality assertions) and run it in CI on prompt or model changes. This is the single highest-leverage quality investment. |
| Cost controls | Track `usage` (already returned) per request; attribute to user/tenant; alert on anomalies; set per-tenant budgets. |
| Guardrails | Add refusal/timeout handling, max-loop caps (Defect Triage already has one), and content moderation where client data is involved. |
| Observability | Log prompt id/version, model, token usage, latency, and outcome (not raw client content) to a tracing backend (e.g. OpenTelemetry → your APM, or an LLM-observability tool). |

### 5.4 Persistence & data lifecycle

- **Migrations** — replace auto-`CREATE TABLE IF NOT EXISTS` with a real migration
  tool (Drizzle, Prisma Migrate, or plain SQL via `node-pg-migrate`) checked into
  the repo and run in CI. Auto-create is fine for demos, unsafe for evolving schemas.
- **Multi-tenancy** — add `tenant_id` to both tables, index it, and enforce
  row-level scoping (or Postgres RLS) so engagements are isolated.
- **Indices** — add `idx_artifacts_project_id` and `idx_projects_tenant_created`
  for the list queries.
- **Backups & retention** — enable Neon PITR/branching; define a retention policy
  for stored artifacts (which may contain client material) and a deletion workflow.
- **Auditing** — record who created/deleted projects and artifacts.

### 5.5 CI/CD, testing & delivery

- **Pipeline** — add GitHub Actions: lint → `npm run build` → unit tests → prompt
  evals → preview deploy → (gated) promote to production. Today merges fast-forward
  to `main` with no gate.
- **Branch protection** — require PR + green checks on `main`.
- **Frontend tests** — there are none; add component tests (Vitest + Testing
  Library) for the module render/parse paths and a smoke E2E (Playwright) for the
  happy path of each module.
- **Dependency & secret scanning** — Dependabot/Renovate + secret scanning + SCA.

### 5.6 Observability & operations

- **Structured logging** in functions (request id, route, status, duration) with
  **no raw client content** by default.
- **Error tracking** (Sentry or equivalent) on both client and functions.
- **Uptime/synthetics** hitting `/api/chat` and `/api/projects` health.
- **Dashboards & alerts** for token spend, error rate, p95 latency, DB errors.
- A lightweight **`/api/health`** endpoint (checks env + a trivial DB ping).

### 5.7 Recommended target architecture (enterprise)

```
   IdP (SAML/OIDC) ──► Edge auth (Access/Gateway) ──► SPA (CDN)
                                                       │ authenticated calls
                                                       ▼
                         API layer (serverless or container)
            ┌───────────────┬────────────────┬────────────────────┐
            │ rate limit /  │ schema-validated│ usage metering &   │
            │ quota (Redis) │ LLM proxy +     │ audit logging      │
            │               │ prompt cache    │                    │
            └──────┬────────┴───────┬─────────┴─────────┬──────────┘
                   ▼                ▼                   ▼
              Anthropic        Postgres (RLS,      Secrets store +
              (pinned model)   migrations, PITR)   observability/APM
```

---

## 6. Productionising the Katalon automation

The Katalon project is a separate deliverable with its own path to "production"
(i.e. a reliable, scheduled regression capability owned by a QA team).

### 6.1 Execution & licensing

- **Katalon Runtime Engine (KRE)** is required to run suites headless in CI
  (`katalonc`). Budget licences for the CI runners. Katalon Studio (authoring) and
  KRE (execution) are licensed separately.
- Run on **containerised browsers** (Selenium Grid / Selenoid / Katalon's grid, or
  a cloud grid like BrowserStack/Sauce) for parallelism and version control of the
  browser/driver.

### 6.2 CI/CD integration

```bash
katalonc -noSplash -runMode=console \
  -projectPath="$PWD/katalon/GuidewireFlowAutomation.prj" \
  -retry=1 -testSuitePath="Test Suites/Smoke - All Products" \
  -executionProfile="qa" -browserType="Chrome (headless)" \
  -apiKey="$KATALON_API_KEY"
```

- Add a pipeline (GitHub Actions / Jenkins / Azure DevOps) that runs the **smoke**
  suite on every Guidewire deploy and the **per-product regression** nightly.
- Publish JUnit/HTML reports as build artifacts; optionally push to **Katalon
  TestOps** for trend dashboards and flaky-test analytics.

### 6.3 Secrets & configuration

- **Never commit real credentials** in `.glbl` profiles. The committed `default`/
  `qa` profiles use placeholder URLs and `su/gw` demo creds.
- In CI, inject URLs/credentials via environment variables and override
  `GlobalVariable`s at runtime (`-g_USERNAME=... -g_PASSWORD=...`) sourced from the
  pipeline's secret store. Keep one profile per environment.

### 6.4 Test data management

- Data-dependent flows (PC02–PC04, CC02/CC03, BC01–BC03) act on **existing**
  policies/claims/accounts via clearly-marked `// TODO` seed constants and
  `Data Files/SeedData.csv`.
- Productionise this with a **deterministic data setup**: prefer Guidewire **Cloud
  API / GUnit / data-loader scripts** to seed the policy/claim/account a UI test
  needs *before* the run, rather than relying on hand-staged data. UI tests then
  read identifiers from a generated data file or environment variables.
- Self-seeding happy paths (PC01, CC01, JU01) already create their own data — keep
  that pattern where feasible; it's the most robust.

### 6.5 Stability & maintenance

- **Locators** target OOTB widget ids with label fallbacks; tune them once per
  customised environment (they're grouped at the top of each `*Actions.groovy`).
  This is the main maintenance surface — budget for it each Guidewire release.
- **Waits** are explicit (no hard sleeps) via `GuidewireUI`; keep it that way to
  limit flakiness.
- **Quarantine** flaky tests in a separate suite rather than disabling them.
- Add **screenshot/video on failure** (the step helper already screenshots) and
  retain artifacts in CI for triage.

### 6.6 Coverage roadmap

Extend beyond the 12 shipped flows as the regression need grows: additional LOBs
(Commercial Auto, GL, Workers' Comp), rating/forms validation, BC delinquency and
commission cycles, CC subrogation/litigation, and Jutro agent-portal journeys.
Each new flow = a keyword method or two plus a thin test case, reusing the existing
libraries.

---

## 7. Phased roadmap

| Phase | Goal | Key work |
|---|---|---|
| **0 — Now** | Internal demo | Works end-to-end; no auth; auto-schema |
| **1 — Pilot hardening** | Safe for named users | Auth (SSO/edge), rate limiting + token ceiling, input validation, structured logging + error tracking, branch protection + CI build/test, migrations replace auto-create |
| **2 — Client-ready** | Multi-tenant, governed | Tenancy + RLS, audit log, data-classification/redaction, prompt evals in CI, streaming + prompt caching, usage metering & budgets, Katalon in CI with KRE + secret injection |
| **3 — Enterprise scale** | Supportable product | Managed secrets + rotation, full observability/APM + SLOs, schema-validated structured outputs, model-upgrade eval gate, Katalon TestOps + grid parallelism + API-driven data seeding |

---

## 8. Quick reference — top 10 things to do first

1. Put **authentication** in front of both API routes.
2. Add **rate limiting** and a **daily token budget**.
3. **Validate inputs** (size, shape, `module` enum) in the functions.
4. Add **tenant scoping** to every DB query.
5. Replace auto-schema with **versioned migrations**.
6. Add **schema validation + repair** around model JSON.
7. Stand up a **prompt eval** golden set in CI.
8. Add **structured logging, error tracking, and token-usage metering**.
9. Wire **Katalon into CI** with KRE and secret-injected profiles.
10. Move Katalon **test-data seeding to Cloud API/GUnit** instead of hand-staged data.
