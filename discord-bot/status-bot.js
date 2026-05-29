// ============================================================
//  SKII'S LODGE — ARK SERVER STATUS BOT
//  Fully configured for the Skii's Lodge cluster
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const http = require("http");

// ── Keepalive (required for Railway) ─────────────────────────────────────────
const PORT = process.env.STATUS_PORT || 3001;
http.createServer((req, res) => { res.writeHead(200); res.end("Status bot alive 🦕"); })
  .listen(PORT, () => console.log(`[Keepalive] Running on port ${PORT}`));

// ============================================================
//  CONFIG
// ============================================================

const DISCORD_TOKEN           = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID                = "636832636752625664";
const STATUS_EMBED_CHANNEL_ID = "1509809942968799252"; // #┃✅┃live-server-status
const UPDATE_INTERVAL_MINUTES = 5;

// Admin role IDs — only these roles can use !status
const ADMIN_ROLE_ID     = "1242319080760467557"; // Admin
const ARK_ADMIN_ROLE_ID = "1242319323145166868"; // ARK Admin's

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
//  STATE
// ============================================================

let statusMessageId = null;
const lastKnownState = {};

// ============================================================
//  ADMIN CHECK
// ============================================================

function isAdmin(member) {
  if (!member) return false;
  return member.roles.cache.has(ADMIN_ROLE_ID) || member.roles.cache.has(ARK_ADMIN_ROLE_ID);
}

// ============================================================
//  BATTLEMETRICS API
// ============================================================

async function fetchServerStatus(bmId) {
  try {
    const res = await fetch(`https://api.battlemetrics.com/servers/${bmId}`);
    if (!res.ok) return null;
    const json = await res.json();
    const attrs = json.data.attributes;
    return {
      online:     attrs.status === "online",
      players:    attrs.players,
      maxPlayers: attrs.maxPlayers,
      name:       attrs.name,
    };
  } catch {
    return null;
  }
}

async function discoverMissingServers() {
  const missing = SERVERS.filter((s) => s.bm_id === null);
  if (missing.length === 0) return;
  console.log(`[Discovery] Searching BattleMetrics for ${missing.length} missing server(s)...`);
  try {
    const res = await fetch(
      "https://api.battlemetrics.com/servers?filter[game]=arksa&filter[search]=Skii%27s&page[size]=50"
    );
    if (!res.ok) return;
    const json = await res.json();
    for (const result of json.data) {
      const bmId   = result.id;
      const bmName = result.attributes.name.toLowerCase().replace(/\s/g, "");
      for (const server of SERVERS) {
        if (server.bm_id !== null) continue;
        const keyword = server.name.toLowerCase().replace(/\s/g, "");
        if (bmName.includes(keyword)) {
          server.bm_id = bmId;
          console.log(`[Discovery] Matched: ${server.name} → BM ID ${bmId} (${result.attributes.name})`);
          break;
        }
      }
    }
    const stillMissing = SERVERS.filter(s => s.bm_id === null).map(s => s.name);
    if (stillMissing.length) console.log(`[Discovery] Still unmatched: ${stillMissing.join(", ")}`);
  } catch (err) {
    console.error("[Discovery] Error:", err.message);
  }
}

// ============================================================
//  CHANNEL NAME HELPERS
// ============================================================

function formatChannelName(serverName, data) {
  if (!data)        return `⚫︱${serverName}`;
  if (!data.online) return `🔴︱${serverName}`;
  return `🟢︱${serverName} ${data.players}/${data.maxPlayers}`;
}

async function updateChannelName(guild, channelId, newName) {
  if (!channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    if (channel.name === newName) return;
    await channel.setName(newName);
    console.log(`[Channel] ✅ ${newName}`);
  } catch (err) {
    console.warn(`[Channel] Could not update ${channelId}: ${err.message}`);
  }
}

// ============================================================
//  STATUS EMBED
// ============================================================

function playerBar(players, maxPlayers, length = 8) {
  if (!maxPlayers) return "";
  const filled = Math.round((players / maxPlayers) * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

function buildEmbed(results) {
  const online = results.filter((r) => r.data?.online).length;
  const total  = results.length;

  const lines = results.map(({ server, data }) => {
    if (!data)        return `⚫  **${server.name}** — unavailable`;
    if (!data.online) return `🔴  **${server.name}** — offline`;
    const bar = playerBar(data.players, data.maxPlayers);
    return `🟢  **${server.name}**  \`${data.players}/${data.maxPlayers}\`  ${bar}`;
  });

  return new EmbedBuilder()
    .setTitle("🦕  Skii's Lodge — Live Server Status")
    .setColor(0x1ec864)
    .setDescription(
      `**${online}/${total}** servers online\n` +
      "──────────────────────────────\n" +
      lines.join("\n")
    )
    .setFooter({ text: "Updates every 5 minutes  •  BattleMetrics" })
    .setTimestamp();
}

// ============================================================
//  MAIN POLL
// ============================================================

async function pollServers() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error("[Poll] Guild not found."); return; }

  const results = await Promise.all(
    SERVERS.map(async (server) => {
      const data = server.bm_id ? await fetchServerStatus(server.bm_id) : null;
      return { server, data };
    })
  );

  // Update voice channel names — only on actual state change
  for (const { server, data } of results) {
    const newName  = formatChannelName(server.name, data);
    const lastName = lastKnownState[server.name];
    if (newName !== lastName) {
      lastKnownState[server.name] = newName;
      await updateChannelName(guild, server.channel_id, newName);
      await new Promise((r) => setTimeout(r, 1500)); // rate limit buffer
    }
  }

  // Update or post the status embed
  const statusChannel = guild.channels.cache.get(STATUS_EMBED_CHANNEL_ID);
  if (!statusChannel) { console.warn("[Embed] Status channel not found."); return; }

  const embed = buildEmbed(results);

  if (statusMessageId) {
    try {
      const existing = await statusChannel.messages.fetch(statusMessageId);
      await existing.edit({ embeds: [embed] });
      console.log(`[Embed] ✅ Updated — ${new Date().toLocaleTimeString()}`);
      return;
    } catch {
      statusMessageId = null;
    }
  }

  const msg = await statusChannel.send({ embeds: [embed] });
  statusMessageId = msg.id;
  console.log(`[Embed] ✅ Posted (ID: ${msg.id})`);
}

// ============================================================
//  DISCORD CLIENT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(`[Bot] ✅ Logged in as ${client.user.tag}`);
  await discoverMissingServers();
  await pollServers();
  setInterval(pollServers, UPDATE_INTERVAL_MINUTES * 60 * 1000);
});

// ── !status command — admin only ─────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== "!status") return;

  const member = message.member || await message.guild?.members.fetch(message.author.id).catch(() => null);

  if (!isAdmin(member)) {
    await message.reply("🚫 That command is for admins only.");
    console.log(`[!status] Denied for ${message.author.username} — missing admin role`);
    return;
  }

  console.log(`[!status] Triggered by admin ${message.author.username}`);
  await message.reply("🔄 Polling servers now...");
  await pollServers();
  await message.channel.send("✅ Status updated!");
});

client.on("error", (err) => console.error("[Client] Error:", err.message));
process.on("unhandledRejection", (r) => console.error("[Unhandled]", r));

if (!DISCORD_TOKEN) { console.error("❌ DISCORD_BOT_TOKEN not set"); process.exit(1); }
client.login(DISCORD_TOKEN);
