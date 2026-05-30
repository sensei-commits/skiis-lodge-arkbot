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

const DYNAMIC_CONFIG_URL = "https://skiilodge.asa-bot.info/api/dynamicConfig/server/898e4691-fbac-4e87-9c50-340dff4167f6/63d2bd1d-a52e-4606-9869-7fd363dfc599";
const UPDATE_INTERVAL_MINUTES = 5;

const TRIBE_WATCH_ENABLED = true;
const TRIBE_ALERT_CHANNEL = "helena-logs";

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
].join("\n");

// ── Role IDs ──────────────────────────────────────────────────
const ROLES = {
  admin:   "703389459747700807",   // Admin ⭐
  staff:   "1276494265593102357",  // Moderator
  donator: null,
};

// ── Channel IDs ───────────────────────────────────────────────
const CHANNEL_IDS = {
  ai:               "1509816601334124614",  // #🤖︱ai
  adminConsole:     "1509762780192837675",  // #🛠️・admin-console
  staffChat:        "1509816635765293067",  // #🦑︱staff-chat
  adminDiscussion:  "1510122840404394145",  // #admin-discussion
  supportTicket:    "1509816628542570609",  // #🎫︱support-ticket
  adminLogs:        "1509765406724980837",  // #admin-logs
  ticketTranscript: "1509765427360694344",  // #ticket-transcripts
  getRoles:         "1509816508291878972",  // #🎭︱get-roles
  statusEmbed:      "1509883790783156437",  // #server-status-1
};

// AI channels that are always active (no !ai toggle needed)
const AI_PUBLIC_CHANNEL_ID   = CHANNEL_IDS.ai;
const AI_PUBLIC_CHANNEL_NAME = "🤖︱ai";

// Admin channels where Helena responds to ARK-related messages automatically
const ADMIN_CHANNEL_IDS = new Set([
  CHANNEL_IDS.adminConsole,
  CHANNEL_IDS.staffChat,
  CHANNEL_IDS.adminDiscussion,
]);

// 🔴 PROTECTED — NEVER TOUCH
const PROTECTED_CATEGORY_IDS = new Set([
  "1509765384364888115", // ADMIN SUITE
  "1509765438630789120", // MAP LOGS
  "1509765536643285022", // TRIBE LOGS
]);

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
      { name: "player", description: "Player Steam ID",        type: ApplicationCommandOptionType.String, required: true },
      { name: "server", description: "Server(s) to unban on",  type: ApplicationCommandOptionType.String, required: true, choices: serverChoicesAll },
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
  {
    name: "memory",
    description: "View everything Helena remembers",
  },
  {
    name: "forget",
    description: "Remove a memory by its number (see /memory)",
    options: [
      { name: "number", description: "The memory number to remove", type: ApplicationCommandOptionType.Integer, required: true },
    ],
  },
  {
    name: "rates",
    description: "Show the current live cluster rates",
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
let   currentRates    = {};
let   ratesUpdatedAt  = null;
let   statusMessageId = null;
const lastKnown       = {};
let   lastStatusResults = [];

const AI_TIMEOUT_MS     = 10 * 60 * 1000;
const TRIBE_COOLDOWN_MS = 8000;
const tribeAlertCooldown = new Map();

const TRIBE_FLAGS = [
  "was killed by", "killed by your", "destroyed by", "demolished",
  "auto-decay", "was auto-decayed", "your tribe killed",
  "froze", "claimed", "unclaimed", "uploaded", "downloaded",
  "starved", "decay", "raided", "raid",
];

// ── Persistence ───────────────────────────────────────────────
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      warnRecords:    [...warnRecords.entries()],
      banRecords:     [...banRecords.entries()],
      longTermMemory,
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
    if (typeof data.ticketCounter === "number") ticketCounter = data.ticketCounter;
    console.log(`[Data] Loaded — ${warnRecords.size} warns, ${banRecords.size} bans, ${longTermMemory.length} memories.`);
  } catch (err) { console.error("[Data] Load error:", err.message); }
}

