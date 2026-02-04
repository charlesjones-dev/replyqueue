/**
 * LinkedIn platform adapter for ReplyQueue extension
 * Implements post extraction from LinkedIn's feed
 */

import type { PlatformAdapter, ExtractedPost, FeedSelectors } from '../types';
import { linkedInSelectors, linkedInExtraSelectors, linkedInDataAttributes, linkedInUrlPatterns } from './selectors';

const LOG_PREFIX = '[ReplyQueue:LinkedIn]';

/**
 * LinkedIn platform adapter implementation
 */
export class LinkedInAdapter implements PlatformAdapter {
  readonly platformId = 'linkedin';
  readonly platformName = 'LinkedIn';
  readonly selectors: FeedSelectors = linkedInSelectors;

  /**
   * Check if the current page is a LinkedIn feed page
   */
  isFeedPage(url: string): boolean {
    return linkedInUrlPatterns.feed.test(url);
  }

  /**
   * Find all post elements currently in the DOM
   */
  findPostElements(): Element[] {
    const elements = document.querySelectorAll(this.selectors.postItem);
    return Array.from(elements);
  }

  /**
   * Get the unique ID for a post element
   */
  getPostId(element: Element): string | null {
    // Try componentkey attribute first (new LinkedIn DOM structure)
    const componentKey = element.getAttribute(linkedInDataAttributes.componentKey);
    if (componentKey) {
      const expandedMatch = componentKey.match(linkedInDataAttributes.componentKeyPattern);
      if (expandedMatch) {
        return expandedMatch[1];
      }
      // Try simple pattern for non-expanded keys
      const simpleMatch = componentKey.match(linkedInDataAttributes.componentKeySimplePattern);
      if (simpleMatch) {
        return simpleMatch[1];
      }
    }

    // Check parent/ancestor elements for componentkey
    const parentWithKey = element.closest('[componentkey*="FeedType"]');
    if (parentWithKey) {
      const parentKey = parentWithKey.getAttribute('componentkey');
      if (parentKey) {
        const match = parentKey.match(linkedInDataAttributes.componentKeyPattern);
        if (match) {
          return match[1];
        }
      }
    }

    // Legacy: Try to get the data-urn attribute
    const urn = element.getAttribute(linkedInDataAttributes.postUrn);
    if (urn) {
      const activityMatch = urn.match(linkedInDataAttributes.activityUrnPattern);
      if (activityMatch) {
        return activityMatch[1];
      }
      const shareMatch = urn.match(linkedInDataAttributes.shareUrnPattern);
      if (shareMatch) {
        return shareMatch[1];
      }
    }

    // Legacy: Check parent elements for the URN
    const parent = element.closest('[data-urn]');
    if (parent) {
      const parentUrn = parent.getAttribute('data-urn');
      if (parentUrn) {
        const match =
          parentUrn.match(linkedInDataAttributes.activityUrnPattern) ||
          parentUrn.match(linkedInDataAttributes.shareUrnPattern);
        if (match) {
          return match[1];
        }
      }
    }

    // Fallback: generate a hash from the content
    const content = this.extractTextContent(element, this.selectors.postContent);
    if (content) {
      return this.hashString(content.substring(0, 100));
    }

    return null;
  }

  /**
   * Generate the permalink URL for a post
   */
  getPostUrl(postId: string): string {
    return `${linkedInUrlPatterns.postPermalink}urn:li:activity:${postId}`;
  }

