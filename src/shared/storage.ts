/**
 * Typed chrome.storage wrappers with sync/local fallback
 */

import type {
  ExtensionConfig,
  MatchedPost,
  StorageData,
  ExtractedPostRecord,
  MatchedPostWithScore,
  CachedRssFeed,
} from './types';
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  MAX_EXTRACTED_POSTS,
  DEFAULT_MAX_MATCHED_POSTS,
  MAX_EXAMPLE_COMMENTS,
  SYNC_STORAGE_ITEM_LIMIT,
  DEFAULT_MAX_QUEUE_SIZE,
} from './constants';

/**
 * Check if chrome.storage API is available
 */
function isStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && chrome.storage !== undefined;
}

/**
 * Get data from chrome.storage.sync with local fallback
 */
async function get<T>(key: string): Promise<T | undefined> {
  if (!isStorageAvailable()) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : undefined;
  }

  try {
    const result = await chrome.storage.sync.get(key);
    return result[key] as T | undefined;
  } catch {
    // Fallback to local storage if sync fails
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] as T | undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * Set data in chrome.storage.sync with local fallback
 */
async function set<T>(key: string, value: T): Promise<void> {
  if (!isStorageAvailable()) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch {
    // Fallback to local storage if sync fails
    await chrome.storage.local.set({ [key]: value });
  }
}

/**
 * Remove data from chrome.storage.sync
 */
async function remove(key: string): Promise<void> {
  if (!isStorageAvailable()) {
    localStorage.removeItem(key);
    return;
  }

  try {
    await chrome.storage.sync.remove(key);
  } catch {
    await chrome.storage.local.remove(key);
  }
}

/**
 * Get extension configuration
 */
export async function getConfig(): Promise<ExtensionConfig> {
  const config = await get<ExtensionConfig>(STORAGE_KEYS.CONFIG);
  return config ?? { ...DEFAULT_CONFIG };
}

/**
 * Save extension configuration
 */
export async function saveConfig(config: ExtensionConfig): Promise<void> {
  await set(STORAGE_KEYS.CONFIG, config);
}

/**
 * Update partial configuration
 */
export async function updateConfig(updates: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
  const current = await getConfig();
  const updated = { ...current, ...updates };
  await saveConfig(updated);
  return updated;
}

/**
 * Get matched posts
 */
export async function getMatchedPosts(): Promise<MatchedPost[]> {
  const posts = await get<MatchedPost[]>(STORAGE_KEYS.MATCHED_POSTS);
  return posts ?? [];
}

/**
 * Save matched posts
 */
export async function saveMatchedPosts(posts: MatchedPost[]): Promise<void> {
  await set(STORAGE_KEYS.MATCHED_POSTS, posts);
}

// ============================================================
// Extracted posts storage (uses chrome.storage.local for larger capacity)
// ============================================================

/**
 * Get data from chrome.storage.local
 */
