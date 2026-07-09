// src/lib/externalFindings.js — normalizes third-party static-analysis reports
// (SonarQube, ESLint, Checkstyle) into the same finding shape the Code Review
// Copilot already renders, so they can be merged alongside the LLM's findings.
//
// { severity: critical|major|minor|info, category, location, issue, recommendation, standardRef, source }

export const EXTERNAL_TOOLS = [
  { id: 'sonarqube', label: 'SonarQube / SonarCloud (issues JSON)' },
  { id: 'eslint', label: 'ESLint (JSON formatter)' },
  { id: 'checkstyle', label: 'Checkstyle (XML)' }
]

const SONAR_SEVERITY = { BLOCKER: 'critical', CRITICAL: 'critical', MAJOR: 'major', MINOR: 'minor', INFO: 'info' }
const SONAR_CATEGORY = { VULNERABILITY: 'security', SECURITY_HOTSPOT: 'security', BUG: 'correctness', CODE_SMELL: 'standards' }

function parseSonarQube(text) {
  const data = JSON.parse(text)
  const issues = Array.isArray(data) ? data : data.issues
  if (!Array.isArray(issues)) throw new Error('Expected a SonarQube issues export with an "issues" array')

  return issues.map((it) => ({
    source: 'sonarqube',
    severity: SONAR_SEVERITY[it.severity] || 'minor',
    category: SONAR_CATEGORY[it.type] || 'standards',
    location: it.line ? `${it.component || ''}:${it.line}` : (it.component || '-'),
    issue: it.message || '(no message)',
    recommendation: it.type === 'SECURITY_HOTSPOT' ? 'Review this security hotspot in SonarQube for the recommended remediation.' : 'See SonarQube rule description for the recommended fix.',
    standardRef: it.rule || ''
  }))
}

function parseESLint(text) {
  const data = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('Expected an ESLint JSON formatter array (eslint -f json)')

  const findings = []
  for (const file of data) {
    for (const m of file.messages || []) {
      findings.push({
        source: 'eslint',
        severity: m.severity === 2 ? 'major' : m.severity === 1 ? 'minor' : 'info',
        category: (m.ruleId || '').startsWith('security/') ? 'security' : 'standards',
        location: `${file.filePath || '-'}:${m.line ?? '-'}`,
        issue: m.message || '(no message)',
        recommendation: 'See ESLint rule documentation for the recommended fix.',
        standardRef: m.ruleId || ''
      })
    }
  }
  return findings
}

const CHECKSTYLE_SEVERITY = { error: 'major', warning: 'minor', info: 'info', ignore: 'info' }

function parseCheckstyle(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Could not parse Checkstyle XML')

  const findings = []
  for (const file of doc.querySelectorAll('file')) {
    const name = file.getAttribute('name') || '-'
    for (const err of file.querySelectorAll('error')) {
      findings.push({
        source: 'checkstyle',
        severity: CHECKSTYLE_SEVERITY[err.getAttribute('severity')] || 'minor',
        category: 'standards',
        location: `${name}:${err.getAttribute('line') || '-'}`,
        issue: err.getAttribute('message') || '(no message)',
        recommendation: 'See the Checkstyle check documentation for the recommended fix.',
        standardRef: (err.getAttribute('source') || '').split('.').pop() || ''
      })
    }
  }
  return findings
}

const PARSERS = { sonarqube: parseSonarQube, eslint: parseESLint, checkstyle: parseCheckstyle }

/** Parse a pasted/uploaded report of the given tool type into normalized findings. Throws on malformed input. */
export function parseExternalReport(toolId, text) {
  const parser = PARSERS[toolId]
  if (!parser) throw new Error(`Unknown tool: ${toolId}`)
  const trimmed = (text || '').trim()
  if (!trimmed) throw new Error('Report is empty')
  return parser(trimmed)
}
