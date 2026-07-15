# Target release: Palisades (reference themes)

> Verify all items against official **Palisades** release notes before committing to a remediation plan.

## Release posture (planning lens)

- Recent ski baseline — teams target **Cloud-native** patterns and smaller upgrade deltas from Palisades forward.
- Upgrade focus: **deprecation cleanup**, **performance**, and **security** hardening before next jump.

## Typical high-touch inventory areas

- Lingering **`internal.*`** imports and deprecated messaging APIs.
- **Performance** hotspots: queries in loops, unchunked batch, heavy PCF refresh chains.
- **Security**: secrets in properties, custom endpoints without authZ.

## Regression focus

- Performance-sensitive **list views** and worksheets
- **Security** regression on custom APIs and file uploads
- **Upgrade-safety** compile — zero tolerance for internal package use
- Critical-path **GT-UI** after PCF override merge

## Pre-upgrade checklist additions

- Run code review accelerator profiles: **upgrade + security + performance** on top changed bundles.
- Enable **static analysis** in CI if not already present.
- Benchmark top ten batch jobs and PCF screens for duration in int.
