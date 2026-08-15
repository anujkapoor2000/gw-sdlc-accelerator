// Text/code chunking for project knowledge ingestion.

const CODE_EXTS = new Set(['.gs', '.gsx', '.pcf', '.xml', '.java', '.gsp', '.gradle'])
const DOC_EXTS = new Set(['.md', '.txt', '.rst', '.adoc'])

const MAX_CHUNK = 2000
const MAX_FILE_BYTES = 120_000

export function inferProductFromPath(path) {
  const p = (path || '').toLowerCase()
  if (/policycenter|\bpc\b|\/pc\//.test(p)) return 'PolicyCenter'
  if (/claimcenter|\bcc\b|\/cc\//.test(p)) return 'ClaimCenter'
  if (/billingcenter|\bbc\b|\/bc\//.test(p)) return 'BillingCenter'
  if (/jutro/.test(p)) return 'Jutro'
  return null
}

export function inferLanguage(path) {
  const ext = (path || '').slice((path || '').lastIndexOf('.')).toLowerCase()
  if (ext === '.gs' || ext === '.gsx') return 'gosu'
  if (ext === '.pcf') return 'pcf'
  if (ext === '.java') return 'java'
  if (ext === '.md') return 'markdown'
  if (ext === '.xml') return 'xml'
  return ext.replace('.', '') || 'text'
}

export function chunkTextFile({ path, content, sourceType, product }) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (CODE_EXTS.has(ext)) return chunkCodeFile({ path, content, sourceType, product })
  if (DOC_EXTS.has(ext) || sourceType === 'doc') return chunkMarkdown({ path, content, sourceType, product })
  return chunkPlain({ path, content, sourceType, product })
}

function chunkCodeFile({ path, content, sourceType, product }) {
  const lines = content.split(/\r?\n/)
  const chunks = []
  const blockSize = 40
  for (let i = 0; i < lines.length; i += blockSize) {
    const slice = lines.slice(i, i + blockSize)
    const lineStart = i + 1
    const lineEnd = i + slice.length
    const text = slice.join('\n').trim()
    if (!text) continue
    chunks.push(makeChunk({
      path,
      lineStart,
      lineEnd,
      text,
      sourceType: sourceType || 'git',
      product: product || inferProductFromPath(path),
      language: inferLanguage(path)
    }))
  }
  return chunks
}

function chunkMarkdown({ path, content, sourceType, product }) {
  const sections = content.split(/\n(?=#{1,3}\s)/)
  const chunks = []
  let offset = 1
  for (const section of sections) {
    const text = section.trim()
    if (!text) continue
    if (text.length <= MAX_CHUNK) {
      chunks.push(makeChunk({ path, lineStart: offset, text, sourceType: sourceType || 'doc', product, language: 'markdown' }))
    } else {
      for (let i = 0; i < text.length; i += MAX_CHUNK) {
        chunks.push(makeChunk({
          path,
          lineStart: offset + i,
          text: text.slice(i, i + MAX_CHUNK),
          sourceType: sourceType || 'doc',
          product,
          language: 'markdown'
        }))
      }
    }
    offset += text.split('\n').length
  }
  return chunks.length ? chunks : chunkPlain({ path, content, sourceType, product })
}

function chunkPlain({ path, content, sourceType, product }) {
  const chunks = []
  const text = content.trim()
  if (!text) return chunks
  for (let i = 0; i < text.length; i += MAX_CHUNK) {
    chunks.push(makeChunk({
      path,
      lineStart: Math.floor(i / 80) + 1,
      text: text.slice(i, i + MAX_CHUNK),
      sourceType: sourceType || 'doc',
      product,
      language: inferLanguage(path)
    }))
  }
  return chunks
}

function makeChunk({ path, lineStart, lineEnd, text, sourceType, product, language }) {
  const citeKey = lineStart && path
    ? `[${sourceType === 'doc' || sourceType === 'artifact' ? 'doc' : 'code'}:${path}${lineStart ? `:${lineStart}` : ''}]`
    : `[doc:${path || 'unknown'}]`
  return {
    citeKey,
    chunkText: text,
    path: path || null,
    lineStart: lineStart || null,
    lineEnd: lineEnd || lineStart || null,
    language: language || null,
    product: product || null,
    sourceType: sourceType || 'doc',
    metadata: { path, lineStart, lineEnd }
  }
}

export function chunkArtifact(artifact) {
  const c = artifact.content || {}
  const parts = [
    `Title: ${artifact.title}`,
    c.investigation?.leadHypothesis ? `Lead hypothesis: ${c.investigation.leadHypothesis}` : '',
    c.routing?.handoffNote ? `Handoff: ${c.routing.handoffNote}` : '',
    c.routing?.routeTo ? `Routed to: ${c.routing.routeTo} (${c.routing.priority})` : '',
    c.plan?.workaround ? `Workaround: ${c.plan.workaround}` : '',
    ...(c.plan?.permanentFix?.steps || []).map((s, i) => `Fix step ${i + 1}: ${s}`),
    ...(c.plan?.regressionTests || []).map((t) => `Regression: ${t}`)
  ].filter(Boolean)

  const text = parts.join('\n')
  const path = `artifacts/${artifact.id}.json`
  return [makeChunk({
    path,
    lineStart: 1,
    text,
    sourceType: 'artifact',
    product: null,
    language: 'json'
  })]
}

export function filterIngestibleFiles(files) {
  return files.filter((f) => {
    const ext = f.path.slice(f.path.lastIndexOf('.')).toLowerCase()
    return (CODE_EXTS.has(ext) || DOC_EXTS.has(ext)) && f.content.length <= MAX_FILE_BYTES
  })
}

export function parseStackFrameTerms(stack) {
  if (!stack) return []
  const terms = []
  const re = /(?:at\s+)?([\w.$]+\.([\w$]+))(?:\([^)]*\))?/g
  let m
  while ((m = re.exec(stack)) !== null) {
    terms.push(m[1])
    if (m[1].includes('.')) terms.push(m[1].split('.').pop())
  }
  return [...new Set(terms)].slice(0, 12)
}
