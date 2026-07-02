#!/usr/bin/env python3
"""Generate code-review.gif — animated showcase of the Code Review Copilot."""

from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "media" / "code-review.gif"
W, H = 800, 480
FPS = 10
DURATION_MS = 1000 // FPS

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
RED = (220, 38, 38)
RED_TINT = (254, 242, 242)
BG = (248, 250, 252)
MONO_BG = (11, 17, 32)
MONO_FG = (180, 200, 230)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

CODE_LINES = [
    "uses gw.api.database.Query",
    "",
    "class PolicyHoldFinder {",
    "  function findHolds(periods : List<PolicyPeriod>) {",
    "    for (p in periods) {",
    "      var q = Query.make(UWIssue)",
    "        .compare(\"PolicyPeriod\", Equals, p).select()",
    "      for (issue in q) { holds.add(issue) }",
    "    }",
    "  }",
    "}",
]

PROFILES = [
    ("Standards & maintainability", True),
    ("Performance & bundles", True),
    ("Upgrade / Cloud safety", True),
    ("Security", False),
]

FINDINGS = [
    {
        "severity": "critical",
        "category": "performance",
        "location": "lines 5–8",
        "issue": "Query executed inside a loop over PolicyPeriod — N+1 pattern will degrade bind performance at scale.",
        "fix": "Batch-fetch UWIssues with a single Query using CompareIn on PolicyPeriod IDs.",
        "colors": (RED_TINT, RED),
    },
    {
        "severity": "major",
        "category": "upgrade-safety",
        "location": "line 6",
        "issue": "String-based entity field compare on PolicyPeriod — fragile across ski releases if field metadata changes.",
        "fix": "Use typed property reference: compare(PolicyPeriod, Relop.Equals, p).",
        "colors": (AMBER_TINT, AMBER),
    },
    {
        "severity": "major",
        "category": "standards",
        "location": "line 4",
        "issue": "Missing null/empty guard on periods parameter — will throw if caller passes null.",
        "fix": "Add early return when periods == null or periods.IsEmpty.",
        "colors": (AMBER_TINT, AMBER),
    },
    {
        "severity": "minor",
        "category": "performance",
        "location": "line 8",
        "issue": "Mutable collection holds not initialised — implicit array growth on large result sets.",
        "fix": "Pre-size holds list or use LinkedHashSet if uniqueness matters.",
        "colors": (BLUE_TINT, BLUE),
    },
]

SCORE = {"health": 72, "critical": 1, "major": 2, "minor": 1, "info": 1}
VERDICT = (
    "Fix the N+1 query pattern before merge — it will surface under production renewal volume. "
    "Upgrade-safety and null-guard issues are quick wins."
)


def fonts():
    return {
        "xs": ImageFont.truetype(FONT, 10),
        "sm": ImageFont.truetype(FONT, 11),
        "md": ImageFont.truetype(FONT_BOLD, 12),
        "lg": ImageFont.truetype(FONT_BOLD, 14),
        "xl": ImageFont.truetype(FONT_BOLD, 20),
        "cap": ImageFont.truetype(FONT_BOLD, 9),
        "mono": ImageFont.truetype(MONO, 9),
        "score": ImageFont.truetype(FONT_BOLD, 18),
    }


def rr(draw, box, r, fill, outline=None, w=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)


def wrap(draw, text, font, width):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def block(draw, x, y, text, font, color, width, gap=2):
    for line in wrap(draw, text, font, width):
        draw.text((x, y), line, fill=color, font=font)
        y += font.size + gap
    return y


def footer(draw, f):
    draw.rectangle((0, H - 24, W, H), fill=INK)
    draw.text((16, H - 18), "GuidewireAI · Code Review Copilot", fill=(203, 213, 225), font=f["xs"])
    draw.text((W - 185, H - 18), "NTT DATA Guidewire Practice", fill=(147, 197, 253), font=f["xs"])


def header(draw, f, compact=False):
    draw.text((20, 14 if compact else 16), "BUILD · ANALYSIS ACCELERATOR", fill=VIOLET, font=f["cap"])
    draw.text((20, 28 if compact else 32), "Code Review Copilot", fill=INK, font=f["xl"] if not compact else f["lg"])
    if not compact:
        block(draw, 20, 58,
              "Principal-level review of Gosu code — severity-tagged findings with concrete fixes and upgrade-safety flags.",
              f["sm"], SLATE, W - 40)


def scene_input(draw, f, t: float, reviewing: bool):
    header(draw, f)
    y0 = 88
    rr(draw, (16, y0, W - 16, y0 + 168), 12, PAPER, LINE)

    draw.text((28, y0 + 8), "Product", fill=SLATE, font=f["xs"])
    rr(draw, (28, y0 + 22, 150, y0 + 42), 6, PAPER, LINE)
    draw.text((36, y0 + 26), "PolicyCenter", fill=INK, font=f["sm"])

    draw.text((168, y0 + 8), "Code type", fill=SLATE, font=f["xs"])
    rr(draw, (168, y0 + 22, 360, y0 + 42), 6, PAPER, LINE)
    draw.text((176, y0 + 26), "Gosu class / enhancement", fill=INK, font=f["sm"])

    draw.text((28, y0 + 48), "Review profiles", fill=SLATE, font=f["xs"])
    cx = 28
    for label, on in PROFILES:
        if on or t > 1.2:
            tw = draw.textlength(label, font=f["xs"]) + 16
            bg = VIOLET_TINT if on else PAPER
            fg = VIOLET if on else SLATE
            outline = VIOLET if on else LINE
            rr(draw, (cx, y0 + 62, cx + tw, y0 + 78), 10, bg, outline, 1)
            draw.text((cx + 8, y0 + 66), label, fill=fg, font=f["xs"])
            cx += tw + 6

    draw.text((28, y0 + 86), "Code under review", fill=SLATE, font=f["xs"])
    rr(draw, (28, y0 + 100, W - 28, y0 + 168), 6, MONO_BG, LINE)
    visible_lines = int(min(len(CODE_LINES), (t / 2.0) * len(CODE_LINES) + 0.5))
    ly = y0 + 106
    for i, line in enumerate(CODE_LINES[:visible_lines]):
        draw.text((36, ly), f"{i + 1:>2}  {line}" if line else "", fill=MONO_FG, font=f["mono"])
        ly += 11

    btn_y = y0 + 178
    rr(draw, (28, btn_y, 168, btn_y + 28), 8, (109, 40, 217) if reviewing else VIOLET)
    label = "Reviewing…" if reviewing else "Run review"
    draw.text((48, btn_y + 7), label, fill=PAPER, font=f["md"])
    if reviewing:
        draw.text((190, btn_y + 9), "● ● ●", fill=VIOLET, font=f["md"])


