import {
  BIOMES,
  ENEMIES,
  HERO_CLASSES,
  HeroClassDef,
  OwnedSymbol,
  RELICS,
  SYMBOL_LIST,
  SYMBOLS
} from '../data/gameData';
import { ActiveRunState, MapNode, MapNodeType, saveManager } from './saveSystem';

let uidCounter = 1;
export function nextUid(prefix = 'sym'): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

export function generateActMap(actIndex: number): MapNode[] {
  const biome = BIOMES[actIndex] ?? BIOMES[0];
  const rows = biome.roomsCount; // 8 or 9 rows, final row is Boss!
  const nodes: MapNode[] = [];

  const rowNodes: MapNode[][] = [];
  for (let r = 0; r < rows; r++) {
    const list: MapNode[] = [];
    if (r === 0) {
      // Opening Skirmish Duel (2 branching entrances)
      for (let c = 0; c < 2; c++) {
        const enemyId = biome.enemyPool[c % biome.enemyPool.length];
        list.push({
          id: `a${actIndex}_r${r}_c${c}`,
          row: r,
          col: c === 0 ? 0 : 2,
          type: 'duel',
          enemyId,
          nextIds: [],
          visited: false,
          cleared: false
        });
      }
    } else if (r === rows - 1) {
      // Act Boss Gate
      list.push({
        id: `a${actIndex}_r${r}_boss`,
        row: r,
        col: 1,
        type: 'boss',
        enemyId: biome.bossId,
        nextIds: [],
        visited: false,
        cleared: false
      });
    } else if (r === rows - 2) {
      // Pre-Boss Preparation Row: Camp & Anvil Forge
      list.push({
        id: `a${actIndex}_r${r}_c0`,
        row: r,
        col: 0,
        type: 'camp',
        nextIds: [],
        visited: false,
        cleared: false
      });
      list.push({
        id: `a${actIndex}_r${r}_c2`,
        row: r,
        col: 2,
        type: 'forge',
        nextIds: [],
        visited: false,
        cleared: false
      });
    } else {
      // Branching Expedition Row (2 or 3 paths)
      const colSlots = r % 2 === 1 ? [0, 1, 2] : [0, 2];
      for (const c of colSlots) {
        let type: MapNodeType = 'duel';
        let enemyId: string | undefined;
        if (r === Math.floor(rows / 2) && c === 1) {
          type = 'elite';
          enemyId = biome.elitePool[Math.floor(Math.random() * biome.elitePool.length)];
        } else if (r === 2 && c === 0) {
          type = 'forge';
        } else if (r === 3 && c === 2) {
          type = 'chest';
        } else if (r === 4 && c === 0) {
          type = 'merchant';
        } else if (r === 5 && c === 2) {
          type = 'camp';
        } else {
          const roll = Math.random();
          if (roll < 0.56) {
            type = 'duel';
            enemyId = biome.enemyPool[Math.floor(Math.random() * biome.enemyPool.length)];
          } else if (roll < 0.70) {
            type = 'forge';
          } else if (roll < 0.80) {
            type = 'chest';
          } else if (roll < 0.90) {
            type = 'merchant';
          } else {
            type = 'elite';
            enemyId = biome.elitePool[Math.floor(Math.random() * biome.elitePool.length)];
          }
        }
        list.push({
          id: `a${actIndex}_r${r}_c${c}`,
          row: r,
          col: c,
          type,
          enemyId,
          nextIds: [],
          visited: false,
          cleared: false
        });
      }
    }
    rowNodes.push(list);
    nodes.push(...list);
  }

  // Connect rows cleanly without dead-ends
  for (let r = 0; r < rows - 1; r++) {
    const curr = rowNodes[r];
    const next = rowNodes[r + 1];
    for (const node of curr) {
      const sorted = [...next].sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col));
      node.nextIds.push(sorted[0].id);
      if (sorted[1] && Math.abs(sorted[1].col - node.col) <= 2) {
        node.nextIds.push(sorted[1].id);
      }
    }
    // Ensure every node in `next` has at least one incoming edge
    for (const target of next) {
      const hasIn = curr.some((n) => n.nextIds.includes(target.id));
      if (!hasIn) {
        const nearest = [...curr].sort((a, b) => Math.abs(a.col - target.col) - Math.abs(b.col - target.col))[0];
        nearest.nextIds.push(target.id);
      }
    }
  }

  return nodes;
}

