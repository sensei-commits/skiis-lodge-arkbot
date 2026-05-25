const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');
const fetch = require('node-fetch');
const http = require('http');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET;

// ── Config ────────────────────────────────────────────────────────────────────
const GUILD_ID                   = '636832636752625664';
const OPEN_TICKETS_CATEGORY_ID   = '1390284215870033971';
const ADMIN_LOGS_CHANNEL_ID      = '1275132184440868866';
const ARK_GENERAL_CHANNEL_ID     = '1173768088089534596';
const STAFF_CHAT_CHANNEL_ID      = '1276128810609152030';
const ADMIN_STUFF_CHANNEL_ID     = '1274810759485980704';
const SUPPORT_TRIGGER_CHANNEL_ID = '1390284806650331146';
const ADMIN_ROLE_ID              = '1242319080760467557';
const ARK_ADMIN_ROLE_ID          = '1242319323145166868';
const BOT_USER_ID                = '1507730299356708984';
const EVERYONE_ROLE_ID           = GUILD_ID; // @everyone role ID == Guild ID in Discord

const PUBLIC_CHANNELS = [ARK_GENERAL_CHANNEL_ID, ADMIN_STUFF_CHANNEL_ID];

// In-memory ticket state: channelId -> { userId, username, stage, collectedData, issueType }
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
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
      console.error(`❌ Discord REST ${method} ${path} → ${res.status}:`, JSON.stringify(data).substring(0, 300));
      return null;
    }
    return data;
  } catch (err) {
    console.error(`❌ Discord REST fetch error: ${err.message}`);
    return null;
  }
}

async function sendMessage(channelId, content) {
  return dREST('POST', `/channels/${channelId}/messages`, { content });
}

async function deleteMessage(channelId, messageId) {
  return dREST('DELETE', `/channels/${channelId}/messages/${messageId}`);
}

// ── Create private ticket channel via REST ────────────────────────────────────
async function createTicketChannel(userId, username) {
  const ticketNum = String(Math.floor(1000 + Math.random() * 9000));
  const channelName = `ticket-${ticketNum}`;

  console.log(`🔨 Creating channel "${channelName}" in category ${OPEN_TICKETS_CATEGORY_ID}...`);

  const channel = await dREST('POST', `/guilds/${GUILD_ID}/channels`, {
    name: channelName,
    type: 0, // GUILD_TEXT
    parent_id: OPEN_TICKETS_CATEGORY_ID,
    permission_overwrites: [
      // @everyone — deny view
      { id: EVERYONE_ROLE_ID, type: 0, deny: String(PermissionFlagsBits.ViewChannel) },
      // Player — allow view + send
      { id: userId, type: 1, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory) },
      // Bot — allow all
      { id: BOT_USER_ID, type: 1, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.ManageChannels) },
      // Admin role — allow all
      { id: ADMIN_ROLE_ID, type: 0, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory) },
      // ARK Admins role — allow all
      { id: ARK_ADMIN_ROLE_ID, type: 0, allow: String(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory) },
    ],
  });

  if (!channel || !channel.id) {
    console.error('❌ Failed to create ticket channel:', JSON.stringify(channel));
    return null;
  }

  console.log(`✅ Created ticket channel: #${channelName} (${channel.id})`);
  return channel;
}

