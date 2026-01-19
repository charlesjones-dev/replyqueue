/**
 * Platform adapter interface and types for ReplyQueue extension
 * Defines the contract for extracting posts from different social platforms
 */

/**
 * Represents a social media post extracted from the DOM
 * Extends the base Post type with platform-specific metadata
 */
export interface ExtractedPost {
  /** Unique identifier for the post (platform-specific) */
  id: string;
  /** URL to the original post */
  url: string;
  /** Author's display name */
  authorName: string;
  /** Author's headline/bio (if available) */
  authorHeadline?: string;
  /** Author's profile URL */
  authorProfileUrl?: string;
  /** Post text content */
  content: string;
  /** Timestamp when the post was published */
  publishedAt?: string;
  /** Number of reactions/likes */
  reactionCount?: number;
  /** Number of comments */
  commentCount?: number;
  /** Number of reposts/shares */
  repostCount?: number;
  /** Whether this is a repost of another post */
  isRepost?: boolean;
  /** Original post info if this is a repost */
  originalPost?: {
    authorName: string;
    authorProfileUrl?: string;
    content?: string;
  };
  /** Type of content attached to the post */
  contentType?: 'text' | 'image' | 'video' | 'article' | 'document' | 'poll';
  /** Platform this post was extracted from */
  platform: string;
  /** Timestamp when this post was extracted */
  extractedAt: number;
}

/**
 * DOM selectors for extracting feed elements
 */
export interface FeedSelectors {
  /** Selector for the main feed container */
  feedContainer: string;
  /** Selector for individual post elements */
  postItem: string;
  /** Selector for the author name element */
  authorName: string;
  /** Selector for the author headline element */
  authorHeadline?: string;
  /** Selector for the author profile link */
  authorProfileLink?: string;
  /** Selector for the post content text */
  postContent: string;
  /** Selector for the post timestamp */
  postTimestamp?: string;
  /** Selector for the reactions count */
  reactionCount?: string;
  /** Selector for the comments count */
  commentCount?: string;
  /** Selector for the repost count */
  repostCount?: string;
  /** Selector to identify if a post is a repost */
  repostIndicator?: string;
  /** Selector for article/link shares */
  articleShare?: string;
  /** Selector for images in posts */
  postImage?: string;
  /** Selector for the post actions menu or link */
  postLink?: string;
}

/**
 * Platform adapter interface
 * Each supported platform must implement this interface
 */
export interface PlatformAdapter {
  /** Platform identifier (e.g., 'linkedin', 'twitter') */
  readonly platformId: string;

  /** Human-readable platform name */
  readonly platformName: string;

  /** DOM selectors for this platform */
  readonly selectors: FeedSelectors;

  /**
   * Check if the current page is a feed page that should be monitored
   * @param url Current page URL
   */
  isFeedPage(url: string): boolean;

  /**
   * Extract a post from a DOM element
   * @param element The post container element
   * @returns Extracted post or null if extraction fails
   */
  extractPost(element: Element): ExtractedPost | null;

  /**
   * Get the unique ID for a post element
   * @param element The post container element
   */
  getPostId(element: Element): string | null;

  /**
   * Generate the permalink URL for a post
   * @param postId The post's unique identifier
   */
  getPostUrl(postId: string): string;

  /**
   * Find all post elements currently in the DOM
   */
  findPostElements(): Element[];
}

/**
 * Platform registry entry
 */
export interface PlatformRegistryEntry {
  /** URL patterns that match this platform (regex patterns) */
  urlPatterns: RegExp[];
  /** Factory function to create the adapter */
  createAdapter: () => PlatformAdapter;
}
