import {
  ARENA,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  COMBAT,
  OVERHEAT,
} from './constants.ts';
import type {
  ArcEffect,
  BeamEffect,
  Enemy,
  FloatingText,
  Hazard,
  Particle,
  PlayerState,
  Projectile,
  RingEffect,
  Sawblade,
  Vec2,
  WeaponId,
} from './entities.ts';

export interface AimRenderState {
  active: boolean;
  pullX: number;
  pullY: number;
  pullRatio: number;
  focusRemainingRatio: number;
  slowMoActive: boolean;
  previewPoints: Vec2[];
}

export interface RenderState {
  phase: 'title' | 'playing' | 'transition' | 'draft' | 'gameover';
  player: PlayerState;
  enemies: Enemy[];
  hazards: Hazard[];
  projectiles: Projectile[];
  sawblades: Sawblade[];
  beams: BeamEffect[];
  arcs: ArcEffect[];
  rings: RingEffect[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  roomNumber: number;
  score: number;
  flowMultiplier: number;
  roomTimer: number;
  shakeX: number;
  shakeY: number;
  transitionProgress: number;
  aim: AimRenderState;
  time: number;
}

type SpritePalette = Record<string, string>;

const WEAPON_SHORT_LABELS: Record<WeaponId, string> = {
  railgun: 'RAIL',
  shotgun: 'SHOT',
  sawblade: 'SAW',
  arccoil: 'COIL',
};

const CHARGE_COLORS = [
  COLORS.charge0,
  COLORS.charge1,
  COLORS.charge2,
  COLORS.charge3,
] as const;

// 3x5 compact pixel bitmap font for crisp native 270x480 HUD & floating text
const PIXEL_FONT: Record<string, readonly string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['111', '100', '101', '101', '111'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['111', '101', '101', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  Q: ['111', '101', '101', '111', '001'],
  R: ['111', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  x: ['000', '101', '010', '101', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'],
  '?': ['111', '001', '010', '000', '010'],
  '.': ['000', '000', '000', '000', '010'],
  ',': ['000', '000', '000', '010', '100'],
  ':': ['000', '010', '000', '010', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '%': ['101', '001', '010', '100', '101'],
  '[': ['110', '100', '100', '100', '110'],
  ']': ['011', '001', '001', '001', '011'],
  '(': ['010', '100', '100', '100', '010'],
  ')': ['010', '001', '001', '001', '010'],
  '*': ['101', '010', '111', '010', '101'],
  "'": ['010', '010', '000', '000', '000'],
  _: ['000', '000', '000', '000', '111'],
  ' ': ['000', '000', '000', '000', '000'],
};

const SLIME_SPRITE = [
  '....oooo....',
  '..oobbbboo..',
  '.obhhbbbbbo.',
  '.obbbbbbbbo.',
  'obbeebbbeebo',
  'obbeebbbeebo',
  'obbbbbbbbbbo',
  'oddddddddddo',
  '.oddddddddo.',
  '..oooooooo..',
] as const;

const SPIKE_SLIME_CALM_SPRITE = [
  '....oooo....',
  '..oobbbboo..',
  '.obhhbbbbbo.',
  '.obbbbbbbbo.',
  'obbeebbbeebo',
  'obbeebbbeebo',
  'obbbbbbbbbbo',
  'oddddddddddo',
  '.oddddddddo.',
  '..oooooooo..',
] as const;

const SPIKE_SLIME_WARN_SPRITE = [
  '..s......s..',
  '...oooooo...',
  '.sobhhbbbbs.',
  '.obbbbbbbbo.',
  'sobeebbbeeos',
  'obbeebbbeebo',
  'sobbbbbbbbs.',
  '.oddddddddo.',
  '..sddddddso.',
  '..s.oooo.s..',
] as const;

const SPIKE_SLIME_SPIKED_SPRITE = [
  's.....ss.....s',
  '.ss..oooo..ss.',
  '..sobbbbbbos..',
  '.sobhbbbbbbos.',
  'ssbbeebbbeeoss',
  '.obbeebbbeebo.',
  'sobbbbbbbbbbo.',
  '.obddddddddbos',
  'ssoddddddddos.',
  '.s.ooddddoo.s.',
  '..s..oooo..ss.',
  's.....ss.....s',
] as const;

const SNIPER_BASE_SPRITE = [
  '...oooooo...',
  '..oppppppo..',
  '.opddddddpo.',
  'opdccccccdpo',
  'opdcwwwwcdpo',
  'opdccccccdpo',
  '.opddddddpo.',
  '..oppppppo..',
  '...oooooo...',
] as const;

const BOMB_BOT_SPRITE = [
  '......ff......',
  '.....oooo.....',
  '...oobbbboo...',
  '..obhbbbbbbbo.',
  '.obbbbbbbbbbbo',
  '.obssbbbbssbbo',
  '.obbbbeebbbbbo',
  '.obbbbeebbbbbo',
  '.obssssssssbbo',
  '..odddddddddo.',
  '...ooooooooo..',
] as const;

const DRONE_SPRITE = [
  '.....o.....',
  '....oho....',
  '...ohbho...',
  '..ohbbbho..',
  '.ohbcccbho.',
  'ohbcwwwcbho',
  '.ohbcccbho.',
  '..ohbbbho..',
  '...ohbho...',
  '....oho....',
  '.....o.....',
] as const;

const BARREL_SPRITE = [
  '..oooooooo..',
  '.ohhhhhhhhh.',
  'obbbbbbbbbbo',
  'obssssssssbo',
  'obbbbbbbbbbo',
  'obddddddddbo',
  'obssssssssbo',
  'obddddddddbo',
  '.ohddddddho.',
  '..oooooooo..',
] as const;

const HEART_FULL_SPRITE = [
  '.oo...oo.',
  'orrh.orrho',
  'orrrrorrro',
  'orrrrrrrro',
  '.orrrrrro.',
  '..orrrro..',
  '...orro...',
  '....oo....',
] as const;

const HEART_EMPTY_SPRITE = [
  '.oo...oo.',
  'o..o.o..o',
  'o...o...o',
  'o.......o',
  '.o.....o.',
  '..o...o..',
  '...o.o...',
  '....o....',
] as const;

const SHIELD_FULL_SPRITE = [
  'ooooooo',
  'occccco',
  'ocwwwco',
  'occccco',
  '.occco.',
  '..oco..',
  '...o...',
] as const;

const SHIELD_EMPTY_SPRITE = [
  'ooooooo',
  'o.....o',
  'o.....o',
  'o.....o',
  '.o...o.',
  '..o.o..',
  '...o...',
] as const;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function easeOutCubic(t: number): number {
  const inv = 1 - clamp(t, 0, 1);
  return 1 - inv * inv * inv;
}

function raycastToArena(x: number, y: number, angle: number): Vec2 {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let tMin = 1000;

  if (dx > 0.0001) tMin = Math.min(tMin, (ARENA.right - x) / dx);
  else if (dx < -0.0001) tMin = Math.min(tMin, (ARENA.left - x) / dx);

  if (dy > 0.0001) tMin = Math.min(tMin, (ARENA.bottom - y) / dy);
  else if (dy < -0.0001) tMin = Math.min(tMin, (ARENA.top - y) / dy);

  const t = Math.max(0, tMin);
  return {
    x: x + dx * t,
    y: y + dy * t,
  };
}

export class GameRenderer {
  private drawSprite(
    ctx: CanvasRenderingContext2D,
    sprite: readonly string[],
    palette: SpritePalette,
    cx: number,
    cy: number,
    pixelSize = 1,
    flashWhite = false,
  ): void {
    const rows = sprite.length;
    const cols = sprite[0].length;
    const startX = Math.round(cx - (cols * pixelSize) / 2);
    const startY = Math.round(cy - (rows * pixelSize) / 2);

    for (let r = 0; r < rows; r++) {
      const row = sprite[r];
      for (let c = 0; c < cols; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const color = flashWhite
          ? ch === 'o'
            ? '#ffffff'
            : '#fff5f8'
          : palette[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(
          startX + c * pixelSize,
          startY + r * pixelSize,
          pixelSize,
          pixelSize,
        );
      }
    }
  }

  private drawPixelText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    scale = 1,
    align: 'left' | 'center' | 'right' = 'left',
    shadowColor: string | null = COLORS.voidBg,
  ): void {
    const s = Math.max(1, Math.round(scale));
    const charW = 3 * s;
    const gap = 1 * s;
    const len = text.length;
    if (len === 0) return;

    const totalW = len * charW + (len - 1) * gap;
    let cursorX = Math.round(x);
    if (align === 'center') cursorX = Math.round(x - totalW / 2);
    else if (align === 'right') cursorX = Math.round(x - totalW);
    const baseY = Math.round(y);

    const drawPass = (ox: number, oy: number, fill: string): void => {
      ctx.fillStyle = fill;
      for (let i = 0; i < len; i++) {
        const rawChar = text[i];
        const glyph =
          PIXEL_FONT[rawChar] ?? PIXEL_FONT[rawChar.toUpperCase()] ?? PIXEL_FONT[' '];
        const gx = cursorX + i * (charW + gap) + ox;
        for (let r = 0; r < 5; r++) {
          const row = glyph[r];
          for (let c = 0; c < 3; c++) {
            if (row[c] === '1') {
              ctx.fillRect(gx + c * s, baseY + oy + r * s, s, s);
            }
          }
        }
      }
    };

    if (shadowColor) {
      drawPass(s, s, shadowColor);
    }
    drawPass(0, 0, color);
  }

  private drawPixelCircleFill(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    color: string,
  ): void {
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    const r = Math.max(1, Math.round(radius));
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(ix - span, iy + dy, span * 2 + 1, 1);
    }
  }

  private drawPixelCircleStroke(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    color: string,
    thickness = 1,
  ): void {
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    const rOuter = Math.max(1, Math.round(radius));
    const rInner = Math.max(0, rOuter - thickness);
    const rOuterSq = rOuter * rOuter + rOuter * 0.5;
    const rInnerSq = rInner * rInner - rInner * 0.5;

    ctx.fillStyle = color;
    for (let dy = -rOuter; dy <= rOuter; dy++) {
      for (let dx = -rOuter; dx <= rOuter; dx++) {
        const dSq = dx * dx + dy * dy;
        if (dSq <= rOuterSq && (rInner === 0 || dSq >= rInnerSq)) {
          ctx.fillRect(ix + dx, iy + dy, 1, 1);
        }
      }
    }
  }

  private drawPixelLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    thickness = 1,
  ): void {
    let ix1 = Math.round(x1);
    let iy1 = Math.round(y1);
    const ix2 = Math.round(x2);
    const iy2 = Math.round(y2);
    const dx = Math.abs(ix2 - ix1);
    const dy = Math.abs(iy2 - iy1);
    const sx = ix1 < ix2 ? 1 : -1;
    const sy = iy1 < iy2 ? 1 : -1;
    let err = dx - dy;
    const half = Math.floor(thickness / 2);

    ctx.fillStyle = color;
    while (true) {
      ctx.fillRect(ix1 - half, iy1 - half, thickness, thickness);
      if (ix1 === ix2 && iy1 === iy2) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix1 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy1 += sy;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, state: RenderState): void {
    ctx.imageSmoothingEnabled = false;

    // 1. Clear full canvas with dark void
    ctx.fillStyle = COLORS.voidBg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const shakeX = Math.round(state.shakeX);
    const shakeY = Math.round(state.shakeY);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 2. Dungeon floor & room scroll transition
    const isTransition = state.phase === 'transition';
    const easedTransition = isTransition
      ? easeOutCubic(state.transitionProgress)
      : 1;
    const floorScrollOffset = isTransition
      ? Math.round(easedTransition * ARENA.height)
      : 0;

    this.drawDungeonFloor(ctx, state, floorScrollOffset, isTransition, easedTransition);

    // 3. Dungeon border walls & overheat state
    this.drawDungeonWalls(ctx, state);

    // 4. Prominent Slow-Mo time-dilation overlay inside arena
    if (state.phase === 'playing' && state.aim.slowMoActive) {
      ctx.fillStyle = 'rgba(8, 18, 44, 0.45)';
      ctx.fillRect(ARENA.left, ARENA.top, ARENA.width, ARENA.height);

      // Subtle horizontal CRT / time-dilation scanlines every 4px
      ctx.fillStyle = 'rgba(44, 245, 255, 0.06)';
      for (let y = ARENA.top; y < ARENA.bottom; y += 4) {
        ctx.fillRect(ARENA.left, y, ARENA.width, 1);
      }

      // Crisp 1px pulsing cyan inner border around ARENA
      const borderAlpha = 0.55 + 0.45 * Math.sin(state.time * 16);
      ctx.fillStyle = `rgba(44, 245, 255, ${borderAlpha.toFixed(3)})`;
      ctx.fillRect(ARENA.left, ARENA.top, ARENA.width, 1);
      ctx.fillRect(ARENA.left, ARENA.bottom - 1, ARENA.width, 1);
      ctx.fillRect(ARENA.left, ARENA.top, 1, ARENA.height);
      ctx.fillRect(ARENA.right - 1, ARENA.top, 1, ARENA.height);
    }

    // Clip gameplay entities cleanly inside the arena (with slight wall overlap allowance)
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARENA.left, ARENA.top, ARENA.width, ARENA.height);
    ctx.clip();

    const entityOffsetY = isTransition
      ? -Math.round((1 - easedTransition) * ARENA.height)
      : 0;

    // 5. Hazards (barrels, bumpers)
    for (let i = 0; i < state.hazards.length; i++) {
      this.drawHazard(ctx, state.hazards[i], state.time, entityOffsetY);
    }

    // 6. Ground VFX (rings)
    for (let i = 0; i < state.rings.length; i++) {
      this.drawRing(ctx, state.rings[i]);
    }

    // 7. Sniper aiming lasers (under entities so turrets sit on top)
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.kind === 'sniper') {
        this.drawSniperLaser(ctx, e, state.time, entityOffsetY);
      }
    }

    // 8. Aiming preview & slingshot indicators (under player)
    if (state.aim.active) {
      this.drawAimOverlay(ctx, state.player, state.aim, state.time);
    }

    // 9. Player speed trail
    this.drawPlayerTrail(ctx, state.player);

    // 10. Enemies
    for (let i = 0; i < state.enemies.length; i++) {
      this.drawEnemy(ctx, state.enemies[i], state.time, entityOffsetY);
    }

    // 11. Sawblades
    for (let i = 0; i < state.sawblades.length; i++) {
      this.drawSawblade(ctx, state.sawblades[i]);
    }

    // 12. Player
    this.drawPlayer(ctx, state.player, state.aim, state.time);

    // 13. Projectiles
    for (let i = 0; i < state.projectiles.length; i++) {
      this.drawProjectile(ctx, state.projectiles[i]);
    }

    // 14. Beams & Arcs
    for (let i = 0; i < state.beams.length; i++) {
      this.drawBeam(ctx, state.beams[i]);
    }
    for (let i = 0; i < state.arcs.length; i++) {
      this.drawArc(ctx, state.arcs[i]);
    }

    // 15. Particles & Floating Texts
    for (let i = 0; i < state.particles.length; i++) {
      this.drawParticle(ctx, state.particles[i]);
    }
    for (let i = 0; i < state.floatingTexts.length; i++) {
      this.drawFloatingText(ctx, state.floatingTexts[i]);
    }

    // 16. Boss top HP bar (inside arena top)
    for (let i = 0; i < state.enemies.length; i++) {
      if (state.enemies[i].kind === 'boss') {
        this.drawBossHpBar(ctx, state.enemies[i], entityOffsetY, state.roomNumber);
        break;
      }
    }

    // 17. Overheat countdown / warning banner inside arena
    this.drawOverheatOverlay(ctx, state);

    ctx.restore(); // End arena clip

    ctx.restore(); // End screen shake

    // 18. Crisp Top HUD Strip (unshaken, y: 0..38)
    this.drawTopHud(ctx, state);
  }

  private drawDungeonFloor(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    scrollOffset: number,
    isTransition: boolean,
    easedTransition: number,
  ): void {
    const tile = 20;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARENA.left, ARENA.top, ARENA.width, ARENA.height);
    ctx.clip();

    // Base dark floor
    ctx.fillStyle = COLORS.voidBg;
    ctx.fillRect(ARENA.left, ARENA.top, ARENA.width, ARENA.height);

    // Subtle tiled stone checkerboard & accent cracks
    const startRow = -Math.ceil(scrollOffset / tile) - 1;
    const endRow = Math.ceil(ARENA.height / tile) + 1;
    const cols = Math.ceil(ARENA.width / tile);

    for (let r = startRow; r <= endRow; r++) {
      const py = ARENA.top + r * tile + scrollOffset;
      if (py + tile < ARENA.top || py > ARENA.bottom) continue;

      for (let c = 0; c < cols; c++) {
        const px = ARENA.left + c * tile;
        const checker = ((r + c) & 1) === 0;

        // Subtle stone tile fill
        ctx.fillStyle = checker ? '#0a0d19' : '#080b15';
        ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);

        // Tile grid border lines
        ctx.fillStyle = COLORS.floorGrid;
        ctx.fillRect(px, py, tile, 1);
        ctx.fillRect(px, py, 1, tile);

        // Occasional stone accent studs / cracks
        const hash = Math.abs((r * 73856093) ^ (c * 19349663)) % 11;
        if (hash === 0) {
          ctx.fillStyle = COLORS.floorAccent;
          ctx.fillRect(px + 3, py + 3, 4, 2);
          ctx.fillRect(px + 13, py + 14, 3, 2);
        } else if (hash === 5) {
          ctx.fillStyle = COLORS.floorAccent;
          ctx.fillRect(px + 14, py + 4, 2, 2);
        }
      }
    }

