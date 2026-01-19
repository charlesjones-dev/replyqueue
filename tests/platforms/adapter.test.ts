/**
 * Tests for platform adapter interface compliance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LinkedInAdapter } from '../../src/platforms/linkedin/adapter';
import { getPlatformForUrl, isSupportedPlatform } from '../../src/platforms';
import type { PlatformAdapter } from '../../src/platforms/types';

describe('Platform Registry', () => {
  it('should return LinkedIn adapter for linkedin.com URLs', () => {
    const urls = [
      'https://www.linkedin.com/feed',
      'https://linkedin.com/feed',
      'https://www.linkedin.com/',
      'https://www.linkedin.com/in/someone',
    ];

    for (const url of urls) {
      const adapter = getPlatformForUrl(url);
      expect(adapter).not.toBeNull();
      expect(adapter?.platformId).toBe('linkedin');
    }
  });

  it('should return null for unsupported URLs', () => {
    const urls = ['https://www.twitter.com', 'https://facebook.com', 'https://example.com'];

    for (const url of urls) {
      const adapter = getPlatformForUrl(url);
      expect(adapter).toBeNull();
    }
  });

  it('should correctly identify supported platforms', () => {
    expect(isSupportedPlatform('https://www.linkedin.com/')).toBe(true);
    expect(isSupportedPlatform('https://linkedin.com/feed')).toBe(true);
    expect(isSupportedPlatform('https://twitter.com/')).toBe(false);
  });
});

describe('LinkedInAdapter', () => {
  let adapter: LinkedInAdapter;

  beforeEach(() => {
    adapter = new LinkedInAdapter();
  });

  describe('interface compliance', () => {
    it('should have required properties', () => {
      expect(adapter.platformId).toBe('linkedin');
      expect(adapter.platformName).toBe('LinkedIn');
      expect(adapter.selectors).toBeDefined();
      expect(adapter.selectors.postItem).toBeDefined();
      expect(adapter.selectors.authorName).toBeDefined();
      expect(adapter.selectors.postContent).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof adapter.isFeedPage).toBe('function');
      expect(typeof adapter.extractPost).toBe('function');
      expect(typeof adapter.getPostId).toBe('function');
      expect(typeof adapter.getPostUrl).toBe('function');
      expect(typeof adapter.findPostElements).toBe('function');
    });
  });

  describe('isFeedPage', () => {
    it('should return true for LinkedIn feed URLs', () => {
      expect(adapter.isFeedPage('https://www.linkedin.com/feed')).toBe(true);
      expect(adapter.isFeedPage('https://www.linkedin.com/')).toBe(true);
      expect(adapter.isFeedPage('https://linkedin.com/feed')).toBe(true);
    });

    it('should return false for non-feed LinkedIn URLs', () => {
      expect(adapter.isFeedPage('https://www.linkedin.com/in/someone')).toBe(false);
      expect(adapter.isFeedPage('https://www.linkedin.com/company/test')).toBe(false);
      expect(adapter.isFeedPage('https://www.linkedin.com/messaging')).toBe(false);
    });
  });

  describe('getPostUrl', () => {
    it('should generate correct LinkedIn post URL', () => {
      const postId = '7123456789012345678';
      const url = adapter.getPostUrl(postId);
      expect(url).toBe(`https://www.linkedin.com/feed/update/urn:li:activity:${postId}`);
    });
  });
});

describe('PlatformAdapter interface', () => {
  it('should ensure all adapters implement the same interface', () => {
    const adapters: PlatformAdapter[] = [new LinkedInAdapter()];

    for (const adapter of adapters) {
      // Verify required properties
      expect(typeof adapter.platformId).toBe('string');
      expect(adapter.platformId.length).toBeGreaterThan(0);

      expect(typeof adapter.platformName).toBe('string');
      expect(adapter.platformName.length).toBeGreaterThan(0);

      expect(adapter.selectors).toBeDefined();

      // Verify required methods exist and return correct types
      expect(typeof adapter.isFeedPage).toBe('function');
      expect(typeof adapter.extractPost).toBe('function');
      expect(typeof adapter.getPostId).toBe('function');
      expect(typeof adapter.getPostUrl).toBe('function');
      expect(typeof adapter.findPostElements).toBe('function');

      // Verify method return types
      expect(typeof adapter.isFeedPage('https://example.com')).toBe('boolean');
      expect(typeof adapter.getPostUrl('123')).toBe('string');
    }
  });
});
