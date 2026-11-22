import { AudioEngine } from './audio.ts';
import {
  ARENA,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  COMBAT,
  CONTROLS,
  OVERHEAT,
  PHYSICS,
  STORAGE_KEYS,
  TRANSITION,
} from './constants.ts';
import {
  allocEntityId,
  ArcEffect,
  BeamEffect,
  createInitialPerks,
  DraftOption,
  Enemy,
  FloatingText,
  Hazard,
  Particle,
  PerkId,
  PlayerState,
  Projectile,
  RingEffect,
  Sawblade,
  Vec2,
  WeaponId,
} from './entities.ts';
import {
  clamp,
  isBossFrontShieldHit,
  len,
  normalize,
  normalizeOr,
  raycastArena,
  resolveCircleCollision,
  stepCircleArena,
} from './physics.ts';
import { AimRenderState, GameRenderer, RenderState } from './renderer.ts';
import { generateDraftOptions, generateRoom } from './rooms.ts';
import { fireActiveWeapon } from './weapons.ts';

export type GamePhase = 'title' | 'playing' | 'transition' | 'draft' | 'gameover';

export interface RunSummary {
  score: number;
  bestScore: number;
  roomNumber: number;
  bestRoom: number;
  isNewBest: boolean;
}

export interface EngineCallbacks {
  onPhaseChange?: (phase: GamePhase) => void;
  onDraftReady?: (options: DraftOption[], roomNumber: number) => void;
  onGameOver?: (summary: RunSummary) => void;
  onMuteChange?: (muted: boolean) => void;
}

export class GameEngine {
  readonly audio = new AudioEngine();
  private readonly renderer = new GameRenderer();
  private callbacks: EngineCallbacks;

  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private lastFrameTimeMs = 0;
  private accumulator = 0;

