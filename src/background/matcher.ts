/**
 * Post Matcher
 * Matches extracted posts against RSS feed keywords using keyword or AI matching
 */

import type {
  ExtractedPostRecord,
  MatchedPostWithScore,
  MatchResult,
  MatchingPreferences,
  RssFeed,
  RssFeedItem,
  ReplySuggestion,
  AIMatchResult,
  HeatCheckResult,
  PostTone,
} from '../shared/types';
import {
  DEFAULT_MATCHING_PREFERENCES,
  MAX_STYLE_EXAMPLES_IN_PROMPT,
  REPLY_SUGGESTIONS_COUNT,
} from '../shared/constants';
import { chatCompletion } from './openrouter';

const LOG_PREFIX = '[ReplyQueue:Matcher]';

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((word) => word.length >= 2);
}

/**
 * Calculate keyword match score for a post
 * Returns a score between 0 and 1
 */
function calculateMatchScore(
  post: ExtractedPostRecord,
  keywords: string[]
): { score: number; matchedKeywords: string[] } {
  if (keywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }

  // Combine all post text
  const postText = [post.content, post.authorName, post.authorHeadline || ''].join(' ');

  const normalizedPostText = normalizeText(postText);
  const postWords = new Set(tokenize(postText));

  const matchedKeywords: string[] = [];
  let totalWeight = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    // Check for exact phrase match (higher weight)
    if (normalizedPostText.includes(normalizedKeyword)) {
      matchedKeywords.push(keyword);
      // Longer keywords get higher weight
      totalWeight += 1 + (normalizedKeyword.split(' ').length - 1) * 0.5;
      continue;
    }

    // Check for word match
    const keywordWords = tokenize(keyword);
    const wordMatches = keywordWords.filter((kw) => postWords.has(kw));

    if (wordMatches.length > 0) {
      matchedKeywords.push(keyword);
      // Partial match gets proportional weight
      totalWeight += wordMatches.length / keywordWords.length;
    }
  }

  // Calculate score normalized to 0-1
  // Score based on whether ANY relevant keywords matched, not requiring all keywords
  // A post matching 3+ keywords with good weight should score well
  if (matchedKeywords.length === 0) {
    return { score: 0, matchedKeywords };
  }

  // Base score on number of matched keywords and their weight
  // 1 keyword = ~0.2, 3 keywords = ~0.5, 5+ keywords = ~0.7+
  const keywordCountScore = Math.min(1, matchedKeywords.length / 5);
  const avgWeight = totalWeight / matchedKeywords.length;
  const weightScore = Math.min(1, avgWeight);

  // Combined score: weighted average of keyword count and match quality
  const score = Math.min(1, keywordCountScore * 0.6 + weightScore * 0.4);

  return { score, matchedKeywords };
}

/**
 * Generate a human-readable match reason
 */
function generateMatchReason(matchedKeywords: string[]): string {
  if (matchedKeywords.length === 0) {
    return 'No specific keywords matched';
  }

  if (matchedKeywords.length === 1) {
    return `Matched keyword: "${matchedKeywords[0]}"`;
  }

  if (matchedKeywords.length <= 3) {
    return `Matched keywords: ${matchedKeywords.map((k) => `"${k}"`).join(', ')}`;
  }

  return `Matched ${matchedKeywords.length} keywords including: ${matchedKeywords
    .slice(0, 3)
    .map((k) => `"${k}"`)
    .join(', ')}`;
}

/**
 * Match posts against keywords
 */
