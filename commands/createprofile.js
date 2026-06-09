const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { buildProfileEmbed, buildProfileComponents, parseInterests } = require('../utils/profileCard');
const { resolveImageUrl, resolveImageDetailed } = require('../utils/resolveImage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createprofile')
    .setDescription('Create a profile carousel with multiple images and profile details.')
    .addStringOption(option =>
      option.setName('shortcut')
        .setDescription('The trigger word (e.g., e0)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('role')
        .setDescription('Role/title shown next to the icon (e.g. Ely 48)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('avatar_url')
        .setDescription('Profile avatar URL (animated GIF supported)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name shown as the big header (e.g. Thổ Yeuu)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('images')
        .setDescription('Image URLs (comma-separated)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('bio')
        .setDescription('Bio lines separated by | or comma (e.g. "Gaming | Game: PUBG, LQ | Cam: Deal")')
        .setRequired(false))
    .addNumberOption(option =>
      option.setName('rating')
        .setDescription('Rating (0-5.0)')
        .setRequired(false))
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
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Accent color hex (e.g., #f9a8d4). Default: pink')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
    }

    const shortcut = interaction.options.getString('shortcut').trim().toLowerCase();
    const role = interaction.options.getString('role');
    const iconUrl = interaction.options.getString('avatar_url');
    const name = interaction.options.getString('name');
    const interestsStr = interaction.options.getString('bio') || '';
    const rating = interaction.options.getNumber('rating');
    const imagesStr = interaction.options.getString('images');
    const likes = interaction.options.getInteger('likes') || 0;
    const book = interaction.options.getInteger('book') || 0;
    const feedback = interaction.options.getInteger('feedback') || 0;
    const color = interaction.options.getString('color');

    // Validate URLs
    const validateUrl = (url) => url.startsWith('http://') || url.startsWith('https://');
    if (!validateUrl(iconUrl)) {
      return interaction.reply({ content: '❌ Icon URL must start with http:// or https://', ephemeral: true });
    }

    if (color && !/^#?[0-9a-fA-F]{6}$/.test(color)) {
      return interaction.reply({ content: '❌ Color must be a 6-digit hex like #f9a8d4', ephemeral: true });
    }

    const images = imagesStr.split(',').map(u => u.trim());
    for (const img of images) {
      if (!validateUrl(img)) {
        return interaction.reply({ content: `❌ Image URL invalid: ${img}`, ephemeral: true });
      }
    }

    const interests = parseInterests(interestsStr);

    // Resolving Tenor/Giphy page links needs network calls — defer first.
    await interaction.deferReply();

    // Resolve shareable page links (e.g. tenor.com/view/...) to direct media URLs
    const iconResolved = await resolveImageDetailed(iconUrl);
    if (!iconResolved.isImage) {
      return interaction.editReply({
        content: '❌ That avatar is a video (.mp4), not an image — Discord can only show GIF/PNG/JPG avatars. Use the Tenor **page** link (tenor.com/view/...) or a direct .gif/.png/.jpg URL.'
      });
    }
    const resolvedIcon = iconResolved.url;
    const resolvedImages = [];
    for (const img of images) resolvedImages.push(await resolveImageUrl(img));

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
      images: resolvedImages,
      role,
      icon: resolvedIcon,
      name,
      interests,
      rating: rating || null,
      color: color ? (color.startsWith('#') ? color : `#${color}`) : null,
      stats: {
        book,
        feedback,
        likes
      },
      liked_by: [],
      custom_fields: [],
      target_user_id: null,
      custom_text: null
    };

    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    // Show preview
    const previewEmbed = buildProfileEmbed(gallery[shortcut], 0);
    const previewComponents = buildProfileComponents(shortcut, gallery[shortcut], 0);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Profile Created')
      .setDescription(`Typing \`${shortcut}\` will now display this profile carousel (${images.length} images).`)
      .setColor('#00ff00');

    await interaction.editReply({
      embeds: [confirmEmbed, previewEmbed],
      components: previewComponents
    });
  }
};
