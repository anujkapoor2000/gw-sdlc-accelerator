// /api/projects.js — Neon Postgres persistence for projects and saved outputs.
// One function handles both resources to keep the serverless footprint small:
//   GET    /api/projects                       → list projects (with artifact counts)
//   POST   /api/projects                       → create project { name, client, product }
//   DELETE /api/projects?id=<uuid>             → delete project (cascades artifacts)
//   GET    /api/projects?id=<uuid>&artifacts=1 → list artifacts for a project
//   POST   /api/projects?id=<uuid>&artifacts=1 → save artifact { module, title, content }
//   DELETE /api/projects?artifactId=<uuid>     → delete a single artifact

import { neon } from '@neondatabase/serverless'

let schemaReady = false

async function ensureSchema(sql) {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      client TEXT DEFAULT '',
      product TEXT DEFAULT 'InsuranceSuite',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sdlc_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES sdlc_projects(id) ON DELETE CASCADE,
      module TEXT NOT NULL,
      title TEXT NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `
  schemaReady = true
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      error: 'DATABASE_URL is not configured. Add it as a plain Environment Variable in Vercel settings.'
    })
  }

  const sql = neon(process.env.DATABASE_URL)
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
          RETURNING id, module, title, created_at
        `
        return res.status(201).json(rows[0])
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
