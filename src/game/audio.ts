import type { WeaponId } from './entities.ts';

const MASTER_GAIN = 0.35;
const BGM_GAIN = 0.42;
const DEFAULT_FILTER_FREQ = 18000;
const SLOW_MO_FILTER_FREQ = 480;

const BGM_LOOKAHEAD_SEC = 0.14;
const BGM_SCHEDULER_MS = 25;

// Midi-to-Hz helper for crisp musical patterns
function midiHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const MUSIC_TRACK_NAMES = [
  'SECTOR PULSE',
  'CYBER FUNK',
  'NEON DRIFT',
  'HYPER GRID',
  'CORE OVERDRIVE',
] as const;

interface MusicTrack {
  readonly name: (typeof MUSIC_TRACK_NAMES)[number];
  readonly bpm: number;
  readonly swing: number;
  readonly bassType: 'slap' | 'funk' | 'outrun' | 'acid' | 'overdrive';
  readonly leadType: 'square' | 'pulse' | 'detuned';
  readonly arpType: OscillatorType;
  readonly drumStyle: 'synthwave' | 'electrofunk' | 'outrun' | 'breakbeat' | 'boss';
  readonly bass: readonly number[];
  readonly lead: readonly number[];
  readonly arpChords: readonly (readonly [number, number, number])[];
}

// Track 0: SECTOR PULSE (136 BPM, E minor) — Em -> G/D -> C -> D/B7 slap-bass synthwave
const TRACK_SECTOR_PULSE: MusicTrack = {
  name: 'SECTOR PULSE',
  bpm: 136,
  swing: 0.09,
  bassType: 'slap',
  leadType: 'square',
  arpType: 'square',
  drumStyle: 'synthwave',
  bass: [
    // Bar 1 (Em: E2=40, E3=52, G2=43, D2=38)
    40, 0, 52, 40,  0, 40, 52, 0,   40, 43, 52, 40,  0, 52, 43, 38,
    // Bar 2 (G -> D: G2=43, G3=55, D2=38, D3=50, F#2=42)
    43, 0, 55, 43,  0, 43, 55, 0,   38, 0, 50, 38,   42, 0, 50, 42,
    // Bar 3 (C: C2=36, C3=48, E2=40, G2=43)
    36, 0, 48, 36,  0, 36, 48, 0,   36, 40, 48, 43,  0, 48, 43, 40,
    // Bar 4 (D -> B7: D2=38, D3=50, B1=35, B2=47, F#2=42, A2=45)
    38, 0, 50, 38,  0, 38, 50, 38,  35, 0, 47, 35,   42, 45, 47, 50,
  ],
  lead: [
    // Bar 1 (Em hook)
    64, 0, 67, 0,   71, 0, 69, 67,  0, 64, 67, 0,   74, 0, 71, 69,
    // Bar 2 (G -> D)
    67, 0, 71, 0,   74, 0, 71, 69,  0, 66, 69, 0,   74, 71, 69, 66,
    // Bar 3 (C lift)
    64, 0, 67, 72,  0, 71, 67, 0,   72, 0, 76, 0,   74, 72, 71, 67,
    // Bar 4 (D -> B7 tension)
    69, 0, 74, 0,   71, 69, 66, 0,  71, 0, 75, 0,   76, 0, 75, 71,
  ],
  arpChords: [
    [52, 55, 59], // Bar 1a: Em
    [52, 55, 59], // Bar 1b: Em
    [55, 59, 62], // Bar 2a: G
    [50, 54, 57], // Bar 2b: D
    [48, 52, 55], // Bar 3a: C
    [48, 52, 55], // Bar 3b: C
    [50, 54, 57], // Bar 4a: D
    [47, 51, 54], // Bar 4b: B7/B
  ],
};

