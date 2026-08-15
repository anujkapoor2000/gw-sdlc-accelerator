// Optional embedding provider for vector-enhanced search (OpenAI-compatible).

const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'

export function embeddingsConfigured() {
  return Boolean(process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY)
}

export async function embedTexts(texts) {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey || !texts.length) return texts.map(() => null)

  const base = process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1'
  const res = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts })
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Embedding API error')
  }

  return (data.data || [])
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
