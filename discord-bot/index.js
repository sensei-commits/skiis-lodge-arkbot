const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  REST,
  Routes,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  Partials,
} = require("discord.js");
const Anthropic = require("@anthropic-ai/sdk");
const fetch     = require("node-fetch");
const http      = require("http");

// RCON — run: npm install rcon-client
let Rcon;
try { Rcon = require("rcon-client").Rcon; }
catch { console.warn("[RCON] rcon-client not installed — actions logged only."); }

// ============================================================
//  CONFIG
// ============================================================

const DISCORD_TOKEN     = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID         = process.env.DISCORD_CLIENT_ID || "1507730299356708984";
const GUILD_ID          = "636832636752625664";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WEBHOOK_URL       = process.env.ARKBOT_WEBHOOK_URL;
const WEBHOOK_SECRET    = process.env.DISCORD_WEBHOOK_SECRET;
const DYNAMIC_CONFIG_URL = "https://skiilodge.asa-bot.info/api/dynamicConfig/server/898e4691-fbac-4e87-9c50-340dff4167f6/63d2bd1d-a52e-4606-9869-7fd363dfc599";

const UPDATE_INTERVAL_MINUTES = 5;

// ── Role IDs ──────────────────────────────────────────────────
const ROLES = {
  admin:   "703389459747700807",   // Admin ⭐
  staff:   "1276494265593102357",  // Moderator (closest to staff)
  donator: null,                   // Set if/when you create a donator role
};

// ── Channel IDs ───────────────────────────────────────────────
const CHANNEL_IDS = {
  ai:               "1509816601334124614",  // #🤖︱ai
  adminConsole:     "1509762780192837675",  // #🛠️・admin-console
  staffChat:        "1509816635765293067",  // #🦑︱staff-chat
  supportTicket:    "1509816628542570609",  // #🎫︱support-ticket
  adminLogs:        "1509765406724980837",  // #admin-logs
  ticketTranscript: "1509765427360694344",  // #ticket-transcripts
  getRoles:         "1509816508291878972",  // #🎭︱get-roles
  polls:            "1509816572322250852",  // #🗳️︱polls
  announcements:    "1509816500272238682",  // #📣︱announcements
  serverStats:      "1509816532232962098",  // #📊︱server-stats
  // Status embed — use server-status-1 (where Lodge-Bot already posts)
  statusEmbed:      "1509883790783156437",  // #server-status-1
};

// 🔴 PROTECTED CATEGORIES — NEVER TOUCH
const PROTECTED_CATEGORY_IDS = new Set([
  "1509765384364888115", // ✦ ADMIN SUITE
  "1509765438630789120", // ✦ MAP LOGS
  "1509765536643285022", // ✦ TRIBE LOGS
]);

// ── Server voice channel IDs (SERVER STATUS category) ────────
const SERVERS = [
  { name: "Island",      bm_id: "36970150", channel_id: "1509847604115279964", rcon_port: null, rcon_pass: null },
  { name: "Center",      bm_id: null,       channel_id: "1509847671320481802", rcon_port: null, rcon_pass: null },
  { name: "Scorched",    bm_id: null,       channel_id: "1509847685468000406", rcon_port: null, rcon_pass: null },
  { name: "Aberration",  bm_id: null,       channel_id: "1509847698600104037", rcon_port: null, rcon_pass: null },
  { name: "Astraeos",    bm_id: null,       channel_id: "1509847703293792357", rcon_port: null, rcon_pass: null },
  { name: "Extinction",  bm_id: null,       channel_id: "1509847704757473481", rcon_port: null, rcon_pass: null },
  { name: "Ragnarok",    bm_id: "36968477", channel_id: "1509847708809302098", rcon_port: null, rcon_pass: null },
  { name: "Valguero",    bm_id: null,       channel_id: "1509847716526559252", rcon_port: null, rcon_pass: null },
  { name: "Lost Colony", bm_id: "36950578", channel_id: "1509847718036508672", rcon_port: null, rcon_pass: null },
  { name: "Club Ark",    bm_id: null,       channel_id: "1509847700076630096", rcon_port: null, rcon_pass: null },
  { name: "Forglar",     bm_id: "36970148", channel_id: "1509847695672606720", rcon_port: null, rcon_pass: null },
  { name: "Svartlfheim", bm_id: null,       channel_id: "1509847701494431815", rcon_port: null, rcon_pass: null },
  { name: "Volcano",     bm_id: "36970154", channel_id: "1509847706938507344", rcon_port: null, rcon_pass: null },
];

// ── Platform roles for #get-roles ────────────────────────────
const PLATFORMS = [
  { name: "Xbox",        emoji: "🎮", roleId: "1389939183312699523" },
  { name: "PS5",         emoji: "🕹️", roleId: "1425828763538555004" },
  { name: "Steam",       emoji: "💻", roleId: "1389218790067404800" },
  { name: "Windows",     emoji: "🪟", roleId: "1386292242397925458" },
  { name: "GeForce Now", emoji: "☁️", roleId: "1386292322060206101" },
];

// ── Ticket categories ─────────────────────────────────────────
const TICKET_CATEGORIES = [
  { name: "General Help",   emoji: "❓", description: "General questions or assistance",   key: "general_help"  },
  { name: "Admin Support",  emoji: "🛡️", description: "Reach out to an admin directly",    key: "admin_support" },
  { name: "Player Report",  emoji: "🚨", description: "Report a player for rule breaking",  key: "player_report" },
  { name: "Tame/Item Loss", emoji: "🦖", description: "Lost a tame or items? Let us know",  key: "tameitem_loss" },
  { name: "Bug Report",     emoji: "🐛", description: "Report a server or game bug",        key: "bug_report"    },
];

