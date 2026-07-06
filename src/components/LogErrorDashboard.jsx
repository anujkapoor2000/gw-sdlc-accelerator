import React, { useState } from 'react'
import { formatLogTimestamp } from '../lib/logLoader.js'

const BULK_MAX_ERRORS = 5

function fmtTime(errOrTs, lineNumber) {
  if (errOrTs && typeof errOrTs === 'object') {
    return formatLogTimestamp(errOrTs.timestamp, { lineNumber: errOrTs.lineNumber })
  }
  return formatLogTimestamp(errOrTs, { lineNumber })
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
          {visibleErrors.length} occurrence{visibleErrors.length !== 1 ? 's' : ''} across {scenarios.length} distinct scenario{scenarios.length !== 1 ? 's' : ''}. Select a row to populate the defect form, or investigate directly.
        </p>

        {scenarios.length === 0 ? (
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>No error scenarios match the current filter.</p>
        ) : (
          <div className="log-table-wrap">
            <table className="log-scenarios-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} aria-label="Expand" />
                  <th>Scenario / exception</th>
                  <th>Services</th>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Last seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => {
                  const isExpanded = expandedScenario === scenario.id
                  const isSelected = scenario.errors.some((e) => e.id === selectedErrorId)
                  return (
                    <React.Fragment key={scenario.id}>
                      <tr className={`log-scenario-row ${isSelected ? 'selected' : ''}`}>
                        <td>
                          {scenario.count > 1 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm log-expand-btn"
                              aria-expanded={isExpanded}
                              onClick={() => setExpandedScenario(isExpanded ? null : scenario.id)}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="log-scenario-label">{scenario.label}</div>
                          <div className="log-scenario-msg">{scenario.sampleMessage}</div>
                        </td>
                        <td>
                          {scenario.services.map((s) => (
                            <span key={s} className="tag">{s}</span>
                          ))}
                        </td>
                        <td>
                          {scenario.statuses.map((s) => (
                            <span key={s} className="tag red">{s}</span>
                          ))}
                        </td>
                        <td><b>{scenario.count}</b></td>
                        <td className="log-ts">
                          {scenario.latestTimestampMs != null
                            ? new Date(scenario.latestTimestampMs).toLocaleString()
                            : fmtTime(scenario.errors[0])}
                        </td>
                        <td className="log-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={running}
                            onClick={() => onSelectError(scenario.representativeId)}
                          >
                            Select
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={running}
                            onClick={() => onInvestigate(scenario.representativeId)}
                          >
                            Investigate
                          </button>
                        </td>
                      </tr>
                      {isExpanded && scenario.errors.map((err) => (
                        <tr
                          key={err.id}
                          className={`log-scenario-detail ${selectedErrorId === err.id ? 'selected' : ''}`}
                        >
                          <td />
                          <td>
                            <span className="log-scenario-msg">{err.preview}</span>
                            {err.traceId && (
                              <span className="log-trace">trace: {err.traceId}</span>
                            )}
                          </td>
                          <td><span className="tag">{err.service}</span></td>
                          <td><span className="tag red">{err.status}</span></td>
                          <td>—</td>
                          <td className="log-ts">{fmtTime(err)}</td>
                          <td className="log-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={running}
                              onClick={() => onSelectError(err.id)}
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={running}
                              onClick={() => onInvestigate(err.id)}
                            >
                              Investigate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
