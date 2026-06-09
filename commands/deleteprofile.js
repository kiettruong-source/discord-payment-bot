const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteprofile')
    .setDescription('Delete an existing profile carousel.')
    .addStringOption(option =>
      option.setName('shortcut')
        .setDescription('The profile trigger word to delete (e.g. e0)')
        .setRequired(true)),

  async execute(interaction) {
    // Admin only check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const shortcut = interaction.options.getString('shortcut').trim().toLowerCase();

    const dataDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
    const galleryPath = path.join(dataDir, 'gallery.json');
    let gallery = {};
    if (fs.existsSync(galleryPath)) {
      try {
        gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8'));
      } catch (e) {
        console.error('Failed to parse gallery.json', e);
      }
    }

    const entry = gallery[shortcut];
    if (!entry) {
      return interaction.reply({ content: `❌ \`${shortcut}\` does not exist.`, ephemeral: true });
    }

    // Make sure it is actually a profile carousel
    if (typeof entry !== 'object' || !Array.isArray(entry.images)) {
      return interaction.reply({
        content: `❌ \`${shortcut}\` is a simple image shortcut, not a profile. Use \`/deleteres\` instead.`,
        ephemeral: true
      });
    }

    const profileName = entry.name || shortcut;
    const imageCount = entry.images.length;

    delete gallery[shortcut];
    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Profile Deleted')
      .setDescription(`Profile **${profileName}** (\`${shortcut}\`, ${imageCount} image${imageCount === 1 ? '' : 's'}) has been removed.`)
      .setColor('#ff0000');

    await interaction.reply({ embeds: [embed] });
  }
};
