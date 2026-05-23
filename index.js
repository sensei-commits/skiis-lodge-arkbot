const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.ARKBOT_WEBHOOK_SECRET;
const ARK_GENERAL_CHANNEL_ID = '1173768088089534596';

if (!DISCORD_BOT_TOKEN || !WEBHOOK_URL || !WEBHOOK_SECRET) {
  console.error('Missing required environment variables!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ ArkBot is online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Only watch #ark-general, ignore bots
  if (message.channel.id !== ARK_GENERAL_CHANNEL_ID) return;
  if (message.author.bot) return;

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        id: message.id,
        channel_id: message.channel.id,
        content: message.content,
        author: {
          id: message.author.id,
          username: message.author.username,
          global_name: message.author.globalName,
          bot: message.author.bot,
        },
      }),
    });

    const result = await response.json();
    console.log(`[${message.author.username}]: "${message.content}" → ${result.action || result.skipped || 'ok'}`);
  } catch (err) {
    console.error('Failed to forward message to webhook:', err.message);
  }
});

client.login(DISCORD_BOT_TOKEN);
