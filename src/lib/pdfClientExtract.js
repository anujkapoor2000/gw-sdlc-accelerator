// Extract PDF text in the browser — split large documents into multiple indexed parts.

import * as pdfjsLib from 'pdfjs-dist'
import { MAX_KNOWLEDGE_DOC_BYTES } from './uploadLimits.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

async function pageText(pdf, pageNum) {
  const page = await pdf.getPage(pageNum)
  const textContent = await page.getTextContent()
  return textContent.items.map((item) => item.str).join(' ').trim()
}

/**
 * Extract PDF text, splitting into parts when extract exceeds maxCharsPerPart.
 * Each part becomes one knowledge document (separate Voyage embedding + DB row).
 * @returns {{ parts: Array<{ text, pageStart, pageEnd, partIndex, totalParts }>, totalPages: number }}
 */
export async function extractPdfInParts(arrayBuffer, maxCharsPerPart = MAX_KNOWLEDGE_DOC_BYTES) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const rawParts = []
  let buf = []
  let pageStart = 0
  let pageEnd = 0
  let chars = 0

  function flush() {
    if (!buf.length) return
    rawParts.push({
      text: buf.join('\n\n'),
      pageStart,
      pageEnd,
      chars
    })
    buf = []
    pageStart = 0
    pageEnd = 0
    chars = 0
  }

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const text = await pageText(pdf, pageNum)
    if (!text) continue

    const blockLen = text.length + (buf.length ? 2 : 0)
    if (chars + blockLen > maxCharsPerPart && buf.length) {
      flush()
    }

    if (!buf.length) pageStart = pageNum
    buf.push(text)
    pageEnd = pageNum
    chars += blockLen
  }
  flush()

  if (!rawParts.length) {
    throw new Error(
      'No extractable text in PDF — it may be scanned/image-only. Paste the text or use OCR first.'
    )
  }

  const totalParts = rawParts.length
  return {
    totalPages: pdf.numPages,
    parts: rawParts.map((p, i) => ({
      text: p.text,
      pageStart: p.pageStart,
      pageEnd: p.pageEnd,
      partIndex: i + 1,
      totalParts
    }))
  }
}

/** Single-part extract (small PDFs). */
export async function extractPdfTextClient(arrayBuffer) {
  const { parts, totalPages } = await extractPdfInParts(arrayBuffer)
  if (parts.length !== 1) {
    return { text: parts[0].text, pages: totalPages, multiPart: true, parts }
  }
  return { text: parts[0].text, pages: totalPages }
}
