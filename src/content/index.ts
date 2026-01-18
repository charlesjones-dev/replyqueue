/**
 * Content script entry point for ReplyQueue extension
 * Loads the appropriate platform adapter and manages post extraction
 */

import { getPlatformForUrl } from '../platforms'
import type { PlatformAdapter, ExtractedPost } from '../platforms/types'
import { PostExtractor } from './post-extractor'
import {
  sendMessage,
  type ExtensionMessage,
  type MessageResponse,
  type ExtractionStatusResponse,
  type PostsStoredResponse,
} from '../shared/messages'

const LOG_PREFIX = '[ReplyQueue]'

// Global state
let adapter: PlatformAdapter | null = null
let extractor: PostExtractor | null = null
let isInitialized = false

/**
 * Initialize the content script
 */
async function initialize(): Promise<void> {
  if (isInitialized) {
    console.warn(`${LOG_PREFIX} Already initialized`)
    return
  }

  const currentUrl = window.location.href
  console.log(`${LOG_PREFIX} Initializing on ${currentUrl}`)

  // Get the platform adapter for this URL
  adapter = getPlatformForUrl(currentUrl)

  if (!adapter) {
    console.log(`${LOG_PREFIX} No platform adapter found for this URL`)
    return
  }

  console.log(`${LOG_PREFIX} Using ${adapter.platformName} adapter`)

  // Check if this is a feed page
  const isFeedPage = adapter.isFeedPage(currentUrl)

  // Notify background script that content script is ready
  await sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    platform: adapter.platformId,
    pageUrl: currentUrl,
    isFeedPage,
  })

  if (!isFeedPage) {
    console.log(`${LOG_PREFIX} Not a feed page, extraction disabled`)
    isInitialized = true
    return
  }

  // Create the post extractor
  extractor = new PostExtractor({
    adapter,
    onPostsExtracted: handleExtractedPosts,
    debounceMs: 500,
  })

  // Start extraction automatically on feed pages
  extractor.start()

  isInitialized = true
  console.log(`${LOG_PREFIX} Content script initialized and extraction started`)
}

/**
 * Handle extracted posts by sending them to the background script
 */
async function handleExtractedPosts(posts: ExtractedPost[]): Promise<void> {
  if (posts.length === 0) {
    return
  }

  console.log(`${LOG_PREFIX} Sending ${posts.length} posts to background worker`)

  try {
    const response = await sendMessage<PostsStoredResponse>({
      type: 'POSTS_EXTRACTED',
      posts,
      platform: adapter?.platformId || 'unknown',
      pageUrl: window.location.href,
    })

    if (response.success && response.data) {
      console.log(
        `${LOG_PREFIX} Posts stored: ${response.data.storedCount} new, ` +
        `${response.data.duplicateCount} duplicates, ` +
        `${response.data.totalStored} total`
      )
    } else if (!response.success) {
      console.error(`${LOG_PREFIX} Failed to store posts:`, response.error)
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error sending posts to background:`, error)
  }
}

/**
 * Handle messages from the background script
 */
function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): boolean {
  console.log(`${LOG_PREFIX} Received message:`, message.type)

  switch (message.type) {
    case 'START_EXTRACTION':
      if (extractor) {
        extractor.start()
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false, error: 'Extractor not initialized' })
      }
      break

    case 'STOP_EXTRACTION':
      if (extractor) {
        extractor.stop()
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false, error: 'Extractor not initialized' })
      }
      break

    case 'GET_EXTRACTION_STATUS':
      const statusResponse: ExtractionStatusResponse = {
        isExtracting: extractor !== null,
        extractedCount: extractor?.getExtractedCount() || 0,
        platform: adapter?.platformId || 'none',
      }
      sendResponse({ success: true, data: statusResponse })
      break

    case 'SCROLL_TO_POST':
      if (adapter && message.postId) {
        const found = adapter.scrollToPost(message.postId)
        sendResponse({ success: found, error: found ? undefined : 'Post not found in DOM' })
      } else {
        sendResponse({ success: false, error: 'Adapter not initialized or missing postId' })
      }
      break

    default:
      // Unknown message type, acknowledge but do nothing
      sendResponse({ success: true, data: { message: 'Unknown message type' } })
  }

  // Return true to indicate we'll send a response asynchronously
  return true
}

/**
 * Handle page navigation (for SPAs like LinkedIn)
 */
function handleNavigation(): void {
  // Re-check if we're on a feed page after navigation
  if (adapter && extractor) {
    const isFeedPage = adapter.isFeedPage(window.location.href)

    if (isFeedPage) {
      // Make sure extraction is running
      extractor.start()
      console.log(`${LOG_PREFIX} Navigation detected, continuing extraction`)
    } else {
      // Stop extraction on non-feed pages
      extractor.stop()
      console.log(`${LOG_PREFIX} Left feed page, extraction stopped`)
    }
  }
}

// Set up message listener
chrome.runtime.onMessage.addListener(handleMessage)

// Listen for SPA navigation using the History API
let lastUrl = window.location.href
const navigationObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    console.log(`${LOG_PREFIX} Navigation detected: ${lastUrl}`)
    handleNavigation()
  }
})

// Observe the document for changes that might indicate navigation
navigationObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
})

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  console.log(`${LOG_PREFIX} Popstate navigation detected`)
  handleNavigation()
})

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  // DOM is already ready
  initialize()
}

console.log(`${LOG_PREFIX} Content script loaded on ${window.location.hostname}`)

export {}
