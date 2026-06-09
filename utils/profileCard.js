const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildProfileEmbed(profileData, currentImageIndex = 0) {
  const totalImages = profileData.images.length;
  const embed = new EmbedBuilder()
    .setColor('#00b96b');

  if (profileData.name) {
    embed.setAuthor({
      name: profileData.name,
      iconURL: profileData.icon || undefined
    });
  }

  if (profileData.bio) {
    embed.setTitle(profileData.bio);
  }

  const fields = [];

  if (profileData.interests && profileData.interests.length > 0) {
    fields.push({
      name: '✨ Interests',
      value: profileData.interests.map(i => `⭐ ${i}`).join('\n'),
      inline: false
    });
  }

  if (profileData.stats) {
    const statsText = [
      profileData.stats.book > 0 ? `📖 Book: ${profileData.stats.book}` : null,
      profileData.stats.feedback > 0 ? `💬 Feedback: ${profileData.stats.feedback}` : null,
      profileData.stats.likes > 0 ? `❤️ Likes: ${profileData.stats.likes}` : null
    ].filter(Boolean).join(' | ');
    if (statsText) {
      fields.push({
        name: '📊 Stats',
        value: statsText,
        inline: false
      });
    }
  }

  if (profileData.rating) {
    fields.push({
      name: '⭐ Rating',
      value: `${profileData.rating}/5.0`,
      inline: false
    });
  }

  if (profileData.custom_fields && profileData.custom_fields.length > 0) {
    profileData.custom_fields.forEach(field => {
      fields.push({
        name: field.name,
        value: field.value,
        inline: false
      });
    });
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (profileData.images[currentImageIndex]) {
    embed.setImage(profileData.images[currentImageIndex]);
  }

  embed.setFooter({
    text: `${currentImageIndex + 1}/${totalImages}`
  });

  return embed;
}

function buildNavigationButtons(shortcutName, totalImages, currentPage) {
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalImages - 1;

  const prevBtn = new ButtonBuilder()
    .setCustomId(`profile_prev_${shortcutName}_${currentPage}`)
    .setLabel('<<')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(isFirstPage);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`profile_next_${shortcutName}_${currentPage}`)
    .setLabel('>>')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(isLastPage);

  const row = new ActionRowBuilder()
    .addComponents(prevBtn, nextBtn);

  return row;
}

module.exports = {
  buildProfileEmbed,
  buildNavigationButtons
};
