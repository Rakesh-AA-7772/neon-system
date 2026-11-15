const STORAGE_KEY = 'neon-system-local-visits-v1';

function formatCount(value) {
  return Math.max(0, Math.floor(value)).toLocaleString();
}

/**
 * Supports the two response shapes used by earlier versions of the project:
 * { value: number } and { count: number }. Without an API, use a clearly
 * labelled per-browser counter instead of pretending it is a global total.
 */
export async function loadVisitCount(element) {
  if (!element) return;

  try {
    const response = await fetch('/api/visits', {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Visit endpoint returned ${response.status}`);

    const payload = await response.json();
    const rawCount = payload?.count ?? payload?.value;
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count < 0) throw new Error('Visit endpoint returned an invalid count');

    element.textContent = formatCount(count);
    element.title = 'Count returned by the configured visit API';
    element.dataset.source = 'server';
    return;
  } catch (error) {
    console.info('Using local visit counter; no working /api/visits endpoint was found.', error);
  }

  try {
    const previous = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    const next = (Number.isFinite(previous) ? previous : 0) + 1;
    localStorage.setItem(STORAGE_KEY, String(next));
    element.textContent = `${formatCount(next)} local`;
    element.title = 'Local count for this browser only; configure /api/visits for a shared total';
    element.dataset.source = 'local';
  } catch {
    element.textContent = 'Unavailable';
    element.title = 'Visit count is unavailable in this browser';
  }
}
