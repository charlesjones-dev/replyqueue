/**
 * LinkedIn DOM selectors for post extraction
 * These selectors target LinkedIn's feed structure as of 2025-2026
 * Note: LinkedIn frequently changes their DOM structure, so these may need updates
 *
 * As of Feb 2026, LinkedIn uses CSS-in-JS with hashed class names.
 * We rely on data-view-name, data-testid, and structural patterns instead of class names.
 */

import type { FeedSelectors } from '../types';

/**
 * LinkedIn-specific DOM selectors
 * Uses data-view-name, data-testid, and ARIA attributes
 * which are more stable than hashed CSS class names
 */
export const linkedInSelectors: FeedSelectors = {
  // Main feed container
  feedContainer: '[data-testid="mainFeed"]',

  // Individual post items - uses data-view-name for post identification
  // Each post has data-view-name="feed-full-update" or role="listitem" with componentkey
  postItem: '[data-view-name="feed-full-update"]',

  // Author information
  // The author name is in a link with data-view-name="feed-actor-image" (company)
  // or nearby text elements. For personal posts, look in sibling elements.
  authorName:
    '[data-view-name="feed-actor-image"] + a p:first-of-type, [data-view-name="feed-actor-image"] ~ div p:first-of-type',

  // Author headline - second paragraph in the actor info section
  authorHeadline:
    '[data-view-name="feed-actor-image"] + a p:nth-of-type(2), [data-view-name="feed-actor-image"] ~ div p:nth-of-type(2)',

  // Author profile link - links containing /in/ or /company/
  authorProfileLink:
    '[data-view-name="feed-actor-image"][href*="/in/"], [data-view-name="feed-actor-image"][href*="/company/"], a[href*="/in/"][data-view-name="feed-actor-image"]',

  // Post content - expandable text box or feed commentary
  postContent: '[data-testid="expandable-text-box"], [data-view-name="feed-commentary"]',

  // Timestamp - third info line in actor section (contains time like "24m")
  postTimestamp:
    '[data-view-name="feed-actor-image"] + a p:nth-of-type(3), [data-view-name="feed-actor-image"] ~ div p:nth-of-type(3)',

  // Engagement metrics
  reactionCount: '[data-view-name="feed-reaction-count"]',

  commentCount: '[data-view-name="feed-comment-count"]',

  repostCount: '[data-view-name="feed-repost-count"]',

  // Repost detection - header text for reposts
  repostIndicator: '[data-view-name="feed-header-text"]',

  // Article shares
  articleShare: '[data-view-name="feed-update-article"]',

  // Images in posts
  postImage: '[data-view-name="feed-update-image"]',

  // Post link/actions - control menu button
  postLink: '[data-view-name="feed-control-menu"]',
};

/**
 * Additional LinkedIn-specific selectors for edge cases
 */
export const linkedInExtraSelectors = {
  // Poll content
  pollContent: '[data-view-name="feed-update-poll"]',

  // Document/PDF shares
  documentShare: '[data-view-name="feed-update-document"]',

  // Video content
  videoContent: '[data-view-name="feed-update-video"], .vjs-poster',

  // Celebration/event posts
  celebrationPost: '[data-view-name="feed-update-celebration"]',

  // Sponsored content indicator - look for "Promoted" text
  sponsoredIndicator: '[data-view-name="feed-actor-sponsored"]',

  // Original poster in repost - the actor info inside a reposted post
  originalPoster: '[data-view-name="feed-actor-image"] + a p:first-of-type',

  // Original content in repost
  originalContent: '[data-testid="expandable-text-box"]',

  // Comment button for interaction
  commentButton: 'button[aria-label*="Comment"]',

  // Share button
  shareButton: 'button[aria-label*="Share"], button[aria-label*="Repost"]',

  // Like button
  likeButton: 'button[aria-label*="Like"]',

  // Repost header (who reposted)
  repostHeader: '[data-view-name="feed-header-actor-image"]',

  // Repost header text
  repostHeaderText: '[data-view-name="feed-header-text"]',
};

/**
 * Data attribute patterns for extracting post IDs
 */
export const linkedInDataAttributes = {
  // Primary post ID attribute - LinkedIn now uses componentkey
  postUrn: 'data-urn', // Legacy, may not exist
  componentKey: 'componentkey',

  // Activity URN pattern (urn:li:activity:1234567890) - legacy
  activityUrnPattern: /urn:li:activity:(\d+)/,

  // Share URN pattern (urn:li:share:1234567890) - legacy
  shareUrnPattern: /urn:li:share:(\d+)/,

  // Profile URN pattern - legacy
  profileUrnPattern: /urn:li:fs_miniProfile:([A-Za-z0-9_-]+)/,

  // Component key pattern for post IDs (e.g., "expandedABC123FeedType_MAIN_FEED_RELEVANCE")
  // The ID is the part between "expanded" and "FeedType"
  componentKeyPattern: /^expanded(.+?)FeedType/,

  // Alternative component key pattern (just the ID without expanded prefix)
  componentKeySimplePattern: /^([A-Za-z0-9_-]+)$/,
};

/**
 * URL patterns for LinkedIn
 */
export const linkedInUrlPatterns = {
  // Feed page patterns
  feed: /^https?:\/\/(www\.)?linkedin\.com\/(feed|$)/i,

  // Individual post page
  post: /^https?:\/\/(www\.)?linkedin\.com\/posts\//i,

  // Profile page
  profile: /^https?:\/\/(www\.)?linkedin\.com\/in\//i,

  // Company page
  company: /^https?:\/\/(www\.)?linkedin\.com\/company\//i,

  // Post permalink format
  postPermalink: 'https://www.linkedin.com/feed/update/',
};
