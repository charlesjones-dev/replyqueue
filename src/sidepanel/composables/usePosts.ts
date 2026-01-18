/**
 * Posts composable
 * Manages matched posts display and status with live updates
 */

import { ref, shallowRef, computed, onMounted, onUnmounted, triggerRef } from 'vue';
import type { MatchedPostWithScore, CachedRssFeed, ExtractedPostRecord } from '@shared/types';
import { MAX_MATCHED_POSTS, STORAGE_KEYS } from '@shared/constants';
import {
  getMatchedPostsWithScore,
  saveMatchedPostsWithScore,
  getCachedRssFeed,
  isCachedFeedValid,
  getExtractedPosts,
  getEvaluatedPostIds,
  getConfig,
} from '@shared/storage';
import { sendMessage } from '@shared/messages';

export type PostFilter = 'queued' | 'matched' | 'unmatched' | 'replied' | 'skipped';

export function usePosts() {
  // State - use shallowRef for large arrays to improve performance
  const matchedPosts = shallowRef<MatchedPostWithScore[]>([]);
  const extractedPosts = shallowRef<ExtractedPostRecord[]>([]);
  const evaluatedPostIds = shallowRef<Set<string>>(new Set());
  const cachedFeed = shallowRef<CachedRssFeed | null>(null);
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const error = ref<string | null>(null);
  const currentFilter = ref<PostFilter>('queued');
  const lastRefreshedAt = ref<number | null>(null);

  // Storage change listener reference for cleanup
  let storageListener: ((changes: { [key: string]: chrome.storage.StorageChange }) => void) | null = null;

  // Helper to get the key for a post
  const getPostKey = (platform: string, id: string) => `${platform}:${id}`;

  // Posts in queue (extracted but not yet evaluated by AI)
  const queuedPosts = computed(() => {
    return extractedPosts.value.filter((p) => {
      const key = getPostKey(p.platform, p.id);
      return !evaluatedPostIds.value.has(key);
    });
  });

  // Posts that were evaluated but didn't match (not in matchedPosts)
  const unmatchedPosts = computed(() => {
    const matchedKeys = new Set(matchedPosts.value.map((m) => getPostKey(m.post.platform, m.post.id)));
    return extractedPosts.value.filter((p) => {
      const key = getPostKey(p.platform, p.id);
      return evaluatedPostIds.value.has(key) && !matchedKeys.has(key);
    });
  });

  // Computed values
  const filteredMatchedPosts = computed(() => {
    switch (currentFilter.value) {
      case 'matched':
        return matchedPosts.value.filter((p) => p.status === 'pending');
      case 'replied':
        return matchedPosts.value.filter((p) => p.status === 'replied');
      case 'skipped':
        return matchedPosts.value.filter((p) => p.status === 'skipped');
      default:
        return [];
    }
  });

  // Count of posts in queue (extracted but not yet analyzed)
  const queuedCount = computed(() => queuedPosts.value.length);

  // Count of matched posts (analyzed and pending action)
  const matchedCount = computed(() => matchedPosts.value.filter((p) => p.status === 'pending').length);

  // Count of unmatched posts (evaluated but didn't meet threshold)
  const unmatchedCount = computed(() => unmatchedPosts.value.length);

  const repliedCount = computed(() => matchedPosts.value.filter((p) => p.status === 'replied').length);

  const skippedCount = computed(() => matchedPosts.value.filter((p) => p.status === 'skipped').length);

  const totalMatches = computed(() => matchedPosts.value.length);

  const hasRssFeed = computed(() => cachedFeed.value !== null);

  const rssFeedStatus = computed(() => {
    if (!cachedFeed.value) {
      return { connected: false, message: 'No RSS feed configured' };
    }

    if (!isCachedFeedValid(cachedFeed.value)) {
      return { connected: false, message: 'RSS feed cache expired' };
    }

    const minutesAgo = Math.round((Date.now() - cachedFeed.value.fetchedAt) / 1000 / 60);
    return {
      connected: true,
      message: `Last updated ${minutesAgo}m ago`,
      feedTitle: cachedFeed.value.feed.title,
      itemCount: cachedFeed.value.feed.items.length,
    };
  });

  /**
   * Load matched posts and feed status from storage
   */
  async function loadPosts() {
    isLoading.value = true;
    error.value = null;

    try {
      // Load matched posts - limit to MAX_MATCHED_POSTS for performance
      const posts = await getMatchedPostsWithScore();
      matchedPosts.value = posts.slice(0, MAX_MATCHED_POSTS);
      triggerRef(matchedPosts);

      // Load cached feed status
      cachedFeed.value = await getCachedRssFeed();
      triggerRef(cachedFeed);

      // Auto-refresh RSS feed if cache is missing/expired but URL is configured
      const config = await getConfig();
      if (config.rssFeedUrl && (!cachedFeed.value || !isCachedFeedValid(cachedFeed.value))) {
        // Refresh in background without blocking
        sendMessage({ type: 'FETCH_RSS', url: '' })
          .then(async (response) => {
            if (response.success) {
              // Reload the cached feed after refresh
              cachedFeed.value = await getCachedRssFeed();
              triggerRef(cachedFeed);
            }
          })
          .catch(() => {
            // Silently ignore refresh errors on startup
          });
      }

      // Load extracted posts for the queue
      const extracted = await getExtractedPosts();
      extractedPosts.value = extracted;
      triggerRef(extractedPosts);

      // Load evaluated post IDs
      evaluatedPostIds.value = await getEvaluatedPostIds();
      triggerRef(evaluatedPostIds);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load posts';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Set up storage change listener for live updates
   */
  function setupStorageListener() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      // Update extracted posts when they change (live queue updates)
      if (changes[STORAGE_KEYS.EXTRACTED_POSTS]) {
        const newValue = changes[STORAGE_KEYS.EXTRACTED_POSTS].newValue as ExtractedPostRecord[] | undefined;
        extractedPosts.value = newValue ?? [];
        triggerRef(extractedPosts);
      }

      // Update matched posts when they change
      if (changes[STORAGE_KEYS.MATCHED_POSTS_WITH_SCORE]) {
        const newValue = changes[STORAGE_KEYS.MATCHED_POSTS_WITH_SCORE].newValue as MatchedPostWithScore[] | undefined;
        matchedPosts.value = (newValue ?? []).slice(0, MAX_MATCHED_POSTS);
        triggerRef(matchedPosts);
      }

      // Update evaluated post IDs when they change
      if (changes[STORAGE_KEYS.EVALUATED_POST_IDS]) {
        const newValue = changes[STORAGE_KEYS.EVALUATED_POST_IDS].newValue as string[] | undefined;
        evaluatedPostIds.value = new Set(newValue ?? []);
        triggerRef(evaluatedPostIds);
      }

      // Update cached feed when it changes
      if (changes[STORAGE_KEYS.CACHED_RSS_FEED]) {
        const newValue = changes[STORAGE_KEYS.CACHED_RSS_FEED].newValue as CachedRssFeed | undefined;
        cachedFeed.value = newValue ?? null;
        triggerRef(cachedFeed);
      }
    };

    chrome.storage.local.onChanged.addListener(storageListener);
  }

  /**
   * Clean up storage listener
   */
  function cleanupStorageListener() {
    if (storageListener && typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.onChanged.removeListener(storageListener);
      storageListener = null;
    }
  }

  /**
   * Refresh RSS feed and re-match posts
   */
  async function refreshMatches() {
    isRefreshing.value = true;
    error.value = null;

    try {
      // Request background to refresh RSS and re-match
      const response = await sendMessage({ type: 'FETCH_RSS', url: '' });

      if (!response.success) {
        throw new Error(response.error ?? 'Failed to refresh matches');
      }

      // Reload posts
      await loadPosts();

      // Update last refreshed timestamp
      lastRefreshedAt.value = Date.now();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to refresh matches';
    } finally {
      isRefreshing.value = false;
    }
  }

  /**
   * Trigger content script to re-scan the current feed
   */
  async function rescanFeed() {
    try {
      // Get the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script to restart extraction
      await chrome.tabs.sendMessage(activeTab.id, { type: 'START_EXTRACTION' });

      // Wait a bit for extraction to complete, then refresh
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await refreshMatches();
    } catch (e) {
      // Silently fail - content script may not be on a supported page
      console.warn('Could not trigger feed rescan:', e);
    }
  }

  /**
   * Update post status
   */
  async function updatePostStatus(postId: string, platform: string, status: MatchedPostWithScore['status']) {
    const updated = matchedPosts.value.map((p) => {
      if (p.post.id === postId && p.post.platform === platform) {
        return { ...p, status };
      }
      return p;
    });

    matchedPosts.value = updated;
    triggerRef(matchedPosts);
    await saveMatchedPostsWithScore(updated);
  }

  /**
   * Skip a post
   */
  async function skipPost(postId: string, platform: string) {
    await updatePostStatus(postId, platform, 'skipped');
  }

  /**
   * Mark post as replied
   */
  async function markAsReplied(postId: string, platform: string) {
    await updatePostStatus(postId, platform, 'replied');
  }

  /**
   * Reset post to pending
   */
  async function resetPost(postId: string, platform: string) {
    await updatePostStatus(postId, platform, 'pending');
  }

  /**
   * Set filter
   */
  function setFilter(filter: PostFilter) {
    currentFilter.value = filter;
  }

  /**
   * Get a single post by ID
   */
  function getPost(postId: string, platform: string): MatchedPostWithScore | undefined {
    return matchedPosts.value.find((p) => p.post.id === postId && p.post.platform === platform);
  }

  /**
   * Format score as percentage
   */
  function formatScore(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  /**
   * Format relative time
   */
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  // Load posts and set up storage listener on mount
  onMounted(() => {
    loadPosts();
    setupStorageListener();
  });

  // Clean up storage listener on unmount
  onUnmounted(() => {
    cleanupStorageListener();
  });

  return {
    // State
    matchedPosts,
    extractedPosts,
    evaluatedPostIds,
    cachedFeed,
    isLoading,
    isRefreshing,
    error,
    currentFilter,
    lastRefreshedAt,

    // Computed
    filteredMatchedPosts,
    queuedPosts,
    unmatchedPosts,
    queuedCount,
    matchedCount,
    unmatchedCount,
    repliedCount,
    skippedCount,
    totalMatches,
    hasRssFeed,
    rssFeedStatus,

    // Actions
    loadPosts,
    refreshMatches,
    rescanFeed,
    updatePostStatus,
    skipPost,
    markAsReplied,
    resetPost,
    setFilter,
    getPost,

    // Helpers
    formatScore,
    formatRelativeTime,
  };
}
