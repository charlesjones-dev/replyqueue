/**
 * RSS Feed Fetcher and Parser
 * Handles fetching, parsing, and caching of RSS/Atom feeds
 */

import type { RssFeed, RssFeedItem, CachedRssFeed } from '../shared/types';
import { STORAGE_KEYS, DEFAULT_MATCHING_PREFERENCES, DEFAULT_MAX_RSS_ITEMS } from '../shared/constants';

const LOG_PREFIX = '[ReplyQueue:RSS]';

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text content from XML tag, handling CDATA sections
 */
function extractTagContent(xml: string, tagName: string): string {
  // Handle namespaced tags (e.g., content:encoded, dc:creator)
  // tagName is from internal code (hardcoded tag names), not user input
  /* eslint-disable security/detect-non-literal-regexp */
  const patterns = [
    new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, 'i'),
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
  ];
  /* eslint-enable security/detect-non-literal-regexp */

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extract attribute value from a tag
 */
function extractAttribute(tag: string, attrName: string): string {
  // attrName is from internal code (hardcoded attribute names), not user input
  // eslint-disable-next-line security/detect-non-literal-regexp
  const match = tag.match(new RegExp(`${attrName}=["']([^"']*)["']`, 'i'));
  return match ? match[1] : '';
}

/**
 * Parse an RSS 2.0 feed using regex (service workers don't have DOMParser)
 */
function parseRss20(xml: string): RssFeed {
  // Extract channel content
  const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  if (!channelMatch) {
    throw new Error('Invalid RSS feed: no channel element found');
  }
  const channelXml = channelMatch[1];

  // Get channel-level info (before first item)
  const firstItemIndex = channelXml.indexOf('<item');
  const channelHeader = firstItemIndex > 0 ? channelXml.substring(0, firstItemIndex) : channelXml;

  const title = extractTagContent(channelHeader, 'title') || 'Untitled Feed';
  const description = extractTagContent(channelHeader, 'description');
  const link = extractTagContent(channelHeader, 'link');
  const lastBuildDate = extractTagContent(channelHeader, 'lastBuildDate');

  // Extract all items
  const items: RssFeedItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];

    const itemTitle = extractTagContent(itemXml, 'title');
    const itemLink = extractTagContent(itemXml, 'link');
    const guid = extractTagContent(itemXml, 'guid');
    const itemDescription = extractTagContent(itemXml, 'description');

    // content:encoded often has the full content
    const content = extractTagContent(itemXml, 'content:encoded') || extractTagContent(itemXml, 'encoded');

    const pubDate = extractTagContent(itemXml, 'pubDate');
    const author =
      extractTagContent(itemXml, 'author') ||
      extractTagContent(itemXml, 'dc:creator') ||
      extractTagContent(itemXml, 'creator');

    // Get categories
    const categories: string[] = [];
    const categoryRegex = /<category[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/gi;
    let catMatch;
    while ((catMatch = categoryRegex.exec(itemXml)) !== null) {
      const catText = catMatch[1].trim();
      if (catText) categories.push(catText);
    }

    // Get enclosure
    const enclosureMatch = itemXml.match(/<enclosure([^>]*)\/?>/);
    const enclosure = enclosureMatch
      ? {
          url: extractAttribute(enclosureMatch[1], 'url'),
          type: extractAttribute(enclosureMatch[1], 'type') || undefined,
          length: extractAttribute(enclosureMatch[1], 'length')
            ? parseInt(extractAttribute(enclosureMatch[1], 'length'), 10)
            : undefined,
        }
      : undefined;

    items.push({
      id: guid || itemLink || `rss-item-${items.length}`,
      title: itemTitle,
      description: itemDescription ? stripHtml(itemDescription) : undefined,
      content: content ? stripHtml(content) : undefined,
      link: itemLink,
      pubDate,
      author,
      categories: categories.length > 0 ? categories : undefined,
      enclosure,
    });
  }

  return {
    title,
    description: description ? stripHtml(description) : undefined,
    link,
    items,
    feedType: 'rss',
    lastUpdated: lastBuildDate,
  };
}

