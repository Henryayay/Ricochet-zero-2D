import {
  allocEntityId,
  DraftOption,
  Enemy,
  EnemyKind,
  Hazard,
  HazardKind,
  PerkId,
  PlayerState,
  WeaponId,
} from './entities';
import { WEAPON_META } from './weapons';

export const PERK_META: Record<PerkId, { title: string; description: string }> = {
  preview_bounce: {
    title: '+1 Aim Preview Bounce',
    description: 'Trajectory preview shows an extra wall bank.',
  },
  explosive_slam: {
    title: 'Explosive Wall Slams',
    description: 'Wall-slammed foes trigger a shockwave blast.',
  },
  brake_shockwave: {
    title: 'Brake Shockwave',
    description: 'Mid-flight Brake Tap clears nearby bullets.',
  },
  longer_focus: {
    title: 'Longer Focus Ring',
    description: '+0.6s slow-mo aiming window.',
  },
  max_shield: {
    title: '+1 Max Shield',
    description: 'Increases max Shield by 1 and restores Shield.',
  },
  bounce_speed: {
    title: 'Higher Bounce Speed',
    description: '+12% wall bounce speed & max launch power.',
  },
};

export interface RoomSpawnResult {
  enemies: Enemy[];
  hazards: Hazard[];
  isBossRoom: boolean;
  roomName: string;
}

const PLAYER_SPAWN_X = 135;
const PLAYER_SPAWN_Y = 395;
const MIN_PLAYER_SPAWN_CLEARANCE = 95;

const ALL_WEAPONS: WeaponId[] = ['railgun', 'shotgun', 'sawblade', 'arccoil'];
const ALL_PERKS: PerkId[] = [
  'preview_bounce',
  'explosive_slam',
  'brake_shockwave',
  'longer_focus',
  'max_shield',
  'bounce_speed',
];

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function makeEnemy(kind: EnemyKind, x: number, y: number, roomNumber: number): Enemy {
  const tierScale = Math.floor((roomNumber - 1) / 5);
  switch (kind) {
    case 'slime': {
      const hp = 2 + tierScale;
      return {
        id: allocEntityId(),
        kind,
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
        stateTimer: randRange(0.4, 1.1),
      };
    }
    case 'spike_slime': {
      const hp = 3 + tierScale;
      return {
        id: allocEntityId(),
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 11,
        hp,
        maxHp: hp,
        hitFlash: 0,
        slammedTimer: 0,
        angle: 0,
        stateTimer: randRange(1.0, 2.2),
        spikeState: 'calm',
      };
    }
    case 'sniper': {
      const hp = 2 + Math.floor((roomNumber - 1) / 6);
      return {
        id: allocEntityId(),
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 10,
        hp,
        maxHp: hp,
        hitFlash: 0,
        slammedTimer: 0,
        angle: Math.PI / 2,
        stateTimer: randRange(0.8, 1.6),
        sniperState: 'cooldown',
      };
    }
    case 'bomb_bot': {
      const hp = 2 + Math.floor((roomNumber - 1) / 7);
      return {
        id: allocEntityId(),
        kind,
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
        stateTimer: randRange(0.9, 1.8),
      };
    }
    case 'boss': {
      const hp = 14 + Math.floor(roomNumber / 5) * 6;
      return {
        id: allocEntityId(),
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 20,
        hp,
        maxHp: hp,
        hitFlash: 0,
        slammedTimer: 0,
        angle: Math.PI / 2,
        stateTimer: 1.4,
        bossPhase: 0,
        bossBurstCount: 0,
      };
    }
  }
}

function makeHazard(kind: HazardKind, x: number, y: number): Hazard {
  return {
    id: allocEntityId(),
    kind,
    x,
    y,
    radius: kind === 'bumper' ? 11 : 10,
    hp: kind === 'barrel' ? 1 : 999,
    pulseTimer: 0,
    triggered: false,
  };
}

interface OccupiedCircle {
  x: number;
  y: number;
  r: number;
}

