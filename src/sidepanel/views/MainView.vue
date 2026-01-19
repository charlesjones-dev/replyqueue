<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppState } from '../composables/useAppState';
import { usePosts, type PostFilter } from '../composables/usePosts';
import { useConfig } from '../composables/useConfig';
import { useToast } from '../composables/useToast';
import { useNetworkStatus } from '../composables/useNetworkStatus';
import { useCreditsModal } from '../composables/useCreditsModal';
import { useTabStatus } from '../composables/useTabStatus';
import { sendMessage, sendTabMessage, type MessageResponse } from '@shared/messages';
import PostCard from '../components/PostCard.vue';
import QueuedPostCard from '../components/QueuedPostCard.vue';
import PostCardSkeleton from '../components/PostCardSkeleton.vue';
import Toast from '../components/Toast.vue';
import TabStatusBadge from '../components/TabStatusBadge.vue';

const { openSettings, openSetup } = useAppState();
const { config, requestRssFeedPermission } = useConfig();
const toast = useToast();
const { isOnline } = useNetworkStatus();
const creditsModal = useCreditsModal();
const { isActiveOnPlatform, currentPlatform } = useTabStatus();
const {
  filteredMatchedPosts,
  extractedPosts,
  queuedPosts,
  unmatchedPosts,
  queuedCount,
  matchedCount,
  unmatchedCount,
  isLoading,
  isRefreshing,
  error,
  currentFilter,
  repliedCount,
  skippedCount,
  refreshMatches,
  loadPosts,
  skipPost,
  markAsReplied,
  setFilter,
  isQueueAtLimit,
  maxQueueSize,
} = usePosts();

// Extension version from manifest
const extensionVersion = computed(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version;
  }
  return '';
});

// AI matching state (includes heat check)
const isAIMatching = ref(false);
const aiMatchError = ref<string | null>(null);

