/**
 * OpenRouter API Client
 * Handles chat completions with rate limiting and retry logic
 */

import type { OpenRouterChatRequest, OpenRouterChatResponse, OpenRouterModel, CachedModelList } from '../shared/types';
import {
  OPENROUTER_API_BASE,
  OPENROUTER_RATE_LIMIT,
  MODEL_CACHE_TTL,
  STORAGE_KEYS,
  RECOMMENDED_MODELS,
} from '../shared/constants';

const LOG_PREFIX = '[ReplyQueue:OpenRouter]';

/**
 * OpenRouter API error
 */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

/**
 * Insufficient credits error (402)
 */
export class InsufficientCreditsError extends OpenRouterError {
  constructor(
    message: string,
    public requestedTokens?: number,
    public availableTokens?: number
  ) {
    super(message, 402, false);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Rate limiter state
 */
interface RateLimiterState {
  lastRequestTime: number;
  consecutiveErrors: number;
  retryAfter?: number;
}

const rateLimiterState: RateLimiterState = {
  lastRequestTime: 0,
  consecutiveErrors: 0,
};

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number): number {
  const { baseDelayMs, maxDelayMs } = OPENROUTER_RATE_LIMIT;
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an API request with rate limiting and retry logic
 */
async function makeRequest<T>(endpoint: string, options: RequestInit, apiKey: string): Promise<T> {
  const url = `${OPENROUTER_API_BASE}${endpoint}`;
  const maxRetries = OPENROUTER_RATE_LIMIT.maxRetries;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if we need to wait based on rate limiter state
    if (rateLimiterState.retryAfter && Date.now() < rateLimiterState.retryAfter) {
      const waitTime = rateLimiterState.retryAfter - Date.now();
      console.log(`${LOG_PREFIX} Rate limited, waiting ${waitTime}ms`);
      await sleep(waitTime);
    }

    // Apply exponential backoff on retries
    if (attempt > 0) {
      const delay = calculateBackoffDelay(attempt - 1);
      console.log(`${LOG_PREFIX} Retry attempt ${attempt}, waiting ${delay}ms`);
      await sleep(delay);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/replyqueue',
          'X-Title': 'ReplyQueue',
          ...options.headers,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : calculateBackoffDelay(attempt);
        rateLimiterState.retryAfter = Date.now() + waitTime;
        rateLimiterState.consecutiveErrors++;

        if (attempt < maxRetries) {
          console.warn(`${LOG_PREFIX} Rate limited (429), will retry after ${waitTime}ms`);
          continue;
        }

        throw new OpenRouterError('Rate limit exceeded. Please try again later.', 429, true);
      }

      // Handle authentication errors
      if (response.status === 401) {
        throw new OpenRouterError('Invalid API key. Please check your OpenRouter API key.', 401, false);
      }

      // Handle forbidden errors
      if (response.status === 403) {
        throw new OpenRouterError('Access denied. Your API key may not have access to this resource.', 403, false);
      }

      // Handle insufficient credits (402 Payment Required)
      if (response.status === 402) {
        console.log(`${LOG_PREFIX} Detected 402 insufficient credits error`);
        const errorText = await response.text();
        let requestedTokens: number | undefined;
        let availableTokens: number | undefined;

        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.error?.message || '';
          // Parse tokens from message like "You requested up to 16384 tokens, but can only afford 1501"
          const tokenMatch = message.match(/requested up to (\d+) tokens.*can only afford (\d+)/);
          if (tokenMatch) {
            requestedTokens = parseInt(tokenMatch[1], 10);
            availableTokens = parseInt(tokenMatch[2], 10);
          }
          console.log(`${LOG_PREFIX} Parsed tokens - requested: ${requestedTokens}, available: ${availableTokens}`);
        } catch {
          // Ignore parsing errors
        }

        const error = new InsufficientCreditsError(
          'Insufficient OpenRouter credits. Please add credits to your account.',
          requestedTokens,
          availableTokens
        );
        console.log(`${LOG_PREFIX} Throwing InsufficientCreditsError:`, error.name, error.message);
        throw error;
      }

      // Handle server errors
      if (response.status >= 500) {
        rateLimiterState.consecutiveErrors++;

        if (attempt < maxRetries) {
          console.warn(`${LOG_PREFIX} Server error (${response.status}), will retry`);
          continue;
        }

        throw new OpenRouterError(
          `OpenRouter server error (${response.status}). Please try again later.`,
          response.status,
          true
        );
      }

      // Handle other errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;

          // Check for 402 error code in response body (OpenRouter may return this with different HTTP status)
          if (errorJson.error?.code === 402) {
            let requestedTokens: number | undefined;
            let availableTokens: number | undefined;

            const message = errorJson.error?.message || '';
            const tokenMatch = message.match(/requested up to (\d+) tokens.*can only afford (\d+)/);
            if (tokenMatch) {
              requestedTokens = parseInt(tokenMatch[1], 10);
              availableTokens = parseInt(tokenMatch[2], 10);
            }

            throw new InsufficientCreditsError(
              'Insufficient OpenRouter credits. Please add credits to your account.',
              requestedTokens,
              availableTokens
            );
          }
        } catch (parseError) {
          // Re-throw InsufficientCreditsError if that's what we caught
          if (parseError instanceof InsufficientCreditsError) {
            throw parseError;
          }
          // Otherwise use default error message
        }

