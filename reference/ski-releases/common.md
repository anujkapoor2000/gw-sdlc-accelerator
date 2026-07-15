# Ski release upgrade — common preparation themes

Applies to **all** Guidewire Cloud Platform ski releases. Use alongside release-specific reference when a target release is selected.

> **Disclaimer:** This bundled material summarises recurring upgrade themes for delivery planning. Always verify specifics against the official Guidewire release notes, deprecation spreadsheets, and Cloud Console advisories for the target ski release.

## Universal impact areas

| Area | Typical upgrade exposure | What to verify |
|---|---|---|
| Entity extensions | Schema merge, new required fields | Run upgrade tools; diff datamodel |
| PCF / UI overrides | Widget id shifts, screen flow changes | Smoke GT-UI on critical journeys |
| Gosu plugins / rules | API signature changes, removed internals | Compile + GUnit; scan `internal.*` |
| Batch processes | Scheduler, chunking API changes | Rerun batch in lower env with prod-like volume |
| Integration Gateway | Connector versions, auth, WSDL | Contract tests per integration |
| Cloud API | Version sunset, schema changes | Consumer contract tests; pin versions |
| App Events / messaging | Topic schema, subscription filters | Replay test in int |
| Jutro / digital | Separate release train | Cross-check PC Cloud API dependencies |
| Reports / GXR | Runtime and data model | Sample report regression |
| Product model (APD) | Line-of-business merge | APD diff and quote/bind smoke |

## Recommended pre-upgrade sequence

1. Freeze customisation inventory and tag each item: **OOTB-touching** vs **isolated extension**.
2. Run **static scan** for `internal.*`, direct SQL, OOTB edits, hard-coded secrets.
3. Refresh **GUnit + GT-API + smoke GT-UI** baselines on current release.
4. Apply platform upgrade in **int**; capture compile errors and upgrade tool output first.
5. Execute **integration contract suite** and **financial/regression** scripts.
6. Reconcile **deprecation list** item-by-item against inventory.
7. Plan **rollback** and support window with Guidewire Cloud ops.

## Effort heuristics (indicative)

- **Low:** Mostly configuration, few entity extensions, IG-only integrations, strong automated regression.
- **Medium:** Multiple PCF overrides per product, custom batch, several Cloud API consumers.
- **High:** OOTB file edits, heavy `internal.*` usage, custom portals, large APD changes, cross-product workflows.

## Products in scope

When multiple products are selected (PC, CC, BC), assess **cross-product** touchpoints: billing flows after policy changes, claim-payment alignment, commission interfaces, and shared integration credentials.
