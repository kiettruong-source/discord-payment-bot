const axios = require('axios');

const UA = 'Mozilla/5.0 (compatible; DiscordBot/1.0)';

// Pages that host media behind an HTML page instead of a direct file URL.
const PAGE_HOSTS = /^https?:\/\/(www\.)?(tenor\.com\/(view|[a-z]{2}\/view)|giphy\.com\/gifs)/i;

// Unwrap Discord's media proxy: images-ext-N.discordapp.net/external/<hash>/https/<rest>
function unwrapDiscordProxy(url) {
  const m = url.match(/^https?:\/\/(?:images-ext-\d+|media)\.discordapp\.net\/external\/[^/]+\/(https?)\/(.+)$/i);
  return m ? `${m[1]}://${m[2]}` : url;
}

async function fetchOgImage(url) {
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 8000, maxRedirects: 5 });
    const html = String(res.data);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+itemprop=["']contentUrl["'][^>]+content=["']([^"']+)["']/i);
    return m && m[1] ? m[1] : null;
  } catch (e) {
    return null;
  }
}

async function contentType(url) {
  try {
    const res = await axios.head(url, { headers: { 'User-Agent': UA }, timeout: 8000, maxRedirects: 5, validateStatus: () => true });
    return String(res.headers['content-type'] || '').toLowerCase();
  } catch (e) {
    return '';
  }
}

/**
 * Resolve a shareable/page/proxy/video link to a direct image URL Discord can
 * embed. Returns { url, isImage }. Non-resolvable inputs pass through.
 *
 * Handles: Discord /external/ proxy unwrap, Tenor/Giphy view pages (og:image),
 * and Tenor video (.mp4) → animated GIF (format-code swap, verified).
 */
async function resolveImageDetailed(url) {
  if (!url) return { url, isImage: true };
  let u = unwrapDiscordProxy(url);

  // Tenor/Giphy view page → direct media URL
  if (PAGE_HOSTS.test(u)) {
    const og = await fetchOgImage(u);
    if (og) u = unwrapDiscordProxy(og);
  }

  // Tenor serves format by the path code, not the extension. A video code
  // (e.g. ...AAAPo) returns mp4 even as ".gif"; the tinygif code is ...AAAAC.
  if (/^https?:\/\/media\d*\.tenor\.com\//i.test(u) && /\.(mp4|webm)(\?|$)/i.test(u)) {
    const candidate = u
      .replace(/\.(mp4|webm)(\?|$)/i, '.gif$2')
      .replace(/([A-Za-z0-9]{5})(\/[^/]+\.gif)/, 'AAAAC$2');
    const ct = await contentType(candidate);
    if (ct.startsWith('image/')) return { url: candidate, isImage: true };
  }

  // Report whether the final URL is actually an image (best-effort)
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(u)) return { url: u, isImage: true };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { url: u, isImage: false };
  const ct = await contentType(u);
  return { url: u, isImage: ct === '' || ct.startsWith('image/') };
}

// Backwards-compatible helper: returns just the resolved URL.
async function resolveImageUrl(url) {
  return (await resolveImageDetailed(url)).url;
}

module.exports = { resolveImageUrl, resolveImageDetailed };
