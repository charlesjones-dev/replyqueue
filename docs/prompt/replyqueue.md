# ReplyQueue - Chrome Extension Implementation Plan

## Project Overview

Build a Chrome extension that helps content creators identify social media posts relevant to their blog content, surfacing engagement opportunities without automating any platform interactions.

The extension reads the user's social feed as they browse normally, extracts post content from the DOM, and uses AI-powered semantic matching to compare posts against the user's blog content (via RSS feed). Relevant posts are displayed in a side panel, ranked by relevance score.

**Important**: While V1 focuses exclusively on LinkedIn, the architecture must be designed for cross-platform support from the start. Future platforms will include Twitter/X, Bluesky, Threads, and others. All platform-specific logic should be isolated and abstracted behind common interfaces.

## Core Value Proposition

- Surface social media posts that relate to topics the user has written about
- Generate contextual reply suggestions that match the user's personal writing style
- Include blog URLs in suggestions for easy engagement and traffic generation
- Enable strategic commenting on relevant discussions to build authority
- No automation of platform actions (fully ToS compliant, user manually posts)
- Configurable via RSS feed so any content creator can use it
- Cross-platform architecture: start with LinkedIn, expand to Twitter/X, Bluesky, Threads

## Technical Architecture

### Cross-Platform Design Principles

The extension must be architected to support multiple social platforms. All platform-specific code should be isolated behind interfaces:

```typescript
// Platform adapter interface - each platform implements this
interface PlatformAdapter {
  platformId: string;                    // 'linkedin' | 'twitter' | 'bluesky' | etc.
  displayName: string;
  hostPatterns: string[];                // URL patterns for manifest
  feedSelectors: FeedSelectors;          // DOM selectors for this platform
  extractPost(element: Element): Post | null;
  getPostUrl(post: Post): string;
  scrollToPost(postId: string): void;
}

// Raw post extracted from DOM
interface Post {
  id: string;
  platformId: string;
  authorName: string;
  authorHandle?: string;
  authorHeadline?: string;
  content: string;
  engagement: {
    likes?: number;
    comments?: number;
    reposts?: number;
  };
  timestamp?: Date;
  url: string;
}

// Post with AI-generated match data
interface MatchedPost extends Post {
  relevanceScore: number;
  matchedBlogPost: {
    title: string;
    url: string;
  };
  matchReason: string;
  replySuggestions: string[];  // 2-3 suggested replies with blog URL appended
}
```

V1 ships with only the LinkedIn adapter, but the core matching logic, storage, UI, and API integration remain platform-agnostic.

### Extension Components

1. **Content Script** (runs on supported platform domains)
   - Load appropriate platform adapter based on current domain
   - Observe feed posts as user scrolls using MutationObserver
   - Extract post data via adapter: author name, author headline, post text, engagement metrics, post URL/identifier, timestamp
   - Debounce extraction to avoid excessive processing
   - Send extracted posts to background worker via message passing

2. **Background Service Worker**
   - Fetch and cache RSS feed content with configurable TTL (default: 1 hour)
   - Parse RSS feed and extract: post titles, descriptions, full content, keywords/tags, URLs
   - Manage OpenRouter API calls for semantic matching
   - Score posts against blog content (platform-agnostic)
   - Store processed results in chrome.storage.local
   - Handle rate limiting and error states gracefully

3. **Side Panel UI**
   - Display ranked list of relevant posts (grouped by platform when multiple supported)
   - Show relevance score, post preview, author info, platform indicator
   - Click-to-scroll: clicking a result scrolls the tab to that post
   - Settings/configuration interface
   - Connection status indicators (RSS loaded, API configured, etc.)

### Data Flow

```
Platform DOM → Content Script → Background Worker → OpenRouter API
     ↑               ↓                 ↓
Platform Adapter   Message         RSS Feed Cache
                  Passing               ↓
                                 Relevance Scoring
                                       ↓
                                Side Panel Display
```

## Configuration Options

Store in `chrome.storage.sync` for cross-device persistence:

```typescript
interface ExtensionConfig {
  // Required
  rssFeedUrl: string;
  
  // OpenRouter (optional - enables semantic matching)
  openRouterApiKey: string;
  selectedModel: string;
  showAllModels: boolean;           // default false (show only recommended)
  
  // Model filtering (applies to "All Models" list)
  maxModelBlendedPrice: number;     // default 6 (dollars per 1M tokens)
  maxModelAgeMonths: number;        // default 6 (months)
  
  // Writing Style (optional - improves reply suggestions)
  exampleComments: string[];  // User's past comments for tone matching
  
  // Preferences
  matchingThreshold: number;      // 0-1, default 0.6
  maxPostsToDisplay: number;      // default 20
  rssCacheTtlMinutes: number;     // default 60
  enableNotifications: boolean;   // default false
}
```

### Writing Style Examples

Users can provide an unlimited list of comments they've previously written on social media. These examples are included in the AI prompt to help generate reply suggestions that match the user's personal voice, tone, and writing style.

**Storage considerations:**
- Each comment stored as a string in an array
- No practical limit on number of examples, but UI should handle large lists gracefully
- Only send the most recent 10-15 examples to the API to manage token usage
- Store in `chrome.storage.sync` if total size permits, otherwise fall back to `chrome.storage.local`

