## Spotify City – Project Milestones

**Milestone 1: Project Scaffold**
- Initialize React + Vite frontend
- Initialize FastAPI backend
- Set up folder structure (frontend / backend, shared / utils, etc.)
- Create a simple health‑check endpoint in FastAPI (`/health`) and call it from the React app
**Done when:** Browser shows “Spotify City API connected ✅”

**Milestone 2: Spotify OAuth**
- Register a Spotify developer app and obtain client ID & client secret
- Implement PKCE OAuth flow in FastAPI (authorize, token exchange, refresh)
- Store the access token securely in a server‑side session (encrypted cookie)
- Add a `/me` endpoint that returns the user’s Spotify profile (display name, avatar)
- Frontend triggers login, receives profile, and displays the display name
**Done when:** User can log in and see their Spotify display name on screen

**Milestone 3: Spotify Data Fetch**
- FastAPI calls Spotify `/me/top/artists?limit=20&time_range=medium_term`
- FastAPI calls `/me/top/tracks?limit=50`
- FastAPI calls `/me/player/recently-played?limit=50`
- FastAPI fetches audio features for the top tracks (`/audio-features`)
- Assemble a normalized JSON payload (`city_payload`) that includes artists, tracks, recent plays, and audio features
- Frontend logs the payload to the console
**Done when:** Frontend console logs a clean `city_payload` JSON object

**Milestone 4: City Generation Logic**
- Add `franc` language‑detection to map each artist name to a language code
- Translate language code → country code using the mapping table from the spec
- Map each artist’s primary genre to a predefined city within the country (genre‑city mapping)
- Compute building dimensions: height = listening minutes, width = song count, depth = normalized factor
- Compute building style: color = energy + valence, brightness = popularity, animation flag = recently‑played (7 days)
- Generate radial layout positions (x, z) for “My City” mode according to the genre‑district rules
**Done when:** `city_payload` now includes `position.x/z` and a full building schema for every artist

**Milestone 5: Basic 3D Render**
- Set up a React Three Fiber `<Canvas>` in the frontend
- For each artist, render a `<BoxGeometry>` using the calculated height, width, depth
- Apply the computed color material to each box
- Add `<OrbitControls>` (pan, zoom, rotate) from Drei
**Done when:** After login, the browser displays a 3D city of colored boxes representing the user’s artists

**Milestone 6: Districts**
- Group buildings by genre district based on the layout generated in Milestone 4
- Render a colored floor plane for each district (e.g., `<Plane>` with district‑specific color)
- Add a text label for each district using Drei’s `<Text>` component
- Space districts radially from the city center according to the spec (top genre at center, others around)
**Done when:** The city visually shows distinct colored zones (districts) with labels for each genre

**Milestone 7: Building Interaction**
- Use a raycaster to detect clicks on a building mesh
- On click, open a side panel that displays: artist name, image, genres, popularity, and a “Play preview” button
- When the preview button is pressed, play the 30‑second Spotify preview URL (via HTML Audio)
- Clicking outside the panel closes it
**Done when:** Clicking a building plays its preview and shows an info panel; panel dismisses on click‑away

**Milestone 8: Glow + Animation**
- Identify buildings whose `last_played` date is within the past 7 days
- Apply a pulse animation (scale + emissive intensity) to those buildings using Drei’s `<Pulse>` or custom shader
- Map popularity (0–100) to material emissive brightness for all buildings
**Done when:** Some buildings are pulsating/glowing (recently played) while others appear dimmer, giving the city a “alive” feel

**Milestone 9: Share Feature**
- Add an endpoint that generates a unique share token (UUID) on demand
- Persist a snapshot of the full `city_payload` (JSON) to PostgreSQL linked to the token
- Create a public read‑only route (`/share/:token`) that retrieves the snapshot and renders the city without requiring Spotify login
- Frontend adds a “Share” button that copies the shareable URL to the clipboard
**Done when:** A shareable URL loads another user’s city in read‑only mode without any login flow

**Milestone 10: Deploy**
- Deploy the FastAPI backend to Railway (or Fly.io) with environment variables for Spotify client ID/secret, DB URL, etc.
- Deploy the React + Vite frontend to Vercel (or Netlify) with the backend base URL configured
- Set up required environment variables in both platforms (Spotify keys, DB connection, JWT secret)
- Run a smoke test: login, generate city, share URL, and load shared city on production URLs
**Done when:** Full app works end‑to‑end on production URLs (login → city rendering → share → read‑only view).