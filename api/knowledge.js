// /api/knowledge.js — per-project knowledge CRUD, file upload, codebase sync for RAG.

import { CODEBASE_PRESETS, validateUpload } from './_lib/codebase.js'
import { getRagStatus } from './_lib/rag-status.js'
import { ensureSchema, getSql } from './_lib/schema.js'
import {
  addKnowledgeDoc,
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  reindexProjectKnowledge,
  syncArtifactsToKnowledge,
  syncCodebaseToKnowledge
} from './_lib/rag.js'

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      error: 'DATABASE_URL is not configured. Add it as a plain Environment Variable in Vercel settings.'
    })
  }

  const sql = getSql()
  const { projectId, id, action } = req.query

  try {
    await ensureSchema(sql)

    if (req.method === 'GET' && action === 'status') {
      const status = await getRagStatus(sql)
      if (projectId) {
        const docs = await listKnowledgeDocs(sql, projectId)
        status.project = {
          id: projectId,
          docCount: docs.length,
          chunkCount: docs.reduce((n, d) => n + (d.chunk_count || 0), 0)
        }
      }
      return res.status(200).json(status)
    }

    if (req.method === 'GET' && action === 'presets') {
      return res.status(200).json({
        presets: CODEBASE_PRESETS,
        allowedRoots: ['reference', 'katalon', 'docs', 'src/lib', 'db']
      })
    }

    if (req.method === 'GET' && projectId) {
      const docs = await listKnowledgeDocs(sql, projectId)
      return res.status(200).json(docs)
    }

    if (req.method === 'POST' && action === 'reindex' && projectId) {
      const result = await reindexProjectKnowledge(sql, projectId)
      return res.status(200).json(result)
    }

    if (req.method === 'POST' && action === 'sync-artifacts' && projectId) {
      const result = await syncArtifactsToKnowledge(sql, projectId)
      return res.status(200).json(result)
    }

    if (req.method === 'POST' && action === 'sync-codebase' && projectId) {
      const { paths, preset } = req.body || {}
      const result = await syncCodebaseToKnowledge(sql, projectId, { paths, preset })
      return res.status(200).json(result)
    }

    if (req.method === 'POST' && action === 'upload-file') {
      const { projectId: bodyProjectId, filename, content, docType, title, encoding, pages } = req.body || {}
      const pid = bodyProjectId || projectId
      if (!pid) return res.status(400).json({ error: 'projectId is required' })
      const validated = await validateUpload({ filename, content, encoding, pages })
      const doc = await addKnowledgeDoc(sql, {
        projectId: pid,
        title: title || validated.filename,
        docType: docType || 'file',
        source: 'file-upload',
        content: validated.content,
        metadata: validated.metadata || { filename: validated.filename }
      })
      return res.status(201).json(doc)
    }

    if (req.method === 'POST') {
      const { projectId: bodyProjectId, title, docType, content, source, metadata } = req.body || {}
      const pid = bodyProjectId || projectId
      if (!pid || !title || !content) {
        return res.status(400).json({ error: 'projectId, title and content are required' })
      }
      const doc = await addKnowledgeDoc(sql, {
        projectId: pid,
        title,
        docType: docType || 'notes',
        content,
        source: source || 'paste',
        metadata: metadata || {}
      })
      return res.status(201).json(doc)
    }

    if (req.method === 'DELETE' && id) {
      await deleteKnowledgeDoc(sql, id)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Knowledge operation failed' })
  }
}
