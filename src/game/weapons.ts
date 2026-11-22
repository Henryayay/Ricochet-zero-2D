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
  WeaponModId,
} from './entities';
import {
  clamp,
  isBossFrontShieldHit,
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

export const WEAPON_MOD_META: Record<
  WeaponModId,
  { weapon: WeaponId; title: string; description: string }
> = {
  rail_beams: {
    weapon: 'railgun',
    title: 'Split Prism',
    description: 'Fires 2 narrow angled laser beams.',
  },
  rail_width: {
    weapon: 'railgun',
    title: 'Overcharged Bore',
    description: '+2px laser width and +1 beam damage.',
  },
  rail_bounce: {
    weapon: 'railgun',
    title: 'Mirror Lens',
    description: 'Laser beam reflects 1 time off arena walls.',
  },
  shot_pellets: {
    weapon: 'shotgun',
    title: 'Buckshot Drum',
    description: '+2 pellets per blast with tighter choke.',
  },
  shot_bounce: {
    weapon: 'shotgun',
    title: 'Rubber Slugs',
    description: 'Pellets bounce 1 time off arena walls.',
  },
  shot_caliber: {
    weapon: 'shotgun',
    title: 'Heavy Slugs',
    description: '+1 pellet damage and heavier knockback.',
  },
  saw_count: {
    weapon: 'sawblade',
    title: 'Twin Blades',
    description: 'Launches 2 tight spinning sawblades.',
  },
  saw_bounce: {
    weapon: 'sawblade',
    title: 'Perpetual Edge',
    description: '+1 wall bounce and +12% blade speed.',
  },
  saw_size: {
    weapon: 'sawblade',
    title: 'Giant Buzzsaw',
    description: '+2px blade radius and +1 slice damage.',
  },
  arc_jumps: {
    weapon: 'arccoil',
    title: 'Tesla Relay',
    description: '+1 lightning chain jump and +18px chain reach.',
  },
  arc_fork: {
    weapon: 'arccoil',
    title: 'Dual Emitter',
    description: 'Fires 2 forward lightning arcs.',
  },
  arc_overload: {
    weapon: 'arccoil',
    title: 'High Voltage',
    description: '+1 shock damage and +18px forward range.',
  },
};

export const WEAPON_MODS_BY_WEAPON: Record<WeaponId, readonly WeaponModId[]> = {
  railgun: ['rail_beams', 'rail_width', 'rail_bounce'],
  shotgun: ['shot_pellets', 'shot_bounce', 'shot_caliber'],
  sawblade: ['saw_count', 'saw_bounce', 'saw_size'],
  arccoil: ['arc_jumps', 'arc_fork', 'arc_overload'],
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
  bonusDamage?: number;
}

function getModRank(player: PlayerState, modId: WeaponModId): number {
  return clamp(player.weaponMods?.[modId] ?? 0, 0, COMBAT.MAX_WEAPON_MOD_RANK);
}

function rotateVec(dx: number, dy: number, angleRad: number): Vec2 {
  if (angleRad === 0) return { x: dx, y: dy };
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: dx * c - dy * s,
    y: dx * s + dy * c,
  };
}