// ── Server choices for slash commands ────────────────────────
const serverChoices    = SERVERS.map(s => ({ name: s.name, value: s.name }));
const serverChoicesAll = [...serverChoices, { name: "All Servers", value: "all" }];

// ── Slash commands ────────────────────────────────────────────
const SLASH_COMMANDS = [
  {
    name: "announce",
    description: "Post an announcement to a Discord channel",
    options: [
      { name: "channel", description: "Channel to post in",       type: ApplicationCommandOptionType.Channel, required: true },
      { name: "message", description: "The announcement message", type: ApplicationCommandOptionType.String,  required: true },
      { name: "ping",    description: "Ping @everyone?",          type: ApplicationCommandOptionType.Boolean, required: false },
    ],
  },
  {
    name: "broadcast",
    description: "Broadcast a message in-game on an ARK server via RCON",
    options: [
      { name: "server",  description: "Server(s) to broadcast on", type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
      { name: "message", description: "Message to broadcast",      type: ApplicationCommandOptionType.String, required: true },
    ],
  },
  {
    name: "warn",
    description: "Issue a warning to a player",
    options: [
      { name: "player", description: "Player Steam ID or name",  type: ApplicationCommandOptionType.String, required: true },
      { name: "server", description: "Server the player is on",  type: ApplicationCommandOptionType.String, required: true, choices: serverChoices },
      { name: "reason", description: "Reason for the warning",   type: ApplicationCommandOptionType.String, required: true },
    ],
  },
  {
    name: "kick",
    description: "Kick a player from an ARK server",
    options: [
      { name: "player", description: "Player Steam ID",          type: ApplicationCommandOptionType.String, required: true },
      { name: "server", description: "Server to kick from",      type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
      { name: "reason", description: "Reason for the kick",      type: ApplicationCommandOptionType.String, required: true },
    ],
  },
  {
    name: "ban",
    description: "Ban a player from the cluster",
    options: [
      { name: "player",   description: "Player Steam ID",                     type: ApplicationCommandOptionType.String, required: true },
      { name: "server",   description: "Server(s) to ban on",                 type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
      { name: "reason",   description: "Reason for the ban",                  type: ApplicationCommandOptionType.String, required: true },
      { name: "duration", description: "Duration (e.g. 7d, 30d, permanent)",  type: ApplicationCommandOptionType.String, required: false },
    ],
  },
  {
    name: "unban",
    description: "Unban a player",
    options: [
      { name: "player", description: "Player Steam ID",       type: ApplicationCommandOptionType.String, required: true },
      { name: "server", description: "Server(s) to unban on", type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
    ],
  },
  {
    name: "player-history",
    description: "View a player's warning and ban history",
    options: [
      { name: "player", description: "Player Steam ID", type: ApplicationCommandOptionType.String, required: true },
    ],
  },
  {
    name: "server-save",
    description: "Force-save an ARK server world via RCON",
    options: [
      { name: "server", description: "Server to save", type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
    ],
  },
  {
    name: "server-message",
    description: "Send an in-game chat message on an ARK server",
    options: [
      { name: "server",  description: "Server to message", type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
      { name: "message", description: "Message to send",   type: ApplicationCommandOptionType.String, required: true },
    ],
  },
];

// ============================================================
//  INTERNALS
// ============================================================

const warnRecords = new Map();
const banRecords  = new Map();
let ticketCounter = 0;
const openTickets = new Map();
const channelAI   = new Map();
const AI_TIMEOUT_MS = 10 * 60 * 1000;
let statusMessageId = null;
const lastKnown     = {};

// ── Discord client ────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ── Anthropic client ──────────────────────────────────────────
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// ── Keepalive ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end("Helena Walker is alive 🦕"); })
  .listen(PORT, () => console.log(`🌐 Keepalive on port ${PORT}`));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Guards ────────────────────────────────────────────────────
function isAdmin(member) {
  if (!member) return false;
  if (member.roles.cache.has(ROLES.admin)) return true;
  if (ROLES.staff && member.roles.cache.has(ROLES.staff)) return true;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isStaff(member) {
  return isAdmin(member);
}

// ── Discord REST helper ───────────────────────────────────────
async function dREST(method, path, body) {
  try {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: { Authorization: `Bot ${DISCORD_TOKEN}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) { console.error(`❌ REST ${method} ${path} → ${res.status}:`, JSON.stringify(data).slice(0, 200)); return null; }
    return data;
  } catch (err) { console.error(`❌ REST fetch error: ${err.message}`); return null; }
}

// ── Logging helpers ───────────────────────────────────────────
function findChannel(guild, nameFragment) {
  return guild.channels.cache.find(c =>
    c.name.toLowerCase().includes(nameFragment.toLowerCase()) &&
    !PROTECTED_CATEGORY_IDS.has(c.parentId)
  );
}

async function logAction(guild, color, title, fields) {
  const ch = findChannel(guild, "helena-logs") || guild.channels.cache.get(CHANNEL_IDS.adminLogs);
  if (!ch) return;
  await ch.send({ embeds: [new EmbedBuilder().setTitle(title).setColor(color).addFields(fields).setTimestamp()] }).catch(() => {});
}

async function logPlayerAction(guild, color, title, fields) {
  const ch = findChannel(guild, "player-records") || findChannel(guild, "ban-warnings");
  if (!ch) return;
  await ch.send({ embeds: [new EmbedBuilder().setTitle(title).setColor(color).addFields(fields).setTimestamp()] }).catch(() => {});
}

async function logAnnouncement(guild, fields) {
  const ch = findChannel(guild, "announcement-history") || guild.channels.cache.get(CHANNEL_IDS.adminLogs);
  if (!ch) return;
  await ch.send({ embeds: [new EmbedBuilder().setTitle("📢 Announcement Sent").setColor(0x5865f2).addFields(fields).setTimestamp()] }).catch(() => {});
}

function rconSummary(results) {
  return results.map(r => r.success ? `✅ ${r.server}` : `❌ ${r.server}: ${r.error}`).join("\n");
}

// ── RCON ─────────────────────────────────────────────────────
async function sendRcon(serverName, command) {
  if (!Rcon) return { success: false, error: "rcon-client not installed" };
  const srv = SERVERS.find(s => s.name === serverName);
  if (!srv) return { success: false, error: "Server not found" };
  if (!srv.rcon_port || !srv.rcon_pass) return { success: false, error: `RCON not configured for ${serverName}` };
  try {
    const rcon = await Rcon.connect({ host: "24.140.110.115", port: srv.rcon_port, password: srv.rcon_pass, timeout: 5000 });
    const res  = await rcon.send(command);
    await rcon.end();
    return { success: true, response: res || "OK" };
  } catch (err) { return { success: false, error: err.message }; }
}

async function sendRconMany(serverNameOrAll, command) {
  const targets = serverNameOrAll === "all" ? SERVERS.map(s => s.name) : [serverNameOrAll];
  const results = [];
  for (const name of targets) {
    results.push({ server: name, ...(await sendRcon(name, command)) });
    await sleep(300);
  }
  return results;
}

// ── Slash command handlers ────────────────────────────────────
async function handleAnnounce(interaction) {
  const channel = interaction.options.getChannel("channel");
  const message = interaction.options.getString("message");
  const ping    = interaction.options.getBoolean("ping") ?? false;
  await channel.send(ping ? `@everyone\n${message}` : message);
  await interaction.editReply({ content: `✅ Announcement posted in <#${channel.id}>`, ephemeral: true });
  await logAnnouncement(interaction.guild, [
    { name: "Admin",   value: interaction.user.tag, inline: true },
    { name: "Channel", value: `<#${channel.id}>`,   inline: true },
    { name: "Pinged",  value: ping ? "Yes" : "No",  inline: true },
    { name: "Message", value: message },
  ]);
}

async function handleBroadcast(interaction) {
  const server  = interaction.options.getString("server");
  const message = interaction.options.getString("message");
  const results = await sendRconMany(server, `Broadcast ${message}`);
  const summary = rconSummary(results);
  await interaction.editReply({ content: `📡 Broadcast results:\n${summary}`, ephemeral: true });
  await logAction(interaction.guild, 0x5865f2, "📡 In-Game Broadcast", [
    { name: "Admin",   value: interaction.user.tag, inline: true },
    { name: "Server",  value: server,               inline: true },
    { name: "Message", value: message },
    { name: "Result",  value: summary },
  ]);
}

async function handleWarn(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  const reason = interaction.options.getString("reason");
  if (!warnRecords.has(player)) warnRecords.set(player, []);
  warnRecords.get(player).push({ reason, admin: interaction.user.tag, server, date: new Date().toISOString() });
  const rconResult = await sendRcon(server, `Broadcast WARNING issued to ${player}: ${reason}`);
  await interaction.editReply({ content: `⚠️ Warning issued to **${player}** on **${server}**.\nRCON: ${rconResult.success ? "✅ Sent" : `❌ ${rconResult.error}`}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xffa500, "⚠️ Player Warning", [
    { name: "Admin",          value: interaction.user.tag,                inline: true },
    { name: "Player",         value: player,                              inline: true },
    { name: "Server",         value: server,                              inline: true },
    { name: "Reason",         value: reason },
    { name: "Total Warnings", value: String(warnRecords.get(player).length), inline: true },
  ]);
}

async function handleKick(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  const reason = interaction.options.getString("reason");
  const results = await sendRconMany(server, `KickPlayer ${player}`);
  const summary = rconSummary(results);
  await interaction.editReply({ content: `👢 Kick results:\n${summary}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xff6b00, "👢 Player Kicked", [
    { name: "Admin",  value: interaction.user.tag, inline: true },
    { name: "Player", value: player,               inline: true },
    { name: "Server", value: server,               inline: true },
    { name: "Reason", value: reason },
    { name: "RCON",   value: summary },
  ]);
}

async function handleBan(interaction) {
  const player   = interaction.options.getString("player");
  const server   = interaction.options.getString("server");
  const reason   = interaction.options.getString("reason");
  const duration = interaction.options.getString("duration") ?? "Permanent";
  banRecords.set(player, { reason, admin: interaction.user.tag, server, duration, date: new Date().toISOString() });
  const results = await sendRconMany(server, `BanPlayer ${player}`);
  const summary = rconSummary(results);
  await interaction.editReply({ content: `🔨 Ban results:\n${summary}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xff0000, "🔨 Player Banned", [
    { name: "Admin",    value: interaction.user.tag, inline: true },
    { name: "Player",   value: player,               inline: true },
    { name: "Server",   value: server,               inline: true },
    { name: "Duration", value: duration,             inline: true },
    { name: "Reason",   value: reason },
    { name: "RCON",     value: summary },
  ]);
}

async function handleUnban(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  banRecords.delete(player);
  const results = await sendRconMany(server, `UnbanPlayer ${player}`);
  const summary = rconSummary(results);
  await interaction.editReply({ content: `✅ Unban results:\n${summary}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0x00cc44, "✅ Player Unbanned", [
    { name: "Admin",  value: interaction.user.tag, inline: true },
    { name: "Player", value: player,               inline: true },
    { name: "Server", value: server,               inline: true },
    { name: "RCON",   value: summary },
  ]);
}

async function handlePlayerHistory(interaction) {
  const player   = interaction.options.getString("player");
  const warnings = warnRecords.get(player) ?? [];
  const ban      = banRecords.get(player);
  const embed = new EmbedBuilder().setTitle(`📁 Player History — ${player}`).setColor(0x5865f2).setTimestamp();
  if (warnings.length === 0 && !ban) {
    embed.setDescription("No records found for this player.");
  } else {
    if (warnings.length > 0) embed.addFields({ name: `⚠️ Warnings (${warnings.length})`, value: warnings.map((w, i) => `**${i + 1}.** ${w.reason} — by ${w.admin} on ${w.server} (${w.date.slice(0, 10)})`).join("\n") });
    if (ban) embed.addFields({ name: "🔨 Active Ban", value: `Reason: ${ban.reason}\nDuration: ${ban.duration}\nServer: ${ban.server}\nBanned by: ${ban.admin}\nDate: ${ban.date.slice(0, 10)}` });
  }
  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleServerSave(interaction) {
  const server  = interaction.options.getString("server");
  const results = await sendRconMany(server, "SaveWorld");
  const summary = rconSummary(results);
  await interaction.editReply({ content: `💾 Save results:\n${summary}`, ephemeral: true });
  await logAction(interaction.guild, 0x1ec864, "💾 World Saved", [
    { name: "Admin",  value: interaction.user.tag, inline: true },
    { name: "Server", value: server,               inline: true },
    { name: "Result", value: summary },
  ]);
}

async function handleServerMessage(interaction) {
  const server  = interaction.options.getString("server");
  const message = interaction.options.getString("message");
  const results = await sendRconMany(server, `ServerChat [Helena] ${message}`);
  const summary = rconSummary(results);
  await interaction.editReply({ content: `💬 Message results:\n${summary}`, ephemeral: true });
  await logAction(interaction.guild, 0x5865f2, "💬 In-Game Server Message", [
    { name: "Admin",   value: interaction.user.tag, inline: true },
    { name: "Server",  value: server,               inline: true },
    { name: "Message", value: message },
    { name: "Result",  value: summary },
  ]);
}

// ── Slash command registration ────────────────────────────────
async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    console.log("[Slash] Registering commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: SLASH_COMMANDS });
    console.log("[Slash] ✅ Commands registered.");
  } catch (err) { console.error("[Slash] ❌ Failed:", err.message); }
}

// ── Post command reference list ───────────────────────────────
async function postCommandsList(guild) {
  const ch = findChannel(guild, "helena-command-list");
  if (!ch) { console.warn("[Commands] #helena-command-list not found — skipping."); return; }
  try {
    const msgs = await ch.messages.fetch({ limit: 20 });
    for (const m of msgs.filter(m => m.author.id === client.user.id).values()) await m.delete().catch(() => {});
  } catch {}
  const serverList = SERVERS.map(s => `\`${s.name}\``).join(", ");
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🤖  Helena — Admin Command Reference")
        .setColor(0x5865f2)
        .setDescription("All commands below are **admin role only**.\nType `/` in any channel to open the command menu.\n─────────────────────────────────────────")
        .addFields(
          { name: "📢  Announcements", value: "**`/announce`** — Post to a Discord channel.\n**`/broadcast`** — In-game RCON broadcast.\n**`/server-message`** — In-game chat message." },
          { name: "⚠️  Player Management", value: "**`/warn`** — Issue a warning (logged + in-game notify).\n**`/kick`** — Kick via RCON.\n**`/ban`** — Ban via RCON.\n**`/unban`** — Unban via RCON.\n**`/player-history`** — View warnings & bans." },
          { name: "🔧  Server Tools", value: "**`/server-save`** — Force-save an ARK world via RCON." },
          { name: "🗺️  Available Servers", value: serverList },
          { name: "🤖  AI Commands", value: "`!ai on` — Enable AI in current channel (admin only)\n`!ai off` — Disable AI in current channel (admin only)\n`!ai help` — Show capabilities\n\nThe **#🤖︱ai** channel is always active for everyone." },
        )
        .setFooter({ text: "Helena — Skii's Lodge Admin Bot  •  All actions are logged automatically" })
        .setTimestamp(),
    ],
  });
  console.log("[Commands] ✅ Posted to #helena-command-list.");
}

// ── BattleMetrics ─────────────────────────────────────────────
async function fetchServerStatus(bmId) {
  try {
    const res = await fetch(`https://api.battlemetrics.com/servers/${bmId}`);
    if (!res.ok) return null;
    const { data: { attributes: a } } = await res.json();
    return { online: a.status === "online", players: a.players, maxPlayers: a.maxPlayers };
  } catch { return null; }
}

async function discoverMissingServers() {
  if (!SERVERS.some(s => !s.bm_id)) return;
  try {
    const res  = await fetch("https://api.battlemetrics.com/servers?filter[game]=arksa&filter[search]=Skii%27s+PVE&page[size]=25");
    if (!res.ok) return;
    const json = await res.json();
    for (const result of json.data) {
      const bmName = result.attributes.name.toLowerCase();
      for (const s of SERVERS) {
        if (s.bm_id) continue;
        if (bmName.replace(/\s/g, "").includes(s.name.toLowerCase().replace(" ", ""))) {
          s.bm_id = result.id;
          console.log(`[Discovery] ${s.name} → ${result.id}`);
          break;
        }
      }
    }
  } catch (err) { console.error("[Discovery]", err.message); }
}

function playerBar(p, m, l = 10) {
  if (!m) return "";
  return "█".repeat(Math.round((p / m) * l)) + "░".repeat(l - Math.round((p / m) * l));
}

function buildStatusEmbed(results) {
  const online = results.filter(r => r.data?.online).length;
  const lines  = results.map(({ server: s, data: d }) =>
    !d ? `⚫  **${s.name}** — unavailable` :
    !d.online ? `🔴  **${s.name}** — offline` :
    `🟢  **${s.name}**  •  \`${d.players}/${d.maxPlayers}\`  ${playerBar(d.players, d.maxPlayers)}`
  );
  return new EmbedBuilder()
    .setTitle("🦕  Skii's Lodge — Live Server Status")
    .setColor(0x1ec864)
    .setDescription(`**${online}/${results.length}** servers online\n──────────────────────────────\n${lines.join("\n")}`)
    .setFooter({ text: "Updates every 5 minutes  •  BattleMetrics" })
    .setTimestamp();
}


// ── Dynamic server rates (live from ASA-Bot API) ──────────────
let cachedRates = null;
let ratesCachedAt = 0;
const RATES_CACHE_MS = 5 * 60 * 1000; // cache for 5 minutes

async function fetchDynamicConfig() {
  if (cachedRates && Date.now() - ratesCachedAt < RATES_CACHE_MS) return cachedRates;
  try {
    const res  = await fetch(DYNAMIC_CONFIG_URL);
    if (!res.ok) return null;
    const data = await res.json();
    cachedRates  = data;
    ratesCachedAt = Date.now();
    return data;
  } catch (err) { console.error("[Rates] Failed to fetch config:", err.message); return null; }
}

function formatRates(cfg) {
  if (!cfg) return "*(rates unavailable — API unreachable)*";
  const get = (key, fallback) => cfg[key] ?? fallback;
  return [
    `🥩 **Taming Speed:** ${get("TamingSpeedMultiplier", "?")}x`,
    `⛏️ **Harvesting:** ${get("HarvestAmountMultiplier", get("HarvestAmountMultiplie", "?"))}x`,
    `⭐ **XP:** ${get("XPMultiplier", "?")}x`,
    `🥚 **Egg Hatch Speed:** ${get("EggHatchSpeedMultiplier", "?")}x`,
    `🍼 **Baby Mature Speed:** ${get("BabyMatureSpeedMultiplier", "?")}x`,
    `💞 **Imprint Amount:** ${get("BabyImprintAmountMultiplier", "?")}x`,
    `⏰ **Cuddle Interval:** ${get("BabyCuddleIntervalMultiplier", "?")}x`,
    `🔁 **Mating Interval:** ${get("MatingIntervalMultiplier", "?")}x`,
    `🥚 **Lay Egg Interval:** ${get("LayEggIntervalMultiplier", "?")}x`,
    `💎 **Hexagon Reward:** ${get("HexagonRewardMultiplier", "?")}x`,
  ].join("\n");
}

async function pollServers() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const results = await Promise.all(SERVERS.map(async s => ({ server: s, data: s.bm_id ? await fetchServerStatus(s.bm_id) : null })));

  for (const { server: s, data } of results) {
    const newName = !data ? `⚫︱${s.name}` : !data.online ? `🔴︱${s.name}` : `🟢︱${s.name} - ${data.players}/${data.maxPlayers}`;
    if (newName !== lastKnown[s.name]) {
      lastKnown[s.name] = newName;
      if (s.channel_id) {
        try {
          const ch = guild.channels.cache.get(s.channel_id);
          if (ch && ch.name !== newName) { await ch.setName(newName); await sleep(1500); }
        } catch {}
      }
    }
  }

  const statusCh = guild.channels.cache.get(CHANNEL_IDS.statusEmbed);
  if (!statusCh) return;
  const embed = buildStatusEmbed(results);
  if (statusMessageId) {
    try { const m = await statusCh.messages.fetch(statusMessageId); await m.edit({ embeds: [embed] }); return; }
    catch { statusMessageId = null; }
  }
  const m = await statusCh.send({ embeds: [embed] });
  statusMessageId = m.id;
}

// ── Ticket system ─────────────────────────────────────────────
async function initTicketCounter(guild) {
  const existing = guild.channels.cache
    .filter(c => /ticket-\d+/i.test(c.name))
    .map(c => parseInt(c.name.replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  ticketCounter = existing.length > 0 ? Math.max(...existing) : 0;
  console.log(`[Tickets] Counter initialized at ${ticketCounter}`);
}

async function postTicketPanel(guild) {
  const ch = guild.channels.cache.get(CHANNEL_IDS.supportTicket);
  if (!ch) { console.warn("[Tickets] #support-ticket not found."); return; }
  try {
    const msgs = await ch.messages.fetch({ limit: 20 });
    for (const m of msgs.filter(m => m.author.id === client.user.id).values()) await m.delete().catch(() => {});
  } catch {}
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("create_ticket").setLabel("📩  Open a Ticket").setStyle(ButtonStyle.Primary)
  );
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎫  Support — Skii's Lodge")
        .setColor(0x5865f2)
        .setDescription("Need help? Click the button below to open a private support ticket.\n\n**Use tickets for:**\n• Rule violations or reports\n• Bugs or technical issues\n• Ban appeals\n• General questions for staff\n\n*A private channel will be created just for you and our team.*")
        .setFooter({ text: "Skii's Lodge  •  Staff will respond as soon as possible" }),
    ],
    components: [row],
  });
  console.log("[Tickets] ✅ Panel posted to #support-ticket.");
}

async function createTicket(interaction) {
  const guild  = interaction.guild;
  const member = interaction.member;
  const existing = guild.channels.cache.find(c => openTickets.has(c.id) && openTickets.get(c.id).userId === member.id);
  if (existing) return interaction.reply({ content: `❌ You already have an open ticket: <#${existing.id}>`, ephemeral: true });

  ticketCounter++;
  const ticketNum = String(ticketCounter).padStart(4, "0");
  const chanName  = `🎫︱ticket-${ticketNum}`;

  let category = guild.channels.cache.get("1390284215870033971"); // Open Tickets category ID
  if (!category) category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("open ticket"));
  if (!category) category = await guild.channels.create({ name: "📂 Open Tickets", type: ChannelType.GuildCategory });

  const perms = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (ROLES.staff) perms.push({ id: ROLES.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  if (ROLES.admin) perms.push({ id: ROLES.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const ticketCh = await guild.channels.create({
    name: chanName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: perms,
    topic: `Ticket #${ticketNum} — opened by ${member.user.tag}`,
  });

  openTickets.set(ticketCh.id, { userId: member.id, ticketNum });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒  Close Ticket").setStyle(ButtonStyle.Danger)
  );

  await ticketCh.send({
    content: `<@${member.id}>`,
    embeds: [
      new EmbedBuilder()
        .setTitle(`🎫  Ticket #${ticketNum}`)
        .setColor(0x5865f2)
        .setDescription(`Welcome <@${member.id}>! Staff will be with you shortly.\n\nPlease describe your issue in detail.\nWhen resolved, click **Close Ticket** below.`)
        .setTimestamp(),
    ],
    components: [closeRow],
  });

  await interaction.reply({ content: `✅ Ticket opened: <#${ticketCh.id}>`, ephemeral: true });

  // Delete the trigger message in #support-ticket
  if (interaction.message) await interaction.message.delete().catch(() => {});

  await logAction(guild, 0x5865f2, "🎫 Ticket Opened", [
    { name: "User",    value: `<@${member.id}>`,  inline: true },
    { name: "Ticket",  value: `#${ticketNum}`,    inline: true },
    { name: "Channel", value: `<#${ticketCh.id}>`, inline: true },
  ]);
}

async function closeTicket(interaction) {
  const guild  = interaction.guild;
  const ch     = interaction.channel;
  const closer = interaction.member;
  const info   = openTickets.get(ch.id);
  const ticketNum = info ? info.ticketNum : ch.name.replace(/\D/g, "").padStart(4, "0");

  let transcript = `Ticket #${ticketNum} — Closed by ${closer.user.tag}\nDate: ${new Date().toISOString()}\n${"─".repeat(60)}\n`;
  try {
    const msgs   = await ch.messages.fetch({ limit: 100 });
    const sorted = [...msgs.values()].reverse();
    for (const m of sorted) transcript += `[${m.createdAt.toISOString().slice(0, 16)}] ${m.author.tag}: ${m.content}\n`;
  } catch {}

  const transcriptsCh = guild.channels.cache.get(CHANNEL_IDS.ticketTranscript);
  if (transcriptsCh) {
    await transcriptsCh.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 Ticket #${ticketNum} — Transcript`)
          .setColor(0xff6b00)
          .addFields(
            { name: "Closed by", value: closer.user.tag,                        inline: true },
            { name: "User",      value: info ? `<@${info.userId}>` : "unknown", inline: true },
            { name: "Date",      value: new Date().toISOString().slice(0, 10),  inline: true }
          ).setTimestamp(),
      ],
      files: [new AttachmentBuilder(Buffer.from(transcript, "utf-8"), { name: `ticket-${ticketNum}.txt` })],
    });
  }

  await interaction.reply({ content: `🔒 Closing ticket #${ticketNum}...` });
  openTickets.delete(ch.id);
  try {
    if (info) await ch.permissionOverwrites.delete(info.userId).catch(() => {});
    await ch.setName(`🔒︱closed-${ticketNum}`);
  } catch {}

  await logAction(guild, 0xff6b00, "🔒 Ticket Closed", [
    { name: "Closed by", value: closer.user.tag, inline: true },
    { name: "Ticket",    value: `#${ticketNum}`,  inline: true },
  ]);
}

// ── Get-Roles panel ───────────────────────────────────────────
async function postRolePanel(guild) {
  const ch = guild.channels.cache.get(CHANNEL_IDS.getRoles);
  if (!ch) { console.warn("[Roles] #get-roles not found."); return; }
  try {
    const msgs = await ch.messages.fetch({ limit: 20 });
    const bot  = msgs.filter(m => m.author.id === client.user.id && m.components?.length > 0);
    if (bot.size > 0) { console.log("[Roles] ℹ️ Role panel already posted."); return; }
  } catch {}

  const mapRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_map_role")
      .setPlaceholder("🗺️ Choose your preferred map(s)")
      .setMinValues(1)
      .setMaxValues(Math.min(SERVERS.length, 25))
      .addOptions(SERVERS.map(s => ({ label: s.name, value: s.name.toLowerCase().replace(/\s/g, "_") })))
  );

  const platformRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_platform_role")
      .setPlaceholder("🎮 Choose your platform")
      .setMinValues(1)
      .setMaxValues(Math.min(PLATFORMS.length, 25))
      .addOptions(PLATFORMS.map(p => ({ label: `${p.emoji} ${p.name}`, value: p.roleId })))
  );

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎭  Get Your Roles")
        .setColor(0x7B2FBE)
        .setDescription("Select your platform and favourite maps below to unlock the right channels and get pinged for relevant events!")
        .setFooter({ text: "Skii's Lodge — role assignment" }),
    ],
    components: [platformRow],
  });
  console.log("[Roles] ✅ Role panel posted.");
}

