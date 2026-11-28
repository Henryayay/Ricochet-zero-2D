import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../audio.ts';
import {
  ARENA,
  COLORS,
  COMBAT,
  CONTROLS,
  OVERHEAT,
  PERK_MAX_RANKS,
  PHYSICS,
  TRANSITION,
} from '../constants.ts';
import type { DraftOption, Enemy, PerkId } from '../entities.ts';
import { GameEngine } from '../engine.ts';
import {
  isBossFrontShieldHit,
  len,
  normalize,
  raycastArena,
  stepCircleArena,
} from '../physics.ts';
import { generateDraftOptions, generateRoom } from '../rooms.ts';

function triggerQuickTap(
  engine: GameEngine,
  x: number,
  y: number,
  pointerId = 1,
  startMs = 1000,
  durationMs = 60,
): void {
  engine.handlePointerDown(x, y, pointerId, startMs);
  engine.handlePointerUp(x + 2, y + 2, pointerId, startMs + durationMs);
}

function advanceRoomClearToDraft(engine: GameEngine): void {
  // Kill all enemies cleanly in the current room
  for (const enemy of engine.enemies) {
    enemy.hp = 0;
  }
  engine.stepSimulation(PHYSICS.FIXED_DT);
  expect(engine.phase).toBe('transition');

  const steps = Math.ceil(TRANSITION.ROOM_SCROLL_SEC / 0.05) + 1;
  for (let i = 0; i < steps; i++) {
    engine.update(0.05);
  }
  expect(engine.phase).toBe('draft');
}

