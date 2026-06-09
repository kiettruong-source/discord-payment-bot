const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { buildProfileEmbed, buildProfileComponents, parseInterests } = require('../utils/profileCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editprofile')
    .setDescription('Modify an existing profile. Only the fields you provide are changed.')
    .addStringOption(option =>
      option.setName('shortcut')
        .setDescription('The profile trigger word to edit (e.g. e0)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('role')
        .setDescription('New role/title shown next to the icon (e.g. Ely 48)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('icon_url')
        .setDescription('New icon/avatar URL (animated GIF supported)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('New name shown as the big header (e.g. Thổ Yeuu)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('images')
        .setDescription('New image URLs (comma-separated) — replaces all images')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('interests')
        .setDescription('New interests separated by | or comma — replaces all interests')
        .setRequired(false))
    .addNumberOption(option =>
      option.setName('rating')
        .setDescription('New rating (0-5.0)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('New accent color hex (e.g., #f9a8d4)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('likes')
        .setDescription('Set the likes count')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('book')
        .setDescription('Set the bookings count')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('feedback')
        .setDescription('Set the feedback count')
        .setRequired(false)),

  async execute(interaction) {
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

    const profile = gallery[shortcut];
    if (!profile || typeof profile !== 'object' || !Array.isArray(profile.images)) {
      return interaction.reply({
        content: `❌ \`${shortcut}\` is not an existing profile. Use \`/createprofile\` to make one.`,
        ephemeral: true
      });
    }

    // Migrate old schema (name=role, bio=name) in place so edits use new fields
    if (profile.bio !== undefined && profile.role === undefined) {
      profile.role = profile.name;
      profile.name = profile.bio;
      delete profile.bio;
    }

    const validateUrl = (url) => url.startsWith('http://') || url.startsWith('https://');

    // Read options (null when not provided)
    const role = interaction.options.getString('role');
    const iconUrl = interaction.options.getString('icon_url');
    const name = interaction.options.getString('name');
    const imagesStr = interaction.options.getString('images');
    const interestsStr = interaction.options.getString('interests');
    const rating = interaction.options.getNumber('rating');
    const color = interaction.options.getString('color');
    const likes = interaction.options.getInteger('likes');
    const book = interaction.options.getInteger('book');
    const feedback = interaction.options.getInteger('feedback');

    const changed = [];

    if (role !== null) { profile.role = role; changed.push('role'); }
    if (name !== null) { profile.name = name; changed.push('name'); }

    if (iconUrl !== null) {
      if (!validateUrl(iconUrl)) {
        return interaction.reply({ content: '❌ Icon URL must start with http:// or https://', ephemeral: true });
      }
      profile.icon = iconUrl;
      changed.push('icon');
    }

    if (imagesStr !== null) {
      const images = imagesStr.split(',').map(u => u.trim()).filter(Boolean);
      for (const img of images) {
        if (!validateUrl(img)) {
          return interaction.reply({ content: `❌ Image URL invalid: ${img}`, ephemeral: true });
        }
      }
      if (images.length === 0) {
        return interaction.reply({ content: '❌ At least one image is required.', ephemeral: true });
      }
      profile.images = images;
      changed.push('images');
    }

    if (interestsStr !== null) {
      profile.interests = parseInterests(interestsStr);
      changed.push('interests');
    }

    if (rating !== null) { profile.rating = rating || null; changed.push('rating'); }

    if (color !== null) {
      if (!/^#?[0-9a-fA-F]{6}$/.test(color)) {
        return interaction.reply({ content: '❌ Color must be a 6-digit hex like #f9a8d4', ephemeral: true });
      }
      profile.color = color.startsWith('#') ? color : `#${color}`;
      changed.push('color');
    }

    if (!profile.stats) profile.stats = { book: 0, feedback: 0, likes: 0 };
    if (likes !== null) { profile.stats.likes = likes; changed.push('likes'); }
    if (book !== null) { profile.stats.book = book; changed.push('book'); }
    if (feedback !== null) { profile.stats.feedback = feedback; changed.push('feedback'); }

    if (changed.length === 0) {
      return interaction.reply({ content: 'ℹ️ Nothing to change — provide at least one field to update.', ephemeral: true });
    }

    fs.writeFileSync(galleryPath, JSON.stringify(gallery, null, 2), 'utf-8');

    const previewEmbed = buildProfileEmbed(profile, 0);
    const previewComponents = buildProfileComponents(shortcut, profile, 0);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Profile Updated')
      .setDescription(`Updated **${changed.join(', ')}** for \`${shortcut}\`.`)
      .setColor('#00ff00');

    await interaction.reply({
      embeds: [confirmEmbed, previewEmbed],
      components: previewComponents
    });
  }
};