// ── AI helpers ────────────────────────────────────────────────
function resetAiTimer(channelId, guild) {
  const state = channelAI.get(channelId);
  if (!state) return;
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    state.enabled = false; state.timer = null; state.history = [];
    const ch = guild.channels.cache.get(channelId);
    if (ch) await ch.send("⏰ Helena AI went offline due to **10 minutes of inactivity**. An admin can use `!ai on` to re-enable.").catch(() => {});
  }, AI_TIMEOUT_MS);
}

async function getAiResponse(channelId, userMessage, username) {
  if (!anthropic) return "⚠️ AI not configured — `ANTHROPIC_API_KEY` missing.";
  if (!channelAI.has(channelId)) channelAI.set(channelId, { enabled: false, timer: null, history: [] });
  const state = channelAI.get(channelId);
  state.history.push({ role: "user", content: `${username}: ${userMessage}` });
  if (state.history.length > 20) state.history.splice(0, 2);
  try {
    const liveCfg = await fetchDynamicConfig();
    const liveRates = liveCfg ? formatRates(liveCfg) : "2.5x taming/harvest/XP, 10x maturation, 20x egg hatch, 10x imprint";
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: `You are Helena Walker, the AI assistant for Skii's Lodge — an ARK: Survival Ascended cluster. You are warm, knowledgeable, and speak naturally. Deep expertise in taming, breeding, mutations, base building, all 13 cluster maps (Island, Center, Scorched, Aberration, Astraeos, Extinction, Ragnarok, Valguero, Lost Colony, Club Ark, Forglar, Svartlfheim, Volcano), boss fights, and server management. LIVE SERVER RATES (always use these — fetched in real time):\n${liveRates}\nAdmins: Skidogg, iNFAMOUS, Remi, Captain Rhynio. Keep responses concise and conversational.`,
      messages: state.history,
    });
    const reply = msg.content[0].text;
    state.history.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) { return `❌ AI error: ${err.message}`; }
}