## Model Selection

### Hybrid Approach: Recommended + Dynamic

Combine a curated recommended list with dynamic loading from OpenRouter's API. **Critically, recommended models must be validated against the API response. If a recommended model doesn't exist in OpenRouter's current offerings, don't display it.**

**Recommended models** (defined in constants, updated with releases):
```typescript
// src/shared/constants.ts
export const RECOMMENDED_MODELS = [
  'anthropic/claude-haiku-4.5',   // Default - fast, cheap, good for this use case
  'anthropic/claude-sonnet-4.5',  // Higher quality option
] as const;

// Default model - fast, cheap, good enough for matching/reply generation
export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';
```

**Validation logic:**
```typescript
// Only show recommended models that actually exist in OpenRouter
function getValidatedRecommendedModels(
  recommended: string[],
  availableFromApi: OpenRouterModel[]
): OpenRouterModel[] {
  const availableIds = new Set(availableFromApi.map(m => m.id));
  
  return recommended
    .filter(id => availableIds.has(id))
    .map(id => availableFromApi.find(m => m.id === id)!);
}

// If default model doesn't exist, fall back to first available recommended
function getDefaultModel(
  validatedRecommended: OpenRouterModel[],
  defaultId: string
): string {
  const defaultExists = validatedRecommended.some(m => m.id === defaultId);
  if (defaultExists) return defaultId;
  if (validatedRecommended.length > 0) return validatedRecommended[0].id;
  return ''; // No valid models - should show error state
}
```

**Dynamic loading from OpenRouter:**
```typescript
// Fetch available models from OpenRouter API
// https://openrouter.ai/api/v1/models
interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };  // Cost per 1M tokens
  context_length: number;
  created: number;  // Unix timestamp of model release
}

// Default filter values
// $6 blended price filters out expensive frontier models (overkill for this task)
// 6 months age filters out models with outdated training data
const DEFAULT_MAX_BLENDED_PRICE = 6;    // $6 per 1M tokens
const DEFAULT_MAX_MODEL_AGE_MONTHS = 6; // 6 months

// Cache duration: 1 hour
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchAvailableModels(apiKey: string, forceRefresh = false): Promise<OpenRouterModel[]> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await chrome.storage.local.get('openRouterModels');
    if (cached.openRouterModels) {
      const { data, timestamp } = cached.openRouterModels;
      if (Date.now() - timestamp < MODEL_CACHE_TTL_MS) {
        return data;
      }
    }
  }
  
  // Fetch fresh data
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await response.json();
  
  // Cache the result
  await chrome.storage.local.set({
    openRouterModels: { data: data.data, timestamp: Date.now() }
  });
  
  return data.data;
}

// Blended price: weighs input 3x more than output (typical for this use case)
function getBlendedPrice(model: OpenRouterModel): number {
  const inputCost = parseFloat(model.pricing.prompt);
  const outputCost = parseFloat(model.pricing.completion);
  return (3 * inputCost + outputCost) / 4;
}

// Get model age in months
function getModelAgeMonths(model: OpenRouterModel): number {
  const now = Date.now();
  const createdAt = model.created * 1000; // Convert to milliseconds
  const ageMs = now - createdAt;
  return ageMs / (1000 * 60 * 60 * 24 * 30); // Approximate months
}

// Filter models by price and age
function filterModels(
  models: OpenRouterModel[],
  maxBlendedPrice: number,
  maxAgeMonths: number
): OpenRouterModel[] {
  return models.filter(model => {
    const price = getBlendedPrice(model);
    const ageMonths = getModelAgeMonths(model);
    
    return price <= maxBlendedPrice && ageMonths <= maxAgeMonths;
  });
}

// Sort models by blended price ascending
function sortModelsByPrice(models: OpenRouterModel[]): OpenRouterModel[] {
  return [...models].sort((a, b) => getBlendedPrice(a) - getBlendedPrice(b));
}

// Full pipeline: filter, then sort
// NOTE: These filters apply ONLY to the "All Models" list
// Recommended models are always shown regardless of price/age filters
function getFilteredAndSortedModels(
  models: OpenRouterModel[],
  maxBlendedPrice: number = DEFAULT_MAX_BLENDED_PRICE,
  maxAgeMonths: number = DEFAULT_MAX_MODEL_AGE_MONTHS
): OpenRouterModel[] {
  const filtered = filterModels(models, maxBlendedPrice, maxAgeMonths);
  return sortModelsByPrice(filtered);
}
```

### Model Selector UI

**Note:** The model selector only renders after the user has completed API key setup. If no valid API key exists, the Setup View is shown instead.

Clean, simple list. Recommended models appear first in the order defined in the constants, followed by all other models (filtered by price/age, sorted by price cheapest first) when enabled.

```
┌─────────────────────────────────────────┐
│ Model                                   │
├─────────────────────────────────────────┤
│ Claude Haiku 4.5                   [$] ✓│
│ Claude Sonnet 4.5                 [$$]  │
├─────────────────────────────────────────┤
│ ☐ Show all models                       │
└─────────────────────────────────────────┘
```

