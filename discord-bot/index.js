const {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, Partials,
} = require('discord.js');
const fetch = require('node-fetch');
const http = require('http');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL       = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET    = process.env.DISCORD_WEBHOOK_SECRET;

// ── Config ────────────────────────────────────────────────────────────────────
const GUILD_ID                   = '636832636752625664';
const OPEN_TICKETS_CATEGORY_ID   = '1390284215870033971';
const ADMIN_LOGS_CHANNEL_ID      = '1275132184440868866';
const ARK_GENERAL_CHANNEL_ID     = '1173768088089534596'; // BLACKLISTED — bot ignores entirely
const AI_CHANNEL_ID              = '1509173477725175928'; // #ai — only channel Helena responds in
const STAFF_CHAT_CHANNEL_ID      = '1276128810609152030';
const ADMIN_STUFF_CHANNEL_ID     = '1274810759485980704';
const SUPPORT_TRIGGER_CHANNEL_ID = '1390284806650331146'; // #support-ticket (text trigger)
const ROLES_CHANNEL_ID           = '1509816508291878972'; // #🎭︱get-roles
const AI_PREFIX                  = '!ai';
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
const MAPS = [
  { name: 'Island',       label: 'The Island',    emoji: '🏝️' },
  { name: 'Center',       label: 'The Center',    emoji: '🌀' },
  { name: 'Scorched',     label: 'Scorched Earth', emoji: '🏜️' },
  { name: 'Forglar',      label: 'Forglar',        emoji: '🌊' },
  { name: 'Aberration',   label: 'Aberration',     emoji: '🌑' },
  { name: 'Club Ark',     label: 'Club Ark',       emoji: '🎉' },
  { name: 'Svartlfheim',  label: 'Svartlfheim',    emoji: '❄️' },
  { name: 'Astraeos',     label: 'Astraeos',       emoji: '🌌' },
  { name: 'Extinction',   label: 'Extinction',     emoji: '☄️' },
  { name: 'Volcano',      label: 'Volcano',        emoji: '🔥' },
  { name: 'Valguero',     label: 'Valguero',       emoji: '🦕' },
  { name: 'Lost Colony',  label: 'Lost Colony',    emoji: '🚀' },
];

const PLATFORMS = [
  { name: 'Xbox',     emoji: '🎮', roleId: '1389939183312699523' },
  { name: 'PS5',      emoji: '🕹️', roleId: '1425828763538555004' },
  { name: 'Steam',    emoji: '💻', roleId: '1389218790067404800' },
  { name: 'Windows',  emoji: '🪟', roleId: '1386292242397925458' },
  { name: 'GeForce Now', emoji: '☁️', roleId: '1386292322060206101' },
];

const TICKET_CATEGORIES = [
  { name: 'General Help',  emoji: '❓', description: 'General questions or assistance',        customId: 'ticket_general_help' },
  { name: 'Admin Support', emoji: '🛡️', description: 'Reach out to an admin directly',         customId: 'ticket_admin_support' },
  { name: 'Player Report', emoji: '🚨', description: 'Report a player for rule breaking',       customId: 'ticket_player_report' },
  { name: 'Tame/Item Loss',emoji: '🦖', description: 'Lost a tame or items? Let us know',       customId: 'ticket_tame_item_loss' },
  { name: 'Bug Report',    emoji: '🐛', description: 'Report a server or game bug',             customId: 'ticket_bug_report' },
];

// ── In-memory ticket state ────────────────────────────────────────────────────
// channelId -> { userId, username, stage, collectedData, issueType }
const activeTickets = new Map();

// ── Startup validation ────────────────────────────────────────────────────────
if (!DISCORD_BOT_TOKEN) { console.error('❌ FATAL: DISCORD_BOT_TOKEN not set'); process.exit(1); }
if (!WEBHOOK_URL)       { console.error('❌ FATAL: ARKBOT_WEBHOOK_URL not set'); process.exit(1); }
console.log(`✅ Config OK — Webhook: ${WEBHOOK_URL}`);

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

