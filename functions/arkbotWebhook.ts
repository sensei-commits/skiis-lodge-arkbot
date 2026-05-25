import base44 from 'npm:@base44/sdk';

const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN') || '';
const DISCORD_WEBHOOK_SECRET = Deno.env.get('DISCORD_WEBHOOK_SECRET') || '';
const BASE44_API_KEY = Deno.env.get('BASE44_API_KEY') || '';
const APP_ID = '6a10ba67d4688599c08a387c';

// ── CHANNEL IDs ──────────────────────────────────────────────────────────────
const ARK_GENERAL_CHANNEL_ID    = '1173768088089534596';
const ADMIN_LOGS_CHANNEL_ID     = '1275132184440868866';
const WELCOME_CHANNEL_ID        = '636832636752625666';
const STAFF_CHAT_CHANNEL_ID     = '1276128810609152030';
const ADMIN_STUFF_CHANNEL_ID    = '1274810759485980704';
const SUPPORT_TICKET_CHANNEL_ID = '1390284806650331146';
const BOT_USER_ID               = '1507730299356708984';
const ADMIN_ROLE_ID             = '703389459747700807';
const ARK_ADMIN_ROLE_ID         = '703397175538876428';

// Public channels Helena responds in (NOT supporter-chat)
const PUBLIC_CHANNELS = [
  ARK_GENERAL_CHANNEL_ID,
  ADMIN_STUFF_CHANNEL_ID,
];

// All monitored channels
const MONITORED_CHANNELS = [
  ...PUBLIC_CHANNELS,
  STAFF_CHAT_CHANNEL_ID,
  SUPPORT_TICKET_CHANNEL_ID,
];

// ── DINO DATA ─────────────────────────────────────────────────────────────────
interface DinoData {
  name: string; aliases: string[]; map: string[];
  tameMethod: 'knockout' | 'passive' | 'raise' | 'special';
  tameFood: string[]; kibble?: string; tameTimeMin: string;
  torporDrain: 'fast' | 'medium' | 'slow'; maturationHrsVanilla: number;
  imprint: boolean; useCase: string; tips: string; bossFight?: string;
}

