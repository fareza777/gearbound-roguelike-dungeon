/**
 * Massive Roguelike Expedition Database for Gearbound:
 * - 3 Playable Vanguard Classes
 * - 28 Action Symbols (mergeable across Tiers I - IV)
 * - 30 Clockwork Relics & Probability Cores
 * - 6 Distinct Biomes (Acts I - VI) with 13 Enemies, Elites & Monumental Bosses
 * - 6 Citadel Meta-Workshop Upgrades
 * - 24 Achievements
 * - 7-Day Daily Rewards Calendar
 */

export type SymbolCategory = 'melee' | 'ranged' | 'guard' | 'break' | 'repair' | 'gear' | 'utility';

export interface SymbolDef {
  id: string;
  name: string;
  category: SymbolCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'masterwork';
  basePower: number;
  baseBlock: number;
  baseHeal: number;
  baseScrap: number;
  pierce?: boolean;
  multiHit?: number;
  stagger?: number; // % chance or buildup to stun enemy next turn
  burnHeat?: number; // Searing oil heat damage over turns
  reflectPct?: number; // Counter-parry reflection
  adjacentBoostPct?: number; // Gear-link boost to orthogonal neighbors
  retriggerAdjacent?: boolean; // Master cogwheel re-fires neighbors
  rowStrikeBoost?: number; // Banner of Resolve
  carryoverArmor?: boolean; // Fortress Wall
  overdriveGain?: number; // Steam Boiler / Signal Flare
  wildcardLine?: boolean; // Masterwork Core bridges any 3-in-a-row line
  weakenEnemy?: number; // Grappling hook reduces enemy attack
  thorns?: number; // Spiked Buckler / Caltrops
  description: string;
}

export interface OwnedSymbol {
  uid: string;
  symbolId: string;
  tier: 1 | 2 | 3 | 4; // I Iron, II Brass, III Tempered Steel, IV Masterwork Gold
}

export interface RelicDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'masterwork';
  iconSymbolId: string;
  description: string;
  weightBoostCategory?: SymbolCategory;
  weightMultiplier?: number;
  diagonalBonusPct?: number;
  lineBonusPct?: number;
  extraLocksPerBattle?: number;
  startArmor?: number;
  startMaxHp?: number;
  mergeHeal?: number;
  scrapBonusPct?: number;
  overdriveEveryN?: number;
  retainArmorCap?: number;
  firstTurnGearBoost?: boolean;
  extraDraftChoice?: boolean;
  thornsFlat?: number;
  pierceAllMelee?: boolean;
  critChanceBonus?: number;
  repairBonus?: number;
  staggerBonus?: number;
  heatBonus?: number;
}

export interface EnemyIntent {
  type: 'strike' | 'heavy' | 'multi' | 'fortify' | 'shatter' | 'charge';
  label: string;
  damage: number;
  hits?: number;
  armor?: number;
}

export interface EnemyDef {
  id: string;
  spriteId: string;
  name: string;
  title: string;
  isElite?: boolean;
  isBoss?: boolean;
  biomeIndex: number;
  baseHp: number;
  baseArmor: number;
  scrapReward: number;
  ingotReward: number;
  pattern: EnemyIntent[];
  lore: string;
}

export interface BiomeDef {
  index: number; // 0..5
  actNumeral: string;
  name: string;
  subtitle: string;
  bgFile: string;
  ambientKind: 'sunbeams' | 'sand' | 'embers' | 'snow' | 'steam' | 'gold_motes';
  accentHex: string;
  roomsCount: number;
  enemyPool: string[];
  elitePool: string[];
  bossId: string;
  narrative: string;
}

export interface HeroClassDef {
  id: 'ironclad' | 'arbalest' | 'artificer';
  spriteId: string;
  name: string;
  role: string;
  maxHp: number;
  startArmor: number;
  unlockCostIngots: number;
  passiveName: string;
  passiveDesc: string;
  starterDeck: string[];
  starterRelicId: string;
  bio: string;
}

export const TIER_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Iron I',
  2: 'Brass II',
  3: 'Tempered III',
  4: 'Masterwork IV'
};

export const TIER_MULTIPLIER: Record<1 | 2 | 3 | 4, number> = {
  1: 1.0,
  2: 1.55,
  3: 2.25,
  4: 3.2
};

export const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: '#9BA3AF',
  2: '#D9A441',
  3: '#68B6E8',
  4: '#FFE07D'
};

