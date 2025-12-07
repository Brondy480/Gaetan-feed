// server/services/feedServices.js
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Article from '../models/articles.js';

/**
 * Robust feed service
 * - prefers RSS-provided images (enclosure, media:content)
 * - falls back to guarded page-scraping (og:image, twitter:image, first <img>)
 * - limits concurrency so we don't get blocked
 * - retries feed fetching a few times
 * - upserts by URL to avoid duplicates
 */

/* ----------------------------
   Configuration
   ----------------------------*/
const DEFAULT_TIMEOUT = 20000; // parser timeout for RSS (ms)
const SCRAPE_TIMEOUT = 10000; // page scraping timeout (ms)
const MAX_FEED_RETRIES = 2; // feed parsing retries
const MAX_SCRAPE_CONCURRENCY = 4; // concurrent scrapes per feed (simple queue)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* Create rss-parser with headers and timeout */
const parser = new Parser({
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml, application/xml, text/xml, */*'
  }
});

/* ----------------------------
   Feeds list (you can edit this)
   ----------------------------*/
export const RSS_FEEDS = [
  { url: 'https://www.ft.com/?format=rss', source: 'Financial Times' },
  { url: 'https://www.economist.com/the-world-this-week/rss.xml', source: 'The Economist' },
  { url: 'https://sloanreview.mit.edu/feed/', source: 'MIT Sloan Management Review' },
  { url: 'https://www.mckinsey.com/featured-insights/rss', source: 'McKinsey' },
  { url: 'https://www2.deloitte.com/global/en/insights/rss.html', source: 'Deloitte Insights' },
  { url: 'https://www.privateequityinternational.com/feed/', source: 'Private Equity International' },
  { url: 'https://african.business/feed/', source: 'African Business Magazine' },
  { url: 'https://businessday.ng/feed/', source: 'BusinessDay Nigeria' },
  { url: 'https://kpmg.com/xx/en/blogs.rss.html', source: 'KPMG Insights' },
  { url: 'https://www.imf.org/external/pubs/ft/survey/so/rss.aspx?items=1', source: 'IMF' }
];

/* ----------------------------
   Category keywords (simple rule-based)
   ----------------------------*/
export const CATEGORY_KEYWORDS = {
  'Capital Strategy': ['rate', 'inflation', 'capital', 'market', 'macro', 'liquidity', 'monetary', 'fiscal'],
  'Private Markets & M&A': ['deal', 'acquisition', 'valuation', 'lbo', 'private equity', 'funding', 'term sheet', 'merger', 'buyout'],
  'Operational Excellence': ['productivity', 'cost', 'efficiency', 'automation', 'forecast', 'transformation', 'fp&a', 'operations'],
  'Leadership & Conscious CFO': ['leadership', 'culture', 'behavior', 'influence', 'team', 'decision', 'mindset', 'conscious'],
  'Africa Finance': ['africa', 'african', 'sub-saharan', 'nigeria', 'kenya', 'south africa']
};

/* ----------------------------
   Helpers
   ----------------------------*/
export function categorizeArticle(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const k of keywords) {
      if (text.includes(k.toLowerCase())) return category;
    }
  }
  return 'Uncategorized';
}

export function calculateRelevance(category) {
  const scores = {
    'Private Markets & M&A': 5,
    'Africa Finance': 5,
    'Capital Strategy': 4,
    'Operational Excellence': 4,
    'Leadership & Conscious CFO': 3,
    'Uncategorized': 1
  };
  return scores[category] || 2;
}

function safeDate(dateLike) {
  const d = new Date(dateLike);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeUrl(base, src) {
  if (!src) return null;
  // if already absolute, return
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, base).toString();
  } catch (err) {
    return null;
  }
}

/* Simple concurrency queue for scraping (p-limit-lite) */
function createLimitedQueue(limit = 4) {
  let active = 0;
  const queue = [];
  async function run(fn) {
    if (active >= limit) {
      await new Promise((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  }
  return (fn) => run(fn);
}

/* ----------------------------
   Image extraction:
   - prefer RSS fields (enclosure, media:content)
   - then try item.content (HTML)
   - finally guarded scrape of article page for og:image / twitter:image / first img
   ----------------------------*/
async function extractImageFromItem(item) {
  try {
    // 1) well-known RSS fields
    if (item.enclosure?.url) return item.enclosure.url;
    if (item['media:content']?.url) return item['media:content'].url;
    if (item['media:thumbnail']?.url) return item['media:thumbnail'].url;

    // 2) sometimes content contains an <img>
    const html = item.content || item['content:encoded'] || item.contentSnippet || '';
    if (html) {
      const match = html.match(/<img[^>]+src=(?:'|")([^'">]+)(?:'|")/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 3) fall back to page scrape (guarded)
    return null;
  } catch (err) {
    console.warn('extractImageFromItem error:', err.message);
    return null;
  }
}

/* Scrape page for image with safe headers/timeouts. Returns absolute URL or null. */
async function scrapePageForImage(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      timeout: SCRAPE_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.google.com/'
      },
      // do not follow infinite redirects
      maxRedirects: 3
    });

    const $ = cheerio.load(res.data);

    // OpenGraph
    let img = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
    if (img) return normalizeUrl(url, img);

    // Twitter card
    img = $('meta[name="twitter:image"]').attr('content') || $('meta[property="twitter:image"]').attr('content');
    if (img) return normalizeUrl(url, img);

    // First big image (pick one with width/height attributes or largest natural)
    const imgs = $('img')
      .map((i, el) => $(el).attr('src'))
      .get()
      .filter(Boolean);

    // choose first absolute or normalized
    for (const s of imgs) {
      const n = normalizeUrl(url, s);
      if (n) return n;
    }

    return null;
  } catch (err) {
    // Many big publishers block scraping -> axios will return 403 in many cases.
    // We log but don't fail the whole process.
    // Keep message concise
    console.warn(`Failed to fetch image for ${url}: ${err.message}`);
    return null;
  }
}