// ── Role selection embeds — post once to #get-roles ───────────────────────────
async function ensureRoleEmbeds(guild) {
  try {
    const msgs = await dREST('GET', `/channels/${ROLES_CHANNEL_ID}/messages?limit=20`);
    if (msgs && msgs.some(m => m.author.id === BOT_USER_ID)) {
      console.log('ℹ️  Role embeds already posted — skipping.');
      return;
    }
  } catch { /* ignore */ }

  console.log('📋 Posting role selection embeds to #get-roles...');

  // MAP ROLES
  const mapEmbed = new EmbedBuilder()
    .setTitle('🗺️  SELECT YOUR MAP ROLES')
    .setDescription('Select the maps you play on to get relevant pings and updates.\nYou can pick multiple maps!')
    .setColor(COLORS.blue)
    .setFooter({ text: 'Helena • Skii\'s Lodge' })
    .setTimestamp();

  const mapMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('map_roles')
      .setPlaceholder('🗺️ Choose your maps...')
      .setMinValues(1)
      .setMaxValues(MAPS.length)
      .addOptions(MAPS.map(m => ({ label: m.label, value: m.name, emoji: m.emoji })))
  );

  await sendEmbed(ROLES_CHANNEL_ID, mapEmbed, [mapMenu]);

  // PLATFORM ROLES
  const platformEmbed = new EmbedBuilder()
    .setTitle('🎮  SELECT YOUR PLATFORM ROLE')
    .setDescription('Let us know what platform you play ARK on!')
    .setColor(COLORS.orange)
    .setFooter({ text: 'Helena • Skii\'s Lodge' })
    .setTimestamp();

  const platformMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('platform_roles')
      .setPlaceholder('🎮 Choose your platform...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(PLATFORMS.map(p => ({ label: p.name, value: p.name, emoji: p.emoji })))
  );

  await sendEmbed(ROLES_CHANNEL_ID, platformEmbed, [platformMenu]);

  console.log('✅ Role embeds posted!');
}

// ── Ticket panel — post once to #support-ticket ───────────────────────────────
async function ensureTicketPanel() {
  try {
    const msgs = await dREST('GET', `/channels/${SUPPORT_TRIGGER_CHANNEL_ID}/messages?limit=20`);
    if (msgs && msgs.some(m => m.author.id === BOT_USER_ID && m.embeds && m.embeds.length > 0)) {
      console.log('ℹ️  Ticket panel already posted — skipping.');
      return;
    }
  } catch { /* ignore */ }

  console.log('🎫 Posting ticket panel...');

  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎫  OPEN A SUPPORT TICKET')
    .setDescription(
      'Need help from the Skii\'s Lodge team? Click a button below to open a private ticket!\n\n' +
      TICKET_CATEGORIES.map(c => `${c.emoji} **${c.name}** — ${c.description}`).join('\n') +
      '\n\n*A private channel will be created just for you and the admin team.*'
    )
    .setColor(COLORS.purple)
    .setFooter({ text: 'Helena • Support System' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    TICKET_CATEGORIES.map(c =>
      new ButtonBuilder()
        .setCustomId(c.customId)
        .setLabel(c.name)
        .setEmoji(c.emoji)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  await sendEmbed(SUPPORT_TRIGGER_CHANNEL_ID, ticketEmbed, [row]);
  console.log('✅ Ticket panel posted!');
}

// ── Create private ticket channel via REST ────────────────────────────────────
async function createTicketChannel(userId, username) {
  const ticketNum = String(Math.floor(1000 + Math.random() * 9000));
  const channelName = `ticket-${ticketNum}`;
  console.log(`🔨 Creating channel "${channelName}" in category ${OPEN_TICKETS_CATEGORY_ID}...`);

  const channel = await dREST('POST', `/guilds/${GUILD_ID}/channels`, {
    name: channelName,
    type: 0,
    parent_id: OPEN_TICKETS_CATEGORY_ID,
    permission_overwrites: [
      { id: EVERYONE_ROLE_ID,  type: 0, deny: String(PermissionFlagsBits.ViewChannel) },
      { id: userId,            type: 1, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory) },
      { id: BOT_USER_ID,       type: 1, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.ManageChannels) },
      { id: ADMIN_ROLE_ID,     type: 0, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory) },
      { id: ARK_ADMIN_ROLE_ID, type: 0, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory) },
    ],
  });

  if (!channel || !channel.id) { console.error('❌ Failed to create ticket channel:', JSON.stringify(channel)); return null; }
  console.log(`✅ Created ticket channel: #${channelName} (${channel.id})`);
  return channel;
}