async function getLocal<T>(key: string): Promise<T | undefined> {
  if (!isStorageAvailable()) {
    const data = localStorage.getItem(`local_${key}`);
    return data ? JSON.parse(data) : undefined;
  }

  try {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Set data in chrome.storage.local
 */
async function setLocal<T>(key: string, value: T): Promise<void> {
  if (!isStorageAvailable()) {
    localStorage.setItem(`local_${key}`, JSON.stringify(value));
    return;
  }

  await chrome.storage.local.set({ [key]: value });
}

/**
 * Get extracted posts from local storage
 */
export async function getExtractedPosts(): Promise<ExtractedPostRecord[]> {
  const posts = await getLocal<ExtractedPostRecord[]>(STORAGE_KEYS.EXTRACTED_POSTS);
  return posts ?? [];
}

/**
 * Save extracted posts to local storage
 */
export async function saveExtractedPosts(posts: ExtractedPostRecord[]): Promise<void> {
  await setLocal(STORAGE_KEYS.EXTRACTED_POSTS, posts);
}

/**
 * Add new extracted posts with deduplication and queue size limit
 * Returns the count of new posts added, duplicates skipped, and whether limit was reached
 */
export async function addExtractedPosts(
  newPosts: ExtractedPostRecord[]
): Promise<{ added: number; duplicates: number; total: number; limitReached: boolean }> {
  const existing = await getExtractedPosts();
  const existingIds = new Set(existing.map((p) => `${p.platform}:${p.id}`));

  // Get config for maxQueueSize and evaluated posts to calculate current queue size
  const config = await getConfig();
  const maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
  const evaluatedIds = await getEvaluatedPostIds();

  // Calculate current queue size (extracted posts not yet evaluated)
  const currentQueueSize = existing.filter((p) => {
    const key = `${p.platform}:${p.id}`;
    return !evaluatedIds.has(key);
  }).length;

  const remainingCapacity = Math.max(0, maxQueueSize - currentQueueSize);

  let added = 0;
  let duplicates = 0;
  let limitReached = remainingCapacity === 0;

  for (const post of newPosts) {
    const key = `${post.platform}:${post.id}`;
    if (existingIds.has(key)) {
      duplicates++;
    } else if (added < remainingCapacity) {
      existing.push(post);
      existingIds.add(key);
      added++;
    } else {
      // Queue limit reached, stop adding
      limitReached = true;
    }
  }

  // Trim to max size, keeping most recent
  if (existing.length > MAX_EXTRACTED_POSTS) {
    // Sort by extractedAt descending and keep only MAX_EXTRACTED_POSTS
    existing.sort((a, b) => b.extractedAt - a.extractedAt);
    existing.length = MAX_EXTRACTED_POSTS;
  }

  await saveExtractedPosts(existing);

  return { added, duplicates, total: existing.length, limitReached };
}

/**
 * Get current queue status (for UI to display limit warnings)
 */
export async function getQueueStatus(): Promise<{
  currentSize: number;
  maxSize: number;
  isAtLimit: boolean;
}> {
  const config = await getConfig();
  const maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
  const existing = await getExtractedPosts();
  const evaluatedIds = await getEvaluatedPostIds();

  // Calculate current queue size (extracted posts not yet evaluated)
  const currentSize = existing.filter((p) => {
    const key = `${p.platform}:${p.id}`;
    return !evaluatedIds.has(key);
  }).length;

  return {
    currentSize,
    maxSize: maxQueueSize,
    isAtLimit: currentSize >= maxQueueSize,
  };
}

/**
 * Clear extracted posts
 */
export async function clearExtractedPosts(): Promise<void> {
  await setLocal(STORAGE_KEYS.EXTRACTED_POSTS, []);
}

/**
 * Clear all extension data
 */
export async function clearAllData(): Promise<void> {
  await remove(STORAGE_KEYS.CONFIG);
  await remove(STORAGE_KEYS.MATCHED_POSTS);
}

/**
 * Clear all caches (extracted posts, matched posts, RSS feed cache, evaluated posts)
 * Preserves user settings like API key and RSS feed URL
 */
export async function clearAllCaches(): Promise<void> {
  await clearExtractedPosts();
  await clearMatchedPostsWithScore();
  await clearCachedRssFeed();
  await clearEvaluatedPostIds();
  // Also clear AI match cache if it exists
  if (isStorageAvailable()) {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.AI_MATCH_CACHE);
      await chrome.storage.local.remove(STORAGE_KEYS.CACHED_MODELS);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Get all storage data
 */
export async function getAllData(): Promise<StorageData> {
  const config = await getConfig();
  const matchedPosts = await getMatchedPosts();
  return { config, matchedPosts };
}

// ============================================================
// Matched posts with score storage (uses chrome.storage.local)
// ============================================================

/**
 * Get matched posts with scores from local storage
 */
export async function getMatchedPostsWithScore(): Promise<MatchedPostWithScore[]> {
  const posts = await getLocal<MatchedPostWithScore[]>(STORAGE_KEYS.MATCHED_POSTS_WITH_SCORE);
  return posts ?? [];
}

/**
 * Save matched posts with scores to local storage
 */
export async function saveMatchedPostsWithScore(posts: MatchedPostWithScore[]): Promise<void> {
  // Get max matched posts from config
  const config = await getConfig();
  const maxMatchedPosts = config.maxMatchedPosts ?? DEFAULT_MAX_MATCHED_POSTS;

  // Limit to max size, keeping highest scores
  const sorted = [...posts].sort((a, b) => b.score - a.score);
  const limited = sorted.slice(0, maxMatchedPosts);
  await setLocal(STORAGE_KEYS.MATCHED_POSTS_WITH_SCORE, limited);
}

/**
 * Update a single matched post status
 */
export async function updateMatchedPostStatus(
  postId: string,
  platform: string,
  status: MatchedPostWithScore['status'],
  draftReply?: string
): Promise<void> {
  const posts = await getMatchedPostsWithScore();
  const updated = posts.map((p) => {
    if (p.post.id === postId && p.post.platform === platform) {
      return {
        ...p,
        status,
        draftReply: draftReply !== undefined ? draftReply : p.draftReply,
      };
    }
    return p;
  });
  await saveMatchedPostsWithScore(updated);
}

/**
 * Clear matched posts with scores
 */
export async function clearMatchedPostsWithScore(): Promise<void> {
  await setLocal(STORAGE_KEYS.MATCHED_POSTS_WITH_SCORE, []);
}

// ============================================================
// Evaluated post IDs storage (uses chrome.storage.local)
// Tracks which posts have been through AI matching
// ============================================================

/**
 * Get evaluated post IDs from local storage
 * These are posts that have been processed by AI matching (whether matched or not)
 */
export async function getEvaluatedPostIds(): Promise<Set<string>> {
  const ids = await getLocal<string[]>(STORAGE_KEYS.EVALUATED_POST_IDS);
  return new Set(ids ?? []);
}

/**
 * Save evaluated post IDs to local storage
 */
export async function saveEvaluatedPostIds(ids: Set<string>): Promise<void> {
  await setLocal(STORAGE_KEYS.EVALUATED_POST_IDS, Array.from(ids));
}

/**
 * Add post IDs to the evaluated set
 */
export async function addEvaluatedPostIds(newIds: string[]): Promise<void> {
  const existing = await getEvaluatedPostIds();
  for (const id of newIds) {
    existing.add(id);
  }
  await saveEvaluatedPostIds(existing);
}

/**
 * Clear evaluated post IDs
 */
export async function clearEvaluatedPostIds(): Promise<void> {
  await setLocal(STORAGE_KEYS.EVALUATED_POST_IDS, []);
}

// ============================================================
// Cached RSS feed storage (uses chrome.storage.local)
// ============================================================

/**
 * Get cached RSS feed from local storage
 */
export async function getCachedRssFeed(): Promise<CachedRssFeed | null> {
  const cached = await getLocal<CachedRssFeed>(STORAGE_KEYS.CACHED_RSS_FEED);
  return cached ?? null;
}

/**
 * Save RSS feed to cache
 */
export async function saveCachedRssFeed(cached: CachedRssFeed): Promise<void> {
  await setLocal(STORAGE_KEYS.CACHED_RSS_FEED, cached);
}

/**
 * Clear the RSS feed cache
 */
export async function clearCachedRssFeed(): Promise<void> {
  if (!isStorageAvailable()) {
    localStorage.removeItem(`local_${STORAGE_KEYS.CACHED_RSS_FEED}`);
    return;
  }
  await chrome.storage.local.remove(STORAGE_KEYS.CACHED_RSS_FEED);
}

/**
 * Check if cached feed is still valid
 */
export function isCachedFeedValid(cached: CachedRssFeed | null): boolean {
  if (!cached) return false;
  const now = Date.now();
  const expiresAt = cached.fetchedAt + cached.ttl;
  return now < expiresAt;
}

// ============================================================
// Example comments storage (sync with local fallback for large lists)
// ============================================================

/**
 * Calculate approximate byte size of data
 */
function getByteSize(data: unknown): number {
  const json = JSON.stringify(data);
  // Try to use Blob if available, otherwise estimate using string length
  if (typeof Blob !== 'undefined') {
    try {
      return new Blob([json]).size;
    } catch {
      // Fallback to string length estimation (assumes UTF-8)
      return json.length * 2;
    }
  }
  // Estimate byte size (string length * 2 for UTF-16 encoding, roughly)
  return json.length * 2;
}

/**
 * Get example comments
 * Tries sync storage first, falls back to local for large lists
 */
export async function getExampleComments(): Promise<string[]> {
  // Try sync storage first
  const syncComments = await get<string[]>(STORAGE_KEYS.EXAMPLE_COMMENTS);
  if (syncComments !== undefined) {
    return syncComments;
  }

  // Fall back to local storage
  const localComments = await getLocal<string[]>(STORAGE_KEYS.EXAMPLE_COMMENTS);
  return localComments ?? [];
}

/**
 * Save example comments
 * Uses sync storage if small enough, otherwise local storage
 */
export async function saveExampleComments(comments: string[]): Promise<void> {
  // Limit to max number
  const limited = comments.slice(0, MAX_EXAMPLE_COMMENTS);

  // Check if it fits in sync storage
  const byteSize = getByteSize(limited);

  if (byteSize < SYNC_STORAGE_ITEM_LIMIT) {
    // Fits in sync storage
    await set(STORAGE_KEYS.EXAMPLE_COMMENTS, limited);
    // Clear from local storage if it was there
    if (isStorageAvailable()) {
      try {
        await chrome.storage.local.remove(STORAGE_KEYS.EXAMPLE_COMMENTS);
      } catch {
        // Ignore errors
      }
    }
  } else {
    // Too large for sync, use local storage
    await setLocal(STORAGE_KEYS.EXAMPLE_COMMENTS, limited);
    // Clear from sync storage
    try {
      await remove(STORAGE_KEYS.EXAMPLE_COMMENTS);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Add a new example comment
 */
export async function addExampleComment(comment: string): Promise<string[]> {
  const existing = await getExampleComments();

  // Check if comment already exists
  if (existing.includes(comment)) {
    return existing;
  }

  // Add new comment at the beginning
  const updated = [comment, ...existing].slice(0, MAX_EXAMPLE_COMMENTS);
  await saveExampleComments(updated);
  return updated;
}

/**
 * Remove an example comment
 */
export async function removeExampleComment(comment: string): Promise<string[]> {
  const existing = await getExampleComments();
  const updated = existing.filter((c) => c !== comment);
  await saveExampleComments(updated);
  return updated;
}

/**
 * Update an example comment
 */
export async function updateExampleComment(oldComment: string, newComment: string): Promise<string[]> {
  const existing = await getExampleComments();
  const updated = existing.map((c) => (c === oldComment ? newComment : c));
  await saveExampleComments(updated);
  return updated;
}

/**
 * Clear all example comments
 */
export async function clearExampleComments(): Promise<void> {
  await remove(STORAGE_KEYS.EXAMPLE_COMMENTS);
  if (isStorageAvailable()) {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.EXAMPLE_COMMENTS);
    } catch {
      // Ignore errors
    }
  }
}

// ============================================================
// Export storage object
// ============================================================

export const storage = {
  get,
  set,
  remove,
  getConfig,
  saveConfig,
  updateConfig,
  getMatchedPosts,
  saveMatchedPosts,
  getExtractedPosts,
  saveExtractedPosts,
  addExtractedPosts,
  clearExtractedPosts,
  getQueueStatus,
  clearAllData,
  clearAllCaches,
  getAllData,
  // Matched posts with score
  getMatchedPostsWithScore,
  saveMatchedPostsWithScore,
  updateMatchedPostStatus,
  clearMatchedPostsWithScore,
  // Evaluated post IDs
  getEvaluatedPostIds,
  saveEvaluatedPostIds,
  addEvaluatedPostIds,
  clearEvaluatedPostIds,
  // Cached RSS feed
  getCachedRssFeed,
  saveCachedRssFeed,
  clearCachedRssFeed,
  isCachedFeedValid,
  // Example comments
  getExampleComments,
  saveExampleComments,
  addExampleComment,
  removeExampleComment,
  updateExampleComment,
  clearExampleComments,
};
