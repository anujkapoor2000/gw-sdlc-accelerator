// Extract PDF text in the browser so only plain text is sent to the API (avoids 413).

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/** @returns {{ text: string, pages: number }} */
export async function extractPdfTextClient(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const parts = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    parts.push(textContent.items.map((item) => item.str).join(' '))
  }

  const text = parts.join('\n\n').replace(/\r\n/g, '\n').trim()
  if (!text) {
    throw new Error(
      'No extractable text in PDF — it may be scanned/image-only. Paste the text or use OCR first.'
    )
  }

  return { text, pages: pdf.numPages }
}
