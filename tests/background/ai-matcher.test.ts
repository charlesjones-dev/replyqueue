import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedPostRecord } from '@shared/types';

// Mock chrome.storage.local for the module
const mockStorage: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
    },
  },
});

// Mock fetch for API calls
vi.stubGlobal('fetch', vi.fn());

// Import after mocking
import { matchPosts, mergeMatches, clearAIMatchCache } from '@/background/matcher';
import { DEFAULT_MATCHING_PREFERENCES } from '@shared/constants';

// Helper to create test posts
function createTestPost(overrides: Partial<ExtractedPostRecord> = {}): ExtractedPostRecord {
  return {
    id: `test-post-${Math.random().toString(36).substring(7)}`,
    platform: 'linkedin',
    url: 'https://linkedin.com/posts/test',
    authorName: 'Test Author',
    authorHeadline: 'Test Headline',
    content: 'Test content about technology and software development.',
    extractedAt: Date.now(),
    sourcePageUrl: 'https://linkedin.com/feed',
    ...overrides,
  };
}

describe('AI Matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    clearAIMatchCache();
  });

  describe('matchPosts (keyword matching)', () => {
    it('should match posts with relevant keywords', () => {
      const posts = [
        createTestPost({
          id: 'post-1',
          content: 'Great article about TypeScript and Vue.js development!',
        }),
        createTestPost({
          id: 'post-2',
          content: 'Just had coffee.',
        }),
      ];

      const keywords = ['typescript', 'vue.js', 'development'];
      const result = matchPosts(posts, keywords);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].post.id).toBe('post-1');
    });

    it('should filter posts below threshold', () => {
      const posts = [
        createTestPost({
          id: 'post-1',
          content: 'Completely unrelated content about cooking.',
        }),
      ];

      const keywords = ['technology', 'software', 'coding'];
      const result = matchPosts(posts, keywords, {
        ...DEFAULT_MATCHING_PREFERENCES,
        threshold: 0.3,
      });

      expect(result.matches.length).toBe(0);
    });

    it('should respect maxPosts limit', () => {
      const posts = Array.from({ length: 50 }, (_, i) =>
        createTestPost({
          id: `post-${i}`,
          content: `Post about technology and software number ${i}`,
        })
      );

      const keywords = ['technology', 'software'];
      const result = matchPosts(posts, keywords, {
        ...DEFAULT_MATCHING_PREFERENCES,
        maxPosts: 10,
      });

      expect(result.matches.length).toBeLessThanOrEqual(10);
    });

    it('should return empty matches for no keywords', () => {
      const posts = [createTestPost()];
      const result = matchPosts(posts, []);

      expect(result.matches.length).toBe(0);
    });

    it('should return empty matches for no posts', () => {
      const result = matchPosts([], ['technology']);

      expect(result.matches.length).toBe(0);
      expect(result.totalEvaluated).toBe(0);
    });

    it('should include processing time', () => {
      const posts = [createTestPost()];
      const result = matchPosts(posts, ['technology']);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mergeMatches', () => {
    it('should preserve status from existing matches', () => {
      const existing = [
        {
          post: createTestPost({ id: 'post-1' }),
          score: 0.5,
          matchedKeywords: ['tech'],
          matchReason: 'Matched keyword: "tech"',
          matchedAt: Date.now(),
          status: 'replied' as const,
          draftReply: 'My reply',
        },
      ];

      const newMatches = [
        {
          post: createTestPost({ id: 'post-1' }),
          score: 0.8,
          matchedKeywords: ['tech', 'software'],
          matchReason: 'AI matched',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged.length).toBe(1);
      expect(merged[0].status).toBe('replied');
      expect(merged[0].draftReply).toBe('My reply');
      expect(merged[0].score).toBe(0.8);
    });

    it('should add new matches not in existing', () => {
      const existing = [
        {
          post: createTestPost({ id: 'post-1' }),
          score: 0.5,
          matchedKeywords: [],
          matchReason: 'Matched',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
      ];

      const newMatches = [
        {
          post: createTestPost({ id: 'post-2' }),
          score: 0.7,
          matchedKeywords: [],
          matchReason: 'Matched',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged.some((m) => m.post.id === 'post-2')).toBe(true);
    });

    it('should keep non-pending existing matches', () => {
      const existing = [
        {
          post: createTestPost({ id: 'post-1' }),
          score: 0.5,
          matchedKeywords: [],
          matchReason: 'Matched',
          matchedAt: Date.now(),
          status: 'replied' as const,
        },
      ];

      const newMatches = [
        {
          post: createTestPost({ id: 'post-2' }),
          score: 0.7,
          matchedKeywords: [],
          matchReason: 'Matched',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged.some((m) => m.post.id === 'post-1')).toBe(true);
      expect(merged.some((m) => m.post.id === 'post-2')).toBe(true);
    });

    it('should respect maxPosts limit', () => {
      const existing = Array.from({ length: 50 }, (_, i) => ({
        post: createTestPost({ id: `existing-${i}` }),
        score: 0.5,
        matchedKeywords: [],
        matchReason: 'Matched',
        matchedAt: Date.now(),
        status: 'replied' as const,
      }));

      const newMatches = Array.from({ length: 50 }, (_, i) => ({
        post: createTestPost({ id: `new-${i}` }),
        score: 0.7,
        matchedKeywords: [],
        matchReason: 'Matched',
        matchedAt: Date.now(),
        status: 'pending' as const,
      }));

      const merged = mergeMatches(existing, newMatches, 20);

      expect(merged.length).toBeLessThanOrEqual(20);
    });

    it('should sort by score descending', () => {
      const existing: typeof newMatches = [];

      const newMatches = [
        {
          post: createTestPost({ id: 'post-1' }),
          score: 0.3,
          matchedKeywords: [],
          matchReason: 'Low score',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
        {
          post: createTestPost({ id: 'post-2' }),
          score: 0.9,
          matchedKeywords: [],
          matchReason: 'High score',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
        {
          post: createTestPost({ id: 'post-3' }),
          score: 0.6,
          matchedKeywords: [],
          matchReason: 'Medium score',
          matchedAt: Date.now(),
          status: 'pending' as const,
        },
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged[0].score).toBe(0.9);
      expect(merged[1].score).toBe(0.6);
      expect(merged[2].score).toBe(0.3);
    });
  });
});