// Track 1: CYBER FUNK (140 BPM, A Dorian) — syncopated electro-funk bassline & double-clap groove
const TRACK_CYBER_FUNK: MusicTrack = {
  name: 'CYBER FUNK',
  bpm: 140,
  swing: 0.13,
  bassType: 'funk',
  leadType: 'pulse',
  arpType: 'triangle',
  drumStyle: 'electrofunk',
  bass: [
    // Bar 1 (Am: A2=45, A3=57, G2=43, C3=48, D3=50, E3=52)
    45, 0, 57, 45,  0, 43, 45, 0,   48, 0, 50, 52,  0, 43, 45, 57,
    // Bar 2 (D7 Dorian: D3=50, D4=62, C3=48, F#3=54, A3=57)
    50, 0, 62, 50,  0, 48, 50, 0,   54, 0, 57, 50,  0, 43, 45, 48,
    // Bar 3 (G -> Em7: G2=43, G3=55, E2=40, E3=52, B2=47)
    43, 0, 55, 43,  0, 45, 47, 0,   40, 0, 52, 40,  43, 45, 47, 50,
    // Bar 4 (Am -> G/E turnaround)
    45, 0, 57, 45,  0, 43, 45, 0,   48, 50, 52, 0,  55, 52, 50, 43,
  ],
  lead: [
    // Bar 1 (Catchy A Dorian riff)
    69, 0, 72, 74,  0, 76, 0, 72,   74, 0, 78, 0,   76, 74, 72, 69,
    // Bar 2 (F#5 Dorian color lift)
    74, 0, 78, 0,   81, 0, 79, 78,  0, 74, 76, 0,   72, 0, 71, 69,
    // Bar 3 (G -> Em bounce)
    71, 0, 74, 0,   79, 0, 76, 74,  0, 72, 71, 0,   76, 0, 74, 72,
    // Bar 4 (Climbing Dorian turnaround)
    69, 72, 76, 0,  78, 0, 79, 0,   81, 0, 79, 76,  74, 72, 74, 0,
  ],
  arpChords: [
    [57, 60, 64], // Bar 1a: Am
    [57, 60, 64], // Bar 1b: Am
    [50, 54, 57], // Bar 2a: D
    [54, 57, 60], // Bar 2b: D7
    [55, 59, 62], // Bar 3a: G
    [52, 55, 59], // Bar 3b: Em7
    [57, 60, 64], // Bar 4a: Am
    [55, 59, 64], // Bar 4b: G/E
  ],
};

// Track 2: NEON DRIFT (138 BPM, F# minor) — rolling Outrun 16th-note bass & soaring lead
const TRACK_NEON_DRIFT: MusicTrack = {
  name: 'NEON DRIFT',
  bpm: 138,
  swing: 0.03,
  bassType: 'outrun',
  leadType: 'square',
  arpType: 'sawtooth',
  drumStyle: 'outrun',
  bass: [
    // Bar 1 (F#m: F#2=42, F#3=54, A2=45, C#3=49)
    42, 42, 54, 42,  42, 42, 54, 42,  42, 42, 54, 42,  42, 45, 49, 54,
    // Bar 2 (D: D2=38, D3=50, F#2=42, A2=45)
    38, 38, 50, 38,  38, 38, 50, 38,  38, 38, 50, 38,  38, 42, 45, 50,
    // Bar 3 (E: E2=40, E3=52, G#2=44, B2=47)
    40, 40, 52, 40,  40, 40, 52, 40,  40, 40, 52, 40,  40, 44, 47, 52,
    // Bar 4 (C#m: C#2=37, C#3=49, E2=40, G#2=44, B2=47)
    37, 37, 49, 37,  37, 37, 49, 37,  37, 37, 49, 37,  40, 44, 47, 49,
  ],
  lead: [
    // Bar 1 (Call)
    73, 0, 0, 73,   76, 0, 78, 0,   73, 0, 71, 0,   69, 0, 68, 0,
    // Bar 2 (Response)
    69, 0, 0, 69,   74, 0, 73, 0,   71, 0, 69, 0,   66, 0, 0, 0,
    // Bar 3 (Soaring lift)
    76, 0, 0, 76,   80, 0, 78, 0,   76, 0, 73, 0,   71, 0, 76, 0,
    // Bar 4 (C#m cascade)
    73, 0, 76, 0,   80, 0, 81, 0,   78, 0, 76, 0,   73, 0, 71, 0,
  ],
  arpChords: [
    [54, 57, 61], // Bar 1a: F#m
    [54, 57, 61], // Bar 1b: F#m
    [50, 54, 57], // Bar 2a: D
    [50, 54, 57], // Bar 2b: D
    [52, 56, 59], // Bar 3a: E
    [52, 56, 59], // Bar 3b: E
    [49, 52, 56], // Bar 4a: C#m
    [49, 52, 59], // Bar 4b: C#m7
  ],
};