**When "Show all models" is checked:**
```
┌─────────────────────────────────────────┐
│ Model                                   │
├─────────────────────────────────────────┤
│ Filter: [                             ] │
├─────────────────────────────────────────┤
│ ⭐ RECOMMENDED                          │
│ Claude Haiku 4.5                   [$] ✓│
│ Claude Sonnet 4.5                 [$$]  │
├─────────────────────────────────────────┤
│ ALL MODELS (≤$6, ≤6mo, by price ↑)      │
│ Llama 3 8B                         [$]  │
│ Gemini 2.0 Flash                   [$]  │
│ GPT-5 mini                         [$]  │
│ Mistral Medium                    [$$]  │
│ ... (scrollable)                        │
└─────────────────────────────────────────┘
```

**UI behavior:**
- Recommended models always shown at top, in order from constants
- All models section filtered by max blended price and max age (configurable in settings)
- Default filters: ≤$6/1M tokens blended price, ≤6 months old
- This removes expensive frontier models and models with outdated training data
- Filtered models sorted by blended price ascending (cheapest first)
- Checkmark on currently selected model
- Cost tier shown as [$], [$$], [$$$]
- Filter input only visible when "Show all models" is enabled
- Text filter matches against model name (case-insensitive), applied after price/age filters

### Default Model Rationale

**Default: Claude Haiku 4.5**

Why:
- Fast response times for good UX
- Low cost since users will run many queries per session
- Sufficient capability for semantic matching and reply generation
- This isn't a task that requires frontier reasoning

If user wants higher quality matches or more nuanced reply suggestions, they can select Sonnet 4.5 from recommended, or enable "Show all models" to access any model available on OpenRouter.

### Cost Tier Calculation

Derive cost tier dynamically from OpenRouter pricing data using blended price:

```typescript
function calculateCostTier(model: OpenRouterModel): 1 | 2 | 3 {
  const blendedPrice = getBlendedPrice(model);
  
  if (blendedPrice < 0.5) return 1;      // $ - cheap
  if (blendedPrice < 5) return 2;        // $$ - moderate  
  return 3;                              // $$$ - expensive
}
```

### Behavior

- **First launch (no API key):** Show Setup View, block access to other views
- **On API key validated:** Fetch model list, validate recommended models, cache for 1 hour, transition to Main View
- **Subsequent launches:** Check for valid API key, if present load cached models (or refresh if stale), show Main View
- **Cache refresh:** Automatic after 1 hour, or manual via refresh icon in settings header
- **API key removed:** Return user to Setup View
- **Default selection:** Claude Haiku 4.5 if available, otherwise first validated recommended model
- **Fallback:** If API fetch fails, show error on Setup View (cannot proceed without valid model list)
- **Persist selection:** Save selected model ID, validate it still exists on next load

## Matching Strategy

### Without API Key (Basic Mode)
- Keyword extraction from RSS content (titles, tags, key phrases)
- Simple text matching against post content
- Lower accuracy but zero cost
- No reply suggestions available

### With API Key (Semantic Mode)
- Send batch of posts + blog content summaries to selected model
- Request relevance scores (0-1) with brief explanations
- Generate 2-3 reply suggestions per relevant post
- Cache results by post ID to avoid redundant API calls

### Reply Suggestions Feature

When a post is matched with high relevance, generate 2-3 suggested replies that:
- Match the user's writing style (based on their example comments)
- Are conversational and authentic (not salesy or spammy)
- Add value to the discussion (insight, agreement with nuance, question)
- Naturally reference the user's related blog post
- Append the blog post URL at the end
- Vary in approach while maintaining consistent voice

Example output for a post about accessibility challenges (assuming user has a direct, experienced tone):
```
1. "I've seen this pattern too - the real cost isn't compliance fines, it's the users you never reach. We built a whole audit process around this: [blog-url]"

2. "Solid take on the tooling gaps. We've been experimenting with AI-assisted scanning and it catches way more than the legacy tools. Wrote about our approach: [blog-url]"

3. "The compliance vs. usability framing is underrated. Too many teams ship accessible-on-paper but unusable-in-practice. More thoughts here: [blog-url]"
```

Users can click to copy any suggestion, then paste and personalize before posting.

### Prompt Template for Semantic Matching

```
You are analyzing social media posts for relevance to a content creator's blog, and generating reply suggestions that match their writing style.

## Blog Content (from RSS feed):
{array of blog posts with title, url, summary, key themes}

## User's Writing Style Examples:
{array of example comments the user has written previously - use these to match their tone, vocabulary, and style}

## Social Media Posts to Analyze:
{array of post objects with id, platform, author, text}

For each post with relevance >= 0.4, return a JSON array:
[
  {
    "postId": "string",
    "relevanceScore": 0.0-1.0,
    "matchedBlogPost": {
      "title": "string",
      "url": "string"
    },
    "reason": "brief explanation (max 20 words)",
    "replySuggestions": [
      "Conversational reply that adds value and ends with the blog URL",
      "Alternative reply with different tone/angle and the blog URL",
      "Third option with a question or thought-provoking take and the blog URL"
    ]
  }
]

Reply guidelines:
- Match the user's writing style based on their example comments (tone, vocabulary, sentence structure)
- Sound human and conversational, not promotional
- Add genuine value (insight, experience, question)
- Vary the approach across suggestions while maintaining consistent voice
- Keep replies under 280 characters when possible (Twitter-friendly)
- Always end with the matched blog post URL
- Never start with "Great post!" or similar generic openers
- If no writing examples provided, use a professional but approachable tone
```