export function matchPosts(
  posts: ExtractedPostRecord[],
  keywords: string[],
  preferences: MatchingPreferences = DEFAULT_MATCHING_PREFERENCES
): MatchResult {
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} Matching ${posts.length} posts against ${keywords.length} keywords`);
  console.log(`${LOG_PREFIX} Preferences: threshold=${preferences.threshold}, maxPosts=${preferences.maxPosts}`);

  const matches: MatchedPostWithScore[] = [];

  for (const post of posts) {
    const { score, matchedKeywords } = calculateMatchScore(post, keywords);

    if (score >= preferences.threshold) {
      matches.push({
        post,
        score,
        matchedKeywords,
        matchReason: generateMatchReason(matchedKeywords),
        matchedAt: Date.now(),
        status: 'pending',
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Limit to maxPosts
  const limitedMatches = matches.slice(0, preferences.maxPosts);

  const processingTimeMs = Date.now() - startTime;

  console.log(
    `${LOG_PREFIX} Found ${matches.length} matches (showing top ${limitedMatches.length}) in ${processingTimeMs}ms`
  );

  return {
    matches: limitedMatches,
    totalEvaluated: posts.length,
    keywords,
    processingTimeMs,
  };
}

/**
 * Re-score existing matches with new keywords
 * Preserves status and draft replies
 */
export function rescoreMatches(
  existingMatches: MatchedPostWithScore[],
  keywords: string[],
  preferences: MatchingPreferences = DEFAULT_MATCHING_PREFERENCES
): MatchResult {
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} Re-scoring ${existingMatches.length} existing matches`);

  const updatedMatches: MatchedPostWithScore[] = [];

  for (const existing of existingMatches) {
    const { score, matchedKeywords } = calculateMatchScore(existing.post, keywords);

    if (score >= preferences.threshold) {
      updatedMatches.push({
        ...existing,
        score,
        matchedKeywords,
        matchReason: generateMatchReason(matchedKeywords),
        matchedAt: Date.now(),
        // Preserve status and draft reply
      });
    }
  }

  // Sort by score descending
  updatedMatches.sort((a, b) => b.score - a.score);

  // Limit to maxPosts
  const limitedMatches = updatedMatches.slice(0, preferences.maxPosts);

  const processingTimeMs = Date.now() - startTime;

  return {
    matches: limitedMatches,
    totalEvaluated: existingMatches.length,
    keywords,
    processingTimeMs,
  };
}

/**
 * Merge new matches with existing ones
 * Preserves status for posts that were already matched
 */
export function mergeMatches(
  existingMatches: MatchedPostWithScore[],
  newMatches: MatchedPostWithScore[],
  maxPosts: number = DEFAULT_MATCHING_PREFERENCES.maxPosts
): MatchedPostWithScore[] {
  // Create a map of existing matches by post ID
  const existingMap = new Map<string, MatchedPostWithScore>();
  for (const match of existingMatches) {
    const key = `${match.post.platform}:${match.post.id}`;
    existingMap.set(key, match);
  }

  // Merge new matches
  const merged: MatchedPostWithScore[] = [];

  for (const newMatch of newMatches) {
    const key = `${newMatch.post.platform}:${newMatch.post.id}`;
    const existing = existingMap.get(key);

    if (existing) {
      // Preserve status and draft reply from existing match
      merged.push({
        ...newMatch,
        status: existing.status,
        draftReply: existing.draftReply,
      });
      existingMap.delete(key);
    } else {
      merged.push(newMatch);
    }
  }

  // Add any existing matches not in new results that haven't been acted on
  for (const existing of existingMap.values()) {
    if (existing.status !== 'pending') {
      merged.push(existing);
    }
  }

  // Sort by score descending
  merged.sort((a, b) => b.score - a.score);

  return merged.slice(0, maxPosts);
}

/**
 * Filter matches by status
 */
export function filterMatchesByStatus(
  matches: MatchedPostWithScore[],
  status: MatchedPostWithScore['status']
): MatchedPostWithScore[] {
  return matches.filter((m) => m.status === status);
}

/**
 * Update match status
 */
export function updateMatchStatus(
  matches: MatchedPostWithScore[],
  postId: string,
  platform: string,
  status: MatchedPostWithScore['status'],
  draftReply?: string
): MatchedPostWithScore[] {
  return matches.map((match) => {
    if (match.post.id === postId && match.post.platform === platform) {
      return {
        ...match,
        status,
        draftReply: draftReply !== undefined ? draftReply : match.draftReply,
      };
    }
    return match;
  });
}

/**
 * Get statistics about matches
 */
export function getMatchStats(matches: MatchedPostWithScore[]): {
  total: number;
  pending: number;
  replied: number;
  skipped: number;
  averageScore: number;
} {
  const stats = {
    total: matches.length,
    pending: 0,
    replied: 0,
    skipped: 0,
    averageScore: 0,
  };

  let totalScore = 0;

  for (const match of matches) {
    totalScore += match.score;
    switch (match.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'replied':
        stats.replied++;
        break;
      case 'skipped':
        stats.skipped++;
        break;
    }
  }

  stats.averageScore = matches.length > 0 ? totalScore / matches.length : 0;

  return stats;
}

