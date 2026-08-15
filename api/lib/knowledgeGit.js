import { deleteSourceChunks, insertChunk, updateSourceStatus } from './knowledgeDb.js'
import { chunkTextFile, filterIngestibleFiles, inferProductFromPath } from './knowledgeChunker.js'
import { embedTexts } from './knowledgeEmbed.js'

const CODE_GLOB = /\.(gs|gsx|pcf|xml|java|md|txt)$/i
const MAX_FILES = 80

function parseGitHubUrl(url) {
  const m = String(url).match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

async function githubFetch(path, token) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'gw-sdlc-accelerator'
  }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`https://api.github.com${path}`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API error (${res.status})`)
  }
  return res.json()
}

async function fetchRawFile(owner, repo, path, branch, token) {
  const headers = { 'user-agent': 'gw-sdlc-accelerator' }
  if (token) headers.authorization = `Bearer ${token}`
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  const res = await fetch(url, { headers })
  if (!res.ok) return null
  const text = await res.text()
  if (text.length > 120_000) return null
  return text
}

export async function syncGitRepo(sql, { projectId, gitUrl, branch = 'main' }) {
  const parsed = parseGitHubUrl(gitUrl)
  if (!parsed) throw new Error('Only GitHub URLs are supported (https://github.com/owner/repo)')

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
  const { owner, repo } = parsed

  const sourceRows = await sql`
    INSERT INTO sdlc_knowledge_sources (project_id, source_type, label, config, sync_status)
    VALUES (
      ${projectId}, 'git', ${`${owner}/${repo}@${branch}`},
      ${JSON.stringify({ gitUrl, branch, owner, repo })}, 'syncing'
    )
    RETURNING id
  `
  const sourceId = sourceRows[0].id

  try {
    const repoMeta = await githubFetch(`/repos/${owner}/${repo}`, token)
    const defaultBranch = branch || repoMeta.default_branch || 'main'

    const tree = await githubFetch(
      `/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      token
    )

    const paths = (tree.tree || [])
      .filter((t) => t.type === 'blob' && CODE_GLOB.test(t.path))
      .slice(0, MAX_FILES)

    const files = []
    for (const item of paths) {
      const content = await fetchRawFile(owner, repo, item.path, defaultBranch, token)
      if (content) {
        files.push({ path: item.path, content })
      }
    }

    const ingestible = filterIngestibleFiles(files)
    await deleteSourceChunks(sql, sourceId)

    const allChunks = []
    for (const file of ingestible) {
      const product = inferProductFromPath(file.path)
      const chunks = chunkTextFile({ path: file.path, content: file.content, sourceType: 'git', product })
      allChunks.push(...chunks)
    }

    const embeddings = await embedTexts(allChunks.map((c) => c.chunkText.slice(0, 8000))).catch(() => allChunks.map(() => null))

    let count = 0
    for (let i = 0; i < allChunks.length; i++) {
      const c = allChunks[i]
      await insertChunk(sql, {
        projectId,
        sourceId,
        citeKey: c.citeKey,
        chunkText: c.chunkText,
        path: c.path,
        lineStart: c.lineStart,
        lineEnd: c.lineEnd,
        language: c.language,
        product: c.product,
        sourceType: 'git',
        embedding: embeddings[i],
        metadata: { gitUrl, branch: defaultBranch, repo: `${owner}/${repo}` }
      })
      count++
    }

    await updateSourceStatus(sql, sourceId, { status: 'ready', chunkCount: count })
    return { sourceId, chunkCount: count, filesScanned: ingestible.length, branch: defaultBranch }
  } catch (err) {
    await updateSourceStatus(sql, sourceId, { status: 'error', chunkCount: 0, error: err.message })
    throw err
  }
}
