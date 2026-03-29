# TUNEXA GLOBAL CITY PLAN
## Two-phase roadmap: Public global city → Personal city layer

### Phase overview
- **Phase 1 (Sessions 1–6):** Public global city — no login required to explore, artist building claims, monetization
- **Phase 2 (Sessions 7–9):** Personal city layer — Last.fm username input highlights the user's artists on top of the existing global city. No separate city generated. No Spotify API needed.

---

## PIVOT SUMMARY

| | Before | After |
|---|---|---|
| Data source | Spotify OAuth (blocked) | Last.fm + MusicBrainz + TheAudioDB |
| Auth | Spotify OAuth PKCE | Supabase Auth (email/social) |
| Users | 25 max (dev mode) | Unlimited |
| City type | Personal listening city | Global artist city (public) |
| Building height | Listening time | Last.fm listener count (log-normalized) |
| Building width | Fixed (8 units) | MusicBrainz track count (log-normalized) |
| Monetization | Blocked | Artist building claim + premium dashboard |
| Spotify dependency | Full | Zero |

---

## FINALIZED BUILDING DIMENSIONS

```
height = log_normalize(last_fm_listeners, min=1000, max=10_000_000, out_min=1.0, out_max=20.0)
width  = log_normalize(musicbrainz_track_count, min=1, max=5000, out_min=0.5, out_max=6.0)
depth  = width (square base)
color  = genre → predefined color map (keep existing district color logic)
```

Real-time strategy: cached in Supabase, refreshed nightly via Railway cron job.
Last.fm: artist.getInfo → listeners (live, free, no auth)
MusicBrainz: initial load via full data dump, nightly API sync for active artists only

---

## NEW DATABASE SCHEMA

```sql
-- Replace spotify_id PK with uuid. Keep existing tables, add below.

-- Core artist table (populated from MusicBrainz dump + enriched)
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mbid TEXT UNIQUE,                    -- MusicBrainz ID
    name TEXT NOT NULL,
    lastfm_listeners INTEGER DEFAULT 0,  -- building height source
    track_count INTEGER DEFAULT 0,       -- building width source
    height FLOAT DEFAULT 1.0,            -- precomputed normalized
    width FLOAT DEFAULT 1.0,             -- precomputed normalized
    genre TEXT,
    sub_genres TEXT[],
    image_url TEXT,
    city_x FLOAT,                        -- precomputed grid position
    city_z FLOAT,
    last_updated TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Artist claim (for artist dashboard / monetization)
CREATE TABLE artist_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID REFERENCES artists(id),
    user_id UUID REFERENCES auth.users(id),
    verified BOOLEAN DEFAULT FALSE,
    tier TEXT DEFAULT 'free',            -- 'free' | 'premium'
    custom_color TEXT,
    bio_link TEXT,
    banner_text TEXT,
    stripe_subscription_id TEXT,
    claimed_at TIMESTAMP DEFAULT NOW()
);

-- Users (Supabase Auth handles auth.users, this is profile extension)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'fan',             -- 'fan' | 'artist'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Keep shared_cities table (still useful)
-- Drop friend_codes, friendships (unused, out of scope for phase 1)

-- Indexes for city query performance
CREATE INDEX idx_artists_genre ON artists(genre);
CREATE INDEX idx_artists_height ON artists(height DESC);
CREATE INDEX idx_artists_last_updated ON artists(last_updated);
```

RLS: Keep disabled, backend uses service_role key.

---

## API ENDPOINTS (NEW/CHANGED)

```
REMOVE:
GET  /login          - Spotify OAuth (gone)
GET  /callback       - Spotify callback (gone)
GET  /city_payload   - Spotify personal city (replaced)

KEEP:
GET  /health
POST /api/share
GET  /api/share/{token}

NEW:
GET  /city           - Paginated global city data
                       ?page=1&limit=500&genre=pop
                       Returns: artists[] with {id, name, x, z, height, width, color, image_url, claimed}

GET  /artist/{id}    - Single artist detail panel data
                       Returns: name, genre, listeners, track_count, image, bio_link, banner

GET  /search         - Artist name autocomplete
                       ?q=radiohead&limit=10

POST /auth/claim     - Claim an artist building
                       Body: { artist_id }
                       Auth: Bearer token required

PUT  /auth/claim/{id} - Update claimed building
                       Body: { bio_link, banner_text, custom_color }
                       Auth: Bearer + must own claim

GET  /artist/{id}/analytics - Engagement stats (premium only)
                       Returns: { views_7d, clicks_7d, unique_visitors }
```

