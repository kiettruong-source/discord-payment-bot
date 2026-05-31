const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createres')
    .setDescription('Save or update a text shortcut image response.')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('The shortcut trigger word (e.g. vanu)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('link')
        .setDescription('The direct image URL link')
        .setRequired(true)),
  
  async execute(interaction) {
    // Admin only check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const name = interaction.options.getString('name').trim().toLowerCase();
    const link = interaction.options.getString('link');

    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      return interaction.reply({ content: '❌ Link must start with http:// or https://', ephemeral: true });
    }

    const galleryPath = path.join(__dirname, '..', 'gallery.json');
    let gallery = {};
    if (fs.existsSync(galleryPath)) {
      try {
        gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8'));
      } catch (e) {
        console.error('Failed to parse gallery.json', e);
      }
    }

    gallery[name] = link;
    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const embed = new EmbedBuilder()
      .setTitle('✅ Shortcut Registered')
      .setDescription(`Typing \`${name}\` will now display your custom image frame.`)
      .setColor('#00ff00')
      .setThumbnail(link);

    await interaction.reply({ embeds: [embed] });
  }
};
