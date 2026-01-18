/**
 * Core type definitions for ReplyQueue extension
 */

export type AppView = 'setup' | 'main' | 'settings';

/**
 * Matching preferences for keyword-based post filtering
 */
export interface MatchingPreferences {
  /** Minimum relevance score threshold (0-1) */
  threshold: number;
  /** Cache TTL in minutes */
  cacheTtlMinutes: number;
}

export interface ExtensionConfig {
  apiKey: string;
  rssFeedUrl: string;
  selectedModel: string;
  isSetupComplete: boolean;
  lastFetchTime?: number;
  /** Matching preferences */
  matchingPreferences?: MatchingPreferences;
  /** User's writing style examples */
  exampleComments?: string[];
  /** Communication preferences/rules for AI-generated replies */
  communicationPreferences?: string;
  /** Character limit for blog content sent to AI (0 = no limit) */
  blogContentCharLimit?: number;
  /** Character limit for social media post content sent to AI (0 = no limit) */
  postContentCharLimit?: number;
  /** Maximum posts to keep in queue while browsing */
  maxQueueSize?: number;
  /** Maximum matched posts to keep after AI analysis */
  maxMatchedPosts?: number;
}

export interface Post {
  id: string;
  title: string;
  link: string;
  author: string;
  pubDate: string;
  content: string;
  guid: string;
}

