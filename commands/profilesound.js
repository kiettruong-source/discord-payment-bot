const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { saveUploadedSound, fetchYouTubeClip, deleteSoundFiles, CLIP_SECONDS } = require('../utils/sound');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profilesound')
    .setDescription('Thêm/xóa âm thanh cho profile / Add or remove a profile sound bar')
    .addStringOption((o) =>
      o.setName('shortcut')
        .setDescription('Trigger word của profile (vd: e0)')
        .setRequired(true))
    .addAttachmentOption((o) =>
      o.setName('file')
        .setDescription('Tải lên file âm thanh (mp3/ogg/wav/m4a) / Upload an audio file')
        .setRequired(false))
    .addStringOption((o) =>
      o.setName('yt_url')
        .setDescription('Link YouTube để cắt 30s / YouTube link to clip 30s from')
        .setRequired(false))
    .addIntegerOption((o) =>
      o.setName('start')
        .setDescription('Giây bắt đầu cắt 30s (cho file & YouTube, mặc định 0) / Start second for file & YouTube')
        .setRequired(false)
        .setMinValue(0))
    .addBooleanOption((o) =>
      o.setName('remove')
        .setDescription('Xóa âm thanh hiện tại / Remove the current sound')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const shortcut = interaction.options.getString('shortcut').trim().toLowerCase();
    const file = interaction.options.getAttachment('file');
    const ytUrl = interaction.options.getString('yt_url');
    const start = interaction.options.getInteger('start') || 0;
    const remove = interaction.options.getBoolean('remove');

    const dataDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
    const galleryPath = path.join(dataDir, 'gallery.json');
    let gallery = {};
    if (fs.existsSync(galleryPath)) {
      try { gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8')); } catch (e) { /* ignore */ }
    }

    const profile = gallery[shortcut];
    if (!profile || typeof profile !== 'object' || !Array.isArray(profile.images)) {
      return interaction.reply({ content: `❌ \`${shortcut}\` không phải profile. Dùng \`/createprofile\` trước. / Not a profile.`, ephemeral: true });
    }

    const okEmbed = (desc) => new EmbedBuilder().setTitle('🔊 Profile Sound').setDescription(desc).setColor('#00ff00');

    // Remove
    if (remove) {
      deleteSoundFiles(shortcut);
      delete profile.sound;
      fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');
      return interaction.reply({ embeds: [okEmbed(`Đã xóa âm thanh của \`${shortcut}\`. / Sound removed.`)] });
    }

    // Upload (download + ffmpeg trim — defer)
    if (file) {
      await interaction.deferReply();
      try {
        const sound = await saveUploadedSound(shortcut, file, start);
        profile.sound = sound;
        fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');
        return interaction.editReply({ embeds: [okEmbed(`Đã thêm âm thanh (${CLIP_SECONDS}s từ giây ${start}) cho \`${shortcut}\`. Thanh phát sẽ hiện dưới profile. / Sound added (${CLIP_SECONDS}s from ${start}s).`)] });
      } catch (e) {
        const msg = e.message === 'NOT_AUDIO' ? '❌ File phải là âm thanh (mp3/ogg/wav/m4a). / File must be audio.'
          : e.message === 'TOO_BIG' ? '❌ File quá lớn (>8MB). / File too large (>8MB).'
          : '❌ Không xử lý được file. / Could not process the file.';
        return interaction.editReply({ content: msg });
      }
    }

    // YouTube clip (slow — defer)
    if (ytUrl) {
      await interaction.deferReply();
      try {
        const sound = await fetchYouTubeClip(shortcut, ytUrl, start);
        profile.sound = sound;
        fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');
        return interaction.editReply({ embeds: [okEmbed(`Đã cắt ${CLIP_SECONDS}s từ YouTube (bắt đầu ${start}s) cho \`${shortcut}\`. / Clipped ${CLIP_SECONDS}s from YouTube.`)] });
      } catch (e) {
        const yt = /INVALID_URL/.test(e.message)
          ? '❌ Link YouTube không hợp lệ. / Invalid YouTube link.'
          : '❌ Không tải được từ YouTube (máy chủ thường bị YouTube chặn). Hãy **tải file âm thanh lên** thay thế. / YouTube fetch failed (often blocked on servers) — upload an audio file instead.';
        return interaction.editReply({ content: yt });
      }
    }

    return interaction.reply({ content: 'ℹ️ Cung cấp `file`, `yt_url`, hoặc `remove`. / Provide a file, yt_url, or remove.', ephemeral: true });
  },
};
