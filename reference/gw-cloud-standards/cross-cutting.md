# Guidewire Cloud — cross-cutting review standards

Use these rules across all review profiles. Cite as `GW Cloud Standards: <topic>` in standardRef.

## Layering and transaction boundaries

- **UI / PCF layer must not open transactions.** No `gw.transaction` or bundle commits in PCF event handlers, screen lifecycle, or UI-triggered Gosu that runs synchronously on user action. Use rules, plugins, or async batch/messaging for transactional work.
- **PCF is for presentation and navigation**, not business logic. Complex conditionals, rating calls, or multi-step validation belong in Gosu plugins, enhancements, or rules — not inline PCF expressions or large script blocks.
- **Do not edit OOTB artifacts in place.** Extend via PCF overrides, entity extensions, typelist extensions, Gosu plugins, and Guidewire Cloud extension points. Direct edits to OOTB Gosu/PCF/XML are upgrade blockers.

## Data model

- Prefer **typelist extensions** and **typekey descriptors** over entity extensions when the need is enumerations or metadata, not new persisted fields.
- Entity extensions: every new FK must be **null-safe** in queries and UI bindings; document cascade and validation behaviour.
- Avoid **direct SQL** against the operational database. Use Query API, bundle queries, or approved reporting paths.

## Gosu quality

- **GosuDoc** on public/plugin methods; meaningful names (`camelCase` methods, `PascalCase` types).
- No **`internal.*`** package imports in customer code — upgrade-fragile.
- Avoid **queries inside loops**; batch-fetch or use efficient Query API patterns.
- **Bundle hygiene:** commit in clear units; avoid holding large bundles open across remote calls or user waits.

## Cloud readiness

- Prefer **Cloud API / Integration Gateway / App Events** over bespoke SOAP/REST servlets where platform patterns exist.
- Externalise **secrets and endpoints** via configuration (GlobalVariable, environment config, Integration Gateway credentials) — never hard-coded in source.
- Flag **Jutro / digital** candidates when customising legacy PCF portals.

## Review output discipline

- Tie each finding to a **concrete location** (line number or snippet).
- Name the **Guidewire construct** to use in the fix (plugin, rule, typelist extension, Cloud API, etc.).
- When uncertain whether an API is deprecated in a specific ski release, say **verify against target release notes** rather than asserting.
