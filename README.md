# Neon System — 3D Solar System Visualizer

A cinematic, interactive Solar System visualizer built with Vite and Three.js. The project began as a single HTML experiment in 2025 and has been progressively reorganized into reusable modules.

## Features

- Real-time 3D Sun, eight planets and the Moon, using the original surface textures
- Saturn's ring system, soft solar glow and a lightweight star field
- Drag to rotate the scene; scroll or use the zoom slider to zoom
- Pause, time-scale, focus-object, orbit, trail and projected-label controls
- Performance mode with reduced sphere detail, fewer stars, a capped pixel ratio and a 30 FPS render limit
- Automatic lower-resolution settings on smaller / lower-core devices
- WebGL 2 renderer with a Canvas 2D compatibility fallback when WebGL 2 is unavailable
- Planet information dialog with links to NASA science pages
- Optional background audio that starts only after pressing **Play**
- PNG export of the rendered 3D scene
- Responsive control panel for desktop and mobile
- Optional `/api/visits` endpoint with a clearly labelled per-browser fallback

> The scene uses cinematic distances, planet sizes and orbital speeds for readability. It is not a scale model or an ephemeris.

## Requirements

- Node.js 18 or newer
- npm
- A browser with WebGL 2 for the 3D renderer. Browsers without WebGL 2 use the Canvas 2D fallback.

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local development URL in the terminal (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

The production-ready static site is written to `dist/`. For Vercel, use `npm run build` as the build command and `dist` as the output directory.

## Project structure

```text
public/
  audio/                 Background music files
  textures/              Sun, planet and Moon surface textures
src/
  core/
    math.js              Numeric helpers
    renderer.js          Three.js scene, camera, geometry and interaction
    renderer-2d.js       Lightweight compatibility renderer
  data/
    solar-system.js      Reusable celestial-body metadata
  services/
    audio.js             Explicit play, pause and track selection
    visits.js            Visit API integration and local fallback
  ui/
    controls.js          Sidebar controls and keyboard shortcuts
    planet-modal.js      Accessible planet details dialog
  main.js                App entry point and renderer fallback
  style.css              Application styles
index.html               Accessible application shell
vite.config.js           Vite configuration
package.json             Scripts and dependencies
```

## Performance decisions

- One shared sphere geometry is reused for every celestial body.
- Texture maps are loaded once and reused; anisotropic filtering is capped.
- Real-time shadows and post-processing / bloom are intentionally disabled.
- The star field is a single `THREE.Points` draw call.
- Orbit paths are generated once and reused rather than rebuilt every frame.
- Device pixel ratio is capped at 1.5 normally and 1.0 in Performance Mode.
- Performance Mode lowers sphere detail and star count and caps rendering at 30 FPS.
- The renderer pauses visual work while the page is hidden.
- Low-core and mobile devices use conservative antialiasing and pixel-ratio settings.

## Visit counter note

The frontend requests `GET /api/visits` and accepts either `{ "count": 123 }` or `{ "value": 123 }`. There is no API implementation or persistent database in this repository. Until a server endpoint is configured, the UI falls back to a per-browser `localStorage` count and labels it `local`; this is not a global visitor total.

## Assets and licensing

Textures and audio are served from `public/textures/` and `public/audio/`. Keep file names and casing in sync with the paths declared in `src/data/solar-system.js` and the audio selector in `index.html`. Confirm that you have the right to redistribute any third-party images or audio before publishing.

## Notes

- Three.js uses WebGL 2 for the main 3D renderer. A Canvas 2D renderer is retained as a compatibility fallback.
- NASA links are informational outbound links. Planet descriptions are short summaries for the visualizer.
- Audio is intentionally not autoplayed. A visitor must press **Play** to start it.
