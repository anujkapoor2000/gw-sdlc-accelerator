// /api/knowledge.js — per-project knowledge CRUD + artifact sync for RAG.

import { ensureSchema, getSql } from './_lib/schema.js'
import {
  addKnowledgeDoc,
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  syncArtifactsToKnowledge
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

    if (req.method === 'GET' && projectId) {
      const docs = await listKnowledgeDocs(sql, projectId)
      return res.status(200).json(docs)
    }

    if (req.method === 'POST' && action === 'sync-artifacts' && projectId) {
      const result = await syncArtifactsToKnowledge(sql, projectId)
      return res.status(200).json(result)
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