// ── System prompt builders ────────────────────────────────────
function memoryForPrompt() {
  if (!longTermMemory.length) return "";
  return "\n\nLong-term memory (things you should always remember):\n" +
    longTermMemory.map((m, i) => `${i + 1}. ${m.text}`).join("\n");
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
    + memoryForPrompt()
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
function isAdmin(member) {
  if (!member) return false;
  if (member.roles?.cache?.has(ROLES.admin)) return true;
  if (ROLES.staff && member.roles?.cache?.has(ROLES.staff)) return true;
  return member.permissions?.has(PermissionFlagsBits.Administrator) ?? false;
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
    // API returns plain text key=value pairs
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
        .setDescription("All commands below are **admin role only**.\nType `/` in any channel to open the command menu.\n─────────────────────────────────────────")
        .addFields(
          { name: "📢  Announcements", value: "**`/announce`** — Post to a Discord channel.\n**`/broadcast`** — In-game RCON broadcast.\n**`/server-message`** — In-game chat message." },
          { name: "⚠️  Player Management", value: "**`/warn`** — Issue a warning (logged + in-game).\n**`/kick`** — Kick via RCON.\n**`/ban`** — Ban via RCON.\n**`/unban`** — Unban via RCON.\n**`/player-history`** — View warnings & bans." },
          { name: "🔧  Server Tools", value: "**`/server-save`** — Force-save an ARK world.\n**`/rates`** — Show current live cluster rates." },
          { name: "🧠  Memory", value: "**`/remember`** — Save a fact (survives restarts).\n**`/memory`** — View all saved memories.\n**`/forget`** — Remove a memory by number." },
          { name: "🧪  Brainstorming", value: "**`!sandbox`** — Opens a private DM to develop ideas.\n`!submit <title>` — post polished idea to #idea-review.\n`!cancel` — discard session." },
          { name: "🤖  AI", value: "`!ai on/off` — toggle AI in current channel (admin only).\n`!ai help` — show capabilities.\n**#🤖︱ai** is always on for everyone." },
          { name: "🗺️  Servers", value: SERVERS.map(s => `\`${s.name}\``).join(", ") },
        )
        .setFooter({ text: "Helena — Skii's Lodge v2.5.0  •  All actions logged automatically" })
        .setTimestamp(),
    ],
  });
  console.log("[Commands] ✅ Posted to #helena-command-list.");
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
    embeds: [
      new EmbedBuilder()
        .setTitle("🎫  Support — Skii's Lodge")
        .setColor(0x5865f2)
        .setDescription("Need help? Click the button below to open a private support ticket.\n\n**Use tickets for:**\n• Rule violations or reports\n• Bugs or technical issues\n• Ban appeals\n• General questions for staff\n\n*A private channel will be created just for you and our team.*")
        .setFooter({ text: "Skii's Lodge  •  Staff will respond as soon as possible" }),
    ],
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
  const chanName  = `🎫︱ticket-${ticketNum}`;

  let category = guild.channels.cache.get("1390284215870033971");
  if (!category) category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("open ticket"));
  if (!category) category = await guild.channels.create({ name: "📂 Open Tickets", type: ChannelType.GuildCategory });

  const perms = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (ROLES.staff) perms.push({ id: ROLES.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  if (ROLES.admin) perms.push({ id: ROLES.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const ticketCh = await guild.channels.create({
    name: chanName, type: ChannelType.GuildText,
    parent: category.id, permissionOverwrites: perms,
    topic: `Ticket #${ticketNum} — opened by ${member.user.tag}`,
  });
  openTickets.set(ticketCh.id, { userId: member.id, ticketNum });
  saveData();

  await ticketCh.send({
    content: `<@${member.id}>`,
    embeds: [new EmbedBuilder().setTitle(`🎫  Ticket #${ticketNum}`).setColor(0x5865f2)
      .setDescription(`Welcome <@${member.id}>! Staff will be with you shortly.\n\nPlease describe your issue in detail.\nWhen resolved, click **Close Ticket** below.`).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒  Close Ticket").setStyle(ButtonStyle.Danger)
    )],
  });
  await interaction.reply({ content: `✅ Ticket opened: <#${ticketCh.id}>`, ephemeral: true });
  await logAction(guild, 0x5865f2, "🎫 Ticket Opened", [
    { name: "User",    value: `<@${member.id}>`,   inline: true },
    { name: "Ticket",  value: `#${ticketNum}`,     inline: true },
    { name: "Channel", value: `<#${ticketCh.id}>`, inline: true },
  ]);
}

async function closeTicket(interaction) {
  const guild     = interaction.guild;
  const ch        = interaction.channel;
  const closer    = interaction.member;
  const info      = openTickets.get(ch.id);
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
      embeds: [new EmbedBuilder().setTitle(`📁 Ticket #${ticketNum} — Transcript`).setColor(0xff6b00)
        .addFields(
          { name: "Closed by", value: closer.user.tag,                        inline: true },
          { name: "User",      value: info ? `<@${info.userId}>` : "unknown", inline: true },
          { name: "Date",      value: new Date().toISOString().slice(0, 10),  inline: true }
        ).setTimestamp()],
      files: [new AttachmentBuilder(Buffer.from(transcript, "utf-8"), { name: `ticket-${ticketNum}.txt` })],
    });
  }
  await interaction.reply({ content: `🔒 Closing ticket #${ticketNum}...` });
  openTickets.delete(ch.id);
  saveData();
  try {
    if (info) await ch.permissionOverwrites.delete(info.userId).catch(() => {});
    await ch.setName(`🔒︱closed-${ticketNum}`);
  } catch {}
  await logAction(guild, 0xff6b00, "🔒 Ticket Closed", [
    { name: "Closed by", value: closer.user.tag, inline: true },
    { name: "Ticket",    value: `#${ticketNum}`,  inline: true },
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
      .setDescription("Select your platform below to unlock the right channels and get pinged for relevant events!")
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
  if (!ANTHROPIC_API_KEY) return "⚠️ AI not configured. You can still type `!submit <title>` to send a raw idea.";
  session.history.push({ role: "user", content: userMessage });
  if (session.history.length > 30) session.history.splice(0, 2);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 1500,
        system: buildSystemPrompt("Right now you're brainstorming privately with an admin in their DMs. Help them develop and sharpen their idea: ask clarifying questions, suggest improvements, point out trade-offs, and shape it into a clear, actionable proposal. When they're ready, they'll type `!submit <title>` to send the polished idea to the admin review channel."),
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
        system: "Summarize the following brainstorm into a clean, structured proposal for an ARK cluster admin team to review. Use short sections: **Summary**, **Details**, and **Open Questions**. Be concise. Output only the proposal, no preamble.",
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
  const reviewCh = findChannel(guild, "idea-review");
  if (!reviewCh) return user.send("❌ The #idea-review channel doesn't exist yet.");

  let body = await summarizeBrainstorm(session.history);
  if (!body) {
    const userMsgs = session.history.filter(m => m.role === "user").map(m => m.content);
    body = userMsgs.length ? userMsgs.join("\n\n") : "*(No brainstorm content captured.)*";
  }
  if (body.length > 3500) body = body.slice(0, 3500) + "…";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("idea_approve").setLabel("✅ Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("idea_reject").setLabel("❌ Reject").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("idea_discuss").setLabel("💬 Open Discussion").setStyle(ButtonStyle.Secondary),
  );
  const msg = await reviewCh.send({
    embeds: [new EmbedBuilder().setTitle(`💡  ${title}`).setColor(0xffc83d)
      .setDescription(body).addFields({ name: "Status", value: "🕓 Pending review", inline: true })
      .setFooter({ text: `Submitted by ${user.tag}` }).setTimestamp()],
    components: [row],
  });
  await user.send(`✅ Your idea **"${title}"** has been submitted to <#${reviewCh.id}> for review.`);
  await logAction(guild, 0xffc83d, "💡 Idea Submitted", [
    { name: "Submitted by", value: user.tag, inline: true },
    { name: "Title",        value: title,    inline: true },
    { name: "Review",       value: `[Jump to idea](${msg.url})` },
  ]);
}

async function handleIdeaDecision(interaction, decision) {
  if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ Only admins can decide on ideas.", ephemeral: true });
  const original = interaction.message.embeds[0];
  if (!original) return;
  const isApprove = decision === "approve";
  const newEmbed  = EmbedBuilder.from(original).setColor(isApprove ? 0x1ec864 : 0xff0000)
    .spliceFields(0, 1, { name: "Status", value: isApprove ? `✅ Approved by ${interaction.user.tag}` : `❌ Rejected by ${interaction.user.tag}`, inline: true });
  await interaction.update({
    embeds: [newEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("idea_approve").setLabel("✅ Approve").setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId("idea_reject").setLabel("❌ Reject").setStyle(ButtonStyle.Danger).setDisabled(true),
      new ButtonBuilder().setCustomId("idea_discuss").setLabel("💬 Open Discussion").setStyle(ButtonStyle.Secondary),
    )],
  });
  await logAction(interaction.guild, isApprove ? 0x1ec864 : 0xff0000, isApprove ? "✅ Idea Approved" : "❌ Idea Rejected", [
    { name: "Decided by", value: interaction.user.tag, inline: true },
    { name: "Idea",       value: original.title || "Untitled", inline: true },
  ]);
}