export const SYMBOLS: Record<string, SymbolDef> = {
  vanguard_blade: {
    id: 'vanguard_blade', name: 'Vanguard Blade', category: 'melee', rarity: 'common',
    basePower: 7, baseBlock: 0, baseHeal: 0, baseScrap: 0,
    description: 'Reliable forged broadblade strike. Align three across a line for a sweeping vanguard cleave.'
  },
  heavy_broadsword: {
    id: 'heavy_broadsword', name: 'Heavy Broadsword', category: 'melee', rarity: 'uncommon',
    basePower: 12, baseBlock: 0, baseHeal: 0, baseScrap: 0, pierce: true,
    description: 'Weighty tempered greatsword that carves straight through 50% of enemy armor plating.'
  },
  twin_daggers: {
    id: 'twin_daggers', name: 'Twin Dirks', category: 'melee', rarity: 'uncommon',
    basePower: 4, baseBlock: 0, baseHeal: 0, baseScrap: 0, multiHit: 3,
    description: 'Delivers three rapid close-quarters strikes that multiply strongly with Gear-Links and Banners.'
  },
  siege_crossbow: {
    id: 'siege_crossbow', name: 'Siege Crossbow', category: 'ranged', rarity: 'common',
    basePower: 8, baseBlock: 0, baseHeal: 0, baseScrap: 0, pierce: true,
    description: 'High-tension steel quarrel that punches completely through enemy guard shields.'
  },
  volley_arbalest: {
    id: 'volley_arbalest', name: 'Volley Arbalest', category: 'ranged', rarity: 'rare',
    basePower: 6, baseBlock: 0, baseHeal: 0, baseScrap: 0, multiHit: 3, pierce: true,
    description: 'Repeating clockwork magazine fires three armor-piercing bolts downrange.'
  },
  tower_shield: {
    id: 'tower_shield', name: 'Tower Shield', category: 'guard', rarity: 'common',
    basePower: 0, baseBlock: 8, baseHeal: 0, baseScrap: 0,
    description: 'Solid riveted kite bulwark that absorbs incoming blows before they reach your hull.'
  },
  spiked_buckler: {
    id: 'spiked_buckler', name: 'Spiked Buckler', category: 'guard', rarity: 'uncommon',
    basePower: 0, baseBlock: 6, baseHeal: 0, baseScrap: 0, thorns: 5,
    description: 'Grants sturdy Guard and drives steel spikes into any foe that strikes you this turn.'
  },
  war_mace: {
    id: 'war_mace', name: 'Flanged War Mace', category: 'break', rarity: 'common',
    basePower: 9, baseBlock: 0, baseHeal: 0, baseScrap: 0, stagger: 35,
    description: 'Crushing blunt strike that builds Stagger to interrupt and stun enemy attacks.'
  },
  anvil_crusher: {
    id: 'anvil_crusher', name: 'Anvil Crusher', category: 'break', rarity: 'rare',
    basePower: 15, baseBlock: 0, baseHeal: 0, baseScrap: 0, stagger: 55,
    description: 'Monumental forge-hammer impact that shatters enemy armor and delivers massive Stagger.'
  },
  field_kit: {
    id: 'field_kit', name: 'Field Repair Kit', category: 'repair', rarity: 'common',
    basePower: 0, baseBlock: 2, baseHeal: 7, baseScrap: 0,
    description: 'Restores Vanguard vitality and patches loose armor straps mid-duel.'
  },
  steam_boiler: {
    id: 'steam_boiler', name: 'Steam Boiler', category: 'gear', rarity: 'uncommon',
    basePower: 0, baseBlock: 3, baseHeal: 0, baseScrap: 0, overdriveGain: 28,
    description: 'Pressurizes the console Overdrive gauge to unleash devastating amplified combos.'
  },
  gear_link: {
    id: 'gear_link', name: 'Brass Gear-Link', category: 'gear', rarity: 'uncommon',
    basePower: 0, baseBlock: 2, baseHeal: 0, baseScrap: 0, adjacentBoostPct: 55,
    description: 'Interlocks mechanically with every orthogonally adjacent tile, boosting their output by +55%.'
  },
  master_cogwheel: {
    id: 'master_cogwheel', name: 'Master Cogwheel', category: 'gear', rarity: 'masterwork',
    basePower: 0, baseBlock: 4, baseHeal: 0, baseScrap: 0, retriggerAdjacent: true, adjacentBoostPct: 35,
    description: 'Masterwork drive wheel that boosts AND triggers adjacent tiles a second time.'
  },
  counter_parry: {
    id: 'counter_parry', name: 'Counter-Parry', category: 'guard', rarity: 'rare',
    basePower: 3, baseBlock: 7, baseHeal: 0, baseScrap: 0, reflectPct: 60,
    description: 'Raises a disciplined steel guard and redirects 60% of the enemy’s attack right back.'
  },
  grappling_hook: {
    id: 'grappling_hook', name: 'Grappling Hook', category: 'utility', rarity: 'uncommon',
    basePower: 5, baseBlock: 0, baseHeal: 0, baseScrap: 0, weakenEnemy: 25,
    description: 'Snags the opponent off balance, cutting their next strike damage by 25%.'
  },
  oil_flint: {
    id: 'oil_flint', name: 'Oil Flask & Flint', category: 'ranged', rarity: 'uncommon',
    basePower: 4, baseBlock: 0, baseHeal: 0, baseScrap: 0, burnHeat: 6,
    description: 'Ignites enemy plating with heated lantern oil, dealing steady Searing Heat each turn.'
  },
  caltrops_pouch: {
    id: 'caltrops_pouch', name: 'Iron Caltrops', category: 'utility', rarity: 'common',
    basePower: 3, baseBlock: 3, baseHeal: 0, baseScrap: 0, thorns: 7,
    description: 'Scatters forged steel spikes across the stone floor, punishing charging foes.'
  },
  banner_resolve: {
    id: 'banner_resolve', name: 'Banner of Resolve', category: 'utility', rarity: 'rare',
    basePower: 0, baseBlock: 4, baseHeal: 0, baseScrap: 0, rowStrikeBoost: 6,
    description: 'Inspires disciplined strikes: adds +6 flat damage to every attack on the same row.'
  },
  fortress_wall: {
    id: 'fortress_wall', name: 'Fortress Wall', category: 'guard', rarity: 'rare',
    basePower: 0, baseBlock: 13, baseHeal: 0, baseScrap: 0, carryoverArmor: true,
    description: 'Raises bastion-grade plating and preserves remaining Armor into the following turn.'
  },
  clock_pendulum: {
    id: 'clock_pendulum', name: 'Brass Pendulum', category: 'gear', rarity: 'rare',
    basePower: 4, baseBlock: 4, baseHeal: 0, baseScrap: 0, overdriveGain: 20, adjacentBoostPct: 30,
    description: 'Balanced horological regulator that grants Attack, Guard, Overdrive, and neighbor synergy.'
  },
  bellows_vent: {
    id: 'bellows_vent', name: 'Forge Bellows', category: 'gear', rarity: 'uncommon',
    basePower: 5, baseBlock: 0, baseHeal: 0, baseScrap: 0, burnHeat: 4, overdriveGain: 18,
    description: 'Stokes furnace heat across the battlefield while feeding extra pressure into Overdrive.'
  },
  whetstone: {
    id: 'whetstone', name: 'Artisan Whetstone', category: 'utility', rarity: 'uncommon',
    basePower: 2, baseBlock: 0, baseHeal: 0, baseScrap: 0, adjacentBoostPct: 45, rowStrikeBoost: 4,
    description: 'Hones neighboring blades on the drum, sharpening adjacent symbols and row strikes.'
  },
  riveted_plate: {
    id: 'riveted_plate', name: 'Riveted Plate', category: 'guard', rarity: 'uncommon',
    basePower: 0, baseBlock: 10, baseHeal: 3, baseScrap: 0,
    description: 'Heavy cold-rolled iron plating that reinforces Guard and patches minor hull dents.'
  },
  blueprint: {
    id: 'blueprint', name: 'Tactical Blueprint', category: 'utility', rarity: 'common',
    basePower: 0, baseBlock: 4, baseHeal: 0, baseScrap: 14,
    description: 'Surveys enemy clockwork weaknesses to harvest bonus Forge Scrap and defensive positioning.'
  },
  ballista_bolt: {
    id: 'ballista_bolt', name: 'Ballista Spear', category: 'ranged', rarity: 'masterwork',
    basePower: 18, baseBlock: 0, baseHeal: 0, baseScrap: 0, pierce: true, stagger: 25,
    description: 'Siege-scale lance bolt capable of skewering armored bosses in a single thunderous shot.'
  },
  iron_chain: {
    id: 'iron_chain', name: 'Iron Drive Chain', category: 'gear', rarity: 'rare',
    basePower: 5, baseBlock: 5, baseHeal: 0, baseScrap: 0, adjacentBoostPct: 40, weakenEnemy: 15,
    description: 'Links drum momentum across adjacent slots while binding enemy weapon arms.'
  },
  signal_flare: {
    id: 'signal_flare', name: 'Vanguard Flare', category: 'utility', rarity: 'uncommon',
    basePower: 6, baseBlock: 0, baseHeal: 0, baseScrap: 6, overdriveGain: 34,
    description: 'Blinding magnesium signal flare that charges Overdrive rapidly and exposes weak seams.'
  },
  masterwork_core: {
    id: 'masterwork_core', name: 'Masterwork Core', category: 'gear', rarity: 'masterwork',
    basePower: 8, baseBlock: 8, baseHeal: 4, baseScrap: 5, wildcardLine: true, adjacentBoostPct: 45,
    description: 'Crown jewel of clockwork engineering: acts as a Universal Wildcard to complete ANY 3-in-a-row line!'
  }
};