## UI/UX Design

### Application Flow

The extension has three main views. **Setup View must be completed before any other view is accessible.**

1. **Setup View** - Required onboarding (API key + RSS feed validation)
2. **Main View** - Primary interface showing matched posts and reply suggestions
3. **Settings View** - Full configuration panel (only accessible after setup)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Setup View    │────▶│    Main View    │◀───▶│  Settings View  │
│  (required)     │     │   (primary)     │     │ (configuration) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                                                │
       └────────────────────────────────────────────────┘
                    (if API key removed)
```

**Critical:** No OpenRouter API calls are made until the Setup View is completed. The model selector, matching functionality, and reply generation are all gated behind successful setup validation.

### Side Panel Layout - Setup View (Onboarding)

Shown by default until user completes both required setup steps. No API requests are made until validation passes. The model selector and main functionality are completely hidden until setup is complete.

**Setup is required before the extension is functional:**
1. OpenRouter API key (validated before proceeding)
2. RSS Feed URL (validated before proceeding)

```
┌─────────────────────────────────────────┐
│ ReplyQueue                              │
├─────────────────────────────────────────┤
│                                         │
│        Welcome to ReplyQueue! 👋        │
│                                         │
│  Let's get you set up.                  │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ STEP 1 OF 2: OpenRouter API Key         │
│                                         │
│ ReplyQueue uses AI to find relevant     │
│ posts and suggest replies.              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Paste your API key...         [👁️] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Don't have one?                         │
│ [Get a free key at openrouter.ai →]     │
│                                         │
│ [Validate Key]                          │
│                                         │
│ ✓ API key is valid                      │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ STEP 2 OF 2: Your Blog's RSS Feed       │
│                                         │
│ We'll match posts to your blog content. │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ https://yourblog.com/feed.xml       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Test Feed]                             │
│                                         │
│ ✓ Feed valid (12 posts found)           │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ ℹ️ Your API key is stored locally and   │
│ only sent to OpenRouter.                │
│                                         │
├─────────────────────────────────────────┤
│            [Complete Setup]             │
│     (enabled when both steps valid)     │
└─────────────────────────────────────────┘
```

### Pre-API Call Validation

Before making any requests to OpenRouter or external RSS feeds, perform these checks:

```typescript
// src/shared/validation.ts

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================
// API Key Validation (before any OpenRouter calls)
// ============================================

function validateApiKeyFormat(apiKey: string): ValidationResult {
  // Check not empty
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }
  
  // Check reasonable length (OpenRouter keys are typically 40+ chars)
  if (apiKey.trim().length < 20) {
    return { valid: false, error: 'API key appears too short' };
  }
  
  // Check for common mistakes (spaces, quotes)
  if (apiKey.includes(' ') || apiKey.includes('"') || apiKey.includes("'")) {
    return { valid: false, error: 'API key should not contain spaces or quotes' };
  }
  
  return { valid: true };
}

async function validateApiKeyWithServer(apiKey: string): Promise<ValidationResult> {
  // First check format
  const formatCheck = validateApiKeyFormat(apiKey);
  if (!formatCheck.valid) return formatCheck;
  
  // Then test with actual API call
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    });
    
    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (response.status === 403) {
      return { valid: false, error: 'API key does not have required permissions' };
    }
    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Could not connect to OpenRouter. Check your internet connection.' };
  }
}

// ============================================
// RSS Feed Validation (before fetching feeds)
// ============================================

function validateRssUrlFormat(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'RSS feed URL is required' };
  }
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must start with http:// or https://' };
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  
  return { valid: true };
}

async function validateRssFeed(url: string): Promise<ValidationResult & { postCount?: number }> {
  // First check format
  const formatCheck = validateRssUrlFormat(url);
  if (!formatCheck.valid) return formatCheck;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return { valid: false, error: `Could not fetch feed: ${response.status}` };
    }
    
    const text = await response.text();
    
    // Basic check for RSS/Atom content
    if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<channel')) {
      return { valid: false, error: 'URL does not appear to be a valid RSS/Atom feed' };
    }
    
    // Parse and count items
    const parser = new RssParser();
    const feed = await parser.parseString(text);
    const postCount = feed.items?.length || 0;
    
    if (postCount === 0) {
      return { valid: false, error: 'Feed is valid but contains no posts' };
    }
    
    return { valid: true, postCount };
  } catch (error) {
    return { valid: false, error: 'Could not parse RSS feed. Ensure URL points to a valid feed.' };
  }
}

// ============================================
// Startup check - determines which view to show
// ============================================

interface SetupStatus {
  isComplete: boolean;
  hasApiKey: boolean;
  hasRssFeed: boolean;
}

