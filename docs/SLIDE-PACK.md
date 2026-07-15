# GuidewireAI — Accelerator Slide Pack

Client-ready deck built on the **NTT DATA Global Insurance Guidewire Template (2025)**.

## Files

| Format | File | Best for |
|---|---|---|
| **PowerPoint** | [`guidewire-ai-accelerators-slide-pack.pptx`](guidewire-ai-accelerators-slide-pack.pptx) | Client presentations — edit in PowerPoint |
| **Template (source)** | [`templates/PPT_Global_Insurance_Guidewire_Template_2025.pptx`](templates/PPT_Global_Insurance_Guidewire_Template_2025.pptx) | Master template — do not edit master slides |
| **Demo images** | [`media/*-demo.png`](media/) | Per-accelerator UI preview screenshots |
| **Legacy HTML pack** | [`accelerators-slide-pack.html`](accelerators-slide-pack.html) | Browser viewing |

## Regenerate

```bash
pip install python-pptx pillow
python scripts/generate-accelerator-demos.py      # PNG previews → docs/media/
python scripts/generate-guidewire-slide-pack.py   # Full deck → docs/
```

The slide-pack script also runs the code-review and defect-triage GIF generators when available (`public/media/*.gif` is preferred over PNG in the deck).

## Contents (16 slides)

1. **Title** — GuidewireAI SDLC Test Accelerators
2. **Agenda**
3. **Executive summary** — challenge & response
4. **Section** — The seven AI accelerators
5. **Story Forge** — Plan
6. **Code Review Copilot** — Build
7. **Test Strategist** — Test
8. **Flow Automator** — Test
9. **Test Migrator** — Test
10. **Release Navigator** — Release
11. **Defect Triage Agent** — Operate
12. **Section** — Productionalise the suite
13. **Katalon Flow Automation** — companion execution asset
14. **Productionalisation roadmap** — Phase 0–3
15. **Recommended adoption path**
16. **Next steps** — closing

## Each accelerator slide includes

- **Purpose** — what problem it solves
- **Example** — realistic input → output
- **Key capabilities** — differentiators (incl. bundled reference material & RAG)
- **Productionalise** — concrete steps to move from demo to production
- **Demo image/GIF** — right-hand preview (PNG or animated GIF where generated)

## Source of truth

Module descriptions and ROI figures: [`src/lib/catalog.js`](../src/lib/catalog.js)  
Production roadmap: [`ARCHITECTURE.md`](ARCHITECTURE.md) §7
