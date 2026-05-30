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
  AttachmentBuilder,
  StringSelectMenuBuilder,
  Partials,
} = require("discord.js");

// RCON — run: npm install rcon-client
let Rcon;
try { Rcon = require("rcon-client").Rcon; }
catch { console.warn("[RCON] rcon-client not installed — actions logged only."); }

const fs   = require("fs");
const http = require("http");
const DATA_FILE = "./helena-data.json";

// ── Keepalive — must be first so Railway health checks pass ──
const KEEPALIVE_PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Helena is alive!");
}).listen(KEEPALIVE_PORT, () => console.log(`🌐 Keepalive on port ${KEEPALIVE_PORT}`));

// ============================================================
//  CONFIG
// ============================================================

const DISCORD_TOKEN     = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID         = process.env.DISCORD_CLIENT_ID || "1507730299356708984";
const GUILD_ID          = "636832636752625664";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const DYNAMIC_CONFIG_URL    = "https://skiilodge.asa-bot.info/api/dynamicConfig/server/898e4691-fbac-4e87-9c50-340dff4167f6/63d2bd1d-a52e-4606-9869-7fd363dfc599";
const UPDATE_INTERVAL_MINUTES = 5;

const TRIBE_WATCH_ENABLED = true;
const TRIBE_ALERT_CHANNEL = "helena-logs";

// ASA-Bot tribe roster (optional — leave blank until you have the endpoint)
const ASA_API_KEY    = process.env.ASA_API_KEY    || "";
const ASA_TRIBES_URL = process.env.ASA_TRIBES_URL || "";

const AI_MODEL = "claude-sonnet-4-5";

const AI_PERSONALITY = [
  "You are Helena Walker, the resident AI of Skii's Lodge — an ARK: Survival Ascended PvE cluster.",
  "",
  "You're named after the famous ARK Explorer: an Australian biologist with an insatiable curiosity for the creatures of the ARKs. Channel that spirit — warm, quick-witted, and genuinely delighted by dinos, taming, breeding, and survival. You've got real personality and a dry sense of humour, and you clearly love this world. But you're never annoying about it, and you always actually help.",
  "",
  "Style:",
  "- Conversational and fun, with a naturalist's flair — the occasional field-note quip or creature observation lands well.",
  "- Concise. You're entertaining, not long-winded. Get to the point with a bit of spark.",
  "- Deeply knowledgeable about ARK: creatures, taming methods, breeding lines, maps, boss fights, mechanics, and strategy.",
  "- Helpful first, funny second — never let a joke get in the way of a real answer.",
  "- Use Discord markdown naturally; emojis sparingly, for flavour.",
  "",
  "Cluster: Skii's Lodge — 13 maps: Island, Center, Scorched Earth, Forglar, Aberration, Club Ark, Svartlfheim, Astraeos, Extinction, Volcano, Valguero, Lost Colony, Ragnarok.",
  "Admins: Skidogg, iNFAMOUS, Remi, Captain Rhynio.",
  "Server rules: PVE only. Turrets set to wild creatures only (inside base or TEK shield may be all targets). No building at spawn points. No blocking artifacts. Taming traps must be removed within 12 hours. Max tribe size: 7.",
  "",
  "CRITICAL — Honesty about data:",
  "You have access to tribe-log events you've personally parsed and stored in memory since your last restart. That is ALL you have.",
  "NEVER pretend to fetch, query, retrieve, or pull data from a database, API, or external source unless you are literally executing a function that does so.",
  "NEVER narrate fake actions like 'let me pull that up', 'checking the database', 'retrieving logs', 'the system is not responding', etc.",
  "If someone asks about tribe activity and you have relevant events in memory, report them directly.",
  "If you have nothing for that tribe, map, or timeframe, say so plainly and honestly:",
  "  e.g. 'I haven't captured any logged activity for Triumphant Titans since my last restart. I can only report events I've seen come through the tribe-log channels — I don't have access to full historical tribe data.'",
  "It is always better to say 'I don't have that' than to imply you're fetching something you can't.",
  "The same rule applies to player records, server stats, or any other data — only report what you actually have in context.",
].join("\n");

// ── Role IDs ──────────────────────────────────────────────────
const ROLES = {
  admin:   "703389459747700807",
  staff:   "1276494265593102357",
  donator: null,
};

// ── Channel IDs ───────────────────────────────────────────────
const CHANNEL_IDS = {
  ai:               "1509816601334124614",
  adminConsole:     "1509762780192837675",
  staffChat:        "1509816635765293067",
  adminDiscussion:  "1510122840404394145",
  supportTicket:    "1509816628542570609",
  adminLogs:        "1509765406724980837",
  ticketTranscript: "1509765427360694344",
  getRoles:         "1509816508291878972",
  statusEmbed:      "1509883790783156437",
};

const AI_PUBLIC_CHANNEL_ID   = CHANNEL_IDS.ai;
const AI_PUBLIC_CHANNEL_NAME = "🤖︱ai";
const ADMIN_CHANNEL_IDS      = new Set([CHANNEL_IDS.adminConsole, CHANNEL_IDS.staffChat, CHANNEL_IDS.adminDiscussion]);

// 🔴 PROTECTED — NEVER TOUCH
const PROTECTED_CATEGORY_IDS = new Set([
  "1509765384364888115", // Admin Suite
  "1509765438630789120", // Cluster Map Logs
  "1509765536643285022", // Tribe Data Logs
]);

// Tribe Data Logs category — monitor ALL channels inside
const TRIBE_LOG_CATEGORY_ID = "1509765536643285022";

// ── Servers ───────────────────────────────────────────────────
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

// ── Platforms for #get-roles ──────────────────────────────────
const PLATFORMS = [
  { name: "Xbox",        emoji: "🎮", roleId: "1389939183312699523" },
  { name: "PS5",         emoji: "🕹️", roleId: "1425828763538555004" },
  { name: "Steam",       emoji: "💻", roleId: "1389218790067404800" },
  { name: "Windows",     emoji: "🪟", roleId: "1386292242397925458" },
  { name: "GeForce Now", emoji: "☁️", roleId: "1386292322060206101" },
];

// ── Rate labels ───────────────────────────────────────────────
const RATE_LABELS = {
  XPMultiplier:                 "XP",
  TamingSpeedMultiplier:        "Taming Speed",
  HarvestAmountMultiplier:      "Harvest Amount",
  HarvestAmountMultiplie:       "Harvest Amount",
  MatingIntervalMultiplier:     "Mating Interval",
  LayEggIntervalMultiplier:     "Egg Lay Interval",
  EggHatchSpeedMultiplier:      "Egg Hatch Speed",
  BabyMatureSpeedMultiplier:    "Baby Mature Speed",
  BabyCuddleIntervalMultiplier: "Baby Cuddle Interval",
  BabyImprintAmountMultiplier:  "Baby Imprint Amount",
  HexagonRewardMultiplier:      "Hexagon Reward",
};

