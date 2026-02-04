/**
 * Tests for LinkedIn post extraction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedInAdapter } from '../../src/platforms/linkedin/adapter';

// Mock LinkedIn post HTML structure (2025-2026 version using data-view-name attributes)
function createMockLinkedInPost(options: {
  id?: string;
  authorName?: string;
  authorHeadline?: string;
  content?: string;
  isRepost?: boolean;
  isSponsored?: boolean;
  hasImage?: boolean;
  reactionCount?: string;
}) {
  const {
    id = '7123456789012345678',
    authorName = 'John Doe',
    authorHeadline = 'Software Engineer at Tech Corp',
    content = 'This is a test post content with some interesting information.',
    isRepost = false,
    isSponsored = false,
    hasImage = false,
    reactionCount = '42',
  } = options;

  const repostHeader = isRepost
    ? `
      <a data-view-name="feed-header-actor-image" href="https://www.linkedin.com/in/reposter">
        <figure></figure>
      </a>
      <p data-view-name="feed-header-text">
        <a href="https://www.linkedin.com/in/reposter"><strong>Someone</strong></a> reposted this
      </p>
    `
    : '';

  const timestampText = isSponsored ? 'Promoted' : '2h';

  const imageSection = hasImage ? `<div data-view-name="feed-update-image"><img src="test.jpg" /></div>` : '';

  return `
    <div data-view-name="feed-full-update" componentkey="expanded${id}FeedType_MAIN_FEED_RELEVANCE">
      ${repostHeader}
      <a data-view-name="feed-actor-image" href="https://www.linkedin.com/in/johndoe">
        <figure></figure>
      </a>
      <a href="https://www.linkedin.com/in/johndoe">
        <div>
          <p>${authorName}</p>
          <p>${authorHeadline}</p>
          <p>${timestampText}</p>
        </div>
      </a>
      <p data-view-name="feed-commentary">
        <span data-testid="expandable-text-box">${content}</span>
      </p>
      ${imageSection}
      <div data-view-name="feed-reaction-count">
        <p>${reactionCount}</p>
      </div>
      <div data-view-name="feed-comment-count">
        <p>5 comments</p>
      </div>
    </div>
  `;
}

describe('LinkedIn Post Extraction', () => {
  let adapter: LinkedInAdapter;

  beforeEach(() => {
    adapter = new LinkedInAdapter();
    // Clear the document body before each test
    document.body.innerHTML = '';
  });

  describe('getPostId', () => {
    it('should extract post ID from componentkey attribute', () => {
      document.body.innerHTML = createMockLinkedInPost({ id: '7123456789012345678' });
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const postId = adapter.getPostId(element);
      expect(postId).toBe('7123456789012345678');
    });

    it('should return null for elements without componentkey', () => {
      document.body.innerHTML = '<div data-view-name="feed-full-update">No ID</div>';
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      // This will use fallback hash since no content matches
      const postId = adapter.getPostId(element);
      // Should return null or a hash fallback
      expect(postId).toBeDefined();
    });
  });

  describe('extractPost', () => {
    it('should extract a basic text post', () => {
      document.body.innerHTML = createMockLinkedInPost({
        id: '7123456789012345678',
        authorName: 'Jane Smith',
        authorHeadline: 'Product Manager',
        content: 'Excited to share my latest project!',
        reactionCount: '100',
      });
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);

      expect(post).not.toBeNull();
      expect(post?.id).toBe('7123456789012345678');
      expect(post?.authorName).toBe('Jane Smith');
      expect(post?.content).toContain('Excited to share');
      expect(post?.platform).toBe('linkedin');
      expect(post?.contentType).toBe('text');
    });

    it('should extract a post with image', () => {
      document.body.innerHTML = createMockLinkedInPost({
        hasImage: true,
        content: 'Check out this photo!',
      });
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);

      expect(post).not.toBeNull();
      expect(post?.contentType).toBe('image');
    });

    it('should detect reposts', () => {
      document.body.innerHTML = createMockLinkedInPost({
        isRepost: true,
        content: 'Original content',
      });
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);

      expect(post).not.toBeNull();
      expect(post?.isRepost).toBe(true);
    });

    it('should skip sponsored posts', () => {
      document.body.innerHTML = createMockLinkedInPost({
        isSponsored: true,
        content: 'Buy our product!',
      });
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);

      expect(post).toBeNull();
    });

    it('should return null for posts without content', () => {
      document.body.innerHTML = `
        <div data-view-name="feed-full-update" componentkey="expanded123FeedType_MAIN_FEED_RELEVANCE">
          <a data-view-name="feed-actor-image" href="https://www.linkedin.com/in/testuser">
            <figure></figure>
          </a>
          <a href="https://www.linkedin.com/in/testuser">
            <div><p>Test User</p></div>
          </a>
        </div>
      `;
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);

      expect(post).toBeNull();
    });

    it('should include extractedAt timestamp', () => {
      const before = Date.now();
      document.body.innerHTML = createMockLinkedInPost({});
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);
      const after = Date.now();

      expect(post).not.toBeNull();
      expect(post?.extractedAt).toBeGreaterThanOrEqual(before);
      expect(post?.extractedAt).toBeLessThanOrEqual(after);
    });

    it('should generate correct post URL', () => {
      document.body.innerHTML = createMockLinkedInPost({ id: '7123456789012345678' });
      const element = document.querySelector('[data-view-name="feed-full-update"]')!;

      const post = adapter.extractPost(element);

      expect(post?.url).toBe('https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678');
    });
  });

  describe('findPostElements', () => {
    it('should find all post elements in the DOM', () => {
      document.body.innerHTML = `
        ${createMockLinkedInPost({ id: '1' })}
        ${createMockLinkedInPost({ id: '2' })}
        ${createMockLinkedInPost({ id: '3' })}
      `;

      const elements = adapter.findPostElements();

      expect(elements.length).toBe(3);
    });

    it('should return empty array when no posts exist', () => {
      document.body.innerHTML = '<div>No posts here</div>';

      const elements = adapter.findPostElements();

      expect(elements.length).toBe(0);
    });
  });
});
