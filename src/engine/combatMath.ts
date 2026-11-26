import {
  HERO_CLASSES,
  OwnedSymbol,
  RELICS,
  SYMBOLS,
  TIER_MULTIPLIER
} from '../data/gameData';
import { ActiveRunState, saveManager } from './saveSystem';

export interface SynergyLine {
  kind: 'row' | 'col' | 'diag';
  index: number;
  cells: Array<[number, number]>; // [row, col]
  symbolId: string;
  label: string;
  multiplier: number;
}

export interface CellEval {
  row: number;
  col: number;
  owned: OwnedSymbol;
  boostMult: number;
  triggers: number;
  damage: number;
  pierceDamage: number;
  block: number;
  heal: number;
  scrap: number;
  stagger: number;
  burnHeat: number;
  overdrive: number;
  thorns: number;
  reflectPct: number;
  weakenEnemy: number;
  carryoverArmor: boolean;
  isCrit: boolean;
  partOfLine: boolean;
}

export interface SpinResolution {
  grid: OwnedSymbol[][]; // [3 rows][3 cols]
  lines: SynergyLine[];
  cells: CellEval[];
  totalDamage: number;
  totalPierceDamage: number;
  totalBlock: number;
  totalHeal: number;
  totalScrap: number;
  totalStagger: number;
  totalHeat: number;
  totalOverdrive: number;
  totalThorns: number;
  maxReflectPct: number;
  weakenEnemyPct: number;
  carryoverArmor: boolean;
  triggeredOverdrive: boolean;
  hadCrit: boolean;
  comboTag: string;
}

export function getRelicBonuses(run: ActiveRunState) {
  const relics = run.relicIds.map((id) => RELICS.find((r) => r.id === id)).filter(Boolean);
  const ranks = saveManager.data.workshopRanks;
  const cls = HERO_CLASSES.find((c) => c.id === run.heroClassId) ?? HERO_CLASSES[0];

  const categoryWeights: Record<string, number> = {};
  let diagonalBonusPct = 0;
  let lineBonusPct = (ranks.forge_mastery || 0) * 6 + (cls.id === 'ironclad' ? 15 : 0);
  let extraLocks = (ranks.drum_locks || 0) + (cls.id === 'arbalest' ? 1 : 0);
  let startArmor = cls.startArmor + (ranks.start_guard || 0) * 3;
  let scrapBonusPct = 0;
  let overdriveEveryN = 0;
  let retainArmorCap = cls.id === 'ironclad' ? 8 : 0;
  let firstTurnGearBoost = false;
  let thornsFlat = 0;
  let pierceAllMelee = false;
  let critChanceBonus = cls.id === 'arbalest' ? 15 : 8;
  let repairBonus = 0;
  let staggerBonus = 0;
  let heatBonus = 0;

  for (const r of relics) {
    if (!r) continue;
    if (r.weightBoostCategory && r.weightMultiplier) {
      categoryWeights[r.weightBoostCategory] = (categoryWeights[r.weightBoostCategory] || 1) * r.weightMultiplier;
    }
    if (r.diagonalBonusPct) diagonalBonusPct += r.diagonalBonusPct;
    if (r.lineBonusPct) lineBonusPct += r.lineBonusPct;
    if (r.extraLocksPerBattle) extraLocks += r.extraLocksPerBattle;
    if (r.startArmor) startArmor += r.startArmor;
    if (r.scrapBonusPct) scrapBonusPct += r.scrapBonusPct;
    if (r.overdriveEveryN) overdriveEveryN = overdriveEveryN ? Math.min(overdriveEveryN, r.overdriveEveryN) : r.overdriveEveryN;
    if (r.retainArmorCap) retainArmorCap += r.retainArmorCap;
    if (r.firstTurnGearBoost) firstTurnGearBoost = true;
    if (r.thornsFlat) thornsFlat += r.thornsFlat;
    if (r.pierceAllMelee) pierceAllMelee = true;
    if (r.critChanceBonus) critChanceBonus += r.critChanceBonus;
    if (r.repairBonus) repairBonus += r.repairBonus;
    if (r.staggerBonus) staggerBonus += r.staggerBonus;
    if (r.heatBonus) heatBonus += r.heatBonus;
  }

  return {
    categoryWeights,
    diagonalBonusPct,
    lineBonusPct,
    extraLocks,
    startArmor,
    scrapBonusPct,
    overdriveEveryN,
    retainArmorCap,
    firstTurnGearBoost,
    thornsFlat,
    pierceAllMelee,
    critChanceBonus,
    repairBonus,
    staggerBonus,
    heatBonus,
    gearTrainBonus: cls.id === 'artificer' ? 0.25 : 0
  };
}

function weightedPickFromDeck(deck: OwnedSymbol[], categoryWeights: Record<string, number>): OwnedSymbol {
  let totalWeight = 0;
  const weights = deck.map((item) => {
    const def = SYMBOLS[item.symbolId];
    const catW = def ? (categoryWeights[def.category] ?? 1.0) : 1.0;
    const tierW = 1 + (item.tier - 1) * 0.14; // Upgraded symbols are slightly better balanced onto the drum
    const w = catW * tierW;
    totalWeight += w;
    return w;
  });
  let r = Math.random() * totalWeight;
  for (let i = 0; i < deck.length; i++) {
    r -= weights[i];
    if (r <= 0) return deck[i];
  }
  return deck[deck.length - 1];
}

