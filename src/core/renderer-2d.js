import { CELESTIAL_BODIES, PLANETS, MOON } from '../data/solar-system.js';
import { auToWorld, clamp, project, rotateX, rotateY, TWO_PI } from './math.js';

const GLOBAL_SPEED = 0.28;
const MAX_TRAIL_POINTS = 100;
const FOCAL_LENGTH = 1000;
const CAMERA_Z = 2000;

/** Canvas renderer for the cinematic (intentionally non-scale) Solar System. */
export function createCanvasFallbackRenderer({ canvas, tooltip, onSelect, onZoomChange }) {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('This browser does not support the Canvas 2D renderer.');

  const state = {
    running: true,
    timeScale: 1,
    zoom: 1,
    targetZoom: 1,
    yaw: -0.12,
    pitch: -0.08,
    targetYaw: -0.12,
    targetPitch: -0.08,
    centerOn: 'sun',
    showOrbits: true,
    showTrails: false,
    showLabels: true,
    performanceMode: false
  };

  const angles = Object.fromEntries(CELESTIAL_BODIES.map((body) => [body.id, Math.random() * TWO_PI]));
  const trails = Object.fromEntries(CELESTIAL_BODIES.map((body) => [body.id, []]));
  const textures = new Map();
  let width = 1;
  let height = 1;
  let frameId = 0;
  let previousFrameTime = performance.now();
  let frameObjects = [];
  let lastHoverId = null;
  let dragging = false;
  let pointerStart = null;
  let pointerMoved = false;
  let suppressClick = false;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const hardwareThreads = navigator.hardwareConcurrency || 4;
    const pixelRatio = window.devicePixelRatio || 1;
    const dpr = pixelRatio > 2.2 && hardwareThreads <= 2 ? 1 : Math.min(1.6, pixelRatio);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loadTextures() {
    for (const body of CELESTIAL_BODIES) {
      const image = new Image();
      image.onload = () => textures.set(body.id, image);
      image.onerror = () => console.warn(`Texture could not be loaded: ${body.texture}`);
      image.src = body.texture;
    }
  }

  function bodyWorldPosition(id) {
    if (id === MOON.id) {
      const earth = PLANETS.find((body) => body.id === 'earth');
      return {
        x: earth.distAU * Math.cos(angles.earth) + MOON.distAU * Math.cos(angles.moon),
        y: earth.distAU * Math.sin(angles.earth) + MOON.distAU * Math.sin(angles.moon)
      };
    }
    const body = PLANETS.find((candidate) => candidate.id === id);
    if (!body) return { x: 0, y: 0 };
    return { x: body.distAU * Math.cos(angles[id]), y: body.distAU * Math.sin(angles[id]) };
  }

  function projectWorldPosition(xAU, yAU) {
    let point = rotateY(
      auToWorld(xAU, width, height, state.zoom),
      auToWorld(yAU, width, height, state.zoom),
      0,
      state.yaw
    );
    point = rotateX(point.x, point.y, point.z, state.pitch);
    return project(point, CAMERA_Z, FOCAL_LENGTH);
  }

  function getCenterPan() {
    const target = bodyWorldPosition(state.centerOn);
    const projected = projectWorldPosition(target.x, target.y);
    return projected ? { x: projected.x, y: projected.y } : { x: 0, y: 0 };
  }

  function drawSunGlow(x, y, radius) {
    const gradient = context.createRadialGradient(x, y, radius * 0.2, x, y, radius * 4);
    gradient.addColorStop(0, 'rgba(255,245,200,0.98)');
    gradient.addColorStop(0.18, 'rgba(255,210,120,0.5)');
    gradient.addColorStop(0.45, 'rgba(255,150,60,0.14)');
    gradient.addColorStop(1, 'rgba(255,100,30,0)');
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius * 4, 0, TWO_PI);
    context.fill();
    context.restore();
  }

  function strokeOrbit(points) {
    if (!points.length) return;
    context.beginPath();
    context.setLineDash(state.performanceMode ? [5, 6] : [8, 6]);
    context.lineWidth = state.performanceMode ? 0.9 : 1.15;
    context.strokeStyle = state.performanceMode ? 'rgba(255,255,255,0.12)' : 'rgba(180,205,255,0.25)';
    let started = false;
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        started = false;
        continue;
      }
      if (!started) {
        context.moveTo(point.x, point.y);
        started = true;
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.closePath();
    context.stroke();
    context.setLineDash([]);
  }

  function drawTexture(body, x, y, radius) {
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, TWO_PI);
    context.closePath();
    context.clip();

    const image = textures.get(body.id);
    if (!state.performanceMode && image?.complete && image.naturalWidth > 0) {
      context.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
    } else {
      context.fillStyle = body.color;
      context.fill();
    }
    context.restore();
  }

  function drawLabel(name, x, y, radius, scale = 1) {
    if (!state.showLabels) return;
    context.save();
    context.font = `${Math.max(10, Math.round(11 * (1 + scale * 0.12)))}px Poppins, sans-serif`;
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(0,0,0,0.7)';
    context.fillText(name, x + radius + 7, y + 1);
    context.fillStyle = '#f4f7ff';
    context.fillText(name, x + radius + 6, y);
    context.restore();
  }

  function appendTrail(id, x, y) {
    const trail = trails[id];
    trail.push({ x, y });
    if (trail.length > MAX_TRAIL_POINTS) trail.shift();
    if (trail.length < 2) return;

    context.beginPath();
    trail.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = 'rgba(180,200,255,0.19)';
    context.lineWidth = 1;
    context.stroke();
  }

  function drawBody(body, screenX, screenY, radius, scale = 1) {
    drawTexture(body, screenX, screenY, radius);
    drawLabel(body.name, screenX, screenY, radius, scale);
    frameObjects.push({
      id: body.id,
      name: body.name,
      screenX,
      screenY,
      radius,
      description: body.description
    });
    if (state.showTrails && body.id !== 'sun') appendTrail(body.id, screenX, screenY);
  }

  function drawOrbits(centerX, centerY, pan) {
    if (!state.showOrbits) return;
    const steps = state.performanceMode ? 64 : 160;
    for (const body of PLANETS) {
      if (body.id === 'sun') continue;
      const points = new Array(steps);
      for (let index = 0; index < steps; index += 1) {
        const angle = (index / steps) * TWO_PI;
        const projected = projectWorldPosition(body.distAU * Math.cos(angle), body.distAU * Math.sin(angle));
        points[index] = projected
          ? { x: centerX + projected.x - pan.x, y: centerY + projected.y - pan.y }
          : { x: Number.NaN, y: Number.NaN };
      }
      strokeOrbit(points);
    }
  }

  function updateTooltip() {
    if (!tooltip || !lastHoverId) return;
    const hovered = frameObjects.find((object) => object.id === lastHoverId);
    if (!hovered) {
      tooltip.hidden = true;
      tooltip.style.display = 'none';
      lastHoverId = null;
      return;
    }
    const left = clamp(hovered.screenX + 18, 10, Math.max(10, width - 300));
    const top = clamp(hovered.screenY - 12, 10, Math.max(10, height - 100));
    tooltip.textContent = `${hovered.name}\n${hovered.description}`;
    tooltip.style.transform = `translate(${left}px, ${top}px)`;
    tooltip.hidden = false;
    tooltip.style.display = 'block';
  }

  function render(now) {
    const deltaTime = Math.min(0.05, Math.max(0, (now - previousFrameTime) / 1000));
    previousFrameTime = now;

    const interpolation = 0.12;
    state.yaw += (state.targetYaw - state.yaw) * interpolation;
    state.pitch += (state.targetPitch - state.pitch) * interpolation;
    state.zoom += (state.targetZoom - state.zoom) * 0.18;

    if (state.running) {
      for (const body of CELESTIAL_BODIES) {
        if (body.speed) angles[body.id] += body.speed * GLOBAL_SPEED * state.timeScale * deltaTime;
      }
    }

    context.clearRect(0, 0, width, height);
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const pan = getCenterPan();
    drawOrbits(centerX, centerY, pan);
    frameObjects = [];

    const sun = PLANETS[0];
    const sunProjected = projectWorldPosition(0, 0);
    if (sunProjected) {
      const sunX = centerX + sunProjected.x - pan.x;
      const sunY = centerY + sunProjected.y - pan.y;
      const sunRadius = sun.size * 2 * (1 + (state.zoom - 1) * 0.4);
      drawSunGlow(sunX, sunY, 80 * (1 + (state.zoom - 1) * 0.4));
      drawBody(sun, sunX, sunY, sunRadius, sunProjected.scale);
    }

    const visiblePlanets = PLANETS.slice(1).map((body) => {
      const world = bodyWorldPosition(body.id);
      const projected = projectWorldPosition(world.x, world.y);
      if (!projected) return null;
      return {
        body,
        x: centerX + projected.x - pan.x,
        y: centerY + projected.y - pan.y,
        scale: projected.scale,
        depth: projected.depth
      };
    }).filter(Boolean).sort((a, b) => a.depth - b.depth);

    for (const item of visiblePlanets) {
      const radius = item.body.size * 2;
      drawBody(item.body, item.x, item.y, radius, item.scale);
    }

    const moonWorld = bodyWorldPosition(MOON.id);
    const moonProjected = projectWorldPosition(moonWorld.x, moonWorld.y);
    if (moonProjected) {
      const moonX = centerX + moonProjected.x - pan.x;
      const moonY = centerY + moonProjected.y - pan.y;
      const moonRadius = Math.max(2, MOON.size * 2 * moonProjected.scale);
      drawBody(MOON, moonX, moonY, moonRadius, moonProjected.scale);
    }

    updateTooltip();
    frameId = window.requestAnimationFrame(render);
  }

  function findHoveredObject(x, y) {
    let nearest = null;
    for (const object of frameObjects) {
      const distance = Math.hypot(object.screenX - x, object.screenY - y);
      if (distance <= Math.max(6, object.radius + 6) && (!nearest || distance < nearest.distance)) {
        nearest = { object, distance };
      }
    }
    return nearest?.object ?? null;
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    pointerMoved = false;
    pointerStart = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    if (dragging && pointerStart) {
      const deltaX = event.clientX - pointerStart.lastX;
      const deltaY = event.clientY - pointerStart.lastY;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) pointerMoved = true;
      state.targetYaw += deltaX * 0.006;
      state.targetPitch = clamp(state.targetPitch + deltaY * 0.006, -Math.PI / 2 + 0.12, Math.PI / 2 - 0.12);
      pointerStart.lastX = event.clientX;
      pointerStart.lastY = event.clientY;
      return;
    }

    const hovered = findHoveredObject(localX, localY);
    if (hovered) {
      lastHoverId = hovered.id;
      canvas.style.cursor = 'pointer';
      tooltip.textContent = `${hovered.name}\n${hovered.description}`;
      const left = clamp(hovered.screenX + 18, 10, Math.max(10, width - 300));
      const top = clamp(hovered.screenY - 12, 10, Math.max(10, height - 100));
      tooltip.style.transform = `translate(${left}px, ${top}px)`;
      tooltip.hidden = false;
      tooltip.style.display = 'block';
    } else {
      lastHoverId = null;
      tooltip.hidden = true;
      tooltip.style.display = 'none';
      canvas.style.cursor = 'grab';
    }
  }

  function finishPointer() {
    if (!dragging) return;
    dragging = false;
    suppressClick = pointerMoved;
    pointerStart = null;
    canvas.style.cursor = 'grab';
  }

  function onClick(event) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const selected = findHoveredObject(event.clientX - rect.left, event.clientY - rect.top);
    if (selected) onSelect?.(selected.id);
  }

  function onWheel(event) {
    event.preventDefault();
    state.targetZoom = clamp(state.targetZoom * (1 - event.deltaY * 0.0012), 0.5, 10);
    onZoomChange?.(state.targetZoom);
  }

  function onPointerLeave() {
    if (dragging) return;
    lastHoverId = null;
    tooltip.hidden = true;
    tooltip.style.display = 'none';
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  resize();
  loadTextures();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerleave', onPointerLeave);
  frameId = window.requestAnimationFrame(render);

  return {
    setPaused(paused) { state.running = !paused; },
    setTimeScale(value) { state.timeScale = Number(value); },
    setZoom(value) { state.targetZoom = clamp(Number(value), 0.5, 10); },
    setShowOrbits(enabled) { state.showOrbits = Boolean(enabled); },
    setShowTrails(enabled) { state.showTrails = Boolean(enabled); },
    setShowLabels(enabled) { state.showLabels = Boolean(enabled); },
    setCenterOn(id) { state.centerOn = id; },
    setPerformanceMode(enabled) { state.performanceMode = Boolean(enabled); },
    reset() {
      state.running = true;
      state.timeScale = 1;
      state.zoom = 1;
      state.targetZoom = 1;
      state.yaw = -0.12;
      state.pitch = -0.08;
      state.targetYaw = -0.12;
      state.targetPitch = -0.08;
      state.centerOn = 'sun';
      state.showOrbits = true;
      state.showTrails = false;
      state.showLabels = true;
      state.performanceMode = false;
      for (const key of Object.keys(trails)) trails[key] = [];
    },
    saveImage() {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'neon-system-solar-view.png';
      link.click();
    },
    destroy() {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', finishPointer);
      canvas.removeEventListener('pointercancel', finishPointer);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    }
  };
}