async function checkSetupStatus(): Promise<SetupStatus> {
  const config = await chrome.storage.sync.get(['openRouterApiKey', 'rssFeedUrl']);
  
  const hasApiKey = !!(config.openRouterApiKey && config.openRouterApiKey.trim().length > 0);
  const hasRssFeed = !!(config.rssFeedUrl && config.rssFeedUrl.trim().length > 0);
  
  return {
    isComplete: hasApiKey && hasRssFeed,
    hasApiKey,
    hasRssFeed,
  };
}
```

### Setup View Behavior
- **On extension open:** Call `checkSetupStatus()` to determine which view to show
- **If setup incomplete:** Show Setup View, hide all other functionality
- **Step 1 validation:** "Validate Key" button runs `validateApiKeyWithServer()`
- **Step 2 validation:** "Test Feed" button runs `validateRssFeed()`
- **Complete Setup button:** Only enabled when both steps show valid checkmarks
- **On Complete Setup click:**
  1. Save API key and RSS URL to storage
  2. Fetch and cache model list (first API call)
  3. Fetch and cache RSS content
  4. Transition to Main View
- **After setup:** User can modify settings anytime via Settings View
- **If API key is removed:** Return user to Setup View immediately

### Model Selector Conditional Rendering

**The model selector component should not render at all if:**
- No API key is configured
- API key validation has not passed
- Model list has not been successfully fetched

```typescript
// In ModelSelector.vue or useModels.ts
const canShowModelSelector = computed(() => {
  return !!(
    config.openRouterApiKey &&
    models.value.length > 0 &&
    !modelsLoading.value &&
    !modelsError.value
  );
});
```

If the model selector cannot render, show a message directing user to settings to configure their API key.

### Side Panel Layout - Main View

**Note:** This view is only shown after the user has completed the Setup View and has a valid API key configured.

```
┌─────────────────────────────────────────┐
│ ReplyQueue                         [⚙️] │
├─────────────────────────────────────────┤
│ Claude Haiku 4.5                   [$]  │
├─────────────────────────────────────────┤
│ ● RSS Connected (12 posts cached)       │
│ ● 47 posts scanned (LinkedIn)           │
├─────────────────────────────────────────┤
│                                         │
│ 🎯 8 Relevant Posts Found               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 92% Match              [in] LinkedIn│ │
│ │ @johndoe · Product Designer         │ │
│ │ "Accessibility isn't just about     │ │
│ │ compliance, it's about reaching..." │ │
│ │ 💬 34  👍 256  🔄 12                 │ │
│ │ Matches: "WCAG 2.1 Compliance"      │ │
│ │                                     │ │
│ │ 💬 Suggested Replies:               │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ "This resonates - the real cost │ │ │
│ │ │ isn't fines, it's users you..." │ │ │
│ │ │                         [Copy]  │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ "Great point about tooling..."  │ │ │
│ │ │                         [Copy]  │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ "The compliance vs usability    │ │ │
│ │ │ framing is spot on..."  [Copy]  │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │                                     │ │
│ │ [Jump to Post]    [Regenerate 🔄]  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 78% Match              [in] LinkedIn│ │
│ │ ...                                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│                            [🔄 Refresh] │
└─────────────────────────────────────────┘
```

### Post Card Interactions
- **Copy button**: Copies reply text to clipboard, shows brief "Copied!" confirmation
- **Regenerate button**: Calls API again for fresh suggestions (uses tokens)
- **Jump to Post**: Scrolls the LinkedIn tab to that post
- **Expandable replies**: Show first reply by default, expand to see all three

### Side Panel Layout - Settings View

Clicking the ⚙️ cog icon replaces the main view with the settings view (same sidebar, not a popup or modal).

```
┌─────────────────────────────────────────┐
│ [←] Settings                       [🔄] │
├─────────────────────────────────────────┤
│                                         │
│ RSS FEED                                │
│ ┌─────────────────────────────────────┐ │
│ │ https://yourblog.com/feed.xml       │ │
│ └─────────────────────────────────────┘ │
│ [Test Connection]                       │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ OPENROUTER API                          │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ API key configured          [Edit]│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Model                                   │
│ ┌─────────────────────────────────────┐ │
│ │ Claude Haiku 4.5               [$] ✓│ │
│ │ Claude Sonnet 4.5             [$$]  │ │
│ └─────────────────────────────────────┘ │
│ ☐ Show all models                       │
│                                         │
│ Model Filters (for "All Models" list)   │
│ Max price ($/1M tokens)                 │
│ [6                                    ] │
│ Max model age (months)                  │
│ [6                                    ] │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ WRITING STYLE EXAMPLES                  │
│ Add comments you've written to help     │
│ generate replies that match your voice. │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ "I've seen this pattern too - the   │ │
│ │ key is starting with user research" │ │
│ │                              [🗑️]   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ "Solid take. We implemented..."     │ │
│ │                              [🗑️]   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ "This is underrated advice..."      │ │
│ │                              [🗑️]   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Add new example comment...          │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                             [+ Add]     │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ MATCHING PREFERENCES                    │
│                                         │
│ Relevance Threshold                     │
│ [====●===========] 0.6                  │
│                                         │
│ Max Posts to Display                    │
│ [20                                 ▼]  │
│                                         │
│ Cache Duration (minutes)                │
│ [60                                   ] │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ [Clear Cache]                           │
│                                         │
├─────────────────────────────────────────┤
│ [Cancel]                       [Save]   │
└─────────────────────────────────────────┘
```

### Settings View Behavior
- **⚙️ cog icon**: Opens settings view within the sidebar (replaces main view)
- **[←] back arrow**: Returns to main view (same as Cancel if no changes)
- **[🔄] refresh icon**: Manually refreshes model list from OpenRouter API (bypasses cache), shows loading spinner during fetch
- **Save button**: Persists all settings to chrome.storage, returns to main view, triggers RSS re-fetch if URL changed
- **Cancel button**: Discards unsaved changes, returns to main view
- **Unsaved changes warning**: If user clicks back arrow with unsaved changes, prompt to confirm discard
- **Form validation**: Validate RSS URL format before allowing save

### Model Filter Settings
- **Max price**: Numeric input for maximum blended price in $/1M tokens (default: 6)
- **Max age**: Numeric input for maximum model age in months (default: 6)
- Filters only apply to the "All Models" list, not to recommended models
- Changing these values re-filters the model list immediately (no need to refresh from API)
- If currently selected model no longer passes filters, keep it selected but show a warning

### API Key Management in Settings
- Shows "✓ API key configured" with an Edit button (not the actual key)
- **Edit button**: Expands to show masked key field with options to view, change, or remove
- **Remove API key**: Prompts for confirmation, then clears key and returns user to Setup View
- API key changes require re-validation before saving

### Writing Style Examples UI
- Scrollable list of user-provided example comments
- Each example shows a preview with a delete (🗑️) button
- Textarea at bottom to add new examples
- No limit on number of examples (handle large lists with virtual scrolling if needed)
- Examples are editable (click to expand and edit in place)

## Technical Requirements

### Chrome Extension Storage

Extensions have dedicated storage APIs separate from web localStorage:

| API | Quota | Syncs Across Devices | Use Case |
|-----|-------|---------------------|----------|
| `chrome.storage.sync` | ~100KB total, 8KB per item | Yes (via Chrome account) | Settings, preferences |
| `chrome.storage.local` | ~10MB (can request unlimited) | No | Large data, caches |
| `chrome.storage.session` | ~10MB | No (clears on browser close) | Temporary state |

**Storage strategy for ReplyQueue:**

```typescript
// Settings (sync across devices)
// Stored in chrome.storage.sync
interface SyncedSettings {
  rssFeedUrl: string;
  openRouterApiKey: string;
  selectedModel: string;
  showAllModels: boolean;
  maxModelBlendedPrice: number;   // default 6
  maxModelAgeMonths: number;      // default 6
  matchingThreshold: number;
  maxPostsToDisplay: number;
  rssCacheTtlMinutes: number;
  enableNotifications: boolean;
}