describe('Ricochet Zero Core Systems', () => {
  describe('1. Sub-stepped Physics (stepCircleArena)', () => {
    it('prevents tunneling at 2400 px/s in a single dt = 1/60 frame and reflects cleanly', () => {
      const radius = PHYSICS.PLAYER_RADIUS;
      const entity = {
        x: ARENA.right - radius - 5,
        y: 200,
        vx: 2400,
        vy: 0,
        radius,
      };

      const res = stepCircleArena(entity, 1 / 60, PHYSICS.WALL_RESTITUTION);

      expect(res.hitWall).toBe(true);
      expect(res.normalX).toBe(-1);
      expect(res.normalY).toBe(0);
      expect(entity.x).toBeGreaterThanOrEqual(ARENA.left + radius);
      expect(entity.x).toBeLessThanOrEqual(ARENA.right - radius);
      expect(entity.vx).toBeCloseTo(-2400 * PHYSICS.WALL_RESTITUTION, 4);
      expect(entity.vy).toBe(0);
    });

    it('keeps fast diagonal corner movement (2400 px/s per axis) inside ARENA bounds', () => {
      const radius = PHYSICS.PLAYER_RADIUS;
      const entity = {
        x: ARENA.left + radius + 4,
        y: ARENA.top + radius + 4,
        vx: -2400,
        vy: -2400,
        radius,
      };

      const res = stepCircleArena(entity, 1 / 60, PHYSICS.WALL_RESTITUTION);

      expect(res.hitWall).toBe(true);
      expect(res.wallHitCount).toBeGreaterThanOrEqual(2);
      expect(entity.x).toBeGreaterThanOrEqual(ARENA.left + radius);
      expect(entity.x).toBeLessThanOrEqual(ARENA.right - radius);
      expect(entity.y).toBeGreaterThanOrEqual(ARENA.top + radius);
      expect(entity.y).toBeLessThanOrEqual(ARENA.bottom - radius);
      expect(entity.vx).toBeCloseTo(2400 * PHYSICS.WALL_RESTITUTION, 4);
      expect(entity.vy).toBeCloseTo(2400 * PHYSICS.WALL_RESTITUTION, 4);
    });
  });

  describe('2. Raycast Reflections (raycastArena)', () => {
    it('returns 3 points for maxBounces = 1 and 4 points for maxBounces = 2 with exact reflection angles', () => {
      const startX = 135;
      const startY = 200;

      const oneBounce = raycastArena(startX, startY, 1, -1, 1, 0);
      expect(oneBounce).toHaveLength(3);
      expect(oneBounce[0]).toEqual({ x: 135, y: 200 });
      expect(oneBounce[1].x).toBeCloseTo(260, 6);
      expect(oneBounce[1].y).toBeCloseTo(75, 6);
      expect(oneBounce[2].x).toBeCloseTo(225, 6);
      expect(oneBounce[2].y).toBeCloseTo(40, 6);

      const twoBounces = raycastArena(startX, startY, 1, -1, 2, 0);
      expect(twoBounces).toHaveLength(4);
      expect(twoBounces[3].x).toBeCloseTo(10, 6);
      expect(twoBounces[3].y).toBeCloseTo(255, 6);

      // Verify exact reflection vectors across segments
      const seg0 = normalize(
        twoBounces[1].x - twoBounces[0].x,
        twoBounces[1].y - twoBounces[0].y,
      );
      const seg1 = normalize(
        twoBounces[2].x - twoBounces[1].x,
        twoBounces[2].y - twoBounces[1].y,
      );
      const seg2 = normalize(
        twoBounces[3].x - twoBounces[2].x,
        twoBounces[3].y - twoBounces[2].y,
      );

      // Bounce 1 hits vertical right wall: dx flips, dy unchanged
      expect(seg1.x).toBeCloseTo(-seg0.x, 6);
      expect(seg1.y).toBeCloseTo(seg0.y, 6);

      // Bounce 2 hits horizontal top wall: dy flips, dx unchanged
      expect(seg2.x).toBeCloseTo(seg1.x, 6);
      expect(seg2.y).toBeCloseTo(-seg1.y, 6);
    });

    it('preserves exact reflection angles for non-45-degree rays', () => {
      const pts = raycastArena(135, 200, 2, -1, 2, 0);
      expect(pts).toHaveLength(4);

      const seg0 = normalize(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const seg1 = normalize(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
      const seg2 = normalize(pts[3].x - pts[2].x, pts[3].y - pts[2].y);

      // Right wall at x=260: dx=(125), dy=(-62.5) -> hits (260, 137.5)
      expect(pts[1].x).toBeCloseTo(260, 6);
      expect(pts[1].y).toBeCloseTo(137.5, 6);
      expect(seg1.x).toBeCloseTo(-seg0.x, 6);
      expect(seg1.y).toBeCloseTo(seg0.y, 6);

      // Top wall at y=40: t_y = 97.5 / (1/sqrt(5)) => x = 260 - 195 = 65
      expect(pts[2].x).toBeCloseTo(65, 6);
      expect(pts[2].y).toBeCloseTo(40, 6);
      expect(seg2.x).toBeCloseTo(seg1.x, 6);
      expect(seg2.y).toBeCloseTo(-seg1.y, 6);
    });
  });

  describe('3. One-Thumb Input State Machine (GameEngine)', () => {
    it('activates slowMoActive on drag > 6px, expires after 2.5s real time, and launches on release', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');

      engine.handlePointerDown(135, 300, 1, 1000);
      expect(engine.getRenderState().aim.slowMoActive).toBe(false);

      // Drag > 6px downward -> Focus Ring activates
      engine.handlePointerMove(135, 340, 1);
      let aim = engine.getRenderState().aim;
      expect(aim.active).toBe(true);
      expect(aim.slowMoActive).toBe(true);
      expect(aim.focusRemainingRatio).toBeCloseTo(1, 5);

      // While slowMoActive is true (outside ramp-out), simulation runs at AIM_TIME_SCALE (0.12x)
      const beforeSlowTimer = engine.roomTimer;
      for (let i = 0; i < 10; i++) {
        engine.update(0.05); // 0.5s real time -> 0.06s sim time
      }
      expect(engine.roomTimer - beforeSlowTimer).toBeCloseTo(0.5 * CONTROLS.AIM_TIME_SCALE, 2);
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);

      // Advance remaining 2.05s real time to clear 2.5s total without FP edge drift
      for (let i = 0; i < 41; i++) {
        engine.update(0.05);
      }
      aim = engine.getRenderState().aim;
      expect(aim.slowMoActive).toBe(false);
      expect(aim.focusRemainingRatio).toBe(0);

      // Verify simulation has snapped back to 1.0x time scale
      const afterExpireTimer = engine.roomTimer;
      engine.update(0.05);
      expect(engine.roomTimer - afterExpireTimer).toBeCloseTo(0.05, 2);

      // Release downward drag -> launches player upward (opposite vector) at high armored speed
      engine.handlePointerUp(135, 368, 1, 2300);
      expect(engine.player.vx).toBeCloseTo(0, 4);
      expect(engine.player.vy).toBeLessThan(-PHYSICS.ARMORED_SPEED_THRESHOLD);
      expect(len(engine.player.vx, engine.player.vy)).toBeGreaterThanOrEqual(
        PHYSICS.MIN_LAUNCH_SPEED,
      );
      expect(engine.player.armored).toBe(true);
      expect(engine.player.aimDirX).toBeCloseTo(0, 4);
      expect(engine.player.aimDirY).toBeCloseTo(-1, 4);
    });

    it('mid-flight quick tap while armored stops player, fires along aimDir, and resets chargeTier', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');

      // Launch upward
      engine.handlePointerDown(135, 300, 1, 1000);
      engine.handlePointerMove(135, 350, 1);
      engine.handlePointerUp(135, 350, 1, 1100);
      expect(engine.player.armored).toBe(true);

      // Simulate charge built from wall bounces & oblique aimDir
      engine.player.aimDirX = 0.6;
      engine.player.aimDirY = -0.8;
      engine.player.chargeTier = 2;

      // Quick tap (< 140ms, < 10px drag)
      triggerQuickTap(engine, 120, 250, 2, 1200, 75);

      expect(engine.player.vx).toBe(0);
      expect(engine.player.vy).toBe(0);
      expect(engine.player.armored).toBe(false);
      expect(engine.player.chargeTier).toBe(0);

      expect(engine.beams).toHaveLength(1);
      const beam = engine.beams[0];
      const beamDir = normalize(beam.x2 - beam.x1, beam.y2 - beam.y1);
      expect(beamDir.x).toBeCloseTo(0.6, 4);
      expect(beamDir.y).toBeCloseTo(-0.8, 4);
    });

    it('quick tap while stationary (armored === false) does NOT fire weapon', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');

      expect(engine.player.armored).toBe(false);
      triggerQuickTap(engine, 135, 300, 1, 1000, 50);

      expect(engine.beams).toHaveLength(0);
      expect(engine.projectiles).toHaveLength(0);
      expect(engine.sawblades).toHaveLength(0);
      expect(engine.arcs).toHaveLength(0);
    });
  });

  describe('4. Wall-Bounce Charge System', () => {
    it('increments chargeTier 0 -> 1 -> 2 -> 3 (capped at 3) on armored wall bounces and resets below threshold', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      // Keep enemies far and harmless so room doesn't clear or interfere
      engine.enemies = [
        {
          id: 999,
          kind: 'slime',
          x: 200,
          y: 100,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 50,
          maxHp: 50,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        },
      ];
      engine.hazards = [];

      expect(engine.player.chargeTier).toBe(0);

      // Position near left wall moving left at armored speed
      engine.player.y = 350;
      for (let expectedTier = 1; expectedTier <= 4; expectedTier++) {
        engine.player.x = ARENA.left + engine.player.radius + 1;
        engine.player.vx = -400;
        engine.player.vy = 0;
        engine.stepSimulation(PHYSICS.FIXED_DT);
        expect(engine.player.chargeTier).toBe(Math.min(3, expectedTier));
      }

      // Drop speed below ARMORED_SPEED_THRESHOLD -> chargeTier resets to 0
      engine.player.x = 135;
      engine.player.y = 350;
      engine.player.vx = PHYSICS.ARMORED_SPEED_THRESHOLD - 10;
      engine.player.vy = 0;
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(engine.player.armored).toBe(false);
      expect(engine.player.chargeTier).toBe(0);
    });
  });

  describe('5. Anti-Stall Overheat', () => {
    it('damages player (Shield first, then HP) on wall bounce past OVERHEAT_START_SEC instead of granting Charge', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      engine.enemies = [
        {
          id: 998,
          kind: 'slime',
          x: 220,
          y: 80,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 50,
          maxHp: 50,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        },
      ];

      expect(engine.player.shield).toBe(1);
      expect(engine.player.hp).toBe(3);

      // Advance roomTimer past OVERHEAT.OVERHEAT_START_SEC (23s)
      engine.roomTimer = OVERHEAT.OVERHEAT_START_SEC;

      // 1st overheated wall bounce: consumes Shield, grants 0 charge
      engine.player.x = ARENA.left + engine.player.radius + 1;
      engine.player.y = 360;
      engine.player.vx = -400;
      engine.player.vy = 0;
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(engine.player.chargeTier).toBe(0);
      expect(engine.player.shield).toBe(0);
      expect(engine.player.hp).toBe(3);

      // Advance simulation past PLAYER_IFRAMES_SEC (0.9s) safely in center
      engine.player.x = 135;
      engine.player.y = 360;
      engine.player.vx = 0;
      engine.player.vy = 0;
      const iframeSteps = Math.ceil((COMBAT.PLAYER_IFRAMES_SEC + 0.05) / PHYSICS.FIXED_DT);
      for (let i = 0; i < iframeSteps; i++) {
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      expect(engine.player.iframes).toBe(0);

      // 2nd overheated wall bounce: consumes HP now that Shield is 0
      engine.player.x = ARENA.left + engine.player.radius + 1;
      engine.player.y = 360;
      engine.player.vx = -400;
      engine.player.vy = 0;
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(engine.player.chargeTier).toBe(0);
      expect(engine.player.shield).toBe(0);
      expect(engine.player.hp).toBe(2);
    });
  });

  describe('6. Weapons (railgun, shotgun, sawblade, arccoil)', () => {
    it('railgun damages enemies along aim vector and scales damage with chargeTier', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];

      const makeTarget = (x: number, y: number): Enemy => ({
        id: 1001,
        kind: 'slime',
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
      });

      // Tier 0 shot: damage = 2 + 0 * 2 = 2
      const targetTier0 = makeTarget(135, 200);
      engine.enemies = [targetTier0];
      engine.player.x = 135;
      engine.player.y = 350;
      engine.player.vx = 0;
      engine.player.vy = -300;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;
      triggerQuickTap(engine, 135, 350);
      expect(targetTier0.hp).toBe(18);

      // Tier 3 shot: damage = 2 + 3 * 2 = 8
      const targetTier3 = makeTarget(135, 200);
      engine.enemies = [targetTier3];
      engine.player.x = 135;
      engine.player.y = 350;
      engine.player.vx = 0;
      engine.player.vy = -300;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 3;
      triggerQuickTap(engine, 135, 350, 2, 2000, 50);
      expect(targetTier3.hp).toBe(12);
    });

    it('shotgun spawns pellets forward and applies backward recoil velocity to player', () => {
      const engine = new GameEngine();
      engine.startNewRun('shotgun');
      engine.hazards = [];

      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -300;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 1;

      triggerQuickTap(engine, 135, 300);

      // 5 + tier = 6 pellets moving forward (-Y)
      expect(engine.projectiles).toHaveLength(6);
      for (const p of engine.projectiles) {
        expect(p.fromPlayer).toBe(true);
        expect(p.vy).toBeLessThan(0);
      }

      // Armored backward recoil (+Y) with speed = 245 + 1*42 = 287
      expect(engine.player.armored).toBe(true);
      expect(engine.player.vx).toBeCloseTo(0, 4);
      expect(engine.player.vy).toBeCloseTo(287, 4);
    });

    it('sawblade spawns a bouncing sawblade with 2 + chargeTier bounces', () => {
      const engine = new GameEngine();
      engine.startNewRun('sawblade');
      engine.hazards = [];

      for (const tier of [0, 1, 2, 3]) {
        engine.sawblades = [];
        engine.player.x = 135;
        engine.player.y = 300;
        engine.player.vx = 0;
        engine.player.vy = -300;
        engine.player.aimDirX = 0;
        engine.player.aimDirY = -1;
        engine.player.armored = true;
        engine.player.chargeTier = tier;

        triggerQuickTap(engine, 135, 300, tier + 1, 1000 + tier * 200, 50);
        expect(engine.sawblades).toHaveLength(1);
        expect(engine.sawblades[0].bouncesLeft).toBe(2 + tier);
      }
    });

    it('arccoil chains lightning across nearby enemies up to 2 + chargeTier jumps', () => {
      const makeChain = (): Enemy[] =>
        [0, 1, 2, 3, 4, 5].map((i) => ({
          id: 2000 + i,
          kind: 'slime',
          x: 135,
          y: 280 - i * 40, // 40px apart (well within chainRange = 95)
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        }));

      for (const tier of [0, 2, 3]) {
        const engine = new GameEngine();
        engine.startNewRun('arccoil');
        engine.hazards = [];
        engine.enemies = makeChain();

        engine.player.x = 135;
        engine.player.y = 330;
        engine.player.vx = 0;
        engine.player.vy = -300;
        engine.player.aimDirX = 0;
        engine.player.aimDirY = -1;
        engine.player.armored = true;
        engine.player.chargeTier = tier;

        triggerQuickTap(engine, 135, 330);

        const damagedCount = engine.enemies.filter((e) => e.hp < e.maxHp).length;
        expect(damagedCount).toBe(2 + tier);
      }
    });
  });

  describe('7. Boss Frontal Shield vs Rear Weakspot (Room 5)', () => {
    it('Room 5 spawns boss (Armored Core)', () => {
      const room5 = generateRoom(5);
      expect(room5.isBossRoom).toBe(true);
      expect(room5.roomName).toBe('ARMORED CORE');
      expect(room5.enemies.some((e) => e.kind === 'boss')).toBe(true);

      // Verify progression through GameEngine reaches Room 5 with boss
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      for (let r = 1; r < 5; r++) {
        advanceRoomClearToDraft(engine);
        engine.selectDraftOption({
          id: 'perk_max_shield',
          kind: 'perk',
          perkId: 'max_shield',
          title: '+1 Max Shield',
          description: '',
        });
      }
      expect(engine.roomNumber).toBe(5);
      expect(engine.isBossRoom).toBe(true);
      expect(engine.roomName).toBe('ARMORED CORE');
      expect(engine.enemies.some((e) => e.kind === 'boss')).toBe(true);
    });

    it('deflects attacks from in front of boss.angle (0 damage) and crits attacks from behind', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      for (let r = 1; r < 5; r++) {
        advanceRoomClearToDraft(engine);
        engine.selectDraftOption({
          id: 'perk_preview_bounce',
          kind: 'perk',
          perkId: 'preview_bounce',
          title: '+1 Aim Preview Bounce',
          description: '',
        });
      }

      const boss = engine.enemies.find((e) => e.kind === 'boss');
      expect(boss).toBeDefined();
      if (!boss) return;

      // Boss spawns at (135, 130) facing downward (+Y, angle = PI/2)
      boss.angle = Math.PI / 2;
      const initialHp = boss.hp;

      // Attack from in front of boss.angle (player below boss aiming upward)
      engine.player.x = boss.x;
      engine.player.y = boss.y + 90;
      engine.player.vx = 0;
      engine.player.vy = -300;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, engine.player.x, engine.player.y, 1, 1000, 50);
      expect(boss.hp).toBe(initialHp);
      expect(engine.floatingTexts.some((ft) => ft.text === 'DEFLECT!')).toBe(true);

      // Attack from behind boss.angle (player above boss aiming downward)
      engine.floatingTexts = [];
      engine.player.x = boss.x;
      engine.player.y = boss.y - 70;
      engine.player.vx = 0;
      engine.player.vy = 300;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = 1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, engine.player.x, engine.player.y, 2, 1200, 50);
      // Railgun tier 0 deals 2 base + 1 rear weakspot crit = 3 damage
      expect(boss.hp).toBe(initialHp - 3);
      expect(engine.floatingTexts.some((ft) => ft.text === 'CRIT -3!')).toBe(true);
    });
  });

  describe('8. Room Clear, Shield Restore, Draft & Restart', () => {
    it('restores shield on room clear, transitions to draft, advances room on selectDraftOption, and resets cleanly on startNewRun', () => {
      const onDraftReady = vi.fn();
      const engine = new GameEngine({ onDraftReady });
      engine.startNewRun('railgun');

      // Simulate damaged shield & HP during room 1
      engine.player.shield = 0;
      engine.player.hp = 2;

      // Clear all enemies
      for (const e of engine.enemies) {
        e.hp = 0;
      }
      engine.stepSimulation(PHYSICS.FIXED_DT);

      // Shield restored immediately on clear, enters transition
      expect(engine.player.shield).toBe(engine.player.maxShield);
      expect(engine.phase).toBe('transition');

      // Transition completes -> draft phase
      const steps = Math.ceil(TRANSITION.ROOM_SCROLL_SEC / 0.05) + 1;
      for (let i = 0; i < steps; i++) {
        engine.update(0.05);
      }
      expect(engine.phase).toBe('draft');
      expect(onDraftReady).toHaveBeenCalledTimes(1);

      const options: DraftOption[] = onDraftReady.mock.calls[0][0];
      expect(options.length).toBeGreaterThan(0);

      // Select draft option -> advances to room 2
      engine.selectDraftOption(options[0]);
      expect(engine.roomNumber).toBe(2);
      expect(engine.phase).toBe('playing');
      expect(engine.enemies.length).toBeGreaterThan(0);
      expect(engine.score).toBeGreaterThan(0);

      // startNewRun() resets score, HP, shield, and Room 1 cleanly
      engine.startNewRun('railgun');
      expect(engine.phase).toBe('playing');
      expect(engine.roomNumber).toBe(1);
      expect(engine.score).toBe(0);
      expect(engine.flowMultiplier).toBe(1.0);
      expect(engine.player.hp).toBe(COMBAT.BASE_MAX_HP);
      expect(engine.player.maxHp).toBe(COMBAT.BASE_MAX_HP);
      expect(engine.player.shield).toBe(COMBAT.BASE_MAX_SHIELD);
      expect(engine.player.maxShield).toBe(COMBAT.BASE_MAX_SHIELD);
      expect(engine.player.chargeTier).toBe(0);
      expect(engine.player.armored).toBe(false);
    });
  });

  describe('9. Regression Checks', () => {
    it('Bomb Bot contact detonation awards score and hurts player even while armored', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      engine.enemies = [
        {
          id: 9001,
          kind: 'bomb_bot',
          x: 135,
          y: 250,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 2,
          maxHp: 2,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 0,
        },
        {
          id: 9002,
          kind: 'slime',
          x: 60,
          y: 120,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 5,
          maxHp: 5,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 0,
        },
      ];
      engine.player.x = 135;
      engine.player.y = 262;
      engine.player.vx = 0;
      engine.player.vy = -300;
      engine.player.armored = true;
      engine.player.shield = 1;

      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(engine.score).toBeGreaterThanOrEqual(100);
      expect(engine.player.shield).toBe(0);
      expect(engine.enemies.some((e) => e.id === 9001)).toBe(false);
    });

    it('Arc Coil skips indestructible bumpers and targets enemies directly', () => {
      const engine = new GameEngine();
      engine.startNewRun('arccoil');
      engine.hazards = [
        {
          id: 9101,
          kind: 'bumper',
          x: 135,
          y: 290,
          radius: 11,
          hp: 999,
          pulseTimer: 0,
          triggered: false,
        },
      ];
      const slime: Enemy = {
        id: 9102,
        kind: 'slime',
        x: 135,
        y: 255,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 10,
        maxHp: 10,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
      };
      engine.enemies = [slime];
      engine.player.x = 135;
      engine.player.y = 320;
      engine.player.vx = 0;
      engine.player.vy = -250;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 320);

      // PrimaryArc damage = 2 at tier 0 (not downgraded to 1 by bumper)
      expect(slime.hp).toBe(8);
    });

    it('Charged Shotgun kills increment flowMultiplier and cancelActiveInput clears stuck slow-mo', () => {
      const engine = new GameEngine();
      engine.startNewRun('shotgun');
      engine.hazards = [];
      engine.enemies = [
        {
          id: 9201,
          kind: 'slime',
          x: 135,
          y: 265,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 1,
          maxHp: 1,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        },
        {
          id: 9202,
          kind: 'slime',
          x: 50,
          y: 80,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 10,
          maxHp: 10,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        },
      ];
      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 2;

      triggerQuickTap(engine, 135, 300);
      for (let i = 0; i < 15; i++) {
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }

      expect(engine.flowMultiplier).toBeGreaterThan(1.0);

      // Drag into slow-mo then cancelActiveInput
      engine.handlePointerDown(100, 300, 7, 1000);
      engine.handlePointerMove(100, 340, 7);
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);
      engine.cancelActiveInput();
      expect(engine.getRenderState().aim.slowMoActive).toBe(false);
      expect(engine.getRenderState().aim.active).toBe(false);
    });
  });

  describe('10. Music Tracks, Narrow Boss Shield, Weapon Upgrades & Transfers', () => {
    it('narrows Boss front shield to 48 deg half-angle: deflects at 30 deg and passes with crit at 60 deg', () => {
      expect(COMBAT.BOSS_SHIELD_HALF_ANGLE_RAD).toBeCloseTo((48 * Math.PI) / 180, 6);

      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];

      const boss: Enemy = {
        id: 10001,
        kind: 'boss',
        x: 135,
        y: 160,
        vx: 0,
        vy: 0,
        radius: 20,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: Math.PI / 2,
        stateTimer: 10,
        bossPhase: 0,
      };
      engine.enemies = [boss];

      // 30 deg from boss.angle: deflects (0 damage)
      const angle30 = boss.angle + (30 * Math.PI) / 180;
      const pos30X = boss.x + Math.cos(angle30) * 80;
      const pos30Y = boss.y + Math.sin(angle30) * 80;
      expect(isBossFrontShieldHit(boss, pos30X, pos30Y)).toBe(true);

      const dir30 = normalize(boss.x - pos30X, boss.y - pos30Y);
      engine.player.x = pos30X;
      engine.player.y = pos30Y;
      engine.player.vx = dir30.x * 260;
      engine.player.vy = dir30.y * 260;
      engine.player.aimDirX = dir30.x;
      engine.player.aimDirY = dir30.y;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, pos30X, pos30Y, 1, 1000, 50);
      expect(boss.hp).toBe(20);
      expect(engine.floatingTexts.some((ft) => ft.text === 'DEFLECT!')).toBe(true);

      // 60 deg from boss.angle (previously deflected at 75 deg, now passes!): deals 2 + 1 crit = 3 damage
      engine.floatingTexts = [];
      const angle60 = boss.angle + (60 * Math.PI) / 180;
      const pos60X = boss.x + Math.cos(angle60) * 80;
      const pos60Y = boss.y + Math.sin(angle60) * 80;
      expect(isBossFrontShieldHit(boss, pos60X, pos60Y)).toBe(false);

      const dir60 = normalize(boss.x - pos60X, boss.y - pos60Y);
      engine.player.x = pos60X;
      engine.player.y = pos60Y;
      engine.player.vx = dir60.x * 260;
      engine.player.vy = dir60.y * 260;
      engine.player.aimDirX = dir60.x;
      engine.player.aimDirY = dir60.y;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, pos60X, pos60Y, 2, 1200, 50);
      expect(boss.hp).toBe(17);
      expect(engine.floatingTexts.some((ft) => ft.text === 'CRIT -3!')).toBe(true);
    });

    it('selects distinct room tracks 0..3 for rooms 1..4 and boss track 4 for boss rooms safely in headless mode', () => {
      const audio = new AudioEngine();
      const getTrackIndex = () => (audio as unknown as { bgmTrackIndex: number }).bgmTrackIndex;

      expect(() => {
        audio.init();
        audio.startMusic(1);

        audio.setMusicTrack(1, false);
        expect(getTrackIndex()).toBe(0);

        audio.setMusicTrack(2, false);
        expect(getTrackIndex()).toBe(1);

        audio.setMusicTrack(3, false);
        expect(getTrackIndex()).toBe(2);

        audio.setMusicTrack(4, false);
        expect(getTrackIndex()).toBe(3);

        audio.setMusicTrack(5, true);
        expect(getTrackIndex()).toBe(4);

        audio.setMusicIntensity(2);
        audio.stopMusic();
      }).not.toThrow();
    });

    it('applies Railgun upgrades (rail_beams, rail_width, rail_bounce) and uses COLORS.playerBullet', () => {
      // 1. rail_beams rank 2 spawns 3 beams; rail_width increases beam width & damage
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      const baseTarget: Enemy = {
        id: 10101,
        kind: 'slime',
        x: 135,
        y: 160,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
      };
      engine.enemies = [baseTarget];
      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 300, 1, 1000, 50);
      expect(engine.beams).toHaveLength(1);
      const baseWidth = engine.beams[0].width;
      const baseDamage = 20 - baseTarget.hp;
      expect(engine.beams[0].color).toBe(COLORS.playerBullet);
      expect(baseDamage).toBe(2);

      // Now upgrade rail_beams: 1 and rail_width: 1 (MAX_WEAPON_MOD_RANK = 1)
      engine.beams = [];
      baseTarget.hp = 20;
      engine.player.weaponMods.rail_beams = 1;
      engine.player.weaponMods.rail_width = 1;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 300, 2, 1200, 50);
      expect(engine.beams).toHaveLength(2);
      for (const beam of engine.beams) {
        expect(beam.color).toBe(COLORS.playerBullet);
        expect(beam.width).toBeGreaterThan(baseWidth);
      }
      expect(20 - baseTarget.hp).toBeGreaterThan(baseDamage);

      // 2. rail_bounce rank 1 reflects beam off wall (2 beam segments) and hits behind Boss shield
      const bounceEngine = new GameEngine();
      bounceEngine.startNewRun('railgun');
      bounceEngine.hazards = [];
      bounceEngine.player.weaponMods.rail_bounce = 1;

      const boss: Enemy = {
        id: 10102,
        kind: 'boss',
        x: 135,
        y: 180,
        vx: 0,
        vy: 0,
        radius: 20,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: Math.PI / 2, // Shield faces downward (+y); rear is above (y < 180)
        stateTimer: 10,
        bossPhase: 0,
      };
      bounceEngine.enemies = [boss];

      // Aim from (165, 120) toward top wall at (150, 40) -> segment 1 misses boss,
      // reflects off top wall downward through (123.75, 180) into boss's unshielded rear
      const dir = normalize(-15, -80);
      bounceEngine.player.x = 165;
      bounceEngine.player.y = 120;
      bounceEngine.player.vx = dir.x * 260;
      bounceEngine.player.vy = dir.y * 260;
      bounceEngine.player.aimDirX = dir.x;
      bounceEngine.player.aimDirY = dir.y;
      bounceEngine.player.armored = true;
      bounceEngine.player.chargeTier = 0;

      triggerQuickTap(bounceEngine, 165, 120, 3, 1400, 50);
      expect(bounceEngine.beams).toHaveLength(2);
      expect(bounceEngine.beams[0].color).toBe(COLORS.playerBullet);
      expect(bounceEngine.beams[1].color).toBe(COLORS.playerBullet);
      expect(boss.hp).toBe(17); // 2 base + 1 rear weakspot crit
      expect(bounceEngine.floatingTexts.some((ft) => ft.text === 'CRIT -3!')).toBe(true);
    });

    it('applies Shotgun upgrades (shot_pellets, shot_bounce, shot_caliber) with COLORS.playerBullet', () => {
      const engine = new GameEngine();
      engine.startNewRun('shotgun');
      engine.hazards = [];
      engine.enemies = [];

      // Base tier 0: 4 pellets, damage 1
      engine.player.x = 135;
      engine.player.y = 260;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 260, 1, 1000, 50);
      expect(engine.projectiles).toHaveLength(5);
      const baseDmg = engine.projectiles[0].damage;
      expect(baseDmg).toBe(1);
      expect(engine.projectiles.every((pr) => pr.color === COLORS.playerBullet)).toBe(true);

      // Upgrade shot_pellets (+2/rank) & shot_caliber (+1 dmg/rank), capped at rank 1
      engine.projectiles = [];
      engine.player.weaponMods.shot_pellets = 1;
      engine.player.weaponMods.shot_caliber = 1;
      engine.player.x = 135;
      engine.player.y = 260;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 260, 2, 1200, 50);
      expect(engine.projectiles).toHaveLength(7);
      expect(engine.projectiles[0].damage).toBeGreaterThan(baseDmg);
      expect(engine.projectiles[0].damage).toBe(2);

      // Upgrade shot_bounce rank 1: bounces once off arena wall (bouncesDone === 1) and despawns on 2nd wall hit
      const bounceEngine = new GameEngine();
      bounceEngine.startNewRun('shotgun');
      bounceEngine.hazards = [];
      bounceEngine.enemies = [
        {
          id: 10150,
          kind: 'slime',
          x: 230,
          y: 440,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 10,
          maxHp: 10,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        },
      ];
      bounceEngine.player.weaponMods.shot_bounce = 1;

      const cornerDir = normalize(-1, -1);
      bounceEngine.player.x = 28;
      bounceEngine.player.y = 85;
      bounceEngine.player.vx = cornerDir.x * 260;
      bounceEngine.player.vy = cornerDir.y * 260;
      bounceEngine.player.aimDirX = cornerDir.x;
      bounceEngine.player.aimDirY = cornerDir.y;
      bounceEngine.player.armored = true;
      bounceEngine.player.chargeTier = 0;

      triggerQuickTap(bounceEngine, 28, 85, 3, 1400, 50);
      expect(bounceEngine.projectiles.length).toBeGreaterThan(0);
      expect(bounceEngine.projectiles.every((pr) => pr.color === COLORS.playerBullet)).toBe(true);

      let sawFirstBounce = false;
      for (let i = 0; i < 40; i++) {
        bounceEngine.stepSimulation(PHYSICS.FIXED_DT);
        if (bounceEngine.projectiles.some((pr) => pr.bouncesDone === 1)) {
          sawFirstBounce = true;
        }
        if (bounceEngine.projectiles.length === 0) break;
      }

      expect(sawFirstBounce).toBe(true);
      // All pellets hit a second wall within ~0.25s (< 0.41s life) and despawn
      expect(bounceEngine.projectiles).toHaveLength(0);
    });

    it('applies Sawblade upgrades (saw_count, saw_bounce, saw_size)', () => {
      const engine = new GameEngine();
      engine.startNewRun('sawblade');
      engine.hazards = [];
      engine.enemies = [];

      engine.player.x = 135;
      engine.player.y = 260;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 260, 1, 1000, 50);
      expect(engine.sawblades).toHaveLength(1);
      const baseBounces = engine.sawblades[0].bouncesLeft;
      const baseRadius = engine.sawblades[0].radius;
      const baseDamage = engine.sawblades[0].damage;

      engine.sawblades = [];
      engine.player.weaponMods.saw_count = 1;
      engine.player.weaponMods.saw_bounce = 1;
      engine.player.weaponMods.saw_size = 1;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 260, 2, 1200, 50);
      expect(engine.sawblades).toHaveLength(2);
      for (const saw of engine.sawblades) {
        expect(saw.bouncesLeft).toBeGreaterThan(baseBounces);
        expect(saw.radius).toBeGreaterThan(baseRadius);
        expect(saw.damage).toBeGreaterThan(baseDamage);
      }
    });

    it('applies Arc Coil upgrades (arc_fork, arc_jumps, arc_overload)', () => {
      // arc_fork rank 1 fires 2 arcs
      const forkEngine = new GameEngine();
      forkEngine.startNewRun('arccoil');
      forkEngine.hazards = [];
      forkEngine.enemies = [];
      forkEngine.player.weaponMods.arc_fork = 1;
      forkEngine.player.x = 135;
      forkEngine.player.y = 260;
      forkEngine.player.vx = 0;
      forkEngine.player.vy = -260;
      forkEngine.player.aimDirX = 0;
      forkEngine.player.aimDirY = -1;
      forkEngine.player.armored = true;
      forkEngine.player.chargeTier = 0;

      triggerQuickTap(forkEngine, 135, 260, 1, 1000, 50);
      expect(forkEngine.arcs).toHaveLength(2);
      expect(forkEngine.arcs.every((arc) => arc.color === COLORS.playerBullet)).toBe(true);

      // arc_jumps increases chain jumps & arc_overload increases shock damage
      const makeChainLine = (jumpsRank: number, overloadRank: number) => {
        const engine = new GameEngine();
        engine.startNewRun('arccoil');
        engine.hazards = [];
        engine.player.weaponMods.arc_jumps = jumpsRank;
        engine.player.weaponMods.arc_overload = overloadRank;

        const targets: Enemy[] = [0, 1, 2, 3].map((idx) => ({
          id: 10200 + idx,
          kind: 'slime',
          x: 135,
          y: 250 - idx * 50,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        }));
        engine.enemies = targets;
        engine.player.x = 135;
        engine.player.y = 300;
        engine.player.vx = 0;
        engine.player.vy = -260;
        engine.player.aimDirX = 0;
        engine.player.aimDirY = -1;
        engine.player.armored = true;
        engine.player.chargeTier = 0;

        triggerQuickTap(engine, 135, 300, 1, 1000, 50);
        return targets;
      };

      const baseTargets = makeChainLine(0, 0);
      // Base maxJumps = 2 at tier 0: hits first 2 enemies (primary=2, chain=1), skips 3rd & 4th
      expect(20 - baseTargets[0].hp).toBe(2);
      expect(20 - baseTargets[1].hp).toBe(1);
      expect(20 - baseTargets[2].hp).toBe(0);
      expect(20 - baseTargets[3].hp).toBe(0);

      const upgradedTargets = makeChainLine(1, 1);
      // arc_jumps rank 1 -> maxJumps = 3; arc_overload rank 1 -> primary=3, chain=2
      expect(20 - upgradedTargets[0].hp).toBe(3);
      expect(20 - upgradedTargets[1].hp).toBe(2);
      expect(20 - upgradedTargets[2].hp).toBe(2);
      expect(20 - upgradedTargets[3].hp).toBe(0);
    });

    it('enforces COMBAT.MAX_WEAPON_UPGRADES = 3 for new mods in generateDraftOptions', () => {
      expect(COMBAT.MAX_WEAPON_UPGRADES).toBe(3);
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.player.weaponUpgradeBudget = 3;

      for (let i = 0; i < 20; i++) {
        const options = generateDraftOptions(engine.player, 2);
        expect(options).toHaveLength(3);
        expect(options.some((opt) => opt.kind === 'weapon_mod' && !opt.isRarityUpgrade)).toBe(false);
      }
    });

    it('transfers weaponUpgradeBudget to new weapon mods step-by-step on weapon swap', () => {
      const onDraftReady = vi.fn();
      const engine = new GameEngine({ onDraftReady });
      engine.startNewRun('railgun');

      engine.player.weaponUpgradeBudget = 2;
      engine.player.weaponMods.rail_beams = 1;
      engine.player.weaponMods.rail_width = 1;

      advanceRoomClearToDraft(engine);
      expect(onDraftReady).toHaveBeenCalledTimes(1);

      // Swap from railgun to shotgun
      engine.selectDraftOption({
        id: 'weapon_shotgun',
        kind: 'weapon',
        weaponId: 'shotgun',
        title: 'Equip: Recoil Shotgun',
        description: 'Wide pellet blast forward; kicks you sharply backward.',
      });

      expect(engine.phase).toBe('draft');
      expect(engine.player.weapon).toBe('shotgun');
      expect(Object.values(engine.player.weaponMods).every((rank) => rank === 0)).toBe(true);

      expect(onDraftReady).toHaveBeenCalledTimes(2);
      const [transferOpts1, , transferRem1, transferWeapon1] = onDraftReady.mock.calls[1] as [
        DraftOption[],
        number,
        number,
        string,
      ];
      expect(transferRem1).toBe(2);
      expect(transferWeapon1).toBe('shotgun');
      expect(transferOpts1.length).toBeGreaterThanOrEqual(2);
      expect(
        transferOpts1.every((opt) => opt.kind === 'weapon_mod' && opt.weaponId === 'shotgun'),
      ).toBe(true);

      // Pick first shotgun mod -> transferRemaining === 1, still in draft
      const mod1 = transferOpts1.find((opt) => opt.weaponModId === 'shot_pellets')!;
      expect(mod1).toBeDefined();
      engine.selectDraftOption(mod1);

      expect(engine.phase).toBe('draft');
      expect(onDraftReady).toHaveBeenCalledTimes(3);
      const [transferOpts2, , transferRem2, transferWeapon2] = onDraftReady.mock.calls[2] as [
        DraftOption[],
        number,
        number,
        string,
      ];
      expect(transferRem2).toBe(1);
      expect(transferWeapon2).toBe('shotgun');
      expect(
        transferOpts2.every((opt) => opt.kind === 'weapon_mod' && opt.weaponId === 'shotgun'),
      ).toBe(true);

      // Pick second shotgun mod -> advances to room 2 with budget preserved and both mods active
      const mod2 = transferOpts2.find((opt) => opt.weaponModId === 'shot_bounce')!;
      expect(mod2).toBeDefined();
      engine.selectDraftOption(mod2);

      expect(engine.phase).toBe('playing');
      expect(engine.roomNumber).toBe(2);
      expect(engine.player.weapon).toBe('shotgun');
      expect(engine.player.weaponUpgradeBudget).toBe(2);
      expect(engine.player.weaponMods.shot_pellets).toBe(1);
      expect(engine.player.weaponMods.shot_bounce).toBe(1);
    });
  });

  describe('11. Rebalance Caps & Expanded Enemy/Boss Bullet Patterns', () => {
    it('caps max_shield perk at HARD_MAX_SHIELD = 3 and removes it from draft pool once capped', () => {
      expect(COMBAT.HARD_MAX_SHIELD).toBe(3);
      expect(PERK_MAX_RANKS.max_shield).toBe(2);

      const engine = new GameEngine();
      engine.startNewRun('railgun');
      expect(engine.player.maxShield).toBe(1);

      const shieldOption: DraftOption = {
        id: 'perk_max_shield',
        kind: 'perk',
        perkId: 'max_shield',
        title: '+1 Max Shield',
        description: '+1 Max Shield (up to 3) and restores Shield.',
      };

      // 1st pick: 1 -> 2
      engine.phase = 'draft';
      engine.selectDraftOption(shieldOption);
      expect(engine.player.maxShield).toBe(2);
      expect(engine.player.shield).toBe(2);
      expect(engine.player.perks.max_shield).toBe(1);

      // 2nd pick: 2 -> 3
      engine.phase = 'draft';
      engine.selectDraftOption(shieldOption);
      expect(engine.player.maxShield).toBe(3);
      expect(engine.player.shield).toBe(3);
      expect(engine.player.perks.max_shield).toBe(2);

      // 3rd pick: clamped at 3
      engine.phase = 'draft';
      engine.selectDraftOption(shieldOption);
      expect(engine.player.maxShield).toBe(3);
      expect(engine.player.shield).toBe(3);
      expect(engine.player.perks.max_shield).toBe(2);

      // generateDraftOptions never offers max_shield once maxShield >= 3 or perks.max_shield >= 2
      for (let i = 0; i < 30; i++) {
        const opts = generateDraftOptions(engine.player, 4);
        expect(opts.some((opt) => opt.perkId === 'max_shield')).toBe(false);
      }

      engine.player.perks.max_shield = 0;
      engine.player.maxShield = 3;
      for (let i = 0; i < 20; i++) {
        const opts = generateDraftOptions(engine.player, 4);
        expect(opts.some((opt) => opt.perkId === 'max_shield')).toBe(false);
      }
    });

    it('triggers brake_shockwave bullet clear only when chargeTier >= 1', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      engine.enemies = [
        {
          id: 20001,
          kind: 'slime',
          x: 230,
          y: 70,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
          canShoot: false,
        },
      ];

      engine.player.perks.brake_shockwave = 1;
      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      engine.projectiles = [
        {
          id: 20002,
          fromPlayer: false,
          x: 135,
          y: 280,
          vx: 0,
          vy: 60,
          radius: 3.5,
          damage: 1,
          life: 3,
          color: COLORS.bulletRed,
        },
      ];

      // Uncharged Brake Tap (chargeTier = 0) does NOT clear adjacent enemy bullet
      triggerQuickTap(engine, 135, 300, 1, 1000, 50);
      expect(engine.projectiles).toHaveLength(1);

      // Charged Brake Tap (chargeTier = 1) DOES clear adjacent enemy bullet
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 1;

      triggerQuickTap(engine, 135, 300, 2, 1200, 50);
      expect(engine.projectiles).toHaveLength(0);
    });

    it('keeps Room 1 Slimes non-shooting for 4s while Room 2+ Slimes fire crimson bullets', () => {
      // Room 1
      const room1Engine = new GameEngine();
      room1Engine.startNewRun('railgun');
      expect(room1Engine.enemies.every((e) => e.kind === 'slime' && e.canShoot === false)).toBe(
        true,
      );
      room1Engine.player.x = 135;
      room1Engine.player.y = 445;

      const steps4s = Math.round(4 / PHYSICS.FIXED_DT);
      for (let i = 0; i < steps4s; i++) {
        room1Engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      expect(room1Engine.projectiles).toHaveLength(0);

      // Room 2+
      const room2 = generateRoom(2);
      const room2Slime = room2.enemies.find((e) => e.kind === 'slime');
      expect(room2Slime).toBeDefined();
      expect(room2Slime!.canShoot).toBe(true);

      const room2Engine = new GameEngine();
      room2Engine.startNewRun('railgun');
      room2Engine.hazards = [];
      room2Slime!.x = 135;
      room2Slime!.y = 100;
      room2Slime!.fireTimer = 0.05;
      room2Engine.enemies = [room2Slime!];
      room2Engine.player.x = 135;
      room2Engine.player.y = 445;

      for (let i = 0; i < 20; i++) {
        room2Engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      const enemyBullets = room2Engine.projectiles.filter(
        (pr) => !pr.fromPlayer && pr.color === COLORS.bulletRed,
      );
      expect(enemyBullets.length).toBeGreaterThanOrEqual(1);
    });

    it('spawns 4 crimson bullets and toggles spikePhaseParity on Spike Slime telegraph -> spiked', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      engine.player.x = 135;
      engine.player.y = 420;

      const spikeSlime: Enemy = {
        id: 20100,
        kind: 'spike_slime',
        x: 135,
        y: 150,
        vx: 0,
        vy: 0,
        radius: 11,
        hp: 4,
        maxHp: 4,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 0.01,
        spikeState: 'telegraph',
        spikePhaseParity: 0,
      };
      engine.enemies = [spikeSlime];

      engine.stepSimulation(PHYSICS.FIXED_DT);
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(spikeSlime.spikeState).toBe('spiked');
      expect(spikeSlime.spikePhaseParity).toBe(1);
      const wave1 = engine.projectiles.filter(
        (pr) => !pr.fromPlayer && pr.color === COLORS.bulletRed,
      );
      expect(wave1).toHaveLength(4);

      // Next eruption toggles parity back 1 -> 0 and fires rotated 4-way wave
      engine.projectiles = [];
      spikeSlime.spikeState = 'telegraph';
      spikeSlime.stateTimer = 0.01;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(spikeSlime.spikeState).toBe('spiked');
      expect(spikeSlime.spikePhaseParity).toBe(0);
      const wave2 = engine.projectiles.filter(
        (pr) => !pr.fromPlayer && pr.color === COLORS.bulletRed,
      );
      expect(wave2).toHaveLength(4);
    });

    it('fires Sniper 2-round burst in Room 3 vs immediate 3-way fan in Room 4+', () => {
      // Room 3: 2-round burst
      const room3 = generateRoom(3);
      const sniper3 = room3.enemies.find((e) => e.kind === 'sniper');
      expect(sniper3).toBeDefined();
      expect(sniper3!.isFanShot).toBe(false);

      const engine3 = new GameEngine();
      engine3.startNewRun('railgun');
      engine3.hazards = [];
      engine3.player.x = 135;
      engine3.player.y = 420;
      sniper3!.x = 135;
      sniper3!.y = 120;
      sniper3!.angle = Math.PI / 2;
      sniper3!.sniperState = 'locked';
      sniper3!.stateTimer = 0.01;
      sniper3!.burstRemaining = 0;
      sniper3!.burstCooldown = 0;
      engine3.enemies = [sniper3!];

      engine3.stepSimulation(PHYSICS.FIXED_DT);
      engine3.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine3.projectiles).toHaveLength(1);
      expect(sniper3!.burstRemaining).toBe(1);

      const stepsBurst = Math.ceil(0.15 / PHYSICS.FIXED_DT);
      for (let i = 0; i < stepsBurst; i++) {
        engine3.stepSimulation(PHYSICS.FIXED_DT);
      }
      expect(engine3.projectiles).toHaveLength(2);
      expect(sniper3!.burstRemaining).toBe(0);

      // Room 4+: immediate 3-way fan
      const room4 = generateRoom(4);
      const sniper4 = room4.enemies.find((e) => e.kind === 'sniper');
      expect(sniper4).toBeDefined();
      expect(sniper4!.isFanShot).toBe(true);

      const engine4 = new GameEngine();
      engine4.startNewRun('railgun');
      engine4.hazards = [];
      engine4.player.x = 135;
      engine4.player.y = 420;
      sniper4!.x = 135;
      sniper4!.y = 120;
      sniper4!.angle = Math.PI / 2;
      sniper4!.sniperState = 'locked';
      sniper4!.stateTimer = 0.01;
      engine4.enemies = [sniper4!];

      engine4.stepSimulation(PHYSICS.FIXED_DT);
      engine4.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine4.projectiles).toHaveLength(3);
      expect(
        engine4.projectiles.every((pr) => !pr.fromPlayer && pr.color === COLORS.bulletRed),
      ).toBe(true);
    });

    it('spawns 6 radial crimson shrapnel bullets when bomb_bot detonates', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];

      const bombBot: Enemy = {
        id: 20200,
        kind: 'bomb_bot',
        x: 135,
        y: 160,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 2,
        maxHp: 2,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
      };
      const anchorSlime: Enemy = {
        id: 20201,
        kind: 'slime',
        x: 235,
        y: 70,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
        canShoot: false,
      };
      engine.enemies = [bombBot, anchorSlime];

      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 300, 1, 1000, 50);

      expect(bombBot.hp).toBeLessThanOrEqual(0);
      const shrapnel = engine.projectiles.filter(
        (pr) => !pr.fromPlayer && pr.color === COLORS.bulletRed,
      );
      expect(shrapnel).toHaveLength(6);
    });

    it('spawns drone in Room 3+ and fires 5 spiral crimson bullets when fireTimer <= 0', () => {
      const room3 = generateRoom(3);
      const drone = room3.enemies.find((e) => e.kind === 'drone');
      expect(drone).toBeDefined();

      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      engine.player.x = 135;
      engine.player.y = 420;
      drone!.x = 135;
      drone!.y = 140;
      drone!.fireTimer = 0.02;
      engine.enemies = [drone!];

      for (let i = 0; i < 6; i++) {
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }

      const spiralBullets = engine.projectiles.filter(
        (pr) => !pr.fromPlayer && pr.color === COLORS.bulletRed,
      );
      expect(spiralBullets).toHaveLength(5);
    });

    it('steps Boss through Phase 1 (Aimed 5-Way Fan & Double Spiral) and Phase 2 (Cross-Ring + Aimed Burst)', () => {
      const bossRoom = generateRoom(5);
      expect(bossRoom.isBossRoom).toBe(true);
      const boss = bossRoom.enemies.find((e) => e.kind === 'boss')!;
      expect(boss).toBeDefined();

      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.roomNumber = 5;
      engine.hazards = [];
      engine.player.x = 135;
      engine.player.y = 445;
      boss.x = 135;
      boss.y = 130;
      engine.enemies = [boss];

      const stepFor = (sec: number) => {
        const steps = Math.ceil(sec / PHYSICS.FIXED_DT);
        for (let i = 0; i < steps; i++) {
          engine.stepSimulation(PHYSICS.FIXED_DT);
        }
      };

      // Phase 1, Pattern 1: Aimed 5-Way Fan (Room 5 softer 0.7s telegraph)
      boss.hp = boss.maxHp;
      boss.bossPhase = 0;
      boss.bossPattern = 0;
      boss.stateTimer = 0.01;
      stepFor(0.02); // enters telegraph for Pattern 1
      expect(boss.bossPhase).toBe(1);
      expect(boss.bossPattern).toBe(1);
      stepFor(0.71); // fires 5-way fan
      expect(engine.projectiles.filter((pr) => !pr.fromPlayer)).toHaveLength(5);

      // Phase 1, Pattern 0: Double Spiral (2 radial bursts of 10 in Room 5)
      engine.projectiles = [];
      boss.bossPhase = 0;
      boss.bossPattern = 1;
      boss.stateTimer = 0.01;
      stepFor(0.02); // enters telegraph for Pattern 0
      expect(boss.bossPhase).toBe(1);
      expect(boss.bossPattern).toBe(0);
      stepFor(0.71); // fires 1st radial ring + queues 2nd burst
      expect(engine.projectiles.filter((pr) => !pr.fromPlayer)).toHaveLength(10);
      expect(boss.burstRemaining).toBe(1);
      stepFor(0.35); // fires 2nd radial ring
      expect(engine.projectiles.filter((pr) => !pr.fromPlayer)).toHaveLength(20);
      expect(boss.burstRemaining).toBe(0);

      // Phase 2 (<= 50% HP), Pattern 2: Cross-Ring + Aimed Burst
      engine.projectiles = [];
      boss.hp = Math.floor(boss.maxHp * 0.5);
      boss.bossPhase = 0;
      boss.bossPattern = 1;
      boss.burstRemaining = 0;
      boss.stateTimer = 0.01;
      stepFor(0.02); // enters telegraph for Pattern 2 (patternCount = 3)
      expect(boss.bossPhase).toBe(1);
      expect(boss.bossPattern).toBe(2);
      stepFor(0.59); // fires Cross-Ring (10 bullets) + queues 2 aimed bursts
      expect(engine.projectiles.filter((pr) => !pr.fromPlayer)).toHaveLength(10);
      expect(boss.burstRemaining).toBe(2);
      stepFor(0.34); // fires 2 aimed follow-up shots (total 12 bullets)
      expect(engine.projectiles.filter((pr) => !pr.fromPlayer)).toHaveLength(12);
      expect(boss.burstRemaining).toBe(0);
    });
  });

  describe('12. Expanded Player-Property Perks & Draft Skip', () => {
    it('air_drag_tune retains strictly higher speed after 1s of unblocked flight', () => {
      const fly1Sec = (airDragRank: number): number => {
        const engine = new GameEngine();
        engine.startNewRun('railgun');
        engine.enemies = [];
        engine.hazards = [];
        engine.player.perks.air_drag_tune = airDragRank;
        engine.player.x = 135;
        engine.player.y = 445;
        engine.player.vx = 0;
        engine.player.vy = -260;
        engine.player.aimDirX = 0;
        engine.player.aimDirY = -1;
        engine.player.armored = true;

        const steps1s = Math.round(1 / PHYSICS.FIXED_DT);
        for (let i = 0; i < steps1s; i++) {
          engine.stepSimulation(PHYSICS.FIXED_DT);
        }
        return len(engine.player.vx, engine.player.vy);
      };

      const baseSpeed = fly1Sec(0);
      const tunedSpeed = fly1Sec(2);
      expect(tunedSpeed).toBeGreaterThan(baseSpeed);
    });

    it('heavy_ram increases ram knockback speed and sets Wall Slam bonus damage to 4 at rank 2', () => {
      const runRam = (heavyRamRank: number) => {
        const engine = new GameEngine();
        engine.startNewRun('railgun');
        engine.hazards = [];
        engine.player.perks.heavy_ram = heavyRamRank;

        const slime: Enemy = {
          id: 21001 + heavyRamRank,
          kind: 'slime',
          x: 135,
          y: 250,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
          canShoot: false,
        };
        engine.enemies = [slime];
        engine.player.x = 135;
        engine.player.y = 264;
        engine.player.vx = 0;
        engine.player.vy = -300;
        engine.player.aimDirX = 0;
        engine.player.aimDirY = -1;
        engine.player.armored = true;

        engine.stepSimulation(PHYSICS.FIXED_DT);
        return len(slime.vx, slime.vy);
      };

      const baseKnockSpeed = runRam(0);
      const heavyKnockSpeed = runRam(2);
      expect(heavyKnockSpeed).toBeGreaterThan(baseKnockSpeed);

      // Wall Slam deals COMBAT.WALL_SLAM_BONUS_DAMAGE + 2 = 4 bonus damage
      const slamEngine = new GameEngine();
      slamEngine.startNewRun('railgun');
      slamEngine.hazards = [];
      slamEngine.player.perks.heavy_ram = 2;
      slamEngine.player.x = 50;
      slamEngine.player.y = 400;

      const slammedSlime: Enemy = {
        id: 21010,
        kind: 'slime',
        x: ARENA.right - 10.5,
        y: 200,
        vx: 220,
        vy: 0,
        radius: 10,
        hp: 10,
        maxHp: 10,
        hitFlash: 0,
        slammedTimer: 0.5,
        angle: 0,
        stateTimer: 10,
        canShoot: false,
      };
      slamEngine.enemies = [slammedSlime];

      slamEngine.stepSimulation(PHYSICS.FIXED_DT);
      slamEngine.stepSimulation(PHYSICS.FIXED_DT);

      expect(COMBAT.WALL_SLAM_BONUS_DAMAGE + 2).toBe(4);
      expect(slammedSlime.hp).toBe(6);
      expect(slamEngine.floatingTexts.some((ft) => ft.text === 'WALL SLAM!')).toBe(true);
    });

    it('quick_charge jumps wall bounce 1 -> 3 (3x MAX!) and bumper +2 Charge (0 -> 2)', () => {
      // Wall bounce at chargeTier === 1 jumps directly to chargeTier === 3
      const wallEngine = new GameEngine();
      wallEngine.startNewRun('railgun');
      wallEngine.hazards = [];
      wallEngine.enemies = [
        {
          id: 21020,
          kind: 'slime',
          x: 200,
          y: 120,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
          canShoot: false,
        },
      ];
      wallEngine.player.perks.quick_charge = 1;
      wallEngine.player.x = ARENA.right - wallEngine.player.radius - 1;
      wallEngine.player.y = 300;
      wallEngine.player.vx = 280;
      wallEngine.player.vy = 0;
      wallEngine.player.aimDirX = 1;
      wallEngine.player.aimDirY = 0;
      wallEngine.player.armored = true;
      wallEngine.player.chargeTier = 1;

      wallEngine.stepSimulation(PHYSICS.FIXED_DT);
      expect(wallEngine.player.chargeTier).toBe(3);
      expect(wallEngine.floatingTexts.some((ft) => ft.text === '3x MAX!')).toBe(true);

      // Pinball Bumper hit at chargeTier === 0 grants +2 Charge (chargeTier === 2)
      const bumperEngine = new GameEngine();
      bumperEngine.startNewRun('railgun');
      bumperEngine.enemies = [
        {
          id: 21021,
          kind: 'slime',
          x: 220,
          y: 100,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
          canShoot: false,
        },
      ];
      bumperEngine.hazards = [
        {
          id: 21022,
          kind: 'bumper',
          x: 135,
          y: 250,
          radius: 11,
          hp: 999,
          pulseTimer: 0,
          triggered: false,
        },
      ];
      bumperEngine.player.perks.quick_charge = 1;
      bumperEngine.player.x = 135;
      bumperEngine.player.y = 264;
      bumperEngine.player.vx = 0;
      bumperEngine.player.vy = -260;
      bumperEngine.player.aimDirX = 0;
      bumperEngine.player.aimDirY = -1;
      bumperEngine.player.armored = true;
      bumperEngine.player.chargeTier = 0;

      bumperEngine.stepSimulation(PHYSICS.FIXED_DT);
      expect(bumperEngine.player.chargeTier).toBe(2);
    });

    it('overheat_vent delays Overheat by +8s at rank 2', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      engine.enemies = [
        {
          id: 21030,
          kind: 'slime',
          x: 60,
          y: 100,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 20,
          maxHp: 20,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
          canShoot: false,
        },
      ];
      engine.player.perks.overheat_vent = 2;
      expect(engine.getRenderState().overheatDelaySec).toBe(8);
      expect(OVERHEAT.OVERHEAT_START_SEC + 8).toBe(31);

      // Bounce at roomTimer = 26s (< 31s): NO overheat damage, normal charge gain
      engine.roomTimer = 26;
      engine.player.shield = 1;
      engine.player.hp = 3;
      engine.player.x = ARENA.right - engine.player.radius - 1;
      engine.player.y = 320;
      engine.player.vx = 260;
      engine.player.vy = 0;
      engine.player.aimDirX = 1;
      engine.player.aimDirY = 0;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.player.shield).toBe(1);
      expect(engine.player.hp).toBe(3);
      expect(engine.player.chargeTier).toBe(1);

      // Bounce at roomTimer = 31.5s (>= 31s): Overheat triggers normally
      engine.roomTimer = 31.5;
      engine.player.iframes = 0;
      engine.player.x = ARENA.right - engine.player.radius - 1;
      engine.player.y = 320;
      engine.player.vx = 260;
      engine.player.vy = 0;
      engine.player.aimDirX = 1;
      engine.player.aimDirY = 0;
      engine.player.armored = true;

      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.player.shield).toBe(0);
    });

    it('momentum_edge deals +1 bonus damage and shows FAST SHOT! only at speed >= 290', () => {
      expect(COMBAT.MOMENTUM_EDGE_MIN_SPEED).toBe(290);

      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.hazards = [];
      const target: Enemy = {
        id: 21040,
        kind: 'slime',
        x: 135,
        y: 180,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 10,
        maxHp: 10,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
        canShoot: false,
      };
      engine.enemies = [target];
      engine.player.perks.momentum_edge = 1;

      // Speed 320 (>= 290): Railgun Tier 0 deals 2 + 1 = 3 damage and shows 'FAST SHOT!'
      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -320;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 300, 1, 1000, 50);
      expect(target.hp).toBe(7);
      expect(engine.floatingTexts.some((ft) => ft.text === 'FAST SHOT!')).toBe(true);

      // Speed 200 (< 290): Railgun Tier 0 deals base damage 2 and no 'FAST SHOT!'
      engine.floatingTexts = [];
      engine.player.x = 135;
      engine.player.y = 300;
      engine.player.vx = 0;
      engine.player.vy = -200;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 0;

      triggerQuickTap(engine, 135, 300, 2, 1200, 50);
      expect(target.hp).toBe(5);
      expect(engine.floatingTexts.some((ft) => ft.text === 'FAST SHOT!')).toBe(false);
    });

    it('flow_surge grants +1.0 Flow on no-hit clear and raises Flow cap to 7.0', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.player.perks.flow_surge = 1;
      engine.flowMultiplier = 1.0;
      engine.tookDamageThisRoom = false;

      // Clearing a room without damage grants +1.0 Flow (1.0 -> 2.0)
      for (const e of engine.enemies) {
        e.hp = 0;
      }
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.phase).toBe('transition');
      expect(engine.flowMultiplier).toBe(2.0);

      // Flow scales up to 7.0 instead of capping at 5.0
      engine.phase = 'playing';
      engine.enemies = [
        {
          id: 21050,
          kind: 'slime',
          x: 135,
          y: 180,
          vx: 0,
          vy: 0,
          radius: 10,
          hp: 0,
          maxHp: 3,
          hitFlash: 0,
          slammedTimer: 0,
          angle: 0,
          stateTimer: 10,
        },
      ];
      engine.flowMultiplier = 6.5;
      engine.tookDamageThisRoom = false;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.flowMultiplier).toBe(7.0);

      // Capped at 7.0
      engine.phase = 'playing';
      engine.enemies = [];
      engine.tookDamageThisRoom = false;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.flowMultiplier).toBe(7.0);
    });

    it('vital_core caps at HARD_MAX_HP = 4 and field_repair heals only when damaged', () => {
      expect(COMBAT.HARD_MAX_HP).toBe(4);
      expect(PERK_MAX_RANKS.vital_core).toBe(1);

      const engine = new GameEngine();
      engine.startNewRun('railgun');
      expect(engine.player.maxHp).toBe(3);
      expect(engine.player.hp).toBe(3);

      // At full HP (3/3), field_repair is excluded from draft options
      for (let i = 0; i < 30; i++) {
        const opts = generateDraftOptions(engine.player, 2);
        expect(opts.some((opt) => opt.perkId === 'field_repair')).toBe(false);
      }

      // vital_core increases maxHp 3 -> 4 and heals +1 (2 -> 3 when damaged, or 3 -> 4 at full)
      engine.player.hp = 2;
      engine.phase = 'draft';
      engine.selectDraftOption({
        id: 'perk_vital_core',
        kind: 'perk',
        perkId: 'vital_core',
        title: 'Reinforced Core',
        description: '+1 Max HP (up to 4) and restores +1 HP.',
      });
      expect(engine.player.maxHp).toBe(4);
      expect(engine.player.hp).toBe(3);
      expect(engine.player.perks.vital_core).toBe(1);

      // Subsequent vital_core stays capped at HARD_MAX_HP = 4 and is excluded from generateDraftOptions
      engine.phase = 'draft';
      engine.selectDraftOption({
        id: 'perk_vital_core',
        kind: 'perk',
        perkId: 'vital_core',
        title: 'Reinforced Core',
        description: '+1 Max HP (up to 4) and restores +1 HP.',
      });
      expect(engine.player.maxHp).toBe(4);
      expect(engine.player.hp).toBe(4);

      for (let i = 0; i < 30; i++) {
        const opts = generateDraftOptions(engine.player, 3);
        expect(opts.some((opt) => opt.perkId === 'vital_core')).toBe(false);
      }

      // When hp < maxHp, field_repair is eligible and heals +1 HP
      engine.player.hp = 2;
      engine.player.weaponUpgradeBudget = COMBAT.MAX_WEAPON_UPGRADES;
      let sawFieldRepair = false;
      for (let i = 0; i < 40; i++) {
        const opts = generateDraftOptions(engine.player, 3);
        if (opts.some((opt) => opt.perkId === 'field_repair')) {
          sawFieldRepair = true;
          break;
        }
      }
      expect(sawFieldRepair).toBe(true);

      engine.phase = 'draft';
      engine.selectDraftOption({
        id: 'perk_field_repair',
        kind: 'perk',
        perkId: 'field_repair',
        title: 'Nano Patch',
        description: 'Restores +1 HP immediately.',
      });
      expect(engine.player.hp).toBe(3);
    });

    it('skipDraft awards scaled score bonus, blocks during weapon transfers, and draft offers varied perks/swaps', () => {
      // skipDraft() in 'draft' phase awards Math.round(COMBAT.SKIP_DRAFT_BASE_BONUS * flowMultiplier)
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.flowMultiplier = 2.5;
      advanceRoomClearToDraft(engine);

      const scoreBeforeSkip = engine.score;
      const expectedBonus = Math.round(COMBAT.SKIP_DRAFT_BASE_BONUS * engine.flowMultiplier);
      engine.skipDraft();

      expect(engine.phase).toBe('playing');
      expect(engine.roomNumber).toBe(2);
      expect(engine.score).toBe(scoreBeforeSkip + expectedBonus);

      // skipDraft() during pendingWeaponTransfers > 0 does nothing
      const transferEngine = new GameEngine();
      transferEngine.startNewRun('railgun');
      transferEngine.player.weaponUpgradeBudget = 2;
      transferEngine.player.weaponMods.rail_beams = 1;
      transferEngine.player.weaponMods.rail_width = 1;
      advanceRoomClearToDraft(transferEngine);

      transferEngine.selectDraftOption({
        id: 'weapon_shotgun',
        kind: 'weapon',
        weaponId: 'shotgun',
        title: 'Equip: Recoil Shotgun',
        description: 'Wide pellet blast forward; kicks you sharply backward.',
      });
      expect(transferEngine.phase).toBe('draft');
      const scoreDuringTransfer = transferEngine.score;
      const roomDuringTransfer = transferEngine.roomNumber;

      transferEngine.skipDraft();
      expect(transferEngine.phase).toBe('draft');
      expect(transferEngine.score).toBe(scoreDuringTransfer);
      expect(transferEngine.roomNumber).toBe(roomDuringTransfer);

      // Across 40 calls to generateDraftOptions (weaponUpgradeBudget = 3, fresh perks),
      // weapon swaps appear occasionally (0 < count < 40) and multiple player-property perks appear
      const varietyEngine = new GameEngine();
      varietyEngine.startNewRun('railgun');
      varietyEngine.player.weaponUpgradeBudget = COMBAT.MAX_WEAPON_UPGRADES;

      let weaponSwapDraftCount = 0;
      const seenPerks = new Set<PerkId>();
      let draftsWithMultiplePerks = 0;

      for (let i = 0; i < 40; i++) {
        const opts = generateDraftOptions(varietyEngine.player, 3);
        expect(opts).toHaveLength(3);
        if (opts.some((opt) => opt.kind === 'weapon')) {
          weaponSwapDraftCount++;
        }
        const perkOpts = opts.filter((opt) => opt.kind === 'perk' && opt.perkId);
        if (perkOpts.length >= 2) {
          draftsWithMultiplePerks++;
        }
        for (const opt of perkOpts) {
          if (opt.perkId) seenPerks.add(opt.perkId);
        }
      }

      expect(weaponSwapDraftCount).toBeGreaterThan(0);
      expect(weaponSwapDraftCount).toBeLessThan(40);
      expect(draftsWithMultiplePerks).toBe(40);
      expect(seenPerks.size).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Interactive First-Time Tutorial', () => {
    it('locks to railgun, disables overheat, and resets drill instead of gameover on damage', () => {
      const engine = new GameEngine();
      engine.startTutorial({ returnToTitle: false, postWeapon: 'sawblade' });

      expect(engine.phase).toBe('playing');
      expect(engine.isTutorialActive()).toBe(true);
      expect(engine.getTutorialStageIndex()).toBe(0);
      expect(engine.player.weapon).toBe('railgun');
      expect(engine.enemies).toHaveLength(2);
      expect(engine.getRenderState().tutorial?.active).toBe(true);

      // Advance past Overheat threshold: overheat must not trigger or damage player
      engine.roomTimer = OVERHEAT.OVERHEAT_START_SEC + 5;
      engine.player.x = ARENA.right - engine.player.radius - 1;
      engine.player.vx = 220;
      engine.player.armored = true;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.phase).toBe('playing');
      expect(engine.player.hp).toBe(engine.player.maxHp);
      expect(engine.player.shield).toBe(engine.player.maxShield);

      // Simulate unarmored collision with enemy: auto-heals & resets Drill 1 instead of Game Over
      engine.player.hp = 1;
      engine.player.shield = 0;
      engine.player.armored = false;
      engine.player.vx = 0;
      engine.player.vy = 0;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = engine.enemies[0].y;
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(engine.phase).toBe('playing');
      expect(engine.isTutorialActive()).toBe(true);
      expect(engine.getTutorialStageIndex()).toBe(0);
      expect(engine.player.hp).toBe(engine.player.maxHp);
      expect(engine.player.shield).toBe(engine.player.maxShield);
      expect(engine.enemies).toHaveLength(2);
    });

    it('enforces strict skill gates across all 3 drills, pauses for briefing, and drops Drill 3 barrier after 0.2x slow-mo dodge', () => {
      const tutorialEvents: Array<boolean | null> = [];
      const engine = new GameEngine({
        onTutorialStateChange: (info) => {
          tutorialEvents.push(info ? info.briefVisible : null);
        },
      });
      engine.startTutorial({ returnToTitle: false, postWeapon: 'shotgun' });

      // Briefing starts visible and pauses simulation until first pointer interaction
      expect(engine.getRenderState().tutorial?.briefVisible).toBe(true);
      engine.update(0.05);
      expect(engine.roomTimer).toBe(0);

      // Pointer down dismisses briefing
      engine.handlePointerDown(135, 400, 1, 1000);
      engine.handlePointerUp(135, 400, 1, 1050);
      expect(engine.getRenderState().tutorial?.briefVisible).toBe(false);
      expect(tutorialEvents).toContain(true);
      expect(tutorialEvents).toContain(false);

      // Drill 1: Weapon firing is blocked (cannot skip ramming by shooting)
      engine.player.armored = true;
      engine.player.vx = 0;
      engine.player.vy = -250;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = 320;
      triggerQuickTap(engine, 135, 380);
      expect(engine.enemies).toHaveLength(2);
      expect(engine.enemies[0].hp).toBe(1);

      // Drill 1: Ramming only 1 slime + clearing 2nd non-ram resets Drill 1
      engine.player.armored = true;
      engine.player.vx = 280;
      engine.player.vy = 0;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = engine.enemies[0].y;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.getRenderState().tutorial?.stepBadge).toBe('1/2 RAMS');
      expect(engine.enemies).toHaveLength(1);
      engine.enemies[0].hp = 0;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.getTutorialStageIndex()).toBe(0);
      expect(engine.enemies).toHaveLength(2);

      // Drill 1: Ramming both slimes advances to Drill 2
      engine.handlePointerDown(135, 400, 1, 1200);
      engine.handlePointerUp(135, 400, 1, 1220);
      engine.player.armored = true;
      engine.player.vx = 280;
      engine.player.vy = 0;
      for (const e of engine.enemies) {
        engine.player.x = e.x;
        engine.player.y = e.y;
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      expect(engine.getTutorialStageIndex()).toBe(1);
      expect(engine.enemies).toHaveLength(1);
      expect(engine.getRenderState().tutorial?.briefVisible).toBe(true);

      // Drill 2: Direct ram deflects (deals 0 damage) and uncharged shot is blocked
      engine.handlePointerDown(135, 400, 1, 1300);
      engine.handlePointerUp(135, 400, 1, 1320);
      engine.player.armored = true;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = engine.enemies[0].y + 4;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.enemies[0].hp).toBe(4);

      engine.player.chargeTier = 0;
      engine.player.armored = true;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = 300;
      triggerQuickTap(engine, 135, 380);
      expect(engine.enemies[0].hp).toBe(4);

      // Drill 2: Bounce wall to reach chargeTier >= 1, then quick-tap to brake & fire Railgun
      engine.player.x = ARENA.right - engine.player.radius - 1;
      engine.player.y = engine.enemies[0].y;
      engine.player.vx = 300;
      engine.player.vy = 0;
      engine.player.armored = true;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.player.chargeTier).toBeGreaterThanOrEqual(1);

      triggerQuickTap(engine, 135, 380);
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.getTutorialStageIndex()).toBe(2);
      expect(engine.enemies).toHaveLength(1);
      expect(engine.enemies[0].kind).toBe('drone');
      expect(engine.getRenderState().tutorial?.droneBarrierActive).toBe(true);

      // Drill 3: Dismiss briefing, verify pre-bullet drag & early attack cannot bypass barrier
      engine.handlePointerDown(135, 400, 1, 1500);
      engine.handlePointerMove(135, 430, 1);
      engine.handlePointerUp(135, 430, 1, 1600);
      // Player sits safely at side while Drone fires first wave
      engine.player.x = 25;
      engine.player.y = 395;
      engine.player.vx = 0;
      engine.player.vy = 0;

      // Step until Drone fires its aimed red wave
      for (let i = 0; i < 20; i++) {
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      expect(engine.projectiles.some((p) => !p.fromPlayer)).toBe(true);

      // Attacking Drone while barrier is up deals 0 damage
      engine.player.armored = true;
      engine.player.vx = 0;
      engine.player.vy = -280;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = engine.enemies[0].y + 4;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.enemies[0].hp).toBe(2);
      expect(engine.getRenderState().tutorial?.droneBarrierActive).toBe(true);

      // Now trigger 0.2x slow-mo WHILE red bullets are airborne and launch cleanly away
      engine.player.x = 24;
      engine.player.y = 395;
      engine.player.vx = 0;
      engine.player.vy = 0;
      engine.handlePointerDown(24, 395, 1, 2000);
      engine.handlePointerMove(24, 430, 1);
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);
      engine.handlePointerUp(24, 430, 1, 2120);

      // Clear remaining wave bullets cleanly (simulating wave passing without hitting player)
      engine.projectiles = [];
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.getRenderState().tutorial?.droneBarrierActive).toBe(false);

      // Now finish off the unshielded Drone -> completes tutorial & launches Room 1 with Shotgun
      engine.player.armored = true;
      engine.player.vx = 0;
      engine.player.vy = -300;
      engine.player.x = engine.enemies[0].x;
      engine.player.y = engine.enemies[0].y;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      engine.player.x = engine.enemies[0].x;
      engine.player.y = engine.enemies[0].y;
      engine.stepSimulation(PHYSICS.FIXED_DT);

      expect(engine.isTutorialActive()).toBe(false);
      expect(engine.isTutorialCompleted()).toBe(true);
      expect(engine.phase).toBe('playing');
      expect(engine.roomNumber).toBe(1);
      expect(engine.player.weapon).toBe('shotgun');
    });

    it('getting hit by multi-bullet wave in Drill 3 does not freeze loop and resets cleanly to start of Drill 3', () => {
      const engine = new GameEngine();
      engine.startTutorial({ returnToTitle: false, postWeapon: 'railgun' });

      // Advance cleanly through Drill 1 and Drill 2 to enter Drill 3
      engine.handlePointerDown(135, 400, 1, 100);
      engine.handlePointerUp(135, 400, 1, 120);
      engine.player.armored = true;
      engine.player.vx = 280;
      for (const e of engine.enemies) {
        engine.player.x = e.x;
        engine.player.y = e.y;
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      engine.handlePointerDown(135, 400, 1, 200);
      engine.handlePointerUp(135, 400, 1, 220);
      engine.player.x = ARENA.right - engine.player.radius - 1;
      engine.player.y = engine.enemies[0].y;
      engine.player.vx = 300;
      engine.player.vy = 0;
      engine.player.armored = true;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      triggerQuickTap(engine, 135, 380);
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.getTutorialStageIndex()).toBe(2);

      // Dismiss Drill 3 briefing and let Drone fire a 6-bullet wave
      engine.handlePointerDown(135, 400, 1, 300);
      engine.handlePointerUp(135, 400, 1, 320);
      for (let i = 0; i < 20; i++) {
        engine.update(1 / 60);
      }
      expect(engine.projectiles.length).toBeGreaterThanOrEqual(5);

      // Collide player with a bullet near the end of projectiles[] (so earlier indices remain)
      const hitBullet = engine.projectiles[engine.projectiles.length - 1];
      engine.player.x = hitBullet.x;
      engine.player.y = hitBullet.y;
      engine.player.armored = true;

      // Must NOT throw TypeError on remaining projectiles and must reset to start of Drill 3
      expect(() => {
        for (let i = 0; i < 10; i++) {
          engine.update(1 / 60);
        }
      }).not.toThrow();

      expect(engine.phase).toBe('playing');
      expect(engine.getTutorialStageIndex()).toBe(2);
      expect(engine.getRenderState().tutorial?.briefVisible).toBe(false);
      expect(engine.getRenderState().tutorial?.droneBarrierActive).toBe(true);
      expect(engine.player.x).toBe(135);
      expect(engine.player.y).toBe(395);
      expect(engine.player.hp).toBe(engine.player.maxHp);
      expect(engine.player.shield).toBe(engine.player.maxShield);

      // Player remains responsive and can drag-launch again
      engine.handlePointerDown(135, 400, 2, 1000);
      engine.handlePointerMove(135, 440, 2);
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);
      engine.handlePointerUp(135, 440, 2, 1200);
      expect(engine.player.vy).toBeLessThan(0);
    });

    it('drops Drill 3 barrier automatically after real simulated wave passes with 0.2x slow-mo dodge (no manual projectile clear)', () => {
      const engine = new GameEngine();
      engine.startTutorial({ returnToTitle: false, postWeapon: 'railgun' });

      // Skip cleanly to Drill 3 via Drill 1 & 2 mechanics
      engine.handlePointerDown(135, 400, 1, 100);
      engine.handlePointerUp(135, 400, 1, 120);
      engine.player.armored = true;
      engine.player.vx = 280;
      for (const e of engine.enemies) {
        engine.player.x = e.x;
        engine.player.y = e.y;
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }
      engine.handlePointerDown(135, 400, 1, 200);
      engine.handlePointerUp(135, 400, 1, 220);
      engine.player.x = ARENA.right - engine.player.radius - 1;
      engine.player.y = engine.enemies[0].y;
      engine.player.vx = 300;
      engine.player.vy = 0;
      engine.player.armored = true;
      engine.stepSimulation(PHYSICS.FIXED_DT);
      triggerQuickTap(engine, 135, 380);
      engine.stepSimulation(PHYSICS.FIXED_DT);
      expect(engine.getTutorialStageIndex()).toBe(2);

      // Dismiss briefing and step real frames until Drone fires Wave 1
      engine.handlePointerDown(135, 400, 1, 300);
      engine.handlePointerUp(135, 400, 1, 320);
      for (let i = 0; i < 25; i++) {
        engine.update(1 / 60);
      }
      expect(engine.projectiles.some((p) => !p.fromPlayer)).toBe(true);
      expect(engine.getRenderState().tutorial?.droneBarrierActive).toBe(true);

      // Trigger 0.2x slow-mo while Wave 1 is airborne, then launch cleanly sideways into gap
      engine.handlePointerDown(135, 400, 2, 1000);
      engine.handlePointerMove(195, 410, 2); // aims left (-60, -10) safely away from center stream
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);
      engine.handlePointerUp(195, 410, 2, 1180);

      // Step real 60fps simulation until wave clears/passes without touching projectiles manually
      for (let i = 0; i < 240; i++) {
        engine.update(1 / 60);
        if (!engine.getRenderState().tutorial?.droneBarrierActive) break;
      }

      expect(engine.getTutorialStageIndex()).toBe(2);
      expect(engine.getRenderState().tutorial?.droneBarrierActive).toBe(false);
    });

    it('skipTutorial exits cleanly to Title when launched from Title and to Room 1 when launched via Drop In', () => {
      const fromTitle = new GameEngine();
      fromTitle.startTutorial({ returnToTitle: true, postWeapon: 'arccoil' });
      expect(fromTitle.isTutorialActive()).toBe(true);
      fromTitle.skipTutorial();
      expect(fromTitle.isTutorialActive()).toBe(false);
      expect(fromTitle.isTutorialCompleted()).toBe(true);
      expect(fromTitle.phase).toBe('title');
      expect(fromTitle.getStartingWeapon()).toBe('arccoil');

      const fromDropIn = new GameEngine();
      fromDropIn.startTutorial({ returnToTitle: false, postWeapon: 'sawblade' });
      fromDropIn.skipTutorial();
      expect(fromDropIn.isTutorialActive()).toBe(false);
      expect(fromDropIn.isTutorialCompleted()).toBe(true);
      expect(fromDropIn.phase).toBe('playing');
      expect(fromDropIn.roomNumber).toBe(1);
      expect(fromDropIn.player.weapon).toBe('sawblade');
    });
  });

  describe('13. Rarity System, Endgame Mastery, Progressive Bosses, 0.12x Slow-Mo & Settings', () => {
    it('enforces HP/Shield/preview_bounce/multi-shot caps and offers Mastery + Rarity upgrades past Room 30', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.player.maxHp = COMBAT.HARD_MAX_HP;
      engine.player.hp = COMBAT.HARD_MAX_HP;
      engine.player.maxShield = COMBAT.HARD_MAX_SHIELD;
      engine.player.shield = COMBAT.HARD_MAX_SHIELD;
      engine.player.weaponUpgradeBudget = COMBAT.MAX_WEAPON_UPGRADES;
      engine.player.weaponMods.rail_beams = 1;
      engine.player.weaponMods.rail_bounce = 1;
      engine.player.weaponMods.rail_width = 1;
      engine.player.perks.preview_bounce = 1;
      engine.player.perks.explosive_slam = 2;
      engine.player.perks.longer_focus = 2;

      // Max all non-mastery perks
      for (const key of Object.keys(engine.player.perks) as PerkId[]) {
        if (!['kinetic_mastery', 'ordnance_caliber', 'velocity_tuning', 'overclock_score'].includes(key)) {
          engine.player.perks[key] = 99;
        }
      }

      for (let i = 0; i < 30; i++) {
        const opts = generateDraftOptions(engine.player, 35, 3.0);
        expect(opts).toHaveLength(3);
        expect(opts.some((o) => o.perkId === 'preview_bounce')).toBe(false);
        expect(opts.some((o) => o.perkId === 'max_shield')).toBe(false);
        expect(opts.some((o) => o.perkId === 'vital_core')).toBe(false);
        // Never falls back to 3 weapon swaps
        expect(opts.filter((o) => o.kind === 'weapon').length).toBeLessThan(3);
        // Multi-shot / bounce mods are never offered as rarity upgrades
        expect(opts.some((o) => o.weaponModId === 'rail_beams' || o.weaponModId === 'rail_bounce')).toBe(false);
      }
    });

    it('applies rarity upgrades without consuming weaponUpgradeBudget and scales scalable perk potency', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');
      engine.player.weaponUpgradeBudget = 1;
      engine.player.weaponMods.rail_width = 1;
      engine.player.perks.longer_focus = 1;

      const baseFocus = engine.getRenderState().aim.focusRemainingRatio;
      expect(baseFocus).toBe(1);

      engine.phase = 'draft';
      engine.selectDraftOption({
        id: 'mod_up_rail_width',
        kind: 'weapon_mod',
        weaponId: 'railgun',
        weaponModId: 'rail_width',
        title: 'Overcharged Bore +',
        description: 'Upgraded bore',
        rarity: 'mythic',
        previousRarity: 'common',
        isRarityUpgrade: true,
      });

      expect(engine.player.weaponUpgradeBudget).toBe(1);
      expect(engine.player.weaponModRarities?.rail_width).toBe('mythic');
    });

    it('smooths Room 5 -> 10 -> 15 -> 20 Boss curve and removes Sniper from Room 15 escorts', () => {
      const rm5 = generateRoom(5, 'standard');
      const boss5 = rm5.enemies.find((e) => e.kind === 'boss')!;
      expect(boss5.hp).toBe(Math.round(16 * 0.88));
      expect(rm5.enemies).toHaveLength(1);

      const rm10 = generateRoom(10, 'standard');
      const boss10 = rm10.enemies.find((e) => e.kind === 'boss')!;
      expect(boss10.hp).toBe(Math.round(32 * 0.88));
      expect(rm10.enemies).toHaveLength(2);
      expect(rm10.hazards.some((h) => h.kind === 'barrel')).toBe(false);

      const rm15 = generateRoom(15, 'standard');
      const boss15 = rm15.enemies.find((e) => e.kind === 'boss')!;
      expect(boss15.hp).toBe(Math.round(44 * 0.88));
      expect(rm15.enemies).toHaveLength(3);
      expect(rm15.enemies.some((e) => e.kind === 'sniper')).toBe(false);

      const rm20 = generateRoom(20, 'standard');
      const boss20 = rm20.enemies.find((e) => e.kind === 'boss')!;
      expect(boss20.hp).toBeGreaterThan(boss15.hp * 1.5);
      expect(rm20.enemies.some((e) => e.kind === 'sniper')).toBe(true);
    });

    it('activates 0.12x slow-mo on >=90ms hold without drag and smoothly ramps out near expiry', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');

      engine.handlePointerDown(135, 300, 1, 1000);
      expect(engine.getRenderState().aim.slowMoActive).toBe(false);

      // Hold without dragging past 90ms
      engine.update(0.05);
      expect(engine.getRenderState().aim.slowMoActive).toBe(false);
      engine.update(0.05);
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);

      // Verify time runs at 0.12x
      const before = engine.roomTimer;
      for (let i = 0; i < 10; i++) {
        engine.update(0.05); // 0.5s real time -> ~0.06s sim time
      }
      expect(engine.roomTimer - before).toBeCloseTo(0.5 * CONTROLS.AIM_TIME_SCALE, 2);

      // Advance into the final 0.25s ramp-out window (2.5s - 0.5s - 0.05s = 1.95s remaining; advance 1.85s -> 0.1s left)
      for (let i = 0; i < 37; i++) {
        engine.update(0.05);
      }
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);
      const beforeRamp = engine.roomTimer;
      engine.update(0.05);
      const rampDelta = engine.roomTimer - beforeRamp;
      // During ramp-out, effective timeScale is strictly between AIM_TIME_SCALE (0.12) and 1.0
      expect(rampDelta).toBeGreaterThan(0.05 * CONTROLS.AIM_TIME_SCALE);
      expect(rampDelta).toBeLessThan(0.05);
    });

    it('persists settings, pauses cleanly, adjusts pull sensitivity, and separates difficulty records with 1.3x Overdrive score', () => {
      const engine = new GameEngine();
      engine.updateSettings({
        bgmVolume: 0.4,
        sfxVolume: 0.7,
        pullSensitivityPx: 48,
        screenShake: false,
        difficulty: 'overdrive',
      });

      const s = engine.getSettings();
      expect(s.bgmVolume).toBeCloseTo(0.4, 5);
      expect(s.sfxVolume).toBeCloseTo(0.7, 5);
      expect(s.pullSensitivityPx).toBe(48);
      expect(s.screenShake).toBe(false);
      expect(s.difficulty).toBe('overdrive');
      expect(engine.audio.getBgmVolume()).toBeCloseTo(0.4, 5);
      expect(engine.audio.getSfxVolume()).toBeCloseTo(0.7, 5);

      engine.startNewRun('railgun');
      // Difficulty cannot change mid-run
      engine.updateSettings({ difficulty: 'chill' });
      expect(engine.getSettings().difficulty).toBe('overdrive');

      // Pause stops simulation progress
      engine.setPaused(true);
      const frozenTime = engine.roomTimer;
      engine.update(0.2);
      expect(engine.roomTimer).toBe(frozenTime);
      engine.setPaused(false);

      // Pull sensitivity of 48px reaches full launch speed at 48px pull
      engine.handlePointerDown(135, 300, 2, 1000);
      engine.handlePointerMove(135, 348, 2);
      engine.handlePointerUp(135, 348, 2, 1100);
      expect(len(engine.player.vx, engine.player.vy)).toBeCloseTo(PHYSICS.MAX_LAUNCH_SPEED, 2);

      // Overdrive grants 1.3x score on draft skip
      engine.phase = 'draft';
      engine.flowMultiplier = 1.0;
      engine.score = 0;
      engine.skipDraft();
      expect(engine.score).toBe(Math.round(COMBAT.SKIP_DRAFT_BASE_BONUS * 1.3));
    });

    it('Shotgun triggers Wall Slams, point-blank bonus damage, and 2x+ Charge piercing', () => {
      const engine = new GameEngine();
      engine.startNewRun('shotgun');
      engine.hazards = [];

      // Place a tough enemy near the top wall and another behind it for piercing test
      const frontEnemy: Enemy = {
        id: 9901,
        kind: 'slime',
        x: 135,
        y: 80,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
      };
      const rearEnemy: Enemy = {
        id: 9902,
        kind: 'slime',
        x: 135,
        y: 54,
        vx: 0,
        vy: 0,
        radius: 10,
        hp: 20,
        maxHp: 20,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: 10,
      };
      engine.enemies = [frontEnemy, rearEnemy];

      // Fire point-blank at 2x Charge from y=106 upward (-Y)
      engine.player.x = 135;
      engine.player.y = 106;
      engine.player.vx = 0;
      engine.player.vy = -260;
      engine.player.aimDirX = 0;
      engine.player.aimDirY = -1;
      engine.player.armored = true;
      engine.player.chargeTier = 2;

      triggerQuickTap(engine, 135, 106);
      expect(engine.player.armored).toBe(true);
      expect(engine.beams.length).toBe(3);

      // Step simulation: pellets hit frontEnemy (point-blank + slamTimer), pierce to rearEnemy, and slam into top wall
      for (let i = 0; i < 40; i++) {
        engine.stepSimulation(PHYSICS.FIXED_DT);
      }

      // Both enemies took heavy damage (frontEnemy point-blank + wall slam; rearEnemy pierced)
      expect(frontEnemy.hp).toBeLessThan(12);
      expect(rearEnemy.hp).toBeLessThan(20);
    });
  });
});
