/**
 * Constants for ReplyQueue extension
 */

import type { MatchingPreferences } from './types'

// src/shared/constants.ts
export const RECOMMENDED_MODELS = [
  'anthropic/claude-haiku-4.5',   // Default - fast, cheap, good for this use case
  'anthropic/claude-sonnet-4.5',  // Higher quality option
] as const;

// Default model - fast, cheap, good enough for matching/reply generation
export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

// Default matching preferences
export const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  threshold: 0.3,
  maxPosts: 20,
  cacheTtlMinutes: 60,
}

export const DEFAULT_CONFIG: {
  apiKey: string
  rssFeedUrl: string
  selectedModel: string
  isSetupComplete: boolean
  matchingPreferences: MatchingPreferences
  exampleComments: string[]
  communicationPreferences: string
} = {
  apiKey: '',
  rssFeedUrl: '',
  selectedModel: DEFAULT_MODEL,
  isSetupComplete: false,
  matchingPreferences: { ...DEFAULT_MATCHING_PREFERENCES },
  exampleComments: [] as string[],
  communicationPreferences: '',
}

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

export const STORAGE_KEYS = {
  CONFIG: 'config',
  MATCHED_POSTS: 'matchedPosts',
  EXTRACTED_POSTS: 'extractedPosts',
  CACHED_RSS_FEED: 'cachedRssFeed',
  MATCHED_POSTS_WITH_SCORE: 'matchedPostsWithScore',
  EXAMPLE_COMMENTS: 'exampleComments',
  CACHED_MODELS: 'cachedModels',
  AI_MATCH_CACHE: 'aiMatchCache',
} as const

// Maximum number of extracted posts to keep in storage
export const MAX_EXTRACTED_POSTS = 500

// Maximum number of matched posts to keep
export const MAX_MATCHED_POSTS = 100

// Maximum number of example comments
export const MAX_EXAMPLE_COMMENTS = 10

// Byte limit for sync storage (chrome.storage.sync has 8KB per item limit)
export const SYNC_STORAGE_ITEM_LIMIT = 8192

export const API_KEY_PATTERN = /^sk-or-v1-[a-f0-9]{64}$/

export const RSS_URL_PATTERN = /^https?:\/\/.+/i

// RSS cache TTL options (in minutes)
export const CACHE_TTL_OPTIONS = [15, 30, 60, 120, 240] as const

// Max posts display options
export const MAX_POSTS_OPTIONS = [10, 20, 30, 50, 100] as const

// Relevance threshold presets
export const THRESHOLD_PRESETS = {
  low: 0.2,
  medium: 0.3,
  high: 0.5,
} as const

// Model cache TTL (1 hour in milliseconds)
export const MODEL_CACHE_TTL = 60 * 60 * 1000

// Maximum number of writing style examples to include in prompts
export const MAX_STYLE_EXAMPLES_IN_PROMPT = 15

// Default max price filter for models (per 1M tokens blended)
export const DEFAULT_MAX_MODEL_PRICE = 10

// Default max age filter for models (in days)
export const DEFAULT_MAX_MODEL_AGE_DAYS = 365

// Number of reply suggestions to generate per post
export const REPLY_SUGGESTIONS_COUNT = 3

// Cost tier thresholds (blended price per 1M tokens)
export const COST_TIER_THRESHOLDS = {
  cheap: 0.5,    // $
  medium: 2.0,   // $$
  // Above medium: $$$
} as const

// OpenRouter rate limiting
export const OPENROUTER_RATE_LIMIT = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
} as const
