import {
  COMBAT,
  DIFFICULTY_CONFIG,
  PERK_MAX_RANKS,
  RARITY_META,
  RARITY_ORDER,
} from './constants';
import {
  allocEntityId,
  DifficultyId,
  DraftOption,
  Enemy,
  EnemyKind,
  Hazard,
  HazardKind,
  PerkId,
  PlayerState,
  RarityId,
  WeaponId,
  WeaponModId,
} from './entities';
import { WEAPON_META, WEAPON_MOD_META, WEAPON_MODS_BY_WEAPON } from './weapons';

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
    description: 'Charged Brake Tap clears nearby bullets.',
  },
  longer_focus: {
    title: 'Longer Focus Ring',
    description: 'Extends your slow-mo aiming window.',
  },
  max_shield: {
    title: '+1 Max Shield',
    description: '+1 Max Shield (up to 3) and restores Shield.',
  },
  bounce_speed: {
    title: 'Higher Bounce Speed',
    description: 'Boosts wall bounce speed & max launch power.',
  },
  air_drag_tune: {
    title: 'Low-Friction Hull',
    description: 'Reduces air drag so launches glide farther.',
  },
  heavy_ram: {
    title: 'Kinetic Bumper',
    description: 'Boosts ram knockback and Wall Slam bonus damage.',
  },
  quick_charge: {
    title: 'Capacitor Banks',
    description: '2nd wall bounce hits 3x MAX; Bumpers grant +2 Charge.',
  },
  overheat_vent: {
    title: 'Thermal Sink',
    description: 'Delays arena Overheat countdown.',
  },
  momentum_edge: {
    title: 'Momentum Payload',
    description: 'Fast Brake Tap (290+ px/s) deals bonus damage.',
  },
  flow_surge: {
    title: 'Adrenaline Flow',
    description: 'Flow cap 7.0x; no-hit clears grant +1.0 Flow.',
  },
  vital_core: {
    title: 'Reinforced Core',
    description: '+1 Max HP (up to 4) and restores +1 HP.',
  },
  field_repair: {
    title: 'Nano Patch',
    description: 'Restores +1 HP immediately.',
  },
  ricochet_crit: {
    title: 'Bank Shot Mastery',
    description: '2x+ Charged shots deal bonus damage.',
  },
  perfect_brake: {
    title: 'Apex Snap-Shot',
    description: 'Brake Tap within 0.22s of wall bounce deals bonus damage.',
  },
  focus_kill_refund: {
    title: 'Bullet Time Flow',
    description: 'Kills right after slow-mo launch grant +0.5 Flow.',
  },
  kinetic_mastery: {
    title: 'Kinetic Overdrive',
    description: 'Repeatable: boosts Ram & Wall Slam damage.',
  },
  ordnance_caliber: {
    title: 'Ordnance Tuning',
    description: 'Repeatable: boosts primary weapon damage.',
  },
  velocity_tuning: {
    title: 'Hyper Bearings',
    description: 'Repeatable: boosts launch speed & max Flow cap.',
  },
  overclock_score: {
    title: 'Telemetry Overclock',
    description: 'Repeatable: boosts all score gained.',
  },
};

export const SCALABLE_PERKS: ReadonlySet<PerkId> = new Set([
  'explosive_slam',
  'brake_shockwave',
  'longer_focus',
  'bounce_speed',
  'air_drag_tune',
  'heavy_ram',
  'overheat_vent',
  'momentum_edge',
  'ricochet_crit',
  'perfect_brake',
]);

export const SCALABLE_WEAPON_MODS: ReadonlySet<WeaponModId> = new Set([
  'rail_width',
  'shot_caliber',
  'saw_size',
  'arc_overload',
]);

export const STANDARD_PERKS: readonly PerkId[] = [
  'preview_bounce',
  'explosive_slam',
  'brake_shockwave',
  'longer_focus',
  'max_shield',
  'bounce_speed',
  'air_drag_tune',
  'heavy_ram',
  'quick_charge',
  'overheat_vent',
  'momentum_edge',
  'flow_surge',
  'vital_core',
  'field_repair',
  'ricochet_crit',
  'perfect_brake',
  'focus_kill_refund',
];

export const MASTERY_PERKS: readonly PerkId[] = [
  'kinetic_mastery',
  'ordnance_caliber',
  'velocity_tuning',
  'overclock_score',
];

const MASTERY_RANKS_BY_RARITY: Record<RarityId, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  heroic: 4,
  mythic: 5,
};

