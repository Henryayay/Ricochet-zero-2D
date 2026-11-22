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
  DRAG_THRESHOLD_PX: 10,
  TAP_MAX_DURATION_MS: 140,
  SLINGSHOT_MAX_PULL_PX: 68,
  AIM_TIME_SCALE: 0.2,
  AIM_MAX_DURATION_SEC: 1.2,
  BASE_PREVIEW_BOUNCES: 1,
} as const;

export const COMBAT = {
  BASE_MAX_HP: 3,
  BASE_MAX_SHIELD: 1,
  PLAYER_IFRAMES_SEC: 0.9,
  HITSTOP_HEAVY_SEC: 0.045,
  HITSTOP_LIGHT_SEC: 0.022,
  MAX_CHARGE_TIER: 3,
  RAM_BASE_DAMAGE: 1,
  WALL_SLAM_BONUS_DAMAGE: 2,
  BOMB_BLAST_RADIUS: 44,
  BOMB_DAMAGE: 3,
  BARREL_BLAST_RADIUS: 48,
  BARREL_DAMAGE: 4,
  BRAKE_SHOCKWAVE_RADIUS: 46,
  EXPLOSIVE_SLAM_RADIUS: 36,
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
  bossShell: '#4f5d8a',
  bossCore: '#ff2e88',
  bossShield: '#8bb8ff',

  barrel: '#ff5238',
  bumper: '#ffd447',
  bulletRed: '#ff2b45',
  bulletCore: '#ffe6ea',

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
} as const;
