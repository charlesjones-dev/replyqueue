/**
 * Tests for extracted posts storage functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearMockStorage, setMockStorage, mockChrome } from '../setup'
import {
  getExtractedPosts,
  saveExtractedPosts,
  addExtractedPosts,
  clearExtractedPosts,
} from '../../src/shared/storage'
import type { ExtractedPostRecord } from '../../src/shared/types'
import { STORAGE_KEYS, MAX_EXTRACTED_POSTS } from '../../src/shared/constants'

describe('Extracted Posts Storage', () => {
  beforeEach(() => {
    clearMockStorage()
    vi.clearAllMocks()
  })

  describe('getExtractedPosts', () => {
    it('should return empty array when no posts exist', async () => {
      const posts = await getExtractedPosts()
      expect(posts).toEqual([])
    })

    it('should return stored posts', async () => {
      const storedPosts: ExtractedPostRecord[] = [
        {
          id: '123',
          platform: 'linkedin',
          url: 'https://linkedin.com/post/123',
          authorName: 'John Doe',
          content: 'Test content',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ]
      // Extracted posts use local storage
      setMockStorage({ [STORAGE_KEYS.EXTRACTED_POSTS]: storedPosts }, 'local')

      const posts = await getExtractedPosts()
      expect(posts).toHaveLength(1)
      expect(posts[0].id).toBe('123')
    })
  })

  describe('saveExtractedPosts', () => {
    it('should save posts to storage', async () => {
      const posts: ExtractedPostRecord[] = [
        {
          id: '456',
          platform: 'linkedin',
          url: 'https://linkedin.com/post/456',
          authorName: 'Jane Doe',
          content: 'Another post',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ]

      await saveExtractedPosts(posts)

      expect(mockChrome.storage.local.set).toHaveBeenCalled()
    })
  })

  describe('addExtractedPosts', () => {
    it('should add new posts and return counts', async () => {
      const newPosts: ExtractedPostRecord[] = [
        {
          id: '789',
          platform: 'linkedin',
          url: 'https://linkedin.com/post/789',
          authorName: 'New User',
          content: 'New content',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ]

      const result = await addExtractedPosts(newPosts)

      expect(result.added).toBe(1)
      expect(result.duplicates).toBe(0)
      expect(result.total).toBe(1)
    })

    it('should detect and skip duplicate posts', async () => {
      const existingPost: ExtractedPostRecord = {
        id: '111',
        platform: 'linkedin',
        url: 'https://linkedin.com/post/111',
        authorName: 'Existing User',
        content: 'Existing content',
        extractedAt: Date.now() - 1000,
        sourcePageUrl: 'https://linkedin.com/feed',
      }
      // Extracted posts use local storage
      setMockStorage({ [STORAGE_KEYS.EXTRACTED_POSTS]: [existingPost] }, 'local')

      const newPosts: ExtractedPostRecord[] = [
        { ...existingPost }, // Duplicate
        {
          id: '222',
          platform: 'linkedin',
          url: 'https://linkedin.com/post/222',
          authorName: 'New User',
          content: 'New content',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ]

      const result = await addExtractedPosts(newPosts)

      expect(result.added).toBe(1)
      expect(result.duplicates).toBe(1)
      expect(result.total).toBe(2)
    })

    it('should handle cross-platform duplicates correctly', async () => {
      const linkedinPost: ExtractedPostRecord = {
        id: '123',
        platform: 'linkedin',
        url: 'https://linkedin.com/post/123',
        authorName: 'User',
        content: 'Content',
        extractedAt: Date.now(),
        sourcePageUrl: 'https://linkedin.com/feed',
      }
      // Extracted posts use local storage
      setMockStorage({ [STORAGE_KEYS.EXTRACTED_POSTS]: [linkedinPost] }, 'local')

      // Same ID but different platform should not be considered duplicate
      const twitterPost: ExtractedPostRecord = {
        id: '123',
        platform: 'twitter',
        url: 'https://twitter.com/post/123',
        authorName: 'User',
        content: 'Content',
        extractedAt: Date.now(),
        sourcePageUrl: 'https://twitter.com',
      }

      const result = await addExtractedPosts([twitterPost])

      expect(result.added).toBe(1)
      expect(result.duplicates).toBe(0)
    })

    it('should trim posts to max size keeping most recent', async () => {
      // Create posts that exceed MAX_EXTRACTED_POSTS
      const existingPosts: ExtractedPostRecord[] = Array.from(
        { length: MAX_EXTRACTED_POSTS },
        (_, i) => ({
          id: `existing-${i}`,
          platform: 'linkedin',
          url: `https://linkedin.com/post/existing-${i}`,
          authorName: 'User',
          content: 'Content',
          extractedAt: Date.now() - (MAX_EXTRACTED_POSTS - i) * 1000, // Older first
          sourcePageUrl: 'https://linkedin.com/feed',
        })
      )
      // Extracted posts use local storage
      setMockStorage({ [STORAGE_KEYS.EXTRACTED_POSTS]: existingPosts }, 'local')

      // Add one more post (newest)
      const newPost: ExtractedPostRecord = {
        id: 'newest',
        platform: 'linkedin',
        url: 'https://linkedin.com/post/newest',
        authorName: 'Newest User',
        content: 'Newest content',
        extractedAt: Date.now() + 1000,
        sourcePageUrl: 'https://linkedin.com/feed',
      }

      const result = await addExtractedPosts([newPost])

      // Should have added the new post
      expect(result.added).toBe(1)
      // Total should be capped at MAX_EXTRACTED_POSTS
      expect(result.total).toBe(MAX_EXTRACTED_POSTS)
    })
  })

  describe('clearExtractedPosts', () => {
    it('should clear all extracted posts', async () => {
      const posts: ExtractedPostRecord[] = [
        {
          id: '999',
          platform: 'linkedin',
          url: 'https://linkedin.com/post/999',
          authorName: 'User',
          content: 'Content',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ]
      // Extracted posts use local storage
      setMockStorage({ [STORAGE_KEYS.EXTRACTED_POSTS]: posts }, 'local')

      await clearExtractedPosts()

      expect(mockChrome.storage.local.set).toHaveBeenCalled()
    })
  })
})
