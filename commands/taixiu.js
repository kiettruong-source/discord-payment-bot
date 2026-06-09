const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, addCoins, MIN_BET } = require('../utils/economy');
const { fetchGifAttachment } = require('../utils/gifAttachment');

// Direct .gif of rolling dice. Override with env TAIXIU_GIF_URL. Must end in .gif.
const DEFAULT_DICE_GIF = 'https://media.tenor.com/0S5MzTDr52AAAAAM/dice-roll-mod.gif';
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('taixiu')
    .setDescription('Chơi Tài Xỉu — đặt cược 3 viên xúc xắc / Play Tài Xỉu (over-under dice)')
    .addStringOption((o) =>
      o.setName('cua')
        .setDescription('Chọn cửa: Tài (11-17) hoặc Xỉu (4-10) / Choose side')
        .setRequired(true)
        .addChoices(
          { name: 'Tài (11-17)', value: 'tai' },
          { name: 'Xỉu (4-10)', value: 'xiu' },
        ))
    .addIntegerOption((o) =>
      o.setName('bet')
        .setDescription('Số coin đặt cược (tối thiểu 10) / Amount to bet (min 10)')
        .setRequired(true)
        .setMinValue(MIN_BET)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const side = interaction.options.getString('cua');
    const bet = interaction.options.getInteger('bet');

    // --- Validation (before defer) ---
    if (bet < MIN_BET) {
      return interaction.reply({ content: `❌ Cược tối thiểu là ${MIN_BET} coin. / Minimum bet is ${MIN_BET}.`, ephemeral: true });
    }
    const balance = getBalance(userId);
    if (balance <= 0) {
      return interaction.reply({ content: '❌ Bạn hết coin rồi! Dùng `/daily` để nhận coin miễn phí. / You\'re out of coins — use `/daily`.', ephemeral: true });
    }
    if (bet > balance) {
      return interaction.reply({ content: `❌ Không đủ coin. Số dư: ${balance}. / Insufficient balance: ${balance}.`, ephemeral: true });
    }

    // Deduct the stake up front so concurrent rolls can't double-spend.
    const afterDeduct = addCoins(userId, -bet);

    await interaction.deferReply();

    // Rolling animation: show a dice GIF (if available) then reveal after ~2s.
    const gif = await fetchGifAttachment(process.env.TAIXIU_GIF_URL || DEFAULT_DICE_GIF, 'dice.gif');
    const sideLabel = side === 'tai' ? 'Tài' : 'Xỉu';
    const rollingEmbed = new EmbedBuilder()
      .setColor('#f1c40f')
      .setTitle('🎲 Tài Xỉu')
      .setDescription(`🎲 Đang lắc... / Rolling...\nCửa: **${sideLabel}** · Cược: **${bet}** coin`);
    if (gif) rollingEmbed.setImage('attachment://dice.gif');

    await interaction.editReply({ embeds: [rollingEmbed], files: gif ? [gif] : [] });
    await delay(2000);

    // Roll 3 dice and classify (triple/Bão first, then range)
    const d = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 6));
    const total = d[0] + d[1] + d[2];
    const isTriple = d[0] === d[1] && d[1] === d[2];
    const result = total >= 11 ? 'tai' : 'xiu';
    const won = !isTriple && result === side;

    // Settle: stake already removed; pay 2x on a win.
    let newBalance = afterDeduct;
    if (won) newBalance = addCoins(userId, bet * 2);

    const resultLabel = isTriple ? `Bão 💥 (${d[0]})` : result === 'tai' ? 'Tài (Over)' : 'Xỉu (Under)';
    const outcomeLine = won
      ? `🎉 Bạn THẮNG **+${bet}** coin! / You won +${bet}!`
      : `💀 Bạn THUA **-${bet}** coin. / You lost -${bet}.`;

    const revealEmbed = new EmbedBuilder()
      .setColor(won ? '#2ecc71' : '#e74c3c')
      .setTitle('🎲 Tài Xỉu')
      .setDescription(
        `# ${d.map((v) => FACES[v - 1]).join('  ')}\n` +
        `**Tổng / Total: ${total}** → **${resultLabel}**\n` +
        `Cửa của bạn / Your bet: **${sideLabel}**\n\n` +
        `${outcomeLine}\n` +
        `💰 Số dư mới / New balance: **${newBalance}** coin`
      );

    // Clear the GIF on reveal (both files and attachments must be emptied).
    await interaction.editReply({ embeds: [revealEmbed], files: [], attachments: [] });
  },
};