/**
 * Parse an Atom feed using regex (service workers don't have DOMParser)
 */
function parseAtom(xml: string): RssFeed {
  // Check for feed element
  if (!/<feed[^>]*>/i.test(xml)) {
    throw new Error('Invalid Atom feed: no feed element found');
  }

  // Get feed-level info (before first entry)
  const firstEntryIndex = xml.indexOf('<entry');
  const feedHeader = firstEntryIndex > 0 ? xml.substring(0, firstEntryIndex) : xml;

  const title = extractTagContent(feedHeader, 'title') || 'Untitled Feed';
  const subtitle = extractTagContent(feedHeader, 'subtitle');

  // Extract link with rel="alternate" or no rel
  const linkMatch = feedHeader.match(/<link[^>]*href=["']([^"']*)["'][^>]*>/i);
  const link = linkMatch ? linkMatch[1] : undefined;

  const updated = extractTagContent(feedHeader, 'updated');

  // Extract all entries
  const items: RssFeedItem[] = [];
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1];

    const entryTitle = extractTagContent(entryXml, 'title');

    // Atom links - prefer alternate, fallback to any link
    const entryLinkMatch = entryXml.match(/<link[^>]*href=["']([^"']*)["'][^>]*>/i);
    const entryLink = entryLinkMatch ? entryLinkMatch[1] : '';

    const id = extractTagContent(entryXml, 'id') || entryLink;
    const summary = extractTagContent(entryXml, 'summary');
    const content = extractTagContent(entryXml, 'content');
    const published = extractTagContent(entryXml, 'published') || extractTagContent(entryXml, 'updated');

    // Author - extract name from within author element
    const authorMatch = entryXml.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
    const author = authorMatch ? extractTagContent(authorMatch[1], 'name') : undefined;

    // Categories - extract term attribute
    const categories: string[] = [];
    const categoryRegex = /<category[^>]*term=["']([^"']*)["'][^>]*\/?>/gi;
    let catMatch;
    while ((catMatch = categoryRegex.exec(entryXml)) !== null) {
      if (catMatch[1]) categories.push(catMatch[1]);
    }

    items.push({
      id,
      title: entryTitle,
      description: summary ? stripHtml(summary) : undefined,
      content: content ? stripHtml(content) : undefined,
      link: entryLink,
      pubDate: published,
      author,
      categories: categories.length > 0 ? categories : undefined,
    });
  }

  return {
    title,
    description: subtitle ? stripHtml(subtitle) : undefined,
    link,
    items,
    feedType: 'atom',
    lastUpdated: updated,
  };
}

/**
 * Detect feed type and parse accordingly (using regex, no DOMParser in service workers)
 */
function parseFeed(xml: string): RssFeed {
  // Basic XML validation
  if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<')) {
    throw new Error('Invalid XML: document does not start with XML declaration or tag');
  }

  // Detect feed type based on content patterns
  const lowerXml = xml.toLowerCase();

  // Check for Atom feed
  if (lowerXml.includes('<feed') && lowerXml.includes('<entry')) {
    return parseAtom(xml);
  }

  // Check for RSS feed
  if (lowerXml.includes('<rss') || lowerXml.includes('<channel')) {
    return parseRss20(xml);
  }

  // Check for RDF/RSS 1.0
  if (lowerXml.includes('rdf:rdf') || lowerXml.includes('<rdf')) {
    return parseRss20(xml); // RSS 1.0 has similar structure
  }

  throw new Error('Unsupported feed format');
}

/**
 * Fetch and parse an RSS feed
 */
export async function fetchRssFeed(url: string): Promise<RssFeed> {
  console.log(`${LOG_PREFIX} Fetching feed: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const feed = parseFeed(text);

    console.log(`${LOG_PREFIX} Parsed feed "${feed.title}" with ${feed.items.length} items`);

    return feed;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Failed to fetch feed:`, error);
    throw new Error(`Failed to fetch RSS feed: ${message}`);
  }
}

