# Target release: Innsbruck (reference themes)

> Verify all items against official **Innsbruck** release notes before committing to a remediation plan.

## Release posture (planning lens)

- Mature InsuranceSuite baseline — teams on Innsbruck often carry **legacy integration** debt (custom SOAP, file drops).
- Upgrade focus: **integration modernisation** candidates and first wave of **Cloud API** adoption.

## Typical high-touch inventory areas

- Custom **SOAP** or early **REST** servlets → plan IG / Cloud API migration.
- **PCF-heavy** underwriting wizards with inline Gosu → refactor before next ski jump.
- **Batch** using legacy APIs → audit for chunking and Cloud batch compatibility.

## Regression focus

- Quote/bind and **mid-term change** (PC)
- **FNOL → payment** (CC)
- **Invoice / direct bill** (BC)
- Top **Integration Gateway** flows by transaction volume

## Pre-upgrade checklist additions

- Export IG flow inventory and map to supported connector versions for Innsbruck → next target.
- Identify PCF screens with **>3 override layers** — candidate for simplification.
- Confirm **GUnit** coverage on rating plugins and assignment rules.
