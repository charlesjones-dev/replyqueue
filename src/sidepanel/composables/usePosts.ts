/**
 * Posts composable
 * Manages matched posts display and status
 */

import { ref, shallowRef, computed, onMounted, triggerRef } from 'vue'
import type { MatchedPostWithScore, CachedRssFeed } from '@shared/types'
import { MAX_MATCHED_POSTS } from '@shared/constants'
import {
  getMatchedPostsWithScore,
  saveMatchedPostsWithScore,
  getCachedRssFeed,
  isCachedFeedValid,
  getExtractedPosts,
} from '@shared/storage'
import { sendMessage } from '@shared/messages'

export type PostFilter = 'all' | 'pending' | 'replied' | 'skipped'

export function usePosts() {
  // State - use shallowRef for large arrays to improve performance
  const matchedPosts = shallowRef<MatchedPostWithScore[]>([])
  const cachedFeed = shallowRef<CachedRssFeed | null>(null)
  const extractedPostCount = ref(0)
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)
  const currentFilter = ref<PostFilter>('all')
  const lastRefreshedAt = ref<number | null>(null)

  // Computed values
  const filteredPosts = computed(() => {
    if (currentFilter.value === 'all') {
      return matchedPosts.value
    }
    return matchedPosts.value.filter(p => p.status === currentFilter.value)
  })

  const pendingCount = computed(() =>
    matchedPosts.value.filter(p => p.status === 'pending').length
  )

  const repliedCount = computed(() =>
    matchedPosts.value.filter(p => p.status === 'replied').length
  )

  const skippedCount = computed(() =>
    matchedPosts.value.filter(p => p.status === 'skipped').length
  )

  const totalMatches = computed(() => matchedPosts.value.length)

  const hasRssFeed = computed(() => cachedFeed.value !== null)

  const rssFeedStatus = computed(() => {
    if (!cachedFeed.value) {
      return { connected: false, message: 'No RSS feed configured' }
    }

    if (!isCachedFeedValid(cachedFeed.value)) {
      return { connected: false, message: 'RSS feed cache expired' }
    }

    const minutesAgo = Math.round((Date.now() - cachedFeed.value.fetchedAt) / 1000 / 60)
    return {
      connected: true,
      message: `Last updated ${minutesAgo}m ago`,
      feedTitle: cachedFeed.value.feed.title,
      itemCount: cachedFeed.value.feed.items.length,
    }
  })

  /**
   * Load matched posts and feed status from storage
   */
  async function loadPosts() {
    isLoading.value = true
    error.value = null

    try {
      // Load matched posts - limit to MAX_MATCHED_POSTS for performance
      const posts = await getMatchedPostsWithScore()
      matchedPosts.value = posts.slice(0, MAX_MATCHED_POSTS)
      triggerRef(matchedPosts)

      // Load cached feed status
      cachedFeed.value = await getCachedRssFeed()
      triggerRef(cachedFeed)

      // Get extracted post count
      const extracted = await getExtractedPosts()
      extractedPostCount.value = extracted.length
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load posts'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh RSS feed and re-match posts
   */
  async function refreshMatches() {
    isRefreshing.value = true
    error.value = null

    try {
      // Request background to refresh RSS and re-match
      const response = await sendMessage({ type: 'FETCH_RSS', url: '' })

      if (!response.success) {
        throw new Error(response.error ?? 'Failed to refresh matches')
      }

      // Reload posts
      await loadPosts()

      // Update last refreshed timestamp
      lastRefreshedAt.value = Date.now()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to refresh matches'
    } finally {
      isRefreshing.value = false
    }
  }

  /**
   * Trigger content script to re-scan the current feed
   */
  async function rescanFeed() {
    try {
      // Get the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeTab = tabs[0]

      if (!activeTab?.id) {
        throw new Error('No active tab found')
      }

      // Send message to content script to restart extraction
      await chrome.tabs.sendMessage(activeTab.id, { type: 'START_EXTRACTION' })

      // Wait a bit for extraction to complete, then refresh
      await new Promise(resolve => setTimeout(resolve, 1000))
      await refreshMatches()
    } catch (e) {
      // Silently fail - content script may not be on a supported page
      console.warn('Could not trigger feed rescan:', e)
    }
  }

  /**
   * Update post status
   */
  async function updatePostStatus(
    postId: string,
    platform: string,
    status: MatchedPostWithScore['status']
  ) {
    const updated = matchedPosts.value.map(p => {
      if (p.post.id === postId && p.post.platform === platform) {
        return { ...p, status }
      }
      return p
    })

    matchedPosts.value = updated
    triggerRef(matchedPosts)
    await saveMatchedPostsWithScore(updated)
  }

  /**
   * Skip a post
   */
  async function skipPost(postId: string, platform: string) {
    await updatePostStatus(postId, platform, 'skipped')
  }

  /**
   * Mark post as replied
   */
  async function markAsReplied(postId: string, platform: string) {
    await updatePostStatus(postId, platform, 'replied')
  }

  /**
   * Reset post to pending
   */
  async function resetPost(postId: string, platform: string) {
    await updatePostStatus(postId, platform, 'pending')
  }

  /**
   * Set filter
   */
  function setFilter(filter: PostFilter) {
    currentFilter.value = filter
  }

  /**
   * Get a single post by ID
   */
  function getPost(postId: string, platform: string): MatchedPostWithScore | undefined {
    return matchedPosts.value.find(
      p => p.post.id === postId && p.post.platform === platform
    )
  }

  /**
   * Format score as percentage
   */
  function formatScore(score: number): string {
    return `${Math.round(score * 100)}%`
  }

  /**
   * Format relative time
   */
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Load posts on mount
  onMounted(() => {
    loadPosts()
  })

  return {
    // State
    matchedPosts,
    cachedFeed,
    extractedPostCount,
    isLoading,
    isRefreshing,
    error,
    currentFilter,
    lastRefreshedAt,

    // Computed
    filteredPosts,
    pendingCount,
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
  }
}
