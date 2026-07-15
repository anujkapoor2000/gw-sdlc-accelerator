# Upgrade / Cloud safety profile

Applies when the reviewer selects **Upgrade / Cloud safety**.

## High-risk customisation patterns (usually critical/major)

- **OOTB file modifications** (Gosu, PCF, XML under OOTB paths) — must migrate to extensions.
- Imports from **`internal.*`** or **`gw.api.internal`** — break across ski releases.
- **Deprecated APIs** (legacy SOAP stacks, old messaging APIs, removed Cloud API versions) — flag with upgrade-safety category.
- **SQL DDL** or schema changes outside supported upgrade tools.
- **Custom servlet/filter** deployments not aligned with Guidewire Cloud hosting model.

## Extension-point discipline

- Entity/typelist extensions: verify **upgrade merge** behaviour; avoid renaming OOTB typekeys.
- **PCF overrides** should be minimal diffs; document dependency on OOTB widget ids (upgrade may shift).
- **Rules** in rule sets: prefer product model / APD where appropriate to reduce upgrade merge pain.

## Platform upgrade regression surface

- **Integration Gateway** flows: contract versioning, WSDL/OpenAPI changes, auth mode shifts.
- **Cloud API** consumers: pin and test against target API version for the ski release.
- **Jutro / digital** apps: separate upgrade cadence from InsuranceSuite — flag cross-dependencies.
- **GX models** and **App Events**: schema evolution and subscription compatibility.

## Cloud migration readiness

- Custom **batch** using filesystem or local JMS — flag for Cloud-managed equivalents.
- **Environment-specific** URLs, keystores, or paths in source — must be externalised.
- **On-prem assumptions** (direct DB, custom app server hooks) — cloud-readiness findings.

## Reviewer guidance

- Do **not invent** specific deprecations for a named ski release unless provided in reference material for that release.
- Phrase uncertain items as: **verify against &lt;target release&gt; release notes and deprecation list**.

## standardRef examples

- `GW Cloud Standards: upgrade-safety — OOTB artifact edit`
- `GW Cloud Standards: upgrade-safety — internal package import`
- `GW Cloud Standards: Cloud API version pin for ski upgrade`