// ============================================================
// AI Matching Functions
// ============================================================

/**
 * Generate a unique ID for a suggestion
 */
function generateSuggestionId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Cache key for AI match results
 */
function getAICacheKey(postId: string, platform: string): string {
  return `${platform}:${postId}`;
}

/**
 * AI match cache stored in memory during session
 */
const aiMatchCache = new Map<
  string,
  {
    result: AIMatchResult;
    cachedAt: number;
  }
>();

// Cache TTL: 30 minutes
const AI_CACHE_TTL = 30 * 60 * 1000;

/**
 * Get cached AI match result
 */
function getCachedAIMatch(postId: string, platform: string): AIMatchResult | null {
  const key = getAICacheKey(postId, platform);
  const cached = aiMatchCache.get(key);

  if (!cached) return null;

  // Check if cache is expired
  if (Date.now() - cached.cachedAt > AI_CACHE_TTL) {
    aiMatchCache.delete(key);
    return null;
  }

  return cached.result;
}

/**
 * Cache AI match result
 */
function cacheAIMatch(postId: string, platform: string, result: AIMatchResult): void {
  const key = getAICacheKey(postId, platform);
  aiMatchCache.set(key, {
    result,
    cachedAt: Date.now(),
  });
}

/**
 * Build blog content summary from RSS feed items
 */
function buildBlogSummary(feedItems: RssFeedItem[], maxItems: number = 5): string {
  const items = feedItems.slice(0, maxItems);

  return items
    .map((item, index) => {
      const title = item.title || 'Untitled';
      const url = item.link || '';
      const description = item.description?.slice(0, 200) || item.content?.slice(0, 200) || '';
      return `${index + 1}. "${title}"${url ? `\n   URL: ${url}` : ''}\n   ${description}${description.length >= 200 ? '...' : ''}`;
    })
    .join('\n\n');
}

/**
 * Build the AI matching prompt
 */
function buildMatchingPrompt(
  posts: ExtractedPostRecord[],
  feedItems: RssFeedItem[],
  feedTitle: string,
  blogUrl: string,
  exampleComments: string[],
  communicationPreferences: string = ''
): string {
  const blogSummary = buildBlogSummary(feedItems);

  const postsJson = posts.map((post) => ({
    id: post.id,
    author: post.authorName,
    content: post.content.slice(0, 500), // Limit content length
  }));

  const styleExamples = exampleComments.slice(0, MAX_STYLE_EXAMPLES_IN_PROMPT);
  const styleSection =
    styleExamples.length > 0
      ? `\n\nWriting Style Examples (match this tone and style):\n${styleExamples.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')}`
      : '';

  const commPrefsSection = communicationPreferences.trim()
    ? `\n\nCommunication Rules (MUST follow):\n${communicationPreferences.trim()}`
    : '';

  return `You are evaluating social media posts to find opportunities to share relevant blog content and engage with the community.

Blog: "${feedTitle}"
URL: ${blogUrl}

Recent Blog Posts:
${blogSummary}
${styleSection}${commPrefsSection}

Analyze each post below and determine if it's a good opportunity to share insights from the blog. Consider:
- Topic relevance to the blog content
- Whether the author seems open to engagement
- Natural opportunities to add value with blog insights

For each matching post, provide:
1. A relevance score (0.0 to 1.0)
2. A brief reason why this is a good match
3. ${REPLY_SUGGESTIONS_COUNT} reply suggestions that naturally reference a specific blog post URL from the list above (use the specific post URL that is most relevant, not the generic blog URL)

Posts to evaluate:
${JSON.stringify(postsJson, null, 2)}

Respond with valid JSON in this exact format:
{
  "results": [
    {
      "postId": "post-id-here",
      "score": 0.8,
      "reason": "This post discusses X which aligns with our blog post about Y",
      "suggestions": [
        "Reply suggestion 1 with blog link",
        "Reply suggestion 2 with blog link",
        "Reply suggestion 3 with blog link"
      ]
    }
  ]
}

Only include posts with score >= 0.3. Return empty results array if no posts match.`;
}

