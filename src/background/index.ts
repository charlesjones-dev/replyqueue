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
  getEvaluatedPostIds,
  skipQueuedPost,
  unskipPost,
} from '../shared/storage';
import {
  DEFAULT_MATCHING_PREFERENCES,
  DEFAULT_MAX_MATCHED_POSTS,
  DEFAULT_BLOG_CONTENT_CHAR_LIMIT,
  DEFAULT_POST_CONTENT_CHAR_LIMIT,
  DEFAULT_MAX_RSS_ITEMS,
  DEFAULT_MAX_BLOG_ITEMS_IN_PROMPT,
} from '../shared/constants';
import { fetchRssFeed } from './rss-fetcher';
import { mergeMatches, aiMatchPosts, generateReplySuggestions, heatCheckPosts } from './matcher';
import { fetchModelsWithCache, InsufficientCreditsError } from './openrouter';

const LOG_PREFIX = '[ReplyQueue:Background]';

/**
 * Allowed origins for content script messages
 * Add new platform domains here when implementing new platform adapters
 */
const ALLOWED_CONTENT_SCRIPT_ORIGINS = /^https:\/\/(www\.)?linkedin\.com\//;

/**
 * Content script message types that require origin validation
 * These messages originate from content scripts running on social media pages
 */
const CONTENT_SCRIPT_MESSAGE_TYPES = ['POSTS_EXTRACTED', 'CONTENT_SCRIPT_READY', 'OPEN_SIDE_PANEL'] as const;

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
    const maxRssItems = config.maxRssItems ?? DEFAULT_MAX_RSS_ITEMS;

    console.log(`${LOG_PREFIX} Fetching RSS feed from ${config.rssFeedUrl}`);

    // Always fetch fresh feed when explicitly requested
    const feed = await fetchRssFeed(config.rssFeedUrl);

    // Apply maxRssItems limit
    const limitedFeed = {
      ...feed,
      items: feed.items.slice(0, maxRssItems),
    };

    // Cache it
    const newCache: CachedRssFeed = {
      feed: limitedFeed,
      fetchedAt: Date.now(),
      ttl: preferences.cacheTtlMinutes * 60 * 1000,
      url: config.rssFeedUrl,
    };
    await saveCachedRssFeed(newCache);

    // Update last fetch time
    await updateConfig({ lastFetchTime: Date.now() });

    console.log(
      `${LOG_PREFIX} Cached RSS feed "${limitedFeed.title}" with ${limitedFeed.items.length} items (limited from ${feed.items.length})`
    );

    return {
      success: true,
      data: {
        feedTitle: limitedFeed.title,
        itemCount: limitedFeed.items.length,
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
    // Check if we have permission to access this URL's origin
    const origin = getOriginPattern(url.trim());
    const hasPermission = await chrome.permissions.contains({ origins: [origin] });

    if (!hasPermission) {
      console.log(`${LOG_PREFIX} Missing permission for ${origin}, returning RSS_PERMISSION_REQUIRED`);
      return {
        success: false,
        error: 'RSS_PERMISSION_REQUIRED',
      };
    }

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
 * If postIds provided, only matches those specific posts
 */
async function handleAIMatchPosts(message: ExtensionMessage): Promise<MessageResponse<MatchResult>> {
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

      // Check if we have permission before fetching
      const origin = getOriginPattern(config.rssFeedUrl);
      const hasPermission = await chrome.permissions.contains({ origins: [origin] });

      if (!hasPermission) {
        console.log(`${LOG_PREFIX} Missing permission for ${origin}`);
        return {
          success: false,
          error: 'RSS_PERMISSION_REQUIRED',
        };
      }

      try {
        feed = await fetchRssFeed(config.rssFeedUrl);
      } catch (fetchError) {
        // Check if this is a CORS/network error that might be permission-related
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('CORS')) {
          console.log(`${LOG_PREFIX} Fetch failed, may be permission issue: ${errorMsg}`);
          return {
            success: false,
            error: 'RSS_PERMISSION_REQUIRED',
          };
        }
        throw fetchError;
      }

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

    // Get extracted posts and filter to only queued posts (not yet evaluated)
    const allExtractedPosts = await getExtractedPosts();
    const alreadyEvaluatedIds = await getEvaluatedPostIds();

    // Check if specific postIds were requested
    const requestedPostIds = (message as { postIds?: string[] }).postIds;

    let extractedPosts: ExtractedPostRecord[];
    if (requestedPostIds && requestedPostIds.length > 0) {
      // Filter to only the requested posts (must exist and not already evaluated)
      const requestedSet = new Set(requestedPostIds);
      extractedPosts = allExtractedPosts.filter((p) => {
        const key = `${p.platform}:${p.id}`;
        return requestedSet.has(key) && !alreadyEvaluatedIds.has(key);
      });
      console.log(
        `${LOG_PREFIX} AI matching ${extractedPosts.length} selected posts (${requestedPostIds.length} requested, ${alreadyEvaluatedIds.size} already evaluated)`
      );
    } else {
      // Match all queued posts (not yet evaluated)
      extractedPosts = allExtractedPosts.filter((p) => {
        const key = `${p.platform}:${p.id}`;
        return !alreadyEvaluatedIds.has(key);
      });
      console.log(
        `${LOG_PREFIX} AI matching ${extractedPosts.length} queued posts (${allExtractedPosts.length} total, ${alreadyEvaluatedIds.size} already evaluated)`
      );
    }

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

    // Get max matched posts from config
    const maxMatchedPosts = config.maxMatchedPosts ?? DEFAULT_MAX_MATCHED_POSTS;

    // Get max blog items for AI prompts
    const maxBlogItemsInPrompt = config.maxBlogItemsInPrompt ?? DEFAULT_MAX_BLOG_ITEMS_IN_PROMPT;

    // Perform AI matching
    const matchResult = await aiMatchPosts(
      extractedPosts,
      feed,
      blogUrl,
      config.apiKey,
      config.selectedModel,
      exampleComments,
      preferences,
      maxMatchedPosts,
      config.communicationPreferences ?? '',
      blogContentCharLimit,
      postContentCharLimit,
      maxBlogItemsInPrompt
    );

    // Mark all evaluated posts as processed (whether they matched or not)
    const evaluatedIds = extractedPosts.map((p) => `${p.platform}:${p.id}`);
    console.log(`${LOG_PREFIX} Saving ${evaluatedIds.length} evaluated post IDs`);
    await addEvaluatedPostIds(evaluatedIds);

    // Get existing matches to preserve status
    const existingMatches = await getMatchedPostsWithScore();

    // Merge new matches with existing ones
    const mergedMatches = mergeMatches(existingMatches, matchResult.matches, maxMatchedPosts);

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

    // Get max blog items for AI prompts
    const maxBlogItemsInPrompt = config.maxBlogItemsInPrompt ?? DEFAULT_MAX_BLOG_ITEMS_IN_PROMPT;

    // Generate suggestions
    const suggestions = await generateReplySuggestions(
      post,
      cachedFeed.feed,
      blogUrl,
      config.apiKey,
      config.selectedModel,
      exampleComments,
      config.communicationPreferences ?? '',
      blogContentCharLimit,
      maxBlogItemsInPrompt
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
 * Extract origin pattern from URL for permission requests
 */
function getOriginPattern(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    throw new Error('Invalid URL');
  }
}

/**
 * Handle CHECK_HOST_PERMISSION message
 * Checks if we have permission to access a URL's origin
 */
async function handleCheckHostPermission(
  message: ExtensionMessage
): Promise<MessageResponse<{ hasPermission: boolean }>> {
  const { url } = message as { url: string };

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  try {
    const origin = getOriginPattern(url);
    const hasPermission = await chrome.permissions.contains({
      origins: [origin],
    });

    console.log(`${LOG_PREFIX} Permission check for ${origin}: ${hasPermission}`);

    return { success: true, data: { hasPermission } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle REQUEST_HOST_PERMISSION message
 * Requests permission to access a URL's origin
 */
async function handleRequestHostPermission(message: ExtensionMessage): Promise<MessageResponse<{ granted: boolean }>> {
  const { url } = message as { url: string };

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  try {
    const origin = getOriginPattern(url);

    // First check if we already have the permission
    const alreadyHas = await chrome.permissions.contains({
      origins: [origin],
    });

    if (alreadyHas) {
      console.log(`${LOG_PREFIX} Already have permission for ${origin}`);
      return { success: true, data: { granted: true } };
    }

    // Request the permission
    console.log(`${LOG_PREFIX} Requesting permission for ${origin}`);
    const granted = await chrome.permissions.request({
      origins: [origin],
    });

    console.log(`${LOG_PREFIX} Permission ${granted ? 'granted' : 'denied'} for ${origin}`);

    return { success: true, data: { granted } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error requesting permission:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle SKIP_QUEUED_POST message
 * Skips a queued post before AI analysis
 */
async function handleSkipQueuedPost(message: ExtensionMessage): Promise<MessageResponse> {
  const { postId, platform } = message as { postId: string; platform: string };

  if (!postId || !platform) {
    return { success: false, error: 'Post ID and platform are required' };
  }

  try {
    await skipQueuedPost(postId, platform);
    console.log(`${LOG_PREFIX} Skipped queued post ${postId} from ${platform}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error skipping queued post:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle ENSURE_CONTENT_SCRIPT message
 * Ensures content script is injected and extracting on the active tab
 * Handles the case where side panel opens on an already-loaded LinkedIn page
 */
async function handleEnsureContentScript(): Promise<MessageResponse> {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id || !activeTab.url) {
      console.log(`${LOG_PREFIX} No active tab found`);
      return { success: false, error: 'No active tab found' };
    }

    // Check if it's a LinkedIn URL
    if (!ALLOWED_CONTENT_SCRIPT_ORIGINS.test(activeTab.url)) {
      console.log(`${LOG_PREFIX} Active tab is not LinkedIn: ${activeTab.url}`);
      return { success: false, error: 'Not a LinkedIn page' };
    }

    const tabId = activeTab.id;

    // Try to send START_EXTRACTION to the content script
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'START_EXTRACTION' });
      console.log(`${LOG_PREFIX} Content script already running on tab ${tabId}`);
      return { success: true, data: { injected: false } };
    } catch {
      // Content script not running, need to inject it
      console.log(`${LOG_PREFIX} Content script not found on tab ${tabId}, injecting...`);
    }

    // Get the content script path from the manifest
    const manifest = chrome.runtime.getManifest();
    const contentScriptPath = manifest.content_scripts?.[0]?.js?.[0];

    if (!contentScriptPath) {
      console.error(`${LOG_PREFIX} Could not find content script path in manifest`);
      return { success: false, error: 'Content script path not found in manifest' };
    }

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [contentScriptPath],
    });

    console.log(`${LOG_PREFIX} Content script injected on tab ${tabId}`);

    // Wait a moment for the content script to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Now send START_EXTRACTION
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'START_EXTRACTION' });
      console.log(`${LOG_PREFIX} Extraction started after injection on tab ${tabId}`);
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to start extraction after injection:`, error);
    }

    return { success: true, data: { injected: true } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error ensuring content script:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle UNSKIP_POST message
 * Moves a skipped post back to the queue
 */
async function handleUnskipPost(message: ExtensionMessage): Promise<MessageResponse> {
  const { postId, platform } = message as { postId: string; platform: string };

  if (!postId || !platform) {
    return { success: false, error: 'Post ID and platform are required' };
  }

  try {
    await unskipPost(postId, platform);
    console.log(`${LOG_PREFIX} Unskipped post ${postId} from ${platform}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error unskipping post:`, error);
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

    // Validate origin for content script messages
    if (CONTENT_SCRIPT_MESSAGE_TYPES.includes(message.type as (typeof CONTENT_SCRIPT_MESSAGE_TYPES)[number])) {
      if (!sender.url || !ALLOWED_CONTENT_SCRIPT_ORIGINS.test(sender.url)) {
        console.warn(`${LOG_PREFIX} Rejected message from unauthorized origin:`, sender.url);
        sendResponse({ success: false, error: 'Unauthorized origin' });
        return true;
      }
    }

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
          return handleAIMatchPosts(message);

        case 'GENERATE_SUGGESTIONS':
        case 'REGENERATE_SUGGESTIONS':
          return handleGenerateSuggestions(message);

        case 'HEAT_CHECK_POSTS':
          return handleHeatCheckPosts();

        case 'SKIP_QUEUED_POST':
          return handleSkipQueuedPost(message);

        case 'UNSKIP_POST':
          return handleUnskipPost(message);

        case 'CHECK_HOST_PERMISSION':
          return handleCheckHostPermission(message);

        case 'REQUEST_HOST_PERMISSION':
          return handleRequestHostPermission(message);

        case 'ENSURE_CONTENT_SCRIPT':
          return handleEnsureContentScript();

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
