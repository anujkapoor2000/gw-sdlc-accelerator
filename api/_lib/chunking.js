// Text chunking for RAG indexing.

const TARGET_CHARS = 1400
const OVERLAP_CHARS = 180

/** Split long text into overlapping chunks for embedding. */
export function chunkText(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/)
  const chunks = []
  let buf = ''

  function flush() {
    const piece = buf.trim()
    if (piece) chunks.push(piece)
    buf = ''
  }

  for (const para of paragraphs) {
    const next = buf ? `${buf}\n\n${para}` : para
    if (next.length <= TARGET_CHARS) {
      buf = next
      continue
    }
    if (buf) flush()
    if (para.length <= TARGET_CHARS) {
      buf = para
      continue
    }
    // Hard-split very long paragraphs.
    let i = 0
    while (i < para.length) {
      const slice = para.slice(i, i + TARGET_CHARS)
      chunks.push(slice.trim())
      i += TARGET_CHARS - OVERLAP_CHARS
    }
  }
  flush()

  if (chunks.length <= 1) return chunks

  // Add overlap between consecutive chunks for context continuity.
  const overlapped = [chunks[0]]
  for (let i = 1; i < chunks.length; i++) {
    const prevTail = chunks[i - 1].slice(-OVERLAP_CHARS)
    overlapped.push(`${prevTail}\n${chunks[i]}`.trim())
  }
  return overlapped
}

/** Flatten a saved artifact JSON into searchable text. */
export function artifactToText(artifact) {
  const { module, title, content } = artifact
  const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  return `Module: ${module}\nTitle: ${title}\n\n${body}`
}