export const SYMBOL_LIST = Object.values(SYMBOLS);

export const RELICS: RelicDef[] = [
  { id: 'weighted_strike_drum', name: 'Weighted Strike Drum', rarity: 'common', iconSymbolId: 'vanguard_blade',
    weightBoostCategory: 'melee', weightMultiplier: 1.55,
    description: 'Counterweighted brass cylinder increases the probability of rolling Melee Strike symbols by +55%.' },
  { id: 'aegis_regulator', name: 'Aegis Regulator', rarity: 'common', iconSymbolId: 'tower_shield',
    weightBoostCategory: 'guard', weightMultiplier: 1.55, startArmor: 8,
    description: 'Calibrates drum balance toward Guard symbols (+55% odds) and starts every duel with +8 Armor.' },
  { id: 'precision_caliper', name: 'Precision Caliper', rarity: 'common', iconSymbolId: 'blueprint',
    extraLocksPerBattle: 2,
    description: 'Adds +2 free Drum Lock Clamps per duel so you can pin key columns for guaranteed 3-in-a-row lines.' },
  { id: 'twin_tooth_ratchet', name: 'Twin-Tooth Ratchet', rarity: 'rare', iconSymbolId: 'gear_link',
    diagonalBonusPct: 50,
    description: 'Reinforces diagonal gear conduits: all diagonal 3-in-a-row synergies deal +50% amplified effect.' },
  { id: 'hydraulic_lever', name: 'Hydraulic Pull-Lever', rarity: 'rare', iconSymbolId: 'steam_boiler',
    firstTurnGearBoost: true,
    description: 'Pressurizes the opening turn of every battle, boosting all first-pull outputs by +45%.' },
  { id: 'anvil_resonance', name: 'Anvil Resonance Core', rarity: 'common', iconSymbolId: 'field_kit',
    mergeHeal: 16,
    description: 'Whenever you merge or upgrade symbols at the Anvil Forge, restore +16 HP automatically.' },
  { id: 'salvage_magnet', name: 'Brass Salvage Magnet', rarity: 'common', iconSymbolId: 'blueprint',
    scrapBonusPct: 40,
    description: 'Extracts +40% extra Forge Scrap from every defeated foe, chest, and blueprint roll.' },
  { id: 'momentum_flywheel', name: 'Momentum Flywheel', rarity: 'rare', iconSymbolId: 'master_cogwheel',
    overdriveEveryN: 3,
    description: 'Stores rotational energy: every 3rd lever pull automatically triggers an Overdrive Surge (+40% power).' },
  { id: 'steam_governor', name: 'Steam Armor Governor', rarity: 'rare', iconSymbolId: 'fortress_wall',
    retainArmorCap: 18,
    description: 'Retains up to 18 unused Armor at the end of each turn instead of letting it dissipate.' },
  { id: 'master_blueprint', name: 'Master Draft Blueprint', rarity: 'rare', iconSymbolId: 'blueprint',
    extraDraftChoice: true,
    description: 'Expands post-battle reward drafts with an extra bonus high-tier blueprint option.' },
  { id: 'ballista_cam', name: 'Arbalest Camshaft', rarity: 'common', iconSymbolId: 'siege_crossbow',
    weightBoostCategory: 'ranged', weightMultiplier: 1.6,
    description: 'Tunes drum cams to favor Ranged Crossbow and Bolt symbols (+60% roll odds).' },
  { id: 'iron_thorns_collar', name: 'Spiked Iron Collar', rarity: 'common', iconSymbolId: 'spiked_buckler',
    thornsFlat: 6,
    description: 'Permanent riveted spikes deal 6 counter-damage whenever an enemy strikes your Vanguard.' },
  { id: 'tempered_edge_oil', name: 'Tempered Edge Oil', rarity: 'masterwork', iconSymbolId: 'heavy_broadsword',
    pierceAllMelee: true,
    description: 'Treats every Melee blade on the 3x3 console as armor-piercing, bypassing enemy Guard.' },
  { id: 'horologist_lens', name: 'Horologist Sight Lens', rarity: 'rare', iconSymbolId: 'signal_flare',
    critChanceBonus: 22,
    description: 'Increases Critical Precision chance by +22% across all attacks rolled on the console.' },
  { id: 'apothecary_satchel', name: 'Field Surgeon Satchel', rarity: 'common', iconSymbolId: 'field_kit',
    repairBonus: 5, startMaxHp: 15,
    description: 'Raises Max HP by +15 and increases all Field Repair Kit healing by +5.' },
  { id: 'concussive_piston', name: 'Concussive Piston', rarity: 'rare', iconSymbolId: 'war_mace',
    staggerBonus: 20, weightBoostCategory: 'break', weightMultiplier: 1.45,
    description: 'Adds +20 Stagger impact to Break symbols and increases their roll probability by +45%.' },
  { id: 'bellows_manifold', name: 'Furnace Manifold', rarity: 'common', iconSymbolId: 'oil_flint',
    heatBonus: 5,
    description: 'Superheats oil and bellows canisters, adding +5 extra Searing Heat damage per application.' },
  { id: 'sovereign_escapement', name: 'Sovereign Escapement', rarity: 'masterwork', iconSymbolId: 'masterwork_core',
    lineBonusPct: 35, extraLocksPerBattle: 1,
    description: 'Masterwork regulator: ALL 3-in-a-row lines gain +35% output and grants +1 Drum Lock Clamp per duel.' },
  { id: 'bulwark_chassis', name: 'Bastion Hull Plating', rarity: 'common', iconSymbolId: 'riveted_plate',
    startMaxHp: 24, startArmor: 6,
    description: 'Heavy bolted hull upgrade granting +24 Max HP and +6 opening Armor in every combat.' },
  { id: 'gear_lubricant', name: 'Clockwork Brass Oil', rarity: 'rare', iconSymbolId: 'gear_link',
    weightBoostCategory: 'gear', weightMultiplier: 1.65,
    description: 'Smooths gear-train ratios to elevate Gear-Link, Boiler, and Cogwheel odds by +65%.' },
  { id: 'vanguard_standard', name: 'Gilded Vanguard Crest', rarity: 'rare', iconSymbolId: 'banner_resolve',
    lineBonusPct: 25, critChanceBonus: 10,
    description: 'Boosts every matching 3-in-a-row line by +25% and grants +10% Critical Precision.' },
  { id: 'anvil_heart', name: 'Foundry Anvil Heart', rarity: 'masterwork', iconSymbolId: 'anvil_crusher',
    startMaxHp: 30, thornsFlat: 8, retainArmorCap: 12,
    description: 'Grants +30 Max HP, +8 permanent Spikes, and retains up to 12 Armor between rounds.' },
  { id: 'pendulum_weight', name: 'Brass Balance Weight', rarity: 'common', iconSymbolId: 'clock_pendulum',
    extraLocksPerBattle: 1, lineBonusPct: 15,
    description: 'Adds +1 Drum Lock Clamp per fight and boosts line combos by +15%.' },
  { id: 'siege_calipers', name: 'Siege Rangefinder', rarity: 'rare', iconSymbolId: 'ballista_bolt',
    critChanceBonus: 18, scrapBonusPct: 25,
    description: 'Precision targeting grants +18% Critical Precision and +25% Scrap salvage.' },
  { id: 'foundry_flintbox', name: 'Artisan Flintbox', rarity: 'common', iconSymbolId: 'bellows_vent',
    heatBonus: 4, startArmor: 5,
    description: 'Increases Searing Heat damage by +4 and begins each duel with +5 Armor.' },
  { id: 'iron_chain_drive', name: 'Double Chain Drive', rarity: 'rare', iconSymbolId: 'iron_chain',
    diagonalBonusPct: 35, lineBonusPct: 20,
    description: 'Cross-links horizontal and diagonal conduits for +20% line and +35% diagonal output.' },
  { id: 'field_kit_reserve', name: 'Reserve Repair Pack', rarity: 'common', iconSymbolId: 'field_kit',
    repairBonus: 4, mergeHeal: 10,
    description: 'Adds +4 healing to Field Kits and restores +10 HP on every Forge merge.' },
  { id: 'vanguard_whetstone', name: 'Master Whetstone', rarity: 'rare', iconSymbolId: 'whetstone',
    lineBonusPct: 22, pierceAllMelee: true,
    description: 'Hones all melee strikes to pierce Armor and boosts line combos by +22%.' },
  { id: 'counterweight_lock', name: 'Triple Brass Latch', rarity: 'masterwork', iconSymbolId: 'master_cogwheel',
    extraLocksPerBattle: 3, retainArmorCap: 10,
    description: 'Masterwork locking assembly granting +3 free Drum Lock Clamps every duel and 10 Armor retention.' },
  { id: 'citadel_seal', name: 'Seal of the Citadel', rarity: 'masterwork', iconSymbolId: 'masterwork_core',
    startMaxHp: 20, startArmor: 12, lineBonusPct: 30, critChanceBonus: 15,
    description: 'Royal mechanical insignia granting +20 HP, +12 Opening Armor, +30% Line Combo, and +15% Crit.' }
];