function getSpreadOffsetsDeg(rank: number, rank1Deg: number, rank2Deg: number): number[] {
  if (rank <= 0) return [0];
  if (rank === 1) return [(-rank1Deg * Math.PI) / 180, (rank1Deg * Math.PI) / 180];
  return [(-rank2Deg * Math.PI) / 180, 0, (rank2Deg * Math.PI) / 180];
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
  const beamsRank = getModRank(player, 'rail_beams');
  const widthRank = getModRank(player, 'rail_width');
  const bounceRank = getModRank(player, 'rail_bounce');

  const beamOffsets = getSpreadOffsetsDeg(beamsRank, 3.5, 3.5);
  const width = 2 + tier * 1.5 + widthRank * 2;
  const bonus = Math.max(0, ctx.bonusDamage ?? 0);
  const dmg = 2 + tier * 2 + widthRank + bonus;
  const repeatHitDmg = Math.max(1, Math.floor(dmg * 0.4));
  const hitstop =
    tier >= 2 ? COMBAT.HITSTOP_HEAVY_SEC : COMBAT.HITSTOP_LIGHT_SEC;
  const color = COLORS.playerBullet;
  const beamHalfWidth = width * 0.5 + 1.5;
  const kbSpeed = 110 + tier * 25;

  let hitSomething = false;
  const hitEnemies = new Set<number>();
  const hitHazards = new Set<number>();

  for (const offsetRad of beamOffsets) {
    const beamDir = rotateVec(dx, dy, offsetRad);
    const rawPath = raycastArena(player.x, player.y, beamDir.x, beamDir.y, bounceRank, 0);
    const path =
      rawPath.length >= 2
        ? rawPath
        : [
            { x: player.x, y: player.y },
            { x: player.x + beamDir.x * 480, y: player.y + beamDir.y * 480 },
          ];

    for (let s = 0; s < path.length - 1; s++) {
      const segStart = path[s];
      const segEnd = path[s + 1];
      const segDir = normalizeOr(
        segEnd.x - segStart.x,
        segEnd.y - segStart.y,
        beamDir.x,
        beamDir.y,
      );

      ctx.beams.push({
        x1: segStart.x,
        y1: segStart.y,
        x2: segEnd.x,
        y2: segEnd.y,
        width,
        color,
        life: 0.18 + tier * 0.03,
        maxLife: 0.18 + tier * 0.03,
      });

      for (const enemy of [...ctx.enemies]) {
        if (enemy.hp <= 0) continue;
        if (
          segmentCircleIntersect(
            segStart.x,
            segStart.y,
            segEnd.x,
            segEnd.y,
            enemy.x,
            enemy.y,
            enemy.radius + beamHalfWidth,
          )
        ) {
          hitSomething = true;
          const hitDmg = hitEnemies.has(enemy.id) ? repeatHitDmg : dmg;
          ctx.onDamageEnemy(
            enemy,
            hitDmg,
            segDir.x * kbSpeed,
            segDir.y * kbSpeed,
            segStart.x,
            segStart.y,
          );
          if (!(enemy.kind === 'boss' && isBossFrontShieldHit(enemy, segStart.x, segStart.y))) {
            hitEnemies.add(enemy.id);
          }
          spawnSparks(ctx.particles, enemy.x, enemy.y, segDir.x, segDir.y, color, 6, 60, 170, 1.8);
        }
      }

      for (const hazard of [...ctx.hazards]) {
        if (hazard.triggered || hitHazards.has(hazard.id)) continue;
        if (
          segmentCircleIntersect(
            segStart.x,
            segStart.y,
            segEnd.x,
            segEnd.y,
            hazard.x,
            hazard.y,
            hazard.radius + beamHalfWidth,
          )
        ) {
          hitSomething = true;
          hitHazards.add(hazard.id);
          ctx.onHitHazard(hazard, segStart.x, segStart.y);
        }
      }

      const isFinalSegment = s === path.length - 2;
      spawnSparks(
        ctx.particles,
        segEnd.x,
        segEnd.y,
        -segDir.x,
        -segDir.y,
        color,
        isFinalSegment ? 8 : 5,
        50,
        150,
        2.2,
      );
    }
  }

  spawnSparks(ctx.particles, player.x, player.y, dx, dy, color, 6, 70, 160, 1.1);

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
  const pelletsRank = getModRank(player, 'shot_pellets');
  const shotBounceRank = getModRank(player, 'shot_bounce');
  const caliberRank = getModRank(player, 'shot_caliber');

  const pelletCount = 4 + tier + pelletsRank * 2;
  const totalSpread = ((26 - pelletsRank * 4) * Math.PI) / 180;
  const baseAngle = Math.atan2(dy, dx);
  const bonus = Math.max(0, ctx.bonusDamage ?? 0);
  const dmg = 1 + (tier >= 3 ? 1 : 0) + caliberRank;
  const centerPelletIdx = Math.floor(pelletCount / 2);
  const knockback = 185 + tier * 30 + caliberRank * 45;
  const speed = 390;
  const life = 0.25 + shotBounceRank * 0.14;
  const color = COLORS.playerBullet;
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
      damage: dmg + (i === centerPelletIdx ? bonus : 0),
      life,
      color,
      knockback,
      fromCharge: tier >= 1,
      bouncesLeft: shotBounceRank,
      bouncesDone: 0,
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
  const countRank = getModRank(player, 'saw_count');
  const bounceRank = getModRank(player, 'saw_bounce');
  const sizeRank = getModRank(player, 'saw_size');

  const bladeOffsets = getSpreadOffsetsDeg(countRank, 8, 8);
  const speed = (340 + tier * 30) * (1 + bounceRank * 0.12);
  const bouncesLeft = 2 + tier + bounceRank;
  const bonus = Math.max(0, ctx.bonusDamage ?? 0);
  const baseDamage = 2 + tier + sizeRank;
  const radius = 7 + (tier >= 2 ? 1 : 0) + sizeRank * 2;
  const color = COLORS.playerBullet;

  for (let i = 0; i < bladeOffsets.length; i++) {
    const offsetRad = bladeOffsets[i];
    const bladeDir = rotateVec(dx, dy, offsetRad);
    const spawnX = clamp(
      player.x + bladeDir.x * (player.radius + radius + 2),
      ARENA.left + radius,
      ARENA.right - radius,
    );
    const spawnY = clamp(
      player.y + bladeDir.y * (player.radius + radius + 2),
      ARENA.top + radius,
      ARENA.bottom - radius,
    );

    ctx.sawblades.push({
      id: allocEntityId(),
      x: spawnX,
      y: spawnY,
      vx: bladeDir.x * speed,
      vy: bladeDir.y * speed,
      radius,
      damage: baseDamage + (i === 0 ? bonus : 0),
      bouncesLeft,
      bouncesDone: 0,
      fromCharge: tier >= 1,
      spin: 0,
      hitCooldowns: new Map<number, number>(),
    });

    spawnSparks(ctx.particles, spawnX, spawnY, bladeDir.x, bladeDir.y, color, 6, 50, 140, 1.4);
  }

  ctx.onShake(dx, dy, 1.8 + tier * 0.6);
}

