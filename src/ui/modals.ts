import {
  ACHIEVEMENTS,
  DAILY_REWARDS,
  ENEMIES,
  HERO_CLASSES,
  OwnedSymbol,
  RELICS,
  SYMBOL_LIST,
  SYMBOLS,
  TIER_NAMES,
  WORKSHOP_UPGRADES
} from '../data/gameData';
import { MONETIZATION_CONFIG } from '../config/monetization';
import { sfx } from '../audio/sfxEngine';
import { nativeBridge } from '../platform/nativeBridge';
import { ActiveRunState, saveManager } from '../engine/saveSystem';
import { getRelicBonuses } from '../engine/combatMath';
import { getSymbolDisplaySummary } from '../engine/runEngine';

export interface ModalContext {
  onStateChanged: () => void;
  showToast: (msg: string) => void;
}

function getModalRoot(): HTMLElement {
  return document.getElementById('modal-root')!;
}

export function closeModal(): void {
  const root = getModalRoot();
  root.classList.add('hidden');
  root.innerHTML = '';
}

function openModal(title: string, bodyHtml: string, onBind?: (sheet: HTMLElement) => void): void {
  const root = getModalRoot();
  root.classList.remove('hidden');
  root.innerHTML = `
    <div class="ornate-panel modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="title-engraved" style="font-size:17px;">${title}</h2>
        <button class="hud-icon-btn" data-close-modal aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  const sheet = root.querySelector('.modal-sheet') as HTMLElement;
  root.onclick = (e) => {
    if (e.target === root) {
      sfx.playTap();
      closeModal();
    }
  };
  sheet.querySelector('[data-close-modal]')?.addEventListener('click', () => {
    sfx.playTap();
    closeModal();
  });
  if (onBind) onBind(sheet);
}

export function openSettingsModal(ctx: ModalContext): void {
  const s = saveManager.data.settings;
  const owned = saveManager.data.removeAdsOwned;

  const html = `
    <div class="setting-row">
      <div>
        <div class="ui-label" style="font-size:12px;">CHRONICLE THEME</div>
        <div style="font-size:13px;color:var(--ink-secondary);">Sunlit Parchment (Light) or Obsidian Foundry (Dark)</div>
      </div>
      <button class="gb-btn gb-btn-brass gb-btn-sm" data-toggle-theme>
        ${s.theme === 'light' ? '☀ LIGHT' : '☾ DARK'}
      </button>
    </div>

    <div class="setting-row">
      <div>
        <div class="ui-label" style="font-size:12px;">MECHANICAL SFX</div>
        <div style="font-size:13px;color:var(--ink-secondary);">Non-musical lever, gear, steel & forge Foley</div>
      </div>
      <button class="gb-btn ${s.sfxEnabled ? 'gb-btn-emerald' : 'gb-btn-iron'} gb-btn-sm" data-toggle-sfx>
        ${s.sfxEnabled ? 'ON' : 'OFF'}
      </button>
    </div>

    <div class="setting-row">
      <div>
        <div class="ui-label" style="font-size:12px;">HALL AMBIENCE</div>
        <div style="font-size:13px;color:var(--ink-secondary);">Subtle non-musical wind & stone chamber air</div>
      </div>
      <button class="gb-btn ${s.ambienceEnabled ? 'gb-btn-emerald' : 'gb-btn-iron'} gb-btn-sm" data-toggle-amb>
        ${s.ambienceEnabled ? 'ON' : 'OFF'}
      </button>
    </div>

    <div class="setting-row">
      <div>
        <div class="ui-label" style="font-size:12px;">TACTILE HAPTICS</div>
        <div style="font-size:13px;color:var(--ink-secondary);">Vibration feedback on lever pull & drum lock</div>
      </div>
      <button class="gb-btn ${s.hapticsEnabled ? 'gb-btn-emerald' : 'gb-btn-iron'} gb-btn-sm" data-toggle-hap>
        ${s.hapticsEnabled ? 'ON' : 'OFF'}
      </button>
    </div>

    <div class="setting-row">
      <div>
        <div class="ui-label" style="font-size:12px;">DEFAULT CONSOLE SPEED</div>
        <div style="font-size:13px;color:var(--ink-secondary);">Normal 1x cadence or Fast 2x mechanical tempo</div>
      </div>
      <button class="gb-btn gb-btn-brass gb-btn-sm" data-toggle-speed>
        ${s.speedMultiplier}X SPEED
      </button>
    </div>

    <div class="divider-brass"></div>

    <div class="ornate-subcard">
      <div class="ui-label" style="font-size:13px;margin-bottom:4px;">REMOVE ADS — ${MONETIZATION_CONFIG.iap.displayPriceUsd}</div>
      <p class="prose-justified" style="margin-bottom:8px;">${MONETIZATION_CONFIG.iap.description}</p>
      <div style="display:flex;gap:8px;">
        <button class="gb-btn gb-btn-brass gb-btn-sm" style="flex:1;" data-buy-remove-ads ${owned ? 'disabled' : ''}>
          ${owned ? '✓ AD-FREE ACTIVE' : `UNLOCK ${MONETIZATION_CONFIG.iap.displayPriceUsd}`}
        </button>
        <button class="gb-btn gb-btn-iron gb-btn-sm" data-restore-iap>RESTORE</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px;">
      <button class="gb-btn gb-btn-iron gb-btn-sm" data-open-about>ABOUT & F7</button>
      <button class="gb-btn gb-btn-crimson gb-btn-sm" data-reset-save>RESET SAVE</button>
    </div>
  `;

  openModal('SETTINGS & WORKSHOP PREFS', html, (sheet) => {
    sheet.querySelector('[data-toggle-theme]')?.addEventListener('click', () => {
      sfx.playTap();
      s.theme = s.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', s.theme);
      void nativeBridge.applyStatusBarTheme(s.theme);
      saveManager.save();
      ctx.onStateChanged();
      openSettingsModal(ctx);
    });
    sheet.querySelector('[data-toggle-sfx]')?.addEventListener('click', () => {
      s.sfxEnabled = !s.sfxEnabled;
      sfx.configure(s.sfxEnabled, s.ambienceEnabled);
      if (s.sfxEnabled) sfx.playTap();
      saveManager.save();
      openSettingsModal(ctx);
    });
    sheet.querySelector('[data-toggle-amb]')?.addEventListener('click', () => {
      sfx.playTap();
      s.ambienceEnabled = !s.ambienceEnabled;
      sfx.configure(s.sfxEnabled, s.ambienceEnabled);
      saveManager.save();
      openSettingsModal(ctx);
    });
    sheet.querySelector('[data-toggle-hap]')?.addEventListener('click', () => {
      sfx.playTap();
      s.hapticsEnabled = !s.hapticsEnabled;
      nativeBridge.setHapticsEnabled(s.hapticsEnabled);
      saveManager.save();
      openSettingsModal(ctx);
    });
    sheet.querySelector('[data-toggle-speed]')?.addEventListener('click', () => {
      sfx.playTap();
      s.speedMultiplier = s.speedMultiplier === 1 ? 2 : 1;
      saveManager.save();
      ctx.onStateChanged();
      openSettingsModal(ctx);
    });
    sheet.querySelector('[data-buy-remove-ads]')?.addEventListener('click', async () => {
      sfx.playTap();
      const res = await nativeBridge.purchaseRemoveAds();
      if (res.purchased) {
        saveManager.data.removeAdsOwned = true;
        saveManager.save();
        ctx.showToast(res.message);
        ctx.onStateChanged();
        openSettingsModal(ctx);
      } else {
        ctx.showToast(res.message);
      }
    });
    sheet.querySelector('[data-restore-iap]')?.addEventListener('click', async () => {
      sfx.playTap();
      const restored = await nativeBridge.restorePurchases();
      if (restored) {
        saveManager.data.removeAdsOwned = true;
        saveManager.save();
        ctx.showToast('Previous Remove Ads purchase restored!');
        ctx.onStateChanged();
        openSettingsModal(ctx);
      } else {
        ctx.showToast('No previous Remove Ads entitlement found.');
      }
    });
    sheet.querySelector('[data-open-about]')?.addEventListener('click', () => {
      sfx.playTap();
      openAboutModal(ctx);
    });
    sheet.querySelector('[data-reset-save]')?.addEventListener('click', () => {
      sfx.playTap();
      if (confirm('Reset all expedition progress, ingots, and workshop upgrades? Remove Ads purchase will be preserved.')) {
        saveManager.resetProgress();
        ctx.showToast('Chronicle save reset.');
        closeModal();
        ctx.onStateChanged();
      }
    });
  });
}

export function openAboutModal(ctx: ModalContext): void {
  const html = `
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="./assets/ui/app_icon_master.png" alt="Gearbound" class="hub-app-emblem" style="width:60px;height:60px;" />
      <div>
        <div class="title-engraved" style="font-size:18px;">GEARBOUND</div>
        <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">F7 DEVELOPER • VERSION 1.0.0</div>
      </div>
    </div>
    <p class="prose-justified">
      Gearbound is an offline-first medieval-clockwork roguelike dungeon duel engineered by F7 Developer. Operate the 3x3 Clockwork Combat Console, forge overlapping symbol synergies, calibrate probability cores, and ascend six handcrafted dungeon biomes without casino mechanics, paid loot boxes, or mandatory connectivity.
    </p>
    <div class="ornate-subcard" style="display:flex;align-items:center;gap:10px;">
      <img src="./assets/brand/f7_mark.svg" alt="F7 Developer" style="width:38px;height:38px;background:#07060C;padding:5px;border-radius:8px;border:1.5px solid var(--brass-border);" />
      <div>
        <div class="ui-label" style="font-size:11.5px;">CRAFTED BY F7 DEVELOPER</div>
        <div style="font-size:13px;color:var(--ink-secondary);">Package: ${MONETIZATION_CONFIG.store.packageId}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="gb-btn gb-btn-brass gb-btn-sm" data-rate-app>★ RATE APP</button>
      <button class="gb-btn gb-btn-emerald gb-btn-sm" data-share-app>↗ SHARE</button>
    </div>
    <button class="gb-btn gb-btn-iron gb-btn-sm" data-replay-tutorial>REPLAY EXPEDITION BRIEFING</button>
  `;
  openModal('ABOUT GEARBOUND', html, (sheet) => {
    sheet.querySelector('[data-rate-app]')?.addEventListener('click', () => {
      sfx.playTap();
      nativeBridge.openRatePage();
      ctx.showToast('Opening Google Play listing...');
    });
    sheet.querySelector('[data-share-app]')?.addEventListener('click', async () => {
      sfx.playTap();
      await nativeBridge.shareApp();
      ctx.showToast('Expedition link ready to share!');
    });
    sheet.querySelector('[data-replay-tutorial]')?.addEventListener('click', () => {
      sfx.playTap();
      openOnboardingModal(ctx);
    });
  });
}

export function openDailyRewardsModal(ctx: ModalContext): void {
  const canClaim = saveManager.canClaimDaily();
  const currentDay = saveManager.data.dailyStreakDay;
  const cells = DAILY_REWARDS.map((d) => {
    const isToday = d.day === currentDay;
    const isPast = d.day < currentDay;
    return `
      <div class="ornate-subcard" style="padding:8px;text-align:center;${isToday ? 'border-color:#F0BE49;background:rgba(240,190,73,0.22);' : ''}${isPast ? 'opacity:0.55;' : ''}">
        <div class="ui-label" style="font-size:10px;color:var(--ink-accent);">DAY ${d.day}</div>
        <div class="ui-label" style="font-size:15px;margin:2px 0;">+${d.ingots}</div>
        <div style="font-size:11px;color:var(--ink-secondary);">Ingots</div>
      </div>
    `;
  }).join('');

  const html = `
    <p class="prose-justified">
      Report to the Citadel Quartermaster once each day to collect Sun-Brass Ingots for permanent Vanguard hull armor, drum clamps, and class unlocks.
    </p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">${cells}</div>
    <button class="gb-btn gb-btn-brass gb-btn-lg" data-claim-daily ${canClaim ? '' : 'disabled'}>
      ${canClaim ? `CLAIM DAY ${currentDay} SUPPLY` : 'ALREADY CLAIMED TODAY'}
    </button>
  `;
  openModal('DAILY QUARTERMASTER SUPPLIES', html, (sheet) => {
    sheet.querySelector('[data-claim-daily]')?.addEventListener('click', () => {
      const res = saveManager.claimDaily();
      if (res) {
        sfx.playForgeMerge();
        ctx.showToast(`Claimed Day ${res.day}: +${res.ingots} Sun-Brass Ingots!`);
        ctx.onStateChanged();
        openDailyRewardsModal(ctx);
      }
    });
  });
}

export function openOfflinePatrolModal(ctx: ModalContext): void {
  const p = saveManager.getOfflinePatrolPreview();
  const hrs = Math.floor(p.minutes / 60);
  const mins = p.minutes % 60;
  const html = `
    <p class="prose-justified">
      While you are away, automated Vanguard clockwork scouts patrol cleared dungeon passages and salvage Sun-Brass Ingots for up to 12 hours offline.
    </p>
    <div class="ornate-subcard" style="text-align:center;padding:14px;">
      <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">OFFLINE PATROL DURATION ${p.capped ? '(MAX 12H)' : ''}</div>
      <div class="title-engraved" style="font-size:26px;margin:4px 0;">${hrs}h ${mins}m</div>
      <div class="ui-label" style="font-size:15px;color:var(--ink-primary);">SALVAGED: +${p.ingots} SUN-BRASS INGOTS</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="gb-btn gb-btn-brass gb-btn-sm" data-claim-1x ${p.ingots <= 0 ? 'disabled' : ''}>
        CLAIM +${p.ingots}
      </button>
      <button class="gb-btn gb-btn-emerald gb-btn-sm" data-claim-2x ${p.ingots <= 0 ? 'disabled' : ''}>
        WATCH AD (2X: +${p.ingots * 2})
      </button>
    </div>
  `;
  openModal('OFFLINE EXPEDITION PATROL', html, (sheet) => {
    sheet.querySelector('[data-claim-1x]')?.addEventListener('click', () => {
      const gained = saveManager.claimOfflinePatrol(1);
      if (gained > 0) {
        sfx.playForgeMerge();
        ctx.showToast(`Collected +${gained} Sun-Brass Ingots!`);
        ctx.onStateChanged();
        closeModal();
      }
    });
    sheet.querySelector('[data-claim-2x]')?.addEventListener('click', async () => {
      sfx.playTap();
      await nativeBridge.showRewardedAd(() => {
        const gained = saveManager.claimOfflinePatrol(2);
        sfx.playForgeMerge();
        ctx.showToast(`Double Patrol Bonus: +${gained} Sun-Brass Ingots!`);
        ctx.onStateChanged();
        closeModal();
      });
    });
  });
}

export function openAchievementsModal(ctx: ModalContext): void {
  const rows = ACHIEVEMENTS.map((a) => {
    const val = saveManager.data.stats[a.statKey];
    const pct = Math.min(100, Math.round((val / a.target) * 100));
    const claimed = saveManager.data.claimedAchievements.includes(a.id);
    const ready = !claimed && val >= a.target;
    return `
      <div class="ornate-subcard" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div class="ui-label" style="font-size:11.5px;">${a.name}</div>
          <div style="font-size:12.5px;color:var(--ink-secondary);margin:2px 0 5px;">${a.desc}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:10.5px;color:var(--ink-accent);margin-top:2px;">${Math.min(val, a.target)} / ${a.target}</div>
        </div>
        <button class="gb-btn ${ready ? 'gb-btn-brass' : 'gb-btn-iron'} gb-btn-sm" data-claim-ach="${a.id}" ${ready ? '' : 'disabled'}>
          ${claimed ? 'DONE' : `+${a.rewardIngots}`}
        </button>
      </div>
    `;
  }).join('');

  openModal('EXPEDITION ACHIEVEMENTS', rows, (sheet) => {
    sheet.querySelectorAll('[data-claim-ach]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-claim-ach')!;
        const reward = saveManager.claimAchievement(id);
        if (reward > 0) {
          sfx.playForgeMerge();
          ctx.showToast(`Achievement Claimed: +${reward} Sun-Brass Ingots!`);
          ctx.onStateChanged();
          openAchievementsModal(ctx);
        }
      });
    });
  });
}

export function openWorkshopModal(ctx: ModalContext): void {
  const ingots = saveManager.data.ingots;
  const upgradeHtml = WORKSHOP_UPGRADES.map((u) => {
    const rank = saveManager.data.workshopRanks[u.id] || 0;
    const maxed = rank >= u.maxRank;
    const cost = u.baseCost + rank * u.costStep;
    const canBuy = !maxed && ingots >= cost;
    return `
      <div class="ornate-subcard" style="display:flex;align-items:center;gap:10px;">
        <img src="./assets/symbols/${u.iconSymbolId}.png" alt="${u.name}" class="symbol-thumb" style="width:40px;height:40px;flex:0 0 40px;" />
        <div style="flex:1;min-width:0;">
          <div class="ui-label" style="font-size:11.5px;">${u.name} <span style="color:var(--ink-accent);">Lv.${rank}/${u.maxRank}</span></div>
          <div style="font-size:12.5px;color:var(--ink-secondary);">${u.effectPerRank}</div>
        </div>
        <button class="gb-btn ${canBuy ? 'gb-btn-brass' : 'gb-btn-iron'} gb-btn-sm" data-buy-ws="${u.id}" ${canBuy ? '' : 'disabled'}>
          ${maxed ? 'MAX' : `${cost} ⚙`}
        </button>
      </div>
    `;
  }).join('');

  const classHtml = HERO_CLASSES.filter((c) => c.unlockCostIngots > 0).map((c) => {
    const unlocked = saveManager.data.unlockedClasses.includes(c.id);
    const canUnlock = !unlocked && ingots >= c.unlockCostIngots;
    return `
      <div class="ornate-subcard" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div class="ui-label" style="font-size:12px;">${c.name} (${c.role})</div>
          <div style="font-size:12.5px;color:var(--ink-secondary);">${c.passiveDesc}</div>
        </div>
        <button class="gb-btn ${unlocked ? 'gb-btn-emerald' : canUnlock ? 'gb-btn-brass' : 'gb-btn-iron'} gb-btn-sm" data-unlock-cls="${c.id}" ${unlocked || !canUnlock ? 'disabled' : ''}>
          ${unlocked ? 'OWNED' : `${c.unlockCostIngots} ⚙`}
        </button>
      </div>
    `;
  }).join('');

  const html = `
    <div class="hud-pill" style="align-self:center;font-size:12.5px;padding:6px 14px;">
      TREASURY: ${ingots} SUN-BRASS INGOTS
    </div>
    <p class="prose-justified">
      Invest salvaged Sun-Brass Ingots into permanent Citadel schematics that strengthen every future Vanguard expedition across all six biomes.
    </p>
    ${upgradeHtml}
    <div class="divider-brass"></div>
    <div class="ui-label" style="font-size:12px;color:var(--ink-accent);">VANGUARD LOADOUT UNLOCKS</div>
    ${classHtml}
  `;

  openModal('CITADEL META-WORKSHOP', html, (sheet) => {
    sheet.querySelectorAll('[data-buy-ws]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-buy-ws')!;
        const def = WORKSHOP_UPGRADES.find((u) => u.id === id);
        if (!def) return;
        const rank = saveManager.data.workshopRanks[id] || 0;
        const cost = def.baseCost + rank * def.costStep;
        if (rank >= def.maxRank || saveManager.data.ingots < cost) return;
        saveManager.data.ingots -= cost;
        saveManager.data.workshopRanks[id] = rank + 1;
        saveManager.save();
        sfx.playForgeMerge();
        ctx.showToast(`${def.name} upgraded to Level ${rank + 1}!`);
        ctx.onStateChanged();
        openWorkshopModal(ctx);
      });
    });
    sheet.querySelectorAll('[data-unlock-cls]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-unlock-cls') as 'ironclad' | 'arbalest' | 'artificer';
        const cls = HERO_CLASSES.find((c) => c.id === id);
        if (!cls || saveManager.data.unlockedClasses.includes(id) || saveManager.data.ingots < cls.unlockCostIngots) return;
        saveManager.data.ingots -= cls.unlockCostIngots;
        saveManager.data.unlockedClasses.push(id);
        saveManager.data.selectedClassId = id;
        saveManager.save();
        sfx.playVictoryStamp();
        ctx.showToast(`Unlocked ${cls.name}!`);
        ctx.onStateChanged();
        openWorkshopModal(ctx);
      });
    });
  });
}

export function openCodexModal(tab: 'symbols' | 'relics' | 'enemies' = 'symbols'): void {
  let content = '';
  if (tab === 'symbols') {
    content = SYMBOL_LIST.map((s) => `
      <div class="ornate-subcard" style="display:flex;align-items:center;gap:10px;">
        <img src="./assets/symbols/${s.id}.png" alt="${s.name}" class="symbol-thumb" style="width:42px;height:42px;flex:0 0 42px;" />
        <div>
          <div class="ui-label" style="font-size:11.5px;">${s.name} <span style="color:var(--ink-accent);">• ${s.category.toUpperCase()}</span></div>
          <div style="font-size:12px;font-weight:700;color:var(--ink-primary);">${getSymbolDisplaySummary(s.id, 1)}</div>
          <p class="prose-justified" style="font-size:12.5px;">${s.description}</p>
        </div>
      </div>
    `).join('');
  } else if (tab === 'relics') {
    content = RELICS.map((r) => `
      <div class="ornate-subcard" style="display:flex;align-items:center;gap:10px;">
        <img src="./assets/symbols/${r.iconSymbolId}.png" alt="${r.name}" class="symbol-thumb" style="width:38px;height:38px;flex:0 0 38px;" />
        <div>
          <div class="ui-label" style="font-size:11.5px;">${r.name} <span style="color:var(--ink-accent);">• ${r.rarity.toUpperCase()}</span></div>
          <p class="prose-justified" style="font-size:12.5px;">${r.description}</p>
        </div>
      </div>
    `).join('');
  } else {
    content = Object.values(ENEMIES).map((e) => `
      <div class="ornate-subcard">
        <div class="ui-label" style="font-size:12px;">${e.name} <span style="color:var(--ink-accent);">• ${e.title} (${e.baseHp} HP)</span></div>
        <p class="prose-justified" style="font-size:12.5px;margin-top:3px;">${e.lore}</p>
      </div>
    `).join('');
  }

  const html = `
    <div class="class-tabs">
      <button class="class-tab ${tab === 'symbols' ? 'active' : ''}" data-codex-tab="symbols">SYMBOLS (${SYMBOL_LIST.length})</button>
      <button class="class-tab ${tab === 'relics' ? 'active' : ''}" data-codex-tab="relics">RELICS (${RELICS.length})</button>
      <button class="class-tab ${tab === 'enemies' ? 'active' : ''}" data-codex-tab="enemies">FOES (${Object.keys(ENEMIES).length})</button>
    </div>
    ${content}
  `;
  openModal('EXPEDITION CODEX', html, (sheet) => {
    sheet.querySelectorAll('[data-codex-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        sfx.playTap();
        openCodexModal(b.getAttribute('data-codex-tab') as 'symbols' | 'relics' | 'enemies');
      });
    });
  });
}

export function openDeckInspectorModal(run: ActiveRunState): void {
  const bonuses = getRelicBonuses(run);
  // Compute roll weights per item
  let totalW = 0;
  const rows = run.deck.map((item) => {
    const def = SYMBOLS[item.symbolId];
    const w = (def ? bonuses.categoryWeights[def.category] ?? 1 : 1) * (1 + (item.tier - 1) * 0.14);
    totalW += w;
    return { item, def, w };
  });

  const relicBadges = run.relicIds.map((rid) => {
    const r = RELICS.find((x) => x.id === rid);
    if (!r) return '';
    return `
      <div class="ornate-subcard" style="padding:7px 9px;">
        <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">${r.name}</div>
        <p class="prose-justified" style="font-size:12px;">${r.description}</p>
      </div>
    `;
  }).join('');

  const symHtml = rows.map(({ item, def, w }) => `
    <div class="ornate-subcard" style="display:flex;align-items:center;gap:8px;padding:7px 9px;">
      <img src="./assets/symbols/${item.symbolId}.png" class="symbol-thumb" style="width:36px;height:36px;flex:0 0 36px;" />
      <div style="flex:1;min-width:0;">
        <div class="ui-label" style="font-size:11px;">${def?.name ?? item.symbolId} <span class="tier-pill">${TIER_NAMES[item.tier]}</span></div>
        <div style="font-size:12px;color:var(--ink-secondary);">${getSymbolDisplaySummary(item.symbolId, item.tier)}</div>
      </div>
      <div class="ui-label" style="font-size:11px;color:var(--ink-accent);">${((w / Math.max(0.01, totalW)) * 100).toFixed(1)}%</div>
    </div>
  `).join('');

  openModal(`TUMBLER POOL (${run.deck.length} TILES)`, `
    <div class="ui-label" style="font-size:11.5px;color:var(--ink-accent);">EQUIPPED CLOCKWORK RELICS (${run.relicIds.length})</div>
    ${relicBadges || '<div style="font-size:13px;">No relics equipped yet.</div>'}
    <div class="divider-brass"></div>
    <div class="ui-label" style="font-size:11.5px;color:var(--ink-accent);">DRUM SYMBOL PROBABILITIES</div>
    ${symHtml}
  `);
}

export function openSymbolTooltipModal(sym: OwnedSymbol): void {
  const def = SYMBOLS[sym.symbolId];
  if (!def) return;
  openModal(def.name.toUpperCase(), `
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="./assets/symbols/${sym.symbolId}.png" class="symbol-thumb" style="width:64px;height:64px;flex:0 0 64px;" />
      <div>
        <span class="tier-pill">${TIER_NAMES[sym.tier]}</span>
        <div class="ui-label" style="font-size:12.5px;margin-top:5px;">${getSymbolDisplaySummary(sym.symbolId, sym.tier)}</div>
      </div>
    </div>
    <p class="prose-justified">${def.description}</p>
  `);
}

export function openOnboardingModal(ctx: ModalContext, step = 0): void {
  const steps = [
    {
      title: '1. THE CLOCKWORK COMBAT CONSOLE',
      img: './assets/symbols/master_cogwheel.png',
      body: 'Welcome, Vanguard! Pull or tap the brass mechanical lever on the right side of the 3x3 Clockwork Console to rotate your three combat drums. Every spin uses free mechanical momentum — zero wagering, pure tactical engineering.'
    },
    {
      title: '2. SYNERGY LINES & GEAR-LINKS',
      img: './assets/symbols/gear_link.png',
      body: 'Align three identical action tiles horizontally, vertically, or diagonally to unleash massive combo multipliers. Place Brass Gear-Links and Master Cogwheels in your pool to amplify orthogonally adjacent blades, shields, and repair kits.'
    },
    {
      title: '3. READ ENEMY INTENTS & LOCK DRUMS',
      img: './assets/symbols/tower_shield.png',
      body: 'Every armored foe and Act Boss telegraphs its next strike above its head. Tap the brass LOCK latches above any drum column to pin high-value shields or matching blades in place for the next pull, or build Stagger with War Maces to stun bosses!'
    },
    {
      title: '4. FORGE, MERGE & CONQUER SIX BIOMES',
      img: './assets/symbols/masterwork_core.png',
      body: 'After every victory, draft new symbols and probability-bending Clockwork Relics. Visit the Anvil Forge to merge duplicate tiles from Iron I all the way to Masterwork Gold IV, prune weak pieces, and conquer all six acts of the Sovereign Iron Citadel!'
    }
  ];

  const curr = steps[step];
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;">
      <img src="${curr.img}" style="width:76px;height:76px;border-radius:14px;border:2px solid var(--brass-border);" />
      <div class="ui-label" style="font-size:13px;color:var(--ink-accent);">${curr.title}</div>
      <p class="prose-justified">${curr.body}</p>
      <div style="display:flex;gap:6px;margin:4px 0;">
        ${steps.map((_, i) => `<span style="width:10px;height:10px;border-radius:50%;background:${i === step ? '#D9A434' : 'rgba(130,100,50,0.3)'};border:1px solid var(--brass-border);"></span>`).join('')}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px;">
      <button class="gb-btn gb-btn-iron gb-btn-sm" style="flex:1;" data-onb-skip>SKIP</button>
      <button class="gb-btn gb-btn-brass gb-btn-sm" style="flex:2;" data-onb-next>
        ${step < steps.length - 1 ? 'NEXT BRIEFING →' : 'BEGIN EXPEDITION!'}
      </button>
    </div>
  `;

  openModal('VANGUARD EXPEDITION BRIEFING', html, (sheet) => {
    const finish = () => {
      saveManager.data.onboardingCompleted = true;
      saveManager.save();
      closeModal();
      ctx.onStateChanged();
    };
    // Ensure closing via X or backdrop ALSO permanently marks onboarding completed so it never nags!
    sheet.querySelector('[data-close-modal]')?.addEventListener('click', finish);
    const root = getModalRoot();
    root.onclick = (e) => {
      if (e.target === root) {
        sfx.playTap();
        finish();
      }
    };
    sheet.querySelector('[data-onb-skip]')?.addEventListener('click', () => {
      sfx.playTap();
      finish();
    });
    sheet.querySelector('[data-onb-next]')?.addEventListener('click', () => {
      sfx.playTap();
      if (step < steps.length - 1) openOnboardingModal(ctx, step + 1);
      else finish();
    });
  });
}