  phase: GamePhase = 'title';
  player: PlayerState;
  enemies: Enemy[] = [];
  hazards: Hazard[] = [];
  projectiles: Projectile[] = [];
  sawblades: Sawblade[] = [];
  beams: BeamEffect[] = [];
  arcs: ArcEffect[] = [];
  rings: RingEffect[] = [];
  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];

  roomNumber = 1;
  roomName = '';
  isBossRoom = false;
  score = 0;
  bestScore = 0;
  bestRoom = 1;
  flowMultiplier = 1.0;
  roomTimer = 0;
  tookDamageThisRoom = false;

  private hitstopTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private shakeDirX = 0;
  private shakeDirY = 0;
  private shakeX = 0;
  private shakeY = 0;

  private transitionTimer = 0;
  private timeElapsed = 0;
  private overheatWarnSecond = -1;
  private multiKillCount = 0;
  private multiKillTimer = 0;
  private selectedStartWeapon: WeaponId = 'railgun';

  // One-thumb pointer state machine
  private activePointerId: number | null = null;
  private pointerDownPos: Vec2 = { x: 0, y: 0 };
  private pointerCurPos: Vec2 = { x: 0, y: 0 };
  private pointerDownTimeMs = 0;
  private isSlingshotDragging = false;
  private wasArmoredOnPointerDown = false;
  private slowMoActive = false;
  private focusRemainingSec: number = CONTROLS.AIM_MAX_DURATION_SEC;

  constructor(callbacks: EngineCallbacks = {}) {
    this.callbacks = callbacks;
    this.player = this.createFreshPlayer('railgun');
    this.loadPersistentState();
  }

  private loadPersistentState(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const bs = Number(localStorage.getItem(STORAGE_KEYS.BEST_SCORE) ?? '0');
      const br = Number(localStorage.getItem(STORAGE_KEYS.BEST_ROOM) ?? '1');
      const muted = localStorage.getItem(STORAGE_KEYS.MUTED) === '1';
      if (Number.isFinite(bs) && bs > 0) this.bestScore = bs;
      if (Number.isFinite(br) && br >= 1) this.bestRoom = br;
      this.audio.setMuted(muted);
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }

  private savePersistentState(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEYS.BEST_SCORE, String(Math.floor(this.bestScore)));
      localStorage.setItem(STORAGE_KEYS.BEST_ROOM, String(this.bestRoom));
      localStorage.setItem(STORAGE_KEYS.MUTED, this.audio.isMuted() ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
  }

  private createFreshPlayer(weapon: WeaponId): PlayerState {
    return {
      x: CANVAS_WIDTH / 2,
      y: 395,
      vx: 0,
      vy: 0,
      radius: PHYSICS.PLAYER_RADIUS,
      aimDirX: 0,
      aimDirY: -1,
      hp: COMBAT.BASE_MAX_HP,
      maxHp: COMBAT.BASE_MAX_HP,
      shield: COMBAT.BASE_MAX_SHIELD,
      maxShield: COMBAT.BASE_MAX_SHIELD,
      iframes: 0,
      chargeTier: 0,
      armored: false,
      weapon,
      perks: createInitialPerks(),
      trail: [],
      flashTimer: 0,
    };
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not initialize 2D canvas context');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  startLoop(): void {
    if (this.rafId !== null) return;
    this.lastFrameTimeMs = performance.now();
    const tick = (now: number) => {
      const rawDt = Math.min(PHYSICS.MAX_FRAME_DT, Math.max(0, (now - this.lastFrameTimeMs) / 1000));
      this.lastFrameTimeMs = now;
      this.update(rawDt);
      this.renderFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setStartingWeapon(weapon: WeaponId): void {
    this.selectedStartWeapon = weapon;
    if (this.phase === 'title') {
      this.player.weapon = weapon;
    }
  }

  getStartingWeapon(): WeaponId {
    return this.selectedStartWeapon;
  }

  toggleMute(): boolean {
    this.audio.init();
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    this.savePersistentState();
    this.callbacks.onMuteChange?.(next);
    return next;
  }

  startNewRun(weapon = this.selectedStartWeapon): void {
    this.audio.init();
    this.selectedStartWeapon = weapon;
    this.player = this.createFreshPlayer(weapon);
    this.roomNumber = 1;
    this.score = 0;
    this.flowMultiplier = 1.0;
    this.hitstopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.multiKillCount = 0;
    this.multiKillTimer = 0;
    this.clearPointerState(false);
    this.loadRoom(1);
    this.setPhase('playing');
    this.audio.startMusic(this.isBossRoom ? 2 : 1);
  }

  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.updateMusicIntensity();
    this.callbacks.onPhaseChange?.(phase);
  }

  private updateMusicIntensity(): void {
    if (this.phase === 'playing' || this.phase === 'transition') {
      const intense = this.isBossRoom || this.flowMultiplier >= 2.0 ? 2 : 1;
      this.audio.setMusicIntensity(intense);
    } else {
      this.audio.setMusicIntensity(0);
    }
  }

  private loadRoom(roomNum: number): void {
    const spawned = generateRoom(roomNum);
    this.enemies = spawned.enemies;
    this.hazards = spawned.hazards;
    this.isBossRoom = spawned.isBossRoom;
    this.roomName = spawned.roomName;
    this.projectiles = [];
    this.sawblades = [];
    this.beams = [];
    this.arcs = [];
    this.rings = [];
    this.particles = [];
    this.floatingTexts = [];
    this.roomTimer = 0;
    this.overheatWarnSecond = -1;
    this.tookDamageThisRoom = false;

    this.player.x = CANVAS_WIDTH / 2;
    this.player.y = 395;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.aimDirX = 0;
    this.player.aimDirY = -1;
    this.player.armored = false;
    this.player.chargeTier = 0;
    this.player.trail = [];
    this.player.shield = this.player.maxShield;

    this.addFloatingText(
      CANVAS_WIDTH / 2,
      235,
      this.isBossRoom ? `BOSS: ${this.roomName}` : `ROOM ${roomNum}`,
      this.isBossRoom ? COLORS.bossCore : COLORS.textCyan,
      1.1,
    );
  }

  selectDraftOption(option: DraftOption): void {
    if (this.phase !== 'draft') return;
    this.audio.init();
    this.audio.playDraftPick();

    if (option.kind === 'weapon' && option.weaponId) {
      this.player.weapon = option.weaponId;
    } else if (option.kind === 'perk' && option.perkId) {
      this.applyPerk(option.perkId);
    }

    this.roomNumber += 1;
    this.loadRoom(this.roomNumber);
    this.setPhase('playing');
  }

  private applyPerk(perkId: PerkId): void {
    this.player.perks[perkId] = (this.player.perks[perkId] ?? 0) + 1;
    if (perkId === 'max_shield') {
      this.player.maxShield += 1;
      this.player.shield = this.player.maxShield;
    }
  }

  // ---- Input State Machine ----

  private getMaxFocusDuration(): number {
    return CONTROLS.AIM_MAX_DURATION_SEC + this.player.perks.longer_focus * 0.6;
  }

  private getMaxLaunchSpeed(): number {
    return PHYSICS.MAX_LAUNCH_SPEED * (1 + this.player.perks.bounce_speed * 0.12);
  }

  private getWallRestitution(): number {
    return Math.min(1.04, PHYSICS.WALL_RESTITUTION * (1 + this.player.perks.bounce_speed * 0.06));
  }

  handlePointerDown(canvasX: number, canvasY: number, pointerId: number, nowMs: number): void {
    this.audio.init();
    if (this.phase !== 'playing') return;
    if (this.activePointerId !== null) return;

    this.activePointerId = pointerId;
    this.pointerDownPos = { x: canvasX, y: canvasY };
    this.pointerCurPos = { x: canvasX, y: canvasY };
    this.pointerDownTimeMs = nowMs;
    this.isSlingshotDragging = false;
    this.wasArmoredOnPointerDown = this.player.armored;
  }

  handlePointerMove(canvasX: number, canvasY: number, pointerId: number): void {
    if (this.phase !== 'playing') return;
    if (this.activePointerId !== pointerId) return;

    this.pointerCurPos = { x: canvasX, y: canvasY };
    const dist = len(
      this.pointerCurPos.x - this.pointerDownPos.x,
      this.pointerCurPos.y - this.pointerDownPos.y,
    );

    if (!this.isSlingshotDragging && dist > CONTROLS.DRAG_THRESHOLD_PX) {
      this.isSlingshotDragging = true;
      this.focusRemainingSec = this.getMaxFocusDuration();
      this.slowMoActive = true;
      this.audio.playSlowMoEnter();
    }
  }

  handlePointerUp(canvasX: number, canvasY: number, pointerId: number, nowMs: number): void {
    if (this.activePointerId !== pointerId) return;
    this.pointerCurPos = { x: canvasX, y: canvasY };

    const elapsedMs = nowMs - this.pointerDownTimeMs;
    const pullX = this.pointerDownPos.x - this.pointerCurPos.x;
    const pullY = this.pointerDownPos.y - this.pointerCurPos.y;
    const pullDist = len(pullX, pullY);

    if (this.phase === 'playing') {
      if (this.isSlingshotDragging) {
        if (pullDist >= CONTROLS.DRAG_THRESHOLD_PX) {
          const dir = normalize(pullX, pullY);
          const ratio = clamp(
            pullDist / CONTROLS.SLINGSHOT_MAX_PULL_PX,
            0.22,
            1.0,
          );
          const speed =
            PHYSICS.MIN_LAUNCH_SPEED +
            (this.getMaxLaunchSpeed() - PHYSICS.MIN_LAUNCH_SPEED) * ratio;

          this.player.vx = dir.x * speed;
          this.player.vy = dir.y * speed;
          this.player.aimDirX = dir.x;
          this.player.aimDirY = dir.y;
          this.player.armored = speed >= PHYSICS.ARMORED_SPEED_THRESHOLD;
          this.spawnSparks(this.player.x, this.player.y, -dir.x, -dir.y, COLORS.playerCore, 6, 40, 110);
        }
      } else if (
        elapsedMs < CONTROLS.TAP_MAX_DURATION_MS &&
        pullDist < CONTROLS.DRAG_THRESHOLD_PX &&
        (this.player.armored || this.wasArmoredOnPointerDown)
      ) {
        this.executeBrakeAndFire();
      }
    }

    this.clearPointerState(true);
  }

  handlePointerCancel(pointerId: number): void {
    if (this.activePointerId !== pointerId) return;
    this.clearPointerState(true);
  }

  cancelActiveInput(): void {
    if (this.activePointerId !== null || this.slowMoActive || this.isSlingshotDragging) {
      this.clearPointerState(true);
    }
  }

  private clearPointerState(restoreAudio: boolean): void {
    if (restoreAudio && this.slowMoActive) {
      this.audio.playSlowMoExit();
    }
    this.activePointerId = null;
    this.isSlingshotDragging = false;
    this.wasArmoredOnPointerDown = false;
    this.slowMoActive = false;
    this.focusRemainingSec = this.getMaxFocusDuration();
  }

  private executeBrakeAndFire(): void {
    const dir = normalizeOr(
      this.player.aimDirX,
      this.player.aimDirY,
      this.player.vx,
      this.player.vy,
    );
    this.player.aimDirX = dir.x;
    this.player.aimDirY = dir.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.armored = false;

    // Optional perk: Bullet-Clear Shockwave on Brake
    if (this.player.perks.brake_shockwave > 0) {
      const shockRadius =
        COMBAT.BRAKE_SHOCKWAVE_RADIUS + (this.player.perks.brake_shockwave - 1) * 14;
      this.rings.push({
        x: this.player.x,
        y: this.player.y,
        radius: 6,
        maxRadius: shockRadius,
        color: COLORS.playerArmored,
        life: 0.22,
        maxLife: 0.22,
      });

      let cleared = 0;
      this.projectiles = this.projectiles.filter((p) => {
        if (!p.fromPlayer && len(p.x - this.player.x, p.y - this.player.y) <= shockRadius) {
          cleared++;
          this.spawnSparks(p.x, p.y, 0, -1, COLORS.playerArmored, 3, 25, 70);
          return false;
        }
        return true;
      });
      if (cleared > 0) {
        this.addFloatingText(this.player.x, this.player.y - 16, `CLEAR x${cleared}`, COLORS.playerArmored, 0.85);
      }

      for (const e of this.enemies) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const d = len(dx, dy);
        if (d > 0 && d <= shockRadius + e.radius) {
          const n = normalize(dx, dy);
          e.vx += n.x * 160;
          e.vy += n.y * 160;
        }
      }
    }

    fireActiveWeapon({
      player: this.player,
      enemies: this.enemies,
      hazards: this.hazards,
      projectiles: this.projectiles,
      sawblades: this.sawblades,
      beams: this.beams,
      arcs: this.arcs,
      rings: this.rings,
      particles: this.particles,
      onDamageEnemy: (enemy, dmg, kx, ky, sx, sy) =>
        this.damageEnemy(enemy, dmg, kx, ky, sx, sy, this.player.chargeTier >= 1),
      onHitHazard: (hazard, sx, sy) => this.hitHazard(hazard, sx, sy),
      onHitstop: (sec) => this.triggerHitstop(sec),
      onShake: (dx, dy, intensity) => this.addShake(dx, dy, intensity),
      playWeaponSfx: (weapon, tier) => this.audio.playWeapon(weapon, tier),
    });

    // Charge resets after firing
    this.player.chargeTier = 0;
  }

  // ---- Main Simulation Step ----

  update(rawDt: number): void {
    this.timeElapsed += rawDt;

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - rawDt);
      const t = this.shakeTimer > 0 ? this.shakeIntensity * (this.shakeTimer / 0.18) : 0;
      this.shakeX = (Math.random() * 2 - 1) * t + this.shakeDirX * t * 0.6;
      this.shakeY = (Math.random() * 2 - 1) * t + this.shakeDirY * t * 0.6;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    if (this.phase === 'transition') {
      this.updateEffects(rawDt);
      this.transitionTimer += rawDt;
      if (this.transitionTimer >= TRANSITION.ROOM_SCROLL_SEC) {
        this.transitionTimer = 0;
        const options = generateDraftOptions(this.player, this.roomNumber);
        this.setPhase('draft');
        this.callbacks.onDraftReady?.(options, this.roomNumber);
      }
      return;
    }

    if (this.phase !== 'playing') return;

    // Focus Ring countdown happens in real-time
    if (this.isSlingshotDragging && this.slowMoActive) {
      this.focusRemainingSec -= rawDt;
      if (this.focusRemainingSec <= 0) {
        this.focusRemainingSec = 0;
        this.slowMoActive = false;
        this.audio.playSlowMoExit();
      }
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - rawDt);
      return;
    }

    const timeScale = this.slowMoActive ? CONTROLS.AIM_TIME_SCALE : 1.0;
    const simDt = rawDt * timeScale;
    this.accumulator += simDt;

    let guard = 0;
    while (this.accumulator >= PHYSICS.FIXED_DT && guard < 16) {
      this.stepSimulation(PHYSICS.FIXED_DT);
      this.accumulator -= PHYSICS.FIXED_DT;
      guard++;
      if (this.phase !== 'playing') {
        this.accumulator = 0;
        break;
      }
    }
  }

  stepSimulation(dt: number): void {
    this.roomTimer += dt;
    this.checkOverheatWarning();

    if (this.multiKillTimer > 0) {
      this.multiKillTimer -= dt;
      if (this.multiKillTimer <= 0) {
        this.multiKillCount = 0;
      }
    }

    this.updatePlayer(dt);
    this.updateSawblades(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateHazards(dt);
    this.updateEffects(dt);
    this.cleanupDeadAndCheckClear();
  }

  private checkOverheatWarning(): void {
    if (
      this.roomTimer >= OVERHEAT.WARNING_START_SEC &&
      this.roomTimer < OVERHEAT.OVERHEAT_START_SEC
    ) {
      const sec = Math.ceil(OVERHEAT.OVERHEAT_START_SEC - this.roomTimer);
      if (sec !== this.overheatWarnSecond) {
        this.overheatWarnSecond = sec;
        this.audio.playOverheatWarn();
      }
    } else if (
      this.roomTimer >= OVERHEAT.OVERHEAT_START_SEC &&
      this.overheatWarnSecond !== 0
    ) {
      this.overheatWarnSecond = 0;
      this.audio.playOverheatWarn();
      this.addFloatingText(CANVAS_WIDTH / 2, 110, 'OVERHEAT!', COLORS.textRed, 1.15);
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - dt);
    if (p.flashTimer > 0) p.flashTimer = Math.max(0, p.flashTimer - dt);

    const drag = Math.exp(-PHYSICS.PLAYER_DRAG * dt);
    p.vx *= drag;
    p.vy *= drag;

    let speed = len(p.vx, p.vy);
    if (speed < PHYSICS.STOP_SPEED_THRESHOLD) {
      p.vx = 0;
      p.vy = 0;
      speed = 0;
    } else {
      p.aimDirX = p.vx / speed;
      p.aimDirY = p.vy / speed;
    }

    p.armored = speed >= PHYSICS.ARMORED_SPEED_THRESHOLD;
    if (!p.armored && p.chargeTier > 0) {
      p.chargeTier = 0;
    }

    // Trail emission
    if (speed > PHYSICS.STOP_SPEED_THRESHOLD * 1.5) {
      const maxLife = 0.16 + p.chargeTier * 0.04;
      p.trail.push({
        x: p.x,
        y: p.y,
        life: maxLife,
        maxLife,
        tier: p.chargeTier,
        armored: p.armored,
      });
      if (p.trail.length > 22) {
        p.trail.shift();
      }
    }
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= dt;
      if (p.trail[i].life <= 0) {
        p.trail.splice(i, 1);
      }
    }

    const wallRes = stepCircleArena(p, dt, this.getWallRestitution());
    if (wallRes.hitWall) {
      const overheated = this.roomTimer >= OVERHEAT.OVERHEAT_START_SEC;
      if (overheated) {
        this.audio.playBounce(p.chargeTier, true);
        this.spawnSparks(p.x, p.y, wallRes.normalX, wallRes.normalY, COLORS.wallOverheat, 8, 60, 140);
        this.damagePlayer(1, wallRes.normalX, wallRes.normalY);
      } else if (p.armored) {
        const prevTier = p.chargeTier;
        p.chargeTier = Math.min(COMBAT.MAX_CHARGE_TIER, p.chargeTier + 1);
        this.audio.playBounce(p.chargeTier, false);
        const tierColors = [COLORS.charge0, COLORS.charge1, COLORS.charge2, COLORS.charge3];
        const col = tierColors[p.chargeTier] ?? COLORS.charge3;
        this.spawnSparks(p.x, p.y, wallRes.normalX, wallRes.normalY, col, 6 + p.chargeTier * 2, 50, 130);
        if (p.chargeTier > prevTier) {
          const label = p.chargeTier === 3 ? '3x MAX!' : `${p.chargeTier}x`;
          this.addFloatingText(p.x, p.y - 12, label, col, 0.9);
        }
      } else {
        this.audio.playBounce(0, false);
      }
    }
  }

  private updateSawblades(dt: number): void {
    for (let i = this.sawblades.length - 1; i >= 0; i--) {
      const s = this.sawblades[i];
      s.spin += dt * 22;

      for (const [id, cd] of s.hitCooldowns.entries()) {
        if (cd - dt <= 0) {
          s.hitCooldowns.delete(id);
        } else {
          s.hitCooldowns.set(id, cd - dt);
        }
      }

      const wallHit = stepCircleArena(s, dt, 1.0);
      if (wallHit.hitWall) {
        s.bouncesLeft -= wallHit.wallHitCount;
        s.bouncesDone = (s.bouncesDone ?? 0) + wallHit.wallHitCount;
        this.audio.playBounce(1, false);
        this.spawnSparks(s.x, s.y, wallHit.normalX, wallHit.normalY, COLORS.charge1, 4, 40, 100);
        if (s.bouncesLeft < 0) {
          this.sawblades.splice(i, 1);
          continue;
        }
      }

      for (const e of this.enemies) {
        if (e.hp <= 0 || s.hitCooldowns.has(e.id)) continue;
        if (len(e.x - s.x, e.y - s.y) <= e.radius + s.radius) {
          s.hitCooldowns.set(e.id, 0.16);
          if (e.kind === 'boss' && isBossFrontShieldHit(e, s.x - s.vx * 0.03, s.y - s.vy * 0.03)) {
            this.deflectOffBossShield(s.x, s.y);
            const n = normalizeOr(s.x - e.x, s.y - e.y, -s.vx, -s.vy);
            const speed = len(s.vx, s.vy);
            s.x = e.x + n.x * (e.radius + s.radius + 1);
            s.y = e.y + n.y * (e.radius + s.radius + 1);
            s.vx = n.x * speed;
            s.vy = n.y * speed;
            s.bouncesLeft--;
            s.bouncesDone = (s.bouncesDone ?? 0) + 1;
          } else {
            const dir = normalize(s.vx, s.vy);
            const isBankOrCharged = (s.bouncesDone ?? 0) > 0 || Boolean(s.fromCharge);
            this.damageEnemy(e, s.damage, dir.x * 130, dir.y * 130, s.x, s.y, isBankOrCharged);
          }
        }
      }

      for (const h of this.hazards) {
        if (h.triggered || h.kind !== 'barrel') continue;
        if (len(h.x - s.x, h.y - s.y) <= h.radius + s.radius) {
          this.hitHazard(h, s.x, s.y);
        }
      }

      if (s.bouncesLeft < 0) {
        this.sawblades.splice(i, 1);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (
        pr.x - pr.radius <= ARENA.left ||
        pr.x + pr.radius >= ARENA.right ||
        pr.y - pr.radius <= ARENA.top ||
        pr.y + pr.radius >= ARENA.bottom
      ) {
        this.spawnSparks(pr.x, pr.y, -pr.vx, -pr.vy, pr.color, 3, 25, 75);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer) {
        let hit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (len(e.x - pr.x, e.y - pr.y) <= e.radius + pr.radius) {
            const dir = normalize(pr.vx, pr.vy);
            const kb = pr.knockback ?? 160;
            this.damageEnemy(
              e,
              pr.damage,
              dir.x * kb,
              dir.y * kb,
              pr.x - dir.x * 8,
              pr.y - dir.y * 8,
              Boolean(pr.fromCharge),
            );
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const h of this.hazards) {
            if (h.triggered) continue;
            if (len(h.x - pr.x, h.y - pr.y) <= h.radius + pr.radius) {
              this.hitHazard(h, pr.x, pr.y);
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          this.projectiles.splice(i, 1);
        }
      } else {
        // Red enemy projectile: damages player even while armored!
        if (len(this.player.x - pr.x, this.player.y - pr.y) <= this.player.radius + pr.radius) {
          const dir = normalize(pr.vx, pr.vy);
          this.damagePlayer(pr.damage, dir.x, dir.y);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.slammedTimer > 0) e.slammedTimer = Math.max(0, e.slammedTimer - dt);

      const toPlayer = normalize(p.x - e.x, p.y - e.y);

      switch (e.kind) {
        case 'slime': {
          e.stateTimer += dt;
          const desiredVx = toPlayer.x * 34;
          const desiredVy = toPlayer.y * 34;
          e.vx += (desiredVx - e.vx) * Math.min(1, dt * PHYSICS.ENEMY_KNOCKBACK_DRAG);
          e.vy += (desiredVy - e.vy) * Math.min(1, dt * PHYSICS.ENEMY_KNOCKBACK_DRAG);
          break;
        }
        case 'spike_slime': {
          e.stateTimer -= dt;
          if (e.spikeState === 'calm' && e.stateTimer <= 0) {
            e.spikeState = 'telegraph';
            e.stateTimer = 0.75;
          } else if (e.spikeState === 'telegraph' && e.stateTimer <= 0) {
            e.spikeState = 'spiked';
            e.stateTimer = 1.25;
          } else if (e.spikeState === 'spiked' && e.stateTimer <= 0) {
            e.spikeState = 'calm';
            e.stateTimer = 1.85;
          }
          const chaseSpeed = e.spikeState === 'spiked' ? 18 : 30;
          e.vx += (toPlayer.x * chaseSpeed - e.vx) * Math.min(1, dt * PHYSICS.ENEMY_KNOCKBACK_DRAG);
          e.vy += (toPlayer.y * chaseSpeed - e.vy) * Math.min(1, dt * PHYSICS.ENEMY_KNOCKBACK_DRAG);
          break;
        }
        case 'sniper': {
          e.vx *= Math.exp(-PHYSICS.ENEMY_KNOCKBACK_DRAG * dt);
          e.vy *= Math.exp(-PHYSICS.ENEMY_KNOCKBACK_DRAG * dt);
          e.stateTimer -= dt;
          const targetAngle = Math.atan2(p.y - e.y, p.x - e.x);

          if (e.sniperState === 'cooldown') {
            e.angle = this.rotateToward(e.angle, targetAngle, dt * 2.2);
            if (e.stateTimer <= 0) {
              e.sniperState = 'tracking';
              e.stateTimer = 1.15;
            }
          } else if (e.sniperState === 'tracking') {
            e.angle = this.rotateToward(e.angle, targetAngle, dt * 1.9);
            if (e.stateTimer <= 0) {
              e.sniperState = 'locked';
              e.stateTimer = 0.42;
            }
          } else if (e.sniperState === 'locked') {
            if (e.stateTimer <= 0) {
              const bx = Math.cos(e.angle);
              const by = Math.sin(e.angle);
              this.projectiles.push({
                id: allocEntityId(),
                fromPlayer: false,
                x: e.x + bx * (e.radius + 3),
                y: e.y + by * (e.radius + 3),
                vx: bx * 255,
                vy: by * 255,
                radius: 3.5,
                damage: 1,
                life: 3.0,
                color: COLORS.bulletRed,
              });
              this.spawnSparks(e.x + bx * 10, e.y + by * 10, bx, by, COLORS.bulletRed, 5, 40, 100);
              e.sniperState = 'cooldown';
              e.stateTimer = 1.4;
            }
          }
          break;
        }
        case 'bomb_bot': {
          e.vx += (toPlayer.x * 42 - e.vx) * Math.min(1, dt * PHYSICS.ENEMY_KNOCKBACK_DRAG);
          e.vy += (toPlayer.y * 42 - e.vy) * Math.min(1, dt * PHYSICS.ENEMY_KNOCKBACK_DRAG);
          break;
        }
        case 'boss': {
          const targetAngle = Math.atan2(p.y - e.y, p.x - e.x);
          e.angle = this.rotateToward(e.angle, targetAngle, dt * 1.15);

          // Drift gently in upper/mid arena
          const anchorX = 135 + Math.sin(this.roomTimer * 0.7) * 52;
          const anchorY = 145 + Math.cos(this.roomTimer * 0.5) * 28;
          const toAnchor = normalizeOr(anchorX - e.x, anchorY - e.y, 0, 0);
          const anchorDist = len(anchorX - e.x, anchorY - e.y);
          const moveSpeed = anchorDist > 6 ? 26 : 0;
          e.vx += (toAnchor.x * moveSpeed - e.vx) * Math.min(1, dt * 3.5);
          e.vy += (toAnchor.y * moveSpeed - e.vy) * Math.min(1, dt * 3.5);

          e.stateTimer -= dt;
          if (e.bossPhase === 0 && e.stateTimer <= 0) {
            e.bossPhase = 1; // Telegraph radial burst
            e.stateTimer = 0.65;
          } else if (e.bossPhase === 1 && e.stateTimer <= 0) {
            this.fireBossRadialBurst(e);
            e.bossPhase = 0;
            e.stateTimer = 2.15;
          }
          break;
        }
      }

      const preWallSpeed = len(e.vx, e.vy);
      const wallHit = stepCircleArena(e, dt, 0.6);
      if (wallHit.hitWall && e.slammedTimer > 0 && preWallSpeed >= PHYSICS.WALL_SLAM_SPEED_THRESHOLD) {
        e.slammedTimer = 0;
        this.audio.playWallSlam();
        this.triggerHitstop(COMBAT.HITSTOP_LIGHT_SEC);
        this.addShake(-wallHit.normalX, -wallHit.normalY, 4);
        this.addFloatingText(e.x, e.y - 12, 'WALL SLAM!', COLORS.textGold, 0.95);
        this.spawnSparks(e.x, e.y, wallHit.normalX, wallHit.normalY, COLORS.textGold, 10, 50, 140);
        this.damageEnemy(e, COMBAT.WALL_SLAM_BONUS_DAMAGE, 0, 0, e.x, e.y, true, true);

        if (p.perks.explosive_slam > 0) {
          this.triggerExplosiveSlam(e.x, e.y, p.perks.explosive_slam);
        }
      }

      // Player vs Enemy collision
      if (e.hp <= 0) continue;
      const dist = len(p.x - e.x, p.y - e.y);
      if (dist < p.radius + e.radius) {
        if (p.armored) {
          if (e.kind === 'spike_slime' && e.spikeState === 'spiked') {
            const away = normalizeOr(p.x - e.x, p.y - e.y, 0, 1);
            resolveCircleCollision(p, e, 0.9);
            this.clampToArena(p);
            this.clampToArena(e);
            this.damagePlayer(1, away.x, away.y);
          } else if (e.kind === 'bomb_bot') {
            resolveCircleCollision(p, e, 0.9);
            this.clampToArena(p);
            this.clampToArena(e);
            this.detonateBombBot(e);
          } else if (e.kind === 'boss' && isBossFrontShieldHit(e, p.x, p.y)) {
            resolveCircleCollision(p, e, 0.95);
            this.clampToArena(p);
            this.clampToArena(e);
            this.deflectOffBossShield(p.x, p.y);
          } else {
            const ramDir = normalizeOr(e.x - p.x, e.y - p.y, p.aimDirX, p.aimDirY);
            resolveCircleCollision(p, e, 0.95);
            this.clampToArena(p);
            this.clampToArena(e);
            const ramDmg = COMBAT.RAM_BASE_DAMAGE + (p.chargeTier >= 2 ? 1 : 0);
            const knockSpeed = 290 + p.chargeTier * 35;
            e.slammedTimer = 0.8;
            this.audio.playRam(p.chargeTier >= 2);
            this.triggerHitstop(COMBAT.HITSTOP_LIGHT_SEC);
            this.addShake(ramDir.x, ramDir.y, 3.5);
            this.damageEnemy(
              e,
              ramDmg,
              ramDir.x * knockSpeed,
              ramDir.y * knockSpeed,
              p.x,
              p.y,
              p.chargeTier >= 1,
            );
          }
        } else {
          // Vulnerable: touching enemies hurts player
          const away = normalizeOr(p.x - e.x, p.y - e.y, 0, 1);
          resolveCircleCollision(p, e, 0.7);
          this.clampToArena(p);
          this.clampToArena(e);
          if (e.kind === 'bomb_bot') {
            this.detonateBombBot(e);
          } else {
            this.damagePlayer(1, away.x, away.y);
          }
        }
      }
    }

    // Separate overlapping enemies softly
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.hp <= 0) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.hp <= 0) continue;
        const res = resolveCircleCollision(a, b, 0.6);
        if (res.collided) {
          this.clampToArena(a);
          this.clampToArena(b);
        }
      }
    }
  }

  private clampToArena(entity: { x: number; y: number; radius: number }): void {
    entity.x = clamp(entity.x, ARENA.left + entity.radius, ARENA.right - entity.radius);
    entity.y = clamp(entity.y, ARENA.top + entity.radius, ARENA.bottom - entity.radius);
  }

  private fireBossRadialBurst(boss: Enemy): void {
    const burstIndex = (boss.bossBurstCount ?? 0) + 1;
    boss.bossBurstCount = burstIndex;
    const count = 9 + Math.floor(this.roomNumber / 5);
    const offset = (burstIndex % 2) * (Math.PI / count);

    for (let i = 0; i < count; i++) {
      const a = offset + (i * Math.PI * 2) / count;
      const bx = Math.cos(a);
      const by = Math.sin(a);
      this.projectiles.push({
        id: allocEntityId(),
        fromPlayer: false,
        x: boss.x + bx * (boss.radius + 2),
        y: boss.y + by * (boss.radius + 2),
        vx: bx * 145,
        vy: by * 145,
        radius: 3.5,
        damage: 1,
        life: 3.6,
        color: COLORS.bulletRed,
      });
    }
    this.rings.push({
      x: boss.x,
      y: boss.y,
      radius: boss.radius,
      maxRadius: boss.radius + 20,
      color: COLORS.bossCore,
      life: 0.25,
      maxLife: 0.25,
    });
    this.audio.playWeapon('shotgun', 0);
  }

  private updateHazards(dt: number): void {
    const p = this.player;
    for (const h of this.hazards) {
      if (h.pulseTimer > 0) h.pulseTimer = Math.max(0, h.pulseTimer - dt);
      if (h.triggered) continue;

      const d = len(p.x - h.x, p.y - h.y);
      if (d < p.radius + h.radius) {
        if (h.kind === 'bumper') {
          const away = normalizeOr(p.x - h.x, p.y - h.y, p.aimDirX, p.aimDirY);
          p.x = h.x + away.x * (p.radius + h.radius + 1);
          p.y = h.y + away.y * (p.radius + h.radius + 1);
          const bumpSpeed = PHYSICS.BUMPER_BOUNCE_SPEED * (1 + p.perks.bounce_speed * 0.08);
          p.vx = away.x * bumpSpeed;
          p.vy = away.y * bumpSpeed;
          p.aimDirX = away.x;
          p.aimDirY = away.y;
          p.armored = true;
          const prev = p.chargeTier;
          p.chargeTier = Math.min(COMBAT.MAX_CHARGE_TIER, p.chargeTier + 1);
          h.pulseTimer = 0.28;
          this.audio.playBumper();
          this.addShake(away.x, away.y, 2.5);
          this.spawnSparks(h.x, h.y, away.x, away.y, COLORS.bumper, 8, 60, 150);
          this.addFloatingText(
            h.x,
            h.y - 14,
            p.chargeTier > prev ? `BUMP +${p.chargeTier}x` : 'BUMP!',
            COLORS.bumper,
            0.9,
          );
        } else if (h.kind === 'barrel') {
          const away = normalizeOr(p.x - h.x, p.y - h.y, -p.aimDirX, -p.aimDirY);
          if (p.armored) {
            p.vx = away.x * Math.max(len(p.vx, p.vy), 240);
            p.vy = away.y * Math.max(len(p.vx, p.vy), 240);
            p.x = h.x + away.x * (p.radius + h.radius + 12);
            p.y = h.y + away.y * (p.radius + h.radius + 12);
          }
          this.detonateBarrel(h);
        }
      }
    }
  }

  private hitHazard(hazard: Hazard, sourceX: number, sourceY: number): void {
    if (hazard.triggered) return;
    if (hazard.kind === 'barrel') {
      this.detonateBarrel(hazard);
    } else if (hazard.kind === 'bumper') {
      hazard.pulseTimer = 0.25;
      this.audio.playBumper();
      const dir = normalizeOr(hazard.x - sourceX, hazard.y - sourceY, 0, -1);
      this.spawnSparks(hazard.x, hazard.y, dir.x, dir.y, COLORS.bumper, 5, 40, 90);
    }
  }

  private detonateBarrel(barrel: Hazard): void {
    if (barrel.triggered) return;
    barrel.triggered = true;
    barrel.hp = 0;
    this.explodeAt(barrel.x, barrel.y, COMBAT.BARREL_BLAST_RADIUS, COMBAT.BARREL_DAMAGE, false);
  }

  private detonateBombBot(bot: Enemy): void {
    if (bot.hp <= 0) return;
    bot.hp = 0;
    this.explodeAt(bot.x, bot.y, COMBAT.BOMB_BLAST_RADIUS, COMBAT.BOMB_DAMAGE, true, bot.id);
    this.onEnemyKilled(bot, this.player.chargeTier >= 1);
  }

  private explodeAt(
    x: number,
    y: number,
    radius: number,
    enemyDamage: number,
    hurtsPlayerArmored: boolean,
    skipEnemyId?: number,
  ): void {
    this.audio.playExplosion();
    this.triggerHitstop(COMBAT.HITSTOP_HEAVY_SEC);
    this.addShake(0, 1, 6);
    this.rings.push({
      x,
      y,
      radius: 6,
      maxRadius: radius,
      color: COLORS.bombBot,
      life: 0.28,
      maxLife: 0.28,
    });
    this.spawnSparks(x, y, 0, -1, COLORS.textGold, 16, 60, 180, Math.PI * 2);

    for (const e of this.enemies) {
      if (e.hp <= 0 || e.id === skipEnemyId) continue;
      if (len(e.x - x, e.y - y) <= radius + e.radius) {
        const dir = normalizeOr(e.x - x, e.y - y, 0, -1);
        this.damageEnemy(e, enemyDamage, dir.x * 200, dir.y * 200, x, y, true, true);
      }
    }

    for (const h of this.hazards) {
      if (!h.triggered && h.kind === 'barrel' && len(h.x - x, h.y - y) <= radius + h.radius) {
        this.detonateBarrel(h);
      }
    }

    const pDist = len(this.player.x - x, this.player.y - y);
    if (pDist <= radius + this.player.radius && (hurtsPlayerArmored || !this.player.armored)) {
      const away = normalizeOr(this.player.x - x, this.player.y - y, 0, 1);
      this.damagePlayer(1, away.x, away.y);
    }
  }

  private triggerExplosiveSlam(x: number, y: number, stacks: number): void {
    const radius = COMBAT.EXPLOSIVE_SLAM_RADIUS + (stacks - 1) * 10;
    this.rings.push({
      x,
      y,
      radius: 4,
      maxRadius: radius,
      color: COLORS.textGold,
      life: 0.22,
      maxLife: 0.22,
    });
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (len(e.x - x, e.y - y) <= radius + e.radius) {
        const dir = normalizeOr(e.x - x, e.y - y, 0, -1);
        this.damageEnemy(e, 2 + stacks, dir.x * 140, dir.y * 140, x, y, true, true);
      }
    }
  }

  private damageEnemy(
    enemy: Enemy,
    dmg: number,
    kx: number,
    ky: number,
    sourceX: number,
    sourceY: number,
    isBankOrCharged: boolean,
    ignoreShield = false,
  ): void {
    if (enemy.hp <= 0) return;

    if (!ignoreShield && enemy.kind === 'boss' && isBossFrontShieldHit(enemy, sourceX, sourceY)) {
      this.deflectOffBossShield(sourceX, sourceY);
      return;
    }

    const isWeakspotCrit = enemy.kind === 'boss' && !ignoreShield;
    const totalDmg = dmg + (isWeakspotCrit ? 1 : 0);
    enemy.hp -= totalDmg;
    enemy.hitFlash = 0.12;
    enemy.vx += kx;
    enemy.vy += ky;

    this.addFloatingText(
      enemy.x,
      enemy.y - enemy.radius - 2,
      isWeakspotCrit ? `CRIT -${totalDmg}!` : `-${totalDmg}`,
      isWeakspotCrit ? COLORS.bossCore : COLORS.textWhite,
      isWeakspotCrit ? 1.05 : 0.9,
    );
    this.spawnSparks(
      enemy.x,
      enemy.y,
      kx,
      ky,
      isWeakspotCrit ? COLORS.bossCore : COLORS.textGold,
      6,
      40,
      120,
    );

    if (enemy.hp <= 0) {
      if (enemy.kind === 'bomb_bot') {
        // Trigger AoE blast on death!
        this.explodeAt(enemy.x, enemy.y, COMBAT.BOMB_BLAST_RADIUS, COMBAT.BOMB_DAMAGE, true, enemy.id);
      }
      this.onEnemyKilled(enemy, isBankOrCharged);
    }
  }

  private deflectOffBossShield(x: number, y: number): void {
    this.audio.playShieldDeflect();
    this.spawnSparks(x, y, 0, 1, COLORS.bossShield, 7, 50, 120);
    this.addFloatingText(x, y - 10, 'DEFLECT!', COLORS.bossShield, 0.85);
  }

  private onEnemyKilled(enemy: Enemy, isBankOrCharged: boolean): void {
    this.multiKillTimer = 0.6;
    this.multiKillCount += 1;
    this.audio.playKill(this.multiKillCount);

    if (isBankOrCharged || this.multiKillCount >= 2) {
      this.flowMultiplier = Math.min(5.0, +(this.flowMultiplier + 0.5).toFixed(1));
      this.updateMusicIntensity();
    }

    const basePoints = enemy.kind === 'boss' ? 500 : 100;
    const gained = Math.round(basePoints * this.flowMultiplier);
    this.score += gained;

    if (this.multiKillCount >= 3 || enemy.kind === 'boss') {
      this.triggerHitstop(COMBAT.HITSTOP_HEAVY_SEC);
      this.addShake(0, -1, 5.5);
      if (this.multiKillCount >= 3) {
        this.addFloatingText(enemy.x, enemy.y - 20, `${this.multiKillCount}x KILL!`, COLORS.charge3, 1.15);
      }
    }

    this.spawnSparks(
      enemy.x,
      enemy.y,
      0,
      -1,
      enemy.kind === 'boss' ? COLORS.bossCore : COLORS.slime,
      enemy.kind === 'boss' ? 24 : 10,
      50,
      160,
      Math.PI * 2,
    );
  }

  private damagePlayer(amount: number, knockX: number, knockY: number): void {
    const p = this.player;
    if (p.iframes > 0 || this.phase !== 'playing') return;

    p.iframes = COMBAT.PLAYER_IFRAMES_SEC;
    p.flashTimer = 0.25;
    this.tookDamageThisRoom = true;
    this.flowMultiplier = 1.0;
    this.updateMusicIntensity();

    if (p.shield > 0) {
      p.shield -= 1;
      this.audio.playShieldBreak();
      this.triggerHitstop(COMBAT.HITSTOP_LIGHT_SEC);
      this.addShake(knockX, knockY, 5);
      this.addFloatingText(p.x, p.y - 14, 'SHIELD BREAK!', COLORS.textCyan, 1.0);
      this.spawnSparks(p.x, p.y, knockX, knockY, COLORS.textCyan, 12, 60, 150, Math.PI * 2);
      return;
    }

    p.hp = Math.max(0, p.hp - amount);
    this.audio.playHpHit();
    this.triggerHitstop(COMBAT.HITSTOP_HEAVY_SEC);
    this.addShake(knockX, knockY, 7);
    this.addFloatingText(p.x, p.y - 14, `-${amount} HP`, COLORS.textRed, 1.1);
    this.spawnSparks(p.x, p.y, knockX, knockY, COLORS.textRed, 14, 60, 160, Math.PI * 2);

    if (p.hp <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    this.clearPointerState(true);
    const isNewBest = this.score > this.bestScore;
    if (isNewBest) this.bestScore = this.score;
    if (this.roomNumber > this.bestRoom) this.bestRoom = this.roomNumber;
    this.savePersistentState();
    this.setPhase('gameover');
    this.callbacks.onGameOver?.({
      score: this.score,
      bestScore: this.bestScore,
      roomNumber: this.roomNumber,
      bestRoom: this.bestRoom,
      isNewBest,
    });
  }

  private updateEffects(dt: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - Math.max(0, r.life / r.maxLife);
      r.radius = r.maxRadius * t;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-4 * dt);
      pt.vy *= Math.exp(-4 * dt);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private cleanupDeadAndCheckClear(): void {
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.hazards = this.hazards.filter((h) => !h.triggered);

    if (this.enemies.length === 0 && this.phase === 'playing') {
      if (!this.tookDamageThisRoom) {
        this.flowMultiplier = Math.min(5.0, +(this.flowMultiplier + 0.5).toFixed(1));
      }
      const clearBonus = Math.round(this.roomNumber * 100 * this.flowMultiplier);
      this.score += clearBonus;
      if (this.score > this.bestScore) this.bestScore = this.score;
      if (this.roomNumber > this.bestRoom) this.bestRoom = this.roomNumber;
      this.savePersistentState();
      this.player.shield = this.player.maxShield;
      this.hazards = [];
      this.projectiles = [];
      this.sawblades = [];
      this.clearPointerState(true);
      this.audio.playRoomClear();
      this.transitionTimer = 0;
      this.setPhase('transition');
    }
  }

  private rotateToward(current: number, target: number, maxStep: number): number {
    let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
  }

  private triggerHitstop(sec: number): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, sec);
  }

  private addShake(dx: number, dy: number, intensity: number): void {
    const n = normalizeOr(dx, dy, 0, 1);
    this.shakeDirX = n.x;
    this.shakeDirY = n.y;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = 0.18;
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1,
  ): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -24,
      text,
      color,
      life: 0.72,
      maxLife: 0.72,
      scale,
    });
  }

  private spawnSparks(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    color: string,
    count: number,
    speedMin: number,
    speedMax: number,
    spreadRad = Math.PI * 0.9,
  ): void {
    const baseAngle = Math.atan2(dirY, dirX);
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spreadRad;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      const maxLife = 0.16 + Math.random() * 0.18;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 1.5 + Math.random() * 1.5,
        color,
        life: maxLife,
        maxLife,
      });
    }
  }

  // ---- Rendering Snapshot ----

  private buildAimRenderState(): AimRenderState {
    if (!this.isSlingshotDragging || this.phase !== 'playing') {
      return {
        active: false,
        pullX: 0,
        pullY: 0,
        pullRatio: 0,
        focusRemainingRatio: 1,
        slowMoActive: false,
        previewPoints: [],
      };
    }

    const rawPullX = this.pointerDownPos.x - this.pointerCurPos.x;
    const rawPullY = this.pointerDownPos.y - this.pointerCurPos.y;
    const pullDist = len(rawPullX, rawPullY);
    const dir = normalize(rawPullX, rawPullY);
    const pullRatio = clamp(pullDist / CONTROLS.SLINGSHOT_MAX_PULL_PX, 0.22, 1.0);
    const maxBounces = CONTROLS.BASE_PREVIEW_BOUNCES + this.player.perks.preview_bounce;

    const previewPoints =
      pullDist >= CONTROLS.DRAG_THRESHOLD_PX
        ? raycastArena(
            this.player.x,
            this.player.y,
            dir.x,
            dir.y,
            maxBounces,
            this.player.radius,
          )
        : [];

    const maxFocus = this.getMaxFocusDuration();
    return {
      active: pullDist >= CONTROLS.DRAG_THRESHOLD_PX,
      pullX: -dir.x * Math.min(pullDist, CONTROLS.SLINGSHOT_MAX_PULL_PX) * 0.45,
      pullY: -dir.y * Math.min(pullDist, CONTROLS.SLINGSHOT_MAX_PULL_PX) * 0.45,
      pullRatio,
      focusRemainingRatio: clamp(this.focusRemainingSec / maxFocus, 0, 1),
      slowMoActive: this.slowMoActive,
      previewPoints,
    };
  }

  getRenderState(): RenderState {
    return {
      phase: this.phase,
      player: this.player,
      enemies: this.enemies,
      hazards: this.hazards,
      projectiles: this.projectiles,
      sawblades: this.sawblades,
      beams: this.beams,
      arcs: this.arcs,
      rings: this.rings,
      particles: this.particles,
      floatingTexts: this.floatingTexts,
      roomNumber: this.roomNumber,
      score: this.score,
      flowMultiplier: this.flowMultiplier,
      roomTimer: this.roomTimer,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      transitionProgress: clamp(this.transitionTimer / TRANSITION.ROOM_SCROLL_SEC, 0, 1),
      aim: this.buildAimRenderState(),
      time: this.timeElapsed,
    };
  }

  renderFrame(): void {
    if (!this.ctx) return;
    this.renderer.render(this.ctx, this.getRenderState());
  }
}