function findSafeSpawnPos(
  occupied: OccupiedCircle[],
  radius: number,
  minX = 35,
  maxX = 235,
  minY = 75,
  maxY = 295,
): { x: number; y: number } {
  let bestX = (minX + maxX) * 0.5;
  let bestY = (minY + maxY) * 0.5;
  let bestMinClearance = -Infinity;

  for (let attempt = 0; attempt < 64; attempt++) {
    const cx = randRange(minX, maxX);
    const cy = randRange(minY, maxY);

    const playerDist = Math.hypot(cx - PLAYER_SPAWN_X, cy - PLAYER_SPAWN_Y);
    if (playerDist < MIN_PLAYER_SPAWN_CLEARANCE) {
      continue;
    }

    let minClearance = Infinity;
    let valid = true;
    for (const occ of occupied) {
      const dist = Math.hypot(cx - occ.x, cy - occ.y);
      const required = radius + occ.r + 14;
      const clearance = dist - required;
      if (clearance < minClearance) {
        minClearance = clearance;
      }
      if (dist < required) {
        valid = false;
      }
    }

    if (valid) {
      return { x: cx, y: cy };
    }

    if (minClearance > bestMinClearance) {
      bestMinClearance = minClearance;
      bestX = cx;
      bestY = cy;
    }
  }

  return { x: bestX, y: bestY };
}

