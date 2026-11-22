import { ARENA, PHYSICS } from './constants';
import type { Enemy, Vec2 } from './entities';

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function normalize(x: number, y: number): Vec2 {
  const l = Math.hypot(x, y);
  if (l < 1e-6) {
    return { x: 0, y: 0 };
  }
  return { x: x / l, y: y / l };
}

export function normalizeOr(
  x: number,
  y: number,
  fallbackX: number,
  fallbackY: number,
): Vec2 {
  const l = Math.hypot(x, y);
  if (l >= 1e-6) {
    return { x: x / l, y: y / l };
  }
  return normalize(fallbackX, fallbackY);
}

/** Returns shortest signed angle difference (a - b) in [-Math.PI, Math.PI]. */
export function angleDiff(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  let d = (a - b + Math.PI) % twoPi;
  if (d < 0) {
    d += twoPi;
  }
  const res = d - Math.PI;
  return res === 0 ? 0 : res;
}

export function isBossFrontShieldHit(
  boss: Enemy,
  attackOriginX: number,
  attackOriginY: number,
): boolean {
  const incomingAngle = Math.atan2(attackOriginY - boss.y, attackOriginX - boss.x);
  return Math.abs(angleDiff(incomingAngle, boss.angle)) <= (75 * Math.PI) / 180;
}

export function raycastArena(
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  maxBounces: number,
  padding = 0,
): Vec2[] {
  const dir = normalize(dirX, dirY);
  if (dir.x === 0 && dir.y === 0) {
    return [{ x: startX, y: startY }];
  }

  const minX = ARENA.left + padding;
  const maxX = ARENA.right - padding;
  const minY = ARENA.top + padding;
  const maxY = ARENA.bottom - padding;

  if (minX >= maxX || minY >= maxY || maxBounces < 0) {
    return [{ x: startX, y: startY }];
  }

  const points: Vec2[] = [{ x: startX, y: startY }];
  let x = clamp(startX, minX, maxX);
  let y = clamp(startY, minY, maxY);
  let dx = dir.x;
  let dy = dir.y;

  const dirEps = 1e-9;
  const cornerEps = 1e-5;
  const totalSegments = 1 + Math.floor(maxBounces);

  for (let i = 0; i < totalSegments; i++) {
    let tx = Infinity;
    if (dx < -dirEps) {
      tx = (minX - x) / dx;
    } else if (dx > dirEps) {
      tx = (maxX - x) / dx;
    }

    let ty = Infinity;
    if (dy < -dirEps) {
      ty = (minY - y) / dy;
    } else if (dy > dirEps) {
      ty = (maxY - y) / dy;
    }

    if (!Number.isFinite(tx) && !Number.isFinite(ty)) {
      break;
    }

    let tMin: number;
    let hitXWall = false;
    let hitYWall = false;

    if (tx < ty - cornerEps) {
      tMin = tx;
      hitXWall = true;
    } else if (ty < tx - cornerEps) {
      tMin = ty;
      hitYWall = true;
    } else {
      tMin = Math.min(tx, ty);
      hitXWall = true;
      hitYWall = true;
    }

    if (tMin < 0) {
      tMin = 0;
    }

    x = clamp(x + dx * tMin, minX, maxX);
    y = clamp(y + dy * tMin, minY, maxY);
    points.push({ x, y });

    if (hitXWall) {
      dx = -dx;
    }
    if (hitYWall) {
      dy = -dy;
    }
  }

  return points;
}

export function rayCircleIntersectDist(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  if (r < 0) {
    return null;
  }

  const fx = ox - cx;
  const fy = oy - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) {
    return 0;
  }

  const a = dx * dx + dy * dy;
  if (a < 1e-12) {
    return null;
  }

  const b = fx * dx + fy * dy;
  if (b > 0) {
    return null;
  }

  const disc = b * b - a * c;
  if (disc < 0) {
    return null;
  }

  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 ? t : 0;
}

export function segmentCircleIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  if (r < 0) {
    return false;
  }

  const sx = x2 - x1;
  const sy = y2 - y1;
  const lenSq = sx * sx + sy * sy;

  let px: number;
  let py: number;
  if (lenSq < 1e-12) {
    px = x1;
    py = y1;
  } else {
    const t = clamp(((cx - x1) * sx + (cy - y1) * sy) / lenSq, 0, 1);
    px = x1 + t * sx;
    py = y1 + t * sy;
  }

  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy <= r * r;
}

export function stepCircleArena(
  entity: { x: number; y: number; vx: number; vy: number; radius: number },
  dt: number,
  restitution: number,
): { hitWall: boolean; normalX: number; normalY: number; wallHitCount: number } {
  if (dt <= 0) {
    return { hitWall: false, normalX: 0, normalY: 0, wallHitCount: 0 };
  }

  const speed = Math.hypot(entity.vx, entity.vy);
  const steps = Math.min(
    32,
    Math.max(1, Math.ceil((speed * dt) / PHYSICS.MAX_SUBSTEP_DIST)),
  );
  const subDt = dt / steps;

  const minX = ARENA.left + entity.radius;
  const maxX = ARENA.right - entity.radius;
  const minY = ARENA.top + entity.radius;
  const maxY = ARENA.bottom - entity.radius;

  let hitWall = false;
  let normalX = 0;
  let normalY = 0;
  let wallHitCount = 0;

  for (let i = 0; i < steps; i++) {
    entity.x += entity.vx * subDt;
    entity.y += entity.vy * subDt;

    if (entity.x < minX) {
      entity.x = minX;
      if (entity.vx < 0) {
        entity.vx = -entity.vx * restitution;
        hitWall = true;
        normalX = 1;
        wallHitCount++;
      }
    } else if (entity.x > maxX) {
      entity.x = maxX;
      if (entity.vx > 0) {
        entity.vx = -entity.vx * restitution;
        hitWall = true;
        normalX = -1;
        wallHitCount++;
      }
    }

    if (entity.y < minY) {
      entity.y = minY;
      if (entity.vy < 0) {
        entity.vy = -entity.vy * restitution;
        hitWall = true;
        normalY = 1;
        wallHitCount++;
      }
    } else if (entity.y > maxY) {
      entity.y = maxY;
      if (entity.vy > 0) {
        entity.vy = -entity.vy * restitution;
        hitWall = true;
        normalY = -1;
        wallHitCount++;
      }
    }
  }

  if (hitWall) {
    const n = normalize(normalX, normalY);
    normalX = n.x;
    normalY = n.y;
  }

  return { hitWall, normalX, normalY, wallHitCount };
}

export function resolveCircleCollision(
  a: { x: number; y: number; vx: number; vy: number; radius: number },
  b: { x: number; y: number; vx: number; vy: number; radius: number },
  restitution = 0.9,
): { collided: boolean; nx: number; ny: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = a.radius + b.radius;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) {
    return { collided: false, nx: 0, ny: 0 };
  }

  const dist = Math.sqrt(distSq);
  let nx: number;
  let ny: number;
  if (dist < 1e-6) {
    nx = 1;
    ny = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  const halfOverlap = (minDist - dist) * 0.5;
  a.x -= nx * halfOverlap;
  a.y -= ny * halfOverlap;
  b.x += nx * halfOverlap;
  b.y += ny * halfOverlap;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  if (velAlongNormal < 0) {
    const impulse = (-(1 + restitution) * velAlongNormal) * 0.5;
    const ix = impulse * nx;
    const iy = impulse * ny;
    a.vx -= ix;
    a.vy -= iy;
    b.vx += ix;
    b.vy += iy;
  }

  return { collided: true, nx, ny };
}
