/**
 * Settings view composable
 * Manages settings form state, validation, and persistence
 */

import { ref, computed, watch, onMounted } from 'vue';
import type { MatchingPreferences } from '@shared/types';
import { useConfig } from './useConfig';
import { useAppState } from './useAppState';
import { validateApiKeyWithServer, validateRssFeed } from '@shared/validation';
import {
  getExampleComments,
  saveExampleComments,
  addExampleComment,
  removeExampleComment,
  updateExampleComment,
  clearCachedRssFeed,
  clearAllCaches,
  getCachedRssFeed,
  isCachedFeedValid,
} from '@shared/storage';
import type { CachedRssFeed } from '@shared/types';
import { sendMessage } from '@shared/messages';
import {
  DEFAULT_MATCHING_PREFERENCES,
  CACHE_TTL_OPTIONS,
  MAX_MATCHED_POSTS_OPTIONS,
  DEFAULT_MAX_MATCHED_POSTS,
  BLOG_CONTENT_CHAR_LIMIT_OPTIONS,
  DEFAULT_BLOG_CONTENT_CHAR_LIMIT,
  POST_CONTENT_CHAR_LIMIT_OPTIONS,
  DEFAULT_POST_CONTENT_CHAR_LIMIT,
  DEFAULT_MAX_QUEUE_SIZE,
} from '@shared/constants';

