const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET;

// All channels Helena monitors — update IDs here if channels change
const MONITORED_CHANNEL_IDS = [
  '1173768088089534596', // #ark-general
  '1276128810609152030', // #staff-chat
  '1274810759485980704', // #admin-stuff
  '1390284806650331146', // #support-ticket
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`✅ Helena is online as ${client.user.tag}`);
  console.log(`📡 Monitoring ${MONITORED_CHANNEL_IDS.length} channels`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!MONITORED_CHANNEL_IDS.includes(message.channel.id)) return;

  console.log(`📨 [#${message.channel.name}] ${message.author.username}: "${message.content}"`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        type: 'message',
        id: message.id,
        channel_id: message.channel.id,
        channel_name: message.channel.name,
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
    console.log(`✅ Webhook response [${message.channel.name}]:`, result);
  } catch (err) {
    console.error(`❌ Failed to forward message from #${message.channel.name}:`, err.message);
  }
});

client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member joined: ${member.user.username}`);
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        type: 'member_join',
        user: {
          id: member.user.id,
          username: member.user.username,
          global_name: member.user.globalName,
        },
      }),
    });
    const result = await response.json();
    console.log(`✅ Member join forwarded:`, result);
  } catch (err) {
    console.error('❌ Failed to forward member join:', err.message);
  }
});

client.login(DISCORD_BOT_TOKEN);
