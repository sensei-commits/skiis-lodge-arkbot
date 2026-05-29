const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

// ============================================================
//  CONFIG
// ============================================================

const DISCORD_TOKEN           = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID                = "636832636752625664";
const STATUS_EMBED_CHANNEL_ID = "1509809942968799252"; // #┃✅┃live-server-status
const UPDATE_INTERVAL_MINUTES = 5;

const ROLES = {
  admin:   "703389459747700807",   // Admin ⭐
  staff:   "703397175538876428",   // ARK Admin's⭐
  donator: "1318898666890858546",  // Platinum Donator (highest tier)
};

// ============================================================
//  SERVER STATUS
// ============================================================

const SERVERS = [
  { name: "Island",      bm_id: "36970150", channel_id: "1509809992998584321" },
  { name: "Center",      bm_id: null,        channel_id: "1509809996903481364" },
  { name: "Scorched",    bm_id: null,        channel_id: "1509810000015654953" },
  { name: "Aberration",  bm_id: null,        channel_id: "1509810002750214236" },
  { name: "Astraeos",    bm_id: null,        channel_id: "1509810005346488353" },
  { name: "Extinction",  bm_id: null,        channel_id: "1509810008462721075" },
  { name: "Ragnarok",    bm_id: "36968477",  channel_id: "1509810011394670683" },
  { name: "Valguero",    bm_id: null,        channel_id: "1509810015005966526" },
  { name: "Lost Colony", bm_id: "36950578",  channel_id: "1509810017572753411" },
  { name: "Club Ark",    bm_id: null,        channel_id: "1509810020903292958" },
  { name: "Forglar",     bm_id: "36970148",  channel_id: "1509810023679660175" },
  { name: "Svartlfheim", bm_id: null,        channel_id: "1509810026531782706" },
  { name: "Volcano",     bm_id: "36970154",  channel_id: "1509810029455343708" },
];

// ============================================================
//  CHANNEL SETUP STRUCTURE
// ============================================================

const CATEGORIES = [

  {
    name: "🦕 ┃ WELCOME TO THE LODGE",
    channels: [
      { name: "📜︱rules",           type: "text",         readOnly: true,  topic: "Server rules — read before playing." },
      { name: "📣︱announcements",    type: "announcement", readOnly: true,  topic: "Official Lodge announcements." },
      { name: "👋︱welcome",          type: "text",         readOnly: true,  topic: "Welcome to Skii's Lodge!" },
      { name: "🎭︱get-roles",        type: "text",                          topic: "React to get your roles here." },
      { name: "🚀︱get-started-here", type: "text",         readOnly: true,  topic: "New? Start here — everything you need to know." },
      { name: "🏆︱level-ups",        type: "text",         readOnly: true,  topic: "Level up announcements." },
      { name: "🎂︱birthdays",        type: "text",                          topic: "Share your birthday with the Lodge!" },
    ],
  },

  {
    name: "🗺️ ┃ ARK SERVER INFO",
    channels: [
      { name: "🏠︱ark-server-info",  type: "text", readOnly: true, topic: "Everything about our cluster — rules, rates, mods." },
      { name: "📊︱server-stats",     type: "text", readOnly: true, topic: "Server statistics and uptime records." },
      { name: "🔧︱cluster-changes",  type: "text", readOnly: true, topic: "Changelog for cluster updates, wipes, and mods." },
      { name: "📦︱ark-updates",      type: "text", readOnly: true, topic: "ARK patch notes and update info." },
      { name: "💡︱tips-and-tricks",  type: "text", readOnly: true, topic: "Survivor tips, starter guides, and useful tricks." },
      { name: "📋︱templates",        type: "text", readOnly: true, topic: "Useful copy-paste templates for tribes and builds." },
    ],
  },

  {
    name: "🦖 ┃ ARK ASCENDED",
    channels: [
      { name: "💬︱ark-general",          type: "text", topic: "General ARK chat — tames, builds, adventures." },
      { name: "🌐︱cluster-chat-in-game",  type: "text", topic: "Cross-server chat. Say hi from any map!" },
      { name: "📸︱screenshots",           type: "text", topic: "Show off your base, tames, and screenshots." },
      { name: "💱︱trading-chat",          type: "text", topic: "Trade dinos, items, and resources here." },
      { name: "🗳️︱ark-polls",             type: "text", topic: "Vote on cluster decisions and events." },
      { name: "🎉︱lodge-events",          type: "text", topic: "Community events, tournaments, and giveaways." },
      { name: "🛍️︱shops",                type: "text", topic: "Browse and advertise your in-game shops." },
      { name: "🎁︱birthday-rewards",      type: "text", topic: "Claim your birthday reward here!" },
      { name: "📦︱package-claim",         type: "text", topic: "Claim your starter or reward packages." },
      { name: "💭︱suggestions",           type: "text", topic: "Ideas for improving the cluster." },
      { name: "🎨︱art-misc",              type: "text", topic: "Fan art, memes, and off-topic content." },
      { name: "🤖︱ai",                    type: "text", topic: "AI chat and tools." },
    ],
  },

  {
    name: "💎 ┃ DONATORS",
    donatorOnly: true,
    channels: [
      { name: "💬︱supporter-chat",      type: "text", donatorOnly: true, topic: "Exclusive chat for our supporters." },
      { name: "👁️︱cluster-sneak-peaks", type: "text", donatorOnly: true, topic: "Early looks at upcoming cluster content." },
      { name: "💰︱donations",           type: "text", readOnly: true,    topic: "Info on how to support the Lodge." },
    ],
  },

  {
    name: "🎫 ┃ SUPPORT",
    channels: [
      { name: "🔴︱red-chat",       type: "text", staffOnly: true, topic: "Staff-only red alert channel." },
      { name: "🎫︱support-ticket", type: "text",                  topic: "Open a support ticket with staff here." },
    ],
  },

  {
    name: "🔧 ┃ STAFF",
    staffOnly: true,
    channels: [
      { name: "💬︱staff-chat",                type: "text", staffOnly: true, topic: "Staff discussion and coordination." },
      { name: "📋︱commands",                  type: "text", staffOnly: true, topic: "Bot commands reference." },
      { name: "💡︱staff-specific-topics",     type: "text", staffOnly: true, topic: "Topics staff need to track." },
      { name: "📡︱live-server-status",        type: "text", staffOnly: true, topic: "Live server connection details." },
      { name: "👥︱online-players",            type: "text", staffOnly: true, topic: "Current online player list." },
      { name: "📝︱registration-log",          type: "text", staffOnly: true, topic: "New player registration log." },
      { name: "✅︱to-do-list",               type: "text", staffOnly: true, topic: "Staff to-do items." },
      { name: "🖼️︱bot-images",               type: "text", staffOnly: true, topic: "Images used by bots." },
      { name: "📌︱cs-notes-to-keep-in-mind", type: "text", staffOnly: true, topic: "CS notes and reminders." },
      { name: "📖︱commands-list-refrence",    type: "text", staffOnly: true, topic: "Full command list reference." },
      { name: "⚠️︱ban-warnings",             type: "text", staffOnly: true, topic: "Ban and warning log." },
      { name: "⏰︱decay-info",               type: "text", staffOnly: true, topic: "Structure decay tracking." },
      { name: "🤖︱helper-bot-logs",          type: "text", staffOnly: true, topic: "Helper bot activity logs." },
    ],
  },

];

