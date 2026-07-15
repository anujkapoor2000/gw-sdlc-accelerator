# Target release: Hakuba (reference themes)

> Verify all items against official **Hakuba** release notes before committing to a remediation plan.

## Release posture (planning lens)

- Common stepping-stone for teams exiting heavy **on-prem customisation** patterns.
- Upgrade focus: **extension-point compliance** and reducing OOTB file edits.

## Typical high-touch inventory areas

- **OOTB Gosu/PCF edits** still present — high merge risk.
- **Entity extensions** on core Account/Policy/Claim — schema merge scrutiny.
- Early **Jutro** pilots coupled to custom Cloud API layers.

## Regression focus

- **Policy renewal** and cancellation flows
- **Reserve / payment** authority and financial holds (CC)
- **Producer / commission** interfaces (BC)
- Cloud API **consumer contracts** (pagination and error schema)

## Pre-upgrade checklist additions

- Run OOTB edit scanner; open remediation tickets per file.
- Diff **datamodel extensions** against upgrade preview tools.
- List Cloud API versions in use; note consumers without contract tests.
