const { EmbedBuilder } = require('discord.js');
const { getBalance, addCoins, MIN_BET } = require('./economy');
const { fetchGifAttachment } = require('./gifAttachment');

// Direct .gif of rolling dice. Override with env TAIXIU_GIF_URL. Must end in .gif.
const DEFAULT_DICE_GIF = 'https://media.tenor.com/0S5MzTDr52AAAAAM/dice-roll-mod.gif';
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function parseSide(s) {
  if (!s) return null;
  s = s.toLowerCase();
  if (['tai', 'tài', 't', 'over', 'big', 'lớn'].includes(s)) return 'tai';
  if (['xiu', 'xỉu', 'x', 'under', 'small', 'nhỏ'].includes(s)) return 'xiu';
  return null;
}

// Handle a "vtaixiu <tài|xỉu> <bet>" text command.
async function playTaixiuText(message, args) {
  const userId = message.author.id;
  const side = parseSide(args[0]);
  const bet = parseInt(args[1], 10);

  if (!side || !Number.isFinite(bet)) {
    return message.reply('🎲 Cách dùng: `vtaixiu <tài|xỉu> <số coin>` — VD: `vtaixiu tài 100`');
  }
  if (bet < MIN_BET) {
    return message.reply(`❌ Cược tối thiểu là ${MIN_BET} coin. / Minimum bet is ${MIN_BET}.`);
  }
  const balance = getBalance(userId);
  if (balance <= 0) {
    return message.reply('❌ Bạn hết coin rồi! Gõ `vdaily` để nhận coin miễn phí. / Out of coins — type `vdaily`.');
  }
  if (bet > balance) {
    return message.reply(`❌ Không đủ coin. Số dư: ${balance}. / Insufficient balance: ${balance}.`);
  }

  // Deduct the stake up front so concurrent rolls can't double-spend.
  const afterDeduct = addCoins(userId, -bet);
  const sideLabel = side === 'tai' ? 'Tài' : 'Xỉu';

  // Rolling animation
  const gif = await fetchGifAttachment(process.env.TAIXIU_GIF_URL || DEFAULT_DICE_GIF, 'dice.gif');
  const rollingEmbed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle('🎲 Tài Xỉu')
    .setDescription(`🎲 Đang lắc... / Rolling...\nCửa: **${sideLabel}** · Cược: **${bet}** coin`);
  if (gif) rollingEmbed.setImage('attachment://dice.gif');

  const sent = await message.reply({ embeds: [rollingEmbed], files: gif ? [gif] : [] });
  await delay(2000);

  // Roll 3 dice, classify (triple/Bão first, then range)
  const d = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 6));
  const total = d[0] + d[1] + d[2];
  const isTriple = d[0] === d[1] && d[1] === d[2];
  const result = total >= 11 ? 'tai' : 'xiu';
  const won = !isTriple && result === side;

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

  await sent.edit({ embeds: [revealEmbed], files: [], attachments: [] });
}

module.exports = { playTaixiuText };
