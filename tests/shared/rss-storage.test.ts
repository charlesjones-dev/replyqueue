import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMatchedPostsWithScore,
  saveMatchedPostsWithScore,
  updateMatchedPostStatus,
  clearMatchedPostsWithScore,
  getCachedRssFeed,
  saveCachedRssFeed,
  clearCachedRssFeed,
  isCachedFeedValid,
  getExampleComments,
  saveExampleComments,
  addExampleComment,
  removeExampleComment,
  updateExampleComment,
  clearExampleComments,
} from '@shared/storage'
import type { MatchedPostWithScore, CachedRssFeed } from '@shared/types'
import { clearMockStorage } from '../setup'

// Helper to create test matched post
function createTestMatchedPost(overrides: Partial<MatchedPostWithScore> = {}): MatchedPostWithScore {
  return {
    post: {
      id: 'test-post-1',
      platform: 'linkedin',
      url: 'https://linkedin.com/posts/test-1',
      authorName: 'John Doe',
      content: 'Test content',
      extractedAt: Date.now(),
      sourcePageUrl: 'https://linkedin.com/feed',
    },
    score: 0.5,
    matchedKeywords: ['test'],
    matchReason: 'Test match',
    matchedAt: Date.now(),
    status: 'pending',
    ...overrides,
  }
}

// Helper to create test cached feed
function createTestCachedFeed(overrides: Partial<CachedRssFeed> = {}): CachedRssFeed {
  return {
    feed: {
      title: 'Test Feed',
      items: [],
      feedType: 'rss',
    },
    fetchedAt: Date.now(),
    ttl: 60 * 60 * 1000, // 1 hour
    url: 'https://example.com/feed.xml',
    ...overrides,
  }
}

describe('RSS Storage', () => {
  beforeEach(() => {
    clearMockStorage()
  })

  describe('Matched Posts With Score', () => {
    it('should save and retrieve matched posts', async () => {
      const posts = [
        createTestMatchedPost({ post: { ...createTestMatchedPost().post, id: 'post-1' } }),
        createTestMatchedPost({ post: { ...createTestMatchedPost().post, id: 'post-2' } }),
      ]

      await saveMatchedPostsWithScore(posts)
      const retrieved = await getMatchedPostsWithScore()

      expect(retrieved.length).toBe(2)
      expect(retrieved[0].post.id).toBe('post-1')
      expect(retrieved[1].post.id).toBe('post-2')
    })

    it('should return empty array when no posts', async () => {
      const posts = await getMatchedPostsWithScore()
      expect(posts).toEqual([])
    })

    it('should update post status', async () => {
      const posts = [
        createTestMatchedPost({
          post: { ...createTestMatchedPost().post, id: 'post-1' },
          status: 'pending',
        }),
      ]

      await saveMatchedPostsWithScore(posts)
      await updateMatchedPostStatus('post-1', 'linkedin', 'replied', 'My reply')

      const retrieved = await getMatchedPostsWithScore()
      expect(retrieved[0].status).toBe('replied')
      expect(retrieved[0].draftReply).toBe('My reply')
    })

    it('should clear matched posts', async () => {
      const posts = [createTestMatchedPost()]
      await saveMatchedPostsWithScore(posts)
      await clearMatchedPostsWithScore()

      const retrieved = await getMatchedPostsWithScore()
      expect(retrieved).toEqual([])
    })

    it('should sort by score and limit to max', async () => {
      const posts = Array.from({ length: 150 }, (_, i) =>
        createTestMatchedPost({
          post: { ...createTestMatchedPost().post, id: `post-${i}` },
          score: i / 150,
        })
      )

      await saveMatchedPostsWithScore(posts)
      const retrieved = await getMatchedPostsWithScore()

      // Should be limited to MAX_MATCHED_POSTS (100)
      expect(retrieved.length).toBeLessThanOrEqual(100)
      // Should be sorted by score descending
      if (retrieved.length > 1) {
        expect(retrieved[0].score).toBeGreaterThanOrEqual(retrieved[1].score)
      }
    })
  })

  describe('Cached RSS Feed', () => {
    it('should save and retrieve cached feed', async () => {
      const cached = createTestCachedFeed()
      await saveCachedRssFeed(cached)

      const retrieved = await getCachedRssFeed()
      expect(retrieved).not.toBeNull()
      expect(retrieved?.feed.title).toBe('Test Feed')
      expect(retrieved?.url).toBe('https://example.com/feed.xml')
    })

    it('should return null when no cached feed', async () => {
      const cached = await getCachedRssFeed()
      expect(cached).toBeNull()
    })

    it('should clear cached feed', async () => {
      const cached = createTestCachedFeed()
      await saveCachedRssFeed(cached)
      await clearCachedRssFeed()

      const retrieved = await getCachedRssFeed()
      expect(retrieved).toBeNull()
    })

    it('should detect valid cache', () => {
      const cached = createTestCachedFeed({
        fetchedAt: Date.now(),
        ttl: 60 * 60 * 1000, // 1 hour
      })

      expect(isCachedFeedValid(cached)).toBe(true)
    })

    it('should detect expired cache', () => {
      const cached = createTestCachedFeed({
        fetchedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        ttl: 60 * 60 * 1000, // 1 hour TTL
      })

      expect(isCachedFeedValid(cached)).toBe(false)
    })

    it('should return false for null cache', () => {
      expect(isCachedFeedValid(null)).toBe(false)
    })
  })

  describe('Example Comments', () => {
    it('should save and retrieve example comments', async () => {
      const comments = ['First comment', 'Second comment']
      await saveExampleComments(comments)

      const retrieved = await getExampleComments()
      expect(retrieved).toEqual(comments)
    })

    it('should return empty array when no comments', async () => {
      const comments = await getExampleComments()
      expect(comments).toEqual([])
    })

    it('should add example comment', async () => {
      await addExampleComment('First comment')
      await addExampleComment('Second comment')

      const comments = await getExampleComments()
      expect(comments).toContain('First comment')
      expect(comments).toContain('Second comment')
      // New comments should be at the beginning
      expect(comments[0]).toBe('Second comment')
    })

    it('should not add duplicate comments', async () => {
      await addExampleComment('Test comment')
      await addExampleComment('Test comment')

      const comments = await getExampleComments()
      expect(comments.filter(c => c === 'Test comment').length).toBe(1)
    })

    it('should remove example comment', async () => {
      await saveExampleComments(['Comment 1', 'Comment 2', 'Comment 3'])
      await removeExampleComment('Comment 2')

      const comments = await getExampleComments()
      expect(comments).not.toContain('Comment 2')
      expect(comments.length).toBe(2)
    })

    it('should update example comment', async () => {
      await saveExampleComments(['Old comment', 'Other comment'])
      await updateExampleComment('Old comment', 'New comment')

      const comments = await getExampleComments()
      expect(comments).not.toContain('Old comment')
      expect(comments).toContain('New comment')
    })

    it('should clear example comments', async () => {
      await saveExampleComments(['Comment 1', 'Comment 2'])
      await clearExampleComments()

      const comments = await getExampleComments()
      expect(comments).toEqual([])
    })

    it('should limit to max number of comments', async () => {
      const manyComments = Array.from({ length: 20 }, (_, i) => `Comment ${i}`)
      await saveExampleComments(manyComments)

      const comments = await getExampleComments()
      // MAX_EXAMPLE_COMMENTS is 10
      expect(comments.length).toBeLessThanOrEqual(10)
    })
  })
})