export const HERO_CLASSES: HeroClassDef[] = [
  {
    id: 'ironclad',
    spriteId: 'hero_ironclad',
    name: 'Ironclad Vanguard',
    role: 'Bastion Duelist',
    maxHp: 92,
    startArmor: 6,
    unlockCostIngots: 0,
    passiveName: 'Fortified Resolve',
    passiveDesc: 'Retains up to 8 unused Armor each turn and gains +15% damage on 3-in-a-row lines.',
    starterDeck: [
      'vanguard_blade', 'vanguard_blade', 'vanguard_blade',
      'heavy_broadsword',
      'tower_shield', 'tower_shield', 'tower_shield',
      'war_mace', 'war_mace',
      'field_kit', 'gear_link', 'spiked_buckler'
    ],
    starterRelicId: 'aegis_regulator',
    bio: 'Encased in cold-forged royal steel, the Ironclad Vanguard advances steadily behind a riveted tower shield, turning disciplined line alignments into unbreakable counteroffensives.'
  },
  {
    id: 'arbalest',
    spriteId: 'hero_arbalest',
    name: 'Siege Arbalest',
    role: 'Armor-Piercing Marksman',
    maxHp: 78,
    startArmor: 3,
    unlockCostIngots: 120,
    passiveName: 'Sighted Quarrels',
    passiveDesc: '+15% Critical Precision on all Ranged shots and starts with +1 free Drum Lock Clamp per duel.',
    starterDeck: [
      'siege_crossbow', 'siege_crossbow', 'siege_crossbow',
      'volley_arbalest',
      'twin_daggers', 'twin_daggers',
      'tower_shield', 'caltrops_pouch',
      'oil_flint', 'field_kit', 'signal_flare', 'blueprint'
    ],
    starterRelicId: 'ballista_cam',
    bio: 'Equipped with a repeating brass-prod arbalest and visored sallet helm, the Siege Arbalest punches directly through heavy fortress plating before foes can wind up.'
  },
  {
    id: 'artificer',
    spriteId: 'hero_artificer',
    name: 'Clockwork Artificer',
    role: 'Overdrive Engineer',
    maxHp: 85,
    startArmor: 5,
    unlockCostIngots: 220,
    passiveName: 'Master Gear-Train',
    passiveDesc: 'Gear-Link and Cogwheel adjacency bonuses are +25% stronger and Overdrive fills 30% faster.',
    starterDeck: [
      'vanguard_blade', 'war_mace', 'war_mace',
      'gear_link', 'gear_link', 'steam_boiler', 'steam_boiler',
      'tower_shield', 'riveted_plate',
      'bellows_vent', 'field_kit', 'iron_chain'
    ],
    starterRelicId: 'gear_lubricant',
    bio: 'Master of pressurized pistons and interlocking brass drums, the Clockwork Artificer engineers cascading chain-reactions across the 3x3 Combat Console.'
  }
];

