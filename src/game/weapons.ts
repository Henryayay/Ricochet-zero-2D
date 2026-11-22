import { ARENA, COLORS, COMBAT } from './constants';
import {
  allocEntityId,
  ArcEffect,
  BeamEffect,
  Enemy,
  Hazard,
  Particle,
  PlayerState,
  Projectile,
  RingEffect,
  Sawblade,
  Vec2,
  WeaponId,
} from './entities';
import {
  clamp,
  len,
  normalizeOr,
  raycastArena,
  segmentCircleIntersect,
} from './physics';

export const WEAPON_META: Record<
  WeaponId,
  { name: string; short: string; color: string; desc: string }
> = {
  railgun: {
    name: 'Piercing Railgun',
    short: 'RAIL',
    color: COLORS.charge0,
    desc: 'Instant full-screen laser along your velocity vector.',
  },
  shotgun: {
    name: 'Recoil Shotgun',
    short: 'SHOT',
    color: COLORS.charge2,
    desc: 'Wide pellet blast forward; kicks you sharply backward.',
  },
  sawblade: {
    name: 'Ricochet Sawblade',
    short: 'SAW',
    color: COLORS.charge1,
    desc: 'Spinning blade that ricochets off walls and slices foes.',
  },
  arccoil: {
    name: 'Arc Coil',
    short: 'ARC',
    color: COLORS.charge3,
    desc: 'Forward shock burst that chains lightning to nearby foes.',
  },
};

export interface WeaponFireContext {
  player: PlayerState;
  enemies: Enemy[];
  hazards: Hazard[];
  projectiles: Projectile[];
  sawblades: Sawblade[];
  beams: BeamEffect[];
  arcs: ArcEffect[];
  rings: RingEffect[];
  particles: Particle[];
  onDamageEnemy: (
    enemy: Enemy,
    dmg: number,
    kx: number,
    ky: number,
    sourceX: number,
    sourceY: number,
  ) => void;
  onHitHazard: (hazard: Hazard, sourceX: number, sourceY: number) => void;
  onHitstop: (sec: number) => void;
  onShake: (dx: number, dy: number, intensity: number) => void;
  playWeaponSfx: (weapon: WeaponId, tier: number) => void;
}

function getTierColor(tier: number, fallback: string): string {
  switch (tier) {
    case 1:
      return COLORS.charge1;
    case 2:
      return COLORS.charge2;
    case 3:
      return COLORS.charge3;
    default:
      return fallback;
  }
}

function spawnSparks(
  particles: Particle[],
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  color: string,
  count: number,
  speedMin: number,
  speedMax: number,
  spreadRad: number,
): void {
  const baseAngle = Math.atan2(dirY, dirX);
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * spreadRad;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const maxLife = 0.14 + Math.random() * 0.16;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.5 + Math.random() * 1.5,
      color,
      life: maxLife,
      maxLife,
    });
  }
}