export function startNewExpedition(heroClassId: HeroClassDef['id'], ascension: number): ActiveRunState {
  const cls = HERO_CLASSES.find((c) => c.id === heroClassId) ?? HERO_CLASSES[0];
  const ranks = saveManager.data.workshopRanks;
  const maxHp = cls.maxHp + (ranks.hull_plating || 0) * 8;
  const startScrap = 35 + (ranks.salvage_yield || 0) * 15;

  const deck: OwnedSymbol[] = cls.starterDeck.map((symbolId) => ({
    uid: nextUid('sym'),
    symbolId,
    tier: 1
  }));

  const run: ActiveRunState = {
    runId: nextUid('run'),
    heroClassId: cls.id,
    actIndex: 0,
    ascension,
    hp: maxHp,
    maxHp,
    scrap: startScrap,
    ingotsEarned: 0,
    deck,
    relicIds: [cls.starterRelicId],
    mapNodes: generateActMap(0),
    currentNodeId: null,
    roomsClearedInRun: 0,
    pullsInRun: 0,
    mergesInRun: 0,
    pendingPhase: 'map'
  };

  saveManager.data.stats.totalRuns += 1;
  saveManager.data.activeRun = run;
  saveManager.save();
  return run;
}

export function getSelectableMapNodeIds(run: ActiveRunState): string[] {
  if (!run.currentNodeId) {
    return run.mapNodes.filter((n) => n.row === 0).map((n) => n.id);
  }
  const curr = run.mapNodes.find((n) => n.id === run.currentNodeId);
  if (!curr) return [];
  return curr.nextIds;
}

export function buildRewardDraft(run: ActiveRunState, wasEliteOrBoss: boolean, wasBoss: boolean): {
  symbols: string[];
  relics: string[];
  bonusScrap: number;
  wasBoss: boolean;
} {
  const hasMasterBlueprint = run.relicIds.includes('master_blueprint');
  const symCount = hasMasterBlueprint ? 4 : 3;

  // Weight toward higher rarity on elites/bosses and later acts
  const pool = [...SYMBOL_LIST].sort(() => Math.random() - 0.5);
  const chosenSyms: string[] = [];
  for (const s of pool) {
    if (chosenSyms.length >= symCount) break;
    if (!wasEliteOrBoss && run.actIndex === 0 && s.rarity === 'masterwork' && Math.random() < 0.7) continue;
    chosenSyms.push(s.id);
  }
  while (chosenSyms.length < symCount) {
    chosenSyms.push(SYMBOL_LIST[Math.floor(Math.random() * SYMBOL_LIST.length)].id);
  }

  const unownedRelics = RELICS.filter((r) => !run.relicIds.includes(r.id)).sort(() => Math.random() - 0.5);
  const relicChoices = wasEliteOrBoss ? unownedRelics.slice(0, 2).map((r) => r.id) : unownedRelics.slice(0, 1).map((r) => r.id);

  return {
    symbols: chosenSyms,
    relics: relicChoices,
    bonusScrap: wasBoss ? 40 : wasEliteOrBoss ? 25 : 15,
    wasBoss
  };
}