function labelRate(key) {
  return RATE_LABELS[key] || key.replace(/Multiplier$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

// ── Slash commands ────────────────────────────────────────────
const serverChoices    = SERVERS.map(s => ({ name: s.name, value: s.name }));
const serverChoicesAll = [...serverChoices, { name: "All Servers", value: "all" }];

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
      { name: "player", description: "Player Steam ID",     type: ApplicationCommandOptionType.String, required: true },
      { name: "server", description: "Server to kick from", type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
      { name: "reason", description: "Reason for the kick", type: ApplicationCommandOptionType.String, required: true },
    ],
  },
  {
    name: "ban",
    description: "Ban a player from the cluster",
    options: [
      { name: "player",   description: "Player Steam ID",                    type: ApplicationCommandOptionType.String, required: true },
      { name: "server",   description: "Server(s) to ban on",               type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
      { name: "reason",   description: "Reason for the ban",                type: ApplicationCommandOptionType.String, required: true },
      { name: "duration", description: "Duration (e.g. 7d, 30d, permanent)", type: ApplicationCommandOptionType.String, required: false },
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
  {
    name: "remember",
    description: "Save a fact to Helena's long-term memory",
    options: [
      { name: "fact", description: "The fact to remember", type: ApplicationCommandOptionType.String, required: true },
    ],
  },
  { name: "memory", description: "View everything Helena remembers" },
  {
    name: "forget",
    description: "Remove a memory by its number (see /memory)",
    options: [
      { name: "number", description: "The memory number to remove", type: ApplicationCommandOptionType.Integer, required: true },
    ],
  },
  { name: "rates", description: "Show the current live cluster rates" },
  {
    name: "activity",
    description: "Show recent tribe-log activity Helena has captured",
    options: [
      { name: "type",  description: "Filter by event type",             type: ApplicationCommandOptionType.String,  required: false,
        choices: [
          { name: "PvP Kills",            value: "pvp_kill" },
          { name: "Structures Destroyed", value: "structure_destroyed" },
          { name: "Dinos Killed",         value: "dino_killed" },
          { name: "Dinos Starved/Died",   value: "dino_starved" },
          { name: "Transfers",            value: "transfer" },
          { name: "Tames",                value: "dino_tamed" },
          { name: "Member Changes",       value: "member_left" },
        ] },
      { name: "map",   description: "Filter by map name (e.g. Ragnarok)", type: ApplicationCommandOptionType.String,  required: false },
      { name: "limit", description: "How many to show (default 15, max 40)", type: ApplicationCommandOptionType.Integer, required: false },
    ],
  },
  {
    name: "tribes",
    description: "List active tribes across the cluster",
    options: [
      { name: "map", description: "Filter by map name", type: ApplicationCommandOptionType.String, required: false },
    ],
  },
  {
    name: "help",
    description: "What can Helena do? Shows all commands and features.",
  },
];

// ============================================================
//  STATE
// ============================================================

const warnRecords     = new Map();
const banRecords      = new Map();
let   ticketCounter   = 0;
const openTickets     = new Map();
const channelAI       = new Map();
const sandboxSessions = new Map();
let   longTermMemory  = [];
let   recentEvents    = [];
let   tribesSeen      = {};
let   currentRates    = {};
let   ratesUpdatedAt  = null;
let   tribesCache     = [];
let   tribesUpdatedAt = null;
let   statusMessageId = null;
const lastKnown       = {};
let   lastStatusResults = [];

const AI_TIMEOUT_MS      = 10 * 60 * 1000;
const TRIBE_COOLDOWN_MS  = 10000;
const RECENT_EVENTS_MAX  = 250;
const TRIBE_ACTIVE_DAYS  = 7;
const tribeAlertCooldown = new Map();

// ── Event categories ──────────────────────────────────────────
// ping:true = alert admins immediately; ping:false = silently record only
// Order matters — first match wins, so put high-priority rules first.
const TRIBE_EVENTS = [
  { key: "pvp_kill",            label: "🔴 PvP Kill",             ping: true,  test: t => /was killed by .*\((human|.*player.*)\)/i.test(t) || /killed by your tribe/i.test(t) },
  { key: "structure_destroyed", label: "💥 Structure Destroyed",  ping: true,  test: t => /was destroyed|demolished/i.test(t) },
  { key: "turret_warning",      label: "⚠️ Turret Warning",       ping: true,  test: t => /turret|targeting|auto-?turret/i.test(t) },
  { key: "dino_killed",         label: "🦖 Dino Killed",          ping: true,  test: t => /(your|tribe).{0,40}was killed/i.test(t) },
  { key: "dino_starved",        label: "🍖 Dino Starved/Died",    ping: true,  test: t => /starved|died of/i.test(t) },
  { key: "member_left",         label: "🚪 Member Left Tribe",    ping: true,  test: t => /was removed from the tribe|left the tribe/i.test(t) },
  { key: "tribe_merge",         label: "🔗 Tribe Merged",         ping: true,  test: t => /merged|absorbed/i.test(t) },
  { key: "rank_change",         label: "🎖️ Rank/Perms Changed",  ping: true,  test: t => /\brank\b|promoted|demoted|permission/i.test(t) },
  { key: "member_joined",       label: "👋 Member Joined",        ping: false, test: t => /was added to the tribe/i.test(t) },
  { key: "tribe_renamed",       label: "✏️ Tribe Renamed",        ping: false, test: t => /tribe name|renamed the tribe/i.test(t) },
  { key: "transfer",            label: "📦 Dino/Item Transfer",   ping: false, test: t => /uploaded|downloaded/i.test(t) },
  { key: "dino_claimed",        label: "🪢 Dino Claimed",         ping: false, test: t => /claimed/i.test(t) },
  { key: "dino_tamed",          label: "🦕 Dino Tamed",           ping: false, test: t => /tamed a|was tamed|has tamed/i.test(t) },
  { key: "egg_laid",            label: "🥚 Egg Laid",             ping: false, test: t => /\begg\b/i.test(t) },
  { key: "structure_built",     label: "🏗️ Structure Built",      ping: false, test: t => /\bbuilt\b|placed a/i.test(t) },
];

// ── Persistence ───────────────────────────────────────────────
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      warnRecords:    [...warnRecords.entries()],
      banRecords:     [...banRecords.entries()],
      longTermMemory,
      recentEvents,
      tribesSeen,
      ticketCounter,
    }, null, 2));
  } catch (err) { console.error("[Data] Save error:", err.message); }
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) { console.log("[Data] No save file — starting fresh."); return; }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (Array.isArray(data.warnRecords))    for (const [k, v] of data.warnRecords) warnRecords.set(k, v);
    if (Array.isArray(data.banRecords))     for (const [k, v] of data.banRecords)  banRecords.set(k, v);
    if (Array.isArray(data.longTermMemory)) longTermMemory = data.longTermMemory;
    if (Array.isArray(data.recentEvents))   recentEvents   = data.recentEvents;
    if (data.tribesSeen && typeof data.tribesSeen === "object") tribesSeen = data.tribesSeen;
    if (typeof data.ticketCounter === "number") ticketCounter = data.ticketCounter;
    console.log(`[Data] Loaded — ${warnRecords.size} warns, ${banRecords.size} bans, ${longTermMemory.length} memories, ${recentEvents.length} events.`);
  } catch (err) { console.error("[Data] Load error:", err.message); }
}

// ── System prompt builders ────────────────────────────────────
function memoryForPrompt() {
  if (!longTermMemory.length) return "";
  return "\n\nLong-term memory (things you should always remember):\n" +
    longTermMemory.map((m, i) => `${i + 1}. ${m.text}`).join("\n");
}

function recentEventsForPrompt() {
  if (!recentEvents.length) return "";
  const latest = recentEvents.slice(-25).reverse();
  const lines  = latest.map(e => `- [${e.at.slice(5, 16).replace("T", " ")}] ${e.map}: ${e.label} — ${e.text}`);
  return "\n\nRecent tribe-log activity you've observed (most recent first):\n" + lines.join("\n");
}

function serverStatusForPrompt() {
  if (!lastStatusResults.length) return "";
  const lines = lastStatusResults.map(({ server, data }) =>
    !data ? `- ${server.name}: status unknown` :
    !data.online ? `- ${server.name}: offline` :
    `- ${server.name}: online (${data.players}/${data.maxPlayers} players)`
  );
  return "\n\nLive server status right now:\n" + lines.join("\n");
}

function tribesForPrompt() {
  if (tribesCache.length) {
    const byMap = {};
    for (const t of tribesCache) { const m = tribeMap(t) || "Unknown"; byMap[m] = (byMap[m] || 0) + 1; }
    const breakdown = Object.entries(byMap).map(([m, n]) => `${m}: ${n}`).join(", ");
    return `\n\nActive tribes on the cluster (live from ASA-Bot, updated ${tribesUpdatedAt?.toISOString() ?? "unknown"}): ${tribesCache.length} total. By map: ${breakdown}.`;
  }
  const active = activeTribes();
  if (!active.length) return "";
  const byMap = {};
  for (const t of active) for (const m of (t.maps.length ? t.maps : ["Unknown"])) byMap[m] = (byMap[m] || 0) + 1;
  const breakdown = Object.entries(byMap).map(([m, n]) => `${m}: ${n}`).join(", ");
  return `\n\nActive tribes seen in tribe logs over the last ${TRIBE_ACTIVE_DAYS} days: ${active.length}. By map: ${breakdown}. (Derived from log activity.)`;
}

