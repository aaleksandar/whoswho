# whoswho

A guest board for Abu's friends. Until he's back: Friday 27 November 2026, 7:30pm+, 8 Dereham Place, London EC2A 3HJ.

Phone pages for the people in the room, a TV for the wall.

- **`/`** is the invite. Who, when, what to bring, RSVP. No profile yet. Edit the words in `src/event.js`.
- **`/hi`** is the card, filled at the party. Same phone that RSVP'd opens it directly. Another phone picks the name off the RSVP list. "Fill it in with your AI" copies the questions and pre-fills a reply. Nothing submits until Done.
- **`/night`** is the page for the night: build your card, check in, matches, directory, icebreakers, playlist.
- **`/home`** is the TV. Graph, map, needs, bringing. The QR opens `/night`. RSVPs without a card count in the bringing tally and stay off the graph.
- **`/hax0r`** is admin: edit or delete anyone, including the new fields, flip the views, reset the night. It also shows the door QR (`/night?door=1`), which checks in the phone that scans it.

Matching is offline. It scores shared communities (both in, or one in and one curious), a need against what someone offers or is already part of, the same London area, favourite spots that name the same place, and the older interest and music clusters. The TV graph uses those same edges. An optional LLM can rewrite the reason lines; the board works with the env vars unset.

`matchTags()` in `public/js/match.js` is the stable label list a later "night quests" feature can reuse.

## Quick start (LAN)

```sh
npm install
npm start
```

Open the Display URL on the TV and press **F**. Phones use the Join URL.

```sh
npm run seed:demo          # 20 demo guests. Not loaded on startup.
npm run seed:demo -- --clear
```

The first line of seed output is an edit token for Maya, so you can open `/night` as her on a laptop.

Copy `.env.example` to `.env` if you want a password or an invite code on the LAN too. Anything already in the shell wins over `.env`.

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Listen port |
| `DB_PATH` | `./whoswho.sqlite` | SQLite file |
| `ADMIN_PASSWORD` | unset on a LAN | Basic auth for `/hax0r`. **Required** when `PUBLIC_BASE_URL` or `PUBLIC_HOST` is a public host. The process refuses to start without it. |
| `PUBLIC_BASE_URL` | LAN IP | Origin used in QR codes and copied links, no trailing slash |
| `INVITE_CODE` | unset | When set, guest answers sit behind `/?invite=CODE`. Time, place and RSVP stay public. |
| `PLAYLIST_URL` | unset | Shared playlist linked from `/night`. No Spotify login. |
| `PUBLIC_HOST` | auto | LAN IP override if a VPN interface wins |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | unset | Optional rewrite of match reasons. Offline text is the fallback. |

**Privacy.** A postcode is stored for admin and placed at the district centroid plus a small fixed jitter. The public API never returns it. "Visiting" pins you near the party, not a home. Links are saved only when the consent box is ticked, and nothing is scraped. With `INVITE_CODE` set, `/api/guests`, the TV, registration and the night page all require the cookie. Every response sends `X-Robots-Tag: noindex` and `/robots.txt` disallows everything.

**Display keys.** `←` `→` switch view, `Space` pauses, `F` fullscreen, `Esc` clears a selection. Tabs: Connections, Map, Needs, Tonight.

**Map tiles** need internet (Esri). Borough outlines and pins work offline. Change `TILE_URL` in `public/js/views/map.js` to swap tiles.

## Deploy (do this before Friday)

Use **Fly.io**, London region, one always-on machine, SQLite on a volume. Railway and Render notes are below. Do not deploy without a persistent disk: the file is the whole party.

From a checkout of this repo:

```sh
# 1. Install the CLI and log in: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

# 2. The name in fly.toml is whoswho-sendoff. Change `app` if Fly says it is taken.
fly launch --no-deploy --copy-config --name whoswho-sendoff --region lhr

# 3. Persistent disk. The mount in fly.toml expects this name.
fly volumes create whoswho_data --region lhr --size 1

# 4. Secrets. PUBLIC_BASE_URL must be the https origin Fly gives you, no trailing slash.
fly secrets set \
  ADMIN_PASSWORD='pick-a-long-one' \
  INVITE_CODE='pick-a-short-one' \
  PUBLIC_BASE_URL='https://whoswho-sendoff.fly.dev' \
  PLAYLIST_URL='https://open.spotify.com/playlist/your-collaborative-playlist'

# 5. Boot. min_machines_running is 1, so it will not sleep on the night.
fly deploy
```

Then:

1. Open `https://<your-app>.fly.dev/?invite=<INVITE_CODE>` on your phone. You should see "Until I'm back", not a password prompt.
2. RSVP, then "Introduce yourself", then you should land on `/night`.
3. On the TV, open `https://<your-app>.fly.dev/home?invite=<INVITE_CODE>` once. The cookie sticks. Press **F**.
4. Admin is `https://<your-app>.fly.dev/hax0r` (any username, `ADMIN_PASSWORD`). Print or screenshot the **door QR** on that page and put it by the door. Scanning it on a phone that already registered checks that person in.
5. Text people `https://<your-app>.fly.dev/?invite=<INVITE_CODE>`. The code is the gate. The QR codes include it so a scan at the party works in one step. `/api/qr.svg` itself is behind the gate, so a stranger cannot download the code.

`ADMIN_PASSWORD` is mandatory on this URL. Leave `PUBLIC_BASE_URL` unset only when you are back on a living-room LAN.

### Railway

1. New project, deploy this repo. The `Dockerfile` and `railway.toml` are already there. Health check path is `/api/event`.
2. Add a volume mounted at `/data`.
3. Variables: `DB_PATH=/data/whoswho.sqlite`, `ADMIN_PASSWORD`, `INVITE_CODE`, `PUBLIC_BASE_URL` (the Railway `https://` domain, no trailing slash), `PLAYLIST_URL`. Railway sets `PORT`.
4. Turn off app sleeping if the plan has a toggle. A cold start on the night is a bad first impression.

### Render

`render.yaml` is a Docker web service with a 1GB disk at `/var/data` and `DB_PATH=/var/data/whoswho.sqlite`. A disk needs a paid instance. Set `ADMIN_PASSWORD`, `PUBLIC_BASE_URL`, `INVITE_CODE` and `PLAYLIST_URL` in the dashboard (they are `sync: false` on purpose). Free instances have no disk and they sleep.

## Development

```sh
npm run dev     # restart on file changes
npm test        # node:test
```

No build step. Node ≥ 22.13 (`node:sqlite`), Express 5, vanilla ES modules in the browser.

```
server.js                 routes, invite gate, SSE, public URL
src/event.js              the only place the party words live
src/db.js                 schema, validation, guests, RSVPs
src/deploy.js             LAN vs public, ADMIN_PASSWORD rule
src/invite.js             invite cookie
public/js/match.js        offline scoring, shared with the TV graph
public/js/catalog.js      chips: chapter, need, offer, interests, areas
public/js/views/          graph, map, needs, bringing
scripts/seed-demo.mjs     20 demo guests, opt-in
```

### Data sources

- **Postcode district centroids:** [postcodes.io](https://postcodes.io). OS data © Crown copyright and database right, Royal Mail data © Royal Mail copyright and database right, ONS data © Crown copyright (OGL v3).
- **Borough boundaries:** ONS Open Geography Portal, Local Authority Districts (May 2024) BGC (OGL v3).
- **Map tiles:** shaded relief © Esri.
- **Fonts:** Bangers and Comic Neue (SIL Open Font License).
