// /api/projects.js — Neon Postgres persistence for projects and saved outputs.

import { ensureSchema, getSql } from './_lib/schema.js'
import { indexArtifactToKnowledge } from './_lib/rag.js'

const autoIndexArtifacts = () => process.env.RAG_AUTO_INDEX_ARTIFACTS !== 'false'

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      error: 'DATABASE_URL is not configured. Add it as a plain Environment Variable in Vercel settings.'
    })
  }

  const sql = getSql()
  const { id, artifacts, artifactId } = req.query

  try {
    await ensureSchema(sql)

    // ---- artifact deletion ----
    if (req.method === 'DELETE' && artifactId) {
      await sql`DELETE FROM sdlc_artifacts WHERE id = ${artifactId}`
      return res.status(200).json({ ok: true })
    }

    // ---- artifact routes (scoped to a project) ----
    if (artifacts && id) {
      if (req.method === 'GET') {
        const rows = await sql`
          SELECT id, module, title, content, created_at
          FROM sdlc_artifacts WHERE project_id = ${id}
          ORDER BY created_at DESC
        `
        return res.status(200).json(rows)
      }
      if (req.method === 'POST') {
        const { module, title, content } = req.body || {}
        if (!module || !title || content === undefined) {
          return res.status(400).json({ error: 'module, title and content are required' })
        }
        const rows = await sql`
          INSERT INTO sdlc_artifacts (project_id, module, title, content)
          VALUES (${id}, ${module}, ${title}, ${JSON.stringify(content)})
          RETURNING id, module, title, content, created_at
        `
        const saved = rows[0]

        if (autoIndexArtifacts()) {
          try {
            await indexArtifactToKnowledge(sql, id, saved)
          } catch (err) {
            console.warn('Auto-index artifact to knowledge failed:', err.message)
          }
        }

        return res.status(201).json({
          id: saved.id,
          module: saved.module,
          title: saved.title,
          created_at: saved.created_at,
          knowledgeIndexed: autoIndexArtifacts()
        })
      }
    }

    // ---- project routes ----
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT p.id, p.name, p.client, p.product, p.created_at,
               COUNT(a.id)::int AS artifact_count
        FROM sdlc_projects p
        LEFT JOIN sdlc_artifacts a ON a.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const { name, client, product } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name is required' })
      const rows = await sql`
        INSERT INTO sdlc_projects (name, client, product)
        VALUES (${name}, ${client || ''}, ${product || 'InsuranceSuite'})
        RETURNING id, name, client, product, created_at
      `
      return res.status(201).json(rows[0])
    }

    if (req.method === 'DELETE' && id) {
      await sql`DELETE FROM sdlc_projects WHERE id = ${id}`
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Database operation failed' })
  }
}
