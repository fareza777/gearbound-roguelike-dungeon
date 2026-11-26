import { OwnedSymbol, SYMBOLS, TIER_COLORS } from '../data/gameData';
import { sfx } from '../audio/sfxEngine';
import { nativeBridge } from '../platform/nativeBridge';
import { assetCache } from './assetCache';
import { SynergyLine } from './combatMath';

interface ReelState {
  phase: 'idle' | 'anticipation_up' | 'spinning' | 'stopping' | 'bouncing';
  scrollOffset: number; // in cell units (1.0 = one symbol height)
  velocity: number;
  targetTimer: number;
  bounceOffset: number;
  bounceVel: number;
  strip: OwnedSymbol[]; // visual strip cycling while spinning
  finalCol: [OwnedSymbol, OwnedSymbol, OwnedSymbol];
  anticipationGlow: number;
  lastTickCell: number;
}

interface ConsoleSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface ConsoleCallbacks {
  onPullRequested: () => void;
  onToggleLock: (col: number) => void;
  onCellTapped: (row: number, col: number, sym: OwnedSymbol) => void;
}

export class ConsoleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 380;
  private h = 300;
  private dpr = 1;
  private rafId = 0;
  private lastTs = 0;
  private destroyed = false;
  private speedMult: 1 | 2 = 1;

  private reels: [ReelState, ReelState, ReelState];
  private lockedCols: [boolean, boolean, boolean] = [false, false, false];
  private locksRemaining = 0;
  private overdriveReady = false;
  private busy = false;
  private activeLines: SynergyLine[] = [];
  private highlightPulse = 0;

  private gearAngle = 0;
  private leverProgress = 0; // 0 = up, 1 = pulled fully down
  private leverVel = 0;
  private leverDragging = false;
  private leverPointerId: number | null = null;
  private leverDragStartY = 0;
  private leverTriggeredThisDrag = false;
  private lastDragTickStep = 0;

  private sparks: ConsoleSpark[] = [];
  private callbacks: ConsoleCallbacks;
  private spinResolveCb: (() => void) | null = null;

  // Layout geometry computed on resize
  private housingRect = { x: 0, y: 0, w: 0, h: 0 };
  private colRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private leverRect = { x: 0, y: 0, w: 0, h: 0 };
  private lockBtnRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  constructor(canvas: HTMLCanvasElement, initialGrid: OwnedSymbol[][], callbacks: ConsoleCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.callbacks = callbacks;

    this.reels = [0, 1, 2].map((c) => ({
      phase: 'idle',
      scrollOffset: 0,
      velocity: 0,
      targetTimer: 0,
      bounceOffset: 0,
      bounceVel: 0,
      strip: [initialGrid[0][c], initialGrid[1][c], initialGrid[2][c], initialGrid[0][c], initialGrid[1][c]],
      finalCol: [initialGrid[0][c], initialGrid[1][c], initialGrid[2][c]],
      anticipationGlow: 0,
      lastTickCell: 0
    })) as [ReelState, ReelState, ReelState];

    this.resize();
    this.bindInput();
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  setSpeed(mult: 1 | 2): void {
    this.speedMult = mult;
  }

  setHudMeta(locksRemaining: number, lockedCols: [boolean, boolean, boolean], overdriveReady: boolean): void {
    this.locksRemaining = locksRemaining;
    this.lockedCols = [...lockedCols] as [boolean, boolean, boolean];
    this.overdriveReady = overdriveReady;
  }

  setGridImmediate(grid: OwnedSymbol[][]): void {
    for (let c = 0; c < 3; c++) {
      this.reels[c].finalCol = [grid[0][c], grid[1][c], grid[2][c]];
      this.reels[c].phase = 'idle';
      this.reels[c].scrollOffset = 0;
      this.reels[c].bounceOffset = 0;
    }
    this.activeLines = [];
  }

  highlightSynergies(lines: SynergyLine[]): void {
    this.activeLines = lines;
    this.highlightPulse = 1.6;
    if (lines.length > 0) {
      sfx.playSynergyBurst();
      for (const line of lines) {
        for (const [r, c] of line.cells) {
          const rect = this.colRects[c];
          if (!rect) continue;
          const cx = rect.x + rect.w * 0.5;
          const cy = rect.y + (r + 0.5) * (rect.h / 3);
          this.spawnSparks(cx, cy, 8, '#FFE072');
        }
      }
    }
  }

  /**
   * Executes a full ultra-tactile mechanical spin with anticipation wind-up,
   * high-speed drum rotation, synchronized gears, optional dramatic Column 3
   * anticipation slowdown when 2 symbols align, and spring bounce settle!
   */
  spinTo(
    targetGrid: OwnedSymbol[][],
    deckPool: OwnedSymbol[],
    lockedCols: [boolean, boolean, boolean],
    hasAnticipationOnCol2: boolean
  ): Promise<void> {
    this.busy = true;
    this.activeLines = [];
    this.lockedCols = [...lockedCols] as [boolean, boolean, boolean];
    this.leverProgress = 1.0;
    this.leverVel = -3.8;
    sfx.playLeverPull();
    void nativeBridge.haptic('medium');

    // Steam puff burst from console side vents on lever pull!
    this.spawnSteamBurst(this.leverRect.x, this.leverRect.y + this.leverRect.h * 0.45);

    const fast = this.speedMult === 2;
    const baseStopTimes = fast ? [0.28, 0.46, hasAnticipationOnCol2 ? 0.88 : 0.64] : [0.52, 0.84, hasAnticipationOnCol2 ? 1.56 : 1.14];

    for (let c = 0; c < 3; c++) {
      const reel = this.reels[c];
      reel.finalCol = [targetGrid[0][c], targetGrid[1][c], targetGrid[2][c]];
      if (lockedCols[c]) {
        reel.phase = 'idle';
        reel.scrollOffset = 0;
        reel.bounceOffset = 0;
        continue;
      }
      // Build cycling visual drum strip from player's actual deck
      const strip: OwnedSymbol[] = [];
      for (let i = 0; i < 12; i++) {
        strip.push(deckPool[Math.floor(Math.random() * deckPool.length)] ?? targetGrid[i % 3][c]);
      }
      reel.strip = strip;
      reel.phase = 'anticipation_up';
      reel.scrollOffset = 0;
      reel.velocity = -4.2; // crisp reverse kick before rolling down!
      reel.targetTimer = baseStopTimes[c];
      reel.bounceOffset = 0;
      reel.bounceVel = 0;
      reel.anticipationGlow = c === 2 && hasAnticipationOnCol2 ? 1 : 0;
      reel.lastTickCell = 0;
    }

    if (lockedCols[0] && lockedCols[1] && lockedCols[2]) {
      this.busy = false;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.spinResolveCb = resolve;
    });
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(280, rect.width || 390);
    this.h = Math.max(220, rect.height || 300);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);

    // Reserve right 66px for the iconic ornate mechanical pull-lever!
    const leverW = Math.min(68, Math.max(54, this.w * 0.165));
    const padX = 6;
    const topLockBar = 26;
    const availW = this.w - leverW - padX * 2;
    const availH = this.h - topLockBar - 6;

    // Fit 900x690 housing aspect cleanly
    const aspect = 900 / 690;
    let hw = availW;
    let hh = hw / aspect;
    if (hh > availH) {
      hh = availH;
      hw = hh * aspect;
    }
    const hx = padX + (availW - hw) * 0.5;
    const hy = topLockBar + (availH - hh) * 0.5;
    this.housingRect = { x: hx, y: hy, w: hw, h: hh };

    // Exact drum viewport coordinates matching art_console_and_gui.py (vx=88, vy=118, vw=1024, vh=712 on 1200x920)
    const vx = hx + (88 / 1200) * hw;
    const vy = hy + (118 / 920) * hh;
    const vw = (1024 / 1200) * hw;
    const vh = (712 / 920) * hh;
    const gap = (18 / 1200) * hw;
    const cw = (vw - gap * 2) / 3;

    this.colRects = [0, 1, 2].map((c) => ({
      x: vx + c * (cw + gap),
      y: vy,
      w: cw,
      h: vh
    }));

    this.lockBtnRects = this.colRects.map((cr) => ({
      x: cr.x + cr.w * 0.5 - 30,
      y: Math.max(2, hy - 18),
      w: 60,
      h: 24
    }));

    this.leverRect = {
      x: hx + hw - 2,
      y: hy + hh * 0.08,
      w: leverW,
      h: hh * 0.84
    };
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
  }

  private getLocalPoint(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      const pt = this.getLocalPoint(e);

      // 1. Check Lock Clamp buttons above columns
      for (let c = 0; c < 3; c++) {
        const b = this.lockBtnRects[c];
        if (pt.x >= b.x - 6 && pt.x <= b.x + b.w + 6 && pt.y >= b.y - 6 && pt.y <= b.y + b.h + 10) {
          if (!this.busy) this.callbacks.onToggleLock(c);
          return;
        }
      }

      // 2. Check Pull Lever zone (supports both drag-down AND tap!)
      const lr = this.leverRect;
      if (pt.x >= lr.x - 10 && pt.x <= lr.x + lr.w + 14 && pt.y >= lr.y - 16 && pt.y <= lr.y + lr.h + 16) {
        if (this.busy) return;
        this.leverDragging = true;
        this.leverPointerId = e.pointerId;
        this.leverDragStartY = pt.y;
        this.leverTriggeredThisDrag = false;
        this.lastDragTickStep = 0;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      // 3. Check Drum Cells (tap any symbol to inspect tooltip!)
      if (!this.busy) {
        for (let c = 0; c < 3; c++) {
          const cr = this.colRects[c];
          if (pt.x >= cr.x && pt.x <= cr.x + cr.w && pt.y >= cr.y && pt.y <= cr.y + cr.h) {
            const row = Math.min(2, Math.max(0, Math.floor(((pt.y - cr.y) / cr.h) * 3)));
            this.callbacks.onCellTapped(row, c, this.reels[c].finalCol[row]);
            return;
          }
        }
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.leverDragging || e.pointerId !== this.leverPointerId) return;
      const pt = this.getLocalPoint(e);
      const travel = Math.max(60, this.leverRect.h * 0.58);
      const prog = Math.max(0, Math.min(1, (pt.y - this.leverDragStartY) / travel));
      this.leverProgress = prog;

      const step = Math.floor(prog * 5);
      if (step > this.lastDragTickStep) {
        this.lastDragTickStep = step;
        sfx.playRatchetTick(0.8);
        void nativeBridge.haptic('light');
      }

      if (prog >= 0.72 && !this.leverTriggeredThisDrag && !this.busy) {
        this.leverTriggeredThisDrag = true;
        this.leverDragging = false;
        this.callbacks.onPullRequested();
      }
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.leverDragging || e.pointerId !== this.leverPointerId) return;
      const wasTap = this.leverProgress < 0.25 && !this.leverTriggeredThisDrag;
      this.leverDragging = false;
      this.leverPointerId = null;
      if (wasTap && !this.busy) {
        this.callbacks.onPullRequested();
      }
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  private spawnSparks(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 120;
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        size: 2.2 + Math.random() * 2.8,
        color
      });
    }
  }

  private spawnSteamBurst(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      this.sparks.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 20,
        vx: 25 + Math.random() * 55,
        vy: -35 - Math.random() * 65,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.25,
        size: 6 + Math.random() * 9,
        color: 'rgba(255, 248, 232, 0.65)'
      });
    }
  }

  private loop = (ts: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.step(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    // Spring lever back to upright rest position when not dragging
    if (!this.leverDragging) {
      const k = 72, damp = 9.5;
      this.leverVel += (-k * this.leverProgress - damp * this.leverVel) * dt;
      this.leverProgress += this.leverVel * dt;
      if (Math.abs(this.leverProgress) < 0.004 && Math.abs(this.leverVel) < 0.01) {
        this.leverProgress = 0;
        this.leverVel = 0;
      }
    }

    let maxVel = 0.22; // gentle idle clockwork hum
    let anyActive = false;

    for (let c = 0; c < 3; c++) {
      const r = this.reels[c];
      if (r.phase === 'idle') continue;
      anyActive = true;

      if (r.phase === 'anticipation_up') {
        r.scrollOffset += r.velocity * dt;
        if (r.scrollOffset <= -0.32) {
          r.phase = 'spinning';
          r.velocity = this.speedMult === 2 ? 26 : 19.5;
        }
      } else if (r.phase === 'spinning') {
        r.targetTimer -= dt;
        // Dramatic anticipation slow-down on Column 2 when 2 symbols align!
        if (c === 2 && r.anticipationGlow > 0 && r.targetTimer < 0.62) {
          if (r.velocity > 11) {
            sfx.playAnticipationWhir();
          }
          r.velocity = Math.max(5.5, r.velocity * Math.pow(0.28, dt));
        }
        r.scrollOffset += r.velocity * dt;
        const tickCell = Math.floor(r.scrollOffset);
        if (tickCell > r.lastTickCell) {
          r.lastTickCell = tickCell;
          sfx.playRatchetTick(c === 2 && r.anticipationGlow > 0 ? 1.2 : 0.72);
        }
        if (r.targetTimer <= 0) {
          r.phase = 'bouncing';
          r.scrollOffset = 0;
          r.bounceOffset = 22; // Crisp downward lock-in overshoot!
          r.bounceVel = 0;
          r.velocity = 0;
          r.anticipationGlow = 0;
          sfx.playDrumStop(c);
          void nativeBridge.haptic('light');
          const cr = this.colRects[c];
          if (cr) this.spawnSparks(cr.x + cr.w * 0.5, cr.y + cr.h * 0.5, 6, '#F2CA64');
        }
      } else if (r.phase === 'bouncing') {
        const k = 280, damp = 17;
        r.bounceVel += (-k * r.bounceOffset - damp * r.bounceVel) * dt;
        r.bounceOffset += r.bounceVel * dt;
        if (Math.abs(r.bounceOffset) < 0.4 && Math.abs(r.bounceVel) < 2) {
          r.bounceOffset = 0;
          r.bounceVel = 0;
          r.phase = 'idle';
        }
      }
      maxVel = Math.max(maxVel, Math.abs(r.velocity) * 0.42);
    }

    // Rotate interlocking mechanical gears in exact proportion to drum speed!
    this.gearAngle += maxVel * dt * 1.15;

    if (this.busy && !anyActive) {
      this.busy = false;
      const cb = this.spinResolveCb;
      this.spinResolveCb = null;
      if (cb) cb();
    }

    if (this.highlightPulse > 0) {
      this.highlightPulse = Math.max(0, this.highlightPulse - dt);
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private drawGear(imgPath: string, cx: number, cy: number, radius: number, angle: number): void {
    const img = assetCache.getImage(imgPath);
    if (!img) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.w, this.h);

    const hr = this.housingRect;

    // 1. Live Interlocked Mechanical Clockwork Gears behind Console Corners!
    this.drawGear('./assets/ui/gear_brass_lg.png', hr.x + 16, hr.y + 18, 34, this.gearAngle);
    this.drawGear('./assets/ui/gear_iron_md.png', hr.x + hr.w - 14, hr.y + 20, 28, -this.gearAngle * 1.33);
    this.drawGear('./assets/ui/gear_copper_sm.png', hr.x + 12, hr.y + hr.h - 16, 25, -this.gearAngle * 1.6);
    this.drawGear('./assets/ui/gear_brass_lg.png', hr.x + hr.w - 8, hr.y + hr.h - 14, 30, this.gearAngle * 1.2);

    // 2. Render 3 Curved Cylindrical Rotating Mechanical Drums inside Viewport Channels
    for (let c = 0; c < 3; c++) {
      this.renderDrumColumn(c);
    }

    // 3. Bespoke Art-Generated Console Housing Frame Overlay (Riveted Brass, Walnut & Iron Bezel)
    const housing = assetCache.getImage('./assets/ui/console_housing.png');
    if (housing) {
      ctx.drawImage(housing, hr.x, hr.y, hr.w, hr.h);
    }

    // 4. Glowing Brass Synergy Conduits across Matching Rows / Columns / Diagonals
    if (this.activeLines.length > 0) {
      const pulse = 0.55 + Math.sin(performance.now() * 0.014) * 0.45;
      for (const line of this.activeLines) {
        const pts = line.cells.map(([r, c]) => {
          const cr = this.colRects[c];
          return { x: cr.x + cr.w * 0.5, y: cr.y + (r + 0.5) * (cr.h / 3) };
        });
        ctx.save();
        ctx.strokeStyle = `rgba(255, 214, 92, ${0.42 + pulse * 0.48})`;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#FFD452';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.stroke();

        ctx.strokeStyle = '#FFF7D4';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Glowing brass nodes at each matched tile center
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#FFF5C2';
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 5. Tactile Drum Lock Clamp Latches along Top Bezel
    for (let c = 0; c < 3; c++) {
      this.renderLockLatch(c);
    }

    // 6. Iconic Physical Mechanical Pull-Lever (Right Side)
    this.renderPullLever();

    // 7. Sparks & Steam Puffs
    for (const p of this.sparks) {
      const u = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - u);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - u * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private renderDrumColumn(c: number): void {
    const ctx = this.ctx;
    const rect = this.colRects[c];
    const reel = this.reels[c];
    const cellH = rect.h / 3;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    // Curved parchment-brass mechanical drum backing cylinder
    const bgGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    bgGrad.addColorStop(0.0, '#1D150E');
    bgGrad.addColorStop(0.18, '#3B2D1E');
    bgGrad.addColorStop(0.50, '#54422C');
    bgGrad.addColorStop(0.82, '#3B2D1E');
    bgGrad.addColorStop(1.0, '#1D150E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Subtle mechanical drum seam rings between rows
    ctx.strokeStyle = 'rgba(218, 178, 92, 0.18)';
    ctx.lineWidth = 1.2;
    for (let r = 1; r < 3; r++) {
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + r * cellH);
      ctx.lineTo(rect.x + rect.w, rect.y + r * cellH);
      ctx.stroke();
    }

    // Draw visible symbols along curved drum face
    const drawTile = (sym: OwnedSymbol, centerY: number, isMatched: boolean) => {
      // Cylindrical foreshortening based on distance from center row
      const normY = (centerY - (rect.y + rect.h * 0.5)) / (rect.h * 0.52);
      const clamped = Math.max(-1, Math.min(1, normY));
      const scaleY = Math.max(0.76, Math.cos(clamped * 0.62));
      const pad = Math.min(rect.w, cellH) * 0.08;
      const iconSize = Math.min(rect.w - pad * 2, cellH - pad * 1.4);

      ctx.save();
      ctx.translate(rect.x + rect.w * 0.5, centerY);
      const pop = isMatched ? 1 + Math.sin(performance.now() * 0.015) * 0.06 : 1;
      ctx.scale(pop, scaleY * pop);

      // Symbol medallion artwork
      const img = assetCache.getImage(`./assets/symbols/${sym.symbolId}.png`);
      if (img) {
        ctx.drawImage(img, -iconSize * 0.5, -iconSize * 0.5, iconSize, iconSize);
      }

      // Upgraded Tier II / III / IV Metallic Rim + Roman Crest Badge
      if (sym.tier > 1) {
        ctx.strokeStyle = TIER_COLORS[sym.tier];
        ctx.lineWidth = sym.tier === 4 ? 3.2 : 2.2;
        ctx.strokeRect(-iconSize * 0.45, -iconSize * 0.45, iconSize * 0.9, iconSize * 0.9);
      }

      // Compact Tier Numeral Pip (bottom-right of medallion)
      const roman = ['I', 'II', 'III', 'IV'][sym.tier - 1];
      ctx.fillStyle = 'rgba(18, 12, 6, 0.90)';
      ctx.beginPath();
      ctx.arc(iconSize * 0.34, iconSize * 0.34, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = TIER_COLORS[sym.tier];
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.font = '800 8.5px "Cinzel", serif';
      ctx.fillStyle = TIER_COLORS[sym.tier];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(roman, iconSize * 0.34, iconSize * 0.35);

      ctx.restore();
    };

    if (reel.phase === 'spinning' || reel.phase === 'anticipation_up') {
      const stripLen = reel.strip.length;
      const baseIdx = Math.floor(reel.scrollOffset);
      const frac = reel.scrollOffset - baseIdx;
      for (let r = -1; r <= 3; r++) {
        const sIdx = ((baseIdx + r) % stripLen + stripLen) % stripLen;
        const cy = rect.y + (r + frac + 0.5) * cellH;
        drawTile(reel.strip[sIdx], cy, false);
      }
      // Subtle vertical motion streak during high-speed rotation
      if (reel.velocity > 10) {
        ctx.fillStyle = 'rgba(255, 240, 195, 0.08)';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
    } else {
      for (let r = 0; r < 3; r++) {
        const isMatched = this.activeLines.some((l) => l.cells.some(([lr, lc]) => lr === r && lc === c));
        const cy = rect.y + (r + 0.5) * cellH + reel.bounceOffset;
        drawTile(reel.finalCol[r], cy, isMatched);
      }
    }

    // 3D Cylindrical Curvature Lighting Overlay (deep top/bottom shadow + central specular band!)
    const cylGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    cylGrad.addColorStop(0.0, 'rgba(6, 4, 2, 0.68)');
    cylGrad.addColorStop(0.16, 'rgba(6, 4, 2, 0.16)');
    cylGrad.addColorStop(0.45, 'rgba(255, 244, 206, 0.07)');
    cylGrad.addColorStop(0.55, 'rgba(255, 244, 206, 0.0)');
    cylGrad.addColorStop(0.84, 'rgba(6, 4, 2, 0.18)');
    cylGrad.addColorStop(1.0, 'rgba(6, 4, 2, 0.72)');
    ctx.fillStyle = cylGrad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Locked column golden brass clamp glow
    if (this.lockedCols[c]) {
      ctx.strokeStyle = 'rgba(255, 212, 92, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    }

    // Dramatic Anticipation Golden Heat Glow on Column 3!
    if (reel.anticipationGlow > 0 && reel.phase === 'spinning' && reel.targetTimer < 0.72) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.025) * 0.5;
      ctx.strokeStyle = `rgba(255, 198, 56, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
    }

    ctx.restore();
  }

  private renderLockLatch(c: number): void {
    const ctx = this.ctx;
    const b = this.lockBtnRects[c];
    const locked = this.lockedCols[c];
    const canInteract = locked || this.locksRemaining > 0;

    ctx.save();
    ctx.globalAlpha = canInteract ? 1.0 : 0.48;
    ctx.fillStyle = locked ? '#7C2414' : '#261C12';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.strokeStyle = locked ? '#FFD86B' : '#A9823C';
    ctx.lineWidth = locked ? 2.2 : 1.4;
    ctx.stroke();

    ctx.font = '800 9.5px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = locked ? '#FFF2BD' : '#E7D1A4';
    ctx.fillText(locked ? 'LOCKED' : `LOCK (${this.locksRemaining})`, b.x + b.w * 0.5, b.y + b.h * 0.53);
    ctx.restore();
  }

  private renderPullLever(): void {
    const ctx = this.ctx;
    const lr = this.leverRect;
    const cx = lr.x + lr.w * 0.54;
    const pivotY = lr.y + lr.h * 0.62;
    const topY = lr.y + lr.h * 0.14;
    const botY = lr.y + lr.h * 0.86;

    // 1. Heavy Riveted Brass Side Housing & Recessed Guide Slot
    ctx.save();
    const mountGrad = ctx.createLinearGradient(lr.x, pivotY - 46, lr.x + lr.w, pivotY + 46);
    mountGrad.addColorStop(0, '#4F381B');
    mountGrad.addColorStop(0.45, '#C89B40');
    mountGrad.addColorStop(1, '#3A2510');
    ctx.fillStyle = mountGrad;
    ctx.beginPath();
    ctx.roundRect(lr.x - 4, pivotY - 42, lr.w * 0.72, 84, 14);
    ctx.fill();
    ctx.strokeStyle = '#180E06';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Recessed dark iron lever slot track
    ctx.fillStyle = '#0E0A07';
    ctx.beginPath();
    ctx.roundRect(cx - 7, lr.y + lr.h * 0.22, 14, lr.h * 0.58, 7);
    ctx.fill();
    ctx.strokeStyle = '#B88934';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 2. Lever Arm Shaft (pivots smoothly from topY to botY based on leverProgress!)
    const knobY = topY + (botY - topY) * this.leverProgress;
    const shaftGrad = ctx.createLinearGradient(cx - 8, pivotY, cx + 8, knobY);
    shaftGrad.addColorStop(0, '#505660');
    shaftGrad.addColorStop(0.5, '#E4E9F2');
    shaftGrad.addColorStop(1, '#383C44');
    ctx.strokeStyle = shaftGrad;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, pivotY);
    ctx.lineTo(cx, knobY);
    ctx.stroke();
    ctx.strokeStyle = '#120C08';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Pivot brass axle bolt
    ctx.beginPath();
    ctx.arc(cx, pivotY, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#D9A742';
    ctx.fill();
    ctx.strokeStyle = '#191008';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // 3. Ergonomic Sculpted Burnished-Brass & Crimson-Walnut Pull Pommel Knob
    const knobR = Math.min(23, lr.w * 0.38);
    if (!this.busy) {
      // Subtle inviting golden glow ring (stronger when Overdrive ready!)
      const pulse = 0.5 + Math.sin(performance.now() * 0.007) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, knobY, knobR + 5 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = this.overdriveReady
        ? `rgba(255, 212, 72, ${0.55 + pulse * 0.45})`
        : `rgba(244, 198, 92, ${0.28 + pulse * 0.35})`;
      ctx.lineWidth = this.overdriveReady ? 4 : 2.5;
      ctx.stroke();
    }

    const kg = ctx.createRadialGradient(cx - knobR * 0.32, knobY - knobR * 0.35, 3, cx, knobY, knobR);
    if (this.overdriveReady) {
      kg.addColorStop(0, '#FFF6BE');
      kg.addColorStop(0.45, '#F2AE2E');
      kg.addColorStop(1, '#7A3E0A');
    } else {
      kg.addColorStop(0, '#F5644C');
      kg.addColorStop(0.5, '#A62318');
      kg.addColorStop(1, '#3B0A07');
    }
    ctx.beginPath();
    ctx.arc(cx, knobY, knobR, 0, Math.PI * 2);
    ctx.fillStyle = kg;
    ctx.fill();
    ctx.strokeStyle = '#F2C964';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Specular highlight crescent on pommel
    ctx.beginPath();
    ctx.arc(cx - knobR * 0.28, knobY - knobR * 0.28, knobR * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 250, 232, 0.55)';
    ctx.fill();

    // Crisp etched PULL label inside knob
    ctx.font = '900 9.5px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.overdriveReady ? '#291404' : '#FFF4D8';
    ctx.fillText(this.busy ? 'SPIN' : 'PULL', cx, knobY + 0.5);

    // Subtle downward arrow hint below knob when idle
    if (!this.busy && this.leverProgress < 0.1) {
      const bob = Math.sin(performance.now() * 0.008) * 3;
      ctx.fillStyle = '#F5D276';
      ctx.font = '800 13px sans-serif';
      ctx.fillText('▼', cx, knobY + knobR + 13 + bob);
    }
    ctx.restore();
  }
}
