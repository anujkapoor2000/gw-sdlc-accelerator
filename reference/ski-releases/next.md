# Target release: Next (unannounced) (reference themes)

> **No release-specific facts are asserted here.** Use this profile for early planning only. Replace with official release notes when the ski name and deprecation list are published.

## Planning posture

- Assume **continuation** of Cloud API versioning, Jutro/digital cadence, and stricter **internal API** removal.
- Treat unknown inventory as **verify at GA** — prioritise hygiene now to reduce future surprise.

## Inventory areas to harden before GA notes land

- Eliminate **`internal.*`** and OOTB edits proactively.
- Standardise on **Integration Gateway + Cloud API** for new work; freeze new custom SOAP.
- Ensure **contract tests** exist for every external integration.
- Document **APD** and product model diffs per LOB.

## Regression focus (generic)

- Full **smoke pack** per product in scope
- **Financial** end-to-end (premium, tax, commission, payment)
- **Digital + core** combined journeys if Jutro in scope

## Pre-upgrade checklist additions

- Maintain a living **customisation inventory** tagged by upgrade risk (high/medium/low).
- Subscribe to Guidewire **Cloud Console** advisories for the tenant.
- Schedule a **dry-run upgrade** in int within two weeks of preview notes.
