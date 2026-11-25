import {
  allocEntityId,
  Enemy,
  Hazard,
  PlayerState,
  Projectile,
  Vec2,
} from './entities.ts';

export const TUTORIAL_STAGE_COUNT = 3;

export type TutorialCueKind = 'drag' | 'bounce_tap' | 'slowmo_dodge';

export interface TutorialRenderInfo {
  active: boolean;
  stageIndex: number;
  stageCount: number;
  title: string;
  promptLine1: string;
  promptLine2: string;
  stepBadge: string;
  briefVisible: boolean;
  briefTag: string;
  briefTagKind: 'cyan' | 'gold' | 'red';
  briefHeadline: string;
  briefSubtext: string;
  droneBarrierActive: boolean;
  worldHintText?: string;
  cueKind: TutorialCueKind;
  cueFrom: Vec2;
  cueTo: Vec2;
  highlightPos?: Vec2;
  showDragHint: boolean;
  showTapHint: boolean;
}

export interface TutorialSpawnResult {
  enemies: Enemy[];
  hazards: Hazard[];
  title: string;
  roomName: string;
}

function makeTutorialSlime(x: number, y: number, hp: number): Enemy {
  return {
    id: allocEntityId(),
    kind: 'slime',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 10,
    hp,
    maxHp: hp,
    hitFlash: 0,
    slammedTimer: 0,
    angle: 0,
    stateTimer: 0,
    canShoot: false,
    stationary: true,
  };
}

function makeTutorialDrone(x: number, y: number): Enemy {
  return {
    id: allocEntityId(),
    kind: 'drone',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 10,
    hp: 2,
    maxHp: 2,
    hitFlash: 0,
    slammedTimer: 0,
    angle: Math.PI / 2,
    stateTimer: 0,
    fireTimer: 0.08,
    stationary: true,
  };
}

export function spawnTutorialStage(stageIndex: number): TutorialSpawnResult {
  switch (stageIndex) {
    case 0:
      return {
        title: 'DRILL 1/3: SLINGSHOT RAM',
        roomName: 'TUTORIAL 1/3',
        enemies: [
          makeTutorialSlime(90, 215, 1),
          makeTutorialSlime(180, 215, 1),
        ],
        hazards: [],
      };
    case 1:
      return {
        title: 'DRILL 2/3: BOUNCE + TAP',
        roomName: 'TUTORIAL 2/3',
        enemies: [makeTutorialSlime(135, 165, 4)],
        hazards: [],
      };
    default:
      return {
        title: 'DRILL 3/3: 0.2x SLOW-MO DODGE',
        roomName: 'TUTORIAL 3/3',
        enemies: [makeTutorialDrone(135, 130)],
        hazards: [],
      };
  }
}

