/**
 * Background service worker for ReplyQueue extension
 * Handles message passing from content scripts and manages post storage
 */

import type {
  ExtractedPostRecord,
  CachedRssFeed,
  MatchResult,
  OpenRouterModel,
  ReplySuggestion,
} from '../shared/types';
import type { ExtractedPost } from '../platforms/types';
import {
  type ExtensionMessage,
  type MessageResponse,
  type PostsStoredResponse,
  isPostsExtractedMessage,
  isContentScriptReadyMessage,
} from '../shared/messages';
import {
  addExtractedPosts,
  getConfig,
  updateConfig,
  getExtractedPosts,
  getMatchedPostsWithScore,
  saveMatchedPostsWithScore,
  getCachedRssFeed,
  saveCachedRssFeed,
  isCachedFeedValid,
  addEvaluatedPostIds,
} from '../shared/storage';
import {
  DEFAULT_MATCHING_PREFERENCES,
  DEFAULT_BLOG_CONTENT_CHAR_LIMIT,
  DEFAULT_POST_CONTENT_CHAR_LIMIT,
} from '../shared/constants';
import { fetchRssFeed } from './rss-fetcher';
import { mergeMatches, aiMatchPosts, generateReplySuggestions, heatCheckPosts } from './matcher';
import { fetchModelsWithCache, InsufficientCreditsError } from './openrouter';

const LOG_PREFIX = '[ReplyQueue:Background]';

// Track active content scripts
const activeContentScripts = new Map<number, { platform: string; pageUrl: string; isFeedPage: boolean }>();

// Register the service worker
console.log(`${LOG_PREFIX} Background service worker initialized`);

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

/**
 * Convert ExtractedPost to ExtractedPostRecord for storage
 */
function toStorageRecord(post: ExtractedPost, pageUrl: string): ExtractedPostRecord {
  return {
    id: post.id,
    platform: post.platform,
    url: post.url,
    authorName: post.authorName,
    authorHeadline: post.authorHeadline,
    authorProfileUrl: post.authorProfileUrl,
    content: post.content,
    publishedAt: post.publishedAt,
    reactionCount: post.reactionCount,
    commentCount: post.commentCount,
    repostCount: post.repostCount,
    isRepost: post.isRepost,
    contentType: post.contentType,
    extractedAt: post.extractedAt,
    sourcePageUrl: pageUrl,
  };
}

/**
 * Handle POSTS_EXTRACTED message from content script
 */