async function handleIdeaDiscuss(interaction) {
  if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ Only admins can open discussion.", ephemeral: true });
  try {
    const title  = (interaction.message.embeds[0]?.title || "Idea").replace("💡  ", "");
    const thread = await interaction.message.startThread({ name: `💬 ${title}`.slice(0, 90), autoArchiveDuration: 1440 });
    await interaction.reply({ content: `💬 Discussion thread opened: <#${thread.id}>`, ephemeral: true });
  } catch (err) { await interaction.reply({ content: `❌ Could not open thread: ${err.message}`, ephemeral: true }); }
}

// ── Tribe log watcher ─────────────────────────────────────────
function extractLogText(message) {
  let text = message.content || "";
  for (const e of message.embeds || []) {
    if (e.title)       text += "\n" + e.title;
    if (e.description) text += "\n" + e.description;
    for (const f of e.fields || []) text += `\n${f.name}: ${f.value}`;
  }
  return text.trim();
}

async function evaluateTribeLog(text) {
  if (!ANTHROPIC_API_KEY) {
    const hit = ["was killed by", "destroyed by", "demolished", "raided"].find(k => text.toLowerCase().includes(k));
    return hit ? { concerning: true, reason: `Keyword: "${hit}"` } : { concerning: false };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5", max_tokens: 150,
        system: "You monitor ARK: Survival Ascended tribe logs for a PvE cluster. Flag entries that are CONCERNING: player-vs-player damage (shouldn't happen on PvE), structures destroyed/demolished by other players, griefing, possible exploits or duping, mass simultaneous losses, offensive or harassing names. Routine events (taming, leveling, deaths to wild dinos, normal decay, members joining) are NOT concerning. Reply with exactly 'OK' if routine, or 'CONCERN: <brief reason>' if an admin should look.",
        messages: [{ role: "user", content: text.slice(0, 1500) }],
      }),
    });
    const data  = await res.json();
    const reply = (data.content?.[0]?.text || "").trim();
    if (/^concern/i.test(reply)) return { concerning: true, reason: reply.replace(/^concern:?\s*/i, "") };
    return { concerning: false };
  } catch { return { concerning: false }; }
}