        throw new OpenRouterError(errorMessage, response.status, false);
      }

      // Success - reset error count
      rateLimiterState.consecutiveErrors = 0;
      rateLimiterState.lastRequestTime = Date.now();

      const data = await response.json();
      return data as T;
    } catch (error) {
      // Re-throw InsufficientCreditsError explicitly (check by name for service worker compatibility)
      if (error instanceof InsufficientCreditsError || (error as Error)?.name === 'InsufficientCreditsError') {
        console.log(`${LOG_PREFIX} Re-throwing InsufficientCreditsError`);
        throw error;
      }

      // Re-throw OpenRouterErrors
      if (error instanceof OpenRouterError || (error as Error)?.name === 'OpenRouterError') {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (attempt < maxRetries) {
          console.warn(`${LOG_PREFIX} Network error, will retry: ${error.message}`);
          continue;
        }

        throw new OpenRouterError('Network error. Please check your internet connection.', undefined, true);
      }

      // Re-throw unknown errors
      throw error;
    }
  }

  throw new OpenRouterError('Maximum retries exceeded', undefined, true);
}

/**
 * Send a chat completion request
 */
export async function chatCompletion(apiKey: string, request: OpenRouterChatRequest): Promise<OpenRouterChatResponse> {
  console.log(`${LOG_PREFIX} Chat completion request with model: ${request.model}`);

  const response = await makeRequest<OpenRouterChatResponse>(
    '/chat/completions',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    apiKey
  );

  console.log(`${LOG_PREFIX} Chat completion successful, tokens used: ${response.usage?.total_tokens ?? 'unknown'}`);

  return response;
}

/**
 * Raw model data from OpenRouter API
 */
interface RawOpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  created?: number;
}

/**
 * Fetch available models from OpenRouter
 */
export async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  console.log(`${LOG_PREFIX} Fetching available models`);

  const response = await makeRequest<{ data: RawOpenRouterModel[] }>('/models', { method: 'GET' }, apiKey);

  const recommendedSet = new Set<string>(RECOMMENDED_MODELS);

  const models: OpenRouterModel[] = response.data.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.description,
    context_length: model.context_length,
    pricing: model.pricing,
    created: model.created,
    isRecommended: recommendedSet.has(model.id),
  }));

  console.log(`${LOG_PREFIX} Fetched ${models.length} models`);

  return models;
}

/**
 * Get cached models from storage
 */
export async function getCachedModels(): Promise<CachedModelList | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CACHED_MODELS);
    return result[STORAGE_KEYS.CACHED_MODELS] as CachedModelList | null;
  } catch {
    return null;
  }
}

/**
 * Save models to cache
 */
export async function cacheModels(models: OpenRouterModel[]): Promise<void> {
  const cached: CachedModelList = {
    models,
    fetchedAt: Date.now(),
    ttl: MODEL_CACHE_TTL,
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.CACHED_MODELS]: cached });
  console.log(`${LOG_PREFIX} Cached ${models.length} models`);
}

/**
 * Check if cached models are still valid
 */
export function isCacheValid(cached: CachedModelList | null): boolean {
  if (!cached) return false;

  const now = Date.now();
  const expiresAt = cached.fetchedAt + cached.ttl;

  return now < expiresAt;
}

/**
 * Fetch models with caching
 */
export async function fetchModelsWithCache(
  apiKey: string,
  forceRefresh: boolean = false
): Promise<{ models: OpenRouterModel[]; fromCache: boolean }> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await getCachedModels();

    if (cached && isCacheValid(cached)) {
      const minutesRemaining = Math.round((cached.fetchedAt + cached.ttl - Date.now()) / 1000 / 60);
      console.log(`${LOG_PREFIX} Using cached models (expires in ${minutesRemaining} minutes)`);
      return { models: cached.models, fromCache: true };
    }
  }

  // Fetch fresh models
  const models = await fetchModels(apiKey);
  await cacheModels(models);

  return { models, fromCache: false };
}

/**
 * Calculate blended price (average of prompt and completion)
 */
export function calculateBlendedPrice(pricing: { prompt: string; completion: string }): number {
  const promptPrice = parseFloat(pricing.prompt) || 0;
  const completionPrice = parseFloat(pricing.completion) || 0;
  return (promptPrice + completionPrice) / 2;
}

/**
 * Calculate model age in days
 */
export function calculateModelAge(created?: number): number | null {
  if (!created) return null;

  const now = Date.now() / 1000; // Convert to seconds
  const ageSeconds = now - created;
  return Math.floor(ageSeconds / (60 * 60 * 24));
}

/**
 * Validate that a model exists in the available models
 */
export function validateModel(modelId: string, models: OpenRouterModel[]): OpenRouterModel | null {
  return models.find((m) => m.id === modelId) ?? null;
}

/**
 * Get recommended models that exist in the API response
 */
export function getValidRecommendedModels(models: OpenRouterModel[]): OpenRouterModel[] {
  return models.filter((m) => m.isRecommended);
}

/**
 * Clear the model cache
 */
export async function clearModelCache(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.CACHED_MODELS);
  console.log(`${LOG_PREFIX} Model cache cleared`);
}
