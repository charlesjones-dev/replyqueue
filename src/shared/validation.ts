/**
 * Validation utilities for ReplyQueue extension
 */

import type { ValidationResult, ApiKeyValidationResult, RssFeedValidationResult } from './types';
import { API_KEY_PATTERN, RSS_URL_PATTERN, OPENROUTER_API_BASE } from './constants';

/**
 * Validate API key format (local check only)
 */
export function validateApiKeyFormat(apiKey: string): ValidationResult {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmedKey = apiKey.trim();

  if (!trimmedKey.startsWith('sk-or-v1-')) {
    return {
      valid: false,
      error: 'Invalid API key format. OpenRouter keys start with sk-or-v1-',
    };
  }

  if (!API_KEY_PATTERN.test(trimmedKey)) {
    return {
      valid: false,
      error: 'Invalid API key format. Please check your key and try again.',
    };
  }

  return { valid: true };
}

/**
 * Validate API key with OpenRouter server
 */
export async function validateApiKeyWithServer(apiKey: string): Promise<ApiKeyValidationResult> {
  // First check format
  const formatResult = validateApiKeyFormat(apiKey);
  if (!formatResult.valid) {
    return formatResult;
  }

  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key. Please check your key.' };
      }
      if (response.status === 403) {
        return { valid: false, error: 'API key is disabled or expired.' };
      }
      return {
        valid: false,
        error: `API validation failed (${response.status})`,
      };
    }

    const data = await response.json();

    return {
      valid: true,
      credits: data.data?.limit_remaining,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: `Failed to validate API key: ${message}`,
    };
  }
}

/**
 * Checks if a URL points to a private/internal network address.
 * Used to prevent SSRF attacks.
 */
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0'
    ) {
      return true;
    }

    // Block private IPv4 ranges (RFC 1918) and link-local
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 10.0.0.0/8
      if (a === 10) return true;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true;
    }

    return false;
  } catch {
    return true; // Invalid URLs are blocked
  }
}

/**
 * Validate RSS URL format (local check only)
 */
export function validateRssUrlFormat(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'RSS feed URL is required' };
  }

  const trimmedUrl = url.trim();

  if (!RSS_URL_PATTERN.test(trimmedUrl)) {
    return {
      valid: false,
      error: 'Invalid URL format. URL must start with http:// or https://',
    };
  }

  // SSRF protection - block private/internal URLs
  if (isPrivateUrl(trimmedUrl)) {
    return {
      valid: false,
      error: 'Private or internal network URLs are not allowed',
    };
  }

  try {
    new URL(trimmedUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  return { valid: true };
}

/**
 * Validate RSS feed by fetching and parsing
 * Routes through background service worker to avoid CORS issues
 */
export async function validateRssFeed(url: string): Promise<RssFeedValidationResult> {
  // First check format
  const formatResult = validateRssUrlFormat(url);
  if (!formatResult.valid) {
    return formatResult;
  }

  // Route through background worker to bypass CORS
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_RSS_FEED',
        url: url.trim(),
      });

      if (!response.success) {
        return {
          valid: false,
          error: response.error ?? 'Failed to validate feed',
        };
      }

      return {
        valid: true,
        feedTitle: response.data?.feedTitle ?? 'Untitled Feed',
        itemCount: response.data?.itemCount ?? 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `Failed to validate feed: ${message}`,
      };
    }
  }

  // Fallback for non-extension context (tests, etc.)
  try {
    const response = await fetch(url.trim(), {
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml',
      },
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `Failed to fetch feed (${response.status})`,
      };
    }

    const text = await response.text();

    // Basic validation that it's RSS/Atom XML
    if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<channel')) {
      return {
        valid: false,
        error: 'URL does not appear to be a valid RSS or Atom feed',
      };
    }

    // Parse to extract basic info
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        valid: false,
        error: 'Failed to parse feed XML',
      };
    }

    // Extract feed title
    const titleEl = doc.querySelector('channel > title') || doc.querySelector('feed > title');
    const feedTitle = titleEl?.textContent ?? 'Untitled Feed';

    // Count items
    const items = doc.querySelectorAll('item, entry');
    const itemCount = items.length;

    return {
      valid: true,
      feedTitle,
      itemCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: `Failed to validate feed: ${message}`,
    };
  }
}
