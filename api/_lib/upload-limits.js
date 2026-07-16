// Upload size limits — keep extracted text under Vercel's 4.5 MB body cap.

export const MAX_TEXT_UPLOAD_BYTES = 512_000
export const MAX_PDF_BYTES = 3_000_000 // server-side base64 fallback only (~4 MB encoded)
