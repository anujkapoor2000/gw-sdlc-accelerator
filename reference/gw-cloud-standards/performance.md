# Performance & bundles profile

Applies when the reviewer selects **Performance & bundles**.

## Bundle and query patterns

- **Never query inside a loop** over accounts, policies, claims, or line items. Use `Query.compareIn`, batch queries, or pre-indexed maps.
- **Limit result sets** — paginate list views; avoid unbounded `Query.run()` in batch without chunking.
- **Bundle iteration:** `while (bundle != null)` loops must have clear exit conditions; avoid loading entire books of business in one run.
- Prefer **read-only bundles** for reporting-style code; commit only when mutating.

## Batch processes

- Batch must be **restartable/idempotent** where Guidewire patterns allow; document cursor keys and batch size.
- **Chunk size** and **work queue** usage should match GW Cloud batch guidance — flag single-threaded processing of huge volumes.
- Long-running batch should not hold **user sessions** or synchronous HTTP calls.

## PCF and UI performance

- **List views** with expensive filters: move filter logic to Query API or precomputed fields.
- Avoid **N+1** screen refreshes — batch related data loads in Gosu before binding.
- **Worksheet / LV** configurations: flag unbounded row expansion on large result sets.

## Caching and remote calls

- Cache **reference data** (typelists, small configuration) appropriately; do not cache mutable policy/claim state incorrectly.
- **Integration calls** from UI path: flag synchronous external HTTP in hot paths; prefer async/messaging.
- **Cloud API** pagination: honour `pageSize` limits; do not pull entire datasets client-side.

## standardRef examples

- `GW Cloud Standards: no Query.run inside bundle iteration`
- `GW Cloud Standards: batch chunking and restartability`
- `GW Cloud Standards: avoid synchronous integration in PCF event handlers`
