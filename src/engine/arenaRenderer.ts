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
  kind: 'spark' | 'steam' | 'dust' | 'ring' | 'slash' | 'bolt';
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

interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  phase: number;
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
  private ambients: AmbientMote[] = [];
  private rafId = 0;
  private lastTs = 0;
  private speedMult = 1;
  private destroyed = false;
  private bgCache: HTMLCanvasElement | null = null;
  private bgCacheBiome = -1;
  private bgCacheW = 0;
  private bgCacheH = 0;

  constructor(canvas: HTMLCanvasElement, initial: ArenaSnapshot) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.state = { ...initial };
    this.initAmbients();
    this.resize();
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  setSpeed(mult: 1 | 2): void {
    this.speedMult = mult;
  }

  updateState(next: Partial<ArenaSnapshot>): void {
    this.state = { ...this.state, ...next };
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(240, rect.width || 380);
    this.h = Math.max(160, rect.height || 230);
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.bgCacheBiome = -1; // invalidate cached backdrop
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
  }

  private initAmbients(): void {
    this.ambients = [];
    for (let i = 0; i < 12; i++) {
      this.ambients.push({
        x: Math.random(),
        y: Math.random() * 0.85,
        vx: (Math.random() - 0.5) * 0.04,
        vy: -0.02 - Math.random() * 0.04,
        r: 1.5 + Math.random() * 3.2,
        alpha: 0.22 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  triggerHeroAttack(heavy = false, ranged = false): void {
    this.heroAnim = 'attack';
    this.heroAnimTime = 0;
    this.heroDashX = ranged ? 10 : heavy ? 52 : 34;
    if (ranged) {
      this.particles.push({
        x: this.w * 0.30,
        y: this.h * 0.62,
        vx: this.w * 1.9,
        vy: -12,
        size: 16,
        life: 0,
        maxLife: 0.24,
        color: '#FFE588',
        kind: 'bolt'
      });
    } else {
      this.particles.push({
        x: this.w * 0.66,
        y: this.h * 0.60,
        vx: 0,
        vy: 0,
        size: heavy ? 68 : 48,
        life: 0,
        maxLife: 0.28,
        color: heavy ? '#FFD45E' : '#FFF4CC',
        kind: 'slash',
        angle: -0.35 + Math.random() * 0.7
      });
    }
  }

  triggerHeroGuard(): void {
    this.heroAnim = 'guard';
    this.heroAnimTime = 0;
    this.particles.push({
      x: this.w * 0.28,
      y: this.h * 0.62,
      vx: 0,
      vy: 0,
      size: 42,
      life: 0,
      maxLife: 0.38,
      color: '#6BB8FF',
      kind: 'ring'
    });
  }

  triggerHeroHit(heavy = false): void {
    this.heroAnim = 'hit';
    this.heroAnimTime = 0;
    this.heroDashX = heavy ? -22 : -14;
    this.triggerShake(heavy ? 10 : 5, heavy ? 0.28 : 0.16);
    if (heavy) this.hitStopTime = 0.06;
    this.spawnSparks(this.w * 0.26, this.h * 0.62, heavy ? 16 : 9, '#FF8B5A');
  }

  triggerEnemyAttack(heavy = false): void {
    this.enemyAnim = 'attack';
    this.enemyAnimTime = 0;
    this.enemyDashX = heavy ? -48 : -30;
  }

  triggerEnemyHit(heavy = false): void {
    this.enemyAnim = 'hit';
    this.enemyAnimTime = 0;
    this.enemyDashX = heavy ? 22 : 13;
    this.triggerShake(heavy ? 11 : 5.5, heavy ? 0.26 : 0.15);
    if (heavy) this.hitStopTime = 0.065;
    this.spawnSparks(this.w * 0.72, this.h * 0.58, heavy ? 18 : 11, heavy ? '#FFE066' : '#FFF2C2');
  }

  triggerOverdriveBurst(): void {
    this.triggerShake(8, 0.25);
    this.spawnSparks(this.w * 0.26, this.h * 0.62, 22, '#FFD24C');
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: this.w * 0.25 + (Math.random() - 0.5) * 40,
        y: this.h * 0.72,
        vx: (Math.random() - 0.5) * 80,
        vy: -55 - Math.random() * 85,
        size: 10 + Math.random() * 14,
        life: 0,
        maxLife: 0.65,
        color: 'rgba(255, 245, 220, 0.75)',
        kind: 'steam'
      });
    }
  }

  showComboBanner(text: string): void {
    if (!text) return;
    this.bannerText = text;
    this.bannerFlash = 1.65;
  }

  spawnFloatingNumber(
    target: 'hero' | 'enemy',
    text: string,
    kind: 'damage' | 'crit' | 'block' | 'heal' | 'heat' | 'stun',
    subText?: string
  ): void {
    const baseX = target === 'hero' ? this.w * 0.26 : this.w * 0.73;
    const baseY = this.h * 0.42 + (Math.random() - 0.5) * 22;
    const palette: Record<typeof kind, { c: string; s: string; sc: number }> = {
      damage: { c: '#FFF5D6', s: '#4E160C', sc: 1.05 },
      crit: { c: '#FFD74A', s: '#5B1806', sc: 1.38 },
      block: { c: '#8AD0FF', s: '#0D2645', sc: 1.02 },
      heal: { c: '#7BF0A5', s: '#0E381E', sc: 1.06 },
      heat: { c: '#FF9844', s: '#4D1405', sc: 0.98 },
      stun: { c: '#FFE478', s: '#3A2306', sc: 1.15 }
    };
    const p = palette[kind];
    this.floats.push({
      x: baseX + (Math.random() - 0.5) * 28,
      y: baseY,
      vy: -52 - Math.random() * 20,
      text,
      subText,
      color: p.c,
      stroke: p.s,
      scale: p.sc,
      life: 0,
      maxLife: 1.15
    });
  }

  private triggerShake(mag: number, dur: number): void {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  private spawnSparks(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 75 + Math.random() * 195;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 45,
        size: 2.5 + Math.random() * 3.8,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.28,
        color,
        kind: 'spark'
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
    if (this.hitStopTime > 0) {
      this.hitStopTime -= rawDt;
    } else {
      this.step(dt);
    }
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    // Advance smooth frame-by-frame animation timers
    this.heroAnimTime += dt;
    if (this.heroAnim !== 'idle') {
      const dur = this.heroAnim === 'hit' ? 0.36 : this.heroAnim === 'guard' ? 0.55 : 0.52;
      if (this.heroAnimTime >= dur) {
        this.heroAnim = 'idle';
        this.heroAnimTime = 0;
      }
    }
    this.enemyAnimTime += dt;
    if (this.enemyAnim !== 'idle') {
      const dur = this.enemyAnim === 'hit' ? 0.36 : 0.54;
      if (this.enemyAnimTime >= dur) {
        this.enemyAnim = 'idle';
        this.enemyAnimTime = 0;
      }
    }

    // Spring-damped dash offsets
    const k = 120, damp = 14;
    this.heroDashVel += (-k * this.heroDashX - damp * this.heroDashVel) * dt;
    this.heroDashX += this.heroDashVel * dt;
    this.enemyDashVel += (-k * this.enemyDashX - damp * this.enemyDashVel) * dt;
    this.enemyDashX += this.enemyDashVel * dt;

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }
    if (this.bannerFlash > 0) {
      this.bannerFlash = Math.max(0, this.bannerFlash - dt);
    }

    // Ambient biome motes
    const biome = BIOMES[this.state.biomeIndex] ?? BIOMES[0];
    for (const m of this.ambients) {
      m.phase += dt * 2.2;
      if (biome.ambientKind === 'snow') {
        m.x += (0.03 + Math.sin(m.phase) * 0.015) * dt;
        m.y += 0.14 * dt;
      } else if (biome.ambientKind === 'sand') {
        m.x += 0.26 * dt;
        m.y += Math.sin(m.phase) * 0.02 * dt;
      } else if (biome.ambientKind === 'embers') {
        m.x += Math.sin(m.phase) * 0.04 * dt;
        m.y -= 0.12 * dt;
      } else {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
      }
      if (m.x > 1.05) m.x = -0.05;
      if (m.x < -0.05) m.x = 1.05;
      if (m.y < -0.05) m.y = 0.88;
      if (m.y > 0.92) m.y = -0.04;
    }

    // Combat VFX particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 420 * dt;
    }

    // Floating combat numerals
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

    const fps = anim === 'idle' ? 11 : anim === 'hit' ? 20 : 22;
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
      sx,
      sy,
      fw,
      fh,
      cx - drawW * 0.5,
      footY - drawHeight * 0.90,
      drawW,
      drawHeight
    );
  }

  private drawUnitBar(
    x: number,
    y: number,
    w: number,
    hp: number,
    maxHp: number,
    armor: number,
    colorA: string,
    colorB: string,
    label: string,
    alignRight = false
  ): void {
    const ctx = this.ctx;
    const h = 15;
    ctx.save();
    // Brass plate backing
    ctx.fillStyle = 'rgba(20, 14, 9, 0.84)';
    this.roundRect(x - 3, y - 3, w + 6, h + 6, 7);
    ctx.fill();
    ctx.strokeStyle = '#C99B3B';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Fill
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.fillStyle = grad;
    if (pct > 0) {
      this.roundRect(x, y, Math.max(6, w * pct), h, 4.5);
      ctx.fill();
    }

    // Specular sheen
    ctx.fillStyle = 'rgba(255, 250, 232, 0.22)';
    this.roundRect(x + 2, y + 1.5, Math.max(0, w * pct - 4), h * 0.36, 2);
    ctx.fill();

    // HP text
    ctx.font = '700 11px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFF9E8';
    ctx.strokeStyle = 'rgba(18, 10, 4, 0.92)';
    ctx.lineWidth = 3;
    const hpText = `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
    ctx.strokeText(hpText, x + w * 0.5, y + h * 0.52);
    ctx.fillText(hpText, x + w * 0.5, y + h * 0.52);

    // Nameplate above bar
    ctx.font = '700 10.5px "Cinzel", serif';
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.fillStyle = '#FFF6DE';
    ctx.strokeStyle = 'rgba(22, 13, 6, 0.96)';
    ctx.lineWidth = 3.6;
    const lx = alignRight ? x + w : x;
    ctx.strokeText(label, lx, y - 12);
    ctx.fillText(label, lx, y - 12);

    // Armor Shield Badge
    if (armor > 0) {
      const bx = alignRight ? x - 24 : x + w + 24;
      const by = y + h * 0.5;
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#1B4275';
      ctx.fill();
      ctx.strokeStyle = '#E8C266';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 10.5px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#EAF6FF';
      ctx.fillText(`${armor}`, bx, by + 0.5);
    }
    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Camera shake offset
    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag * (this.shakeTime * 3.5) : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag * (this.shakeTime * 3.5) : 0;
    ctx.translate(sx, sy);

    // 1. Pre-scaled Offscreen Cached Biome Backdrop (Single fast GPU blit per frame!)
    const biome = BIOMES[this.state.biomeIndex] ?? BIOMES[0];
    const bg = assetCache.getImage(biome.bgFile);
    if (bg) {
      const cw = Math.round(this.w * this.dpr);
      const ch = Math.round(this.h * this.dpr);
      if (!this.bgCache || this.bgCacheBiome !== this.state.biomeIndex || this.bgCacheW !== cw || this.bgCacheH !== ch) {
        this.bgCache = document.createElement('canvas');
        this.bgCache.width = cw;
        this.bgCache.height = ch;
        const bctx = this.bgCache.getContext('2d');
        if (bctx) {
          const scale = Math.max(cw / bg.width, ch / bg.height);
          const dw = bg.width * scale;
          const dh = bg.height * scale;
          bctx.drawImage(bg, (cw - dw) * 0.5, (ch - dh) * 0.5, dw, dh);
        }
        this.bgCacheBiome = this.state.biomeIndex;
        this.bgCacheW = cw;
        this.bgCacheH = ch;
      }
      ctx.drawImage(this.bgCache, 0, 0, this.w, this.h);
    } else {
      ctx.fillStyle = '#3A2E20';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // 2. Ambient Biome Particles
    for (const m of this.ambients) {
      ctx.save();
      ctx.globalAlpha = m.alpha;
      if (biome.ambientKind === 'embers') ctx.fillStyle = '#FF9C3B';
      else if (biome.ambientKind === 'snow') ctx.fillStyle = '#F2F8FF';
      else if (biome.ambientKind === 'sand') ctx.fillStyle = '#E8C082';
      else ctx.fillStyle = '#FFF2C6';
      ctx.beginPath();
      ctx.arc(m.x * this.w, m.y * this.h, m.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Animated Frame-by-Frame Combatants on the Battle Terrace
    const footY = this.h * 0.87;
    const heroH = Math.min(this.h * 0.64, 156);
    const enemyH = this.state.enemyIsBoss ? Math.min(this.h * 0.76, 188) : Math.min(this.h * 0.64, 156);

    this.drawSprite(
      this.state.heroSpriteId,
      this.heroAnim,
      this.heroAnimTime,
      this.w * 0.25 + this.heroDashX,
      footY,
      heroH
    );

    this.drawSprite(
      this.state.enemySpriteId,
      this.enemyAnim,
      this.enemyAnimTime,
      this.w * 0.75 + this.enemyDashX,
      footY,
      enemyH
    );

    // Enemy Stunned spinning brass indicators
    if (this.state.enemyStunned) {
      const t = performance.now() * 0.005;
      for (let i = 0; i < 3; i++) {
        const a = t + (i * Math.PI * 2) / 3;
        const bx = this.w * 0.74 + Math.cos(a) * 26;
        const by = footY - enemyH * 0.86 + Math.sin(a) * 7;
        ctx.beginPath();
        ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFE47A';
        ctx.fill();
        ctx.strokeStyle = '#3B2206';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // 4. Combat VFX Particles
    for (const p of this.particles) {
      const u = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - u);
      if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - u * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'steam') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.7 + u * 1.1), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * (1 - u);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.45 + u * 1.25), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'slash') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 12 * (1 - u);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.65 + u * 0.45), -1.1, 1.1);
        ctx.stroke();
      } else if (p.kind === 'bolt') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x - 28, p.y);
        ctx.lineTo(p.x + 12, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Top HUD Bars (Hero Left, Enemy Right, Intent Center-Right)
    const barW = Math.min(138, this.w * 0.36);
    this.drawUnitBar(
      12,
      24,
      barW,
      this.state.heroHp,
      this.state.heroMaxHp,
      this.state.heroArmor,
      '#40B866',
      '#1A6935',
      'VANGUARD'
    );

    // Overdrive Steam Gauge right below Hero HP bar
    const odY = 44;
    ctx.save();
    ctx.fillStyle = 'rgba(20, 14, 9, 0.8)';
    this.roundRect(12, odY, barW, 8, 4);
    ctx.fill();
    const odPct = Math.max(0, Math.min(1, this.state.heroOverdrive / 100));
    const odGrad = ctx.createLinearGradient(12, odY, 12 + barW, odY);
    odGrad.addColorStop(0, '#E39A2B');
    odGrad.addColorStop(1, '#FFE47A');
    ctx.fillStyle = odGrad;
    if (odPct > 0) {
      this.roundRect(13, odY + 1, Math.max(4, (barW - 2) * odPct), 6, 3);
      ctx.fill();
    }
    ctx.font = '800 9px "Cinzel", serif';
    ctx.textAlign = 'left';
    const odLabel = this.state.heroOverdrive >= 100 ? 'STEAM OVERDRIVE READY!' : `STEAM ${Math.floor(this.state.heroOverdrive)}%`;
    ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)';
    ctx.lineWidth = 3.4;
    ctx.strokeText(odLabel, 12, odY + 18);
    ctx.fillStyle = '#FFE9A3';
    ctx.fillText(odLabel, 12, odY + 18);
    ctx.restore();

    this.drawUnitBar(
      this.w - barW - 12,
      24,
      barW,
      this.state.enemyHp,
      this.state.enemyMaxHp,
      this.state.enemyArmor,
      this.state.enemyIsBoss ? '#E85D2A' : '#D94236',
      this.state.enemyIsBoss ? '#7A1F0B' : '#701812',
      this.state.enemyName.toUpperCase(),
      true
    );

    // Telegraphed Enemy Intent Plaque (clean riveted brass badge below Enemy HP)
    this.drawIntentPlaque(this.w - barW - 12, 44, barW);

    // 6. Floating Custom-Art Numerals
    for (const f of this.floats) {
      const u = f.life / f.maxLife;
      const pop = u < 0.14 ? 0.65 + (u / 0.14) * 0.55 : 1.2 - Math.min(0.2, (u - 0.14) * 0.8);
      const alpha = u > 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.28) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(f.x, f.y);
      ctx.scale(f.scale * pop, f.scale * pop);
      ctx.font = '900 22px "Cinzel Decorative", "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = f.stroke;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      if (f.subText) {
        ctx.font = '700 10px "Cinzel", serif';
        ctx.lineWidth = 3;
        ctx.strokeText(f.subText, 0, 17);
        ctx.fillStyle = '#FFEAA8';
        ctx.fillText(f.subText, 0, 17);
      }
      ctx.restore();
    }

    // 7. Synergy Callout Banner across Top-Center
    if (this.bannerFlash > 0 && this.bannerText) {
      const alpha = Math.min(1, this.bannerFlash * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      const bw = Math.min(this.w - 28, 286);
      const bx = (this.w - bw) * 0.5;
      const by = this.h * 0.28;
      ctx.fillStyle = 'rgba(26, 17, 9, 0.90)';
      this.roundRect(bx, by, bw, 28, 14);
      ctx.fill();
      ctx.strokeStyle = '#F2CA66';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '800 11.5px "Cinzel", serif';
      ctx.fillStyle = '#FFE89E';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.bannerText, this.w * 0.5, by + 14.5);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawIntentPlaque(x: number, y: number, w: number): void {
    const ctx = this.ctx;
    const intent = this.state.enemyIntent;
    ctx.save();
    ctx.fillStyle = this.state.enemyStunned ? 'rgba(84, 62, 16, 0.92)' : 'rgba(30, 17, 12, 0.88)';
    this.roundRect(x, y, w, 24, 8);
    ctx.fill();
    ctx.strokeStyle = this.state.enemyStunned ? '#FFE072' : intent.type === 'shatter' || intent.type === 'heavy' ? '#FF7D45' : '#C99B3B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let copy = '';
    if (this.state.enemyStunned) {
      copy = 'STAGGERED • SKIP TURN';
    } else {
      const effDmg = Math.max(0, Math.round(intent.damage * (1 - this.state.weakenedPct / 100)));
      if (intent.type === 'multi' && intent.hits) {
        copy = `⚔ ${effDmg}×${intent.hits} • ${intent.label}`;
      } else if (intent.type === 'charge') {
        copy = `⚙ +${intent.armor ?? 0} ARM • ${intent.label}`;
      } else if (intent.type === 'fortify') {
        copy = `🛡 ${effDmg} DMG +${intent.armor ?? 0}`;
      } else {
        copy = `⚔ ${effDmg} DMG • ${intent.label}`;
      }
    }

    ctx.font = '700 8.8px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.state.enemyStunned ? '#FFF0A8' : '#FFE3C4';
    ctx.fillText(copy.slice(0, 24), x + w * 0.5, y + 12.5);

    // Stagger & Heat sub-pills with crisp dark forged outline
    let tagX = x + w;
    if (this.state.enemyStagger > 0 && !this.state.enemyStunned) {
      const st = `STAGGER ${Math.min(100, this.state.enemyStagger)}%`;
      ctx.font = '800 9px "Cinzel", serif';
      ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)';
      ctx.lineWidth = 3.2;
      ctx.strokeText(st, tagX, y + 35);
      ctx.fillStyle = '#FFE98A';
      ctx.fillText(st, tagX, y + 35);
      tagX -= 84;
    }
    if (this.state.enemyHeat > 0) {
      const ht = `HEAT ${this.state.enemyHeat}`;
      ctx.font = '800 9px "Cinzel", serif';
      ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(18, 10, 4, 0.94)';
      ctx.lineWidth = 3.2;
      ctx.strokeText(ht, tagX, y + 35);
      ctx.fillStyle = '#FFA45E';
      ctx.fillText(ht, tagX, y + 35);
    }
    ctx.restore();
  }
}