export const ENEMIES: Record<string, EnemyDef> = {
  enemy_pikeman: {
    id: 'enemy_pikeman', spriteId: 'enemy_pikeman', name: 'Ironclad Halberdier', title: 'Ruin Patrol',
    biomeIndex: 0, baseHp: 46, baseArmor: 4, scrapReward: 26, ingotReward: 6,
    pattern: [
      { type: 'strike', label: 'Halberd Thrust', damage: 9 },
      { type: 'fortify', label: 'Brace Plate', damage: 5, armor: 8 },
      { type: 'heavy', label: 'Overhead Cleave', damage: 14 }
    ],
    lore: 'An enclosed-visor sentinel guarding the ancient sandstone viaducts with disciplined halberd sweeps.'
  },
  enemy_arbalest: {
    id: 'enemy_arbalest', spriteId: 'enemy_arbalest', name: 'Canyon Arbalest', title: 'Ranged Marksman',
    biomeIndex: 0, baseHp: 42, baseArmor: 2, scrapReward: 28, ingotReward: 6,
    pattern: [
      { type: 'multi', label: 'Twin Quarrels', damage: 5, hits: 2 },
      { type: 'charge', label: 'Crank Winch', damage: 0, armor: 6 },
      { type: 'heavy', label: 'Piercing Bolt', damage: 16 }
    ],
    lore: 'Fires precision steel quarrels from sheltered stone alcoves using a hand-cranked brass winch.'
  },
  enemy_automaton: {
    id: 'enemy_automaton', spriteId: 'enemy_automaton', name: 'Brass Automaton', title: 'Clockwork Blade',
    biomeIndex: 1, baseHp: 64, baseArmor: 8, scrapReward: 34, ingotReward: 8,
    pattern: [
      { type: 'multi', label: 'Whirling Blades', damage: 6, hits: 2 },
      { type: 'strike', label: 'Gear Slash', damage: 12 },
      { type: 'fortify', label: 'Overclock Shell', damage: 8, armor: 10 }
    ],
    lore: 'A self-winding horological construct driven by dorsal brass cogwheels and twin tempered scimitars.'
  },
  enemy_bulwark: {
    id: 'enemy_bulwark', spriteId: 'enemy_bulwark', name: 'Bulwark Warden', title: 'Armored Elite',
    isElite: true, biomeIndex: 1, baseHp: 94, baseArmor: 16, scrapReward: 52, ingotReward: 14,
    pattern: [
      { type: 'fortify', label: 'Iron Phalanx', damage: 7, armor: 16 },
      { type: 'heavy', label: 'Shield Slam', damage: 18 },
      { type: 'strike', label: 'Broadsword Cut', damage: 13 }
    ],
    lore: 'Encased in double-riveted fortress steel, this elite vanguard punishes careless blows that fail to pierce armor.'
  },
  enemy_hammer_golem: {
    id: 'enemy_hammer_golem', spriteId: 'enemy_hammer_golem', name: 'Foundry Hammer-Mech', title: 'Steam Construct',
    biomeIndex: 2, baseHp: 88, baseArmor: 12, scrapReward: 42, ingotReward: 10,
    pattern: [
      { type: 'charge', label: 'Build Steam', damage: 0, armor: 12 },
      { type: 'shatter', label: 'Anvil Smash', damage: 22 },
      { type: 'strike', label: 'Piston Backhand', damage: 13 }
    ],
    lore: 'Forged to stamp molten ingots in the deep vaults, its pressurized steam hammer crushes shields effortlessly.'
  },
  enemy_ballista: {
    id: 'enemy_ballista', spriteId: 'enemy_ballista', name: 'Siege Ballista Rig', title: 'War Engine',
    biomeIndex: 3, baseHp: 98, baseArmor: 14, scrapReward: 48, ingotReward: 12,
    pattern: [
      { type: 'charge', label: 'Winch Torsion', damage: 0, armor: 14 },
      { type: 'heavy', label: 'Siege Lance', damage: 25 },
      { type: 'multi', label: 'Shrapnel Bolts', damage: 7, hits: 3 }
    ],
    lore: 'An unmanned iron-plated artillery carriage operating on counterweighted ratchet gears.'
  },
  enemy_lancer: {
    id: 'enemy_lancer', spriteId: 'enemy_lancer', name: 'Highland Plate-Lancer', title: 'Elite Champion',
    isElite: true, biomeIndex: 3, baseHp: 122, baseArmor: 18, scrapReward: 64, ingotReward: 18,
    pattern: [
      { type: 'heavy', label: 'Jousting Charge', damage: 22 },
      { type: 'fortify', label: 'Bastion Guard', damage: 10, armor: 18 },
      { type: 'multi', label: 'Triple Thrust', damage: 8, hits: 3 }
    ],
    lore: 'An elite mountain bastion champion whose polished steel lance carries the momentum of an avalanche.'
  },
  // 6 Monumental Act Bosses
  boss_colossus: {
    id: 'boss_colossus', spriteId: 'boss_colossus', name: 'Colossus Gatekeeper', title: 'Act I Boss',
    isBoss: true, biomeIndex: 0, baseHp: 135, baseArmor: 14, scrapReward: 85, ingotReward: 30,
    pattern: [
      { type: 'fortify', label: 'Stone Bastion', damage: 10, armor: 16 },
      { type: 'heavy', label: 'Gatekeeper Slam', damage: 20 },
      { type: 'multi', label: 'Crushing Tremors', damage: 8, hits: 2 },
      { type: 'charge', label: 'Wind Mainspring', damage: 0, armor: 18 }
    ],
    lore: 'Monumental limestone-and-brass automaton erected to seal the Sunlit Ruins against unauthorized expeditions.'
  },
  boss_juggernaut: {
    id: 'boss_juggernaut', spriteId: 'boss_juggernaut', name: 'Dune-Strider Juggernaut', title: 'Act II Boss',
    isBoss: true, biomeIndex: 1, baseHp: 188, baseArmor: 20, scrapReward: 105, ingotReward: 42,
    pattern: [
      { type: 'multi', label: 'Twin Halberd Sweep', damage: 10, hits: 2 },
      { type: 'fortify', label: 'Sandstone Phalanx', damage: 12, armor: 22 },
      { type: 'shatter', label: 'Canyon Cleaver', damage: 26 }
    ],
    lore: 'Patrols the Amber Canyon Catacombs in bronze siege plating, grinding trespassers beneath heavy halberd arcs.'
  },
  boss_furnace: {
    id: 'boss_furnace', spriteId: 'boss_furnace', name: 'Furnace Warden Mk.IV', title: 'Act III Boss',
    isBoss: true, biomeIndex: 2, baseHp: 245, baseArmor: 24, scrapReward: 125, ingotReward: 55,
    pattern: [
      { type: 'charge', label: 'Superheat Boiler', damage: 0, armor: 24 },
      { type: 'shatter', label: 'Molten Anvil Drop', damage: 34 },
      { type: 'multi', label: 'Steam Piston Barrage', damage: 10, hits: 3 }
    ],
    lore: 'Chief mechanical overseer of the Iron Foundry Vaults, powered by twin pressurized hearth boilers.'
  },
  boss_glacier: {
    id: 'boss_glacier', spriteId: 'boss_glacier', name: 'Glacier Siege Bastion', title: 'Act IV Boss',
    isBoss: true, biomeIndex: 3, baseHp: 305, baseArmor: 30, scrapReward: 145, ingotReward: 68,
    pattern: [
      { type: 'fortify', label: 'Glacial Rampart', damage: 14, armor: 30 },
      { type: 'heavy', label: 'Avalanche Lance', damage: 32 },
      { type: 'multi', label: 'Frost-Steel Flurry', damage: 12, hits: 3 }
    ],
    lore: 'A towering frost-rimmed dreadnought anchoring the mountain wall with impenetrable shield plating.'
  },
  boss_arbiter: {
    id: 'boss_arbiter', spriteId: 'boss_arbiter', name: 'Chronometer Arbiter', title: 'Act V Boss',
    isBoss: true, biomeIndex: 4, baseHp: 365, baseArmor: 28, scrapReward: 170, ingotReward: 85,
    pattern: [
      { type: 'multi', label: 'Pendulum Twin-Cut', damage: 14, hits: 3 },
      { type: 'charge', label: 'Escapement Lock', damage: 0, armor: 32 },
      { type: 'shatter', label: 'Grand Hour Strike', damage: 42 }
    ],
    lore: 'Masterpiece horological guardian of the Grand Clockwork Spire, synchronized to relentless brass escapements.'
  },
  boss_sovereign: {
    id: 'boss_sovereign', spriteId: 'boss_sovereign', name: 'Grand Vanguard Sovereign', title: 'Final Citadel Boss',
    isBoss: true, biomeIndex: 5, baseHp: 450, baseArmor: 36, scrapReward: 220, ingotReward: 130,
    pattern: [
      { type: 'fortify', label: 'Sovereign Aegis', damage: 18, armor: 36 },
      { type: 'multi', label: 'Royal Steel Volley', damage: 15, hits: 3 },
      { type: 'charge', label: 'Crown Overdrive', damage: 0, armor: 34 },
      { type: 'shatter', label: 'Citadel Judgement', damage: 48 }
    ],
    lore: 'The apex golden-plated masterwork mech-knight reigning over the Sovereign Iron Citadel.'
  }
};

