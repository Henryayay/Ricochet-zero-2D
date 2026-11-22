import type { WeaponId } from './entities.ts';

const MASTER_GAIN = 0.35;
const BGM_GAIN = 0.42;
const DEFAULT_FILTER_FREQ = 18000;
const SLOW_MO_FILTER_FREQ = 700;

const BGM_BPM = 136;
const BGM_STEP_SEC = 60 / BGM_BPM / 4; // 16th-note step (~0.1103s)
const BGM_LOOKAHEAD_SEC = 0.14;
const BGM_SCHEDULER_MS = 25;

// Midi-to-Hz helper for crisp musical patterns
function midiHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 4-bar (64-step) E-minor / Dorian groovy synthwave progression:
// Bar 1: Em | Bar 2: G -> D | Bar 3: C | Bar 4: D -> B7
// Funky octave-jumping slap bassline (MIDI notes, 0 = rest)
const BASS_PATTERN: readonly number[] = [
  // Bar 1 (Em: E2=40, E3=52, G2=43, D2=38)
  40, 0, 52, 40,  0, 40, 52, 0,   40, 43, 52, 40,  0, 52, 43, 38,
  // Bar 2 (G -> D: G2=43, G3=55, D2=38, D3=50, F#2=42)
  43, 0, 55, 43,  0, 43, 55, 0,   38, 0, 50, 38,   42, 0, 50, 42,
  // Bar 3 (C: C2=36, C3=48, E2=40, G2=43)
  36, 0, 48, 36,  0, 36, 48, 0,   36, 40, 48, 43,  0, 48, 43, 40,
  // Bar 4 (D -> B7: D2=38, D3=50, B1=35, B2=47, F#2=42, A2=45)
  38, 0, 50, 38,  0, 38, 50, 38,  35, 0, 47, 35,   42, 45, 47, 50,
];

// Syncopated arcade hook lead melody (MIDI notes, 0 = rest)
const LEAD_PATTERN: readonly number[] = [
  // Bar 1 (Em hook: E4=64, G4=67, A4=69, B4=71, D5=74)
  64, 0, 67, 0,   71, 0, 69, 67,  0, 64, 67, 0,   74, 0, 71, 69,
  // Bar 2 (G -> D: G4=67, B4=71, D5=74, A4=69, F#4=66)
  67, 0, 71, 0,   74, 0, 71, 69,  0, 66, 69, 0,   74, 71, 69, 66,
  // Bar 3 (C lift: E4=64, G4=67, C5=72, B4=71, E5=76)
  64, 0, 67, 72,  0, 71, 67, 0,   72, 0, 76, 0,   74, 72, 71, 67,
  // Bar 4 (D -> B7 tension: A4=69, F#4=66, B4=71, D#5=75, E5=76)
  69, 0, 74, 0,   71, 69, 66, 0,  71, 0, 75, 0,   76, 0, 75, 71,
];

// 3-note chord arpeggios per bar (Em, G/D, C, D/B7)
const ARP_CHORDS: readonly (readonly [number, number, number])[] = [
  [52, 55, 59], // Bar 1: Em (E3, G3, B3)
  [55, 59, 62], // Bar 2a: G (G3, B3, D4)
  [50, 54, 57], // Bar 2b: D (D3, F#3, A3)
  [48, 52, 55], // Bar 3: C (C3, E3, G3)
  [50, 54, 57], // Bar 4a: D (D3, F#3, A3)
  [47, 51, 54], // Bar 4b: B7/B (B2, D#3, F#3)
];

interface ToneOptions {
  type: OscillatorType;
  startFreq: number;
  endFreq?: number;
  duration: number;
  gain: number;
  delay?: number;
  ramp?: 'exp' | 'linear';
}

interface NoiseOptions {
  duration: number;
  gain: number;
  delay?: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterEndFreq?: number;
  q?: number;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  const g = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  private bgmPlaying = false;
  private bgmPaused = false;
  private bgmIntensity: 0 | 1 | 2 = 0;
  private bgmStep = 0;
  private bgmNextNoteTime = 0;
  private bgmTimerId: ReturnType<typeof setInterval> | null = null;

