const { SlashCommandBuilder } = require('discord.js');
const { claimDaily, DAILY_AMOUNT } = require('../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Nhận coin miễn phí mỗi 24h / Claim free coins every 24h'),

  async execute(interaction) {
    const res = claimDaily(interaction.user.id, Date.now());
    if (res.ok) {
      return interaction.reply({
        content: `✅ Bạn nhận **${res.amount}** coin! Số dư: **${res.newBalance}**. / Claimed ${res.amount} coins! Balance: ${res.newBalance}.`,
        ephemeral: true,
      });
    }
    const totalMin = Math.ceil(res.remainingMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return interaction.reply({
      content: `⏳ Bạn đã nhận rồi. Quay lại sau **${h}h ${m}m**. / Already claimed — come back in ${h}h ${m}m.`,
      ephemeral: true,
    });
  },
};
