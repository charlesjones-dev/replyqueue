/**
 * Integration tests for ReplyQueue Phase 5: Polish & UX Refinement
 * Tests the full flow: setup -> extraction -> matching -> display
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearMockStorage, setMockStorage } from '../setup';
import {
  getConfig,
  updateConfig,
  saveMatchedPostsWithScore,
  getMatchedPostsWithScore,
  clearAllCaches,
  clearCachedRssFeed,
  getCachedRssFeed,
  getExtractedPosts,
  addExtractedPosts,
} from '@shared/storage';
import { STORAGE_KEYS } from '@shared/constants';
import type { MatchedPostWithScore, ExtractedPostRecord, CachedRssFeed } from '@shared/types';

describe('Full Flow Integration Tests', () => {
  beforeEach(() => {
    clearMockStorage();
    vi.clearAllMocks();
  });

  describe('Setup Flow', () => {
    it('should start with default config when no setup is complete', async () => {
      const config = await getConfig();

      expect(config.isSetupComplete).toBe(false);
      expect(config.apiKey).toBe('');
      expect(config.rssFeedUrl).toBe('');
    });

    it('should properly save setup configuration', async () => {
      await updateConfig({
        apiKey: 'sk-or-v1-test-api-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        isSetupComplete: true,
      });

      const config = await getConfig();

      expect(config.isSetupComplete).toBe(true);
      expect(config.apiKey).toBe('sk-or-v1-test-api-key');
      expect(config.rssFeedUrl).toBe('https://example.com/feed.xml');
    });

    it('should preserve model selection through setup', async () => {
      await updateConfig({
        selectedModel: 'anthropic/claude-sonnet-4.5',
        isSetupComplete: true,
      });

      const config = await getConfig();
      expect(config.selectedModel).toBe('anthropic/claude-sonnet-4.5');
    });
  });

  describe('Post Storage Flow', () => {
    it('should store extracted posts with deduplication', async () => {
      const posts: ExtractedPostRecord[] = [
        {
          id: 'post-1',
          platform: 'linkedin',
          url: 'https://linkedin.com/posts/1',
          authorName: 'Test Author',
          content: 'Test content 1',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
        {
          id: 'post-2',
          platform: 'linkedin',
          url: 'https://linkedin.com/posts/2',
          authorName: 'Test Author 2',
          content: 'Test content 2',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ];

      const result = await addExtractedPosts(posts);

      expect(result.added).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.total).toBe(2);

      // Try to add duplicates
      const result2 = await addExtractedPosts([posts[0]]);

      expect(result2.added).toBe(0);
      expect(result2.duplicates).toBe(1);
      expect(result2.total).toBe(2);
    });

    it('should store matched posts with scores', async () => {
      const matchedPosts: MatchedPostWithScore[] = [
        {
          post: {
            id: 'post-1',
            platform: 'linkedin',
            url: 'https://linkedin.com/posts/1',
            authorName: 'Test Author',
            content: 'Great post about technology',
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: 0.85,
          matchedKeywords: ['technology', 'development'],
          matchReason: 'Matched keywords: technology, development',
          matchedAt: Date.now(),
          status: 'pending',
        },
        {
          post: {
            id: 'post-2',
            platform: 'linkedin',
            url: 'https://linkedin.com/posts/2',
            authorName: 'Another Author',
            content: 'Another interesting post',
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: 0.65,
          matchedKeywords: ['interesting'],
          matchReason: 'Semantic similarity to RSS content',
          matchedAt: Date.now(),
          status: 'pending',
        },
      ];

      await saveMatchedPostsWithScore(matchedPosts);
      const retrieved = await getMatchedPostsWithScore();

      expect(retrieved).toHaveLength(2);
      // Should be sorted by score descending
      expect(retrieved[0].score).toBeGreaterThanOrEqual(retrieved[1].score);
    });
  });

  describe('Settings Changes Flow', () => {
    it('should properly update matching preferences', async () => {
      const initialConfig = await getConfig();
      expect(initialConfig.matchingPreferences?.threshold).toBe(0.3);

      await updateConfig({
        matchingPreferences: {
          threshold: 0.5,
          maxPosts: 30,
          cacheTtlMinutes: 120,
        },
      });

      const updatedConfig = await getConfig();
      expect(updatedConfig.matchingPreferences?.threshold).toBe(0.5);
      expect(updatedConfig.matchingPreferences?.maxPosts).toBe(30);
      expect(updatedConfig.matchingPreferences?.cacheTtlMinutes).toBe(120);
    });

    it('should preserve other settings when updating specific fields', async () => {
      await updateConfig({
        apiKey: 'test-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        isSetupComplete: true,
      });

      await updateConfig({
        selectedModel: 'anthropic/claude-sonnet-4.5',
      });

      const config = await getConfig();
      expect(config.apiKey).toBe('test-key');
      expect(config.rssFeedUrl).toBe('https://example.com/feed.xml');
      expect(config.isSetupComplete).toBe(true);
      expect(config.selectedModel).toBe('anthropic/claude-sonnet-4.5');
    });
  });

  describe('Cache Management Flow', () => {
    it('should clear all caches while preserving settings', async () => {
      // Set up config
      await updateConfig({
        apiKey: 'test-key',
        rssFeedUrl: 'https://example.com/feed.xml',
        isSetupComplete: true,
      });

      // Add some cached data
      const posts: ExtractedPostRecord[] = [
        {
          id: 'post-1',
          platform: 'linkedin',
          url: 'https://linkedin.com/posts/1',
          authorName: 'Test Author',
          content: 'Test content',
          extractedAt: Date.now(),
          sourcePageUrl: 'https://linkedin.com/feed',
        },
      ];
      await addExtractedPosts(posts);

      const matchedPosts: MatchedPostWithScore[] = [
        {
          post: posts[0],
          score: 0.8,
          matchedKeywords: ['test'],
          matchReason: 'Test match',
          matchedAt: Date.now(),
          status: 'pending',
        },
      ];
      await saveMatchedPostsWithScore(matchedPosts);

      // Clear caches
      await clearAllCaches();

      // Verify caches are cleared
      const extractedPosts = await getExtractedPosts();
      expect(extractedPosts).toHaveLength(0);

      const matchedPostsResult = await getMatchedPostsWithScore();
      expect(matchedPostsResult).toHaveLength(0);

      // Verify config is preserved
      const config = await getConfig();
      expect(config.apiKey).toBe('test-key');
      expect(config.rssFeedUrl).toBe('https://example.com/feed.xml');
      expect(config.isSetupComplete).toBe(true);
    });

    it('should clear RSS cache separately', async () => {
      // This tests the clearCachedRssFeed function
      const cachedFeed: CachedRssFeed = {
        feed: {
          title: 'Test Feed',
          description: 'A test feed',
          feedType: 'rss',
          items: [
            {
              id: 'item-1',
              title: 'Test Item',
              link: 'https://example.com/item',
              content: 'Test content',
            },
          ],
        },
        fetchedAt: Date.now(),
        ttl: 60 * 60 * 1000,
        url: 'https://example.com/feed.xml',
      };

      setMockStorage({ [STORAGE_KEYS.CACHED_RSS_FEED]: cachedFeed }, 'local');

      await clearCachedRssFeed();

      const retrieved = await getCachedRssFeed();
      expect(retrieved).toBeNull();
    });
  });

  describe('Post Status Updates', () => {
    it('should update post status correctly', async () => {
      const matchedPosts: MatchedPostWithScore[] = [
        {
          post: {
            id: 'post-1',
            platform: 'linkedin',
            url: 'https://linkedin.com/posts/1',
            authorName: 'Test Author',
            content: 'Test content',
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: 0.8,
          matchedKeywords: ['test'],
          matchReason: 'Test match',
          matchedAt: Date.now(),
          status: 'pending',
        },
      ];

      await saveMatchedPostsWithScore(matchedPosts);

      // Update status to skipped
      const posts = await getMatchedPostsWithScore();
      posts[0].status = 'skipped';
      await saveMatchedPostsWithScore(posts);

      const updated = await getMatchedPostsWithScore();
      expect(updated[0].status).toBe('skipped');
    });

    it('should filter posts by status', async () => {
      const matchedPosts: MatchedPostWithScore[] = [
        {
          post: {
            id: 'post-1',
            platform: 'linkedin',
            url: 'https://linkedin.com/posts/1',
            authorName: 'Author 1',
            content: 'Content 1',
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: 0.8,
          matchedKeywords: ['keyword1'],
          matchReason: 'Match 1',
          matchedAt: Date.now(),
          status: 'pending',
        },
        {
          post: {
            id: 'post-2',
            platform: 'linkedin',
            url: 'https://linkedin.com/posts/2',
            authorName: 'Author 2',
            content: 'Content 2',
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: 0.7,
          matchedKeywords: ['keyword2'],
          matchReason: 'Match 2',
          matchedAt: Date.now(),
          status: 'skipped',
        },
        {
          post: {
            id: 'post-3',
            platform: 'linkedin',
            url: 'https://linkedin.com/posts/3',
            authorName: 'Author 3',
            content: 'Content 3',
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: 0.6,
          matchedKeywords: ['keyword3'],
          matchReason: 'Match 3',
          matchedAt: Date.now(),
          status: 'replied',
        },
      ];

      await saveMatchedPostsWithScore(matchedPosts);
      const allPosts = await getMatchedPostsWithScore();

      const pendingPosts = allPosts.filter((p) => p.status === 'pending');
      const skippedPosts = allPosts.filter((p) => p.status === 'skipped');
      const draftedPosts = allPosts.filter((p) => p.status === 'replied');

      expect(pendingPosts).toHaveLength(1);
      expect(skippedPosts).toHaveLength(1);
      expect(draftedPosts).toHaveLength(1);
    });
  });

  describe('Refresh Flow', () => {
    it('should track refresh timestamp correctly', async () => {
      // This tests that the lastFetchTime is updated correctly
      const initialConfig = await getConfig();
      expect(initialConfig.lastFetchTime).toBeUndefined();

      const fetchTime = Date.now();
      await updateConfig({ lastFetchTime: fetchTime });

      const updatedConfig = await getConfig();
      expect(updatedConfig.lastFetchTime).toBe(fetchTime);
    });
  });

  describe('Performance Limits', () => {
    it('should limit stored posts to MAX_MATCHED_POSTS', async () => {
      // Create more posts than the limit
      const matchedPosts: MatchedPostWithScore[] = [];
      for (let i = 0; i < 150; i++) {
        matchedPosts.push({
          post: {
            id: `post-${i}`,
            platform: 'linkedin',
            url: `https://linkedin.com/posts/${i}`,
            authorName: `Author ${i}`,
            content: `Content ${i}`,
            extractedAt: Date.now(),
            sourcePageUrl: 'https://linkedin.com/feed',
          },
          score: Math.random(),
          matchedKeywords: ['keyword'],
          matchReason: `Match ${i}`,
          matchedAt: Date.now(),
          status: 'pending',
        });
      }

      await saveMatchedPostsWithScore(matchedPosts);
      const retrieved = await getMatchedPostsWithScore();

      // Should be limited to MAX_MATCHED_POSTS (100)
      expect(retrieved.length).toBeLessThanOrEqual(100);

      // Should be sorted by score, so highest scores are kept
      for (let i = 0; i < retrieved.length - 1; i++) {
        expect(retrieved[i].score).toBeGreaterThanOrEqual(retrieved[i + 1].score);
      }
    });
  });
});
