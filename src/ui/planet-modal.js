import { BODY_BY_ID, formatAU, formatAverageDistance } from '../data/solar-system.js';

/** Accessible planet details dialog with consistent, id-based NASA destinations. */
export function createPlanetModal() {
  const overlay = document.getElementById('planetModal');
  const dialog = overlay.querySelector('.modal-dialog');
  const title = document.getElementById('modalTitle');
  const description = document.getElementById('modalDesc');
  const image = document.getElementById('modalImg');
  const moreLink = document.getElementById('modalMore');
  const closeButton = document.getElementById('modalClose');
  let previouslyFocused = null;

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    previouslyFocused?.focus?.();
    previouslyFocused = null;
  }

  function open(bodyId) {
    const body = BODY_BY_ID[bodyId];
    if (!body) return;

    previouslyFocused = document.activeElement;
    title.textContent = body.name;
    const metrics = [];
    if (body.kind === 'planet') metrics.push(`Average distance from the Sun: ${formatAverageDistance(body)} (${formatAU(body.distAU)} AU).`);
    if (body.kind === 'moon') metrics.push(`Average distance from Earth: ${formatAverageDistance(body)}.`);
    if (body.orbitalPeriodDays) metrics.push(`Orbital period: ${body.orbitalPeriodDays.toLocaleString(undefined, { maximumFractionDigits: 2 })} days.`);
    if (Number.isFinite(body.axialTiltDeg)) metrics.push(`Axial tilt: ${body.axialTiltDeg.toFixed(2)}°.`);
    description.textContent = metrics.length ? `${body.description}\n\n${metrics.join('\n')}` : body.description;
    image.src = body.texture;
    image.alt = `${body.name} surface texture`;
    moreLink.href = body.nasaUrl;
    moreLink.hidden = !body.nasaUrl;

    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    closeButton.focus();
  }

  function onOverlayClick(event) {
    if (event.target === overlay) close();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && !overlay.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', onOverlayClick);
  window.addEventListener('keydown', onKeyDown);

  return {
    open,
    close,
    destroy() {
      closeButton.removeEventListener('click', close);
      overlay.removeEventListener('click', onOverlayClick);
      window.removeEventListener('keydown', onKeyDown);
    }
  };
}
