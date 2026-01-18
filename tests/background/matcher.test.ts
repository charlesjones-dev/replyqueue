import { describe, it, expect } from 'vitest';
import type { ExtractedPostRecord, MatchedPostWithScore, MatchingPreferences } from '@shared/types';
import {
  matchPosts,
  rescoreMatches,
  mergeMatches,
  filterMatchesByStatus,
  updateMatchStatus,
  getMatchStats,
} from '@/background/matcher';
import { DEFAULT_MATCHING_PREFERENCES } from '@shared/constants';

// Helper to create test posts
function createTestPost(overrides: Partial<ExtractedPostRecord> = {}): ExtractedPostRecord {
  return {
    id: 'test-post-1',
    platform: 'linkedin',
    url: 'https://linkedin.com/posts/test-1',
    authorName: 'John Doe',
    authorHeadline: 'Software Engineer',
    content: 'Default test content about technology and innovation.',
    extractedAt: Date.now(),
    sourcePageUrl: 'https://linkedin.com/feed',
    ...overrides,
  };
}

// Helper to create test matched post
function createTestMatch(overrides: Partial<MatchedPostWithScore> = {}): MatchedPostWithScore {
  return {
    post: createTestPost(),
    score: 0.5,
    matchedKeywords: ['technology'],
    matchReason: 'Matched keyword: "technology"',
    matchedAt: Date.now(),
    status: 'pending',
    ...overrides,
  };
}

