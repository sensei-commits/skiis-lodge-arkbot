const {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, Partials,
} = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const fetch     = require('node-fetch');
const http      = require('http');

// ── Secrets (injected by Railway env vars) ────────────────────────────────────
const DISCORD_BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL            = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET         = process.env.DISCORD_WEBHOOK_SECRET;
const ANTHROPIC_API_KEY      = process.env.ANTHROPIC_API_KEY;
const BATTLEMETRICS_API_KEY  = process.env.BATTLEMETRICS_API_KEY  || '';
const BATTLEMETRICS_ORG_ID   = process.env.BATTLEMETRICS_ORG_ID   || '';
const RCON_DEFAULT_PASSWORD  = process.env.RCON_DEFAULT_PASSWORD   || '';

// ── Config ────────────────────────────────────────────────────────────────────
const GUILD_ID                   = '636832636752625664';
const OPEN_TICKETS_CATEGORY_ID   = '1390284215870033971';
const ADMIN_LOGS_CHANNEL_ID      = '1275132184440868866';
const AI_CHANNEL_ID              = '1509173477725175928'; // #🤖・ai
const SUPPORT_TRIGGER_CHANNEL_ID = '1390284806650331146'; // #🎫︱support-ticket
const ROLES_CHANNEL_ID           = '1509816508291878972'; // #🎭︱get-roles
const ADMIN_CONSOLE_CHANNEL_ID   = '1509762780192837675'; // #🛠️・admin-console
const STAFF_CHAT_CHANNEL_ID      = '1509816635765293067'; // #🦑︱staff-chat
const POLLS_CHANNEL_ID           = '1509816572322250852'; // #🗳️︱ark-polls
const ADMIN_ROLE_ID              = '1242319080760467557';
const ARK_ADMIN_ROLE_ID          = '1242319323145166868';
const BOT_USER_ID                = '1507730299356708984';
const EVERYONE_ROLE_ID           = GUILD_ID;

// ── Colors ────────────────────────────────────────────────────────────────────
const COLORS = {
  orange: 0xFF6B1A,
  blue:   0x1A8CFF,
  purple: 0x7B2FBE,
  green:  0x2ECC71,
  red:    0xE74C3C,
};

// ── Map / Platform / Ticket data ──────────────────────────────────────────────
let MAPS = [
  { name: 'Island',      label: 'The Island',     emoji: '🏝️' },
  { name: 'Center',      label: 'The Center',     emoji: '🌀' },
  { name: 'Scorched',    label: 'Scorched Earth',  emoji: '🏜️' },
  { name: 'Forglar',     label: 'Forglar',         emoji: '🌊' },
  { name: 'Aberration',  label: 'Aberration',      emoji: '🌑' },
  { name: 'Club Ark',    label: 'Club Ark',        emoji: '🎉' },
  { name: 'Svartlfheim', label: 'Svartlfheim',     emoji: '❄️' },
  { name: 'Astraeos',    label: 'Astraeos',        emoji: '🌌' },
  { name: 'Extinction',  label: 'Extinction',      emoji: '☄️' },
  { name: 'Volcano',     label: 'Volcano',         emoji: '🔥' },
  { name: 'Valguero',    label: 'Valguero',        emoji: '🦕' },
  { name: 'Lost Colony', label: 'Lost Colony',     emoji: '🚀' },
];

const PLATFORMS = [
  { name: 'Xbox',        emoji: '🎮', roleId: '1389939183312699523' },
  { name: 'PS5',         emoji: '🕹️', roleId: '1425828763538555004' },
  { name: 'Steam',       emoji: '💻', roleId: '1389218790067404800' },
  { name: 'Windows',     emoji: '🪟', roleId: '1386292242397925458' },
  { name: 'GeForce Now', emoji: '☁️', roleId: '1386292322060206101' },
];

let TICKET_CATEGORIES = [
  { name: 'General Help',   emoji: '❓', description: 'General questions or assistance',  key: 'general_help'  },
  { name: 'Admin Support',  emoji: '🛡️', description: 'Reach out to an admin directly',   key: 'admin_support' },
  { name: 'Player Report',  emoji: '🚨', description: 'Report a player for rule breaking', key: 'player_report' },
  { name: 'Tame/Item Loss', emoji: '🦖', description: 'Lost a tame or items? Let us know', key: 'tameitem_loss' },
  { name: 'Bug Report',     emoji: '🐛', description: 'Report a server or game bug',       key: 'bug_report'    },
];

// ── In-memory ticket state ────────────────────────────────────────────────────
const activeTickets = new Map();

// ── Per-channel AI conversation history ──────────────────────────────────────
const conversationHistory = {};

// ── Startup validation ────────────────────────────────────────────────────────
if (!DISCORD_BOT_TOKEN) { console.error('❌ FATAL: DISCORD_BOT_TOKEN not set'); process.exit(1); }
if (!WEBHOOK_URL)       { console.error('❌ FATAL: ARKBOT_WEBHOOK_URL not set'); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error('⚠️  WARNING: ANTHROPIC_API_KEY not set — AI brain disabled'); }
console.log(`✅ Config OK | Webhook: ${WEBHOOK_URL} | AI: ${ANTHROPIC_API_KEY ? 'enabled' : 'disabled'}`);

