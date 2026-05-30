const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatVND } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rates')
    .setDescription('Show current booking rates (day & night)'),

  async execute(interaction) {
    const dayRate   = parseInt(process.env.RATE_DAY   || '25000');
    const nightRate = parseInt(process.env.RATE_NIGHT || '30000');

    const embed = new EmbedBuilder()
      .setTitle('📋 Current Booking Rates')
      .setColor(0x00b96b)
      .addFields(
        { name: '🌞 Day Rate',   value: `${formatVND(dayRate)} / hour`,   inline: true },
        { name: '🌙 Night Rate', value: `${formatVND(nightRate)} / hour`, inline: true },
      )
      .addFields(
        {
          name: '📌 Example',
          value: [
            `• 2 hrs (day)   → **${formatVND(dayRate * 2)}**`,
            `• 3 hrs (night) → **${formatVND(nightRate * 3)}**`,
            `• 1.5 hrs (day) → **${formatVND(dayRate * 1.5)}**`,
          ].join('\n'),
        }
      )
      .setFooter({ text: 'Use /booking to generate a QR payment' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
