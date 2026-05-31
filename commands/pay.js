const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { generateVietQR } = require('../utils/vietqr');
const { generatePaymentId, formatVND } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Generate a VietQR payment request for a custom amount')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Amount in VND (e.g. 150000)')
        .setRequired(true)
        .setMinValue(1000)
    )
    .addStringOption(opt =>
      opt.setName('note')
        .setDescription('Optional extra note in the transfer description')
        .setRequired(false)
    )
    .addUserOption(opt =>
      opt.setName('customer')
        .setDescription('Tag the customer (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const amount   = interaction.options.getInteger('amount');
    const note     = interaction.options.getString('note') || '';
    const customer = interaction.options.getUser('customer');

    const paymentId  = generatePaymentId();
    const description = `${paymentId}${note ? ' ' + note : ''}`.substring(0, 50); // max 50 chars

    try {
      const { qrDataURL } = await generateVietQR({
        bankId:      process.env.BANK_ID,
        accountNo:   process.env.BANK_ACCOUNT_NO,
        accountName: process.env.BANK_ACCOUNT_NAME,
        amount,
        description,
      });

      // Convert base64 data URL → Buffer for Discord attachment
      const base64 = qrDataURL.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64, 'base64');
      const attachment = new AttachmentBuilder(imgBuffer, { name: `${paymentId}.png` });

      const embed = new EmbedBuilder()
        .setTitle('💳 Payment Request')
        .setColor(0x00b96b)
        .setThumbnail(`attachment://${paymentId}.png`)
        .setImage(`attachment://${paymentId}.png`)
        .addFields(
          { name: '🏦 Bank',           value: process.env.BANK_NAME || 'N/A',         inline: true },
          { name: '👤 Account Name',   value: process.env.BANK_ACCOUNT_NAME || 'N/A', inline: true },
          { name: '💰 Amount',         value: `**${formatVND(amount)}**`,              inline: true },
        )
        .setFooter({ text: 'Scan QR with any Vietnamese banking app • MoMo • ZaloPay' })
        .setTimestamp();

      if (customer) {
        embed.setDescription(`Payment for ${customer}`);
      }

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('QR generation failed:', err.message);
      await interaction.editReply(`❌ Failed to generate QR: ${err.message}`);
    }
  },
};