Auth: Supabase JWT via Authorization: Bearer header (replaces Spotify token flow)

---

## SESSION PLAN

---

### PHASE 1: GLOBAL CITY (Sessions 1–6)
Public global city — no login required to explore, artist building claims, monetization.

---

### SESSION 1 — Data pipeline (Python scripts, run locally)
**Goal:** Populate Supabase artists table with 50k artists. No frontend changes.

**Tasks:**
1. Download MusicBrainz data dump (artists + release groups)
   - URL: https://data.metabrainz.org/pub/musicbrainz/data/json-dumps/
   - Parse artist MBID, name, type=Person/Group only
   - Extract release group count per artist → track_count
2. Write `scripts/import_musicbrainz.py`
   - Parse dump → insert into artists table in batches of 1000
   - Target: top 50k artists by release count
3. Write `scripts/enrich_lastfm.py`
   - For each artist: call Last.fm artist.getInfo?artist={name}&api_key=...
   - Write lastfm_listeners back to Supabase
   - Rate: 5 req/sec (Last.fm allows this), sleep(0.2) between calls
   - Estimated time: 50k × 0.2s = ~2.8 hours (run once)
4. Write `scripts/enrich_audiodb.py`
   - Fetch artist image_url from TheAudioDB free tier
   - Fallback: MusicBrainz cover art API
5. Write `scripts/compute_layout.py`
   - Log-normalize height and width values
   - Assign city_x, city_z grid positions (genre-based districts, same logic as current city_generator.py)
   - Write computed values back to Supabase

**Validation:**
```bash
# Should return 50k rows with non-null height, width, city_x, city_z
SELECT COUNT(*), AVG(height), AVG(width) FROM artists WHERE height IS NOT NULL;
```

**Do not change:** Any frontend files. Backend main.py, share.py.

---

### SESSION 2 — Backend pivot (FastAPI)
**Goal:** Replace Spotify endpoints with global city endpoints. Keep share endpoints working.

**Tasks:**
1. Remove from `main.py`: Spotify client init, /login, /callback routes
2. Replace `data.py` entirely → `city.py`
   - `GET /city` — query artists table, paginated, filterable by genre
   - `GET /artist/{id}` — single artist detail
   - `GET /search` — ilike query on artists.name
3. Update `main.py` CORS and router includes
4. Add Supabase Auth JWT verification middleware (replace Spotify token check)
   - Use supabase.auth.get_user(token) for protected routes
5. Keep `share.py` exactly as-is
6. Fix known issue: remove duplicate generate_grid_layout from city_generator.py
   - Keep city_generator.py only for layout utility functions, strip Spotify logic

**Do not change:** Frontend files. Database schema (sessions 1 set it up).

**Test:**
```bash
curl https://tunexa-production.up.railway.app/city?page=1&limit=10
curl https://tunexa-production.up.railway.app/search?q=radiohead
curl https://tunexa-production.up.railway.app/artist/{uuid}
```

---

### SESSION 3 — Frontend pivot (React + R3F)
**Goal:** City renders global data. Remove all Spotify auth UI. Add own login.

**Tasks:**
1. Replace `App.tsx` auth flow
   - Remove: Spotify login button, OAuth callback handler, friend code UI
   - Add: Supabase Auth UI (email/password + Google OAuth)
   - State: user (Supabase session), not Spotify token
2. Replace `CityView.tsx` data fetch
   - Remove: fetch(/city_payload) with Spotify auth header
   - Add: fetch(/city) paginated — load 500 buildings at a time, infinite scroll / LOD
   - Buildings now use artist.height and artist.width from API (not computed frontend)
3. Update `ArtistPanel.tsx`
   - Remove: Spotify audio preview, preview_url, play/stop button
   - Remove: Spotify popularity score
   - Add: Last.fm listener count display
   - Add: track count display
   - Add: "Claim this building" button (visible when logged in, artist not yet claimed)
   - Keep: artist image, name, genre badge