async function handlePostsExtracted(
  message: ExtensionMessage,
  senderId: number | undefined
): Promise<MessageResponse<PostsStoredResponse>> {
  if (!isPostsExtractedMessage(message)) {
    return { success: false, error: 'Invalid message type' };
  }

  const { posts, platform, pageUrl } = message;

  console.log(`${LOG_PREFIX} Received ${posts.length} posts from ${platform} (tab ${senderId})`);

  try {
    // Convert to storage records
    const records = posts.map((post) => toStorageRecord(post, pageUrl));

    // Add to storage with deduplication
    const result = await addExtractedPosts(records);

    console.log(
      `${LOG_PREFIX} Stored ${result.added} new posts, ` + `${result.duplicates} duplicates, ${result.total} total`
    );

    return {
      success: true,
      data: {
        storedCount: result.added,
        duplicateCount: result.duplicates,
        totalStored: result.total,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error storing posts:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle CONTENT_SCRIPT_READY message
 */
function handleContentScriptReady(message: ExtensionMessage, senderId: number | undefined): MessageResponse {
  if (!isContentScriptReadyMessage(message)) {
    return { success: false, error: 'Invalid message type' };
  }

  const { platform, pageUrl, isFeedPage } = message;

  if (senderId !== undefined) {
    activeContentScripts.set(senderId, { platform, pageUrl, isFeedPage });
    console.log(`${LOG_PREFIX} Content script ready on tab ${senderId}: ` + `${platform} (feed: ${isFeedPage})`);
  }

  return { success: true };
}

/**
 * Handle GET_CONFIG message
 */
async function handleGetConfig(): Promise<MessageResponse> {
  try {
    const config = await getConfig();
    return { success: true, data: config };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle SAVE_CONFIG message
 */
async function handleSaveConfig(message: ExtensionMessage): Promise<MessageResponse> {
  if (message.type !== 'SAVE_CONFIG') {
    return { success: false, error: 'Invalid message type' };
  }

  try {
    const updated = await updateConfig(message.config);
    return { success: true, data: updated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle FETCH_RSS message
 * Refreshes the RSS feed cache (does not perform matching)
 */
async function handleFetchRss(): Promise<MessageResponse<{ feedTitle: string; itemCount: number }>> {
  try {
    const config = await getConfig();

    if (!config.rssFeedUrl) {
      return { success: false, error: 'No RSS feed URL configured' };
    }

    const preferences = config.matchingPreferences ?? DEFAULT_MATCHING_PREFERENCES;

    console.log(`${LOG_PREFIX} Fetching RSS feed from ${config.rssFeedUrl}`);

    // Always fetch fresh feed when explicitly requested
    const feed = await fetchRssFeed(config.rssFeedUrl);

    // Cache it
    const newCache: CachedRssFeed = {
      feed,
      fetchedAt: Date.now(),
      ttl: preferences.cacheTtlMinutes * 60 * 1000,
      url: config.rssFeedUrl,
    };
    await saveCachedRssFeed(newCache);

    // Update last fetch time
    await updateConfig({ lastFetchTime: Date.now() });

    console.log(`${LOG_PREFIX} Cached RSS feed "${feed.title}" with ${feed.items.length} items`);

    return {
      success: true,
      data: {
        feedTitle: feed.title,
        itemCount: feed.items.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching RSS:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle VALIDATE_RSS_FEED message
 * Validates an RSS feed URL by fetching and parsing it
 * Note: Service workers don't have DOMParser, so we use regex-based parsing
 */
async function handleValidateRssFeed(
  message: ExtensionMessage
): Promise<MessageResponse<{ feedTitle: string; itemCount: number }>> {
  const { url } = message as { url: string };

  if (!url) {
    return { success: false, error: 'RSS feed URL is required' };
  }

  try {
    const response = await fetch(url.trim(), {
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch feed (HTTP ${response.status})`,
      };
    }

    const text = await response.text();

    // Basic validation that it's RSS/Atom XML
    const isRss = text.includes('<rss') || text.includes('<channel');
    const isAtom = text.includes('<feed') && text.includes('xmlns="http://www.w3.org/2005/Atom"');

    if (!isRss && !isAtom) {
      return {
        success: false,
        error: 'URL does not appear to be a valid RSS or Atom feed',
      };
    }

    // Extract feed title using regex (service workers don't have DOMParser)
    let feedTitle = 'Untitled Feed';

    // Try RSS format: <channel><title>...</title>
    const rssTitleMatch = text.match(
      /<channel[^>]*>[\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i
    );
    if (rssTitleMatch) {
      feedTitle = rssTitleMatch[1].trim();
    } else {
      // Try Atom format: <feed><title>...</title>
      const atomTitleMatch = text.match(
        /<feed[^>]*>[\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i
      );
      if (atomTitleMatch) {
        feedTitle = atomTitleMatch[1].trim();
      }
    }

    // Count items/entries
    const rssItemCount = (text.match(/<item[\s>]/gi) || []).length;
    const atomEntryCount = (text.match(/<entry[\s>]/gi) || []).length;
    const itemCount = Math.max(rssItemCount, atomEntryCount);

    console.log(`${LOG_PREFIX} Validated RSS feed: "${feedTitle}" with ${itemCount} items`);

    return {
      success: true,
      data: { feedTitle, itemCount },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error validating RSS feed:`, error);
    return { success: false, error: `Failed to validate feed: ${errorMessage}` };
  }
}

/**
 * Handle FETCH_MODELS message
 * Fetches available models from OpenRouter API
 */
async function handleFetchModels(
  message: ExtensionMessage
): Promise<MessageResponse<{ models: OpenRouterModel[]; fromCache: boolean }>> {
  try {
    const config = await getConfig();

    if (!config.apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    const forceRefresh = (message as { forceRefresh?: boolean }).forceRefresh ?? false;
    const result = await fetchModelsWithCache(config.apiKey, forceRefresh);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching models:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle AI_MATCH_POSTS message
 * Performs AI-based semantic matching
 */
async function handleAIMatchPosts(): Promise<MessageResponse<MatchResult>> {
  try {
    const config = await getConfig();

    if (!config.apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    if (!config.rssFeedUrl) {
      return { success: false, error: 'No RSS feed URL configured' };
    }

    const preferences = config.matchingPreferences ?? DEFAULT_MATCHING_PREFERENCES;

    // Get cached feed
    let cachedFeed = await getCachedRssFeed();
    let feed = cachedFeed?.feed;

    if (!cachedFeed || cachedFeed.url !== config.rssFeedUrl || !isCachedFeedValid(cachedFeed)) {
      console.log(`${LOG_PREFIX} Fetching fresh RSS feed for AI matching`);
      feed = await fetchRssFeed(config.rssFeedUrl);

      const newCache: CachedRssFeed = {
        feed,
        fetchedAt: Date.now(),
        ttl: preferences.cacheTtlMinutes * 60 * 1000,
        url: config.rssFeedUrl,
      };
      await saveCachedRssFeed(newCache);
      await updateConfig({ lastFetchTime: Date.now() });
    } else {
      feed = cachedFeed.feed;
    }

    if (!feed) {
      return { success: false, error: 'Failed to load RSS feed' };
    }

    // Get extracted posts
    const extractedPosts = await getExtractedPosts();
    console.log(`${LOG_PREFIX} AI matching ${extractedPosts.length} extracted posts`);

    if (extractedPosts.length === 0) {
      return {
        success: true,
        data: {
          matches: [],
          totalEvaluated: 0,
          keywords: [],
          processingTimeMs: 0,
        },
      };
    }

    // Get example comments for style matching
    const exampleComments = config.exampleComments ?? [];

    // Use feed.link (actual blog URL) instead of rssFeedUrl (feed XML URL)
    const blogUrl = feed.link || config.rssFeedUrl.replace(/\/feed\.xml$|\/rss\.xml$|\/feed\/?$|\/rss\/?$/i, '');

    // Get content character limits
    const blogContentCharLimit = config.blogContentCharLimit ?? DEFAULT_BLOG_CONTENT_CHAR_LIMIT;
    const postContentCharLimit = config.postContentCharLimit ?? DEFAULT_POST_CONTENT_CHAR_LIMIT;

    // Perform AI matching
    const matchResult = await aiMatchPosts(
      extractedPosts,
      feed,
      blogUrl,
      config.apiKey,
      config.selectedModel,
      exampleComments,
      preferences,
      config.communicationPreferences ?? '',
      blogContentCharLimit,
      postContentCharLimit
    );

    // Mark all evaluated posts as processed (whether they matched or not)
    const evaluatedIds = extractedPosts.map((p) => `${p.platform}:${p.id}`);
    console.log(`${LOG_PREFIX} Saving ${evaluatedIds.length} evaluated post IDs`);
    await addEvaluatedPostIds(evaluatedIds);

    // Get existing matches to preserve status
    const existingMatches = await getMatchedPostsWithScore();

    // Merge new matches with existing ones
    const mergedMatches = mergeMatches(existingMatches, matchResult.matches, preferences.maxPosts);

    // Save merged matches
    await saveMatchedPostsWithScore(mergedMatches);

    console.log(`${LOG_PREFIX} AI matched ${matchResult.matches.length} posts, merged to ${mergedMatches.length}`);

    return {
      success: true,
      data: {
        ...matchResult,
        matches: mergedMatches,
      },
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in AI matching:`, error);
    console.log(
      `${LOG_PREFIX} Error type check - is InsufficientCreditsError:`,
      error instanceof InsufficientCreditsError
    );
    console.log(`${LOG_PREFIX} Error constructor name:`, (error as Error)?.constructor?.name);
    console.log(`${LOG_PREFIX} Error name property:`, (error as Error)?.name);

    if (error instanceof InsufficientCreditsError) {
      console.log(`${LOG_PREFIX} Returning INSUFFICIENT_CREDITS response`);
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        errorData: {
          requestedTokens: error.requestedTokens,
          availableTokens: error.availableTokens,
        },
      };
    }

    // Also check by error name in case instanceof fails (can happen in service workers)
    if ((error as Error)?.name === 'InsufficientCreditsError') {
      console.log(`${LOG_PREFIX} Matched by error name, returning INSUFFICIENT_CREDITS response`);
      const insuffError = error as InsufficientCreditsError;
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        errorData: {
          requestedTokens: insuffError.requestedTokens,
          availableTokens: insuffError.availableTokens,
        },
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle GENERATE_SUGGESTIONS message
 * Generates reply suggestions for a specific post
 */
async function handleGenerateSuggestions(
  message: ExtensionMessage
): Promise<MessageResponse<{ suggestions: ReplySuggestion[] }>> {
  try {
    const { postId, platform } = message as { postId: string; platform: string };

    const config = await getConfig();

    if (!config.apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    // Get the post
    const extractedPosts = await getExtractedPosts();
    const post = extractedPosts.find((p) => p.id === postId && p.platform === platform);

    if (!post) {
      return { success: false, error: 'Post not found' };
    }

    // Get cached feed
    const cachedFeed = await getCachedRssFeed();
    if (!cachedFeed?.feed) {
      return { success: false, error: 'No RSS feed available' };
    }

    // Get example comments
    const exampleComments = config.exampleComments ?? [];

    // Use feed.link (actual blog URL) instead of rssFeedUrl (feed XML URL)
    const blogUrl =
      cachedFeed.feed.link || config.rssFeedUrl.replace(/\/feed\.xml$|\/rss\.xml$|\/feed\/?$|\/rss\/?$/i, '');

    // Get blog content character limit
    const blogContentCharLimit = config.blogContentCharLimit ?? DEFAULT_BLOG_CONTENT_CHAR_LIMIT;

    // Generate suggestions
    const suggestions = await generateReplySuggestions(
      post,
      cachedFeed.feed,
      blogUrl,
      config.apiKey,
      config.selectedModel,
      exampleComments,
      config.communicationPreferences ?? '',
      blogContentCharLimit
    );

    // Update the matched post with new suggestions
    const matchedPosts = await getMatchedPostsWithScore();
    const updatedPosts = matchedPosts.map((m) => {
      if (m.post.id === postId && m.post.platform === platform) {
        return {
          ...m,
          replySuggestions: suggestions,
        };
      }
      return m;
    });
    await saveMatchedPostsWithScore(updatedPosts);

    return {
      success: true,
      data: { suggestions },
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error generating suggestions:`, error);

    if (error instanceof InsufficientCreditsError || (error as Error)?.name === 'InsufficientCreditsError') {
      const insuffError = error as InsufficientCreditsError;
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        errorData: {
          requestedTokens: insuffError.requestedTokens,
          availableTokens: insuffError.availableTokens,
        },
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle HEAT_CHECK_POSTS message
 * Analyzes post tone/sentiment using AI
 */
async function handleHeatCheckPosts(): Promise<MessageResponse> {
  console.log(`${LOG_PREFIX} Starting heat check...`);

  try {
    const config = await getConfig();

    if (!config.apiKey) {
      console.log(`${LOG_PREFIX} Heat check skipped: No API key`);
      return { success: false, error: 'No API key configured' };
    }

    // Get matched posts
    const matchedPosts = await getMatchedPostsWithScore();
    console.log(`${LOG_PREFIX} Heat check: Found ${matchedPosts.length} matched posts`);

    if (matchedPosts.length === 0) {
      return { success: true, data: { message: 'No posts to analyze' } };
    }

    // Get post content character limit
    const postContentCharLimit = config.postContentCharLimit ?? DEFAULT_POST_CONTENT_CHAR_LIMIT;

    // Run heat check
    const updatedPosts = await heatCheckPosts(matchedPosts, config.apiKey, config.selectedModel, postContentCharLimit);

    // Log results
    const withHeatCheck = updatedPosts.filter((p) => p.heatCheck).length;
    console.log(`${LOG_PREFIX} Heat check: ${withHeatCheck}/${updatedPosts.length} posts analyzed`);

    // Save updated posts with heat check results
    await saveMatchedPostsWithScore(updatedPosts);

    console.log(`${LOG_PREFIX} Heat check completed and saved`);

    return { success: true, data: { analyzedCount: updatedPosts.length } };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in heat check:`, error);

    if (error instanceof InsufficientCreditsError || (error as Error)?.name === 'InsufficientCreditsError') {
      const insuffError = error as InsufficientCreditsError;
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        errorData: {
          requestedTokens: insuffError.requestedTokens,
          availableTokens: insuffError.availableTokens,
        },
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Main message handler
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    const senderId = sender.tab?.id;
    console.log(`${LOG_PREFIX} Received message: ${message.type} from tab ${senderId}`);

    // Handle async messages
    const handleAsync = async () => {
      switch (message.type) {
        case 'POSTS_EXTRACTED':
          return handlePostsExtracted(message, senderId);

        case 'CONTENT_SCRIPT_READY':
          return handleContentScriptReady(message, senderId);

        case 'GET_CONFIG':
          return handleGetConfig();

        case 'SAVE_CONFIG':
          return handleSaveConfig(message);

        case 'FETCH_RSS':
          return handleFetchRss();

        case 'VALIDATE_RSS_FEED':
          return handleValidateRssFeed(message);

        case 'OPEN_SIDE_PANEL':
          if (senderId !== undefined) {
            await chrome.sidePanel.open({ tabId: senderId });
          }
          return { success: true };

        case 'FETCH_MODELS':
          return handleFetchModels(message);

        case 'AI_MATCH_POSTS':
          return handleAIMatchPosts();

        case 'GENERATE_SUGGESTIONS':
        case 'REGENERATE_SUGGESTIONS':
          return handleGenerateSuggestions(message);

        case 'HEAT_CHECK_POSTS':
          return handleHeatCheckPosts();

        default:
          console.log(`${LOG_PREFIX} Unhandled message type: ${message.type}`);
          return { success: true, data: { message: 'Message acknowledged' } };
      }
    };

    // Execute and send response
    handleAsync()
      .then(sendResponse)
      .catch((error) => {
        console.error(`${LOG_PREFIX} Error handling message:`, error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
);

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeContentScripts.has(tabId)) {
    console.log(`${LOG_PREFIX} Tab ${tabId} closed, removing from active scripts`);
    activeContentScripts.delete(tabId);
  }
});

// Handle tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // When a tab navigates to a new URL, the content script will re-initialize
  if (changeInfo.status === 'loading' && activeContentScripts.has(tabId)) {
    console.log(`${LOG_PREFIX} Tab ${tabId} navigating, content script will re-initialize`);
    activeContentScripts.delete(tabId);
  }
});

export {};
