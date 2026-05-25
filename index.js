const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const http = require('http');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET;

// ── Startup validation ─────────────────────────────────────────────────────────
if (!DISCORD_BOT_TOKEN) {
  console.error('❌ FATAL: DISCORD_BOT_TOKEN is not set. Exiting.');
  process.exit(1);
}
if (!WEBHOOK_URL) {
  console.error('❌ FATAL: ARKBOT_WEBHOOK_URL is not set. Exiting.');
  process.exit(1);
}
console.log(`✅ Config OK — Webhook URL: ${WEBHOOK_URL}`);

// ── Keepalive HTTP server (prevents Railway from killing idle containers) ──────
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Helena Walker is alive 🦕');
}).listen(PORT, () => {
  console.log(`🌐 Keepalive server running on port ${PORT}`);
});

// ── Monitored channels ─────────────────────────────────────────────────────────
const MONITORED_CHANNEL_IDS = [
  '1173768088089534596', // #ark-general
  '1276128810609152030', // #staff-chat
  '1274810759485980704', // #admin-stuff
  '1390284806650331146', // #support-ticket
];

// ── Discord client ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`✅ Helena Walker is online as ${client.user.tag}`);
  console.log(`📡 Monitoring ${MONITORED_CHANNEL_IDS.length} channels`);
});

// ── Forward message to webhook ─────────────────────────────────────────────────
async function forwardToWebhook(payload) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET || '',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Webhook returned ${response.status}: ${text}`);
      return;
    }
    const result = await response.json();
    console.log(`✅ Forwarded [${payload.channel_name || payload.type}]:`, JSON.stringify(result));
  } catch (err) {
    console.error(`❌ Webhook fetch failed:`, err.message);
  }
}

// ── Message handler ────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!MONITORED_CHANNEL_IDS.includes(message.channel.id)) return;

  console.log(`📨 [#${message.channel.name}] ${message.author.username}: "${message.content.substring(0, 80)}"`);

  await forwardToWebhook({
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
  });
});

// ── Member join handler ────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.username}`);
  await forwardToWebhook({
    type: 'member_join',
    user: {
      id: member.user.id,
      username: member.user.username,
      global_name: member.user.globalName,
    },
  });
});

// ── Error handlers (prevent crash on unhandled errors) ────────────────────────
client.on('error', (err) => {
  console.error('❌ Discord client error:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err.message);
});

// ── Login ──────────────────────────────────────────────────────────────────────
console.log('🔄 Connecting to Discord...');
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error('❌ FATAL: Discord login failed:', err.message);
  process.exit(1);
});
