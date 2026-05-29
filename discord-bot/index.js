const {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, Partials,
} = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const fetch     = require('node-fetch');
const http      = require('http');

// ── Secrets (Railway env vars) ────────────────────────────────────────────────
const DISCORD_BOT_TOKEN     = process.env.DISCORD_BOT_TOKEN;
const WEBHOOK_URL           = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET        = process.env.DISCORD_WEBHOOK_SECRET;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY;
const BATTLEMETRICS_API_KEY = process.env.BATTLEMETRICS_API_KEY || '';
const BATTLEMETRICS_ORG_ID  = process.env.BATTLEMETRICS_ORG_ID  || '';

// ── IDs ───────────────────────────────────────────────────────────────────────
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
const ARK_ADMIN_ROLE_ID          = '1242319323145166848';
const BOT_USER_ID                = '1507730299356708984';

// ── Channel name constants (used for name-based lookups) ──────────────────────
const SUPPORT_TICKET_CHANNEL_NAME = 'support-ticket';
const ROLES_CHANNEL_NAME          = 'get-roles';
const ADMIN_CONSOLE_CHANNEL_NAME  = 'admin-console';
const STAFF_CHAT_CHANNEL_NAME     = 'staff-chat';
const POLLS_CHANNEL_NAME          = 'ark-polls';
const ADMIN_ROLE_NAME             = 'Admin';

// ── Colors ────────────────────────────────────────────────────────────────────
const COLORS = {
  orange: 0xFF6B1A,
  blue:   0x1A8CFF,
  purple: 0x7B2FBE,
  white:  0xF5F0E8,
  green:  0x2ECC71,
  red:    0xE74C3C,
  yellow: 0xF1C40F,
};

// ── Cluster data (mutable via admin actions) ──────────────────────────────────
let MAPS = [
  { name: 'The Island',     emoji: '🏝️' },
  { name: 'The Center',     emoji: '🌀' },
  { name: 'Scorched Earth', emoji: '🏜️' },
  { name: 'Forglar',        emoji: '🌊' },
  { name: 'Aberration',     emoji: '🌑' },
  { name: 'Club Ark',       emoji: '🎉' },
  { name: 'Svartlfheim',    emoji: '❄️' },
  { name: 'Astraeos',       emoji: '🌌' },
  { name: 'Extinction',     emoji: '☄️' },
  { name: 'Volcano',        emoji: '🔥' },
  { name: 'Valguero',       emoji: '🦕' },
  { name: 'Lost Colony',    emoji: '🚀' },
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

// ── State ─────────────────────────────────────────────────────────────────────
const conversationHistory = {};
const escalatedTickets    = new Set();

// ── Startup validation ────────────────────────────────────────────────────────
if (!DISCORD_BOT_TOKEN) { console.error('❌ FATAL: DISCORD_BOT_TOKEN not set'); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error('⚠️  WARNING: ANTHROPIC_API_KEY not set — AI responses disabled'); }
console.log(`✅ Config OK | AI: ${ANTHROPIC_API_KEY ? 'enabled' : 'DISABLED'}`);

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

// ── BattleMetrics ─────────────────────────────────────────────────────────────
async function getBMServers() {
  if (!BATTLEMETRICS_API_KEY || !BATTLEMETRICS_ORG_ID) return [];
  try {
    const res  = await fetch(
      `https://api.battlemetrics.com/servers?filter[organizations]=${BATTLEMETRICS_ORG_ID}&page[size]=25`,
      { headers: { Authorization: `Bearer ${BATTLEMETRICS_API_KEY}` } }
    );
    const json = await res.json();
    return json.data || [];
  } catch (err) { console.error('❌ BattleMetrics error:', err.message); return []; }
}

// ── Forward to ArkBot webhook ─────────────────────────────────────────────────
async function forwardToWebhook(payload) {
  if (!WEBHOOK_URL) return null;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { console.error(`❌ Webhook ${res.status}: ${await res.text()}`); return null; }
    return await res.json();
  } catch (err) { console.error(`❌ Webhook error: ${err.message}`); return null; }
}

