# Neon System — Solar System Visualizer

A cinematic, interactive Solar System visualizer originally built as a single HTML file in 2025. Version 2 reorganizes the project into a Vite-powered application with reusable celestial-body data and focused JavaScript modules.

## Features

- Animated Sun, eight planets and the Moon
- Drag to rotate the scene; scroll or use the zoom slider to zoom
- Pause, time-scale, focus-object, orbit, trail and label controls
- Texture rendering with a lightweight performance mode
- Planet information dialog with links to NASA science pages
- Optional background audio that starts only after pressing **Play**
- PNG export of the current canvas view
- Responsive control panel for desktop and mobile
- Visit count from an optional `/api/visits` endpoint, with a clearly labelled local fallback

> This is a cinematic visualization. Planet sizes, spacing and orbital speeds are intentionally adjusted for visibility and are not to scale.

## Requirements

- Node.js 18 or newer
- npm

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

The production-ready static site is written to `dist/`. For Vercel, use `npm run build` as the build command and `dist` as the output directory. The project does not require React or a separate runtime framework.

## Project structure

```text
public/
  audio/                 Background music files
  textures/              Sun, planet and Moon texture images
src/
  core/
    math.js              Projection, rotation and numeric helpers
    renderer.js          Canvas scene, animation, interaction and texture loading
  data/
    solar-system.js      Reusable celestial-body metadata
  services/
    audio.js             Explicit play, pause and track selection
    visits.js            Visit API integration and local fallback
  ui/
    controls.js          Sidebar controls and keyboard shortcuts
    planet-modal.js      Accessible planet details dialog
  main.js                Application entry point
  style.css              Application styles
index.html               App shell and accessible control markup
vite.config.js           Vite configuration
package.json             Scripts and development dependencies
```

## Visit counter note

The frontend requests `GET /api/visits` and accepts either `{ "count": 123 }` or `{ "value": 123 }`. There is no API implementation or persistent database in this repository. Until a server endpoint is configured on the deployment platform, the UI falls back to a per-browser `localStorage` count and labels it `local`; that number is not a global visitor total.

## Assets

Textures and audio are served from `public/textures/` and `public/audio/`. Keep asset names and casing in sync with the paths declared in `src/data/solar-system.js` and the audio selector in `index.html`.

## Notes

- The renderer uses the browser's Canvas 2D API; this migration does not claim to introduce a WebGL/Three.js 3D scene.
- NASA links are informational outbound links. Planet descriptions are short summaries for the visualizer.
- Audio is intentionally not autoplayed. A visitor must press **Play** to start it.