4. Keep `ShareView.tsx` exactly as-is
5. Update `config.ts` — no Spotify URLs needed

**Do not change:** CityView 3D rendering logic, building mesh geometry, window/floor logic, camera controls, share button logic.

---

### SESSION 4 — Nightly sync cron job
**Goal:** City stays live. Buildings update as artists grow.

**Tasks:**
1. Write `scripts/nightly_sync.py`
   - Query artists WHERE last_updated < NOW() - INTERVAL '24 hours' LIMIT 2000
   - For each: fetch Last.fm listeners (sleep 0.2s between calls)
   - For recently active artists (release in last 12 months): also fetch MusicBrainz track count
   - Recompute normalized height/width
   - Update Supabase row + last_updated timestamp
2. Add Railway cron job: runs nightly_sync.py at 02:00 UTC daily
3. Write `scripts/recompute_layout.py` (weekly)
   - Re-run log normalization across full dataset
   - Recompute city_x, city_z if any genre assignments changed
   - Railway cron: runs Sundays 03:00 UTC

**Estimated nightly load:** ~2000 artists × 0.2s = ~7 minutes. Well within Railway free tier.

**Do not change:** Any frontend or backend API files.

---

### SESSION 5 — Artist claim + dashboard
**Goal:** Artists can claim and customise their building. Free tier live.

**Tasks:**
1. Backend: add `POST /auth/claim` and `PUT /auth/claim/{id}` to new `claims.py` router
   - Verify user is logged in (Supabase JWT)
   - Check artist not already claimed
   - Insert into artist_claims table
   - Update artists.claimed = true
2. Frontend: add `ArtistDashboard.tsx`
   - Route: /dashboard (protected, role=artist)
   - Shows: claimed building preview, edit fields (bio_link, banner_text)
   - Free tier: bio link only
   - Premium lock icons on: custom color, banner, analytics (wired but locked)
3. Frontend: update ArtistPanel.tsx
   - Show "Claimed" badge if artist.claimed = true
   - Show bio_link and banner_text if set
   - Show "Claim this building" CTA if not claimed and user logged in
4. Add role selector on signup: "I'm a fan" / "I'm an artist or manager"

**Do not change:** City rendering, share flow, nightly sync.

---

### SESSION 6 — Monetization (Stripe)
**Goal:** Premium artist tier live. Revenue path open.

**Tasks:**
1. Add Stripe to backend: `payments.py`
   - POST /payments/create-checkout — creates Stripe checkout session
   - POST /payments/webhook — handles subscription events, updates artist_claims.tier
2. Frontend: `UpgradeModal.tsx`
   - Shown when artist clicks a locked premium feature
   - Stripe checkout redirect
3. Premium features unlock on tier='premium':
   - Custom building color (custom_color field)
   - Animated banner on building
   - Analytics tab in dashboard (views, clicks, unique visitors — tracked via simple counter on /artist/{id} hits)
4. Keep useSubscription hook already scaffolded — wire it to real Stripe tier

**Price:** €15/month per building. Stripe handles billing.

---

### PHASE 2: PERSONAL CITY (Sessions 7–9)
Personal city layer — Last.fm username input highlights the user's artists on top of the existing global city. No separate city generated.

### SESSION 7 — Personal City Integration
**Goal:** Users can input Last.fm username to highlight their personal listening data on the global city.

**Tasks:**
1. Add Last.fm username input field in user profile
2. Fetch user's top artists from Last.fm API
3. Highlight matching buildings in the global city (glow effect, different color)
4. Add "My Artists" filter toggle in city view
5. Show personal listening stats overlay

### SESSION 8 — Personal Analytics
**Goal:** Personal listening analytics and history.

**Tasks:**
1. Store user's Last.fm listening history in database
2. Create personal dashboard with:
   - Top genres breakdown
   - Listening trends over time
   - Artist discovery timeline
   - Comparison with global averages
3. Add shareable personal stats cards

### SESSION 9 — Social Features
**Goal:** Compare personal cities with friends.