  /**
   * Extract a post from a DOM element
   */
  extractPost(element: Element): ExtractedPost | null {
    try {
      const postId = this.getPostId(element);
      if (!postId) {
        console.debug(`${LOG_PREFIX} Could not extract post ID from element`);
        return null;
      }

      // Check if this is a sponsored post and skip it
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

  /**
   * Extract text content from an element using a selector
   */
  private extractTextContent(container: Element, selector: string): string | undefined {
    // Try each selector in the comma-separated list
    const selectors = selector.split(',').map((s) => s.trim());

    for (const sel of selectors) {
      const element = container.querySelector(sel);
      if (element) {
        const text = element.textContent?.trim();
        if (text) {
          return text;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract the author's name from a post element
   */
  private extractAuthorName(container: Element): string | undefined {
    // New structure: look for the actor link and find the name in nearby elements
    const actorImage = container.querySelector('[data-view-name="feed-actor-image"]');
    if (actorImage) {
      // The name is typically in a sibling anchor element's first paragraph
      const nextAnchor = actorImage.nextElementSibling;
      if (nextAnchor?.tagName === 'A') {
        const namePara = nextAnchor.querySelector('p');
        if (namePara) {
          const text = namePara.textContent?.trim();
          if (text && !text.includes('followers')) {
            return text.replace(/\s+/g, ' ').split('\n')[0].trim();
          }
        }
      }
    }

    // Try original selectors as fallback
    const selectors = this.selectors.authorName.split(',').map((s) => s.trim());

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element) {
        // Handle visually-hidden elements that contain the full name
        const text = element.textContent?.trim();
        if (text && !text.includes('View') && !text.includes('profile')) {
          // Clean up the name - remove extra whitespace and newlines
          return text.replace(/\s+/g, ' ').split('\n')[0].trim();
        }
      }
    }
    return undefined;
  }

  /**
   * Extract the author's headline/description
   */
  private extractAuthorHeadline(container: Element): string | undefined {
    // New structure: look for the actor link and find headline in nearby elements
    const actorImage = container.querySelector('[data-view-name="feed-actor-image"]');
    if (actorImage) {
      const nextAnchor = actorImage.nextElementSibling;
      if (nextAnchor?.tagName === 'A') {
        const paragraphs = nextAnchor.querySelectorAll('p');
        // Second paragraph is typically the headline/followers
        if (paragraphs.length >= 2) {
          const text = paragraphs[1].textContent?.trim();
          if (text) {
            return text.split('\n')[0].trim();
          }
        }
      }
    }

    // Fallback to original selectors
    if (!this.selectors.authorHeadline) return undefined;
    const text = this.extractTextContent(container, this.selectors.authorHeadline);
    if (text) {
      // Clean up and return just the first line/part
      return text.split('\n')[0].split('  ')[0].trim();
    }
    return undefined;
  }

  /**
   * Extract the author's profile URL
   */
  private extractAuthorProfileUrl(container: Element): string | undefined {
    // New structure: look for the actor image link
    const actorImage = container.querySelector('[data-view-name="feed-actor-image"]') as HTMLAnchorElement | null;
    if (actorImage?.href) {
      const href = actorImage.href;
      if (href.includes('/in/') || href.includes('/company/')) {
        return href.split('?')[0]; // Remove query params
      }
    }

    // Fallback to original selectors
    if (!this.selectors.authorProfileLink) return undefined;

    const selectors = this.selectors.authorProfileLink.split(',').map((s) => s.trim());

    for (const selector of selectors) {
      const link = container.querySelector(selector) as HTMLAnchorElement | null;
      if (link?.href && (link.href.includes('/in/') || link.href.includes('/company/'))) {
        return link.href.split('?')[0]; // Remove query params
      }
    }
    return undefined;
  }

  /**
   * Extract the main post content
   */
  private extractPostContent(container: Element): string | undefined {
    const selectors = this.selectors.postContent.split(',').map((s) => s.trim());

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element) {
        // Get all text content, preserving some structure
        const text = this.getCleanTextContent(element);
        if (text && text.length > 10) {
          return text;
        }
      }
    }
    return undefined;
  }

  /**
   * Get clean text content from an element, handling LinkedIn's complex DOM
   */
  private getCleanTextContent(element: Element): string {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as Element;

    // Remove hidden elements (new structure uses class patterns for visually-hidden)
    clone.querySelectorAll('.visually-hidden, [aria-hidden="true"], ._7e570f38').forEach((el) => {
      // Keep aria-hidden spans that contain the actual visible text
      const parent = el.closest('[data-testid="expandable-text-box"]');
      if (!parent) {
        el.remove();
      }
    });

    // Remove "see more" buttons (new structure)
    clone.querySelectorAll('[data-testid="expandable-text-button"]').forEach((el) => el.remove());
    // Legacy "see more" buttons
    clone.querySelectorAll('.feed-shared-inline-show-more-text__see-more-less-toggle').forEach((el) => el.remove());

    let text = clone.textContent || '';

    // Clean up whitespace while preserving newlines
    text = text
      .replace(/[^\S\n]+/g, ' ') // Collapse horizontal whitespace only
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .replace(/^\s+|\s+$/gm, '') // Trim each line
      .trim();

    // Remove common LinkedIn UI text
    text = text.replace(/\s*(see more|see less|…more|… more)\s*/gi, '').trim();

    return text;
  }

  /**
   * Extract the post timestamp
   */
  private extractTimestamp(container: Element): string | undefined {
    if (!this.selectors.postTimestamp) return undefined;

    const selectors = this.selectors.postTimestamp.split(',').map((s) => s.trim());

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element) {
        // Check for datetime attribute first
        const datetime = element.getAttribute('datetime');
        if (datetime) {
          return datetime;
        }
        // Otherwise return the text content (relative time like "2h")
        return element.textContent?.trim();
      }
    }
    return undefined;
  }