// ── Anthropic client ──────────────────────────────────────────────────────────
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// ── Keepalive ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('Helena Walker is alive 🦕'); })
  .listen(PORT, () => console.log(`🌐 Keepalive on port ${PORT}`));

// ── Discord REST helper ───────────────────────────────────────────────────────
async function dREST(method, path, body) {
  try {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) { console.error(`❌ Discord REST ${method} ${path} → ${res.status}:`, JSON.stringify(data).substring(0, 300)); return null; }
    return data;
  } catch (err) { console.error(`❌ Discord REST fetch error: ${err.message}`); return null; }
}

async function sendMessage(channelId, content) {
  return dREST('POST', `/channels/${channelId}/messages`, { content });
}

async function sendEmbed(channelId, embed, components) {
  return dREST('POST', `/channels/${channelId}/messages`, {
    embeds: [embed.toJSON()],
    ...(components ? { components: components.map(c => c.toJSON()) } : {}),
  });
}

async function deleteMessage(channelId, messageId) {
  return dREST('DELETE', `/channels/${channelId}/messages/${messageId}`);
}

// ── BattleMetrics helpers ─────────────────────────────────────────────────────
async function getBMServers() {
  if (!BATTLEMETRICS_API_KEY || !BATTLEMETRICS_ORG_ID) return [];
  try {
    const res  = await fetch(
      `https://api.battlemetrics.com/servers?filter[organizations]=${BATTLEMETRICS_ORG_ID}&page[size]=25`,
      { headers: { Authorization: `Bearer ${BATTLEMETRICS_API_KEY}` } }
    );
    const json = await res.json();
    return json.data || [];
  } catch (err) { console.error('❌ BattleMetrics fetch error:', err.message); return []; }
}

// ── Helena AI brain ───────────────────────────────────────────────────────────
async function handleHelenaAI(message, guild) {
  if (!anthropic) {
    await message.channel.send('❌ AI brain is offline — `ANTHROPIC_API_KEY` not set in Railway env vars.');
    return;
  }

  const channelId = message.channel.id;
  if (!conversationHistory[channelId]) conversationHistory[channelId] = [];

  // Add user message
  conversationHistory[channelId].push({
    role: 'user',
    content: `[${message.member.displayName}]: ${message.content}`,
  });

  // Keep last 20 messages
  if (conversationHistory[channelId].length > 20) {
    conversationHistory[channelId] = conversationHistory[channelId].slice(-20);
  }

  // Build live server context
  const servers    = await getBMServers();
  const serverList = servers.length
    ? servers.map(s => `${s.attributes.name} — ${s.attributes.status} — ${s.attributes.players}/${s.attributes.maxPlayers} players`).join('\n')
    : 'BattleMetrics not configured or unavailable.';

  const systemPrompt = `You are Helena, the intelligent admin assistant for Skii's Lodge — an ARK Survival Ascended cluster Discord server. You are sharp, calm, and direct. You speak naturally like a knowledgeable team member, not a bot. You only respond in #admin-console and #staff-chat.

You assist admins with server management, player issues, RCON commands, polls, and cluster configuration. When an admin asks you to take action, respond naturally AND append a special action tag at the END of your message so the bot can parse and execute it:

[ACTION:action_name:param1:param2:...]

Available actions:
- [ACTION:broadcast:message] — Broadcast a message to all servers via RCON
- [ACTION:kick:playerName:reason] — Kick a player from all servers
- [ACTION:ban:playerName:reason] — Ban a player from all servers
- [ACTION:online] — Show live player counts across all servers
- [ACTION:rcon_all:command] — Send any RCON command to ALL servers
- [ACTION:rcon_one:serverName:command] — Send RCON to a specific server
- [ACTION:restart:serverName] — Schedule a restart for a specific server (5 min warning)
- [ACTION:restart_all] — Schedule restart for all servers (5 min warning)
- [ACTION:poll:question|option1|option2|option3:durationHours] — Post a poll to #ark-polls
- [ACTION:add_map:mapName:emoji] — Add a map to the cluster config
- [ACTION:remove_map:mapName] — Remove a map from the cluster config
- [ACTION:add_ticket_category:name:emoji:description] — Add a support ticket category
- [ACTION:remove_ticket_category:name] — Remove a support ticket category

Current cluster servers:
${serverList}

Current maps: ${MAPS.map(m => m.label).join(', ')}
Current ticket categories: ${TICKET_CATEGORIES.map(c => c.name).join(', ')}
Server admins: Skidogg, iNFAMOUS, Remi, Captain Rhynio

Rules: Never expose raw IPs, passwords, or tokens in your responses. If no action is needed, respond normally with no action tag. Always respond naturally first, action tag last.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationHistory[channelId],
    });

    const fullReply  = response.content[0].text;
    const cleanReply = fullReply.replace(/\[ACTION:[^\]]+\]/g, '').trim();
    const actions    = fullReply.match(/\[ACTION:[^\]]+\]/g) || [];

    // Add to history
    conversationHistory[channelId].push({ role: 'assistant', content: fullReply });

    // Send Helena's reply as embed
    await sendEmbed(message.channel.id,
      new EmbedBuilder()
        .setDescription(cleanReply)
        .setColor(COLORS.purple)
        .setAuthor({ name: 'Helena', iconURL: `https://cdn.discordapp.com/avatars/${BOT_USER_ID}/` })
        .setFooter({ text: 'Helena • Admin Console' })
        .setTimestamp()
    );

    // Execute any actions
    for (const actionStr of actions) {
      await executeAction(actionStr, message, guild);
    }

  } catch (err) {
    console.error('❌ Anthropic API error:', err.message);
    await message.channel.send('❌ I ran into an issue processing that. Please try again.');
  }
}

