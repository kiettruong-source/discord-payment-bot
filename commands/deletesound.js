const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { deleteSoundFiles } = require('../utils/sound');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletesound')
    .setDescription('Xóa âm thanh của một profile / Remove a profile\'s sound')
    .addStringOption((o) =>
      o.setName('shortcut')
        .setDescription('Trigger word của profile (vd: e0)')
        .setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const shortcut = interaction.options.getString('shortcut').trim().toLowerCase();

    const dataDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
    const galleryPath = path.join(dataDir, 'gallery.json');
    let gallery = {};
    if (fs.existsSync(galleryPath)) {
      try { gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8')); } catch (e) { /* ignore */ }
    }

    const profile = gallery[shortcut];
    if (!profile || typeof profile !== 'object' || !Array.isArray(profile.images)) {
      return interaction.reply({ content: `❌ \`${shortcut}\` không phải profile. / Not a profile.`, ephemeral: true });
    }
    if (!profile.sound) {
      return interaction.reply({ content: `ℹ️ \`${shortcut}\` chưa có âm thanh. / This profile has no sound.`, ephemeral: true });
    }

    deleteSoundFiles(shortcut);
    delete profile.sound;
    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Sound Deleted')
      .setDescription(`Đã xóa âm thanh của \`${shortcut}\`. / Sound removed.`)
      .setColor('#ff0000');

    await interaction.reply({ embeds: [embed] });
  },
};