// Writing examples (may exceed sync limits)
// Stored in chrome.storage.local with sync fallback attempt
interface LocalSettings {
  exampleComments: string[];  // Can grow large
}

// Cached data (never synced)
// Stored in chrome.storage.local
interface CachedData {
  rssFeedCache: { data: RssFeed; timestamp: number };
  extractedPosts: Post[];
  matchResults: Record<string, MatchedPost>;  // Keyed by post ID
  openRouterModels: { data: OpenRouterModel[]; timestamp: number };  // Cache for 1 hour
}
```

**Handling storage limits:**

```typescript
// Helper to safely store writing examples
async function saveExampleComments(comments: string[]): Promise<void> {
  const data = JSON.stringify(comments);
  
  // Try sync first if under 8KB
  if (data.length < 8000) {
    try {
      await chrome.storage.sync.set({ exampleComments: comments });
      await chrome.storage.local.remove('exampleComments'); // Clean up local
      return;
    } catch (e) {
      // Fall through to local storage
    }
  }
  
  // Fall back to local storage for large lists
  await chrome.storage.local.set({ exampleComments: comments });
  await chrome.storage.sync.remove('exampleComments'); // Clean up sync
}

// Helper to read from either location
async function getExampleComments(): Promise<string[]> {
  const sync = await chrome.storage.sync.get('exampleComments');
  if (sync.exampleComments) return sync.exampleComments;
  
  const local = await chrome.storage.local.get('exampleComments');
  return local.exampleComments || [];
}
```

**Storage utilities to implement:**
- `src/shared/storage.ts` should wrap all chrome.storage calls
- Provide typed getters/setters for each config section
- Handle the sync/local fallback for large data transparently
- Include a `clearCache()` function that preserves settings
- Listen for `chrome.storage.onChanged` to reactively update UI

### Manifest V3 Compliance

**Note:** Manifest V3 is the current, actively supported extension format. Manifest V2 is deprecated and being phased out. This project uses MV3 from the start.

- Use service workers (not background pages)
- Declare appropriate permissions: storage, sidePanel, activeTab
- Host permissions for linkedin.com and RSS feed domains
- Content Security Policy considerations for API calls

### Permissions Needed
```json
{
  "permissions": [
    "storage",
    "sidePanel",
    "activeTab"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://linkedin.com/*",
    "https://openrouter.ai/*"
  ]
}
```

**Note:** OpenRouter host permission required for both model list fetching and chat completions API calls.

### Vue 3 + Chrome Extension Setup
- Use `@crxjs/vite-plugin` for hot reload and manifest generation
- Vue 3 with `<script setup>` syntax for cleaner components
- Composition API with TypeScript for type-safe composables
- Pinia optional (chrome.storage may be sufficient for this scope)
- Configure Vite to build separate entry points: content script, background worker, side panel

### Key Dependencies
```json
{
  "dependencies": {
    "vue": "^3.4",
    "rss-parser": "^3.13"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta",
    "@types/chrome": "^0.0.268",
    "@vitejs/plugin-vue": "^5.0",
    "typescript": "^5.0",
    "vite": "^5.0",
    "tailwindcss": "^3.4",
    "autoprefixer": "^10.4",
    "postcss": "^8.4"
  }
}
```

**Note on @types/chrome:** Provides full TypeScript definitions for all chrome.* APIs including storage, runtime, tabs, and sidePanel.

### Performance Considerations
- Debounce DOM observations (500ms minimum)
- Batch API calls (don't call per-post)
- Cache aggressively (RSS content, API responses by post ID)
- Lazy load side panel content
- Limit stored posts to prevent storage bloat
- Use `shallowRef` for large post arrays to minimize reactivity overhead
- Batch chrome.storage writes (don't write on every keystroke in settings)
- Read settings once on load, use reactive state, write only on Save

### Error Handling

**Setup validation errors:**
- API key empty: "API key is required"
- API key too short: "API key appears too short"
- API key has spaces/quotes: "API key should not contain spaces or quotes"
- API key invalid (401): "Invalid API key"
- API key forbidden (403): "API key does not have required permissions"
- Network error during validation: "Could not connect to OpenRouter. Check your internet connection."
- RSS URL empty: "RSS feed URL is required"
- RSS URL invalid format: "Invalid URL format" or "URL must start with http:// or https://"
- RSS fetch failed: "Could not fetch feed: {status}"
- RSS not valid XML: "URL does not appear to be a valid RSS/Atom feed"
- RSS empty: "Feed is valid but contains no posts"

**Runtime errors:**
- RSS fetch failures: show clear error, offer retry
- Invalid RSS format: validate and provide feedback
- API key invalid/expired: return to Setup View
- Model list fetch failed: show error, cannot proceed without models
- Selected model no longer available: prompt user to select new model, suggest default
- Model unavailable during generation: offer fallback to Haiku
- Rate limiting: implement exponential backoff
- Network offline: graceful degradation to cached data

## File Structure

```
replyqueue/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── platforms/
│   │   ├── index.ts              # Platform registry and loader
│   │   ├── types.ts              # PlatformAdapter interface, Post type
│   │   ├── linkedin/
│   │   │   ├── adapter.ts        # LinkedIn-specific implementation
│   │   │   └── selectors.ts      # LinkedIn DOM selectors
│   │   └── _template/            # Template for adding new platforms
│   │       ├── adapter.ts
│   │       └── selectors.ts
│   ├── content/
│   │   ├── index.ts              # Content script entry
│   │   ├── dom-observer.ts       # Generic feed observation logic
│   │   └── post-extractor.ts     # Uses platform adapter to extract
│   ├── background/
│   │   ├── index.ts              # Service worker entry
│   │   ├── rss-fetcher.ts        # RSS fetching and parsing
│   │   ├── openrouter.ts         # API client
│   │   └── matcher.ts            # Relevance scoring logic (platform-agnostic)
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.ts               # Vue app entry
│   │   ├── App.vue
│   │   ├── views/
│   │   │   ├── SetupView.vue     # Onboarding - API key setup
│   │   │   ├── MainView.vue      # Primary interface
│   │   │   └── SettingsView.vue  # Full settings panel
│   │   ├── components/
│   │   │   ├── PostCard.vue      # Renders any platform's post
│   │   │   ├── ReplySuggestion.vue # Individual reply with copy button
│   │   │   ├── PlatformBadge.vue # Visual indicator for post source
│   │   │   ├── ModelSelector.vue # Model selection list
│   │   │   ├── StatusBar.vue
│   │   │   ├── ApiKeyInput.vue   # Reusable API key input with validation
│   │   │   ├── ExampleCommentsList.vue # Writing style examples manager
│   │   │   └── ExampleCommentItem.vue  # Single example with edit/delete
│   │   └── composables/          # Vue 3 Composition API
│   │       ├── useConfig.ts      # Settings state and persistence
│   │       ├── useAppState.ts    # Tracks current view (setup/main/settings)
│   │       ├── useSetup.ts       # Setup flow state and validation
│   │       ├── usePosts.ts
│   │       ├── useClipboard.ts   # Copy to clipboard helper
│   │       ├── useSettingsView.ts # Toggle between main/settings views
│   │       └── useModels.ts      # Fetch and filter OpenRouter models
│   ├── shared/
│   │   ├── types.ts              # Shared TypeScript interfaces
│   │   ├── constants.ts          # Model list, defaults
│   │   ├── storage.ts            # Typed chrome.storage wrappers with sync/local fallback
│   │   ├── validation.ts         # Pre-API call validation helpers
│   │   └── messages.ts           # Message passing types
│   └── styles/
│       └── main.css              # Tailwind directives and custom styles
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── README.md
```

## Technology Stack

- **Build Tool**: Vite with CRXJS plugin for Chrome extension dev
- **Language**: TypeScript throughout
- **UI Framework**: Vue 3 with Composition API for side panel
- **Styling**: Tailwind CSS
- **RSS Parsing**: rss-parser library
- **Storage**: chrome.storage.sync (config) + chrome.storage.local (cache)

## Development Phases

### Phase 1: Foundation
- Project scaffolding with Vite + CRXJS + Vue 3
- Manifest V3 configuration
- Basic content script that logs posts to console
- Side panel shell with Vue app mounted
- Setup View with API key onboarding flow
- App state management (setup vs main vs settings views)

### Phase 2: Core Extraction
- Platform adapter interface and LinkedIn implementation
- Robust DOM observation for LinkedIn feed
- Post data extraction (handle various post formats)
- Message passing between content script and background
- Storage layer with typed wrappers for chrome.storage.sync and chrome.storage.local
- Implement sync/local fallback logic for large data (writing examples)

### Phase 3: RSS Integration & Settings
- RSS fetching and parsing
- Full settings panel UI (opens in sidebar, Save/Cancel workflow)
- Configuration for RSS URL, API key, model selection
- Writing style examples management (add, edit, delete)
- Form validation and unsaved changes warning
- Basic keyword matching (no API required)
- Display matched posts in side panel

### Phase 4: AI-Powered Matching
- OpenRouter integration (completions API)
- Dynamic model loading from OpenRouter models API with caching
- Model selector UI with recommended list, filtering, and cost tiers
- Semantic matching implementation
- Reply suggestion generation with blog URL appending
- Writing style matching using user's example comments
- Copy-to-clipboard functionality
- Regenerate button for fresh suggestions
- Response caching

### Phase 5: Polish
- Error handling and edge cases
- Loading states and transitions
- "Jump to post" scroll functionality
- Performance optimization
- Icon and branding

### Phase 6: Distribution Prep
- README with setup instructions
- Privacy policy (required for Chrome Web Store)
- Screenshots and promotional images
- Chrome Web Store listing

## Privacy Considerations

- No data leaves the user's browser except:
  - RSS fetch (to their own blog)
  - OpenRouter API calls (post content, blog summaries, and writing style examples for matching/reply generation)
- No analytics or tracking
- No storage of social media data beyond local cache
- Writing style examples are stored locally and only sent to OpenRouter when generating suggestions
- Clear documentation of what data is processed
- API key stored locally only
- Reply suggestions are generated but never auto-posted (user always in control)

## Future Enhancements (Out of Scope for V1)

### Platform Expansion (V2 Priority)
- Twitter/X adapter
- Bluesky adapter
- Threads adapter
- Platform toggle in settings (enable/disable per platform)
- Unified feed view across all platforms

### Writing Style Enhancements
- Import existing comments from LinkedIn profile automatically
- Analyze writing patterns to show style insights
- Multiple writing style profiles (professional vs casual)

### Model & AI Enhancements
- Per-task model selection (different model for matching vs reply generation)
- Cost estimation before API calls
- Usage tracking and budget alerts
- Local model support via Ollama

### Additional Features
- Firefox compatibility
- Multiple RSS feeds
- Custom keyword lists (beyond RSS content)
- Engagement history tracking
- Export matched posts
- Keyboard shortcuts
- Dark mode

## Success Criteria

1. Extension installs and runs on Chrome without errors
2. Setup View shown on first launch with two-step onboarding (API key + RSS feed)
3. No API requests made until Setup View is completed with valid credentials
4. API key validated before being accepted (format check + server validation)
5. RSS feed validated before being accepted (URL format + fetch + parse check)
6. Main View and Settings View only accessible after setup is complete
7. Model selector does not render until API key is validated and models are loaded
8. Successfully extracts posts from LinkedIn feed via platform adapter
9. Platform adapter architecture is clean and documented (easy to add new platforms)
10. Parses standard RSS feeds correctly
11. Displays relevant posts ranked by score with platform indicator
12. Generates 2-3 contextual reply suggestions per matched post with blog URL appended
13. Reply suggestions reflect user's writing style when examples are provided
14. Settings panel opens within sidebar with all configuration options
15. Writing style examples can be added, edited, and deleted without limit
16. Model selector dynamically loads from OpenRouter API with recommended list always shown
17. "All Models" list filtered by configurable max price ($6 default) and max age (6 months default)
18. Model list cached for 1 hour with manual refresh option in settings
19. Copy-to-clipboard works reliably for reply suggestions
20. OpenRouter integration works with dynamically selected models
21. Settings persist across browser sessions (Save/Cancel workflow functions correctly)
22. Graceful fallbacks when API calls fail (models, RSS, completions)
23. If API key is removed or invalidated, user is returned to Setup View
24. No LinkedIn ToS violations (pure DOM reading, no automation)