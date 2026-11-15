import './style.css';
import { createSolarSystemRenderer } from './core/renderer.js';
import { setupAudio } from './services/audio.js';
import { loadVisitCount } from './services/visits.js';
import { bindControls } from './ui/controls.js';
import { createPlanetModal } from './ui/planet-modal.js';

const canvas = document.getElementById('canvas');
const tooltip = document.getElementById('tooltip');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');

const planetModal = createPlanetModal();

const renderer = createSolarSystemRenderer({
  canvas,
  tooltip,
  onSelect: (bodyId) => planetModal.open(bodyId),
  onZoomChange: (value) => {
    zoomInput.value = String(value);
    zoomValue.textContent = Number(value).toFixed(2);
  }
});

const controls = bindControls(renderer);
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
  planetModal.destroy();
  destroyAudio();
}, { once: true });