function ratesForPrompt() {
  if (!Object.keys(currentRates).length) return "Current server rates are unavailable right now.";
  const lines = Object.entries(currentRates)
    .filter(([k]) => RATE_LABELS[k])
    .map(([k, v]) => `- ${labelRate(k)}: ${v}x`);
  return `Current Skii's Lodge cluster rates (live, last updated ${ratesUpdatedAt?.toISOString() ?? "unknown"}):\n${lines.join("\n")}`;
}

function buildSystemPrompt(extra = "") {
  return AI_PERSONALITY
    + "\n\n" + ratesForPrompt()
    + serverStatusForPrompt()
    + tribesForPrompt()
    + memoryForPrompt()
    + recentEventsForPrompt()
    + (extra ? "\n\n" + extra : "");
}

// ── Discord client ────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Guards ────────────────────────────────────────────────────
function isStaff(member) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  if (ROLES.staff && member.roles?.cache?.has(ROLES.staff)) return true;
  return member.permissions?.has(PermissionFlagsBits.ManageChannels) ?? false;
}

function isAdmin(member) {
  if (!member) return false;
  if (member.roles?.cache?.has(ROLES.admin)) return true;
  if (ROLES.staff && member.roles?.cache?.has(ROLES.staff)) return true;
  return member.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
}


// ── Display name helpers ──────────────────────────────────────
// Always prefer server nickname (displayName) over username/tag.
// Pass a guild + userId to get the member's display name.
// Falls back gracefully if the member can't be fetched.

async function getDisplayName(guild, userOrMember) {
  if (!userOrMember) return 'Unknown';
  // Already a GuildMember
  if (userOrMember.displayName) return userOrMember.displayName;
  // It's a User object — fetch the member
  try {
    const member = await guild.members.fetch(userOrMember.id);
    return member.displayName;
  } catch {
    return userOrMember.username || userOrMember.tag || 'Unknown';
  }
}

// Synchronous version for cases where we already have the member cached
function displayName(memberOrUser) {
  if (!memberOrUser) return 'Unknown';
  if (memberOrUser.displayName) return memberOrUser.displayName;   // GuildMember
  return memberOrUser.username || memberOrUser.tag || 'Unknown';   // User fallback
}

// ── Channel helpers ───────────────────────────────────────────
function findChannel(guild, nameFragment) {
  return guild.channels.cache.find(c =>
    c.name.toLowerCase().includes(nameFragment.toLowerCase()) &&
    !PROTECTED_CATEGORY_IDS.has(c.parentId)
  );
}

// ── Logging ───────────────────────────────────────────────────
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

// ── Live Rates ────────────────────────────────────────────────
async function fetchRates() {
  try {
    const res = await fetch(DYNAMIC_CONFIG_URL);
    if (!res.ok) { console.warn(`[Rates] HTTP ${res.status}`); return; }
    const text   = await res.text();
    const parsed = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      parsed[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    if (Object.keys(parsed).length > 0) {
      currentRates   = parsed;
      ratesUpdatedAt = new Date();
      console.log(`[Rates] Updated — ${Object.keys(parsed).length} values.`);
    }
  } catch (err) { console.error("[Rates] Fetch error:", err.message); }
}

// ── ASA-Bot Tribes ────────────────────────────────────────────
async function fetchTribes() {
  if (!ASA_TRIBES_URL) return;
  try {
    const headers = { "Accept": "application/json" };
    if (ASA_API_KEY) headers["Authorization"] = `BOT ${ASA_API_KEY}`;
    const res = await fetch(ASA_TRIBES_URL, { headers });
    if (!res.ok) { console.warn(`[Tribes] HTTP ${res.status}`); return; }
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.tribes || data.data || data.results || []);
    if (Array.isArray(list)) {
      tribesCache     = list;
      tribesUpdatedAt = new Date();
      console.log(`[Tribes] Updated — ${list.length} tribes.`);
    }
  } catch (err) { console.error("[Tribes] Fetch error:", err.message); }
}

function tribeName(t)    { return t.name || t.tribeName || t.tribe || t.Name || "Unknown Tribe"; }
function tribeMap(t)     { return t.map || t.server || t.serverName || t.Map || null; }
function tribeMembers(t) { return t.members ?? t.memberCount ?? t.numMembers ?? (Array.isArray(t.players) ? t.players.length : null); }

function activeTribes() {
  const cutoff = Date.now() - TRIBE_ACTIVE_DAYS * 86400000;
  return Object.entries(tribesSeen)
    .filter(([, t]) => t.lastSeen && new Date(t.lastSeen).getTime() >= cutoff)
    .map(([name, t]) => ({ name, ...t }));
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
        if (bmName.replace(/\s/g, "").includes(s.name.toLowerCase().replace(/\s/g, ""))) {
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

async function pollServers() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const results = await Promise.all(SERVERS.map(async s => ({ server: s, data: s.bm_id ? await fetchServerStatus(s.bm_id) : null })));
  lastStatusResults = results;

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

// ── Slash command registration ────────────────────────────────
async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    console.log("[Slash] Registering commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: SLASH_COMMANDS });
    console.log("[Slash] ✅ Commands registered.");
  } catch (err) { console.error("[Slash] ❌ Failed:", err.message); }
}

// ── Command list ──────────────────────────────────────────────
async function postCommandsList(guild) {
  const ch = findChannel(guild, "helena-command-list");
  if (!ch) { console.warn("[Commands] #helena-command-list not found — skipping."); return; }
  try {
    const msgs = await ch.messages.fetch({ limit: 20 });
    for (const m of msgs.filter(m => m.author.id === client.user.id).values()) await m.delete().catch(() => {});
  } catch {}
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🤖  Helena — Admin Command Reference")
        .setColor(0x5865f2)
        .setDescription("All commands are **admin role only**.\n─────────────────────────────────────────")
        .addFields(
          { name: "📢  Announcements", value: "**`/announce`** `/broadcast`** `/server-message`**" },
          { name: "⚠️  Player Management", value: "**`/warn`** `/kick`** `/ban`** `/unban`** `/player-history`**" },
          { name: "🔧  Server Tools", value: "**`/server-save`** `/rates`**" },
          { name: "📋  Tribe-Log Monitoring", value: "Helena watches **all channels in the Tribe Data Logs category** automatically.\nPings <@&1242319080760467557> <@&1242319323145166868> on: PvP kills, structure destruction, dino deaths, starvation, turret alerts, member departures, tribe merges.\n**`/activity`** — view recent captured events (filter by type + map)\n**`/tribes`** — view active tribe roster" },
          { name: "🧠  Memory", value: "**`/remember`** `/memory`** `/forget`**" },
          { name: "🧪  Brainstorming", value: "**`!sandbox`** — private DM to develop ideas → `!submit <title>` → #idea-review" },
          { name: "🤖  AI", value: "`!ai on/off` — toggle in any channel\n`!ai help` — capabilities\n**#🤖︱ai** always on" },
          { name: "🗺️  Servers", value: SERVERS.map(s => `\`${s.name}\``).join(", ") },
        )
        .setFooter({ text: "Helena Walker — Skii's Lodge v2.9.1  •  All actions logged" })
        .setTimestamp(),
    ],
  });
  console.log("[Commands] ✅ Posted.");
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
  await ch.send({
    embeds: [new EmbedBuilder().setTitle("🎫  Support — Skii's Lodge").setColor(0x5865f2)
      .setDescription("Need help? Click below to open a private support ticket.\n\n**Use tickets for:**\n• Rule violations or reports\n• Bugs or technical issues\n• Ban appeals\n• General questions for staff\n\n*A private channel will be created just for you and our team.*")
      .setFooter({ text: "Skii's Lodge  •  Staff will respond as soon as possible" })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("create_ticket").setLabel("📩  Open a Ticket").setStyle(ButtonStyle.Primary)
    )],
  });
  console.log("[Tickets] ✅ Panel posted.");
}

