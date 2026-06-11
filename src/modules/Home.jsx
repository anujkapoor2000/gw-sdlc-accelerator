import React, { useState } from 'react'
import { CATALOG, SHARED_CONFIG } from '../lib/catalog.js'
import DemoPreview from '../components/DemoPreview.jsx'

export default function Home({ go }) {
  return (
    <div>
      <header className="page-head showcase-hero">
        <div className="page-eyebrow">NTT DATA Guidewire Practice · AI Accelerator</div>
        <h1 className="page-title" style={{ fontSize: 32 }}>One lifecycle, five copilots.</h1>
        <p className="page-desc">
          AI assistance at every gate of Guidewire InsuranceSuite delivery — from raw requirement to
          production triage. Four structured copilots and one multi-agent pipeline, all on a shared
          project workspace with saved, exportable outputs.
        </p>
        <div className="hero-rail" aria-hidden="true">
          {CATALOG.map((m, i) => (
            <React.Fragment key={m.id}>
              <button className="hero-node" onClick={() => go(m.id)}>
                <span className="hero-phase">{m.phase}</span>
                {m.name}
              </button>
              {i < CATALOG.length - 1 && <span className="hero-link" />}
            </React.Fragment>
          ))}
        </div>
      </header>

      {CATALOG.map((m) => <AgentSection key={m.id} m={m} go={go} />)}

      <div className="panel">
        <h3>Platform configuration (shared)</h3>
        <ConfigTable rows={SHARED_CONFIG} />
        <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 10 }}>
          ROI figures are indicative practice estimates — edit them in <code>src/lib/catalog.js</code> as
          engagement benchmarks firm up. Drop a screen recording at <code>public/media/&lt;agent-id&gt;.gif</code>{' '}
          to replace any animated preview with the real demo.
        </p>
      </div>
    </div>
  )
}

function AgentSection({ m, go }) {
  const [copied, setCopied] = useState(false)
  const path = `/#/${m.id}`
  const fullUrl = `${window.location.origin}${path}`

  function copy() {
    navigator.clipboard?.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <section className="agent-showcase" id={`about-${m.id}`}>
      <div className="agent-showcase-media">
        <DemoPreview id={m.id} />
        <div className="url-row">
          <code className="url-chip">{path}</code>
          <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy URL'}</button>
          <button className="btn btn-primary btn-sm" onClick={() => go(m.id)}>Launch</button>
        </div>
      </div>

      <div className="agent-showcase-body">
        <div className="page-eyebrow">
          {m.phase}{m.agentic ? ' · Agentic' : ''}
        </div>
        <h2 className="showcase-name">{m.name}</h2>
        <p className="showcase-tagline">{m.tagline}</p>
        <p className="showcase-desc">{m.description}</p>

        <div className="roi-row">
          {m.roi.map((r, i) => (
            <div key={i} className="roi-tile">
              <div className="roi-metric">{r.metric}</div>
              <div className="roi-label">{r.label}</div>
            </div>
          ))}
        </div>

        <details className="showcase-details">
          <summary>Benefits</summary>
          <ul className="plain">{m.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </details>

        <details className="showcase-details">
          <summary>Taxonomy</summary>
          <div className="tax-grid">
            {Object.entries(m.taxonomy).map(([k, v]) => (
              <React.Fragment key={k}>
                <div className="tax-k">{k}</div>
                <div className="tax-v">{v}</div>
              </React.Fragment>
            ))}
          </div>
        </details>

        <details className="showcase-details">
          <summary>Configuration parameters</summary>
          <ConfigTable rows={m.config} />
        </details>
      </div>
    </section>
  )
}

function ConfigTable({ rows }) {
  return (
    <table className="config-table">
      <thead>
        <tr><th>Parameter</th><th>Values</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td><code>{r.param}</code></td><td>{r.values}</td></tr>
        ))}
      </tbody>
    </table>
  )
}
