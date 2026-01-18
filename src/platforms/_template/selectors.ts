/**
 * Platform Selectors Template
 *
 * This file serves as a template for implementing DOM selectors for new platforms.
 * Copy this file to a new platform directory (e.g., src/platforms/twitter/selectors.ts)
 * and update the selectors to match the target platform's DOM structure.
 *
 * IMPORTANT NOTES:
 * - Use data attributes when available (more stable than classes)
 * - Use ARIA roles and labels as fallbacks
 * - Combine multiple selectors with commas for resilience
 * - Document which elements each selector targets
 * - Include version/date comments for when selectors were last verified
 */

import type { FeedSelectors } from '../types'

/**
 * DOM selectors for [PLATFORM_NAME]
 * Last verified: [DATE]
 *
 * Replace [PLATFORM_NAME] with the actual platform name
 */
export const platformSelectors: FeedSelectors = {
  /**
   * Main feed container
   * The element that contains all feed posts
   * Example: main feed section, timeline container
   */
  feedContainer: '[TODO: selector for main feed container]',

  /**
   * Individual post items
   * Selector for each post/tweet/update in the feed
   * Should target the outermost container of each post
   */
  postItem: '[TODO: selector for individual posts]',

  /**
   * Author name
   * The display name of the post author
   * Multiple selectors can be comma-separated for fallback
   */
  authorName: '[TODO: selector for author name]',

  /**
   * Author headline/bio (optional)
   * Additional info about the author (job title, bio snippet, etc.)
   */
  authorHeadline: '[TODO: selector for author headline]',

  /**
   * Author profile link (optional)
   * Link to the author's profile page
   */
  authorProfileLink: '[TODO: selector for profile link]',

  /**
   * Post content
   * The main text content of the post
   * May need multiple selectors for different post types
   */
  postContent: '[TODO: selector for post content]',

  /**
   * Post timestamp (optional)
   * When the post was published
   * Prefer elements with datetime attributes
   */
  postTimestamp: '[TODO: selector for timestamp]',

  /**
   * Reaction/like count (optional)
   * Number of likes, hearts, reactions, etc.
   */
  reactionCount: '[TODO: selector for reaction count]',

  /**
   * Comment count (optional)
   * Number of comments/replies
   */
  commentCount: '[TODO: selector for comment count]',

  /**
   * Repost/share count (optional)
   * Number of reposts, retweets, shares
   */
  repostCount: '[TODO: selector for repost count]',

  /**
   * Repost indicator (optional)
   * Element that indicates this is a repost/share of another post
   */
  repostIndicator: '[TODO: selector for repost indicator]',

  /**
   * Article/link shares (optional)
   * Container for shared articles or external links
   */
  articleShare: '[TODO: selector for article shares]',

  /**
   * Post images (optional)
   * Container for images in the post
   */
  postImage: '[TODO: selector for images]',

  /**
   * Post link/permalink (optional)
   * Element containing or linked to the post's permanent URL
   */
  postLink: '[TODO: selector for post permalink]',
}

/**
 * Additional platform-specific selectors
 * Add any selectors not covered by the standard FeedSelectors interface
 */
export const platformExtraSelectors = {
  // Example: sponsored content indicator
  sponsoredIndicator: '[TODO: selector for sponsored content]',

  // Example: video content
  videoContent: '[TODO: selector for video content]',

  // Example: poll content
  pollContent: '[TODO: selector for polls]',

  // Add more platform-specific selectors as needed
}

/**
 * Data attributes used by the platform
 * Document any data-* attributes used for post identification
 */
export const platformDataAttributes = {
  // Example: post ID attribute
  postId: 'data-post-id',

  // Example: pattern to extract ID from attribute
  postIdPattern: /post-(\d+)/,

  // Add more data attribute patterns as needed
}

/**
 * URL patterns for the platform
 * Used to identify different page types
 */
export const platformUrlPatterns = {
  // Main feed page
  feed: /^https?:\/\/(www\.)?example\.com\/(feed|home|$)/i,

  // Individual post page
  post: /^https?:\/\/(www\.)?example\.com\/post\//i,

  // Profile page
  profile: /^https?:\/\/(www\.)?example\.com\/user\//i,

  // Post permalink format (for generating URLs)
  postPermalink: 'https://www.example.com/post/',
}