function pickForwardArcTarget(
  ctx: WeaponFireContext,
  dx: number,
  dy: number,
  range: number,
  claimedEnemies: Set<number>,
  claimedHazards: Set<number>,
  preferUnclaimed: boolean,
): {
  bestEnemy: Enemy | null;
  bestEnemyDist: number;
  bestHazard: Hazard | null;
  bestHazardDist: number;
} {
  const { player } = ctx;
  let bestEnemy: Enemy | null = null;
  let bestEnemyDist = Infinity;
  let bestEnemyScore = Infinity;

  for (const enemy of ctx.enemies) {
    if (enemy.hp <= 0) continue;
    if (preferUnclaimed && claimedEnemies.has(enemy.id)) continue;
    const ox = enemy.x - player.x;
    const oy = enemy.y - player.y;
    const dist = len(ox, oy);
    if (dist > range + enemy.radius) continue;

    const forwardDot = dist < 1e-3 ? 1 : (ox * dx + oy * dy) / dist;
    const pointBlank = dist <= player.radius + enemy.radius + 10;
    if (!pointBlank && forwardDot < 0.64) continue;

    // Prefer targets well-aligned along the nose chevron (skill-based aiming)
    const alignScore = dist * (1.35 - 0.35 * Math.max(0, forwardDot));
    if (alignScore < bestEnemyScore) {
      bestEnemyScore = alignScore;
      bestEnemyDist = dist;
      bestEnemy = enemy;
    }
  }

  let bestHazard: Hazard | null = null;
  let bestHazardDist = Infinity;
  let bestHazardScore = Infinity;
  for (const hazard of ctx.hazards) {
    if (hazard.triggered || hazard.kind !== 'barrel') continue;
    if (preferUnclaimed && claimedHazards.has(hazard.id)) continue;
    const ox = hazard.x - player.x;
    const oy = hazard.y - player.y;
    const dist = len(ox, oy);
    if (dist > range + hazard.radius) continue;

    const forwardDot = dist < 1e-3 ? 1 : (ox * dx + oy * dy) / dist;
    const pointBlank = dist <= player.radius + hazard.radius + 10;
    if (!pointBlank && forwardDot < 0.64) continue;

    const alignScore = dist * (1.35 - 0.35 * Math.max(0, forwardDot));
    if (alignScore < bestHazardScore) {
      bestHazardScore = alignScore;
      bestHazardDist = dist;
      bestHazard = hazard;
    }
  }

  return { bestEnemy, bestEnemyDist, bestHazard, bestHazardDist };
}

