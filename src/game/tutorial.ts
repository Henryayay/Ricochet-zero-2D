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
    hp: 1,
    maxHp: 1,
    hitFlash: 0,
    slammedTimer: 0,
    angle: 0.25,
    stateTimer: 0,
    fireTimer: 0.12,
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
        enemies: [makeTutorialSlime(135, 155, 4)],
        hazards: [],
      };
    default:
      return {
        title: 'DRILL 3/3: RED MEANS DEAD',
        roomName: 'TUTORIAL 3/3',
        enemies: [makeTutorialDrone(135, 125)],
        hazards: [],
      };
  }
}

export function buildTutorialRenderState(params: {
  stageIndex: number;
  player: PlayerState;
  enemies: Enemy[];
  hazards: Hazard[];
  projectiles: Projectile[];
  isDragging: boolean;
  slowMoActive: boolean;
  usedSlowMo: boolean;
}): TutorialRenderInfo {
  const {
    stageIndex,
    player,
    enemies,
    projectiles,
    isDragging,
    slowMoActive,
    usedSlowMo,
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
          ? 'AIM AT SLIME AND RELEASE!'
          : 'DRAG BACK, RELEASE FAST',
        promptLine2: 'ARMOR UP TO RAM SLIMES',
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
          : '1. BOUNCE WALL FOR CHARGE',
        promptLine2: chargedReady
          ? 'BRAKES + FIRES RAILGUN'
          : '2. TAP MID-FLIGHT TO FIRE',
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
      return {
        active: true,
        stageIndex: 2,
        stageCount: TUTORIAL_STAGE_COUNT,
        title: 'DRILL 3/3: RED MEANS DEAD',
        promptLine1: slowMoActive
          ? '0.2X FOCUS: WEAVE THE GAP!'
          : 'RED PIERCES ARMOR!',
        promptLine2: usedSlowMo
          ? 'DODGE RED, DESTROY DRONE'
          : 'HOLD DRAG FOR 0.2X SLOW-MO',
        cueKind: 'slowmo_dodge',
        cueFrom: { x: 135, y: 400 },
        cueTo: { x: 158, y: 442 },
        highlightPos: firstEnemy ? { x: firstEnemy.x, y: firstEnemy.y } : undefined,
        showDragHint: !isDragging && !usedSlowMo && (hasEnemyBullets || isIdle),
        showTapHint: false,
      };
    }
  }
}