// ============================================================
//  INTERNALS
// ============================================================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let statusMessageId  = null;
const lastKnownState = {};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Channel Setup ─────────────────────────────────────────────

function buildPermissions(channel, category, guild) {
  const overwrites    = [];
  const everyone      = guild.roles.everyone;
  const isStaffOnly   = channel.staffOnly   || category.staffOnly;
  const isDonatorOnly = channel.donatorOnly || category.donatorOnly;
  const isReadOnly    = channel.readOnly;

  if (isStaffOnly) {
    overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    if (ROLES.staff) overwrites.push({ id: ROLES.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    if (ROLES.admin) overwrites.push({ id: ROLES.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  } else if (isDonatorOnly) {
    overwrites.push({ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
    if (ROLES.donator) overwrites.push({ id: ROLES.donator, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    if (ROLES.staff)   overwrites.push({ id: ROLES.staff,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    if (ROLES.admin)   overwrites.push({ id: ROLES.admin,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  } else if (isReadOnly) {
    overwrites.push({ id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] });
    if (ROLES.staff) overwrites.push({ id: ROLES.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    if (ROLES.admin) overwrites.push({ id: ROLES.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }

  return overwrites;
}

function getChannelType(type) {
  switch (type) {
    case "voice":        return ChannelType.GuildVoice;
    case "announcement": return ChannelType.GuildAnnouncement;
    default:             return ChannelType.GuildText;
  }
}

async function setupChannels(guild) {
  console.log("[Setup] Creating ARK-themed channels...");
  const existingCatNames  = new Set(guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => c.name.toLowerCase()));
  const existingChanNames = new Set(guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).map(c => c.name.toLowerCase()));
  let created = 0, skipped = 0;

  for (const categoryDef of CATEGORIES) {
    let category;
    const catKey = categoryDef.name.toLowerCase();

    if (existingCatNames.has(catKey)) {
      category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === catKey);
      skipped++;
    } else {
      try {
        category = await guild.channels.create({ name: categoryDef.name, type: ChannelType.GuildCategory });
        console.log(`[CREATE] Category: ${categoryDef.name}`);
        created++;
        await sleep(600);
      } catch (err) {
        console.error(`[ERROR] Category "${categoryDef.name}": ${err.message}`);
        continue;
      }
    }

    for (const ch of categoryDef.channels) {
      const chanKey = ch.name.toLowerCase();
      if (existingChanNames.has(chanKey)) { skipped++; continue; }
      try {
        const perms = buildPermissions(ch, categoryDef, guild);
        const opts  = {
          name:   ch.name,
          type:   getChannelType(ch.type),
          parent: category?.id,
          permissionOverwrites: perms.length ? perms : undefined,
        };
        if (ch.topic && ch.type !== "voice") opts.topic = ch.topic;
        await guild.channels.create(opts);
        console.log(`  [CREATE] ${ch.name}`);
        existingChanNames.add(chanKey);
        created++;
        await sleep(700);
      } catch (err) {
        console.error(`  [ERROR] "${ch.name}": ${err.message}`);
      }
    }
  }
  console.log(`[Setup] Done — Created: ${created}, Skipped: ${skipped}\n`);
}

// ── BattleMetrics ─────────────────────────────────────────────

async function fetchServerStatus(bmId) {
  try {
    const res = await fetch(`https://api.battlemetrics.com/servers/${bmId}`);
    if (!res.ok) return null;
    const json  = await res.json();
    const attrs = json.data.attributes;
    return { online: attrs.status === "online", players: attrs.players, maxPlayers: attrs.maxPlayers };
  } catch { return null; }
}

async function discoverMissingServers() {
  const missing = SERVERS.filter(s => s.bm_id === null);
  if (!missing.length) return;
  console.log(`[Discovery] Finding ${missing.length} missing BattleMetrics IDs...`);
  try {
    const res  = await fetch("https://api.battlemetrics.com/servers?filter[game]=arksa&filter[search]=Skii%27s+PVE&page[size]=25");
    if (!res.ok) return;
    const json = await res.json();
    for (const result of json.data) {
      const bmId   = result.id;
      const bmName = result.attributes.name.toLowerCase();
      for (const server of SERVERS) {
        if (server.bm_id !== null) continue;
        if (bmName.replace(/\s/g, "").includes(server.name.toLowerCase().replace(" ", ""))) {
          server.bm_id = bmId;
          console.log(`[Discovery] ${server.name} → ${bmId}`);
          break;
        }
      }
    }
  } catch (err) { console.error("[Discovery] Error:", err.message); }
}

// ── Status Embed ──────────────────────────────────────────────

function playerBar(players, maxPlayers, length = 10) {
  if (!maxPlayers) return "";
  const filled = Math.round((players / maxPlayers) * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function buildEmbed(results) {
  const onlineCount = results.filter(r => r.data?.online).length;
  const lines = results.map(({ server, data }) => {
    if (!data)        return `⚫  **${server.name}** — unavailable`;
    if (!data.online) return `🔴  **${server.name}** — offline`;
    return `🟢  **${server.name}**  •  \`${data.players}/${data.maxPlayers}\``;
  });
  return new EmbedBuilder()
    .setTitle("🦕  Skii's Lodge — Live Server Status")
    .setColor(0x1ec864)
    .setDescription(`**${onlineCount}/${results.length}** servers online\n──────────────────────────────\n${lines.join("\n")}`)
    .setFooter({ text: "Updates every 5 minutes  •  BattleMetrics" })
    .setTimestamp();
}

// ── Poll Servers ──────────────────────────────────────────────

async function pollServers() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const results = await Promise.all(
    SERVERS.map(async (server) => ({
      server,
      data: server.bm_id ? await fetchServerStatus(server.bm_id) : null,
    }))
  );

  for (const { server, data } of results) {
    const newName = !data ? `⚫︱${server.name}` : !data.online ? `🔴︱${server.name}` : `🟢︱${server.name} - ${data.players}/${data.maxPlayers}`;
    if (newName !== lastKnownState[server.name]) {
      lastKnownState[server.name] = newName;
      if (server.channel_id) {
        try {
          const ch = guild.channels.cache.get(server.channel_id);
          if (ch && ch.name !== newName) { await ch.setName(newName); await sleep(1500); }
        } catch (err) { console.warn(`[Channel] ${server.name}: ${err.message}`); }
      }
    }
  }

  const statusChannel = guild.channels.cache.get(STATUS_EMBED_CHANNEL_ID);
  if (!statusChannel) return;
  const embed = buildEmbed(results);

  if (statusMessageId) {
    try {
      const msg = await statusChannel.messages.fetch(statusMessageId);
      await msg.edit({ embeds: [embed] });
      console.log("[Embed] Updated.");
      return;
    } catch { statusMessageId = null; }
  }
  const msg = await statusChannel.send({ embeds: [embed] });
  statusMessageId = msg.id;
  console.log(`[Embed] Posted (ID: ${msg.id})`);
}

// ── Bot Ready ─────────────────────────────────────────────────

client.once("ready", async () => {
  console.log(`[Bot] Logged in as ${client.user.tag}\n`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error("[Error] Guild not found."); process.exit(1); }

  await setupChannels(guild);
  await discoverMissingServers();
  await pollServers();
  setInterval(pollServers, UPDATE_INTERVAL_MINUTES * 60 * 1000);
});

client.login(DISCORD_TOKEN);
