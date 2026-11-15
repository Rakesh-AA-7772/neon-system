import {
  CELESTIAL_BODIES,
  formatAU,
  formatAverageDistance
} from '../data/solar-system.js';

const EXPLORABLE_BODIES = CELESTIAL_BODIES;

function formatOrbitalPeriod(body) {
  if (!body?.orbitalPeriodDays) return '—';
  if (body.kind === 'moon' || body.orbitalPeriodDays < 365.256) return `${body.orbitalPeriodDays.toFixed(2)} days`;
  return `${(body.orbitalPeriodDays / 365.256).toFixed(2)} Earth years`;
}
function formatRotationPeriod(body) {
  if (!body?.rotationPeriodHours) return '—';
  const hours = Math.abs(body.rotationPeriodHours);
  const value = hours >= 48 ? `${(hours / 24).toFixed(2)} days` : `${hours.toFixed(2)} hours`;
  return body.rotationPeriodHours < 0 ? `${value} · retrograde` : value;
}
function formatDistance(body) {
  if (!body) return '—';
  if (body.kind === 'star') return 'Center of the Solar System';
  return body.kind === 'moon'
    ? formatAverageDistance(body)
    : `${formatAverageDistance(body)} · ${formatAU(body.distAU)} AU`;
}

/** Optional, low-cost planet close-up HUD with previous/next navigation. */
export function createExplorationHud({ renderer, onOpenDetails }) {
  const panel = document.getElementById('explorationHud');
  const kind = document.getElementById('explorationKind');
  const name = document.getElementById('explorationName');
  const description = document.getElementById('explorationDescription');
  const distanceLabel = document.getElementById('explorationDistanceLabel');
  const distance = document.getElementById('explorationDistance');
  const period = document.getElementById('explorationPeriod');
  const tilt = document.getElementById('explorationTilt');
  const rotation = document.getElementById('explorationRotation');
  const closeButton = document.getElementById('explorationClose');
  const returnButton = document.getElementById('explorationReturn');
  const previousButton = document.getElementById('explorationPrevious');
  const nextButton = document.getElementById('explorationNext');
  const detailsButton = document.getElementById('explorationDetails');
  const modal = document.getElementById('planetModal');
  let activeId = null;

  function setActive(bodyId) {
    activeId = bodyId || null;
    if (!activeId) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      return;
    }
    const body = CELESTIAL_BODIES.find((candidate) => candidate.id === activeId);
    if (!body) return;
    kind.textContent = body.kind === 'moon' ? 'NATURAL SATELLITE' : body.kind === 'star' ? 'CENTRAL STAR' : 'PLANETARY PROFILE';
    name.textContent = body.name;
    description.textContent = body.description;
    distanceLabel.textContent = body.kind === 'moon' ? 'Average Earth distance' : body.kind === 'star' ? 'Position' : 'Average Sun distance';
    distance.textContent = formatDistance(body);
    period.textContent = formatOrbitalPeriod(body);
    tilt.textContent = Number.isFinite(body.axialTiltDeg) ? `${body.axialTiltDeg.toFixed(2)}°` : '—';
    rotation.textContent = formatRotationPeriod(body);
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    previousButton.disabled = false;
    nextButton.disabled = false;
  }

  function open(bodyId) {
    return renderer.enterExplore?.(bodyId) || false;
  }
  function close() {
    renderer.exitExplore?.();
    if (document.activeElement && panel.contains(document.activeElement)) {
      document.getElementById('canvas')?.focus({ preventScroll: true });
    }
  }
  function step(direction) {
    if (!activeId) return;
    const currentIndex = EXPLORABLE_BODIES.findIndex((body) => body.id === activeId);
    const nextIndex = (currentIndex + direction + EXPLORABLE_BODIES.length) % EXPLORABLE_BODIES.length;
    open(EXPLORABLE_BODIES[nextIndex].id);
  }

  const onPrevious = () => step(-1);
  const onNext = () => step(1);
  const onClose = () => close();
  const onDetails = () => { if (activeId) onOpenDetails?.(activeId); };
  function onKeyDown(event) {
    if (!activeId || modal?.hidden === false || (event.target instanceof HTMLElement && ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))) return;
    if (event.key === 'Escape' && modal?.hidden !== false) {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  }

  closeButton.addEventListener('click', onClose);
  returnButton.addEventListener('click', onClose);
  previousButton.addEventListener('click', onPrevious);
  nextButton.addEventListener('click', onNext);
  detailsButton.addEventListener('click', onDetails);
  window.addEventListener('keydown', onKeyDown);

  return {
    open, setActive, close,
    destroy() {
      closeButton.removeEventListener('click', onClose);
      returnButton.removeEventListener('click', onClose);
      previousButton.removeEventListener('click', onPrevious);
      nextButton.removeEventListener('click', onNext);
      detailsButton.removeEventListener('click', onDetails);
      window.removeEventListener('keydown', onKeyDown);
    }
  };
}
