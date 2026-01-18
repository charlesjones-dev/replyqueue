/**
 * Tests for message passing types and utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockChrome } from '../setup'
import {
  sendMessage,
  sendTabMessage,
  isPostsExtractedMessage,
  isContentScriptReadyMessage,
  isScrollToPostMessage,
  type ExtensionMessage,
  type PostsExtractedMessage,
  type ContentScriptReadyMessage,
  type ScrollToPostMessage,
} from '../../src/shared/messages'
import type { ExtractedPost } from '../../src/platforms/types'

describe('Message Type Guards', () => {
  describe('isPostsExtractedMessage', () => {
    it('should return true for valid PostsExtractedMessage', () => {
      const message: PostsExtractedMessage = {
        type: 'POSTS_EXTRACTED',
        posts: [],
        platform: 'linkedin',
        pageUrl: 'https://linkedin.com/feed',
      }
      expect(isPostsExtractedMessage(message)).toBe(true)
    })

    it('should return false for other message types', () => {
      const message: ExtensionMessage = {
        type: 'GET_CONFIG',
      }
      expect(isPostsExtractedMessage(message)).toBe(false)
    })
  })

  describe('isContentScriptReadyMessage', () => {
    it('should return true for valid ContentScriptReadyMessage', () => {
      const message: ContentScriptReadyMessage = {
        type: 'CONTENT_SCRIPT_READY',
        platform: 'linkedin',
        pageUrl: 'https://linkedin.com/feed',
        isFeedPage: true,
      }
      expect(isContentScriptReadyMessage(message)).toBe(true)
    })

    it('should return false for other message types', () => {
      const message: ExtensionMessage = {
        type: 'SAVE_CONFIG',
        config: {},
      }
      expect(isContentScriptReadyMessage(message)).toBe(false)
    })
  })

  describe('isScrollToPostMessage', () => {
    it('should return true for valid ScrollToPostMessage', () => {
      const message: ScrollToPostMessage = {
        type: 'SCROLL_TO_POST',
        postId: '123456',
      }
      expect(isScrollToPostMessage(message)).toBe(true)
    })

    it('should return false for other message types', () => {
      const message: ExtensionMessage = {
        type: 'START_EXTRACTION',
      }
      expect(isScrollToPostMessage(message)).toBe(false)
    })
  })
})

describe('Message Serialization', () => {
  it('should properly serialize PostsExtractedMessage with posts', () => {
    const posts: ExtractedPost[] = [
      {
        id: '123',
        url: 'https://linkedin.com/post/123',
        authorName: 'John Doe',
        content: 'Test content',
        platform: 'linkedin',
        extractedAt: Date.now(),
      },
    ]

    const message: PostsExtractedMessage = {
      type: 'POSTS_EXTRACTED',
      posts,
      platform: 'linkedin',
      pageUrl: 'https://linkedin.com/feed',
    }

    // Verify serialization/deserialization
    const serialized = JSON.stringify(message)
    const deserialized = JSON.parse(serialized)

    expect(deserialized.type).toBe('POSTS_EXTRACTED')
    expect(deserialized.posts).toHaveLength(1)
    expect(deserialized.posts[0].id).toBe('123')
    expect(deserialized.posts[0].authorName).toBe('John Doe')
  })

  it('should handle empty posts array', () => {
    const message: PostsExtractedMessage = {
      type: 'POSTS_EXTRACTED',
      posts: [],
      platform: 'linkedin',
      pageUrl: 'https://linkedin.com/feed',
    }

    const serialized = JSON.stringify(message)
    const deserialized = JSON.parse(serialized)

    expect(deserialized.posts).toHaveLength(0)
  })

  it('should serialize all ExtractedPost fields', () => {
    const post: ExtractedPost = {
      id: '123',
      url: 'https://linkedin.com/post/123',
      authorName: 'John Doe',
      authorHeadline: 'Software Engineer',
      authorProfileUrl: 'https://linkedin.com/in/johndoe',
      content: 'Test content with lots of text',
      publishedAt: '2024-01-15T10:00:00.000Z',
      reactionCount: 42,
      commentCount: 5,
      repostCount: 3,
      isRepost: false,
      contentType: 'text',
      platform: 'linkedin',
      extractedAt: 1705312800000,
    }

    const serialized = JSON.stringify(post)
    const deserialized: ExtractedPost = JSON.parse(serialized)

    expect(deserialized.id).toBe(post.id)
    expect(deserialized.authorName).toBe(post.authorName)
    expect(deserialized.authorHeadline).toBe(post.authorHeadline)
    expect(deserialized.reactionCount).toBe(post.reactionCount)
    expect(deserialized.isRepost).toBe(post.isRepost)
    expect(deserialized.contentType).toBe(post.contentType)
    expect(deserialized.extractedAt).toBe(post.extractedAt)
  })
})

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send message and return response', async () => {
    const mockResponse = { success: true, data: { test: 'value' } }
    mockChrome.runtime.sendMessage.mockResolvedValueOnce(mockResponse)

    const response = await sendMessage({ type: 'GET_CONFIG' })

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_CONFIG' })
    expect(response).toEqual(mockResponse)
  })

  it('should return error response on failure', async () => {
    mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Connection failed'))

    const response = await sendMessage({ type: 'GET_CONFIG' })

    expect(response.success).toBe(false)
    expect(response.error).toBe('Connection failed')
  })
})

describe('sendTabMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send message to specific tab', async () => {
    const mockResponse = { success: true }
    mockChrome.tabs.sendMessage.mockResolvedValueOnce(mockResponse)

    const response = await sendTabMessage(123, { type: 'START_EXTRACTION' })

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, { type: 'START_EXTRACTION' })
    expect(response).toEqual(mockResponse)
  })

  it('should return error response on tab message failure', async () => {
    mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'))

    const response = await sendTabMessage(999, { type: 'STOP_EXTRACTION' })

    expect(response.success).toBe(false)
    expect(response.error).toBe('Tab not found')
  })
})
