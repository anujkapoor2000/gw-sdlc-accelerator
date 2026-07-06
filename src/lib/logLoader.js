/** Max characters to include in evidence sent to the triage agents. */
export const MAX_EVIDENCE_CHARS = 80000

/** Context lines to include before/after a selected error in evidence. */
const CONTEXT_LINES = 8

/**
 * Read a browser File object as UTF-8 text.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`Could not read "${file.name}"`))
    reader.readAsText(file)
  })
}

/**
 * Parse Datadog log export text (JSON array, NDJSON, or plain text).
 * @param {string} text
 * @param {string} [filename]
 * @returns {{ entries: object[], format: string, parseWarnings: string[] }}
 */
export function parseDatadogLogs(text, filename = 'log') {
  const trimmed = text.trim()
  if (!trimmed) {
    return { entries: [], format: 'empty', parseWarnings: [`"${filename}" is empty`] }
  }

  const warnings = []

  // JSON array export: [{ ... }, { ... }]
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) {
        return { entries: arr.filter(Boolean), format: 'json-array', parseWarnings: warnings }
      }
    } catch {
      warnings.push('Looked like a JSON array but failed to parse — trying line-by-line')
    }
  }

  // NDJSON / JSON-per-line (common Datadog export)
  const lines = trimmed.split(/\r?\n/)
  const entries = []
  let jsonLines = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    if (!line.startsWith('{')) continue
    try {
      entries.push(JSON.parse(line))
      jsonLines++
    } catch {
      warnings.push(`Line ${i + 1}: invalid JSON — skipped`)
    }
  }
  if (jsonLines > 0) {
    return { entries, format: 'ndjson', parseWarnings: warnings }
  }

  // Plain text — treat each non-empty line as a pseudo-entry
  warnings.push('No JSON log lines found — treating as plain text')
  return {
    entries: lines.filter((l) => l.trim()).map((line, i) => ({ message: line, _line: i + 1 })),
    format: 'plain-text',
    parseWarnings: warnings
  }
}

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null && v !== '') return v
  }
  return undefined
}

