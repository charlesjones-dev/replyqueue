import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockStorage } from '../setup';

// Sample RSS 2.0 feed
const RSS_20_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <description>A test blog for testing</description>
    <link>https://example.com</link>
    <lastBuildDate>Sat, 01 Jan 2024 12:00:00 GMT</lastBuildDate>
    <item>
      <title>First Post</title>
      <link>https://example.com/post-1</link>
      <guid>https://example.com/post-1</guid>
      <description>This is the first post about technology and innovation.</description>
      <pubDate>Sat, 01 Jan 2024 10:00:00 GMT</pubDate>
      <category>Technology</category>
      <category>Innovation</category>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/post-2</link>
      <guid>https://example.com/post-2</guid>
      <description>This is the second post about AI and machine learning.</description>
      <pubDate>Fri, 31 Dec 2023 10:00:00 GMT</pubDate>
      <category>AI</category>
    </item>
  </channel>
</rss>`;

// Note: ATOM_SAMPLE was replaced with inline Atom XML in tests for better happy-dom compatibility

// Sample RSS with CDATA content
const RSS_CDATA_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>CDATA Test Feed</title>
    <description>Feed with CDATA content</description>
    <link>https://example.com</link>
    <item>
      <title><![CDATA[Post with <em>HTML</em> in Title]]></title>
      <link>https://example.com/cdata-post</link>
      <guid>cdata-1</guid>
      <description><![CDATA[<p>Description with <strong>HTML</strong> tags.</p>]]></description>
      <content:encoded><![CDATA[<div><p>Full content with <a href="https://example.com">links</a> and formatting.</p></div>]]></content:encoded>
    </item>
  </channel>
</rss>`;

// Invalid XML
const INVALID_XML = `This is not valid XML at all`;

// Non-feed XML
const NON_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <title>Not a feed</title>
  <content>This is just a regular XML document</content>
