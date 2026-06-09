const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DEFAULT_COLOR = '#f9a8d4'; // soft pink to match the booking card style

function buildProfileEmbed(profileData, currentImageIndex = 0) {
  const embed = new EmbedBuilder()
    .setColor(profileData.color || DEFAULT_COLOR);

  // Prominent name as the title (largest text)
  if (profileData.name) {
    embed.setTitle(`🌙  ${profileData.name}`);
  }

  // Avatar shows as a square in the top-right corner
  if (profileData.icon) {
    embed.setThumbnail(profileData.icon);
  }

  // Description: bio line, then star-bulleted interests
  const descLines = [];
  if (profileData.bio) {
    descLines.push(`✨  **${profileData.bio}**  ✨`);
  }
  if (profileData.interests && profileData.interests.length > 0) {
    if (descLines.length > 0) descLines.push('');
    profileData.interests.forEach(i => descLines.push(`✿  ${i}`));
  }
  if (profileData.custom_fields && profileData.custom_fields.length > 0) {
    profileData.custom_fields.forEach(f => descLines.push(`✿  **${f.name}:** ${f.value}`));
  }
  if (descLines.length > 0) {
    embed.setDescription(descLines.join('\n'));
  }

  // Main gallery image
  if (profileData.images && profileData.images[currentImageIndex]) {
    embed.setImage(profileData.images[currentImageIndex]);
  }

  return embed;
}

// Returns an array of ActionRows: [navigation row, action row]
function buildProfileComponents(shortcutName, profileData, currentPage = 0) {
  const totalImages = (profileData.images && profileData.images.length) || 1;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalImages - 1;

  // Row 1: << | page counter | >> | rating
  const prevBtn = new ButtonBuilder()
    .setCustomId(`profile_prev_${currentPage}_${shortcutName}`)
    .setLabel('«')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(isFirstPage);

  const pageBtn = new ButtonBuilder()
    .setCustomId(`profile_page_${currentPage}_${shortcutName}`)
    .setLabel(`${currentPage + 1}/${totalImages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`profile_next_${currentPage}_${shortcutName}`)
    .setLabel('»')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(isLastPage);

  const navRow = new ActionRowBuilder().addComponents(prevBtn, pageBtn, nextBtn);

  if (profileData.rating) {
    const ratingBtn = new ButtonBuilder()
      .setCustomId(`profile_rating_${currentPage}_${shortcutName}`)
      .setLabel(`${profileData.rating}`)
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    navRow.addComponents(ratingBtn);
  }

  // Row 2: Book | Feedback | Like
  const likes = (profileData.stats && profileData.stats.likes) || 0;
  const bookBtn = new ButtonBuilder()
    .setCustomId(`profile_book_${currentPage}_${shortcutName}`)
    .setLabel('Book')
    .setEmoji('🥿')
    .setStyle(ButtonStyle.Primary);

  const feedbackBtn = new ButtonBuilder()
    .setCustomId(`profile_feedback_${currentPage}_${shortcutName}`)
    .setLabel('Feedback')
    .setEmoji('✉️')
    .setStyle(ButtonStyle.Secondary);

  const likeBtn = new ButtonBuilder()
    .setCustomId(`profile_like_${currentPage}_${shortcutName}`)
    .setLabel(`${likes}`)
    .setEmoji('💗')
    .setStyle(ButtonStyle.Secondary);

  const actionRow = new ActionRowBuilder().addComponents(bookBtn, feedbackBtn, likeBtn);

  return [navRow, actionRow];
}

module.exports = {
  buildProfileEmbed,
  buildProfileComponents
};
