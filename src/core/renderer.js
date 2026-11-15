import * as THREE from 'three';
import {
  CELESTIAL_BODIES, PLANETS, MOON, formatAU, formatAverageDistance
} from '../data/solar-system.js';
import { clamp, TWO_PI } from './math.js';

const GLOBAL_SPEED = 0.28;
const MODEL_UNITS_PER_AU = 1.15;
const MAX_TRAIL_POINTS = 72;
const ORBIT_SEGMENTS = 144;
const FOCUS_CAMERA_FACTOR = 0.72;

function orbitalCoordinates(body, eccentricAnomaly, target = new THREE.Vector3()) {
  const semiMajor = body.distAU * MODEL_UNITS_PER_AU;
  const eccentricity = body.orbitalEccentricity || 0;
  const semiMinor = semiMajor * Math.sqrt(1 - eccentricity * eccentricity);
  const inclination = THREE.MathUtils.degToRad(body.orbitalInclinationDeg || 0);
  const x = semiMajor * (Math.cos(eccentricAnomaly) - eccentricity);
  const planeY = semiMinor * Math.sin(eccentricAnomaly);
  return target.set(x, planeY * Math.sin(inclination), planeY * Math.cos(inclination));
}

function eccentricAnomalyFromMean(meanAnomaly, eccentricity) {
  let estimate = eccentricity < 0.8 ? meanAnomaly : Math.PI;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const error = estimate - eccentricity * Math.sin(estimate) - meanAnomaly;
    estimate -= error / (1 - eccentricity * Math.cos(estimate));
  }
  return estimate;
}

function createGlowTexture() {
  const surface = document.createElement('canvas');
  surface.width = 128;
  surface.height = 128;
  const context = surface.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,250,220,0.94)');
  gradient.addColorStop(0.16, 'rgba(255,208,132,0.52)');
  gradient.addColorStop(0.44, 'rgba(255,132,64,0.16)');
  gradient.addColorStop(1, 'rgba(255,92,40,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarPositions(count) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 260;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 150;
    positions[index * 3 + 2] = -65 - Math.random() * 105;
  }
  return positions;
}

function makeLabel(body) {
  const element = document.createElement('span');
  element.className = 'scene-label';
  const name = document.createElement('span');
  name.className = 'scene-label-name';
  name.textContent = body.name;
  element.appendChild(name);

  if (body.kind === 'planet' || body.kind === 'moon') {
    const distance = document.createElement('small');
    distance.className = 'scene-label-distance';
    distance.textContent = body.kind === 'moon' ? '384,400 km' : `${formatAU(body.distAU)} AU`;
    element.appendChild(distance);
  }
  element.hidden = true;
  return element;
}

function bodyDistanceLine(body) {
  if (body.kind === 'planet') {
    return `Average distance from Sun: ${formatAverageDistance(body)} (${formatAU(body.distAU)} AU)`;
  }
  if (body.kind === 'moon') return `Average distance from Earth: ${formatAverageDistance(body)}`;
  return 'The Sun is at the center of the Solar System.';
}

/**
 * Three.js renderer with linear AU-scaled orbits.
 * Shares sphere geometry, avoids shadows/post-processing, builds orbit buffers
 * once, and scales detail/resolution/frame rate down in Performance Mode.
 */
