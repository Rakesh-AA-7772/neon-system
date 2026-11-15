/** Connect the control panel to the renderer and own its keyboard shortcuts. */
export function bindControls(renderer, { onZoomChange } = {}) {
  const $ = (id) => document.getElementById(id);
  const sidebar = $('sidebar');
  const sidebarToggle = $('sidebarToggle');
  const pause = $('pause');
  const timeScale = $('timeScale');
  const scaleValue = $('scaleValue');
  const zoom = $('zoom');
  const zoomValue = $('zoomValue');
  const showOrbits = $('showOrbits');
  const showTrails = $('showTrails');
  const showLabels = $('showLabels');
  const centerOn = $('centerOn');
  const performanceMode = $('perfMode');
  const resetButton = $('resetBtn');
  const saveButton = $('saveBtn');

  const syncZoom = (value) => {
    zoom.value = String(value);
    zoomValue.textContent = Number(value).toFixed(2);
    onZoomChange?.(Number(value));
  };

  const updateSidebarState = () => {
    const expanded = !sidebar.classList.contains('is-collapsed');
    sidebarToggle.setAttribute('aria-expanded', String(expanded));
    sidebarToggle.setAttribute('aria-label', expanded ? 'Collapse controls' : 'Open controls');
    sidebarToggle.querySelector('span').textContent = expanded ? '☰' : '☰';
  };

  const toggleSidebar = () => {
    sidebar.classList.toggle('is-collapsed');
    updateSidebarState();
  };

  const mobileQuery = window.matchMedia('(max-width: 820px)');
  const applyResponsiveSidebar = () => {
    sidebar.classList.toggle('is-collapsed', mobileQuery.matches);
    updateSidebarState();
  };

  const onPauseChange = () => renderer.setPaused(pause.checked);
  const onTimeScaleInput = () => {
    const value = Number(timeScale.value);
    scaleValue.textContent = `${value.toFixed(2)}x`;
    renderer.setTimeScale(value);
  };
  const onZoomInput = () => {
    zoomValue.textContent = Number(zoom.value).toFixed(2);
    renderer.setZoom(zoom.value);
  };
  const onShowOrbitsChange = () => renderer.setShowOrbits(showOrbits.checked);
  const onShowTrailsChange = () => renderer.setShowTrails(showTrails.checked);
  const onShowLabelsChange = () => renderer.setShowLabels(showLabels.checked);
  const onCenterChange = () => renderer.setCenterOn(centerOn.value);
  const onPerformanceChange = () => renderer.setPerformanceMode(performanceMode.checked);

  const onReset = () => {
    renderer.reset();
    pause.checked = false;
    timeScale.value = '1';
    scaleValue.textContent = '1.00x';
    zoom.value = '1';
    zoomValue.textContent = '1.00';
    showOrbits.checked = true;
    showTrails.checked = false;
    showLabels.checked = true;
    centerOn.value = 'sun';
    performanceMode.checked = false;
    syncZoom(1);
  };

  const onKeyDown = (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (
      target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)
    );

    if (event.code === 'Space' && !isTyping) {
      event.preventDefault();
      pause.checked = !pause.checked;
      onPauseChange();
    }
    if ((event.key === 'h' || event.key === 'H') && !isTyping) toggleSidebar();
  };

  sidebarToggle.addEventListener('click', toggleSidebar);
  mobileQuery.addEventListener('change', applyResponsiveSidebar);
  pause.addEventListener('change', onPauseChange);
  timeScale.addEventListener('input', onTimeScaleInput);
  zoom.addEventListener('input', onZoomInput);
  showOrbits.addEventListener('change', onShowOrbitsChange);
  showTrails.addEventListener('change', onShowTrailsChange);
  showLabels.addEventListener('change', onShowLabelsChange);
  centerOn.addEventListener('change', onCenterChange);
  performanceMode.addEventListener('change', onPerformanceChange);
  resetButton.addEventListener('click', onReset);
  saveButton.addEventListener('click', () => renderer.saveImage());
  window.addEventListener('keydown', onKeyDown);
  applyResponsiveSidebar();
  onTimeScaleInput();
  onZoomInput();

  return {
    syncZoom,
    destroy() {
      sidebarToggle.removeEventListener('click', toggleSidebar);
      mobileQuery.removeEventListener('change', applyResponsiveSidebar);
      pause.removeEventListener('change', onPauseChange);
      timeScale.removeEventListener('input', onTimeScaleInput);
      zoom.removeEventListener('input', onZoomInput);
      showOrbits.removeEventListener('change', onShowOrbitsChange);
      showTrails.removeEventListener('change', onShowTrailsChange);
      showLabels.removeEventListener('change', onShowLabelsChange);
      centerOn.removeEventListener('change', onCenterChange);
      performanceMode.removeEventListener('change', onPerformanceChange);
      resetButton.removeEventListener('click', onReset);
      window.removeEventListener('keydown', onKeyDown);
    }
  };
}
