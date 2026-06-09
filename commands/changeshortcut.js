const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { renameSoundFiles } = require('../utils/sound');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('changeshortcut')
    .setDescription('Đổi từ khóa kích hoạt của profile / Change a profile\'s trigger word')
    .addStringOption((o) =>
      o.setName('current')
        .setDescription('Từ khóa hiện tại / Current trigger word (e.g. e0)')
        .setRequired(true))
    .addStringOption((o) =>
      o.setName('new')
        .setDescription('Từ khóa mới / New trigger word')
        .setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const oldKey = interaction.options.getString('current').trim().toLowerCase();
    const newKey = interaction.options.getString('new').trim().toLowerCase();

    if (!newKey) {
      return interaction.reply({ content: '❌ Từ khóa mới không hợp lệ. / Invalid new trigger word.', ephemeral: true });
    }
    if (newKey === oldKey) {
      return interaction.reply({ content: 'ℹ️ Từ khóa mới giống từ khóa cũ. / New trigger is the same.', ephemeral: true });
    }
    if (/\s/.test(newKey)) {
      return interaction.reply({ content: '❌ Từ khóa không được chứa khoảng trắng. / Trigger word cannot contain spaces.', ephemeral: true });
    }

    const dataDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
    const galleryPath = path.join(dataDir, 'gallery.json');
    let gallery = {};
    if (fs.existsSync(galleryPath)) {
      try { gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8')); } catch (e) { /* ignore */ }
    }

    if (!gallery[oldKey]) {
      return interaction.reply({ content: `❌ \`${oldKey}\` không tồn tại. / \`${oldKey}\` does not exist.`, ephemeral: true });
    }
    if (gallery[newKey]) {
      return interaction.reply({ content: `❌ \`${newKey}\` đã được dùng. Chọn từ khóa khác. / \`${newKey}\` is already taken.`, ephemeral: true });
    }

    const entry = gallery[oldKey];

    // Move the entry to the new key
    gallery[newKey] = entry;
    delete gallery[oldKey];

    // Keep the sound file name in sync with the new shortcut
    if (entry && typeof entry === 'object' && entry.sound && entry.sound.file) {
      const renamed = renameSoundFiles(oldKey, newKey);
      if (renamed) entry.sound.file = renamed;
    }

    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const embed = new EmbedBuilder()
      .setTitle('🔁 Trigger Word Changed')
      .setDescription(`Từ giờ gõ \`${newKey}\` (thay cho \`${oldKey}\`) để hiển thị profile. / Type \`${newKey}\` instead of \`${oldKey}\` now.`)
      .setColor('#00ff00');

    await interaction.reply({ embeds: [embed] });
  },
};
