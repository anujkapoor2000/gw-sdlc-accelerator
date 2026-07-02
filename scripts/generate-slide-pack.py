#!/usr/bin/env python3
"""Generate McKinsey-style GW SDLC Accelerator slide pack (.pptx)."""

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

# McKinsey-inspired palette
NAVY = RGBColor(0x05, 0x1C, 0x2C)
NAVY_MID = RGBColor(0x0D, 0x2D, 0x45)
TEAL = RGBColor(0x00, 0xA9, 0xCE)
GOLD = RGBColor(0xC4, 0xA3, 0x5A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY_100 = RGBColor(0xF4, 0xF6, 0xF8)
GRAY_400 = RGBColor(0x8A, 0x9B, 0xAB)
GRAY_600 = RGBColor(0x5A, 0x6D, 0x7E)
TEXT = RGBColor(0x1A, 0x2B, 0x3C)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
OUT = Path(__file__).resolve().parent.parent / "docs" / "accelerators-slide-pack.pptx"


def blank_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def fill_rect(slide, left, top, width, height, color):
    shape = slide.shapes.add_shape(1, left, top, width, height)  # MSO_SHAPE.RECTANGLE
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_textbox(slide, left, top, width, height, text, size=14, bold=False, color=TEXT,
                align=PP_ALIGN.LEFT, font_name="Calibri", anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    run = p.runs[0]
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font_name
    return box


def add_bullets(slide, left, top, width, height, items, size=11, color=TEXT, spacing=6):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = item
        p.level = 0
        p.space_after = Pt(spacing)
        p.font.size = Pt(size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        p.bullet = True
    return box


def add_footer(slide, page_num):
    add_textbox(slide, Inches(0.5), Inches(7.05), Inches(3), Inches(0.3),
                "GW SDLC Accelerator", size=8, bold=True, color=NAVY)
    add_textbox(slide, Inches(5.5), Inches(7.05), Inches(2.3), Inches(0.3),
                "Confidential", size=8, color=GRAY_400, align=PP_ALIGN.CENTER)
    add_textbox(slide, Inches(12.3), Inches(7.05), Inches(0.5), Inches(0.3),
                str(page_num), size=8, color=GRAY_400, align=PP_ALIGN.RIGHT)
    fill_rect(slide, Inches(0), Inches(6.95), SLIDE_W, Inches(0.01), GRAY_100)


def add_header_slide(slide, action_title, subtitle):
    fill_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.35), NAVY)
    add_textbox(slide, Inches(0.55), Inches(0.25), Inches(12.2), Inches(0.75),
                action_title, size=20, bold=True, color=WHITE)
    add_textbox(slide, Inches(0.55), Inches(0.95), Inches(12), Inches(0.3),
                subtitle, size=10, color=GRAY_400)


def add_so_what(slide, text, top=Inches(1.55)):
    shape = fill_rect(slide, Inches(0.5), top, Inches(12.3), Inches(0.65), GRAY_100)
    # teal left bar
    fill_rect(slide, Inches(0.5), top, Inches(0.06), Inches(0.65), TEAL)
    add_textbox(slide, Inches(0.7), top + Inches(0.08), Inches(12), Inches(0.5),
                text, size=11, bold=True, color=NAVY)


def add_metric_card(slide, left, top, value, label, width=Inches(2.8)):
    fill_rect(slide, left, top, width, Inches(1.05), GRAY_100)
    fill_rect(slide, left, top, width, Inches(0.05), TEAL)
    add_textbox(slide, left, top + Inches(0.12), width, Inches(0.5),
                value, size=22, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_textbox(slide, left + Inches(0.1), top + Inches(0.58), width - Inches(0.2), Inches(0.4),
                label, size=8, color=GRAY_600, align=PP_ALIGN.CENTER)


def add_table(slide, left, top, width, headers, rows, col_widths=None):
    n_rows = len(rows) + 1
    n_cols = len(headers)
    table_shape = slide.shapes.add_table(n_rows, n_cols, left, top, width, Inches(0.32 * n_rows))
    table = table_shape.table

    if col_widths:
        for i, w in enumerate(col_widths):
            table.columns[i].width = w

    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        for p in cell.text_frame.paragraphs:
            p.font.size = Pt(8)
            p.font.bold = True
            p.font.color.rgb = WHITE

    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            cell = table.cell(i, j)
            cell.text = val
            if i % 2 == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = GRAY_100
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(8)
                p.font.color.rgb = TEXT
                if j == 0:
                    p.font.bold = True
    return table_shape


def slide_title(prs, page):
    slide = blank_slide(prs)
    fill_rect(slide, Inches(0), Inches(0), SLIDE_W, SLIDE_H, NAVY)
    fill_rect(slide, Inches(0), Inches(7.35), SLIDE_W, Inches(0.15), TEAL)
    add_textbox(slide, Inches(0.8), Inches(1.8), Inches(10), Inches(0.4),
                "NTT DATA GUIDEWIRE PRACTICE", size=10, color=TEAL)
    add_textbox(slide, Inches(0.8), Inches(2.3), Inches(10), Inches(1.2),
                "GW SDLC Accelerator", size=44, color=WHITE)
    add_textbox(slide, Inches(0.8), Inches(3.5), Inches(9), Inches(0.8),
                "AI-assisted lifecycle tooling for Guidewire InsuranceSuite — from requirements to release and operate",
                size=16, color=GRAY_400)
    add_textbox(slide, Inches(0.8), Inches(5.8), Inches(10), Inches(0.6),
                "GuidewireAI · Internal Accelerator v1.0\nJuly 2026 · Confidential — For Internal & Client Use",
                size=10, color=GRAY_400)
    return slide


def slide_section(prs, num, title, desc):
    slide = blank_slide(prs)
    fill_rect(slide, Inches(0), Inches(0), SLIDE_W, SLIDE_H, NAVY_MID)
    add_textbox(slide, Inches(0.8), Inches(2.2), Inches(2), Inches(1.2),
                num, size=72, color=TEAL)
    add_textbox(slide, Inches(0.8), Inches(3.5), Inches(10), Inches(0.8),
                title, size=32, color=WHITE)
    add_textbox(slide, Inches(0.8), Inches(4.4), Inches(8), Inches(0.8),
                desc, size=14, color=GRAY_400)
    return slide


def slide_next_steps(prs):
    slide = blank_slide(prs)
    fill_rect(slide, Inches(0), Inches(0), SLIDE_W, SLIDE_H, NAVY)
    fill_rect(slide, Inches(0), Inches(7.35), SLIDE_W, Inches(0.15), TEAL)
    add_textbox(slide, Inches(0.8), Inches(1.8), Inches(4), Inches(0.4),
                "NEXT STEPS", size=10, color=TEAL)
    add_textbox(slide, Inches(0.8), Inches(2.3), Inches(10), Inches(0.8),
                "Deploy. Demo. Deliver.", size=36, color=WHITE)
    add_bullets(slide, Inches(0.8), Inches(3.3), Inches(9), Inches(2.2), [
        "Deploy to Vercel with Anthropic + Neon credentials",
        "Schedule a client showcase using the live application",
        "Open /katalon in Katalon Studio for hands-on automation demo",
        "Update ROI benchmarks in catalog.js as evidence firms up",
    ], size=13, color=GRAY_400, spacing=10)
    add_textbox(slide, Inches(0.8), Inches(5.8), Inches(10), Inches(0.6),
                "NTT DATA Guidewire Practice · GuidewireAI\ngw-sdlc-accelerator · Internal v1.0 · July 2026",
                size=11, color=TEAL)
    return slide


def build():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    page = 0

    # 1 Title
    slide_title(prs, page := 1)

    # 2 Executive Summary
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Seven AI accelerators span the full Guidewire delivery lifecycle — compressing time-to-value at every gate",
        "Executive Summary")
    add_so_what(slide,
        "The GW SDLC Accelerator packages proven AI patterns into a single web application, complemented by a ready-to-run Katalon automation library.")
    add_textbox(slide, Inches(0.5), Inches(2.35), Inches(2), Inches(0.25),
                "THE CHALLENGE", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(0.5), Inches(2.6), Inches(5.8), Inches(2.2), [
        "Guidewire programmes stall on repetitive manual work across story writing, code review, test design, UI automation, upgrade planning, and defect triage",
        "Delivery centres lack consistent standards across geographies and seniority levels",
        "UI test packs rot with every customisation and ski release",
        "AMS teams face 24/7 defect volume with limited L2/L3 capacity",
    ], size=10)
    add_textbox(slide, Inches(6.8), Inches(2.35), Inches(2), Inches(0.25),
                "OUR RESPONSE", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(6.8), Inches(2.6), Inches(5.8), Inches(2.2), [
        "7 AI modules mapped to Plan → Build → Test → Release → Operate",
        "1 Katalon accelerator with 12 ready-to-run flows across PC, CC, BC & Jutro",
        "Powered by Claude Sonnet via secure server-side API proxy",
        "All outputs persisted to Neon Postgres and exportable as JSON",
        "Indicative ROI: 30–70% effort reduction across targeted activities",
    ], size=10)
    add_metric_card(slide, Inches(0.5), Inches(5.1), "7", "AI accelerators live")
    add_metric_card(slide, Inches(3.6), Inches(5.1), "12", "Katalon flows shipped")
    add_metric_card(slide, Inches(6.7), Inches(5.1), "5", "SDLC phases covered")
    add_metric_card(slide, Inches(9.8), Inches(5.1), "5", "Automation frameworks supported")
    add_footer(slide, page := 2)

    # 3 Lifecycle
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Each SDLC phase has a dedicated accelerator — creating a connected value chain from backlog to production",
        "Lifecycle Architecture")
    phases = [
        ("PLAN", "Story Forge", "Requirements → INVEST stories\nGherkin ACs · GW touchpoints"),
        ("BUILD", "Code Review Copilot", "Gosu · PCF · Integration\nSeverity findings · Upgrade-safety"),
        ("TEST", "Test Strategist · Flow Automator · Test Migrator", "Pyramid cases · Katalon scripts\nManual → automation"),
        ("RELEASE", "Release Navigator", "CI/CD maturity · Ski-release impact\nPre-upgrade checklist"),
        ("OPERATE", "Defect Triage Agent", "4-agent pipeline · Self-correction\n24/7 first-pass triage"),
    ]
    x = Inches(0.4)
    w = Inches(2.45)
    for label, box, modules in phases:
        add_textbox(slide, x, Inches(1.55), w, Inches(0.25), label, size=7, bold=True, color=GRAY_400, align=PP_ALIGN.CENTER)
        fill_rect(slide, x, Inches(1.85), w, Inches(0.55), NAVY)
        add_textbox(slide, x + Inches(0.05), Inches(1.9), w - Inches(0.1), Inches(0.45),
                    box, size=8, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        add_textbox(slide, x, Inches(2.5), w, Inches(0.7), modules, size=7, color=GRAY_600, align=PP_ALIGN.CENTER)
        x += w + Inches(0.12)
    add_textbox(slide, Inches(0.5), Inches(3.4), Inches(2), Inches(0.25),
                "TESTING ACCELERATORS (4)", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(0.5), Inches(3.65), Inches(5.8), Inches(2.5), [
        "Story Forge — eliminates the blank-page problem for BAs",
        "Test Strategist — keeps test design pace with development",
        "Flow Automator — scaffolds Katalon UI regression in minutes",
        "Test Migrator — converts legacy manual packs to automation",
    ], size=10)
    add_textbox(slide, Inches(6.8), Inches(3.4), Inches(2.5), Inches(0.25),
                "ANALYSIS ACCELERATORS (3)", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(6.8), Inches(3.65), Inches(5.8), Inches(2.5), [
        "Code Review Copilot — principal-level review on every commit-sized chunk",
        "Release Navigator — evidence-based upgrade planning",
        "Defect Triage Agent — autonomous multi-agent production triage",
    ], size=10)
    add_footer(slide, page := 3)

    # 4 Section Plan & Build
    slide_section(prs, "01", "Plan & Build Accelerators",
                  "Front-load quality at the requirements and code gates — where defects are cheapest to fix")

    # 5 Story Forge
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Story Forge converts raw requirements into sprint-ready, Guidewire-mapped user stories in minutes",
        "Plan · Story Forge")
    add_so_what(slide, "Requirements in, sprint-ready stories out — with Gherkin ACs, Guidewire touchpoints, and Fibonacci estimates pre-populated.")
    add_bullets(slide, Inches(0.5), Inches(2.35), Inches(6), Inches(3.5), [
        "Ingests BRD extracts, workshop notes, emails — any free-text requirements",
        "Produces INVEST-compliant user stories with Gherkin acceptance criteria",
        "Maps each story to Guidewire constructs: entities, PCF, plugins, Cloud API",
        "Generates Fibonacci point estimates with rationale and explicit dependencies",
        "Surfaces open questions for the BA — negative-path ACs by default",
        "Output is JSON, import-ready for Jira or Azure DevOps",
    ], size=10)
    add_metric_card(slide, Inches(7), Inches(2.35), "40–60%", "Less effort per story written")
    add_metric_card(slide, Inches(10.1), Inches(2.35), "~2 days", "Saved per grooming sprint")
    add_table(slide, Inches(7), Inches(3.7), Inches(5.8),
              ["Parameter", "Values"],
              [
                  ["Primary product", "PolicyCenter · ClaimCenter · BillingCenter · Cross-suite"],
                  ["Input", "Free-text requirements"],
                  ["AI pattern", "Structured generation (single-pass)"],
                  ["Output", "Epic + stories JSON → Neon Postgres"],
              ],
              [Inches(1.6), Inches(4.2)])
    add_footer(slide, page := 5)

    # 6 Code Review
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Code Review Copilot delivers principal-level Guidewire review on every commit — catching defects at desk-check cost",
        "Build · Code Review Copilot")
    add_so_what(slide, "Defects caught at review cost 10× less than at UAT — and consume zero reviewer calendar time.")
    add_bullets(slide, Inches(0.5), Inches(2.35), Inches(6), Inches(3.2), [
        "Reviews Gosu, PCF, integration, GX, batch and rules code",
        "Severity-calibrated findings: critical → info, with line-level locations",
        "Concrete fixes naming the Guidewire construct to use",
        "Upgrade-safety flags for deprecated APIs and internal.* packages",
        "Multi-select profiles: Standards · Performance · Upgrade/Cloud · Security",
        "Overall code-health score plus quick-win recommendations",
    ], size=10)
    add_metric_card(slide, Inches(7), Inches(2.35), "30%", "Fewer human review cycles")
    add_metric_card(slide, Inches(9.55), Inches(2.35), "10×", "Cheaper fix at review vs UAT")
    add_metric_card(slide, Inches(12.1), Inches(2.35), "0", "Reviewer calendar time", width=Inches(1.2))
    add_table(slide, Inches(7), Inches(3.7), Inches(5.8),
              ["Category", "Focus"],
              [
                  ["Correctness", "Logic errors, null handling, edge cases"],
                  ["Performance", "Query patterns, caching, batch efficiency"],
                  ["Standards", "Naming, structure, Guidewire conventions"],
                  ["Security", "Injection, auth, data exposure"],
                  ["Upgrade-safety", "OOTB overrides, deprecated APIs, Cloud readiness"],
              ],
              [Inches(1.5), Inches(4.3)])
    add_footer(slide, page := 6)

    # 7 Section Test
    slide_section(prs, "02", "Test Accelerators",
                  "Three complementary tools cover test design, UI automation generation, and legacy manual-to-automation conversion")

    # 8 Test Strategist
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Test Strategist enforces pyramid discipline — assigning the right harness to every test case",
        "Test · Test Strategist")
    add_so_what(slide, "Test design keeps pace with development — with harness selection enforced and test data staged upfront.")
    add_bullets(slide, Inches(0.5), Inches(2.35), Inches(6), Inches(3), [
        "Derives executable test cases from stories, code, or defect descriptions",
        "Selects harness per case: GUnit · GT-API · GT-UI · Manual",
        "Maintains test pyramid health — no GT-UI for logic GUnit should own",
        "Staged test data list eliminates blocked test execution",
        "Each case names the acceptance criterion it covers — full traceability",
    ], size=10)
    add_table(slide, Inches(7), Inches(2.35), Inches(5.8),
              ["Harness", "When Used"],
              [
                  ["GUnit", "Business logic, rules, calculations, entity operations"],
                  ["GT-API", "Cloud API contracts, integration gateways"],
                  ["GT-UI", "End-user journeys requiring screen interaction"],
                  ["Manual", "Exploratory, visual, or environment-dependent scenarios"],
              ],
              [Inches(1.2), Inches(4.6)])
    add_metric_card(slide, Inches(7), Inches(4.9), "50%", "Faster test-case design")
    add_metric_card(slide, Inches(9.55), Inches(4.9), "↑", "Higher automation ratio")
    add_metric_card(slide, Inches(12.1), Inches(4.9), "↓", "Blocked tests from missing data", width=Inches(1.2))
    add_footer(slide, page := 8)

    # 9 Flow Automator
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Flow Automator scaffolds keyword-driven Katalon UI automation for common Guidewire journeys in minutes, not days",
        "Test · Flow Automator")
    add_so_what(slide, "Regression UI packs scaffolded in minutes — with locators centralised in one keyword library per product.")
    add_table(slide, Inches(0.5), Inches(2.35), Inches(6.2),
              ["Product", "Flows"],
              [
                  ["PolicyCenter", "Submission → bind · Mid-term change · Cancellation · Renewal"],
                  ["ClaimCenter", "FNOL · Reserve + payment · Assign + close"],
                  ["BillingCenter", "Direct-bill payment · Invoices · Producer + disbursement"],
                  ["Jutro", "Digital quote-and-buy · Self-service FNOL"],
              ],
              [Inches(1.4), Inches(4.8)])
    add_metric_card(slide, Inches(7), Inches(2.35), "60%+", "Faster first-draft UI automation")
    add_metric_card(slide, Inches(9.55), Inches(2.35), "12", "Ready-to-run flows in /katalon")
    add_metric_card(slide, Inches(12.1), Inches(2.35), "1", "Place to fix a locator", width=Inches(1.2))
    add_bullets(slide, Inches(7), Inches(3.7), Inches(5.8), Inches(2.5), [
        "Keyword-driven: business actions in reusable libraries",
        "Defensive XPath/CSS locators with label fallbacks",
        "Environment profiles for URL/credential switching",
        "Output matches bundled Katalon accelerator style",
    ], size=10)
    add_footer(slide, page := 9)

    # 10 Test Migrator
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Test Migrator converts legacy manual regression packs into runnable automation — with honest gap analysis per case",
        "Test · Test Migrator")
    add_so_what(slide, "A legacy manual regression pack becomes automation drafts in minutes — with per-case verdicts on automate, fix-then-automate, or keep manual.")
    add_bullets(slide, Inches(0.5), Inches(2.35), Inches(6), Inches(3), [
        "Ingests manual test cases from Excel, ALM, Zephyr, qTest — single or bulk",
        "Converts each into a runnable automated script in the chosen framework",
        "Surfaces gaps: missing preconditions, ambiguous steps, no verification point",
        "Itemises test data per script with generate / stage / existing-record strategy",
        "Honest automation verdict per case",
    ], size=10)
    add_table(slide, Inches(7), Inches(2.35), Inches(5.8),
              ["Framework", "Output"],
              [
                  ["Katalon (Groovy)", "Keyword-driven, matches /katalon style"],
                  ["Guidewire GT", "GT-UI and GT-API harness scripts"],
                  ["Playwright", "TypeScript test files"],
                  ["Selenium + Java", "TestNG test classes"],
                  ["Cucumber BDD", "Feature files with step definitions"],
              ],
              [Inches(1.5), Inches(4.3)])
    add_metric_card(slide, Inches(7), Inches(5.0), "70%+", "Faster manual-to-automation conversion")
    add_metric_card(slide, Inches(9.8), Inches(5.0), "Per case", "Gap + test-data analysis")
    add_footer(slide, page := 10)

    # 11 Section Analysis
    slide_section(prs, "03", "Analysis Accelerators",
                  "Evidence-based decision support for release readiness and production defect management")

    # 12 Release Navigator
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Release Navigator reveals what the next ski release does to your customisations — before it lands",
        "Release · Release Navigator")
    add_so_what(slide, "Upgrade planning starts from evidence, not guesswork — with effort bands that support AMS commercial conversations weeks earlier.")
    add_bullets(slide, Inches(0.5), Inches(2.35), Inches(6), Inches(3.2), [
        "CI/CD Maturity Self-Check — 16 practices across 4 groups with live scoring",
        "AI Impact Analysis — customisation inventory vs target ski release",
        "Per-area impact rating, remediation actions, and regression focus",
        "Effort band (S/M/L/XL) supports commercial scoping",
        "Pre-upgrade checklist doubles as onboarding assessment for new AMS accounts",
        "Target releases: Innsbruck · Hakuba · Garmisch · Las Leñas · Palisades · Next",
    ], size=10)
    add_table(slide, Inches(7), Inches(2.35), Inches(5.8),
              ["Group", "Practices"],
              [
                  ["Source Control", "Branching, PR reviews, merge policies"],
                  ["Build & Deploy", "CI pipelines, artefact management, env promotion"],
                  ["Testing", "Automation coverage, regression gates, data management"],
                  ["Operations", "Monitoring, rollback, incident response"],
              ],
              [Inches(1.5), Inches(4.3)])
    add_metric_card(slide, Inches(7), Inches(4.9), "20–30%", "Less upgrade regression effort")
    add_metric_card(slide, Inches(9.55), Inches(4.9), "Weeks", "Earlier remediation visibility")
    add_metric_card(slide, Inches(12.1), Inches(4.9), "2-in-1", "Maturity + impact", width=Inches(1.2))
    add_footer(slide, page := 12)

    # 13 Defect Triage
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Defect Triage Agent runs a four-agent pipeline with self-correction — delivering L2/L3 triage in minutes, 24/7",
        "Operate · Defect Triage Agent (Agentic)")
    add_so_what(slide, "The only agentic module — a demonstrable multi-agent capability with confidence-gated self-correction for client showcases.")
    agents = ["Intake Agent", "Investigator", "Router ⟲", "Fix Planner"]
    ax = Inches(0.5)
    for agent in agents:
        fill_rect(slide, ax, Inches(2.35), Inches(2.6), Inches(0.7), NAVY)
        add_textbox(slide, ax, Inches(2.45), Inches(2.6), Inches(0.5),
                    agent, size=9, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        ax += Inches(2.85)
    add_bullets(slide, Inches(0.5), Inches(3.3), Inches(6), Inches(2.8), [
        "Intake — structures raw defect report into structured case file",
        "Investigator — ranked root-cause hypotheses with confidence scores",
        "Router — assigns team, priority (P1–P4); loops back if confidence < 65% (max 2 passes)",
        "Fix Planner — workaround, permanent fix, regression coverage, prevention step",
        "Every handoff renders on a live timeline with inspectable agent output",
    ], size=10)
    add_metric_card(slide, Inches(7), Inches(3.3), "35–50%", "Faster mean-time-to-triage")
    add_metric_card(slide, Inches(9.55), Inches(3.3), "24/7", "First-pass triage coverage")
    add_metric_card(slide, Inches(12.1), Inches(3.3), "↓", "Misrouting & ping-pong", width=Inches(1.2))
    add_table(slide, Inches(7), Inches(4.6), Inches(5.8),
              ["Parameter", "Value"],
              [
                  ["Loop threshold", "Confidence < 65% triggers re-investigation"],
                  ["Loop budget", "Max 2 extra passes"],
                  ["Evidence", "Optional logs / stack trace / code raises confidence"],
              ],
              [Inches(1.6), Inches(4.2)])
    add_footer(slide, page := 13)

    # 14 Katalon
    slide = blank_slide(prs)
    add_header_slide(slide,
        "The Katalon Flow Automation accelerator ships 12 ready-to-run flows — the physical execution layer behind Flow Automator",
        "Companion Asset · Guidewire Flow Automation (Katalon)")
    add_so_what(slide, "UI test packs rot fast — this accelerator front-loads locators and boilerplate so teams focus on flows, not maintenance.")
    add_table(slide, Inches(0.5), Inches(2.35), Inches(12.3),
              ["App", "Test Case", "Flow"],
              [
                  ["PolicyCenter", "PC01–PC04", "PA submission → bind · Mid-term change · Cancellation · Renewal"],
                  ["ClaimCenter", "CC01–CC03", "FNOL · Reserve + payment · Assign + close"],
                  ["BillingCenter", "BC01–BC03", "Direct-bill payment · Invoices · Producer + disbursement"],
                  ["Jutro", "JU01–JU02", "Digital quote-and-buy · Self-service FNOL"],
              ],
              [Inches(1.5), Inches(1.2), Inches(9.6)])
    add_textbox(slide, Inches(0.5), Inches(4.5), Inches(3.8), Inches(0.25),
                "KEYWORD LIBRARIES", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(0.5), Inches(4.75), Inches(3.8), Inches(1.8), [
        "GuidewireUI · LoginActions",
        "PolicyCenterActions · ClaimCenterActions",
        "BillingCenterActions · JutroActions · TestData",
    ], size=9)
    add_textbox(slide, Inches(4.6), Inches(4.5), Inches(3.8), Inches(0.25),
                "TEST SUITES", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(4.6), Inches(4.75), Inches(3.8), Inches(1.8), [
        "PC · CC · BC · Jutro Regression",
        "Smoke — All Products",
        "Profiles: default.glbl · qa.glbl",
    ], size=9)
    add_textbox(slide, Inches(8.7), Inches(4.5), Inches(3.8), Inches(0.25),
                "CI INTEGRATION", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(8.7), Inches(4.75), Inches(3.8), Inches(1.8), [
        "Headless via katalonc (Runtime Engine)",
        "Katalon Studio 8.x+ — open /katalon directly",
        "Defensive XPath: one-line fix per customisation",
    ], size=9)
    add_footer(slide, page := 14)

    # 15 Architecture
    slide = blank_slide(prs)
    add_header_slide(slide,
        "A secure, serverless architecture keeps API keys server-side while persisting all outputs to project storage",
        "Technical Architecture")
    fill_rect(slide, Inches(0.5), Inches(1.65), Inches(5.8), Inches(0.7), NAVY)
    add_textbox(slide, Inches(0.6), Inches(1.75), Inches(5.6), Inches(0.5),
                "React 18 + Vite Frontend\n7 module pages · NTT DATA brand", size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(slide, Inches(2.8), Inches(2.45), Inches(1.2), Inches(0.3), "↓", size=16, color=TEAL, align=PP_ALIGN.CENTER)
    fill_rect(slide, Inches(0.5), Inches(2.8), Inches(5.8), Inches(0.55), GRAY_100)
    add_textbox(slide, Inches(0.6), Inches(2.9), Inches(5.6), Inches(0.4),
                "Vercel Serverless API\n/api/chat.js · /api/projects.js", size=9, color=TEXT, align=PP_ALIGN.CENTER)
    add_textbox(slide, Inches(2.8), Inches(3.45), Inches(1.2), Inches(0.3), "↓", size=16, color=TEAL, align=PP_ALIGN.CENTER)
    fill_rect(slide, Inches(0.5), Inches(3.8), Inches(2.7), Inches(0.55), GRAY_100)
    add_textbox(slide, Inches(0.55), Inches(3.9), Inches(2.6), Inches(0.4),
                "Anthropic API\nClaude Sonnet 4.6", size=9, color=TEXT, align=PP_ALIGN.CENTER)
    fill_rect(slide, Inches(3.6), Inches(3.8), Inches(2.7), Inches(0.55), GRAY_100)
    add_textbox(slide, Inches(3.65), Inches(3.9), Inches(2.6), Inches(0.4),
                "Neon Postgres\nProjects + artifacts", size=9, color=TEXT, align=PP_ALIGN.CENTER)
    fill_rect(slide, Inches(7), Inches(1.65), Inches(5.8), Inches(0.7), NAVY)
    add_textbox(slide, Inches(7.1), Inches(1.75), Inches(5.6), Inches(0.5),
                "Katalon Studio Project (/katalon)\nKeyword libs → Test cases → Suites", size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(slide, Inches(9.3), Inches(2.45), Inches(1.2), Inches(0.3), "↓", size=16, color=TEAL, align=PP_ALIGN.CENTER)
    fill_rect(slide, Inches(7), Inches(2.8), Inches(5.8), Inches(0.55), GRAY_100)
    add_textbox(slide, Inches(7.1), Inches(2.9), Inches(5.6), Inches(0.4),
                "katalonc (Runtime Engine)\nHeadless CI execution", size=9, color=TEXT, align=PP_ALIGN.CENTER)
    add_textbox(slide, Inches(7), Inches(3.7), Inches(2), Inches(0.25),
                "SECURITY POSTURE", size=9, bold=True, color=TEAL)
    add_bullets(slide, Inches(7), Inches(4.0), Inches(5.8), Inches(2.2), [
        "ANTHROPIC_API_KEY — server-side only, never reaches browser",
        "DATABASE_URL — Neon pooled connection on Vercel",
        "All module outputs saved to project with JSON export",
        "SPA routing via vercel.json rewrites",
    ], size=10)
    add_footer(slide, page := 15)

    # 16 ROI
    slide = blank_slide(prs)
    add_header_slide(slide,
        "Indicative ROI ranges from 30% to 70% effort reduction — concentrated at the highest-volume manual activities",
        "Value at a Glance")
    add_table(slide, Inches(0.4), Inches(1.55), Inches(12.5),
              ["Accelerator", "Phase", "Primary Metric", "Secondary Metric", "Key Benefit"],
              [
                  ["Story Forge", "Plan", "40–60% less effort per story", "~2 days saved per grooming sprint", "Fewer AC gaps reaching SIT/UAT"],
                  ["Code Review Copilot", "Build", "30% fewer review cycles", "10× cheaper fix at review vs UAT", "Zero reviewer calendar time"],
                  ["Test Strategist", "Test", "50% faster test-case design", "Higher automation ratio", "Fewer blocked tests from missing data"],
                  ["Flow Automator", "Test", "60%+ faster UI automation", "12 ready-to-run Katalon flows", "One place to fix customised locators"],
                  ["Test Migrator", "Test", "70%+ faster manual conversion", "5 frameworks supported", "Per-case gap + test-data analysis"],
                  ["Release Navigator", "Release", "20–30% less regression effort", "Weeks earlier remediation visibility", "2-in-1 maturity + impact analysis"],
                  ["Defect Triage Agent", "Operate", "35–50% faster MTTT", "24/7 first-pass coverage", "Lower misrouting and ping-pong"],
              ],
              [Inches(1.8), Inches(0.8), Inches(2.5), Inches(2.5), Inches(2.4)])
    add_textbox(slide, Inches(0.5), Inches(6.5), Inches(12), Inches(0.3),
                "All ROI figures are indicative benchmarks from the NTT DATA Guidewire Practice — update in src/lib/catalog.js as firm evidence accumulates.",
                size=8, color=GRAY_400)
    add_footer(slide, page := 16)

    # 17 Adoption
    slide = blank_slide(prs)
    add_header_slide(slide,
        "A phased adoption path moves teams from showcase demos to embedded workflow integration",
        "Recommended Adoption Path")
    steps = [
        ("Discover & Demo (Week 1)",
         "Walk client stakeholders through the showcase. Lead with Defect Triage Agent and Flow Automator + Katalon live demo."),
        ("Pilot on Live Data (Weeks 2–4)",
         "Run Story Forge on real backlog grooming. Feed actual Gosu into Code Review. Convert 10–20 manual cases via Test Migrator."),
        ("Embed in Delivery (Month 2+)",
         "Integrate outputs into Jira/Azure DevOps. Wire Katalon suites into CI. Establish Code Review as a pre-PR gate."),
        ("Measure & Scale (Ongoing)",
         "Track ROI metrics per module. Extend Katalon keyword libraries for client customisations."),
    ]
    y = Inches(1.7)
    for i, (title, desc) in enumerate(steps, 1):
        fill_rect(slide, Inches(0.5), y, Inches(0.35), Inches(0.35), TEAL)
        add_textbox(slide, Inches(0.5), y + Inches(0.02), Inches(0.35), Inches(0.3),
                    str(i), size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        add_textbox(slide, Inches(1.0), y, Inches(11.5), Inches(0.3), title, size=12, bold=True, color=NAVY)
        add_textbox(slide, Inches(1.0), y + Inches(0.32), Inches(11.5), Inches(0.55), desc, size=10, color=GRAY_600)
        y += Inches(1.15)
    add_footer(slide, page := 17)

    # 18 Next Steps
    slide_next_steps(prs)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUT))
    print(f"Wrote {OUT} ({len(prs.slides)} slides)")


if __name__ == "__main__":
    build()
