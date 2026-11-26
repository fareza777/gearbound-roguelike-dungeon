import './styles.css';
import {
  BIOMES,
  ENEMIES,
  HERO_CLASSES,
  OwnedSymbol,
  RELICS,
  SYMBOL_LIST,
  SYMBOLS,
  TIER_NAMES
} from './data/gameData';
import { MONETIZATION_CONFIG } from './config/monetization';
import { sfx } from './audio/sfxEngine';
import { nativeBridge } from './platform/nativeBridge';
import { assetCache } from './engine/assetCache';
import { ActiveRunState, MapNode, saveManager } from './engine/saveSystem';
import {
  addRelicToRun,
  buildRewardDraft,
  generateActMap,
  getMergeableGroups,
  getScaledEnemyStats,
  getSelectableMapNodeIds,
  getSymbolDisplaySummary,
  mergeDuplicateSymbols,
  nextUid,
  startNewExpedition
} from './engine/runEngine';
import {
  evaluateSpin,
  getRelicBonuses,
  hasTwoMatchingInCols01,
  rollGrid
} from './engine/combatMath';
import { ArenaRenderer } from './engine/arenaRenderer';
import { ConsoleRenderer } from './engine/consoleRenderer';
import {
  closeModal,
  ModalContext,
  openAboutModal,
  openAchievementsModal,
  openCodexModal,
  openDailyRewardsModal,
  openDeckInspectorModal,
  openOfflinePatrolModal,
  openOnboardingModal,
  openSettingsModal,
  openSymbolTooltipModal,
  openWorkshopModal
} from './ui/modals';

type ScreenKind =
  | 'hub'
  | 'map'
  | 'duel'
  | 'draft'
  | 'forge'
  | 'camp'
  | 'chest'
  | 'merchant'
  | 'act_clear'
  | 'summary';

interface DuelRuntime {
  node: MapNode;
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyArmor: number;
  enemyStagger: number;
  enemyStunned: boolean;
  enemyHeat: number;
  enemyDamageMult: number;
  patternIdx: number;
  heroArmor: number;
  heroOverdrive: number;
  heroThorns: number;
  heroReflectPct: number;
  enemyWeakenedPct: number;
  carryoverArmor: boolean;
  turnNumber: number;
  locksRemaining: number;
  lockedCols: [boolean, boolean, boolean];
  currentGrid: OwnedSymbol[][];
  busy: boolean;
  arena: ArenaRenderer | null;
  console: ConsoleRenderer | null;
}

class GearboundApp {
  private screen: ScreenKind = 'hub';
  private duel: DuelRuntime | null = null;
  private hubHeroRaf = 0;
  private summaryData: { victory: boolean; actName: string; rooms: number; ingots: number; reason: string } | null = null;
  private modalCtx: ModalContext;

  constructor() {
    this.modalCtx = {
      onStateChanged: () => this.onGlobalStateChanged(),
      showToast: (m) => this.showToast(m)
    };
  }

  async boot(): Promise<void> {
    await saveManager.load();
    const s = saveManager.data.settings;
    document.documentElement.setAttribute('data-theme', s.theme);
    sfx.configure(s.sfxEnabled, s.ambienceEnabled);
    nativeBridge.setHapticsEnabled(s.hapticsEnabled);
    await nativeBridge.init(s.theme, saveManager.data.removeAdsOwned);

    // Preload sprite manifest & core console/UI assets in parallel with dual splash
    const preloadTask = Promise.all([
      assetCache.loadManifest(),
      assetCache.preload([
        './assets/ui/console_housing.png',
        './assets/ui/gear_brass_lg.png',
        './assets/ui/gear_iron_md.png',
        './assets/ui/gear_copper_sm.png',
        './assets/ui/lock_clamp_open.png',
        './assets/ui/lock_clamp_locked.png',
        './assets/ui/panel_light.png',
        './assets/ui/panel_dark.png',
        './assets/ui/btn_brass.png',
        './assets/ui/btn_crimson.png',
        './assets/ui/btn_iron.png',
        './assets/ui/btn_emerald.png',
        './assets/biomes/biome_1.png',
        ...SYMBOL_LIST.map((sym) => `./assets/symbols/${sym.id}.png`)
      ])
    ]).then(() => assetCache.preloadUnit('hero_ironclad'));

    await this.runDualSplashScreens();
    await preloadTask;

    await nativeBridge.applyStatusBarTheme(s.theme);
    await nativeBridge.showBanner(saveManager.data.removeAdsOwned);
    this.goTo('hub');

    if (!saveManager.data.onboardingCompleted) {
      setTimeout(() => openOnboardingModal(this.modalCtx, 0), 380);
    }
  }