// Track 3: HYPER GRID (142 BPM, D minor) — acid resonant bassline & breakbeat kick pickups
const TRACK_HYPER_GRID: MusicTrack = {
  name: 'HYPER GRID',
  bpm: 142,
  swing: 0.05,
  bassType: 'acid',
  leadType: 'pulse',
  arpType: 'square',
  drumStyle: 'breakbeat',
  bass: [
    // Bar 1 (Dm: D2=38, D3=50, F2=41, G2=43, A2=45)
    38, 0, 50, 38,   41, 0, 50, 45,   38, 50, 0, 38,   43, 45, 50, 38,
    // Bar 2 (Bb: Bb2=46, Bb3=58, F2=41, F3=53, D3=50)
    46, 0, 58, 46,   0, 46, 58, 46,   41, 0, 53, 46,   50, 0, 58, 46,
    // Bar 3 (C: C2=36, C3=48, E2=40, G2=43, E3=52)
    36, 0, 48, 36,   40, 0, 48, 43,   36, 48, 0, 36,   43, 48, 52, 48,
    // Bar 4 (A7: A1=33, A2=45, C#2=37, E2=40, C#3=49, E3=52)
    33, 0, 45, 33,   37, 0, 45, 40,   33, 45, 49, 45,  52, 49, 45, 40,
  ],
  lead: [
    // Bar 1 (Dm arcade hook)
    62, 65, 69, 0,  74, 0, 72, 69,  65, 0, 69, 74,  0, 72, 69, 67,
    // Bar 2 (Bb lift)
    70, 0, 74, 0,   77, 0, 74, 70,  69, 0, 70, 74,  0, 72, 70, 69,
    // Bar 3 (C drive)
    72, 0, 76, 0,   79, 0, 76, 72,  74, 0, 72, 69,  67, 69, 72, 0,
    // Bar 4 (A7 harmonic minor snap)
    73, 0, 76, 0,   81, 0, 79, 76,  73, 76, 73, 69,  67, 69, 73, 0,
  ],
  arpChords: [
    [50, 53, 57], // Bar 1a: Dm
    [53, 57, 62], // Bar 1b: Dm (inv)
    [46, 50, 53], // Bar 2a: Bb
    [50, 53, 58], // Bar 2b: Bb (inv)
    [48, 52, 55], // Bar 3a: C
    [52, 55, 60], // Bar 3b: C (inv)
    [45, 49, 55], // Bar 4a: A7
    [49, 55, 57], // Bar 4b: A7 (inv)
  ],
};

