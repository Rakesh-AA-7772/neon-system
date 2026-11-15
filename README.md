# Neon System — Solar System Visualizer

A cinematic, interactive Solar System visualizer built with Vite and Three.js.

## Features

- Real 3D textured Sun, eight planets and the Moon
- Planetary orbit paths positioned from NASA's published mean Sun distances in AU
- Eccentric elliptical paths and orbital inclinations for a more realistic layout
- Average distance labels and a distance reference panel in AU and kilometres
- Atmospheric glow layers for Venus, Earth, Mars, Uranus and Neptune
- Saturn's rings, Jupiter's Great Red Spot and band accents
- Slowly drifting background stars and eased camera focus transitions
- Drag to rotate, scroll or slider to zoom, and click a planet for its details
- Pause, time-scale, focus-object, orbit, trail and label controls
- Performance mode with reduced sphere detail, fewer stars, disabled atmosphere layers, 1.0 pixel ratio and a 30 FPS cap
- No real-time shadows or post-processing effects
- WebGL 2 renderer with a Canvas 2D compatibility fallback
- Optional background audio (starts only after pressing Play)
- PNG export of the rendered view and responsive mobile controls

## Scientific scale notes

- Orbit radii are linear in AU, using the planets' published mean Sun distances (approximately their orbital semi-major axes).
- The table and planet labels show the real average distance in AU and kilometres.
- Planet visual radii are enlarged so they remain visible. Their diameters are not to scale with the orbit distances.
- The Moon's displayed separation from Earth is enlarged; its real average Earth distance (384,400 km) is shown in the tooltip and profile.
- Orbital paths use simplified ellipses. This is an educational visualization, not a real-time ephemeris or a prediction of exact planetary positions.

### Sources

- NASA, [Planet Sizes and Locations](https://science.nasa.gov/solar-system/planets/planet-sizes-and-locations-in-our-solar-system/)
- NASA, [The Solar System — mean planetary distances and orbital data](https://science.nasa.gov/learn/basics-of-space-flight/chapter1-2/)

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Vercel build command: `npm run build`. Output directory: `dist`.

## Project structure

```text
public/
  audio/
  textures/
src/
  core/
    math.js
    renderer.js
    renderer-2d.js
  data/
    solar-system.js
  services/
    audio.js
    visits.js
  ui/
    controls.js
    planet-modal.js
  main.js
  style.css
index.html
package.json
vite.config.js
```

## Performance approach

- Reuses one sphere geometry for body surfaces and atmosphere shells.
- Loads each surface texture once and reuses it.
- Builds orbit paths once rather than regenerating them every frame.
- Uses one `THREE.Points` star-field draw call.
- Caps device pixel ratio, adapts antialiasing to smaller devices, and skips rendering while the document is hidden.
- Performance Mode simplifies geometry, lowers the star count, hides atmosphere effects, uses a 1.0 pixel ratio and caps rendering at 30 FPS.
- Real-time shadows, bloom and post-processing are intentionally disabled.

## Visit counter note

The frontend requests `GET /api/visits` and accepts either `{ "count": 123 }` or `{ "value": 123 }`. No API or persistent database is included; until one is configured the interface uses a clearly labelled per-browser localStorage count.

## Assets

Texture and audio files are served from `public/textures/` and `public/audio/`. Keep names and letter casing in sync with the paths in the data module and audio selector. Confirm redistribution rights for third-party media before publishing.
