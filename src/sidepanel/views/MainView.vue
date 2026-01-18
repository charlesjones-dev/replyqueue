<script setup lang="ts">
import { ref } from 'vue'
import { useAppState } from '../composables/useAppState'
import { usePosts } from '../composables/usePosts'
import { useConfig } from '../composables/useConfig'
import { useToast } from '../composables/useToast'
import { useNetworkStatus } from '../composables/useNetworkStatus'
import { useCreditsModal } from '../composables/useCreditsModal'
import { sendMessage, sendTabMessage, type MessageResponse } from '@shared/messages'
import StatusBar from '../components/StatusBar.vue'
import PostCard from '../components/PostCard.vue'
import PostCardSkeleton from '../components/PostCardSkeleton.vue'
import ModelSelector from '../components/ModelSelector.vue'
import Toast from '../components/Toast.vue'

const { openSettings, openSetup } = useAppState()
const { config, update: updateConfig } = useConfig()
const toast = useToast()
const { isOnline } = useNetworkStatus()
const creditsModal = useCreditsModal()
const {
  filteredPosts,
  extractedPostCount,
  totalMatches,
  isLoading,
  isRefreshing,
  error,
  currentFilter,
  rssFeedStatus,
  pendingCount,
  repliedCount,
  skippedCount,
  refreshMatches,
  loadPosts,
  skipPost,
  markAsReplied,
  setFilter,
} = usePosts()

// AI matching state (includes heat check)
const isAIMatching = ref(false)
const aiMatchError = ref<string | null>(null)

// Handle model change
async function handleModelChange(modelId: string) {
  await updateConfig({ selectedModel: modelId })
}

// Format error message for user display
function formatErrorMessage(error: string): string {
  // Handle common error cases with user-friendly messages
  if (error.includes('network') || error.includes('fetch') || error.includes('Failed to fetch')) {
    return 'Network error. Please check your internet connection and try again.'
  }
  if (error.includes('401') || error.includes('Unauthorized')) {
    return 'API key is invalid or expired. Please update your API key in settings.'
  }
  if (error.includes('429') || error.includes('rate limit')) {
    return 'Rate limit exceeded. Please wait a moment and try again.'
  }
  if (error.includes('500') || error.includes('502') || error.includes('503')) {
    return 'Server error. The service may be temporarily unavailable. Please try again later.'
  }
  if (error.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }
  return error
}

// Run AI matching (includes heat check)
async function runAIMatching() {
  if (!isOnline.value) {
    toast.warning('You are offline. Please check your internet connection.')
    return
  }

  if (!config.value.apiKey) {
    aiMatchError.value = 'API key not configured'
    openSetup()
    return
  }

  isAIMatching.value = true
  aiMatchError.value = null

  try {
    // Step 1: Run AI matching
    const matchResponse = await sendMessage({ type: 'AI_MATCH_POSTS' }) as MessageResponse
    console.log('[MainView] AI_MATCH_POSTS response:', matchResponse)

    if (!matchResponse.success) {
      console.log('[MainView] Response error:', matchResponse.error)
      // Check for insufficient credits error
      if (matchResponse.error === 'INSUFFICIENT_CREDITS') {
        console.log('[MainView] Showing credits modal')
        creditsModal.show(
          matchResponse.errorData?.requestedTokens,
          matchResponse.errorData?.availableTokens
        )
        isAIMatching.value = false
        return
      }
      throw new Error(matchResponse.error ?? 'AI matching failed')
    }

    // Step 2: Run heat check on matched posts
    const heatCheckResponse = await sendMessage({ type: 'HEAT_CHECK_POSTS' }) as MessageResponse

    if (!heatCheckResponse.success) {
      // Check for insufficient credits error in heat check
      if (heatCheckResponse.error === 'INSUFFICIENT_CREDITS') {
        creditsModal.show(
          heatCheckResponse.errorData?.requestedTokens,
          heatCheckResponse.errorData?.availableTokens
        )
        // Still load posts since AI matching succeeded
        await loadPosts()
        toast.warning('AI matching complete, but heat check requires more credits')
        isAIMatching.value = false
        return
      }
      console.warn('Heat check failed:', heatCheckResponse.error)
      // Don't fail the whole operation if heat check fails
    }

    // Reload posts to show matches with heat check results
    await loadPosts()
    toast.success('AI matching complete')
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'AI matching failed'
    aiMatchError.value = formatErrorMessage(errorMsg)
    toast.error('AI matching failed')
  } finally {
    isAIMatching.value = false
  }
}

// Handle regenerate suggestions
async function handleRegenerate(postId: string, platform: string) {
  try {
    const response = await sendMessage({
      type: 'REGENERATE_SUGGESTIONS',
      postId,
      platform,
    } as never) as MessageResponse

    if (!response.success) {
      // Check for insufficient credits error
      if (response.error === 'INSUFFICIENT_CREDITS') {
        creditsModal.show(
          response.errorData?.requestedTokens,
          response.errorData?.availableTokens
        )
        return
      }
      throw new Error(response.error ?? 'Failed to regenerate suggestions')
    }

    // Reload posts to show new suggestions
    await loadPosts()
  } catch (e) {
    console.error('Failed to regenerate suggestions:', e)
    toast.error('Failed to regenerate suggestions')
  }
}