// Tribe Data Logs category ID — monitor ALL channels inside it
const TRIBE_LOG_CATEGORY_ID = "1509765536643285022";

async function watchTribeLog(message) {
  if (!TRIBE_WATCH_ENABLED || !message.guild) return;
  const name     = message.channel?.name?.toLowerCase() || "";
  const parentId = message.channel?.parentId || "";
  // Match by category ID (catches all channels inside Tribe Data Logs)
  // OR by channel name containing "tribe-log" (fallback)
  const isTribeLogChannel = parentId === TRIBE_LOG_CATEGORY_ID || name.includes("tribe-log");
  if (!isTribeLogChannel) return;
  console.log(`[TribeWatch] Monitoring message in #${message.channel.name} (category: ${parentId})`);
  const text  = extractLogText(message);
  if (!text) return;
  const lower = text.toLowerCase();
  if (!TRIBE_FLAGS.some(k => lower.includes(k))) return;
  const last = tribeAlertCooldown.get(message.channel.id) || 0;
  if (Date.now() - last < TRIBE_COOLDOWN_MS) return;
  const verdict = await evaluateTribeLog(text);
  if (!verdict.concerning) return;
  tribeAlertCooldown.set(message.channel.id, Date.now());
  const alertCh = findChannel(message.guild, TRIBE_ALERT_CHANNEL);
  if (!alertCh) return;
  await alertCh.send({
    content: `🚨 <@&1242319080760467557> <@&1242319323145166868> — concerning tribe log activity`,
    embeds: [new EmbedBuilder().setTitle("🚨 Tribe Log Alert").setColor(0xff0000)
      .addFields(
        { name: "Source",    value: `<#${message.channel.id}>`, inline: true },
        { name: "Reason",    value: verdict.reason || "Flagged", inline: false },
        { name: "Log Entry", value: text.slice(0, 1000) },
      ).setFooter({ text: "Helena tribe-log watcher" }).setTimestamp()],
  }).catch(() => {});
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
  await interaction.editReply({ content: `📡 Broadcast:\n${rconSummary(results)}`, ephemeral: true });
  await logAction(interaction.guild, 0x5865f2, "📡 Broadcast", [
    { name: "Admin",   value: interaction.user.tag, inline: true },
    { name: "Server",  value: server,               inline: true },
    { name: "Message", value: message },
  ]);
}

