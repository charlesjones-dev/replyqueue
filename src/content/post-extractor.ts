/**
 * Post Extractor for ReplyQueue extension
 * Coordinates DOM observation and platform adapter for post extraction
 */

import type { PlatformAdapter, ExtractedPost } from '../platforms/types';
import { DOMObserver, onScrollEnd } from './dom-observer';

const LOG_PREFIX = '[ReplyQueue:Extractor]';

/**
 * Callback for when posts are extracted
 */
export type OnPostsExtractedCallback = (posts: ExtractedPost[]) => void;

/**
 * Configuration for the post extractor
 */
export interface PostExtractorOptions {
  /** Platform adapter to use for extraction */
  adapter: PlatformAdapter;
  /** Callback when new posts are extracted */
  onPostsExtracted: OnPostsExtractedCallback;
  /** Debounce time for DOM observation (default: 500ms) */
  debounceMs?: number;
}

/**
 * Post extractor that coordinates DOM observation and post extraction
 */
export class PostExtractor {
  private adapter: PlatformAdapter;
  private observer: DOMObserver | null = null;
  private onPostsExtracted: OnPostsExtractedCallback;
  private debounceMs: number;
  private extractedIds: Set<string> = new Set();
  private scrollCleanup: (() => void) | null = null;
  private isRunning = false;

  constructor(options: PostExtractorOptions) {
    this.adapter = options.adapter;
    this.onPostsExtracted = options.onPostsExtracted;
    this.debounceMs = options.debounceMs ?? 500;
  }

  /**
   * Start extracting posts from the feed
   */
  start(): void {
    if (this.isRunning) {
      console.warn(`${LOG_PREFIX} Extractor already running`);
      return;
    }

    console.log(`${LOG_PREFIX} Starting post extractor for ${this.adapter.platformName}`);

    this.isRunning = true;

    // Create and start the DOM observer
    this.observer = new DOMObserver({
      targetSelector: this.adapter.selectors.postItem,
      debounceMs: this.debounceMs,
      onElements: (elements) => this.handleNewElements(elements),
    });

    this.observer.start();

    // Also listen for scroll events to catch any missed posts
    this.scrollCleanup = onScrollEnd(() => {
      this.scanForMissedPosts();
    }, 300);

    console.log(`${LOG_PREFIX} Post extractor started`);
  }

  /**
   * Stop extracting posts
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log(`${LOG_PREFIX} Stopping post extractor`);

    if (this.observer) {
      this.observer.stop();
      this.observer = null;
    }

    if (this.scrollCleanup) {
      this.scrollCleanup();
      this.scrollCleanup = null;
    }

    this.isRunning = false;
    console.log(`${LOG_PREFIX} Post extractor stopped`);
  }

  /**
   * Get the count of extracted posts
   */
  getExtractedCount(): number {
    return this.extractedIds.size;
  }

  /**
   * Check if a post ID has already been extracted
   */
  hasExtracted(postId: string): boolean {
    return this.extractedIds.has(postId);
  }

  /**
   * Clear the extracted post cache
   * Useful if you want to re-extract all posts
   */
  clearCache(): void {
    this.extractedIds.clear();
    console.log(`${LOG_PREFIX} Cleared extracted post cache`);
  }

  /**
   * Force a full scan of the current page
   */
  forceRescan(): void {
    console.log(`${LOG_PREFIX} Forcing full rescan`);
    const elements = this.adapter.findPostElements();
    this.handleNewElements(elements, true);
  }

  /**
   * Handle new elements detected by the observer
   */
  private handleNewElements(elements: Element[], forceRescan = false): void {
    const newPosts: ExtractedPost[] = [];

    for (const element of elements) {
      // Skip if we've already extracted this element
      const postId = this.adapter.getPostId(element);
      if (!postId) {
        continue;
      }

      if (!forceRescan && this.extractedIds.has(postId)) {
        continue;
      }

      // Try to extract the post
      const post = this.adapter.extractPost(element);
      if (post) {
        this.extractedIds.add(post.id);
        newPosts.push(post);
      }
    }

    if (newPosts.length > 0) {
      console.log(`${LOG_PREFIX} Extracted ${newPosts.length} new posts`);
      this.onPostsExtracted(newPosts);
    }
  }

  /**
   * Scan for any posts that might have been missed
   * Called after scroll events settle
   */
  private scanForMissedPosts(): void {
    const elements = this.adapter.findPostElements();
    let missedCount = 0;

    for (const element of elements) {
      const postId = this.adapter.getPostId(element);
      if (postId && !this.extractedIds.has(postId)) {
        missedCount++;
      }
    }

    if (missedCount > 0) {
      console.log(`${LOG_PREFIX} Found ${missedCount} potentially missed posts, processing...`);
      this.handleNewElements(elements);
    }
  }
}

/**
 * Create a post extractor for a platform adapter
 * Convenience factory function
 */
export function createPostExtractor(
  adapter: PlatformAdapter,
  onPostsExtracted: OnPostsExtractedCallback,
  debounceMs = 500
): PostExtractor {
  return new PostExtractor({
    adapter,
    onPostsExtracted,
    debounceMs,
  });
}