// Format error message for user display
function formatErrorMessage(error: string): string {
  // Handle common error cases with user-friendly messages
  if (error.includes('network') || error.includes('fetch') || error.includes('Failed to fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (error.includes('401') || error.includes('Unauthorized')) {
    return 'API key is invalid or expired. Please update your API key in settings.';
  }
  if (error.includes('429') || error.includes('rate limit')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }
  if (error.includes('500') || error.includes('502') || error.includes('503')) {
    return 'Server error. The service may be temporarily unavailable. Please try again later.';
  }
  if (error.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  return error;
}

// Run AI matching (includes heat check)
async function runAIMatching() {
  if (!isOnline.value) {
    toast.warning('You are offline. Please check your internet connection.');
    return;
  }

  if (!config.value.apiKey) {
    aiMatchError.value = 'API key not configured';
    openSetup();
    return;
  }

  isAIMatching.value = true;
  aiMatchError.value = null;

  try {
    // Step 1: Run AI matching
    const matchResponse = (await sendMessage({ type: 'AI_MATCH_POSTS' })) as MessageResponse;
    console.log('[MainView] AI_MATCH_POSTS response:', matchResponse);

    if (!matchResponse.success) {
      console.log('[MainView] Response error:', matchResponse.error);

      // Check for RSS permission required error
      if (matchResponse.error === 'RSS_PERMISSION_REQUIRED') {
        console.log('[MainView] RSS permission required, requesting...');
        toast.warning('Permission required to access your RSS feed.');

        // Request permission - we're in a user gesture context from the button click
        const granted = await requestRssFeedPermission();

        if (granted) {
          toast.success('Permission granted! Retrying...');
          // Retry the AI matching now that we have permission
          const retryResponse = (await sendMessage({ type: 'AI_MATCH_POSTS' })) as MessageResponse;
          if (retryResponse.success) {
            // Continue with heat check
            const heatCheckResponse = (await sendMessage({ type: 'HEAT_CHECK_POSTS' })) as MessageResponse;
            if (!heatCheckResponse.success && heatCheckResponse.error !== 'INSUFFICIENT_CREDITS') {
              console.warn('Heat check failed:', heatCheckResponse.error);
            }
            await loadPosts();
            setFilter('matched');
            toast.success('AI matching complete');
            isAIMatching.value = false;
            return;
          }
          throw new Error(retryResponse.error ?? 'AI matching failed after permission grant');
        } else {
          aiMatchError.value = 'Permission denied. Please grant access to your RSS feed URL in settings.';
          isAIMatching.value = false;
          return;
        }
      }

      // Check for insufficient credits error
      if (matchResponse.error === 'INSUFFICIENT_CREDITS') {
        console.log('[MainView] Showing credits modal');
        creditsModal.show(matchResponse.errorData?.requestedTokens, matchResponse.errorData?.availableTokens);
        isAIMatching.value = false;
        return;
      }
      throw new Error(matchResponse.error ?? 'AI matching failed');
    }

    // Step 2: Run heat check on matched posts
    const heatCheckResponse = (await sendMessage({ type: 'HEAT_CHECK_POSTS' })) as MessageResponse;

    if (!heatCheckResponse.success) {
      // Check for insufficient credits error in heat check
      if (heatCheckResponse.error === 'INSUFFICIENT_CREDITS') {
        creditsModal.show(heatCheckResponse.errorData?.requestedTokens, heatCheckResponse.errorData?.availableTokens);
        // Still load posts since AI matching succeeded
        await loadPosts();
        setFilter('matched');
        toast.warning('AI matching complete, but heat check requires more credits');
        isAIMatching.value = false;
        return;
      }
      console.warn('Heat check failed:', heatCheckResponse.error);
      // Don't fail the whole operation if heat check fails
    }

    // Reload posts to show matches with heat check results
    await loadPosts();
    setFilter('matched');
    toast.success('AI matching complete');
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'AI matching failed';
    aiMatchError.value = formatErrorMessage(errorMsg);
    toast.error('AI matching failed');
  } finally {
    isAIMatching.value = false;
  }
}

// Handle regenerate suggestions
async function handleRegenerate(postId: string, platform: string) {
  try {
    const response = (await sendMessage({
      type: 'REGENERATE_SUGGESTIONS',
      postId,
      platform,
    } as never)) as MessageResponse;

    if (!response.success) {
      // Check for insufficient credits error
      if (response.error === 'INSUFFICIENT_CREDITS') {
        creditsModal.show(response.errorData?.requestedTokens, response.errorData?.availableTokens);
        return;
      }
      throw new Error(response.error ?? 'Failed to regenerate suggestions');
    }

    // Reload posts to show new suggestions
    await loadPosts();
  } catch (e) {
    console.error('Failed to regenerate suggestions:', e);
    toast.error('Failed to regenerate suggestions');
  }
}

const filters: { value: PostFilter; label: string }[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'matched', label: 'Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'replied', label: 'Replied' },
  { value: 'skipped', label: 'Skipped' },
];

function getFilterCount(filter: PostFilter): number {
  switch (filter) {
    case 'queued':
      return queuedCount.value;
    case 'matched':
      return matchedCount.value;
    case 'unmatched':
      return unmatchedCount.value;
    case 'replied':
      return repliedCount.value;
    case 'skipped':
      return skippedCount.value;
    default:
      return 0;
  }
}

function handleSkip(postId: string, platform: string) {
  skipPost(postId, platform);
}

function handleReplied(postId: string, platform: string) {
  markAsReplied(postId, platform);
  toast.success('Marked as replied');
}

function handleOpen(postId: string, platform: string) {
  // Find the post and open its URL
  const post = filteredMatchedPosts.value.find((p) => p.post.id === postId && p.post.platform === platform);
  if (post?.post.url) {
    window.open(post.post.url, '_blank');
  }
}

function handleOpenQueued(postId: string, platform: string) {
  // Find the queued post and open its URL
  const post = extractedPosts.value.find((p) => p.id === postId && p.platform === platform);
  if (post?.url) {
    window.open(post.url, '_blank');
  }
}

// Handle skip queued post - sends message to background to skip before AI analysis
async function handleSkipQueued(postId: string, platform: string) {
  try {
    const response = (await sendMessage({
      type: 'SKIP_QUEUED_POST',
      postId,
      platform,
    } as never)) as MessageResponse;

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to skip post');
    }

    // Reload posts to reflect the change
    await loadPosts();
    toast.success('Post skipped');
  } catch (error) {
    console.error('Failed to skip queued post:', error);
    toast.error('Failed to skip post');
  }
}

// Handle jump to queued post - sends message to content script to scroll to the post
async function handleJumpToQueuedPost(postId: string, _platform: string) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      toast.error('No active tab found. Make sure LinkedIn is open.');
      return;
    }

    if (!activeTab.url?.includes('linkedin.com')) {
      toast.warning('Navigate to LinkedIn to jump to this post.');
      return;
    }

    const response = await sendTabMessage(activeTab.id, {
      type: 'SCROLL_TO_POST',
      postId,
    });

    if (response.success) {
      toast.success('Scrolled to post');
    } else {
      toast.warning('Post not found in current feed. It may have scrolled out of view.');
    }
  } catch (error) {
    console.error('Failed to jump to post:', error);
    toast.error('Failed to jump to post. Make sure LinkedIn is open.');
  }
}

