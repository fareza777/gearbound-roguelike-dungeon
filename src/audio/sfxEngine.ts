/**
 * 100% NON-MUSICAL Procedural Mechanical & Combat Foley SFX Engine.
 * STRICT PRINSIP SALAF COMPLIANCE:
 * - ZERO musical instruments, ZERO melodies, ZERO pitched chords, ZERO BGM music.
 * - Purely tactile mechanical & natural Foley synthesized via Web Audio API:
 *   filtered noise bursts, wooden/iron thuds, ratchet clicks, lever clanks,
 *   steam vents, steel clashes, shield impacts, anvil strikes, subtle wind/torch ambience.
 */

class MechanicalSfxEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private shortNoiseBuf: AudioBuffer | null = null;
  private sfxEnabled = true;
  private ambienceEnabled = true;
  private ambienceNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastRatchetAt = 0;

  configure(sfxEnabled: boolean, ambienceEnabled: boolean): void {
    this.sfxEnabled = sfxEnabled;
    this.ambienceEnabled = ambienceEnabled;
    if (!ambienceEnabled) {
      this.stopAmbience();
    } else if (this.ctx && !this.ambienceNodes) {
      this.startAmbience();
    }
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.noiseBuf = this.buildNoiseBuffer(this.ctx, 1.5);
      this.shortNoiseBuf = this.buildNoiseBuffer(this.ctx, 0.08);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ambienceEnabled && !this.ambienceNodes) {
      this.startAmbience();
    }
  }

  private buildNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private startAmbience(): void {
    if (!this.ctx || !this.noiseBuf || this.ambienceNodes) return;
    // Gentle low-passed wind/stone hall draft (purely natural air ambience, zero tone/pitch)
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 175;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.022;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.ambienceNodes = { src, gain };
  }

  private stopAmbience(): void {
    if (!this.ambienceNodes) return;
    try {
      this.ambienceNodes.src.stop();
      this.ambienceNodes.src.disconnect();
      this.ambienceNodes.gain.disconnect();
    } catch {
      // Ignore
    }
    this.ambienceNodes = null;
  }

  private playFilteredNoise(
    duration: number,
    freq: number,
    q: number,
    filterType: BiquadFilterType,
    volume: number,
    delay = 0,
    freqEnd?: number
  ): void {
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx || !this.noiseBuf) return;

    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.008, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 1.2);
    src.stop(now + duration + 0.02);
  }

  private playThud(duration: number, startHz: number, endHz: number, volume: number, delay = 0): void {
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    // Pure non-tonal percussive sub-impact envelope (fast pitch-drop membrane/iron thud)
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, endHz), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  /** Tactile UI wooden/brass latch tap */
  playTap(): void {
    this.playFilteredNoise(0.032, 1650, 2.2, 'bandpass', 0.16);
    this.playThud(0.028, 180, 62, 0.10);
  }

  /** Heavy mechanical pull-lever engagement clank + steam release */
  playLeverPull(): void {
    this.playThud(0.085, 160, 46, 0.28, 0.0);
    this.playFilteredNoise(0.065, 920, 2.5, 'bandpass', 0.24, 0.01, 420);
    // Spring latch snap + crisp steam hiss
    this.playFilteredNoise(0.045, 2400, 3.0, 'bandpass', 0.22, 0.09);
    this.playFilteredNoise(0.24, 3400, 0.9, 'highpass', 0.10, 0.07, 1500);
  }

  /** Crisp clockwork ratchet detent tick while drums spin (throttled >=70ms for zero audio-thread lag!) */
  playRatchetTick(intensity = 1.0): void {
    if (!this.sfxEnabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastRatchetAt < 70) return;
    this.lastRatchetAt = nowMs;
    this.unlock();
    if (!this.ctx || !this.shortNoiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.shortNoiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600 + Math.random() * 450;
    filter.Q.value = 3.2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.024);
  }

  /** Heavy iron mechanical drum lock-in thud */
  playDrumStop(colIndex: number): void {
    const base = 138 - colIndex * 14;
    this.playThud(0.11, base, 36, 0.34);
    this.playFilteredNoise(0.06, 1300 - colIndex * 120, 2.0, 'bandpass', 0.22);
    this.playFilteredNoise(0.04, 3100, 3.8, 'bandpass', 0.12, 0.018);
  }

  /** Anticipation high-tension mechanical whir on Column 3 */
  playAnticipationWhir(): void {
    this.playFilteredNoise(0.38, 800, 1.8, 'bandpass', 0.13, 0, 2200);
  }

  /** Lock clamp brass latch engagement */
  playLockClamp(locked: boolean): void {
    if (locked) {
      this.playThud(0.055, 210, 75, 0.22);
      this.playFilteredNoise(0.04, 2800, 3.5, 'bandpass', 0.22, 0.02);
    } else {
      this.playFilteredNoise(0.035, 1900, 2.6, 'bandpass', 0.16);
    }
  }

  /** Synergy line conduit spark-snap */
  playSynergyBurst(): void {
    this.playFilteredNoise(0.14, 3200, 1.4, 'bandpass', 0.22, 0, 1100);
    this.playThud(0.10, 190, 58, 0.24);
  }

  /** Forged steel sword slash & metallic impact */
  playSwordSlash(heavy = false): void {
    this.playFilteredNoise(0.13, 2900, 1.1, 'bandpass', heavy ? 0.28 : 0.20, 0, 780);
    this.playThud(heavy ? 0.16 : 0.10, heavy ? 155 : 190, 38, heavy ? 0.42 : 0.26, 0.045);
    this.playFilteredNoise(0.08, 3800, 3.2, 'bandpass', heavy ? 0.24 : 0.16, 0.048);
  }

  /** Crossbow mechanical release & bolt impact */
  playCrossbowShot(): void {
    this.playFilteredNoise(0.055, 1450, 2.2, 'bandpass', 0.24, 0, 620);
    this.playFilteredNoise(0.09, 3600, 1.0, 'highpass', 0.14, 0.02, 1600);
    this.playThud(0.07, 175, 55, 0.24, 0.08);
  }

  /** Tower shield heavy iron brace/block clang */
  playShieldBlock(): void {
    this.playThud(0.09, 170, 52, 0.30);
    this.playFilteredNoise(0.11, 2100, 4.5, 'bandpass', 0.25, 0, 1400);
  }

  /** War mace / heavy boss slam crunch */
  playHeavySlam(): void {
    this.playThud(0.22, 125, 28, 0.48);
    this.playFilteredNoise(0.18, 680, 1.2, 'lowpass', 0.32, 0.01, 180);
    this.playFilteredNoise(0.09, 2200, 2.4, 'bandpass', 0.18, 0.02);
  }

  /** Field kit bandage/latch repair sound */
  playRepairKit(): void {
    this.playFilteredNoise(0.14, 1500, 1.4, 'bandpass', 0.14, 0, 2400);
    this.playFilteredNoise(0.08, 2200, 2.2, 'bandpass', 0.12, 0.09);
  }

  /** Anvil Forge merge hammer impact + steam quench */
  playForgeMerge(): void {
    this.playThud(0.16, 180, 42, 0.38);
    this.playFilteredNoise(0.14, 3400, 4.0, 'bandpass', 0.26, 0.01, 1800);
    this.playFilteredNoise(0.30, 3800, 0.8, 'highpass', 0.16, 0.11, 1200);
  }

  /** Expedition room victory stamp & latch fanfare (pure mechanical, zero melody) */
  playVictoryStamp(): void {
    this.playThud(0.13, 150, 42, 0.36, 0.0);
    this.playFilteredNoise(0.08, 2400, 2.6, 'bandpass', 0.22, 0.08);
    this.playThud(0.16, 175, 48, 0.38, 0.15);
    this.playFilteredNoise(0.22, 3000, 1.4, 'bandpass', 0.20, 0.16, 1200);
  }
}

export const sfx = new MechanicalSfxEngine();
