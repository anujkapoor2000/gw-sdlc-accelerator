// Upload size limits — each request must stay under Vercel's 4.5 MB body cap.

export const MAX_KNOWLEDGE_DOC_BYTES = 1_400_000
export const MAX_PDF_BYTES = 3_000_000 // server-side base64 fallback only
