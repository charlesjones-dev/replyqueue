/**
 * Platform Adapter Template
 *
 * This file serves as a template for implementing platform adapters.
 * Copy this entire directory to a new platform directory
 * (e.g., src/platforms/twitter/) and implement the adapter.
 *
 * Steps to add a new platform:
 * 1. Copy _template/ to a new directory (e.g., twitter/)
 * 2. Update selectors.ts with platform-specific DOM selectors
 * 3. Implement all methods in this adapter class
 * 4. Register the platform in src/platforms/index.ts
 * 5. Update manifest.json with the new platform's URL patterns
 * 6. Add tests for the new adapter
 * 7. Add the platform's domain to ALLOWED_CONTENT_SCRIPT_ORIGINS in src/background/index.ts
 */

import type { PlatformAdapter, ExtractedPost, FeedSelectors } from '../types';
import { platformSelectors, platformExtraSelectors, platformDataAttributes, platformUrlPatterns } from './selectors';

// Prefix for console logging
const LOG_PREFIX = '[ReplyQueue:PLATFORM_NAME]';

/**
 * Platform adapter implementation
 *
 * Replace PLATFORM_NAME with the actual platform name in:
 * - Class name
 * - platformId
 * - platformName
 * - LOG_PREFIX
 */
export class PlatformNameAdapter implements PlatformAdapter {
  readonly platformId = 'platform_name'; // lowercase, no spaces
  readonly platformName = 'Platform Name'; // Human-readable name
  readonly selectors: FeedSelectors = platformSelectors;

  /**
   * Check if the current page is a feed page that should be monitored
   *
   * Implementation notes:
   * - Return true only for pages where posts should be extracted
   * - Consider: main feed, profile feeds, hashtag feeds, etc.
   * - Exclude: settings pages, messages, notifications, etc.
   */
  isFeedPage(url: string): boolean {
    return platformUrlPatterns.feed.test(url);
  }

  /**
   * Find all post elements currently in the DOM
   *
   * Implementation notes:
   * - Use the postItem selector from selectors.ts
   * - Filter out any non-post elements that might match
   * - Return an array, even if empty
   */
  findPostElements(): Element[] {
    const elements = document.querySelectorAll(this.selectors.postItem);
    return Array.from(elements);
  }

  /**
   * Get the unique ID for a post element
   *
   * Implementation notes:
   * - Extract the platform's native post ID if available
   * - Check data attributes first (most reliable)
   * - Fall back to URL parsing or content hashing if needed
   * - Return null if ID cannot be determined
   */
  getPostId(element: Element): string | null {
    // Try to get the post ID from data attribute
    const postId = element.getAttribute(platformDataAttributes.postId);
    if (postId) {
      const match = postId.match(platformDataAttributes.postIdPattern);
      if (match) {
        return match[1];
      }
    }

    // TODO: Implement fallback ID extraction

    return null;
  }

  /**
   * Generate the permalink URL for a post
   *
   * Implementation notes:
   * - Use the platform's standard permalink format
   * - Include any required path components
   */
  getPostUrl(postId: string): string {
    return `${platformUrlPatterns.postPermalink}${postId}`;
  }

