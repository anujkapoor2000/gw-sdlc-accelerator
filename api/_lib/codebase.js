// Read and index files from the deployed repo for per-project RAG.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, sep } from 'path'

const REPO_ROOT = resolve(process.cwd())

/** Allowed top-level roots — blocks path traversal outside these trees. */
export const ALLOWED_ROOTS = [
  'reference',
  'katalon',
  'docs',
  'src/lib',
  'db'
]

export const CODEBASE_PRESETS = [
  {
    id: 'reference',
    label: 'GW standards & ski-release themes',
    paths: ['reference']
  },
  {
    id: 'katalon-keywords',
    label: 'Katalon keyword libraries',
    paths: ['katalon/Keywords']
  },
  {
    id: 'katalon-project',
    label: 'Full Katalon project (scripts, suites)',
    paths: ['katalon']
  },
  {
    id: 'accelerator-prompts',
    label: 'Accelerator prompts & catalog',
    paths: ['src/lib/prompts.js', 'src/lib/catalog.js', 'src/lib/referenceMaterial.js']
  }
]

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.js', '.jsx', '.ts', '.tsx',
  '.groovy', '.gosu', '.sql', '.xml', '.csv', '.properties',
  '.glbl', '.feature', '.java', '.yaml', '.yml'
])

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.vercel', 'coverage', '__pycache__'
])

const MAX_FILE_BYTES = 512_000
const MAX_FILES_PER_SYNC = 200

/** Normalise user path and verify it sits under an allowed root. */
export function assertAllowedPath(inputPath) {
  const cleaned = String(inputPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!cleaned || cleaned.includes('..')) {
    throw new Error(`Invalid path: ${inputPath}`)
  }
  const allowed = ALLOWED_ROOTS.some((root) => cleaned === root || cleaned.startsWith(`${root}/`))
  if (!allowed) {
    throw new Error(
      `Path not allowed: ${cleaned}. Permitted roots: ${ALLOWED_ROOTS.join(', ')}`
    )
  }
  const abs = resolve(REPO_ROOT, cleaned)
  if (!abs.startsWith(REPO_ROOT + sep) && abs !== REPO_ROOT) {
    throw new Error(`Path escapes repository root: ${inputPath}`)
  }
  return { relative: cleaned, absolute: abs }
}

function isTextFile(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

/** Recursively collect indexable files under resolved paths. */
export function collectCodebaseFiles(pathInputs) {
  const seen = new Set()
  const files = []

  for (const raw of pathInputs) {
    const { relative: rel, absolute: abs } = assertAllowedPath(raw)
    if (!statSync(abs).isDirectory()) {
      if (isTextFile(abs) && !seen.has(rel)) {
        seen.add(rel)
        files.push({ relativePath: rel, absolutePath: abs })
      }
      continue
    }
    walk(abs, rel, seen, files)
  }

  return files.slice(0, MAX_FILES_PER_SYNC)
}

function walk(dirAbs, dirRel, seen, files) {
  for (const name of readdirSync(dirAbs)) {
    if (SKIP_DIRS.has(name)) continue
    const abs = join(dirAbs, name)
    const rel = dirRel ? `${dirRel}/${name}` : name
    let st
    try { st = statSync(abs) } catch { continue }

    if (st.isDirectory()) {
      walk(abs, rel, seen, files)
      continue
    }
    if (!isTextFile(abs) || st.size > MAX_FILE_BYTES || seen.has(rel)) continue
    seen.add(rel)
    files.push({ relativePath: rel, absolutePath: abs })
    if (files.length >= MAX_FILES_PER_SYNC) return
  }
}

/** Read file text with a path header for embedding context. */
export function readCodebaseFile(file) {
  const body = readFileSync(file.absolutePath, 'utf8')
  return `Source: ${file.relativePath}\n\n${body}`
}

/** Validate uploaded file content from the browser. */
export function validateUpload({ filename, content }) {
  const name = String(filename || 'upload.txt').trim()
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid filename')
  }
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  if (!TEXT_EXTENSIONS.has(ext)) {
    throw new Error(`File type not supported: ${ext || '(none)'}. Use text-based formats.`)
  }
  const text = String(content || '')
  if (!text.trim()) throw new Error('File is empty')
  if (text.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${Math.round(MAX_FILE_BYTES / 1024)} KB)`)
  }
  return { filename: name, content: `Source: ${name}\n\n${text}` }
}

export function resolvePreset(presetId) {
  const preset = CODEBASE_PRESETS.find((p) => p.id === presetId)
  if (!preset) throw new Error(`Unknown preset: ${presetId}`)
  return preset.paths
}