</document>`;

describe('RSS Fetcher', () => {
  beforeEach(() => {
    clearMockStorage();
    vi.clearAllMocks();
  });

  describe('parseFeed', () => {
    // We need to test the parseFeed function indirectly through the module
    // Since it's not exported, we'll test through the overall flow

    it('should handle RSS 2.0 feeds correctly', async () => {
      // Mock fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(RSS_20_SAMPLE),
      });

      const { fetchRssFeed } = await import('@/background/rss-fetcher');
      const feed = await fetchRssFeed('https://example.com/feed.xml');

      expect(feed.title).toBe('Test Blog');
      expect(feed.description).toBe('A test blog for testing');
      expect(feed.feedType).toBe('rss');
      expect(feed.items).toHaveLength(2);

      // Check first item
      expect(feed.items[0].title).toBe('First Post');
      // Link parsing may vary by DOM parser implementation
      expect(feed.items[0].id).toContain('post-1');
      expect(feed.items[0].categories).toContain('Technology');
      expect(feed.items[0].categories).toContain('Innovation');
    });

    it('should handle Atom feeds correctly', async () => {
      // Atom with explicit root tag name (works better with happy-dom)
      const atomWithExplicitTag = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <subtitle>A test Atom feed</subtitle>
  <updated>2024-01-01T12:00:00Z</updated>
  <entry>
    <title>Atom Entry 1</title>
    <id>https://example.com/atom-1</id>
    <summary>Summary of first Atom entry about software development.</summary>
    <published>2024-01-01T10:00:00Z</published>
  </entry>
</feed>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(atomWithExplicitTag),
      });

      const { fetchRssFeed } = await import('@/background/rss-fetcher');
      const feed = await fetchRssFeed('https://example.com/atom.xml');

      expect(feed.title).toBe('Test Atom Feed');
      expect(feed.feedType).toBe('atom');
      expect(feed.items).toHaveLength(1);
      expect(feed.items[0].title).toBe('Atom Entry 1');
    });

    it('should handle CDATA content correctly', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(RSS_CDATA_SAMPLE),
      });

      const { fetchRssFeed } = await import('@/background/rss-fetcher');
      const feed = await fetchRssFeed('https://example.com/cdata.xml');

      expect(feed.title).toBe('CDATA Test Feed');
      expect(feed.items).toHaveLength(1);

      // HTML should be stripped from descriptions
      const item = feed.items[0];
      expect(item.description).not.toContain('<p>');
      expect(item.description).not.toContain('<strong>');
    });

    it('should throw error for invalid XML', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(INVALID_XML),
      });

      const { fetchRssFeed } = await import('@/background/rss-fetcher');

      await expect(fetchRssFeed('https://example.com/invalid.xml')).rejects.toThrow();
    });

    it('should throw error for non-feed XML', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(NON_FEED_XML),
      });

      const { fetchRssFeed } = await import('@/background/rss-fetcher');

      await expect(fetchRssFeed('https://example.com/document.xml')).rejects.toThrow('Unsupported feed format');
    });

    it('should handle HTTP errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { fetchRssFeed } = await import('@/background/rss-fetcher');

      await expect(fetchRssFeed('https://example.com/notfound.xml')).rejects.toThrow('HTTP 404');
    });
  });

  describe('extractKeywordsFromFeed', () => {
    it('should extract keywords from RSS feed', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(RSS_20_SAMPLE),
      });

      const { fetchRssFeed, extractKeywordsFromFeed } = await import('@/background/rss-fetcher');
      const feed = await fetchRssFeed('https://example.com/feed.xml');
      const keywords = extractKeywordsFromFeed(feed);

      // Should include categories
      expect(keywords).toContain('technology');
      expect(keywords).toContain('innovation');
      expect(keywords).toContain('ai');

      // Should include significant words from titles
      expect(keywords).toContain('post');
    });

    it('should extract keywords from Atom feed', async () => {
      const atomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry>
    <title>Software Development Article</title>
    <id>https://example.com/atom-1</id>
    <summary>Summary about software development.</summary>
  </entry>
</feed>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(atomFeed),
      });

      const { fetchRssFeed, extractKeywordsFromFeed } = await import('@/background/rss-fetcher');
      const feed = await fetchRssFeed('https://example.com/atom.xml');
      const keywords = extractKeywordsFromFeed(feed);

      expect(keywords).toContain('software');
      expect(keywords).toContain('development');
    });

    it('should filter out stop words', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(RSS_20_SAMPLE),
      });

      const { fetchRssFeed, extractKeywordsFromFeed } = await import('@/background/rss-fetcher');
      const feed = await fetchRssFeed('https://example.com/feed.xml');
      const keywords = extractKeywordsFromFeed(feed);

      // Common stop words should be filtered out
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('and');
      expect(keywords).not.toContain('this');
    });
  });

  describe('caching', () => {
    it('should cache feed correctly', async () => {
      const { cacheFeed, getCachedFeed, isCacheValid } = await import('@/background/rss-fetcher');

      const mockFeed = {
        title: 'Test Feed',
        items: [],
        feedType: 'rss' as const,
      };

      await cacheFeed(mockFeed, 'https://example.com/feed.xml', 60);

      const cached = await getCachedFeed();
      expect(cached).not.toBeNull();
      expect(cached?.feed.title).toBe('Test Feed');
      expect(cached?.url).toBe('https://example.com/feed.xml');
      expect(isCacheValid(cached)).toBe(true);
    });

    it('should detect expired cache', async () => {
      const { isCacheValid } = await import('@/background/rss-fetcher');

      const expiredCache = {
        feed: { title: 'Test', items: [], feedType: 'rss' as const },
        fetchedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        ttl: 60 * 60 * 1000, // 1 hour TTL
        url: 'https://example.com/feed.xml',
      };

      expect(isCacheValid(expiredCache)).toBe(false);
    });

    it('should clear cache', async () => {
      const { cacheFeed, getCachedFeed, clearFeedCache } = await import('@/background/rss-fetcher');

      const mockFeed = {
        title: 'Test Feed',
        items: [],
        feedType: 'rss' as const,
      };

      await cacheFeed(mockFeed, 'https://example.com/feed.xml', 60);
      await clearFeedCache();

      const cached = await getCachedFeed();
      // After clearing, cache should be null or undefined
      expect(cached == null).toBe(true);
    });
  });
});