/**
 * Parse AI response and extract match results
 */
function parseAIResponse(responseText: string): AIMatchResult[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`${LOG_PREFIX} No JSON found in AI response`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.results || !Array.isArray(parsed.results)) {
      console.warn(`${LOG_PREFIX} Invalid AI response format - no results array`);
      return [];
    }

    return parsed.results.map((result: Partial<AIMatchResult>) => ({
      postId: result.postId || '',
      score: typeof result.score === 'number' ? Math.min(1, Math.max(0, result.score)) : 0,
      reason: result.reason || 'AI-matched post',
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
    }));
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to parse AI response:`, error);
    return [];
  }
}

/**
 * Match posts using AI semantic analysis
 */
export async function aiMatchPosts(
  posts: ExtractedPostRecord[],
  feed: RssFeed,
  blogUrl: string,
  apiKey: string,
  model: string,
  exampleComments: string[] = [],
  preferences: MatchingPreferences = DEFAULT_MATCHING_PREFERENCES,
  communicationPreferences: string = ''
): Promise<MatchResult> {
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} AI matching ${posts.length} posts using model ${model}`);

  // Check cache for already-matched posts
  const uncachedPosts: ExtractedPostRecord[] = [];
  const cachedResults: AIMatchResult[] = [];

  for (const post of posts) {
    const cached = getCachedAIMatch(post.id, post.platform);
    if (cached) {
      cachedResults.push(cached);
    } else {
      uncachedPosts.push(post);
    }
  }

  console.log(`${LOG_PREFIX} Found ${cachedResults.length} cached, ${uncachedPosts.length} need AI matching`);

  let newResults: AIMatchResult[] = [];

  // Only call API if there are uncached posts
  if (uncachedPosts.length > 0) {
    const prompt = buildMatchingPrompt(
      uncachedPosts,
      feed.items,
      feed.title,
      blogUrl,
      exampleComments,
      communicationPreferences
    );

    try {
      const response = await chatCompletion(apiKey, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 16384,
      });

      const responseText = response.choices[0]?.message?.content || '';
      newResults = parseAIResponse(responseText);

      // Cache the new results
      for (const result of newResults) {
        const post = uncachedPosts.find((p) => p.id === result.postId);
        if (post) {
          cacheAIMatch(post.id, post.platform, result);
        }
      }

      console.log(`${LOG_PREFIX} AI returned ${newResults.length} matches`);
    } catch (error) {
      console.error(`${LOG_PREFIX} AI matching failed:`, error);
      // Re-throw InsufficientCreditsError so it can be handled by the caller
      if ((error as Error)?.name === 'InsufficientCreditsError') {
        console.log(`${LOG_PREFIX} Re-throwing InsufficientCreditsError from aiMatchPosts`);
        throw error;
      }
      // Fall back to keyword matching for uncached posts
      const keywordResult = matchPosts(uncachedPosts, [], preferences);
      return keywordResult;
    }
  }

  // Combine cached and new results
  const allResults = [...cachedResults, ...newResults];

  // Build matched posts from AI results
  const matches: MatchedPostWithScore[] = [];

  for (const result of allResults) {
    // Find the post in our list
    let matchedPost: ExtractedPostRecord | undefined;

    for (const post of posts) {
      if (post.id === result.postId) {
        matchedPost = post;
        break;
      }
    }

    if (!matchedPost) continue;

    if (result.score >= preferences.threshold) {
      const replySuggestions: ReplySuggestion[] = result.suggestions.map((text) => ({
        id: generateSuggestionId(),
        text,
        generatedAt: Date.now(),
      }));

      matches.push({
        post: matchedPost,
        score: result.score,
        matchedKeywords: [], // AI matching doesn't use keywords
        matchReason: result.reason,
        matchedAt: Date.now(),
        status: 'pending',
        replySuggestions,
      } as MatchedPostWithScore & { replySuggestions: ReplySuggestion[] });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Limit to maxPosts
  const limitedMatches = matches.slice(0, preferences.maxPosts);

  const processingTimeMs = Date.now() - startTime;

  console.log(
    `${LOG_PREFIX} AI matched ${matches.length} posts (showing top ${limitedMatches.length}) in ${processingTimeMs}ms`
  );

  return {
    matches: limitedMatches,
    totalEvaluated: posts.length,
    keywords: [], // AI matching doesn't use keywords
    processingTimeMs,
  };
}

/**
 * Generate reply suggestions for a single post
 */
export async function generateReplySuggestions(
  post: ExtractedPostRecord,
  feed: RssFeed,
  blogUrl: string,
  apiKey: string,
  model: string,
  exampleComments: string[] = [],
  communicationPreferences: string = ''
): Promise<ReplySuggestion[]> {
  console.log(`${LOG_PREFIX} Generating suggestions for post ${post.id}`);

  const blogSummary = buildBlogSummary(feed.items, 3);

  const styleExamples = exampleComments.slice(0, MAX_STYLE_EXAMPLES_IN_PROMPT);
  const styleSection =
    styleExamples.length > 0
      ? `\n\nWrite replies in this style:\n${styleExamples.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')}`
      : '';

  const commPrefsSection = communicationPreferences.trim()
    ? `\n\nCommunication Rules (MUST follow):\n${communicationPreferences.trim()}`
    : '';

  const prompt = `Generate ${REPLY_SUGGESTIONS_COUNT} engaging reply suggestions for this social media post. The replies should naturally reference insights from the blog.

Blog: "${feed.title}"
URL: ${blogUrl}

Recent Blog Posts:
${blogSummary}
${styleSection}${commPrefsSection}

Post to reply to:
Author: ${post.authorName}
Content: ${post.content}

Requirements:
- Each reply should be helpful and add value
- Include a link to the most relevant specific blog post URL from the list above (not the generic blog homepage)
- Be conversational and authentic, not salesy
- Keep replies concise (under 280 characters if possible)

Respond with valid JSON:
{
  "suggestions": [
    "Reply suggestion 1",
    "Reply suggestion 2",
    "Reply suggestion 3"
  ]
}`;

  try {
    const response = await chatCompletion(apiKey, {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 16384,
    });

    const responseText = response.choices[0]?.message?.content || '';

    // Parse response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`${LOG_PREFIX} No JSON found in suggestions response`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      console.warn(`${LOG_PREFIX} Invalid suggestions response format`);
      return [];
    }

    return parsed.suggestions.map((text: string) => ({
      id: generateSuggestionId(),
      text,
      generatedAt: Date.now(),
    }));
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to generate suggestions:`, error);
    // Re-throw InsufficientCreditsError so it can be handled by the caller
    if ((error as Error)?.name === 'InsufficientCreditsError') {
      console.log(`${LOG_PREFIX} Re-throwing InsufficientCreditsError from generateReplySuggestions`);
      throw error;
    }
    return [];
  }
}

/**
 * Clear the AI match cache
 */
export function clearAIMatchCache(): void {
  aiMatchCache.clear();
  console.log(`${LOG_PREFIX} AI match cache cleared`);
}

// ============================================================
// Heat Check Functions
// ============================================================

/**
 * Heat check cache stored in memory during session
 */
const heatCheckCache = new Map<
  string,
  {
    result: HeatCheckResult;
    cachedAt: number;
  }
>();

/**
 * Get cached heat check result
 */
function getCachedHeatCheck(postId: string, platform: string): HeatCheckResult | null {
  const key = getAICacheKey(postId, platform);
  const cached = heatCheckCache.get(key);

  if (!cached) return null;

  // Check if cache is expired (use same TTL as AI cache)
  if (Date.now() - cached.cachedAt > AI_CACHE_TTL) {
    heatCheckCache.delete(key);
    return null;
  }

  return cached.result;
}

/**
 * Cache heat check result
 */
function cacheHeatCheck(postId: string, platform: string, result: HeatCheckResult): void {
  const key = getAICacheKey(postId, platform);
  heatCheckCache.set(key, {
    result,
    cachedAt: Date.now(),
  });
}

/**
 * Build the heat check prompt for analyzing post tone/sentiment
 */
function buildHeatCheckPrompt(posts: { id: string; content: string; author: string }[]): string {
  return `Analyze the tone and sentiment of these social media posts. Classify each post into one of these categories:

- positive: Uplifting, encouraging, celebratory, sharing wins or good news
- educational: Informative, teaching, sharing knowledge or insights
- question: Asking for help, advice, or opinions
- negative: Complaining, venting, pessimistic, criticizing without constructive purpose
- promotional: Self-promotion, selling products/services, marketing
- neutral: General updates, observations, neither positive nor negative

Also determine if each post is a good candidate for engagement. Posts that are positive, educational, or genuine questions are usually good candidates. Posts that are negative complaints or overly promotional are usually NOT good candidates.

Posts to analyze:
${JSON.stringify(posts, null, 2)}

Respond with valid JSON in this exact format:
{
  "results": [
    {
      "postId": "post-id-here",
      "tone": "positive",
      "reason": "Brief explanation of why this tone was assigned",
      "recommended": true
    }
  ]
}

Include ALL posts in the results array.`;
}

/**
 * Parse heat check AI response
 */
function parseHeatCheckResponse(responseText: string): Map<string, HeatCheckResult> {
  const results = new Map<string, HeatCheckResult>();
  const validTones: PostTone[] = ['positive', 'educational', 'question', 'negative', 'promotional', 'neutral'];

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`${LOG_PREFIX} No JSON found in heat check response`);
      return results;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.results || !Array.isArray(parsed.results)) {
      console.warn(`${LOG_PREFIX} Invalid heat check response format - no results array`);
      return results;
    }

    for (const result of parsed.results) {
      if (!result.postId) continue;

      const tone = validTones.includes(result.tone) ? result.tone : 'neutral';

      results.set(result.postId, {
        tone,
        reason: result.reason || 'Analyzed by AI',
        recommended: result.recommended === true,
      });
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to parse heat check response:`, error);
  }

  return results;
}

