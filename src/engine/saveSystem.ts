import {
  ACHIEVEMENTS,
  DAILY_REWARDS,
  HeroClassDef,
  OwnedSymbol
} from '../data/gameData';
import { nativeBridge } from '../platform/nativeBridge';

export interface ProfileStats {
  totalPulls: number;
  totalWins: number;
  totalLines: number;
  totalMerges: number;
  bossesDefeated: number;
  maxActCleared: number;
  relicsCollected: number;
  tier4Forged: number;
  overdrivesTriggered: number;
  dailyClaims: number;
  totalRuns: number;
}

export interface UserSettings {
  theme: 'light' | 'dark'; // Default Light Mode (F7 Standard)
  sfxEnabled: boolean;
  ambienceEnabled: boolean;
  hapticsEnabled: boolean;
  speedMultiplier: 1 | 2;
}

export type MapNodeType = 'duel' | 'elite' | 'forge' | 'camp' | 'chest' | 'merchant' | 'boss';

export interface MapNode {
  id: string;
  row: number; // 0..roomsCount-1
  col: number; // 0..2
  type: MapNodeType;
  enemyId?: string;
  nextIds: string[];
  visited: boolean;
  cleared: boolean;
}

export interface ActiveRunState {
  runId: string;
  heroClassId: HeroClassDef['id'];
  actIndex: number; // 0..5
  ascension: number; // 0..5
  hp: number;
  maxHp: number;
  scrap: number;
  ingotsEarned: number;
  deck: OwnedSymbol[];
  relicIds: string[];
  mapNodes: MapNode[];
  currentNodeId: string | null;
  roomsClearedInRun: number;
  pullsInRun: number;
  mergesInRun: number;
  pendingPhase: 'map' | 'duel' | 'draft' | 'forge' | 'camp' | 'chest' | 'merchant' | 'act_clear';
  pendingDraft?: {
    symbols: string[];
    relics: string[];
    bonusScrap: number;
    wasBoss: boolean;
  };
}

export interface SaveDataV1 {
  version: 1;
  ingots: number;
  unlockedClasses: HeroClassDef['id'][];
  selectedClassId: HeroClassDef['id'];
  selectedAscension: number;
  maxAscensionUnlocked: number;
  workshopRanks: Record<string, number>;
  claimedAchievements: string[];
  stats: ProfileStats;
  settings: UserSettings;
  onboardingCompleted: boolean;
  removeAdsOwned: boolean;
  dailyStreakDay: number; // 1..7
  lastDailyClaimDate: string | null; // YYYY-MM-DD
  lastOfflineClaimAt: number; // timestamp ms
  activeRun: ActiveRunState | null;
}

const STORAGE_KEY = 'gearbound_save_v1';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createDefaultSave(): SaveDataV1 {
  return {
    version: 1,
    ingots: 40,
    unlockedClasses: ['ironclad'],
    selectedClassId: 'ironclad',
    selectedAscension: 0,
    maxAscensionUnlocked: 0,
    workshopRanks: {
      hull_plating: 0,
      start_guard: 0,
      forge_mastery: 0,
      drum_locks: 0,
      salvage_yield: 0,
      field_rations: 0
    },
    claimedAchievements: [],
    stats: {
      totalPulls: 0,
      totalWins: 0,
      totalLines: 0,
      totalMerges: 0,
      bossesDefeated: 0,
      maxActCleared: 0,
      relicsCollected: 0,
      tier4Forged: 0,
      overdrivesTriggered: 0,
      dailyClaims: 0,
      totalRuns: 0
    },
    settings: {
      theme: 'light', // F7 Developer Mandatory Default Light Mode
      sfxEnabled: true,
      ambienceEnabled: true,
      hapticsEnabled: true,
      speedMultiplier: 1
    },
    onboardingCompleted: false,
    removeAdsOwned: false,
    dailyStreakDay: 1,
    lastDailyClaimDate: null,
    lastOfflineClaimAt: Date.now() - 45 * 60 * 1000, // Start with a welcoming 45m patrol ready
    activeRun: null
  };
}

class SaveManager {
  data: SaveDataV1 = createDefaultSave();

  async load(): Promise<SaveDataV1> {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      raw = await nativeBridge.loadBackup(STORAGE_KEY);
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SaveDataV1>;
        const def = createDefaultSave();
        this.data = {
          ...def,
          ...parsed,
          workshopRanks: { ...def.workshopRanks, ...(parsed.workshopRanks ?? {}) },
          stats: { ...def.stats, ...(parsed.stats ?? {}) },
          settings: { ...def.settings, ...(parsed.settings ?? {}) }
        };
      } catch {
        this.data = createDefaultSave();
      }
    }
    return this.data;
  }

  save(): void {
    const json = JSON.stringify(this.data);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // Ignore quota
    }
    void nativeBridge.saveBackup(STORAGE_KEY, json);
  }

  resetProgress(): void {
    const keepRemoveAds = this.data.removeAdsOwned;
    const keepTheme = this.data.settings.theme;
    this.data = createDefaultSave();
    this.data.removeAdsOwned = keepRemoveAds;
    this.data.settings.theme = keepTheme;
    this.save();
  }

  canClaimDaily(): boolean {
    return this.data.lastDailyClaimDate !== todayKey();
  }

  claimDaily(): { day: number; ingots: number } | null {
    if (!this.canClaimDaily()) return null;
    const dayIdx = ((this.data.dailyStreakDay - 1) % DAILY_REWARDS.length);
    const reward = DAILY_REWARDS[dayIdx];
    this.data.ingots += reward.ingots;
    this.data.stats.dailyClaims += 1;
    this.data.lastDailyClaimDate = todayKey();
    this.data.dailyStreakDay = (this.data.dailyStreakDay % DAILY_REWARDS.length) + 1;
    this.save();
    return { day: reward.day, ingots: reward.ingots };
  }

  getOfflinePatrolPreview(): { minutes: number; ingots: number; capped: boolean } {
    const now = Date.now();
    const elapsedMin = Math.max(0, Math.floor((now - this.data.lastOfflineClaimAt) / 60_000));
    const maxMin = 12 * 60; // Up to 12 hours offline accumulation
    const clamped = Math.min(elapsedMin, maxMin);
    const salvageRank = this.data.workshopRanks.salvage_yield || 0;
    const actBonus = 1 + this.data.stats.maxActCleared * 0.25;
    const ratePerHour = 12 * (1 + salvageRank * 0.10) * actBonus;
    const ingots = Math.floor((clamped / 60) * ratePerHour);
    return { minutes: clamped, ingots, capped: elapsedMin >= maxMin };
  }

  claimOfflinePatrol(multiplier: 1 | 2 = 1): number {
    const preview = this.getOfflinePatrolPreview();
    const gained = preview.ingots * multiplier;
    if (gained > 0) {
      this.data.ingots += gained;
      this.data.lastOfflineClaimAt = Date.now();
      this.save();
    }
    return gained;
  }

  getUnclaimedAchievementsCount(): number {
    let count = 0;
    for (const a of ACHIEVEMENTS) {
      if (this.data.claimedAchievements.includes(a.id)) continue;
      if (this.data.stats[a.statKey] >= a.target) count++;
    }
    return count;
  }

  claimAchievement(id: string): number {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return 0;
    if (this.data.claimedAchievements.includes(id)) return 0;
    if (this.data.stats[def.statKey] < def.target) return 0;
    this.data.claimedAchievements.push(id);
    this.data.ingots += def.rewardIngots;
    this.save();
    return def.rewardIngots;
  }
}

export const saveManager = new SaveManager();
