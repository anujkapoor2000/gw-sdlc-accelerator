# Guidewire Flow Automation — Katalon Accelerator

Reusable, keyword-driven UI automation for the **common Guidewire InsuranceSuite
flows** a delivery or AMS team re-tests every sprint — across **PolicyCenter
(PC)**, **ClaimCenter (CC)**, **BillingCenter (BC)** and **Jutro** digital.

Part of the NTT DATA Guidewire SDLC Accelerator. This is a standard
[Katalon Studio](https://katalon.com/) project — open the `katalon/` folder
directly in Katalon Studio (8.x+).

## Why this exists

Guidewire UI test packs rot fast: every project customises the OOTB screens and
every ski release nudges the markup. The cost is rarely the *flow* — it's the
locators and the boilerplate. This accelerator front-loads both:

- **One reusable keyword library per product** holds every business action
  (`createPersonAccount`, `startFNOL`, `makePayment`, `payAndBind`, …). Test
  cases read like a runbook; locators live in exactly one place.
- **Locators are built dynamically** from defensive XPath/CSS (id-prefix
  `contains()` + a label fallback), so a renamed widget is a one-line fix in the
  library, not a hunt through an Object Repository of hundreds of entries.
- **Environments are profiles** — URLs and credentials swap with a dropdown, no
  code change.

## What's covered

| App | Test case | Flow |
|---|---|---|
| **PolicyCenter** | PC01 | New Personal Auto submission → quote → bind |
| | PC02 | Mid-term policy change (endorsement): add a vehicle |
| | PC03 | Policy cancellation |
| | PC04 | Policy renewal quote |
| **ClaimCenter** | CC01 | FNOL → new auto claim |
| | CC02 | Set reserve + issue payment |
| | CC03 | Assign + close claim |
| **BillingCenter** | BC01 | Take a direct-bill payment |
| | BC02 | Review invoices |
| | BC03 | Producer setup + disbursement |
| **Jutro** | JU01 | Digital quote-and-buy, end to end |
| | JU02 | Self-service FNOL from the portal |

Test suites group these per product (`PC Regression`, `CC Regression`, …) plus a
cross-suite `Smoke - All Products` that runs one headline flow per app.

## Project layout

```
katalon/
  GuidewireFlowAutomation.prj        Katalon project descriptor
  Profiles/
    default.glbl                     local dev URLs + su/gw creds
    qa.glbl                          QA environment URLs + creds
  Keywords/com/nttdata/guidewire/
    GuidewireUI.groovy               shared interaction layer (dynamic TestObjects, waits, steps)
    LoginActions.groovy              auth for PC/CC/BC + Jutro
    PolicyCenterActions.groovy       PC flows
    ClaimCenterActions.groovy        CC flows
    BillingCenterActions.groovy      BC flows
    JutroActions.groovy              Jutro digital flows
    TestData.groovy                  unique/randomised data generators
  Test Cases/<App>/...               one .tc per flow (metadata)
  Scripts/<App>/<Flow>/Script*.groovy  the executable Groovy per flow
  Test Suites/                       per-product regression + smoke
  Object Repository/Common/          sample static login objects (pattern reference)
  Data Files/SeedData.csv            seed identifiers for data-dependent flows
```

## Running

1. **Open** the `katalon/` folder in Katalon Studio.
2. **Pick a profile** (top-right dropdown): `default` for a local InsuranceSuite,
   `qa` for a shared QA environment. Edit the `.glbl` to point at your URLs and
   set credentials. *Never commit real production secrets* — wire secrets through
   Katalon's `GlobalVariable` overrides or environment variables in CI.
3. **Run a suite** — e.g. `Test Suites/Smoke - All Products` — or a single test
   case from `Test Cases/`.

### Headless / CI

```bash
katalonc -noSplash -runMode=console \
  -projectPath="$PWD/katalon/GuidewireFlowAutomation.prj" \
  -retry=0 -testSuitePath="Test Suites/Smoke - All Products" \
  -executionProfile="qa" -browserType="Chrome (headless)"
```

## Adapting to your environment — read this first

The locators target **OOTB Guidewire widget ids** and the Jutro reference apps'
`data-test` ids. They are written defensively but **your project will have
customised screens**. Expect to:

1. Run a flow once with the Katalon recorder/spy open against *your* environment.
2. Correct the affected locator constants — they are grouped at the top of each
   `*Actions.groovy` library, so changes are localised.
3. Re-run. The flow logic and assertions stay as-is.

### Data-dependent flows

PC02–PC04, CC01–CC03 and BC01–BC03 act on **existing** policies/claims/accounts.
Each script has a clearly marked `// TODO` constant near the top (e.g.
`POLICY_NUMBER`, `CLAIM_NUMBER`, `ACCOUNT_NUMBER`). Point these at staged data in
your environment — `Data Files/SeedData.csv` documents the placeholders. PC01,
CC01 and JU01 are self-seeding happy paths and need no pre-staged data beyond a
policy visible to ClaimCenter for CC01.

## Conventions

- **Call style** — flows import the libraries statically
  (`import com.nttdata.guidewire.PolicyCenterActions as PC`) and read top-to-bottom.
  Every method is also annotated `@Keyword`, so it shows up in Katalon's Keywords
  browser for drag-and-drop/manual test authoring.
- **Steps & evidence** — `GuidewireUI.step(label)` logs a business milestone and
  (when `SCREENSHOT_EACH_STEP` is true in the profile) captures a screenshot, so
  reports read as a narrative.
- **Idempotent data** — `TestData` embeds a timestamp in names/VINs/plates so
  reruns never collide on Guidewire's uniqueness rules.