/**
 * Get cached feed from storage
 */
export async function getCachedFeed(): Promise<CachedRssFeed | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CACHED_RSS_FEED);
    return result[STORAGE_KEYS.CACHED_RSS_FEED] as CachedRssFeed | null;
  } catch {
    return null;
  }
}

/**
 * Save feed to cache
 */
export async function cacheFeed(feed: RssFeed, url: string, ttlMinutes: number): Promise<void> {
  const cached: CachedRssFeed = {
    feed,
    fetchedAt: Date.now(),
    ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
    url,
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.CACHED_RSS_FEED]: cached });
  console.log(`${LOG_PREFIX} Feed cached (TTL: ${ttlMinutes} minutes)`);
}

/**
 * Check if cached feed is still valid
 */
export function isCacheValid(cached: CachedRssFeed | null): boolean {
  if (!cached) return false;

  const now = Date.now();
  const expiresAt = cached.fetchedAt + cached.ttl;

  return now < expiresAt;
}

/**
 * Clear the feed cache
 */
export async function clearFeedCache(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.CACHED_RSS_FEED);
  console.log(`${LOG_PREFIX} Feed cache cleared`);
}

/**
 * Fetch feed with caching
 */
export async function fetchRssFeedWithCache(
  url: string,
  ttlMinutes: number = DEFAULT_MATCHING_PREFERENCES.cacheTtlMinutes,
  maxItems: number = DEFAULT_MAX_RSS_ITEMS
): Promise<{ feed: RssFeed; fromCache: boolean }> {
  // Check cache first
  const cached = await getCachedFeed();

  if (cached && cached.url === url && isCacheValid(cached)) {
    console.log(
      `${LOG_PREFIX} Using cached feed (expires in ${Math.round((cached.fetchedAt + cached.ttl - Date.now()) / 1000 / 60)} minutes)`
    );
    // Apply maxItems limit to cached feed (in case limit changed since caching)
    const limitedFeed = {
      ...cached.feed,
      items: cached.feed.items.slice(0, maxItems),
    };
    return { feed: limitedFeed, fromCache: true };
  }

  // Fetch fresh feed
  const feed = await fetchRssFeed(url);

  // Apply maxItems limit before caching
  const limitedFeed = {
    ...feed,
    items: feed.items.slice(0, maxItems),
  };

  await cacheFeed(limitedFeed, url, ttlMinutes);

  return { feed: limitedFeed, fromCache: false };
}

/**
 * Extract keywords from RSS feed content
 * Returns unique keywords from titles, categories, and content
 */
export function extractKeywordsFromFeed(feed: RssFeed): string[] {
  const keywordSet = new Set<string>();

  for (const item of feed.items) {
    // Add categories
    if (item.categories) {
      for (const category of item.categories) {
        keywordSet.add(category.toLowerCase());
      }
    }

    // Extract significant words from titles
    const titleWords = extractSignificantWords(item.title);
    for (const word of titleWords) {
      keywordSet.add(word.toLowerCase());
    }

    // Extract from description/content (if available)
    const textContent = item.content || item.description || '';
    if (textContent) {
      const contentWords = extractSignificantWords(textContent);
      // Only add top words from content to avoid noise
      for (const word of contentWords.slice(0, 10)) {
        keywordSet.add(word.toLowerCase());
      }
    }
  }

  return Array.from(keywordSet);
}

/**
 * Extract significant words from text
 * Filters out common stop words and short words
 */
function extractSignificantWords(text: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'over',
    'after',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'they',
    'them',
    'their',
    'we',
    'our',
    'you',
    'your',
    'i',
    'my',
    'me',
    'he',
    'she',
    'his',
    'her',
    'what',
    'which',
    'who',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'can',
    'now',
    'also',
    'get',
    'got',
    'like',
    'make',
    'made',
    'new',
    'one',
  ]);

  // Extract words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word) && !/^\d+$/.test(word));

  // Count word frequency
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  // Sort by frequency and return
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}