/**
 * Run heat check on matched posts to classify their tone/sentiment
 */
export async function heatCheckPosts(
  matches: MatchedPostWithScore[],
  apiKey: string,
  model: string
): Promise<MatchedPostWithScore[]> {
  console.log(`${LOG_PREFIX} Running heat check on ${matches.length} posts`);

  // Separate cached and uncached posts
  const uncachedMatches: MatchedPostWithScore[] = [];
  const results = new Map<string, HeatCheckResult>();

  for (const match of matches) {
    const cached = getCachedHeatCheck(match.post.id, match.post.platform);
    if (cached) {
      results.set(match.post.id, cached);
    } else {
      uncachedMatches.push(match);
    }
  }

  console.log(`${LOG_PREFIX} Found ${results.size} cached heat checks, ${uncachedMatches.length} need analysis`);

  // Call AI for uncached posts
  if (uncachedMatches.length > 0) {
    const postsToAnalyze = uncachedMatches.map((m) => ({
      id: m.post.id,
      content: m.post.content.slice(0, 500),
      author: m.post.authorName,
    }));

    const prompt = buildHeatCheckPrompt(postsToAnalyze);

    try {
      const response = await chatCompletion(apiKey, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent classification
        max_tokens: 16384,
      });

      const responseText = response.choices[0]?.message?.content || '';
      const newResults = parseHeatCheckResponse(responseText);

      // Cache and merge results
      for (const [postId, result] of newResults) {
        const match = uncachedMatches.find((m) => m.post.id === postId);
        if (match) {
          cacheHeatCheck(postId, match.post.platform, result);
          results.set(postId, result);
        }
      }

      console.log(`${LOG_PREFIX} AI heat check returned ${newResults.size} results`);
    } catch (error) {
      console.error(`${LOG_PREFIX} Heat check failed:`, error);
      // Re-throw InsufficientCreditsError so it can be handled by the caller
      if ((error as Error)?.name === 'InsufficientCreditsError') {
        console.log(`${LOG_PREFIX} Re-throwing InsufficientCreditsError from heatCheckPosts`);
        throw error;
      }
      // Continue without heat check results for uncached posts
    }
  }

  // Apply heat check results to matches
  return matches.map((match) => ({
    ...match,
    heatCheck: results.get(match.post.id),
  }));
}

/**
 * Clear the heat check cache
 */
export function clearHeatCheckCache(): void {
  heatCheckCache.clear();
  console.log(`${LOG_PREFIX} Heat check cache cleared`);
}
