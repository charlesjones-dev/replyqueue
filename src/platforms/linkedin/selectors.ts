/**
 * LinkedIn DOM selectors for post extraction
 * These selectors target LinkedIn's feed structure as of 2024-2025
 * Note: LinkedIn frequently changes their DOM structure, so these may need updates
 */

import type { FeedSelectors } from '../types'

/**
 * LinkedIn-specific DOM selectors
 * Uses a combination of data attributes, semantic classes, and ARIA roles
 * to be more resilient to LinkedIn's frequent DOM changes
 */
export const linkedInSelectors: FeedSelectors = {
  // Main feed container
  feedContainer: 'main.scaffold-layout__main',

  // Individual post items - LinkedIn uses data-urn for post identification
  // The feed-shared-update-v2 class is the main post container
  postItem: '[data-urn*="urn:li:activity:"], .feed-shared-update-v2',

  // Author information
  // LinkedIn uses update-components-actor for author info section
  authorName: '.update-components-actor__name .visually-hidden, .update-components-actor__title .visually-hidden, .update-components-actor__name span[aria-hidden="true"], .update-components-actor__title span[dir="ltr"]',

  authorHeadline: '.update-components-actor__description, .update-components-actor__subtitle, .update-components-actor__sub-description',

  authorProfileLink: '.update-components-actor__container-link, .update-components-actor__image a, .update-components-actor a[href*="/in/"]',

  // Post content - LinkedIn wraps content in different ways
  postContent: '.update-components-text, .feed-shared-update-v2__description, .feed-shared-text, .feed-shared-inline-show-more-text, .break-words',

  // Timestamp - LinkedIn shows relative time
  postTimestamp: '.update-components-actor__sub-description time, .feed-shared-actor__sub-description time, time.visually-hidden',

  // Engagement metrics - social counts are in social-details-social-counts
  reactionCount: '.social-details-social-counts__reactions-count, .social-details-social-counts__count-value, button[aria-label*="reaction"] span',

  commentCount: '.social-details-social-counts__comments, button[aria-label*="comment"] span.social-details-social-counts__count-value',

  repostCount: '.social-details-social-counts__item--repost, button[aria-label*="repost"] span',

  // Repost detection - Look for "reposted" text or repost header
  repostIndicator: '.update-components-header__text-view, .feed-shared-header, [data-urn*="reshare"]',

  // Article shares - when someone shares a link/article
  articleShare: '.update-components-article, .feed-shared-article, .update-components-mini-update-v2',

  // Images in posts
  postImage: '.update-components-image, .feed-shared-image, .feed-shared-carousel',

  // Post link/actions - for getting permalink
  postLink: '.feed-shared-control-menu, .update-components-update-v2__control-menu, button[aria-label*="Open control menu"]',
}

/**
 * Additional LinkedIn-specific selectors for edge cases
 */
export const linkedInExtraSelectors = {
  // Poll content
  pollContent: '.feed-shared-poll, .update-components-poll',

  // Document/PDF shares
  documentShare: '.feed-shared-document, .update-components-document',

  // Video content
  videoContent: '.feed-shared-linkedin-video, .update-components-video',

  // Celebration/event posts
  celebrationPost: '.feed-shared-celebration, .update-components-celebration',

  // Sponsored content indicator
  sponsoredIndicator: '.feed-shared-actor__sub-description--sponsored, .update-components-actor__sponsored',

  // Original poster in repost
  originalPoster: '.update-components-mini-update-v2 .update-components-actor__name, .feed-shared-update-v2__reshare .update-components-actor__name',

  // Original content in repost
  originalContent: '.update-components-mini-update-v2 .update-components-text, .feed-shared-update-v2__reshare .update-components-text',

  // Comment button for interaction
  commentButton: 'button[aria-label*="Comment"], .comment-button, .social-actions-button[data-control-name="comment"]',

  // Share button
  shareButton: 'button[aria-label*="Share"], button[aria-label*="Repost"]',

  // Like button
  likeButton: 'button[aria-label*="Like"], .react-button, .social-actions-button[data-control-name="react"]',
}

/**
 * Data attribute patterns for extracting post IDs
 */
export const linkedInDataAttributes = {
  // Primary post ID attribute
  postUrn: 'data-urn',

  // Activity URN pattern (urn:li:activity:1234567890)
  activityUrnPattern: /urn:li:activity:(\d+)/,

  // Share URN pattern (urn:li:share:1234567890)
  shareUrnPattern: /urn:li:share:(\d+)/,

  // Profile URN pattern
  profileUrnPattern: /urn:li:fs_miniProfile:([A-Za-z0-9_-]+)/,
}

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
}
