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

// Download an uploaded audio attachment and store it. Returns the sound record.
async function saveUploadedSound(shortcut, attachment) {
  const name = (attachment.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const isAudio = (attachment.contentType || '').startsWith('audio/') || ALLOWED_EXT.includes(ext);
  if (!isAudio) {
    throw new Error('NOT_AUDIO');
  }
  if (attachment.size && attachment.size > MAX_BYTES) {
    throw new Error('TOO_BIG');
  }
  const useExt = ALLOWED_EXT.includes(ext) ? ext : 'mp3';
  const resp = await axios.get(attachment.url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxContentLength: MAX_BYTES,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' },
  });
  ensureSoundsDir();
  removeExistingSound(shortcut);
  fs.writeFileSync(path.join(soundsDir, `${shortcut}.${useExt}`), Buffer.from(resp.data));
  return { file: `${shortcut}.${useExt}`, source: 'upload' };
}

// Download a YouTube clip (CLIP_SECONDS from `start`) and store it as mp3.
// Deps are lazy-required so a missing/broken binary never crashes the bot.
async function fetchYouTubeClip(shortcut, url, start) {
  const ytdl = require('@distube/ytdl-core');
  const ffmpegPath = require('ffmpeg-static');
  const { spawn } = require('child_process');

  if (!ytdl.validateURL(url)) throw new Error('INVALID_URL');
  ensureSoundsDir();
  removeExistingSound(shortcut);

  const outPath = path.join(soundsDir, `${shortcut}.mp3`);
  const startSec = Math.max(0, parseInt(start, 10) || 0);

  await new Promise((resolve, reject) => {
    let settled = false;
    let lastAudioErr = null;
    let ffErr = '';
    const done = (err) => { if (settled) return; settled = true; err ? reject(err) : resolve(); };

    const audio = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
    const ff = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-ss', String(startSec),
      '-t', String(CLIP_SECONDS),
      '-vn', '-acodec', 'libmp3lame', '-b:a', '128k',
      '-f', 'mp3', '-y', outPath,
    ]);

    const timeout = setTimeout(() => {
      try { audio.destroy(); ff.kill('SIGKILL'); } catch (e) { /* ignore */ }
      done(new Error('TIMEOUT'));
    }, 90000);

    ff.stderr.on('data', (d) => { ffErr += d.toString(); });
    ff.stdin.on('error', () => { /* ignore EPIPE when ffmpeg closes early */ });
    ff.on('error', (e) => { clearTimeout(timeout); done(new Error('FFMPEG_SPAWN_FAILED: ' + e.message)); });
    audio.on('error', (e) => { lastAudioErr = e; try { ff.stdin.end(); } catch (_) { /* ignore */ } });
    ff.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return done();
      if (lastAudioErr) return done(new Error('YT_FETCH_FAILED: ' + lastAudioErr.message));
      return done(new Error('FFMPEG_FAILED: ' + ffErr.slice(-300)));
    });

    audio.pipe(ff.stdin);
  });

  return { file: `${shortcut}.mp3`, source: 'youtube' };
}

// Build an attachment for a profile's stored sound, or null if none/missing.
function getSoundAttachment(profile) {
  const file = profile && profile.sound && profile.sound.file;
  if (!file) return null;
  const full = path.join(soundsDir, file);
  if (!fs.existsSync(full)) return null;
  const ext = file.split('.').pop();
  const display = `${(profile.role || profile.name || 'profile')}-sound.${ext}`.replace(/\s+/g, '_');
  return new AttachmentBuilder(full, { name: display });
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
