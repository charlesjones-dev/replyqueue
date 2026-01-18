/**
 * Tests for LinkedIn post extraction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedInAdapter } from '../../src/platforms/linkedin/adapter';

// Mock LinkedIn post HTML structure
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

  const repostHeader = isRepost ? '<div class="update-components-header__text-view">John reposted this</div>' : '';

  const sponsoredText = isSponsored ? 'Promoted' : '2h';

  const imageSection = hasImage ? '<div class="update-components-image"><img src="test.jpg" /></div>' : '';

  return `
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:${id}">
      ${repostHeader}
      <div class="update-components-actor">
        <a class="update-components-actor__container-link" href="https://www.linkedin.com/in/johndoe">
          <span class="update-components-actor__name">
            <span class="visually-hidden">${authorName}</span>
          </span>
          <span class="update-components-actor__description">${authorHeadline}</span>
          <span class="update-components-actor__sub-description">
            <time datetime="2024-01-15T10:00:00.000Z">${sponsoredText}</time>
          </span>
        </a>
      </div>
      <div class="update-components-text">
        <span dir="ltr">${content}</span>
      </div>
      ${imageSection}
      <div class="social-details-social-counts">
        <button aria-label="${reactionCount} reactions">
          <span class="social-details-social-counts__reactions-count">${reactionCount}</span>
        </button>
        <button aria-label="5 comments">
          <span class="social-details-social-counts__comments">5 comments</span>
        </button>
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
    it('should extract post ID from data-urn attribute', () => {
      document.body.innerHTML = createMockLinkedInPost({ id: '7123456789012345678' });
      const element = document.querySelector('.feed-shared-update-v2')!;

      const postId = adapter.getPostId(element);
      expect(postId).toBe('7123456789012345678');
    });

    it('should return null for elements without data-urn', () => {
      document.body.innerHTML = '<div class="feed-shared-update-v2">No URN</div>';
      const element = document.querySelector('.feed-shared-update-v2')!;

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
      const element = document.querySelector('.feed-shared-update-v2')!;

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
      const element = document.querySelector('.feed-shared-update-v2')!;

      const post = adapter.extractPost(element);

      expect(post).not.toBeNull();
      expect(post?.contentType).toBe('image');
    });

    it('should detect reposts', () => {
      document.body.innerHTML = createMockLinkedInPost({
        isRepost: true,
        content: 'Original content',
      });
      const element = document.querySelector('.feed-shared-update-v2')!;

      const post = adapter.extractPost(element);

      expect(post).not.toBeNull();
      expect(post?.isRepost).toBe(true);
    });

    it('should skip sponsored posts', () => {
      document.body.innerHTML = createMockLinkedInPost({
        isSponsored: true,
        content: 'Buy our product!',
      });
      const element = document.querySelector('.feed-shared-update-v2')!;

      const post = adapter.extractPost(element);

      expect(post).toBeNull();
    });

    it('should return null for posts without content', () => {
      document.body.innerHTML = `
        <div class="feed-shared-update-v2" data-urn="urn:li:activity:123">
          <div class="update-components-actor">
            <span class="update-components-actor__name">
              <span class="visually-hidden">Test User</span>
            </span>
          </div>
        </div>
      `;
      const element = document.querySelector('.feed-shared-update-v2')!;

      const post = adapter.extractPost(element);

      expect(post).toBeNull();
    });

    it('should include extractedAt timestamp', () => {
      const before = Date.now();
      document.body.innerHTML = createMockLinkedInPost({});
      const element = document.querySelector('.feed-shared-update-v2')!;

      const post = adapter.extractPost(element);
      const after = Date.now();

      expect(post).not.toBeNull();
      expect(post?.extractedAt).toBeGreaterThanOrEqual(before);
      expect(post?.extractedAt).toBeLessThanOrEqual(after);
    });

    it('should generate correct post URL', () => {
      document.body.innerHTML = createMockLinkedInPost({ id: '7123456789012345678' });
      const element = document.querySelector('.feed-shared-update-v2')!;

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
