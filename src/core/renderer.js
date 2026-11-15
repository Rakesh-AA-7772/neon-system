import * as THREE from 'three';
import { CELESTIAL_BODIES, PLANETS, MOON } from '../data/solar-system.js';
import { clamp, TWO_PI } from './math.js';

const GLOBAL_SPEED = 0.28;
const MAX_TRAIL_POINTS = 72;
const ORBIT_SEGMENTS = 112;
const DISTANCE_SCALE = 1.1;
const BODY_SIZE_SCALE = 0.045;

function orbitalRadius(au) {
  return au <= 0 ? 0 : Math.pow(au, 0.92) * DISTANCE_SCALE;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,250,218,0.92)');
  gradient.addColorStop(0.18, 'rgba(255,204,122,0.48)');
  gradient.addColorStop(0.48, 'rgba(255,126,57,0.14)');
  gradient.addColorStop(1, 'rgba(255,88,34,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStarGeometry(count) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const u = Math.random() * 2 - 1;
    const angle = Math.random() * TWO_PI;
    const radial = 132 + Math.random() * 58;
    const horizontal = Math.sqrt(1 - u * u);
    positions[index * 3] = radial * horizontal * Math.cos(angle);
    positions[index * 3 + 1] = radial * u;
    positions[index * 3 + 2] = radial * horizontal * Math.sin(angle);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Three.js renderer for the cinematic Solar System.
 * Geometry, lighting and texture work is intentionally kept modest:
 * no real-time shadows, no post-processing and one shared sphere geometry.
 */
export function createSolarSystemRenderer({ canvas, tooltip, onSelect, onZoomChange }) {
  const sceneElement = canvas.parentElement;
  const hardwareThreads = navigator.hardwareConcurrency || 4;
  const isMobile = window.matchMedia?.('(max-width: 820px)').matches ?? false;
  const lowPowerDevice = hardwareThreads <= 4 || isMobile;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: !lowPowerDevice,
    powerPreference: lowPowerDevice ? 'low-power' : 'default',
    depth: true,
    stencil: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x050711, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050711);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 420);
  const systemRoot = new THREE.Group();
  systemRoot.rotation.order = 'YXZ';
  scene.add(systemRoot);

  const state = {
    running: true,
    timeScale: 1,
    zoom: 1,
    targetZoom: 1,
    yaw: -0.12,
    pitch: -0.32,
    targetYaw: -0.12,
    targetPitch: -0.32,
    centerOn: 'sun',
    showOrbits: true,
    showTrails: false,
    showLabels: true,
    performanceMode: false
  };

  const angles = Object.fromEntries(
    CELESTIAL_BODIES.map((body) => [body.id, Math.random() * TWO_PI])
  );
  const bodyGroups = new Map();
  const bodyMeshes = new Map();
  const bodyMaterials = new Map();
  const textures = new Map();
  const interactiveMeshes = [];
  const labelElements = new Map();
  const labelPositions = new Map();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const screenVector = new THREE.Vector3();
  let sphereGeometry = null;
  let stars = null;
  let width = 1;
  let height = 1;
  let frameCount = 0;
  let previousFrameTime = performance.now();
  let lastTrailTime = 0;
  let dragging = false;
  let pointerStart = null;
  let pointerMoved = false;
  let suppressClick = false;
  let lastHoverId = null;
  let destroyed = false;

  const ambientLight = new THREE.HemisphereLight(0xa7b9ef, 0x080b18, 0.78);
  scene.add(ambientLight);
  const sunlight = new THREE.PointLight(0xffd8aa, 30, 0, 2);
  sunlight.position.set(0, 0, 0);
  systemRoot.add(sunlight);
  const fillLight = new THREE.DirectionalLight(0x9abaff, 0.28);
  fillLight.position.set(-18, 22, 30);
  scene.add(fillLight);

  const textureLoader = new THREE.TextureLoader();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), lowPowerDevice ? 2 : 4);

  function loadBodyTexture(body) {
    const texture = textureLoader.load(
      body.texture,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = anisotropy;
      },
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

  function createSphereGeometry(performanceMode) {
    return new THREE.SphereGeometry(1, performanceMode ? 24 : (lowPowerDevice ? 36 : 48), performanceMode ? 16 : (lowPowerDevice ? 24 : 32));
  }

  function addPlanet(body) {
    const group = new THREE.Group();
    group.name = `${body.name} group`;
    group.userData.bodyId = body.id;
    const texture = loadBodyTexture(body);
    const material = body.kind === 'star'
      ? new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          roughness: 0.94,
          metalness: 0.01
        });
    bodyMaterials.set(body.id, material);

    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.name = body.name;
    mesh.userData.bodyId = body.id;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);

    const axialTilt = body.id === 'uranus' ? 1.42 : body.id === 'saturn' ? 0.16 : body.id === 'earth' ? 0.08 : 0.025;
    group.rotation.z = axialTilt;

    const radius = Math.max(0.12, body.size * BODY_SIZE_SCALE);
    group.scale.setScalar(radius);

    if (body.id === 'saturn') {
      const ringGeometry = new THREE.RingGeometry(1.28, 2.15, 88);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xcab38e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.66,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.015;
      ring.renderOrder = 2;
      group.add(ring);
    }

    systemRoot.add(group);
    bodyGroups.set(body.id, group);
    bodyMeshes.set(body.id, mesh);
    interactiveMeshes.push(mesh);
  }

  sphereGeometry = createSphereGeometry(false);
  for (const body of CELESTIAL_BODIES) addPlanet(body);

  const glowTexture = makeGlowTexture();
  textures.set('sun-glow', glowTexture);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffd5a1,
    transparent: true,
    opacity: 0.54,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  }));
  sunGlow.scale.set(10.5, 10.5, 1);
  sunGlow.renderOrder = 3;
  systemRoot.add(sunGlow);

  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0x9fb7f5,
    transparent: true,
    opacity: 0.25,
    depthWrite: false
  });
  const orbitLines = [];
  for (const body of PLANETS) {
    if (body.id === 'sun') continue;
    const radius = orbitalRadius(body.distAU);
    const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
    for (let index = 0; index <= ORBIT_SEGMENTS; index += 1) {
      const angle = (index / ORBIT_SEGMENTS) * TWO_PI;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.LineLoop(geometry, orbitMaterial);
    line.name = `${body.name} orbit`;
    line.frustumCulled = false;
    systemRoot.add(line);
    orbitLines.push(line);
  }

  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0xaec9ff,
    transparent: true,
    opacity: 0.23,
    depthWrite: false
  });
  const trails = new Map();
  for (const body of CELESTIAL_BODIES) {
    if (body.id === 'sun') continue;
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
  sceneElement.appendChild(labelsLayer);
  for (const body of CELESTIAL_BODIES) {
    const label = document.createElement('span');
    label.className = 'scene-label';
    label.textContent = body.name;
    label.hidden = true;
    labelsLayer.appendChild(label);
    labelElements.set(body.id, label);
  }

  function buildStarfield(count) {
    if (stars) {
      scene.remove(stars);
      stars.geometry.dispose();
      stars.material.dispose();
    }
    stars = new THREE.Points(
      makeStarGeometry(count),
      new THREE.PointsMaterial({
        color: 0xcbd9ff,
        size: state.performanceMode ? 0.48 : 0.58,
        transparent: true,
        opacity: 0.78,
        sizeAttenuation: true,
        depthWrite: false
      })
    );
    stars.name = 'Background stars';
    stars.frustumCulled = false;
    scene.add(stars);
  }
  buildStarfield(420);

  function resize() {
    if (destroyed) return;
    const rect = sceneElement.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const cameraDistance = Math.max(54, 52 / Math.max(0.42, aspect));
    camera.position.set(0, cameraDistance * 0.38, cameraDistance);
    camera.lookAt(0, 0, 0);

    const deviceRatio = window.devicePixelRatio || 1;
    const pixelRatio = state.performanceMode
      ? 1
      : Math.min(deviceRatio, lowPowerDevice ? 1.25 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
  }

  function bodyWorldPosition(id, target = new THREE.Vector3()) {
    if (id === MOON.id) {
      const earth = bodyGroups.get('earth');
      const earthPosition = earth ? earth.position : new THREE.Vector3();
      const moonRadius = orbitalRadius(MOON.distAU);
      return target.set(
        earthPosition.x + Math.cos(angles.moon) * moonRadius,
        0,
        earthPosition.z + Math.sin(angles.moon) * moonRadius
      );
    }
    const body = bodyGroups.get(id);
    return body ? target.copy(body.position) : target.set(0, 0, 0);
  }

  function updateBodyPositions(deltaTime) {
    for (const body of PLANETS) {
      const group = bodyGroups.get(body.id);
      const mesh = bodyMeshes.get(body.id);
      if (body.id === 'sun') {
        group.position.set(0, 0, 0);
      } else {
        const radius = orbitalRadius(body.distAU);
        group.position.set(
          Math.cos(angles[body.id]) * radius,
          0,
          Math.sin(angles[body.id]) * radius
        );
      }
      mesh.rotation.y += deltaTime * (0.14 + body.speed * 0.035);
    }

    const earth = bodyGroups.get('earth').position;
    const moonRadius = orbitalRadius(MOON.distAU);
    const moonGroup = bodyGroups.get(MOON.id);
    const moonMesh = bodyMeshes.get(MOON.id);
    moonGroup.position.set(
      earth.x + Math.cos(angles.moon) * moonRadius,
      0,
      earth.z + Math.sin(angles.moon) * moonRadius
    );
    moonMesh.rotation.y += deltaTime * 0.32;
  }

  function updateSystemTransform() {
    systemRoot.rotation.y = state.yaw;
    systemRoot.rotation.x = state.pitch;
    systemRoot.scale.setScalar(state.zoom);

    const target = bodyWorldPosition(state.centerOn);
    target.applyEuler(systemRoot.rotation).multiplyScalar(state.zoom).negate();
    systemRoot.position.lerp(target, 0.14);
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
    const rect = sceneElement.getBoundingClientRect();
    const x = clamp(clientX - rect.left + 15, 8, Math.max(8, width - 295));
    const y = clamp(clientY - rect.top - 12, 8, Math.max(8, height - 96));
    tooltip.textContent = `${body.name}\n${body.description}`;
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
      group.getWorldPosition(screenVector);
      screenVector.project(camera);
      const visible = screenVector.z >= -1 && screenVector.z <= 1 &&
        screenVector.x > -1.08 && screenVector.x < 1.08 &&
        screenVector.y > -1.08 && screenVector.y < 1.08;
      label.hidden = !visible;
      if (!visible) continue;
      const x = (screenVector.x * 0.5 + 0.5) * width;
      const y = (-screenVector.y * 0.5 + 0.5) * height;
      label.style.left = `${x.toFixed(1)}px`;
      label.style.top = `${y.toFixed(1)}px`;
      labelPositions.set(body.id, { x, y, name: body.name });
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
    if (!state.showTrails || now - lastTrailTime < (state.performanceMode ? 125 : 78)) return;
    lastTrailTime = now;
    for (const [id, trail] of trails) {
      const group = bodyGroups.get(id);
      if (!group) continue;
      const point = group.position;
      const points = trail.points;
      const previous = points[points.length - 1];
      if (previous && previous.distanceToSquared(point) < 0.0003) continue;
      points.push(point.clone());
      if (points.length > MAX_TRAIL_POINTS) points.shift();
      const array = trail.attribute.array;
      for (let index = 0; index < points.length; index += 1) {
        const value = points[index];
        array[index * 3] = value.x;
        array[index * 3 + 1] = value.y;
        array[index * 3 + 2] = value.z;
      }
      trail.attribute.needsUpdate = true;
      trail.geometry.setDrawRange(0, points.length);
      trail.line.visible = points.length > 1;
    }
  }

  function renderLabelsIfNeeded() {
    const labelInterval = state.performanceMode ? 3 : 2;
    if (frameCount % labelInterval === 0) updateLabels();
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

    state.yaw += (state.targetYaw - state.yaw) * 0.12;
    state.pitch += (state.targetPitch - state.pitch) * 0.12;
    state.zoom += (state.targetZoom - state.zoom) * 0.16;

    if (state.running) {
      for (const body of CELESTIAL_BODIES) {
        if (body.speed) angles[body.id] += body.speed * GLOBAL_SPEED * state.timeScale * deltaTime;
      }
    }

    updateBodyPositions(deltaTime);
    updateSystemTransform();
    updateTrails(now);
    renderLabelsIfNeeded();
    renderer.render(scene, camera);
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    pointerMoved = false;
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY
    };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }

  function onPointerMove(event) {
    if (dragging && pointerStart) {
      const deltaX = event.clientX - pointerStart.lastX;
      const deltaY = event.clientY - pointerStart.lastY;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) {
        pointerMoved = true;
      }
      state.targetYaw += deltaX * 0.0048;
      state.targetPitch = clamp(
        state.targetPitch + deltaY * 0.0048,
        -Math.PI / 2 + 0.12,
        Math.PI / 2 - 0.12
      );
      pointerStart.lastX = event.clientX;
      pointerStart.lastY = event.clientY;
      return;
    }

    const bodyId = pickBody(event.clientX, event.clientY);
    lastHoverId = bodyId;
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
    lastHoverId = null;
    setTooltip(null);
  }

  function onVisibilityChange() {
    previousFrameTime = performance.now();
  }

  function onPerformanceChange(enabled) {
    const nextGeometry = createSphereGeometry(enabled);
    for (const mesh of bodyMeshes.values()) mesh.geometry = nextGeometry;
    sphereGeometry.dispose();
    sphereGeometry = nextGeometry;

    buildStarfield(enabled ? 180 : 420);
    resize();
    if (enabled) clearTrails();
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null;
  resizeObserver?.observe(sceneElement);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerleave', onPointerLeave);

  tooltip && (tooltip.hidden = true);
  resize();
  updateBodyPositions(0);
  updateSystemTransform();
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
      for (const trail of trails.values()) trail.line.visible = state.showTrails && trail.points.length > 1;
      if (!state.showTrails) clearTrails();
    },
    setShowLabels(enabled) {
      state.showLabels = Boolean(enabled);
      updateLabels();
    },
    setCenterOn(id) {
      if (bodyGroups.has(id)) state.centerOn = id;
    },
    setPerformanceMode(enabled) {
      const nextValue = Boolean(enabled);
      if (state.performanceMode === nextValue) return;
      state.performanceMode = nextValue;
      onPerformanceChange(nextValue);
    },
    reset() {
      state.running = true;
      state.timeScale = 1;
      state.zoom = 1;
      state.targetZoom = 1;
      state.yaw = -0.12;
      state.pitch = -0.32;
      state.targetYaw = -0.12;
      state.targetPitch = -0.32;
      state.centerOn = 'sun';
      state.showOrbits = true;
      state.showTrails = false;
      state.showLabels = true;
      if (state.performanceMode) {
        state.performanceMode = false;
        onPerformanceChange(false);
      }
      for (const line of orbitLines) line.visible = true;
      for (const label of labelElements.values()) label.hidden = false;
      clearTrails();
    },
    saveImage() {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const exportWidth = Math.max(1, Math.floor(size.x));
      const exportHeight = Math.max(1, Math.floor(size.y));
      const target = new THREE.WebGLRenderTarget(exportWidth, exportHeight, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false
      });
      target.texture.colorSpace = THREE.SRGBColorSpace;
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

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportWidth;
      exportCanvas.height = exportHeight;
      const context = exportCanvas.getContext('2d');
      if (!context) return;
      const imageData = context.createImageData(exportWidth, exportHeight);
      const rowLength = exportWidth * 4;
      for (let row = 0; row < exportHeight; row += 1) {
        const sourceStart = (exportHeight - row - 1) * rowLength;
        imageData.data.set(pixels.subarray(sourceStart, sourceStart + rowLength), row * rowLength);
      }
      context.putImageData(imageData, 0, 0);

      if (state.showLabels) {
        const pixelRatio = renderer.getPixelRatio();
        context.font = `${Math.round(11 * pixelRatio)}px Poppins, sans-serif`;
        context.textBaseline = 'middle';
        for (const position of labelPositions.values()) {
          context.fillStyle = 'rgba(0,0,0,0.72)';
          context.fillText(position.name, (position.x + 9) * pixelRatio + 1, position.y * pixelRatio + 1);
          context.fillStyle = '#f4f7ff';
          context.fillText(position.name, (position.x + 9) * pixelRatio, position.y * pixelRatio);
        }
      }

      const link = document.createElement('a');
      link.href = exportCanvas.toDataURL('image/png');
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
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material?.dispose?.();
        }
      });
      orbitMaterial.dispose();
      trailMaterial.dispose();
      for (const texture of textures.values()) texture.dispose();
      renderer.dispose();
    }
  };
}
