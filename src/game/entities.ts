export type WeaponId = 'railgun' | 'shotgun' | 'sawblade' | 'arccoil';

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
  | 'bounce_speed';

export type EnemyKind = 'slime' | 'spike_slime' | 'sniper' | 'bomb_bot' | 'boss';

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
  /** Total weapon upgrade points earned across the run (capped at COMBAT.MAX_WEAPON_UPGRADES) */
  weaponUpgradeBudget: number;
  perks: Record<PerkId, number>;
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
  color: string;
  knockback?: number;
  fromCharge?: boolean;
  bouncesLeft?: number;
  bouncesDone?: number;
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
}

export function createInitialPerks(): Record<PerkId, number> {
  return {
    preview_bounce: 0,
    explosive_slam: 0,
    brake_shockwave: 0,
    longer_focus: 0,
    max_shield: 0,
    bounce_speed: 0,
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

let nextEntityId = 1;
export function allocEntityId(): number {
  return nextEntityId++;
}
