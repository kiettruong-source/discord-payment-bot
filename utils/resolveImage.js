const axios = require('axios');

// Pages that host media behind an HTML page instead of a direct file URL.
const PAGE_HOSTS = /^https?:\/\/(www\.)?(tenor\.com\/view|giphy\.com\/gifs|tenor\.com\/[a-z]{2}\/view)/i;

/**
 * Resolve a shareable page URL (e.g. a Tenor/Giphy "view" link) to the direct
 * media URL Discord can embed. Non-page URLs are returned unchanged.
 *
 * Tenor/Giphy pages expose the real media file via the og:image meta tag.
 * @param {string} url
 * @returns {Promise<string>} direct media URL (or the original on failure)
 */
async function resolveImageUrl(url) {
  if (!url || !PAGE_HOSTS.test(url)) return url;
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' },
      timeout: 8000,
      maxRedirects: 5,
    });
    const html = String(res.data);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+itemprop=["']contentUrl["'][^>]+content=["']([^"']+)["']/i);
    if (m && m[1]) return m[1];
  } catch (e) {
    // Network/parse failure — fall back to the original URL.
  }
  return url;
}

module.exports = { resolveImageUrl };