export interface MatchedPost extends Post {
  matchedAt: number;
  status: 'pending' | 'drafted' | 'posted' | 'skipped';
  draftReply?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ApiKeyValidationResult extends ValidationResult {
  credits?: number;
  models?: string[];
}

export interface RssFeedValidationResult extends ValidationResult {
  feedTitle?: string;
  itemCount?: number;
}

export interface StorageData {
  config?: ExtensionConfig;
  matchedPosts?: MatchedPost[];
  extractedPosts?: ExtractedPostRecord[];
}

/**
 * Record of an extracted post stored in chrome.storage.local
 * Includes metadata about when/where it was extracted
 */
export interface ExtractedPostRecord {
  id: string;
  platform: string;
  url: string;
  authorName: string;
  authorHeadline?: string;
  authorProfileUrl?: string;
  content: string;
  publishedAt?: string;
  reactionCount?: number;
  commentCount?: number;
  repostCount?: number;
  isRepost?: boolean;
  contentType?: 'text' | 'image' | 'video' | 'article' | 'document' | 'poll';
  extractedAt: number;
  /** URL of the page where post was extracted */
  sourcePageUrl: string;
}

// ============================================================
// RSS Feed Types
// ============================================================

/**
 * Parsed RSS feed item
 */
export interface RssFeedItem {
  /** Unique identifier (guid or link) */
  id: string;
  /** Item title */
  title: string;
  /** Item description/summary */
  description?: string;
  /** Full content (content:encoded or atom:content) */
  content?: string;
  /** URL to the item */
  link: string;
  /** Publication date */
  pubDate?: string;
  /** Author name */
  author?: string;
  /** Categories/tags */
  categories?: string[];
  /** Enclosure (for podcasts, etc.) */
  enclosure?: {
    url: string;
    type?: string;
    length?: number;
  };
}

/**
 * Parsed RSS feed
 */
export interface RssFeed {
  /** Feed title */
  title: string;
  /** Feed description */
  description?: string;
  /** Feed link */
  link?: string;
  /** Feed items */
  items: RssFeedItem[];
  /** Feed type (rss or atom) */
  feedType: 'rss' | 'atom';
  /** Last build/updated date */
  lastUpdated?: string;
}

/**
 * Cached RSS feed data
 */
export interface CachedRssFeed {
  /** The parsed feed */
  feed: RssFeed;
  /** When the feed was fetched */
  fetchedAt: number;
  /** Cache TTL in milliseconds */
  ttl: number;
  /** Source URL */
  url: string;
}

// ============================================================
// Matched Post Types
// ============================================================

/**
 * Post tone/sentiment classification from heat check
 */
export type PostTone =
  | 'positive' // Uplifting, encouraging, celebratory
  | 'educational' // Informative, teaching, sharing knowledge
  | 'question' // Asking for help or opinions
  | 'negative' // Complaining, venting, pessimistic
  | 'promotional' // Self-promotion, selling
  | 'neutral'; // General updates, observations

/**
 * Heat check result for a post
 */
export interface HeatCheckResult {
  /** Classified tone of the post */
  tone: PostTone;
  /** Brief explanation of the classification */
  reason: string;
  /** Whether this post is a good candidate for engagement (true = green light) */
  recommended: boolean;
}

/**
 * A matched post with relevance score and match details
 */
export interface MatchedPostWithScore {
  /** The extracted post */
  post: ExtractedPostRecord;
  /** Relevance score (0-1) */
  score: number;
  /** Keywords that matched */
  matchedKeywords: string[];
  /** Reason for the match */
  matchReason: string;
  /** When the match was calculated */
  matchedAt: number;
  /** Status for reply workflow */
  status: 'pending' | 'replied' | 'skipped';
  /** Draft reply (if generated) */
  draftReply?: string;
  /** Heat check result (tone/sentiment analysis) */
  heatCheck?: HeatCheckResult;
}

/**
 * Result from the matching process
 */
export interface MatchResult {
  /** Posts that matched above threshold */
  matches: MatchedPostWithScore[];
  /** Total posts evaluated */
  totalEvaluated: number;
  /** Keywords extracted from RSS feed */
  keywords: string[];
  /** Time taken to match (ms) */
  processingTimeMs: number;
}

// ============================================================
// AI/OpenRouter Types
// ============================================================

/**
 * A reply suggestion generated by AI
 */
export interface ReplySuggestion {
  /** The suggestion text */
  text: string;
  /** Unique ID for this suggestion */
  id: string;
  /** When this suggestion was generated */
  generatedAt: number;
}

/**
 * Extended matched post with AI-generated reply suggestions
 */
export interface MatchedPostWithSuggestions extends MatchedPostWithScore {
  /** AI-generated reply suggestions */
  replySuggestions?: ReplySuggestion[];
  /** Whether AI matching was used */
  aiMatched?: boolean;
  /** AI-generated match reason (more detailed than keyword matching) */
  aiMatchReason?: string;
}

/**
 * OpenRouter model information
 */
export interface OpenRouterModel {
  /** Model ID (e.g., 'anthropic/claude-haiku-4.5') */
  id: string;
  /** Display name */
  name: string;
  /** Model description */
  description?: string;
  /** Context length */
  context_length: number;
  /** Pricing per 1M tokens */
  pricing: {
    prompt: string;
    completion: string;
  };
  /** When the model was created/released */
  created?: number;
  /** Whether the model is recommended */
  isRecommended?: boolean;
}

/**
 * Cached model list
 */
export interface CachedModelList {
  /** List of models */
  models: OpenRouterModel[];
  /** When the list was fetched */
  fetchedAt: number;
  /** Cache TTL in milliseconds (1 hour) */
  ttl: number;
}

/**
 * Model filter options
 */
export interface ModelFilterOptions {
  /** Maximum blended price per 1M tokens */
  maxPrice?: number;
  /** Maximum model age in days */
  maxAgeDays?: number;
  /** Text search query */
  searchQuery?: string;
  /** Whether to show all models or just recommended */
  showAll?: boolean;
}

/**
 * OpenRouter chat completion request
 */
export interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * OpenRouter chat completion response
 */
export interface OpenRouterChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AI matching result for a single post
 */
export interface AIMatchResult {
  /** Post ID */
  postId: string;
  /** Relevance score (0-1) */
  score: number;
  /** Reason for the match */
  reason: string;
  /** Reply suggestions */
  suggestions: string[];
}

/**
 * Response from AI matching batch
 */
export interface AIMatchBatchResponse {
  results: AIMatchResult[];
}