type FilterOption = 'all' | 'pending' | 'replied' | 'skipped'

const filters: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'replied', label: 'Replied' },
  { value: 'skipped', label: 'Skipped' },
]

function getFilterCount(filter: FilterOption): number {
  switch (filter) {
    case 'all':
      return totalMatches.value
    case 'pending':
      return pendingCount.value
    case 'replied':
      return repliedCount.value
    case 'skipped':
      return skippedCount.value
    default:
      return 0
  }
}

function handleSkip(postId: string, platform: string) {
  skipPost(postId, platform)
}

function handleReplied(postId: string, platform: string) {
  markAsReplied(postId, platform)
  toast.success('Marked as replied')
}

function handleOpen(postId: string, platform: string) {
  // Find the post and open its URL
  const post = filteredPosts.value.find(
    p => p.post.id === postId && p.post.platform === platform
  )
  if (post?.post.url) {
    window.open(post.post.url, '_blank')
  }
}

// Handle jump to post - sends message to content script to scroll to the post
async function handleJumpToPost(postId: string, _platform: string) {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]

    if (!activeTab?.id) {
      toast.error('No active tab found. Make sure LinkedIn is open.')
      return
    }

    // Check if we're on LinkedIn
    if (!activeTab.url?.includes('linkedin.com')) {
      toast.warning('Navigate to LinkedIn to jump to this post.')
      return
    }

    // Send message to content script to scroll to the post
    const response = await sendTabMessage(activeTab.id, {
      type: 'SCROLL_TO_POST',
      postId,
    })

    if (response.success) {
      toast.success('Scrolled to post')
    } else {
      // Post not found in DOM
      toast.warning('Post not found in current feed. It may have scrolled out of view.')
    }
  } catch (error) {
    console.error('Failed to jump to post:', error)
    toast.error('Failed to jump to post. Make sure LinkedIn is open.')
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
          <svg
            class="h-5 w-5 text-yellow-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <span class="text-sm text-yellow-700">
            You're offline. Some features may be unavailable.
          </span>
        </div>
      </Transition>

      <!-- Header -->
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">ReplyQueue</h1>
        <button
          type="button"
          class="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          @click="openSettings"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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

      <!-- Model Selector -->
      <div class="mb-4">
        <label class="mb-1 block text-xs font-medium text-gray-700">AI Model</label>
        <div class="flex gap-2">
          <div class="flex-1">
            <ModelSelector
              :model-value="config.selectedModel"
              @update:model-value="handleModelChange"
            />
          </div>
          <button
            type="button"
            class="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            :disabled="isAIMatching || !config.apiKey"
            title="Find relevant posts and analyze their tone"
            @click="runAIMatching"
          >
            <svg
              v-if="isAIMatching"
              class="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span class="hidden sm:inline">{{ isAIMatching ? 'Analyzing...' : 'AI Match' }}</span>
          </button>
        </div>
        <p v-if="aiMatchError" class="mt-1 text-xs text-red-600">{{ aiMatchError }}</p>
      </div>

      <!-- Status Bar -->
      <StatusBar
        :rss-feed-connected="rssFeedStatus.connected"
        :rss-feed-message="rssFeedStatus.message"
        :extracted-post-count="extractedPostCount"
        :matched-post-count="totalMatches"
        :is-refreshing="isRefreshing"
        class="mb-4"
        @refresh="refreshMatches"
      />

      <!-- Filter tabs -->
      <div class="mb-4 flex rounded-lg bg-gray-100 p-1">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
          :class="
            currentFilter === filter.value
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-600 hover:text-gray-900'
          "
          @click="setFilter(filter.value)"
        >
          {{ filter.label }}
          <span
            class="ml-1 rounded-full px-1.5 text-xs"
            :class="
              currentFilter === filter.value
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-200 text-gray-500'
            "
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
      <div
        v-else-if="error"
        class="rounded-lg bg-red-50 border border-red-200 p-4 text-center"
      >
        <svg
          class="mx-auto h-10 w-10 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
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

      <!-- Empty state -->
      <div
        v-else-if="filteredPosts.length === 0"
        class="rounded-lg bg-white p-6 text-center shadow"
      >
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No posts found</h3>
        <p class="mt-1 text-xs text-gray-500">
          <template v-if="currentFilter === 'all'">
            Navigate to a LinkedIn feed to start extracting posts, or check your RSS feed settings.
          </template>
          <template v-else>
            No posts with status "{{ currentFilter }}" found.
          </template>
        </p>
        <button
          v-if="currentFilter !== 'all'"
          type="button"
          class="mt-3 text-sm text-blue-600 hover:underline"
          @click="setFilter('all')"
        >
          View all posts
        </button>
      </div>

      <!-- Posts list -->
      <div v-else class="space-y-4">
        <PostCard
          v-for="match in filteredPosts"
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
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Refreshing matches...
        </span>
      </div>
    </div>
  </div>
</template>