export function rollGrid(
  run: ActiveRunState,
  prevGrid: OwnedSymbol[][] | null,
  lockedCols: [boolean, boolean, boolean]
): OwnedSymbol[][] {
  const bonuses = getRelicBonuses(run);
  const grid: OwnedSymbol[][] = [[], [], []];
  for (let c = 0; c < 3; c++) {
    if (lockedCols[c] && prevGrid) {
      for (let r = 0; r < 3; r++) {
        grid[r][c] = prevGrid[r][c];
      }
    } else {
      for (let r = 0; r < 3; r++) {
        grid[r][c] = weightedPickFromDeck(run.deck, bonuses.categoryWeights);
      }
    }
  }
  return grid;
}

const LINE_SPECS: Array<{ kind: 'row' | 'col' | 'diag'; index: number; cells: Array<[number, number]> }> = [
  { kind: 'row', index: 0, cells: [[0, 0], [0, 1], [0, 2]] },
  { kind: 'row', index: 1, cells: [[1, 0], [1, 1], [1, 2]] },
  { kind: 'row', index: 2, cells: [[2, 0], [2, 1], [2, 2]] },
  { kind: 'col', index: 0, cells: [[0, 0], [1, 0], [2, 0]] },
  { kind: 'col', index: 1, cells: [[0, 1], [1, 1], [2, 1]] },
  { kind: 'col', index: 2, cells: [[0, 2], [1, 2], [2, 2]] },
  { kind: 'diag', index: 0, cells: [[0, 0], [1, 1], [2, 2]] },
  { kind: 'diag', index: 1, cells: [[2, 0], [1, 1], [0, 2]] }
];

export function hasTwoMatchingInCols01(grid: OwnedSymbol[][]): boolean {
  // Used to trigger dramatic anticipation slowdown on Column 3!
  const checkPair = (a: OwnedSymbol, b: OwnedSymbol) => {
    const da = SYMBOLS[a.symbolId];
    const db = SYMBOLS[b.symbolId];
    if (!da || !db) return false;
    return a.symbolId === b.symbolId || Boolean(da.wildcardLine) || Boolean(db.wildcardLine);
  };
  for (let r = 0; r < 3; r++) {
    if (checkPair(grid[r][0], grid[r][1])) return true;
  }
  if (checkPair(grid[0][0], grid[1][1])) return true;
  if (checkPair(grid[2][0], grid[1][1])) return true;
  return false;
}

