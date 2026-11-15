import './style.css';
import { createSolarSystemRenderer } from './core/renderer.js';
import { createCanvasFallbackRenderer } from './core/renderer-2d.js';
import { setupAudio } from './services/audio.js';
import { loadVisitCount } from './services/visits.js';
import { bindControls } from './ui/controls.js';
import { createPlanetModal } from './ui/planet-modal.js';
import { createExplorationHud } from './ui/exploration-hud.js';

let canvas = document.getElementById('canvas');
const tooltip = document.getElementById('tooltip');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');
const planetModal = createPlanetModal();
let explorationHud = null;
let renderer = null;

const rendererOptions = {
  tooltip,
  onSelect: (bodyId) => explorationHud?.open(bodyId),
  onExploreChange: (bodyId) => {
    explorationHud?.setActive(bodyId);
    const focusSelect = document.getElementById('centerOn');
    if (focusSelect) focusSelect.value = bodyId || 'sun';
  },
  onZoomChange: (value) => {
    zoomInput.value = String(value);
    zoomValue.textContent = Number(value).toFixed(2);
  }
};

try {
  renderer = createSolarSystemRenderer({ canvas, ...rendererOptions });
  document.documentElement.dataset.renderer = 'webgl';
} catch (error) {
  console.warn('WebGL 2 is unavailable. Using the lighter 2D compatibility renderer.', error);
  const replacement = canvas.cloneNode(true);
  canvas.replaceWith(replacement);
  canvas = replacement;
  renderer = createCanvasFallbackRenderer({ canvas, ...rendererOptions });
  document.documentElement.dataset.renderer = 'canvas';
}

explorationHud = createExplorationHud({ renderer, onOpenDetails: (bodyId) => planetModal.open(bodyId) });
const controls = bindControls(renderer, { onExplore: (bodyId) => explorationHud.open(bodyId) });
const destroyAudio = setupAudio({
  audio: document.getElementById('bgAudio'),
  select: document.getElementById('audioSelect'),
  playButton: document.getElementById('audioPlay'),
  pauseButton: document.getElementById('audioPause'),
  status: document.getElementById('audioStatus')
});

loadVisitCount(document.getElementById('visitCount'));

window.addEventListener('pagehide', () => {
  controls.destroy();
  renderer.destroy();
  explorationHud?.destroy();
  planetModal.destroy();
  destroyAudio();
}, { once: true });