async function createTicket(interaction) {
  const guild  = interaction.guild;
  const member = interaction.member;
  const existing = guild.channels.cache.find(c => openTickets.has(c.id) && openTickets.get(c.id).userId === member.id);
  if (existing) return interaction.reply({ content: `❌ You already have an open ticket: <#${existing.id}>`, ephemeral: true });

  ticketCounter++;
  const ticketNum = String(ticketCounter).padStart(4, "0");
  let category = guild.channels.cache.get("1390284215870033971")
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("open ticket"))
    || await guild.channels.create({ name: "📂 Open Tickets", type: ChannelType.GuildCategory });

  const perms = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (ROLES.staff) perms.push({ id: ROLES.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  if (ROLES.admin) perms.push({ id: ROLES.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const ticketCh = await guild.channels.create({
    name: `🎫︱ticket-${ticketNum}`, type: ChannelType.GuildText,
    parent: category.id, permissionOverwrites: perms,
    topic: `Ticket #${ticketNum} — opened by ${displayName(member)}`,
  });
  openTickets.set(ticketCh.id, { userId: member.id, ticketNum });
  saveData();

  await ticketCh.send({
    content: `<@${member.id}>`,
    embeds: [new EmbedBuilder().setTitle(`🎫  Ticket #${ticketNum}`).setColor(0x5865f2)
      .setDescription(`Welcome <@${member.id}>! Staff will be with you shortly.\n\nPlease describe your issue.\nWhen resolved, click **Close Ticket** below.`).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒  Close Ticket").setStyle(ButtonStyle.Danger)
    )],
  });
  await interaction.reply({ content: `✅ Ticket opened: <#${ticketCh.id}>`, ephemeral: true });
  await logAction(guild, 0x5865f2, "🎫 Ticket Opened", [
    { name: "User", value: `<@${member.id}>`, inline: true }, { name: "Ticket", value: `#${ticketNum}`, inline: true }, { name: "Channel", value: `<#${ticketCh.id}>`, inline: true },
  ]);
}

async function closeTicket(interaction) {
  const guild     = interaction.guild;
  const ch        = interaction.channel;
  const info      = openTickets.get(ch.id);
  const ticketNum = info ? info.ticketNum : ch.name.replace(/\D/g, "").padStart(4, "0");

  let closer = interaction.member;
  if (!closer) { try { closer = await guild.members.fetch(interaction.user.id); } catch {} }
  const isOwner = info && info.userId === interaction.user.id;
  if (!isOwner && !isStaff(closer)) return interaction.reply({ content: "❌ Only the ticket owner or staff can close this.", ephemeral: true });
  const closerTag = displayName(closer) || interaction.user.username;

  let transcript = `Ticket #${ticketNum} — Closed by ${closerTag}\nDate: ${new Date().toISOString()}\n${"─".repeat(60)}\n`;
  try {
    const msgs   = await ch.messages.fetch({ limit: 100 });
    const sorted = [...msgs.values()].reverse();
    for (const m of sorted) transcript += `[${m.createdAt.toISOString().slice(0, 16)}] ${m.member?.displayName ?? m.author.username}: ${m.content}\n`;
  } catch {}

  const transcriptsCh = guild.channels.cache.get(CHANNEL_IDS.ticketTranscript);
  if (transcriptsCh) {
    await transcriptsCh.send({
      embeds: [new EmbedBuilder().setTitle(`📁 Ticket #${ticketNum} — Transcript`).setColor(0xff6b00)
        .addFields(
          { name: "Closed by", value: closerTag,                          inline: true },
          { name: "User",      value: info ? `<@${info.userId}>` : "unknown", inline: true },
          { name: "Date",      value: new Date().toISOString().slice(0, 10), inline: true }
        ).setTimestamp()],
      files: [new AttachmentBuilder(Buffer.from(transcript, "utf-8"), { name: `ticket-${ticketNum}.txt` })],
    });
  }
  await interaction.reply({ content: `🔒 Ticket #${ticketNum} closed. Transcript saved.` });
  openTickets.delete(ch.id);
  saveData();
  try {
    if (info) await ch.permissionOverwrites.delete(info.userId).catch(() => {});
    await ch.setName(`🔒︱closed-${ticketNum}`);
  } catch {}
  await logAction(guild, 0xff6b00, "🔒 Ticket Closed", [
    { name: "Closed by", value: closerTag, inline: true }, { name: "Ticket", value: `#${ticketNum}`, inline: true },
  ]);
}

// ── Role panel ────────────────────────────────────────────────
async function postRolePanel(guild) {
  const ch = guild.channels.cache.get(CHANNEL_IDS.getRoles);
  if (!ch) { console.warn("[Roles] #get-roles not found."); return; }
  try {
    const msgs = await ch.messages.fetch({ limit: 20 });
    const bot  = msgs.filter(m => m.author.id === client.user.id && m.components?.length > 0);
    if (bot.size > 0) { console.log("[Roles] ℹ️ Panel already posted."); return; }
  } catch {}
  await ch.send({
    embeds: [new EmbedBuilder().setTitle("🎭  Get Your Roles").setColor(0x7B2FBE)
      .setDescription("Select your platform below!")
      .setFooter({ text: "Skii's Lodge — role assignment" })],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_platform_role")
        .setPlaceholder("🎮 Choose your platform")
        .setMinValues(1).setMaxValues(PLATFORMS.length)
        .addOptions(PLATFORMS.map(p => ({ label: `${p.emoji} ${p.name}`, value: p.roleId })))
    )],
  });
  console.log("[Roles] ✅ Panel posted.");
}

// ── AI ────────────────────────────────────────────────────────
function resetAiTimer(channelId, guild) {
  const state = channelAI.get(channelId);
  if (!state) return;
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    state.enabled = false; state.timer = null; state.history = [];
    const ch = guild.channels.cache.get(channelId);
    if (ch) await ch.send("⏰ Helena AI went offline due to **10 minutes of inactivity**. Use `!ai on` to re-enable.").catch(() => {});
  }, AI_TIMEOUT_MS);
}

async function getAiResponse(channelId, userMessage, username) {
  if (!ANTHROPIC_API_KEY) return "⚠️ AI not configured — `ANTHROPIC_API_KEY` missing.";
  if (!channelAI.has(channelId)) channelAI.set(channelId, { enabled: false, timer: null, history: [] });
  const state = channelAI.get(channelId);
  state.history.push({ role: "user", content: `${username}: ${userMessage}` });
  if (state.history.length > 20) state.history.splice(0, 2);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 1500, system: buildSystemPrompt(), messages: state.history }),
    });
    const data  = await res.json();
    const reply = data.content[0].text;
    state.history.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) { return `❌ AI error: ${err.message}`; }
}

// ── Sandbox ───────────────────────────────────────────────────
async function getSandboxResponse(userId, userMessage) {
  const session = sandboxSessions.get(userId);
  if (!session) return "Your sandbox session has expired. Start again with `!sandbox`.";
  if (!ANTHROPIC_API_KEY) return "⚠️ AI not configured. Type `!submit <title>` to send a raw idea.";
  session.history.push({ role: "user", content: userMessage });
  if (session.history.length > 30) session.history.splice(0, 2);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 1500,
        system: buildSystemPrompt("Right now you're brainstorming privately with an admin in their DMs. Help them develop and sharpen their idea. When they're ready, they'll type `!submit <title>` to send it to the admin review channel."),
        messages: session.history,
      }),
    });
    const data  = await res.json();
    const reply = data.content[0].text;
    session.history.push({ role: "assistant", content: reply });
    return reply;
  } catch (err) { return `❌ AI error: ${err.message}`; }
}

async function summarizeBrainstorm(history) {
  if (!ANTHROPIC_API_KEY || !history.length) return null;
  try {
    const transcript = history.map(m => `${m.role === "user" ? "Admin" : "Helena"}: ${m.content}`).join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 600,
        system: "Summarize the following brainstorm into a clean proposal for an ARK cluster admin team. Use: **Summary**, **Details**, **Open Questions**. Be concise. Output only the proposal.",
        messages: [{ role: "user", content: transcript }],
      }),
    });
    const data = await res.json();
    return data.content[0].text;
  } catch { return null; }
}

