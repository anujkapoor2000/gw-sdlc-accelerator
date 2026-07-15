# Standards & maintainability profile

Applies when the reviewer selects **Standards & maintainability**. Pair with cross-cutting rules.

## PCF and UI configuration

- Screen **visibility and availability** expressions should be short predicates; extract repeated logic to Gosu helpers.
- **Required-field** and **default** bindings must handle null bundle states during create flows.
- Locator/widget ids: customer overrides should use **extension PCFs**, not copies of entire OOTB screens unless unavoidable.
- **Input sets** and **list views**: avoid duplicating OOTB list definitions — extend or configure columns via metadata where possible.

## Gosu structure

- One **enhancement / plugin class per concern**; avoid god-classes spanning unrelated domains.
- **Enhancements** should call `super` appropriately and not shadow OOTB behaviour silently.
- Use **interfaces and dependency injection** patterns supported by the bundle for testability (GUnit-friendly seams).
- Remove **dead code**, commented-out blocks, and debug `print()` left in production paths.

## Naming and documentation

- Typelist typekeys: **meaningful codes**, not `ext_1`, `temp`, or environment-specific literals.
- PCF file names and screen IDs should reflect **business purpose**, not developer initials.
- Document **non-obvious workarounds** with a ticket/reference and planned removal.

## Maintainability signals (flag as major/minor)

- Magic numbers/strings for status codes, role names, or LOB keys — prefer typelists/constants.
- Copy-pasted blocks across PCF events — candidate for shared Gosu utility.
- Mixed languages (Gosu + Java + JS) without clear boundary — consolidate where possible.

## standardRef examples

- `GW Cloud Standards: no business logic in PCF expressions`
- `GW Cloud Standards: typelist extension preferred over entity for enumerations`
- `GW Cloud Standards: GosuDoc required on public plugin methods`
