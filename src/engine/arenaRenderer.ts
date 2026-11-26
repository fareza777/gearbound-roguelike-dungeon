import { BIOMES, EnemyIntent } from '../data/gameData';
import { assetCache } from './assetCache';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'spark' | 'steam' | 'ring' | 'slash' | 'bolt';
  angle?: number;
}

interface FloatingNumber {
  x: number;
  y: number;
  vy: number;
  text: string;
  subText?: string;
  color: string;
  stroke: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface ArenaSnapshot {
  biomeIndex: number;
  heroSpriteId: string;
  heroHp: number;
  heroMaxHp: number;
  heroArmor: number;
  heroOverdrive: number;
  enemySpriteId: string;
  enemyName: string;
  enemyTitle: string;
  enemyIsBoss: boolean;
  enemyHp: number;
  enemyMaxHp: number;
  enemyArmor: number;
  enemyStagger: number;
  enemyStunned: boolean;
  enemyHeat: number;
  enemyIntent: EnemyIntent;
  weakenedPct: number;
}

/**
 * High-Performance Mobile GPU Arena Renderer.
 * - Opaque alpha:false canvas at 1.25x DPR.
 * - Pre-bakes BOTH Biome Backdrop AND Top HUD Bars/Intent Plaque into 1:1 offscreen canvases!
 * - Zero per-frame strokeText/fillText/gradients during idle or spin; throttles Arena idle to
 *   15 FPS while the 3x3 Clockwork Console is spinning so GPU stays rock-solid 60 FPS!
 */
export class ArenaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 360;
  private h = 240;
  private dpr = 1;

  private state: ArenaSnapshot;
  private heroAnim: 'idle' | 'attack' | 'guard' | 'hit' = 'idle';
  private heroAnimTime = 0;
  private heroDashX = 0;
  private heroDashVel = 0;

  private enemyAnim: 'idle' | 'attack' | 'hit' = 'idle';
  private enemyAnimTime = 0;
  private enemyDashX = 0;
  private enemyDashVel = 0;

  private shakeTime = 0;
  private shakeMag = 0;
  private hitStopTime = 0;
  private bannerFlash = 0;
  private bannerText = '';

  private particles: Particle[] = [];
  private floats: FloatingNumber[] = [];
  private rafId = 0;
  private lastTs = 0;
  private frameAccum = 0;
  private speedMult = 1;
  private wheelSpinning = false;
  private destroyed = false;

  private bgCache: HTMLCanvasElement | null = null;
  private bgCacheBiome = -1;
  private hudCache: HTMLCanvasElement | null = null;
  private hudDirty = true;

  constructor(canvas: HTMLCanvasElement, initial: ArenaSnapshot) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.state = { ...initial };
    this.resize();
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  setSpeed(mult: 1 | 2): void {
    this.speedMult = mult;
  }

  setWheelSpinning(spinning: boolean): void {
    this.wheelSpinning = spinning;
  }

  updateState(next: Partial<ArenaSnapshot>): void {
    this.state = { ...this.state, ...next };
    this.hudDirty = true;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(240, Math.round(rect.width || 380));
    this.h = Math.max(160, Math.round(rect.height || 230));
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.bgCacheBiome = -1;
    this.hudDirty = true;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
  }

  triggerHeroAttack(heavy = false, ranged = false): void {
    this.heroAnim = 'attack';
    this.heroAnimTime = 0;
    this.heroDashX = ranged ? 10 : heavy ? 48 : 32;
    if (ranged) {
      this.particles.push({
        x: this.w * 0.30, y: this.h * 0.62, vx: this.w * 1.9, vy: -10,
        size: 14, life: 0, maxLife: 0.22, color: '#FFE588', kind: 'bolt'
      });
    } else {
      this.particles.push({
        x: this.w * 0.66, y: this.h * 0.60, vx: 0, vy: 0,
        size: heavy ? 62 : 44, life: 0, maxLife: 0.25,
        color: heavy ? '#FFD45E' : '#FFF4CC', kind: 'slash', angle: -0.3 + Math.random() * 0.6
      });
    }
  }

  triggerHeroGuard(): void {
    this.heroAnim = 'guard';
    this.heroAnimTime = 0;
    this.particles.push({
      x: this.w * 0.28, y: this.h * 0.62, vx: 0, vy: 0,
      size: 40, life: 0, maxLife: 0.34, color: '#6BB8FF', kind: 'ring'
    });
  }