  /**
   * F7 Developer Mandatory Dual Sequential Splash Screens:
   * 1) Custom art-generated Gearbound Title Splash
   * 2) F7 Developer Brand Splash Video (silent, portrait, from G:\My Drive\F7 Developer - Content\F7 Brand)
   */
  private runDualSplashScreens(): Promise<void> {
    return new Promise<void>((resolve) => {
      const overlay = document.getElementById('splash-overlay')!;
      const stageGame = document.getElementById('splash-game')!;
      const stageF7 = document.getElementById('splash-f7')!;
      const video = document.getElementById('f7-splash-video') as HTMLVideoElement;
      const fallback = document.getElementById('f7-splash-fallback') as HTMLImageElement;

      let step = 1;
      let finished = false;
      let timer: number | undefined;

      const finishAll = () => {
        if (finished) return;
        finished = true;
        if (timer) window.clearTimeout(timer);
        try {
          video.pause();
        } catch {
          // Ignore
        }
        overlay.classList.remove('active');
        setTimeout(() => overlay.classList.add('hidden'), 460);
        resolve();
      };

      const startF7Stage = () => {
        if (step !== 1) return;
        step = 2;
        if (timer) window.clearTimeout(timer);
        stageGame.classList.remove('active');
        stageF7.classList.add('active');

        const showFallback = () => {
          video.classList.add('hidden');
          fallback.classList.remove('hidden');
          timer = window.setTimeout(finishAll, 1900);
        };

        video.onended = () => finishAll();
        video.onerror = () => showFallback();
        video.muted = true;
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise) {
          playPromise.catch(() => showFallback());
        }
        // Safety cap (F7 spec recommends 4.5-5s timeout)
        timer = window.setTimeout(finishAll, 4500);
      };

      overlay.onclick = () => {
        sfx.unlock();
        if (step === 1) startF7Stage();
        else finishAll();
      };

      // Expose clean debug jump for QA automation while keeping default sequence authentic
      (window as unknown as { __gearboundSplash?: { toF7: () => void; finish: () => void } }).__gearboundSplash = {
        toF7: startF7Stage,
        finish: finishAll
      };

      timer = window.setTimeout(startF7Stage, 2300);
    });
  }

  showToast(msg: string): void {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const item = document.createElement('div');
    item.className = 'toast-item';
    item.textContent = msg;
    root.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.25s ease';
      setTimeout(() => item.remove(), 260);
    }, 2400);
  }

  private onGlobalStateChanged(): void {
    void nativeBridge.showBanner(saveManager.data.removeAdsOwned);
    if (this.duel) {
      const sp = saveManager.data.settings.speedMultiplier;
      this.duel.arena?.setSpeed(sp);
      this.duel.console?.setSpeed(sp);
    }
    if (this.screen !== 'duel') {
      this.renderCurrentScreen();
    }
  }

  private cleanupActiveScreen(): void {
    if (this.hubHeroRaf) {
      cancelAnimationFrame(this.hubHeroRaf);
      this.hubHeroRaf = 0;
    }
    if (this.duel) {
      this.duel.arena?.destroy();
      this.duel.console?.destroy();
      this.duel.arena = null;
      this.duel.console = null;
    }
  }

  private goTo(next: ScreenKind): void {
    this.cleanupActiveScreen();
    this.screen = next;
    this.renderCurrentScreen();
  }

  private renderTopHud(): void {
    const hud = document.getElementById('top-hud')!;
    const run = saveManager.data.activeRun;
    if (this.screen === 'hub' || !run) {
      hud.classList.add('hidden');
      hud.innerHTML = '';
      return;
    }
    const biome = BIOMES[run.actIndex] ?? BIOMES[0];
    hud.classList.remove('hidden');
    hud.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;min-width:0;">
        <button class="hud-icon-btn" data-hud-home title="Return to Citadel Hub">⌂</button>
        <div class="hud-pill" style="color:var(--ink-accent);">${biome.actNumeral}</div>
        <div class="hud-pill">♥ ${Math.max(0, Math.ceil(run.hp))}/${run.maxHp}</div>
        <div class="hud-pill">⚙ ${run.scrap}</div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;">
        <button class="hud-icon-btn" data-hud-deck title="Tumbler Pool & Relics">⛨</button>
        <button class="hud-icon-btn" data-hud-settings title="Settings">☰</button>
      </div>
    `;
    hud.querySelector('[data-hud-home]')?.addEventListener('click', () => {
      sfx.playTap();
      this.goTo('hub');
    });
    hud.querySelector('[data-hud-deck]')?.addEventListener('click', () => {
      sfx.playTap();
      openDeckInspectorModal(run);
    });
    hud.querySelector('[data-hud-settings]')?.addEventListener('click', () => {
      sfx.playTap();
      openSettingsModal(this.modalCtx);
    });
  }

  private renderCurrentScreen(): void {
    this.renderTopHud();
    switch (this.screen) {
      case 'hub':
        this.renderHubScreen();
        break;
      case 'map':
        this.renderMapScreen();
        break;
      case 'duel':
        void this.renderDuelScreen();
        break;
      case 'draft':
        this.renderDraftScreen();
        break;
      case 'forge':
        this.renderForgeScreen();
        break;
      case 'camp':
        this.renderCampScreen();
        break;
      case 'chest':
        this.renderChestScreen();
        break;
      case 'merchant':
        this.renderMerchantScreen();
        break;
      case 'act_clear':
        this.renderActClearScreen();
        break;
      case 'summary':
        this.renderSummaryScreen();
        break;
    }
  }

  // ==================== 1. CITADEL EXPEDITION HUB ====================
  private renderHubScreen(): void {
    const root = document.getElementById('screen-root')!;
    const data = saveManager.data;
    const cls = HERO_CLASSES.find((c) => c.id === data.selectedClassId) ?? HERO_CLASSES[0];
    const hasRun = Boolean(data.activeRun);
    const dailyReady = saveManager.canClaimDaily();
    const patrol = saveManager.getOfflinePatrolPreview();
    const achCount = saveManager.getUnclaimedAchievementsCount();

    root.innerHTML = `
      <div class="hub-layout">
        <div class="hub-header">
          <div class="hub-brand">
            <img src="./assets/ui/app_icon_master.png" alt="Gearbound" class="hub-app-emblem" />
            <div>
              <h1 class="title-engraved" style="font-size:21px;line-height:1.05;">GEARBOUND</h1>
              <div class="ui-label" style="font-size:9.5px;color:var(--ink-accent);">CLOCKWORK ROGUELIKE DUEL</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="hud-pill" style="font-size:11.5px;">⚙ ${data.ingots}</div>
            <button class="hud-icon-btn" data-open-settings aria-label="Settings">☰</button>
          </div>
        </div>

        <div class="ornate-panel hub-hero-showcase">
          <div class="hub-hero-portrait">
            <canvas id="hub-hero-canvas" width="192" height="192"></canvas>
          </div>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
            <div class="ui-label" style="font-size:13.5px;color:var(--ink-primary);">${cls.name.toUpperCase()}</div>
            <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">${cls.role} • ${cls.maxHp + (data.workshopRanks.hull_plating || 0) * 8} HP</div>
            <p class="prose-justified" style="font-size:12.8px;line-height:1.3;">${cls.passiveDesc}</p>
          </div>
        </div>

        <div class="class-tabs">
          ${HERO_CLASSES.map((c) => {
            const unlocked = data.unlockedClasses.includes(c.id);
            const active = c.id === cls.id;
            return `<button class="class-tab ${active ? 'active' : ''}" data-select-class="${c.id}">
              ${unlocked ? c.name.split(' ')[0].toUpperCase() : `🔒 ${c.name.split(' ')[0].toUpperCase()}`}
            </button>`;
          }).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:7px;">
          ${
            hasRun
              ? `<button class="gb-btn gb-btn-emerald gb-btn-lg" data-resume-run>
                   ▶ RESUME EXPEDITION (ACT ${(data.activeRun!.actIndex + 1)})
                 </button>`
              : ''
          }
          <button class="gb-btn gb-btn-brass gb-btn-lg" data-start-run>
            ⚔ ${hasRun ? 'NEW EXPEDITION' : 'LAUNCH EXPEDITION'}
          </button>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px;">
            <span class="ui-label" style="font-size:10px;color:var(--ink-secondary);">
              BEST: ACT ${Math.min(6, Math.max(1, data.stats.maxActCleared || 1))} • ASCENSION ${data.selectedAscension}
            </span>
            <button class="gb-btn gb-btn-iron gb-btn-sm" style="min-height:28px;padding:3px 10px;font-size:10px;" data-cycle-asc>
              ASCENSION: ${data.selectedAscension}
            </button>
          </div>
        </div>

        <div class="hub-grid-actions">
          <button class="hub-tile-btn" data-open-workshop>
            <img src="./assets/symbols/whetstone.png" class="hub-tile-icon" alt="" />
            WORKSHOP
          </button>
          <button class="hub-tile-btn" data-open-daily>
            ${dailyReady ? '<span class="badge-dot">!</span>' : ''}
            <img src="./assets/symbols/blueprint.png" class="hub-tile-icon" alt="" />
            DAILY
          </button>
          <button class="hub-tile-btn" data-open-patrol>
            ${patrol.ingots > 0 ? `<span class="badge-dot">+${patrol.ingots}</span>` : ''}
            <img src="./assets/symbols/clock_pendulum.png" class="hub-tile-icon" alt="" />
            PATROL
          </button>
          <button class="hub-tile-btn" data-open-ach>
            ${achCount > 0 ? `<span class="badge-dot">${achCount}</span>` : ''}
            <img src="./assets/symbols/banner_resolve.png" class="hub-tile-icon" alt="" />
            TROPHIES
          </button>
          <button class="hub-tile-btn" data-open-codex>
            <img src="./assets/symbols/master_cogwheel.png" class="hub-tile-icon" alt="" />
            CODEX
          </button>
          <button class="hub-tile-btn" data-open-about>
            <img src="./assets/symbols/masterwork_core.png" class="hub-tile-icon" alt="" />
            ${data.removeAdsOwned ? 'ABOUT F7' : 'NO ADS $4.99'}
          </button>
        </div>
      </div>
    `;

    // Animate live idle hero preview sprite on hub canvas
    void assetCache.preloadUnit(cls.spriteId).then(() => {
      const cv = document.getElementById('hub-hero-canvas') as HTMLCanvasElement | null;
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      let start = performance.now();
      const tick = (now: number) => {
        if (this.screen !== 'hub') return;
        const meta = assetCache.manifest[cls.spriteId];
        const idle = meta?.anims.idle;
        const sheet = idle ? assetCache.getImage(idle.file) : null;
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (meta && idle && sheet) {
          const idx = Math.floor(((now - start) / 1000) * 11) % idle.frames;
          const dw = (meta.frameWidth / meta.frameHeight) * 172;
          ctx.drawImage(sheet, idx * meta.frameWidth, 0, meta.frameWidth, meta.frameHeight, (cv.width - dw) * 0.5, 16, dw, 172);
        }
        this.hubHeroRaf = requestAnimationFrame(tick);
      };
      this.hubHeroRaf = requestAnimationFrame(tick);
    });

    root.querySelector('[data-open-settings]')?.addEventListener('click', () => {
      sfx.playTap();
      openSettingsModal(this.modalCtx);
    });
    root.querySelectorAll('[data-select-class]').forEach((b) => {
      b.addEventListener('click', () => {
        sfx.playTap();
        const id = b.getAttribute('data-select-class') as 'ironclad' | 'arbalest' | 'artificer';
        if (!data.unlockedClasses.includes(id)) {
          this.showToast('Unlock this Vanguard class inside the Citadel Workshop!');
          openWorkshopModal(this.modalCtx);
          return;
        }
        data.selectedClassId = id;
        saveManager.save();
        this.renderHubScreen();
      });
    });
    root.querySelector('[data-cycle-asc]')?.addEventListener('click', () => {
      sfx.playTap();
      if (data.maxAscensionUnlocked <= 0) {
        this.showToast('Clear Act VI to unlock Masterwork Ascension tiers!');
        return;
      }
      data.selectedAscension = (data.selectedAscension + 1) % (data.maxAscensionUnlocked + 1);
      saveManager.save();
      this.renderHubScreen();
    });
    root.querySelector('[data-resume-run]')?.addEventListener('click', () => {
      sfx.playLeverPull();
      const run = saveManager.data.activeRun;
      if (!run) return;
      this.goTo(run.pendingPhase === 'duel' ? 'map' : run.pendingPhase);
    });
    root.querySelector('[data-start-run]')?.addEventListener('click', () => {
      sfx.playLeverPull();
      startNewExpedition(data.selectedClassId, data.selectedAscension);
      this.goTo('map');
    });
    root.querySelector('[data-open-workshop]')?.addEventListener('click', () => {
      sfx.playTap();
      openWorkshopModal(this.modalCtx);
    });
    root.querySelector('[data-open-daily]')?.addEventListener('click', () => {
      sfx.playTap();
      openDailyRewardsModal(this.modalCtx);
    });
    root.querySelector('[data-open-patrol]')?.addEventListener('click', () => {
      sfx.playTap();
      openOfflinePatrolModal(this.modalCtx);
    });
    root.querySelector('[data-open-ach]')?.addEventListener('click', () => {
      sfx.playTap();
      openAchievementsModal(this.modalCtx);
    });
    root.querySelector('[data-open-codex]')?.addEventListener('click', () => {
      sfx.playTap();
      openCodexModal('symbols');
    });
    root.querySelector('[data-open-about]')?.addEventListener('click', () => {
      sfx.playTap();
      if (data.removeAdsOwned) openAboutModal(this.modalCtx);
      else openSettingsModal(this.modalCtx);
    });
  }

  // ==================== 2. BRANCHING EXPEDITION TRAIL MAP ====================
  private renderMapScreen(): void {
    const run = saveManager.data.activeRun;
    if (!run) {
      this.goTo('hub');
      return;
    }
    const root = document.getElementById('screen-root')!;
    const biome = BIOMES[run.actIndex] ?? BIOMES[0];
    const selectable = new Set(getSelectableMapNodeIds(run));

    const maxRow = Math.max(...run.mapNodes.map((n) => n.row));
    const nodeIcons: Record<MapNode['type'], { icon: string; label: string }> = {
      duel: { icon: './assets/symbols/vanguard_blade.png', label: 'DUEL' },
      elite: { icon: './assets/symbols/anvil_crusher.png', label: 'ELITE' },
      forge: { icon: './assets/symbols/whetstone.png', label: 'FORGE' },
      camp: { icon: './assets/symbols/field_kit.png', label: 'CAMP' },
      chest: { icon: './assets/symbols/blueprint.png', label: 'CHEST' },
      merchant: { icon: './assets/symbols/master_cogwheel.png', label: 'TRADER' },
      boss: { icon: './assets/symbols/masterwork_core.png', label: 'ACT BOSS' }
    };

    // Build rows top-down from Boss (maxRow) down to Entrance (0) so player climbs upward!
    let rowsHtml = '';
    for (let r = maxRow; r >= 0; r--) {
      const rowNodes = run.mapNodes.filter((n) => n.row === r).sort((a, b) => a.col - b.col);
      rowsHtml += `
        <div class="map-row">
          ${rowNodes
            .map((node) => {
              const info = nodeIcons[node.type];
              const isSel = selectable.has(node.id);
              const cls = node.cleared ? 'cleared' : isSel ? 'selectable' : 'locked';
              return `
                <button class="map-node-btn ${cls} ${node.type === 'boss' ? 'boss-node' : ''}" data-map-node="${node.id}">
                  <img src="${info.icon}" style="width:28px;height:28px;border-radius:6px;" alt="" />
                  <span>${node.cleared ? '✓ ' : ''}${info.label}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      `;
    }

    root.innerHTML = `
      <div class="screen-scroll">
        <div class="ornate-panel" style="padding:20px 22px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">${biome.actNumeral} OF VI • ${biome.subtitle.toUpperCase()}</div>
              <h2 class="title-engraved" style="font-size:17px;">${biome.name}</h2>
            </div>
            <span class="tier-pill">${run.deck.length} TILES • ${run.relicIds.length} ${run.relicIds.length === 1 ? 'RELIC' : 'RELICS'}</span>
          </div>
          <p class="prose-justified" style="font-size:13px;margin-top:5px;">${biome.narrative}</p>
        </div>

        <div class="map-canvas-wrap" style="padding:22px 18px;">
          <div class="ui-label" style="text-align:center;font-size:10px;color:var(--ink-accent);margin-bottom:8px;">
            ▲ ADVANCE UPWARD TO THE ACT BOSS GATE ▲
          </div>
          <div id="map-nodes-stage" style="position:relative;">
            <svg id="map-trails-svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;"></svg>
            ${rowsHtml}
          </div>
        </div>
      </div>
    `;

    // Render crisp brass SVG trail lines connecting branching expedition nodes
    requestAnimationFrame(() => {
      const stage = document.getElementById('map-nodes-stage');
      const svg = document.getElementById('map-trails-svg');
      if (!stage || !svg) return;
      const sr = stage.getBoundingClientRect();
      const lines: string[] = [];
      for (const node of run.mapNodes) {
        const a = stage.querySelector(`[data-map-node="${node.id}"]`);
        if (!a) continue;
        const ar = a.getBoundingClientRect();
        const x1 = ar.left - sr.left + ar.width * 0.5;
        const y1 = ar.top - sr.top + ar.height * 0.5;
        for (const nid of node.nextIds) {
          const b = stage.querySelector(`[data-map-node="${nid}"]`);
          if (!b) continue;
          const br = b.getBoundingClientRect();
          const x2 = br.left - sr.left + br.width * 0.5;
          const y2 = br.top - sr.top + br.height * 0.5;
          const active = node.cleared || selectable.has(nid);
          lines.push(
            `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${active ? '#C9942E' : 'rgba(130,96,46,0.45)'}" stroke-width="${active ? '3' : '2'}" stroke-dasharray="5 4" />`
          );
        }
      }
      svg.innerHTML = lines.join('');
      // Auto-scroll expedition map cleanly to currently selectable row (so Row 0 is immediately visible!)
      const firstSel = stage.querySelector('.map-node-btn.selectable') as HTMLElement | null;
      if (firstSel) {
        firstSel.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      }
    });

    root.querySelectorAll('[data-map-node]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-map-node')!;
        if (!selectable.has(id)) return;
        const node = run.mapNodes.find((n) => n.id === id);
        if (!node) return;
        sfx.playLeverPull();
        node.visited = true;
        run.currentNodeId = node.id;

        if (node.type === 'duel' || node.type === 'elite' || node.type === 'boss') {
          run.pendingPhase = 'duel';
          saveManager.save();
          this.initDuel(node);
          this.goTo('duel');
        } else {
          node.cleared = true;
          run.roomsClearedInRun += 1;
          run.pendingPhase = node.type;
          saveManager.save();
          this.goTo(node.type);
        }
      });
    });
  }

  // ==================== 3. ACTIVE 60 FPS DUNGEON DUEL & 3x3 CONSOLE ====================
  private initDuel(node: MapNode): void {
    const run = saveManager.data.activeRun!;
    const enemyId = node.enemyId ?? 'enemy_pikeman';
    const scaled = getScaledEnemyStats(enemyId, run.actIndex, run.ascension);
    const bonuses = getRelicBonuses(run);
    const initialGrid = rollGrid(run, null, [false, false, false]);

    this.duel = {
      node,
      enemyId,
      enemyHp: scaled.hp,
      enemyMaxHp: scaled.hp,
      enemyArmor: scaled.armor,
      enemyStagger: 0,
      enemyStunned: false,
      enemyHeat: 0,
      enemyDamageMult: scaled.damageMult,
      patternIdx: 0,
      heroArmor: bonuses.startArmor,
      heroOverdrive: 0,
      heroThorns: bonuses.thornsFlat,
      heroReflectPct: 0,
      enemyWeakenedPct: 0,
      carryoverArmor: false,
      turnNumber: 1,
      locksRemaining: Math.max(1, bonuses.extraLocks),
      lockedCols: [false, false, false],
      currentGrid: initialGrid,
      busy: false,
      arena: null,
      console: null
    };
  }

  private async renderDuelScreen(): Promise<void> {
    const run = saveManager.data.activeRun;
    if (!run || !this.duel) {
      this.goTo('map');
      return;
    }
    const d = this.duel;
    const cls = HERO_CLASSES.find((c) => c.id === run.heroClassId) ?? HERO_CLASSES[0];
    const enemyDef = ENEMIES[d.enemyId] ?? ENEMIES.enemy_pikeman;
    const biome = BIOMES[run.actIndex] ?? BIOMES[0];

    await Promise.all([
      assetCache.preload([biome.bgFile]),
      assetCache.preloadUnit(cls.spriteId),
      assetCache.preloadUnit(enemyDef.spriteId)
    ]);

    const root = document.getElementById('screen-root')!;
    const speed = saveManager.data.settings.speedMultiplier;

    const relicIcons = run.relicIds
      .slice(0, 7)
      .map((rid) => {
        const r = RELICS.find((x) => x.id === rid);
        return r ? `<img src="./assets/symbols/${r.iconSymbolId}.png" title="${r.name}" class="relic-mini" alt="" />` : '';
      })
      .join('');

    root.innerHTML = `
      <div class="duel-screen">
        <div class="arena-zone">
          <canvas id="arena-canvas"></canvas>
        </div>

        <div class="tactical-ribbon">
          <div class="relic-strip">${relicIcons || '<span>NO RELICS</span>'}</div>
          <div id="duel-status-copy" style="white-space:nowrap;">TURN ${d.turnNumber} • PULL LEVER</div>
        </div>

        <div class="console-zone">
          <canvas id="console-canvas"></canvas>
        </div>

        <div class="console-controls-bar">
          <button class="gb-btn gb-btn-iron gb-btn-sm" id="btn-speed">${speed}X</button>
          <button class="gb-btn gb-btn-brass gb-btn-sm" id="btn-pull-main" style="min-height:40px;font-size:13px;">
            ⚙ PULL LEVER
          </button>
          <button class="gb-btn gb-btn-iron gb-btn-sm" id="btn-deck">POOL</button>
          <button class="gb-btn gb-btn-crimson gb-btn-sm" id="btn-pause">PAUSE</button>
        </div>
      </div>
    `;

    const arenaCanvas = document.getElementById('arena-canvas') as HTMLCanvasElement;
    const consoleCanvas = document.getElementById('console-canvas') as HTMLCanvasElement;

    const currentIntent = this.getScaledIntent(d);
    d.arena = new ArenaRenderer(arenaCanvas, {
      biomeIndex: run.actIndex,
      heroSpriteId: cls.spriteId,
      heroHp: run.hp,
      heroMaxHp: run.maxHp,
      heroArmor: d.heroArmor,
      heroOverdrive: d.heroOverdrive,
      enemySpriteId: enemyDef.spriteId,
      enemyName: enemyDef.name,
      enemyTitle: enemyDef.title,
      enemyIsBoss: Boolean(enemyDef.isBoss),
      enemyHp: d.enemyHp,
      enemyMaxHp: d.enemyMaxHp,
      enemyArmor: d.enemyArmor,
      enemyStagger: d.enemyStagger,
      enemyStunned: d.enemyStunned,
      enemyHeat: d.enemyHeat,
      enemyIntent: currentIntent,
      weakenedPct: d.enemyWeakenedPct
    });
    d.arena.setSpeed(speed);

    d.console = new ConsoleRenderer(consoleCanvas, d.currentGrid, {
      onPullRequested: () => void this.executeDuelTurn(),
      onToggleLock: (col) => this.toggleDrumLock(col),
      onCellTapped: (_r, _c, sym) => {
        sfx.playTap();
        openSymbolTooltipModal(sym);
      }
    });
    d.console.setSpeed(speed);
    d.console.setHudMeta(d.locksRemaining, d.lockedCols, d.heroOverdrive >= 100);

    const onResize = () => {
      d.arena?.resize();
      d.console?.resize();
    };
    window.addEventListener('resize', onResize, { passive: true });

    document.getElementById('btn-pull-main')?.addEventListener('click', () => {
      sfx.unlock();
      void this.executeDuelTurn();
    });
    document.getElementById('btn-speed')?.addEventListener('click', () => {
      sfx.playTap();
      const next = saveManager.data.settings.speedMultiplier === 1 ? 2 : 1;
      saveManager.data.settings.speedMultiplier = next;
      saveManager.save();
      d.arena?.setSpeed(next);
      d.console?.setSpeed(next);
      const b = document.getElementById('btn-speed');
      if (b) b.textContent = `${next}X`;
    });
    document.getElementById('btn-deck')?.addEventListener('click', () => {
      sfx.playTap();
      openDeckInspectorModal(run);
    });
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      sfx.playTap();
      openSettingsModal(this.modalCtx);
    });
  }

  private getScaledIntent(d: DuelRuntime) {
    const def = ENEMIES[d.enemyId] ?? ENEMIES.enemy_pikeman;
    const raw = def.pattern[d.patternIdx % def.pattern.length];
    return {
      ...raw,
      damage: Math.round(raw.damage * d.enemyDamageMult),
      armor: raw.armor ? Math.round(raw.armor * d.enemyDamageMult) : 0
    };
  }

  private toggleDrumLock(col: number): void {
    const d = this.duel;
    if (!d || d.busy) return;
    if (d.lockedCols[col]) {
      d.lockedCols[col] = false;
      d.locksRemaining += 1;
      sfx.playLockClamp(false);
    } else {
      if (d.locksRemaining <= 0) {
        this.showToast('No Drum Lock Clamps left in this duel.');
        return;
      }
      d.lockedCols[col] = true;
      d.locksRemaining -= 1;
      sfx.playLockClamp(true);
    }
    d.console?.setHudMeta(d.locksRemaining, d.lockedCols, d.heroOverdrive >= 100);
  }

  private wait(ms: number): Promise<void> {
    const mult = saveManager.data.settings.speedMultiplier === 2 ? 0.58 : 1;
    return new Promise((r) => setTimeout(r, Math.round(ms * mult)));
  }

  private syncDuelVisuals(): void {
    const run = saveManager.data.activeRun;
    const d = this.duel;
    if (!run || !d) return;
    d.arena?.updateState({
      heroHp: run.hp,
      heroMaxHp: run.maxHp,
      heroArmor: d.heroArmor,
      heroOverdrive: d.heroOverdrive,
      enemyHp: d.enemyHp,
      enemyMaxHp: d.enemyMaxHp,
      enemyArmor: d.enemyArmor,
      enemyStagger: d.enemyStagger,
      enemyStunned: d.enemyStunned,
      enemyHeat: d.enemyHeat,
      enemyIntent: this.getScaledIntent(d),
      weakenedPct: d.enemyWeakenedPct
    });
    d.console?.setHudMeta(d.locksRemaining, d.lockedCols, d.heroOverdrive >= 100);
    this.renderTopHud();
  }

  private async executeDuelTurn(): Promise<void> {
    const run = saveManager.data.activeRun;
    const d = this.duel;
    if (!run || !d || d.busy || !d.console || !d.arena) return;

    d.busy = true;
    const pullBtn = document.getElementById('btn-pull-main') as HTMLButtonElement | null;
    if (pullBtn) pullBtn.disabled = true;
    const statusEl = document.getElementById('duel-status-copy');
    if (statusEl) statusEl.textContent = 'DRUMS SPINNING...';

    // 1. Roll weighted 3x3 grid respecting locked columns & relic probability weights
    const nextGrid = rollGrid(run, d.currentGrid, d.lockedCols);
    const hasAnticipation = !d.lockedCols[2] && hasTwoMatchingInCols01(nextGrid);

    run.pullsInRun += 1;
    saveManager.data.stats.totalPulls += 1;

    await d.console.spinTo(nextGrid, run.deck, d.lockedCols, hasAnticipation);
    d.currentGrid = nextGrid;
    // Release column locks after the pull resolves
    d.lockedCols = [false, false, false];

    // 2. Evaluate full 3x3 synergy lines, adjacency boosts, overdrive & crits
    const res = evaluateSpin(run, nextGrid, d.turnNumber, d.heroOverdrive);
    if (res.lines.length > 0) {
      saveManager.data.stats.totalLines += res.lines.length;
      d.console.highlightSynergies(res.lines);
    }
    if (res.comboTag) {
      d.arena.showComboBanner(res.comboTag);
    }
    if (res.triggeredOverdrive) {
      d.heroOverdrive = 0;
      saveManager.data.stats.overdrivesTriggered += 1;
      d.arena.triggerOverdriveBurst();
    }
    d.heroOverdrive = Math.min(100, d.heroOverdrive + res.totalOverdrive + (res.lines.length > 0 ? 16 : 8));
    d.heroThorns = res.totalThorns;
    d.heroReflectPct = res.maxReflectPct;
    d.enemyWeakenedPct = res.weakenEnemyPct;
    d.carryoverArmor = res.carryoverArmor;

    if (res.lines.length > 0) await this.wait(420);

    // 3. Apply Hero Guard & Repair first
    if (res.totalBlock > 0) {
      d.heroArmor += res.totalBlock;
      d.arena.triggerHeroGuard();
      sfx.playShieldBlock();
      d.arena.spawnFloatingNumber('hero', `+${res.totalBlock}`, 'block', 'GUARD');
      this.syncDuelVisuals();
      await this.wait(260);
    }
    if (res.totalHeal > 0) {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + res.totalHeal);
      const healed = Math.round(run.hp - before);
      if (healed > 0) {
        sfx.playRepairKit();
        d.arena.spawnFloatingNumber('hero', `+${healed}`, 'heal', 'REPAIR');
      }
      this.syncDuelVisuals();
    }
    if (res.totalScrap > 0) {
      run.scrap += res.totalScrap;
    }

    // 4. Execute Hero Strikes (Standard Melee + Armor-Piercing Ranged/Heavy)
    const totalAtk = res.totalDamage + res.totalPierceDamage;
    if (totalAtk > 0) {
      const heavy = totalAtk >= 28 || res.hadCrit || res.lines.length > 0;
      const rangedPrimary = res.totalPierceDamage > res.totalDamage;
      d.arena.triggerHeroAttack(heavy, rangedPrimary);
      if (rangedPrimary) sfx.playCrossbowShot();
      else if (heavy) sfx.playHeavySlam();
      else sfx.playSwordSlash(false);

      await this.wait(170);

      // Standard damage hits enemy armor first; pierce bypasses armor!
      let hpLoss = 0;
      if (res.totalDamage > 0) {
        const absorbed = Math.min(d.enemyArmor, res.totalDamage);
        d.enemyArmor -= absorbed;
        hpLoss += res.totalDamage - absorbed;
      }
      if (res.totalPierceDamage > 0) {
        hpLoss += res.totalPierceDamage;
      }

      d.enemyHp = Math.max(0, d.enemyHp - hpLoss);
      d.arena.triggerEnemyHit(heavy);
      if (heavy) void nativeBridge.haptic('heavy');
      d.arena.spawnFloatingNumber(
        'enemy',
        `-${totalAtk}`,
        res.hadCrit ? 'crit' : 'damage',
        res.hadCrit ? 'CRITICAL!' : res.totalPierceDamage > 0 ? 'PIERCE' : undefined
      );

      // Apply Stagger & Heat
      if (res.totalStagger > 0 && d.enemyHp > 0) {
        d.enemyStagger += res.totalStagger;
        if (d.enemyStagger >= 100) {
          d.enemyStagger = 0;
          d.enemyStunned = true;
          d.arena.spawnFloatingNumber('enemy', 'STUNNED!', 'stun');
        }
      }
      if (res.totalHeat > 0 && d.enemyHp > 0) {
        d.enemyHeat += res.totalHeat;
      }

      this.syncDuelVisuals();
      await this.wait(360);
    }

    // 5. Searing Heat DoT tick on Enemy
    if (d.enemyHeat > 0 && d.enemyHp > 0) {
      d.enemyHp = Math.max(0, d.enemyHp - d.enemyHeat);
      d.arena.spawnFloatingNumber('enemy', `-${d.enemyHeat}`, 'heat', 'SEARING HEAT');
      d.enemyHeat = Math.max(0, Math.floor(d.enemyHeat * 0.72));
      this.syncDuelVisuals();
      await this.wait(240);
    }

    // Check Enemy Defeat!
    if (d.enemyHp <= 0) {
      await this.handleDuelVictory();
      return;
    }

    // 6. Enemy Telegraphed Turn
    if (statusEl) statusEl.textContent = d.enemyStunned ? 'FOE STAGGERED!' : 'ENEMY STRIKING...';
    if (d.enemyStunned) {
      d.enemyStunned = false;
      d.arena.spawnFloatingNumber('enemy', 'RECOVERING', 'stun');
      await this.wait(420);
    } else {
      const intent = this.getScaledIntent(d);
      if (intent.armor && intent.armor > 0) {
        d.enemyArmor += intent.armor;
        sfx.playShieldBlock();
        d.arena.spawnFloatingNumber('enemy', `+${intent.armor}`, 'block', 'ARMOR');
        this.syncDuelVisuals();
        await this.wait(240);
      }

      const hits = intent.hits ?? 1;
      const perHit = Math.max(0, Math.round(intent.damage * (1 - d.enemyWeakenedPct / 100)));
      if (perHit > 0) {
        for (let h = 0; h < hits; h++) {
          const isHeavy = intent.type === 'heavy' || intent.type === 'shatter';
          d.arena.triggerEnemyAttack(isHeavy);
          if (isHeavy) sfx.playHeavySlam();
          else sfx.playSwordSlash(false);
          await this.wait(165);

          let incoming = perHit;
          if (intent.type === 'shatter' && d.heroArmor > 0) {
            d.heroArmor = Math.floor(d.heroArmor * 0.5);
          }
          const blocked = Math.min(d.heroArmor, incoming);
          d.heroArmor -= blocked;
          const dmgToHp = incoming - blocked;
          run.hp = Math.max(0, run.hp - dmgToHp);

          if (dmgToHp > 0) {
            d.arena.triggerHeroHit(isHeavy);
            d.arena.spawnFloatingNumber('hero', `-${dmgToHp}`, 'damage');
          } else {
            sfx.playShieldBlock();
            d.arena.spawnFloatingNumber('hero', 'BLOCKED!', 'block');
          }

          // Counter-Parry reflection & Thorns retaliation!
          const counterDmg = Math.round(incoming * (d.heroReflectPct / 100)) + d.heroThorns;
          if (counterDmg > 0 && d.enemyHp > 0) {
            d.enemyHp = Math.max(0, d.enemyHp - counterDmg);
            d.arena.triggerEnemyHit(false);
            d.arena.spawnFloatingNumber('enemy', `-${counterDmg}`, 'damage', 'COUNTER');
          }

          this.syncDuelVisuals();
          await this.wait(280);
          if (run.hp <= 0 || d.enemyHp <= 0) break;
        }
      }
    }

    if (d.enemyHp <= 0) {
      await this.handleDuelVictory();
      return;
    }

    if (run.hp <= 0) {
      await this.handleRunDefeat();
      return;
    }

    // 7. End-of-turn Armor decay (respecting Steam Governor & Fortress Wall carryover)
    const bonuses = getRelicBonuses(run);
    if (!d.carryoverArmor) {
      d.heroArmor = Math.min(d.heroArmor, bonuses.retainArmorCap);
    }
    d.enemyWeakenedPct = 0;
    d.patternIdx += 1;
    d.turnNumber += 1;
    d.busy = false;
    this.syncDuelVisuals();

    if (statusEl) statusEl.textContent = `TURN ${d.turnNumber} • READY`;
    if (pullBtn) pullBtn.disabled = false;
    saveManager.save();
  }

  private async handleDuelVictory(): Promise<void> {
    const run = saveManager.data.activeRun!;
    const d = this.duel!;
    const enemyDef = ENEMIES[d.enemyId] ?? ENEMIES.enemy_pikeman;
    const bonuses = getRelicBonuses(run);

    sfx.playVictoryStamp();
    d.arena?.showComboBanner(enemyDef.isBoss ? 'ACT BOSS VANQUISHED!' : 'DUEL VICTORY!');
    await this.wait(720);

    const scrapGain = Math.round(enemyDef.scrapReward * (1 + bonuses.scrapBonusPct / 100));
    const ingotGain = Math.round(enemyDef.ingotReward * (1 + run.ascension * 0.25));
    run.scrap += scrapGain;
    run.ingotsEarned += ingotGain;
    saveManager.data.ingots += ingotGain;

    // Field Rations post-victory recovery
    const rationRank = saveManager.data.workshopRanks.field_rations || 0;
    const victoryHeal = Math.round(run.maxHp * (0.08 + rationRank * 0.04));
    run.hp = Math.min(run.maxHp, run.hp + victoryHeal);

    d.node.cleared = true;
    run.roomsClearedInRun += 1;
    saveManager.data.stats.totalWins += 1;

    if (enemyDef.isBoss) {
      saveManager.data.stats.bossesDefeated += 1;
      saveManager.data.stats.maxActCleared = Math.max(saveManager.data.stats.maxActCleared, run.actIndex + 1);
      if (run.actIndex >= BIOMES.length - 1) {
        // FULL 6-ACT EXPEDITION VICTORY!!
        saveManager.data.maxAscensionUnlocked = Math.min(5, Math.max(saveManager.data.maxAscensionUnlocked, run.ascension + 1));
        const biome = BIOMES[run.actIndex];
        this.summaryData = {
          victory: true,
          actName: biome.name,
          rooms: run.roomsClearedInRun,
          ingots: run.ingotsEarned,
          reason: 'You conquered the Grand Vanguard Sovereign and mastered all six acts of the Sovereign Iron Citadel!'
        };
        saveManager.data.activeRun = null;
        saveManager.save();
        this.duel = null;
        await nativeBridge.maybeShowInterstitial(saveManager.data.removeAdsOwned);
        this.goTo('summary');
        return;
      }
    }

    run.pendingDraft = buildRewardDraft(run, Boolean(enemyDef.isElite || enemyDef.isBoss), Boolean(enemyDef.isBoss));
    run.pendingPhase = 'draft';
    saveManager.save();
    this.duel = null;
    this.goTo('draft');
  }

  private async handleRunDefeat(): Promise<void> {
    const run = saveManager.data.activeRun!;
    const biome = BIOMES[run.actIndex] ?? BIOMES[0];
    sfx.playHeavySlam();
    this.duel?.arena?.showComboBanner('VANGUARD FALLEN');
    await this.wait(780);

    this.summaryData = {
      victory: false,
      actName: `${biome.actNumeral}: ${biome.name}`,
      rooms: run.roomsClearedInRun,
      ingots: run.ingotsEarned,
      reason: 'Your armor gave way in the depths, yet your salvaged Sun-Brass Ingots have returned safely to the Citadel Workshop.'
    };
    saveManager.data.activeRun = null;
    saveManager.save();
    this.duel = null;
    await nativeBridge.maybeShowInterstitial(saveManager.data.removeAdsOwned);
    this.goTo('summary');
  }

  // ==================== 4. POST-DUEL REWARD DRAFT ====================
  private renderDraftScreen(): void {
    const run = saveManager.data.activeRun;
    if (!run || !run.pendingDraft) {
      this.goTo('map');
      return;
    }
    const draft = run.pendingDraft;
    const root = document.getElementById('screen-root')!;

    const symCards = draft.symbols
      .map((sid) => {
        const s = SYMBOLS[sid];
        if (!s) return '';
        const hasDup = run.deck.some((d) => d.symbolId === sid && d.tier < 4);
        return `
          <button class="symbol-card" data-draft-sym="${sid}">
            <div class="symbol-card-head">
              <img src="./assets/symbols/${sid}.png" class="symbol-thumb" alt="" />
              <div style="min-width:0;">
                <div class="ui-label" style="font-size:11.5px;">${s.name}</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
                  <span class="tier-pill">${s.category.toUpperCase()}</span>
                  ${hasDup ? '<span class="merge-ready-pill">MERGE READY!</span>' : ''}
                </div>
              </div>
            </div>
            <div class="ui-label" style="font-size:10.5px;color:var(--ink-accent);">${getSymbolDisplaySummary(sid, 1)}</div>
            <p class="prose-justified" style="font-size:12.5px;">${s.description}</p>
          </button>
        `;
      })
      .join('');

    const relicCards = draft.relics
      .map((rid) => {
        const r = RELICS.find((x) => x.id === rid);
        if (!r) return '';
        return `
          <button class="symbol-card" data-draft-relic="${rid}" style="border-color:#E8B744;">
            <div class="symbol-card-head">
              <img src="./assets/symbols/${r.iconSymbolId}.png" class="symbol-thumb" alt="" />
              <div>
                <div class="ui-label" style="font-size:11.5px;color:var(--ink-accent);">CLOCKWORK RELIC</div>
                <div class="ui-label" style="font-size:12.5px;">${r.name}</div>
              </div>
            </div>
            <p class="prose-justified" style="font-size:12.5px;">${r.description}</p>
          </button>
        `;
      })
      .join('');

    root.innerHTML = `
      <div class="screen-scroll">
        <div class="ornate-panel" style="text-align:center;">
          <div class="ui-label" style="font-size:10.5px;color:var(--ink-accent);">VICTORY SALVAGE</div>
          <h2 class="title-engraved" style="font-size:19px;">DRAFT YOUR UPGRADE</h2>
          <p class="prose-justified" style="margin-top:4px;">
            Choose one new Action Symbol to load onto your 3x3 Clockwork Console drums, claim a probability-shaping Clockwork Relic, or convert the salvage into Forge Scrap.
          </p>
        </div>

        <div class="card-grid-2">${symCards}</div>

        ${relicCards ? `<div class="ui-label" style="font-size:11px;color:var(--ink-accent);">OR CLAIM A CLOCKWORK RELIC CORE</div>${relicCards}` : ''}

        <button class="gb-btn gb-btn-iron gb-btn-sm" data-draft-scrap>
          SKIP & TAKE +${draft.bonusScrap} FORGE SCRAP
        </button>
      </div>
    `;

    const finishDraft = () => {
      const wasBoss = draft.wasBoss;
      run.pendingDraft = undefined;
      if (wasBoss) {
        run.pendingPhase = 'act_clear';
        saveManager.save();
        this.goTo('act_clear');
      } else {
        run.pendingPhase = 'map';
        saveManager.save();
        this.goTo('map');
      }
    };

    root.querySelectorAll('[data-draft-sym]').forEach((b) => {
      b.addEventListener('click', () => {
        const sid = b.getAttribute('data-draft-sym')!;
        sfx.playForgeMerge();
        run.deck.push({ uid: nextUid('sym'), symbolId: sid, tier: 1 });
        this.showToast(`Added ${SYMBOLS[sid]?.name ?? sid} to your 3x3 Drum Pool!`);
        finishDraft();
      });
    });
    root.querySelectorAll('[data-draft-relic]').forEach((b) => {
      b.addEventListener('click', () => {
        const rid = b.getAttribute('data-draft-relic')!;
        sfx.playVictoryStamp();
        addRelicToRun(run, rid);
        const r = RELICS.find((x) => x.id === rid);
        this.showToast(`Equipped Relic: ${r?.name ?? rid}!`);
        finishDraft();
      });
    });
    root.querySelector('[data-draft-scrap]')?.addEventListener('click', () => {
      sfx.playTap();
      run.scrap += draft.bonusScrap;
      this.showToast(`Salvaged +${draft.bonusScrap} Forge Scrap.`);
      finishDraft();
    });
  }

  // ==================== 5. ANVIL FORGE (MERGE, UPGRADE, PURGE) ====================
  private renderForgeScreen(): void {
    const run = saveManager.data.activeRun;
    if (!run) {
      this.goTo('hub');
      return;
    }
    const root = document.getElementById('screen-root')!;
    const mergeGroups = getMergeableGroups(run.deck);

    const mergeHtml =
      mergeGroups.length > 0
        ? mergeGroups
            .map((g) => {
              const def = SYMBOLS[g.symbolId];
              return `
                <div class="ornate-subcard" style="display:flex;align-items:center;gap:10px;border-color:#268C4E;">
                  <img src="./assets/symbols/${g.symbolId}.png" class="symbol-thumb" style="width:44px;height:44px;" alt="" />
                  <div style="flex:1;">
                    <div class="ui-label" style="font-size:12px;">${def?.name}</div>
                    <div style="font-size:12px;color:var(--ink-secondary);">Combine 2× ${TIER_NAMES[g.tier]} → <strong style="color:var(--ink-accent);">${TIER_NAMES[(g.tier + 1) as 2 | 3 | 4]}</strong></div>
                  </div>
                  <button class="gb-btn gb-btn-emerald gb-btn-sm" data-merge="${g.symbolId}::${g.tier}">MERGE FREE</button>
                </div>
              `;
            })
            .join('')
        : `<div class="ornate-subcard" style="text-align:center;font-size:13px;color:var(--ink-secondary);">No duplicate same-tier symbols available to merge yet. Draft duplicates to forge Masterwork Gold IV!</div>`;

    const upgradeCost = 35;
    const purgeCost = 25;
    const deckHtml = run.deck
      .map((item) => {
        const def = SYMBOLS[item.symbolId];
        const canUpg = item.tier < 4 && run.scrap >= upgradeCost;
        const canPurge = run.deck.length > 9 && run.scrap >= purgeCost;
        return `
          <div class="ornate-subcard" style="display:flex;align-items:center;gap:8px;padding:8px;">
            <img src="./assets/symbols/${item.symbolId}.png" class="symbol-thumb" style="width:38px;height:38px;flex:0 0 38px;" alt="" />
            <div style="flex:1;min-width:0;">
              <div class="ui-label" style="font-size:11px;">${def?.name} <span class="tier-pill">${TIER_NAMES[item.tier]}</span></div>
              <div style="font-size:11.5px;color:var(--ink-secondary);">${getSymbolDisplaySummary(item.symbolId, item.tier)}</div>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="gb-btn gb-btn-brass gb-btn-sm" style="padding:4px 8px;font-size:10px;" data-upg="${item.uid}" ${canUpg ? '' : 'disabled'}>
                ${item.tier >= 4 ? 'MAX' : `▲ ${upgradeCost}`}
              </button>
              <button class="gb-btn gb-btn-crimson gb-btn-sm" style="padding:4px 8px;font-size:10px;" data-purge="${item.uid}" ${canPurge ? '' : 'disabled'}>
                ✕ ${purgeCost}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    root.innerHTML = `
      <div class="screen-scroll">
        <div class="ornate-panel">
          <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">ARTISAN ANVIL FORGE • SCRAP: ${run.scrap}</div>
          <h2 class="title-engraved" style="font-size:18px;">MERGE, TEMPER & PRUNE</h2>
          <p class="prose-justified" style="font-size:13px;margin-top:4px;">
            Fuse duplicate tiles for free into higher metallic tiers, spend Forge Scrap to temper single symbols, or prune weak pieces to tighten your 3x3 alignment odds.
          </p>
        </div>

        <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">DUPLICATE MERGES (FREE)</div>
        ${mergeHtml}

        <div class="ui-label" style="font-size:11px;color:var(--ink-accent);margin-top:4px;">TEMPER (${upgradeCost} SCRAP) OR PURGE (${purgeCost} SCRAP)</div>
        ${deckHtml}

        <button class="gb-btn gb-btn-brass gb-btn-lg" data-leave-forge>RETURN TO EXPEDITION MAP</button>
      </div>
    `;

    root.querySelectorAll('[data-merge]').forEach((b) => {
      b.addEventListener('click', () => {
        const [sid, t] = b.getAttribute('data-merge')!.split('::');
        const merged = mergeDuplicateSymbols(run, sid, Number(t) as 1 | 2 | 3);
        if (merged) {
          sfx.playForgeMerge();
          void nativeBridge.haptic('heavy');
          this.showToast(`Forged ${SYMBOLS[sid]?.name} → ${TIER_NAMES[merged.tier]}!`);
          this.renderForgeScreen();
        }
      });
    });

    root.querySelectorAll('[data-upg]').forEach((b) => {
      b.addEventListener('click', () => {
        const uid = b.getAttribute('data-upg')!;
        const item = run.deck.find((x) => x.uid === uid);
        if (!item || item.tier >= 4 || run.scrap < upgradeCost) return;
        run.scrap -= upgradeCost;
        item.tier = (item.tier + 1) as 2 | 3 | 4;
        if (item.tier === 4) saveManager.data.stats.tier4Forged += 1;
        saveManager.save();
        sfx.playForgeMerge();
        this.showToast(`Tempered ${SYMBOLS[item.symbolId]?.name} to ${TIER_NAMES[item.tier]}!`);
        this.renderForgeScreen();
      });
    });

    root.querySelectorAll('[data-purge]').forEach((b) => {
      b.addEventListener('click', () => {
        const uid = b.getAttribute('data-purge')!;
        if (run.deck.length <= 9 || run.scrap < purgeCost) return;
        run.scrap -= purgeCost;
        run.deck = run.deck.filter((x) => x.uid !== uid);
        saveManager.save();
        sfx.playTap();
        this.showToast('Pruned tile from your 3x3 Drum Pool.');
        this.renderForgeScreen();
      });
    });

    root.querySelector('[data-leave-forge]')?.addEventListener('click', () => {
      sfx.playTap();
      run.pendingPhase = 'map';
      saveManager.save();
      this.goTo('map');
    });
  }

  // ==================== 6. FIELD CAMP, SUPPLY CHEST, MERCHANT, ACT CLEAR, SUMMARY ====================
  private renderCampScreen(): void {
    const run = saveManager.data.activeRun!;
    const root = document.getElementById('screen-root')!;
    const rationRank = saveManager.data.workshopRanks.field_rations || 0;
    const healAmt = Math.round(run.maxHp * (0.42 + rationRank * 0.06));

    root.innerHTML = `
      <div class="screen-scroll">
        <div class="ornate-panel">
          <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">SHELTERED EXPEDITION CAMP</div>
          <h2 class="title-engraved" style="font-size:19px;">FIELD REPAIR & REST</h2>
          <p class="prose-justified" style="margin-top:6px;">
            Take shelter beside a warm iron brazier to patch dented armor plates, reinforce your Vanguard frame, or request an aerial supply drop.
          </p>
        </div>

        <button class="gb-btn gb-btn-emerald gb-btn-lg" data-camp-heal>
          ✚ REPAIR HULL (+${healAmt} HP)
        </button>
        <button class="gb-btn gb-btn-brass gb-btn-lg" data-camp-hull>
          🛡 REINFORCE PLATING (+12 MAX HP & +12 HP)
        </button>
        <button class="gb-btn gb-btn-iron gb-btn-lg" data-camp-ad>
          ★ WATCH REWARDED AD: FULL 100% REPAIR + 35 SCRAP
        </button>
      </div>
    `;

    const leave = () => {
      run.pendingPhase = 'map';
      saveManager.save();
      this.goTo('map');
    };
    root.querySelector('[data-camp-heal]')?.addEventListener('click', () => {
      sfx.playRepairKit();
      run.hp = Math.min(run.maxHp, run.hp + healAmt);
      this.showToast(`Repaired +${healAmt} HP at Field Camp.`);
      leave();
    });
    root.querySelector('[data-camp-hull]')?.addEventListener('click', () => {
      sfx.playForgeMerge();
      run.maxHp += 12;
      run.hp = Math.min(run.maxHp, run.hp + 12);
      this.showToast('Max HP permanently increased by +12 for this run!');
      leave();
    });
    root.querySelector('[data-camp-ad]')?.addEventListener('click', async () => {
      sfx.playTap();
      await nativeBridge.showRewardedAd(() => {
        sfx.playVictoryStamp();
        run.hp = run.maxHp;
        run.scrap += 35;
        this.showToast('Full Repair & +35 Forge Scrap delivered!');
        leave();
      });
    });
  }

  private renderChestScreen(): void {
    const run = saveManager.data.activeRun!;
    const root = document.getElementById('screen-root')!;
    const unowned = RELICS.filter((r) => !run.relicIds.includes(r.id));
    const relic = unowned[Math.floor(Math.random() * unowned.length)] ?? RELICS[0];
    const scrapBonus = 32 + run.actIndex * 8;

    root.innerHTML = `
      <div class="screen-scroll">
        <div class="ornate-panel" style="text-align:center;">
          <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">ANCIENT SUPPLY VAULT</div>
          <h2 class="title-engraved" style="font-size:19px;">CLOCKWORK RELIC CHEST</h2>
          <img src="./assets/symbols/${relic.iconSymbolId}.png" style="width:76px;height:76px;border-radius:14px;border:2px solid var(--brass-bright);margin:10px auto;display:block;" alt="" />
          <div class="ui-label" style="font-size:15px;color:var(--ink-accent);">${relic.name}</div>
          <p class="prose-justified" style="margin-top:6px;">${relic.description}</p>
          <div class="hud-pill" style="margin-top:10px;">+ ${scrapBonus} FORGE SCRAP</div>
        </div>
        <button class="gb-btn gb-btn-brass gb-btn-lg" data-claim-chest>CLAIM RELIC & CONTINUE</button>
      </div>
    `;

    root.querySelector('[data-claim-chest]')?.addEventListener('click', () => {
      sfx.playVictoryStamp();
      addRelicToRun(run, relic.id);
      run.scrap += scrapBonus;
      run.pendingPhase = 'map';
      saveManager.save();
      this.showToast(`Claimed ${relic.name} & +${scrapBonus} Scrap!`);
      this.goTo('map');
    });
  }

  private renderMerchantScreen(): void {
    const run = saveManager.data.activeRun!;
    const root = document.getElementById('screen-root')!;
    const symOffers = [...SYMBOL_LIST].sort(() => Math.random() - 0.5).slice(0, 4);
    const relicOffer = RELICS.filter((r) => !run.relicIds.includes(r.id)).sort(() => Math.random() - 0.5)[0];

    const renderList = () => {
      root.innerHTML = `
        <div class="screen-scroll">
          <div class="ornate-panel">
            <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">EXPEDITION ARTISAN TRADER • SCRAP: ${run.scrap}</div>
            <h2 class="title-engraved" style="font-size:18px;">CLOCKWORK BAZAAR</h2>
            <p class="prose-justified" style="font-size:13px;margin-top:4px;">
              Exchange salvaged Forge Scrap for calibrated action tiles, probability cores, and emergency repair kits.
            </p>
          </div>

          <div class="card-grid-2">
            ${symOffers
              .map((s) => {
                const cost = s.rarity === 'masterwork' ? 75 : s.rarity === 'rare' ? 55 : 35;
                return `
                  <button class="symbol-card" data-buy-sym="${s.id}::${cost}" ${run.scrap < cost ? 'disabled' : ''}>
                    <div class="symbol-card-head">
                      <img src="./assets/symbols/${s.id}.png" class="symbol-thumb" style="width:38px;height:38px;flex:0 0 38px;" alt="" />
                      <div style="min-width:0;">
                        <div class="ui-label" style="font-size:11px;">${s.name}</div>
                        <span class="tier-pill">${cost} SCRAP</span>
                      </div>
                    </div>
                    <div style="font-size:11.5px;color:var(--ink-secondary);">${getSymbolDisplaySummary(s.id, 1)}</div>
                  </button>
                `;
              })
              .join('')}
          </div>

          ${
            relicOffer && !run.relicIds.includes(relicOffer.id)
              ? `<button class="symbol-card" data-buy-rel="${relicOffer.id}" ${run.scrap < 80 ? 'disabled' : ''}>
                   <div class="symbol-card-head">
                     <img src="./assets/symbols/${relicOffer.iconSymbolId}.png" class="symbol-thumb" alt="" />
                     <div>
                       <div class="ui-label" style="font-size:12px;">RELIC: ${relicOffer.name}</div>
                       <span class="tier-pill">80 SCRAP</span>
                     </div>
                   </div>
                   <p class="prose-justified" style="font-size:12.5px;">${relicOffer.description}</p>
                 </button>`
              : ''
          }

          <button class="gb-btn gb-btn-brass gb-btn-lg" data-leave-merch>CONTINUE EXPEDITION</button>
        </div>
      `;

      root.querySelectorAll('[data-buy-sym]').forEach((b) => {
        b.addEventListener('click', () => {
          const [sid, cStr] = b.getAttribute('data-buy-sym')!.split('::');
          const cost = Number(cStr);
          if (run.scrap < cost) return;
          run.scrap -= cost;
          run.deck.push({ uid: nextUid('sym'), symbolId: sid, tier: 1 });
          saveManager.save();
          sfx.playForgeMerge();
          this.showToast(`Purchased ${SYMBOLS[sid]?.name}!`);
          this.renderTopHud();
          renderList();
        });
      });

      root.querySelector('[data-buy-rel]')?.addEventListener('click', () => {
        if (!relicOffer || run.scrap < 80) return;
        run.scrap -= 80;
        addRelicToRun(run, relicOffer.id);
        sfx.playVictoryStamp();
        this.showToast(`Purchased Relic: ${relicOffer.name}!`);
        this.renderTopHud();
        renderList();
      });

      root.querySelector('[data-leave-merch]')?.addEventListener('click', () => {
        sfx.playTap();
        run.pendingPhase = 'map';
        saveManager.save();
        this.goTo('map');
      });
    };
    renderList();
  }

  private renderActClearScreen(): void {
    const run = saveManager.data.activeRun!;
    const clearedBiome = BIOMES[run.actIndex] ?? BIOMES[0];
    const nextBiome = BIOMES[run.actIndex + 1] ?? BIOMES[BIOMES.length - 1];
    const root = document.getElementById('screen-root')!;

    root.innerHTML = `
      <div class="screen-scroll" style="justify-content:center;">
        <div class="ornate-panel" style="text-align:center;">
          <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">${clearedBiome.actNumeral} CONQUERED</div>
          <h2 class="title-engraved" style="font-size:21px;margin:4px 0;">${clearedBiome.name}</h2>
          <p class="prose-justified" style="margin:8px 0;">
            The mechanical seal gives way! Your Vanguard restores 50% HP before marching onward into <strong>${nextBiome.actNumeral}: ${nextBiome.name}</strong>.
          </p>
          <img src="${nextBiome.bgFile}" style="width:100%;height:140px;object-fit:cover;border-radius:10px;border:2px solid var(--brass-border);margin:8px 0;" alt="" />
          <p class="prose-justified" style="font-size:13px;">${nextBiome.narrative}</p>
        </div>
        <button class="gb-btn gb-btn-brass gb-btn-lg" data-enter-next-act>
          ENTER ${nextBiome.actNumeral}: ${nextBiome.name.toUpperCase()}
        </button>
      </div>
    `;

    root.querySelector('[data-enter-next-act]')?.addEventListener('click', async () => {
      sfx.playLeverPull();
      await nativeBridge.maybeShowInterstitial(saveManager.data.removeAdsOwned);
      run.actIndex += 1;
      run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.5));
      run.mapNodes = generateActMap(run.actIndex);
      run.currentNodeId = null;
      run.pendingPhase = 'map';
      saveManager.save();
      this.goTo('map');
    });
  }

  private renderSummaryScreen(): void {
    const sum = this.summaryData;
    const root = document.getElementById('screen-root')!;
    if (!sum) {
      this.goTo('hub');
      return;
    }

    root.innerHTML = `
      <div class="screen-scroll" style="justify-content:center;">
        <div class="ornate-panel" style="text-align:center;">
          <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">${sum.victory ? 'GRAND EXPEDITION VICTORY' : 'EXPEDITION CHRONICLE'}</div>
          <h2 class="title-engraved" style="font-size:22px;margin:4px 0;">${sum.victory ? 'CITADEL CONQUERED!' : 'RETURN TO CITADEL'}</h2>
          <p class="prose-justified" style="margin:8px 0;">${sum.reason}</p>
          <div class="divider-brass"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <div class="ornate-subcard">
              <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">REACHED</div>
              <div class="ui-label" style="font-size:12px;">${sum.actName}</div>
            </div>
            <div class="ornate-subcard">
              <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">SALVAGED</div>
              <div class="ui-label" style="font-size:14px;">+${sum.ingots} INGOTS</div>
            </div>
          </div>
        </div>

        <button class="gb-btn gb-btn-brass gb-btn-lg" data-sum-workshop>UPGRADE IN CITADEL WORKSHOP</button>
        <button class="gb-btn gb-btn-iron gb-btn-lg" data-sum-home>RETURN TO HUB</button>
      </div>
    `;

    root.querySelector('[data-sum-workshop]')?.addEventListener('click', () => {
      sfx.playTap();
      this.goTo('hub');
      openWorkshopModal(this.modalCtx);
    });
    root.querySelector('[data-sum-home]')?.addEventListener('click', () => {
      sfx.playTap();
      this.goTo('hub');
    });
  }
}

const app = new GearboundApp();
void app.boot();

// Clean modal close on hardware/escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
