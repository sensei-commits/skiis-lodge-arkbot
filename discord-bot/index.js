const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');
const fetch = require('node-fetch');
const http = require('http');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET;

// ── Config ────────────────────────────────────────────────────────────────────
const GUILD_ID                  = '636832636752625664';
const OPEN_TICKETS_CATEGORY_ID  = '1390284215870033971';
const ADMIN_LOGS_CHANNEL_ID     = '1275132184440868866';
const ARK_GENERAL_CHANNEL_ID    = '1173768088089534596';
const STAFF_CHAT_CHANNEL_ID     = '1276128810609152030';
const ADMIN_STUFF_CHANNEL_ID    = '1274810759485980704';
const SUPPORT_TRIGGER_CHANNEL_ID = '1390284806650331146'; // old #support-ticket — now just a trigger
const ADMIN_ROLE_ID             = '1242319080760467557';
const ARK_ADMIN_ROLE_ID         = '1242319323145166868';
const BOT_USER_ID               = '1507730299356708984';

// Public channels Helena watches for general questions
const PUBLIC_CHANNELS = [ARK_GENERAL_CHANNEL_ID, ADMIN_STUFF_CHANNEL_ID];

// Channels that are private ticket channels (tracked in memory)
const activeTickets = new Map(); // channelId -> { userId, username, stage, collectedData, issueType }

// ── Startup validation ────────────────────────────────────────────────────────
if (!DISCORD_BOT_TOKEN) { console.error('❌ FATAL: DISCORD_BOT_TOKEN not set'); process.exit(1); }
if (!WEBHOOK_URL) { console.error('❌ FATAL: ARKBOT_WEBHOOK_URL not set'); process.exit(1); }
console.log(`✅ Config OK — Webhook URL: ${WEBHOOK_URL}`);

// ── Keepalive ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('Helena Walker is alive 🦕'); })
  .listen(PORT, () => console.log(`🌐 Keepalive server running on port ${PORT}`));

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', () => {
  console.log(`✅ Helena Walker is online as ${client.user.tag}`);
  console.log(`📡 Ticket system active | Category: ${OPEN_TICKETS_CATEGORY_ID}`);
});

// ── Forward to webhook (for general public channel messages) ──────────────────
async function forwardToWebhook(payload) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET || '' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(`❌ Webhook returned ${response.status}: ${await response.text()}`);
      return null;
    }
    const result = await response.json();
    console.log(`✅ Forwarded [${payload.channel_name || payload.type}]:`, JSON.stringify(result));
    return result;
  } catch (err) {
    console.error(`❌ Webhook fetch failed:`, err.message);
    return null;
  }
}

// ── Discord API helpers ───────────────────────────────────────────────────────
async function discordAPI(method, path, body) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) console.error(`❌ Discord API ${method} ${path}:`, JSON.stringify(data));
  return data;
}

async function sendMessage(channelId, content) {
  return discordAPI('POST', `/channels/${channelId}/messages`, { content });
}

// ── Create private ticket channel ─────────────────────────────────────────────
async function createTicketChannel(guild, userId, username) {
  const ticketNum = String(Math.floor(1000 + Math.random() * 9000));
  const channelName = `ticket-${ticketNum}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: OPEN_TICKETS_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: BOT_USER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: ARK_ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  });

  console.log(`🎫 Created ticket channel: #${channelName} (${channel.id}) for ${username}`);
  return channel;
}

// ── Close a ticket channel ────────────────────────────────────────────────────
async function closeTicketChannel(channel, userId) {
  const newName = channel.name.replace('ticket-', 'closed-');
  await channel.setName(newName);
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: false,
    SendMessages: false,
  });
  console.log(`🔒 Closed ticket: #${newName}`);
}

// ── Classify issue ────────────────────────────────────────────────────────────
function classifyIssue(text) {
  const l = text.toLowerCase();
  if (l.includes('stuck') || l.includes('mesh') || l.includes('under the map')) return 'Stuck/Meshed';
  if (l.includes('lost') && (l.includes('dino') || l.includes('item') || l.includes('character') || l.includes('stuff'))) return 'Lost Dino/Items';
  if (l.includes('giga') || l.includes('rex') || l.includes('theri') || l.includes('argy') || l.includes('tame') || l.includes('breed')) return 'Dino Help';
  if (l.includes('hacker') || l.includes('cheat') || l.includes('exploit') || l.includes('report') || l.includes('rule break')) return 'Player Report';
  if (l.includes('bug') || l.includes('glitch') || l.includes('broken') || l.includes('crash')) return 'Bug/Glitch';
  if (l.includes('lag') || l.includes('server down') || l.includes('disconnect') || l.includes('offline')) return 'Server Issue';
  if (l.includes('ban') || l.includes('appeal')) return 'Ban Appeal';
  return 'General Support';
}

// ── Needs admin (can't be solved by bot) ─────────────────────────────────────
function needsAdmin(issueType) {
  return ['Stuck/Meshed', 'Lost Dino/Items', 'Player Report', 'Ban Appeal', 'Server Issue'].includes(issueType);
}

