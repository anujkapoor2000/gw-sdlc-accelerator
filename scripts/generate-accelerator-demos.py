#!/usr/bin/env python3
"""Generate stylised demo PNG screenshots for each AI accelerator (slide pack assets)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "media"
W, H = 800, 450

INK = (15, 23, 42)
SLATE = (100, 116, 139)
LINE = (231, 233, 238)
PAPER = (255, 255, 255)
BLUE = (37, 99, 235)
BLUE_TINT = (239, 246, 255)
VIOLET = (124, 58, 237)
VIOLET_TINT = (245, 243, 255)
GREEN = (22, 163, 74)
GREEN_TINT = (236, 253, 245)
AMBER = (180, 83, 9)
AMBER_TINT = (255, 251, 235)
TEAL = (0, 169, 206)
BG = (248, 250, 252)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def f(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def mono(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(MONO, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def chrome(draw: ImageDraw.ImageDraw, eyebrow: str, title: str, badge: str, badge_color: tuple) -> int:
    draw.rectangle((0, 0, W, 56), fill=PAPER)
    draw.line((0, 56, W, 56), fill=LINE, width=1)
    draw.text((20, 14), eyebrow, fill=SLATE, font=f(11))
    draw.text((20, 30), title, fill=INK, font=f(18, True))
    bw = draw.textlength(badge, font=f(10, True)) + 20
    draw.rounded_rectangle((W - bw - 16, 18, W - 16, 40), radius=6, fill=badge_color)
    draw.text((W - bw - 6, 22), badge, fill=PAPER, font=f(10, True))
    return 68


def panel(draw: ImageDraw.ImageDraw, y: int, h: int, label: str) -> int:
    draw.rounded_rectangle((16, y, W - 16, y + h), radius=8, fill=PAPER, outline=LINE, width=1)
    draw.text((28, y + 10), label, fill=SLATE, font=f(10, True))
    return y + 34


def draw_lines(draw: ImageDraw.ImageDraw, lines: list[str], x: int, y: int, font, color=INK, gap: int = 18) -> int:
    for line in lines:
        draw.text((x, y), line, fill=color, font=font)
        y += gap
    return y


RED_TINT = (254, 242, 242)
RED = (220, 38, 38)

MODULES = {
    "story-forge": {
        "eyebrow": "Plan · Story Forge",
        "title": "Requirements → sprint-ready stories",
        "badge": "PolicyCenter",
        "badge_color": BLUE,
        "left": [
            "INPUT: Workshop notes — 'Add PA multi-vehicle discount…'",
            "OUTPUT: ST-1 Bind policy with 2+ vehicles",
            "  Given an in-force PA policy",
            "  When underwriter adds second vehicle",
            "  Then premium reflects multi-car discount",
            "GW touchpoints: PolicyLine, RatingPlugin",
        ],
        "cards": [("ST-1", "5 pts", GREEN_TINT, GREEN), ("ST-2", "3 pts", BLUE_TINT, BLUE)],
    },
    "code-review": {
        "eyebrow": "Build · Code Review Copilot",
        "title": "Principal-level Gosu / PCF review",
        "badge": "Cross-suite",
        "badge_color": VIOLET,
        "left": [
            "1: uses gw.transaction.runInNewBundle",
            "2:   // inside PCF onClick handler",
            "3:   var q = new Query(Claim)...",
            "FINDING [critical] gw.transaction in UI layer",
            "FIX: move to plugin / async batch",
            "Score: 62 · 1 critical · 2 major",
        ],
        "cards": [("critical", "1", RED_TINT, RED), ("major", "2", AMBER_TINT, AMBER)],
    },
    "test-strategist": {
        "eyebrow": "Test · Test Strategist",
        "title": "Pyramid-balanced test cases",
        "badge": "ClaimCenter",
        "badge_color": GREEN,
        "left": [
            "INPUT: User story — FNOL for auto claim",
            "TC-1 Verify FNOL creates claim [GT-UI] P1",
            "TC-2 Validate reserve rules [GUnit] P1",
            "TC-3 Cloud API claim create [GT-API] P2",
            "Test data: in-force PA policy, active vehicle",
        ],
        "cards": [("GUnit", "4", GREEN_TINT, GREEN), ("GT-UI", "2", AMBER_TINT, AMBER)],
    },
    "flow-automator": {
        "eyebrow": "Test · Flow Automator",
        "title": "Katalon UI flow automation",
        "badge": "PolicyCenter",
        "badge_color": VIOLET,
        "left": [
            "Flow: PA submission → quote → bind",
            "PolicyCenterActions.createPersonAccount(...)",
            "PolicyCenterActions.startSubmission('PersonalAuto')",
            "PolicyCenterActions.quote()",
            "PolicyCenterActions.issuePolicy()",
            "Matches /katalon keyword libraries",
        ],
        "cards": [("Groovy", "script", VIOLET_TINT, VIOLET), ("12 flows", "shipped", BLUE_TINT, BLUE)],
    },
    "test-migrator": {
        "eyebrow": "Test · Test Migrator",
        "title": "Manual cases → automation",
        "badge": "Cross-suite",
        "badge_color": VIOLET,
        "left": [
            "INPUT: TC-PC-014 New PA policy bind (manual)",
            "Verdict: automate-with-fixes",
            "GAP: missing precondition — underwriter role",
            "TEST DATA: person account (generate)",
            "OUTPUT: Katalon Groovy script + gap list",
        ],
        "cards": [("automate", "3", GREEN_TINT, GREEN), ("fix first", "2", AMBER_TINT, AMBER)],
    },
    "release-navigator": {
        "eyebrow": "Release · Release Navigator",
        "title": "Ski-release upgrade impact",
        "badge": "BillingCenter",
        "badge_color": AMBER,
        "left": [
            "Target: Palisades · PC + CC in scope",
            "CI/CD readiness: 69% (11/16 practices)",
            "HIGH: Custom IG flows — contract tests",
            "MEDIUM: Entity extensions — schema merge",
            "Effort band: 15–25 person-days regression",
        ],
        "cards": [("risk", "medium", AMBER_TINT, AMBER), ("checklist", "8 items", BLUE_TINT, BLUE)],
    },
    "defect-triage": {
        "eyebrow": "Operate · Defect Triage Agent",
        "title": "4-agent autonomous triage",
        "badge": "ClaimCenter",
        "badge_color": GREEN,
        "left": [
            "Intake → structured case file",
            "Investigator → 3 hypotheses (72% conf.)",
            "Router → Billing team · P2",
            "Fix Planner → workaround + regression",
            "Timeline: 4 agent handoffs visible",
        ],
        "cards": [("P2", "routed", AMBER_TINT, AMBER), ("72%", "confidence", GREEN_TINT, GREEN)],
    },
}


def render(module_id: str, spec: dict) -> Path:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = chrome(draw, spec["eyebrow"], spec["title"], spec["badge"], spec["badge_color"])

    y = panel(draw, y, H - y - 16, "LIVE DEMO PREVIEW")
    draw.rounded_rectangle((28, y, W // 2 - 8, H - 28), radius=6, fill=(250, 251, 253), outline=LINE)
    draw_lines(draw, spec["left"], 40, y + 8, mono(11), INK, 16)

    rx = W // 2 + 8
    draw.rounded_rectangle((rx, y, W - 28, H - 28), radius=6, fill=PAPER, outline=LINE)
    cy = y + 20
    for label, value, bg, fg in spec["cards"]:
        draw.rounded_rectangle((rx + 16, cy, rx + 140, cy + 52), radius=8, fill=bg)
        draw.text((rx + 28, cy + 8), label, fill=fg, font=f(11, True))
        draw.text((rx + 28, cy + 28), value, fill=INK, font=f(14, True))
        cy += 64

    draw.text((rx + 16, cy + 8), "GuidewireAI · Claude Sonnet", fill=SLATE, font=f(10))
    draw.text((rx + 16, cy + 28), "Save to project · Export JSON", fill=TEAL, font=f(10, True))

    out = OUT_DIR / f"{module_id}-demo.png"
    img.save(out, "PNG")
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for mid, spec in MODULES.items():
        path = render(mid, spec)
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