// ── Online announcement ───────────────────────────────────────
async function postOnlineMessage(guild) {
  const targets = [
    { id: CHANNEL_IDS.adminConsole, name: "#admin-console" },
    { id: CHANNEL_IDS.staffChat,    name: "#staff-chat" },
  ];
  for (const { id, name } of targets) {
    const ch = guild.channels.cache.get(id);
    if (!ch) { console.error(`❌ Could not find ${name}`); continue; }
    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🟢  HELENA IS ONLINE")
          .setColor(0x2ECC71)
          .setDescription(
            `Systems are up and I am ready to go.\n\n` +
            `🤖 **AI Brain:** ${anthropic ? "✅ Active" : "❌ Disabled"}\n` +
            `🕐 **Started:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `*Talk to me naturally — polls, config changes, server info, player questions.*`
          )
          .setFooter({ text: "Helena Walker — Skii's Lodge" }),
      ],
    }).catch(err => console.error(`❌ Online msg to ${name}: ${err.message}`));
    console.log(`✅ Online message → ${name}`);
  }
}

// ── READY ─────────────────────────────────────────────────────
client.once("clientReady", async () => {
  console.log(`✅ Helena is online as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error("❌ Guild not found."); process.exit(1); }

  await discoverMissingServers();
  await registerSlashCommands();
  await initTicketCounter(guild);
  await postTicketPanel(guild);
  await postRolePanel(guild);
  await postCommandsList(guild);
  await postOnlineMessage(guild);
  await pollServers();
  setInterval(pollServers, UPDATE_INTERVAL_MINUTES * 60 * 1000);

  console.log("✅ Helena v2.1.0 setup complete!");
});

