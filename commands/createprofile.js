const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { buildProfileEmbed, buildNavigationButtons } = require('../utils/profileCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createprofile')
    .setDescription('Create a profile carousel with multiple images and profile details.')
    .addStringOption(option =>
      option.setName('shortcut')
        .setDescription('The trigger word (e.g., e0)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Profile name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('icon_url')
        .setDescription('Profile icon/avatar URL')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('bio')
        .setDescription('Bio/title text')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('interests')
        .setDescription('Interests (comma-separated, e.g., "Gaming,Cooking,Music")')
        .setRequired(false))
    .addNumberOption(option =>
      option.setName('rating')
        .setDescription('Rating (0-5.0)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('images')
        .setDescription('Image URLs (comma-separated)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('likes')
        .setDescription('Number of likes')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('book')
        .setDescription('Number of bookings')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('feedback')
        .setDescription('Number of feedback')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const shortcut = interaction.options.getString('shortcut').trim().toLowerCase();
    const name = interaction.options.getString('name');
    const iconUrl = interaction.options.getString('icon_url');
    const bio = interaction.options.getString('bio');
    const interestsStr = interaction.options.getString('interests') || '';
    const rating = interaction.options.getNumber('rating');
    const imagesStr = interaction.options.getString('images');
    const likes = interaction.options.getInteger('likes') || 0;
    const book = interaction.options.getInteger('book') || 0;
    const feedback = interaction.options.getInteger('feedback') || 0;

    // Validate URLs
    const validateUrl = (url) => url.startsWith('http://') || url.startsWith('https://');
    if (!validateUrl(iconUrl)) {
      return interaction.reply({ content: '❌ Icon URL must start with http:// or https://', ephemeral: true });
    }

    const images = imagesStr.split(',').map(u => u.trim());
    for (const img of images) {
      if (!validateUrl(img)) {
        return interaction.reply({ content: `❌ Image URL invalid: ${img}`, ephemeral: true });
      }
    }

    const interests = interestsStr.split(',').map(i => i.trim()).filter(Boolean);

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

    gallery[shortcut] = {
      images,
      name,
      icon: iconUrl,
      bio,
      interests,
      rating: rating || null,
      stats: {
        book,
        feedback,
        likes
      },
      custom_fields: [],
      target_user_id: null,
      custom_text: null
    };

    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    // Show preview
    const previewEmbed = buildProfileEmbed(gallery[shortcut], 0);
    const previewButtons = buildNavigationButtons(shortcut, images.length, 0);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Profile Created')
      .setDescription(`Typing \`${shortcut}\` will now display this profile carousel (${images.length} images).`)
      .setColor('#00ff00');

    await interaction.reply({
      embeds: [confirmEmbed, previewEmbed],
      components: images.length > 1 ? [previewButtons] : []
    });
  }
};