// Track 4 (Boss): CORE OVERDRIVE (148 BPM, C# Phrygian/minor) — relentless double-kick & Phrygian tension
const TRACK_CORE_OVERDRIVE: MusicTrack = {
  name: 'CORE OVERDRIVE',
  bpm: 148,
  swing: 0.0,
  bassType: 'overdrive',
  leadType: 'detuned',
  arpType: 'square',
  drumStyle: 'boss',
  bass: [
    // Bar 1 (C#m: C#2=37, C#3=49, D2=38, E2=40, G#2=44)
    37, 49, 37, 49,  37, 49, 38, 49,  37, 49, 37, 49,  40, 49, 44, 49,
    // Bar 2 (D Phrygian bII: D2=38, D3=50, F#2=42, A2=45)
    38, 50, 38, 50,  38, 50, 42, 50,  38, 50, 38, 50,  45, 50, 42, 50,
    // Bar 3 (Bm/B: B1=35, B2=47, F#2=42, D2=38, E2=40)
    35, 47, 35, 47,  35, 47, 42, 47,  35, 47, 35, 47,  38, 47, 40, 47,
    // Bar 4 (C#m Phrygian slam)
    37, 49, 37, 49,  38, 50, 38, 50,  40, 52, 44, 56,  49, 37, 38, 37,
  ],
  lead: [
    // Bar 1 (C# Phrygian aggressive riff)
    73, 0, 74, 73,   0, 76, 74, 73,  80, 0, 74, 73,   76, 74, 73, 71,
    // Bar 2 (D tension)
    74, 0, 78, 0,    81, 0, 80, 78,  74, 0, 73, 74,   76, 74, 73, 71,
    // Bar 3 (B -> E climb)
    71, 0, 74, 0,    78, 0, 76, 74,  71, 0, 76, 0,    80, 78, 76, 74,
    // Bar 4 (Relentless climax)
    73, 74, 76, 80,  81, 0, 80, 78,  76, 74, 73, 74,  85, 0, 80, 74,
  ],
  arpChords: [
    [49, 52, 56], // Bar 1a: C#m
    [52, 56, 61], // Bar 1b: C#m (inv)
    [50, 54, 57], // Bar 2a: D
    [50, 56, 57], // Bar 2b: D Phrygian
    [47, 50, 54], // Bar 3a: Bm
    [50, 54, 59], // Bar 3b: Bm (inv)
    [49, 52, 56], // Bar 4a: C#m
    [50, 56, 61], // Bar 4b: D/C# tension
  ],
};