async function submitIdea(user, session, title) {
  const guild    = client.guilds.cache.get(session.guildId);
  if (!guild) return user.send("❌ Could not find the server to submit to.");
  // Fetch guild member to get server nickname
  let submitterName = user.username;
  try { const m = await guild.members.fetch(user.id); submitterName = m.displayName; } catch {}
  const reviewCh = findChannel(guild, "idea-review");
  if (!reviewCh) return user.send("❌ #idea-review not found.");

  let body = await summarizeBrainstorm(session.history);
  if (!body) {
    const userMsgs = session.history.filter(m => m.role === "user").map(m => m.content);
    body = userMsgs.length ? userMsgs.join("\n\n") : "*(No content captured.)*";
  }
  if (body.length > 3500) body = body.slice(0, 3500) + "…";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("idea_approve").setLabel("✅ Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("idea_reject").setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("idea_discuss").setLabel("💬 Discuss").setStyle(ButtonStyle.Secondary),
  );
  const msg = await reviewCh.send({
    embeds: [new EmbedBuilder().setTitle(`💡  ${title}`).setColor(0xffc83d)
      .setDescription(body).addFields({ name: "Status", value: "🕓 Pending", inline: true })
      .setFooter({ text: `Submitted by ${submitterName}` }).setTimestamp()],
    components: [row],
  });
  await user.send(`✅ Idea **"${title}"** submitted to <#${reviewCh.id}>.`);
  await logAction(guild, 0xffc83d, "💡 Idea Submitted", [
    { name: "By", value: submitterName, inline: true }, { name: "Title", value: title, inline: true }, { name: "Review", value: `[Jump](${msg.url})` },
  ]);
}

async function handleIdeaDecision(interaction, decision) {
  if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
  const original = interaction.message.embeds[0];
  if (!original) return;
  const isApprove = decision === "approve";
  const newEmbed  = EmbedBuilder.from(original).setColor(isApprove ? 0x1ec864 : 0xff0000)
    .spliceFields(0, 1, { name: "Status", value: isApprove ? `✅ Approved by ${displayName(interaction.member)}` : `❌ Rejected by ${displayName(interaction.member)}`, inline: true });
  await interaction.update({
    embeds: [newEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("idea_approve").setLabel("✅ Approve").setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId("idea_reject").setLabel("❌ Reject").setStyle(ButtonStyle.Danger).setDisabled(true),
      new ButtonBuilder().setCustomId("idea_discuss").setLabel("💬 Discuss").setStyle(ButtonStyle.Secondary),
    )],
  });
}

async function handleIdeaDiscuss(interaction) {
  if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
  try {
    const title  = (interaction.message.embeds[0]?.title || "Idea").replace("💡  ", "");
    const thread = await interaction.message.startThread({ name: `💬 ${title}`.slice(0, 90), autoArchiveDuration: 1440 });
    await interaction.reply({ content: `💬 Thread: <#${thread.id}>`, ephemeral: true });
  } catch (err) { await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true }); }
}

// ── Tribe Log Watcher ─────────────────────────────────────────
// Parses the exact ASA-Bot webhook format:
// [Tribe of NAME] @ [MAP] [Day D, HH:MM:SS] EVENT TEXT
//
// IMPORTANT: Logs are posted by the ASA-Bot webhook (a bot/webhook user).
// We must NOT skip bot messages in tribe-log channels.
// We skip only Helena's own messages.

const TRIBE_LOG_LINE_RE = /^\[Tribe of ([^\]]+)\]\s*@\s*\[([^\]]+)\]\s*\[Day ([\d,: ]+)\]\s*(.+)$/;

// Strip <RichColor ...> and </> tags from event text
function stripRichColor(text) {
  return text
    .replace(/<RichColor[^>]*>/gi, '')
    .replace(/<\/>/gi, '')
    .trim();
}

// Parse one log line into { tribe, map, dayTime, event } or null
function parseLogLine(text) {
  // Try the canonical single-line format first
  const m = TRIBE_LOG_LINE_RE.exec(text.trim());
  if (m) {
    return {
      tribe:   m[1].trim(),
      map:     m[2].trim(),
      dayTime: m[3].trim(),
      event:   stripRichColor(m[4].trim()),
    };
  }
  return null;
}

// Extract all text from a message (content + embed text)
function extractAllText(message) {
  const parts = [];
  if (message.content) parts.push(message.content);
  for (const e of message.embeds || []) {
    if (e.title)       parts.push(e.title);
    if (e.description) parts.push(e.description);
    for (const f of e.fields || []) parts.push(f.name + ': ' + f.value);
  }
  return parts.join('\n');
}

// Categorize based on event text
function categorizeEvent(event) {
  const lower = event.toLowerCase();
  for (const rule of TRIBE_EVENTS) {
    try { if (rule.test(lower)) return rule; } catch {}
  }
  return null;
}

function recordTribeEntry(tribe, map) {
  if (!tribe) return;
  if (!tribesSeen[tribe]) tribesSeen[tribe] = { maps: [], lastSeen: null, count: 0 };
  const t = tribesSeen[tribe];
  if (map && !t.maps.includes(map)) t.maps.push(map);
  t.lastSeen = new Date().toISOString();
  t.count   += 1;
}

function recordEventEntry(rule, tribe, map, dayTime, event, channelId) {
  const entry = {
    type:      rule.key,
    label:     rule.label,
    tribe:     tribe || 'Unknown',
    map:       map   || 'Unknown',
    dayTime:   dayTime || '',
    text:      event.slice(0, 300),
    channelId,
    at:        new Date().toISOString(),
  };
  recentEvents.push(entry);
  if (recentEvents.length > RECENT_EVENTS_MAX) recentEvents.splice(0, recentEvents.length - RECENT_EVENTS_MAX);
  saveData();
}

async function pingAdmins(message, rule, tribe, map, dayTime, event) {
  const guild   = message.guild;
  const alertCh = findChannel(guild, TRIBE_ALERT_CHANNEL);
  if (!alertCh) return;
  const mention = `<@&1242319080760467557> <@&1242319323145166868>`;

  await alertCh.send({
    content: `🚨 ${mention} — ${rule.label}`,
    embeds: [new EmbedBuilder()
      .setTitle(rule.label)
      .setColor(0xff0000)
      .addFields(
        { name: 'Tribe',   value: tribe   || 'Unknown', inline: true },
        { name: 'Map',     value: map     || 'Unknown', inline: true },
        { name: 'Day/Time', value: dayTime || 'Unknown', inline: true },
        { name: 'Source',  value: `<#${message.channel.id}>`, inline: true },
        { name: 'Event',   value: event.slice(0, 1000) },
      )
      .setFooter({ text: 'Helena tribe-log watcher' })
      .setTimestamp()],
  }).catch(() => {});
}

async function watchTribeLog(message) {
  if (!TRIBE_WATCH_ENABLED || !message.guild) return;

  // Skip Helena's own messages — but DO process other bots/webhooks (ASA-Bot posts logs)
  if (message.author.id === client.user?.id) return;

  const parentId = message.channel?.parentId || '';
  const chName   = message.channel?.name?.toLowerCase() || '';

  // Only process channels inside the Tribe Data Logs category OR named *tribe-log*
  const isTribeLogChannel = parentId === TRIBE_LOG_CATEGORY_ID || chName.includes('tribe-log');
  if (!isTribeLogChannel) return;

  const rawText = extractAllText(message);
  if (!rawText.trim()) return;

  // Process every line — each line may be a separate log entry
  const lines = rawText.split(/\r?\n/);
  let processed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parseLogLine(trimmed);
    if (!parsed) continue; // not a recognised log line

    const { tribe, map, dayTime, event } = parsed;
    const rule = categorizeEvent(event);

    // Always update the tribe roster from the embedded tribe+map
    recordTribeEntry(tribe, map);

    // Record event (even if uncategorized, store as generic)
    const effectiveRule = rule || { key: 'other', label: '📝 Log Entry', ping: false };
    recordEventEntry(effectiveRule, tribe, map, dayTime, event, message.channel.id);
    processed++;

    // Ping admins for high-impact events with cooldown
    if (rule && rule.ping) {
      const cdKey = `${message.channel.id}:${rule.key}:${tribe}`;
      const last  = tribeAlertCooldown.get(cdKey) || 0;
      if (Date.now() - last >= TRIBE_COOLDOWN_MS) {
        tribeAlertCooldown.set(cdKey, Date.now());
        await pingAdmins(message, rule, tribe, map, dayTime, event);
      }
    }
  }

  if (processed > 0) {
    console.log(`[TribeWatch] ${processed} entr${processed === 1 ? 'y' : 'ies'} parsed from #${message.channel.name}`);
  }
}