function fireArcCoil(
  ctx: WeaponFireContext,
  dx: number,
  dy: number,
  tier: number,
): void {
  const { player } = ctx;
  const jumpsRank = getModRank(player, 'arc_jumps');
  const forkRank = getModRank(player, 'arc_fork');
  const overloadRank = getModRank(player, 'arc_overload');

  const range = 104 + tier * 18 + overloadRank * 18;
  const chainRange = 105 + jumpsRank * 18;
  const maxJumps = 2 + tier + jumpsRank;
  const bonus = Math.max(0, ctx.bonusDamage ?? 0);
  const primaryDmg = 2 + tier + overloadRank + bonus;
  const chainDmg = 1 + tier + overloadRank;
  const forkCount = 1 + forkRank;
  const color = COLORS.playerBullet;

  const claimedPrimaryEnemies = new Set<number>();
  const claimedPrimaryHazards = new Set<number>();
  const everHitEnemies = new Set<number>();
  let anyEnemyHit = false;

  for (let f = 0; f < forkCount; f++) {
    let target = pickForwardArcTarget(
      ctx,
      dx,
      dy,
      range,
      claimedPrimaryEnemies,
      claimedPrimaryHazards,
      true,
    );
    if (!target.bestEnemy && !target.bestHazard) {
      target = pickForwardArcTarget(
        ctx,
        dx,
        dy,
        range,
        claimedPrimaryEnemies,
        claimedPrimaryHazards,
        false,
      );
    }

    let { bestEnemy } = target;
    const { bestEnemyDist, bestHazard, bestHazardDist } = target;

    const hitEnemies = new Set<number>();
    let anchorX = player.x;
    let anchorY = player.y;
    let jumpsUsed = 0;

    // Trigger explosive barrel if it is closer than the primary enemy or no enemy was found
    if (bestHazard && (!bestEnemy || bestHazardDist < bestEnemyDist)) {
      claimedPrimaryHazards.add(bestHazard.id);
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
      const baseDmg = isPrimary ? primaryDmg : chainDmg;
      const dmg = everHitEnemies.has(bestEnemy.id)
        ? Math.max(1, Math.floor(baseDmg * 0.5))
        : baseDmg;
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

      claimedPrimaryEnemies.add(bestEnemy.id);
      hitEnemies.add(bestEnemy.id);
      everHitEnemies.add(bestEnemy.id);
      anyEnemyHit = true;
      jumpsUsed++;
      const prevX = anchorX;
      const prevY = anchorY;
      anchorX = bestEnemy.x;
      anchorY = bestEnemy.y;

      ctx.onDamageEnemy(
        bestEnemy,
        dmg,
        pushDir.x * kb,
        pushDir.y * kb,
        prevX,
        prevY,
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
      const jumpDmg = everHitEnemies.has(nextEnemy.id)
        ? Math.max(1, Math.floor(chainDmg * 0.5))
        : chainDmg;
      everHitEnemies.add(nextEnemy.id);
      anyEnemyHit = true;
      jumpsUsed++;
      const prevX = anchorX;
      const prevY = anchorY;
      anchorX = nextEnemy.x;
      anchorY = nextEnemy.y;

      ctx.onDamageEnemy(
        nextEnemy,
        jumpDmg,
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

    if (jumpsUsed === 0) {
      const reach = range * 0.72;
      const spreadAngle = forkCount > 1 ? (f - (forkCount - 1) * 0.5) * 0.28 : 0;
      const arcDir = rotateVec(dx, dy, spreadAngle);
      const tipX = clamp(player.x + arcDir.x * reach, ARENA.left + 4, ARENA.right - 4);
      const tipY = clamp(player.y + arcDir.y * reach, ARENA.top + 4, ARENA.bottom - 4);
      ctx.arcs.push({
        points: buildJaggedArc(player.x, player.y, tipX, tipY, 5, 8),
        life: 0.15,
        maxLife: 0.15,
        color,
      });
      spawnSparks(ctx.particles, tipX, tipY, arcDir.x, arcDir.y, color, 5, 40, 120, 2.0);
    }
  }

  // Forward burst ring
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

  if (anyEnemyHit) {
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
