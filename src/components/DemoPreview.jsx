import React, { useState } from 'react'

// Each agent gets a brand-styled animated preview. If a real recording exists at
// /media/<id>.gif (drop it in /public/media/), it replaces the animation automatically.

export default function DemoPreview({ id }) {
  const [gifOk, setGifOk] = useState(true)
  return (
    <div className="demo-frame">
      {gifOk && (
        <img
          src={`/media/${id}.gif`}
          alt={`${id} demo recording`}
          className="demo-gif"
          onError={() => setGifOk(false)}
        />
      )}
      {!gifOk && <Animated id={id} />}
    </div>
  )
}

function Animated({ id }) {
  switch (id) {
    case 'story-forge':
      return (
        <div className="anim" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="anim-card" style={{ animationDelay: `${i * 1.4}s` }}>
              <span className="anim-line w70" />
              <span className="anim-line w50" />
              <span className="anim-pill">{[3, 5, 8][i]} pts</span>
            </div>
          ))}
        </div>
      )
    case 'code-review':
      return (
        <div className="anim" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="anim-coderow" style={{ animationDelay: `${i * 0.9}s` }}>
              <span className="anim-line mono" style={{ width: `${[78, 62, 84, 55][i]}%` }} />
              <span className={`anim-dot sev-${['crit', 'major', 'minor', 'ok'][i]}`} style={{ animationDelay: `${i * 0.9 + 0.45}s` }} />
            </div>
          ))}
          <div className="anim-score">Code health <b>72</b>/100</div>
        </div>
      )
    case 'test-strategist':
      return (
        <div className="anim anim-center" aria-hidden="true">
          <div className="pyr pyr-3" style={{ animationDelay: '0s' }}>GUnit ×12</div>
          <div className="pyr pyr-2" style={{ animationDelay: '1.2s' }}>GT-API ×5</div>
          <div className="pyr pyr-1" style={{ animationDelay: '2.4s' }}>GT-UI ×2</div>
        </div>
      )
    case 'release-navigator':
      return (
        <div className="anim anim-center" aria-hidden="true">
          <div className="gauge-track"><div className="gauge-fill" /></div>
          <div className="anim-tags">
            <span className="anim-tag t-green" style={{ animationDelay: '1.6s' }}>low</span>
            <span className="anim-tag t-amber" style={{ animationDelay: '2.4s' }}>medium</span>
            <span className="anim-tag t-red" style={{ animationDelay: '3.2s' }}>high</span>
          </div>
          <div className="anim-caption">readiness 69% · Palisades impact</div>
        </div>
      )
    case 'defect-triage':
      return (
        <div className="anim anim-center" aria-hidden="true">
          <div className="flow">
            {['Intake', 'Investigate', 'Route', 'Plan'].map((n, i) => (
              <React.Fragment key={n}>
                <span className="flow-node" style={{ animationDelay: `${i * 1.1}s` }}>{n}</span>
                {i < 3 && <span className="flow-arrow" style={{ animationDelay: `${i * 1.1 + 0.55}s` }}>→</span>}
              </React.Fragment>
            ))}
          </div>
          <div className="flow-loop">⟲ confidence &lt; 65% — deeper pass</div>
        </div>
      )
    default:
      return null
  }
}