// ── Slash command handlers ────────────────────────────────────
async function handleAnnounce(interaction) {
  const channel = interaction.options.getChannel("channel");
  const message = interaction.options.getString("message");
  const ping    = interaction.options.getBoolean("ping") ?? false;
  await channel.send(ping ? `@everyone\n${message}` : message);
  await interaction.editReply({ content: `✅ Posted in <#${channel.id}>`, ephemeral: true });
  await logAnnouncement(interaction.guild, [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Channel", value: `<#${channel.id}>`, inline: true },
    { name: "Pinged", value: ping ? "Yes" : "No", inline: true }, { name: "Message", value: message },
  ]);
}

async function handleBroadcast(interaction) {
  const server  = interaction.options.getString("server");
  const message = interaction.options.getString("message");
  const results = await sendRconMany(server, `Broadcast ${message}`);
  await interaction.editReply({ content: `📡 Broadcast:\n${rconSummary(results)}`, ephemeral: true });
  await logAction(interaction.guild, 0x5865f2, "📡 Broadcast", [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Server", value: server, inline: true }, { name: "Message", value: message },
  ]);
}

async function handleWarn(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  const reason = interaction.options.getString("reason");
  if (!warnRecords.has(player)) warnRecords.set(player, []);
  warnRecords.get(player).push({ reason, admin: displayName(interaction.member), server, date: new Date().toISOString() });
  saveData();
  const r = await sendRcon(server, `Broadcast WARNING issued to ${player}: ${reason}`);
  await interaction.editReply({ content: `⚠️ Warning issued to **${player}**. RCON: ${r.success ? "✅" : `❌ ${r.error}`}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xffa500, "⚠️ Player Warning", [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Player", value: player, inline: true },
    { name: "Server", value: server, inline: true }, { name: "Reason", value: reason },
    { name: "Total Warnings", value: String(warnRecords.get(player).length), inline: true },
  ]);
}

async function handleKick(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  const reason = interaction.options.getString("reason");
  const results = await sendRconMany(server, `KickPlayer ${player}`);
  await interaction.editReply({ content: `👢 Kick:\n${rconSummary(results)}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xff6b00, "👢 Player Kicked", [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Player", value: player, inline: true },
    { name: "Server", value: server, inline: true }, { name: "Reason", value: reason },
  ]);
}

async function handleBan(interaction) {
  const player   = interaction.options.getString("player");
  const server   = interaction.options.getString("server");
  const reason   = interaction.options.getString("reason");
  const duration = interaction.options.getString("duration") ?? "Permanent";
  banRecords.set(player, { reason, admin: displayName(interaction.member), server, duration, date: new Date().toISOString() });
  saveData();
  const results = await sendRconMany(server, `BanPlayer ${player}`);
  await interaction.editReply({ content: `🔨 Ban:\n${rconSummary(results)}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xff0000, "🔨 Player Banned", [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Player", value: player, inline: true },
    { name: "Server", value: server, inline: true }, { name: "Duration", value: duration, inline: true }, { name: "Reason", value: reason },
  ]);
}

async function handleUnban(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  banRecords.delete(player); saveData();
  const results = await sendRconMany(server, `UnbanPlayer ${player}`);
  await interaction.editReply({ content: `✅ Unban:\n${rconSummary(results)}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0x00cc44, "✅ Player Unbanned", [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Player", value: player, inline: true }, { name: "Server", value: server, inline: true },
  ]);
}

async function handlePlayerHistory(interaction) {
  const player   = interaction.options.getString("player");
  const warnings = warnRecords.get(player) ?? [];
  const ban      = banRecords.get(player);
  const embed = new EmbedBuilder().setTitle(`📁 Player History — ${player}`).setColor(0x5865f2).setTimestamp();
  if (warnings.length === 0 && !ban) {
    embed.setDescription("No records found.");
  } else {
    if (warnings.length > 0) embed.addFields({ name: `⚠️ Warnings (${warnings.length})`, value: warnings.map((w, i) => `**${i + 1}.** ${w.reason} — by ${w.admin} on ${w.server} (${w.date.slice(0, 10)})`).join("\n") });
    if (ban) embed.addFields({ name: "🔨 Active Ban", value: `Reason: ${ban.reason}\nDuration: ${ban.duration}\nServer: ${ban.server}\nBanned by: ${ban.admin}\nDate: ${ban.date.slice(0, 10)}` });
  }
  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleServerSave(interaction) {
  const server  = interaction.options.getString("server");
  const results = await sendRconMany(server, "SaveWorld");
  await interaction.editReply({ content: `💾 Save:\n${rconSummary(results)}`, ephemeral: true });
  await logAction(interaction.guild, 0x1ec864, "💾 World Saved", [
    { name: "Admin", value: displayName(interaction.member), inline: true }, { name: "Server", value: server, inline: true },
  ]);
}

async function handleServerMessage(interaction) {
  const server  = interaction.options.getString("server");
  const message = interaction.options.getString("message");
  const results = await sendRconMany(server, `ServerChat [Helena] ${message}`);
  await interaction.editReply({ content: `💬 Message:\n${rconSummary(results)}`, ephemeral: true });
}

async function handleRemember(interaction) {
  const fact = interaction.options.getString("fact");
  longTermMemory.push({ text: fact, addedBy: displayName(interaction.member), date: new Date().toISOString() });
  saveData();
  await interaction.editReply({ content: `🧠 Got it — I'll remember: *"${fact}"*`, ephemeral: true });
  await logAction(interaction.guild, 0x9b59b6, "🧠 Memory Added", [
    { name: "Added by", value: displayName(interaction.member), inline: true }, { name: "Fact", value: fact },
  ]);
}

async function handleMemory(interaction) {
  if (!longTermMemory.length) return interaction.editReply({ content: "🧠 No memories yet. Use `/remember`.", ephemeral: true });
  const lines = longTermMemory.map((m, i) => `**${i + 1}.** ${m.text}  *(by ${m.addedBy}, ${m.date.slice(0, 10)})*`);
  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("🧠  Helena's Long-Term Memory").setColor(0x9b59b6)
      .setDescription(lines.join("\n").slice(0, 4000))
      .setFooter({ text: "Remove with /forget <number>" }).setTimestamp()],
    ephemeral: true,
  });
}

async function handleForget(interaction) {
  const num = interaction.options.getInteger("number");
  if (num < 1 || num > longTermMemory.length) return interaction.editReply({ content: `❌ No memory #${num}.`, ephemeral: true });
  const [removed] = longTermMemory.splice(num - 1, 1);
  saveData();
  await interaction.editReply({ content: `🗑️ Forgot: *"${removed.text}"*`, ephemeral: true });
}

async function handleRates(interaction) {
  await fetchRates();
  if (!Object.keys(currentRates).length) return interaction.editReply({ content: "⚠️ Rates unavailable.", ephemeral: true });
  const lines = Object.entries(currentRates).filter(([k]) => RATE_LABELS[k]).map(([k, v]) => `**${labelRate(k)}:** \`${v}x\``);
  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("⚙️  Skii's Lodge — Live Cluster Rates").setColor(0x1ec864)
      .setDescription(lines.join("\n")).setFooter({ text: "Pulled live from the cluster config" })
      .setTimestamp(ratesUpdatedAt || new Date())],
    ephemeral: true,
  });
}