async function handleWarn(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  const reason = interaction.options.getString("reason");
  if (!warnRecords.has(player)) warnRecords.set(player, []);
  warnRecords.get(player).push({ reason, admin: interaction.user.tag, server, date: new Date().toISOString() });
  saveData();
  const r = await sendRcon(server, `Broadcast WARNING issued to ${player}: ${reason}`);
  await interaction.editReply({ content: `⚠️ Warning issued to **${player}**. RCON: ${r.success ? "✅" : `❌ ${r.error}`}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xffa500, "⚠️ Player Warning", [
    { name: "Admin",  value: interaction.user.tag, inline: true },
    { name: "Player", value: player,               inline: true },
    { name: "Server", value: server,               inline: true },
    { name: "Reason", value: reason },
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
    { name: "Admin",  value: interaction.user.tag, inline: true },
    { name: "Player", value: player,               inline: true },
    { name: "Server", value: server,               inline: true },
    { name: "Reason", value: reason },
  ]);
}

async function handleBan(interaction) {
  const player   = interaction.options.getString("player");
  const server   = interaction.options.getString("server");
  const reason   = interaction.options.getString("reason");
  const duration = interaction.options.getString("duration") ?? "Permanent";
  banRecords.set(player, { reason, admin: interaction.user.tag, server, duration, date: new Date().toISOString() });
  saveData();
  const results = await sendRconMany(server, `BanPlayer ${player}`);
  await interaction.editReply({ content: `🔨 Ban:\n${rconSummary(results)}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0xff0000, "🔨 Player Banned", [
    { name: "Admin",    value: interaction.user.tag, inline: true },
    { name: "Player",   value: player,               inline: true },
    { name: "Server",   value: server,               inline: true },
    { name: "Duration", value: duration,             inline: true },
    { name: "Reason",   value: reason },
  ]);
}

async function handleUnban(interaction) {
  const player = interaction.options.getString("player");
  const server = interaction.options.getString("server");
  banRecords.delete(player);
  saveData();
  const results = await sendRconMany(server, `UnbanPlayer ${player}`);
  await interaction.editReply({ content: `✅ Unban:\n${rconSummary(results)}`, ephemeral: true });
  await logPlayerAction(interaction.guild, 0x00cc44, "✅ Player Unbanned", [
    { name: "Admin",  value: interaction.user.tag, inline: true },
    { name: "Player", value: player,               inline: true },
    { name: "Server", value: server,               inline: true },
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
    { name: "Admin", value: interaction.user.tag, inline: true },
    { name: "Server", value: server,              inline: true },
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
  longTermMemory.push({ text: fact, addedBy: interaction.user.tag, date: new Date().toISOString() });
  saveData();
  await interaction.editReply({ content: `🧠 Got it — I'll remember: *"${fact}"*`, ephemeral: true });
  await logAction(interaction.guild, 0x9b59b6, "🧠 Memory Added", [
    { name: "Added by", value: interaction.user.tag, inline: true },
    { name: "Fact",     value: fact },
  ]);
}

async function handleMemory(interaction) {
  if (!longTermMemory.length) return interaction.editReply({ content: "🧠 No memories yet. Add one with `/remember`.", ephemeral: true });
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
  if (!Object.keys(currentRates).length) return interaction.editReply({ content: "⚠️ Rates unavailable right now.", ephemeral: true });
  const lines = Object.entries(currentRates).filter(([k]) => RATE_LABELS[k]).map(([k, v]) => `**${labelRate(k)}:** \`${v}x\``);
  await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle("⚙️  Skii's Lodge — Live Cluster Rates").setColor(0x1ec864)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Pulled live from the cluster config" })
      .setTimestamp(ratesUpdatedAt || new Date())],
    ephemeral: true,
  });
}

