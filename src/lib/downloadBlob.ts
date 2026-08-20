// No path separators, control characters, or bidi-control characters
// (same hygiene as downloadJson's own basename check), and not just "."
// or ".." - otherwise any real basename is allowed, including internal
// dots (multiple extensions like "report.v2.pdf" are a real filename
// shape downloadJson's own stricter single-".json"-suffix check would
// wrongly reject).
const SAFE_BASENAME = /^(?!\.{1,2}$)[^/\\\p{Cc}\p{Bidi_Control}]+$/u

export function downloadBlob(blob: Blob, filename: string): void {
  if (!SAFE_BASENAME.test(filename)) {
    throw new TypeError('Filename must be a safe basename')
  }

  const objectUrl = URL.createObjectURL(blob)
  const revokeObjectURL = URL.revokeObjectURL.bind(URL)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename

  try {
    document.body.append(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => revokeObjectURL(objectUrl), 0)
  }
}