export function createSolarSystemRenderer({ canvas, tooltip, onSelect, onZoomChange }) {
  const host = canvas.parentElement;
  const hardwareThreads = navigator.hardwareConcurrency || 4;
  const smallScreen = window.matchMedia?.('(max-width: 820px)').matches ?? false;
  const lowPowerDevice = hardwareThreads <= 4 || smallScreen;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: false, antialias: !lowPowerDevice,
    powerPreference: lowPowerDevice ? 'low-power' : 'default',
    stencil: false, depth: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x050711, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050711);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 520);
  const systemRoot = new THREE.Group();
  systemRoot.rotation.order = 'YXZ';
  scene.add(systemRoot);

  const state = {
    running: true, timeScale: 1, zoom: 1, targetZoom: 1,
    yaw: -0.12, pitch: -0.30, targetYaw: -0.12, targetPitch: -0.30,
    centerOn: 'sun', showOrbits: true, showTrails: false,
    showLabels: true, performanceMode: false
  };

  const angles = Object.fromEntries(CELESTIAL_BODIES.map((body) => [body.id, Math.random() * TWO_PI]));
  const bodyGroups = new Map();
  const bodyMeshes = new Map();
  const bodyMaterials = new Map();
  const textures = new Map();
  const sphereMeshes = [];
  const atmosphereMeshes = [];
  const interactiveMeshes = [];
  const labelElements = new Map();
  const labelPositions = new Map();
  const trails = new Map();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const worldPoint = new THREE.Vector3();
  const focusPoint = new THREE.Vector3();

  let sphereGeometry = new THREE.SphereGeometry(1, lowPowerDevice ? 32 : 48, lowPowerDevice ? 22 : 32);
  let starField = null;
  let width = 1, height = 1;
  let baseCameraDistance = 100, currentCameraDistance = 100, targetCameraDistance = 100;
  let frameCount = 0, previousFrameTime = performance.now(), lastTrailTime = 0;
  let dragging = false, pointerStart = null, pointerMoved = false, suppressClick = false;
  let destroyed = false;

  scene.add(new THREE.HemisphereLight(0xb5c5ef, 0x111629, 1.12));
  const fillLight = new THREE.DirectionalLight(0x9eb7ff, 0.42);
  fillLight.position.set(-18, 24, 32);
  scene.add(fillLight);
  const sunlight = new THREE.PointLight(0xffe0b3, 82, 0, 2);
  systemRoot.add(sunlight);

  const textureLoader = new THREE.TextureLoader();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), lowPowerDevice ? 2 : 4);

  function loadTexture(body) {
    const texture = textureLoader.load(
      body.texture,
      undefined,
      undefined,
      () => {
        console.warn(`Texture could not be loaded: ${body.texture}`);
        const material = bodyMaterials.get(body.id);
        if (material) {
          material.map = null;
          material.color.set(body.color);
          material.needsUpdate = true;
        }
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    textures.set(body.id, texture);
    return texture;
  }

  function addAtmosphere(body, parent) {
    if (!body.atmosphereColor) return;
    const material = new THREE.MeshBasicMaterial({
      color: body.atmosphereColor, transparent: true,
      opacity: body.atmosphereOpacity || 0.14, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const shell = new THREE.Mesh(sphereGeometry, material);
    shell.scale.setScalar(1.10);
    shell.renderOrder = 2;
    shell.name = `${body.name} atmosphere`;
    parent.add(shell);
    sphereMeshes.push(shell);
    atmosphereMeshes.push(shell);
  }

  function addJupiterDetails(mesh) {
    const bandMaterial = new THREE.MeshBasicMaterial({
      color: 0xe4c5a0, transparent: true, opacity: 0.30,
      depthWrite: false, toneMapped: false
    });
    for (const radius of [0.986, 0.994]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 5, 72), bandMaterial);
      band.rotation.x = Math.PI / 2;
      band.renderOrder = 3;
      mesh.add(band);
    }
    const storm = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 14, 10),
      new THREE.MeshBasicMaterial({
        color: 0xb65d43, transparent: true, opacity: 0.86, toneMapped: false
      })
    );
    storm.position.set(0.34, 0.15, 0.918);
    storm.scale.set(1.35, 0.58, 0.24);
    storm.renderOrder = 4;
    storm.name = 'Great Red Spot detail';
    mesh.add(storm);
  }

  function addMarsPolarCap(mesh) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xf2e7dd, transparent: true, opacity: 0.58, toneMapped: false
      })
    );
    cap.position.set(0, 0.955, 0);
    cap.scale.set(0.82, 0.22, 0.82);
    cap.renderOrder = 4;
    cap.name = 'Mars polar cap detail';
    mesh.add(cap);
  }

  function addBody(body) {
    const group = new THREE.Group();
    group.name = `${body.name} group`;
    group.userData.bodyId = body.id;
    group.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg || 0);

    const texture = loadTexture(body);
    const material = body.kind === 'star'
      ? new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          map: texture, color: 0xffffff,
          roughness: body.kind === 'moon' ? 1 : 0.93, metalness: 0.005
        });
    bodyMaterials.set(body.id, material);

    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.name = body.name;
    mesh.userData.bodyId = body.id;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);

    group.scale.setScalar(body.visualRadius || 0.1);
    systemRoot.add(group);
    bodyGroups.set(body.id, group);
    bodyMeshes.set(body.id, mesh);
    sphereMeshes.push(mesh);
    if (body.kind !== 'star') interactiveMeshes.push(mesh);

    if (body.id === 'saturn') {
      const rings = new THREE.Mesh(
        new THREE.RingGeometry(1.24, 2.16, 96),
        new THREE.MeshBasicMaterial({
          color: 0xc9b48c, side: THREE.DoubleSide, transparent: true,
          opacity: 0.76, depthWrite: false, toneMapped: false
        })
      );
      rings.rotation.x = -Math.PI / 2;
      rings.position.y = 0.006;
      rings.renderOrder = 2;
      rings.name = 'Saturn rings';
      group.add(rings);
    }
    if (body.id === 'jupiter') addJupiterDetails(mesh);
    if (body.id === 'mars') addMarsPolarCap(mesh);
    addAtmosphere(body, mesh);
  }

  for (const body of CELESTIAL_BODIES) addBody(body);

  const glowTexture = createGlowTexture();
  textures.set('sun-glow', glowTexture);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xffd7a6, transparent: true, opacity: 0.60,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false
  }));
  sunGlow.scale.set(8.5, 8.5, 1);
  sunGlow.renderOrder = 3;
  systemRoot.add(sunGlow);

  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0x9fb9f5, transparent: true, opacity: 0.27, depthWrite: false
  });
  const orbitLines = [];
  for (const body of PLANETS) {
    if (body.kind === 'star') continue;
    const positions = new Float32Array(ORBIT_SEGMENTS * 3);
    for (let index = 0; index < ORBIT_SEGMENTS; index += 1) {
      const point = orbitalCoordinates(body, (index / ORBIT_SEGMENTS) * TWO_PI);
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.LineLoop(geometry, orbitMaterial);
    line.name = `${body.name} orbit (${formatAU(body.distAU)} AU)`;
    line.frustumCulled = false;
    systemRoot.add(line);
    orbitLines.push(line);
  }

  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0xaec9ff, transparent: true, opacity: 0.24, depthWrite: false
  });
  for (const body of CELESTIAL_BODIES) {
    if (body.kind === 'star') continue;
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS * 3), 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(geometry, trailMaterial);
    line.name = `${body.name} trail`;
    line.frustumCulled = false;
    line.visible = false;
    systemRoot.add(line);
    trails.set(body.id, { points: [], geometry, attribute, line });
  }

  const labelsLayer = document.createElement('div');
  labelsLayer.className = 'scene-labels';
  labelsLayer.setAttribute('aria-hidden', 'true');
  host.appendChild(labelsLayer);
  for (const body of CELESTIAL_BODIES) {
    const label = makeLabel(body);
    labelsLayer.appendChild(label);
    labelElements.set(body.id, label);
  }

  function buildStarField(count) {
    if (starField) {
      scene.remove(starField);
      starField.geometry.dispose();
      starField.material.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(createStarPositions(count), 3));
    const material = new THREE.PointsMaterial({
      color: 0xcbd9ff, size: lowPowerDevice ? 1.8 : 2.1,
      transparent: true, opacity: 0.76, sizeAttenuation: true,
      depthWrite: false, toneMapped: false
    });
    starField = new THREE.Points(geometry, material);
    starField.name = 'Slowly drifting background stars';
    starField.frustumCulled = false;
    scene.add(starField);
  }
  buildStarField(260);

  function resize() {
    if (destroyed) return;
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    // The outer 30.05 AU orbit fits with margin in landscape and portrait.
    baseCameraDistance = Math.max(100, 92 / Math.max(0.35, aspect));
    targetCameraDistance = baseCameraDistance * (state.centerOn === 'sun' ? 1 : FOCUS_CAMERA_FACTOR);
    const pixelRatio = state.performanceMode
      ? 1
      : Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1.25 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function bodyWorldPosition(id, target = new THREE.Vector3()) {
    const group = bodyGroups.get(id);
    return group ? target.copy(group.position) : target.set(0, 0, 0);
  }

  function updateBodyPositions(deltaTime) {
    for (const body of PLANETS) {
      const group = bodyGroups.get(body.id);
      const mesh = bodyMeshes.get(body.id);
      if (body.kind === 'star') group.position.set(0, 0, 0);
      else orbitalCoordinates(body, eccentricAnomalyFromMean(angles[body.id], body.orbitalEccentricity || 0), group.position);

      if (body.rotationPeriodHours) {
        const direction = Math.sign(body.rotationPeriodHours);
        const spin = 0.075 * (24 / Math.abs(body.rotationPeriodHours)) * direction;
        mesh.rotation.y += deltaTime * spin;
      }
    }

    const earthPosition = bodyGroups.get('earth').position;
    const moonGroup = bodyGroups.get(MOON.id);
    const moonRadius = MOON.visualOrbitRadius || 0.42;
    moonGroup.position.set(
      earthPosition.x + Math.cos(angles.moon) * moonRadius,
      earthPosition.y + Math.sin(angles.moon) * moonRadius * 0.08,
      earthPosition.z + Math.sin(angles.moon) * moonRadius
    );
    const moonPeriod = Math.abs(MOON.rotationPeriodHours || 655.7);
    bodyMeshes.get(MOON.id).rotation.y += deltaTime * 0.075 * (24 / moonPeriod);
  }

  function updateCamera(deltaTime) {
    const easing = 1 - Math.exp(-deltaTime * 3.3);
    currentCameraDistance += (targetCameraDistance - currentCameraDistance) * easing;
    camera.position.set(0, currentCameraDistance * 0.38, currentCameraDistance);
    camera.lookAt(0, 0, 0);
  }

  function updateSystemTransform(deltaTime) {
    systemRoot.rotation.y = state.yaw;
    systemRoot.rotation.x = state.pitch;
    systemRoot.scale.setScalar(state.zoom);
    bodyWorldPosition(state.centerOn, focusPoint);
    focusPoint.applyEuler(systemRoot.rotation).multiplyScalar(state.zoom).negate();
    const easing = 1 - Math.exp(-deltaTime * 4.5);
    systemRoot.position.lerp(focusPoint, easing);
  }

  function setTooltip(bodyId, clientX, clientY) {
    if (!tooltip) return;
    if (!bodyId) {
      tooltip.hidden = true;
      tooltip.style.display = 'none';
      return;
    }
    const body = CELESTIAL_BODIES.find((candidate) => candidate.id === bodyId);
    if (!body) return;
    const rect = host.getBoundingClientRect();
    const x = clamp(clientX - rect.left + 15, 8, Math.max(8, width - 300));
    const y = clamp(clientY - rect.top - 12, 8, Math.max(8, height - 100));
    tooltip.textContent = `${body.name}\n${body.description}\n${bodyDistanceLine(body)}`;
    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    tooltip.hidden = false;
    tooltip.style.display = 'block';
  }

  function pickBody(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const intersections = raycaster.intersectObjects(interactiveMeshes, false);
    return intersections.length ? intersections[0].object.userData.bodyId : null;
  }

  function updateLabels() {
    labelsLayer.hidden = !state.showLabels;
    if (!state.showLabels) {
      for (const label of labelElements.values()) label.hidden = true;
      labelPositions.clear();
      return;
    }
    labelPositions.clear();
    for (const body of CELESTIAL_BODIES) {
      const group = bodyGroups.get(body.id);
      const label = labelElements.get(body.id);
      if (!group || !label) continue;
      group.getWorldPosition(worldPoint);
      worldPoint.project(camera);
      const visible = worldPoint.z >= -1 && worldPoint.z <= 1 &&
        worldPoint.x > -1.08 && worldPoint.x < 1.08 &&
        worldPoint.y > -1.08 && worldPoint.y < 1.08;
      label.hidden = !visible;
      if (!visible) continue;
      const x = (worldPoint.x * 0.5 + 0.5) * width;
      const y = (-worldPoint.y * 0.5 + 0.5) * height;
      label.style.left = `${x.toFixed(1)}px`;
      label.style.top = `${y.toFixed(1)}px`;
      labelPositions.set(body.id, {
        x, y,
        text: body.kind === 'planet'
          ? `${body.name} · ${formatAU(body.distAU)} AU`
          : body.kind === 'moon' ? `${body.name} · 384,400 km` : body.name
      });
    }
  }

  function clearTrails() {
    for (const trail of trails.values()) {
      trail.points.length = 0;
      trail.geometry.setDrawRange(0, 0);
      trail.line.visible = false;
    }
  }

  function updateTrails(now) {
    if (!state.showTrails || now - lastTrailTime < (state.performanceMode ? 150 : 90)) return;
    lastTrailTime = now;
    for (const [id, trail] of trails) {
      const group = bodyGroups.get(id);
      if (!group) continue;
      const point = group.position;
      const previous = trail.points[trail.points.length - 1];
      if (previous && previous.distanceToSquared(point) < 0.00015) continue;
      trail.points.push(point.clone());
      if (trail.points.length > MAX_TRAIL_POINTS) trail.points.shift();
      const array = trail.attribute.array;
      for (let index = 0; index < trail.points.length; index += 1) {
        const value = trail.points[index];
        array[index * 3] = value.x;
        array[index * 3 + 1] = value.y;
        array[index * 3 + 2] = value.z;
      }
      trail.attribute.needsUpdate = true;
      trail.geometry.setDrawRange(0, trail.points.length);
      trail.line.visible = trail.points.length > 1;
    }
  }

  function changePerformanceMode(enabled) {
    const nextGeometry = new THREE.SphereGeometry(
      1, enabled ? 20 : (lowPowerDevice ? 32 : 48),
      enabled ? 14 : (lowPowerDevice ? 22 : 32)
    );
    for (const mesh of sphereMeshes) mesh.geometry = nextGeometry;
    sphereGeometry.dispose();
    sphereGeometry = nextGeometry;
    for (const atmosphere of atmosphereMeshes) atmosphere.visible = !enabled;
    buildStarField(enabled ? 110 : 260);
    if (enabled) clearTrails();
    resize();
  }

  function animate(now) {
    if (destroyed) return;
    if (document.hidden) {
      previousFrameTime = now;
      return;
    }
    if (state.performanceMode && now - previousFrameTime < 1000 / 30) return;

    const deltaTime = Math.min(0.05, Math.max(0, (now - previousFrameTime) / 1000));
    previousFrameTime = now;
    frameCount += 1;
    const motionDelta = state.running ? deltaTime * state.timeScale : 0;
    const easing = 1 - Math.exp(-deltaTime * 7.5);

    state.yaw += (state.targetYaw - state.yaw) * easing;
    state.pitch += (state.targetPitch - state.pitch) * easing;
    state.zoom += (state.targetZoom - state.zoom) * (1 - Math.exp(-deltaTime * 8));

    for (const body of CELESTIAL_BODIES) {
      if (body.kind !== 'star' && body.orbitalPeriodDays) {
        const relativeSpeed = 365.256 / body.orbitalPeriodDays;
        angles[body.id] += relativeSpeed * GLOBAL_SPEED * motionDelta;
      }
    }

    updateBodyPositions(motionDelta);
    updateSystemTransform(deltaTime);
    updateCamera(deltaTime);
    if (starField && state.running) {
      starField.rotation.y += deltaTime * 0.0013;
      starField.rotation.x += deltaTime * 0.00025;
    }
    updateTrails(now);
    if (frameCount % (state.performanceMode ? 3 : 2) === 0) updateLabels();
    renderer.render(scene, camera);
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
    if (dragging && pointerStart) {
      const dx = event.clientX - pointerStart.lastX;
      const dy = event.clientY - pointerStart.lastY;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) pointerMoved = true;
      state.targetYaw += dx * 0.0048;
      state.targetPitch = clamp(state.targetPitch + dy * 0.0048, -Math.PI / 2 + 0.12, Math.PI / 2 - 0.12);
      pointerStart.lastX = event.clientX;
      pointerStart.lastY = event.clientY;
      return;
    }
    const bodyId = pickBody(event.clientX, event.clientY);
    canvas.style.cursor = bodyId ? 'pointer' : 'grab';
    setTooltip(bodyId, event.clientX, event.clientY);
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
    const bodyId = pickBody(event.clientX, event.clientY);
    if (bodyId) onSelect?.(bodyId);
  }

  function onWheel(event) {
    event.preventDefault();
    state.targetZoom = clamp(state.targetZoom * (1 - event.deltaY * 0.0011), 0.5, 10);
    onZoomChange?.(state.targetZoom);
  }

  function onPointerLeave() {
    if (dragging) return;
    setTooltip(null);
  }

  function onVisibilityChange() {
    previousFrameTime = performance.now();
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(host);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerleave', onPointerLeave);

  if (tooltip) tooltip.hidden = true;
  resize();
  updateBodyPositions(0);
  updateSystemTransform(1);
  renderer.setAnimationLoop(animate);

  return {
    setPaused(paused) { state.running = !paused; },
    setTimeScale(value) { state.timeScale = clamp(Number(value), 0, 8); },
    setZoom(value) { state.targetZoom = clamp(Number(value), 0.5, 10); },
    setShowOrbits(enabled) {
      state.showOrbits = Boolean(enabled);
      for (const line of orbitLines) line.visible = state.showOrbits;
    },
    setShowTrails(enabled) {
      state.showTrails = Boolean(enabled);
      if (!state.showTrails) clearTrails();
    },
    setShowLabels(enabled) {
      state.showLabels = Boolean(enabled);
      updateLabels();
    },
    setCenterOn(id) {
      if (!bodyGroups.has(id)) return;
      state.centerOn = id;
      targetCameraDistance = baseCameraDistance * (id === 'sun' ? 1 : FOCUS_CAMERA_FACTOR);
    },
    setPerformanceMode(enabled) {
      const value = Boolean(enabled);
      if (state.performanceMode === value) return;
      state.performanceMode = value;
      changePerformanceMode(value);
    },
    reset() {
      state.running = true;
      state.timeScale = 1;
      state.zoom = 1;
      state.targetZoom = 1;
      state.yaw = -0.12;
      state.pitch = -0.30;
      state.targetYaw = -0.12;
      state.targetPitch = -0.30;
      state.centerOn = 'sun';
      state.showOrbits = true;
      state.showTrails = false;
      state.showLabels = true;
      targetCameraDistance = baseCameraDistance;
      if (state.performanceMode) {
        state.performanceMode = false;
        changePerformanceMode(false);
      }
      for (const line of orbitLines) line.visible = true;
      clearTrails();
      updateLabels();
    },
    saveImage() {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const exportWidth = Math.max(1, Math.floor(size.x));
      const exportHeight = Math.max(1, Math.floor(size.y));
      const target = new THREE.WebGLRenderTarget(exportWidth, exportHeight, {
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
        depthBuffer: true, stencilBuffer: false
      });
      const pixels = new Uint8Array(exportWidth * exportHeight * 4);
      const previousTarget = renderer.getRenderTarget();

      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, exportWidth, exportHeight, pixels);
      } catch (error) {
        console.error('Could not export the 3D scene:', error);
        return;
      } finally {
        renderer.setRenderTarget(previousTarget);
        target.dispose();
      }

      const output = document.createElement('canvas');
      output.width = exportWidth;
      output.height = exportHeight;
      const context = output.getContext('2d');
      if (!context) return;
      const imageData = context.createImageData(exportWidth, exportHeight);
      const rowBytes = exportWidth * 4;

      for (let row = 0; row < exportHeight; row += 1) {
        const start = (exportHeight - row - 1) * rowBytes;
        imageData.data.set(pixels.subarray(start, start + rowBytes), row * rowBytes);
      }
      context.putImageData(imageData, 0, 0);

      if (state.showLabels) {
        const pixelRatio = renderer.getPixelRatio();
        context.font = `${Math.round(10 * pixelRatio)}px Poppins, sans-serif`;
        context.textBaseline = 'middle';
        for (const position of labelPositions.values()) {
          context.fillStyle = 'rgba(0,0,0,0.8)';
          context.fillText(position.text, (position.x + 8) * pixelRatio + 1, position.y * pixelRatio + 1);
          context.fillStyle = '#f4f7ff';
          context.fillText(position.text, (position.x + 8) * pixelRatio, position.y * pixelRatio);
        }
      }

      const link = document.createElement('a');
      link.href = output.toDataURL('image/png');
      link.download = 'neon-system-solar-view.png';
      link.click();
    },
    destroy() {
      destroyed = true;
      renderer.setAnimationLoop(null);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', finishPointer);
      canvas.removeEventListener('pointercancel', finishPointer);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      labelsLayer.remove();

      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
        else if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      renderer.dispose();
    }
  };
}