export function getMasteryRankGain(rarity: RarityId): number {
  return MASTERY_RANKS_BY_RARITY[rarity];
}

export function getRarityMultiplier(rarity: RarityId = 'common'): number {
  return RARITY_META[rarity].multiplier;
}

export function getNextRarity(rarity: RarityId): RarityId | null {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

export function rollDraftRarity(
  roomNumber: number,
  flowMultiplier = 1.0,
  minRarity: RarityId = 'common',
): RarityId {
  const roomFactor = Math.max(0, roomNumber - 1);
  const flowFactor = Math.max(0, flowMultiplier - 1);

  const rawWeights: Record<RarityId, number> = {
    common: Math.max(8, 66 - roomFactor * 1.9 - flowFactor * 5),
    rare: 24 + Math.min(20, roomFactor * 0.7),
    epic: Math.max(0, 6 + roomFactor * 0.95 + flowFactor * 3),
    heroic: roomNumber >= 4 ? Math.max(0, 1 + (roomFactor - 3) * 0.65 + flowFactor * 2.5) : 0,
    mythic: roomNumber >= 8 ? Math.max(0, (roomFactor - 7) * 0.45 + flowFactor * 1.8) : 0,
  };

  const minIdx = RARITY_ORDER.indexOf(minRarity);
  let total = 0;
  for (let i = minIdx; i < RARITY_ORDER.length; i++) {
    total += rawWeights[RARITY_ORDER[i]];
  }
  if (total <= 0) return minRarity;

  let roll = Math.random() * total;
  for (let i = minIdx; i < RARITY_ORDER.length; i++) {
    const r = RARITY_ORDER[i];
    roll -= rawWeights[r];
    if (roll <= 0) return r;
  }
  return RARITY_ORDER[RARITY_ORDER.length - 1];
}

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

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function scaleEnemyHp(baseHp: number, hpMul: number): number {
  return Math.max(1, Math.round(baseHp * hpMul));
}

function makeEnemy(
  kind: EnemyKind,
  x: number,
  y: number,
  roomNumber: number,
  difficulty: DifficultyId = 'standard',
): Enemy {
  const diff = DIFFICULTY_CONFIG[difficulty];
  const lateBonus = Math.max(0, Math.floor((roomNumber - 15) / 4));
  const tierScale = Math.floor((roomNumber - 1) / 5) + lateBonus;

  switch (kind) {
    case 'slime': {
      const hp = scaleEnemyHp(3 + tierScale, diff.enemyHpMul);
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
        canShoot: roomNumber >= 2,
        fireTimer: randRange(1.6, 2.5),
      };
    }
    case 'spike_slime': {
      const hp = scaleEnemyHp(4 + tierScale, diff.enemyHpMul);
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
        spikePhaseParity: 0,
      };
    }
    case 'sniper': {
      const hp = scaleEnemyHp(3 + Math.floor((roomNumber - 1) / 6) + Math.floor(lateBonus * 0.7), diff.enemyHpMul);
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
        isFanShot: roomNumber >= 4,
        burstRemaining: 0,
        burstCooldown: 0,
      };
    }
    case 'bomb_bot': {
      const hp = scaleEnemyHp(3 + Math.floor((roomNumber - 1) / 7) + Math.floor(lateBonus * 0.6), diff.enemyHpMul);
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
    case 'drone': {
      const hp = scaleEnemyHp(3 + Math.floor((roomNumber - 1) / 6) + Math.floor(lateBonus * 0.7), diff.enemyHpMul);
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
        angle: Math.random() * Math.PI * 2,
        stateTimer: randRange(0.9, 1.5),
        fireTimer: randRange(1.2, 1.9),
      };
    }
    case 'boss': {
      const bossTier = Math.max(1, Math.floor(roomNumber / 5));
      const baseHp =
        bossTier === 1
          ? 16
          : bossTier === 2
            ? 32
            : bossTier === 3
              ? 44
              : Math.round(16 + bossTier * 9 + Math.pow(bossTier, 1.5) * 3);
      const hp = Math.max(10, Math.round(baseHp * diff.bossHpMul));
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
        stateTimer: bossTier === 1 ? 1.55 : Math.max(0.95, 1.45 - (bossTier - 2) * 0.08),
        bossPhase: 0,
        bossBurstCount: 0,
        bossPattern: 0,
        bossTier,
        burstRemaining: 0,
        burstCooldown: 0,
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
  droneCount: number,
): EnemyKind {
  const maxSpecial = roomNumber >= 15 ? 3 : 2;
  const pool: EnemyKind[] = roomNumber >= 16 ? ['slime'] : ['slime', 'slime'];
  if (roomNumber >= 2) {
    pool.push('spike_slime', 'spike_slime');
  }
  if (roomNumber >= 3 && sniperCount < maxSpecial) {
    pool.push('sniper');
    if (roomNumber >= 18) pool.push('sniper');
  }
  if (roomNumber >= 3 && droneCount < maxSpecial) {
    pool.push('drone');
    if (roomNumber >= 18) pool.push('drone');
  }
  if (roomNumber >= 4 && bombCount < maxSpecial) {
    pool.push('bomb_bot');
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateRoom(
  roomNumber: number,
  difficulty: DifficultyId = 'standard',
): RoomSpawnResult {
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
      const e = makeEnemy(kind, x, y, roomNumber, difficulty);
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
    const bossTier = Math.max(1, Math.floor(roomNumber / 5));
    const boss = makeEnemy('boss', 135, 130, roomNumber, difficulty);
    enemies.push(boss);
    occupied.push({ x: boss.x, y: boss.y, r: boss.radius });

    const leftBumper = makeHazard('bumper', 54, 175);
    const rightBumper = makeHazard('bumper', 216, 175);
    hazards.push(leftBumper, rightBumper);
    occupied.push(
      { x: leftBumper.x, y: leftBumper.y, r: leftBumper.radius },
      { x: rightBumper.x, y: rightBumper.y, r: rightBumper.radius },
    );

    // Tier 2+ bosses bring tactical escorts instead of helpful barrels
    if (bossTier >= 2) {
      const escorts: EnemyKind[] =
        bossTier === 2
          ? ['drone']
          : bossTier === 3
            ? ['drone', 'slime']
            : bossTier === 4
              ? ['sniper', 'spike_slime']
              : bossTier === 5
                ? ['sniper', 'drone', 'bomb_bot']
                : ['sniper', 'drone', 'spike_slime', 'bomb_bot'];

      for (const escortKind of escorts) {
        const minY = escortKind === 'sniper' ? 74 : 95;
        const maxY = escortKind === 'sniper' ? 170 : 250;
        const pos = findSafeSpawnPos(occupied, 11, 40, 230, minY, maxY);
        const escort = makeEnemy(escortKind, pos.x, pos.y, roomNumber, difficulty);
        enemies.push(escort);
        occupied.push({ x: escort.x, y: escort.y, r: escort.radius });
      }
    }

    return {
      enemies,
      hazards,
      isBossRoom: true,
      roomName: bossTier > 1 ? `ARMORED CORE MK.${bossTier}` : 'ARMORED CORE',
    };
  }

  const enemyCount =
    roomNumber < 15
      ? Math.min(8, 3 + Math.floor(roomNumber * 0.6))
      : Math.min(11, 8 + Math.floor((roomNumber - 14) / 5));

  let sniperCount = 0;
  let bombCount = 0;
  let droneCount = 0;

  // Ensure new enemy types appear reliably when first introduced
  const guaranteed: EnemyKind[] = [];
  if (roomNumber === 2) {
    guaranteed.push('spike_slime', 'slime', 'slime');
  } else if (roomNumber === 3) {
    guaranteed.push('sniper', 'drone', 'spike_slime');
  } else if (roomNumber === 4) {
    guaranteed.push('bomb_bot', 'sniper', 'spike_slime');
  }

  for (let i = 0; i < enemyCount; i++) {
    let kind: EnemyKind;
    if (i < guaranteed.length) {
      kind = guaranteed[i];
    } else if (i === enemyCount - 1 && roomNumber >= 3 && sniperCount === 0 && droneCount === 0) {
      kind = Math.random() < 0.5 ? 'sniper' : 'drone';
    } else {
      kind = pickEnemyKind(roomNumber, sniperCount, bombCount, droneCount);
    }

    if (kind === 'sniper') sniperCount++;
    if (kind === 'bomb_bot') bombCount++;
    if (kind === 'drone') droneCount++;

    const minY = kind === 'sniper' ? 72 : kind === 'drone' ? 75 : 85;
    const maxY = kind === 'sniper' ? 195 : kind === 'drone' ? 220 : 290;
    const pos = findSafeSpawnPos(occupied, 11, 35, 235, minY, maxY);
    const enemy = makeEnemy(kind, pos.x, pos.y, roomNumber, difficulty);
    enemies.push(enemy);
    occupied.push({ x: enemy.x, y: enemy.y, r: enemy.radius });
  }

  const barrelCount = 1 + (roomNumber >= 6 && Math.random() < 0.45 ? 1 : 0);
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

function formatModDescription(modId: WeaponModId, rarity: RarityId): string {
  const meta = WEAPON_MOD_META[modId];
  if (!SCALABLE_WEAPON_MODS.has(modId) || rarity === 'common') {
    return meta.description;
  }
  const mult = RARITY_META[rarity].multiplier;
  return `${meta.description} (${Math.round(mult * 100)}% potency)`;
}

function formatPerkDescription(perkId: PerkId, rarity: RarityId): string {
  const meta = PERK_META[perkId];
  if (MASTERY_PERKS.includes(perkId)) {
    const gain = getMasteryRankGain(rarity);
    if (perkId === 'kinetic_mastery') {
      return `Repeatable: +${(gain * 0.5).toFixed(1)} Ram & Wall Slam damage (+${gain} stack).`;
    }
    if (perkId === 'ordnance_caliber') {
      return `Repeatable: +${(gain * 0.5).toFixed(1)} primary weapon damage (+${gain} stack).`;
    }
    if (perkId === 'velocity_tuning') {
      return `Repeatable: +${gain * 3}% launch speed & +${(gain * 0.15).toFixed(2)}x Flow cap.`;
    }
    return `Repeatable: +${gain * 8}% score from kills & clears.`;
  }
  if (!SCALABLE_PERKS.has(perkId) || rarity === 'common') {
    return meta.description;
  }
  const mult = RARITY_META[rarity].multiplier;
  return `${meta.description} (${Math.round(mult * 100)}% potency)`;
}

function makeWeaponModOption(
  modId: WeaponModId,
  currentRank: number,
  rarity: RarityId,
  previousRarity?: RarityId,
): DraftOption {
  const meta = WEAPON_MOD_META[modId];
  const nextRank = currentRank + 1;
  const isUpgrade = previousRarity !== undefined;
  return {
    id: isUpgrade ? `mod_up_${modId}` : `mod_${modId}`,
    kind: 'weapon_mod',
    weaponId: meta.weapon,
    weaponModId: modId,
    title: isUpgrade ? `${meta.title} +` : meta.title,
    description: formatModDescription(modId, rarity),
    rankLabel: isUpgrade
      ? `${RARITY_META[previousRarity].label} → ${RARITY_META[rarity].label}`
      : `Rank ${nextRank}/${COMBAT.MAX_WEAPON_MOD_RANK}`,
    rarity,
    ...(isUpgrade ? { previousRarity, isRarityUpgrade: true } : {}),
  };
}

function makePerkOption(
  perkId: PerkId,
  currentRank = 0,
  rarity: RarityId = 'common',
  previousRarity?: RarityId,
): DraftOption {
  const meta = PERK_META[perkId];
  const maxRank = PERK_MAX_RANKS[perkId];
  const isMastery = MASTERY_PERKS.includes(perkId);
  const isUpgrade = previousRarity !== undefined;

  let rankLabel: string | undefined;
  if (isUpgrade) {
    rankLabel = `${RARITY_META[previousRarity].label} → ${RARITY_META[rarity].label}`;
  } else if (isMastery) {
    const gain = getMasteryRankGain(rarity);
    rankLabel = `Lv.${currentRank + gain}`;
  } else if (maxRank > 1 && maxRank < 99) {
    rankLabel = `Rank ${currentRank + 1}/${maxRank}`;
  }

  return {
    id: isUpgrade ? `perk_up_${perkId}` : `perk_${perkId}`,
    kind: 'perk',
    perkId,
    title: isUpgrade ? `${meta.title} +` : meta.title,
    description: formatPerkDescription(perkId, rarity),
    ...(rankLabel ? { rankLabel } : {}),
    rarity,
    ...(isUpgrade ? { previousRarity, isRarityUpgrade: true } : {}),
    ...(isMastery ? { isMastery: true } : {}),
  };
}

export function generateWeaponTransferOptions(
  player: PlayerState,
  newWeapon: WeaponId,
): DraftOption[] {
  const options: DraftOption[] = [];
  for (const modId of WEAPON_MODS_BY_WEAPON[newWeapon]) {
    const currentRank = player.weaponMods?.[modId] ?? 0;
    if (currentRank < COMBAT.MAX_WEAPON_MOD_RANK) {
      const rarity = SCALABLE_WEAPON_MODS.has(modId)
        ? rollDraftRarity(10, 1.5, 'rare')
        : 'common';
      options.push(makeWeaponModOption(modId, currentRank, rarity));
    }
  }
  return options;
}

function makeWeaponSwapOption(weaponId: WeaponId, budget: number): DraftOption {
  const meta = WEAPON_META[weaponId];
  const transferNote =
    budget > 0 ? ` Transfers ${budget} weapon upgrade(s) to re-pick!` : '';
  return {
    id: `weapon_${weaponId}`,
    kind: 'weapon',
    weaponId,
    title: `Equip: ${meta.name}`,
    description: `${meta.desc}${transferNote}`,
    rarity: 'rare',
  };
}

export function generateDraftOptions(
  player: PlayerState,
  roomNumber: number,
  flowMultiplier = 1.0,
): DraftOption[] {
  const options: DraftOption[] = [];
  const usedIds = new Set<string>();
  const budget = player.weaponUpgradeBudget ?? 0;

  // 1. Standard perks still below max rank (respecting strict survivability & preview caps)
  const eligiblePerks = STANDARD_PERKS.filter((id) => {
    const rank = player.perks?.[id] ?? 0;
    if (rank >= PERK_MAX_RANKS[id]) return false;
    if (id === 'max_shield' && player.maxShield >= COMBAT.HARD_MAX_SHIELD) {
      return false;
    }
    if (id === 'vital_core' && player.maxHp >= COMBAT.HARD_MAX_HP) {
      return false;
    }
    if (id === 'field_repair' && player.hp >= player.maxHp) {
      return false;
    }
    return true;
  });

  // 2. Owned scalable perks whose rarity can still be upgraded toward Mythic
  const rarityUpgradePerks = STANDARD_PERKS.filter((id) => {
    if (!SCALABLE_PERKS.has(id)) return false;
    const rank = player.perks?.[id] ?? 0;
    if (rank <= 0) return false;
    const curRarity = player.perkRarities?.[id] ?? 'common';
    return getNextRarity(curRarity) !== null;
  });

  // 3. Current weapon mods: new unmaxed mods OR rarity upgrades on scalable non-clutter mods
  const upgradeableMods =
    budget < COMBAT.MAX_WEAPON_UPGRADES
      ? WEAPON_MODS_BY_WEAPON[player.weapon].filter(
          (modId) => (player.weaponMods?.[modId] ?? 0) < COMBAT.MAX_WEAPON_MOD_RANK,
        )
      : [];

  const rarityUpgradeMods = WEAPON_MODS_BY_WEAPON[player.weapon].filter((modId) => {
    if (!SCALABLE_WEAPON_MODS.has(modId)) return false;
    if ((player.weaponMods?.[modId] ?? 0) <= 0) return false;
    const curRarity = player.weaponModRarities?.[modId] ?? 'common';
    return getNextRarity(curRarity) !== null;
  });

  const shuffledPerks = shuffled(eligiblePerks);
  const shuffledUpgradePerks = shuffled(rarityUpgradePerks);
  const shuffledMastery = shuffled(MASTERY_PERKS);
  const otherWeapons = shuffled(ALL_WEAPONS.filter((w) => w !== player.weapon));

  const tryAddPerkOrUpgrade = (): boolean => {
    // Prefer new perks early; blend in rarity upgrades & mastery past Rm 14 or when perks thin out
    const wantRarityUpgrade =
      shuffledUpgradePerks.length > 0 &&
      (shuffledPerks.length === 0 || (roomNumber >= 10 && Math.random() < 0.35));

    if (wantRarityUpgrade) {
      for (const perkId of shuffledUpgradePerks) {
        const curRarity = player.perkRarities?.[perkId] ?? 'common';
        const nextRarity = getNextRarity(curRarity);
        if (!nextRarity) continue;
        // Can jump higher rarity at high rooms
        const rolled = rollDraftRarity(roomNumber, flowMultiplier, nextRarity);
        const opt = makePerkOption(
          perkId,
          player.perks?.[perkId] ?? 1,
          rolled,
          curRarity,
        );
        if (usedIds.has(opt.id) || usedIds.has(`perk_${perkId}`)) continue;
        options.push(opt);
        usedIds.add(opt.id);
        return true;
      }
    }

    for (const perkId of shuffledPerks) {
      const rarity = SCALABLE_PERKS.has(perkId)
        ? rollDraftRarity(roomNumber, flowMultiplier)
        : 'common';
      const opt = makePerkOption(perkId, player.perks?.[perkId] ?? 0, rarity);
      if (usedIds.has(opt.id) || usedIds.has(`perk_up_${perkId}`)) continue;
      options.push(opt);
      usedIds.add(opt.id);
      return true;
    }

    // Fallback to any remaining rarity upgrade perks
    for (const perkId of shuffledUpgradePerks) {
      const curRarity = player.perkRarities?.[perkId] ?? 'common';
      const nextRarity = getNextRarity(curRarity);
      if (!nextRarity) continue;
      const rolled = rollDraftRarity(roomNumber, flowMultiplier, nextRarity);
      const opt = makePerkOption(
        perkId,
        player.perks?.[perkId] ?? 1,
        rolled,
        curRarity,
      );
      if (usedIds.has(opt.id) || usedIds.has(`perk_${perkId}`)) continue;
      options.push(opt);
      usedIds.add(opt.id);
      return true;
    }

    return false;
  };

  const tryAddMastery = (): boolean => {
    for (const perkId of shuffledMastery) {
      const rarity = rollDraftRarity(roomNumber, flowMultiplier);
      const opt = makePerkOption(perkId, player.perks?.[perkId] ?? 0, rarity);
      if (usedIds.has(opt.id)) continue;
      options.push(opt);
      usedIds.add(opt.id);
      return true;
    }
    return false;
  };

  // Slot A: Weapon Mod (new or rarity upgrade on scalable mod) -> otherwise Perk/Mastery
  if (upgradeableMods.length > 0) {
    const pickedMod = shuffled(upgradeableMods)[0];
    const rarity = SCALABLE_WEAPON_MODS.has(pickedMod)
      ? rollDraftRarity(roomNumber, flowMultiplier)
      : 'common';
    const opt = makeWeaponModOption(pickedMod, player.weaponMods?.[pickedMod] ?? 0, rarity);
    options.push(opt);
    usedIds.add(opt.id);
  } else if (rarityUpgradeMods.length > 0 && Math.random() < 0.65) {
    const pickedMod = shuffled(rarityUpgradeMods)[0];
    const curRarity = player.weaponModRarities?.[pickedMod] ?? 'common';
    const nextRarity = getNextRarity(curRarity) ?? 'mythic';
    const rolled = rollDraftRarity(roomNumber, flowMultiplier, nextRarity);
    const opt = makeWeaponModOption(
      pickedMod,
      player.weaponMods?.[pickedMod] ?? 1,
      rolled,
      curRarity,
    );
    options.push(opt);
    usedIds.add(opt.id);
  } else if (!tryAddPerkOrUpgrade()) {
    tryAddMastery();
  }

  // Slot B: Weapon Swap (~32% chance early/mid, lower late so mastery/upgrades shine) or Perk/Mastery
  const weaponSwapChance = roomNumber >= 20 ? 0.2 : 0.35;
  if (otherWeapons.length > 0 && Math.random() < weaponSwapChance) {
    const opt = makeWeaponSwapOption(otherWeapons[0], budget);
    options.push(opt);
    usedIds.add(opt.id);
  } else if (roomNumber >= 20 && Math.random() < 0.45) {
    if (!tryAddMastery()) tryAddPerkOrUpgrade();
  } else if (!tryAddPerkOrUpgrade()) {
    tryAddMastery();
  }

  // Slot C: Guarantee a distinct Perk, Rarity Upgrade, or Mastery card (never 3 weapon swaps!)
  while (options.length < 3) {
    const preferMasteryLate = roomNumber >= 22 && Math.random() < 0.5;
    if (preferMasteryLate) {
      if (tryAddMastery()) continue;
      if (tryAddPerkOrUpgrade()) continue;
    } else {
      if (tryAddPerkOrUpgrade()) continue;
      if (tryAddMastery()) continue;
    }

    // Ultimate fallback if somehow exhausted
    let addedWeapon = false;
    for (const weaponId of otherWeapons) {
      const opt = makeWeaponSwapOption(weaponId, budget);
      if (usedIds.has(opt.id)) continue;
      options.push(opt);
      usedIds.add(opt.id);
      addedWeapon = true;
      break;
    }
    if (!addedWeapon) break;
  }

  return options;
}