// ── Action executor ───────────────────────────────────────────────────────────
async function executeAction(actionStr, message, guild) {
  const inner  = actionStr.replace('[ACTION:', '').replace(']', '');
  const parts  = inner.split(':');
  const action = parts[0];

  console.log(`⚙️ Executing action: ${action} | params: ${parts.slice(1).join(', ')}`);

  switch (action) {

    case 'online': {
      const servers = await getBMServers();
      if (!servers.length) {
        await sendEmbed(message.channel.id, new EmbedBuilder().setTitle('🖥️ Server Status').setDescription('BattleMetrics not configured or unavailable.').setColor(COLORS.red));
        return;
      }
      const embed = new EmbedBuilder().setTitle('🖥️  CLUSTER STATUS').setColor(COLORS.blue).setFooter({ text: 'Helena • BattleMetrics' }).setTimestamp();
      let total = 0;
      for (const s of servers) {
        const a = s.attributes;
        const icon = a.status === 'online' ? '🟢' : '🔴';
        embed.addFields({ name: `${icon} ${a.name}`, value: `**${a.players}/${a.maxPlayers}** players`, inline: true });
        total += a.players || 0;
      }
      embed.setDescription(`**Total players online: ${total}**`);
      await sendEmbed(message.channel.id, embed);
      break;
    }

    case 'broadcast': {
      const msg = parts.slice(1).join(':');
      await sendEmbed(message.channel.id,
        new EmbedBuilder()
          .setTitle('📢  BROADCAST QUEUED')
          .setDescription(`**Message:** ${msg}\n\n⚠️ RCON not yet configured — add \`RCON_DEFAULT_PASSWORD\` to Railway env vars to enable live RCON commands.`)
          .setColor(COLORS.orange)
          .setFooter({ text: 'Helena • RCON' })
          .setTimestamp()
      );
      break;
    }

    case 'kick': {
      const playerName = parts[1];
      const reason     = parts.slice(2).join(':') || 'Kicked by admin';
      await sendEmbed(message.channel.id,
        new EmbedBuilder()
          .setTitle('👢  KICK LOGGED')
          .setDescription(`**Player:** ${playerName}\n**Reason:** ${reason}\n\n⚠️ RCON not yet configured — add \`RCON_DEFAULT_PASSWORD\` to Railway env vars to enable live kicks.`)
          .setColor(COLORS.orange)
          .setFooter({ text: 'Helena • RCON' })
          .setTimestamp()
      );
      // Log to admin-logs
      await sendMessage(ADMIN_LOGS_CHANNEL_ID,
        `👢 **[Kick Requested]** Player: **${playerName}** | Reason: ${reason} | Requested by <@${message.author.id}>`
      );
      break;
    }

    case 'ban': {
      const playerName = parts[1];
      const reason     = parts.slice(2).join(':') || 'Banned by admin';
      await sendEmbed(message.channel.id,
        new EmbedBuilder()
          .setTitle('🔨  BAN LOGGED')
          .setDescription(`**Player:** ${playerName}\n**Reason:** ${reason}\n\n⚠️ RCON not yet configured — add \`RCON_DEFAULT_PASSWORD\` to enable live bans.`)
          .setColor(COLORS.red)
          .setFooter({ text: 'Helena • RCON' })
          .setTimestamp()
      );
      await sendMessage(ADMIN_LOGS_CHANNEL_ID,
        `🔨 **[Ban Requested]** Player: **${playerName}** | Reason: ${reason} | Requested by <@${message.author.id}>`
      );
      break;
    }

    case 'rcon_all':
    case 'rcon_one':
    case 'restart':
    case 'restart_all': {
      const serverTarget = parts[1] || 'all';
      const command      = parts.slice(action === 'rcon_one' || action === 'restart' ? 2 : 1).join(':');
      await sendEmbed(message.channel.id,
        new EmbedBuilder()
          .setTitle(`⚙️  RCON — ${action === 'restart_all' ? 'ALL SERVERS' : serverTarget.toUpperCase()}`)
          .setDescription(`**Command:** \`${command || 'DoExit'}\`\n\n⚠️ RCON not yet configured — add \`RCON_DEFAULT_PASSWORD\` to Railway env vars to enable live RCON execution.`)
          .setColor(COLORS.blue)
          .setFooter({ text: 'Helena • RCON' })
          .setTimestamp()
      );
      break;
    }

    case 'poll': {
      const pollData    = parts[1];
      const durationHrs = parseInt(parts[2]) || 24;
      const pollParts   = pollData ? pollData.split('|') : [];
      const question    = pollParts[0];
      const answers     = pollParts.slice(1);

      if (!question || answers.length < 2) {
        await sendMessage(message.channel.id, '❌ Poll needs a question and at least 2 options.');
        return;
      }

      // Post poll as embed to #ark-polls (Discord native polls require specific API version)
      const pollEmbed = new EmbedBuilder()
        .setTitle(`📊  ${question}`)
        .setDescription(answers.map((a, i) => `${['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i] || `${i+1}.`} ${a}`).join('\n') + `\n\n⏱️ Duration: **${durationHrs} hours**`)
        .setColor(COLORS.blue)
        .setFooter({ text: 'Helena • Polls — React with the number to vote!' })
        .setTimestamp();

      await sendEmbed(POLLS_CHANNEL_ID, pollEmbed);
      await sendEmbed(message.channel.id,
        new EmbedBuilder()
          .setTitle('📊  POLL PUBLISHED')
          .setDescription(`**Question:** ${question}\n**Options:** ${answers.join(', ')}\n**Duration:** ${durationHrs} hours\n\nPosted to <#${POLLS_CHANNEL_ID}>`)
          .setColor(COLORS.green)
          .setFooter({ text: 'Helena • Polls' })
          .setTimestamp()
      );
      break;
    }

    case 'add_map': {
      const mapName  = parts[1];
      const mapEmoji = parts[2] || '🗺️';
      if (!MAPS.find(m => m.name === mapName || m.label === mapName)) {
        MAPS.push({ name: mapName, label: mapName, emoji: mapEmoji });
        await sendEmbed(message.channel.id,
          new EmbedBuilder().setTitle('✅  MAP ADDED').setDescription(`**${mapEmoji} ${mapName}** added to cluster config.\n\nRestart Helena to update the #get-roles channel.`).setColor(COLORS.green).setFooter({ text: 'Helena • Config' }).setTimestamp()
        );
      } else {
        await sendMessage(message.channel.id, `⚠️ **${mapName}** is already in the config.`);
      }
      break;
    }

    case 'remove_map': {
      const mapName = parts[1];
      const idx     = MAPS.findIndex(m => m.name === mapName || m.label === mapName);
      if (idx !== -1) {
        MAPS.splice(idx, 1);
        await sendEmbed(message.channel.id,
          new EmbedBuilder().setTitle('✅  MAP REMOVED').setDescription(`**${mapName}** removed from cluster config.\n\nRestart Helena to update the #get-roles channel.`).setColor(COLORS.orange).setFooter({ text: 'Helena • Config' }).setTimestamp()
        );
      } else {
        await sendMessage(message.channel.id, `⚠️ Could not find map **"${mapName}"** in the config.`);
      }
      break;
    }

    case 'add_ticket_category': {
      const catName  = parts[1];
      const catEmoji = parts[2] || '📋';
      const catDesc  = parts.slice(3).join(':') || 'Support category';
      const catKey   = catName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!TICKET_CATEGORIES.find(c => c.name === catName)) {
        TICKET_CATEGORIES.push({ name: catName, emoji: catEmoji, description: catDesc, key: catKey });
        await sendEmbed(message.channel.id,
          new EmbedBuilder().setTitle('✅  TICKET CATEGORY ADDED').setDescription(`**${catEmoji} ${catName}** added.\n\nRestart Helena to update the ticket panel.`).setColor(COLORS.green).setFooter({ text: 'Helena • Config' }).setTimestamp()
        );
      } else {
        await sendMessage(message.channel.id, `⚠️ Category **"${catName}"** already exists.`);
      }
      break;
    }

    case 'remove_ticket_category': {
      const catName = parts[1];
      const idx     = TICKET_CATEGORIES.findIndex(c => c.name === catName);
      if (idx !== -1) {
        TICKET_CATEGORIES.splice(idx, 1);
        await sendEmbed(message.channel.id,
          new EmbedBuilder().setTitle('✅  TICKET CATEGORY REMOVED').setDescription(`**${catName}** removed.\n\nRestart Helena to update the ticket panel.`).setColor(COLORS.orange).setFooter({ text: 'Helena • Config' }).setTimestamp()
        );
      } else {
        await sendMessage(message.channel.id, `⚠️ Could not find category **"${catName}"**.`);
      }
      break;
    }

    default:
      console.log(`⚠️ Unknown action: ${action}`);
  }
}

