/**
 * Message passing types for content/background communication
 */

import type { ExtractedPost } from '../platforms/types';
import type { ExtensionConfig } from './types';

export type MessageType =
  | 'FETCH_RSS'
  | 'VALIDATE_RSS_FEED'
  | 'GENERATE_REPLY'
  | 'POST_REPLY'
  | 'GET_CONFIG'
  | 'SAVE_CONFIG'
  | 'OPEN_SIDE_PANEL'
  // Content script messages
  | 'POSTS_EXTRACTED'
  | 'CONTENT_SCRIPT_READY'
  | 'GET_EXTRACTION_STATUS'
  // Background to content script messages
  | 'START_EXTRACTION'
  | 'STOP_EXTRACTION'
  | 'SCROLL_TO_POST'
  // AI/Model messages
  | 'FETCH_MODELS'
  | 'AI_MATCH_POSTS'
  | 'GENERATE_SUGGESTIONS'
  | 'REGENERATE_SUGGESTIONS'
  | 'HEAT_CHECK_POSTS'
  // Permission messages
  | 'REQUEST_HOST_PERMISSION'
  | 'CHECK_HOST_PERMISSION';

export interface BaseMessage {
  type: MessageType;
}

// ============================================================
// Existing messages
// ============================================================

export interface FetchRssMessage extends BaseMessage {
  type: 'FETCH_RSS';
  url: string;
}

export interface ValidateRssFeedMessage extends BaseMessage {
  type: 'VALIDATE_RSS_FEED';
  url: string;
}

export interface GenerateReplyMessage extends BaseMessage {
  type: 'GENERATE_REPLY';
  postContent: string;
  postAuthor: string;
}

export interface PostReplyMessage extends BaseMessage {
  type: 'POST_REPLY';
  reply: string;
  postUrl: string;
}

export interface GetConfigMessage extends BaseMessage {
  type: 'GET_CONFIG';
}

export interface SaveConfigMessage extends BaseMessage {
  type: 'SAVE_CONFIG';
  config: Partial<ExtensionConfig>;
}

export interface OpenSidePanelMessage extends BaseMessage {
  type: 'OPEN_SIDE_PANEL';
}

// ============================================================
// Content script to background messages
// ============================================================

/**
 * Message sent when posts are extracted from the feed
 */
export interface PostsExtractedMessage extends BaseMessage {
  type: 'POSTS_EXTRACTED';
  posts: ExtractedPost[];
  platform: string;
  pageUrl: string;
}

/**
 * Message sent when content script initializes
 */
export interface ContentScriptReadyMessage extends BaseMessage {
  type: 'CONTENT_SCRIPT_READY';
  platform: string;
  pageUrl: string;
  isFeedPage: boolean;
}

/**
 * Request current extraction status
 */
export interface GetExtractionStatusMessage extends BaseMessage {
  type: 'GET_EXTRACTION_STATUS';
}

// ============================================================
// Background to content script messages
// ============================================================

/**
 * Command to start extracting posts
 */
export interface StartExtractionMessage extends BaseMessage {
  type: 'START_EXTRACTION';
}

/**
 * Command to stop extracting posts
 */
export interface StopExtractionMessage extends BaseMessage {
  type: 'STOP_EXTRACTION';
}

/**
 * Command to scroll to a specific post
 */
export interface ScrollToPostMessage extends BaseMessage {
  type: 'SCROLL_TO_POST';
  postId: string;
}

// ============================================================
// AI/Model messages
// ============================================================

/**
 * Fetch available models from OpenRouter
 */
export interface FetchModelsMessage extends BaseMessage {
  type: 'FETCH_MODELS';
  forceRefresh?: boolean;
}

/**
 * Request AI matching for posts
 */
export interface AIMatchPostsMessage extends BaseMessage {
  type: 'AI_MATCH_POSTS';
}

/**
 * Generate reply suggestions for a specific post
 */
export interface GenerateSuggestionsMessage extends BaseMessage {
  type: 'GENERATE_SUGGESTIONS';
  postId: string;
  platform: string;
}

/**
 * Regenerate reply suggestions for a specific post
 */
export interface RegenerateSuggestionsMessage extends BaseMessage {
  type: 'REGENERATE_SUGGESTIONS';
  postId: string;
  platform: string;
}

/**
 * Run heat check (tone/sentiment analysis) on matched posts
 */
export interface HeatCheckPostsMessage extends BaseMessage {
  type: 'HEAT_CHECK_POSTS';
}

// ============================================================
// Permission messages
// ============================================================

/**
 * Request host permission for a URL (e.g., RSS feed URL)
 */
export interface RequestHostPermissionMessage extends BaseMessage {
  type: 'REQUEST_HOST_PERMISSION';
  url: string;
}

/**
 * Check if we have host permission for a URL
 */
export interface CheckHostPermissionMessage extends BaseMessage {
  type: 'CHECK_HOST_PERMISSION';
  url: string;
}

// ============================================================
// Union types
// ============================================================

export type ExtensionMessage =
  | FetchRssMessage
  | ValidateRssFeedMessage
  | GenerateReplyMessage
  | PostReplyMessage
  | GetConfigMessage
  | SaveConfigMessage
  | OpenSidePanelMessage
  | PostsExtractedMessage
  | ContentScriptReadyMessage
  | GetExtractionStatusMessage
  | StartExtractionMessage
  | StopExtractionMessage
  | ScrollToPostMessage
  | FetchModelsMessage
  | AIMatchPostsMessage
  | GenerateSuggestionsMessage
  | RegenerateSuggestionsMessage
  | HeatCheckPostsMessage
  | RequestHostPermissionMessage
  | CheckHostPermissionMessage;

// ============================================================
// Response types
// ============================================================

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Additional error data for specific error types */
  errorData?: {
    requestedTokens?: number;
    availableTokens?: number;
  };
}

export interface ExtractionStatusResponse {
  isExtracting: boolean;
  extractedCount: number;
  platform: string;
}

export interface PostsStoredResponse {
  storedCount: number;
  duplicateCount: number;
  totalStored: number;
}

// ============================================================
// Message utilities
// ============================================================

/**
 * Send a message to the background script
 */
export async function sendMessage<T = unknown>(message: ExtensionMessage): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as MessageResponse<T>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Send a message to a content script in a specific tab
 */
export async function sendTabMessage<T = unknown>(
  tabId: number,
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response as MessageResponse<T>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Type guard for PostsExtractedMessage
 */
export function isPostsExtractedMessage(message: ExtensionMessage): message is PostsExtractedMessage {
  return message.type === 'POSTS_EXTRACTED';
}

/**
 * Type guard for ContentScriptReadyMessage
 */
export function isContentScriptReadyMessage(message: ExtensionMessage): message is ContentScriptReadyMessage {
  return message.type === 'CONTENT_SCRIPT_READY';
}

/**
 * Type guard for ScrollToPostMessage
 */
export function isScrollToPostMessage(message: ExtensionMessage): message is ScrollToPostMessage {
  return message.type === 'SCROLL_TO_POST';
}