// ── Build follow-up questions ─────────────────────────────────────────────────
function getFollowUpQuestions(issueType) {
  switch (issueType) {
    case 'Stuck/Meshed':
      return `To get you unstuck I need:\n• **Which server/map** are you on?\n• **Your coordinates** (press **H** in-game)\n• How did you get stuck? (fell through mesh, structure, terrain?)`;
    case 'Lost Dino/Items':
      return `To investigate your loss:\n• **Which server/map** was it on?\n• **Dino name/species** or item description\n• **Your tribe name**\n• **Roughly when** did it disappear? (EST time)`;
    case 'Player Report':
      return `To process your report:\n• **Suspect's IGN and tribe name**\n• **Which server/map** did this happen on?\n• **What did they do?** (describe the exploit/rule break)\n• **Any evidence?** (screenshots, video links)`;
    case 'Bug/Glitch':
      return `To investigate the bug:\n• **Which server/map** are you on?\n• **Your coordinates** if relevant (press **H**)\n• **Describe exactly what's happening** — what did you expect vs what occurred?`;
    case 'Server Issue':
      return `To report this to the team:\n• **Which server/map** is affected?\n• **What are you experiencing?** (lag, crash, rollbacks, etc.)\n• **When did it start?** (EST time)`;
    case 'Ban Appeal':
      return `For your ban appeal:\n• **Your in-game name and tribe**\n• **When were you banned?** (EST date/time)\n• **Why do you believe the ban was incorrect?**`;
    default:
      return `Could you give me a bit more detail?\n• **Which server/map** are you on?\n• **Your in-game character name**\n• **Full description of your issue**`;
  }
}

// ── Handle ticket channel messages ───────────────────────────────────────────
async function handleTicketMessage(message) {
  const channelId = message.channel.id;
  const content = message.content.trim();
  const lower = content.toLowerCase();
  const ticket = activeTickets.get(channelId);

  if (!ticket) return;

  console.log(`🎫 [${message.channel.name}] Stage: ${ticket.stage} | Msg: "${content.substring(0, 60)}"`);

  // ── Stage: waiting for issue description ──────────────────────────────────
  if (ticket.stage === 'waiting_for_issue') {
    ticket.collectedData = content;
    ticket.issueType = classifyIssue(content);
    ticket.stage = 'waiting_for_details';
    activeTickets.set(channelId, ticket);

    const questions = getFollowUpQuestions(ticket.issueType);
    await sendMessage(channelId,
      `Got it — I'm logging this as a **${ticket.issueType}** issue.\n\n${questions}\n\n*(Reply with all the details above and I'll do my best to help!)*`
    );
    return;
  }

  // ── Stage: waiting for details ────────────────────────────────────────────
  if (ticket.stage === 'waiting_for_details') {
    ticket.collectedData += '\n' + content;
    ticket.stage = 'waiting_for_resolution_confirm';
    activeTickets.set(channelId, ticket);

    // Try to answer from knowledge base via webhook
    const result = await forwardToWebhook({
      type: 'ticket_resolve',
      channel_id: channelId,
      channel_name: message.channel.name,
      content: ticket.collectedData,
      issue_type: ticket.issueType,
      author: { id: ticket.userId, username: ticket.username, global_name: ticket.username, bot: false },
    });

    // If webhook didn't post a response (unrecognized), post a generic acknowledgement
    if (!result || result.action === 'no_response') {
      if (needsAdmin(ticket.issueType)) {
        // Skip to escalation for issues that require admin tools
        await escalateTicket(message.channel, ticket);
        return;
      }
      await sendMessage(channelId,
        `Thanks for the details! I've reviewed your issue.\n\nUnfortunately I don't have enough information to resolve this automatically — I'll escalate to a human admin.\n\n`
      );
      await escalateTicket(message.channel, ticket);
      return;
    }

    // Ask if resolved
    await sendMessage(channelId,
      `\n---\n✅ Did that resolve your issue? Please reply with **YES** or **NO**.`
    );
    return;
  }

  // ── Stage: waiting for YES/NO ─────────────────────────────────────────────
  if (ticket.stage === 'waiting_for_resolution_confirm') {
    if (lower === 'yes' || lower.includes('yes') || lower.includes('resolved') || lower.includes('fixed') || lower.includes('thanks') || lower.includes('thank you') || lower.includes('ty')) {
      ticket.stage = 'closed';
      activeTickets.set(channelId, ticket);
      await sendMessage(channelId,
        `🎉 Awesome! Glad I could help, **${ticket.username}**!\n\nI'm closing this ticket now. If you ever need help again, just open a new ticket. Happy surviving! 🦕`
      );
      await closeTicketChannel(message.channel, ticket.userId);
      await sendMessage(ADMIN_LOGS_CHANNEL_ID,
        `✅ **[Ticket Closed — Resolved]** <#${channelId}> | **${ticket.username}** | ${ticket.issueType}`
      );
    } else if (lower === 'no' || lower.includes('no') || lower.includes('still') || lower.includes('not fixed') || lower.includes('unresolved') || lower.includes('nope')) {
      await escalateTicket(message.channel, ticket);
    } else {
      await sendMessage(channelId, `Please reply with **YES** if your issue is resolved, or **NO** if you still need help.`);
    }
    return;
  }

  // ── Stage: escalated — just log, admins take over ─────────────────────────
  if (ticket.stage === 'escalated') {
    // Silently log, let admins handle it
    console.log(`📋 [${message.channel.name}] Escalated ticket message from ${ticket.username}: "${content.substring(0, 60)}"`);
    return;
  }
}

