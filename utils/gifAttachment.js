const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');

// Download a direct .gif URL and wrap it as a Discord attachment. Discord
// animates GIFs served from its own CDN (attachments), unlike proxied URLs.
// Returns null on a non-gif URL or any failure so callers can degrade gracefully.
async function fetchGifAttachment(url, name = 'dice.gif') {
  if (!url || !/\.gif(\?|$)/i.test(url)) return null;
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 8 * 1024 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' },
    });
    return new AttachmentBuilder(Buffer.from(resp.data), { name });
  } catch (e) {
    return null;
  }
}

module.exports = { fetchGifAttachment };
