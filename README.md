# GW SDLC Accelerator

AI-assisted lifecycle tooling for Guidewire InsuranceSuite delivery — plan, build, test, release — built by the NTT DATA Guidewire Practice.

## Modules

| Phase | Module | What it does |
|---|---|---|
| Plan | **Story Forge** | Raw requirements → sprint-ready stories: Gherkin ACs, Guidewire touchpoints (entities, PCF, plugins, Cloud API), Fibonacci points with rationale, dependencies, open questions for the BA |
| Build | **Code Review Copilot** | Principal-level review of Gosu / PCF / integration / batch code. Severity-tagged findings (critical → info) across standards, performance, security and upgrade/Cloud safety, with concrete fixes and a code-health score. Can merge in findings from external static analysis (SonarQube/SonarCloud, ESLint, Checkstyle reports) alongside the LLM review |
| Test | **Test Strategist** | Derives executable test cases from stories, code or defects — pyramid-balanced across GUnit, GT-API and GT-UI, with test data to stage and automation notes |
| Test | **Flow Automator** | Generates keyword-driven **Katalon Studio** UI automation for common Guidewire flows (submission→bind, FNOL, billing payment, Jutro quote-and-buy) across PC/CC/BC/Jutro. Ships alongside a ready-to-run Katalon project in [`/katalon`](katalon/) |
| Test | **Test Migrator** | Takes a client's existing **manual** test cases (pasted as-is from Excel/ALM/Zephyr/qTest) and converts each into a runnable automated script — Katalon (Groovy), **Guidewire GT** (GT-UI / GT-API), **Playwright** (TypeScript), Selenium + Java, or Cucumber BDD. Per case it also flags the **gaps** that would block or destabilise automation and itemises the **test data** the script needs, with a generate / stage / existing-record strategy for each |
| Release | **Release Navigator** | CI/CD readiness self-check (16 practices) plus AI impact analysis of your customisation inventory against the target ski release, with effort band and pre-upgrade checklist |
| Operate | **Defect Triage Agent** *(agentic)* | A four-agent pipeline works the case autonomously: an Intake Agent structures the report, an Investigator forms ranked root-cause hypotheses with confidence scores, a Router assigns the case — or sends it back for a deeper pass when confidence falls below threshold (max 2 loops) — and a Fix Planner writes the workaround, permanent fix and regression coverage. Every agent handoff renders on a live timeline with inspectable output |

Every output can be saved to a project (Neon Postgres) and exported as JSON.

## Architecture

> For a full architecture deep-dive and a phased plan to productionalise both the
> web app and the Katalon project, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

- **Frontend**: Vite + React 18, NTT DATA brand tokens, IBM Plex
- **AI proxy**: `/api/chat.js` — Vercel serverless function calling the Anthropic Messages API. The API key never reaches the browser
- **Persistence**: `/api/projects.js` — Neon Postgres via `@neondatabase/serverless`. Schema auto-creates on first request (`db/schema.sql` is reference only)
- **Routing**: SPA rewrites in `vercel.json`

## Local development

```bash
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY and DATABASE_URL
npx vercel dev              # runs the serverless functions + Vite together
```

(`npm run dev` alone runs the frontend, proxying `/api` to port 3000 — pair it with `vercel dev` or any local function runner.)

## Deploy: GitHub → Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "GW SDLC Accelerator v1.0"
   git remote add origin https://github.com/<your-org>/gw-sdlc-accelerator.git
   git push -u origin main
   ```

2. **Create the Neon database**
   - In [Neon](https://neon.tech), create a project and copy the **pooled** connection string
   - No manual schema setup needed — tables auto-create on first API call

3. **Import into Vercel**
   - New Project → import the GitHub repo → framework preset: **Vite**
   - Under **Settings → Environment Variables**, add:

   | Name | Value | Note |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | server-side only |
   | `DATABASE_URL` | Neon pooled connection string | **add as a plain Environment Variable, not a Secret** — Secret references cause `DATABASE_URL` resolution errors at build time |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | optional override |
   | `VOYAGE_API_KEY` | Voyage API key | optional — better RAG embeddings (falls back to sparse/local if unset) |
   | `OPENAI_API_KEY` | OpenAI API key | optional — alternative embedding provider for RAG |

   - Deploy. Subsequent pushes to `main` auto-deploy

## Repository layout

```
api/
  chat.js          Anthropic proxy (key stays server-side)
  projects.js      Projects + saved artifacts (Neon)
db/schema.sql      Reference schema
src/
  lib/prompts.js   Guidewire-aware system prompts per module
  lib/api.js       Client helpers (Claude call, JSON parsing, db)
  components/      ProjectBar, SaveToProject
  lib/catalog.js   Showcase metadata: ROI, taxonomy, config params per agent
  modules/         Home (showcase), Dashboard, StoryForge, CodeReview, TestStrategist, FlowAutomator, TestMigrator, ReleaseNavigator, DefectTriage
public/media/      Drop <agent-id>.gif here to replace animated previews
katalon/           Katalon Studio accelerator: reusable keyword libraries + ready-to-run flows for PC/CC/BC/Jutro (see katalon/README.md)
```

## Katalon Flow Automation accelerator

The [`/katalon`](katalon/) folder is a standalone **Katalon Studio** project — open
it directly in Katalon Studio. It packages reusable, keyword-driven UI automation
for the common Guidewire journeys teams re-test each sprint:

- **PolicyCenter** — new Personal Auto submission → quote → bind, mid-term policy
  change, cancellation, renewal
- **ClaimCenter** — FNOL → new claim, reserves + payment, assign + close
- **BillingCenter** — direct-bill payment, invoice review, producer + disbursement
- **Jutro** — digital quote-and-buy, self-service FNOL

One reusable keyword library per product keeps locators in a single place; URLs and
credentials swap via execution profiles. The in-app **Flow Automator** module
generates new scripts in this same style. See [`katalon/README.md`](katalon/README.md)
for setup, running headless in CI, and adapting locators to a customised environment.

## Extending

- **Reference material**: Bundled corpora under `/reference` are injected into accelerator prompts (Katalon libs, GW Cloud standards, ski-release themes). Re-run `npm run bundle:reference` after edits; `prebuild` does this on deploy.
- **Per-project knowledge (RAG)**: Paste text, **upload files** (.md, .gosu, .groovy, .json, …), **index codebase paths** (`reference`, `katalon`, `src/lib`, …), or sync saved outputs via **Project knowledge**. Enable **Use project knowledge (RAG)** in the project bar; chunks are embedded and retrieved per accelerator run.
- **New module**: add a system prompt in `src/lib/prompts.js` (demand strict JSON), a module component in `src/modules/`, and a rail entry in `src/App.jsx`
- **New review profile**: extend `PROFILES` in `CodeReview.jsx` — the prompt picks up the selected labels automatically
- **New external static-analysis tool** (beyond SonarQube/ESLint/Checkstyle): add a parser to `src/lib/externalFindings.js` that normalizes the tool's report into `{ source, severity, category, location, issue, recommendation, standardRef }`, and register it in `EXTERNAL_TOOLS` — a live SonarQube/SonarCloud Web API proxy (`api/sonarqube.js`, same pattern as `api/datadog.js`) is a natural follow-up to the current paste/upload flow
- **Jira/ADO export**: story and test JSON shapes are import-ready; map fields in a small transform

---

NTT DATA Guidewire Practice · internal accelerator · v1.0
