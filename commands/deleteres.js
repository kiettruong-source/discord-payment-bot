const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteres')
    .setDescription('Delete an existing text shortcut image response.')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('The shortcut trigger word to delete (e.g. vanu)')
        .setRequired(true)),
  
  async execute(interaction) {
    // Admin only check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const name = interaction.options.getString('name').trim().toLowerCase();

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

    if (!gallery[name]) {
      return interaction.reply({ content: `❌ Shortcut \`${name}\` does not exist.`, ephemeral: true });
    }

    delete gallery[name];
    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Shortcut Deleted')
      .setDescription(`The custom image frame for \`${name}\` has been successfully removed.`)
      .setColor('#ff0000'); // Red

    await interaction.reply({ embeds: [embed] });
  }
};
