export const CANVAS_WIDTH = 270;
export const CANVAS_HEIGHT = 480;

export const ARENA = {
  left: 10,
  right: 260,
  top: 40,
  bottom: 468,
  width: 250,
  height: 428,
} as const;

export const PHYSICS = {
  FIXED_DT: 1 / 120,
  MAX_FRAME_DT: 0.05,
  MAX_SUBSTEP_DIST: 2.5,
  PLAYER_RADIUS: 7,
  PLAYER_DRAG: 0.78, // Exponential velocity decay per second
  MIN_LAUNCH_SPEED: 220,
  MAX_LAUNCH_SPEED: 470,
  WALL_RESTITUTION: 0.94,
  ARMORED_SPEED_THRESHOLD: 145,
  STOP_SPEED_THRESHOLD: 14,
  ENEMY_KNOCKBACK_DRAG: 4.5,
  WALL_SLAM_SPEED_THRESHOLD: 135,
  BUMPER_BOUNCE_SPEED: 440,
} as const;

export const CONTROLS = {
  DRAG_THRESHOLD_PX: 6,
  HOLD_SLOWMO_DELAY_MS: 90,
  TAP_MAX_DURATION_MS: 140,
  SLINGSHOT_MAX_PULL_PX: 68,
  MIN_PULL_SENSITIVITY_PX: 44,
  MAX_PULL_SENSITIVITY_PX: 96,
  AIM_TIME_SCALE: 0.12,
  AIM_MAX_DURATION_SEC: 2.5,
  FOCUS_RAMPOUT_SEC: 0.25,
  BASE_PREVIEW_BOUNCES: 1,
} as const;

export const COMBAT = {
  BASE_MAX_HP: 3,
  BASE_MAX_SHIELD: 1,
  PLAYER_IFRAMES_SEC: 0.9,
  HITSTOP_HEAVY_SEC: 0.045,
  HITSTOP_LIGHT_SEC: 0.022,
  MAX_CHARGE_TIER: 3,
  MAX_WEAPON_UPGRADES: 3,
  MAX_WEAPON_MOD_RANK: 1,
  HARD_MAX_HP: 4,
  HARD_MAX_SHIELD: 3,
  MOMENTUM_EDGE_MIN_SPEED: 290,
  SKIP_DRAFT_BASE_BONUS: 150,
  BOSS_SHIELD_HALF_ANGLE_RAD: (48 * Math.PI) / 180,
  RAM_BASE_DAMAGE: 1,
  WALL_SLAM_BONUS_DAMAGE: 2,
  BOMB_BLAST_RADIUS: 44,
  BOMB_DAMAGE: 3,
  BARREL_BLAST_RADIUS: 48,
  BARREL_DAMAGE: 4,
  BRAKE_SHOCKWAVE_RADIUS: 34,
  EXPLOSIVE_SLAM_RADIUS: 36,
} as const;

export const PERK_MAX_RANKS = {
  preview_bounce: 1,
  explosive_slam: 2,
  brake_shockwave: 1,
  longer_focus: 2,
  max_shield: 2,
  bounce_speed: 2,
  air_drag_tune: 2,
  heavy_ram: 2,
  quick_charge: 1,
  overheat_vent: 2,
  momentum_edge: 1,
  flow_surge: 1,
  vital_core: 1,
  field_repair: 99,
  ricochet_crit: 2,
  perfect_brake: 2,
  focus_kill_refund: 1,
  kinetic_mastery: 99,
  ordnance_caliber: 99,
  velocity_tuning: 99,
  overclock_score: 99,
} as const;

export const RARITY_ORDER = ['common', 'rare', 'epic', 'heroic', 'mythic'] as const;

export const RARITY_META = {
  common: { label: 'COMMON', color: '#9aa8cc', multiplier: 1.0 },
  rare: { label: 'RARE', color: '#2cf5ff', multiplier: 1.35 },
  epic: { label: 'EPIC', color: '#b967ff', multiplier: 1.75 },
  heroic: { label: 'HEROIC', color: '#ffd447', multiplier: 2.2 },
  mythic: { label: 'MYTHIC', color: '#ff2e88', multiplier: 2.75 },
} as const;

export const DIFFICULTY_ORDER = ['chill', 'standard', 'overdrive'] as const;

export const DIFFICULTY_CONFIG = {
  chill: {
    label: 'CHILL',
    desc: 'Relaxed pacing: +0.6s Focus, slower shots, lighter HP.',
    enemyBulletSpeedMul: 0.72,
    enemyCooldownMul: 1.35,
    enemyHpMul: 0.75,
    bossHpMul: 0.75,
    focusBonusSec: 0.6,
    scoreMul: 0.8,
  },
  standard: {
    label: 'STANDARD',
    desc: 'Balanced arcade pacing & classic skill challenge.',
    enemyBulletSpeedMul: 0.84,
    enemyCooldownMul: 1.18,
    enemyHpMul: 0.88,
    bossHpMul: 0.88,
    focusBonusSec: 0,
    scoreMul: 1.0,
  },
  overdrive: {
    label: 'OVERDRIVE',
    desc: 'Faster bullets, tougher bosses, 1.3x Score multiplier.',
    enemyBulletSpeedMul: 1.1,
    enemyCooldownMul: 0.88,
    enemyHpMul: 1.15,
    bossHpMul: 1.2,
    focusBonusSec: 0,
    scoreMul: 1.3,
  },
} as const;

export const OVERHEAT = {
  WARNING_START_SEC: 20,
  WARNING_DURATION_SEC: 3,
  OVERHEAT_START_SEC: 23,
} as const;

export const TRANSITION = {
  ROOM_SCROLL_SEC: 0.65,
  CLEAR_BANNER_SEC: 0.45,
} as const;

export const COLORS = {
  voidBg: '#07080f',
  floorGrid: '#0e1222',
  floorAccent: '#151b33',
  wallOuter: '#1c233d',
  wallInner: '#344270',
  wallOverheatWarn: '#ff9a2e',
  wallOverheat: '#ff2b45',

  playerCore: '#e8feff',
  playerBody: '#2cf5ff',
  playerArmored: '#72ffff',
  playerVulnerable: '#6978a8',

  charge0: '#2cf5ff',
  charge1: '#45ff9a',
  charge2: '#ffd447',
  charge3: '#ff2e88',

  slime: '#45ff9a',
  slimeDark: '#177548',
  spikeCalm: '#3de085',
  spikeWarn: '#ffd447',
  spikeRed: '#ff2b45',
  sniper: '#b967ff',
  sniperLaser: '#ff2b45',
  bombBot: '#ff8c2e',
  drone: '#ff5286',
  bossShell: '#4f5d8a',
  bossCore: '#ff2e88',
  bossShield: '#8bb8ff',

  barrel: '#ff5238',
  bumper: '#ffd447',
  bulletRed: '#ff2b45',
  bulletCore: '#ffe6ea',
  playerBullet: '#d8ff36',
  playerBulletRim: '#8ce600',
  playerBulletCore: '#ffffff',

  textWhite: '#eef4ff',
  textDim: '#7f8bb0',
  textGold: '#ffd447',
  textCyan: '#2cf5ff',
  textRed: '#ff384c',
} as const;

export const STORAGE_KEYS = {
  BEST_SCORE: 'ricochet_zero_best_score_v1',
  BEST_ROOM: 'ricochet_zero_best_room_v1',
  MUTED: 'ricochet_zero_muted_v1',
  TUTORIAL_DONE: 'ricochet_zero_tutorial_done_v1',
  SETTINGS: 'ricochet_zero_settings_v1',
  RECORDS: 'ricochet_zero_records_v1',
} as const;
