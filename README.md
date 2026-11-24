# whoswho: who's here?

A guest board for parties and meetups, hosted on your laptop and reachable from every device on the local network.

- **`/home`** is the big-screen display. It rotates between a **connection graph** (people linked by shared vibes), a **map** of London inside the M25, and a **needs** board of comic speech bubbles. A QR code in the corner points to `/hi`.
- **`/hi`** is guest registration, built for phones: name, a spirit animal (15 animals plus glasses, a hat and a background colour), a few lines about yourself, vibes (tap suggestions or add your own), what you need in life, and a postcode.
- **`/hax0r`** is the admin page: edit or delete guests, change display settings, reset the event.

Everything is stored in a single SQLite file, so a restart loses nothing. New registrations appear on the display instantly via Server-Sent Events.

## Quick start

```sh
npm install
npm start
```

The server prints the URLs to open on other devices, for example:

```
Display   http://192.168.1.23:3000/home
Register  http://192.168.1.23:3000/hi
Admin     http://192.168.1.23:3000/hax0r
```

Open the Display URL on the TV or projector and press **F** for fullscreen. Guests scan the QR code to register.

> **macOS:** the first time, you may be asked whether to let `node` accept incoming connections. Click **Allow**, or phones won't be able to connect.

Want something to look at first? `npm run seed` adds 20 sample guests (`npm run seed -- --clear` wipes existing guests first).

## Configuration

Settings come from environment variables, or from a `.env` file in the project folder. Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored, and anything already set in your shell wins over it.

| Env var          | Default            | Purpose                                                                                      |
|------------------|--------------------|----------------------------------------------------------------------------------------------|
| `PORT`           | `3000`             | Port to listen on (all interfaces)                                                           |
| `DB_PATH`        | `./whoswho.sqlite` | SQLite database file                                                                         |
| `ADMIN_PASSWORD` | *(unset)*          | Puts `/hax0r` and the admin API behind HTTP Basic auth (any username)                        |
| `PUBLIC_HOST`    | *(auto)*           | Overrides the auto-detected LAN IP used in the QR code (e.g. if a VPN interface gets picked) |

Set the event title, the seconds each view stays on screen, and which views are in rotation from `/hax0r`. Changes apply to the display live.

**Display controls:** click a view's tab (Connections · Map · Needs) to jump to it; the timer restarts and auto-rotation carries on. Keys: `←` `→` switch view · `Space` pause · `F` fullscreen · `Esc` clear a selection. The cursor hides after 3 s.

**Map view:** the **+** / **−** buttons on the right zoom in and out, you can drag the map to look around, and **⤢** goes back to all of London. The map starts from the full view each time it comes round. Zooming or dragging restarts the view's timer.

**Connections view:** click a face to see that person's profile in the side panel. Click a line (or any vibe in the panel) to pull everyone who shares that vibe into a labelled group. Each click restarts the view's timer, so it stays on screen while people explore.

## Privacy

- **Location:** guests are placed at the **district** level only, e.g. `E8` (Hackney), with a small fixed offset so people don't stack. A full postcode is accepted but never shown. The public API (`/api/guests`) omits it; only the admin page sees what was typed.
- **About text:** shown on the guest's profile on the display.
- **Rendering:** all guest text is rendered as text, never HTML.

## Offline / internet

- **Works without internet:** pages, D3, Leaflet, fonts, postcode lookup (a bundled table of ~360 districts inside the M25) and the London borough outlines all ship with the app.
- **Needs internet:** only the terrain tiles behind the map view (Esri World Shaded Relief, loaded by the display's browser). Without them, the map still shows London's borough outlines and names. To use a different tile server, change `TILE_URL` in `public/js/views/map.js`.

## Development

```sh
npm run dev     # restart on file changes
npm test        # unit + API tests (node:test)
```

No build step: Node ≥ 22.13 (uses the built-in `node:sqlite`), Express 5, and vanilla ES modules in the browser.

```
server.js              routes, REST API, SSE, startup banner
src/db.js              SQLite schema/migrations, validation, CRUD, settings
src/postcode.js        postcode → district centroid (+ jitter)
src/network.js         LAN IP detection
src/auth.js            optional Basic auth for admin
src/env.js             loads .env
pages/                 home / hi / hax0r HTML
public/js/avatar.js    spirit-animal SVG composer (shared by browser + server validation)
public/js/views/       graph (D3 force), map (Leaflet), needs (comic bubbles)
public/js/guest-form.js  form used by /hi and the admin edit dialog
data/                  bundled outcode centroids + borough boundaries
scripts/build-data.mjs regenerates data/ (postcodes.io + ONS, both OGL)
scripts/seed.mjs       sample guests
```

### Data sources

- **Postcode district centroids:** [postcodes.io](https://postcodes.io). Contains OS data © Crown copyright and database right, Royal Mail data © Royal Mail copyright and database right, and ONS data © Crown copyright (OGL v3).
- **Borough boundaries:** ONS Open Geography Portal, Local Authority Districts (May 2024) BGC (OGL v3).
- **Map tiles:** shaded relief © Esri.
- **Fonts:** Bangers and Comic Neue (SIL Open Font License).
