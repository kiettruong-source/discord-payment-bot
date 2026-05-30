const express = require('express');
const crypto  = require('crypto');

const router = express.Router();

/**
 * Casso sends a POST to /webhook/casso whenever a transaction arrives.
 * Payload shape (Casso v2):
 * {
 *   error: 0,
 *   data: {
 *     id: 12345,
 *     tid: "...",
 *     description: "PAY-3F9A12CC NIGHT 3H",
 *     amount: 90000,
 *     cusumBalance: 123456789,
 *     bookingDate: "2024-01-01 12:00:00",
 *     paymentChannel: "MB_BANK",
 *     bankSubAccId: "0123456789",
 *     corresponsiveName: "NGUYEN VAN B",
 *     corresponsiveAccount: "...",
 *     corresponsiveBankId: "...",
 *     corresponsiveBankName: "...",
 *     virtualAccount: null,
 *     virtualAccountName: null
 *   }
 * }
 */
function createWebhookRouter(client) {
  // Verify Casso's secret token (set in Casso dashboard → Webhook → Secure Token)
  function verifySecret(req) {
    const cassoSecret = process.env.CASSO_WEBHOOK_SECRET;
    if (!cassoSecret) return true; // skip check if not configured

    const incoming = req.headers['secure-token'] || req.headers['x-secure-token'] || '';
    return incoming === cassoSecret;
  }

  router.post('/webhook/casso', express.json(), async (req, res) => {
    // Always respond 200 quickly so Casso doesn't retry
    res.status(200).json({ error: 0, message: 'OK' });

    // ⏸️ Feature paused: Returning early to disable payment notifications for now.
    return;

    if (!verifySecret(req)) {
      console.warn('⚠️  Casso webhook: invalid secret token, ignoring.');
      return;
    }

    const body = req.body;

    // Casso can send single transaction or array
    const transactions = Array.isArray(body.data) ? body.data : [body.data];

    for (const tx of transactions) {
      if (!tx || tx.amount <= 0) continue;
      await handleTransaction(client, tx);
    }
  });

  return router;
}

async function handleTransaction(client, tx) {
  try {
    const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
    if (!notifyChannelId) {
      console.warn('⚠️  NOTIFY_CHANNEL_ID not set — cannot send Discord notification.');
      return;
    }

    const channel = await client.channels.fetch(notifyChannelId);
    if (!channel) {
      console.warn('⚠️  Could not find Discord channel:', notifyChannelId);
      return;
    }

    const { EmbedBuilder } = require('discord.js');
    const { formatVND }    = require('./helpers');

    // Try to extract payment ID from description (e.g. "PAY-3F9A12CC ...")
    const desc       = (tx.description || '').trim();
    const payIdMatch = desc.match(/PAY-[A-F0-9]{8}/i);
    const payId      = payIdMatch ? payIdMatch[0].toUpperCase() : null;

    const embed = new EmbedBuilder()
      .setTitle('✅ Payment Received!')
      .setColor(0x00b96b)
      .addFields(
        {
          name:   '💰 Amount',
          value:  `**${formatVND(tx.amount)}**`,
          inline: true,
        },
        {
          name:   '🆔 Payment ID',
          value:  payId ? `\`${payId}\`` : '`—`',
          inline: true,
        },
        {
          name:   '👤 From',
          value:  tx.corresponsiveName || 'Unknown',
          inline: true,
        },
        {
          name:   '🏦 Their Bank',
          value:  tx.corresponsiveBankName || 'Unknown',
          inline: true,
        },
        {
          name:   '📝 Transfer Note',
          value:  `\`${desc || '(empty)'}\``,
          inline: false,
        },
        {
          name:   '🕐 Time',
          value:  tx.bookingDate || new Date().toISOString(),
          inline: true,
        },
      )
      .setFooter({ text: `Account: ${tx.bankSubAccId || process.env.BANK_ACCOUNT_NO}` })
      .setTimestamp();

    // Add warning if no PAY- ID matched (manual transfer, no booking reference)
    if (!payId) {
      embed.setDescription('⚠️ No payment ID found in transfer note — may be an untracked transfer.');
      embed.setColor(0xf4a523);
    }

    await channel.send({ embeds: [embed] });
    console.log(`✅ Notified Discord: ${formatVND(tx.amount)} — ${desc}`);
  } catch (err) {
    console.error('❌ Failed to send Discord notification:', err.message);
  }
}

module.exports = { createWebhookRouter };