// ── Close ticket channel ──────────────────────────────────────────────────────
async function closeTicketChannel(channelId, channelName, userId) {
  const newName = channelName.replace('ticket-', 'closed-');
  // Rename
  await dREST('PATCH', `/channels/${channelId}`, { name: newName });
  // Remove player's view permission
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
    case 'Stuck/Meshed':
      return `I need a few details to get you unstuck:\n• **Which server/map** are you on?\n• **Your coordinates** (press **H** in-game)\n• How did you get stuck? (fell through mesh, structure, terrain?)`;
    case 'Lost Dino/Items':
      return `To investigate your loss, I need:\n• **Which server/map** was it on?\n• **Dino name/species** or item description\n• **Your tribe name**\n• **Roughly when** did it disappear? (EST)`;
    case 'Player Report':
      return `To process your report:\n• **Suspect's IGN and tribe name**\n• **Which server/map** did this happen on?\n• **What did they do?** (describe the exploit/rule break)\n• **Any evidence?** (screenshots, video links)`;
    case 'Bug/Glitch':
      return `To investigate the bug:\n• **Which server/map** are you on?\n• **Your coordinates** if relevant (press **H**)\n• **What's happening?** (what did you expect vs what occurred?)`;
    case 'Server Issue':
      return `To report this:\n• **Which server/map** is affected?\n• **What are you experiencing?** (lag, crashes, rollbacks)\n• **When did it start?** (EST)`;
    case 'Ban Appeal':
      return `For your appeal:\n• **Your in-game name and tribe**\n• **When were you banned?**\n• **Why do you believe the ban was incorrect?**`;
    default:
      return `Could you give me more detail?\n• **Which server/map** are you on?\n• **Your in-game character name**\n• **Full description of your issue**`;
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
    `I've done my best but this needs a human admin. Escalating now!\n\n` +
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

// ── Handle messages inside a ticket channel ───────────────────────────────────
async function handleTicketMessage(message) {
  const channelId = message.channel.id;
  const channelName = message.channel.name;
  const content = message.content.trim();
  const lower = content.toLowerCase();
  const ticket = activeTickets.get(channelId);
  if (!ticket) return;

  console.log(`🎫 [#${channelName}] stage=${ticket.stage} msg="${content.substring(0, 60)}"`);

  // URGENT override at any stage
  if (content.toUpperCase() === 'URGENT' || lower.includes('urgent')) {
    ticket.collectedData = ticket.collectedData || content;
    ticket.issueType = ticket.issueType || 'Urgent';
    await escalateTicket(channelId, channelName, ticket);
    return;
  }

  // ── Stage 1: waiting for issue description ────────────────────────────────
  if (ticket.stage === 'waiting_for_issue') {
    ticket.collectedData = content;
    ticket.issueType = classifyIssue(content);
    ticket.stage = 'waiting_for_details';
    activeTickets.set(channelId, ticket);

    await sendMessage(channelId,
      `Got it — logging this as a **${ticket.issueType}** issue.\n\n` +
      getFollowUpQuestions(ticket.issueType) +
      `\n\n*(Reply with all the details and I'll try to resolve this for you!)*`
    );
    return;
  }

  // ── Stage 2: waiting for details ─────────────────────────────────────────
  if (ticket.stage === 'waiting_for_details') {
    ticket.collectedData += '\n' + content;
    activeTickets.set(channelId, ticket);

    // Issues that always need admin — skip straight to escalation
    if (needsAdmin(ticket.issueType)) {
      await escalateTicket(channelId, channelName, ticket);
      return;
    }

    // Try webhook knowledge base for general questions
    ticket.stage = 'waiting_for_resolution_confirm';
    activeTickets.set(channelId, ticket);

    const result = await forwardToWebhook({
      type: 'ticket_resolve',
      channel_id: channelId,
      channel_name: channelName,
      content: ticket.collectedData,
      issue_type: ticket.issueType,
      author: { id: ticket.userId, username: ticket.username, global_name: ticket.username, bot: false },
    });

    if (!result || result.action === 'no_response') {
      await escalateTicket(channelId, channelName, ticket);
      return;
    }

    await sendMessage(channelId, `\n✅ Did that answer your question? Reply **YES** to close this ticket or **NO** if you still need help.`);
    return;
  }

  // ── Stage 3: YES / NO ─────────────────────────────────────────────────────
  if (ticket.stage === 'waiting_for_resolution_confirm') {
    const resolved = lower === 'yes' || lower.startsWith('yes') || lower.includes('resolved') || lower.includes('fixed') || lower.includes('thanks') || lower.includes('thank you') || lower.includes('ty') || lower.includes('perfect') || lower.includes('good');
    const unresolved = lower === 'no' || lower.startsWith('no') || lower.includes('still') || lower.includes('not fixed') || lower.includes('nope') || lower.includes("doesn't") || lower.includes("didn't");

    if (resolved) {
      ticket.stage = 'closed';
      activeTickets.set(channelId, ticket);
      await sendMessage(channelId,
        `🎉 Awesome! Glad I could help, **${ticket.username}**!\n\nClosing this ticket now. If you ever need help again, just type in <#${SUPPORT_TRIGGER_CHANNEL_ID}>. Happy surviving! 🦕`
      );
      await closeTicketChannel(channelId, channelName, ticket.userId);
      await sendMessage(ADMIN_LOGS_CHANNEL_ID,
        `✅ **[Ticket Closed — Resolved]** <#${channelId}> | **${ticket.username}** | ${ticket.issueType}`
      );
    } else if (unresolved) {
      await escalateTicket(channelId, channelName, ticket);
    } else {
      await sendMessage(channelId, `Please reply **YES** if resolved, or **NO** if you still need help.`);
    }
    return;
  }

  // ── Stage 4: escalated — admins handle it, bot stays quiet ───────────────
  if (ticket.stage === 'escalated') {
    console.log(`📋 [#${channelName}] Post-escalation msg from ${ticket.username}: "${content.substring(0, 60)}"`);
    // Don't respond — let the admins take over
    return;
  }
}

// ── Handle trigger channel — any message creates a ticket ────────────────────
async function handleTriggerChannel(message) {
  const userId = message.author.id;
  const username = message.author.globalName || message.author.username;

  // Delete their message to keep the channel clean
  try { await deleteMessage(message.channel.id, message.id); } catch (_) {}

  // Check for existing open ticket
  for (const [, t] of activeTickets) {
    if (t.userId === userId && t.stage !== 'closed') {
      // Quietly DM or post ephemeral — just log it
      console.log(`⚠️ ${username} already has an open ticket, skipping`);
      return;
    }
  }

  // Create the private channel
  const channel = await createTicketChannel(userId, username);
  if (!channel) {
    await sendMessage(message.channel.id,
      `⚠️ <@${userId}> — Sorry, something went wrong creating your ticket. Please ping <@&${ADMIN_ROLE_ID}> directly!`
    );
    return;
  }

  // Register ticket state
  activeTickets.set(channel.id, {
    userId,
    username,
    stage: 'waiting_for_issue',
    collectedData: '',
    issueType: 'General Support',
  });

  // Welcome message in private channel
  await sendMessage(channel.id,
    `👋 Hey <@${userId}>! I'm **Helena**, Skii's Lodge automated support assistant.\n\n` +
    `This is your private support ticket — only you and the admin team can see this channel.\n\n` +
    `**Please describe your issue in detail.** I'll do my best to resolve it automatically!\n\n` +
    `*(Type **URGENT** at any point to immediately escalate to a human admin.)*`
  );

  // Notify in trigger channel
  await sendMessage(message.channel.id,
    `🎫 <@${userId}> — your ticket is open! Head to <#${channel.id}> 🦕`
  );

  console.log(`🎫 Opened ticket #${channel.name} (${channel.id}) for ${username} (${userId})`);
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
  } catch (err) {
    console.error(`❌ Webhook error: ${err.message}`);
    return null;
  }
}

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', (c) => {
  console.log(`✅ ${c.user.tag} is online!`);
  console.log(`🎫 Ticket system ready | Category: ${OPEN_TICKETS_CATEGORY_ID}`);
});

// ── Main message handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const channelId = message.channel.id;

  // Active ticket channel
  if (activeTickets.has(channelId)) {
    await handleTicketMessage(message);
    return;
  }

  // Support trigger channel
  if (channelId === SUPPORT_TRIGGER_CHANNEL_ID) {
    await handleTriggerChannel(message);
    return;
  }

  // Public channels → forward to webhook
  if (PUBLIC_CHANNELS.includes(channelId)) {
    console.log(`📨 [#${message.channel.name}] ${message.author.username}: "${message.content.substring(0, 80)}"`);
    await forwardToWebhook({
      type: 'message',
      id: message.id,
      channel_id: channelId,
      channel_name: message.channel.name,
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username,
        global_name: message.author.globalName,
        bot: false,
      },
    });
  }
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
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
