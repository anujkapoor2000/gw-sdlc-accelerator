// Extract plain text from PDF uploads (Node.js serverless fallback when client cannot extract).

import pdf from 'pdf-parse/lib/pdf-parse.js'
import { MAX_PDF_BYTES } from './upload-limits.js'

export { MAX_PDF_BYTES }

/** Extract searchable text from a PDF buffer. */
export async function extractPdfText(buffer) {
  const data = await pdf(buffer)
  const text = String(data.text || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    throw new Error(
      'No extractable text in PDF — it may be scanned/image-only. Paste the text or use OCR first.'
    )
  }
  return {
    text,
    pages: data.numpages || 0
  }
}
