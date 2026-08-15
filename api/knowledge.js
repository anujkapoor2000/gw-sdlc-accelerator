// /api/knowledge.js — Project knowledge layer for Defect Triage grounding.
//
// GET    /api/knowledge?projectId=<uuid>                    → status
// POST   /api/knowledge?projectId=<uuid>&action=search      → hybrid search
// POST   /api/knowledge?projectId=<uuid>&action=sync      → sync artifacts (+ optional git/doc)
// POST   /api/knowledge?projectId=<uuid>&action=upload      → upload doc { label, filename, content }
// POST   /api/knowledge?projectId=<uuid>&action=source      → register git source { gitUrl, branch }
// DELETE /api/knowledge?sourceId=<uuid>                     → delete source + chunks

import { neon } from '@neondatabase/serverless'
import {
  ensureKnowledgeSchema,
  getKnowledgeStatus,
  searchChunks
} from './lib/knowledgeDb.js'
import { syncArtifactsForProject, syncDocUpload } from './lib/knowledgeSync.js'
import { syncGitRepo } from './lib/knowledgeGit.js'
import { embeddingsConfigured } from './lib/knowledgeEmbed.js'
import { parseStackFrameTerms } from './lib/knowledgeChunker.js'

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not configured.' })
  }

  const sql = neon(process.env.DATABASE_URL)
  const { projectId, action, sourceId } = req.query

  try {
    await ensureKnowledgeSchema(sql)

    if (req.method === 'DELETE' && sourceId) {
      await sql`DELETE FROM sdlc_knowledge_sources WHERE id = ${sourceId}`
      return res.status(200).json({ ok: true })
    }

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }

    if (req.method === 'GET') {
      const status = await getKnowledgeStatus(sql, projectId)
      return res.status(200).json({
        ...status,
        embeddingsConfigured: embeddingsConfigured()
      })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body || {}

    if (action === 'search') {
      const { queries = [], stack = '', product = '', limit = 12 } = body
      const stackTerms = parseStackFrameTerms(stack)
      const allQueries = [...(Array.isArray(queries) ? queries : [queries]), ...stackTerms].filter(Boolean)
      const results = await searchChunks(sql, { projectId, queries: allQueries, product, limit })
      return res.status(200).json({ results, count: results.length })
    }

    if (action === 'upload') {
      const { label, filename, content } = body
      if (!content || !filename) {
        return res.status(400).json({ error: 'filename and content are required' })
      }
      const result = await syncDocUpload(sql, { projectId, label: label || filename, filename, content })
      return res.status(201).json(result)
    }

    if (action === 'source') {
      const { gitUrl, branch = 'main' } = body
      if (!gitUrl) return res.status(400).json({ error: 'gitUrl is required' })
      const result = await syncGitRepo(sql, { projectId, gitUrl, branch })
      return res.status(201).json(result)
    }

    if (action === 'sync') {
      const results = { artifacts: null, git: null }
      results.artifacts = await syncArtifactsForProject(sql, projectId)
      if (body.gitUrl) {
        results.git = await syncGitRepo(sql, { projectId, gitUrl: body.gitUrl, branch: body.branch || 'main' })
      }
      if (body.filename && body.content) {
        results.doc = await syncDocUpload(sql, {
          projectId,
          label: body.label || body.filename,
          filename: body.filename,
          content: body.content
        })
      }
      const status = await getKnowledgeStatus(sql, projectId)
      return res.status(200).json({ ...results, status })
    }

    return res.status(400).json({ error: 'Unknown action. Use search, sync, upload, or source.' })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Knowledge operation failed' })
  }
}