describe('Matcher', () => {
  describe('matchPosts', () => {
    it('should match posts with relevant keywords', () => {
      const posts = [
        createTestPost({
          id: 'post-1',
          content: 'Great article about artificial intelligence and machine learning!',
        }),
        createTestPost({
          id: 'post-2',
          content: 'Just had a great lunch.',
        }),
      ];

      const keywords = ['artificial intelligence', 'machine learning', 'ai', 'technology'];
      const result = matchPosts(posts, keywords);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].post.id).toBe('post-1');
      expect(result.matches[0].matchedKeywords).toContain('artificial intelligence');
    });

    it('should filter posts below threshold', () => {
      const posts = [
        createTestPost({
          id: 'post-1',
          content: 'Completely unrelated content about cooking.',
          authorHeadline: 'Chef at Restaurant', // Override to avoid matching 'software'
        }),
      ];

      const keywords = ['technology', 'software', 'coding'];
      const preferences: MatchingPreferences = {
        ...DEFAULT_MATCHING_PREFERENCES,
        threshold: 0.3,
      };

      const result = matchPosts(posts, keywords, preferences);

      expect(result.matches.length).toBe(0);
    });

    it('should respect maxPosts limit', () => {
      const posts = Array.from({ length: 50 }, (_, i) =>
        createTestPost({
          id: `post-${i}`,
          content: `Post about technology and innovation number ${i}`,
        })
      );

      const keywords = ['technology', 'innovation'];
      const preferences: MatchingPreferences = {
        ...DEFAULT_MATCHING_PREFERENCES,
        maxPosts: 10,
      };

      const result = matchPosts(posts, keywords, preferences);

      expect(result.matches.length).toBeLessThanOrEqual(10);
    });

    it('should sort matches by score descending', () => {
      const posts = [
        createTestPost({
          id: 'post-1',
          content: 'technology',
        }),
        createTestPost({
          id: 'post-2',
          content: 'technology innovation software development coding programming',
        }),
      ];

      const keywords = ['technology', 'innovation', 'software', 'development', 'coding', 'programming'];
      const result = matchPosts(posts, keywords);

      if (result.matches.length >= 2) {
        expect(result.matches[0].score).toBeGreaterThanOrEqual(result.matches[1].score);
      }
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

    it('should generate meaningful match reasons', () => {
      const posts = [
        createTestPost({
          content: 'Article about technology and innovation in software.',
        }),
      ];

      const keywords = ['technology', 'innovation', 'software'];
      const result = matchPosts(posts, keywords);

      if (result.matches.length > 0) {
        expect(result.matches[0].matchReason).toContain('Matched');
        expect(result.matches[0].matchReason).toContain('keyword');
      }
    });
  });

  describe('rescoreMatches', () => {
    it('should update scores with new keywords', () => {
      const existingMatches = [
        createTestMatch({
          post: createTestPost({ content: 'Post about software development and coding' }),
          score: 0.5,
          matchedKeywords: ['software'],
        }),
      ];

      const newKeywords = ['software', 'development', 'coding', 'programming'];
      const result = rescoreMatches(existingMatches, newKeywords);

      expect(result.matches.length).toBeGreaterThan(0);
      // Score might change with new keywords
      expect(result.keywords).toEqual(newKeywords);
    });

    it('should preserve existing match metadata', () => {
      const existingMatches = [
        createTestMatch({
          status: 'replied',
          draftReply: 'My draft reply',
        }),
      ];

      const result = rescoreMatches(existingMatches, ['technology']);

      if (result.matches.length > 0) {
        expect(result.matches[0].status).toBe('replied');
        expect(result.matches[0].draftReply).toBe('My draft reply');
      }
    });
  });

  describe('mergeMatches', () => {
    it('should preserve status from existing matches', () => {
      const existing = [
        createTestMatch({
          post: createTestPost({ id: 'post-1' }),
          status: 'replied',
          draftReply: 'My reply',
        }),
      ];

      const newMatches = [
        createTestMatch({
          post: createTestPost({ id: 'post-1' }),
          status: 'pending',
          score: 0.8,
        }),
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged.length).toBe(1);
      expect(merged[0].status).toBe('replied');
      expect(merged[0].draftReply).toBe('My reply');
      expect(merged[0].score).toBe(0.8); // Score should be updated
    });

    it('should add new matches not in existing', () => {
      const existing = [
        createTestMatch({
          post: createTestPost({ id: 'post-1' }),
        }),
      ];

      const newMatches = [
        createTestMatch({
          post: createTestPost({ id: 'post-2' }),
        }),
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged.length).toBe(1); // Only new matches by default
      expect(merged.some((m) => m.post.id === 'post-2')).toBe(true);
    });

    it('should keep non-pending existing matches', () => {
      const existing = [
        createTestMatch({
          post: createTestPost({ id: 'post-1' }),
          status: 'replied',
        }),
      ];

      const newMatches = [
        createTestMatch({
          post: createTestPost({ id: 'post-2' }),
        }),
      ];

      const merged = mergeMatches(existing, newMatches);

      expect(merged.some((m) => m.post.id === 'post-1')).toBe(true);
      expect(merged.some((m) => m.post.id === 'post-2')).toBe(true);
    });

    it('should respect maxPosts limit', () => {
      const existing = Array.from({ length: 50 }, (_, i) =>
        createTestMatch({
          post: createTestPost({ id: `existing-${i}` }),
          status: 'replied',
        })
      );

      const newMatches = Array.from({ length: 50 }, (_, i) =>
        createTestMatch({
          post: createTestPost({ id: `new-${i}` }),
        })
      );

      const merged = mergeMatches(existing, newMatches, 20);

      expect(merged.length).toBeLessThanOrEqual(20);
    });
  });

  describe('filterMatchesByStatus', () => {
    it('should filter by pending status', () => {
      const matches = [
        createTestMatch({ status: 'pending' }),
        createTestMatch({ status: 'replied' }),
        createTestMatch({ status: 'replied' }),
      ];

      const pending = filterMatchesByStatus(matches, 'pending');

      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('pending');
    });

    it('should filter by replied status', () => {
      const matches = [
        createTestMatch({ status: 'pending' }),
        createTestMatch({ status: 'replied' }),
        createTestMatch({ status: 'skipped' }),
      ];

      const replied = filterMatchesByStatus(matches, 'replied');

      expect(replied.length).toBe(1);
      expect(replied[0].status).toBe('replied');
    });

    it('should return empty array when no matches', () => {
      const matches = [createTestMatch({ status: 'pending' })];

      const skipped = filterMatchesByStatus(matches, 'skipped');

      expect(skipped.length).toBe(0);
    });
  });

  describe('updateMatchStatus', () => {
    it('should update status of matching post', () => {
      const matches = [
        createTestMatch({
          post: createTestPost({ id: 'post-1', platform: 'linkedin' }),
          status: 'pending',
        }),
        createTestMatch({
          post: createTestPost({ id: 'post-2', platform: 'linkedin' }),
          status: 'pending',
        }),
      ];

      const updated = updateMatchStatus(matches, 'post-1', 'linkedin', 'replied');

      expect(updated[0].status).toBe('replied');
      expect(updated[1].status).toBe('pending');
    });

    it('should update draft reply when provided', () => {
      const matches = [
        createTestMatch({
          post: createTestPost({ id: 'post-1', platform: 'linkedin' }),
        }),
      ];

      const updated = updateMatchStatus(matches, 'post-1', 'linkedin', 'replied', 'My reply text');

      expect(updated[0].draftReply).toBe('My reply text');
    });

    it('should not modify non-matching posts', () => {
      const matches = [
        createTestMatch({
          post: createTestPost({ id: 'post-1', platform: 'linkedin' }),
          status: 'pending',
        }),
      ];

      const updated = updateMatchStatus(matches, 'post-2', 'linkedin', 'replied');

      expect(updated[0].status).toBe('pending');
    });
  });

  describe('getMatchStats', () => {
    it('should calculate correct statistics', () => {
      const matches = [
        createTestMatch({ status: 'pending', score: 0.8 }),
        createTestMatch({ status: 'pending', score: 0.6 }),
        createTestMatch({ status: 'replied', score: 0.7 }),
        createTestMatch({ status: 'replied', score: 0.5 }),
        createTestMatch({ status: 'skipped', score: 0.3 }),
      ];

      const stats = getMatchStats(matches);

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(2);
      expect(stats.replied).toBe(2);
      expect(stats.skipped).toBe(1);
      expect(stats.averageScore).toBeCloseTo(0.58, 1);
    });

    it('should handle empty matches', () => {
      const stats = getMatchStats([]);

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });
});
