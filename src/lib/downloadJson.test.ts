import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadJson } from './downloadJson'

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}

describe('downloadJson', () => {
  let anchor: HTMLAnchorElement
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const createElement = document.createElement.bind(document)
    anchor = createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => {})
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName.toLowerCase() === 'a') return anchor
      return createElement(tagName)
    })

    createObjectURL = vi.fn(() => 'blob:export')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('serializes the supplied value as readable JSON with the JSON MIME type', async () => {
    downloadJson({ notes: [{ id: 'note-1' }] }, 'zettel-export-2026-08-07.json')

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
    expect(await readBlob(blob)).toBe(
      JSON.stringify({ notes: [{ id: 'note-1' }] }, null, 2),
    )
  })

  it('uses the exact caller-provided filename and a connected anchor for the download', () => {
    vi.useFakeTimers()
    vi.mocked(anchor.click).mockImplementation(() => {
      expect(anchor.isConnected).toBe(true)
    })

    downloadJson({ projects: [] }, 'tafel-export-2026-08-07.json')

    expect(anchor.download).toBe('tafel-export-2026-08-07.json')
    expect(anchor.href).toBe('blob:export')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(anchor.isConnected).toBe(false)
    vi.runOnlyPendingTimers()
  })

  it('revokes the object URL in a later task', () => {
    vi.useFakeTimers()
    downloadJson({}, 'export.json')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
    expect(anchor.click).toHaveBeenCalledBefore(revokeObjectURL)
  })

  it('still removes the anchor and schedules URL revocation when the click throws', () => {
    vi.useFakeTimers()
    vi.mocked(anchor.click).mockImplementation(() => {
      throw new Error('download blocked')
    })

    expect(() => downloadJson({}, 'export.json')).toThrow('download blocked')
    expect(anchor.isConnected).toBe(false)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })

  it.each([
    '',
    '.json',
    '../export.json',
    'folder/export.json',
    'folder\\export.json',
    'export.json.exe',
    'export.exe.json',
    'export.JSON',
    'export\u0000.json',
    'export\u202etxt.json',
  ])('rejects unsafe filename %j before creating an object URL', (filename) => {
    expect(() => downloadJson({}, filename)).toThrow(
      'Filename must be a safe basename ending in .json',
    )
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
