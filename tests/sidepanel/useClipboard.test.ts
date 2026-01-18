import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn(),
}

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
})

// Mock document.execCommand for fallback
const mockExecCommand = vi.fn()
Object.defineProperty(document, 'execCommand', {
  value: mockExecCommand,
  writable: true,
})

import { useClipboard } from '@/sidepanel/composables/useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockClipboard.writeText.mockResolvedValue(undefined)
    mockExecCommand.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('copyToClipboard', () => {
    it('should copy text using Clipboard API', async () => {
      const { copyToClipboard } = useClipboard()

      const result = await copyToClipboard('Hello, world!')

      expect(result).toBe(true)
      expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello, world!')
    })

    it('should set copiedId when id is provided', async () => {
      const { copyToClipboard, copiedId } = useClipboard()

      await copyToClipboard('Test text', 'test-id')

      expect(copiedId.value).toBe('test-id')
    })

    it('should reset copiedId after timeout', async () => {
      const { copyToClipboard, copiedId } = useClipboard()

      await copyToClipboard('Test text', 'test-id')
      expect(copiedId.value).toBe('test-id')

      // Advance timers
      vi.advanceTimersByTime(2000)

      expect(copiedId.value).toBeNull()
    })

    it('should use fallback when Clipboard API fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard API failed'))

      const { copyToClipboard } = useClipboard()

      // Mock document.createElement and body methods
      const mockTextArea = {
        value: '',
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      }
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as unknown as HTMLElement)
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(mockTextArea as unknown as HTMLElement)
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockReturnValue(mockTextArea as unknown as HTMLElement)

      const result = await copyToClipboard('Test text')

      expect(result).toBe(true)
      expect(mockExecCommand).toHaveBeenCalledWith('copy')

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('should return false when both methods fail', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard API failed'))
      mockExecCommand.mockReturnValue(false)

      const { copyToClipboard } = useClipboard()

      // Mock document methods to not throw
      const mockTextArea = {
        value: '',
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as unknown as HTMLElement)
      vi.spyOn(document.body, 'appendChild').mockReturnValue(mockTextArea as unknown as HTMLElement)
      vi.spyOn(document.body, 'removeChild').mockReturnValue(mockTextArea as unknown as HTMLElement)

      const result = await copyToClipboard('Test text')

      expect(result).toBe(false)
    })
  })

  describe('wasCopied', () => {
    it('should return true for recently copied id', async () => {
      const { copyToClipboard, wasCopied } = useClipboard()

      await copyToClipboard('Test', 'my-id')

      expect(wasCopied('my-id')).toBe(true)
    })

    it('should return false for different id', async () => {
      const { copyToClipboard, wasCopied } = useClipboard()

      await copyToClipboard('Test', 'my-id')

      expect(wasCopied('other-id')).toBe(false)
    })

    it('should return false after timeout', async () => {
      const { copyToClipboard, wasCopied } = useClipboard()

      await copyToClipboard('Test', 'my-id')
      expect(wasCopied('my-id')).toBe(true)

      vi.advanceTimersByTime(2000)

      expect(wasCopied('my-id')).toBe(false)
    })
  })

  describe('resetCopied', () => {
    it('should clear copiedId', async () => {
      const { copyToClipboard, copiedId, resetCopied } = useClipboard()

      await copyToClipboard('Test', 'my-id')
      expect(copiedId.value).toBe('my-id')

      resetCopied()

      expect(copiedId.value).toBeNull()
    })

    it('should clear pending timeout', async () => {
      const { copyToClipboard, copiedId, resetCopied } = useClipboard()

      await copyToClipboard('Test', 'my-id')
      resetCopied()

      // Copy again
      await copyToClipboard('Test 2', 'my-id-2')

      // The old timeout should not affect the new copied id
      vi.advanceTimersByTime(1000) // Less than full timeout

      expect(copiedId.value).toBe('my-id-2')
    })
  })
})
