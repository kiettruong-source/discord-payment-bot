const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');

const dataDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
const soundsDir = path.join(dataDir, 'sounds');

const ALLOWED_EXT = ['mp3', 'ogg', 'wav', 'm4a', 'webm', 'flac'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const CLIP_SECONDS = 30;

function ensureSoundsDir() {
  if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });
}

// Remove any stored sound file for a shortcut (e0.mp3, e0.ogg, ...).
function removeExistingSound(shortcut) {
  if (!fs.existsSync(soundsDir)) return;
  for (const f of fs.readdirSync(soundsDir)) {
    if (f.startsWith(`${shortcut}.`)) {
      try { fs.unlinkSync(path.join(soundsDir, f)); } catch (e) { /* ignore */ }
    }
  }
}

// Clip CLIP_SECONDS of audio starting at `start` from a Buffer or Readable
// stream, encoding to mp3 at outPath. ffmpeg is lazy-required.
function clipWithFfmpeg(source, start, outPath) {
  const ffmpegPath = require('ffmpeg-static');
  const { spawn } = require('child_process');
  const startSec = Math.max(0, parseInt(start, 10) || 0);

  return new Promise((resolve, reject) => {
    let settled = false;
    let srcErr = null;
    let ffErr = '';
    const done = (err) => { if (settled) return; settled = true; err ? reject(err) : resolve(); };

    const ff = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-ss', String(startSec),
      '-t', String(CLIP_SECONDS),
      '-vn', '-acodec', 'libmp3lame', '-b:a', '128k',
      '-f', 'mp3', '-y', outPath,
    ]);

    const timeout = setTimeout(() => {
      try { if (source && source.destroy) source.destroy(); ff.kill('SIGKILL'); } catch (e) { /* ignore */ }
      done(new Error('TIMEOUT'));
    }, 90000);

    ff.stderr.on('data', (d) => { ffErr += d.toString(); });
    ff.stdin.on('error', () => { /* ignore EPIPE when ffmpeg closes early */ });
    ff.on('error', (e) => { clearTimeout(timeout); done(new Error('FFMPEG_SPAWN_FAILED: ' + e.message)); });
    ff.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return done();
      if (srcErr) return done(new Error('SOURCE_FAILED: ' + srcErr.message));
      return done(new Error('FFMPEG_FAILED: ' + ffErr.slice(-300)));
    });

    if (Buffer.isBuffer(source)) {
      ff.stdin.end(source);
    } else {
      source.on('error', (e) => { srcErr = e; try { ff.stdin.end(); } catch (_) { /* ignore */ } });
      source.pipe(ff.stdin);
    }
  });
}

// Download an uploaded audio attachment, trim CLIP_SECONDS from `start`, store as mp3.
async function saveUploadedSound(shortcut, attachment, start) {
  const name = (attachment.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const isAudio = (attachment.contentType || '').startsWith('audio/') || ALLOWED_EXT.includes(ext);
  if (!isAudio) {
    throw new Error('NOT_AUDIO');
  }
  if (attachment.size && attachment.size > MAX_BYTES) {
    throw new Error('TOO_BIG');
  }
  const resp = await axios.get(attachment.url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxContentLength: MAX_BYTES,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' },
  });
  ensureSoundsDir();
  removeExistingSound(shortcut);
  await clipWithFfmpeg(Buffer.from(resp.data), start, path.join(soundsDir, `${shortcut}.mp3`));
  return { file: `${shortcut}.mp3`, source: 'upload' };
}

// Download a YouTube clip (CLIP_SECONDS from `start`) and store it as mp3.
// Deps are lazy-required so a missing/broken binary never crashes the bot.
async function fetchYouTubeClip(shortcut, url, start) {
  const ytdl = require('@distube/ytdl-core');
  if (!ytdl.validateURL(url)) throw new Error('INVALID_URL');
  ensureSoundsDir();
  removeExistingSound(shortcut);

  const audio = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
  await clipWithFfmpeg(audio, start, path.join(soundsDir, `${shortcut}.mp3`));
  return { file: `${shortcut}.mp3`, source: 'youtube' };
}

// Build an attachment for a profile's stored sound, or null if none/missing.
function getSoundAttachment(profile) {
  const file = profile && profile.sound && profile.sound.file;
  if (!file) return null;
  const full = path.join(soundsDir, file);
  if (!fs.existsSync(full)) return null;
  const ext = file.split('.').pop();
  // Filename based on the profile name: <name>_sound.<ext>
  const base = String(profile.name || profile.role || 'profile')
    .replace(/<a?:\w+:\d+>/g, '')       // strip custom emoji markup <:name:id> / <a:name:id>
    .replace(/[^\p{L}\p{N}]+/gu, '_')   // non-alphanumeric (incl. unicode emoji) → _
    .replace(/^_+|_+$/g, '')            // trim leading/trailing underscores
    || 'profile';
  return new AttachmentBuilder(full, { name: `${base}_sound.${ext}` });
}

function deleteSoundFiles(shortcut) {
  removeExistingSound(shortcut);
}

module.exports = {
  saveUploadedSound,
  fetchYouTubeClip,
  getSoundAttachment,
  deleteSoundFiles,
  CLIP_SECONDS,
};