  /**
   * Scroll the page to a specific post
   *
   * Implementation notes:
   * - Find the post element by its ID
   * - Use smooth scrolling for better UX
   * - Center the post in the viewport if possible
   * @returns true if post was found and scrolled to, false otherwise
   */
  scrollToPost(postId: string): boolean {
    const postElement = document.querySelector(`[${platformDataAttributes.postId}*="${postId}"]`);
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    } else {
      console.warn(`${LOG_PREFIX} Could not find post with ID: ${postId}`);
      return false;
    }
  }

  /**
   * Extract a post from a DOM element
   *
   * Implementation notes:
   * - Extract all available metadata from the post
   * - Handle different post types (text, image, video, etc.)
   * - Skip sponsored/promoted content
   * - Return null if essential data cannot be extracted
   */
  extractPost(element: Element): ExtractedPost | null {
    try {
      const postId = this.getPostId(element);
      if (!postId) {
        console.debug(`${LOG_PREFIX} Could not extract post ID from element`);
        return null;
      }

      // Skip sponsored content
      if (this.isSponsored(element)) {
        console.debug(`${LOG_PREFIX} Skipping sponsored post: ${postId}`);
        return null;
      }

      const authorName = this.extractAuthorName(element);
      if (!authorName) {
        console.debug(`${LOG_PREFIX} Could not extract author name for post: ${postId}`);
        return null;
      }

      const content = this.extractPostContent(element);
      if (!content) {
        console.debug(`${LOG_PREFIX} Could not extract content for post: ${postId}`);
        return null;
      }

      const isRepost = this.isRepost(element);

      const post: ExtractedPost = {
        id: postId,
        url: this.getPostUrl(postId),
        authorName,
        authorHeadline: this.extractAuthorHeadline(element),
        authorProfileUrl: this.extractAuthorProfileUrl(element),
        content,
        publishedAt: this.extractTimestamp(element),
        reactionCount: this.extractEngagementCount(element, this.selectors.reactionCount),
        commentCount: this.extractEngagementCount(element, this.selectors.commentCount),
        repostCount: this.extractEngagementCount(element, this.selectors.repostCount),
        isRepost,
        originalPost: isRepost ? this.extractOriginalPost(element) : undefined,
        contentType: this.detectContentType(element),
        platform: this.platformId,
        extractedAt: Date.now(),
      };

      console.debug(`${LOG_PREFIX} Extracted post:`, post.id, post.authorName);
      return post;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error extracting post:`, error);
      return null;
    }
  }

  // ============================================================
  // Private helper methods - Implement these for your platform
  // ============================================================

  /**
   * Extract the author's display name
   */
  private extractAuthorName(container: Element): string | undefined {
    // TODO: Implement author name extraction
    const element = container.querySelector(this.selectors.authorName);
    return element?.textContent?.trim();
  }

  /**
   * Extract the author's headline/bio
   */
  private extractAuthorHeadline(container: Element): string | undefined {
    if (!this.selectors.authorHeadline) return undefined;
    const element = container.querySelector(this.selectors.authorHeadline);
    return element?.textContent?.trim();
  }

  /**
   * Extract the author's profile URL
   */
  private extractAuthorProfileUrl(container: Element): string | undefined {
    if (!this.selectors.authorProfileLink) return undefined;
    const link = container.querySelector(this.selectors.authorProfileLink) as HTMLAnchorElement;
    return link?.href;
  }

  /**
   * Extract the main post content
   */
  private extractPostContent(container: Element): string | undefined {
    const element = container.querySelector(this.selectors.postContent);
    return element?.textContent?.trim();
  }

  /**
   * Extract the post timestamp
   */
  private extractTimestamp(container: Element): string | undefined {
    if (!this.selectors.postTimestamp) return undefined;
    const element = container.querySelector(this.selectors.postTimestamp);
    // Prefer datetime attribute over text content
    return element?.getAttribute('datetime') || element?.textContent?.trim();
  }

  /**
   * Extract engagement count from a selector
   */
  private extractEngagementCount(container: Element, selector?: string): number | undefined {
    if (!selector) return undefined;
    const element = container.querySelector(selector);
    const text = element?.textContent?.trim();
    if (!text) return undefined;

    // Parse count (handle K, M suffixes if needed)
    const num = parseFloat(text.replace(/,/g, ''));
    return isNaN(num) ? undefined : num;
  }

  /**
   * Check if the post is a repost/share
   */
  private isRepost(container: Element): boolean {
    if (!this.selectors.repostIndicator) return false;
    return !!container.querySelector(this.selectors.repostIndicator);
  }

  /**
   * Check if the post is sponsored/promoted
   */
  private isSponsored(container: Element): boolean {
    return !!container.querySelector(platformExtraSelectors.sponsoredIndicator);
  }

  /**
   * Extract original post info from a repost
   */
  private extractOriginalPost(_container: Element): ExtractedPost['originalPost'] {
    // TODO: Implement original post extraction for reposts
    return undefined;
  }

  /**
   * Detect the type of content in the post
   */
  private detectContentType(container: Element): ExtractedPost['contentType'] {
    if (container.querySelector(platformExtraSelectors.pollContent)) {
      return 'poll';
    }
    if (container.querySelector(platformExtraSelectors.videoContent)) {
      return 'video';
    }
    if (container.querySelector(this.selectors.articleShare || '')) {
      return 'article';
    }
    if (container.querySelector(this.selectors.postImage || '')) {
      return 'image';
    }
    return 'text';
  }
}
