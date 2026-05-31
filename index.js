require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createWebhookRouter } = require('./utils/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// Register slash commands on startup
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered globally.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
});

// Handle regular messages for gallery shortcuts
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userWord = message.content.trim().toLowerCase();
  const galleryPath = path.join(__dirname, 'gallery.json');
  let gallery = {};
  if (fs.existsSync(galleryPath)) {
    try {
      gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse gallery.json', e);
    }
  }

  if (gallery[userWord]) {
    const itemData = gallery[userWord];
    let imageUrl = '';
    let targetUserId = null;
    let customText = null;

    if (typeof itemData === 'object' && itemData !== null) {
      imageUrl = itemData.url;
      customText = itemData.custom_text || null;
      // Handle new target_user_id and fallback to old should_ping
      if (itemData.target_user_id) {
        targetUserId = itemData.target_user_id;
      } else if (itemData.should_ping) {
        targetUserId = message.author.id;
      }
    } else {
      imageUrl = itemData;
    }

    let contentText = null;
    if (customText) {
      contentText = targetUserId ? `<@${targetUserId}> ${customText}` : customText;
    } else if (targetUserId) {
      contentText = `Hey <@${targetUserId}>, here you go!`;
    }
    
    // Append the image URL so Discord unfurls it as a large native image
    contentText = contentText ? `${contentText}\n${imageUrl}` : imageUrl;

    await message.channel.send({ content: contentText });
  }
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Role check: user must have "support" role
  const member = interaction.member;
  const hasRole = member.roles.cache.some(
    r => r.name.toLowerCase() === (process.env.SUPPORT_ROLE_NAME || 'support').toLowerCase()
  );

  if (!hasRole) {
    return interaction.reply({
      content: '❌ You need the **Support** role to use this command.',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing ${interaction.commandName}:`, err);
    const msg = { content: '❌ An error occurred while executing this command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Start Express Server for Webhooks
app.use('/', createWebhookRouter(client));

app.listen(PORT, () => {
  console.log(`🚀 Webhook server listening on port ${PORT}`);
});
