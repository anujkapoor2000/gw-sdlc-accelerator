// Embedding providers — Voyage AI (preferred), OpenAI, or local sparse fallback (512-dim).

export const EMBEDDING_DIM = 512

function normalize(vec) {
  let sum = 0
  for (const v of vec) sum += v * v
  const norm = Math.sqrt(sum) || 1
  return vec.map((v) => v / norm)
}

function hashToken(token) {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic sparse bag-of-words vectors — no external API required. */
export function sparseEmbed(text) {
  const vec = new Array(EMBEDDING_DIM).fill(0)
  const tokens = String(text).toLowerCase().match(/[a-z0-9_./-]{2,}/g) || []
  for (const t of tokens) {
    const idx = hashToken(t) % EMBEDDING_DIM
    vec[idx] += 1
    const idx2 = hashToken(`${t}#2`) % EMBEDDING_DIM
    vec[idx2] += 0.5
  }
  return normalize(vec)
}

async function voyageEmbed(texts, inputType = 'document') {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-lite',
      input: texts,
      input_type: inputType,
      output_dimension: EMBEDDING_DIM
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.detail || err?.message || `Voyage embeddings failed (${res.status})`)
  }
  const data = await res.json()
  return data.data.map((row) => normalize(row.embedding))
}

async function openaiEmbed(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: texts,
      dimensions: EMBEDDING_DIM
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI embeddings failed (${res.status})`)
  }
  const data = await res.json()
  return data.data.sort((a, b) => a.index - b.index).map((row) => normalize(row.embedding))
}

export function embeddingProvider() {
  if (process.env.VOYAGE_API_KEY) return 'voyage'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'sparse'
}

export function embeddingModel() {
  if (process.env.VOYAGE_API_KEY) {
    return process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-lite'
  }
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  }
  return 'sparse-local'
}

/** Active embedding configuration for status UI and metadata. */
export function getEmbeddingConfig() {
  const provider = embeddingProvider()
  return {
    provider,
    model: embeddingModel(),
    dimension: EMBEDDING_DIM,
    voyageConfigured: Boolean(process.env.VOYAGE_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
  }
}

/**
 * Embed document chunks for indexing (Voyage input_type: document).
 * @param {{ strict?: boolean }} opts — when true, throw instead of sparse fallback if API fails
 */
export async function embedTexts(texts, opts = {}) {
  return embedBatch(texts, { inputType: 'document', strict: opts.strict })
}

/** Embed a search query (Voyage input_type: query). */
export async function embedQuery(text, opts = {}) {
  const [vec] = await embedBatch([text], { inputType: 'query', strict: opts.strict })
  return vec
}

async function embedBatch(texts, { inputType = 'document', strict = false } = {}) {
  const list = Array.isArray(texts) ? texts : [texts]
  if (!list.length) return []

  const provider = embeddingProvider()
  try {
    if (provider === 'voyage') return await voyageEmbed(list, inputType)
    if (provider === 'openai') return await openaiEmbed(list)
  } catch (err) {
    if (strict) {
      throw new Error(`${provider} embedding failed: ${err.message}`)
    }
    console.warn('Embedding API failed, using sparse fallback:', err.message)
  }
  return list.map(sparseEmbed)
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0
  const n = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < n; i++) dot += a[i] * b[i]
  return dot
}
