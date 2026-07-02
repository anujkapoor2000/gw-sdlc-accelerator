# GW SDLC Accelerator — Slide Pack

McKinsey-style presentation explaining all accelerators in the GW SDLC Accelerator suite.

## Formats

| Format | File | Best for |
|---|---|---|
| **PowerPoint** | [`accelerators-slide-pack.pptx`](accelerators-slide-pack.pptx) | Client decks, editing in PowerPoint/Keynote/Google Slides |
| **HTML** | [`accelerators-slide-pack.html`](accelerators-slide-pack.html) | Browser viewing, quick PDF export |

### Regenerate PPTX

```bash
pip install python-pptx
python scripts/generate-slide-pack.py
```

## Viewing (HTML)

Open [`accelerators-slide-pack.html`](accelerators-slide-pack.html) in any modern browser.

## Navigation

| Key | Action |
|---|---|
| `→` / `↓` / `Space` | Next slide |
| `←` / `↑` | Previous slide |
| `Home` / `End` | First / last slide |
| `P` | Print or save as PDF |

## Contents (18 slides)

1. Title — GW SDLC Accelerator
2. Executive Summary
3. Lifecycle Architecture (Plan → Operate)
4. Section: Plan & Build
5. Story Forge
6. Code Review Copilot
7. Section: Test
8. Test Strategist
9. Flow Automator
10. Test Migrator
11. Section: Analysis
12. Release Navigator
13. Defect Triage Agent (agentic)
14. Katalon Flow Automation companion asset
15. Technical Architecture
16. Value at a Glance (ROI table)
17. Recommended Adoption Path
18. Next Steps

## Source of truth

ROI figures and module descriptions are sourced from [`src/lib/catalog.js`](../src/lib/catalog.js).