// ── Close ticket channel ──────────────────────────────────────────────────────
async function closeTicketChannel(channelId, channelName, userId) {
  const newName = channelName.replace('ticket-', 'closed-');
  await dREST('PATCH', `/channels/${channelId}`, { name: newName });
  await dREST('PUT', `/channels/${channelId}/permissions/${userId}`, {
    type: 1,
    deny: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages),
    allow: '0',
  });
  console.log(`🔒 Closed ticket: #${newName}`);
}

// ── Classify issue ────────────────────────────────────────────────────────────
function classifyIssue(text) {
  const l = text.toLowerCase();
  if (l.includes('stuck') || l.includes('mesh') || l.includes('under the map') || l.includes('inside a rock')) return 'Stuck/Meshed';
  if ((l.includes('lost') || l.includes('missing') || l.includes('gone')) && (l.includes('dino') || l.includes('item') || l.includes('character') || l.includes('stuff') || l.includes('tame'))) return 'Lost Dino/Items';
  if (l.includes('report') || l.includes('hacker') || l.includes('cheat') || l.includes('exploit') || l.includes('rule break') || l.includes('breaking rules')) return 'Player Report';
  if (l.includes('ban') || l.includes('appeal') || l.includes('unbanned') || l.includes('unban')) return 'Ban Appeal';
  if (l.includes('lag') || l.includes('server down') || l.includes('crash') || l.includes('offline') || l.includes('disconnect')) return 'Server Issue';
  if (l.includes('bug') || l.includes('glitch') || l.includes('broken') || l.includes('not working')) return 'Bug/Glitch';
  return 'General Support';
}

function needsAdmin(issueType) {
  return ['Stuck/Meshed', 'Lost Dino/Items', 'Player Report', 'Ban Appeal', 'Server Issue'].includes(issueType);
}

function getFollowUpQuestions(issueType) {
  switch (issueType) {
    case 'Stuck/Meshed':    return `I need a few details to get you unstuck:\n• **Which server/map** are you on?\n• **Your coordinates** (press **H** in-game)\n• How did you get stuck? (fell through mesh, structure, terrain?)`;
    case 'Lost Dino/Items': return `To investigate your loss, I need:\n• **Which server/map** was it on?\n• **Dino name/species** or item description\n• **Your tribe name**\n• **Roughly when** did it disappear? (EST)`;
    case 'Player Report':   return `To process your report:\n• **Suspect's IGN and tribe name**\n• **Which server/map** did this happen on?\n• **What did they do?** (describe the exploit/rule break)\n• **Any evidence?** (screenshots, video links)`;
    case 'Bug/Glitch':      return `To investigate the bug:\n• **Which server/map** are you on?\n• **Your coordinates** if relevant (press **H**)\n• **What's happening?** (what did you expect vs what occurred?)`;
    case 'Server Issue':    return `To report this:\n• **Which server/map** is affected?\n• **What are you experiencing?** (lag, crashes, rollbacks)\n• **When did it start?** (EST)`;
    case 'Ban Appeal':      return `For your appeal:\n• **Your in-game name and tribe**\n• **When were you banned?**\n• **Why do you believe the ban was incorrect?**`;
    default:                return `Could you give me more detail?\n• **Which server/map** are you on?\n• **Your in-game character name**\n• **Full description of your issue**`;
  }
}

// ── Escalate ticket ───────────────────────────────────────────────────────────
async function escalateTicket(channelId, channelName, ticket) {
  ticket.stage = 'escalated';
  activeTickets.set(channelId, ticket);

  const summary =
    `📋 **Ticket Summary**\n` +
    `• **Issue Type:** ${ticket.issueType}\n` +
    `• **Player:** ${ticket.username}\n` +
    `• **Details:** ${(ticket.collectedData || 'No details provided').substring(0, 400)}`;

  await sendMessage(channelId,
    `${summary}\n\n` +
    `I've gathered the details but this needs a human admin. Escalating now!\n\n` +
    `<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}> — please review this ticket.\n\n` +
    `**${ticket.username}**, an admin will be with you shortly. Please stay in this channel! 🙏`
  );

  await sendMessage(ADMIN_LOGS_CHANNEL_ID,
    `🚨 **[Ticket Escalated]** <#${channelId}> | **${ticket.username}** | **${ticket.issueType}**\n` +
    `> ${(ticket.collectedData || '').substring(0, 200)}\n\n` +
    `<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}>`
  );
  console.log(`🚨 Escalated #${channelName} for ${ticket.username}`);
}