function pickEnemyKind(
  roomNumber: number,
  sniperCount: number,
  bombCount: number,
): EnemyKind {
  const pool: EnemyKind[] = ['slime', 'slime'];
  if (roomNumber >= 2) {
    pool.push('spike_slime', 'spike_slime');
  }
  if (roomNumber >= 3 && sniperCount < 2) {
    pool.push('sniper');
  }
  if (roomNumber >= 4 && bombCount < 2) {
    pool.push('bomb_bot');
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateRoom(roomNumber: number): RoomSpawnResult {
  const enemies: Enemy[] = [];
  const hazards: Hazard[] = [];
  const occupied: OccupiedCircle[] = [];

  if (roomNumber === 1) {
    // Friendly pinball-billiards intro room
    const introEnemies: Array<[EnemyKind, number, number]> = [
      ['slime', 82, 138],
      ['slime', 188, 138],
      ['slime', 135, 228],
    ];
    for (const [kind, x, y] of introEnemies) {
      const e = makeEnemy(kind, x, y, roomNumber);
      enemies.push(e);
      occupied.push({ x: e.x, y: e.y, r: e.radius });
    }

    const barrel = makeHazard('barrel', 135, 145);
    const bumper = makeHazard('bumper', 72, 200);
    hazards.push(barrel, bumper);

    return {
      enemies,
      hazards,
      isBossRoom: false,
      roomName: 'SECTOR 01 // ENTRY',
    };
  }

  if (roomNumber % 5 === 0) {
    const bossTier = Math.floor(roomNumber / 5);
    const boss = makeEnemy('boss', 135, 130, roomNumber);
    enemies.push(boss);
    occupied.push({ x: boss.x, y: boss.y, r: boss.radius });

    const leftBumper = makeHazard('bumper', 54, 175);
    const rightBumper = makeHazard('bumper', 216, 175);
    hazards.push(leftBumper, rightBumper);
    occupied.push(
      { x: leftBumper.x, y: leftBumper.y, r: leftBumper.radius },
      { x: rightBumper.x, y: rightBumper.y, r: rightBumper.radius },
    );

    if (bossTier >= 2) {
      const barrelPos = findSafeSpawnPos(occupied, 10, 55, 215, 220, 280);
      const barrel = makeHazard('barrel', barrelPos.x, barrelPos.y);
      hazards.push(barrel);
      occupied.push({ x: barrel.x, y: barrel.y, r: barrel.radius });

      const supportPos = findSafeSpawnPos(occupied, 10, 45, 225, 85, 250);
      const support = makeEnemy('slime', supportPos.x, supportPos.y, roomNumber);
      enemies.push(support);
      occupied.push({ x: support.x, y: support.y, r: support.radius });
    }

    return {
      enemies,
      hazards,
      isBossRoom: true,
      roomName: bossTier > 1 ? `ARMORED CORE MK.${bossTier}` : 'ARMORED CORE',
    };
  }

  const enemyCount = Math.min(8, 3 + Math.floor(roomNumber * 0.6));
  let sniperCount = 0;
  let bombCount = 0;

  // Ensure new enemy types appear reliably when first introduced
  const guaranteed: EnemyKind[] = [];
  if (roomNumber === 2) {
    guaranteed.push('spike_slime', 'slime', 'slime');
  } else if (roomNumber === 3) {
    guaranteed.push('sniper', 'spike_slime', 'slime');
  } else if (roomNumber === 4) {
    guaranteed.push('bomb_bot', 'sniper', 'spike_slime');
  }

  for (let i = 0; i < enemyCount; i++) {
    let kind: EnemyKind;
    if (i < guaranteed.length) {
      kind = guaranteed[i];
    } else {
      kind = pickEnemyKind(roomNumber, sniperCount, bombCount);
    }

    if (kind === 'sniper') sniperCount++;
    if (kind === 'bomb_bot') bombCount++;

    const minY = kind === 'sniper' ? 72 : 85;
    const maxY = kind === 'sniper' ? 195 : 290;
    const pos = findSafeSpawnPos(occupied, 11, 35, 235, minY, maxY);
    const enemy = makeEnemy(kind, pos.x, pos.y, roomNumber);
    enemies.push(enemy);
    occupied.push({ x: enemy.x, y: enemy.y, r: enemy.radius });
  }

  const barrelCount = Math.random() < 0.75 ? 1 + (roomNumber >= 6 && Math.random() < 0.45 ? 1 : 0) : 1;
  const bumperCount = 1 + (Math.random() < 0.55 ? 1 : 0);

  for (let i = 0; i < barrelCount; i++) {
    const pos = findSafeSpawnPos(occupied, 10, 42, 228, 95, 285);
    const h = makeHazard('barrel', pos.x, pos.y);
    hazards.push(h);
    occupied.push({ x: h.x, y: h.y, r: h.radius });
  }

  for (let i = 0; i < bumperCount; i++) {
    const pos = findSafeSpawnPos(occupied, 11, 45, 225, 115, 295);
    const h = makeHazard('bumper', pos.x, pos.y);
    hazards.push(h);
    occupied.push({ x: h.x, y: h.y, r: h.radius });
  }

  const sectorNum = String(roomNumber).padStart(2, '0');
  const labels = ['VECTOR GRID', 'PINBALL VAULT', 'RICOCHET BAY', 'CHAMBER'];
  const label = labels[(roomNumber - 1) % labels.length];

  return {
    enemies,
    hazards,
    isBossRoom: false,
    roomName: `SECTOR ${sectorNum} // ${label}`,
  };
}

function shuffled<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function generateDraftOptions(
  player: PlayerState,
  roomNumber: number,
): DraftOption[] {
  void roomNumber;
  const options: DraftOption[] = [];

  const otherWeapons = shuffled(ALL_WEAPONS.filter((w) => w !== player.weapon));
  const pickedWeapon = otherWeapons[0];
  if (pickedWeapon) {
    const meta = WEAPON_META[pickedWeapon];
    options.push({
      id: `weapon_${pickedWeapon}`,
      kind: 'weapon',
      weaponId: pickedWeapon,
      title: `Equip: ${meta.name}`,
      description: meta.desc,
    });
  }

  const pickedPerks = shuffled(ALL_PERKS).slice(0, 3 - options.length);
  for (const perkId of pickedPerks) {
    const meta = PERK_META[perkId];
    options.push({
      id: `perk_${perkId}`,
      kind: 'perk',
      perkId,
      title: meta.title,
      description: meta.description,
    });
  }

  return options;
}