// ── Role embeds — post once to #get-roles ─────────────────────────────────────
async function ensureRoleEmbeds() {
  try {
    const msgs = await dREST('GET', `/channels/${ROLES_CHANNEL_ID}/messages?limit=20`);
    if (msgs && Array.isArray(msgs) && msgs.some(m => m.author.id === BOT_USER_ID)) {
      console.log('ℹ️  Role embeds already posted.'); return;
    }
  } catch { /* ignore */ }

  console.log('📋 Posting role embeds...');

  const mapEmbed = new EmbedBuilder()
    .setTitle('🗺️  SELECT YOUR MAP ROLES')
    .setDescription('Select the maps you play on to receive relevant pings and updates.\nYou can select multiple maps!')
    .setColor(COLORS.blue).setFooter({ text: 'Helena • Skii\'s Lodge' }).setTimestamp();

  const mapMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('map_roles').setPlaceholder('🗺️ Select your maps...')
      .setMinValues(1).setMaxValues(MAPS.length)
      .addOptions(MAPS.map(m => ({ label: m.label, value: m.name, emoji: m.emoji })))
  );

  await dREST('POST', `/channels/${ROLES_CHANNEL_ID}/messages`, { embeds: [mapEmbed.toJSON()], components: [mapMenu.toJSON()] });

  const platformEmbed = new EmbedBuilder()
    .setTitle('🎮  SELECT YOUR PLATFORM ROLE')
    .setDescription('Let us know what platform you play ARK on!')
    .setColor(COLORS.orange).setFooter({ text: 'Helena • Skii\'s Lodge' }).setTimestamp();

  const platformMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('platform_roles').setPlaceholder('🎮 Select your platform...')
      .setMinValues(1).setMaxValues(1)
      .addOptions(PLATFORMS.map(p => ({ label: p.name, value: p.name, emoji: p.emoji })))
  );

  await dREST('POST', `/channels/${ROLES_CHANNEL_ID}/messages`, { embeds: [platformEmbed.toJSON()], components: [platformMenu.toJSON()] });
  console.log('✅ Role embeds posted!');
}

