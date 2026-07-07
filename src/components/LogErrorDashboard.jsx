import React, { useState } from 'react'
import { formatLogTimestamp } from '../lib/logLoader.js'

const BULK_MAX_ERRORS = 5

function fmtTime(errOrTs, lineNumber) {
  if (errOrTs && typeof errOrTs === 'object') {
    return formatLogTimestamp(errOrTs.timestamp, { lineNumber: errOrTs.lineNumber })
  }
  return formatLogTimestamp(errOrTs, { lineNumber })
}

function ScenarioActions({ running, onSelect, onInvestigate }) {
  return (
    <div className="log-scenario-actions">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={running}
        onClick={onSelect}
      >
        Select
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={running}
        onClick={onInvestigate}
      >
        Investigate
      </button>
    </div>
  )
}

function ScenarioCard({
  scenario,
  isSelected,
  isExpanded,
  running,
  selectedErrorId,
  onToggleExpand,
  onSelectError,
  onInvestigate
}) {
  const lastSeen = scenario.latestTimestampMs != null
    ? new Date(scenario.latestTimestampMs).toLocaleString()
    : fmtTime(scenario.errors[0])

  return (
    <article
      className={`log-scenario-card ${isSelected ? 'selected' : ''}`}
      role="listitem"
      aria-label={`Error scenario: ${scenario.label}`}
    >
      <div className="log-scenario-card-main">
        <div className="log-scenario-card-body">
          <div className="log-scenario-card-top">
            {scenario.count > 1 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm log-expand-btn"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse occurrences' : `Expand ${scenario.count} occurrences`}
                onClick={onToggleExpand}
              >
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <span className="log-expand-spacer" aria-hidden="true" />
            )}
            <div className="log-scenario-card-title">
              <div className="log-scenario-label">{scenario.label}</div>
              <div className="log-scenario-meta">
                {scenario.services.map((s) => (
                  <span key={s} className="tag">{s}</span>
                ))}
                {scenario.statuses.map((s) => (
                  <span key={s} className="tag red">{s}</span>
                ))}
                <span className="tag">{scenario.count}×</span>
                <span className="log-ts-inline">Last seen {lastSeen}</span>
              </div>
            </div>
          </div>
          <p className="log-scenario-msg">{scenario.sampleMessage}</p>
        </div>
        <ScenarioActions
          running={running}
          onSelect={() => onSelectError(scenario.representativeId)}
          onInvestigate={() => onInvestigate(scenario.representativeId)}
        />
      </div>

      {isExpanded && (
        <ul className="log-occurrence-list" aria-label="Individual occurrences">
          {scenario.errors.map((err) => (
            <li
              key={err.id}
              className={`log-occurrence-item ${selectedErrorId === err.id ? 'selected' : ''}`}
            >
              <div className="log-occurrence-body">
                <p className="log-scenario-msg">{err.preview}</p>
                <div className="log-scenario-meta">
                  <span className="tag">{err.service}</span>
                  <span className="tag red">{err.status}</span>
                  <span className="log-ts-inline">{fmtTime(err)}</span>
                  {err.traceId && (
                    <span className="log-trace">trace: {err.traceId}</span>
                  )}
                </div>
              </div>
              <ScenarioActions
                running={running}
                onSelect={() => onSelectError(err.id)}
                onInvestigate={() => onInvestigate(err.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default function LogErrorDashboard({
  dashboard,
  logAnalysis,
  visibleErrors,
  selectedErrorId,
  serviceFilter,
  onServiceFilterChange,
  running,
  bulkProgress,
  onSelectError,
  onInvestigate,
  onInvestigateAll
}) {
  const [expandedScenario, setExpandedScenario] = useState(null)

  if (!dashboard || !logAnalysis) return null

  const { scenarios, serviceCounts } = dashboard

  return (
    <>
      <div className="panel log-dashboard">
        <div className="log-dashboard-head">
          <div>
            <h3>Log analysis dashboard</h3>
            <p className="log-dashboard-sub">
              {dashboard.filename}
              {dashboard.source === 'live' ? ' · live Datadog query' : ` · ${dashboard.format}`}
              {serviceFilter !== 'all' ? ` · filtered to ${serviceFilter}` : ''}
            </p>
          </div>
          <div className="log-dashboard-actions">
            {logAnalysis.services.length > 0 && (
              <select
                value={serviceFilter}
                onChange={(e) => onServiceFilterChange(e.target.value)}
                disabled={running}
                aria-label="Filter by service"
              >
                <option value="all">All services ({logAnalysis.errorCount})</option>
                {logAnalysis.services.map((s) => (
                  <option key={s} value={s}>
                    {s} ({logAnalysis.errors.filter((e) => e.service === s).length})
                  </option>
                ))}
              </select>
            )}
            {visibleErrors.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={running}
                onClick={onInvestigateAll}
                title={visibleErrors.length > BULK_MAX_ERRORS ? `Investigates first ${BULK_MAX_ERRORS} errors` : undefined}
              >
                Investigate all ({Math.min(visibleErrors.length, BULK_MAX_ERRORS)})
              </button>
            )}
          </div>
        </div>

        <div className="scorecard">
          <div className="score-tile accent">
            <div className="k">Log entries</div>
            <div className="v">{dashboard.totalEntries.toLocaleString()}</div>
          </div>
          <div className="score-tile">
            <div className="k">Errors detected</div>
            <div className="v">{dashboard.errorCount.toLocaleString()}</div>
          </div>
          <div className="score-tile">
            <div className="k">Unique scenarios</div>
            <div className="v">{dashboard.scenarioCount.toLocaleString()}</div>
          </div>
          <div className="score-tile">
            <div className="k">Services affected</div>
            <div className="v">{dashboard.services.length || '—'}</div>
          </div>
          <div className="score-tile">
            <div className="k">Error rate</div>
            <div className="v">{dashboard.errorRate}%</div>
          </div>
        </div>

        {dashboard.timeRange && (
          <p className="log-dashboard-meta">
            Time span: {dashboard.timeRange.from} → {dashboard.timeRange.to}
          </p>
        )}

        {Object.keys(serviceCounts).length > 0 && (
          <div className="log-service-breakdown">
            <span className="log-breakdown-label">Errors by service</span>
            <div className="chips">
              {Object.entries(serviceCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([svc, count]) => (
                  <button
                    key={svc}
                    type="button"
                    className={`chip ${serviceFilter === svc ? 'on' : ''}`}
                    disabled={running}
                    onClick={() => onServiceFilterChange(serviceFilter === svc ? 'all' : svc)}
                  >
                    {svc} ({count})
                  </button>
                ))}
            </div>
          </div>
        )}

        {dashboard.exceptionTypes.length > 0 && (
          <div className="log-service-breakdown">
            <span className="log-breakdown-label">Exception types</span>
            <div className="chips">
              {dashboard.exceptionTypes.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
        )}

        {bulkProgress && (
          <p className="log-dashboard-progress">{bulkProgress}</p>
        )}
      </div>

      <div className="panel">
        <h3>Error scenarios ({scenarios.length})</h3>
        <p className="log-dashboard-sub" style={{ marginBottom: 12 }}>
          {visibleErrors.length} occurrence{visibleErrors.length !== 1 ? 's' : ''} across {scenarios.length} distinct scenario{scenarios.length !== 1 ? 's' : ''}. Select a scenario to populate the defect form, or investigate directly.
        </p>

        {scenarios.length === 0 ? (
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>No error scenarios match the current filter.</p>
        ) : (
          <div className="log-scenario-list" role="list">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={scenario.errors.some((e) => e.id === selectedErrorId)}
                isExpanded={expandedScenario === scenario.id}
                running={running}
                selectedErrorId={selectedErrorId}
                onToggleExpand={() => setExpandedScenario(
                  expandedScenario === scenario.id ? null : scenario.id
                )}
                onSelectError={onSelectError}
                onInvestigate={onInvestigate}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