// ── Helper: check if member is admin ─────────────────────────────────────────
async function isAdminMember(guild, userId) {
  try {
    await guild.roles.fetch();
    const member    = await guild.members.fetch(userId);
    const adminRole = guild.roles.cache.find(r => r.name.toLowerCase() === ADMIN_ROLE_NAME.toLowerCase());
    if (!adminRole) { console.warn('⚠️ Admin role not found — allowing response'); return false; }
    return member.roles.cache.has(adminRole.id) ||
           member.roles.cache.has(ADMIN_ROLE_ID) ||
           member.roles.cache.has(ARK_ADMIN_ROLE_ID);
  } catch (err) { console.error('❌ isAdminMember error:', err.message); return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI BRAIN — TICKET SUPPORT
// ─────────────────────────────────────────────────────────────────────────────
async function handleTicketMessage(message, guild, isFirstMessage = false) {
  if (!anthropic) {
    await message.channel.send('❌ AI brain offline — set `ANTHROPIC_API_KEY` in Railway. An admin will be with you shortly.');
    return;
  }

  const channelId = message.channel.id;
  if (!conversationHistory[channelId]) conversationHistory[channelId] = [];

  if (!isFirstMessage) {
    conversationHistory[channelId].push({
      role: 'user',
      content: `[${message.member.displayName}]: ${message.content}`,
    });
  }

  if (conversationHistory[channelId].length > 30) {
    conversationHistory[channelId] = conversationHistory[channelId].slice(-30);
  }

  const systemPrompt = `You are Helena, the support assistant for Skii's Lodge — an ARK Survival Ascended cluster. You are warm, helpful, and knowledgeable. You speak naturally and conversationally, never like a bot.

Your job is to help players resolve their issues. You have deep knowledge of ARK Survival Ascended:
- Taming: food, effectiveness, knockout methods, torpor drain for all creatures
- Breeding: imprinting, mutations (20/20 cap), stat inheritance, maturation timers
- All cluster maps: The Island, The Center, Scorched Earth, Forglar, Aberration, Club Ark, Svartlfheim, Astraeos, Extinction, Volcano, Valguero, Lost Colony
- Base building, electricity, TEK tier, engrams, crafting
- Boss fights, artifacts, terminals, ascension
- Tribes, alliances, permissions, tribe logs
- Common ASA bugs and workarounds
- Server rules: PVE, turrets set to wild creatures only (inside base or TEK shield can be all targets), no building at spawn points, no blocking artifacts, taming traps must be removed within 12 hours
- Server rates: 2.5x taming, 2.5x harvesting, 2.5x XP, 10x maturation, 20x egg hatch, 10x imprint, 0.15x cuddle interval
- Server admins: Skidogg, iNFAMOUS, Remi, Captain Rhynio

Response strategy:
1. Try to fully resolve the issue yourself with clear, helpful info
2. If it genuinely requires admin action (tame/item restoration, player bans, base wipes, server-side fixes, tribe log reviews) add [ESCALATE] at the very end of your message
3. When resolved, tell the player they can close the ticket with the 🔒 button
4. Be warm and patient — players may be frustrated

Add [ESCALATE] ONLY when admin intervention is truly needed. Do NOT add it for questions, how-to queries, rule clarifications, or anything you can answer yourself.`;

  try {
    const messages = isFirstMessage
      ? [{ role: 'user', content: conversationHistory[channelId][0]?.content || 'A player just opened a support ticket.' }]
      : conversationHistory[channelId];

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    const fullReply      = response.content[0].text;
    const shouldEscalate = fullReply.includes('[ESCALATE]');
    const cleanReply     = fullReply.replace('[ESCALATE]', '').trim();

    conversationHistory[channelId].push({ role: 'assistant', content: cleanReply });

    await sendEmbed(channelId,
      new EmbedBuilder()
        .setDescription(cleanReply)
        .setColor(shouldEscalate ? COLORS.yellow : COLORS.blue)
        .setFooter({ text: 'Helena • Support' })
        .setTimestamp()
    );

    if (shouldEscalate && !escalatedTickets.has(channelId)) {
      escalatedTickets.add(channelId);

      await sendEmbed(channelId,
        new EmbedBuilder()
          .setTitle('🚨  ADMIN ATTENTION NEEDED')
          .setDescription(`<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}> — this ticket requires admin assistance.\n\nHelena has reviewed the issue and determined it needs a human admin to resolve.`)
          .setColor(COLORS.red)
          .setFooter({ text: 'Helena • Escalated Ticket' })
          .setTimestamp()
      );

      await sendMessage(ADMIN_LOGS_CHANNEL_ID,
        `🚨 **[Auto-Escalated]** <#${channelId}> | **${message.member.displayName}** | Needs admin review\n<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}>`
      );

      console.log(`🚨 Auto-escalated ticket ${channelId} for ${message.member.displayName}`);
    }

  } catch (err) {
    console.error('❌ Anthropic ticket error:', err.message);
    await message.channel.send('❌ I ran into an issue. An admin will be with you shortly.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI BRAIN — ADMIN CONSOLE / STAFF CHAT
// ─────────────────────────────────────────────────────────────────────────────
async function handleHelenaMessage(message, guild) {
  if (!anthropic) {
    await message.channel.send('❌ AI brain offline — set `ANTHROPIC_API_KEY` in Railway env vars.');
    return;
  }

  const channelId = message.channel.id;
  if (!conversationHistory[channelId]) conversationHistory[channelId] = [];

  conversationHistory[channelId].push({
    role: 'user',
    content: `[${message.member.displayName}]: ${message.content}`,
  });

  if (conversationHistory[channelId].length > 20) {
    conversationHistory[channelId] = conversationHistory[channelId].slice(-20);
  }

  const servers    = await getBMServers();
  const serverList = servers.length
    ? servers.map(s => `${s.attributes.name} — ${s.attributes.status} — ${s.attributes.players}/${s.attributes.maxPlayers}`).join('\n')
    : 'BattleMetrics not configured.';

  const systemPrompt = `You are Helena, the intelligent admin assistant for Skii's Lodge — an ARK Survival Ascended cluster. You are sharp, calm, and direct. You speak naturally like a trusted team member. You only respond in #admin-console and #staff-chat.

When an admin asks you to take action, respond naturally AND append an action tag at the END of your message:

[ACTION:action_name:param1:param2:...]

Available actions:
- [ACTION:poll:question|option1|option2|option3:durationHours] — Post a poll to #ark-polls
- [ACTION:add_map:mapName:emoji] — Add a map to the cluster
- [ACTION:remove_map:mapName] — Remove a map from the cluster
- [ACTION:add_ticket_category:name:emoji:description] — Add a ticket category
- [ACTION:remove_ticket_category:name] — Remove a ticket category
- [ACTION:online] — Show live player counts from BattleMetrics

Current cluster servers:
${serverList}

Current maps: ${MAPS.map(m => m.name).join(', ')}
Current ticket categories: ${TICKET_CATEGORIES.map(c => c.name).join(', ')}
Server admins: Skidogg, iNFAMOUS, Remi, Captain Rhynio

Respond naturally first, action tag last. If no action needed, respond normally with no action tag.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory[channelId],
    });

    const fullReply  = response.content[0].text;
    const cleanReply = fullReply.replace(/\[ACTION:[^\]]+\]/g, '').trim();
    const actions    = fullReply.match(/\[ACTION:[^\]]+\]/g) || [];

    conversationHistory[channelId].push({ role: 'assistant', content: fullReply });

    await sendEmbed(channelId,
      new EmbedBuilder()
        .setDescription(cleanReply)
        .setColor(COLORS.purple)
        .setFooter({ text: 'Helena • Admin Console' })
        .setTimestamp()
    );

    for (const actionStr of actions) {
      await executeAction(actionStr, message, guild);
    }

  } catch (err) {
    console.error('❌ Anthropic admin error:', err.message);
    await message.channel.send('❌ I ran into an issue. Please try again.');
  }
}

// ── Admin action executor ─────────────────────────────────────────────────────
async function executeAction(actionStr, message, guild) {
  const inner  = actionStr.replace('[ACTION:', '').replace(']', '');
  const parts  = inner.split(':');
  const action = parts[0];

  console.log(`⚙️ Admin action: ${action} | ${parts.slice(1).join(' | ')}`);

  switch (action) {

    case 'online': {
      const servers = await getBMServers();
      if (!servers.length) {
        await sendEmbed(message.channel.id, new EmbedBuilder().setTitle('🖥️ Server Status').setDescription('BattleMetrics not configured.').setColor(COLORS.red));
        return;
      }
      const embed = new EmbedBuilder().setTitle('🖥️  CLUSTER STATUS').setColor(COLORS.blue).setFooter({ text: 'Helena • BattleMetrics' }).setTimestamp();
      let total = 0;
      for (const s of servers) {
        const a = s.attributes;
        embed.addFields({ name: `${a.status === 'online' ? '🟢' : '🔴'} ${a.name}`, value: `**${a.players}/${a.maxPlayers}** players`, inline: true });
        total += a.players || 0;
      }
      embed.setDescription(`**Total players online: ${total}**`);
      await sendEmbed(message.channel.id, embed);
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
      const pollEmbed = new EmbedBuilder()
        .setTitle(`📊  ${question}`)
        .setDescription(answers.map((a, i) => `${['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i] || `${i+1}.`} ${a}`).join('\n') + `\n\n⏱️ Duration: **${durationHrs} hours**`)
        .setColor(COLORS.blue).setFooter({ text: 'Helena • Polls — React to vote!' }).setTimestamp();
      await sendEmbed(POLLS_CHANNEL_ID, pollEmbed);
      await sendEmbed(message.channel.id,
        new EmbedBuilder().setTitle('📊  POLL PUBLISHED').setDescription(`**Q:** ${question}\n**Options:** ${answers.join(', ')}\n**Duration:** ${durationHrs}h\n\nPosted to <#${POLLS_CHANNEL_ID}>`).setColor(COLORS.green).setFooter({ text: 'Helena • Polls' }).setTimestamp()
      );
      break;
    }

    case 'add_map': {
      const mapName = parts[1]; const mapEmoji = parts[2] || '🗺️';
      if (!MAPS.find(m => m.name === mapName)) {
        MAPS.push({ name: mapName, emoji: mapEmoji });
        await sendEmbed(message.channel.id, new EmbedBuilder().setTitle('✅  MAP ADDED').setDescription(`**${mapEmoji} ${mapName}** added.\n\nRestart to update #get-roles.`).setColor(COLORS.green).setFooter({ text: 'Helena • Config' }).setTimestamp());
      } else { await sendMessage(message.channel.id, `⚠️ **${mapName}** is already in the config.`); }
      break;
    }

    case 'remove_map': {
      const mapName = parts[1];
      const idx     = MAPS.findIndex(m => m.name === mapName);
      if (idx !== -1) {
        MAPS.splice(idx, 1);
        await sendEmbed(message.channel.id, new EmbedBuilder().setTitle('✅  MAP REMOVED').setDescription(`**${mapName}** removed.\n\nRestart to update #get-roles.`).setColor(COLORS.orange).setFooter({ text: 'Helena • Config' }).setTimestamp());
      } else { await sendMessage(message.channel.id, `⚠️ Map **"${mapName}"** not found.`); }
      break;
    }

    case 'add_ticket_category': {
      const catName = parts[1]; const catEmoji = parts[2] || '📋'; const catDesc = parts.slice(3).join(':') || 'Support category';
      const catKey  = catName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!TICKET_CATEGORIES.find(c => c.name === catName)) {
        TICKET_CATEGORIES.push({ name: catName, emoji: catEmoji, description: catDesc, key: catKey });
        await sendEmbed(message.channel.id, new EmbedBuilder().setTitle('✅  CATEGORY ADDED').setDescription(`**${catEmoji} ${catName}** added.\n\nRestart to update the ticket panel.`).setColor(COLORS.green).setFooter({ text: 'Helena • Config' }).setTimestamp());
      } else { await sendMessage(message.channel.id, `⚠️ Category **"${catName}"** already exists.`); }
      break;
    }

    case 'remove_ticket_category': {
      const catName = parts[1];
      const idx     = TICKET_CATEGORIES.findIndex(c => c.name === catName);
      if (idx !== -1) {
        TICKET_CATEGORIES.splice(idx, 1);
        await sendEmbed(message.channel.id, new EmbedBuilder().setTitle('✅  CATEGORY REMOVED').setDescription(`**${catName}** removed.\n\nRestart to update the ticket panel.`).setColor(COLORS.orange).setFooter({ text: 'Helena • Config' }).setTimestamp());
      } else { await sendMessage(message.channel.id, `⚠️ Category **"${catName}"** not found.`); }
      break;
    }

    default: console.log(`⚠️ Unknown action: ${action}`);
  }
}

// ── Role embeds ───────────────────────────────────────────────────────────────
async function postRoleEmbeds(guild) {
  const rolesChannel = guild.channels.cache.find(c => c.name === ROLES_CHANNEL_NAME && c.type === ChannelType.GuildText);
  if (!rolesChannel) return console.error(`❌ Could not find #${ROLES_CHANNEL_NAME}`);

  const messages = await rolesChannel.messages.fetch({ limit: 20 });
  if (messages.some(m => m.author.id === client.user.id)) return console.log('ℹ️ Role embeds already posted.');

  await rolesChannel.send({
    embeds: [new EmbedBuilder().setTitle('🗺️  SELECT YOUR MAP ROLES').setDescription('Select the maps you play on!\nYou can select multiple maps.').setColor(COLORS.blue).setFooter({ text: 'Helena • Cluster Roles' }).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('map_roles').setPlaceholder('🗺️ Select your maps...').setMinValues(1).setMaxValues(MAPS.length).addOptions(MAPS.map(m => ({ label: m.name, value: m.name, emoji: m.emoji }))))],
  });

  await rolesChannel.send({
    embeds: [new EmbedBuilder().setTitle('🎮  SELECT YOUR PLATFORM ROLE').setDescription('Let us know what platform you play on!').setColor(COLORS.orange).setFooter({ text: 'Helena • Cluster Roles' }).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('platform_roles').setPlaceholder('🎮 Select your platform...').setMinValues(1).setMaxValues(1).addOptions(PLATFORMS.map(p => ({ label: p.name, value: p.name, emoji: p.emoji }))))],
  });

  console.log('✅ Role embeds posted!');
}

// ── Ticket panel ──────────────────────────────────────────────────────────────
async function postTicketPanel(guild) {
  const ticketChannel = guild.channels.cache.find(c => c.name === SUPPORT_TICKET_CHANNEL_NAME && c.type === ChannelType.GuildText);
  if (!ticketChannel) return console.error(`❌ Could not find #${SUPPORT_TICKET_CHANNEL_NAME}`);

  const messages = await ticketChannel.messages.fetch({ limit: 20 });
  if (messages.some(m => m.author.id === client.user.id)) return console.log('ℹ️ Ticket panel already posted.');

  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎫  SUPPORT TICKETS')
    .setDescription(
      'Need help? Click a button below or just type your issue — Helena will respond immediately!\n\n' +
      TICKET_CATEGORIES.map(c => `${c.emoji} **${c.name}** — ${c.description}`).join('\n') +
      '\n\n*A private channel will be created for you. Helena will respond instantly and escalate to an admin if needed.*'
    )
    .setColor(COLORS.purple).setFooter({ text: 'Helena • Support System' }).setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    TICKET_CATEGORIES.slice(0, 3).map(cat =>
      new ButtonBuilder()
        .setCustomId(`open_ticket_${cat.key}`)
        .setLabel(cat.name).setEmoji(cat.emoji).setStyle(ButtonStyle.Secondary)
    )
  );
  const row2 = new ActionRowBuilder().addComponents(
    TICKET_CATEGORIES.slice(3).map(cat =>
      new ButtonBuilder()
        .setCustomId(`open_ticket_${cat.key}`)
        .setLabel(cat.name).setEmoji(cat.emoji).setStyle(ButtonStyle.Secondary)
    )
  );

  await ticketChannel.send({ embeds: [ticketEmbed], components: [row1, row2] });
  console.log('✅ Ticket panel posted!');
}

// ── Startup online message ────────────────────────────────────────────────────
async function postOnlineMessage(guild) {
  const startTs = Math.floor(Date.now() / 1000);

  for (const [channelName, label] of [
    [ADMIN_CONSOLE_CHANNEL_NAME, 'Admin Console'],
    [STAFF_CHAT_CHANNEL_NAME,    'Staff Chat'],
  ]) {
    const channel = guild.channels.cache.find(c => c.name === channelName && c.type === ChannelType.GuildText);
    if (!channel) { console.error(`❌ Could not find #${channelName}`); continue; }

    const isAdmin = label === 'Admin Console';
    const embed = new EmbedBuilder()
      .setTitle('🟢  HELENA IS ONLINE')
      .setDescription(
        `Systems are up and I am ready to go.\n\n` +
        `🤖 **AI Brain:** ${ANTHROPIC_API_KEY ? '✅ Active' : '❌ Disabled — set ANTHROPIC_API_KEY in Railway'}\n` +
        `🕐 **Started:** <t:${startTs}:F>\n\n` +
        (isAdmin
          ? `*Talk to me naturally — polls, config changes, server status, and more. I am also actively monitoring support tickets and responding to players automatically.*`
          : `*I am online and monitoring tickets. Talk to me here if you need anything.*`)
      )
      .setColor(COLORS.green).setFooter({ text: `Helena • ${label}` }).setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`✅ Online message → #${channelName}`);
  }
}

