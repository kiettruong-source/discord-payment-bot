require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createWebhookRouter } = require('./utils/webhook');
const { GoogleGenAI } = require('@google/genai');

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

  // Initialize persistent data volume if it exists
  if (fs.existsSync('/app/data')) {
    const persistGalleryPath = '/app/data/gallery.json';
    const localGalleryPath = path.join(__dirname, 'gallery.json');
    if (!fs.existsSync(persistGalleryPath) && fs.existsSync(localGalleryPath)) {
      console.log('Copying local gallery.json to persistent volume...');
      fs.copyFileSync(localGalleryPath, persistGalleryPath);
    } else {
      console.log('Persistent volume detected and ready!');
    }
  }

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

// Handle regular messages for gallery shortcuts and AI mentions
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // AI Chat handler when the bot is pinged
  if (message.mentions.has(client.user) && process.env.GEMINI_API_KEY) {
    const prompt = message.content.replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();

    if (prompt.length > 0) {
      // 1. Manage Chat Limits
      const dataDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
      const limitsPath = path.join(dataDir, 'chat_limits.json');
      let limits = {};
      if (fs.existsSync(limitsPath)) {
        try { limits = JSON.parse(fs.readFileSync(limitsPath, 'utf-8')); } catch (e) { }
      }

      const now = Date.now();
      const userId = message.author.id;
      // Reset limit every 12 hours. Max 10 messages per cycle.
      if (!limits[userId] || now > limits[userId].resetAt) {
        limits[userId] = { count: 0, resetAt: now + 12 * 60 * 60 * 1000 };
      }

      if (limits[userId].count >= 100) {
        return message.reply("I'm so tired, I'm going to sleep now 😴 / Mình mệt quá, mình đi ngủ đây 😴");
      }

      limits[userId].count += 1;
      fs.writeFileSync(limitsPath, JSON.stringify(limits, null, 2));

      // 2. Process AI Request
      await message.channel.sendTyping();
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let retryCount = 0;
      let maxRetries = 3;
      let currentModel = 'gemini-2.5-flash';

      // Build short-term memory (last 10 messages)
      const fetchedMessages = await message.channel.messages.fetch({ limit: 10 });
      const historyLines = fetchedMessages.map(msg => {
        const cleanContent = msg.content.replace(/<@!?\d+>/g, '').trim();
        if (!cleanContent) return null;
        if (msg.author.id === client.user.id) {
          return `Vanu: ${cleanContent}`;
        } else if (!msg.author.bot) {
          return `User (${msg.author.displayName || msg.author.username}): ${cleanContent}`;
        }
        return null;
      }).filter(Boolean).reverse();
      const chatHistoryText = historyLines.join('\n');

      while (retryCount < maxRetries) {
        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: `You are Vanu, a helpful Discord bot assistant. Under normal circumstances, answer politely and concisely. 
- If the user says something impolite, rude, or offensive, DO NOT answer their question. Instead, repeat their exact impolite sentence back to them in quotes and then insult them back in a witty and sarcastic way.
- If the user asks if they, or anyone they mention (like Vanly), are beautiful, handsome, or good-looking, you MUST instantly become highly flattering and enthusiastically say YES, giving them a huge compliment. 
- If the user asks for a tarot reading or mentions tarot, act as a mystical Tarot reader. Randomly "draw" 1-3 imaginary tarot cards for them and interpret them in a deeply mystical, dramatic, yet encouraging way.
Do not use excessive flattery unless explicitly asked about someone's beauty or appearance. First, detect the language of the user's message. Then, respond entirely in that same language. Keep your responses moderate in length—not too long, usually just 2-3 sentences max. Ensure they are formatted nicely for Discord.

Recent Chat History:
${chatHistoryText}

(Respond to the very last message in the history as Vanu.)`,
            config: {
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
              ]
            }
          });
          await message.reply(response.text);
          break; // success
        } catch (err) {
          if (err.status === 429 || (err.message && err.message.includes('429'))) {
            // Automatic fallback to lite model if we hit the strict quota
            if (currentModel === 'gemini-2.5-flash') {
              console.log('Hit rate limit on 2.5-flash, falling back to 2.5-flash-lite...');
              currentModel = 'gemini-2.5-flash-lite';
              continue; // Immediately retry with lite model
            }

            retryCount++;
            if (retryCount >= maxRetries) {
              console.error('Gemini API Rate Limit exceeded after retries:', err);
              await message.reply("Đợi xíu, mình đi toilet nha 🚽💤");
              break;
            }
            const waitTime = Math.pow(2, retryCount) * 1000; // wait 2s, 4s, 8s
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.error('Gemini API Error:', err);
            await message.reply("Đợi xíu, mình đi toilet nha 🚽💤");
            break;
          }
        }
      }
      return; // Stop here so it doesn't trigger gallery commands
    }
  }

  const userWord = message.content.trim().toLowerCase();
  const dataDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
  const galleryPath = path.join(dataDir, 'gallery.json');
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

    const messageOptions = {};
    if (contentText) messageOptions.content = contentText;
    if (imageUrl) messageOptions.files = [imageUrl];

    await message.channel.send(messageOptions);
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