**Tasks:**
1. Add friend system (using existing friendships table)
2. Compare listening overlap with friends
3. Show compatibility score
4. Shared exploration mode (fly through city together)
5. Activity feed: "Friend X discovered artist Y"

---

### PHASE 2: PERSONAL CITY (Sessions 7–9)
Last.fm username input highlights the user's artists on top of the existing global city. No separate city generated. No Spotify API needed.

### SESSION 7 — Personal city layer (Frontend)
**Goal:** Users can input Last.fm username to see their listening history overlaid on global city.

**Tasks:**
1. Add Last.fm username input field to user profile settings
2. Fetch user's top artists from Last.fm API (public endpoint, no auth needed)
3. Highlight user's buildings in global city view with glow effect
4. Add "My Artists" filter toggle in city view
5. Show listening stats overlay ("You listen to X of the top artists")

**Do not change:** Global city data, artist positions, building dimensions.

---

### SESSION 8 — Personal analytics dashboard
**Goal:** Users see their music journey stats.

**Tasks:**
1. Create `UserDashboard.tsx` component
2. Display: top genres, listening time trends, discovery timeline
3. Compare user stats to global averages
4. Share personal stats as image/card

---

### SESSION 9 — Social features polish
**Goal:** Friend comparisons and sharing.

**Tasks:**
1. Add friend system (using friend_codes table)
2. Compare cities with friends — show overlap percentage
3. Shared listening sessions visualization
4. Friend activity feed

---

## WHAT DOES NOT CHANGE (EVER)

- React Three Fiber city rendering core
- Building mesh geometry and window/floor logic
- Camera controls and navigation
- Share token system (share.py + ShareView.tsx)
- Vercel + Railway + Supabase deployment targets
- CORS configuration
- Log normalization formula

---

## ENVIRONMENT VARIABLES (UPDATED)

```bash
# Backend — remove Spotify vars, add Last.fm + MusicBrainz
LASTFM_API_KEY=                          # free at last.fm/api
MUSICBRAINZ_USERAGENT=Tunexa/1.0         # required by MusicBrainz ToS
AUDIODB_API_KEY=                         # free tier at theaudiodb.com
SUPABASE_URL=                            # unchanged
SUPABASE_SERVICE_KEY=                    # unchanged
FRONTEND_URL=https://tunexa.vercel.app   # unchanged
ALLOWED_ORIGINS=...                      # unchanged
STRIPE_SECRET_KEY=                       # new (session 6)
STRIPE_WEBHOOK_SECRET=                   # new (session 6)

# Remove entirely:
# SPOTIFY_CLIENT_ID
# SPOTIFY_CLIENT_SECRET
# SPOTIFY_REDIRECT_URI
# SESSION_SECRET

# Frontend
VITE_API_URL=https://tunexa-production.up.railway.app   # unchanged
VITE_SUPABASE_URL=                       # new — for Supabase Auth client
VITE_SUPABASE_ANON_KEY=                  # new — for Supabase Auth client
```

---

## KNOWN ISSUES (RESOLUTION)

| Issue | Resolution |
|---|---|
| PKCE verifier in-memory | Gone — no Spotify auth |
| No Redis caching | Nightly sync + Supabase cache eliminates need |
| Development Mode 25 user cap | Gone — no Spotify auth |
| Duplicate generate_grid_layout | Fix in Session 2 |
| No audio previews | Removed — no audio in global city |
| Friendships table orphaned | Leave for now, repurpose for social later |

---

## SUCCESS CRITERIA PER SESSION

| Session | Done when |
|---|---|
| **PHASE 1: GLOBAL CITY** ||
| 1 | SELECT COUNT(*) FROM artists returns ≥ 50000 with height + width populated |
| 2 | /city returns valid JSON, /search returns results, /health passes |
| 3 | tunexa.vercel.app loads global 3D city without Spotify login |
| 4 | Railway cron runs, last_updated values refresh nightly |
| 5 | Artist can sign up, claim building, add bio link — visible in city |
| 6 | Stripe checkout completes, premium features unlock in dashboard |
| **PHASE 2: PERSONAL CITY** ||
| 7 | User can input Last.fm username, their artists highlight on global city |
| 8 | Personal dashboard shows listening analytics and trends |
| 9 | Friend comparisons and social activity feed working |

