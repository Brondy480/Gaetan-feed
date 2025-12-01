// server/services/feedServices.js
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Article from '../models/articles.js';

// Create parser with headers to reduce 403s & set timeout
const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RSSFetcher/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*'
  }
});

// RSS feeds
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

// Categories and keywords
export const CATEGORY_KEYWORDS = {
  'Capital Strategy': ['rate','inflation','capital','market','macro','liquidity','monetary','fiscal'],
  'Private Markets & M&A': ['deal','acquisition','valuation','lbo','private equity','funding','term sheet','merger','buyout'],
  'Operational Excellence': ['productivity','cost','efficiency','automation','forecast','transformation','fp&a','operations'],
  'Leadership & Conscious CFO': ['leadership','culture','behavior','influence','team','decision','mindset','conscious'],
  'Africa Finance': ['africa','african','sub-saharan','nigeria','kenya','south africa']
};

// Categorize article
export function categorizeArticle(title, description) {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k.toLowerCase()))) return category;
  }
  return 'Uncategorized';
}

// Relevance score
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

// Ensure valid date
function safeDate(date) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date() : d;
}

// --- MAXIMAL IMAGE FETCH ---
async function extractImage(item) {
  // 1️⃣ Try RSS media fields
  const media = item.enclosure?.url || item['media:thumbnail']?.url || item['media:content']?.url;
  if (media) return media;

  // 2️⃣ Try page scraping
  const url = item.link || item.guid;
  if (!url) return null;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // OG image
    let image = $('meta[property="og:image"]').attr('content');
    if (image) return image;

    // Twitter card image
    image = $('meta[name="twitter:image"]').attr('content');
    if (image) return image;

    // First <img> in page
    const firstImg = $('img').first().attr('src');
    if (firstImg) return firstImg;

    return null; // No image found
  } catch (err) {
    console.warn(`Failed to fetch image for ${url}: ${err.message}`);
    return null;
  }
}

// Retry RSS feed parsing
async function fetchFeedWithRetry(feed, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items || [];
    } catch (err) {
      console.warn(`Feed failed (${feed.url}) attempt ${attempt + 1}: ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return [];
}

// Fetch all feeds and save to MongoDB
export async function fetchAllFeeds(feeds = RSS_FEEDS) {
  console.log('📡 Fetching RSS feeds...');

  for (const feed of feeds) {
    const items = await fetchFeedWithRetry(feed);

    for (const item of items) {
      const title = item.title || 'No title';
      const desc = item.contentSnippet || item['content:encoded'] || item.content || '';
      const category = categorizeArticle(title, desc);
      const relevanceScore = calculateRelevance(category);
      const image = await extractImage(item); // Maximal fetching

      const articleData = {
        title,
        url: item.link || item.guid || '#',
        source: feed.source,
        category,
        description: desc.substring(0, 1000),
        publishedDate: safeDate(item.pubDate || item.isoDate),
        relevanceScore,
        image // could be null if nothing found
      };

      try {
        await Article.updateOne(
          { url: articleData.url },
          { $set: articleData },
          { upsert: true }
        );
      } catch (err) {
        if (err.code !== 11000) console.error('Save error:', err.message);
      }
    }
  }

  console.log('✅ All feeds processed');
}
  