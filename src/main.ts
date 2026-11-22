import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMBAT } from './game/constants.ts';
import { DraftOption, WeaponId } from './game/entities.ts';
import { GameEngine, GamePhase, RunSummary } from './game/engine.ts';
import { WEAPON_META } from './game/weapons.ts';

registerSW({
  immediate: true,
  onOfflineReady() {
    // Ready for offline play
  },
});

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiLayer = document.getElementById('ui-layer') as HTMLDivElement;

const STARTER_WEAPONS: WeaponId[] = ['railgun', 'shotgun', 'sawblade', 'arccoil'];

let latestDraft: DraftOption[] = [];
let latestDraftRoom = 1;
let latestTransferRemaining = 0;
let latestTransferWeapon: WeaponId | null = null;
let latestSummary: RunSummary = {
  score: 0,
  bestScore: 0,
  roomNumber: 1,
  bestRoom: 1,
  isNewBest: false,
};

const engine = new GameEngine({
  onPhaseChange(phase) {
    renderUI(phase);
  },
  onDraftReady(options, roomNumber, transferRemaining = 0, transferWeapon) {
    latestDraft = options;
    latestDraftRoom = roomNumber;
    latestTransferRemaining = transferRemaining;
    latestTransferWeapon = transferWeapon ?? null;
    renderUI('draft');
  },
  onGameOver(summary) {
    latestSummary = summary;
    renderUI('gameover');
  },
  onMuteChange(muted) {
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.textContent = muted ? 'SND: OFF' : 'SND: ON';
    }
  },
});

engine.attachCanvas(canvas);
engine.startLoop();

function toCanvasCoords(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Ignore in synthetic pointer tests
  }
  const pt = toCanvasCoords(e);
  engine.handlePointerDown(pt.x, pt.y, e.pointerId, performance.now());
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  const pt = toCanvasCoords(e);
  engine.handlePointerMove(pt.x, pt.y, e.pointerId);
});

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  const pt = toCanvasCoords(e);
  engine.handlePointerUp(pt.x, pt.y, e.pointerId, performance.now());
});

canvas.addEventListener('pointercancel', (e) => {
  engine.handlePointerCancel(e.pointerId);
});

canvas.addEventListener('lostpointercapture', (e) => {
  engine.handlePointerCancel(e.pointerId);
});

