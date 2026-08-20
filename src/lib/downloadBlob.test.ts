import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './downloadBlob'

describe('downloadBlob', () => {
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

    createObjectURL = vi.fn(() => 'blob:file')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates an object URL from the exact blob passed in', () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    downloadBlob(blob, 'report.pdf')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
  })

  it('uses the exact caller-provided filename and a connected anchor for the download', () => {
    vi.useFakeTimers()
    vi.mocked(anchor.click).mockImplementation(() => {
      expect(anchor.isConnected).toBe(true)
    })

    downloadBlob(new Blob(['x']), 'photo.jpg')

    expect(anchor.download).toBe('photo.jpg')
    expect(anchor.href).toBe('blob:file')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(anchor.isConnected).toBe(false)
    vi.runOnlyPendingTimers()
  })

  it('revokes the object URL in a later task', () => {
    vi.useFakeTimers()
    downloadBlob(new Blob(['x']), 'file.bin')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:file')
    expect(anchor.click).toHaveBeenCalledBefore(revokeObjectURL)
  })

  it('still removes the anchor and schedules URL revocation when the click throws', () => {
    vi.useFakeTimers()
    vi.mocked(anchor.click).mockImplementation(() => {
      throw new Error('download blocked')
    })

    expect(() => downloadBlob(new Blob(['x']), 'file.bin')).toThrow('download blocked')
    expect(anchor.isConnected).toBe(false)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runOnlyPendingTimers()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:file')
  })

  it('allows a filename with multiple internal dots and spaces (unlike downloadJson\'s stricter single-suffix rule)', () => {
    expect(() => downloadBlob(new Blob(['x']), 'Report v2 (final).pdf')).not.toThrow()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it.each([
    '',
    '.',
    '..',
    '../report.pdf',
    'folder/report.pdf',
    'folder\\report.pdf',
    `report${String.fromCharCode(0x202e)}txt.pdf`,
  ])('rejects unsafe filename %j before creating an object URL', (filename) => {
    expect(() => downloadBlob(new Blob(['x']), filename)).toThrow(
      'Filename must be a safe basename',
    )
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
