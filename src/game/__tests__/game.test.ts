import { describe, expect, it, vi } from 'vitest';
import {
  ARENA,
  COMBAT,
  CONTROLS,
  OVERHEAT,
  PHYSICS,
  TRANSITION,
} from '../constants.ts';
import type { DraftOption, Enemy } from '../entities.ts';
import { GameEngine } from '../engine.ts';
import {
  len,
  normalize,
  raycastArena,
  stepCircleArena,
} from '../physics.ts';
import { generateRoom } from '../rooms.ts';

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
    it('activates slowMoActive on drag > 10px, expires after 1.2s real time, and launches on release', () => {
      const engine = new GameEngine();
      engine.startNewRun('railgun');

      engine.handlePointerDown(135, 300, 1, 1000);
      expect(engine.getRenderState().aim.slowMoActive).toBe(false);

      // Drag > 10px downward -> Focus Ring activates
      engine.handlePointerMove(135, 340, 1);
      let aim = engine.getRenderState().aim;
      expect(aim.active).toBe(true);
      expect(aim.slowMoActive).toBe(true);
      expect(aim.focusRemainingRatio).toBeCloseTo(1, 5);

      // While slowMoActive is true, simulation runs at AIM_TIME_SCALE (0.2x)
      const beforeSlowTimer = engine.roomTimer;
      for (let i = 0; i < 10; i++) {
        engine.update(0.05); // 0.5s real time -> 0.1s sim time
      }
      expect(engine.roomTimer - beforeSlowTimer).toBeCloseTo(0.5 * CONTROLS.AIM_TIME_SCALE, 2);
      expect(engine.getRenderState().aim.slowMoActive).toBe(true);

      // Advance remaining 0.7s real time to hit 1.2s total
      for (let i = 0; i < 14; i++) {
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

      // 5 + tier*2 = 7 pellets moving forward (-Y)
      expect(engine.projectiles).toHaveLength(7);
      for (const p of engine.projectiles) {
        expect(p.fromPlayer).toBe(true);
        expect(p.vy).toBeLessThan(0);
      }

      // Backward recoil (+Y) with speed = 210 + 1*45 = 255
      expect(engine.player.vx).toBeCloseTo(0, 4);
      expect(engine.player.vy).toBeCloseTo(255, 4);
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
});
