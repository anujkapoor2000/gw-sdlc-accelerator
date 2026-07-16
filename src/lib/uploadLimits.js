// Shared upload limits (must stay under Vercel's 4.5 MB request body cap).

export const MAX_TEXT_UPLOAD_BYTES = 512_000
export const MAX_PDF_EXTRACT_BYTES = 15_000_000 // max PDF size to parse in browser
export const MAX_EXTRACTED_TEXT_BYTES = 512_000

export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

export function assertUploadSize(file) {
  const isPdf = file.name.toLowerCase().endsWith('.pdf')
  const max = isPdf ? MAX_PDF_EXTRACT_BYTES : MAX_TEXT_UPLOAD_BYTES
  if (file.size > max) {
    throw new Error(
      `${file.name} is too large (${formatBytes(file.size)}). ` +
      `Max ${formatBytes(max)} for ${isPdf ? 'PDF' : 'text'} uploads.`
    )
  }
}