// ── Ticket panel — post once to #support-ticket ───────────────────────────────
async function ensureTicketPanel() {
  try {
    const msgs = await dREST('GET', `/channels/${SUPPORT_TRIGGER_CHANNEL_ID}/messages?limit=20`);
    if (msgs && Array.isArray(msgs) && msgs.some(m => m.author.id === BOT_USER_ID && m.embeds?.length > 0)) {
      console.log('ℹ️  Ticket panel already posted.'); return;
    }
  } catch { /* ignore */ }

  console.log('🎫 Posting ticket panel...');

  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎫  SUPPORT TICKETS')
    .setDescription(
      'Need help from the team? Click a button below to open a ticket!\n\n' +
      TICKET_CATEGORIES.map(c => `${c.emoji} **${c.name}** — ${c.description}`).join('\n') +
      '\n\n*A private channel will be created for you and the admin team.*'
    )
    .setColor(COLORS.purple).setFooter({ text: 'Helena • Support System' }).setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    TICKET_CATEGORIES.slice(0, 3).map(cat =>
      new ButtonBuilder().setCustomId(`open_ticket_${cat.key}`).setLabel(cat.name).setEmoji(cat.emoji).setStyle(ButtonStyle.Secondary)
    )
  );
  const row2 = new ActionRowBuilder().addComponents(
    TICKET_CATEGORIES.slice(3).map(cat =>
      new ButtonBuilder().setCustomId(`open_ticket_${cat.key}`).setLabel(cat.name).setEmoji(cat.emoji).setStyle(ButtonStyle.Secondary)
    )
  );

  await dREST('POST', `/channels/${SUPPORT_TRIGGER_CHANNEL_ID}/messages`, {
    embeds: [ticketEmbed.toJSON()], components: [row1.toJSON(), row2.toJSON()],
  });
  console.log('✅ Ticket panel posted!');
}

