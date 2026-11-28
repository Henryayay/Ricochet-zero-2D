import { DIFFICULTY_ORDER, RARITY_ORDER } from './constants';

export type WeaponId = 'railgun' | 'shotgun' | 'sawblade' | 'arccoil';

export type RarityId = (typeof RARITY_ORDER)[number];
export type DifficultyId = (typeof DIFFICULTY_ORDER)[number];

export interface GameSettings {
  bgmVolume: number;
  sfxVolume: number;
  pullSensitivityPx: number;
  screenShake: boolean;
  difficulty: DifficultyId;
}

export interface DifficultyRecord {
  bestScore: number;
  bestRoom: number;
}

export type WeaponModId =
  | 'rail_beams'
  | 'rail_width'
  | 'rail_bounce'
  | 'shot_pellets'
  | 'shot_bounce'
  | 'shot_caliber'
  | 'saw_count'
  | 'saw_bounce'
  | 'saw_size'
  | 'arc_jumps'
  | 'arc_fork'
  | 'arc_overload';

export type PerkId =
  | 'preview_bounce'
  | 'explosive_slam'
  | 'brake_shockwave'
  | 'longer_focus'
  | 'max_shield'
  | 'bounce_speed'
  | 'air_drag_tune'
  | 'heavy_ram'
  | 'quick_charge'
  | 'overheat_vent'
  | 'momentum_edge'
  | 'flow_surge'
  | 'vital_core'
  | 'field_repair'
  | 'ricochet_crit'
  | 'perfect_brake'
  | 'focus_kill_refund'
  | 'kinetic_mastery'
  | 'ordnance_caliber'
  | 'velocity_tuning'
  | 'overclock_score';

export type EnemyKind = 'slime' | 'spike_slime' | 'sniper' | 'bomb_bot' | 'drone' | 'boss';

export type HazardKind = 'barrel' | 'bumper';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  tier: number;
  armored: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Last normalized direction vector while moving (used for Momentum Aim & nose chevron) */
  aimDirX: number;
  aimDirY: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  iframes: number;
  chargeTier: number;
  armored: boolean;
  weapon: WeaponId;
  weaponMods: Record<WeaponModId, number>;
  weaponModRarities?: Record<WeaponModId, RarityId>;
  /** Total weapon upgrade points earned across the run (capped at COMBAT.MAX_WEAPON_UPGRADES) */
  weaponUpgradeBudget: number;
  perks: Record<PerkId, number>;
  perkRarities?: Record<PerkId, RarityId>;
  trail: TrailPoint[];
  flashTimer: number;
}

export type SpikeState = 'calm' | 'telegraph' | 'spiked';
export type SniperState = 'cooldown' | 'tracking' | 'locked';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  /** Set when knocked by player ram; triggers bonus damage if hitting a wall */
  slammedTimer: number;
  /** Facing angle in radians (used by Sniper & Boss shield) */
  angle: number;
  stateTimer: number;
  spikeState?: SpikeState;
  sniperState?: SniperState;
  bossPhase?: number;
  bossBurstCount?: number;
  bossPattern?: number;
  bossTier?: number;
  canShoot?: boolean;
  fireTimer?: number;
  burstRemaining?: number;
  burstCooldown?: number;
  telegraphAngle?: number;
  isFanShot?: boolean;
  spikePhaseParity?: number;
  stationary?: boolean;
}

export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  radius: number;
  hp: number;
  pulseTimer: number;
  triggered: boolean;
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife?: number;
  color: string;
  knockback?: number;
  fromCharge?: boolean;
  bouncesLeft?: number;
  bouncesDone?: number;
  piercesLeft?: number;
  hitEnemyIds?: number[];
  slamTimerSec?: number;
  pointBlankBonus?: number;
  pointBlankWindowSec?: number;
}

export interface Sawblade {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  bouncesLeft: number;
  bouncesDone?: number;
  fromCharge?: boolean;
  spin: number;
  hitCooldowns: Map<number, number>;
}

export interface BeamEffect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface ArcEffect {
  points: Vec2[];
  life: number;
  maxLife: number;
  color: string;
}

export interface RingEffect {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale?: number;
}

export interface DraftOption {
  id: string;
  kind: 'weapon' | 'weapon_mod' | 'perk';
  weaponId?: WeaponId;
  weaponModId?: WeaponModId;
  perkId?: PerkId;
  title: string;
  description: string;
  rankLabel?: string;
  rarity?: RarityId;
  previousRarity?: RarityId;
  isRarityUpgrade?: boolean;
  isMastery?: boolean;
}

export function createInitialPerks(): Record<PerkId, number> {
  return {
    preview_bounce: 0,
    explosive_slam: 0,
    brake_shockwave: 0,
    longer_focus: 0,
    max_shield: 0,
    bounce_speed: 0,
    air_drag_tune: 0,
    heavy_ram: 0,
    quick_charge: 0,
    overheat_vent: 0,
    momentum_edge: 0,
    flow_surge: 0,
    vital_core: 0,
    field_repair: 0,
    ricochet_crit: 0,
    perfect_brake: 0,
    focus_kill_refund: 0,
    kinetic_mastery: 0,
    ordnance_caliber: 0,
    velocity_tuning: 0,
    overclock_score: 0,
  };
}

export function createInitialPerkRarities(): Record<PerkId, RarityId> {
  return {
    preview_bounce: 'common',
    explosive_slam: 'common',
    brake_shockwave: 'common',
    longer_focus: 'common',
    max_shield: 'common',
    bounce_speed: 'common',
    air_drag_tune: 'common',
    heavy_ram: 'common',
    quick_charge: 'common',
    overheat_vent: 'common',
    momentum_edge: 'common',
    flow_surge: 'common',
    vital_core: 'common',
    field_repair: 'common',
    ricochet_crit: 'common',
    perfect_brake: 'common',
    focus_kill_refund: 'common',
    kinetic_mastery: 'common',
    ordnance_caliber: 'common',
    velocity_tuning: 'common',
    overclock_score: 'common',
  };
}

export function createInitialWeaponMods(): Record<WeaponModId, number> {
  return {
    rail_beams: 0,
    rail_width: 0,
    rail_bounce: 0,
    shot_pellets: 0,
    shot_bounce: 0,
    shot_caliber: 0,
    saw_count: 0,
    saw_bounce: 0,
    saw_size: 0,
    arc_jumps: 0,
    arc_fork: 0,
    arc_overload: 0,
  };
}

export function createInitialWeaponModRarities(): Record<WeaponModId, RarityId> {
  return {
    rail_beams: 'common',
    rail_width: 'common',
    rail_bounce: 'common',
    shot_pellets: 'common',
    shot_bounce: 'common',
    shot_caliber: 'common',
    saw_count: 'common',
    saw_bounce: 'common',
    saw_size: 'common',
    arc_jumps: 'common',
    arc_fork: 'common',
    arc_overload: 'common',
  };
}

let nextEntityId = 1;
export function allocEntityId(): number {
  return nextEntityId++;
}
