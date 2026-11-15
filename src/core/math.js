export const TWO_PI = Math.PI * 2;
export const MAX_ORBIT_AU = 30.05;

export function auToWorld(au, width, height, zoom, maxAU = MAX_ORBIT_AU) {
  // Linear AU mapping. maxAU changes only the camera window, never the AU values.
  // Planet radii are enlarged separately for visibility.
  const base = Math.min(width, height) * 0.42;
  const range = Number.isFinite(maxAU) && maxAU > 0 ? maxAU : MAX_ORBIT_AU;
  return (Number(au) / range) * base * zoom;
}

export function rotateY(x, y, z, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: x * cosine + z * sine, y, z: -x * sine + z * cosine };
}

export function rotateX(x, y, z, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x, y: y * cosine - z * sine, z: y * sine + z * cosine };
}

export function project(point, cameraZ, focalLength) {
  const depth = point.z + cameraZ;
  const denominator = focalLength + depth;
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  const scale = focalLength / denominator;
  return { x: point.x * scale, y: point.y * scale, scale, depth };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