def scene_reviewing(draw, f, t: float):
    header(draw, f, compact=True)
    rr(draw, (16, 58, W - 16, 88), 8, VIOLET_TINT, VIOLET, 1)
    draw.text((28, 64), "Reviewing:", fill=VIOLET, font=f["xs"])
    draw.text((28, 78), "PolicyHoldFinder.gs · PolicyCenter · Standards · Performance · Upgrade safety", fill=INK, font=f["sm"])

    cx, cy = W // 2, 200
    for i in range(3):
        angle = t * 4 + i * 2.1
        r = 28 + i * 14
        x = cx + int(math.cos(angle) * r)
        y = cy + int(math.sin(angle) * r * 0.5)
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=VIOLET)

    draw.text((W // 2 - 70, 250), "Analysing Gosu against GW Cloud standards…", fill=SLATE, font=f["sm"])

    checks = ["Standards", "Performance", "Upgrade safety", "Security"]
    for i, chk in enumerate(checks):
        if t > 0.4 + i * 0.35:
            mark = "✓" if chk != "Security" else "—"
            color = GREEN if mark == "✓" else SLATE
            draw.text((28, 290 + i * 18), f"{mark}  {chk}", fill=color, font=f["sm"])


def scene_results(draw, f, t: float):
    header(draw, f, compact=True)

    # scorecard
    if t > 0.2:
        tiles = [
            ("Code health", f"{SCORE['health']}/100", VIOLET_TINT, VIOLET, True),
            ("Critical", str(SCORE["critical"]), RED_TINT, RED, False),
            ("Major", str(SCORE["major"]), AMBER_TINT, AMBER, False),
            ("Minor", str(SCORE["minor"]), (241, 245, 249), SLATE, False),
            ("Info", str(SCORE["info"]), (241, 245, 249), SLATE, False),
        ]
        tx = 16
        for label, value, bg, fg, accent in tiles:
            tw = 148
            rr(draw, (tx, 54, tx + tw, 94), 8, bg, VIOLET if accent else LINE, 2 if accent else 1)
            draw.text((tx + 10, 60), label, fill=SLATE, font=f["xs"])
            draw.text((tx + 10, 74), value, fill=fg, font=f["score"] if accent else f["lg"])
            tx += tw + 8

    if t > 0.8:
        rr(draw, (16, 104, W - 16, 132), 8, PAPER, LINE)
        draw.text((28, 110), "Verdict:", fill=INK, font=f["sm"])
        block(draw, 82, 110, VERDICT, f["xs"], SLATE, W - 100)

    # findings animate in
    y = 142
    for i, finding in enumerate(FINDINGS):
        appear = 1.2 + i * 0.9
        if t < appear:
            continue
        alpha = min(1.0, (t - appear) / 0.35)
        if alpha <= 0:
            continue

        bg, sev_color = finding["colors"]
        rr(draw, (16, y, W - 16, y + 58), 8, bg if alpha > 0.5 else PAPER, sev_color if alpha > 0.5 else LINE, 1)

        sev = finding["severity"]
        tw = draw.textlength(sev, font=f["xs"]) + 12
        rr(draw, (24, y + 8, 24 + tw, y + 22), 4, sev_color)
        draw.text((30, y + 10), sev, fill=PAPER, font=f["xs"])

        draw.text((24 + tw + 8, y + 10), finding["category"], fill=SLATE, font=f["xs"])
        draw.text((W - 120, y + 10), finding["location"], fill=SLATE, font=f["xs"])

        block(draw, 24, y + 26, finding["issue"], f["xs"], INK, W - 48, 1)
        draw.text((24, y + 46), "Fix:", fill=INK, font=f["xs"])
        block(draw, 48, y + 46, finding["fix"], f["xs"], SLATE, W - 70, 1)
        y += 64


def render(t: float, f) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    if t < 2.8:
        scene_input(d, f, t, reviewing=False)
    elif t < 4.5:
        scene_reviewing(d, f, t - 2.8)
    else:
        scroll = 0.08 * math.sin((t - 4.5) * 0.9) if t > 10 else 0
        scene_results(d, f, t - 4.5 - scroll)

    footer(d, f)
    return img


def build():
    f = fonts()
    loop = 16.0
    frames = []
    for i in range(int(loop * FPS)):
        frames.append(render(i / FPS, f).quantize(colors=128, method=Image.Quantize.MEDIANCUT))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(OUT, save_all=True, append_images=frames[1:],
                   duration=DURATION_MS, loop=0, optimize=True, disposal=2)
    print(f"Wrote {OUT} — {len(frames)} frames, {OUT.stat().st_size / 1024:.0f} KB, {loop:.0f}s @ {FPS}fps")


if __name__ == "__main__":
    build()
