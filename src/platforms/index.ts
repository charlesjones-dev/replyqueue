/**
 * Platform registry and loader for ReplyQueue extension
 * Manages platform adapters and provides factory methods
 */

import type { PlatformAdapter, PlatformRegistryEntry } from './types';
import { LinkedInAdapter } from './linkedin/adapter';

// Export types for external use
export * from './types';

/**
 * Registry of all supported platforms
 */
const platformRegistry: PlatformRegistryEntry[] = [
  {
    urlPatterns: [/^https?:\/\/(www\.)?linkedin\.com/i],
    createAdapter: () => new LinkedInAdapter(),
  },
  // Future platforms can be added here:
  // {
  //   urlPatterns: [/^https?:\/\/(www\.)?twitter\.com/i, /^https?:\/\/(www\.)?x\.com/i],
  //   createAdapter: () => new TwitterAdapter(),
  // },
];

/**
 * Get the appropriate platform adapter for a given URL
 * @param url The current page URL
 * @returns The platform adapter or null if no platform matches
 */
export function getPlatformForUrl(url: string): PlatformAdapter | null {
  for (const entry of platformRegistry) {
    for (const pattern of entry.urlPatterns) {
      if (pattern.test(url)) {
        return entry.createAdapter();
      }
    }
  }
  return null;
}

/**
 * Check if a URL matches any supported platform
 * @param url The URL to check
 */
export function isSupportedPlatform(url: string): boolean {
  return getPlatformForUrl(url) !== null;
}

/**
 * Get list of all supported platform IDs
 */
export function getSupportedPlatformIds(): string[] {
  return platformRegistry.map((entry) => {
    const adapter = entry.createAdapter();
    return adapter.platformId;
  });
}
