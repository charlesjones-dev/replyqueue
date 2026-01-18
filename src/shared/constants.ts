/**
 * Constants for ReplyQueue extension
 */

import type { MatchingPreferences } from './types';

// src/shared/constants.ts
export const RECOMMENDED_MODELS = [
  'anthropic/claude-sonnet-4.5', // Higher quality option
  'anthropic/claude-haiku-4.5', // Default - fast, cheap, good for this use case
] as const;

// Default model - fast, cheap, good enough for matching/reply generation
export const DEFAULT_MODEL = 'claude-sonnet-4.5';

// Default matching preferences
export const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  threshold: 0.3,
  cacheTtlMinutes: 60,
};

// Default character limit for blog content sent to AI
export const DEFAULT_BLOG_CONTENT_CHAR_LIMIT = 2500;

// Blog content character limit options (0 = no limit)
export const BLOG_CONTENT_CHAR_LIMIT_OPTIONS = [
  { value: 1000, label: '1,000 characters' },
  { value: 2500, label: '2,500 characters (Recommended)' },
  { value: 5000, label: '5,000 characters' },
  { value: 10000, label: '10,000 characters' },
  { value: 0, label: 'No limit (full content)' },
] as const;

// Default character limit for social media post content sent to AI
export const DEFAULT_POST_CONTENT_CHAR_LIMIT = 2000;

// Default max queue size (limits posts collected while browsing)
export const DEFAULT_MAX_QUEUE_SIZE = 25;

// Post content character limit options (0 = no limit)
export const POST_CONTENT_CHAR_LIMIT_OPTIONS = [
  { value: 500, label: '500 characters' },
  { value: 1000, label: '1,000 characters' },
  { value: 2000, label: '2,000 characters (Recommended)' },
  { value: 3000, label: '3,000 characters' },
  { value: 0, label: 'No limit (full content)' },
] as const;

// Default max matched posts (configurable limit for matched posts after AI analysis)
export const DEFAULT_MAX_MATCHED_POSTS = 100;

export const DEFAULT_CONFIG: {
  apiKey: string;
  rssFeedUrl: string;
  selectedModel: string;
  isSetupComplete: boolean;
  matchingPreferences: MatchingPreferences;
  exampleComments: string[];
  communicationPreferences: string;
  blogContentCharLimit: number;
  postContentCharLimit: number;
  maxQueueSize: number;
  maxMatchedPosts: number;
} = {
  apiKey: '',
  rssFeedUrl: '',
  selectedModel: DEFAULT_MODEL,
  isSetupComplete: false,
  matchingPreferences: { ...DEFAULT_MATCHING_PREFERENCES },
  exampleComments: [] as string[],
  communicationPreferences: '',
  blogContentCharLimit: DEFAULT_BLOG_CONTENT_CHAR_LIMIT,
  postContentCharLimit: DEFAULT_POST_CONTENT_CHAR_LIMIT,
  maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
  maxMatchedPosts: DEFAULT_MAX_MATCHED_POSTS,
};

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export const STORAGE_KEYS = {
  CONFIG: 'config',
  API_KEY: 'apiKey',
  MATCHED_POSTS: 'matchedPosts',
  EXTRACTED_POSTS: 'extractedPosts',
  CACHED_RSS_FEED: 'cachedRssFeed',
  MATCHED_POSTS_WITH_SCORE: 'matchedPostsWithScore',
  EXAMPLE_COMMENTS: 'exampleComments',
  CACHED_MODELS: 'cachedModels',
  AI_MATCH_CACHE: 'aiMatchCache',
  EVALUATED_POST_IDS: 'evaluatedPostIds',
} as const;

// Maximum number of extracted posts to keep in storage
export const MAX_EXTRACTED_POSTS = 500;

// Maximum number of example comments
export const MAX_EXAMPLE_COMMENTS = 10;

// Byte limit for sync storage (chrome.storage.sync has 8KB per item limit)
export const SYNC_STORAGE_ITEM_LIMIT = 8192;

export const API_KEY_PATTERN = /^sk-or-v1-[a-f0-9]{64}$/;

export const RSS_URL_PATTERN = /^https?:\/\/.+/i;

// RSS cache TTL options (in minutes)
export const CACHE_TTL_OPTIONS = [15, 30, 60, 120, 240] as const;

// Max matched posts options (configurable)
export const MAX_MATCHED_POSTS_OPTIONS = [25, 50, 100, 150, 200] as const;

// Relevance threshold presets
export const THRESHOLD_PRESETS = {
  low: 0.2,
  medium: 0.3,
  high: 0.5,
} as const;

// Model cache TTL (1 hour in milliseconds)
export const MODEL_CACHE_TTL = 60 * 60 * 1000;

// Maximum number of writing style examples to include in prompts
export const MAX_STYLE_EXAMPLES_IN_PROMPT = 15;

// Default max price filter for models (per 1M tokens blended)
export const DEFAULT_MAX_MODEL_PRICE = 10;

// Default max age filter for models (in days)
export const DEFAULT_MAX_MODEL_AGE_DAYS = 365;

// Number of reply suggestions to generate per post
export const REPLY_SUGGESTIONS_COUNT = 3;

// Maximum posts to send in a single AI matching request
export const AI_MATCH_BATCH_SIZE = 25;

// Cost tier thresholds (blended price per 1M tokens)
export const COST_TIER_THRESHOLDS = {
  cheap: 0.5, // $
  medium: 2.0, // $$
  // Above medium: $$$
} as const;

// OpenRouter rate limiting
export const OPENROUTER_RATE_LIMIT = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
} as const;