// ── Handle messages inside a ticket channel (text-based flow) ─────────────────
async function handleTicketMessage(message) {
  const channelId   = message.channel.id;
  const channelName = message.channel.name;
  const content     = message.content.trim();
  const lower       = content.toLowerCase();
  const ticket      = activeTickets.get(channelId);
  if (!ticket) return;

  console.log(`🎫 [#${channelName}] stage=${ticket.stage} msg="${content.substring(0, 60)}"`);

  // URGENT override at any stage
  if (content.toUpperCase() === 'URGENT' || lower.includes('urgent')) {
    ticket.collectedData = ticket.collectedData || content;
    ticket.issueType     = ticket.issueType || 'Urgent';
    await escalateTicket(channelId, channelName, ticket);
    return;
  }

  // Stage 1: waiting for issue description
  if (ticket.stage === 'waiting_for_issue') {
    ticket.collectedData = content;
    ticket.issueType     = classifyIssue(content);
    ticket.stage         = 'waiting_for_details';
    activeTickets.set(channelId, ticket);
    await sendMessage(channelId,
      `Got it — logging this as a **${ticket.issueType}** issue.\n\n` +
      getFollowUpQuestions(ticket.issueType) +
      `\n\n*(Reply with all the details and I'll try to resolve this for you!)*`
    );
    return;
  }

  // Stage 2: waiting for details
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
    await sendMessage(channelId, `\n✅ Did that answer your question? Reply **YES** to close this ticket or **NO** if you still need help.`);
    return;
  }

  // Stage 3: YES / NO resolution confirm
  if (ticket.stage === 'waiting_for_resolution_confirm') {
    const resolved   = lower === 'yes' || lower.startsWith('yes') || lower.includes('resolved') || lower.includes('fixed') || lower.includes('thanks') || lower.includes('thank you') || lower.includes('ty') || lower.includes('perfect') || lower.includes('good');
    const unresolved = lower === 'no'  || lower.startsWith('no')  || lower.includes('still')    || lower.includes('not fixed')  || lower.includes('nope') || lower.includes("doesn't") || lower.includes("didn't");

    if (resolved) {
      ticket.stage = 'closed';
      activeTickets.set(channelId, ticket);
      await sendMessage(channelId, `🎉 Awesome! Glad I could help, **${ticket.username}**!\n\nClosing this ticket now. If you ever need help again, just type in <#${SUPPORT_TRIGGER_CHANNEL_ID}>. Happy surviving! 🦕`);
      await closeTicketChannel(channelId, channelName, ticket.userId);
      await sendMessage(ADMIN_LOGS_CHANNEL_ID, `✅ **[Ticket Closed — Resolved]** <#${channelId}> | **${ticket.username}** | ${ticket.issueType}`);
    } else if (unresolved) {
      await escalateTicket(channelId, channelName, ticket);
    } else {
      await sendMessage(channelId, `Please reply **YES** if resolved, or **NO** if you still need help.`);
    }
    return;
  }

  // Stage 4: escalated — admins handle it, bot stays quiet
  if (ticket.stage === 'escalated') {
    console.log(`📋 [#${channelName}] Post-escalation msg from ${ticket.username}: "${content.substring(0, 60)}"`);
    return;
  }
}