// ── INTERACTIONS ──────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {

  // ── Buttons ───────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId === "create_ticket") return createTicket(interaction);
    if (interaction.customId === "close_ticket")  return closeTicket(interaction);
    return;
  }

  // ── Select menus (role assignment) ───────────────────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "select_platform_role") {
      try {
        const member = interaction.member;
        // Remove existing platform roles first
        for (const p of PLATFORMS) {
          if (member.roles.cache.has(p.roleId)) await member.roles.remove(p.roleId).catch(() => {});
        }
        // Add selected roles
        for (const roleId of interaction.values) {
          await member.roles.add(roleId).catch(() => {});
        }
        const names = PLATFORMS.filter(p => interaction.values.includes(p.roleId)).map(p => `${p.emoji} ${p.name}`).join(", ");
        await interaction.reply({ content: `✅ Platform roles updated: **${names}**`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `❌ Could not assign roles: ${err.message}`, ephemeral: true });
      }
      return;
    }
    return;
  }

  // ── Slash commands ────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  if (!isAdmin(interaction.member)) {
    return interaction.reply({ content: "❌ Helena commands are restricted to the **Admin** role only.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    switch (interaction.commandName) {
      case "announce":       await handleAnnounce(interaction);      break;
      case "broadcast":      await handleBroadcast(interaction);     break;
      case "warn":           await handleWarn(interaction);          break;
      case "kick":           await handleKick(interaction);          break;
      case "ban":            await handleBan(interaction);           break;
      case "unban":          await handleUnban(interaction);         break;
      case "player-history": await handlePlayerHistory(interaction); break;
      case "server-save":    await handleServerSave(interaction);    break;
      case "server-message": await handleServerMessage(interaction); break;
      default: await interaction.editReply({ content: "Unknown command." });
    }
  } catch (err) {
    console.error(`[Command] /${interaction.commandName}:`, err.message);
    await interaction.editReply({ content: `❌ Something went wrong: ${err.message}` }).catch(() => {});
  }
});