const MUSIC_TRACKS: readonly MusicTrack[] = [
  TRACK_SECTOR_PULSE,
  TRACK_CYBER_FUNK,
  TRACK_NEON_DRIFT,
  TRACK_HYPER_GRID,
  TRACK_CORE_OVERDRIVE,
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
  private bgmTrackIndex = 0;
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

  /** Switch background music track based on room number (cycles 4 room grooves) or dedicated boss track. */
  setMusicTrack(roomNumber: number, isBoss: boolean): void {
    const safeRoom = Math.max(1, Math.floor(roomNumber));
    const nextTrackIndex = isBoss ? 4 : (safeRoom - 1) % 4;
    if (nextTrackIndex !== this.bgmTrackIndex) {
      this.bgmTrackIndex = nextTrackIndex;
      this.bgmStep = 0;
    }
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

    const track = MUSIC_TRACKS[this.bgmTrackIndex] ?? MUSIC_TRACKS[0];
    const stepSec = 60 / track.bpm / 4;
    if (this.bgmNextNoteTime < this.ctx.currentTime - 0.15) {
      this.bgmNextNoteTime = this.ctx.currentTime + 0.02;
    }
    const horizon = this.ctx.currentTime + BGM_LOOKAHEAD_SEC;
    let guard = 0;
    while (this.bgmNextNoteTime < horizon && guard < 8) {
      // Subtle 16th-note swing on odd steps according to track feel
      const swingOffset = this.bgmStep % 2 === 1 ? stepSec * track.swing : 0;
      this.scheduleBgmStep(track, this.bgmStep, this.bgmNextNoteTime + swingOffset, stepSec);
      this.bgmNextNoteTime += stepSec;
      this.bgmStep = (this.bgmStep + 1) % 64;
      guard++;
    }
  }

  private scheduleBgmStep(
    track: MusicTrack,
    step: number,
    time: number,
    stepSec: number,
  ): void {
    if (!this.ctx || !this.bgmGain) return;
    const ctx = this.ctx;
    const dest = this.bgmGain;
    const stepInBar = step % 16;
    const barIndex = Math.floor(step / 16);
    const intensity = this.bgmIntensity;

    // 1. Drums (kick, snare/clap, hi-hats, fills)
    this.scheduleBgmDrums(ctx, dest, track.drumStyle, step, stepInBar, barIndex, time, intensity);

    // 2. Bassline
    const bassMidi = track.bass[step];
    if (bassMidi > 0) {
      this.scheduleBgmBass(ctx, dest, track.bassType, midiHz(bassMidi), time, stepSec);
    }

    // 3. Driving 16th-note synth arp (active during gameplay)
    if (intensity >= 1) {
      const chordIdx = Math.floor(step / 8);
      const chord = track.arpChords[chordIdx];
      const arpMidi = chord[step % 3] + (intensity === 2 && step % 6 >= 3 ? 12 : 0);
      const arpOsc = ctx.createOscillator();
      const arpEnv = ctx.createGain();
      arpOsc.type = track.arpType;
      arpOsc.frequency.setValueAtTime(midiHz(arpMidi), time);
      arpEnv.gain.setValueAtTime(0.0001, time);
      const arpPeak = track.arpType === 'sawtooth' ? 0.036 : 0.044;
      arpEnv.gain.linearRampToValueAtTime(intensity === 2 ? arpPeak * 1.3 : arpPeak, time + 0.004);
      arpEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
      arpOsc.connect(arpEnv);
      arpEnv.connect(dest);
      arpOsc.start(time);
      arpOsc.stop(time + 0.085);
    }

    // 4. Retro lead hook
    const leadMidi = track.lead[step];
    if (leadMidi > 0 && intensity >= 1) {
      this.scheduleBgmLead(ctx, dest, track.leadType, midiHz(leadMidi), time, stepSec, intensity);
    }
  }

  private scheduleBgmDrums(
    ctx: AudioContext,
    dest: AudioNode,
    style: MusicTrack['drumStyle'],
    step: number,
    stepInBar: number,
    barIndex: number,
    time: number,
    intensity: 0 | 1 | 2,
  ): void {
    let kick = false;
    let kickGain = 0.55;
    let snare = false;
    let snareGain = 1.0;
    let doubleClap = false;
    let openHat = false;

    switch (style) {
      case 'synthwave': {
        kick = stepInBar % 4 === 0 || ((step === 30 || step === 62) && intensity >= 1);
        snare = stepInBar === 4 || stepInBar === 12 || (step === 63 && intensity >= 1);
        snareGain = step === 63 ? 0.55 : 1.0;
        openHat = stepInBar === 10 && intensity >= 1;
        break;
      }
      case 'electrofunk': {
        kick =
          stepInBar === 0 ||
          stepInBar === 6 ||
          stepInBar === 8 ||
          ((barIndex === 1 || barIndex === 3) && stepInBar === 14 && intensity >= 1);
        const isMainSnare = stepInBar === 4 || stepInBar === 12;
        const isGhost =
          intensity >= 1 &&
          (((barIndex === 1 || barIndex === 3) && stepInBar === 7) || step === 63);
        snare = isMainSnare || isGhost;
        snareGain = isMainSnare ? 1.0 : 0.48;
        doubleClap = stepInBar === 12 && intensity >= 1;
        openHat = stepInBar === 14 && intensity >= 1;
        break;
      }
      case 'outrun': {
        kick = stepInBar % 4 === 0 || (step === 62 && intensity >= 1);
        snare = stepInBar === 4 || stepInBar === 12;
        openHat = (stepInBar === 2 || stepInBar === 10) && intensity >= 1;
        // Descending retro synth-tom fills at bar 2 and bar 4 endings
        if (intensity >= 1 && ((step >= 28 && step <= 31) || (step >= 60 && step <= 63))) {
          const tomIdx = stepInBar - 12;
          const tomFreqs = [195, 152, 118, 88];
          this.triggerDrumTom(ctx, dest, tomFreqs[tomIdx] ?? 118, time);
        }
        break;
      }
      case 'breakbeat': {
        const isBreakKick =
          stepInBar === 0 ||
          stepInBar === 6 ||
          stepInBar === 10 ||
          ((step === 27 || step === 30 || step === 59 || step === 62) && intensity >= 1);
        kick = isBreakKick;
        kickGain = stepInBar === 0 ? 0.58 : 0.48;
        const isMainSnare = stepInBar === 4 || stepInBar === 12;
        const isGhost = intensity >= 1 && (stepInBar === 7 || stepInBar === 15);
        snare = isMainSnare || isGhost;
        snareGain = isMainSnare ? 1.0 : 0.45;
        openHat = (stepInBar === 8 || stepInBar === 14) && intensity >= 1;
        break;
      }
      case 'boss': {
        const isDoubleKick =
          intensity >= 1 &&
          (stepInBar === 2 || stepInBar === 10 || stepInBar === 14 || step === 60 || step === 62);
        kick = stepInBar % 4 === 0 || isDoubleKick;
        kickGain = stepInBar % 4 === 0 ? 0.58 : 0.46;
        const isMainSnare = stepInBar === 4 || stepInBar === 12;
        const isRapidFill =
          intensity >= 1 && (step === 30 || step === 31 || step >= 61);
        snare = isMainSnare || isRapidFill;
        snareGain = isMainSnare ? 1.05 : 0.65;
        openHat = (stepInBar === 6 || stepInBar === 14) && intensity >= 1;
        break;
      }
    }

    if (kick) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(style === 'boss' ? 156 : 148, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(kickGain, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
      osc.connect(env);
      env.connect(dest);
      osc.start(time);
      osc.stop(time + 0.16);
    }

    if (snare) {
      this.triggerSnareHit(ctx, dest, time, snareGain);
      if (doubleClap) {
        this.triggerClapBurst(ctx, dest, time + 0.022);
      }
    }

    if (this.noiseBuffer && (intensity >= 1 || step % 2 === 0)) {
      const isOffBeat = stepInBar % 4 === 2;
      const hatGain = openHat ? 0.11 : isOffBeat ? 0.095 : step % 2 === 0 ? 0.045 : 0.03;
      const hatDur = openHat ? 0.11 : 0.032;

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(openHat ? 6200 : 7800, time);
      const env = ctx.createGain();
      env.gain.setValueAtTime(hatGain, time);
      env.gain.exponentialRampToValueAtTime(0.0001, time + hatDur);
      src.connect(hp);
      hp.connect(env);
      env.connect(dest);
      src.start(time);
      src.stop(time + hatDur + 0.01);
    }
  }

  private triggerSnareHit(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    volScale: number,
  ): void {
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

  private triggerClapBurst(ctx: AudioContext, dest: AudioNode, time: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2450, time);
    bp.Q.setValueAtTime(1.1, time);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.2, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    src.connect(bp);
    bp.connect(env);
    env.connect(dest);
    src.start(time);
    src.stop(time + 0.09);
  }

  private triggerDrumTom(ctx: AudioContext, dest: AudioNode, startFreq: number, time: number): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.55, time + 0.09);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.22, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    osc.connect(env);
    env.connect(dest);
    osc.start(time);
    osc.stop(time + 0.11);
  }

  private scheduleBgmBass(
    ctx: AudioContext,
    dest: AudioNode,
    bassType: MusicTrack['bassType'],
    freq: number,
    time: number,
    stepSec: number,
  ): void {
    const durScale =
      bassType === 'outrun' ? 0.96 : bassType === 'funk' ? 0.85 : 0.92;
    const dur = stepSec * durScale;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    if (bassType === 'outrun') {
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 1.005, time);
    } else if (bassType === 'funk') {
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq, time);
    } else {
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq, time);
    }

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const q =
      bassType === 'acid'
        ? 7.5
        : bassType === 'overdrive'
          ? 5.0
          : bassType === 'funk'
            ? 4.4
            : bassType === 'outrun'
              ? 2.4
              : 3.6;
    const startCutoff =
      bassType === 'acid'
        ? 2900
        : bassType === 'overdrive'
          ? 2800
          : bassType === 'funk'
            ? 2400
            : bassType === 'outrun'
              ? 1750
              : 2100;
    const endCutoff = bassType === 'outrun' ? 320 : bassType === 'overdrive' ? 290 : 240;

    lp.Q.setValueAtTime(q, time);
    lp.frequency.setValueAtTime(startCutoff, time);
    lp.frequency.exponentialRampToValueAtTime(endCutoff, time + dur);

    const bEnv = ctx.createGain();
    bEnv.gain.setValueAtTime(0.0001, time);
    bEnv.gain.linearRampToValueAtTime(bassType === 'overdrive' ? 0.25 : 0.24, time + 0.006);
    bEnv.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(
      bassType === 'acid' ? 0.3 : bassType === 'overdrive' ? 0.55 : 0.45,
      time,
    );

    osc1.connect(lp);
    osc2.connect(subGain);
    subGain.connect(lp);
    lp.connect(bEnv);
    bEnv.connect(dest);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.02);
    osc2.stop(time + dur + 0.02);
  }

  private scheduleBgmLead(
    ctx: AudioContext,
    dest: AudioNode,
    leadType: MusicTrack['leadType'],
    freq: number,
    time: number,
    stepSec: number,
    intensity: 0 | 1 | 2,
  ): void {
    const leadDur = stepSec * (leadType === 'detuned' ? 1.35 : 1.45);
    const leadFilter = ctx.createBiquadFilter();
    leadFilter.type = 'lowpass';
    leadFilter.frequency.setValueAtTime(
      leadType === 'detuned' ? 4600 : intensity === 2 ? 4200 : 3000,
      time,
    );

    const leadEnv = ctx.createGain();
    leadEnv.gain.setValueAtTime(0.0001, time);
    leadEnv.gain.linearRampToValueAtTime(
      intensity === 2 ? 0.115 : 0.095,
      time + 0.008,
    );
    leadEnv.gain.exponentialRampToValueAtTime(0.0001, time + leadDur);

    leadFilter.connect(leadEnv);
    leadEnv.connect(dest);

    if (leadType === 'detuned') {
      // Aggressive dual-detuned sawtooth lead for Boss overdrive
      for (const detune of [0.994, 1.006]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * detune, time);
        osc.connect(leadFilter);
        osc.start(time);
        osc.stop(time + leadDur + 0.02);
      }
    } else {
      const leadOsc = ctx.createOscillator();
      leadOsc.type = 'square';
      if (leadType === 'square') {
        leadOsc.frequency.setValueAtTime(freq * 0.985, time);
        leadOsc.frequency.exponentialRampToValueAtTime(freq, time + 0.022);
      } else {
        leadOsc.frequency.setValueAtTime(freq, time);
      }
      leadOsc.connect(leadFilter);
      leadOsc.start(time);
      leadOsc.stop(time + leadDur + 0.02);
    }

    // Boss / High-Flow octave shimmer (always active on Boss lead, and on intensity 2 for normal tracks)
    if (intensity === 2 || leadType === 'detuned') {
      const octOsc = ctx.createOscillator();
      const octEnv = ctx.createGain();
      octOsc.type = leadType === 'detuned' ? 'square' : 'triangle';
      octOsc.frequency.setValueAtTime(freq * 2, time);
      octEnv.gain.setValueAtTime(0.0001, time);
      octEnv.gain.linearRampToValueAtTime(
        intensity === 2 ? 0.055 : 0.032,
        time + 0.008,
      );
      octEnv.gain.exponentialRampToValueAtTime(0.0001, time + leadDur * 0.8);
      octOsc.connect(octEnv);
      octEnv.connect(dest);
      octOsc.start(time);
      octOsc.stop(time + leadDur);
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
      startFreq: 160,
      endFreq: 42,
      duration: 0.26,
      gain: 0.44,
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
    freq.exponentialRampToValueAtTime(DEFAULT_FILTER_FREQ, now + 0.14);
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