export function buildTutorialRenderState(params: {
  stageIndex: number;
  player: PlayerState;
  enemies: Enemy[];
  projectiles: Projectile[];
  isDragging: boolean;
  slowMoActive: boolean;
  briefVisible: boolean;
  ramKillCount: number;
  droneBarrierActive: boolean;
  slowMoDuringBullets: boolean;
}): TutorialRenderInfo {
  const {
    stageIndex,
    player,
    enemies,
    projectiles,
    isDragging,
    slowMoActive,
    briefVisible,
    ramKillCount,
    droneBarrierActive,
    slowMoDuringBullets,
  } = params;

  const isIdle = !player.armored && Math.hypot(player.vx, player.vy) < 20;
  const firstEnemy = enemies[0];

  switch (stageIndex) {
    case 0:
      return {
        active: true,
        stageIndex,
        stageCount: TUTORIAL_STAGE_COUNT,
        title: 'DRILL 1/3: SLINGSHOT RAM',
        promptLine1: isDragging
          ? 'AIM AT A SLIME & RELEASE!'
          : 'DRAG BACK & RELEASE FAST',
        promptLine2: 'RAM BOTH SLIMES AT HIGH SPEED',
        stepBadge: `${Math.min(2, ramKillCount)}/2 RAMS`,
        briefVisible,
        briefTag: 'DRAG & LAUNCH',
        briefTagKind: 'cyan',
        briefHeadline: 'SLINGSHOT TO ARMOR UP & RAM',
        briefSubtext:
          'Pull back anywhere and release fast. Firing is disabled here—slam through both slimes!',
        droneBarrierActive: false,
        worldHintText: isIdle && !isDragging && !briefVisible ? 'DRAG DOWN TO RAM!' : undefined,
        cueKind: 'drag',
        cueFrom: { x: 135, y: 400 },
        cueTo: { x: 158, y: 446 },
        highlightPos: firstEnemy ? { x: firstEnemy.x, y: firstEnemy.y } : undefined,
        showDragHint: isIdle && !isDragging,
        showTapHint: false,
      };

    case 1: {
      const chargedReady = player.armored && player.chargeTier >= 1;
      return {
        active: true,
        stageIndex,
        stageCount: TUTORIAL_STAGE_COUNT,
        title: 'DRILL 2/3: BOUNCE + TAP',
        promptLine1: chargedReady
          ? 'CHARGED! QUICK TAP NOW!'
          : '1. BOUNCE A WALL TO CHARGE',
        promptLine2: chargedReady
          ? 'BRAKES & SHOOTS ALONG NOSE'
          : '2. QUICK-TAP MID-FLIGHT TO SHOOT',
        stepBadge: chargedReady ? 'TAP NOW!' : 'STEP 1: WALL',
        briefVisible,
        briefTag: 'WALL + TAP',
        briefTagKind: 'gold',
        briefHeadline: 'BOUNCE WALL, THEN TAP TO FIRE',
        briefSubtext:
          'Direct rams bounce off! Ricochet off a wall for 1x+ Charge, then quick-tap mid-flight to fire your Railgun.',
        droneBarrierActive: false,
        worldHintText:
          chargedReady && !isDragging
            ? 'TAP NOW!'
            : isIdle && !isDragging && !briefVisible
              ? 'HIT WALL FIRST!'
              : undefined,
        cueKind: 'bounce_tap',
        cueFrom: { x: 135, y: 400 },
        cueTo: { x: 96, y: 442 },
        highlightPos: firstEnemy ? { x: firstEnemy.x, y: firstEnemy.y } : undefined,
        showDragHint: isIdle && !isDragging && player.chargeTier === 0,
        showTapHint: chargedReady && !isDragging,
      };
    }

    default: {
      const hasEnemyBullets = projectiles.some((p) => !p.fromPlayer);
      let promptLine1 = 'BARRIER DOWN! FINISH DRONE!';
      let promptLine2 = 'RAM OR SHOOT TO COMPLETE';
      let stepBadge = 'BARRIER DOWN!';

      if (droneBarrierActive) {
        stepBadge = slowMoDuringBullets ? 'WEAVE GAP!' : 'BARRIER UP';
        if (slowMoActive && hasEnemyBullets) {
          promptLine1 = '0.2x SLOW-MO! THREAD THE GAP!';
        } else if (hasEnemyBullets && !slowMoDuringBullets) {
          promptLine1 = 'HOLD DRAG NOW FOR 0.2x SLOW-MO!';
        } else if (slowMoDuringBullets) {
          promptLine1 = 'LAUNCH THROUGH THE GAP!';
        } else {
          promptLine1 = 'WAIT FOR RED WAVE, THEN 0.2x DODGE';
        }
        promptLine2 = 'RED PIERCES ARMOR — DODGE FIRST!';
      }

      const worldHintText =
        droneBarrierActive && hasEnemyBullets && !slowMoActive && !slowMoDuringBullets
          ? 'HOLD DRAG: 0.2X!'
          : !droneBarrierActive && isIdle && !isDragging
            ? 'FINISH DRONE!'
            : undefined;

      return {
        active: true,
        stageIndex: 2,
        stageCount: TUTORIAL_STAGE_COUNT,
        title: 'DRILL 3/3: 0.2x SLOW-MO DODGE',
        promptLine1,
        promptLine2,
        stepBadge,
        briefVisible,
        briefTag: '0.2x FOCUS',
        briefTagKind: 'red',
        briefHeadline: 'DODGE RED IN 0.2x SLOW-MO',
        briefSubtext:
          'Drone barrier blocks attacks! When red bullets fly, HOLD DRAG to slow time to 0.2x and weave through the gap—then destroy it.',
        droneBarrierActive,
        worldHintText,
        cueKind: 'slowmo_dodge',
        cueFrom: { x: 135, y: 400 },
        cueTo: { x: 158, y: 442 },
        highlightPos: firstEnemy ? { x: firstEnemy.x, y: firstEnemy.y } : undefined,
        showDragHint:
          droneBarrierActive && !isDragging && !slowMoDuringBullets && hasEnemyBullets,
        showTapHint: false,
      };
    }
  }
}
