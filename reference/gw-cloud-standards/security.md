# Security profile

Applies when the reviewer selects **Security**.

## Authentication and authorisation

- **No hard-coded credentials**, API keys, keystore passwords, or tokens in Gosu, PCF, properties, or JS.
- **Role/permission checks** must enforce least privilege — do not rely on UI hiding alone.
- **Cloud API / Integration Gateway**: validate OAuth scopes, mutual TLS, and credential rotation patterns.
- Flag **missing authorisation** on custom REST/SOAP endpoints or scriptable PCF entry points.

## Injection and data handling

- **No string-concatenated SQL** or unparameterised dynamic queries.
- **PCF / Gosu** constructing URLs or scripts from user input — XSS/open-redirect risk.
- **Log statements** must not emit PII, PAN, credentials, or full policy/claim payloads at INFO in production.

## Secrets and configuration

- Secrets belong in **Guidewire Cloud secret stores / IG credential config**, not source control.
- **GlobalVariable** and profile values: flag secrets committed to repo or visible in client-side Jutro bundles.
- Certificate and key material: flag filesystem paths that will not exist in Cloud runtime.

## Integration security

- External calls must use **TLS**; flag trust-all or hostname-verifier bypass.
- **Webhook / App Events** consumers: verify signature validation and replay protection where applicable.
- **File upload** paths: validate type, size, and virus-scan hooks if handling attachments.

## standardRef examples

- `GW Cloud Standards: security — no secrets in source`
- `GW Cloud Standards: security — authorisation on custom API`
- `GW Cloud Standards: security — PII in logs`