  triggerHeroHit(heavy = false): void {
    this.heroAnim = 'hit';
    this.heroAnimTime = 0;
    this.heroDashX = heavy ? -20 : -12;
    this.triggerShake(heavy ? 9 : 4.5, heavy ? 0.24 : 0.14);
    if (heavy) this.hitStopTime = 0.05;
    this.spawnSparks(this.w * 0.26, this.h * 0.62, heavy ? 12 : 7, '#FF8B5A');
  }

  triggerEnemyAttack(heavy = false): void {
    this.enemyAnim = 'attack';
    this.enemyAnimTime = 0;
    this.enemyDashX = heavy ? -44 : -28;
  }

  triggerEnemyHit(heavy = false): void {
    this.enemyAnim = 'hit';
    this.enemyAnimTime = 0;
    this.enemyDashX = heavy ? 20 : 12;
    this.triggerShake(heavy ? 10 : 5, heavy ? 0.24 : 0.14);
    if (heavy) this.hitStopTime = 0.055;
    this.spawnSparks(this.w * 0.72, this.h * 0.58, heavy ? 14 : 8, heavy ? '#FFE066' : '#FFF2C2');
  }

  triggerOverdriveBurst(): void {
    this.triggerShake(7, 0.22);
    this.spawnSparks(this.w * 0.26, this.h * 0.62, 16, '#FFD24C');
  }

  showComboBanner(text: string): void {
    if (!text) return;
    this.bannerText = text;
    this.bannerFlash = 1.25;
  }

  spawnFloatingNumber(
    target: 'hero' | 'enemy',
    text: string,
    kind: 'damage' | 'crit' | 'block' | 'heal' | 'heat' | 'stun',
    subText?: string
  ): void {
    const baseX = target === 'hero' ? this.w * 0.26 : this.w * 0.73;
    const baseY = this.h * 0.42 + (Math.random() - 0.5) * 18;
    const palette: Record<typeof kind, { c: string; s: string; sc: number }> = {
      damage: { c: '#FFF5D6', s: '#4E160C', sc: 1.05 },
      crit: { c: '#FFD74A', s: '#5B1806', sc: 1.32 },
      block: { c: '#8AD0FF', s: '#0D2645', sc: 1.02 },
      heal: { c: '#7BF0A5', s: '#0E381E', sc: 1.04 },
      heat: { c: '#FF9844', s: '#4D1405', sc: 0.96 },
      stun: { c: '#FFE478', s: '#3A2306', sc: 1.12 }
    };
    const p = palette[kind];
    this.floats.push({
      x: baseX + (Math.random() - 0.5) * 24,
      y: baseY,
      vy: -50 - Math.random() * 18,
      text,
      subText,
      color: p.c,
      stroke: p.s,
      scale: p.sc,
      life: 0,
      maxLife: 1.05
    });
  }