// ── Online message ────────────────────────────────────────────
async function postOnlineMessage(guild) {
  for (const [id, name] of [[CHANNEL_IDS.adminConsole, "#admin-console"], [CHANNEL_IDS.staffChat, "#staff-chat"]]) {
    const ch = guild.channels.cache.get(id);
    if (!ch) { console.error(`❌ Could not find ${name}`); continue; }
    await ch.send({
      embeds: [new EmbedBuilder().setTitle("🟢  HELENA IS ONLINE").setColor(0x2ECC71)
        .setDescription(
          `Systems are up and I am ready to go.\n\n` +
          `🤖 **AI Brain:** ${ANTHROPIC_API_KEY ? "✅ Active" : "❌ Disabled"}\n` +
          `🕐 **Started:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
          `*Talk to me naturally in admin channels — ARK questions, polls, player issues.*`
        )
        .setFooter({ text: "Helena Walker — Skii's Lodge v2.5.0" })],
    }).catch(err => console.error(`❌ Online msg to ${name}: ${err.message}`));
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
  await pollServers();
  await postOnlineMessage(guild);

  setInterval(async () => { await fetchRates(); await pollServers(); }, UPDATE_INTERVAL_MINUTES * 60 * 1000);
  console.log("✅ Helena v2.5.0 setup complete!");
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
        await interaction.reply({ content: `✅ Platform roles updated: **${names}**`, ephemeral: true });
      } catch (err) { await interaction.reply({ content: `❌ Role assignment failed: ${err.message}`, ephemeral: true }); }
      return;
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (!isAdmin(interaction.member)) return interaction.reply({ content: "❌ Helena commands are restricted to the **Admin** role only.", ephemeral: true });
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
      default: await interaction.editReply({ content: "Unknown command." });
    }
  } catch (err) {
    console.error(`[Command] /${interaction.commandName}:`, err.message);
    await interaction.editReply({ content: `❌ Something went wrong: ${err.message}` }).catch(() => {});
  }
});

// ── MESSAGES ──────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  // Tribe watcher — runs on ALL messages (including bot posts) except Helena herself
  if (message.author.id !== client.user?.id) {
    watchTribeLog(message).catch(() => {});
  }

  if (message.author.bot) return;

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
      return message.reply("🚪 Sandbox session ended — nothing was submitted.");
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
    console.log(`[Sandbox] triggered by ${message.author.tag} in #${message.channel.name}`);
    let member = message.member;
    if (!member) {
      try { member = await guild.members.fetch(message.author.id); } catch {}
    }
    if (!isAdmin(member)) return message.reply("❌ Only admins can use the sandbox.");
    sandboxSessions.set(message.author.id, { history: [], guildId: guild.id });
    try {
      const dm = await message.author.createDM();
      await dm.send({
        embeds: [new EmbedBuilder().setTitle("🧪  Sandbox — Private Brainstorm").setColor(0xffc83d)
          .setDescription("Let's develop your idea privately. Just start typing and I'll help shape it.\n\n**`!submit <title>`** — send polished idea to #idea-review\n**`!cancel`** — discard session")],
      });
      await message.reply("📬 Check your DMs — let's brainstorm!");
    } catch (err) {
      sandboxSessions.delete(message.author.id);
      console.error(`[Sandbox] DM failed for ${message.author.tag}:`, err.message);
      await message.reply("❌ I couldn't DM you. Go to Server Settings → Privacy & Safety → Allow direct messages, then try again.");
    }
    return;
  }

  // ── !ai on/off ───────────────────────────────────────────
  if (lower === "!ai on" || lower === "!ai off") {
    let member = message.member;
    if (!member) {
      try { member = await guild.members.fetch(message.author.id); } catch {}
    }
    if (!isAdmin(member)) return message.reply("❌ Only admins can toggle Helena AI.");
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

  // ── !ai help ─────────────────────────────────────────────
  if (lower === "!ai help") {
    await message.reply([
      "**🤖 Helena v2.5.0 — Capabilities**",
      "",
      "**Server Info** — rates (live), rules, 13 maps, wipe schedule, admins",
      "**Game Knowledge** — taming, breeding, mutations, all maps, bosses, kibble, TEK",
      "**Live Status** — ask which servers are online right now",
      "**Support Triage** — diagnose bugs, escalate to admins",
      "",
      "**Admin Slash Commands** — `/warn`, `/kick`, `/ban`, `/announce`, `/rates`, `/remember` and more",
      "**`!sandbox`** — private DM to brainstorm ideas → submit to #idea-review",
      "**Tribe Watcher** — auto-flags concerning tribe log entries",
      "",
      "**#🤖︱ai** is always on. `!ai on/off` toggles AI in any channel (admin only).",
    ].join("\n"));
    return;
  }

  // Ignore other ! commands
  if (content.startsWith("!")) return;

  // ── AI response logic ─────────────────────────────────────
  const isPublicAi  = chId === AI_PUBLIC_CHANNEL_ID || message.channel.name === AI_PUBLIC_CHANNEL_NAME;
  const state       = channelAI.get(chId);
  const isToggled   = state?.enabled === true;
  const isAdminCh   = ADMIN_CHANNEL_IDS.has(chId);
  const isArkQuery  = /\?|tame|breed|mut|imprint|dino|tribe|base|raid|server|map|boss|ark|wipe|rate|kibble|egg|baby|hatch|poll|announce|ban|kick|warn|online|player|spawn|saddle|boss|alpha/i.test(content);

  if (!isPublicAi && !isToggled && !(isAdminCh && isArkQuery)) return;
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
console.log(`✅ Config OK | AI: ${ANTHROPIC_API_KEY ? "enabled" : "DISABLED"} | Guild: ${GUILD_ID}`);
client.login(DISCORD_TOKEN);