function nested(obj, path) {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

/**
 * Extract a normalized error record from a log entry.
 * @param {object} entry
 * @param {number} index
 * @returns {object|null}
 */
export function extractErrorFromEntry(entry, index) {
  if (!entry || typeof entry !== 'object') return null

  const status = String(pick(entry, 'status', 'level', '@status') ?? '').toLowerCase()
  const httpStatus = Number(pick(entry, 'http.status_code', 'http.status', 'status_code') ?? nested(entry, 'http.status_code'))
  const message = String(
    pick(entry, 'message', 'msg', 'error.message', 'attributes.message') ??
    nested(entry, 'error.message') ??
    nested(entry, 'attributes.message') ??
    ''
  ).trim()

  const stack = String(
    pick(entry, 'error.stack', 'stack', 'error_stack', 'attributes.error.stack') ??
    nested(entry, 'error.stack') ??
    nested(entry, 'attributes.error.stack') ??
    ''
  ).trim()

  const errorKind = String(
    pick(entry, 'error.kind', 'error.type', 'exception.class', 'attributes.error.kind') ??
    nested(entry, 'error.kind') ??
    nested(entry, 'error.type') ??
    ''
  ).trim()

  const service = String(pick(entry, 'service', 'dd.service', 'attributes.service') ?? '').trim()
  const host = String(pick(entry, 'host', 'hostname', 'dd.host') ?? '').trim()
  const timestamp = pick(entry, '@timestamp', 'timestamp', 'date', 'time') ?? entry._line ?? index + 1
  const traceId = String(pick(entry, 'dd.trace_id', 'trace_id', 'attributes.dd.trace_id') ?? '').trim()
  const spanId = String(pick(entry, 'dd.span_id', 'span_id') ?? '').trim()

  const isErrorStatus = ['error', 'critical', 'emergency', 'alert', 'fatal'].includes(status)
  const isHttpError = httpStatus >= 500
  const hasStack = stack.length > 0
  const hasErrorKind = errorKind.length > 0
  const messageLooksLikeError = /\b(error|exception|failed|failure|panic)\b/i.test(message)

  if (!isErrorStatus && !isHttpError && !hasStack && !hasErrorKind && !messageLooksLikeError) {
    return null
  }

  const preview = message.split(/\r?\n/)[0].slice(0, 160) || errorKind || stack.split('\n')[0]?.slice(0, 160) || '(no message)'

  return {
    id: `err-${index}`,
    index,
    timestamp: String(timestamp),
    service: service || 'unknown',
    host,
    message,
    stack,
    errorKind,
    status: status || (isHttpError ? `http-${httpStatus}` : 'error'),
    httpStatus: isHttpError ? httpStatus : undefined,
    traceId,
    spanId,
    preview,
    raw: entry
  }
}

/**
 * Parse log entries (from file or Datadog API) and extract all error records.
 * @param {object[]} entries
 * @param {{ filename?: string, format?: string, source?: string, meta?: object }} [meta]
 */
export function analyseDatadogEntries(entries, meta = {}) {
  const errors = []
  entries.forEach((entry, i) => {
    const err = extractErrorFromEntry(entry, i)
    if (err) errors.push(err)
  })

  const services = [...new Set(errors.map((e) => e.service).filter((s) => s && s !== 'unknown'))]

  return {
    filename: meta.filename || 'log',
    format: meta.format || 'entries',
    source: meta.source || 'file',
    meta: meta.meta || null,
    parseWarnings: meta.parseWarnings || [],
    totalEntries: entries.length,
    errorCount: errors.length,
    services,
    errors,
    entries
  }
}

/**
 * Parse log text and extract all error records.
 * @param {string} text
 * @param {string} [filename]
 */
export function analyseDatadogLog(text, filename = 'log') {
  const { entries, format, parseWarnings } = parseDatadogLogs(text, filename)
  return analyseDatadogEntries(entries, { filename, format, source: 'file', parseWarnings })
}

/**
 * Filter analysis to a single service (client-side). Keeps full entries for context.
 * @param {object} analysis
 * @param {string} service — service name or 'all'
 */
export function filterAnalysisByService(analysis, service) {
  if (!analysis || !service || service === 'all') return analysis
  const errors = analysis.errors.filter((e) => e.service === service)
  return {
    ...analysis,
    errors,
    errorCount: errors.length,
    serviceFilter: service
  }
}

/**
 * Build a defect report from a selected error (for the defect textarea).
 * @param {object} error
 * @param {{ filename?: string, product?: string, env?: string }} [ctx]
 */
export function buildDefectReportFromError(error, ctx = {}) {
  const { filename, product, env } = ctx
  const lines = [
    'Production error observed in Datadog logs — investigate root cause and remediation.',
    '',
    `Source: ${filename ?? 'Datadog log export'}`,
  ]
  if (product) lines.push(`Product context: ${product}`)
  if (env) lines.push(`Environment: ${env}`)
  lines.push('', `Service: ${error.service}`)
  if (error.host) lines.push(`Host: ${error.host}`)
  lines.push(`Timestamp: ${error.timestamp}`)
  if (error.traceId) lines.push(`Trace ID: ${error.traceId}`)
  if (error.httpStatus) lines.push(`HTTP status: ${error.httpStatus}`)
  lines.push('', 'Error message:', error.message || error.preview)

  if (error.errorKind) {
    lines.push('', `Exception type: ${error.errorKind}`)
  }

  return lines.join('\n')
}

/**
 * Build evidence text centred on a selected error, with surrounding log context.
 * @param {object} analysis — result of analyseDatadogLog
 * @param {string} errorId
 * @param {number} [maxChars]
 */
export function buildEvidenceForError(analysis, errorId, maxChars = MAX_EVIDENCE_CHARS) {
  const error = analysis.errors.find((e) => e.id === errorId)
  if (!error) return analysis.entries.length ? JSON.stringify(analysis.entries.slice(0, 20), null, 2) : ''

  const parts = [
    `=== Datadog log: ${analysis.filename} (${analysis.format}, ${analysis.totalEntries} entries, ${analysis.errorCount} errors) ===`,
    '',
    '--- Selected error (primary evidence) ---',
    formatErrorBlock(error),
  ]

  // Include adjacent entries for context
  const start = Math.max(0, error.index - CONTEXT_LINES)
  const end = Math.min(analysis.entries.length, error.index + CONTEXT_LINES + 1)
  const contextEntries = analysis.entries.slice(start, end)

  if (contextEntries.length > 1) {
    parts.push('', `--- Surrounding log context (entries ${start + 1}–${end}) ---`)
    contextEntries.forEach((entry, i) => {
      const absIdx = start + i
      const marker = absIdx === error.index ? ' >>> SELECTED ERROR <<<' : ''
      parts.push(`[${absIdx + 1}]${marker}`, JSON.stringify(entry, null, 0))
    })
  }

  // Append other distinct errors (deduped by preview) for pattern spotting
  const others = analysis.errors.filter((e) => e.id !== errorId).slice(0, 5)
  if (others.length) {
    parts.push('', '--- Other errors in the same file (for pattern analysis) ---')
    others.forEach((e) => parts.push(formatErrorBlock(e)))
  }

  let text = parts.join('\n')
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + `\n\n… [truncated — ${text.length - maxChars} chars omitted to fit token budget]`
  }
  return text
}

function formatErrorBlock(error) {
  const lines = [
    `timestamp: ${error.timestamp}`,
    `service: ${error.service}`,
  ]
  if (error.host) lines.push(`host: ${error.host}`)
  if (error.traceId) lines.push(`trace_id: ${error.traceId}`)
  if (error.errorKind) lines.push(`exception: ${error.errorKind}`)
  if (error.message) lines.push(`message: ${error.message}`)
  if (error.stack) lines.push(`stack:\n${error.stack}`)
  return lines.join('\n')
}

/**
 * Load and analyse a File from a file input.
 * @param {File} file
 */
export async function loadDatadogLogFile(file) {
  const text = await readFileAsText(file)
  return analyseDatadogLog(text, file.name)
}