// ── Handle trigger channel — text message creates a ticket ────────────────────
async function handleTriggerChannel(message) {
  deleteMessage(message.channel.id, message.id).catch(() => {});

  const userId   = message.author.id;
  const username = message.author.globalName || message.author.username;

  for (const [, t] of activeTickets) {
    if (t.userId === userId && t.stage !== 'closed') {
      console.log(`⚠️ ${username} already has an open ticket, skipping`);
      return;
    }
  }

  const channel = await createTicketChannel(userId, username);
  if (!channel) {
    await sendMessage(message.channel.id, `⚠️ <@${userId}> — Sorry, something went wrong. Please ping <@&${ADMIN_ROLE_ID}> directly!`);
    return;
  }

  activeTickets.set(channel.id, { userId, username, stage: 'waiting_for_issue', collectedData: '', issueType: 'General Support' });

  await sendMessage(channel.id,
    `👋 Hey <@${userId}>! I'm **Helena**, Skii's Lodge automated support assistant.\n\n` +
    `This is your private support ticket — only you and the admin team can see this.\n\n` +
    `**Please describe your issue in detail.** I'll do my best to resolve it automatically!\n\n` +
    `*(Type **URGENT** at any point to immediately escalate to a human admin.)*`
  );

  await sendMessage(message.channel.id, `🎫 <@${userId}> — your ticket is open! Head to <#${channel.id}> 🦕`);
  console.log(`🎫 Opened ticket #${channel.name} (${channel.id}) for ${username} (${userId})`);
}

