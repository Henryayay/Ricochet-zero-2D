import './style.css';
import { registerSW } from 'virtual:pwa-register';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COMBAT,
  CONTROLS,
  DIFFICULTY_CONFIG,
  DIFFICULTY_ORDER,
  RARITY_META,
} from './game/constants.ts';
import { DifficultyId, DraftOption, WeaponId } from './game/entities.ts';
import { GameEngine, GamePhase, RunSummary } from './game/engine.ts';
import { TutorialRenderInfo } from './game/tutorial.ts';
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
let latestTutorial: TutorialRenderInfo | null = null;
let settingsModalOpen = false;
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
    settingsModalOpen = false;
    renderUI('gameover');
  },
  onMuteChange(muted) {
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.textContent = muted ? 'SND: OFF' : 'SND: ON';
    }
  },
  onTutorialStateChange(info) {
    latestTutorial = info;
    updateTutorialOverlayDOM();
  },
  onSettingsChange() {
    if (settingsModalOpen || engine.phase === 'title') {
      renderUI(engine.phase);
    }
  },
  onPauseChange(paused) {
    if (!paused && settingsModalOpen && engine.phase === 'playing') {
      settingsModalOpen = false;
    }
    renderUI(engine.phase);
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

function renderMuteBar(phase: GamePhase): string {
  const label = engine.audio.isMuted() ? 'SND: OFF' : 'SND: ON';
  const skipBtn =
    engine.isTutorialActive() && phase === 'playing'
      ? `<button id="btn-skip-tutorial" class="pixel-btn-mini skip ui-interactive" type="button">SKIP</button>`
      : '';
  const setLabel = phase === 'playing' ? 'PAUSE' : 'OPT';
  return `
    <div class="hud-top-actions">
      ${skipBtn}
      <button id="btn-mute" class="pixel-btn-mini ui-interactive" type="button">${label}</button>
      <button id="btn-open-settings" class="pixel-btn-mini ui-interactive" type="button">${setLabel}</button>
    </div>
  `;
}

function renderTitleOverlay(): string {
  const selected = engine.getStartingWeapon();
  const settings = engine.getSettings();
  const diffMeta = DIFFICULTY_CONFIG[settings.difficulty];
  const rec = engine.getDifficultyRecord(settings.difficulty);
  const chips = STARTER_WEAPONS.map((wid) => {
    const meta = WEAPON_META[wid];
    const active = wid === selected ? 'active' : '';
    return `<button class="weapon-chip ${active}" data-weapon="${wid}" type="button">${meta.name}</button>`;
  }).join('');

  const bestRow =
    rec.bestScore > 0
      ? `<div style="text-align:center;font-size:10px;color:#ffd447;margin-top:8px;letter-spacing:0.08em;">${diffMeta.label} BEST: ${rec.bestScore} // ROOM ${rec.bestRoom}</div>`
      : `<div style="text-align:center;font-size:10px;color:#8a95b8;margin-top:8px;letter-spacing:0.08em;">MODE: ${diffMeta.label}</div>`;

  return `
    <div class="overlay-backdrop">
      <div class="panel-card">
        <h1 class="title-logo">RICOCHET ZERO</h1>
        <div class="title-sub">ONE-THUMB PINBALL ROGUELIKE</div>
        ${bestRow}

        <div class="guide-list">
          <div><span class="guide-tag tag-cyan">DRAG</span> <strong>Slingshot Aim:</strong> Hold or drag for 0.12x slow-mo Focus Ring + banked preview.</div>
          <div><span class="guide-tag tag-gold">TAP</span> <strong>Brake &amp; Fire:</strong> Quick tap mid-flight stops &amp; fires along your nose chevron.</div>
          <div><span class="guide-tag tag-red">RED</span> <strong>Red Means Dead:</strong> Red spikes, bombs &amp; lasers pierce armor!</div>
        </div>

        <div style="margin-top:10px;font-size:10px;color:#8a95b8;letter-spacing:0.08em;">STARTER WEAPON</div>
        <div class="weapon-select-row">${chips}</div>
      </div>

      <div class="title-actions">
        <button id="btn-start" class="pixel-cta" type="button">DROP IN</button>
        <div class="title-sub-actions">
          <button id="btn-tutorial" class="pixel-cta secondary" type="button">TUTORIAL</button>
          <button id="btn-title-settings" class="pixel-cta secondary" type="button">SETTINGS</button>
        </div>
      </div>
    </div>
  `;
}

function renderDraftOverlay(): string {
  const cards = latestDraft
    .map((opt, idx) => {
      const rarity = opt.rarity ?? 'common';
      const rarityInfo = RARITY_META[rarity];
      const badge =
        opt.kind === 'weapon'
          ? 'WEAPON'
          : opt.rankLabel
            ? opt.rankLabel
            : opt.kind === 'weapon_mod'
              ? 'MOD'
              : 'PERK';
      const rarityTag =
        opt.kind === 'weapon'
          ? ''
          : `<span class="rarity-pill rarity-${rarity}">${rarityInfo.label}</span>`;
      return `
        <button class="draft-card ${opt.kind} rarity-${rarity}" data-draft-idx="${idx}" type="button">
          <div class="draft-card-top">
            <span class="draft-title">${opt.title}</span>
            <div class="draft-badges">
              ${rarityTag}
              <span class="draft-badge ${opt.kind}">${badge}</span>
            </div>
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
  const diffLabel = DIFFICULTY_CONFIG[engine.getSettings().difficulty].label;
  const badge = latestSummary.isNewBest
    ? `<div style="text-align:center;color:#ffd447;font-size:11px;font-weight:900;letter-spacing:0.12em;margin-top:4px;">NEW ${diffLabel} HIGH SCORE!</div>`
    : `<div style="text-align:center;color:#8a95b8;font-size:10px;font-weight:800;letter-spacing:0.1em;margin-top:4px;">MODE: ${diffLabel}</div>`;
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
        <div class="title-actions">
          <button id="btn-restart" class="pixel-cta danger" type="button">RUN IT BACK</button>
          <button id="btn-gameover-settings" class="pixel-cta secondary" type="button">SETTINGS / DIFFICULTY</button>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsModal(phase: GamePhase): string {
  if (!settingsModalOpen) return '';
  const s = engine.getSettings();
  const inActiveRun = phase === 'playing' || phase === 'draft' || phase === 'transition';
  const sensSliderVal =
    CONTROLS.MIN_PULL_SENSITIVITY_PX + CONTROLS.MAX_PULL_SENSITIVITY_PX - s.pullSensitivityPx;
  const sensDesc =
    s.pullSensitivityPx <= 54
      ? `HIGH (${s.pullSensitivityPx}px)`
      : s.pullSensitivityPx >= 82
        ? `PRECISE (${s.pullSensitivityPx}px)`
        : `DEFAULT (${s.pullSensitivityPx}px)`;

  const diffChips = DIFFICULTY_ORDER.map((diffId) => {
    const meta = DIFFICULTY_CONFIG[diffId];
    const active = s.difficulty === diffId ? 'active' : '';
    const disabled = inActiveRun ? 'disabled' : '';
    return `<button class="difficulty-chip ${active}" data-difficulty="${diffId}" type="button" ${disabled}>${meta.label}</button>`;
  }).join('');

  const diffDesc = DIFFICULTY_CONFIG[s.difficulty].desc;
  const quitBtn = inActiveRun
    ? `<button id="btn-quit-run" class="pixel-cta secondary" type="button">QUIT TO TITLE</button>`
    : '';

  return `
    <div class="overlay-backdrop settings-backdrop">
      <div class="panel-card settings-modal">
        <div class="settings-header">
          <h2>${inActiveRun && phase === 'playing' ? 'PAUSED // SETTINGS' : 'SETTINGS'}</h2>
          <span class="settings-sub">${inActiveRun ? 'SIMULATION PAUSED' : 'AUDIO, AIM & MODE'}</span>
        </div>

        <div class="settings-row">
          <div class="settings-label-row">
            <span>BGM VOLUME</span>
            <span id="val-bgm">${Math.round(s.bgmVolume * 100)}%</span>
          </div>
          <input id="setting-bgm" class="settings-slider" type="range" min="0" max="100" value="${Math.round(s.bgmVolume * 100)}" />
        </div>

        <div class="settings-row">
          <div class="settings-label-row">
            <span>SFX VOLUME</span>
            <span id="val-sfx">${Math.round(s.sfxVolume * 100)}%</span>
          </div>
          <input id="setting-sfx" class="settings-slider" type="range" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}" />
        </div>

        <div class="settings-row">
          <div class="settings-label-row">
            <span>AIM SENSITIVITY</span>
            <span id="val-sens">${sensDesc}</span>
          </div>
          <input id="setting-sens" class="settings-slider" type="range" min="${CONTROLS.MIN_PULL_SENSITIVITY_PX}" max="${CONTROLS.MAX_PULL_SENSITIVITY_PX}" value="${sensSliderVal}" />
        </div>

        <div class="settings-row settings-toggle-row">
          <span>SCREEN SHAKE</span>
          <button id="btn-toggle-shake" class="pixel-btn-mini ui-interactive" type="button">${s.screenShake ? 'ON' : 'OFF'}</button>
        </div>

        <div class="settings-row">
          <div class="settings-label-row">
            <span>DIFFICULTY</span>
            <span class="settings-lock">${inActiveRun ? 'LOCKED IN RUN' : 'PER-MODE PB'}</span>
          </div>
          <div class="difficulty-row">${diffChips}</div>
          <div class="settings-diff-desc">${diffDesc}</div>
        </div>

        <div class="title-actions" style="margin-top:10px;">
          <button id="btn-close-settings" class="pixel-cta" type="button">${inActiveRun && phase === 'playing' ? 'RESUME' : 'DONE'}</button>
          ${quitBtn}
        </div>
      </div>
    </div>
  `;
}

function renderTutorialOverlayInner(phase: GamePhase): string {
  if (phase !== 'playing' || !latestTutorial?.active) return '';
  const tut = latestTutorial;
  const accent = tut.briefTagKind;

  const briefCard = tut.briefVisible
    ? `
      <div class="tutorial-brief-backdrop">
        <div class="tutorial-brief-card ${accent}">
          <div class="tutorial-brief-top">
            <span class="guide-tag tag-${accent}">${tut.briefTag}</span>
            <span class="tutorial-brief-stage">DRILL ${tut.stageIndex + 1}/${tut.stageCount}</span>
          </div>
          <div class="tutorial-brief-headline">${tut.briefHeadline}</div>
          <div class="tutorial-brief-sub">${tut.briefSubtext}</div>
          <div class="tutorial-brief-cta">DRAG ANYWHERE TO START</div>
        </div>
      </div>
    `
    : '';

  return `
    <div class="tutorial-coach-bar ${accent}">
      <div class="tutorial-coach-header">
        <span class="tutorial-coach-title">${tut.promptLine1}</span>
        <span class="tutorial-step-pill ${accent}">${tut.stepBadge}</span>
      </div>
      <div class="tutorial-coach-sub">${tut.promptLine2}</div>
    </div>
    ${briefCard}
  `;
}

function updateTutorialOverlayDOM(): void {
  const container = document.getElementById('tutorial-overlay');
  if (container) {
    container.innerHTML = renderTutorialOverlayInner(engine.phase);
  }
}

function wireSettingsModalListeners(): void {
  if (!settingsModalOpen) return;

  const bgmInput = document.getElementById('setting-bgm') as HTMLInputElement | null;
  bgmInput?.addEventListener('input', () => {
    const val = Number(bgmInput.value) / 100;
    const label = document.getElementById('val-bgm');
    if (label) label.textContent = `${bgmInput.value}%`;
    engine.updateSettings({ bgmVolume: val });
  });

  const sfxInput = document.getElementById('setting-sfx') as HTMLInputElement | null;
  sfxInput?.addEventListener('input', () => {
    const val = Number(sfxInput.value) / 100;
    const label = document.getElementById('val-sfx');
    if (label) label.textContent = `${sfxInput.value}%`;
    engine.updateSettings({ sfxVolume: val });
  });

  const sensInput = document.getElementById('setting-sens') as HTMLInputElement | null;
  sensInput?.addEventListener('input', () => {
    const sliderVal = Number(sensInput.value);
    const pullPx =
      CONTROLS.MIN_PULL_SENSITIVITY_PX + CONTROLS.MAX_PULL_SENSITIVITY_PX - sliderVal;
    const label = document.getElementById('val-sens');
    if (label) {
      label.textContent =
        pullPx <= 54
          ? `HIGH (${pullPx}px)`
          : pullPx >= 82
            ? `PRECISE (${pullPx}px)`
            : `DEFAULT (${pullPx}px)`;
    }
    engine.updateSettings({ pullSensitivityPx: pullPx });
  });

  document.getElementById('btn-toggle-shake')?.addEventListener('click', () => {
    engine.updateSettings({ screenShake: !engine.getSettings().screenShake });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const diff = btn.dataset.difficulty as DifficultyId;
      engine.updateSettings({ difficulty: diff });
    });
  });

  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    settingsModalOpen = false;
    if (engine.phase === 'playing') {
      engine.setPaused(false);
    } else {
      renderUI(engine.phase);
    }
  });

  document.getElementById('btn-quit-run')?.addEventListener('click', () => {
    settingsModalOpen = false;
    engine.quitToTitle();
  });
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

  uiLayer.innerHTML = `${renderMuteBar(phase)}<div id="tutorial-overlay">${renderTutorialOverlayInner(phase)}</div>${overlay}${renderSettingsModal(phase)}`;

  const muteBtn = document.getElementById('btn-mute');
  muteBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  muteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    engine.toggleMute();
  });

  const openSettingsBtn = document.getElementById('btn-open-settings');
  openSettingsBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  openSettingsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsModalOpen = !settingsModalOpen;
    if (phase === 'playing') {
      engine.setPaused(settingsModalOpen);
    } else {
      renderUI(phase);
    }
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
    document.getElementById('btn-title-settings')?.addEventListener('click', () => {
      settingsModalOpen = true;
      renderUI('title');
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
    document.getElementById('btn-gameover-settings')?.addEventListener('click', () => {
      settingsModalOpen = true;
      renderUI('gameover');
    });
  }

  wireSettingsModalListeners();
}

renderUI('title');
