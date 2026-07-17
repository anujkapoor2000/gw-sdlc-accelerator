// Shared upload limits — each API request must stay under Vercel's 4.5 MB body cap.

/** Max raw PDF size to parse in the browser. */
export const MAX_PDF_FILE_BYTES = 50_000_000

/** Max text per indexed knowledge document (one HTTP upload). */
export const MAX_KNOWLEDGE_DOC_BYTES = 1_400_000

/** Legacy alias used by text file uploads. */
export const MAX_TEXT_UPLOAD_BYTES = MAX_KNOWLEDGE_DOC_BYTES
export const MAX_EXTRACTED_TEXT_BYTES = MAX_KNOWLEDGE_DOC_BYTES

export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

export function assertUploadSize(file) {
  const isPdf = file.name.toLowerCase().endsWith('.pdf')
  const max = isPdf ? MAX_PDF_FILE_BYTES : MAX_KNOWLEDGE_DOC_BYTES
  if (file.size > max) {
    throw new Error(
      `${file.name} is too large (${formatBytes(file.size)}). ` +
      `Max ${formatBytes(max)} for ${isPdf ? 'PDF' : 'text'} uploads.`
    )
  }
}