export function getMergeableGroups(deck: OwnedSymbol[]): Array<{ symbolId: string; tier: 1 | 2 | 3; items: OwnedSymbol[] }> {
  const map = new Map<string, OwnedSymbol[]>();
  for (const item of deck) {
    if (item.tier >= 4) continue;
    const key = `${item.symbolId}::${item.tier}`;
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  const groups: Array<{ symbolId: string; tier: 1 | 2 | 3; items: OwnedSymbol[] }> = [];
  for (const [k, items] of map.entries()) {
    if (items.length >= 2) {
      const [symbolId, tierStr] = k.split('::');
      groups.push({ symbolId, tier: Number(tierStr) as 1 | 2 | 3, items });
    }
  }
  return groups;
}

export function mergeDuplicateSymbols(run: ActiveRunState, symbolId: string, tier: 1 | 2 | 3): OwnedSymbol | null {
  const matches = run.deck.filter((d) => d.symbolId === symbolId && d.tier === tier);
  if (matches.length < 2) return null;
  const [first, second] = matches;
  // Remove second, upgrade first!
  run.deck = run.deck.filter((d) => d.uid !== second.uid);
  first.tier = (tier + 1) as 2 | 3 | 4;
  run.mergesInRun += 1;
  saveManager.data.stats.totalMerges += 1;
  if (first.tier === 4) {
    saveManager.data.stats.tier4Forged += 1;
  }
  // Apply merge-heal relics
  let heal = 0;
  for (const rid of run.relicIds) {
    const r = RELICS.find((x) => x.id === rid);
    if (r?.mergeHeal) heal += r.mergeHeal;
  }
  if (heal > 0) {
    run.hp = Math.min(run.maxHp, run.hp + heal);
  }
  saveManager.save();
  return first;
}

export function addRelicToRun(run: ActiveRunState, relicId: string): void {
  if (run.relicIds.includes(relicId)) return;
  run.relicIds.push(relicId);
  const relic = RELICS.find((r) => r.id === relicId);
  if (relic?.startMaxHp) {
    run.maxHp += relic.startMaxHp;
    run.hp += relic.startMaxHp;
  }
  saveManager.data.stats.relicsCollected += 1;
  saveManager.save();
}

export function getScaledEnemyStats(enemyId: string, actIndex: number, ascension: number): {
  hp: number;
  armor: number;
  damageMult: number;
} {
  const def = ENEMIES[enemyId] ?? ENEMIES.enemy_pikeman;
  const actDelta = Math.max(0, actIndex - def.biomeIndex);
  const hpMult = (1 + actDelta * 0.24) * (1 + ascension * 0.16);
  const dmgMult = (1 + actDelta * 0.14) * (1 + ascension * 0.10);
  return {
    hp: Math.round(def.baseHp * hpMult),
    armor: Math.round(def.baseArmor * (1 + actDelta * 0.2 + ascension * 0.12)),
    damageMult: dmgMult
  };
}

export function getSymbolDisplaySummary(symbolId: string, tier: 1 | 2 | 3 | 4): string {
  const s = SYMBOLS[symbolId];
  if (!s) return '';
  const m = [1, 1, 1.55, 2.25, 3.2][tier];
  const parts: string[] = [];
  if (s.basePower > 0) {
    const p = Math.round(s.basePower * m);
    parts.push(s.multiHit ? `${p}×${s.multiHit} DMG` : `${p} DMG`);
  }
  if (s.baseBlock > 0) parts.push(`+${Math.round(s.baseBlock * m)} Guard`);
  if (s.baseHeal > 0) parts.push(`+${Math.round(s.baseHeal * m)} Repair`);
  if (s.adjacentBoostPct) parts.push(`+${Math.round(s.adjacentBoostPct * (1 + (tier - 1) * 0.2))}% Adj`);
  if (s.overdriveGain) parts.push(`+${Math.round(s.overdriveGain * (1 + (tier - 1) * 0.2))}% Steam`);
  if (s.stagger) parts.push(`${s.stagger}% Stagger`);
  if (s.burnHeat) parts.push(`+${Math.round(s.burnHeat * m)} Heat`);
  if (s.reflectPct) parts.push(`${s.reflectPct}% Parry`);
  if (s.baseScrap) parts.push(`+${Math.round(s.baseScrap * m)} Scrap`);
  if (s.wildcardLine) parts.push('Wildcard Line');
  return parts.join(' • ');
}