// Handle jump to post - sends message to content script to scroll to the post
async function handleJumpToPost(postId: string, _platform: string) {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      toast.error('No active tab found. Make sure LinkedIn is open.');
      return;
    }

    // Check if we're on LinkedIn
    if (!activeTab.url?.includes('linkedin.com')) {
      toast.warning('Navigate to LinkedIn to jump to this post.');
      return;
    }

    // Send message to content script to scroll to the post
    const response = await sendTabMessage(activeTab.id, {
      type: 'SCROLL_TO_POST',
      postId,
    });

    if (response.success) {
      toast.success('Scrolled to post');
    } else {
      // Post not found in DOM
      toast.warning('Post not found in current feed. It may have scrolled out of view.');
    }
  } catch (error) {
    console.error('Failed to jump to post:', error);
    toast.error('Failed to jump to post. Make sure LinkedIn is open.');
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <!-- Toast notifications -->
    <Toast />

    <div class="mx-auto max-w-md">
      <!-- Offline banner -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-full opacity-0"
      >
        <div
          v-if="!isOnline"
          class="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2"
        >
          <svg class="h-5 w-5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <span class="text-sm text-yellow-700"> You're offline. Some features may be unavailable. </span>
        </div>
      </Transition>

      <!-- Header -->
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-baseline gap-2">
          <h1 class="text-xl font-bold text-gray-900">ReplyQueue</h1>
          <span v-if="extensionVersion" class="text-xs text-gray-400">v{{ extensionVersion }}</span>
        </div>
        <div class="flex items-center gap-2">
          <TabStatusBadge :is-active="isActiveOnPlatform" :platform="currentPlatform" />
          <button
            type="button"
            class="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            @click="openSettings"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Queue limit warning banner -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-full opacity-0"
      >
        <div
          v-if="isQueueAtLimit"
          class="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
        >
          <svg class="h-5 w-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span class="text-sm text-amber-700">
            Queue limit reached ({{ maxQueueSize }} posts). Run AI Match or adjust limit in settings.
          </span>
        </div>
      </Transition>

      <!-- Filter tabs -->
      <div class="mb-4 flex rounded-lg bg-gray-100 p-1">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
          :class="
            currentFilter === filter.value ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'
          "
          @click="setFilter(filter.value)"
        >
          {{ filter.label }}
          <span
            class="ml-1 rounded-full px-1.5 text-xs"
            :class="currentFilter === filter.value ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'"
          >
            {{ getFilterCount(filter.value) }}
          </span>
        </button>
      </div>

      <!-- Loading state with skeleton loaders -->
      <div v-if="isLoading" class="space-y-4">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
        <svg class="mx-auto h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-red-800">Something went wrong</h3>
        <p class="mt-1 text-sm text-red-600">{{ formatErrorMessage(error) }}</p>
        <div class="mt-4 flex justify-center gap-3">
          <button
            type="button"
            class="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
            :disabled="!isOnline"
            @click="refreshMatches"
          >
            <span class="flex items-center gap-1">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry
            </span>
          </button>
          <button
            type="button"
            class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            @click="openSettings"
          >
            Settings
          </button>
        </div>
      </div>

      <!-- Empty state for queued tab -->
      <div
        v-else-if="currentFilter === 'queued' && queuedPosts.length === 0"
        class="rounded-lg bg-white p-6 text-center shadow"
      >
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Queue is empty</h3>
        <p class="mt-1 text-xs text-gray-500">
          <template v-if="extractedPosts.length > 0">
            All posts have been analyzed. Navigate to LinkedIn to collect more posts.
          </template>
          <template v-else>
            Navigate to a LinkedIn feed to start collecting posts. Posts will appear here automatically as you scroll.
          </template>
        </p>
      </div>

      <!-- Empty state for unmatched tab -->
      <div
        v-else-if="currentFilter === 'unmatched' && unmatchedPosts.length === 0"
        class="rounded-lg bg-white p-6 text-center shadow"
      >
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No unmatched posts</h3>
        <p class="mt-1 text-xs text-gray-500">
          Posts that don't match your blog content will appear here after AI analysis.
        </p>
        <button type="button" class="mt-3 text-sm text-blue-600 hover:underline" @click="setFilter('queued')">
          View queued posts
        </button>
      </div>

      <!-- Empty state for matched/replied/skipped tabs -->
      <div
        v-else-if="currentFilter !== 'queued' && currentFilter !== 'unmatched' && filteredMatchedPosts.length === 0"
        class="rounded-lg bg-white p-6 text-center shadow"
      >
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No {{ currentFilter }} posts</h3>
        <p class="mt-1 text-xs text-gray-500">
          <template v-if="currentFilter === 'matched'">
            Use the AI Match button to analyze queued posts and find relevant matches.
          </template>
          <template v-else> No posts with status "{{ currentFilter }}" found. </template>
        </p>
        <button type="button" class="mt-3 text-sm text-blue-600 hover:underline" @click="setFilter('queued')">
          View queued posts
        </button>
      </div>

      <!-- Queued posts list -->
      <div v-else-if="currentFilter === 'queued'" class="space-y-4">
        <!-- AI Match button -->
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-blue-900">Ready to analyze?</p>
              <p class="text-xs text-blue-700">
                {{ queuedPosts.length }} post{{ queuedPosts.length === 1 ? '' : 's' }} in queue
              </p>
            </div>
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              :disabled="isAIMatching || !config.apiKey || queuedPosts.length === 0"
              title="Find relevant posts and analyze their tone"
              @click="runAIMatching"
            >
              <svg v-if="isAIMatching" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {{ isAIMatching ? 'Analyzing...' : 'AI Match' }}
            </button>
          </div>
          <p v-if="aiMatchError" class="mt-2 text-xs text-red-600">{{ aiMatchError }}</p>
          <p v-if="!config.apiKey" class="mt-2 text-xs text-amber-600">
            Configure your API key in settings to use AI matching.
          </p>
        </div>

        <QueuedPostCard
          v-for="post in queuedPosts"
          :key="`${post.platform}:${post.id}`"
          :post="post"
          @open="handleOpenQueued"
          @jump-to-post="handleJumpToQueuedPost"
          @skip="handleSkipQueued"
        />
      </div>

      <!-- Unmatched posts list -->
      <div v-else-if="currentFilter === 'unmatched'" class="space-y-4">
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p class="text-sm text-gray-600">
            These posts were analyzed but didn't match your blog content above the relevance threshold.
          </p>
        </div>

        <QueuedPostCard
          v-for="post in unmatchedPosts"
          :key="`${post.platform}:${post.id}`"
          :post="post"
          @open="handleOpenQueued"
          @jump-to-post="handleJumpToQueuedPost"
        />
      </div>

      <!-- Matched/Replied/Skipped posts list -->
      <div v-else class="space-y-4">
        <PostCard
          v-for="match in filteredMatchedPosts"
          :key="`${match.post.platform}:${match.post.id}`"
          :match="match"
          @skip="handleSkip"
          @replied="handleReplied"
          @open="handleOpen"
          @regenerate="handleRegenerate"
          @jump-to-post="handleJumpToPost"
        />
      </div>

      <!-- Refreshing overlay -->
      <div
        v-if="isRefreshing"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg"
      >
        <span class="flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Refreshing matches...
        </span>
      </div>
    </div>
  </div>
</template>