export const BIOMES: BiomeDef[] = [
  {
    index: 0, actNumeral: 'ACT I', name: 'Sunlit Sandstone Ruins', subtitle: 'Outer Viaduct Courtyard',
    bgFile: './assets/biomes/biome_1.png', ambientKind: 'sunbeams', accentHex: '#C99432',
    roomsCount: 8, enemyPool: ['enemy_pikeman', 'enemy_arbalest'], elitePool: ['enemy_bulwark'], bossId: 'boss_colossus',
    narrative: 'Golden morning light pours through weathered limestone arches where ancient clockwork sentinels still hold the expedition gates.'
  },
  {
    index: 1, actNumeral: 'ACT II', name: 'Amber Canyon Catacombs', subtitle: 'Bronze Pillar Vaults',
    bgFile: './assets/biomes/biome_2.png', ambientKind: 'sand', accentHex: '#D87A2A',
    roomsCount: 8, enemyPool: ['enemy_automaton', 'enemy_arbalest', 'enemy_pikeman'], elitePool: ['enemy_bulwark'], bossId: 'boss_juggernaut',
    narrative: 'Deep within ochre sandstone cliffs, lantern-lit corridors hum with self-winding bronze automatons guarding forgotten blueprints.'
  },
  {
    index: 2, actNumeral: 'ACT III', name: 'Iron Foundry Vaults', subtitle: 'Subterranean Forge Halls',
    bgFile: './assets/biomes/biome_3.png', ambientKind: 'embers', accentHex: '#E06424',
    roomsCount: 9, enemyPool: ['enemy_hammer_golem', 'enemy_automaton', 'enemy_bulwark'], elitePool: ['enemy_lancer'], bossId: 'boss_furnace',
    narrative: 'Colossal iron cogs turn beside roaring brick hearths where pressurized steam constructs hammer raw ore into war plating.'
  },
  {
    index: 3, actNumeral: 'ACT IV', name: 'Highland Frost Bastion', subtitle: 'Alpine Rampart Wall',
    bgFile: './assets/biomes/biome_4.png', ambientKind: 'snow', accentHex: '#4E8AC8',
    roomsCount: 9, enemyPool: ['enemy_ballista', 'enemy_bulwark', 'enemy_lancer'], elitePool: ['enemy_lancer'], bossId: 'boss_glacier',
    narrative: 'Crisp mountain winds sweep across snow-dusted battlements defended by wheeled siege ballistas and heavy frost-iron lancers.'
  },
  {
    index: 4, actNumeral: 'ACT V', name: 'Grand Clockwork Spire', subtitle: 'Horological Observatory',
    bgFile: './assets/biomes/biome_5.png', ambientKind: 'steam', accentHex: '#D6A432',
    roomsCount: 9, enemyPool: ['enemy_automaton', 'enemy_ballista', 'enemy_hammer_golem'], elitePool: ['enemy_lancer', 'enemy_bulwark'], bossId: 'boss_arbiter',
    narrative: 'Inside a cathedral of interlocking golden gears and colossal swinging pendulums, every second counts against precision automatons.'
  },
  {
    index: 5, actNumeral: 'ACT VI', name: 'Sovereign Iron Citadel', subtitle: 'Alabaster Throne Gallery',
    bgFile: './assets/biomes/biome_6.png', ambientKind: 'gold_motes', accentHex: '#E5B842',
    roomsCount: 9, enemyPool: ['enemy_lancer', 'enemy_hammer_golem', 'enemy_ballista'], elitePool: ['enemy_lancer'], bossId: 'boss_sovereign',
    narrative: 'Radiant sunlight illuminates the vaulted alabaster gallery where the Grand Vanguard Sovereign awaits the ultimate clockwork duel.'
  }
];

