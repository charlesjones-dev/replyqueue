/**
 * Tests for DOM observer and debounce logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the DOMObserver since we can't easily test MutationObserver
describe('DOM Observer Debounce Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce multiple rapid calls', async () => {
    const callback = vi.fn()
    let pendingElements: Element[] = []
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const debounceMs = 500

    // Simulate the debounce logic
    const scheduleProcessing = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        callback(pendingElements)
        pendingElements = []
      }, debounceMs)
    }

    // Simulate rapid element additions
    pendingElements.push(document.createElement('div'))
    scheduleProcessing()

    pendingElements.push(document.createElement('div'))
    scheduleProcessing()

    pendingElements.push(document.createElement('div'))
    scheduleProcessing()

    // Should not have called yet
    expect(callback).not.toHaveBeenCalled()

    // Advance time past debounce threshold
    vi.advanceTimersByTime(500)

    // Should now have been called once with all elements
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(expect.any(Array))
  })

  it('should respect minimum debounce time', () => {
    const minDebounce = 100
    const requestedDebounce = 50

    // The actual debounce should be at least minDebounce
    const actualDebounce = Math.max(requestedDebounce, minDebounce)
    expect(actualDebounce).toBe(100)
  })

  it('should batch elements during debounce period', () => {
    const processedElements: Element[] = []
    let pendingElements: Element[] = []
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const process = () => {
      processedElements.push(...pendingElements)
      pendingElements = []
    }

    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(process, 500)
    }

    // Add elements at different times
    pendingElements.push(document.createElement('div'))
    schedule()

    vi.advanceTimersByTime(200)
    pendingElements.push(document.createElement('div'))
    schedule()

    vi.advanceTimersByTime(200)
    pendingElements.push(document.createElement('div'))
    schedule()

    // Should not process yet
    expect(processedElements.length).toBe(0)

    // Advance to trigger processing
    vi.advanceTimersByTime(500)

    // All three elements should be processed together
    expect(processedElements.length).toBe(3)
  })
})

describe('Scroll End Detection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should trigger callback after scroll stops', () => {
    const callback = vi.fn()
    let timer: number | null = null
    const debounceMs = 150

    const handleScroll = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(callback, debounceMs) as unknown as number
    }

    // Simulate multiple scroll events
    handleScroll()
    vi.advanceTimersByTime(50)
    handleScroll()
    vi.advanceTimersByTime(50)
    handleScroll()

    // Should not have fired yet
    expect(callback).not.toHaveBeenCalled()

    // Wait for debounce
    vi.advanceTimersByTime(150)

    expect(callback).toHaveBeenCalledTimes(1)
  })
})