  /** Lazily create or resume the Web Audio graph. Safe to call in non-browser environments. */
  init(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return true;
    }

    const Ctor = getAudioContextConstructor();
    if (!Ctor) return false;

    try {
      const ctx = new Ctor();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(DEFAULT_FILTER_FREQ, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.muted ? 0 : MASTER_GAIN, ctx.currentTime);

      const bgm = ctx.createGain();
      bgm.gain.setValueAtTime(BGM_GAIN, ctx.currentTime);

      bgm.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterFilter = filter;
      this.masterGain = gain;
      this.bgmGain = bgm;
      this.noiseBuffer = this.createNoiseBuffer(ctx, 1.0);

      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (this.bgmPlaying && this.bgmTimerId === null) {
        this.startBgmScheduler();
      }
      return true;
    } catch {
      this.ctx = null;
      this.masterFilter = null;
      this.masterGain = null;
      this.bgmGain = null;
      this.noiseBuffer = null;
      return false;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, now, 0.015);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Start the procedural retro synthwave background groove (requires user gesture init first). */
  startMusic(intensity: 0 | 1 | 2 = 1): void {
    this.bgmIntensity = intensity;
    this.bgmPlaying = true;
    this.bgmPaused = false;
    if (!this.ctx) {
      if (!this.init()) return;
    }
    if (this.bgmTimerId === null) {
      this.startBgmScheduler();
    }
  }

  stopMusic(): void {
    this.bgmPlaying = false;
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  /** Adjust groove energy: 0 = chill bass+hats (menu/draft), 1 = full groove, 2 = overdrive (boss/high flow). */
  setMusicIntensity(intensity: 0 | 1 | 2): void {
    this.bgmIntensity = intensity;
  }

  setBackgroundPaused(paused: boolean): void {
    this.bgmPaused = paused;
    if (!this.ctx) return;
    if (paused) {
      if (this.bgmTimerId !== null) {
        clearInterval(this.bgmTimerId);
        this.bgmTimerId = null;
      }
    } else if (this.bgmPlaying) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      this.bgmNextNoteTime = this.ctx.currentTime + 0.04;
      if (this.bgmTimerId === null) {
        this.startBgmScheduler();
      }
    }
  }

  private startBgmScheduler(): void {
    if (!this.ctx || typeof setInterval === 'undefined') return;
    this.bgmNextNoteTime = this.ctx.currentTime + 0.05;
    this.bgmTimerId = setInterval(() => {
      this.pumpBgmScheduler();
    }, BGM_SCHEDULER_MS);
  }

  private pumpBgmScheduler(): void {
    if (!this.bgmPlaying || this.bgmPaused || !this.ctx || !this.bgmGain) return;
    if (this.muted || this.ctx.state === 'suspended') {
      // Keep cursor synced without queuing stale notes while muted/suspended
      this.bgmNextNoteTime = this.ctx.currentTime + 0.05;
      return;
    }

    const horizon = this.ctx.currentTime + BGM_LOOKAHEAD_SEC;
    let guard = 0;
    while (this.bgmNextNoteTime < horizon && guard < 8) {
      // Subtle 16th-note swing on odd steps for groovy bounce
      const swingOffset = this.bgmStep % 2 === 1 ? BGM_STEP_SEC * 0.09 : 0;
      this.scheduleBgmStep(this.bgmStep, this.bgmNextNoteTime + swingOffset);
      this.bgmNextNoteTime += BGM_STEP_SEC;
      this.bgmStep = (this.bgmStep + 1) % 64;
      guard++;
    }
  }