// ── MESSAGES ──────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const guild   = message.guild;
  const content = message.content.trim();
  const chId    = message.channel.id;
  const lower   = content.toLowerCase();

  // Log all monitored channel messages
  const monitoredChannels = [CHANNEL_IDS.adminConsole, CHANNEL_IDS.staffChat, CHANNEL_IDS.ai];
  if (monitoredChannels.includes(chId)) {
    console.log(`📨 [#${message.channel.name}] ${message.member?.displayName || message.author.username}: "${content.slice(0, 80)}"`);
  }

  // ── !ai commands ──────────────────────────────────────────
  if (lower === "!ai on" || lower === "!ai off") {
    if (!isAdmin(message.member)) return message.reply("❌ Only admins can toggle Helena AI.");
    if (lower === "!ai on") {
      if (!channelAI.has(chId)) channelAI.set(chId, { enabled: false, timer: null, history: [] });
      const state = channelAI.get(chId);
      state.enabled = true; state.history = [];
      resetAiTimer(chId, guild);
      await message.reply("🟢 **Helena AI is now active in this channel.**\n*Auto-shuts off after 10 minutes of inactivity.*");
    } else {
      const state = channelAI.get(chId);
      if (state) { if (state.timer) clearTimeout(state.timer); state.enabled = false; state.timer = null; state.history = []; }
      await message.reply("🔴 **Helena AI is now offline in this channel.**");
    }
    return;
  }

  if (lower === "!ai help") {
    await message.reply([
      "**🤖 Helena — Capabilities**",
      "",
      "**Server Info**",
      "• Server rates, rules, maps, wipe schedule",
      "• Cluster info, admin contacts, mod list",
      "",
      "**Game Knowledge**",
      "• Taming: food, torpor, effectiveness for any creature",
      "• Breeding: imprinting, mutations, stat inheritance, timers",
      "• All 13 cluster maps, boss fights, engrams, TEK, kibble",
      "",
      "**Support Triage**",
      "• Diagnose bugs and connection issues",
      "• Escalate critical issues to admins",
      "• Open support tickets via #support-ticket",
      "",
      "**Admin Tools** *(admin role only)*",
      "• `/announce`, `/broadcast`, `/warn`, `/kick`, `/ban`, `/unban`",
      "• `/player-history`, `/server-save`, `/server-message`",
      "• `!ai on/off` — toggle AI in any channel",
    ].join("\n"));
    return;
  }

  if (content.startsWith("!")) return;

  // ── AI response logic ─────────────────────────────────────
  const isPublicAi = chId === CHANNEL_IDS.ai;
  const state      = channelAI.get(chId);
  const isToggled  = state?.enabled === true;

  // Also respond in admin-console and staff-chat if message is a question or ARK-related
  const isAdminChannel = chId === CHANNEL_IDS.adminConsole || chId === CHANNEL_IDS.staffChat;
  const isArkRelated   = /\?|tame|breed|mut|imprint|dino|tribe|base|raid|server|map|boss|ark|wipe|rate|kibble|egg|baby|hatch|poll|announce|ban|kick|warn/i.test(content);

  if (!isPublicAi && !isToggled && !(isAdminChannel && isArkRelated)) return;

  if (isToggled && !isPublicAi) resetAiTimer(chId, guild);

  try {
    await message.channel.sendTyping();
    const reply = await getAiResponse(chId, message.content, message.author.username);
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = reply.match(/.{1,1990}/gs) || [reply];
      await message.reply(chunks[0]);
      for (let i = 1; i < chunks.length; i++) await message.channel.send(chunks[i]);
    }
  } catch (err) {
    console.error("[AI] Error:", err.message);
    await message.reply("❌ Something went wrong with the AI response.").catch(() => {});
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
if (!DISCORD_TOKEN) { console.error("❌ FATAL: DISCORD_BOT_TOKEN not set"); process.exit(1); }
console.log(`✅ Config OK | AI: ${ANTHROPIC_API_KEY ? "enabled" : "DISABLED"}`);
console.log("🔄 Connecting to Discord...");
client.login(DISCORD_TOKEN);