  private triggerShake(mag: number, dur: number): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  private spawnSparks(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 170;
      this.particles.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 40,
        size: 2.5 + Math.random() * 3.0, life: 0, maxLife: 0.26 + Math.random() * 0.22,
        color, kind: 'spark'
      });
    }
  }

  private loop = (ts: number): void => {
    if (this.destroyed) return;
    const rawDt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    const dt = rawDt * (this.speedMult === 2 ? 1.45 : 1.0);

    if (this.bannerFlash > 0) {
      this.bannerFlash = Math.max(0, this.bannerFlash - rawDt);
    }

    const isCombatActive =
      this.heroAnim !== 'idle' ||
      this.enemyAnim !== 'idle' ||
      this.particles.length > 0 ||
      this.floats.length > 0 ||
      this.shakeTime > 0 ||
      this.bannerFlash > 0;

    // While the 3x3 wheel is spinning & combatants are idle, run Arena at 12 FPS so the
    // spinning mechanical console gets 90% of Adreno GPU budget! Ramp instantly to 60 FPS on combat!
    if (this.wheelSpinning && !isCombatActive) {
      this.frameAccum += rawDt;
      if (this.frameAccum < 0.083) {
        this.rafId = requestAnimationFrame(this.loop);
        return;
      }
      this.step(this.frameAccum);
      this.frameAccum = 0;
      this.render();
    } else if (!isCombatActive) {
      // Gentle 20 FPS idle breathing saves battery & keeps GPU silky responsive
      this.frameAccum += rawDt;
      if (this.frameAccum < 0.05) {
        this.rafId = requestAnimationFrame(this.loop);
        return;
      }
      this.step(this.frameAccum);
      this.frameAccum = 0;
      this.render();
    } else {
      if (this.hitStopTime > 0) {
        this.hitStopTime -= rawDt;
      } else {
        this.step(dt);
      }
      this.render();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    this.heroAnimTime += dt;
    if (this.heroAnim !== 'idle') {
      const dur = this.heroAnim === 'hit' ? 0.34 : this.heroAnim === 'guard' ? 0.48 : 0.48;
      if (this.heroAnimTime >= dur) {
        this.heroAnim = 'idle';
        this.heroAnimTime = 0;
      }
    }
    this.enemyAnimTime += dt;
    if (this.enemyAnim !== 'idle') {
      const dur = this.enemyAnim === 'hit' ? 0.34 : 0.50;
      if (this.enemyAnimTime >= dur) {
        this.enemyAnim = 'idle';
        this.enemyAnimTime = 0;
      }
    }

    const k = 120, damp = 14;
    this.heroDashVel += (-k * this.heroDashX - damp * this.heroDashVel) * dt;
    this.heroDashX += this.heroDashVel * dt;
    this.enemyDashVel += (-k * this.enemyDashX - damp * this.enemyDashVel) * dt;
    this.enemyDashX += this.enemyDashVel * dt;

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 400 * dt;
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        this.floats.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.18, dt);
    }
  }

  private drawSprite(unitId: string, anim: string, animTime: number, cx: number, footY: number, drawHeight: number): void {
    const meta = assetCache.manifest[unitId];
    if (!meta) return;
    const animMeta = meta.anims[anim] ?? meta.anims.idle;
    if (!animMeta) return;
    const sheet = assetCache.getImage(animMeta.file);
    if (!sheet) return;

    const fps = anim === 'idle' ? 10 : anim === 'hit' ? 18 : 22;
    const idx =
      anim === 'idle'
        ? Math.floor(animTime * fps) % animMeta.frames
        : Math.min(animMeta.frames - 1, Math.floor(animTime * fps));
    const fw = meta.frameWidth;
    const fh = meta.frameHeight;
    const cols = animMeta.cols ?? animMeta.frames;
    const sx = (idx % cols) * fw;
    const sy = Math.floor(idx / cols) * fh;
    const drawW = (fw / fh) * drawHeight;

    this.ctx.drawImage(
      sheet,
      sx, sy, fw, fh,
      Math.round(cx - drawW * 0.5),
      Math.round(footY - drawHeight * 0.90),
      Math.round(drawW),
      Math.round(drawHeight)
    );
  }

  private rebuildHudCache(): void {
    const c = this.hudCache ?? document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = Math.round(92 * this.dpr);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(this.dpr, this.dpr);

    const barW = Math.min(138, this.w * 0.36);

    const drawBar = (
      x: number, y: number, w: number, hp: number, maxHp: number, armor: number,
      cA: string, cB: string, label: string, alignRight = false
    ) => {
      const h = 15;
      ctx.fillStyle = 'rgba(20, 14, 9, 0.86)';
      ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 7); ctx.fill();
      ctx.strokeStyle = '#C99B3B'; ctx.lineWidth = 1.6; ctx.stroke();

      const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, cA); grad.addColorStop(1, cB);
      ctx.fillStyle = grad;
      if (pct > 0) {
        ctx.beginPath(); ctx.roundRect(x, y, Math.max(6, w * pct), h, 4.5); ctx.fill();
      }
      ctx.font = '700 11px "Cinzel", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)'; ctx.lineWidth = 3;
      const hpText = `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
      ctx.strokeText(hpText, x + w * 0.5, y + h * 0.52);
      ctx.fillStyle = '#FFF9E8';
      ctx.fillText(hpText, x + w * 0.5, y + h * 0.52);

      ctx.font = '700 10.5px "Cinzel", serif';
      ctx.textAlign = alignRight ? 'right' : 'left';
      ctx.lineWidth = 3.4;
      const lx = alignRight ? x + w : x;
      ctx.strokeText(label, lx, y - 12);
      ctx.fillStyle = '#FFF6DE';
      ctx.fillText(label, lx, y - 12);

      if (armor > 0) {
        const bx = alignRight ? x - 22 : x + w + 22;
        const by = y + h * 0.5;
        ctx.beginPath(); ctx.arc(bx, by, 12.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1B4275'; ctx.fill();
        ctx.strokeStyle = '#E8C266'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = '800 10.5px "Cinzel", serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#EAF6FF'; ctx.fillText(`${armor}`, bx, by + 0.5);
      }
    };

    drawBar(12, 24, barW, this.state.heroHp, this.state.heroMaxHp, this.state.heroArmor, '#40B866', '#1A6935', 'VANGUARD');

    // Steam Overdrive gauge
    const odY = 44;
    ctx.fillStyle = 'rgba(20, 14, 9, 0.82)';
    ctx.beginPath(); ctx.roundRect(12, odY, barW, 8, 4); ctx.fill();
    const odPct = Math.max(0, Math.min(1, this.state.heroOverdrive / 100));
    if (odPct > 0) {
      ctx.fillStyle = '#F0BC42';
      ctx.beginPath(); ctx.roundRect(13, odY + 1, Math.max(4, (barW - 2) * odPct), 6, 3); ctx.fill();
    }
    ctx.font = '800 9px "Cinzel", serif'; ctx.textAlign = 'left';
    const odLabel = this.state.heroOverdrive >= 100 ? 'STEAM OVERDRIVE READY!' : `STEAM ${Math.floor(this.state.heroOverdrive)}%`;
    ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)'; ctx.lineWidth = 3.2;
    ctx.strokeText(odLabel, 12, odY + 18);
    ctx.fillStyle = '#FFE9A3'; ctx.fillText(odLabel, 12, odY + 18);

    // Enemy bar + Intent plaque
    const ex = this.w - barW - 12;
    drawBar(
      ex, 24, barW, this.state.enemyHp, this.state.enemyMaxHp, this.state.enemyArmor,
      this.state.enemyIsBoss ? '#E85D2A' : '#D94236',
      this.state.enemyIsBoss ? '#7A1F0B' : '#701812',
      this.state.enemyName.toUpperCase(), true
    );

    const intent = this.state.enemyIntent;
    ctx.fillStyle = this.state.enemyStunned ? 'rgba(84, 62, 16, 0.92)' : 'rgba(30, 17, 12, 0.90)';
    ctx.beginPath(); ctx.roundRect(ex, 44, barW, 24, 8); ctx.fill();
    ctx.strokeStyle = this.state.enemyStunned ? '#FFE072' : intent.type === 'shatter' || intent.type === 'heavy' ? '#FF7D45' : '#C99B3B';
    ctx.lineWidth = 1.5; ctx.stroke();

    let copy = '';
    if (this.state.enemyStunned) {
      copy = 'STAGGERED • SKIP TURN';
    } else {
      const effDmg = Math.max(0, Math.round(intent.damage * (1 - this.state.weakenedPct / 100)));
      if (intent.type === 'multi' && intent.hits) copy = `⚔ ${effDmg}×${intent.hits} • ${intent.label}`;
      else if (intent.type === 'charge') copy = `⚙ +${intent.armor ?? 0} ARM • ${intent.label}`;
      else if (intent.type === 'fortify') copy = `🛡 ${effDmg} DMG +${intent.armor ?? 0}`;
      else copy = `⚔ ${effDmg} DMG • ${intent.label}`;
    }
    ctx.font = '700 8.8px "Cinzel", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this.state.enemyStunned ? '#FFF0A8' : '#FFE3C4';
    ctx.fillText(copy.slice(0, 24), ex + barW * 0.5, 56.5);

    let tagX = ex + barW;
    if (this.state.enemyStagger > 0 && !this.state.enemyStunned) {
      const st = `STAGGER ${Math.min(100, this.state.enemyStagger)}%`;
      ctx.font = '800 9px "Cinzel", serif'; ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)'; ctx.lineWidth = 3.2;
      ctx.strokeText(st, tagX, 79); ctx.fillStyle = '#FFE98A'; ctx.fillText(st, tagX, 79);
      tagX -= 84;
    }
    if (this.state.enemyHeat > 0) {
      const ht = `HEAT ${this.state.enemyHeat}`;
      ctx.font = '800 9px "Cinzel", serif'; ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)'; ctx.lineWidth = 3.2;
      ctx.strokeText(ht, tagX, 79); ctx.fillStyle = '#FFA45E'; ctx.fillText(ht, tagX, 79);
    }

    this.hudCache = c;
    this.hudDirty = false;
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    if (this.shakeTime > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeMag * (this.shakeTime * 3.5);
      const sy = (Math.random() - 0.5) * 2 * this.shakeMag * (this.shakeTime * 3.5);
      ctx.translate(sx, sy);
    }

    // 1. Pre-scaled Offscreen Biome Backdrop (1 GPU blit!)
    const biome = BIOMES[this.state.biomeIndex] ?? BIOMES[0];
    const bg = assetCache.getImage(biome.bgFile);
    if (bg) {
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      if (!this.bgCache || this.bgCacheBiome !== this.state.biomeIndex || this.bgCache.width !== cw || this.bgCache.height !== ch) {
        this.bgCache = document.createElement('canvas');
        this.bgCache.width = cw;
        this.bgCache.height = ch;
        const bctx = this.bgCache.getContext('2d')!;
        const scale = Math.max(cw / bg.width, ch / bg.height);
        const dw = bg.width * scale;
        const dh = bg.height * scale;
        bctx.drawImage(bg, (cw - dw) * 0.5, (ch - dh) * 0.5, dw, dh);
        this.bgCacheBiome = this.state.biomeIndex;
      }
      ctx.drawImage(this.bgCache, 0, 0, this.w, this.h);
    } else {
      ctx.fillStyle = '#3A2E20';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // 2. Hero & Enemy Compact 4x3 Atlas Sprites (2 GPU blits!)
    const footY = this.h * 0.87;
    const heroH = Math.min(this.h * 0.64, 154);
    const enemyH = this.state.enemyIsBoss ? Math.min(this.h * 0.76, 184) : Math.min(this.h * 0.64, 154);

    this.drawSprite(this.state.heroSpriteId, this.heroAnim, this.heroAnimTime, this.w * 0.25 + this.heroDashX, footY, heroH);
    this.drawSprite(this.state.enemySpriteId, this.enemyAnim, this.enemyAnimTime, this.w * 0.75 + this.enemyDashX, footY, enemyH);

    // 3. Cached Top HUD Bars & Intent Plaque (1 GPU blit — ZERO per-frame text!)
    if (this.hudDirty || !this.hudCache) {
      this.rebuildHudCache();
    }
    if (this.hudCache) {
      ctx.drawImage(this.hudCache, 0, 0, this.w, 92);
    }

    // 4. Combat VFX Particles (only when active)
    for (const p of this.particles) {
      const u = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - u);
      if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 4.5 * (1 - u);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.45 + u * 1.25), 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'slash') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle || 0);
        ctx.strokeStyle = p.color; ctx.lineWidth = 11 * (1 - u); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, p.size * (0.65 + u * 0.45), -1.1, 1.1); ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'bolt') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(p.x - 24, p.y); ctx.lineTo(p.x + 12, p.y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // 5. Floating Damage / Guard / Heal Numerals (only when active)
    for (const f of this.floats) {
      const u = f.life / f.maxLife;
      const pop = u < 0.14 ? 0.65 + (u / 0.14) * 0.52 : 1.17 - Math.min(0.18, (u - 0.14) * 0.7);
      ctx.save();
      ctx.globalAlpha = u > 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.28) : 1;
      ctx.translate(f.x, f.y);
      ctx.scale(f.scale * pop, f.scale * pop);
      ctx.font = '900 21px "Cinzel Decorative", "Cinzel", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = f.stroke; ctx.lineWidth = 4.5; ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
      if (f.subText) {
        ctx.font = '700 10px "Cinzel", serif'; ctx.lineWidth = 2.8;
        ctx.strokeText(f.subText, 0, 16);
        ctx.fillStyle = '#FFEAA8'; ctx.fillText(f.subText, 0, 16);
      }
      ctx.restore();
    }

    // 6. Combo Banner Callout (only when active)
    if (this.bannerFlash > 0 && this.bannerText) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.bannerFlash * 1.4);
      const bw = Math.min(this.w - 28, 280);
      const bx = (this.w - bw) * 0.5;
      const by = this.h * 0.28;
      ctx.fillStyle = 'rgba(26, 17, 9, 0.90)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 26, 13); ctx.fill();
      ctx.strokeStyle = '#F2CA66'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.font = '800 11px "Cinzel", serif'; ctx.fillStyle = '#FFE89E';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.bannerText, this.w * 0.5, by + 13.5);
      ctx.restore();
    }

    ctx.restore();
  }
}