  /**
   * Extract engagement count from a selector
   */
  private extractEngagementCount(container: Element, selector?: string): number | undefined {
    if (!selector) return undefined;

    const selectors = selector.split(',').map((s) => s.trim());

    for (const sel of selectors) {
      const element = container.querySelector(sel);
      if (element) {
        const text = element.textContent?.trim() || '';
        const count = this.parseCount(text);
        if (count !== undefined) {
          return count;
        }
      }
    }
    return undefined;
  }

  /**
   * Parse a count string (e.g., "1.2K", "500", "1,234") to a number
   */
  private parseCount(text: string): number | undefined {
    if (!text) return undefined;

    // Extract the numeric part
    const match = text.match(/[\d,.]+\s*[kKmM]?/);
    if (!match) return undefined;

    let numStr = match[0].replace(/,/g, '').trim();
    let multiplier = 1;

    if (numStr.toLowerCase().endsWith('k')) {
      multiplier = 1000;
      numStr = numStr.slice(0, -1);
    } else if (numStr.toLowerCase().endsWith('m')) {
      multiplier = 1000000;
      numStr = numStr.slice(0, -1);
    }

    const num = parseFloat(numStr);
    return isNaN(num) ? undefined : Math.round(num * multiplier);
  }

  /**
   * Check if the post is a repost
   */
  private isRepost(container: Element): boolean {
    // New structure: check for repost header
    const headerText = container.querySelector('[data-view-name="feed-header-text"]');
    if (headerText) {
      const text = headerText.textContent?.toLowerCase() || '';
      if (text.includes('repost')) {
        return true;
      }
    }

    // Also check for the header actor image (indicates someone shared/reposted)
    const headerActor = container.querySelector('[data-view-name="feed-header-actor-image"]');
    if (headerActor) {
      return true;
    }

    // Legacy: check repost indicator selector
    if (this.selectors.repostIndicator) {
      const indicator = container.querySelector(this.selectors.repostIndicator);
      if (indicator) {
        const text = indicator.textContent?.toLowerCase() || '';
        if (text.includes('repost')) {
          return true;
        }
      }
    }

    // Legacy: check for reshare URN
    const urn = container.getAttribute('data-urn') || '';
    return urn.includes('reshare');
  }

  /**
   * Check if the post is sponsored
   */
  private isSponsored(container: Element): boolean {
    // New structure: check for sponsored indicator
    const indicator = container.querySelector(linkedInExtraSelectors.sponsoredIndicator);
    if (indicator) return true;

    // Check for "Promoted" or "Sponsored" text in the actor area
    const actorImage = container.querySelector('[data-view-name="feed-actor-image"]');
    if (actorImage) {
      const nextAnchor = actorImage.nextElementSibling;
      if (nextAnchor) {
        const text = nextAnchor.textContent?.toLowerCase() || '';
        if (text.includes('promoted') || text.includes('sponsored')) {
          return true;
        }
      }
    }

    // Legacy: check for "Promoted" or "Sponsored" text
    const actorDescription = container.querySelector('.update-components-actor__sub-description');
    if (actorDescription) {
      const text = actorDescription.textContent?.toLowerCase() || '';
      return text.includes('promoted') || text.includes('sponsored');
    }

    return false;
  }

  /**
   * Extract the original post info from a repost
   */
  private extractOriginalPost(container: Element): ExtractedPost['originalPost'] {
    const originalName = this.extractTextContent(container, linkedInExtraSelectors.originalPoster);
    const originalContent = this.extractTextContent(container, linkedInExtraSelectors.originalContent);

    if (originalName || originalContent) {
      return {
        authorName: originalName || 'Unknown',
        content: originalContent,
      };
    }
    return undefined;
  }

  /**
   * Detect the type of content in the post
   */
  private detectContentType(container: Element): ExtractedPost['contentType'] {
    if (container.querySelector(linkedInExtraSelectors.pollContent)) {
      return 'poll';
    }
    if (container.querySelector(linkedInExtraSelectors.videoContent)) {
      return 'video';
    }
    if (container.querySelector(linkedInExtraSelectors.documentShare)) {
      return 'document';
    }
    if (container.querySelector(this.selectors.articleShare || '')) {
      return 'article';
    }
    if (container.querySelector(this.selectors.postImage || '')) {
      return 'image';
    }
    return 'text';
  }

  /**
   * Simple hash function for generating fallback IDs
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
