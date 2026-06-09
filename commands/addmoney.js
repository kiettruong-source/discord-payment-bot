const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { addCoins, getBalance, OWNER_IDS } = require('../utils/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addmoney')
    .setDescription('(Admin/Owner) Cộng coin cho một người chơi / Grant coins to a user')
    .addUserOption((o) =>
      o.setName('user')
        .setDescription('Người chơi nhận coin / The user to grant coins to')
        .setRequired(true))
    .addIntegerOption((o) =>
      o.setName('amount')
        .setDescription('Số coin (số âm để trừ) / Amount (negative to deduct)')
        .setRequired(true)),

  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isOwner = OWNER_IDS.includes(interaction.user.id);
    if (!isAdmin && !isOwner) {
      return interaction.reply({ content: '❌ Chỉ admin hoặc chủ bot mới dùng được. / Admin or owner only.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.bot) {
      return interaction.reply({ content: '❌ Không thể cộng coin cho bot. / Cannot give coins to a bot.', ephemeral: true });
    }
    if (amount === 0) {
      return interaction.reply({ content: 'ℹ️ Số coin phải khác 0. / Amount must be non-zero.', ephemeral: true });
    }

    const before = getBalance(target.id);
    const newBalance = addCoins(target.id, amount);
    const sign = amount > 0 ? `+${amount}` : `${amount}`;

    await interaction.reply({
      content: `✅ Đã cập nhật **${sign}** coin cho ${target} (${before} → **${newBalance}**). / Updated ${sign} coins for ${target.tag}.`,
    });
  },
};