export function evaluateSpin(
  run: ActiveRunState,
  grid: OwnedSymbol[][],
  turnNumber: number,
  currentOverdrive: number
): SpinResolution {
  const bonuses = getRelicBonuses(run);
  const lines: SynergyLine[] = [];
  const lineCellSet = new Set<string>();

  // 1. Detect 3-in-a-row / col / diag matches (exact symbol OR wildcardLine)
  for (const spec of LINE_SPECS) {
    const syms = spec.cells.map(([r, c]) => grid[r][c]);
    const nonWild = syms.filter((s) => !SYMBOLS[s.symbolId]?.wildcardLine);
    const matched =
      nonWild.length === 0 ||
      nonWild.every((s) => s.symbolId === nonWild[0].symbolId);
    if (matched) {
      const repId = nonWild[0]?.symbolId ?? syms[0].symbolId;
      const baseLineMult = 1.75 + bonuses.lineBonusPct / 100 + (spec.kind === 'diag' ? bonuses.diagonalBonusPct / 100 : 0);
      lines.push({
        kind: spec.kind,
        index: spec.index,
        cells: spec.cells,
        symbolId: repId,
        label: `${SYMBOLS[repId]?.name ?? 'Combo'} Alignment`,
        multiplier: baseLineMult
      });
      for (const [r, c] of spec.cells) {
        lineCellSet.add(`${r},${c}`);
      }
    }
  }

  // 2. Compute per-cell adjacency boosts, row boosts & retriggers
  const cellBoost: number[][] = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
  const cellTriggers: number[][] = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
  const rowFlatStrike: number[] = [0, 0, 0];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const owned = grid[r][c];
      const def = SYMBOLS[owned.symbolId];
      if (!def) continue;
      const tierBoostScale = 1 + (owned.tier - 1) * 0.2;
      if (def.adjacentBoostPct) {
        const add = (def.adjacentBoostPct / 100) * tierBoostScale * (1 + bonuses.gearTrainBonus);
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            cellBoost[nr][nc] += add;
          }
        }
      }
      if (def.retriggerAdjacent) {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            cellTriggers[nr][nc] += 1;
          }
        }
      }
      if (def.rowStrikeBoost) {
        rowFlatStrike[r] += Math.round(def.rowStrikeBoost * TIER_MULTIPLIER[owned.tier]);
      }
    }
  }

  // Apply line multipliers onto participating cells
  for (const line of lines) {
    for (const [r, c] of line.cells) {
      cellBoost[r][c] *= line.multiplier;
    }
  }

  // Turn-1 Hydraulic Lever & Overdrive check
  const flywheelSurge = bonuses.overdriveEveryN > 0 && turnNumber % bonuses.overdriveEveryN === 0;
  const triggeredOverdrive = currentOverdrive >= 100 || flywheelSurge;
  const globalMult =
    (turnNumber === 1 && bonuses.firstTurnGearBoost ? 1.45 : 1.0) *
    (triggeredOverdrive ? 1.45 : 1.0);

  const cells: CellEval[] = [];
  let totalDamage = 0;
  let totalPierceDamage = 0;
  let totalBlock = 0;
  let totalHeal = 0;
  let totalScrap = 0;
  let totalStagger = 0;
  let totalHeat = 0;
  let totalOverdrive = 0;
  let totalThorns = bonuses.thornsFlat;
  let maxReflectPct = 0;
  let weakenEnemyPct = 0;
  let carryoverArmor = false;
  let hadCrit = false;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const owned = grid[r][c];
      const def = SYMBOLS[owned.symbolId];
      if (!def) continue;
      const tMult = TIER_MULTIPLIER[owned.tier];
      const mult = cellBoost[r][c] * globalMult;
      const trig = cellTriggers[r][c];

      const isCrit = def.basePower > 0 && Math.random() * 100 < bonuses.critChanceBonus;
      if (isCrit) hadCrit = true;
      const critMult = isCrit ? 1.5 : 1.0;

      const hits = def.multiHit ?? 1;
      const rawPow = def.basePower > 0 ? Math.round((def.basePower * tMult + rowFlatStrike[r]) * mult * critMult) * hits * trig : 0;
      const isPierce = Boolean(def.pierce) || (def.category === 'melee' && bonuses.pierceAllMelee);

      const dmg = isPierce ? 0 : rawPow;
      const pierceDmg = isPierce ? rawPow : 0;
      const block = def.baseBlock > 0 ? Math.round(def.baseBlock * tMult * mult) * trig : 0;
      const heal = def.baseHeal > 0 ? Math.round((def.baseHeal * tMult + bonuses.repairBonus) * mult) * trig : 0;
      const scrap = def.baseScrap > 0 ? Math.round(def.baseScrap * tMult * (1 + bonuses.scrapBonusPct / 100)) * trig : 0;
      const stagger = def.stagger ? Math.round((def.stagger + bonuses.staggerBonus) * (1 + (owned.tier - 1) * 0.2)) * trig : 0;
      const heat = def.burnHeat ? Math.round((def.burnHeat * tMult + bonuses.heatBonus) * mult) * trig : 0;
      const od = def.overdriveGain ? Math.round(def.overdriveGain * (1 + (owned.tier - 1) * 0.2) * (1 + bonuses.gearTrainBonus)) * trig : 0;
      const thorns = def.thorns ? Math.round(def.thorns * tMult) * trig : 0;
      const reflect = def.reflectPct ? Math.min(90, def.reflectPct + (owned.tier - 1) * 8) : 0;
      const weak = def.weakenEnemy ? Math.min(50, def.weakenEnemy + (owned.tier - 1) * 5) : 0;
      if (def.carryoverArmor) carryoverArmor = true;

      totalDamage += dmg;
      totalPierceDamage += pierceDmg;
      totalBlock += block;
      totalHeal += heal;
      totalScrap += scrap;
      totalStagger += stagger;
      totalHeat += heat;
      totalOverdrive += od;
      totalThorns += thorns;
      maxReflectPct = Math.max(maxReflectPct, reflect);
      weakenEnemyPct = Math.min(60, weakenEnemyPct + weak);

      cells.push({
        row: r,
        col: c,
        owned,
        boostMult: mult,
        triggers: trig,
        damage: dmg,
        pierceDamage: pierceDmg,
        block,
        heal,
        scrap,
        stagger,
        burnHeat: heat,
        overdrive: od,
        thorns,
        reflectPct: reflect,
        weakenEnemy: weak,
        carryoverArmor: Boolean(def.carryoverArmor),
        isCrit,
        partOfLine: lineCellSet.has(`${r},${c}`)
      });
    }
  }

  let comboTag = '';
  if (lines.length >= 3) comboTag = 'GRAND CLOCKWORK ALIGNMENT!';
  else if (lines.length === 2) comboTag = 'DOUBLE SYNERGY LINE!';
  else if (lines.length === 1) comboTag = `${lines[0].label.toUpperCase()}!`;
  else if (triggeredOverdrive) comboTag = 'STEAM OVERDRIVE SURGE!';
  else if (hadCrit) comboTag = 'PRECISION STRIKE!';

  return {
    grid,
    lines,
    cells,
    totalDamage,
    totalPierceDamage,
    totalBlock,
    totalHeal,
    totalScrap,
    totalStagger,
    totalHeat,
    totalOverdrive,
    totalThorns,
    maxReflectPct,
    weakenEnemyPct,
    carryoverArmor,
    triggeredOverdrive,
    hadCrit,
    comboTag
  };
}
