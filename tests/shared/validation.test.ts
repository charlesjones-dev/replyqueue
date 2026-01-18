import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateApiKeyFormat,
  validateRssUrlFormat,
  validateApiKeyWithServer,
} from '@shared/validation'

describe('validateApiKeyFormat', () => {
  it('should reject empty API key', () => {
    const result = validateApiKeyFormat('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key is required')
  })

  it('should reject whitespace-only API key', () => {
    const result = validateApiKeyFormat('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key is required')
  })

  it('should reject API key with wrong prefix', () => {
    const result = validateApiKeyFormat('sk-wrong-prefix')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('OpenRouter keys start with sk-or-v1-')
  })

  it('should reject API key with invalid format', () => {
    const result = validateApiKeyFormat('sk-or-v1-tooshort')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid API key format')
  })

  it('should accept valid API key format', () => {
    const validKey =
      'sk-or-v1-' + 'a'.repeat(64)
    const result = validateApiKeyFormat(validKey)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should accept valid API key with leading/trailing whitespace', () => {
    const validKey = '  sk-or-v1-' + 'b'.repeat(64) + '  '
    const result = validateApiKeyFormat(validKey)
    expect(result.valid).toBe(true)
  })
})

describe('validateRssUrlFormat', () => {
  it('should reject empty URL', () => {
    const result = validateRssUrlFormat('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('RSS feed URL is required')
  })

  it('should reject whitespace-only URL', () => {
    const result = validateRssUrlFormat('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('RSS feed URL is required')
  })

  it('should reject URL without protocol', () => {
    const result = validateRssUrlFormat('example.com/feed.xml')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('must start with http:// or https://')
  })

  it('should reject invalid URL', () => {
    const result = validateRssUrlFormat('not a valid url')
    expect(result.valid).toBe(false)
  })

  it('should accept valid HTTP URL', () => {
    const result = validateRssUrlFormat('http://example.com/feed.xml')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should accept valid HTTPS URL', () => {
    const result = validateRssUrlFormat('https://example.com/feed.xml')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should accept URL with query parameters', () => {
    const result = validateRssUrlFormat('https://example.com/feed?type=rss')
    expect(result.valid).toBe(true)
  })
})

describe('validateApiKeyWithServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should return format error for invalid key format', async () => {
    const result = await validateApiKeyWithServer('invalid-key')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('OpenRouter keys start with sk-or-v1-')
  })

  it('should return error for 401 response', async () => {
    const validKey = 'sk-or-v1-' + 'c'.repeat(64)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    const result = await validateApiKeyWithServer(validKey)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid API key')
  })

  it('should return error for 403 response', async () => {
    const validKey = 'sk-or-v1-' + 'd'.repeat(64)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response)

    const result = await validateApiKeyWithServer(validKey)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('disabled or expired')
  })

  it('should return valid for successful response', async () => {
    const validKey = 'sk-or-v1-' + 'e'.repeat(64)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { limit_remaining: 100 } }),
    } as Response)

    const result = await validateApiKeyWithServer(validKey)
    expect(result.valid).toBe(true)
    expect(result.credits).toBe(100)
  })

  it('should handle network errors', async () => {
    const validKey = 'sk-or-v1-' + 'f'.repeat(64)

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error')
    )

    const result = await validateApiKeyWithServer(validKey)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Network error')
  })
})