/* ----------------------------
   Feed fetching with retries
   ----------------------------*/
async function fetchFeedItemsWithRetries(feed, retries = MAX_FEED_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = parsed?.items || [];
      console.log(`✅ Fetched ${items.length} items from ${feed.source}`);
      return items;
    } catch (err) {
      console.warn(`Feed failed (${feed.url}) attempt ${attempt + 1}: ${err.message}`);
      // small backoff
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  console.error(`❌ All attempts failed for feed: ${feed.url}`);
  return [];
}

/* ----------------------------
   Main: fetchAllFeeds
   - processes feeds sequentially with throttled scraping per feed
   - updates MongoDB using updateOne({url}, {$set: articleData}, {upsert:true})
   ----------------------------*/
export async function fetchAllFeeds(feeds = RSS_FEEDS) {
  console.log('📡 Fetching RSS feeds...');

  let totalSaved = 0;
  // iterate feeds sequentially to reduce total parallel requests
  for (const feed of feeds) {
    const items = await fetchFeedItemsWithRetries(feed);

    // per-feed limited queue for scraping
    const queue = createLimitedQueue(MAX_SCRAPE_CONCURRENCY);
    // process all items (map -> promises), but extraction+save done with queue for scrape concurrency limit
    const promises = items.map((item) =>
      queue(async () => {
        try {
          const title = (item.title || '').trim() || 'No title';
          const desc = (item.contentSnippet || item['content:encoded'] || item.content || '').trim();
          const category = categorizeArticle(title, desc);
          const relevanceScore = calculateRelevance(category);

          // 1) quick extract from RSS fields or content
          let image = await extractImageFromItem(item);

          // 2) if none, attempt guarded scrape
          if (!image) {
            // scrape may fail with 403 (publisher blocks), that's OK
            const scraped = await scrapePageForImage(item.link || item.guid);
            image = scraped || null;
          }

          // ensure normalized image url if relative
          if (image && item.link) image = normalizeUrl(item.link, image) || image;

          const articleData = {
            title,
            url: item.link || item.guid || '#',
            source: feed.source,
            category,
            description: desc.substring(0, 1200),
            publishedDate: safeDate(item.pubDate || item.isoDate),
            relevanceScore,
            image: image || null
          };

          // upsert (unique by url) - updateOne with $set avoids duplicate inserts
          await Article.updateOne({ url: articleData.url }, { $set: articleData }, { upsert: true });
          totalSaved += 1;
        } catch (err) {
          // don't let single-item errors stop the loop
          console.error('Item processing error:', err.message || err);
        }
      })
    );

    // wait for all items of this feed to complete before moving to next feed
    await Promise.all(promises);
  }

  console.log(`✅ All feeds processed — items processed (approx): ${totalSaved}`);
}

/* ----------------------------
   Optional helper for single-feed fetch (exports if you need)
   ----------------------------*/
export async function fetchSingleFeedAndSave(feed) {
  const items = await fetchFeedItemsWithRetries(feed);
  const queue = createLimitedQueue(MAX_SCRAPE_CONCURRENCY);
  for (const item of items) {
    await queue(async () => {
      // reuse same logic as above: simpler inline to avoid duplication
      const title = (item.title || '').trim() || 'No title';
      const desc = (item.contentSnippet || item['content:encoded'] || item.content || '').trim();
      const category = categorizeArticle(title, desc);
      const relevanceScore = calculateRelevance(category);

      let image = await extractImageFromItem(item);
      if (!image) image = await scrapePageForImage(item.link || item.guid);

      if (image && item.link) image = normalizeUrl(item.link, image) || image;

      const articleData = {
        title,
        url: item.link || item.guid || '#',
        source: feed.source,
        category,
        description: desc.substring(0, 1200),
        publishedDate: safeDate(item.pubDate || item.isoDate),
        relevanceScore,
        image: image || null
      };

      try {
        await Article.updateOne({ url: articleData.url }, { $set: articleData }, { upsert: true });
      } catch (err) {
        if (err.code !== 11000) console.error('Save error (single):', err.message || err);
      }
    });
  }
}