export interface WorkshopUpgradeDef {
  id: string;
  name: string;
  maxRank: number;
  baseCost: number;
  costStep: number;
  iconSymbolId: string;
  effectPerRank: string;
}

export const WORKSHOP_UPGRADES: WorkshopUpgradeDef[] = [
  { id: 'hull_plating', name: 'Reinforced Hull', maxRank: 8, baseCost: 25, costStep: 20, iconSymbolId: 'riveted_plate', effectPerRank: '+8 Starting Max HP per rank' },
  { id: 'start_guard', name: 'Opening Bastion', maxRank: 6, baseCost: 30, costStep: 25, iconSymbolId: 'tower_shield', effectPerRank: '+3 Opening Armor in every duel' },
  { id: 'forge_mastery', name: 'Artisan Metallurgy', maxRank: 6, baseCost: 35, costStep: 30, iconSymbolId: 'whetstone', effectPerRank: '+6% Line Combo Damage per rank' },
  { id: 'drum_locks', name: 'Brass Lock Latches', maxRank: 3, baseCost: 60, costStep: 60, iconSymbolId: 'clock_pendulum', effectPerRank: '+1 Free Drum Lock Clamp per duel' },
  { id: 'salvage_yield', name: 'Expedition Salvage', maxRank: 6, baseCost: 25, costStep: 22, iconSymbolId: 'blueprint', effectPerRank: '+15 Starting Scrap & +10% Offline Ingots' },
  { id: 'field_rations', name: 'Camp Provisions', maxRank: 5, baseCost: 30, costStep: 25, iconSymbolId: 'field_kit', effectPerRank: '+8% Extra Camp Repair & Victory Heal' }
];

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  rewardIngots: number;
  target: number;
  statKey:
    | 'totalPulls'
    | 'totalWins'
    | 'totalLines'
    | 'totalMerges'
    | 'bossesDefeated'
    | 'maxActCleared'
    | 'relicsCollected'
    | 'tier4Forged'
    | 'overdrivesTriggered'
    | 'dailyClaims';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_pull', name: 'Engage the Lever', desc: 'Pull the Clockwork Combat Console lever 5 times.', rewardIngots: 15, target: 5, statKey: 'totalPulls' },
  { id: 'seasoned_operator', name: 'Clockwork Operator', desc: 'Pull the mechanical lever 75 times across expeditions.', rewardIngots: 35, target: 75, statKey: 'totalPulls' },
  { id: 'master_tumbler', name: 'Master of the Tumbler', desc: 'Pull the mechanical lever 300 times across expeditions.', rewardIngots: 80, target: 300, statKey: 'totalPulls' },
  { id: 'first_duel', name: 'First Skirmish Won', desc: 'Win your first dungeon duel.', rewardIngots: 15, target: 1, statKey: 'totalWins' },
  { id: 'veteran_duelist', name: 'Expedition Veteran', desc: 'Win 20 dungeon duels.', rewardIngots: 45, target: 20, statKey: 'totalWins' },
  { id: 'hundred_victories', name: 'Ironclad Legend', desc: 'Win 80 dungeon duels.', rewardIngots: 110, target: 80, statKey: 'totalWins' },
  { id: 'first_line', name: 'Aligned Gears', desc: 'Trigger 3 matching 3-in-a-row synergy lines.', rewardIngots: 20, target: 3, statKey: 'totalLines' },
  { id: 'combo_architect', name: 'Synergy Architect', desc: 'Trigger 40 matching 3-in-a-row synergy lines.', rewardIngots: 55, target: 40, statKey: 'totalLines' },
  { id: 'grand_alignment', name: 'Grand Alignment', desc: 'Trigger 150 matching 3-in-a-row synergy lines.', rewardIngots: 120, target: 150, statKey: 'totalLines' },
  { id: 'first_merge', name: 'Anvil Apprentice', desc: 'Merge duplicate symbols at the Anvil Forge.', rewardIngots: 25, target: 1, statKey: 'totalMerges' },
  { id: 'master_smith', name: 'Master Metalsmith', desc: 'Complete 15 symbol merges at the Anvil Forge.', rewardIngots: 65, target: 15, statKey: 'totalMerges' },
  { id: 'tier4_smith', name: 'Masterwork Gold', desc: 'Forge a Tier IV Masterwork symbol.', rewardIngots: 90, target: 1, statKey: 'tier4Forged' },
  { id: 'boss_1', name: 'Gatekeeper Fallen', desc: 'Defeat the Act I Boss: Colossus Gatekeeper.', rewardIngots: 35, target: 1, statKey: 'maxActCleared' },
  { id: 'boss_2', name: 'Canyon Conqueror', desc: 'Clear Act II: Amber Canyon Catacombs.', rewardIngots: 50, target: 2, statKey: 'maxActCleared' },
  { id: 'boss_3', name: 'Foundry Master', desc: 'Clear Act III: Iron Foundry Vaults.', rewardIngots: 70, target: 3, statKey: 'maxActCleared' },
  { id: 'boss_4', name: 'Bastion Breaker', desc: 'Clear Act IV: Highland Frost Bastion.', rewardIngots: 90, target: 4, statKey: 'maxActCleared' },
  { id: 'boss_5', name: 'Spire Arbiter', desc: 'Clear Act V: Grand Clockwork Spire.', rewardIngots: 120, target: 5, statKey: 'maxActCleared' },
  { id: 'boss_6', name: 'Sovereign Victor', desc: 'Conquer Act VI: Sovereign Iron Citadel!', rewardIngots: 200, target: 6, statKey: 'maxActCleared' },
  { id: 'boss_slayer', name: 'Titan Breaker', desc: 'Defeat 10 Act Bosses in total.', rewardIngots: 100, target: 10, statKey: 'bossesDefeated' },
  { id: 'relic_collector', name: 'Curator of Cores', desc: 'Acquire 15 Clockwork Relics across runs.', rewardIngots: 40, target: 15, statKey: 'relicsCollected' },
  { id: 'relic_hoarder', name: 'Grand Horologist', desc: 'Acquire 50 Clockwork Relics across runs.', rewardIngots: 95, target: 50, statKey: 'relicsCollected' },
  { id: 'overdrive_1', name: 'Full Steam Ahead', desc: 'Unleash 5 Overdrive Surges in combat.', rewardIngots: 30, target: 5, statKey: 'overdrivesTriggered' },
  { id: 'overdrive_2', name: 'Boiler Baron', desc: 'Unleash 30 Overdrive Surges in combat.', rewardIngots: 75, target: 30, statKey: 'overdrivesTriggered' },
  { id: 'daily_devoted', name: 'Punctual Vanguard', desc: 'Claim Daily Expedition Supplies 3 times.', rewardIngots: 40, target: 3, statKey: 'dailyClaims' }
];

export const DAILY_REWARDS = [
  { day: 1, ingots: 25, label: '25 Sun-Brass Ingots' },
  { day: 2, ingots: 35, label: '35 Sun-Brass Ingots' },
  { day: 3, ingots: 50, label: '50 Sun-Brass Ingots' },
  { day: 4, ingots: 65, label: '65 Sun-Brass Ingots' },
  { day: 5, ingots: 80, label: '80 Sun-Brass Ingots' },
  { day: 6, ingots: 100, label: '100 Sun-Brass Ingots' },
  { day: 7, ingots: 160, label: '160 Ingots • Master Cache' }
];