window.addEventListener('blur', () => {
  engine.cancelActiveInput();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    engine.cancelActiveInput();
    engine.audio.setBackgroundPaused(true);
  } else {
    engine.audio.setBackgroundPaused(false);
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function renderMuteBar(): string {
  const label = engine.audio.isMuted() ? 'SND: OFF' : 'SND: ON';
  const skipBtn =
    engine.isTutorialActive() && engine.phase === 'playing'
      ? `<button id="btn-skip-tutorial" class="pixel-btn-mini skip ui-interactive" type="button">SKIP</button>`
      : '';
  return `
    <div class="hud-top-actions">
      ${skipBtn}
      <button id="btn-mute" class="pixel-btn-mini ui-interactive" type="button">${label}</button>
    </div>
  `;
}

function renderTitleOverlay(): string {
  const selected = engine.getStartingWeapon();
  const chips = STARTER_WEAPONS.map((wid) => {
    const meta = WEAPON_META[wid];
    const active = wid === selected ? 'active' : '';
    return `<button class="weapon-chip ${active}" data-weapon="${wid}" type="button">${meta.name}</button>`;
  }).join('');

  const bestRow =
    engine.bestScore > 0
      ? `<div style="text-align:center;font-size:10px;color:#ffd447;margin-top:8px;letter-spacing:0.08em;">BEST: ${engine.bestScore} // ROOM ${engine.bestRoom}</div>`
      : '';

  return `
    <div class="overlay-backdrop">
      <div class="panel-card">
        <h1 class="title-logo">RICOCHET ZERO</h1>
        <div class="title-sub">ONE-THUMB PINBALL ROGUELIKE</div>
        ${bestRow}

        <div class="guide-list">
          <div><span class="guide-tag tag-cyan">DRAG</span> <strong>Slingshot Aim:</strong> Slow-mo 0.2x Focus Ring + banked raycast preview.</div>
          <div><span class="guide-tag tag-gold">TAP</span> <strong>Brake &amp; Fire:</strong> Quick tap mid-flight stops &amp; fires along your nose chevron.</div>
          <div><span class="guide-tag tag-red">RED</span> <strong>Red Means Dead:</strong> Red spikes, bombs &amp; lasers pierce armor!</div>
        </div>

        <div style="margin-top:10px;font-size:10px;color:#8a95b8;letter-spacing:0.08em;">STARTER WEAPON</div>
        <div class="weapon-select-row">${chips}</div>
      </div>

      <div class="title-actions">
        <button id="btn-start" class="pixel-cta" type="button">DROP IN</button>
        <button id="btn-tutorial" class="pixel-cta secondary" type="button">TUTORIAL</button>
      </div>
    </div>
  `;
}

function renderDraftOverlay(): string {
  const cards = latestDraft
    .map((opt, idx) => {
      const badge =
        opt.kind === 'weapon'
          ? 'WEAPON'
          : opt.kind === 'weapon_mod'
            ? opt.rankLabel ?? 'MOD'
            : opt.rankLabel ?? 'PERK';
      return `
        <button class="draft-card ${opt.kind}" data-draft-idx="${idx}" type="button">
          <div class="draft-card-top">
            <span class="draft-title">${opt.title}</span>
            <span class="draft-badge ${opt.kind}">${badge}</span>
          </div>
          <div class="draft-desc">${opt.description}</div>
        </button>
      `;
    })
    .join('');

  const isTransfer = latestTransferRemaining > 0 && latestTransferWeapon !== null;
  const heading = isTransfer
    ? `MOD TRANSFER (${latestTransferRemaining} LEFT)`
    : `ROOM ${latestDraftRoom} CLEARED`;
  const sub = isTransfer
    ? `UPGRADE ${WEAPON_META[latestTransferWeapon!].name.toUpperCase()}`
    : `SHIELD RESTORED // DRAFT 1 UPGRADE (${engine.player.weaponUpgradeBudget}/${COMBAT.MAX_WEAPON_UPGRADES} MODS)`;

  const skipButton = !isTransfer
    ? `<button id="btn-skip-draft" class="draft-skip-btn" type="button">SKIP UPGRADE (+${Math.round(COMBAT.SKIP_DRAFT_BASE_BONUS * engine.flowMultiplier)} PTS)</button>`
    : '';

  return `
    <div class="overlay-backdrop">
      <div class="draft-header">
        <h2>${heading}</h2>
        <p>${sub}</p>
      </div>
      <div class="draft-cards">${cards}</div>
      ${skipButton}
    </div>
  `;
}

function renderGameOverOverlay(): string {
  const badge = latestSummary.isNewBest
    ? `<div style="text-align:center;color:#ffd447;font-size:11px;font-weight:900;letter-spacing:0.12em;margin-top:4px;">NEW HIGH SCORE!</div>`
    : '';
  return `
    <div class="overlay-backdrop">
      <div class="panel-card">
        <h2 class="title-logo" style="font-size:22px;color:#ff384c;">SIGNAL LOST</h2>
        ${badge}
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">SCORE</div>
            <div class="stat-value">${latestSummary.score}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">BEST</div>
            <div class="stat-value">${latestSummary.bestScore}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">ROOM</div>
            <div class="stat-value">${latestSummary.roomNumber}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">BEST ROOM</div>
            <div class="stat-value">${latestSummary.bestRoom}</div>
          </div>
        </div>
        <button id="btn-restart" class="pixel-cta danger" type="button">RUN IT BACK</button>
      </div>
    </div>
  `;
}

function renderUI(phase: GamePhase): void {
  let overlay = '';
  if (phase === 'title') {
    overlay = renderTitleOverlay();
  } else if (phase === 'draft') {
    overlay = renderDraftOverlay();
  } else if (phase === 'gameover') {
    overlay = renderGameOverOverlay();
  }

  uiLayer.innerHTML = `${renderMuteBar()}${overlay}`;

  const muteBtn = document.getElementById('btn-mute');
  muteBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  muteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    engine.toggleMute();
  });

  const skipTutBtn = document.getElementById('btn-skip-tutorial');
  skipTutBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  skipTutBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    engine.skipTutorial();
  });

  if (phase === 'title') {
    document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.weapon as WeaponId;
        engine.setStartingWeapon(w);
        renderUI('title');
      });
    });
    document.getElementById('btn-start')?.addEventListener('click', () => {
      if (!engine.isTutorialCompleted()) {
        engine.startTutorial({
          returnToTitle: false,
          postWeapon: engine.getStartingWeapon(),
        });
      } else {
        engine.startNewRun();
      }
    });
    document.getElementById('btn-tutorial')?.addEventListener('click', () => {
      engine.startTutorial({
        returnToTitle: true,
        postWeapon: engine.getStartingWeapon(),
      });
    });
  } else if (phase === 'draft') {
    document.querySelectorAll<HTMLButtonElement>('[data-draft-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.draftIdx);
        const opt = latestDraft[idx];
        if (opt) engine.selectDraftOption(opt);
      });
    });
    document.getElementById('btn-skip-draft')?.addEventListener('click', () => {
      engine.skipDraft();
    });
  } else if (phase === 'gameover') {
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      engine.startNewRun();
    });
  }
}

renderUI('title');
