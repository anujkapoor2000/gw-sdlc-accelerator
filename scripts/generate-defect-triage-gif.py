#!/usr/bin/env python3
"""Generate defect-triage.gif — animated showcase of the Defect Triage Agent."""

from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "media" / "defect-triage.gif"
W, H = 800, 480
FPS = 10
DURATION_MS = 1000 // FPS

INK = (15, 23, 42)
SLATE = (100, 116, 139)
LINE = (231, 233, 238)
PAPER = (255, 255, 255)
BLUE = (37, 99, 235)
BLUE_TINT = (239, 246, 255)
GREEN = (22, 163, 74)
GREEN_TINT = (236, 253, 245)
RED = (239, 68, 68)
BG = (248, 250, 252)
MONO_BG = (11, 17, 32)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

DEFECT = (
    "Since Monday, renewal bind fails intermittently for commercial property policies "
    "with more than one location. Users see \"An unexpected error occurred\" on the bind "
    "screen. Started after the weekend deployment. Roughly 1 in 5 attempts fail."
)
EVIDENCE = (
    "java.lang.IllegalStateException: Bean already committed in bundle\n"
    "  at gw.pl.persistence.core.Bundle.commit(Bundle.java:412)"
)

AGENTS = [
    ("Intake Agent", "Parsing the report into a structured case file", 2.2),
    ("Investigator Agent", "Forming root-cause hypotheses", 3.0),
    ("Router Agent", "Deciding: route the case, or send it back", 2.4),
    ("Fix Planner Agent", "Producing workaround, permanent fix and regression", 2.8),
]

OUTCOME = {
    "root_cause": (
        "Custom Gosu pre-bind validation commits the PolicyPeriod bundle before "
        "OOTB bind completes — race on multi-location commercial renewals."
    ),
    "handoff": (
        "Check CommercialPropertyBindValidator.gs from Saturday deploy. "
        "Stack trace confirms premature bundle.commit() during location validation."
    ),
    "workaround": (
        "Disable custom validator rule via internal tools for affected LOB until hotfix ships."
    ),
    "fix_steps": [
        "Refactor validation to read-only bundle access — defer commit to OOTB bind",
        "Add GUnit test for multi-location renewal bind path",
        "Deploy hotfix via standard sprint release vehicle",
    ],
}


