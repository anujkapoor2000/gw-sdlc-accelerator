# Target release: Garmisch (reference themes)

> Verify all items against official **Garmisch** release notes before committing to a remediation plan.

## Release posture (planning lens)

- Teams often stabilise **Cloud API** and **App Events** on Garmisch-era baselines.
- Upgrade focus: **event-driven** integrations and batch/API interplay.

## Typical high-touch inventory areas

- **App Events** publishers/consumers with brittle schemas.
- **Batch** jobs triggering synchronous integrations mid-chunk.
- **GX** models and reporting against extended entities.

## Regression focus

- **App Events** replay and idempotency scenarios
- Batch **financial** jobs (commissions, billing extracts)
- **GT-API** for Integration Gateway and Cloud API facades
- Report samples tied to extended typelists

## Pre-upgrade checklist additions

- Catalogue event topics and subscribers; add contract tests for payload shape.
- Review batch **restart** behaviour after simulated failure.
- Confirm GX/report runtime targets Cloud-managed reporting path.