// ── Handle button ticket creation (from embed buttons) ────────────────────────
async function handleTicketButton(interaction, categoryName) {
  const guild    = interaction.guild;
  const member   = interaction.member;
  const userId   = member.user.id;
  const username = member.user.globalName || member.user.username;

  // Check for existing open ticket
  const existingChannel = guild.channels.cache.find(c =>
    c.name && (c.name.startsWith('ticket-') || c.name.startsWith('open-')) &&
    activeTickets.has(c.id) && activeTickets.get(c.id).userId === userId &&
    activeTickets.get(c.id).stage !== 'closed'
  );

  if (existingChannel) {
    await interaction.reply({ content: `⚠️ You already have an open ticket in <#${existingChannel.id}>!`, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const channel = await createTicketChannel(userId, username);
  if (!channel) {
    await interaction.editReply({ content: '❌ Something went wrong creating your ticket. Please ping an admin!' });
    return;
  }

  activeTickets.set(channel.id, { userId, username, stage: 'waiting_for_issue', collectedData: '', issueType: classifyIssue(categoryName) });

  // Welcome embed in the new ticket channel
  const cat = TICKET_CATEGORIES.find(c => c.name === categoryName) || { emoji: '🎫', name: categoryName };
  const ticketEmbed = new EmbedBuilder()
    .setTitle(`${cat.emoji}  ${cat.name} — Support Ticket`)
    .setDescription(
      `Hey <@${userId}>! 👋\n\n` +
      `An admin will be with you shortly. Please describe your issue in as much detail as possible.\n\n` +
      `📋 **Category:** ${cat.name}\n` +
      `🕐 **Opened:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `*(Type **URGENT** to immediately escalate to a human admin.)*`
    )
    .setColor(COLORS.green)
    .setFooter({ text: 'Helena • Support Ticket — OPEN' })
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await sendEmbed(channel.id, ticketEmbed, [closeRow]);
  await interaction.editReply({ content: `✅ Your ticket is open! Head to <#${channel.id}> to get help. 🦕` });
  console.log(`🎫 Button ticket #${channel.name} opened for ${username} [${categoryName}]`);
}

// ── Forward to webhook ────────────────────────────────────────────────────────
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
  console.log(`🎫 Ticket system ready | Category: ${OPEN_TICKETS_CATEGORY_ID}`);
  // Post role embeds and ticket panel on startup if not already present
  await ensureRoleEmbeds(c.guilds.cache.get(GUILD_ID));
  await ensureTicketPanel();
});

// ── Interaction handler (buttons + select menus) ──────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── Map role selection ────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'map_roles') {
    await interaction.deferReply({ ephemeral: true });
    const member   = interaction.member;
    const selected = interaction.values; // role names matching MAPS[].name

    // Remove all current map roles first
    for (const map of MAPS) {
      const role = interaction.guild.roles.cache.find(r => r.name === map.name);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    // Add selected
    const added = [];
    for (const val of selected) {
      const map  = MAPS.find(m => m.name === val);
      const role = map ? interaction.guild.roles.cache.find(r => r.name === map.name) : null;
      if (role) { await member.roles.add(role).catch(() => {}); added.push(map.label); }
    }

    await interaction.editReply({ content: `✅ Map roles updated!\n🗺️ **Active Maps:** ${added.join(', ')}` });
    console.log(`🗺️ Map roles set for ${member.user.username}: ${added.join(', ')}`);
  }

  // ── Platform role selection ───────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'platform_roles') {
    await interaction.deferReply({ ephemeral: true });
    const member   = interaction.member;
    const selected = interaction.values[0];

    // Remove all platform roles
    for (const p of PLATFORMS) {
      const role = interaction.guild.roles.cache.get(p.roleId);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    // Add selected
    const platform = PLATFORMS.find(p => p.name === selected);
    const role     = platform ? interaction.guild.roles.cache.get(platform.roleId) : null;
    if (role) await member.roles.add(role).catch(() => {});

    await interaction.editReply({ content: `✅ Platform role updated!\n${platform?.emoji || '🎮'} **Platform:** ${selected}` });
    console.log(`🎮 Platform role set for ${member.user.username}: ${selected}`);
  }

  // ── Ticket category buttons ───────────────────────────────────────────────
  if (interaction.isButton()) {
    const cat = TICKET_CATEGORIES.find(c => c.customId === interaction.customId);
    if (cat) {
      await handleTicketButton(interaction, cat.name);
      return;
    }

    // Close ticket button
    if (interaction.customId === 'ticket_close') {
      await interaction.deferReply({ ephemeral: false });
      const channel = interaction.channel;
      const member  = interaction.member;
      const newName = channel.name.replace('open-', 'closed-').replace('ticket-', 'closed-');
      await channel.setName(newName).catch(() => {});
      await channel.permissionOverwrites.edit(member.id, { SendMessages: false }).catch(() => {});

      const closedEmbed = new EmbedBuilder()
        .setTitle('🔒  TICKET CLOSED')
        .setDescription(
          `This ticket has been closed by <@${member.id}>.\n\n` +
          `🕐 **Closed:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
          `*An admin can delete this channel once the issue is resolved.*`
        )
        .setColor(COLORS.red)
        .setFooter({ text: 'Helena • Support Ticket — CLOSED' })
        .setTimestamp();

      const deleteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete Ticket').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [closedEmbed], components: [deleteRow] });

      // Update ticket state
      const ticket = activeTickets.get(channel.id);
      if (ticket) { ticket.stage = 'closed'; activeTickets.set(channel.id, ticket); }

      await sendMessage(ADMIN_LOGS_CHANNEL_ID,
        `🔒 **[Ticket Closed]** <#${channel.id}> closed by <@${member.id}>${ticket ? ` | **${ticket.username}** | ${ticket.issueType}` : ''}`
      );
      return;
    }

    // Delete ticket button (admin only)
    if (interaction.customId === 'ticket_delete') {
      const member = interaction.member;
      const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.has(ARK_ADMIN_ROLE_ID);
      if (!isAdmin) {
        await interaction.reply({ content: '🚫 Only admins can delete ticket channels.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: '🗑️ Deleting ticket channel in 3 seconds...', ephemeral: true });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      return;
    }
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const channelId = message.channel.id;

  // Active ticket channel — run text flow
  if (activeTickets.has(channelId)) {
    await handleTicketMessage(message);
    return;
  }

  // Support trigger channel — any text = open a ticket
  if (channelId === SUPPORT_TRIGGER_CHANNEL_ID) {
    await handleTriggerChannel(message);
    return;
  }

  // #ai channel — enforce !ai prefix, forward to Helena backend
  if (channelId === AI_CHANNEL_ID) {
    const trimmed = message.content.trim().toLowerCase();
    if (!trimmed.startsWith('!ai')) return;
    console.log(`📨 [#ai] ${message.author.username}: "${message.content.substring(0, 80)}"`);
    await forwardToWebhook({
      type: 'message', id: message.id, channel_id: channelId, channel_name: message.channel.name,
      content: message.content,
      author: { id: message.author.id, username: message.author.username, global_name: message.author.globalName, bot: false },
    });
    return;
  }

  // All other channels — completely silent
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