    // Center arena sigil subtle mark
    const sigilY = ARENA.top + Math.round(ARENA.height / 2) + scrollOffset;
    if (sigilY > ARENA.top - 40 && sigilY < ARENA.bottom + 40) {
      this.drawPixelCircleStroke(
        ctx,
        ARENA.left + Math.round(ARENA.width / 2),
        sigilY,
        28,
        COLORS.floorAccent,
        1,
      );
      this.drawPixelCircleStroke(
        ctx,
        ARENA.left + Math.round(ARENA.width / 2),
        sigilY,
        12,
        COLORS.floorGrid,
        1,
      );
    }

    // Room scroll transition doorway threshold & speed streaks
    if (isTransition) {
      const gateY = ARENA.top + scrollOffset;
      // Stone threshold separating new room (above) and previous room (below)
      ctx.fillStyle = COLORS.wallOuter;
      ctx.fillRect(ARENA.left, gateY - 8, ARENA.width, 16);
      ctx.fillStyle = COLORS.wallInner;
      ctx.fillRect(ARENA.left, gateY - 8, ARENA.width, 2);
      ctx.fillRect(ARENA.left, gateY + 6, ARENA.width, 2);

      // Glowing ascending threshold markers
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 16);
      ctx.fillStyle = pulse > 0.5 ? COLORS.textCyan : '#1a6880';
      for (let x = ARENA.left + 12; x < ARENA.right - 12; x += 24) {
        ctx.fillRect(x, gateY - 2, 10, 4);
      }

