const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { generateVietQR } = require('../utils/vietqr');
const { generatePaymentId, formatVND, calcBookingAmount } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('booking')
    .setDescription('Generate a VietQR payment for a time booking (day/night rate × hours)')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Booking type')
        .setRequired(true)
        .addChoices(
          { name: `🌞 Day  (${process.env.RATE_DAY   || '25,000'} ₫/hr)`, value: 'day'   },
          { name: `🌙 Night (${process.env.RATE_NIGHT || '30,000'} ₫/hr)`, value: 'night' },
        )
    )
    .addNumberOption(opt =>
      opt.setName('hours')
        .setDescription('Number of hours (e.g. 1.5 for 1h30m)')
        .setRequired(true)
        .setMinValue(0.5)
    )
    .addUserOption(opt =>
      opt.setName('customer')
        .setDescription('Tag the customer (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('note')
        .setDescription('Extra note in transfer description')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const type     = interaction.options.getString('type');
    const hours    = interaction.options.getNumber('hours');
    const customer = interaction.options.getUser('customer');
    const note     = interaction.options.getString('note') || '';

    const amount     = calcBookingAmount(type, hours);
    const paymentId  = generatePaymentId();
    const typeLabel  = type === 'day' ? '🌞 Day' : '🌙 Night';
    const rateLabel  = formatVND(type === 'day'
      ? parseInt(process.env.RATE_DAY   || '25000')
      : parseInt(process.env.RATE_NIGHT || '30000'));

    const description = `${paymentId} ${type.toUpperCase()} ${hours}H${note ? ' ' + note : ''}`.substring(0, 50);

    try {
      const { qrDataURL } = await generateVietQR({
        bankId:      process.env.BANK_ID,
        accountNo:   process.env.BANK_ACCOUNT_NO,
        accountName: process.env.BANK_ACCOUNT_NAME,
        amount,
        description,
      });

      const base64    = qrDataURL.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64, 'base64');
      const attachment = new AttachmentBuilder(imgBuffer, { name: `${paymentId}.png` });

      const embed = new EmbedBuilder()
        .setTitle('🕐 Booking Payment Request')
        .setColor(type === 'day' ? 0xf4a523 : 0x5865f2)
        .setImage(`attachment://${paymentId}.png`)
        .addFields(
          { name: '⏰ Type',          value: typeLabel,                                inline: true  },
          { name: '📊 Rate',           value: `${rateLabel}/hr`,                        inline: true  },
          { name: '💰 Total Amount',   value: `**${formatVND(amount)}**`,               inline: true  },
          { name: '🏦 Bank',           value: process.env.BANK_NAME || 'N/A',           inline: true  },
          { name: '👤 Account Name',   value: process.env.BANK_ACCOUNT_NAME || 'N/A',   inline: true  },
        )
        .setFooter({ text: 'Scan QR with any Vietnamese banking app • MoMo • ZaloPay' })
        .setTimestamp();

      if (customer) embed.setDescription(`Booking for ${customer}`);

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('Booking QR failed:', err.message);
      await interaction.editReply(`❌ Failed to generate booking QR: ${err.message}`);
    }
  },
};
