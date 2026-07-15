# Target release: Las Leñas (reference themes)

> Verify all items against official **Las Leñas** release notes before committing to a remediation plan.

## Release posture (planning lens)

- Increased emphasis on **digital (Jutro)** alongside core suite upgrades.
- Upgrade focus: **split cadence** between InsuranceSuite ski releases and Jutro app updates.

## Typical high-touch inventory areas

- **Jutro** apps calling custom Cloud API facades tied to PCF-era logic.
- **Portal** customisations (self-service FNOL, payments) spanning Jutro + CC/BC.
- **Authentication** flows (SSO, OAuth) shared across suite and digital.

## Regression focus

- Jutro **quote-and-buy** and self-service journeys
- SSO login across **PC/CC/BC** and digital
- Payment and **wallet** flows touching BC
- Mobile/responsive layouts on customised Jutro pages

## Pre-upgrade checklist additions

- Map Jutro app version compatibility matrix to target InsuranceSuite ski release.
- List shared **OAuth clients** and rotate credentials in lower env first.
- Run digital smoke pack independent of core suite smoke, then **combined** E2E.