      // Vertical wind streaks emphasizing upward ascent
      const streakAlpha = 0.28 * Math.sin(easedTransition * Math.PI);
      if (streakAlpha > 0.02) {
        ctx.fillStyle = `rgba(114, 255, 255, ${streakAlpha.toFixed(2)})`;
        for (let i = 0; i < 6; i++) {
          const sx = ARENA.left + 20 + i * 42;
          const sy =
            ARENA.top +
            ((Math.round(easedTransition * 360) + i * 67) % ARENA.height);
          ctx.fillRect(sx, sy, 1, 14);
        }
      }
    }

    // Faint red ambient floor tint during Overheat
    if (
      state.phase === 'playing' &&
      state.roomTimer >= OVERHEAT.OVERHEAT_START_SEC
    ) {
      const pulse = 0.06 + 0.05 * Math.sin(state.time * 10);
      ctx.fillStyle = `rgba(255, 43, 69, ${pulse.toFixed(3)})`;
      ctx.fillRect(ARENA.left, ARENA.top, ARENA.width, ARENA.height);
    }

    ctx.restore();
  }

  private drawDungeonWalls(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
  ): void {
    const isPlaying = state.phase === 'playing';
    const isOverheat =
      isPlaying && state.roomTimer >= OVERHEAT.OVERHEAT_START_SEC;
    const isWarn =
      isPlaying &&
      !isOverheat &&
      state.roomTimer >= OVERHEAT.WARNING_START_SEC;

    const pulseFast = Math.sin(state.time * 14) > 0;
    const pulseMed = Math.sin(state.time * 8) > 0;

    let trimColor: string = COLORS.wallInner;
    if (isOverheat) {
      trimColor = pulseFast ? COLORS.wallOverheat : '#9c162b';
    } else if (isWarn) {
      trimColor = pulseMed ? COLORS.wallOverheatWarn : COLORS.wallInner;
    }

    const wallLeftW = ARENA.left;
    const wallRightW = CANVAS_WIDTH - ARENA.right;
    const wallBottomH = CANVAS_HEIGHT - ARENA.bottom;

    // Outer chunky stone blocks
    ctx.fillStyle = COLORS.wallOuter;
    // Left wall
    ctx.fillRect(0, ARENA.top - 2, wallLeftW, ARENA.height + 4);
    // Right wall
    ctx.fillRect(ARENA.right, ARENA.top - 2, wallRightW, ARENA.height + 4);
    // Top wall lip
    ctx.fillRect(0, ARENA.top - 2, CANVAS_WIDTH, 2);
    // Bottom wall
    ctx.fillRect(0, ARENA.bottom, CANVAS_WIDTH, wallBottomH);

    // Brick seams along side walls
    ctx.fillStyle = '#101529';
    for (let y = ARENA.top; y < ARENA.bottom; y += 16) {
      ctx.fillRect(0, y, wallLeftW - 2, 1);
      ctx.fillRect(ARENA.right + 2, y + 8, wallRightW - 2, 1);
    }
    for (let x = 0; x < CANVAS_WIDTH; x += 18) {
      ctx.fillRect(x, ARENA.bottom + 2, 1, wallBottomH - 2);
    }

    // Inner glowing/stone border trim
    ctx.fillStyle = trimColor;
    ctx.fillRect(ARENA.left - 2, ARENA.top - 2, 2, ARENA.height + 4); // left trim
    ctx.fillRect(ARENA.right, ARENA.top - 2, 2, ARENA.height + 4); // right trim
    ctx.fillRect(ARENA.left - 2, ARENA.top - 2, ARENA.width + 4, 2); // top trim
    ctx.fillRect(ARENA.left - 2, ARENA.bottom, ARENA.width + 4, 2); // bottom trim

    // Overheat hazard chevrons along walls
    if (isOverheat) {
      const chevronColor = pulseFast ? '#ffd447' : COLORS.wallOverheat;
      ctx.fillStyle = chevronColor;
      const scroll = Math.floor(state.time * 24) % 12;
      for (let y = ARENA.top + scroll; y < ARENA.bottom - 4; y += 12) {
        ctx.fillRect(2, y, 5, 3);
        ctx.fillRect(ARENA.right + 3, y, 5, 3);
      }
      for (let x = ARENA.left + scroll; x < ARENA.right - 4; x += 12) {
        ctx.fillRect(x, ARENA.bottom + 4, 5, 4);
      }
    }
  }

  private drawOverheatOverlay(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
  ): void {
    if (state.phase !== 'playing') return;

    if (state.roomTimer >= OVERHEAT.OVERHEAT_START_SEC) {
      if (Math.sin(state.time * 12) > -0.3) {
        this.drawPixelText(
          ctx,
          'OVERHEAT!',
          CANVAS_WIDTH / 2,
          ARENA.bottom - 14,
          COLORS.wallOverheat,
          1,
          'center',
        );
      }
    } else if (state.roomTimer >= OVERHEAT.WARNING_START_SEC) {
      const secs = Math.max(
        1,
        Math.ceil(OVERHEAT.OVERHEAT_START_SEC - state.roomTimer),
      );
      const col =
        Math.sin(state.time * 10) > 0 ? COLORS.wallOverheatWarn : '#ffe08a';
      this.drawPixelText(
        ctx,
        `OVERHEAT IN ${secs}`,
        CANVAS_WIDTH / 2,
        ARENA.bottom - 14,
        col,
        1,
        'center',
      );
    }
  }

  private drawHazard(
    ctx: CanvasRenderingContext2D,
    h: Hazard,
    time: number,
    offsetY: number,
  ): void {
    const hx = Math.round(h.x);
    const hy = Math.round(h.y + offsetY);

    if (h.kind === 'barrel') {
      const palette: SpritePalette = {
        o: '#07080f',
        h: '#ff8a6b',
        b: COLORS.barrel,
        d: '#a62317',
        s: COLORS.textGold,
      };
      this.drawSprite(ctx, BARREL_SPRITE, palette, hx, hy, 1, h.triggered);
      return;
    }

    // Bumper: glowing gold/cyan pinball bumper ring
    const pulseAmt = h.pulseTimer > 0 ? Math.min(1, h.pulseTimer * 6) : 0;
    const outerR = Math.round(h.radius + pulseAmt * 3);
    const innerR = Math.max(4, outerR - 4);
    const idlePulse = Math.sin(time * 5 + h.id) > 0;

    this.drawPixelCircleFill(ctx, hx, hy, outerR + 1, '#07080f');
    this.drawPixelCircleFill(
      ctx,
      hx,
      hy,
      outerR,
      pulseAmt > 0.2 ? '#ffffff' : COLORS.bumper,
    );
    this.drawPixelCircleFill(ctx, hx, hy, innerR, '#162040');
    this.drawPixelCircleFill(
      ctx,
      hx,
      hy,
      Math.max(2, innerR - 3),
      pulseAmt > 0.2 || idlePulse ? COLORS.textCyan : '#1a9fb5',
    );
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - 1, hy - 1, 2, 2);
  }

  private drawSniperLaser(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    time: number,
    offsetY: number,
  ): void {
    if (enemy.sniperState !== 'tracking' && enemy.sniperState !== 'locked') {
      return;
    }

    const ex = enemy.x;
    const ey = enemy.y + offsetY;
    const isLocked = enemy.sniperState === 'locked';
    const fanOffset = (9 * Math.PI) / 180;
    const angles = enemy.isFanShot
      ? [enemy.angle, enemy.angle - fanOffset, enemy.angle + fanOffset]
      : [enemy.angle];
    const flash = Math.sin(time * 28) > 0;

    for (let i = 0; i < angles.length; i++) {
      const end = raycastToArena(ex, ey, angles[i]);
      if (isLocked) {
        const lineColor =
          i === 0
            ? flash
              ? '#ff8596'
              : COLORS.sniperLaser
            : flash
              ? COLORS.sniperLaser
              : '#c91c34';
        this.drawPixelLine(ctx, ex, ey, end.x, end.y, lineColor, 1);
      } else {
        // Faint dotted red tracking laser
        const dx = end.x - ex;
        const dy = end.y - ey;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;
        const ux = dx / dist;
        const uy = dy / dist;
        ctx.fillStyle =
          i === 0 ? 'rgba(255, 43, 69, 0.55)' : 'rgba(255, 43, 69, 0.3)';
        for (let d = 8; d < dist; d += 6) {
          ctx.fillRect(Math.round(ex + ux * d), Math.round(ey + uy * d), 1, 1);
        }
      }
    }
  }

  private drawEnemy(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    time: number,
    offsetY: number,
  ): void {
    const ex = Math.round(enemy.x);
    const ey = Math.round(enemy.y + offsetY);
    const flashWhite = enemy.hitFlash > 0;

    // Subtle knockback slam indicator ring
    if (enemy.slammedTimer > 0) {
      this.drawPixelCircleStroke(
        ctx,
        ex,
        ey,
        Math.round(enemy.radius + 2),
        COLORS.textGold,
        1,
      );
    }

    switch (enemy.kind) {
      case 'slime': {
        const bobY = Math.round(Math.sin(time * 7 + enemy.id) * 1);
        const palette: SpritePalette = {
          o: '#07080f',
          b: COLORS.slime,
          h: '#a8ffcf',
          d: COLORS.slimeDark,
          e: '#07080f',
        };
        this.drawSprite(ctx, SLIME_SPRITE, palette, ex, ey + bobY, 1, flashWhite);

        // Pre-shot mouth/core telegraph when about to spit an orb
        if (
          enemy.canShoot &&
          enemy.fireTimer !== undefined &&
          enemy.fireTimer <= 0.45
        ) {
          const spitBlink = Math.sin(time * 28) > 0;
          ctx.fillStyle = '#07080f';
          ctx.fillRect(ex - 2, ey + bobY, 4, 4);
          ctx.fillStyle = COLORS.bulletRed;
          ctx.fillRect(ex - 2, ey + bobY + 1, 4, 2);
          ctx.fillStyle = spitBlink ? '#ffffff' : COLORS.bulletCore;
          ctx.fillRect(ex - 1, ey + bobY + 1, 2, 2);
        }
        break;
      }

      case 'spike_slime': {
        const state = enemy.spikeState ?? 'calm';
        if (state === 'calm') {
          const palette: SpritePalette = {
            o: '#07080f',
            b: COLORS.spikeCalm,
            h: '#9effc8',
            d: '#187043',
            e: '#07080f',
          };
          this.drawSprite(
            ctx,
            SPIKE_SLIME_CALM_SPRITE,
            palette,
            ex,
            ey,
            1,
            flashWhite,
          );
        } else if (state === 'telegraph') {
          const warnBlink = Math.sin(time * 24) > 0;
          const palette: SpritePalette = {
            o: '#07080f',
            b: warnBlink ? COLORS.spikeWarn : '#ffaa2e',
            h: '#fff2b0',
            d: '#99640c',
            e: '#07080f',
            s: warnBlink ? '#ffffff' : COLORS.spikeWarn,
          };
          this.drawSprite(
            ctx,
            SPIKE_SLIME_WARN_SPRITE,
            palette,
            ex,
            ey,
            1,
            flashWhite,
          );

          // 4 directional crimson spike-bolt telegraph pips (+ if even parity, x if odd)
          const baseAngle =
            (enemy.spikePhaseParity ?? 0) % 2 === 0 ? 0 : Math.PI / 4;
          const pipR = Math.round(enemy.radius) + 4;
          const pipBlink = Math.sin(time * 28) > 0;
          for (let i = 0; i < 4; i++) {
            const ang = baseAngle + i * (Math.PI / 2);
            const cos = Math.cos(ang);
            const sin = Math.sin(ang);
            const tx = Math.round(ex + cos * pipR);
            const ty = Math.round(ey + sin * pipR);
            const ox = Math.round(ex + cos * (pipR + 2));
            const oy = Math.round(ey + sin * (pipR + 2));
            ctx.fillStyle = '#07080f';
            ctx.fillRect(tx - 1, ty - 1, 3, 3);
            this.drawPixelLine(ctx, tx, ty, ox, oy, COLORS.bulletRed, 2);
            ctx.fillStyle = pipBlink ? '#ffffff' : COLORS.bulletCore;
            ctx.fillRect(tx, ty, 1, 1);
          }
        } else {
          const palette: SpritePalette = {
            o: '#07080f',
            b: COLORS.spikeRed,
            h: '#ff96a3',
            d: '#8a0f21',
            e: '#ffe6ea',
            s: '#ffffff',
          };
          this.drawSprite(
            ctx,
            SPIKE_SLIME_SPIKED_SPRITE,
            palette,
            ex,
            ey,
            1,
            flashWhite,
          );
        }
        break;
      }

      case 'sniper': {
        const isLocked = enemy.sniperState === 'locked';
        const palette: SpritePalette = {
          o: '#07080f',
          p: COLORS.sniper,
          d: '#4f2080',
          c: isLocked ? COLORS.spikeRed : '#ff4d6d',
          w: isLocked ? '#ffffff' : '#ffd6e0',
        };
        this.drawSprite(
          ctx,
          SNIPER_BASE_SPRITE,
          palette,
          ex,
          ey,
          1,
          flashWhite,
        );

        // Rotating pixel barrel along enemy.angle
        const bx = ex + Math.cos(enemy.angle) * 9;
        const by = ey + Math.sin(enemy.angle) * 9;
        this.drawPixelLine(ctx, ex, ey, bx, by, '#07080f', 4);
        this.drawPixelLine(
          ctx,
          ex,
          ey,
          bx,
          by,
          flashWhite ? '#ffffff' : '#d29eff',
          2,
        );

        // Bright flash telegraph at muzzle when locked
        if (isLocked && Math.sin(time * 30) > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 4, 4);
          ctx.fillStyle = COLORS.sniperLaser;
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
        }
        break;
      }

      case 'bomb_bot': {
        // stateTimer typically counts down toward 0 or up; support fast blinking either way
        const urgency = clamp(1 - enemy.stateTimer / 3, 0, 1);
        const blinkRate = 8 + urgency * 24;
        const blink = Math.sin(time * blinkRate) > 0;

        // Faint danger ring when armed/ticking
        if (enemy.stateTimer > 0 || urgency > 0.2) {
          const ringColor = blink
            ? 'rgba(255, 43, 69, 0.36)'
            : 'rgba(255, 140, 46, 0.22)';
          this.drawPixelCircleStroke(
            ctx,
            ex,
            ey,
            COMBAT.BOMB_BLAST_RADIUS,
            ringColor,
            1,
          );
        }

        const palette: SpritePalette = {
          o: '#07080f',
          b: blink ? '#ff4e2e' : COLORS.bombBot,
          h: '#ffd185',
          d: '#8a2b10',
          s: '#30395c',
          e: blink ? '#ffffff' : '#ff2b45',
          f: blink ? '#ffffff' : '#ffd447',
        };
        this.drawSprite(ctx, BOMB_BOT_SPRITE, palette, ex, ey, 1, flashWhite);

        // Extra blinking fuse sparks above head
        if (blink) {
          ctx.fillStyle = '#ffd447';
          ctx.fillRect(ex - 2, ey - 7, 1, 1);
          ctx.fillRect(ex + 2, ey - 7, 1, 1);
        }
        break;
      }

      case 'drone': {
        this.drawDrone(ctx, enemy, time, offsetY);
        break;
      }

      case 'boss': {
        this.drawBoss(ctx, enemy, time, offsetY);
        break;
      }
    }

    // Small crisp HP bar above damaged non-boss multi-HP enemies
    if (enemy.kind !== 'boss' && enemy.maxHp > 1 && enemy.hp < enemy.maxHp) {
      const barW = 14;
      const bx = ex - Math.round(barW / 2);
      const by = ey - Math.round(enemy.radius) - 6;
      const fillW = Math.max(1, Math.round((enemy.hp / enemy.maxHp) * barW));
      ctx.fillStyle = '#07080f';
      ctx.fillRect(bx - 1, by - 1, barW + 2, 4);
      ctx.fillStyle = '#252b48';
      ctx.fillRect(bx, by, barW, 2);
      ctx.fillStyle = COLORS.spikeRed;
      ctx.fillRect(bx, by, fillW, 2);
    }
  }

  private drawDrone(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    time: number,
    offsetY: number,
  ): void {
    const ex = Math.round(enemy.x);
    const ey = Math.round(enemy.y + offsetY);
    const r = Math.max(6, Math.round(enemy.radius));
    const flashWhite = enemy.hitFlash > 0;
    const isTelegraphing =
      enemy.fireTimer !== undefined && enemy.fireTimer <= 0.5;

    // Pulsing crimson telegraph ring before firing
    if (isTelegraphing) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 26);
      const ringR = r + 3 + (pulse > 0.5 ? 1 : 0);
      ctx.save();
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      this.drawPixelCircleStroke(
        ctx,
        ex,
        ey,
        ringR,
        pulse > 0.75 ? '#ff7084' : COLORS.bulletRed,
        1,
      );
      ctx.restore();
    }

    // Outer orbital ring with dark outline
    this.drawPixelCircleStroke(ctx, ex, ey, r + 1, '#07080f', 2);
    this.drawPixelCircleStroke(
      ctx,
      ex,
      ey,
      r,
      flashWhite ? '#ffffff' : isTelegraphing ? COLORS.bulletRed : '#7d1e42',
      1,
    );

    // Chunky diamond core sprite
    const blink = Math.sin(time * 28) > 0;
    const palette: SpritePalette = {
      o: '#07080f',
      b: COLORS.drone,
      h: '#ff9ebb',
      d: '#8f1b43',
      c: isTelegraphing ? COLORS.bulletRed : '#ff2e88',
      w: isTelegraphing && blink ? '#ffffff' : '#ffe6f0',
    };
    this.drawSprite(ctx, DRONE_SPRITE, palette, ex, ey, 1, flashWhite);

    // Rotating orbital emitter pips around enemy.angle
    for (let i = 0; i < 4; i++) {
      const pipAngle = enemy.angle + i * (Math.PI / 2);
      const px = Math.round(ex + Math.cos(pipAngle) * r);
      const py = Math.round(ey + Math.sin(pipAngle) * r);
      ctx.fillStyle = '#07080f';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.fillStyle = flashWhite
        ? '#ffffff'
        : isTelegraphing
          ? COLORS.bulletRed
          : COLORS.drone;
      ctx.fillRect(px - 1, py - 1, 2, 2);
      if (isTelegraphing || i === 0) {
        ctx.fillStyle = isTelegraphing && blink ? '#ffffff' : '#ffd6e6';
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  private drawBoss(
    ctx: CanvasRenderingContext2D,
    boss: Enemy,
    time: number,
    offsetY: number,
  ): void {
    const bx = Math.round(boss.x);
    const by = Math.round(boss.y + offsetY);
    const r = Math.round(boss.radius);
    const flashWhite = boss.hitFlash > 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * 9);
    const shieldSpan = COMBAT.BOSS_SHIELD_HALF_ANGLE_RAD;

    // 0. Clear slow-mo readable telegraphs for Boss attacks
    if (boss.bossPhase === 1) {
      const pat = boss.bossPattern ?? 0;
      const flashSoon = boss.stateTimer <= 0.22;
      if (pat === 1) {
        // Aimed 5-Way Fan telegraph cone (-26°, 0°, +26° along telegraphAngle)
        const aimAngle = boss.telegraphAngle ?? boss.angle;
        const halfCone = (26 * Math.PI) / 180;
        const conePulse = flashSoon ? 0.92 : 0.52 + 0.28 * Math.sin(time * 22);
        ctx.save();
        ctx.globalAlpha = conePulse;
        ctx.fillStyle = flashSoon ? '#ffffff' : COLORS.bulletRed;
        for (const offset of [-halfCone, 0, halfCone] as const) {
          const end = raycastToArena(bx, by, aimAngle + offset);
          const dx = end.x - bx;
          const dy = end.y - by;
          const dist = Math.hypot(dx, dy);
          if (dist <= r + 5) continue;
          const ux = dx / dist;
          const uy = dy / dist;
          for (let d = r + 5; d < dist; d += 5) {
            ctx.fillRect(Math.round(bx + ux * d), Math.round(by + uy * d), 2, 2);
          }
        }
        ctx.restore();
      } else {
        // Pulsing crimson outer ring telegraph for Spiral / Cross-Ring Barrage
        const ringPulse = 0.55 + 0.4 * Math.sin(time * 24);
        ctx.save();
        ctx.globalAlpha = ringPulse;
        this.drawPixelCircleStroke(
          ctx,
          bx,
          by,
          r + 8 + Math.round(pulse * 2),
          flashSoon ? '#ffffff' : COLORS.bulletRed,
          1,
        );
        ctx.restore();
      }
    }

    // 1. Wide exposed magenta rear/flank weakspot glow (264-degree unshielded arc)
    const flankStart = boss.angle + shieldSpan + 0.08;
    const flankEnd = boss.angle + Math.PI * 2 - shieldSpan - 0.08;
    const exposedSteps = 32;
    const weakRimR = r + 2;
    for (let i = 0; i <= exposedSteps; i++) {
      const ang = flankStart + (i / exposedSteps) * (flankEnd - flankStart);
      const wx = Math.round(bx + Math.cos(ang) * weakRimR);
      const wy = Math.round(by + Math.sin(ang) * weakRimR);
      ctx.fillStyle = '#07080f';
      ctx.fillRect(wx - 2, wy - 2, 4, 4);
      ctx.fillStyle = i % 2 === 0 || pulse > 0.5 ? COLORS.bossCore : '#b01c61';
      ctx.fillRect(wx - 1, wy - 1, 2, 2);
      if (i % 4 === 0 && pulse > 0.45) {
        ctx.fillStyle = '#ffa6cf';
        ctx.fillRect(wx, wy, 1, 1);
      }
    }

    // Exposed flank weakspot nodes (~108° off-axis on both sides)
    for (const side of [-1, 1] as const) {
      const flankAngle = boss.angle + side * Math.PI * 0.6;
      const fx = bx + Math.cos(flankAngle) * (r - 1);
      const fy = by + Math.sin(flankAngle) * (r - 1);
      const flankR = pulse > 0.5 ? 6 : 5;
      this.drawPixelCircleFill(ctx, fx, fy, flankR + 1, '#07080f');
      this.drawPixelCircleFill(ctx, fx, fy, flankR, '#8c1248');
      this.drawPixelCircleFill(ctx, fx, fy, Math.max(3, flankR - 2), COLORS.bossCore);
      this.drawPixelCircleFill(
        ctx,
        fx,
        fy,
        2,
        pulse > 0.6 ? '#ffffff' : '#ffa6cf',
      );
    }

    // Main rear weak spot glow opposite boss.angle
    const rearAngle = boss.angle + Math.PI;
    const rearX = bx + Math.cos(rearAngle) * (r - 2);
    const rearY = by + Math.sin(rearAngle) * (r - 2);
    const rearGlowR = pulse > 0.5 ? 10 : 8;
    this.drawPixelCircleFill(ctx, rearX, rearY, rearGlowR + 1, '#07080f');
    this.drawPixelCircleFill(ctx, rearX, rearY, rearGlowR, '#8c1248');
    this.drawPixelCircleFill(
      ctx,
      rearX,
      rearY,
      Math.max(4, rearGlowR - 2),
      COLORS.bossCore,
    );
    this.drawPixelCircleFill(
      ctx,
      rearX,
      rearY,
      3,
      pulse > 0.6 ? '#ffffff' : '#ffa6cf',
    );

    // 2. Large ~40x40 Mecha Core chassis
    this.drawPixelCircleFill(ctx, bx, by, r + 1, '#07080f');
    this.drawPixelCircleFill(
      ctx,
      bx,
      by,
      r,
      flashWhite ? '#ffffff' : '#2b3454',
    );
    this.drawPixelCircleFill(
      ctx,
      bx,
      by,
      Math.max(6, r - 4),
      flashWhite ? '#ffe6f0' : COLORS.bossShell,
    );

    // Pixel armor seams & vents on chassis
    ctx.fillStyle = '#1b2238';
    ctx.fillRect(bx - r + 4, by - 1, r * 2 - 8, 2);
    ctx.fillRect(bx - 1, by - r + 4, 2, r * 2 - 8);

    // Corner armor rivets
    const rivetOff = Math.round(r * 0.48);
    ctx.fillStyle = '#8091c4';
    ctx.fillRect(bx - rivetOff, by - rivetOff, 2, 2);
    ctx.fillRect(bx + rivetOff - 2, by - rivetOff, 2, 2);
    ctx.fillRect(bx - rivetOff, by + rivetOff - 2, 2, 2);
    ctx.fillRect(bx + rivetOff - 2, by + rivetOff - 2, 2, 2);

    // Phase 2 subtle pulsing crimson overdrive aura around the Boss core
    if (boss.hp <= boss.maxHp * 0.5) {
      const overdrivePulse = 0.5 + 0.5 * Math.sin(time * 16);
      const auraR = 8 + Math.round(overdrivePulse * 2);
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.35 * overdrivePulse;
      this.drawPixelCircleStroke(ctx, bx, by, auraR, COLORS.bulletRed, 1);
      ctx.restore();
    }

    // Center reactor eye
    this.drawPixelCircleFill(ctx, bx, by, 6, '#07080f');
    this.drawPixelCircleFill(
      ctx,
      bx,
      by,
      5,
      boss.bossPhase === 1 ? COLORS.spikeRed : COLORS.bossCore,
    );
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 1, by - 1, 2, 2);

    // 3. Narrower glowing FRONTAL SHIELD ARC along boss.angle (48° half-angle, 96° total)
    const shieldInner = r + 1;
    const shieldOuter = r + 6;
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const ang = boss.angle - shieldSpan + frac * shieldSpan * 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);

      // Dark pixel outline behind segment
      const ox = Math.round(bx + cos * (shieldOuter + 1));
      const oy = Math.round(by + sin * (shieldOuter + 1));
      ctx.fillStyle = '#07080f';
      ctx.fillRect(ox - 2, oy - 2, 4, 4);

      // Metallic segmented plates (small visual bevel every few steps)
      const isSeam = i % 4 === 0 || i === steps;
      const midR = (shieldInner + shieldOuter) * 0.5;
      const sx = Math.round(bx + cos * midR);
      const sy = Math.round(by + sin * midR);
      ctx.fillStyle = flashWhite
        ? '#ffffff'
        : isSeam
          ? '#466199'
          : COLORS.bossShield;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);

      // Outer cyan-white shield rim highlight
      const hx = Math.round(bx + cos * shieldOuter);
      const hy = Math.round(by + sin * shieldOuter);
      ctx.fillStyle = isSeam ? COLORS.bossShield : '#e6f4ff';
      ctx.fillRect(hx - 1, hy - 1, 2, 2);
    }

    // 4. Pulsing chevron indicators pointing to exposed rear & flank weakspots
    const markerDist = r + 11 + Math.round(pulse * 2);
    const mx = Math.round(bx + Math.cos(rearAngle) * markerDist);
    const my = Math.round(by + Math.sin(rearAngle) * markerDist);
    ctx.fillStyle = pulse > 0.5 ? '#ffffff' : COLORS.bossCore;
    ctx.fillRect(mx - 1, my - 1, 3, 3);

    for (const side of [-1, 1] as const) {
      const flankAngle = boss.angle + side * Math.PI * 0.6;
      const fmx = Math.round(bx + Math.cos(flankAngle) * (markerDist - 2));
      const fmy = Math.round(by + Math.sin(flankAngle) * (markerDist - 2));
      ctx.fillStyle = pulse > 0.5 ? '#ffa6cf' : COLORS.bossCore;
      ctx.fillRect(fmx - 1, fmy - 1, 2, 2);
    }
  }

  private drawBossHpBar(
    ctx: CanvasRenderingContext2D,
    boss: Enemy,
    offsetY: number,
    roomNumber: number,
  ): void {
    const barW = ARENA.width - 36;
    const barX = ARENA.left + 18;
    const barY = ARENA.top + 8 + Math.round(offsetY * 0.2);
    const hpRatio = clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1);
    const tier = Math.floor(roomNumber / 5);
    const label = tier > 1 ? `ARMORED CORE MK.${tier}` : 'ARMORED CORE';

    this.drawPixelText(
      ctx,
      label,
      CANVAS_WIDTH / 2,
      barY - 6,
      COLORS.bossShield,
      1,
      'center',
    );

    ctx.fillStyle = '#07080f';
    ctx.fillRect(barX - 2, barY - 1, barW + 4, 8);
    ctx.fillStyle = '#261428';
    ctx.fillRect(barX, barY + 1, barW, 4);

    const fillW = Math.round(barW * hpRatio);
    if (fillW > 0) {
      ctx.fillStyle = COLORS.bossCore;
      ctx.fillRect(barX, barY + 1, fillW, 4);
      ctx.fillStyle = '#ff94c6';
      ctx.fillRect(barX, barY + 1, fillW, 1);
    }

    // Segmented tick marks
    ctx.fillStyle = '#07080f';
    for (let sx = barX + 20; sx < barX + barW; sx += 20) {
      ctx.fillRect(sx, barY + 1, 1, 4);
    }
  }

  private drawPlayerTrail(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
  ): void {
    const trail = player.trail;
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i];
      const lifeRatio = clamp(pt.life / Math.max(0.001, pt.maxLife), 0, 1);
      const tier = clamp(Math.round(pt.tier), 0, 3);
      const baseColor = CHARGE_COLORS[tier];
      const maxSize = 3 + tier * 2;
      const size = Math.max(1, Math.round(maxSize * lifeRatio));
      const px = Math.round(pt.x - size / 2);
      const py = Math.round(pt.y - size / 2);

      ctx.save();
      ctx.globalAlpha = lifeRatio * (0.35 + tier * 0.18);
      ctx.fillStyle = baseColor;
      ctx.fillRect(px, py, size, size);

      if (tier >= 2 && size >= 3) {
        ctx.fillStyle = COLORS.playerCore;
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 1, 1);
      }
      ctx.restore();
    }
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    aim: AimRenderState,
    time: number,
  ): void {
    const px = Math.round(player.x);
    const py = Math.round(player.y);
    const r = Math.round(player.radius);
    const tier = clamp(Math.round(player.chargeTier), 0, 3);
    const chargeColor = CHARGE_COLORS[tier];

    // Blink during iframes
    const iframeBlink =
      player.iframes > 0 && Math.floor(time * 22) % 2 === 0;
    const hitFlash = player.flashTimer > 0;

    // Charge aura ring for tier >= 2
    if (tier >= 2) {
      const auraR = r + 3 + (Math.sin(time * 12) > 0 ? 1 : 0);
      this.drawPixelCircleStroke(ctx, px, py, auraR, chargeColor, 1);
    }

    // Armored vs Vulnerable pixel outline
    const outlineColor = hitFlash
      ? '#ffffff'
      : player.armored
        ? COLORS.playerArmored
        : COLORS.playerVulnerable;
    const bodyColor = hitFlash
      ? '#ffffff'
      : iframeBlink
        ? '#1d5669'
        : player.armored
          ? COLORS.playerBody
          : '#325a7a';
    const coreColor = hitFlash
      ? '#ffffff'
      : iframeBlink
        ? COLORS.playerArmored
        : COLORS.playerCore;

    // Dark backdrop border for crisp contrast
    this.drawPixelCircleFill(ctx, px, py, r + 2, '#07080f');
    // Armored / Vulnerable status ring
    this.drawPixelCircleFill(ctx, px, py, r + 1, outlineColor);
    // Main player disc
    this.drawPixelCircleFill(ctx, px, py, r - 1, bodyColor);
    // Bright pixel core
    this.drawPixelCircleFill(ctx, px, py, Math.max(2, r - 4), coreColor);

    // Orbiting Charge Pips (0..3)
    if (tier > 0) {
      const orbitR = r + 5;
      const baseAngle = time * (3.5 + tier * 1.2);
      for (let i = 0; i < tier; i++) {
        const ang = baseAngle + (i * Math.PI * 2) / tier;
        const ox = Math.round(px + Math.cos(ang) * orbitR);
        const oy = Math.round(py + Math.sin(ang) * orbitR);
        ctx.fillStyle = '#07080f';
        ctx.fillRect(ox - 2, oy - 2, 4, 4);
        ctx.fillStyle = chargeColor;
        ctx.fillRect(ox - 1, oy - 1, 2, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox, oy, 1, 1);
      }
    }

    // Nose Directional Chevron along (aimDirX, aimDirY)
    const dirLen = Math.hypot(player.aimDirX, player.aimDirY);
    const dx = dirLen > 0.001 ? player.aimDirX / dirLen : 0;
    const dy = dirLen > 0.001 ? player.aimDirY / dirLen : -1;
    const perpX = -dy;
    const perpY = dx;

    const tipDist = r + 6;
    const baseDist = r + 2;
    const tipX = player.x + dx * tipDist;
    const tipY = player.y + dy * tipDist;
    const leftX = player.x + dx * baseDist + perpX * 3;
    const leftY = player.y + dy * baseDist + perpY * 3;
    const rightX = player.x + dx * baseDist - perpX * 3;
    const rightY = player.y + dy * baseDist - perpY * 3;

    const chevronColor = player.armored
      ? '#ffffff'
      : aim.active
        ? 'rgba(114, 255, 255, 0.75)'
        : COLORS.playerArmored;

    this.drawPixelLine(ctx, leftX, leftY, tipX, tipY, '#07080f', 2);
    this.drawPixelLine(ctx, rightX, rightY, tipX, tipY, '#07080f', 2);
    this.drawPixelLine(ctx, leftX, leftY, tipX, tipY, chevronColor, 1);
    this.drawPixelLine(ctx, rightX, rightY, tipX, tipY, chevronColor, 1);
  }

  private drawAimOverlay(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    aim: AimRenderState,
    time: number,
  ): void {
    const px = player.x;
    const py = player.y;

    // 1. Shrinking radial Focus Ring centered around player
    const focus = clamp(aim.focusRemainingRatio, 0, 1);
    const focusColor =
      focus > 0.5
        ? COLORS.textCyan
        : focus > 0.25
          ? COLORS.textGold
          : Math.sin(time * 24) > 0
            ? COLORS.wallOverheat
            : '#ff8a96';

    const ringRadius = Math.round(
      aim.slowMoActive ? 17 + focus * 6 : 14 + focus * 5,
    );
    const segments = 24;
    const activeSegs = focus <= 0.001 ? 0 : Math.max(1, Math.round(focus * segments));

    // Faint background ring track
    this.drawPixelCircleStroke(
      ctx,
      px,
      py,
      ringRadius,
      aim.slowMoActive ? 'rgba(44, 245, 255, 0.25)' : 'rgba(127, 139, 176, 0.22)',
      1,
    );

    // Subtle secondary inner pulse ring during Slow-Mo
    if (aim.slowMoActive) {
      const pulseStep = Math.sin(time * 18) > 0 ? 1 : 0;
      const innerR = Math.max(10, ringRadius - 4 - pulseStep);
      const innerAlpha = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(time * 18));
      this.drawPixelCircleStroke(
        ctx,
        px,
        py,
        innerR,
        `rgba(44, 245, 255, ${innerAlpha.toFixed(3)})`,
        1,
      );
    }

    // Active Focus arc pixels (bold 3x3 / 2x2 segments when slowMoActive)
    if (aim.slowMoActive) {
      ctx.fillStyle = '#07080f';
      for (let i = 0; i < activeSegs; i++) {
        const a0 = -Math.PI / 2 + (i / segments) * Math.PI * 2;
        const a1 = -Math.PI / 2 + ((i + 0.65) / segments) * Math.PI * 2;
        const x0 = Math.round(px + Math.cos(a0) * ringRadius);
        const y0 = Math.round(py + Math.sin(a0) * ringRadius);
        const x1 = Math.round(px + Math.cos(a1) * ringRadius);
        const y1 = Math.round(py + Math.sin(a1) * ringRadius);
        ctx.fillRect(x0 - 2, y0 - 2, 4, 4);
        ctx.fillRect(x1 - 1, y1 - 1, 3, 3);
      }
    }

    ctx.fillStyle = focusColor;
    for (let i = 0; i < activeSegs; i++) {
      const a0 = -Math.PI / 2 + (i / segments) * Math.PI * 2;
      const a1 = -Math.PI / 2 + ((i + 0.65) / segments) * Math.PI * 2;
      const x0 = Math.round(px + Math.cos(a0) * ringRadius);
      const y0 = Math.round(py + Math.sin(a0) * ringRadius);
      const x1 = Math.round(px + Math.cos(a1) * ringRadius);
      const y1 = Math.round(py + Math.sin(a1) * ringRadius);
      if (aim.slowMoActive) {
        ctx.fillRect(x0 - 1, y0 - 1, 3, 3);
        ctx.fillRect(x1 - 1, y1 - 1, 2, 2);
      } else {
        ctx.fillRect(x0 - 1, y0 - 1, 2, 2);
        ctx.fillRect(x1 - 1, y1 - 1, 2, 2);
      }
    }

    // Crisp 0.2x pixel tag just below/above the Focus Ring while slow-mo is active
    if (aim.slowMoActive) {
      const tagX = clamp(Math.round(px), ARENA.left + 12, ARENA.right - 12);
      const tagY =
        py + ringRadius + 10 < ARENA.bottom - 2
          ? Math.round(py + ringRadius + 4)
          : Math.round(py - ringRadius - 9);
      this.drawPixelText(ctx, '0.2x', tagX, tagY, COLORS.textCyan, 1, 'center');
    }

    // 2. Dotted raycast trajectory preview along aim.previewPoints
    const pts = aim.previewPoints;
    if (pts.length >= 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLen = Math.hypot(dx, dy);
        if (segLen < 1) continue;
        const ux = dx / segLen;
        const uy = dy / segLen;

        const isBounce = i > 0;
        const dotColor = isBounce
          ? 'rgba(255, 212, 71, 0.85)'
          : 'rgba(114, 255, 255, 0.9)';

        for (let d = i === 0 ? 10 : 4; d < segLen - 2; d += 6) {
          const sx = Math.round(a.x + ux * d);
          const sy = Math.round(a.y + uy * d);
          ctx.fillStyle = dotColor;
          ctx.fillRect(sx, sy, 2, 2);
        }

        // Bounce node marker at intermediate wall reflections
        if (i < pts.length - 2) {
          const bx = Math.round(b.x);
          const by = Math.round(b.y);
          ctx.fillStyle = '#07080f';
          ctx.fillRect(bx - 3, by - 3, 6, 6);
          ctx.fillStyle = COLORS.textGold;
          ctx.fillRect(bx - 2, by, 5, 1);
          ctx.fillRect(bx, by - 2, 1, 5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx, by, 1, 1);
        }
      }

      // Endpoint reticle
      const last = pts[pts.length - 1];
      const lx = Math.round(last.x);
      const ly = Math.round(last.y);
      ctx.fillStyle = COLORS.textCyan;
      ctx.fillRect(lx - 1, ly - 1, 3, 3);
    }

    // 3. Virtual pullback indicator centered around player (opposite launch vector)
    const pullRatio = clamp(aim.pullRatio, 0, 1);
    let backX = 0;
    let backY = 0;

    if (pts.length >= 2) {
      const ldx = pts[1].x - pts[0].x;
      const ldy = pts[1].y - pts[0].y;
      const lLen = Math.hypot(ldx, ldy);
      if (lLen > 0.001) {
        backX = -ldx / lLen;
        backY = -ldy / lLen;
      }
    }

    if (backX === 0 && backY === 0) {
      const pm = Math.hypot(aim.pullX, aim.pullY);
      if (pm > 0.001) {
        backX = aim.pullX / pm;
        backY = aim.pullY / pm;
      }
    }

    if (pullRatio > 0.02 && (backX !== 0 || backY !== 0)) {
      const pullDist = 8 + pullRatio * 20;
      const kx = px + backX * pullDist;
      const ky = py + backY * pullDist;

      const tensionColor =
        pullRatio >= 0.85
          ? COLORS.charge3
          : pullRatio >= 0.45
            ? COLORS.textGold
            : COLORS.textCyan;

      // Dotted pullback tether
      for (let d = 5; d < pullDist; d += 3) {
        ctx.fillStyle = tensionColor;
        ctx.fillRect(Math.round(px + backX * d), Math.round(py + backY * d), 1, 1);
      }

      // Slingshot band prongs perpendicular to pullback
      const perpX = -backY;
      const perpY = backX;
      const prong1X = px + perpX * 6;
      const prong1Y = py + perpY * 6;
      const prong2X = px - perpX * 6;
      const prong2Y = py - perpY * 6;
      this.drawPixelLine(ctx, prong1X, prong1Y, kx, ky, tensionColor, 1);
      this.drawPixelLine(ctx, prong2X, prong2Y, kx, ky, tensionColor, 1);

      // Tension knob
      this.drawPixelCircleFill(ctx, kx, ky, 3, '#07080f');
      this.drawPixelCircleFill(ctx, kx, ky, 2, tensionColor);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(kx), Math.round(ky), 1, 1);
    }
  }

  private drawSawblade(
    ctx: CanvasRenderingContext2D,
    blade: Sawblade,
  ): void {
    const sx = Math.round(blade.x);
    const sy = Math.round(blade.y);
    const r = Math.max(4, Math.round(blade.radius));

    // Spinning pixel teeth around perimeter (player ordnance volt-yellow-lime palette)
    const teeth = 6;
    for (let i = 0; i < teeth; i++) {
      const ang = blade.spin + (i * Math.PI * 2) / teeth;
      const tx = Math.round(sx + Math.cos(ang) * (r + 2));
      const ty = Math.round(sy + Math.sin(ang) * (r + 2));
      ctx.fillStyle = '#0d1a04';
      ctx.fillRect(tx - 1, ty - 1, 3, 3);
      ctx.fillStyle = COLORS.playerBullet;
      ctx.fillRect(tx, ty, 2, 2);
    }

    this.drawPixelCircleFill(ctx, sx, sy, r + 1, '#0d1a04');
    this.drawPixelCircleFill(ctx, sx, sy, r, COLORS.playerBulletRim);
    this.drawPixelCircleFill(ctx, sx, sy, Math.max(2, r - 2), COLORS.playerBullet);
    ctx.fillStyle = COLORS.playerBulletCore;
    ctx.fillRect(sx - 1, sy - 1, 2, 2);
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    p: Projectile,
  ): void {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const r = Math.max(2, Math.round(p.radius));

    if (p.fromPlayer) {
      // Short 4px velocity trail tail behind player pellets
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 1) {
        const ux = p.vx / speed;
        const uy = p.vy / speed;
        const tailStart = Math.max(1, r - 1);
        const tailEnd = tailStart + 4;
        this.drawPixelLine(
          ctx,
          p.x - ux * tailStart,
          p.y - uy * tailStart,
          p.x - ux * tailEnd,
          p.y - uy * tailEnd,
          COLORS.playerBulletRim,
          2,
        );
        this.drawPixelLine(
          ctx,
          p.x - ux * tailStart,
          p.y - uy * tailStart,
          p.x - ux * (tailStart + 2),
          p.y - uy * (tailStart + 2),
          COLORS.playerBullet,
          1,
        );
      }

      // Signature friendly ordnance: dark outline + volt-yellow-lime body + white-hot center
      this.drawPixelCircleFill(ctx, px, py, r + 1, '#0d1a04');
      this.drawPixelCircleFill(ctx, px, py, r, COLORS.playerBullet);
      ctx.fillStyle = COLORS.playerBulletCore;
      ctx.fillRect(px, py, 1, 1);
    } else {
      // Red Means Dead: dark outline + bright red rim + high-contrast pale core
      this.drawPixelCircleFill(ctx, px, py, r + 1, '#07080f');
      this.drawPixelCircleFill(ctx, px, py, r, COLORS.bulletRed);
      this.drawPixelCircleFill(
        ctx,
        px,
        py,
        Math.max(1, r - 2),
        COLORS.bulletCore,
      );
      if (r <= 2) {
        ctx.fillStyle = COLORS.bulletCore;
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  private drawBeam(ctx: CanvasRenderingContext2D, beam: BeamEffect): void {
    const lifeRatio = clamp(beam.life / Math.max(0.001, beam.maxLife), 0, 1);
    const outerW = Math.max(2, Math.round(beam.width * lifeRatio));
    const innerW = Math.max(1, Math.round(outerW * 0.45));

    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * lifeRatio;
    this.drawPixelLine(
      ctx,
      beam.x1,
      beam.y1,
      beam.x2,
      beam.y2,
      beam.color,
      outerW,
    );
    ctx.globalAlpha = lifeRatio;
    this.drawPixelLine(
      ctx,
      beam.x1,
      beam.y1,
      beam.x2,
      beam.y2,
      '#ffffff',
      innerW,
    );
    ctx.restore();
  }

  private drawArc(ctx: CanvasRenderingContext2D, arc: ArcEffect): void {
    const pts = arc.points;
    if (pts.length < 2) return;
    const lifeRatio = clamp(arc.life / Math.max(0.001, arc.maxLife), 0, 1);

    ctx.save();
    ctx.globalAlpha = lifeRatio;
    for (let i = 0; i < pts.length - 1; i++) {
      this.drawPixelLine(
        ctx,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        arc.color,
        2,
      );
      this.drawPixelLine(
        ctx,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        '#ffffff',
        1,
      );
    }
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D, ring: RingEffect): void {
    const lifeRatio = clamp(ring.life / Math.max(0.001, ring.maxLife), 0, 1);
    const currentR = Math.max(
      1,
      Math.round(ring.radius + (ring.maxRadius - ring.radius) * (1 - lifeRatio)),
    );
    ctx.save();
    ctx.globalAlpha = lifeRatio * 0.9;
    this.drawPixelCircleStroke(ctx, ring.x, ring.y, currentR, ring.color, 1);
    ctx.restore();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    const lifeRatio = clamp(p.life / Math.max(0.001, p.maxLife), 0, 1);
    const size = Math.max(1, Math.round(p.size * (0.4 + 0.6 * lifeRatio)));
    ctx.save();
    ctx.globalAlpha = lifeRatio;
    ctx.fillStyle = p.color;
    ctx.fillRect(
      Math.round(p.x - size / 2),
      Math.round(p.y - size / 2),
      size,
      size,
    );
    ctx.restore();
  }

  private drawFloatingText(
    ctx: CanvasRenderingContext2D,
    ft: FloatingText,
  ): void {
    const lifeRatio = clamp(ft.life / Math.max(0.001, ft.maxLife), 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, lifeRatio * 1.4);
    this.drawPixelText(
      ctx,
      ft.text,
      ft.x,
      ft.y,
      ft.color,
      ft.scale ?? 1,
      'center',
    );
    ctx.restore();
  }

  private drawTopHud(ctx: CanvasRenderingContext2D, state: RenderState): void {
    // Solid HUD header strip (y: 0..38)
    ctx.fillStyle = '#090c18';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 38);
    ctx.fillStyle = '#1d2542';
    ctx.fillRect(0, 37, CANVAS_WIDTH, 1);

    const { player } = state;

    // --- Row 1 (y: 5..14) ---
    // 1. HP Hearts
    let curX = 8;
    const heartY = 6;
    for (let i = 0; i < player.maxHp; i++) {
      const full = i < player.hp;
      const palette: SpritePalette = full
        ? { o: '#07080f', r: '#ff2e88', h: '#ff9ec7' }
        : { o: '#3a4263' };
      this.drawSprite(
        ctx,
        full ? HEART_FULL_SPRITE : HEART_EMPTY_SPRITE,
        palette,
        curX + 4,
        heartY + 4,
        1,
      );
      curX += 11;
    }

    // 2. Shield Pips
    curX += 4;
    for (let i = 0; i < player.maxShield; i++) {
      const full = i < player.shield;
      const palette: SpritePalette = full
        ? { o: '#07080f', c: COLORS.textCyan, w: '#d6feff' }
        : { o: '#2d455e' };
      this.drawSprite(
        ctx,
        full ? SHIELD_FULL_SPRITE : SHIELD_EMPTY_SPRITE,
        palette,
        curX + 3,
        heartY + 4,
        1,
      );
      curX += 9;
    }

    // 3. Room Number
    const roomStr = `RM ${String(Math.max(1, state.roomNumber)).padStart(2, '0')}`;
    this.drawPixelText(ctx, roomStr, 132, 7, COLORS.textWhite, 1, 'center');

    // 4. Score (placed left of top-right SFX button)
    const scoreStr = String(Math.max(0, Math.floor(state.score)));
    this.drawPixelText(ctx, scoreStr, 210, 7, COLORS.textGold, 1, 'right');

    // --- Row 2 (y: 21..32) ---
    // 5. Active Weapon badge
    const weaponLabel = WEAPON_SHORT_LABELS[player.weapon];
    const badgeW = weaponLabel.length * 4 + 8;
    ctx.fillStyle = '#151c33';
    ctx.fillRect(8, 21, badgeW, 11);
    ctx.fillStyle = '#344270';
    ctx.fillRect(8, 21, badgeW, 1);
    ctx.fillRect(8, 31, badgeW, 1);
    ctx.fillRect(8, 21, 1, 11);
    ctx.fillRect(8 + badgeW - 1, 21, 1, 11);
    this.drawPixelText(ctx, weaponLabel, 12, 24, COLORS.textCyan, 1, 'left');

    // 6. Charge Badge (0x..3x MAX)
    const tier = clamp(Math.round(player.chargeTier), 0, 3);
    const chargeColor = CHARGE_COLORS[tier];
    const chargeLabel = tier >= 3 ? '3x MAX' : `${tier}x`;
    const chargeX = 8 + badgeW + 8;

    // Tiny charge pip bars
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < tier ? chargeColor : '#222a47';
      ctx.fillRect(chargeX + i * 5, 24, 4, 5);
    }
    this.drawPixelText(
      ctx,
      chargeLabel,
      chargeX + 18,
      24,
      tier > 0 ? chargeColor : COLORS.textDim,
      1,
      'left',
    );

    // 7. Flow Multiplier (right-aligned on Row 2)
    const flow = Math.max(1, state.flowMultiplier);
    const flowStr = `x${flow.toFixed(1)}`;
    const flowColor =
      flow >= 2.5
        ? COLORS.charge3
        : flow >= 1.5
          ? COLORS.textGold
          : flow > 1.05
            ? COLORS.textCyan
            : COLORS.textDim;
    this.drawPixelText(ctx, flowStr, 262, 24, flowColor, 1, 'right');
  }
}
