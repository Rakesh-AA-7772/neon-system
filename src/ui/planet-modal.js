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
    description.textContent = body.kind === 'planet'
      ? `${body.description}\n\nAverage distance from the Sun: ${formatAverageDistance(body)} (${formatAU(body.distAU)} AU).`
      : body.kind === 'moon'
        ? `${body.description}\n\nAverage distance from Earth: ${formatAverageDistance(body)}.`
        : body.description;
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
    if (event.key === 'Escape' && !overlay.hidden) close();
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