// ── Escalate ticket ───────────────────────────────────────────────────────────
async function escalateTicket(channel, ticket) {
  ticket.stage = 'escalated';
  activeTickets.set(channel.id, ticket);

  const summary = `**📋 Ticket Summary:**\n` +
    `• **Issue Type:** ${ticket.issueType}\n` +
    `• **Player:** ${ticket.username}\n` +
    `• **Details:** ${ticket.collectedData.substring(0, 300)}`;

  await sendMessage(channel.id,
    `${summary}\n\n` +
    `I've done my best to help but this needs a human admin. Escalating now!\n\n` +
    `<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}> — please review this ticket.\n\n` +
    `**${ticket.username}**, a human admin will be with you shortly. Please stay in this channel. 🙏`
  );

  await sendMessage(ADMIN_LOGS_CHANNEL_ID,
    `🚨 **[Ticket Escalated]** <#${channel.id}> | **${ticket.username}** | **${ticket.issueType}**\n` +
    `> ${ticket.collectedData.substring(0, 200)}\n\n` +
    `<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}>`
  );
  console.log(`🚨 Escalated ticket: #${channel.name} for ${ticket.username}`);
}

// ── Handle trigger channel (player types here to open ticket) ────────────────
async function handleTriggerChannel(message) {
  const guild = message.guild;
  const userId = message.author.id;
  const username = message.author.globalName || message.author.username;

  // Check if player already has an open ticket
  for (const [, ticket] of activeTickets) {
    if (ticket.userId === userId && ticket.stage !== 'closed') {
      await sendMessage(message.channel.id,
        `Hey **${username}**, you already have an open ticket! Check your existing ticket channel.`
      );
      return;
    }
  }

  // Delete trigger message to keep channel clean
  try { await message.delete(); } catch (_) {}

  // Create private ticket channel
  const ticketChannel = await createTicketChannel(guild, userId, username);

  // Register in activeTickets
  activeTickets.set(ticketChannel.id, {
    userId,
    username,
    stage: 'waiting_for_issue',
    collectedData: '',
    issueType: 'General Support',
  });

  // Welcome message in new private channel
  await sendMessage(ticketChannel.id,
    `👋 Hey <@${userId}>! I'm **Helena**, Skii's Lodge automated support assistant.\n\n` +
    `I've opened a private ticket just for you — **${ticketChannel.name}**.\n\n` +
    `Please describe your issue in as much detail as possible and I'll do my best to help!\n\n` +
    `*(If this is urgent and requires immediate admin attention, type **URGENT** and I'll escalate right away.)*`
  );

  // Also notify in trigger channel
  await sendMessage(message.channel.id,
    `🎫 <@${userId}> — your support ticket has been created! Check <#${ticketChannel.id}> 🦕`
  );

  console.log(`🎫 Ticket opened for ${username} → #${ticketChannel.name}`);
}

// ── Main message handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const content = message.content.trim();

  // 1. Active ticket channel
  if (activeTickets.has(channelId)) {
    // URGENT override
    if (content.toUpperCase() === 'URGENT') {
      const ticket = activeTickets.get(channelId);
      ticket.issueType = 'Urgent — Admin Required';
      ticket.collectedData = ticket.collectedData || 'Player marked as URGENT';
      await escalateTicket(message.channel, ticket);
      return;
    }
    await handleTicketMessage(message);
    return;
  }

  // 2. Support trigger channel — any message opens a ticket
  if (channelId === SUPPORT_TRIGGER_CHANNEL_ID) {
    await handleTriggerChannel(message);
    return;
  }

  // 3. Public channels — forward to webhook for Helena's general responses
  if (PUBLIC_CHANNELS.includes(channelId) || channelId === STAFF_CHAT_CHANNEL_ID) {
    console.log(`📨 [#${message.channel.name}] ${message.author.username}: "${content.substring(0, 80)}"`);
    await forwardToWebhook({
      type: 'message',
      id: message.id,
      channel_id: channelId,
      channel_name: message.channel.name,
      content,
      author: {
        id: message.author.id,
        username: message.author.username,
        global_name: message.author.globalName,
        bot: message.author.bot,
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
client.on('error', (err) => console.error('❌ Discord client error:', err.message));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled rejection:', reason));
process.on('uncaughtException', (err) => console.error('❌ Uncaught exception:', err.message));

// ── Login ─────────────────────────────────────────────────────────────────────
console.log('🔄 Connecting to Discord...');
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error('❌ FATAL: Discord login failed:', err.message);
  process.exit(1);
});