function buildJaggedArc(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments = 5,
  jitter = 7,
): Vec2[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = len(dx, dy);
  if (dist < 1e-3) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }
  const nx = -dy / dist;
  const ny = dx / dist;
  const points: Vec2[] = [{ x: x1, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const offset = (Math.random() - 0.5) * 2 * jitter;
    points.push({
      x: x1 + dx * t + nx * offset,
      y: y1 + dy * t + ny * offset,
    });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

function fireRailgun(
  ctx: WeaponFireContext,
  dx: number,
  dy: number,
  tier: number,
): void {
  const { player } = ctx;
  const path = raycastArena(player.x, player.y, dx, dy, 0, 0);
  const end = path[path.length - 1] ?? {
    x: player.x + dx * 480,
    y: player.y + dy * 480,
  };

  const width = 2 + tier * 1.5;
  const dmg = 2 + tier * 2;
  const hitstop =
    tier >= 2 ? COMBAT.HITSTOP_HEAVY_SEC : COMBAT.HITSTOP_LIGHT_SEC;
  const color =
    tier >= 2 ? getTierColor(tier, WEAPON_META.railgun.color) : WEAPON_META.railgun.color;
  const beamHalfWidth = width * 0.5 + 1.5;

  ctx.beams.push({
    x1: player.x,
    y1: player.y,
    x2: end.x,
    y2: end.y,
    width,
    color,
    life: 0.18 + tier * 0.03,
    maxLife: 0.18 + tier * 0.03,
  });

  let hitSomething = false;
  const kbSpeed = 110 + tier * 25;

  for (const enemy of [...ctx.enemies]) {
    if (enemy.hp <= 0) continue;
    if (
      segmentCircleIntersect(
        player.x,
        player.y,
        end.x,
        end.y,
        enemy.x,
        enemy.y,
        enemy.radius + beamHalfWidth,
      )
    ) {
      hitSomething = true;
      ctx.onDamageEnemy(
        enemy,
        dmg,
        dx * kbSpeed,
        dy * kbSpeed,
        player.x,
        player.y,
      );
      spawnSparks(ctx.particles, enemy.x, enemy.y, dx, dy, color, 6, 60, 170, 1.8);
    }
  }

  for (const hazard of [...ctx.hazards]) {
    if (hazard.triggered) continue;
    if (
      segmentCircleIntersect(
        player.x,
        player.y,
        end.x,
        end.y,
        hazard.x,
        hazard.y,
        hazard.radius + beamHalfWidth,
      )
    ) {
      hitSomething = true;
      ctx.onHitHazard(hazard, player.x, player.y);
    }
  }

  spawnSparks(ctx.particles, player.x, player.y, dx, dy, color, 6, 70, 160, 1.1);
  spawnSparks(ctx.particles, end.x, end.y, -dx, -dy, color, 8, 50, 150, 2.2);

  if (hitSomething) {
    ctx.onHitstop(hitstop);
  }
  ctx.onShake(dx, dy, 2.4 + tier * 1.3);
}

function fireShotgun(
  ctx: WeaponFireContext,
  dx: number,
  dy: number,
  tier: number,
): void {
  const { player } = ctx;
  const pelletCount = 5 + tier * 2;
  const totalSpread = (36 * Math.PI) / 180;
  const baseAngle = Math.atan2(dy, dx);
  const dmg = 1 + (tier >= 2 ? 1 : 0);
  const speed = 390;
  const life = 0.24;
  const color =
    tier >= 2 ? getTierColor(tier, WEAPON_META.shotgun.color) : WEAPON_META.shotgun.color;
  const spawnOffset = player.radius + 3;

  for (let i = 0; i < pelletCount; i++) {
    const t = pelletCount === 1 ? 0.5 : i / (pelletCount - 1);
    const jitter = (Math.random() - 0.5) * 0.06;
    const angle = baseAngle + (t - 0.5) * totalSpread + jitter;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    ctx.projectiles.push({
      id: allocEntityId(),
      fromPlayer: true,
      x: player.x + Math.cos(angle) * spawnOffset,
      y: player.y + Math.sin(angle) * spawnOffset,
      vx,
      vy,
      radius: 2.5,
      damage: dmg,
      life,
      color,
      knockback: 185 + tier * 30,
      fromCharge: tier >= 1,
    });
  }

  // Built-in backward recoil escape
  const recoilSpeed = 210 + tier * 45;
  player.vx = -dx * recoilSpeed;
  player.vy = -dy * recoilSpeed;

  spawnSparks(
    ctx.particles,
    player.x + dx * spawnOffset,
    player.y + dy * spawnOffset,
    dx,
    dy,
    color,
    8 + tier * 2,
    80,
    210,
    totalSpread * 1.15,
  );
  ctx.onShake(-dx, -dy, 2.5 + tier * 1.1);
}

function fireSawblade(
  ctx: WeaponFireContext,
  dx: number,
  dy: number,
  tier: number,
): void {
  const { player } = ctx;
  const speed = 340 + tier * 30;
  const bouncesLeft = 2 + tier;
  const damage = 2 + tier;
  const radius = 7 + (tier >= 2 ? 1 : 0);

  const spawnX = clamp(
    player.x + dx * (player.radius + radius + 2),
    ARENA.left + radius,
    ARENA.right - radius,
  );
  const spawnY = clamp(
    player.y + dy * (player.radius + radius + 2),
    ARENA.top + radius,
    ARENA.bottom - radius,
  );

  ctx.sawblades.push({
    id: allocEntityId(),
    x: spawnX,
    y: spawnY,
    vx: dx * speed,
    vy: dy * speed,
    radius,
    damage,
    bouncesLeft,
    bouncesDone: 0,
    fromCharge: tier >= 1,
    spin: 0,
    hitCooldowns: new Map<number, number>(),
  });

  const color = getTierColor(tier, WEAPON_META.sawblade.color);
  spawnSparks(ctx.particles, spawnX, spawnY, dx, dy, color, 6, 50, 140, 1.4);
  ctx.onShake(dx, dy, 1.8 + tier * 0.6);
}

function fireArcCoil(
  ctx: WeaponFireContext,
  dx: number,
  dy: number,
  tier: number,
): void {
  const { player } = ctx;
  const range = 92 + tier * 18;
  const chainRange = 95;
  const maxJumps = 2 + tier;
  const primaryDmg = 2 + tier;
  const chainDmg = 1 + tier;
  const color =
    tier >= 2 ? getTierColor(tier, WEAPON_META.arccoil.color) : WEAPON_META.arccoil.color;

  // Find nearest forward target (enemies prioritized, hazards also checked)
  let bestEnemy: Enemy | null = null;
  let bestEnemyDist = Infinity;

  for (const enemy of ctx.enemies) {
    const ox = enemy.x - player.x;
    const oy = enemy.y - player.y;
    const dist = len(ox, oy);
    if (dist > range + enemy.radius) continue;

    const forwardDot = dist < 1e-3 ? 1 : (ox * dx + oy * dy) / dist;
    const pointBlank = dist <= player.radius + enemy.radius + 14;
    if (!pointBlank && forwardDot < 0.2) continue;

    if (dist < bestEnemyDist) {
      bestEnemyDist = dist;
      bestEnemy = enemy;
    }
  }

  let bestHazard: Hazard | null = null;
  let bestHazardDist = Infinity;
  for (const hazard of ctx.hazards) {
    if (hazard.triggered || hazard.kind !== 'barrel') continue;
    const ox = hazard.x - player.x;
    const oy = hazard.y - player.y;
    const dist = len(ox, oy);
    if (dist > range + hazard.radius) continue;

    const forwardDot = dist < 1e-3 ? 1 : (ox * dx + oy * dy) / dist;
    const pointBlank = dist <= player.radius + hazard.radius + 14;
    if (!pointBlank && forwardDot < 0.2) continue;

    if (dist < bestHazardDist) {
      bestHazardDist = dist;
      bestHazard = hazard;
    }
  }

  const hitEnemies = new Set<number>();
  let anchorX = player.x;
  let anchorY = player.y;
  let jumpsUsed = 0;

  // Trigger explosive barrel if it is closer than the primary enemy or no enemy was found
  if (bestHazard && (!bestEnemy || bestHazardDist < bestEnemyDist)) {
    ctx.arcs.push({
      points: buildJaggedArc(player.x, player.y, bestHazard.x, bestHazard.y, 5, 7),
      life: 0.18,
      maxLife: 0.18,
      color,
    });
    ctx.onHitHazard(bestHazard, player.x, player.y);
    spawnSparks(
      ctx.particles,
      bestHazard.x,
      bestHazard.y,
      dx,
      dy,
      color,
      6,
      50,
      140,
      Math.PI * 2,
    );
    anchorX = bestHazard.x;
    anchorY = bestHazard.y;
    jumpsUsed++;

    // Re-check if bestEnemy survived the barrel detonation
    if (bestEnemy && bestEnemy.hp <= 0) {
      bestEnemy = null;
    }
  }

  if (bestEnemy && bestEnemy.hp > 0 && jumpsUsed < maxJumps) {
    const isPrimary = jumpsUsed === 0;
    const dmg = isPrimary ? primaryDmg : chainDmg;
    const pushDir = normalizeOr(
      bestEnemy.x - anchorX,
      bestEnemy.y - anchorY,
      dx,
      dy,
    );
    const kb = isPrimary ? 105 + tier * 20 : 70 + tier * 15;

    ctx.arcs.push({
      points: buildJaggedArc(anchorX, anchorY, bestEnemy.x, bestEnemy.y, 5, 8),
      life: 0.2,
      maxLife: 0.2,
      color,
    });
    ctx.rings.push({
      x: bestEnemy.x,
      y: bestEnemy.y,
      radius: 4,
      maxRadius: 24 + tier * 4,
      color,
      life: 0.18,
      maxLife: 0.18,
    });

    hitEnemies.add(bestEnemy.id);
    jumpsUsed++;
    anchorX = bestEnemy.x;
    anchorY = bestEnemy.y;

    ctx.onDamageEnemy(
      bestEnemy,
      dmg,
      pushDir.x * kb,
      pushDir.y * kb,
      player.x,
      player.y,
    );
    spawnSparks(
      ctx.particles,
      bestEnemy.x,
      bestEnemy.y,
      pushDir.x,
      pushDir.y,
      color,
      7,
      60,
      160,
      Math.PI * 2,
    );
  }

  // Chain lightning to nearby enemies
  while (jumpsUsed < maxJumps) {
    let nextEnemy: Enemy | null = null;
    let nextDist = Infinity;

    for (const candidate of ctx.enemies) {
      if (hitEnemies.has(candidate.id) || candidate.hp <= 0) continue;
      const d = len(candidate.x - anchorX, candidate.y - anchorY);
      if (d <= chainRange + candidate.radius && d < nextDist) {
        nextDist = d;
        nextEnemy = candidate;
      }
    }

    if (!nextEnemy) break;

    const pushDir = normalizeOr(
      nextEnemy.x - anchorX,
      nextEnemy.y - anchorY,
      dx,
      dy,
    );
    const kb = 70 + tier * 15;

    ctx.arcs.push({
      points: buildJaggedArc(anchorX, anchorY, nextEnemy.x, nextEnemy.y, 4, 7),
      life: 0.19,
      maxLife: 0.19,
      color,
    });
    ctx.rings.push({
      x: nextEnemy.x,
      y: nextEnemy.y,
      radius: 3,
      maxRadius: 18 + tier * 3,
      color,
      life: 0.16,
      maxLife: 0.16,
    });

    hitEnemies.add(nextEnemy.id);
    jumpsUsed++;
    const prevX = anchorX;
    const prevY = anchorY;
    anchorX = nextEnemy.x;
    anchorY = nextEnemy.y;

    ctx.onDamageEnemy(
      nextEnemy,
      chainDmg,
      pushDir.x * kb,
      pushDir.y * kb,
      prevX,
      prevY,
    );
    spawnSparks(
      ctx.particles,
      nextEnemy.x,
      nextEnemy.y,
      pushDir.x,
      pushDir.y,
      color,
      5,
      50,
      140,
      Math.PI * 2,
    );
  }

  // Forward burst ring + fallback discharge arc if nothing was in range
  const burstX = player.x + dx * (player.radius + 10);
  const burstY = player.y + dy * (player.radius + 10);
  ctx.rings.push({
    x: burstX,
    y: burstY,
    radius: 5,
    maxRadius: 34 + tier * 8,
    color,
    life: 0.16,
    maxLife: 0.16,
  });

  if (jumpsUsed === 0) {
    const reach = range * 0.72;
    const tipX = clamp(player.x + dx * reach, ARENA.left + 4, ARENA.right - 4);
    const tipY = clamp(player.y + dy * reach, ARENA.top + 4, ARENA.bottom - 4);
    ctx.arcs.push({
      points: buildJaggedArc(player.x, player.y, tipX, tipY, 5, 8),
      life: 0.15,
      maxLife: 0.15,
      color,
    });
    spawnSparks(ctx.particles, tipX, tipY, dx, dy, color, 5, 40, 120, 2.0);
  } else if (hitEnemies.size > 0) {
    ctx.onHitstop(tier >= 2 ? COMBAT.HITSTOP_LIGHT_SEC : 0.014);
  }

  ctx.onShake(dx, dy, 2.0 + tier * 0.9);
}

export function fireActiveWeapon(ctx: WeaponFireContext): void {
  const { player } = ctx;
  const dir = normalizeOr(player.aimDirX, player.aimDirY, 0, -1);
  const tier = clamp(player.chargeTier, 0, COMBAT.MAX_CHARGE_TIER);

  ctx.playWeaponSfx(player.weapon, tier);

  switch (player.weapon) {
    case 'railgun':
      fireRailgun(ctx, dir.x, dir.y, tier);
      break;
    case 'shotgun':
      fireShotgun(ctx, dir.x, dir.y, tier);
      break;
    case 'sawblade':
      fireSawblade(ctx, dir.x, dir.y, tier);
      break;
    case 'arccoil':
      fireArcCoil(ctx, dir.x, dir.y, tier);
      break;
  }
}