// ── Create ticket channel ─────────────────────────────────────────────────────
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
      `Hey ${member}! 👋\n\nI'm Helena, the cluster assistant. I've received your message and I'm looking into it right now.\n\n` +
      (originalMessage ? `📝 **Your message:** ${originalMessage}\n\n` : '') +
      `📋 **Category:** ${cat.name}\n🕐 **Opened:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
      `*If your issue needs an admin I will escalate it automatically. You can close this ticket at any time using the button below.*`
    )
    .setColor(COLORS.green).setFooter({ text: 'Helena • Support Ticket — OPEN' }).setTimestamp();

  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({ embeds: [ticketEmbed], components: [closeButton] });
  console.log(`✅ Ticket #${ticketChannel.name} opened for ${member.user.username} [${cat.name}]`);
  return { channel: ticketChannel };
}

// ── Create roles ──────────────────────────────────────────────────────────────
async function createRoles(guild) {
  console.log('🔨 Creating roles...');
  const existingRoles = guild.roles.cache.map(r => r.name);
  for (const map of MAPS) {
    if (!existingRoles.includes(map.name)) {
      await guild.roles.create({ name: map.name, color: COLORS.orange, mentionable: true, reason: 'Helena - Map Role' });
    }
  }
  for (const platform of PLATFORMS) {
    if (!existingRoles.includes(platform.name)) {
      await guild.roles.create({ name: platform.name, color: COLORS.blue, mentionable: true, reason: 'Helena - Platform Role' });
    }
  }
  for (const category of TICKET_CATEGORIES) {
    const roleName = `Ticket - ${category.name}`;
    if (!existingRoles.includes(roleName)) {
      await guild.roles.create({ name: roleName, color: COLORS.purple, mentionable: false, reason: 'Helena - Ticket Role' });
    }
  }
  console.log('✅ All roles created!');
}

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.once('ready', async () => {
  console.log(`✅ Helena is online as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.error('❌ Guild not found.');
  await createRoles(guild);
  await new Promise(r => setTimeout(r, 2000));
  await postRoleEmbeds(guild);
  await postTicketPanel(guild);
  await postOnlineMessage(guild);
  console.log('✅ Helena v2.0.0 setup complete!');
});

// ── Interaction handler ───────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // Map roles
  if (interaction.isStringSelectMenu() && interaction.customId === 'map_roles') {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    for (const map of MAPS) {
      const role = guild.roles.cache.find(r => r.name === map.name);
      if (role && member.roles.cache.has(role.id)) await member.roles.remove(role).catch(() => {});
    }
    const added = [];
    for (const val of interaction.values) {
      const role = guild.roles.cache.find(r => r.name === val);
      if (role) { await member.roles.add(role).catch(() => {}); added.push(val); }
    }
    await interaction.editReply({ content: `✅ Map roles updated!\n🗺️ **Active Maps:** ${added.join(', ')}` });
  }

  // Platform roles
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
    await interaction.editReply({ content: `✅ Platform updated!\n${platform?.emoji || '🎮'} **Platform:** ${interaction.values[0]}` });
  }

  // Ticket open buttons
  if (interaction.isButton() && interaction.customId.startsWith('open_ticket_')) {
    const key = interaction.customId.replace('open_ticket_', '');
    const cat = TICKET_CATEGORIES.find(c => c.key === key);
    if (!cat) return interaction.reply({ content: '❌ Unknown ticket category.', ephemeral: true });

    const { guild, member } = interaction;
    const existing = guild.channels.cache.find(c => c.name.startsWith(`open-${member.user.username.toLowerCase()}`));
    if (existing) return interaction.reply({ content: `⚠️ You already have an open ticket in <#${existing.id}>!`, ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const result = await createTicketChannel(guild, member, cat);

    if (result.channel) {
      conversationHistory[result.channel.id] = [
        { role: 'user', content: `[${member.displayName}]: I need help with ${cat.name}` }
      ];
      const fakeMsg = { channel: result.channel, member, content: `I need help with ${cat.name}`, author: interaction.user };
      await handleTicketMessage(fakeMsg, guild, true);
      await interaction.editReply({ content: `✅ Ticket opened! Head to <#${result.channel.id}> — Helena is already there. 🦖` });
    }
  }

  // Close ticket
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    await interaction.deferReply({ ephemeral: false });
    const channel = interaction.channel;
    const member  = interaction.member;
    await channel.setName(channel.name.replace('open-', 'closed-').replace('ticket-', 'closed-')).catch(() => {});
    await channel.permissionOverwrites.edit(member.id, { SendMessages: false }).catch(() => {});
    escalatedTickets.delete(channel.id);
    delete conversationHistory[channel.id];

    const closedEmbed = new EmbedBuilder()
      .setTitle('🔒  TICKET CLOSED')
      .setDescription(`This ticket has been closed by ${member}.\n\n🕐 **Closed:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n*An admin can delete this channel once the issue is resolved.*`)
      .setColor(COLORS.red).setFooter({ text: 'Helena • Support Ticket — CLOSED' }).setTimestamp();

    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete Ticket').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    await interaction.editReply({ embeds: [closedEmbed], components: [deleteButton] });
    await sendMessage(ADMIN_LOGS_CHANNEL_ID, `🔒 **[Ticket Closed]** <#${channel.id}> by <@${member.id}>`);
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
  try {
    if (message.author.bot) return;
    const guild = message.guild;
    if (!guild) return;

    // Ensure member is fully fetched
    let member = message.member;
    if (!member) {
      try { member = await guild.members.fetch(message.author.id); } catch { return; }
    }

    const channelId   = message.channel.id;
    const channelName = message.channel.name;
    console.log(`📨 [#${channelName}] ${member.displayName}: "${message.content.substring(0, 60)}"`);

    // #admin-console or #staff-chat — admin AI brain
    if (channelName === ADMIN_CONSOLE_CHANNEL_NAME || channelName === STAFF_CHAT_CHANNEL_NAME) {
      console.log(`🧠 Helena triggered in #${channelName}`);
      const adminCheck = await isAdminMember(guild, message.author.id);
      if (!adminCheck) { console.log(`🚫 Non-admin blocked in #${channelName}`); return; }
      await handleHelenaMessage(message, guild);
      return;
    }

    // open-* ticket channels — Helena responds to players, stays quiet for admins post-escalation
    if (channelName.startsWith('open-')) {
      console.log(`🎫 Message in ticket #${channelName}`);
      const adminCheck = await isAdminMember(guild, message.author.id);
      if (adminCheck) { console.log(`🛡️ Admin in ticket — Helena standing by.`); return; }
      await handleTicketMessage(message, guild, false);
      return;
    }

    // #support-ticket — auto ticket creation + message forwarding
    if (channelId === SUPPORT_TRIGGER_CHANNEL_ID) {
      console.log(`🎟️ Player typed in #support-ticket — creating ticket for ${member.displayName}`);
      const originalContent = message.content;

      deleteMessage(channelId, message.id).catch(() => {});

      const existingChannel = guild.channels.cache.find(
        c => c.name.startsWith(`open-${message.author.username.toLowerCase()}`)
      );

      if (existingChannel) {
        console.log(`📂 Existing ticket found — forwarding.`);
        await existingChannel.send({
          embeds: [new EmbedBuilder()
            .setDescription(`📨 **${member.displayName}** sent a new message:\n\n${originalContent}`)
            .setColor(COLORS.orange).setFooter({ text: 'Helena • Forwarded Message' }).setTimestamp()],
        });
        conversationHistory[existingChannel.id] = conversationHistory[existingChannel.id] || [];
        conversationHistory[existingChannel.id].push({ role: 'user', content: `[${member.displayName}]: ${originalContent}` });
        const fakeMsg = { channel: existingChannel, member, content: originalContent, author: message.author };
        await handleTicketMessage(fakeMsg, guild, false);
        return;
      }

      const result = await createTicketChannel(guild, member, TICKET_CATEGORIES[0], originalContent);
      if (result.channel) {
        console.log(`✅ New ticket: #${result.channel.name}`);
        conversationHistory[result.channel.id] = [
          { role: 'user', content: `[${member.displayName}]: ${originalContent}` }
        ];
        const fakeMsg = { channel: result.channel, member, content: originalContent, author: message.author };
        await handleTicketMessage(fakeMsg, guild, true);
        await sendMessage(channelId, `🎫 <@${member.user.id}> — your ticket is open! Head to <#${result.channel.id}> 🦕`);
      }
      return;
    }

    // #ai channel — !ai prefix only, forward to ArkBot webhook
    if (channelId === AI_CHANNEL_ID) {
      if (!message.content.trim().toLowerCase().startsWith('!ai')) return;
      await forwardToWebhook({
        type: 'message', id: message.id, channel_id: channelId, channel_name: channelName,
        content: message.content,
        author: { id: message.author.id, username: message.author.username, global_name: message.author.globalName, bot: false },
      });
      return;
    }

    // All other channels — silent

  } catch (err) {
    console.error('❌ Unhandled error in messageCreate:', err.message);
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
client.login(DISCORD_BOT_TOKEN).catch((err) => { console.error('❌ Login failed:', err.message); process.exit(1); });