def fonts():
    return {
        "xs": ImageFont.truetype(FONT, 10),
        "sm": ImageFont.truetype(FONT, 11),
        "md": ImageFont.truetype(FONT_BOLD, 12),
        "lg": ImageFont.truetype(FONT_BOLD, 14),
        "xl": ImageFont.truetype(FONT_BOLD, 20),
        "cap": ImageFont.truetype(FONT_BOLD, 9),
        "mono": ImageFont.truetype(MONO, 10),
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
    draw.text((16, H - 18), "GuidewireAI · Defect Triage Agent", fill=(203, 213, 225), font=f["xs"])
    draw.text((W - 185, H - 18), "NTT DATA Guidewire Practice", fill=(147, 197, 253), font=f["xs"])


def header(draw, f, compact=False):
    draw.text((20, 14 if compact else 16), "OPERATE · AGENTIC MODULE", fill=BLUE, font=f["cap"])
    draw.text((20, 28 if compact else 32), "Defect Triage Agent", fill=INK, font=f["xl"] if not compact else f["lg"])
    if not compact:
        block(draw, 20, 58, "Four specialist agents work the case autonomously — intake, investigate, route, and plan the fix.",
              f["sm"], SLATE, W - 40)


def scene_form(draw, f, t: float, running: bool):
    header(draw, f)
    y0 = 92
    rr(draw, (16, y0, W - 16, y0 + 132), 12, PAPER, LINE)

    draw.text((28, y0 + 10), "Product", fill=SLATE, font=f["xs"])
    rr(draw, (28, y0 + 24, 148, y0 + 44), 6, PAPER, LINE)
    draw.text((36, y0 + 28), "PolicyCenter", fill=INK, font=f["sm"])

    draw.text((162, y0 + 10), "Environment", fill=SLATE, font=f["xs"])
    rr(draw, (162, y0 + 24, 278, y0 + 44), 6, PAPER, LINE)
    draw.text((170, y0 + 28), "Production", fill=INK, font=f["sm"])

    draw.text((28, y0 + 52), "Defect report", fill=SLATE, font=f["xs"])
    rr(draw, (28, y0 + 66, W - 28, y0 + 118), 6, (250, 251, 252), LINE)
    chars = int(len(DEFECT) * min(1, t / 1.8))
    ty = y0 + 72
    for line in textwrap.wrap(DEFECT[:chars], width=90)[:3]:
        draw.text((36, ty), line, fill=INK, font=f["xs"])
        ty += 12

    if t > 1.9:
        draw.text((28, y0 + 124), "Evidence (stack trace)", fill=SLATE, font=f["xs"])
        rr(draw, (130, y0 + 122, W - 28, y0 + 140), 6, MONO_BG)
        ev_chars = int(len(EVIDENCE) * min(1, (t - 1.9) / 0.8))
        draw.text((138, y0 + 126), EVIDENCE[:ev_chars].replace("\n", " "), fill=(180, 200, 230), font=f["mono"])

    btn_y = y0 + 148
    rr(draw, (28, btn_y, 200, btn_y + 28), 8, (29, 78, 216) if running else BLUE)
    label = "Agents working…" if running else "Run triage pipeline"
    draw.text((44, btn_y + 7), label, fill=PAPER, font=f["md"])

    if running:
        draw.text((220, btn_y + 9), "● ● ●", fill=BLUE, font=f["md"])


def scene_timeline(draw, f, agent_t: float):
    header(draw, f, compact=True)

    # compact context bar
    rr(draw, (16, 58, W - 16, 88), 8, BLUE_TINT, BLUE, 1)
    draw.text((28, 64), "Example defect:", fill=BLUE, font=f["xs"])
    draw.text((28, 78), "Intermittent renewal bind failure · PolicyCenter · Production", fill=INK, font=f["sm"])

    draw.text((20, 100), "Agent timeline", fill=INK, font=f["lg"])
    y = 124
    durations = [a[2] for a in AGENTS]
    cursor = 0.0
    active = 3
    states: list[str] = ["pending"] * 4

    for i, dur in enumerate(durations):
        if agent_t >= cursor + dur:
            states[i] = "done"
            cursor += dur
        elif agent_t >= cursor:
            states[i] = "running"
            active = i
            break
        else:
            states[i] = "pending"
            break
    else:
        active = 3
        states = ["done"] * 4

    for i, (name, note, dur) in enumerate(AGENTS):
        if states[i] == "pending":
            continue
        running = states[i] == "running"
        done = states[i] == "done"
        rr(draw, (16, y, W - 16, y + 48), 10, BLUE_TINT if running else PAPER, BLUE if running else LINE, 2 if running else 1)
        draw.rectangle((16, y, 20, y + 48), fill=BLUE)

        cy = y + 24
        if running:
            pulse = 0.6 + 0.4 * math.sin(agent_t * 8)
            r = int(5 * pulse)
            draw.ellipse((30 - r, cy - r, 30 + r, cy + r), fill=BLUE)
            status = "working…"
            status_color = BLUE
        else:
            draw.ellipse((26, cy - 4, 34, cy + 4), fill=BLUE)
            status = f"{dur:.1f}s ✓"
            status_color = SLATE

        draw.text((44, y + 10), name, fill=INK, font=f["md"])
        draw.text((44, y + 28), note, fill=SLATE, font=f["xs"])
        draw.text((W - 100, y + 18), status, fill=status_color, font=f["mono"])
        y += 56

    # mini preview of outcome as last agent completes
    if states[3] == "done":
        alpha = min(1, (agent_t - sum(durations)) / 0.8)
        if alpha > 0:
            oy = min(y + 4, 310)
            rr(draw, (16, oy, W - 16, oy + 56), 10, PAPER, LINE)
            draw.text((28, oy + 8), "Triage outcome", fill=INK, font=f["md"])
            tx = 28
            for lbl, bg, fg in [("P2", (254, 226, 226), RED), ("defect", (241, 245, 249), SLATE),
                                ("→ Config Dev", GREEN_TINT, GREEN), ("78% confidence", BLUE_TINT, BLUE)]:
                tw = draw.textlength(lbl, font=f["xs"]) + 12
                rr(draw, (tx, oy + 28, tx + tw, oy + 42), 4, bg)
                draw.text((tx + 6, oy + 30), lbl, fill=fg, font=f["xs"])
                tx += tw + 5


def scene_outcome(draw, f, scroll: float):
    header(draw, f, compact=True)
    y = 54 - int(scroll * 40)

    rr(draw, (16, y, W - 16, y + 96), 12, PAPER, LINE)
    draw.text((28, y + 10), "Triage outcome", fill=INK, font=f["lg"])
    tx = 28
    for lbl, bg, fg in [("P2", (254, 226, 226), RED), ("defect", (241, 245, 249), SLATE),
                        ("→ Config Dev", GREEN_TINT, GREEN), ("confidence 78%", BLUE_TINT, BLUE)]:
        tw = draw.textlength(lbl, font=f["xs"]) + 12
        rr(draw, (tx, y + 32, tx + tw, y + 46), 4, bg)
        draw.text((tx + 6, y + 34), lbl, fill=fg, font=f["xs"])
        tx += tw + 5

    draw.text((28, y + 54), "Root cause:", fill=INK, font=f["sm"])
    block(draw, 96, y + 54, OUTCOME["root_cause"], f["xs"], SLATE, W - 120)
    draw.text((28, y + 76), "Handoff:", fill=INK, font=f["sm"])
    block(draw, 82, y + 76, OUTCOME["handoff"], f["xs"], SLATE, W - 100)

    y2 = y + 106
    rr(draw, (16, y2, W - 16, y2 + 130), 12, PAPER, LINE)
    draw.text((28, y2 + 10), "Fix plan", fill=INK, font=f["lg"])
    draw.text((28, y2 + 32), "Workaround:", fill=INK, font=f["sm"])
    block(draw, 100, y2 + 32, OUTCOME["workaround"], f["xs"], SLATE, W - 120)
    draw.text((28, y2 + 54), "Permanent fix — 2-4 dev-days:", fill=INK, font=f["sm"])
    ly = y2 + 70
    for i, step in enumerate(OUTCOME["fix_steps"], 1):
        draw.text((36, ly), f"{i}. {step}", fill=SLATE, font=f["xs"])
        ly += 14

    draw.text((28, y2 + 112), "Regression: GUnit multi-location bind · GT-UI renewal smoke · manual prod verification",
              fill=SLATE, font=f["xs"])


def render(t: float, f) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    if t < 3.0:
        scene_form(d, f, t, running=t >= 2.6)
    elif t < 13.5:
        scene_timeline(d, f, t - 3.0)
    else:
        scroll = 0.12 * math.sin((t - 13.5) * 1.2)
        scene_outcome(d, f, scroll)

    footer(d, f)
    return img


def build():
    f = fonts()
    loop = 18.0
    frames = []
    for i in range(int(loop * FPS)):
        frame = render(i / FPS, f)
        frames.append(frame.quantize(colors=128, method=Image.Quantize.MEDIANCUT))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(OUT, save_all=True, append_images=frames[1:],
                   duration=DURATION_MS, loop=0, optimize=True, disposal=2)
    print(f"Wrote {OUT} — {len(frames)} frames, {OUT.stat().st_size / 1024:.0f} KB, {loop:.0f}s @ {FPS}fps")


if __name__ == "__main__":
    build()
