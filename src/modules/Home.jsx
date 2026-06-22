import React, { useState } from 'react'
import { CATALOG } from '../lib/catalog.js'

// Tab metadata, in display order.
const TABS = [
  {
    id: 'Testing',
    label: 'Testing',
    overline: 'Testing-focused AI',
    title: 'Testing accelerators',
    desc: 'AI tools that generate structured test cases and realistic test data for Guidewire InsuranceSuite modules in seconds.'
  },
  {
    id: 'Analysis',
    label: 'Analysis',
    overline: 'Analysis-focused AI',
    title: 'Analysis accelerators',
    desc: 'AI tools that review code, assess upgrade impact and triage production defects across the Guidewire delivery lifecycle.'
  }
]

// Line icons for each tool (28×28 viewport, stroke = currentColor).
const ICONS = {
  flask: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-8.5V3" />
      <path d="M7.5 14h9" />
    </svg>
  ),
  story: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h9l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M13 4v4h4M8 13h7M8 17h7M8 9h2" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 15c-1.5 1-2 5-2 5s4-.5 5-2a3 3 0 0 0-3-3Z" />
      <path d="M9 13c-1-2-.5-6 3-9 3.5 3 4 7 3 9M14 4c2.5 0 5 2.5 5 5M9 13l-2 2 4 4 2-2" />
    </svg>
  ),
  triage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="6" width="8" height="13" rx="4" />
      <path d="M12 3v3M9 9 5 7M9 13H4M9 17l-4 2M15 9l4-2M15 13h5M15 17l4 2" />
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M12 5V3M12 5a1.5 1.5 0 1 0 0-.01M8.5 13h.01M15.5 13h.01M9 16.5h6M2 12v3M22 12v3" />
    </svg>
  )
}

export default function Home({ go }) {
  const [tab, setTab] = useState('Testing')
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, CATALOG.filter((m) => m.category === t.id).length])
  )
  const active = TABS.find((t) => t.id === tab)
  const tools = CATALOG.filter((m) => m.category === tab)

  return (
    <div>
      <section className="hero">
        <div className="hero-pill">
          <span className="dot" aria-hidden="true" />
          {CATALOG.length} live AI tools · Powered by Claude Sonnet
        </div>
        <h1 className="hero-title">Welcome to the future of insurance testing.</h1>
        <p className="hero-sub">
          A suite of AI accelerators for Guidewire InsuranceSuite — from test case generation to defect
          analysis, built for QA &amp; AMS teams.
        </p>
        <div className="hero-cta">
          <button className="btn btn-primary" onClick={() => go('story-forge')}>Get started</button>
          <button className="btn btn-ghost" onClick={() => go('dashboard')}>Book a demo</button>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Tool categories">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <section className="section">
        <div className="section-overline">{active.overline}</div>
        <h2 className="section-title">{active.title}</h2>
        <p className="section-desc">{active.desc}</p>

        <div className="tool-grid">
          {tools.map((m) => (
            <button key={m.id} className={`tool-card tone-${m.badge.tone}`} onClick={() => go(m.id)}>
              <div className="tool-card-top">
                <span className="tool-icon">{ICONS[m.icon]}</span>
                <span className={`tool-badge tone-${m.badge.tone}`}>{m.badge.label}</span>
              </div>
              <h3 className="tool-name">{m.name}</h3>
              <p className="tool-desc">{m.tagline}</p>
              <span className="tool-launch">Launch tool <span className="arr">→</span></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