export function useSettingsView() {
  const { config, loadConfig, update } = useConfig();
  const { closeSettings } = useAppState();

  // Form state
  const apiKey = ref('');
  const rssFeedUrl = ref('');
  const selectedModel = ref('');
  const threshold = ref(DEFAULT_MATCHING_PREFERENCES.threshold);
  const cacheTtlMinutes = ref(DEFAULT_MATCHING_PREFERENCES.cacheTtlMinutes);
  const maxMatchedPosts = ref(DEFAULT_MAX_MATCHED_POSTS);
  const exampleComments = ref<string[]>([]);
  const newExampleComment = ref('');
  const communicationPreferences = ref('');
  const blogContentCharLimit = ref(DEFAULT_BLOG_CONTENT_CHAR_LIMIT);
  const postContentCharLimit = ref(DEFAULT_POST_CONTENT_CHAR_LIMIT);
  const maxQueueSize = ref(DEFAULT_MAX_QUEUE_SIZE);

  // UI state
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isTestingApiKey = ref(false);
  const isTestingFeed = ref(false);
  const isClearingCache = ref(false);
  const cacheCleared = ref(false);
  const hasUnsavedChanges = ref(false);
  const showUnsavedWarning = ref(false);
  const pendingNavigation = ref<(() => void) | null>(null);

  // Validation state
  const apiKeyError = ref<string | null>(null);
  const apiKeyValid = ref(false);
  const feedError = ref<string | null>(null);
  const feedValid = ref(false);
  const feedTitle = ref<string | null>(null);
  const feedItemCount = ref<number | null>(null);
  const saveError = ref<string | null>(null);

  // RSS feed cache status
  const cachedFeed = ref<CachedRssFeed | null>(null);

  // Track original values for change detection
  const originalValues = ref({
    apiKey: '',
    rssFeedUrl: '',
    selectedModel: '',
    threshold: DEFAULT_MATCHING_PREFERENCES.threshold,
    cacheTtlMinutes: DEFAULT_MATCHING_PREFERENCES.cacheTtlMinutes,
    maxMatchedPosts: DEFAULT_MAX_MATCHED_POSTS,
    exampleComments: [] as string[],
    communicationPreferences: '',
    blogContentCharLimit: DEFAULT_BLOG_CONTENT_CHAR_LIMIT,
    postContentCharLimit: DEFAULT_POST_CONTENT_CHAR_LIMIT,
    maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
  });

  // Computed values
  const canSave = computed(() => {
    return hasUnsavedChanges.value && apiKey.value.length > 0 && rssFeedUrl.value.length > 0;
  });

  const maskedApiKey = computed(() => {
    if (!apiKey.value) return '';
    if (apiKey.value.length <= 12) return apiKey.value;
    return apiKey.value.slice(0, 8) + '...' + apiKey.value.slice(-4);
  });

  const rssFeedStatus = computed(() => {
    if (!cachedFeed.value) {
      return { connected: false, message: 'Not connected' };
    }

    if (!isCachedFeedValid(cachedFeed.value)) {
      return { connected: false, message: 'Cache expired' };
    }

    const minutesAgo = Math.round((Date.now() - cachedFeed.value.fetchedAt) / 1000 / 60);
    return {
      connected: true,
      message: `Last updated ${minutesAgo}m ago`,
    };
  });

  // Watch for changes
  watch(
    [
      apiKey,
      rssFeedUrl,
      selectedModel,
      threshold,
      cacheTtlMinutes,
      maxMatchedPosts,
      exampleComments,
      communicationPreferences,
      blogContentCharLimit,
      postContentCharLimit,
      maxQueueSize,
    ],
    () => {
      checkForChanges();
    },
    { deep: true }
  );

  /**
   * Check if there are unsaved changes
   */
  function checkForChanges() {
    const changed =
      apiKey.value !== originalValues.value.apiKey ||
      rssFeedUrl.value !== originalValues.value.rssFeedUrl ||
      selectedModel.value !== originalValues.value.selectedModel ||
      threshold.value !== originalValues.value.threshold ||
      cacheTtlMinutes.value !== originalValues.value.cacheTtlMinutes ||
      maxMatchedPosts.value !== originalValues.value.maxMatchedPosts ||
      JSON.stringify(exampleComments.value) !== JSON.stringify(originalValues.value.exampleComments) ||
      communicationPreferences.value !== originalValues.value.communicationPreferences ||
      blogContentCharLimit.value !== originalValues.value.blogContentCharLimit ||
      postContentCharLimit.value !== originalValues.value.postContentCharLimit ||
      maxQueueSize.value !== originalValues.value.maxQueueSize;

    hasUnsavedChanges.value = changed;
  }

  /**
   * Load settings from storage
   */
  async function loadSettings() {
    isLoading.value = true;
    try {
      await loadConfig();
      const cfg = config.value;

      apiKey.value = cfg.apiKey;
      rssFeedUrl.value = cfg.rssFeedUrl;
      selectedModel.value = cfg.selectedModel;

      const prefs = cfg.matchingPreferences ?? DEFAULT_MATCHING_PREFERENCES;
      threshold.value = prefs.threshold;
      cacheTtlMinutes.value = prefs.cacheTtlMinutes;
      maxMatchedPosts.value = cfg.maxMatchedPosts ?? DEFAULT_MAX_MATCHED_POSTS;
      communicationPreferences.value = cfg.communicationPreferences ?? '';
      blogContentCharLimit.value = cfg.blogContentCharLimit ?? DEFAULT_BLOG_CONTENT_CHAR_LIMIT;
      postContentCharLimit.value = cfg.postContentCharLimit ?? DEFAULT_POST_CONTENT_CHAR_LIMIT;
      maxQueueSize.value = cfg.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;

      // Load example comments
      exampleComments.value = await getExampleComments();

      // Load cached RSS feed status
      cachedFeed.value = await getCachedRssFeed();

      // Store original values
      originalValues.value = {
        apiKey: cfg.apiKey,
        rssFeedUrl: cfg.rssFeedUrl,
        selectedModel: cfg.selectedModel,
        threshold: prefs.threshold,
        cacheTtlMinutes: prefs.cacheTtlMinutes,
        maxMatchedPosts: cfg.maxMatchedPosts ?? DEFAULT_MAX_MATCHED_POSTS,
        exampleComments: [...exampleComments.value],
        communicationPreferences: cfg.communicationPreferences ?? '',
        blogContentCharLimit: cfg.blogContentCharLimit ?? DEFAULT_BLOG_CONTENT_CHAR_LIMIT,
        postContentCharLimit: cfg.postContentCharLimit ?? DEFAULT_POST_CONTENT_CHAR_LIMIT,
        maxQueueSize: cfg.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      };

      hasUnsavedChanges.value = false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Test API key
   */
  async function testApiKey() {
    if (!apiKey.value) return;

    isTestingApiKey.value = true;
    apiKeyError.value = null;
    apiKeyValid.value = false;

    try {
      const result = await validateApiKeyWithServer(apiKey.value);
      if (result.valid) {
        apiKeyValid.value = true;
      } else {
        apiKeyError.value = result.error ?? 'Invalid API key';
      }
    } catch (error) {
      apiKeyError.value = error instanceof Error ? error.message : 'Failed to validate API key';
    } finally {
      isTestingApiKey.value = false;
    }
  }

  /**
   * Test RSS feed connection
   */
  async function testFeedConnection() {
    if (!rssFeedUrl.value) return;

    isTestingFeed.value = true;
    feedError.value = null;
    feedValid.value = false;
    feedTitle.value = null;
    feedItemCount.value = null;

    try {
      const result = await validateRssFeed(rssFeedUrl.value);
      if (result.valid) {
        feedValid.value = true;
        feedTitle.value = result.feedTitle ?? null;
        feedItemCount.value = result.itemCount ?? null;
        // Refresh cached feed status after successful test
        cachedFeed.value = await getCachedRssFeed();
      } else {
        feedError.value = result.error ?? 'Invalid RSS feed';
      }
    } catch (error) {
      feedError.value = error instanceof Error ? error.message : 'Failed to validate feed';
    } finally {
      isTestingFeed.value = false;
    }
  }

  /**
   * Save all settings
   */
  async function saveSettings() {
    isSaving.value = true;
    saveError.value = null;

    try {
      const matchingPreferences: MatchingPreferences = {
        threshold: threshold.value,
        cacheTtlMinutes: cacheTtlMinutes.value,
      };

      await update({
        apiKey: apiKey.value,
        rssFeedUrl: rssFeedUrl.value,
        selectedModel: selectedModel.value,
        matchingPreferences,
        communicationPreferences: communicationPreferences.value,
        blogContentCharLimit: blogContentCharLimit.value,
        postContentCharLimit: postContentCharLimit.value,
        maxQueueSize: maxQueueSize.value,
        maxMatchedPosts: maxMatchedPosts.value,
      });

      // Save example comments separately
      await saveExampleComments(exampleComments.value);

      // Clear RSS cache if URL or TTL changed, then re-fetch
      if (
        rssFeedUrl.value !== originalValues.value.rssFeedUrl ||
        cacheTtlMinutes.value !== originalValues.value.cacheTtlMinutes
      ) {
        await clearCachedRssFeed();
      }

      // Trigger RSS fetch to populate the cache if URL is configured
      if (rssFeedUrl.value) {
        // Fire and forget - don't block save on fetch
        sendMessage({ type: 'FETCH_RSS', url: rssFeedUrl.value }).catch(() => {
          // Ignore fetch errors during save - user can refresh manually
        });
      }

      // Update original values
      originalValues.value = {
        apiKey: apiKey.value,
        rssFeedUrl: rssFeedUrl.value,
        selectedModel: selectedModel.value,
        threshold: threshold.value,
        cacheTtlMinutes: cacheTtlMinutes.value,
        maxMatchedPosts: maxMatchedPosts.value,
        exampleComments: [...exampleComments.value],
        communicationPreferences: communicationPreferences.value,
        blogContentCharLimit: blogContentCharLimit.value,
        postContentCharLimit: postContentCharLimit.value,
        maxQueueSize: maxQueueSize.value,
      };

      hasUnsavedChanges.value = false;
      return true;
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : 'Failed to save settings';
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Cancel and discard changes
   */
  function cancelChanges() {
    // Restore original values
    apiKey.value = originalValues.value.apiKey;
    rssFeedUrl.value = originalValues.value.rssFeedUrl;
    selectedModel.value = originalValues.value.selectedModel;
    threshold.value = originalValues.value.threshold;
    cacheTtlMinutes.value = originalValues.value.cacheTtlMinutes;
    maxMatchedPosts.value = originalValues.value.maxMatchedPosts;
    exampleComments.value = [...originalValues.value.exampleComments];
    communicationPreferences.value = originalValues.value.communicationPreferences;
    blogContentCharLimit.value = originalValues.value.blogContentCharLimit;
    postContentCharLimit.value = originalValues.value.postContentCharLimit;
    maxQueueSize.value = originalValues.value.maxQueueSize;

    // Clear validation state
    apiKeyError.value = null;
    apiKeyValid.value = false;
    feedError.value = null;
    feedValid.value = false;
    feedTitle.value = null;
    feedItemCount.value = null;
    saveError.value = null;

    hasUnsavedChanges.value = false;
  }

  /**
   * Handle back navigation with unsaved changes check
   */
  function handleBack() {
    if (hasUnsavedChanges.value) {
      showUnsavedWarning.value = true;
      pendingNavigation.value = closeSettings;
    } else {
      closeSettings();
    }
  }

  /**
   * Confirm discard and navigate
   */
  function confirmDiscard() {
    cancelChanges();
    showUnsavedWarning.value = false;
    if (pendingNavigation.value) {
      pendingNavigation.value();
      pendingNavigation.value = null;
    }
  }

  /**
   * Cancel discard dialog
   */
  function cancelDiscard() {
    showUnsavedWarning.value = false;
    pendingNavigation.value = null;
  }

  /**
   * Clear all cached data (posts, matches, RSS feed cache)
   * Preserves user settings
   */
  async function clearCache() {
    isClearingCache.value = true;
    cacheCleared.value = false;

    try {
      await clearAllCaches();
      cacheCleared.value = true;
      // Reset after a few seconds
      setTimeout(() => {
        cacheCleared.value = false;
      }, 3000);
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : 'Failed to clear cache';
    } finally {
      isClearingCache.value = false;
    }
  }

  // Example comments management
  async function addExample() {
    if (!newExampleComment.value.trim()) return;

    exampleComments.value = await addExampleComment(newExampleComment.value.trim());
    newExampleComment.value = '';
  }

  async function removeExample(comment: string) {
    exampleComments.value = await removeExampleComment(comment);
  }

  async function updateExample(oldComment: string, newComment: string) {
    exampleComments.value = await updateExampleComment(oldComment, newComment);
  }

  // Load settings on mount
  onMounted(() => {
    loadSettings();
  });

  return {
    // Form state
    apiKey,
    rssFeedUrl,
    selectedModel,
    threshold,
    cacheTtlMinutes,
    maxMatchedPosts,
    exampleComments,
    newExampleComment,
    communicationPreferences,
    blogContentCharLimit,
    postContentCharLimit,
    maxQueueSize,

    // UI state
    isLoading,
    isSaving,
    isTestingApiKey,
    isTestingFeed,
    isClearingCache,
    cacheCleared,
    hasUnsavedChanges,
    showUnsavedWarning,

    // Validation state
    apiKeyError,
    apiKeyValid,
    feedError,
    feedValid,
    feedTitle,
    feedItemCount,
    saveError,

    // Computed
    canSave,
    maskedApiKey,
    rssFeedStatus,

    // Constants for UI
    cacheTtlOptions: CACHE_TTL_OPTIONS,
    maxMatchedPostsOptions: MAX_MATCHED_POSTS_OPTIONS,
    blogContentCharLimitOptions: BLOG_CONTENT_CHAR_LIMIT_OPTIONS,
    postContentCharLimitOptions: POST_CONTENT_CHAR_LIMIT_OPTIONS,

    // Actions
    loadSettings,
    testApiKey,
    testFeedConnection,
    saveSettings,
    cancelChanges,
    handleBack,
    confirmDiscard,
    cancelDiscard,
    clearCache,
    addExample,
    removeExample,
    updateExample,
  };
}