  private scheduleBgmStep(step: number, time: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const ctx = this.ctx;
    const dest = this.bgmGain;
    const stepInBar = step % 16;
    const intensity = this.bgmIntensity;

    // 1. Kick drum: punchy 4-on-the-floor + syncopated pickup on step 14 in bars 2 & 4
    const isFourOnFloor = stepInBar % 4 === 0;
    const isKickPickup = (step === 30 || step === 62) && intensity >= 1;
    if (isFourOnFloor || isKickPickup) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(148, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.55, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
      osc.connect(env);
      env.connect(dest);
      osc.start(time);
      osc.stop(time + 0.16);
    }

    // 2. Gated retro snare on beats 2 & 4 (steps 4, 12) + ghost fill on bar 4 step 15
    const isSnare = stepInBar === 4 || stepInBar === 12;
    const isSnareFill = step === 63 && intensity >= 1;
    if (isSnare || isSnareFill) {
      const volScale = isSnare ? 1.0 : 0.55;
      // Snare body thump
      const bodyOsc = ctx.createOscillator();
      const bodyEnv = ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(215, time);
      bodyOsc.frequency.exponentialRampToValueAtTime(95, time + 0.08);
      bodyEnv.gain.setValueAtTime(0.0001, time);
      bodyEnv.gain.linearRampToValueAtTime(0.26 * volScale, time + 0.003);
      bodyEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      bodyOsc.connect(bodyEnv);
      bodyEnv.connect(dest);
      bodyOsc.start(time);
      bodyOsc.stop(time + 0.1);

      // Gated noise crack
      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1750, time);
        bp.Q.setValueAtTime(0.85, time);
        const nEnv = ctx.createGain();
        nEnv.gain.setValueAtTime(0.28 * volScale, time);
        nEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
        src.connect(bp);
        bp.connect(nEnv);
        nEnv.connect(dest);
        src.start(time);
        src.stop(time + 0.14);
      }
    }

    // 3. Groovy 16th-note hi-hats (off-beat accents + open hat on step 10/14)
    if (this.noiseBuffer && (intensity >= 1 || step % 2 === 0)) {
      const isOffBeat = stepInBar % 4 === 2;
      const isOpenHat = stepInBar === 10 && intensity >= 1;
      const hatGain = isOpenHat ? 0.11 : isOffBeat ? 0.095 : step % 2 === 0 ? 0.045 : 0.03;
      const hatDur = isOpenHat ? 0.11 : 0.032;

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(isOpenHat ? 6200 : 7800, time);
      const env = ctx.createGain();
      env.gain.setValueAtTime(hatGain, time);
      env.gain.exponentialRampToValueAtTime(0.0001, time + hatDur);
      src.connect(hp);
      hp.connect(env);
      env.connect(dest);
      src.start(time);
      src.stop(time + hatDur + 0.01);
    }

    // 4. Funky slap-synth bassline (sawtooth + sub square through plucking resonant LP filter)
    const bassMidi = BASS_PATTERN[step];
    if (bassMidi > 0) {
      const freq = midiHz(bassMidi);
      const dur = BGM_STEP_SEC * 0.92;

      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(freq, time);

      const sub = ctx.createOscillator();
      sub.type = 'square';
      sub.frequency.setValueAtTime(freq, time);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.setValueAtTime(3.6, time);
      lp.frequency.setValueAtTime(2100, time);
      lp.frequency.exponentialRampToValueAtTime(240, time + dur);

      const bEnv = ctx.createGain();
      bEnv.gain.setValueAtTime(0.0001, time);
      bEnv.gain.linearRampToValueAtTime(0.24, time + 0.006);
      bEnv.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.45, time);

      saw.connect(lp);
      sub.connect(subGain);
      subGain.connect(lp);
      lp.connect(bEnv);
      bEnv.connect(dest);

      saw.start(time);
      sub.start(time);
      saw.stop(time + dur + 0.02);
      sub.stop(time + dur + 0.02);
    }

    // 5. Driving 16th-note synth arp (active during gameplay)
    if (intensity >= 1) {
      const chordIdx =
        step < 16 ? 0 : step < 24 ? 1 : step < 32 ? 2 : step < 48 ? 3 : step < 56 ? 4 : 5;
      const chord = ARP_CHORDS[chordIdx];
      const arpMidi = chord[step % 3] + (intensity === 2 && step % 6 >= 3 ? 12 : 0);
      const arpOsc = ctx.createOscillator();
      const arpEnv = ctx.createGain();
      arpOsc.type = 'square';
      arpOsc.frequency.setValueAtTime(midiHz(arpMidi), time);
      arpEnv.gain.setValueAtTime(0.0001, time);
      arpEnv.gain.linearRampToValueAtTime(intensity === 2 ? 0.055 : 0.04, time + 0.004);
      arpEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
      arpOsc.connect(arpEnv);
      arpEnv.connect(dest);
      arpOsc.start(time);
      arpOsc.stop(time + 0.085);
    }

    // 6. Adrenaline retro lead hook
    const leadMidi = LEAD_PATTERN[step];
    if (leadMidi > 0 && intensity >= 1) {
      const leadDur = BGM_STEP_SEC * 1.45;
      const freq = midiHz(leadMidi);
      const leadOsc = ctx.createOscillator();
      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(freq * 0.985, time);
      leadOsc.frequency.exponentialRampToValueAtTime(freq, time + 0.022);

      const leadFilter = ctx.createBiquadFilter();
      leadFilter.type = 'lowpass';
      leadFilter.frequency.setValueAtTime(intensity === 2 ? 4200 : 2900, time);

      const leadEnv = ctx.createGain();
      leadEnv.gain.setValueAtTime(0.0001, time);
      leadEnv.gain.linearRampToValueAtTime(intensity === 2 ? 0.115 : 0.095, time + 0.008);
      leadEnv.gain.exponentialRampToValueAtTime(0.0001, time + leadDur);

      leadOsc.connect(leadFilter);
      leadFilter.connect(leadEnv);
      leadEnv.connect(dest);
      leadOsc.start(time);
      leadOsc.stop(time + leadDur + 0.02);

      // Boss / High-Flow octave shimmer
      if (intensity === 2) {
        const octOsc = ctx.createOscillator();
        const octEnv = ctx.createGain();
        octOsc.type = 'triangle';
        octOsc.frequency.setValueAtTime(freq * 2, time);
        octEnv.gain.setValueAtTime(0.0001, time);
        octEnv.gain.linearRampToValueAtTime(0.055, time + 0.008);
        octEnv.gain.exponentialRampToValueAtTime(0.0001, time + leadDur * 0.8);
        octOsc.connect(octEnv);
        octEnv.connect(dest);
        octOsc.start(time);
        octOsc.stop(time + leadDur);
      }
    }
  }

  playBounce(chargeTier: number, overheated = false): void {
    const out = this.prepare();
    if (!out) return;

    if (overheated) {
      this.playTone(out, {
        type: 'sawtooth',
        startFreq: 180,
        endFreq: 90,
        duration: 0.14,
        gain: 0.28,
        ramp: 'linear',
      });
      return;
    }

    const tier = Math.max(0, Math.floor(chargeTier));
    if (tier === 0) {
      // Soft subtle tick (pentatonic root C5 damped quickly)
      this.playTone(out, {
        type: 'triangle',
        startFreq: 523.25,
        endFreq: 392.0,
        duration: 0.045,
        gain: 0.1,
      });
      return;
    }

    // Pentatonic notes: C5=523.25, D5=587.33, E5=659.25, G5=783.99, A5=880, C6=1046.5
    if (tier === 1) {
      this.playTone(out, {
        type: 'triangle',
        startFreq: 659.25,
        duration: 0.11,
        gain: 0.22,
      });
      return;
    }

    if (tier === 2) {
      this.playTone(out, {
        type: 'triangle',
        startFreq: 783.99,
        duration: 0.13,
        gain: 0.25,
      });
      this.playTone(out, {
        type: 'sine',
        startFreq: 587.33,
        duration: 0.09,
        gain: 0.1,
      });
      return;
    }

    // Tier 3+: C6 sparkle (two-note harmonic)
    this.playTone(out, {
      type: 'triangle',
      startFreq: 1046.5,
      duration: 0.16,
      gain: 0.24,
    });
    this.playTone(out, {
      type: 'sine',
      startFreq: 1567.98,
      duration: 0.18,
      gain: 0.16,
      delay: 0.025,
    });
  }

  playBumper(): void {
    const out = this.prepare();
    if (!out) return;

    this.playTone(out, {
      type: 'square',
      startFreq: 660,
      endFreq: 1320,
      duration: 0.11,
      gain: 0.2,
    });
    this.playTone(out, {
      type: 'triangle',
      startFreq: 990,
      endFreq: 1320,
      duration: 0.15,
      gain: 0.22,
      delay: 0.02,
    });
  }

  playRam(heavy = false): void {
    const out = this.prepare();
    if (!out) return;

    const scale = heavy ? 1.3 : 1.0;
    this.playTone(out, {
      type: 'sine',
      startFreq: heavy ? 165 : 150,
      endFreq: 42,
      duration: heavy ? 0.16 : 0.11,
      gain: Math.min(0.65, 0.45 * scale),
    });
    this.playNoise(out, {
      duration: heavy ? 0.09 : 0.055,
      gain: 0.22 * scale,
      filterType: 'bandpass',
      filterFreq: heavy ? 900 : 1200,
      q: 1.0,
    });
  }

  playWallSlam(): void {
    const out = this.prepare();
    if (!out) return;

    this.playTone(out, {
      type: 'sine',
      startFreq: 110,
      endFreq: 28,
      duration: 0.24,
      gain: 0.6,
    });
    this.playTone(out, {
      type: 'triangle',
      startFreq: 190,
      endFreq: 55,
      duration: 0.14,
      gain: 0.3,
    });
    this.playNoise(out, {
      duration: 0.14,
      gain: 0.4,
      filterType: 'highpass',
      filterFreq: 750,
      q: 0.8,
    });
  }

  playWeapon(weapon: WeaponId, chargeTier: number): void {
    const out = this.prepare();
    if (!out) return;

    const tier = Math.max(0, Math.min(3, chargeTier));
    const boost = 1 + tier * 0.15;

    switch (weapon) {
      case 'railgun': {
        // Piercing laser zap downward FM/saw sweep
        const { ctx, dest } = out;
        const now = ctx.currentTime;
        const dur = 0.22 + tier * 0.03;

        const carrier = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const env = ctx.createGain();

        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(1450 + tier * 160, now);
        carrier.frequency.exponentialRampToValueAtTime(140, now + dur);

        mod.type = 'square';
        mod.frequency.setValueAtTime(320 + tier * 40, now);
        mod.frequency.exponentialRampToValueAtTime(60, now + dur);
        modGain.gain.setValueAtTime(480 * boost, now);
        modGain.gain.exponentialRampToValueAtTime(10, now + dur);

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(Math.min(0.36, 0.25 * boost), now + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(env);
        env.connect(dest);

        mod.start(now);
        carrier.start(now);
        mod.stop(now + dur + 0.02);
        carrier.stop(now + dur + 0.02);
        break;
      }

      case 'shotgun': {
        // Punchy noise burst + low boom
        this.playNoise(out, {
          duration: 0.15 + tier * 0.02,
          gain: Math.min(0.55, 0.38 * boost),
          filterType: 'lowpass',
          filterFreq: 2600 + tier * 350,
          filterEndFreq: 420,
          q: 0.9,
        });
        this.playTone(out, {
          type: 'sine',
          startFreq: 145,
          endFreq: 38,
          duration: 0.16,
          gain: Math.min(0.55, 0.42 * boost),
        });
        break;
      }

      case 'sawblade': {
        // Metallic spinning whir triangle/saw modulation
        const { ctx, dest } = out;
        const now = ctx.currentTime;
        const dur = 0.2 + tier * 0.03;

        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const env = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360 + tier * 45, now);
        osc.frequency.linearRampToValueAtTime(520 + tier * 60, now + dur * 0.5);
        osc.frequency.linearRampToValueAtTime(280, now + dur);

        lfo.type = 'triangle';
        lfo.frequency.setValueAtTime(34 + tier * 6, now);
        lfoGain.gain.setValueAtTime(95 * boost, now);

        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(Math.min(0.32, 0.22 * boost), now + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(env);
        env.connect(dest);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + dur + 0.02);
        osc.stop(now + dur + 0.02);
        break;
      }

      case 'arccoil': {
        // Crackling high-freq square/noise arpeggio
        const freqs = [920, 1280, 1660, 2040];
        const count = Math.min(freqs.length, 3 + (tier > 1 ? 1 : 0));
        for (let i = 0; i < count; i++) {
          this.playTone(out, {
            type: 'square',
            startFreq: freqs[i] * (1 + tier * 0.06),
            endFreq: freqs[i] * 0.85,
            duration: 0.045,
            gain: Math.min(0.24, 0.16 * boost),
            delay: i * 0.024,
          });
        }
        this.playNoise(out, {
          duration: 0.11 + tier * 0.02,
          gain: Math.min(0.32, 0.22 * boost),
          filterType: 'highpass',
          filterFreq: 2400,
          q: 1.4,
        });
        break;
      }
    }
  }

  playSlowMoEnter(): void {
    const out = this.prepare();
    if (!out || !this.masterFilter) return;

    const now = out.ctx.currentTime;
    const freq = this.masterFilter.frequency;
    freq.cancelScheduledValues(now);
    freq.setValueAtTime(Math.max(200, freq.value), now);
    freq.exponentialRampToValueAtTime(SLOW_MO_FILTER_FREQ, now + 0.18);

    this.playTone(out, {
      type: 'sine',
      startFreq: 130,
      endFreq: 55,
      duration: 0.22,
      gain: 0.28,
    });
  }

  playSlowMoExit(): void {
    if (!this.ctx || !this.masterFilter) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const freq = this.masterFilter.frequency;
    freq.cancelScheduledValues(now);
    freq.setValueAtTime(Math.max(200, freq.value), now);
    freq.exponentialRampToValueAtTime(DEFAULT_FILTER_FREQ, now + 0.18);
  }

  playShieldBreak(): void {
    const out = this.prepare();
    if (!out) return;

    this.playNoise(out, {
      duration: 0.22,
      gain: 0.36,
      filterType: 'highpass',
      filterFreq: 2200,
      q: 1.5,
    });

    const notes = [1975.53, 1567.98, 1174.66, 880.0];
    for (let i = 0; i < notes.length; i++) {
      this.playTone(out, {
        type: 'triangle',
        startFreq: notes[i],
        duration: 0.08,
        gain: 0.2,
        delay: i * 0.032,
      });
    }
  }

  playHpHit(): void {
    const out = this.prepare();
    if (!out) return;

    this.playTone(out, {
      type: 'sawtooth',
      startFreq: 140,
      endFreq: 55,
      duration: 0.16,
      gain: 0.34,
      ramp: 'linear',
    });
    this.playTone(out, {
      type: 'square',
      startFreq: 95,
      endFreq: 42,
      duration: 0.14,
      gain: 0.24,
      delay: 0.015,
      ramp: 'linear',
    });
    this.playNoise(out, {
      duration: 0.1,
      gain: 0.3,
      filterType: 'bandpass',
      filterFreq: 650,
      q: 1.2,
    });
  }

  playShieldDeflect(): void {
    const out = this.prepare();
    if (!out) return;

    // Metallic clang with inharmonic partials
    this.playTone(out, {
      type: 'square',
      startFreq: 740,
      endFreq: 520,
      duration: 0.12,
      gain: 0.22,
    });
    this.playTone(out, {
      type: 'triangle',
      startFreq: 1185,
      endFreq: 980,
      duration: 0.14,
      gain: 0.24,
    });
  }

  playExplosion(): void {
    const out = this.prepare();
    if (!out) return;

    this.playTone(out, {
      type: 'sine',
      startFreq: 120,
      endFreq: 26,
      duration: 0.38,
      gain: 0.6,
    });
    this.playNoise(out, {
      duration: 0.36,
      gain: 0.48,
      filterType: 'lowpass',
      filterFreq: 1600,
      filterEndFreq: 180,
      q: 0.7,
    });
  }

  playOverheatWarn(): void {
    const out = this.prepare();
    if (!out) return;

    this.playTone(out, {
      type: 'square',
      startFreq: 1120,
      endFreq: 940,
      duration: 0.075,
      gain: 0.22,
      ramp: 'linear',
    });
  }

  playRoomClear(): void {
    const out = this.prepare();
    if (!out) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      this.playTone(out, {
        type: 'triangle',
        startFreq: notes[i],
        duration: i === notes.length - 1 ? 0.28 : 0.12,
        gain: 0.24,
        delay: i * 0.075,
      });
    }
  }

  playDraftPick(): void {
    const out = this.prepare();
    if (!out) return;

    const chord = [523.25, 659.25, 783.99];
    for (let i = 0; i < chord.length; i++) {
      this.playTone(out, {
        type: 'triangle',
        startFreq: chord[i],
        duration: 0.22,
        gain: 0.18,
        delay: i * 0.015,
      });
    }
  }

  playKill(combo = 1): void {
    const out = this.prepare();
    if (!out) return;

    const steps = Math.max(0, Math.min(10, combo - 1));
    const baseFreq = 440 * Math.pow(1.06, steps);
    this.playTone(out, {
      type: 'sine',
      startFreq: baseFreq,
      endFreq: baseFreq * 1.45,
      duration: 0.075,
      gain: 0.24,
    });
  }

  private prepare(): { ctx: AudioContext; dest: AudioNode } | null {
    if (this.muted) return null;
    if (!this.ctx || !this.masterFilter) {
      if (!this.init()) return null;
    }
    if (!this.ctx || !this.masterFilter) return null;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return { ctx: this.ctx, dest: this.masterFilter };
  }

  private playTone(
    out: { ctx: AudioContext; dest: AudioNode },
    opts: ToneOptions,
  ): void {
    const { ctx, dest } = out;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const end = start + Math.max(0.01, opts.duration);

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(20, opts.startFreq), start);
    if (opts.endFreq !== undefined) {
      const target = Math.max(20, opts.endFreq);
      if (opts.ramp === 'linear') {
        osc.frequency.linearRampToValueAtTime(target, end);
      } else {
        osc.frequency.exponentialRampToValueAtTime(target, end);
      }
    }

    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(opts.gain, start + Math.min(0.01, opts.duration * 0.25));
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(env);
    env.connect(dest);

    osc.start(start);
    osc.stop(end + 0.02);
  }

  private playNoise(
    out: { ctx: AudioContext; dest: AudioNode },
    opts: NoiseOptions,
  ): void {
    const { ctx, dest } = out;
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.createNoiseBuffer(ctx, 1.0);
    }

    const start = ctx.currentTime + (opts.delay ?? 0);
    const dur = Math.max(0.01, opts.duration);
    const end = start + dur;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const env = ctx.createGain();
    env.gain.setValueAtTime(opts.gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    if (opts.filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType;
      filter.frequency.setValueAtTime(opts.filterFreq ?? 1000, start);
      if (opts.filterEndFreq !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(40, opts.filterEndFreq),
          end,
        );
      }
      if (opts.q !== undefined) {
        filter.Q.setValueAtTime(opts.q, start);
      }
      src.connect(filter);
      filter.connect(env);
    } else {
      src.connect(env);
    }

    env.connect(dest);
    src.start(start);
    src.stop(end + 0.02);
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
