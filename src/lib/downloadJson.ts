const SAFE_JSON_BASENAME = /^[^./\\\p{Cc}\p{Bidi_Control}]+\.json$/u

export function downloadJson(data: unknown, filename: string): void {
  if (!SAFE_JSON_BASENAME.test(filename)) {
    throw new TypeError('Filename must be a safe basename ending in .json')
  }

  const json = JSON.stringify(data, null, 2)
  if (json === undefined) throw new TypeError('Data must be JSON-serializable')

  const blob = new Blob([json], { type: 'application/json' })
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
