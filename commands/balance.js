const { SlashCommandBuilder } = require('discord.js');
const { getBalance } = require('../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Xem số dư coin của bạn / Check your coin balance'),

  async execute(interaction) {
    const coins = getBalance(interaction.user.id);
    await interaction.reply({
      content: `💰 Số dư của bạn: **${coins}** coin / Your balance: **${coins}** coin`,
      ephemeral: true,
    });
  },
};