async function handleActivity(interaction) {
  const type  = interaction.options.getString("type");
  const map   = interaction.options.getString("map");
  const limit = Math.min(interaction.options.getInteger("limit") || 15, 40);

  let events = [...recentEvents].reverse();
  if (type) events = events.filter(e => e.type === type);
  if (map)  events = events.filter(e => e.map.toLowerCase().includes(map.toLowerCase()));
  events = events.slice(0, limit);

  if (!events.length) return interaction.editReply({ content: "📭 No matching tribe-log activity captured yet.", ephemeral: true });

  const lines = events.map(e =>
    `**${e.label}** • \`${e.map}\` • <t:${Math.floor(new Date(e.at).getTime() / 1000)}:R>\n> ${e.text.slice(0, 180)}`
  );
  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("📋  Recent Tribe-Log Activity").setColor(0x5865f2)
      .setDescription(lines.join("\n\n").slice(0, 4000))
      .setFooter({ text: `${events.length} event(s)${type ? " • " + type : ""}${map ? " • " + map : ""}` })
      .setTimestamp()],
    ephemeral: true,
  });
}

async function handleTribes(interaction) {
  const mapFilter = interaction.options.getString("map");

  if (ASA_TRIBES_URL && tribesCache.length) {
    let tribes = tribesCache;
    if (mapFilter) tribes = tribes.filter(t => (tribeMap(t) || "").toLowerCase().includes(mapFilter.toLowerCase()));
    const byMap = {};
    for (const t of tribes) { const m = tribeMap(t) || "Unknown"; (byMap[m] = byMap[m] || []).push(t); }
    const sections = Object.entries(byMap).map(([m, list]) =>
      `**${m}** — ${list.length} tribe(s)\n${list.map(t => { const mem = tribeMembers(t); return `• ${tribeName(t)}${mem != null ? ` (${mem})` : ""}`; }).join("\n")}`
    );
    return interaction.editReply({
      embeds: [new EmbedBuilder().setTitle("🏰  Active Tribes — Skii's Lodge").setColor(0x1ec864)
        .setDescription(`**${tribes.length}** tribe(s).\n\n${sections.join("\n\n").slice(0, 3800)}`)
        .setFooter({ text: "Live from ASA-Bot" }).setTimestamp(tribesUpdatedAt || new Date())],
      ephemeral: true,
    });
  }

  let active = activeTribes();
  if (mapFilter) active = active.filter(t => t.maps.some(m => m.toLowerCase().includes(mapFilter.toLowerCase())));
  if (!active.length) return interaction.editReply({ content: "📭 No tribe activity captured yet. Helena builds this roster from tribe-log entries as they come in.", ephemeral: true });

  const byMap = {};
  for (const t of active) {
    const maps = t.maps.length ? t.maps : ["Unknown"];
    for (const m of maps) (byMap[m] = byMap[m] || []).push(t);
  }
  const sections = Object.entries(byMap).map(([m, list]) =>
    `**${m}** — ${list.length} tribe(s)\n${list.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen)).map(t => `• ${t.name}  <t:${Math.floor(new Date(t.lastSeen).getTime() / 1000)}:R>`).join("\n")}`
  );
  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("🏰  Active Tribes — Skii's Lodge").setColor(0x1ec864)
      .setDescription(`**${active.length}** tribe(s) active in the last ${TRIBE_ACTIVE_DAYS} days.\n\n${sections.join("\n\n").slice(0, 3800)}`)
      .setFooter({ text: "Derived from tribe-log activity" }).setTimestamp()],
    ephemeral: true,
  });
}

// ── Help command ─────────────────────────────────────────────
async function handleHelp(interaction) {
  const adminOk = isAdmin(interaction.member);
  const lock    = "\*(admin only)\*";

  const embed = new EmbedBuilder()
    .setTitle("🦕  Meet Helena — What I Can Do")
    .setColor(0x5865f2)
    .setDescription(
      "G'day! I'm **Helena Walker** — Skii's Lodge's resident naturalist AI.\n" +
      "Named after the ARK Explorer herself, I keep this cluster ticking: " +
      "monitoring tribe logs, answering questions, and helping your admin team wrangle 13 maps worth of prehistoric chaos. " +
      "Here's everything in my field kit:\n\u200b"
    )
    .addFields(
      {
        name: "📢  Announcements & Messaging",
        value: [
          "**`/announce`** — post an announcement to any Discord channel",
          "**`/broadcast`** — send an in-game RCON broadcast to a server " + lock,
          "**`/server-message`** — send in-game chat to a server " + lock,
        ].join("\n"),
      },
      {
        name: "⚠️  Player Management " + lock,
        value: [
          "**`/warn`  `/kick`  `/ban`  `/unban`** — moderate players",
          "**`/player-history`** — view warnings & ban record for any player",
        ].join("\n"),
      },
      {
        name: "🦖  Server & Cluster Info",
        value: [
          "**`/rates`** — live cluster rates (taming, breeding, XP, and more)",
          "**`/tribes`** — active tribes across the cluster, grouped by map",
          "**`/activity`** — recent tribe-log events; filterable by type & map",
          "**`/server-save`** — force-save a world " + lock,
        ].join("\n"),
      },
      {
        name: "🧠  Memory " + lock,
        value: [
          "**`/remember`** — save a fact I'll carry into every conversation",
          "**`/memory`** — view everything I currently remember",
          "**`/forget`** — remove a memory by number",
        ].join("\n"),
      },
      {
        name: "💬  Text Commands",
        value: [
          "**`!sandbox`** — opens a private DM brainstorm; type `!submit <title>` to pitch to the team " + lock,
          "**`!ai on / off`** — toggle my AI chat in any channel " + lock,
          "**`!ai help`** — show capabilities in chat",
        ].join("\n"),
      },
      {
        name: "✨  Always Running (Automatic)",
        value: [
          "🔍 **Tribe Log Watcher** — I monitor every channel in the Tribe Data Logs category and ping admins on PvP kills, structure destruction, dino deaths, starvation, turret alerts, member departures, and tribe merges",
          "🏰 **Tribe Roster** — built automatically from log activity (use `/tribes` to see it)",
          "📡 **Server Status** — live BattleMetrics polling keeps the status board current every 5 minutes",
          "⚙️ **Live Rates** — pulled from the cluster config and refreshed automatically",
          "🤖 **AI Chat** — I answer ARK questions in **#🤖︱ai** (always on) and any channel where an admin has used `!ai on`",
        ].join("\n"),
      },
      {
        name: "\u200b",
        value: adminOk
          ? "You have **admin access** — all commands above are available to you. Let me know if you need anything! 🦕"
          : "Commands marked *(admin only)* are reserved for staff. **`/rates`**, **`/tribes`**, **`/activity`**, **`/help`**, and the AI chat in **#🤖︱ai** are open to everyone!",
      }
    )
    .setFooter({ text: "Helena Walker — Skii's Lodge v2.9.1  •  Naturalist AI & Cluster Manager" })
    .setTimestamp();

  await interaction.reply({ ephemeral: true, embeds: [embed] });
}