// ── Startup online message → #admin-console ───────────────────────────────────
async function postOnlineMessage() {
  const servers      = await getBMServers();
  const onlineCount  = servers.filter(s => s.attributes.status === 'online').length;
  const totalPlayers = servers.reduce((sum, s) => sum + (s.attributes.players || 0), 0);

  const embed = new EmbedBuilder()
    .setTitle('🟢  HELENA IS ONLINE')
    .setDescription(
      `Systems are up and I am ready to go.\n\n` +
      `🖥️ **Servers Online:** ${servers.length ? `${onlineCount}/${servers.length}` : 'BattleMetrics not configured'}\n` +
      `🦖 **Players Online:** ${totalPlayers}\n` +
      `🤖 **AI Brain:** ${ANTHROPIC_API_KEY ? '✅ Active' : '❌ Disabled — set ANTHROPIC_API_KEY in Railway'}\n` +
      `🕐 **Started:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `*Talk to me naturally in this channel — I can handle server status, player management, broadcasts, polls, and config changes.*`
    )
    .setColor(COLORS.green).setFooter({ text: 'Helena • Admin Console' }).setTimestamp();

  await sendEmbed(ADMIN_CONSOLE_CHANNEL_ID, embed);
  console.log('✅ Online message posted to #admin-console');
}

// ── Create private ticket channel ─────────────────────────────────────────────
async function createTicketChannel(guild, member, category, originalMessage = null) {
  const existingChannel = guild.channels.cache.find(
    c => c.name.startsWith(`open-${member.user.username.toLowerCase()}`)
  );
  if (existingChannel) return { existing: existingChannel };

  const adminRole    = guild.roles.cache.get(ADMIN_ROLE_ID);
  const arkAdminRole = guild.roles.cache.get(ARK_ADMIN_ROLE_ID);

  const ticketChannel = await guild.channels.create({
    name: `open-${member.user.username.toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: OPEN_TICKETS_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.roles.everyone,  deny:  [PermissionFlagsBits.ViewChannel] },
      { id: member.id,             allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id,        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ...(adminRole    ? [{ id: adminRole.id,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ...(arkAdminRole ? [{ id: arkAdminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
    ],
  });

  const cat = category || TICKET_CATEGORIES[0];

  const ticketEmbed = new EmbedBuilder()
    .setTitle(`${cat.emoji}  ${cat.name} — Support Ticket`)
    .setDescription(
      `Hey ${member}! 👋\n\nAn admin will be with you shortly. Please describe your issue in as much detail as possible.\n\n` +
      (originalMessage ? `📝 **Your message:** ${originalMessage}\n\n` : '') +
      `📋 **Category:** ${cat.name}\n🕐 **Opened:** <t:${Math.floor(Date.now() / 1000)}:F>`
    )
    .setColor(COLORS.green).setFooter({ text: 'Helena • Support Ticket — OPEN' }).setTimestamp();

  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({ embeds: [ticketEmbed], components: [closeButton] });

  activeTickets.set(ticketChannel.id, {
    userId: member.user.id, username: member.user.globalName || member.user.username,
    stage: 'waiting_for_issue', collectedData: originalMessage || '', issueType: cat.name,
  });

  console.log(`✅ Created ticket #${ticketChannel.name} for ${member.user.username} [${cat.name}]`);
  return { channel: ticketChannel };
}

// ── Close ticket channel ──────────────────────────────────────────────────────
async function closeTicketChannel(channelId, channelName, userId) {
  const newName = channelName.replace('open-', 'closed-').replace('ticket-', 'closed-');
  await dREST('PATCH', `/channels/${channelId}`, { name: newName });
  await dREST('PUT', `/channels/${channelId}/permissions/${userId}`, {
    type: 1, deny: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages), allow: '0',
  });
  console.log(`🔒 Closed ticket: #${newName}`);
}

// ── Issue classification ──────────────────────────────────────────────────────
function classifyIssue(text) {
  const l = text.toLowerCase();
  if (l.includes('stuck') || l.includes('mesh') || l.includes('under the map')) return 'Stuck/Meshed';
  if ((l.includes('lost') || l.includes('missing') || l.includes('gone')) && (l.includes('dino') || l.includes('item') || l.includes('tame') || l.includes('character'))) return 'Lost Dino/Items';
  if (l.includes('report') || l.includes('hacker') || l.includes('cheat') || l.includes('exploit')) return 'Player Report';
  if (l.includes('ban') || l.includes('appeal') || l.includes('unban')) return 'Ban Appeal';
  if (l.includes('lag') || l.includes('crash') || l.includes('server down') || l.includes('offline')) return 'Server Issue';
  if (l.includes('bug') || l.includes('glitch') || l.includes('broken') || l.includes('not working')) return 'Bug/Glitch';
  return 'General Support';
}

function needsAdmin(issueType) {
  return ['Stuck/Meshed', 'Lost Dino/Items', 'Player Report', 'Ban Appeal', 'Server Issue'].includes(issueType);
}

function getFollowUpQuestions(issueType) {
  switch (issueType) {
    case 'Stuck/Meshed':    return `To get you unstuck:\n• **Which server/map?**\n• **Your coordinates?** (press **H** in-game)\n• How did it happen?`;
    case 'Lost Dino/Items': return `To investigate:\n• **Which server/map?**\n• **Dino/item description?**\n• **Tribe name?**\n• **When?** (EST)`;
    case 'Player Report':   return `To process your report:\n• **Suspect's IGN + tribe?**\n• **Which server/map?**\n• **What did they do?**\n• **Evidence?** (screenshots/clips)`;
    case 'Bug/Glitch':      return `To investigate:\n• **Which server/map?**\n• **Coordinates?** (press **H**)\n• **What happened?**`;
    case 'Server Issue':    return `To report:\n• **Which server/map?**\n• **What are you experiencing?**\n• **When did it start?** (EST)`;
    case 'Ban Appeal':      return `For your appeal:\n• **In-game name + tribe?**\n• **When were you banned?**\n• **Why do you think it was incorrect?**`;
    default:                return `A bit more info:\n• **Which server/map?**\n• **Your in-game name?**\n• **Full description of your issue?**`;
  }
}

// ── Escalate ticket ───────────────────────────────────────────────────────────
async function escalateTicket(channelId, channelName, ticket) {
  ticket.stage = 'escalated';
  activeTickets.set(channelId, ticket);

  await sendMessage(channelId,
    `📋 **Ticket Summary**\n• **Issue:** ${ticket.issueType}\n• **Player:** ${ticket.username}\n• **Details:** ${(ticket.collectedData || 'No details yet').substring(0, 400)}\n\n` +
    `I've gathered everything I can — escalating to the admin team now!\n\n` +
    `<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}> — please review this ticket.\n\n` +
    `**${ticket.username}**, an admin will be with you shortly. Please stay here! 🙏`
  );
  await sendMessage(ADMIN_LOGS_CHANNEL_ID,
    `🚨 **[Ticket Escalated]** <#${channelId}> | **${ticket.username}** | **${ticket.issueType}**\n> ${(ticket.collectedData || '').substring(0, 200)}\n\n<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}>`
  );
}

// ── Handle ticket text conversation ──────────────────────────────────────────
async function handleTicketMessage(message) {
  const channelId   = message.channel.id;
  const channelName = message.channel.name;
  const content     = message.content.trim();
  const lower       = content.toLowerCase();
  const ticket      = activeTickets.get(channelId);
  if (!ticket) return;

  if (content.toUpperCase() === 'URGENT' || lower.includes('urgent')) {
    ticket.collectedData = ticket.collectedData || content;
    await escalateTicket(channelId, channelName, ticket); return;
  }

  if (ticket.stage === 'waiting_for_issue') {
    ticket.collectedData = (ticket.collectedData ? ticket.collectedData + '\n' : '') + content;
    ticket.issueType     = classifyIssue(content);
    ticket.stage         = 'waiting_for_details';
    activeTickets.set(channelId, ticket);
    await sendMessage(channelId,
      `Got it — logging this as **${ticket.issueType}**.\n\n${getFollowUpQuestions(ticket.issueType)}\n\n*(Type **URGENT** at any time to immediately reach a human admin.)*`
    );
    return;
  }

  if (ticket.stage === 'waiting_for_details') {
    ticket.collectedData += '\n' + content;
    activeTickets.set(channelId, ticket);
    if (needsAdmin(ticket.issueType)) { await escalateTicket(channelId, channelName, ticket); return; }
    ticket.stage = 'waiting_for_resolution_confirm';
    activeTickets.set(channelId, ticket);
    const result = await forwardToWebhook({
      type: 'ticket_resolve', channel_id: channelId, channel_name: channelName,
      content: ticket.collectedData, issue_type: ticket.issueType,
      author: { id: ticket.userId, username: ticket.username, global_name: ticket.username, bot: false },
    });
    if (!result || result.action === 'no_response') { await escalateTicket(channelId, channelName, ticket); return; }
    await sendMessage(channelId, `\n✅ Did that answer your question? Reply **YES** to close or **NO** if you still need help.`);
    return;
  }

  if (ticket.stage === 'waiting_for_resolution_confirm') {
    const resolved   = lower === 'yes' || ['resolved','fixed','thanks','thank you','ty','perfect','good'].some(w => lower.includes(w));
    const unresolved = lower === 'no'  || ['still','not fixed','nope',"doesn't","didn't"].some(w => lower.includes(w));
    if (resolved) {
      ticket.stage = 'closed'; activeTickets.set(channelId, ticket);
      await sendMessage(channelId, `🎉 Glad I could help, **${ticket.username}**! Closing this ticket now. Happy surviving! 🦕`);
      await closeTicketChannel(channelId, channelName, ticket.userId);
      await sendMessage(ADMIN_LOGS_CHANNEL_ID, `✅ **[Ticket Resolved]** <#${channelId}> | **${ticket.username}** | ${ticket.issueType}`);
    } else if (unresolved) {
      await escalateTicket(channelId, channelName, ticket);
    } else {
      await sendMessage(channelId, `Please reply **YES** if resolved, or **NO** if you still need help.`);
    }
    return;
  }

  if (ticket.stage === 'escalated') return; // Admins handle it
}

// ── Forward to ArkBot webhook ─────────────────────────────────────────────────
async function forwardToWebhook(payload) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { console.error(`❌ Webhook ${res.status}: ${await res.text()}`); return null; }
    const result = await res.json();
    console.log(`✅ Webhook [${payload.type}]:`, JSON.stringify(result).substring(0, 100));
    return result;
  } catch (err) { console.error(`❌ Webhook error: ${err.message}`); return null; }
}

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('clientReady', async (c) => {
  console.log(`✅ ${c.user.tag} is online!`);
  const guild = c.guilds.cache.get(GUILD_ID);
  if (guild) {
    await ensureRoleEmbeds();
    await ensureTicketPanel();
    await postOnlineMessage();
  }
  console.log(`🎫 Helena v2.0.0 ready!`);
});

// ── Interaction handler ───────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // Map role selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'map_roles') {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    for (const map of MAPS) {
      const role = guild.roles.cache.find(r => r.name === map.name);
      if (role && member.roles.cache.has(role.id)) await member.roles.remove(role).catch(() => {});
    }
    const added = [];
    for (const val of interaction.values) {
      const map  = MAPS.find(m => m.name === val);
      const role = map ? guild.roles.cache.find(r => r.name === map.name) : null;
      if (role) { await member.roles.add(role).catch(() => {}); added.push(map.label); }
    }
    await interaction.editReply({ content: `✅ Map roles updated!\n🗺️ **Active Maps:** ${added.join(', ')}` });
  }

  // Platform role selection
  if (interaction.isStringSelectMenu() && interaction.customId === 'platform_roles') {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    for (const p of PLATFORMS) {
      const role = guild.roles.cache.get(p.roleId);
      if (role && member.roles.cache.has(role.id)) await member.roles.remove(role).catch(() => {});
    }
    const platform = PLATFORMS.find(p => p.name === interaction.values[0]);
    const role     = platform ? guild.roles.cache.get(platform.roleId) : null;
    if (role) await member.roles.add(role).catch(() => {});
    await interaction.editReply({ content: `✅ Platform role updated!\n${platform?.emoji || '🎮'} **Platform:** ${interaction.values[0]}` });
  }

  // Ticket open buttons
  if (interaction.isButton() && interaction.customId.startsWith('open_ticket_')) {
    const key = interaction.customId.replace('open_ticket_', '');
    const cat = TICKET_CATEGORIES.find(c => c.key === key);
    if (!cat) return interaction.reply({ content: '❌ Unknown ticket category.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const result = await createTicketChannel(interaction.guild, interaction.member, cat);
    if (result.existing) return interaction.editReply({ content: `⚠️ You already have an open ticket in <#${result.existing.id}>!` });
    await interaction.editReply({ content: `✅ Ticket opened! Head to <#${result.channel.id}> to get help. 🦖` });
  }

  // Close ticket
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    await interaction.deferReply({ ephemeral: false });
    const channel = interaction.channel;
    const member  = interaction.member;
    await channel.setName(channel.name.replace('open-', 'closed-').replace('ticket-', 'closed-')).catch(() => {});
    await channel.permissionOverwrites.edit(member.id, { SendMessages: false }).catch(() => {});

    const closedEmbed = new EmbedBuilder()
      .setTitle('🔒  TICKET CLOSED')
      .setDescription(`Closed by <@${member.id}>.\n\n🕐 **Closed:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n*An admin can delete this channel once the issue is resolved.*`)
      .setColor(COLORS.red).setFooter({ text: 'Helena • Support Ticket — CLOSED' }).setTimestamp();

    const deleteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete Ticket').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    await interaction.editReply({ embeds: [closedEmbed], components: [deleteRow] });

    const ticket = activeTickets.get(channel.id);
    if (ticket) { ticket.stage = 'closed'; activeTickets.set(channel.id, ticket); }
    await sendMessage(ADMIN_LOGS_CHANNEL_ID,
      `🔒 **[Ticket Closed]** <#${channel.id}> by <@${member.id}>${ticket ? ` | **${ticket.username}** | ${ticket.issueType}` : ''}`
    );
  }

  // Delete ticket (admin only)
  if (interaction.isButton() && interaction.customId === 'ticket_delete') {
    const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID) || interaction.member.roles.cache.has(ARK_ADMIN_ROLE_ID);
    if (!isAdmin) return interaction.reply({ content: '🚫 Only admins can delete ticket channels.', ephemeral: true });
    await interaction.reply({ content: '🗑️ Deleting in 3 seconds...', ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const channelId = message.channel.id;
  const guild     = message.guild;

  // Active ticket channel — text conversation flow
  if (activeTickets.has(channelId)) {
    await handleTicketMessage(message);
    return;
  }

  // #admin-console or #staff-chat — Helena AI brain (admins only)
  if (channelId === ADMIN_CONSOLE_CHANNEL_ID || channelId === STAFF_CHAT_CHANNEL_ID) {
    const isAdmin = message.member.roles.cache.has(ADMIN_ROLE_ID) || message.member.roles.cache.has(ARK_ADMIN_ROLE_ID);
    if (!isAdmin) return;
    await handleHelenaAI(message, guild);
    return;
  }

  // #support-ticket — auto ticket creation / message forwarding
  if (channelId === SUPPORT_TRIGGER_CHANNEL_ID) {
    const originalContent = message.content;
    const member          = message.member;
    deleteMessage(channelId, message.id).catch(() => {});

    const existingChannel = guild.channels.cache.find(
      c => c.name.startsWith(`open-${member.user.username.toLowerCase()}`)
    );
    if (existingChannel) {
      const fwdEmbed = new EmbedBuilder()
        .setDescription(`📨 **${member.displayName}** sent a message from <#${channelId}>:\n\n${originalContent}`)
        .setColor(COLORS.orange).setFooter({ text: 'Helena • Forwarded Message' }).setTimestamp();
      await existingChannel.send({ embeds: [fwdEmbed] });
      return;
    }

    const result = await createTicketChannel(guild, member, TICKET_CATEGORIES[0], originalContent);
    if (result.channel) {
      await sendMessage(channelId, `🎫 <@${member.user.id}> — your ticket is open! Head to <#${result.channel.id}> 🦕`);
    }
    return;
  }

  // #ai channel — enforce !ai prefix, forward to ArkBot webhook
  if (channelId === AI_CHANNEL_ID) {
    if (!message.content.trim().toLowerCase().startsWith('!ai')) return;
    console.log(`📨 [#ai] ${message.author.username}: "${message.content.substring(0, 80)}"`);
    await forwardToWebhook({
      type: 'message', id: message.id, channel_id: channelId, channel_name: message.channel.name,
      content: message.content,
      author: { id: message.author.id, username: message.author.username, global_name: message.author.globalName, bot: false },
    });
    return;
  }

  // All other channels — silent
});

// ── Member join ───────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.username}`);
  await forwardToWebhook({
    type: 'member_join',
    user: { id: member.user.id, username: member.user.username, global_name: member.user.globalName },
  });
});

// ── Error handlers ────────────────────────────────────────────────────────────
client.on('error', (err) => console.error('❌ Client error:', err.message));
process.on('unhandledRejection', (r) => console.error('❌ Unhandled rejection:', r));
process.on('uncaughtException', (err) => console.error('❌ Uncaught exception:', err.message));

// ── Login ─────────────────────────────────────────────────────────────────────
console.log('🔄 Connecting to Discord...');
client.login(DISCORD_BOT_TOKEN).catch((err) => { console.error('❌ Login failed:', err.message); process.exit(1); });
