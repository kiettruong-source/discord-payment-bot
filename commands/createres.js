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
        .setRequired(true))
    .addUserOption(option =>
      option.setName('target_user')
        .setDescription('Optional user to ping when this shortcut is used')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Optional custom text message to accompany the image')
        .setRequired(false)),
  
  async execute(interaction) {
    // Admin only check
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const name = interaction.options.getString('name').trim().toLowerCase();
    const link = interaction.options.getString('link');
    const targetUser = interaction.options.getUser('target_user');
    const customText = interaction.options.getString('text');

    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      return interaction.reply({ content: '❌ Link must start with http:// or https://', ephemeral: true });
    }

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

    gallery[name] = {
      url: link,
      target_user_id: targetUser ? targetUser.id : null,
      custom_text: customText || null
    };
    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const embed = new EmbedBuilder()
      .setTitle('✅ Shortcut Registered')
      .setDescription(`Typing \`${name}\` will now display your custom image frame.\nTarget Ping: ${targetUser ? targetUser.toString() : 'None'}\nCustom Text: ${customText || 'None'}`)
      .setColor('#00ff00')
      .setThumbnail(link);

    await interaction.reply({ embeds: [embed] });
  }
};