// ── Online message ────────────────────────────────────────────
async function postOnlineMessage(guild) {
  for (const [id, name] of [[CHANNEL_IDS.adminConsole, "#admin-console"], [CHANNEL_IDS.staffChat, "#staff-chat"]]) {
    const ch = guild.channels.cache.get(id);
    if (!ch) continue;
    await ch.send({
      embeds: [new EmbedBuilder().setTitle("🟢  HELENA IS ONLINE").setColor(0x2ECC71)
        .setDescription(
          `Systems are up and I am ready.\n\n` +
          `🤖 **AI:** ${ANTHROPIC_API_KEY ? "✅ Active" : "❌ Disabled"}\n` +
          `📋 **Tribe Watcher:** ✅ Monitoring Tribe Data Logs category\n` +
          `🕐 **Started:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setFooter({ text: "Helena Walker — Skii's Lodge v2.9.1" })],
    }).catch(() => {});
    console.log(`✅ Online message → ${name}`);
  }
}

// ── READY ─────────────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ Helena is online as ${client.user.tag}`);
  loadData();
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error("❌ Guild not found."); process.exit(1); }

  await discoverMissingServers();
  await registerSlashCommands();
  await initTicketCounter(guild);
  await postTicketPanel(guild);
  await postRolePanel(guild);
  await postCommandsList(guild);
  await fetchRates();
  await fetchTribes();
  await pollServers();
  await postOnlineMessage(guild);

  setInterval(async () => { await fetchRates(); await fetchTribes(); await pollServers(); }, UPDATE_INTERVAL_MINUTES * 60 * 1000);
  console.log("✅ Helena v2.9.1 setup complete!");
});

// ── INTERACTIONS ──────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === "create_ticket") return createTicket(interaction);
    if (interaction.customId === "close_ticket")  return closeTicket(interaction);
    if (interaction.customId === "idea_approve")  return handleIdeaDecision(interaction, "approve");
    if (interaction.customId === "idea_reject")   return handleIdeaDecision(interaction, "reject");
    if (interaction.customId === "idea_discuss")  return handleIdeaDiscuss(interaction);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "select_platform_role") {
      try {
        const member = interaction.member;
        for (const p of PLATFORMS) { if (member.roles.cache.has(p.roleId)) await member.roles.remove(p.roleId).catch(() => {}); }
        for (const roleId of interaction.values) await member.roles.add(roleId).catch(() => {});
        const names = PLATFORMS.filter(p => interaction.values.includes(p.roleId)).map(p => `${p.emoji} ${p.name}`).join(", ");
        await interaction.reply({ content: `✅ Roles updated: **${names}**`, ephemeral: true });
      } catch (err) { await interaction.reply({ content: `❌ Role error: ${err.message}`, ephemeral: true }); }
      return;
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  // /help is open to everyone — handle it before the admin gate
  if (interaction.commandName === "help") return handleHelp(interaction);
  if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ Admin role only.", ephemeral: true });
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
      case "remember":       await handleRemember(interaction);      break;
      case "memory":         await handleMemory(interaction);        break;
      case "forget":         await handleForget(interaction);        break;
      case "rates":          await handleRates(interaction);         break;
      case "activity":       await handleActivity(interaction);      break;
      case "tribes":         await handleTribes(interaction);        break;
      case "help":           await handleHelp(interaction);          break;
      default: await interaction.editReply({ content: "Unknown command." });
    }
  } catch (err) {
    console.error(`[Command] /${interaction.commandName}:`, err.message);
    await interaction.editReply({ content: `❌ Something went wrong: ${err.message}` }).catch(() => {});
  }
});

// ── MESSAGES ──────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  // Tribe watcher runs FIRST on ALL messages including bots/webhooks (ASA-Bot posts logs)
  // The watcher internally skips Helena's own messages
  watchTribeLog(message).catch(() => {});

  // Skip all bots/webhooks for everything else (AI, commands, DMs, etc.)
  if (message.author.bot || message.webhookId) return;

  // ── DM sandbox ───────────────────────────────────────────
  if (!message.guild) {
    const session = sandboxSessions.get(message.author.id);
    if (!session) return;
    const dm = message.content.trim();
    if (dm.toLowerCase().startsWith("!submit")) {
      const title = dm.slice(7).trim() || "Untitled Idea";
      await message.channel.sendTyping();
      await submitIdea(message.author, session, title);
      sandboxSessions.delete(message.author.id);
      return;
    }
    if (dm.toLowerCase() === "!cancel") {
      sandboxSessions.delete(message.author.id);
      return message.reply("🚪 Sandbox session ended.");
    }
    await message.channel.sendTyping();
    const reply = await getSandboxResponse(message.author.id, message.content);
    if (reply.length <= 2000) await message.reply(reply);
    else {
      const chunks = reply.match(/.{1,1990}/gs) || [reply];
      await message.reply(chunks[0]);
      for (let i = 1; i < chunks.length; i++) await message.channel.send(chunks[i]);
    }
    return;
  }

  const guild   = message.guild;
  const content = message.content.trim();
  const lower   = content.toLowerCase();
  const chId    = message.channel.id;

  // Log monitored channels
  if (ADMIN_CHANNEL_IDS.has(chId) || chId === CHANNEL_IDS.ai) {
    console.log(`📨 [#${message.channel.name}] ${message.member?.displayName ?? message.author.username}: "${content.slice(0, 80)}"`);
  }

  // ── !sandbox ─────────────────────────────────────────────
  if (lower === "!sandbox") {
    console.log(`[Sandbox] triggered by ${message.member?.displayName ?? message.author.username}`);
    let member = message.member;
    if (!member) { try { member = await guild.members.fetch(message.author.id); } catch {} }
    if (!isAdmin(member)) return message.reply("❌ Only admins can use the sandbox.");
    sandboxSessions.set(message.author.id, { history: [], guildId: guild.id });
    try {
      const dm = await message.author.createDM();
      await dm.send({
        embeds: [new EmbedBuilder().setTitle("🧪  Sandbox — Private Brainstorm").setColor(0xffc83d)
          .setDescription("Let's develop your idea privately. Just start typing.\n\n**`!submit <title>`** — send to #idea-review\n**`!cancel`** — discard")],
      });
      await message.reply("📬 Check your DMs!");
    } catch (err) {
      sandboxSessions.delete(message.author.id);
      await message.reply("❌ Couldn't DM you. Enable DMs in Server Settings → Privacy & Safety.");
    }
    return;
  }

  // ── !ai on/off ───────────────────────────────────────────
  if (lower === "!ai on" || lower === "!ai off") {
    let member = message.member;
    if (!member) { try { member = await guild.members.fetch(message.author.id); } catch {} }
    if (!isAdmin(member)) return message.reply("❌ Only admins can toggle Helena AI.");
    if (lower === "!ai on") {
      if (!channelAI.has(chId)) channelAI.set(chId, { enabled: false, timer: null, history: [] });
      const state = channelAI.get(chId);
      state.enabled = true; state.history = [];
      resetAiTimer(chId, guild);
      await message.reply("🟢 **Helena AI is now active.**\n*Auto-shuts off after 10 minutes of inactivity.*");
    } else {
      const state = channelAI.get(chId);
      if (state) { if (state.timer) clearTimeout(state.timer); state.enabled = false; state.timer = null; state.history = []; }
      await message.reply("🔴 **Helena AI is now offline in this channel.**");
    }
    return;
  }

  // ── !ai help ─────────────────────────────────────────────
  if (lower === "!ai help" || lower === "!help") {
    await message.reply(
      "**🦕 Helena Walker — Skii's Lodge Naturalist AI**\n\n" +
      "Here's what I can do — use `/help` for the full formatted guide!\n\n" +
      "**Open to Everyone**\n" +
      "`/help` `/rates` `/tribes` `/activity` + AI chat in #🤖︱ai\n\n" +
      "**Admin Only**\n" +
      "`/announce` `/broadcast` `/server-message` — messaging\n" +
      "`/warn` `/kick` `/ban` `/unban` `/player-history` — players\n" +
      "`/server-save` `/remember` `/memory` `/forget` — tools\n" +
      "`!sandbox` `!ai on/off` — text commands\n\n" +
      "**Always Running:** tribe log watcher · live server status · live rates · AI chat"
    );
    return;
  }

  if (content.startsWith("!")) return;

  // ── AI response ───────────────────────────────────────────
  const isPublicAi = chId === AI_PUBLIC_CHANNEL_ID || message.channel.name === AI_PUBLIC_CHANNEL_NAME;
  const state      = channelAI.get(chId);
  const isToggled  = state?.enabled === true;
  const isAdminCh  = ADMIN_CHANNEL_IDS.has(chId);
  const isArkQuery = /\?|tame|breed|mut|imprint|dino|tribe|base|raid|server|map|boss|ark|wipe|rate|kibble|egg|baby|hatch|announce|ban|kick|warn|online|player|spawn|saddle|alpha/i.test(content);

  if (!isPublicAi && !isToggled && !(isAdminCh && isArkQuery)) return;
  if (isToggled && !isPublicAi) resetAiTimer(chId, guild);

  try {
    await message.channel.sendTyping();
    const reply = await getAiResponse(chId, message.content, message.member?.displayName ?? message.author.username);
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
console.log(`✅ Config OK | AI: ${ANTHROPIC_API_KEY ? "enabled" : "DISABLED"} | Guild: ${GUILD_ID}`);
client.login(DISCORD_TOKEN);