const DINOS: DinoData[] = [
  { name: 'Rex', aliases: ['rex', 't-rex', 'trex', 't rex'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero', 'Lost Island', 'Fjordur'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Meat', 'Raw Mutton'], kibble: 'Exceptional Kibble (Yutyrannus egg)', tameTimeMin: '~30–60 min', torporDrain: 'medium', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Boss fights, general combat, heavy DPS', tips: 'Stack melee mutations for boss runs. Breed a dedicated boss Rex line with 40+ mutations.', bossFight: 'Island bosses (Broodmother, Megapithecus, Dragon)' },
  { name: 'Giganotosaurus', aliases: ['giga', 'giganotosaurus', 'giga rex'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Lost Island'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~1–2 hrs (torpor drains FAST)', torporDrain: 'fast', maturationHrsVanilla: 17.5, imprint: true, useCase: 'Offline deterrent, mass dino killing, PvP', tips: 'Torpor drains EXTREMELY fast — stacks of narcotics required. Always imprint your Giga. Use Shocking Tranq Darts.' },
  { name: 'Therizinosaurus', aliases: ['theri', 'therizinosaurus', 'tickle chicken'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero', 'Crystal Isles'], tameMethod: 'knockout', tameFood: ['Superior Kibble', 'Crops', 'Berries'], kibble: 'Superior Kibble (Brontosaurus egg)', tameTimeMin: '~30–50 min', torporDrain: 'medium', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Boss fights (best all-rounder), harvesting, PvP', tips: 'Best all-purpose boss dino. Stack health AND melee mutations.', bossFight: 'All Island bosses and most other bosses' },
  { name: 'Spino', aliases: ['spino', 'spinosaur', 'spinosaurus'], map: ['The Island', 'The Center', 'Ragnarok', 'Valguero'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Fish Meat', 'Raw Prime Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~30–45 min', torporDrain: 'fast', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Fast combat mount, water combat, boss alternative', tips: 'Torpor drains fast — stock narcotics. Gets speed/damage buff near water.' },
  { name: 'Yutyrannus', aliases: ['yuty', 'yutyrannus', 'yuti'], map: ['The Island', 'Ragnarok', 'Valguero', 'Lost Island'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~25–40 min', torporDrain: 'fast', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Boss fights — courage roar buffs your entire dino army', tips: 'Courage roar = +25% damage. Always pair with a Daeodon.', bossFight: 'All boss fights as support' },
  { name: 'Carnotaurus', aliases: ['carno', 'carnotaurus', 'bull'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero', 'Lost Island'], tameMethod: 'knockout', tameFood: ['Regular Kibble', 'Raw Prime Meat', 'Raw Mutton'], kibble: 'Regular Kibble (Raptor egg)', tameTimeMin: '~10–20 min', torporDrain: 'medium', maturationHrsVanilla: 5.0, imprint: true, useCase: 'Fast land combat, early fighter, chase mount', tips: 'Fast and agile — great early combat mount before you get a Rex.' },
  { name: 'Allosaurus', aliases: ['allo', 'allosaurus', 'allo pack'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero'], tameMethod: 'knockout', tameFood: ['Prime Meat Jerky', 'Raw Prime Meat'], kibble: 'Regular Kibble', tameTimeMin: '~15–25 min', torporDrain: 'medium', maturationHrsVanilla: 6.25, imprint: true, useCase: 'Pack combat — pack buff = massive damage boost', tips: 'Pack buff activates with 3+ together. A trio can rival a Rex.' },
  { name: 'Megatherium', aliases: ['megatherium', 'sloth', 'giant sloth', 'mega sloth'], map: ['The Island', 'Ragnarok', 'Valguero', 'Lost Island'], tameMethod: 'knockout', tameFood: ['Superior Kibble', 'Crops', 'Berries'], kibble: 'Superior Kibble', tameTimeMin: '~20–35 min', torporDrain: 'medium', maturationHrsVanilla: 6.25, imprint: true, useCase: 'Broodmother boss, insect killing (massive buff)', tips: 'ESSENTIAL for Broodmother. Massive buff when killing insects.', bossFight: 'Broodmother Lysrix (The Island)' },
  { name: 'Carcharodontosaurus', aliases: ['carcha', 'carcharodontosaurus', 'carch', 'shark tooth dino'], map: ['Scorched Earth', 'Lost Island', 'Fjordur'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~45–75 min', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'End-game combat — frenzy stacks make it stronger as it kills', tips: 'Torpor drains very slowly. Frenzy stacks rival Giga in raw power.', bossFight: 'Scorched Earth Manticore and other bosses' },
  { name: 'Wyvern', aliases: ['wyvern', 'fire wyvern', 'lightning wyvern', 'poison wyvern', 'ice wyvern'], map: ['Scorched Earth', 'Ragnarok', 'Valguero', 'Crystal Isles', 'Lost Island', 'Fjordur'], tameMethod: 'raise', tameFood: ['Wyvern Milk (babies)', 'Raw Meat (after juvenile)'], tameTimeMin: 'Steal egg + raise (~4 hrs at server rates)', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Fast flying combat, aerial assault, transport', tips: 'Wyvern Milk only from unconscious female Wyverns. Babies NEED milk until juvenile.' },
  { name: 'Crystal Wyvern', aliases: ['crystal wyvern', 'crystal wyv', 'blood crystal wyvern', 'ember crystal wyvern', 'tropical crystal wyvern'], map: ['Crystal Isles'], tameMethod: 'passive', tameFood: ['Primal Crystal'], tameTimeMin: '~15–30 min (passive)', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Flying combat, easier alternative to regular Wyverns', tips: 'Passive tamed — no egg stealing! Feed Primal Crystal.' },
  { name: 'Argentavis', aliases: ['argy', 'argentavis', 'argent'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero', 'Crystal Isles'], tameMethod: 'knockout', tameFood: ['Regular Kibble', 'Raw Prime Meat', 'Raw Mutton'], kibble: 'Regular Kibble (Carno egg)', tameTimeMin: '~15–25 min', torporDrain: 'medium', maturationHrsVanilla: 6.25, imprint: true, useCase: 'Best mid-game flyer, carry weight, mobile smithy', tips: 'Argy saddle = smithy. Carry an Anky for the best metal runs.' },
  { name: 'Quetzal', aliases: ['quetz', 'quetzal', 'quetzalcoatlus'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Crystal Isles'], tameMethod: 'knockout', tameFood: ['Extraordinary Kibble', 'Raw Prime Meat'], kibble: 'Extraordinary Kibble', tameTimeMin: '~45–70 min (never lands — use Tapejara)', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Flying platform base, mass resource hauling, metal runs', tips: 'Quetzals never land. Chase on a Tapejara. Platform saddle = flying base.' },
  { name: 'Pteranodon', aliases: ['ptero', 'pteranodon', 'ptera'], map: ['All maps'], tameMethod: 'knockout', tameFood: ['Simple Kibble', 'Raw Prime Meat', 'Raw Meat'], kibble: 'Simple Kibble (Dodo egg)', tameTimeMin: '~5–10 min (FAST torpor!)', torporDrain: 'fast', maturationHrsVanilla: 3.75, imprint: false, useCase: 'Early game flyer, fast scout', tips: 'Torpor drains extremely fast — act immediately! Upgrade to Argy ASAP.' },
  { name: 'Tapejara', aliases: ['tapejara', 'tape', 'tapejaras'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero', 'Crystal Isles'], tameMethod: 'knockout', tameFood: ['Regular Kibble', 'Raw Prime Meat'], kibble: 'Regular Kibble', tameTimeMin: '~10–20 min', torporDrain: 'medium', maturationHrsVanilla: 3.75, imprint: false, useCase: 'Quetzal taming, 3-person mount, cliff/cave access', tips: 'Can land on walls and ceilings. KEY tool for Quetzal taming.' },
  { name: 'Griffin', aliases: ['griffin', 'royal griffin', 'griff'], map: ['Ragnarok', 'Valguero', 'Crystal Isles', 'Lost Island'], tameMethod: 'knockout', tameFood: ['Extraordinary Kibble', 'Raw Prime Meat'], kibble: 'Extraordinary Kibble', tameTimeMin: '~20–35 min', torporDrain: 'medium', maturationHrsVanilla: 5.625, imprint: false, useCase: 'Fast solo flying mount, dive-bomb attacks', tips: 'Cannot be bred if tamed. Great solo mount for fast travel and dive attacks.' },
  { name: 'Rock Drake', aliases: ['rock drake', 'drake', 'featherlight drake'], map: ['Aberration', 'Valguero (eggs only)', 'Lost Island (eggs only)'], tameMethod: 'raise', tameFood: ['Raw Meat (babies)', 'Raw Prime Meat'], tameTimeMin: 'Steal egg + raise (~2.5 hrs at server rates)', torporDrain: 'slow', maturationHrsVanilla: 11.25, imprint: true, useCase: 'Aberration climbing, stealth gliding, surface runs', tips: 'Need a Rock Drake to safely reach egg nests. Use Nameless Venom for imprinting.' },
  { name: 'Reaper', aliases: ['reaper', 'reaper king', 'reaper queen', 'xenomorph'], map: ['Aberration'], tameMethod: 'special', tameFood: ['Raw Meat', 'Raw Prime Meat'], tameTimeMin: 'Impregnation mechanic — baby spawns ~12 hrs after', torporDrain: 'slow', maturationHrsVanilla: 12.5, imprint: true, useCase: 'Aberration combat king, high DPS and HP', tips: 'Let a low-HP Reaper Queen grab you while at low HP. Bring Nameless Venom.' },
  { name: 'Basilisk', aliases: ['basilisk', 'snek', 'snake', 'big snake'], map: ['Aberration', 'Genesis 2'], tameMethod: 'passive', tameFood: ['Fertilized Rock Drake Eggs (best)', 'Any fertilized egg'], tameTimeMin: '~20–40 min', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Aberration underground travel, combat, ambush predator', tips: 'Drop fert eggs on the ground — NO other dinos nearby or it flees.' },
  { name: 'Shadowmane', aliases: ['shadowmane', 'shadow mane', 'shadowcat'], map: ['Genesis 2', 'Fjordur'], tameMethod: 'passive', tameFood: ['Filled Fish Basket (large fish)', 'Swordfish'], tameTimeMin: '~15–30 min (sleep tame)', torporDrain: 'slow', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Stealth, teleportation, PvP ambush, solo combat', tips: 'Feed while it sleeps at night — approach slowly from behind.' },
  { name: 'Andrewsarchus', aliases: ['andrewsarchus', 'andrew', 'andrews'], map: ['Fjordur', 'Scorched Earth'], tameMethod: 'passive', tameFood: ['Sweet Vegetable Cake'], tameTimeMin: '~10–20 min (passive)', torporDrain: 'slow', maturationHrsVanilla: 3.5, imprint: false, useCase: 'Fast land transport, motorboat mount on water surfaces', tips: 'Can ride water surfaces at high speed. Unique utility mount.' },
  { name: 'Amargasaurus', aliases: ['amarga', 'amargasaurus', 'spiky dino', 'ice dino'], map: ['Fjordur', 'Lost Island'], tameMethod: 'knockout', tameFood: ['Extraordinary Kibble', 'Crops', 'Berries'], kibble: 'Extraordinary Kibble', tameTimeMin: '~20–35 min', torporDrain: 'slow', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Area damage, ice/fire debuffs, PvP zone control', tips: 'Shoots spine projectiles with cold or fire debuffs. Great for crowd control.' },
  { name: 'Desmodus', aliases: ['desmodus', 'bat', 'vampire bat', 'blood bat'], map: ['Fjordur'], tameMethod: 'passive', tameFood: ['Blood Packs (from your own HP)'], tameTimeMin: '~15–25 min (passive)', torporDrain: 'slow', maturationHrsVanilla: 3.75, imprint: true, useCase: 'Stealth flying, wall-clinging, cave runs', tips: 'Passive tame with Blood Packs. Clings to walls and ceilings.' },
  { name: 'Noglin', aliases: ['noglin', 'mind control', 'alien brain', 'brain bug'], map: ['Genesis 2'], tameMethod: 'passive', tameFood: ['Attach to a domesticated creature'], tameTimeMin: 'Attach to a tamed dino, collect after timer', torporDrain: 'slow', maturationHrsVanilla: 2.5, imprint: false, useCase: 'Mind-control creatures temporarily, unique utility', tips: 'Attaches to a tamed dino to tame it. Can temporarily mind-control enemies.' },
  { name: 'Ankylosaurus', aliases: ['anky', 'ankylosaurus', 'ankylosaur'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero', 'Crystal Isles'], tameMethod: 'knockout', tameFood: ['Simple Kibble', 'Berries', 'Mejoberries'], kibble: 'Simple Kibble (Dodo egg)', tameTimeMin: '~10–20 min', torporDrain: 'slow', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Metal, flint, crystal, obsidian harvesting', tips: 'Carry on an Argy for insane metal runs. Stack weight heavily.' },
  { name: 'Doedicurus', aliases: ['doedicurus', 'doed', 'doedic', 'doeic', 'armadillo'], map: ['The Island', 'Scorched Earth', 'Ragnarok', 'Valguero'], tameMethod: 'knockout', tameFood: ['Simple Kibble', 'Berries', 'Mejoberries'], kibble: 'Simple Kibble (Dodo egg)', tameTimeMin: '~10–20 min', torporDrain: 'slow', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Best stone harvester in the game', tips: 'Carry on Argy like an Anky. Stack weight. Roll into ball for fast travel.' },
  { name: 'Beaver', aliases: ['beaver', 'castoroides', 'giant beaver'], map: ['The Island', 'Ragnarok', 'Valguero'], tameMethod: 'knockout', tameFood: ['Simple Kibble', 'Crops', 'Berries'], kibble: 'Simple Kibble', tameTimeMin: '~10–15 min', torporDrain: 'medium', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Cementing Paste, wood harvesting, mobile storage', tips: 'Wild Beaver dams have FREE Cementing Paste — always check them!' },
  { name: 'Mammoth', aliases: ['mammoth', 'woolly mammoth', 'mammath'], map: ['The Island', 'Ragnarok', 'Valguero', 'Fjordur'], tameMethod: 'knockout', tameFood: ['Regular Kibble', 'Crops', 'Berries'], kibble: 'Regular Kibble', tameTimeMin: '~15–25 min', torporDrain: 'medium', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Best wood and thatch harvester', tips: 'Stack melee and weight. Carry on a Quetz for mega wood runs.' },
  { name: 'Brontosaurus', aliases: ['bronto', 'brontosaurus', 'brontosaur', 'sauropod'], map: ['The Island', 'Ragnarok', 'Valguero', 'Crystal Isles'], tameMethod: 'knockout', tameFood: ['Superior Kibble', 'Crops', 'Berries'], kibble: 'Superior Kibble (Sarco egg)', tameTimeMin: '~30–50 min', torporDrain: 'slow', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Mass berry harvesting, platform saddle base', tips: 'Platform saddle = mobile base. Tail swing clears entire berry fields.' },
  { name: 'Gacha', aliases: ['gacha', 'gacha claus'], map: ['Extinction'], tameMethod: 'passive', tameFood: ['Snow Owl Pellets', 'Stones', 'Seeds', 'Berries'], tameTimeMin: '~10–15 min (passive)', torporDrain: 'slow', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Passive crafting — produces resources and element dust', tips: 'Pair male + female and feed stones/seeds for Gacha Crystals.' },
  { name: 'Magmasaur', aliases: ['magmasaur', 'lava lizard', 'magma'], map: ['Genesis 1', 'Lost Island'], tameMethod: 'raise', tameFood: ['Ambergris (babies)', 'Raw Metal after juvenile'], tameTimeMin: 'Steal egg + raise (~2 hrs at server rates)', torporDrain: 'slow', maturationHrsVanilla: 8.75, imprint: true, useCase: 'Metal smelting on the go, lava biome combat', tips: 'Smelts metal IN ITS INVENTORY while moving.' },
  { name: 'Maewing', aliases: ['maewing', 'maewing nurse', 'platypus'], map: ['Genesis 2', 'Lost Island'], tameMethod: 'passive', tameFood: ['Sweet Vegetable Cake'], tameTimeMin: '~10–15 min', torporDrain: 'slow', maturationHrsVanilla: 2.5, imprint: false, useCase: 'Automated baby nursing — feeds ALL babies in range', tips: 'THE best breeding utility creature. Must-have for breeders.' },
  { name: 'Sinomacrops', aliases: ['sino', 'sinomacrops', 'glider bug', 'manta bug'], map: ['Lost Island'], tameMethod: 'passive', tameFood: ['Bug Repellant (wear to approach)', 'Chitin'], tameTimeMin: '~5–10 min (passive)', torporDrain: 'slow', maturationHrsVanilla: 2.0, imprint: false, useCase: 'Living parachute shoulder pet — slows your fall', tips: 'Equip as shoulder pet — acts as a parachute. Great for cliff bases.' },
  { name: 'Mosasaurus', aliases: ['mosa', 'mosasaurus', 'mosas'], map: ['The Island', 'The Center', 'Ragnarok', 'Genesis 1'], tameMethod: 'knockout', tameFood: ['Extraordinary Kibble', 'Raw Prime Fish Meat'], kibble: 'Extraordinary Kibble', tameTimeMin: '~45–75 min', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Deep ocean combat, underwater platform base', tips: 'Platform saddle = underwater base. Hard to tame solo.' },
  { name: 'Basilosaurus', aliases: ['basilo', 'basilosaurus', 'basi'], map: ['The Island', 'The Center', 'Ragnarok', 'Genesis 1'], tameMethod: 'passive', tameFood: ['Exceptional Kibble', 'Raw Prime Fish Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~20–35 min', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Ocean tanking, immune to Jellyfish and Electrophorus', tips: 'IMMUNE to Jellyfish stuns — essential for deep ocean travel.' },
  { name: 'Tusoteuthis', aliases: ['tuso', 'tusoteuthis', 'giant squid', 'squid'], map: ['The Island', 'The Center', 'Ragnarok', 'Genesis 1'], tameMethod: 'passive', tameFood: ['Black Pearls'], tameTimeMin: '~20–30 min (it will grab you — keep feeding!)', torporDrain: 'slow', maturationHrsVanilla: 10.0, imprint: true, useCase: 'Deep ocean combat, Black Pearl farming, oil production', tips: 'Feed Black Pearls while it grabs you. Apex ocean predator.' },
  { name: 'Ichthyosaurus', aliases: ['ichthy', 'ichthyosaurus', 'dolphin'], map: ['The Island', 'The Center', 'Ragnarok', 'Crystal Isles'], tameMethod: 'passive', tameFood: ['Regular Kibble', 'Raw Prime Fish Meat'], kibble: 'Regular Kibble', tameTimeMin: '~5–10 min', torporDrain: 'slow', maturationHrsVanilla: 2.5, imprint: false, useCase: 'Fast early ocean mount, stamina regen while riding', tips: 'Fastest early ocean mount. Stamina regens while riding.' },
  { name: 'Megalodon', aliases: ['mega', 'megalodon', 'shark', 'giant shark'], map: ['The Island', 'The Center', 'Ragnarok', 'Crystal Isles', 'Genesis 1'], tameMethod: 'knockout', tameFood: ['Regular Kibble', 'Raw Prime Fish Meat'], kibble: 'Regular Kibble', tameTimeMin: '~15–25 min', torporDrain: 'medium', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Ocean combat, mid-tier sea mount, pack hunter', tips: 'Pack buff with 3+. Decent mid-tier ocean mount before Basilo or Mosa.' },
  { name: 'Daeodon', aliases: ['daeodon', 'dao', 'healing pig', 'pig'], map: ['The Island', 'Ragnarok', 'Valguero'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~15–25 min', torporDrain: 'medium', maturationHrsVanilla: 5.0, imprint: false, useCase: 'Boss fight healer — AOE heal for your entire dino army', tips: 'Always bring a Daeodon to boss fights. AOE heal saves Rex armies.', bossFight: 'All boss fights as healer' },
  { name: 'Snow Owl', aliases: ['snow owl', 'owl', 'snowy owl'], map: ['Extinction'], tameMethod: 'knockout', tameFood: ['Extraordinary Kibble', 'Raw Prime Meat'], kibble: 'Extraordinary Kibble', tameTimeMin: '~20–30 min', torporDrain: 'medium', maturationHrsVanilla: 5.625, imprint: false, useCase: 'Healing freeze, scouting, Gacha farming', tips: 'Can freeze itself and nearby creatures to heal. Produces Snow Owl Pellets.' },
  { name: 'Fenrir', aliases: ['fenrir', 'fenris'], map: ['Fjordur (boss reward)'], tameMethod: 'special', tameFood: ['N/A'], tameTimeMin: 'Defeat the Fenrisulfr boss on Fjordur', torporDrain: 'slow', maturationHrsVanilla: 0, imprint: false, useCase: 'Fast movement, powerful combat', tips: 'Earned by beating Fenrisulfr boss on Fjordur. Fully transferable across the cluster!' },
  { name: 'Stryder', aliases: ['stryder', 'tek strider', 'stryker'], map: ['Genesis 2'], tameMethod: 'special', tameFood: ['Hacking mini-games'], tameTimeMin: 'Complete 3 hacking mini-games on the Stryder', torporDrain: 'slow', maturationHrsVanilla: 0, imprint: false, useCase: 'Best resource harvester with TEK attachments', tips: 'Add a Mining Drill attachment after taming for insane harvesting.' },
  { name: 'Dinopithecus', aliases: ['dinopithecus', 'monkey', 'chimp', 'dino monkey'], map: ['Lost Island'], tameMethod: 'knockout', tameFood: ['Exceptional Kibble', 'Raw Prime Meat'], kibble: 'Exceptional Kibble', tameTimeMin: '~15–25 min', torporDrain: 'medium', maturationHrsVanilla: 5.625, imprint: true, useCase: 'Tree climbing, base defense, feces throwing', tips: 'Can climb trees and throw feces to slow/blind players.' },
];

function findDino(input: string): DinoData | null {
  const lower = input.toLowerCase();
  return DINOS.find(d => d.aliases.some(alias => lower.includes(alias))) || null;
}

function calcMaturation(vanillaHrs: number) {
  const totalHrs = Math.round((vanillaHrs / 2.5) * 10) / 10;
  const totalMins = Math.round(totalHrs * 60);
  return { totalHrs, totalMins, juvenileEndMins: Math.round(totalMins * 0.1), adolescentEndMins: Math.round(totalMins * 0.5) };
}

function buildDinoResponse(dino: DinoData, username: string, queryType: 'taming' | 'maturation' | 'full'): string {
  const mat = dino.maturationHrsVanilla > 0 ? calcMaturation(dino.maturationHrsVanilla) : null;
  const methodLabel = dino.tameMethod === 'raise' ? '🥚 Raise from egg' : dino.tameMethod === 'passive' ? '🤝 Passive' : dino.tameMethod === 'special' ? '⚡ Special mechanic' : '💤 Knockout';
  const torporLabel = dino.torporDrain === 'fast' ? '🔴 FAST — act immediately!' : dino.torporDrain === 'slow' ? '🟢 Slow — plenty of time' : '🟡 Moderate pace';
  if (queryType === 'taming') return (
    `🦕 **${dino.name} Taming** (at 2.5x):\n• **Method:** ${methodLabel}\n• **Best food:** ${dino.tameFood[0]}\n` +
    (dino.kibble ? `• **Kibble:** ${dino.kibble}\n` : '') +
    `• **Tame time:** ${dino.tameTimeMin}\n` +
    (dino.tameMethod === 'knockout' ? `• **Torpor drain:** ${torporLabel}\n` : '') +
    `• **Found on:** ${dino.map.join(', ')}\n💡 *${dino.tips}*`
  );
  if (queryType === 'maturation' && mat) return (
    `⏱️ **${dino.name} Maturation** (at 2.5x):\n• Full maturation: **~${mat.totalHrs} hrs** (${mat.totalMins} min)\n` +
    `• Juvenile ends (~10%): ~${mat.juvenileEndMins} min\n• Adolescent ends (~50%): ~${mat.adolescentEndMins} min\n` +
    `• Baby food: **0.1x** — don't overfill the trough!\n` +
    (dino.imprint ? `• ✅ Imprint available` : `• ℹ️ No imprint for ${dino.name}`)
  );
  return (
    `🦕 **${dino.name}** — Quick Guide:\n• **Tame:** ${methodLabel} | **Food:** ${dino.tameFood[0]}\n` +
    (dino.kibble ? `• **Kibble:** ${dino.kibble}\n` : '') +
    `• **Tame time:** ${dino.tameTimeMin}\n` +
    (mat ? `• **Maturation:** ~${mat.totalHrs} hrs (${mat.totalMins} min) at 2.5x\n` : '') +
    `• **Best for:** ${dino.useCase}\n• **Found on:** ${dino.map.join(', ')}\n💡 *${dino.tips}*` +
    (dino.bossFight ? `\n🏆 *Boss use: ${dino.bossFight}*` : '')
  );
}

// ── KEYWORDS ──────────────────────────────────────────────────────────────────
const SUPPORT_KEYWORDS = ['stuck', 'glitch', 'lost dino', 'hacker'];

const CRITICAL_KEYWORDS = [
  'mesh', 'meshing', 'meshed', 'under the map', 'hacker', 'hacking', 'cheater', 'cheating', 'exploit',
  'crash', 'crashed', 'server down', 'server crash', 'character lost', 'char lost', 'lost my character',
  'dino lost', 'lost my dino', 'items lost', 'lost my stuff', 'stuck under', 'stuck in mesh',
  'harassment', 'harassing', 'threatening', 'doxxing', 'doxxed', 'admin abuse', 'abuse',
  'rollback needed', 'need a rollback'
];

const ARK_SPECIFIC_KEYWORDS = [
  'how do i tame', 'how to tame', 'taming a ', 'tame a ', 'tame the ', 'how many narco', 'how much kibble',
  'how long does', 'how long to', 'maturation time', 'maturation timer', 'imprint timer', 'hatch time',
  'breeding time', 'mutation stack', 'mutation cap', 'baby food', 'baby pen',
  'server rates', 'what are the rates', 'xp rate', 'harvest rate', 'taming rate', 'taming speed',
  'max tribe size', 'tribe limit', 'turret limit', 'turret rules', 'can i build at', 'no build zone',
  'obelisk blocked', 'artifact cave',
  'helena', 'arkbot', '@helena',
  'who are the admins', 'who runs the server', 'who is admin', 'whos the admin', 'who are admins',
  'list the admins', 'admin list', 'who owns the server', 'server owner', 'cluster owner',
  'torpor drain', 'narcotic', 'tranq dart', 'kibble recipe', 'exceptional kibble', 'superior kibble',
  'extraordinary kibble', 'regular kibble', 'simple kibble',
  'taming rex', 'rex tame', 'rex kibble', 'taming giga', 'giga tame',
  'taming theri', 'theri tame', 'taming spino', 'spino tame', 'taming yuty', 'yuty tame',
  'wyvern milk', 'wyvern egg', 'wyvern tame', 'argy tame', 'quetz tame',
  'carcha tame', 'shadowmane tame', 'rock drake egg', 'drake egg', 'reaper queen', 'nameless venom',
  'basilisk tame', 'maewing nurse', 'gacha crystal', 'magmasaur egg', 'ambergris',
  'mosa tame', 'tuso tame', 'fenrir tame', 'stryder tame', 'desmodus tame', 'noglin tame',
  'maturation rex', 'maturation giga', 'maturation wyvern', 'maturation theri',
  'boss fight', 'boss run', 'boss dino', 'boss prep', 'broodmother', 'megapithecus',
  'manticore', 'rockwell', 'fenrisulfr', 'overseer', 'king titan',
  'transfer dino', 'upload dino', 'download dino', 'obelisk transfer',
  'which server has', 'server list', 'cluster map', 'how many servers',
];

function detectSupportKeyword(content: string): string | null {
  const lower = content.toLowerCase();
  for (const kw of SUPPORT_KEYWORDS) { if (lower.includes(kw)) return kw; }
  return null;
}

function isCritical(content: string): string | null {
  const lower = content.toLowerCase();
  for (const kw of CRITICAL_KEYWORDS) { if (lower.includes(kw)) return kw; }
  return null;
}

function shouldRespondPublic(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes('?') || ARK_SPECIFIC_KEYWORDS.some(kw => lower.includes(kw));
}

// ── DISCORD HELPERS ───────────────────────────────────────────────────────────
async function sendDiscordMessage(channelId: string, content: string): Promise<void> {
  const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!resp.ok) console.error(`Failed to send to ${channelId}: ${await resp.text()}`);
}

async function logActivity(event: string, player: string, detail: string): Promise<void> {
  await sendDiscordMessage(ADMIN_LOGS_CHANNEL_ID, `📊 **[Activity Log]** ${event} | **Player:** ${player} | **Detail:** ${detail}`);
}

// ── SUPPORT TICKET TRIAGE ─────────────────────────────────────────────────────
function classifyIssue(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('mesh') || lower.includes('under the map') || lower.includes('stuck in')) return 'Stuck';
  if (lower.includes('stuck')) return 'Stuck';
  if (lower.includes('lost dino') || lower.includes('dino lost') || lower.includes('lost my dino')) return 'Lost Dino';
  if (lower.includes('glitch') || lower.includes('bug') || lower.includes('crash') || lower.includes('rollback')) return 'Glitch';
  if (lower.includes('hacker') || lower.includes('cheat') || lower.includes('exploit') || lower.includes('mesh')) return 'Hacker Report';
  if (lower.includes('server down') || lower.includes('lag') || lower.includes('offline') || lower.includes('dc')) return 'Server Issue';
  return 'General Support';
}

function extractKeyDetails(content: string): string {
  const details: string[] = [];
  // Coordinates — matches patterns like 12.3 / 45.6, LAT 12 LON 45, coords: etc
  const coordMatch = content.match(/\b(\d{1,3}[.,]\d{0,2}\s*[\/,]\s*\d{1,3}[.,]\d{0,2})\b/);
  if (coordMatch) details.push(`Coords: ${coordMatch[1]}`);
  // Server names
  const serverMatch = content.match(/\b(the island|scorched earth|aberration|extinction|ragnarok|valguero|crystal isles|lost island|fjordur|genesis|the center|club ark|astraeos|forglar|eden|svartalfheim|lost colony)\b/i);
  if (serverMatch) details.push(`Server: ${serverMatch[1]}`);
  // Tribe names — "tribe: X" or "my tribe X" patterns
  const tribeMatch = content.match(/tribe[:\s]+([A-Za-z0-9\s'_-]{2,30})/i);
  if (tribeMatch) details.push(`Tribe: ${tribeMatch[1].trim()}`);
  // Player names — "player X" or "user X" or "@username"
  const playerMatch = content.match(/@([A-Za-z0-9_]{2,32})/);
  if (playerMatch) details.push(`Mentioned player: @${playerMatch[1]}`);
  // Dino type
  const dino = findDino(content);
  if (dino) details.push(`Dino: ${dino.name}`);
  return details.length > 0 ? details.join(' | ') : 'None provided';
}

async function triageTicket(username: string, content: string, channelId: string): Promise<void> {
  const issueType = classifyIssue(content);
  const keyDetails = extractKeyDetails(content);

  // Strip emotional language for clean summary — use first 200 chars
  const cleanMessage = content.replace(/[!]{2,}/g, '!').replace(/\n+/g, ' ').trim();
  const summary = cleanMessage.length > 180 ? cleanMessage.substring(0, 180) + '...' : cleanMessage;

  const formattedSummary =
    `**Issue Type:** ${issueType}\n` +
    `**Summary:** ${summary}\n` +
    `**Key Details:** ${keyDetails}`;

  // Save to Base44 SupportTicket entity
  try {
    const sdk = base44({ appId: APP_ID, apiKey: BASE44_API_KEY });
    await sdk.entities.SupportTicket.create({
      player_name: username,
      discord_channel_id: channelId,
      raw_message: content,
      issue_type: issueType,
      ai_summary: formattedSummary,
      key_details: keyDetails,
      status: 'Open',
      admin_notified: true,
    });
  } catch (e) {
    console.error('Failed to save ticket to Base44:', e);
  }

  // Ping staff-chat with triage summary
  await sendDiscordMessage(STAFF_CHAT_CHANNEL_ID,
    `🎫 **[New Support Ticket]** <@&${ADMIN_ROLE_ID}>\n` +
    `**Player:** ${username} | **Channel:** <#${channelId}>\n\n` +
    formattedSummary
  );

  await sendDiscordMessage(ADMIN_LOGS_CHANNEL_ID,
    `🎫 **[Ticket Triaged]** Player: ${username} | Type: ${issueType} | "${content.substring(0, 80)}"`
  );
}

// ── STAFF CHAT HANDLER ────────────────────────────────────────────────────────
async function handleStaffMessage(username: string, content: string): Promise<void> {
  const keyword = detectSupportKeyword(content);
  if (!keyword) return;

  const lower = content.toLowerCase();
  let staffNote = `🤖 **[Helena — Staff Flag]** Keyword: \`${keyword}\` | **From:** ${username}\n> ${content}\n\n`;

  if (lower.includes('stuck') || lower.includes('glitch')) {
    staffNote += `**Suggested actions:**\n• \`/forcerespawn <player>\` — force player respawn\n• \`/teleport <player> <x> <y> <z>\` — move to safe coords\n• Check tribe logs for last known location\n• If under mesh: document coords + screenshot before intervening`;
  } else if (lower.includes('lost dino')) {
    staffNote += `**Suggested actions:**\n• Pull tribe logs — check cryo-sickness, death, or transfer\n• Verify dino wasn't moved to another cluster server\n• Confirmed server-side loss → rollback, escalate to @Skidogg`;
  } else if (lower.includes('hacker')) {
    staffNote += `**Suggested actions:**\n• Do NOT alert the suspect yet — observe first\n• Screenshot abnormal stats, speeds, or inventory\n• Coordinate with @Skidogg before action\n• Confirmed = ban + tribe wipe per server policy`;
  }

  await sendDiscordMessage(STAFF_CHAT_CHANNEL_ID, staffNote);
  await sendDiscordMessage(ADMIN_LOGS_CHANNEL_ID, `📋 **[Staff Flag]** Keyword: \`${keyword}\` | Staff: ${username} | "${content.substring(0, 80)}"`);
}

// ── PUBLIC CHANNEL HANDLER ────────────────────────────────────────────────────
async function handlePublicMessage(channelId: string, username: string, content: string): Promise<void> {
  const lower = content.toLowerCase();
  const criticalMatch = isCritical(content);
  const supportKeyword = detectSupportKeyword(content);

  if (criticalMatch) {
    await sendDiscordMessage(channelId,
      `⚠️ Hey **${username}**, this one needs a human admin ASAP.\n\n` +
      `👉 **Step 1:** Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}>\n` +
      `👉 **Step 2:** Ping <@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}> with screenshots, tribe name, coords, timestamp\n` +
      `👉 **Step 3:** Don't log out — admin may need to observe live.\n\nHang tight! 🙏`
    );
    await sendDiscordMessage(ADMIN_LOGS_CHANNEL_ID,
      `🚨 **ESCALATION ALERT** 🚨\n**Player:** ${username}\n**Channel:** <#${channelId}>\n**Trigger:** \`${criticalMatch}\`\n**Message:** ${content}\n\n<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}>`
    );
    return;
  }

  if (supportKeyword) {
    let response = '';
    if (lower.includes('stuck')) {
      response = `Hey **${username}**! 😬 Stuck? Try these:\n1. **Whistle passive** all nearby dinos, then move\n2. **Crouch/prone** and wiggle — can dislodge terrain\n3. Open inventory → **"Lay on Ground"** — resets collision\n4. **Disconnect and reconnect** — may respawn you\n5. Still stuck? Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}> with coords + screenshot! 🙏`;
    } else if (lower.includes('glitch')) {
      response = `Hey **${username}**! 🐛 Glitch? Try:\n• **Rejoin the server** — fixes most visual/physics issues\n• **Cryo dinos** and re-release if they're bugged\n• **Hop to another cluster server** then come back\n• Serious issue (items/dino lost)? Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}> 📸`;
    } else if (lower.includes('lost dino')) {
      response = `Hey **${username}**! 🦕 Lost a dino? Check:\n1. **Tribe log** — shows last known status\n2. **Whistle "come to me"** — finds strays\n3. **Cryofridge** — a tribe mate may have cryo'd it\n4. **Other cluster servers** — may have transferred\n5. Server-side issue? Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}> with tribe + dino + time 📋`;
    } else if (lower.includes('hacker')) {
      response = `Hey **${username}**! 🚨 Suspected hacker? Don't confront them.\n\n👉 Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}> with:\n• Their name / tribe\n• Screenshots or video\n• Server + time\n\n<@&${ADMIN_ROLE_ID}> has been notified.`;
      await sendDiscordMessage(ADMIN_LOGS_CHANNEL_ID,
        `🚨 **[Hacker Report]** ${username} in <#${channelId}>: ${content}\n\n<@&${ADMIN_ROLE_ID}> <@&${ARK_ADMIN_ROLE_ID}>`
      );
    }
    if (response) {
      await sendDiscordMessage(channelId, response);
      await logActivity('Support', username, `[${supportKeyword}] ${content.substring(0, 80)}`);
      return;
    }
  }

  if (!shouldRespondPublic(content)) return;

  let response = '';
  const dino = findDino(content);

  if (dino) {
    const asksMaturation = lower.includes('how long') || lower.includes('maturation') || lower.includes('mature') || lower.includes('baby food') || lower.includes('baby pen');
    const asksTaming = lower.includes('tame') || lower.includes('taming') || lower.includes('kibble') || lower.includes('narcotic') || lower.includes('torpor');
    if (asksMaturation && dino.maturationHrsVanilla > 0) response = `Hey **${username}**! ${buildDinoResponse(dino, username, 'maturation')}`;
    else if (asksTaming) response = `Hey **${username}**! ${buildDinoResponse(dino, username, 'taming')}`;
    else response = `Hey **${username}**! ${buildDinoResponse(dino, username, 'full')}`;
  } else if (lower.includes('who are the admins') || lower.includes('who runs the server') || lower.includes('who is admin') || lower.includes('whos the admin') || lower.includes('who are admins') || lower.includes('list the admins') || lower.includes('admin list') || lower.includes('who owns the server') || lower.includes('server owner') || lower.includes('cluster owner') || (lower.includes('admin') && lower.includes('?'))) {
    response = `Hey **${username}**! 👑 **Skii's Lodge Staff:**\n👑 **@Skidogg** [Lunar Republic] — Server Owner & Cluster Owner\n🛡️ **@iNFAMOUS** [Triumphant Titans] — Admin\n🛡️ **@Remi** — Admin\n🛡️ **@Captain Rhynio** — Admin\n\nNeed help? Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}>! 🙏`;
  } else if (lower.includes('boss') || lower.includes('broodmother') || lower.includes('megapithecus') || lower.includes('manticore') || lower.includes('rockwell') || lower.includes('fenrisulfr')) {
    response = `Hey **${username}**! 🏆 Boss rundown:\n• Artifacts in caves — don't block access!\n• Island: Broodmother, Megapithecus, Dragon | SE: Manticore | Ab: Rockwell | Extinction: Titans | Fjordur: Fenrisulfr\n• Best combo: **Rex/Theri army + Yuty + Daeodon** 💪`;
  } else if (lower.includes('mutation stack') || lower.includes('mutation cap') || lower.includes('breeding time') || lower.includes('baby pen') || lower.includes('baby food') || lower.includes('imprint timer') || lower.includes('hatch time')) {
    response = `Hey **${username}**! 🧬 Breeding on Skii's Lodge:\n• Breeding: 2.5x • Egg hatch & mating: 10x • Baby food: 0.1x\n• Mutation cap: 20/20 per parent\n• Use a **Maewing** to auto-nurse babies!\n• Ask "maturation [dino name]" for exact timers ⏱️`;
  } else if (lower.includes('server rates') || lower.includes('what are the rates') || lower.includes('xp rate') || lower.includes('harvest rate') || lower.includes('taming rate') || lower.includes('taming speed')) {
    response = `Hey **${username}**! 🦕 **Skii's Lodge rates:**\n• XP: 2.5x • Harvest: 2.5x • Taming: 2.5x • Breeding: 2.5x\n• Egg Hatch & Mating: 10x • Baby Food: 0.1x\nCheck <#1301900944979791883> for bonus events! 🔥`;
  } else if (lower.includes('max tribe') || lower.includes('tribe limit') || lower.includes('turret') || lower.includes('no build zone') || lower.includes('can i build at')) {
    response = `Hey **${username}**! ⚖️ Quick rules:\n• **Max tribe:** 7 players • **PvE** — consensual PvP only\n• **Turrets:** enclosed in walls or TEK Shield only\n• **No building** at spawns, caves, obelisks, or resource nodes\n• Full rules: <#1291428845643104297>`;
  } else if (lower.includes('server list') || lower.includes('cluster map') || lower.includes('transfer dino') || lower.includes('obelisk transfer') || lower.includes('which server has') || lower.includes('how many servers')) {
    response = `Hey **${username}**! 🗺️ **13 servers:**\nThe Island • Scorched Earth • The Center • Aberration • Extinction • Ragnarok • Valguero • Club Ark • Astraeos • Forglar • Eden • Svartalfheim • Lost Colony\nAll PvE, transfer via Obelisks → <#1249322656021614672>`;
  } else if (lower.includes('helena') || lower.includes('arkbot')) {
    response = `Hey **${username}**! 🦕 I'm Helena, your 24/7 Skii's Lodge assistant.\nAsk me: taming guides, maturation timers, server rates, boss tips, or "who are the admins?"\nIssue? Open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}> 💪`;
  } else if (lower.includes('?')) {
    const arkRelated = ['tame', 'breed', 'dino', 'ark', 'boss', 'kibble', 'imprint', 'mutation', 'torpor', 'server', 'tribe', 'wyvern', 'rex', 'giga', 'spino', 'theri', 'argy', 'quetz', 'admin'].some(w => lower.includes(w));
    if (arkRelated) response = `Hey **${username}**! 🦕 Not sure I caught that — try:\n• "how to tame a [dino]?"\n• "maturation [dino]?"\n• "what are the server rates?"\nOr open a ticket in <#${SUPPORT_TICKET_CHANNEL_ID}> for issues!`;
  }

  if (response) {
    await sendDiscordMessage(channelId, response);
    await logActivity('Question', username, content.substring(0, 100));
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'GET') return new Response('ArkBot webhook is live', { status: 200 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (DISCORD_WEBHOOK_SECRET) {
    if (req.headers.get('x-webhook-secret') !== DISCORD_WEBHOOK_SECRET)
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Welcome new members
  if (body.type === 'member_join') {
    const username = body.user?.username || body.user?.global_name || 'Survivor';
    await sendDiscordMessage(WELCOME_CHANNEL_ID,
      `👋 **Welcome to Skii's Lodge, ${username}!** 🦕\n\nWe're a friendly PvE cluster with 13 maps!\n\n**Getting started:**\n📖 Rules → <#1291428845643104297>\n🗺️ Servers → <#1249322656021614672>\n📢 Announcements → <#1301900944979791883>\n\n**Rates:** 2.5x XP • 2.5x Harvest • 2.5x Taming • 10x Breeding\n\nI'm **Helena**, your 24/7 assistant! Ask me anything in <#${ARK_GENERAL_CHANNEL_ID}>. Have fun! 🔥`
    );
    return Response.json({ ok: true, action: 'welcomed' });
  }

  const { channel_id, author, content } = body;
  if (!channel_id || !author || !content || author.id === BOT_USER_ID || author.bot)
    return Response.json({ ok: true, skipped: true });

  if (!MONITORED_CHANNELS.includes(channel_id))
    return Response.json({ ok: true, skipped: 'unmonitored channel' });

  const username = author.username || author.global_name || 'Survivor';

  // #support-ticket channel — full AI triage
  if (channel_id === SUPPORT_TICKET_CHANNEL_ID) {
    await triageTicket(username, content, channel_id);
    return Response.json({ ok: true, channel: 'support-ticket', action: 'triaged' });
  }

  // #staff-chat — internal flagging only
  if (channel_id === STAFF_CHAT_CHANNEL_ID) {
    await handleStaffMessage(username, content);
    return Response.json({ ok: true, channel: 'staff-chat' });
  }

  // Public channels
  await handlePublicMessage(channel_id, username, content);
  return Response.json({ ok: true, channel: channel_id });
});
