# Geocoding Tool

Electron desktop application for geocoding addresses in Bogotá, Colombia using the Google Geocoding API. See `README.md` for basic setup.

## Cursor Cloud specific instructions

### Running the app

- **Install deps:** `npm install`
- **Start app:** `npx electron . --no-sandbox` (must use `--no-sandbox` since the cloud VM runs as root)
- **Start with DevTools:** `NODE_ENV=development npx electron . --no-sandbox`

### Display server

Electron requires a display. Start Xvfb before launching:

```bash
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99
```

### Known non-blocking warnings

When running headless, you'll see D-Bus and GPU errors in the terminal output — these are harmless and do not affect app functionality:
- `Failed to connect to the bus: Could not parse server address`
- `Exiting GPU process due to errors during initialization`

### External dependencies

- **Google Geocoding API key** is required at runtime for actual geocoding. The app UI prompts for it. Without it, the app still launches and the map renders, but address lookups will fail.
- **Internet access** is needed for OpenStreetMap tiles and Google API calls.

### Build/packaging

- `npm run pack` — package into directory
- `npm run dist` — build distributable installers (Windows/Linux/macOS)

### Project structure

- `main.js` — Electron main process (window creation, IPC handlers)
- `preload.js` — Preload script (exposes `window.api`)
- `index.html` — Main UI (Bootstrap + Leaflet map)
- `js/geocoding.js` — Core geocoding logic
- `geojson/` — Directory for GeoJSON boundary files (spatial intersection)
