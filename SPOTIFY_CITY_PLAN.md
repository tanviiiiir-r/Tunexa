# SPOTIFY CITY — COMPLETE IMPLEMENTATION PLAN
> **For Claude Code + Superpowers Plugin**  
> Read this entire file before writing a single line of code.  
> Use `/brainstorm` before each session. Use `/execute-plan` to run sessions. Use the code-reviewer agent after each major step.

---

## HOW TO USE THIS DOCUMENT WITH SUPERPOWERS

Each numbered session below is a `/execute-plan` unit. Before starting any session:
1. Run `/brainstorm` and reference the session goals below
2. Let Superpowers write a micro-task plan (2–5 minute chunks)
3. Follow TDD: write failing tests first, then implement
4. After each session's major step completes, trigger the code-reviewer agent
5. Do not proceed to the next session until tests pass and reviewer approves

Superpowers slash commands used in this project:
- `/brainstorm` — before any new feature or session
- `/execute-plan` — to run a planned session in isolated worktree
- `/debug` — four-phase root cause methodology, not random fixes
- `code-reviewer` agent — after each session completion

---

## PROJECT OVERVIEW

**Name:** Spotify City (deployed as Tunexa)  
**Live URLs:**  
- Frontend: https://tunexa.vercel.app  
- Backend: https://tunexa-production.up.railway.app  

**Local path:** `/Users/tanvir/CLAUDE CODE/Tunexa/`

**Stack:**
- Frontend: React + Vite + TypeScript + React Three Fiber + Drei
- Backend: FastAPI on Railway
- Database: Supabase (PostgreSQL) — migrating from SQLite
- Auth: Spotify OAuth PKCE, token in localStorage, Bearer headers
- Deployment: Vercel (frontend), Railway (backend)

---

## ACCESS MODEL — NON-NEGOTIABLE

| View | Auth Required | Notes |
|------|--------------|-------|
| Global City | ❌ No | Fully public. Anyone with the URL can explore 50K artists. |
| My City | ✅ Yes | Spotify login unlocks personal visualization |
| Friends | ✅ Yes | Both users must have logged in |
| Shared comparison links | ❌ No | Read-only snapshot, no login needed |

Global City is the viral growth engine. Never gate it. Login only unlocks personal features.

---

## CORE DATA RULES — NEVER DEVIATE

- **Building size in My City** = `followers` (log-normalized to height 10–150 units)
- **Building size in Global City** = `followers` (log-normalized to scale 1–20)
- **No listening time.** Spotify API does not provide this. Do not use proxies.
- **Color intensity in My City** = genre-relative rank from Spotify's ordering (Spotify returns artists in listening frequency order within the requested term. Rank within each genre group = intensity.)
- **No audio playback.** Ever. Spotify API restriction.
- **All Spotify API calls go through FastAPI backend only.** Never from frontend directly.

---

## MONETIZATION — DESIGN HOOKS NOW, BILL LATER

Architecture must support this from day one. No billing yet — just wire the gates.

**Free (no login):** Full Global City, artist name/genre/followers on click, shareable links  
**Free (with login):** My City (20 artists, medium term), basic artist panel, 1 friend  
**Premium (~$4/month — future):** 50 artists, all 3 time periods, top 5 tracks, unlimited friends, city embed links, annual Wrapped snapshot

**Implementation rule:** Create a `useSubscription` hook in frontend that returns `{ isPremium: boolean }`. Always returns `true` for now. Gate premium features behind this hook from day one. When Stripe/Lemon Squeezy is added later, only the hook changes.

**Plant these hooks:**
- "Upgrade" button in nav (placeholder, links to `/premium` — "Coming soon" page)
- Premium lock icon (gold `#FFD700`) on gated UI elements
- City embed share option (locked, greyed out) in share panel

---

## FREE SERVICES CONFIRMATION

All services used are free tier. Storage math confirmed:

| Service | Free Limit | Our Usage | Safe? |
|---------|-----------|-----------|-------|
| Supabase | 500MB DB, 50K MAU | ~30MB for 50K artists + indexes | ✅ Yes |
| Railway | 500 hours/month free | Low traffic hobby project | ✅ Yes |
| Vercel | Unlimited for hobby | Static frontend | ✅ Yes |
| Spotify API | Free, rate limited | Cache all responses 1hr TTL | ✅ Yes |

**Supabase free tier warning:** Projects pause after 7 days of inactivity. Keep the project active or upgrade to prevent pauses in production. The 50K `global_artists` rows with all fields and 3 indexes ≈ 30MB total — well within 500MB limit.

---

## SUPABASE SCHEMA

Run this SQL in the Supabase SQL editor **before any backend work begins.**

```sql
-- Enable trigram extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id text UNIQUE NOT NULL,
  display_name text,
  image_url text,
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Friend codes
CREATE TABLE friend_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(spotify_id),
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_friend_codes_code ON friend_codes(code);

-- Friend links (bidirectional — store A→B and B→A both)
CREATE TABLE friend_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a text NOT NULL,
  user_id_b text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id_a, user_id_b)
);
CREATE INDEX idx_friend_links_a ON friend_links(user_id_a);
CREATE INDEX idx_friend_links_b ON friend_links(user_id_b);

-- Shared cities (migrated from SQLite)
CREATE TABLE shared_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text UNIQUE NOT NULL,
  user_id text,
  city_data jsonb NOT NULL,
  time_range text,
  created_at timestamptz DEFAULT now()
);

-- Comparison shares
CREATE TABLE comparison_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Artist cache (Spotify API responses)
CREATE TABLE artist_cache (
  cache_key text PRIMARY KEY,
  data jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

-- Global artists (seeded once from Kaggle dataset)
CREATE TABLE global_artists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spotify_id text UNIQUE NOT NULL,
  name text NOT NULL,
  genres text[] DEFAULT '{}',
  primary_genre text NOT NULL DEFAULT 'default',
  popularity int DEFAULT 0,
  followers bigint DEFAULT 0,
  image_url text,
  pos_x float NOT NULL,
  pos_y float NOT NULL,
  pos_z float NOT NULL,
  cluster_id int NOT NULL,
  building_scale float NOT NULL
);
CREATE INDEX idx_global_artists_cluster ON global_artists(cluster_id);
CREATE INDEX idx_global_artists_pos ON global_artists(pos_x, pos_z);
CREATE INDEX idx_global_artists_name_trgm ON global_artists USING gin(name gin_trgm_ops);

-- Genre clusters
CREATE TABLE genre_clusters (
  id int PRIMARY KEY,
  genre_name text UNIQUE NOT NULL,
  color text NOT NULL,
  center_x float NOT NULL,
  center_y float NOT NULL,
  center_z float NOT NULL,
  radius float NOT NULL
);

-- RLS Policies

-- global_artists: public read, no client writes
ALTER TABLE global_artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read global_artists" ON global_artists FOR SELECT TO anon, authenticated USING (true);

-- genre_clusters: public read
ALTER TABLE genre_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read genre_clusters" ON genre_clusters FOR SELECT TO anon, authenticated USING (true);

-- All other tables: RLS on, backend service key only (no client policies needed)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_cache ENABLE ROW LEVEL SECURITY;
```

---

## RAILWAY ENVIRONMENT VARIABLES

Set all of these in the Railway dashboard before deploying:

```
SUPABASE_URL=<your supabase project url>
SUPABASE_SERVICE_KEY=<service role key — never expose to frontend>
SUPABASE_ANON_KEY=<anon key — safe for frontend public reads>
SPOTIFY_CLIENT_ID=<from Spotify developer dashboard>
SPOTIFY_CLIENT_SECRET=<from Spotify developer dashboard>
FRONTEND_URL=https://tunexa.vercel.app
SECRET_KEY=<random 32+ char string for JWT signing>
```

Vercel environment variables (frontend):
```
VITE_API_URL=https://tunexa-production.up.railway.app
VITE_SUPABASE_URL=<same supabase url>
VITE_SUPABASE_ANON_KEY=<anon key only — safe>
```

---

## BACKEND FILES

### `requirements.txt` additions
```
supabase==2.x.x
python-dotenv
colorsys  # stdlib, no install needed
```

---

### `main.py` changes
- Initialize Supabase client once at module level using `SUPABASE_SERVICE_KEY`
- Register routers: `auth`, `city`, `share`, `global_city`, `friends`
- Keep existing CORS config — do not modify

```python
from supabase import create_client
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
```

Pass `supabase` client to all routers via dependency injection or module import. Do not re-initialize per request.

---

### `auth.py` — additions only, do not touch OAuth/token logic

After successful login and user identity fetch, add:

1. **Upsert user:**
```python
supabase.table("users").upsert({
    "spotify_id": user["id"],
    "display_name": user["display_name"],
    "image_url": user["images"][0]["url"] if user["images"] else None
}, on_conflict="spotify_id").execute()
```

2. **Generate friend code if not exists:**
```python
existing = supabase.table("friend_codes").select("code").eq("user_id", spotify_id).execute()
if not existing.data:
    charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I
    for _ in range(3):  # retry up to 3x on collision
        code = "".join(secrets.choice(charset) for _ in range(6))
        try:
            supabase.table("friend_codes").insert({"user_id": spotify_id, "code": code}).execute()
            break
        except:
            continue
```

3. **Include `friend_code` in login response payload** so frontend can display it immediately.

---

### `data.py` — full rewrite spec

**`get_top_artists(token, time_range="medium_term", limit=50)`**
- Call Spotify `GET /me/top/artists?limit=50&time_range={time_range}`
- Return: list of `{ spotify_id, name, genres, popularity, followers, image_url }`
- Cache result in `artist_cache` with key `user:{spotify_id}:top:{time_range}` (TTL 1hr)
- Check cache first: if `cached_at` within 1hr, return cached data

**`get_top_tracks_for_artist(spotify_id, token=None)`**
- Cache key: `artist:{spotify_id}:tracks`
- If cached and fresh: return cached
- Call Spotify `GET /artists/{spotify_id}/top-tracks?market=from_token`
- Return top 5: `[{ name, popularity, duration_ms, album_name, album_image_url }]`
- Store in cache

**`get_recently_played_artist_ids(token)`**
- Call `GET /me/player/recently-played?limit=50`
- Extract artist ids where `played_at` is within last 7 days
- Return as Python `set`

**`map_to_primary_genre(genres_list)` — exported function, used by seeder too**

Check substrings in this exact priority order. Use `any(substr in g.lower() for g in genres_list)`:

```
1. "k-pop" or "korean pop" → "kpop"
2. "j-pop" or "japanese pop" → "jpop"
3. "pop" → "pop"
4. "hip hop" or "rap" or "trap" or "drill" → "hiphop"
5. "r&b" or "soul" or "funk" or "neo soul" → "rnb"
6. "rock" or "punk" or "grunge" → "rock"
7. "metal" or "hardcore" or "death metal" → "metal"
8. "electronic" or "edm" or "house" or "techno" or "drum and bass" or "dubstep" → "electronic"
9. "country" or "folk" or "americana" or "bluegrass" → "country"
10. "indie" → "indie"
11. "jazz" or "blues" or "swing" or "bossa nova" → "jazz"
12. "classical" or "orchestra" or "opera" → "classical"
13. "reggaeton" or "latin" or "salsa" or "bachata" → "reggaeton"
14. no match → "default"
```

**Cache TTL helper:**
```python
def is_cache_fresh(cached_at_str, ttl_minutes=60):
    cached_at = datetime.fromisoformat(cached_at_str)
    return (datetime.utcnow() - cached_at).total_seconds() < ttl_minutes * 60
```

---

### `city_generator.py` — full rewrite spec

**Input:** list of 50 artist dicts, set of recent_artist_ids  
**Output:** list of building dicts

**Step 1 — Followers normalization:**
```python
max_followers = max(a["followers"] for a in artists) or 1
for a in artists:
    a["followers_norm"] = math.log(a["followers"] + 1) / math.log(max_followers + 1)
    a["height"] = 10 + a["followers_norm"] * 140  # range 10–150
```

**Step 2 — Map primary genre:**
```python
a["primary_genre"] = map_to_primary_genre(a["genres"])
```

**Step 3 — Genre rank and intensity:**
```python
# Group by primary_genre, preserving original Spotify order (index in list)
# artists already ordered by Spotify: index 0 = most listened
from collections import defaultdict
genre_groups = defaultdict(list)
for i, a in enumerate(artists):
    genre_groups[a["primary_genre"]].append((i, a))  # (spotify_rank, artist)

for genre, group in genre_groups.items():
    group.sort(key=lambda x: x[0])  # sort by original spotify rank
    n = len(group)
    for local_rank, (_, a) in enumerate(group, start=1):
        a["genre_rank"] = local_rank
        a["genre_total"] = n
        raw = (1 - (local_rank - 1) / n) * 4
        a["intensity_level"] = max(1, min(4, math.ceil(raw)))
```

**Step 4 — Building color (HSL saturation modifier):**
```python
import colorsys

GENRE_COLORS = {
    "pop": "#FF69B4", "hiphop": "#8A2BE2", "rock": "#DC143C",
    "electronic": "#00CED1", "rnb": "#FF8C00", "country": "#228B22",
    "indie": "#9370DB", "metal": "#2F4F4F", "jazz": "#FFD700",
    "classical": "#F5F5DC", "kpop": "#FF6B9D", "jpop": "#FF1493",
    "reggaeton": "#FFD700", "default": "#808080"
}

INTENSITY_SATURATION = {4: 1.0, 3: 0.75, 2: 0.50, 1: 0.30}

def apply_intensity(hex_color, intensity_level):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4))
    h, s, l = colorsys.rgb_to_hls(r, g, b)
    s *= INTENSITY_SATURATION[intensity_level]
    if intensity_level <= 2:
        l = l + (0.65 - l) * (1 - intensity_level / 4)
    r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
    return "#{:02x}{:02x}{:02x}".format(int(r2*255), int(g2*255), int(b2*255))
```

**Step 5 — Grid layout:**
```python
# Group by primary_genre, sort groups by count desc
# Within each group, sort by followers desc (biggest building first)
# Row Z: row_index * 20
# Col X: (col_index - total_in_row/2) * 14
```

**Step 6 — is_recent:**
```python
a["is_recent"] = a["spotify_id"] in recent_artist_ids
```

**Output shape per building:**
```python
{
    "spotify_id": str,
    "name": str,
    "primary_genre": str,
    "genres": list,
    "popularity": int,
    "followers": int,
    "image_url": str,
    "height": float,          # 10–150
    "building_color": str,    # hex
    "intensity_level": int,   # 1–4
    "is_recent": bool,
    "grid_x": float,
    "grid_z": float
}
```

---

### `share.py` — migrate only

Replace all SQLite `INSERT`/`SELECT` with:
```python
supabase.table("shared_cities").insert({...}).execute()
supabase.table("shared_cities").select("*").eq("share_id", share_id).single().execute()
```
Logic unchanged.

---

### New: `global_city.py`

Router prefix: `/api/global`  
**All endpoints public — no auth required** (except `/my-highlights`)

**Module-level cluster cache:**
```python
_cluster_cache = None  # populated on first request, never changes

async def get_clusters_cached():
    global _cluster_cache
    if _cluster_cache is None:
        result = supabase.table("genre_clusters").select("*").execute()
        _cluster_cache = result.data
    return _cluster_cache
```

**Endpoints:**

`GET /clusters`
- Return `_cluster_cache` (all 14 genre clusters)
- No query params

`GET /artists`
- Params: `cluster_id` (int, optional), `limit` (default 500, max 1000), `offset` (default 0)
- Query: filter by cluster_id if provided, order by `followers DESC`
- Return fields: `spotify_id, name, primary_genre, cluster_id, pos_x, pos_y, pos_z, building_scale, popularity, followers`
- Do NOT include `image_url` (heavy, bulk endpoint)

`GET /nearby`
- Params: `x` (float), `z` (float), `radius` (float, max 2000)
- Query: `WHERE pos_x BETWEEN {x-radius} AND {x+radius} AND pos_z BETWEEN {z-radius} AND {z+radius}`
- Limit 200 results
- Returns same shape as `/artists`

`GET /artist/{spotify_id}`
- Returns all fields including `image_url`
- Fetches top 5 tracks via `get_top_tracks_for_artist` (uses cache)
- Public, no auth

`GET /search`
- Param: `q` (string, min 2 chars, validated)
- Query: `SELECT ... WHERE name ILIKE '%{q}%' LIMIT 10`
- Use parameterized query — **never string interpolation**
- Returns: `spotify_id, name, primary_genre, pos_x, pos_y, pos_z, building_scale`

`GET /my-highlights`
- **Requires auth Bearer token**
- Fetch user's top 50 artists (long_term) from Spotify or cache
- Query `global_artists` by spotify_id for each
- Return matches with global positions + building_scale
- Used to highlight user's artists neon green in global view

---

### New: `friends.py`

Router prefix: `/api/friends`  
All endpoints require auth.

`GET /code` — return current user's code from `friend_codes`

`POST /add`
- Body: `{ "code": "XK92PL" }`
- Validate: length 6, alphanumeric
- Lookup in `friend_codes`
- Checks: not found → 404 | self → 400 | already linked → 400
- Insert both (A→B) and (B→A) into `friend_links`
- Return friend's `display_name` and `image_url`

`GET /list`
- Query `friend_links WHERE user_id_a = current`
- Join `users` on `user_id_b = spotify_id`
- Join `friend_codes` on `user_id_b = user_id`
- Return: `[{ spotify_id, display_name, image_url, friend_code }]`

`GET /compare/{friend_spotify_id}`
- Verify friendship in `friend_links` → 403 if not friends
- Fetch current user top artists: cache key `user:{id}:top:medium_term`
- Fetch friend top artists: cache key `user:{friend_id}:top:medium_term`
  - If missing: 404 with message `"Friend hasn't visited recently — ask them to open their city first"`
- Compute:
  - `shared_ids = my_ids ∩ friend_ids`
  - `union_ids = my_ids ∪ friend_ids`
  - `score = round(len(shared_ids) / len(union_ids) * 100)`
  - `top_shared_genre` = most common `primary_genre` among shared artist objects
- Return: `{ my_artists, friend_artists, shared_artists, compatibility_score, top_shared_genre, friend_profile }`

`POST /share-comparison`
- Body: full comparison result
- Generate UUID share_id
- Insert into `comparison_shares`
- Return `{ share_id, share_url: "{FRONTEND_URL}/compare/{share_id}" }`

`GET /shared/{share_id}` — no auth required
- Query `comparison_shares` by share_id → 404 if not found

---

## SEEDING SCRIPT: `seed_global_artists.py`

**Run locally only. Never deploy to Railway.**  
**Run:** `python seed_global_artists.py --csv /path/to/kaggle_artists.csv`  
**Requirements:** `pip install pandas supabase python-dotenv`

```
Input CSV expected columns: id (spotify_id), name, genres, popularity, followers, image_url
```

**Steps:**

**1. Load and clean:**
```python
import ast, math, hashlib, time, secrets
import pandas as pd

df = pd.read_csv(csv_path)
df = df.rename(columns={"id": "spotify_id"})
df = df.dropna(subset=["spotify_id", "name", "followers"])
df = df[df["followers"] > 0]
df = df.drop_duplicates(subset="spotify_id")

def parse_genres(g):
    try:
        return ast.literal_eval(g) if isinstance(g, str) else []
    except:
        return []
df["genres"] = df["genres"].apply(parse_genres)
```

**2. Genre assignment:**
```python
from data import map_to_primary_genre  # import shared function

GENRE_TO_CLUSTER = {
    "kpop": 0, "jpop": 1, "pop": 2, "hiphop": 3, "rnb": 4,
    "rock": 5, "metal": 6, "electronic": 7, "country": 8,
    "indie": 9, "jazz": 10, "classical": 11, "reggaeton": 12, "default": 13
}

df["primary_genre"] = df["genres"].apply(map_to_primary_genre)
df["cluster_id"] = df["primary_genre"].map(GENRE_TO_CLUSTER)
```

**3. Compute 14 cluster centers using Fibonacci sphere:**
```python
import math

def fibonacci_sphere(n, radius=3000, y_flatten=0.4):
    points = []
    golden = math.pi * (1 + math.sqrt(5))
    for i in range(n):
        theta = math.acos(1 - 2*(i+0.5)/n)
        phi = golden * i
        x = math.sin(theta) * math.cos(phi) * radius
        y = math.cos(theta) * radius * y_flatten  # flatten Y — city is wide not tall
        z = math.sin(theta) * math.sin(phi) * radius
        points.append((x, y, z))
    return points

GENRE_ORDER = ["kpop","jpop","pop","hiphop","rnb","rock","metal","electronic","country","indie","jazz","classical","reggaeton","default"]
GENRE_COLORS = {
    "pop":"#FF69B4","hiphop":"#8A2BE2","rock":"#DC143C","electronic":"#00CED1",
    "rnb":"#FF8C00","country":"#228B22","indie":"#9370DB","metal":"#2F4F4F",
    "jazz":"#FFD700","classical":"#F5F5DC","kpop":"#FF6B9D","jpop":"#FF1493",
    "reggaeton":"#FFD700","default":"#808080"
}

centers = fibonacci_sphere(14)
cluster_rows = []
for i, genre in enumerate(GENRE_ORDER):
    cx, cy, cz = centers[i]
    cluster_rows.append({
        "id": i, "genre_name": genre, "color": GENRE_COLORS[genre],
        "center_x": cx, "center_y": cy, "center_z": cz, "radius": 800.0
    })

# Insert clusters first
supabase.table("genre_clusters").upsert(cluster_rows).execute()
```

**4. Compute per-artist positions:**
```python
max_followers = df["followers"].max()
CLUSTER_RADIUS = 800

def compute_position(row, centers):
    followers_norm = math.log(row["followers"] + 1) / math.log(max_followers + 1)
    building_scale = 1 + followers_norm * 19  # 1–20
    
    cluster_id = int(row["cluster_id"])
    cx, cy, cz = centers[cluster_id]
    
    # Deterministic angle from spotify_id hash (stable across re-runs)
    hash_val = int(hashlib.md5(row["spotify_id"].encode()).hexdigest(), 16)
    angle = (hash_val % 10000) / 10000 * 2 * math.pi
    
    # More followers = closer to cluster center
    dist = CLUSTER_RADIUS * (1 - followers_norm * 0.7)
    
    pos_x = cx + dist * math.cos(angle)
    pos_z = cz + dist * math.sin(angle)
    
    # Y jitter: deterministic small vertical offset
    hash_val2 = int(hashlib.md5(row["spotify_id"][::-1].encode()).hexdigest(), 16)
    pos_y = cy + ((hash_val2 % 100) - 50) * 0.4  # ±20 unit jitter
    
    return pos_x, pos_y, pos_z, float(building_scale)
```

**5. Batch insert (500 rows per batch):**
```python
records = []
for _, row in df.iterrows():
    px, py, pz, scale = compute_position(row, centers)
    records.append({
        "spotify_id": row["spotify_id"],
        "name": str(row["name"])[:200],
        "genres": row["genres"][:10],  # cap array size
        "primary_genre": row["primary_genre"],
        "popularity": int(row.get("popularity", 0)),
        "followers": int(row["followers"]),
        "image_url": str(row.get("image_url", ""))[:500] if pd.notna(row.get("image_url")) else None,
        "pos_x": px, "pos_y": py, "pos_z": pz,
        "cluster_id": int(row["cluster_id"]),
        "building_scale": scale
    })

BATCH = 500
for i in range(0, len(records), BATCH):
    batch = records[i:i+BATCH]
    supabase.table("global_artists").upsert(batch, on_conflict="spotify_id").execute()
    print(f"Inserted {min(i+BATCH, len(records))}/{len(records)}")
    time.sleep(0.1)  # rate limit courtesy

print("Done. Verifying...")
count = supabase.table("global_artists").select("id", count="exact").execute()
print(f"Total rows: {count.count}")
```

---

## FRONTEND FILES

### Color system (define as CSS variables in `index.css`)
```css
:root {
  --bg: #07070F;
  --surface: #0F0F1E;
  --surface-raised: #16162A;
  --border: rgba(255,255,255,0.08);
  --text: #FFFFFF;
  --text-muted: rgba(255,255,255,0.5);
  --accent: #1DB954;       /* Spotify green — CTAs */
  --premium: #FFD700;      /* Gold — premium lock icons */
  --neon: #39FF14;         /* My artists in Global City */
}
```

Typography: use system font stack only — `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. No external font loads.

---

### `App.tsx` — structural changes

**State:**
```typescript
const [token, setToken] = useState<string | null>(null)
const [currentView, setCurrentView] = useState<"global" | "my-city" | "friends">("global")
const [userProfile, setUserProfile] = useState<{ display_name: string; image_url: string; friend_code: string } | null>(null)
const [isPremium, setIsPremium] = useState(true) // always true for now
```

**On mount:**
- Check localStorage for token
- If present, validate via `GET /api/auth/me`
- If valid: set token + fetch profile (which includes friend_code from auth response)
- If invalid: clear token

**Nav bar (always visible):**
- Left: "🏙 Spotify City" wordmark
- Center tabs: "Global City" | "My City" 🔒 | "Friends" 🔒
- Lock icon on My City + Friends when not logged in. Clicking → trigger login.
- Right: If logged in → user avatar (36px circle) + copyable friend code chip. If not → "Connect Spotify" button (green).
- "Upgrade" button: outlined, subtle, right side. Links to `/premium` route.

**Routing:** Use state + URL query params (`?view=my-city`). Handle `/share/:id` and `/compare/:id` on mount by reading `window.location`.

**`useSubscription` hook (create in `hooks/useSubscription.ts`):**
```typescript
export function useSubscription() {
  // TODO: Wire to userProfile.is_premium when billing added
  return { isPremium: true }
}
```

---

### `CityView.tsx` — My City

**Auth gate:** If no token, render a centered CTA:
```
<div className="auth-gate">
  <h2>Your City Awaits</h2>
  <p>Connect Spotify to visualize your listening history as a 3D city.</p>
  <button onClick={triggerLogin}>Connect Spotify</button>
</div>
```

**Time toggle (below nav):**
Three buttons: "4 Weeks" | "6 Months" | "All Time"  
Maps to: `short_term` | `medium_term` | `long_term`  
Default: `medium_term`  
On click: set state, re-fetch `/api/city?time_range=`. Overlay loading spinner while city re-builds (preserve existing city underneath, do not blank).

**3D scene setup:**
```jsx
<Canvas camera={{ position: [0, 80, 150], fov: 60 }}>
  <fog attach="fog" args={['#0A0A0F', 100, 400]} />
  <ambientLight intensity={0.3} color="#1a1a2e" />
  <directionalLight position={[50, 100, 50]} intensity={1.0} castShadow />
  {/* Per-genre point lights */}
  {genreRows.map(row => (
    <pointLight key={row.genre} position={[row.centerX, 20, row.centerZ]}
      color={GENRE_COLORS[row.genre]} intensity={0.3} distance={80} />
  ))}
  <OrbitControls enableDamping dampingFactor={0.05} minDistance={20} maxDistance={500} />
  <Ground />
  <Buildings data={buildings} onBuildingClick={setSelectedArtist} />
  <GenreLabels rows={genreRows} />
</Canvas>
```

**Building geometry:**
- `BoxGeometry` — width 8, depth 8, height from `building.height`
- Material: `MeshStandardMaterial` color from `building.building_color`, emissive same color at 0.05
- Rooftop: separate flat box (8 × 0.4 × 8), color lightened 20%
- Windows for `is_recent=true`: 4–6 small `PlaneGeometry` meshes on faces, `MeshStandardMaterial` emissive `#FFFACD` intensity 0.8
- Windows for `is_recent=false`: same geometry, emissive intensity 0.05

**Ground:** Large `PlaneGeometry` rotated flat, color `#0A0A0F`

**Genre labels:** Drei `<Text>` component, genre name in all-caps, color = genre color at 60% brightness, Y = tallest building in row + 8, use `billboard` prop so label always faces camera

**onClick handler:** Each building mesh gets `onClick={(e) => { e.stopPropagation(); setSelectedArtist(building) }}`

---

### New: `ArtistPanel.tsx`

Fixed position right panel. Width 340px, full viewport height. Background: `rgba(10,10,20,0.95)`, backdrop-filter blur(20px). CSS `transform: translateX(0)` when open, `translateX(100%)` when closed — transition 300ms ease-out.

**Layout top to bottom:**
1. Close button (×) — top right, 32px, semi-transparent
2. Artist image — 120px circle, centered. Fallback: colored circle with first letter.
3. Artist name — 22px, white, bold, centered, 2-line max, ellipsis
4. Genre pills — flex-wrap, up to 3 pills. Pill background: genre color at 20% opacity. Text: genre color. 12px font.
5. Divider
6. Stats row (two columns):
   - Left: Followers formatted (`1.2M`, `840K`, `12.3K`, `4.5K`)
   - Right: Popularity as 10 dots, filled dots = floor(popularity/10)
7. `is_recent=true` badge: green dot + "Active this week" — 12px, shown only if true
8. Divider
9. "Top Tracks" heading (14px, muted)
   - Loading skeleton: 5 lines, shimmer animation
   - Loaded: numbered list 1–5. Row: `[number] [track name (bold)] [album name (muted)] [MM:SS right-aligned]`
10. Divider
11. "Open in Spotify" button — full width, Spotify green `#1DB954`, black text, 14px bold, border-radius 24px, opens `https://open.spotify.com/artist/{spotify_id}` in new tab

**Track loading:** `useEffect` on `selectedArtist`. Calls `GET /api/city/artist/{spotify_id}/tracks`. Sets `tracksLoading` and `tracks` state. Clears on panel close.

**Format helpers:**
```typescript
function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`
  return n.toString()
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

---

### New: `GlobalCityView.tsx`

**No auth required. Renders immediately for any visitor.**

**Load sequence:**
1. Fetch `/api/global/clusters` → 14 cluster objects. Render cluster name labels instantly.
2. Show pulsing ring at each cluster center while loading.
3. Load 2 clusters nearest to camera start position first.
4. Load remaining clusters in background, one at a time, 100ms gap between fetches.
5. If token present: fetch `/api/global/my-highlights` after all clusters done. Update instance colors.

**InstancedMesh — critical: use imperative API, not Drei's `<Instances>` wrapper**

```typescript
// One InstancedMesh per cluster (14 total)
// Declare refs: const meshRefs = useRef<THREE.InstancedMesh[]>([])
// Per cluster, in useLayoutEffect:

const dummy = new THREE.Object3D()
const color = new THREE.Color()
artists.forEach((artist, i) => {
  dummy.position.set(artist.pos_x, artist.pos_y, artist.pos_z)
  dummy.scale.set(artist.building_scale, artist.building_scale * 2.5, artist.building_scale)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  
  // 30% brightness of genre color for non-user artists
  color.set(GENRE_COLORS[artist.primary_genre])
  color.multiplyScalar(0.3)
  mesh.setColorAt(i, color)
})
mesh.instanceMatrix.needsUpdate = true
mesh.instanceColor!.needsUpdate = true
```

**My-artist highlighting:**
```typescript
// Store: Map<cluster_id, Set<instance_index>>
// In useFrame, for each cluster:
myArtistIndices.forEach(idx => {
  const pulse = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.08
  // retrieve matrix, multiply Y scale by pulse, set back
  mesh.getMatrixAt(idx, dummy.matrix)
  // decompose → modify scale.y → recompose → setMatrixAt
  mesh.setColorAt(idx, neonGreen) // #39FF14
  mesh.instanceMatrix.needsUpdate = true
  mesh.instanceColor!.needsUpdate = true
})
```

**LOD — cluster-level visibility toggle (run every 30 frames):**
```typescript
// frameCount % 30 === 0:
clusters.forEach((cluster, i) => {
  const dist = camera.position.distanceTo(new THREE.Vector3(cluster.center_x, cluster.center_y, cluster.center_z))
  meshRefs.current[i].visible = dist < 6000
})
```

**Camera controls (WASD):**
```typescript
// In useEffect: keydown adds to keysDown Set, keyup removes
// In useFrame:
const speed = keysDown.has("ShiftLeft") ? 12 : 4
const velocity = new THREE.Vector3()
if (keysDown.has("KeyW") || keysDown.has("ArrowUp")) {
  // get look direction projected onto XZ plane, normalize, multiply by speed
}
// similar for S, A, D
velocity.multiplyScalar(0.88) // friction
camera.position.add(velocity)
orbitControlsRef.current.target.add(velocity) // move target with camera
orbitControlsRef.current.update()
```

Camera start: `position(0, 1200, 2800)` looking at `(0, 0, 0)`

**Overlay UI (absolute positioned HTML, z-index above canvas):**

Search box (top-right):
- Text input, placeholder "Search any artist..."
- Debounce 300ms
- On query: `GET /api/global/search?q={q}`
- Dropdown: up to 10 results. Click → store `flyTarget: THREE.Vector3`
- In `useFrame`, if `flyTarget`: `camera.position.lerp(flyTarget, 0.02)` — smooth fly-to

Genre filter (top-left):
- Dropdown: "All Genres" + 14 genres
- On select: set `activeGenre` state
- In render: `meshRefs.current[i].visible = !activeGenre || clusters[i].genre_name === activeGenre`

Cluster legend (bottom-left):
- 14 small colored dots + genre names in a compact grid
- Clickable — same as genre filter

Login CTA (center-bottom, when not logged in):
- Small card: "Login to highlight your artists"
- Green "Connect Spotify" button
- Does not block the city view

Artist click:
- `onPointerDown` on Canvas
- Raycaster: `raycaster.intersectObjects(meshRefs.current, false)`
- On hit: `hit.instanceId` → lookup artist in loaded data → fetch `/api/global/artist/{spotify_id}` → set `selectedArtist` → render `ArtistPanel`

Reuse the same `ArtistPanel` component from My City.

---

### New: `FriendsView.tsx`

**Auth gate:** If no token, render CTA same style as My City gate.

**Layout:** Flex row — left panel (friend management) + right panel (comparison, hidden by default).

**Left panel:**

"Your Friend Code" card:
- Display: monospace font, letter-spacing 0.3em, font-size 28px, background `var(--surface-raised)`, rounded corners
- Copy button: clipboard icon, on click → `navigator.clipboard.writeText(code)` → show "Copied!" 2 seconds
- Subtitle: "Share this with friends to connect"

"Add Friend" card:
- Input: maxLength=6, autoUppercase (onChange → value.toUpperCase())
- "Add" button
- On submit: `POST /api/friends/add` → success toast (friend name + avatar) or inline error

Friends list:
- Fetch `GET /api/friends/list` on mount
- Each item: avatar (40px circle) + display_name (bold) + their code (muted, 12px) + "Compare ›" button
- Empty state: "No friends yet. Share your code to get started."

**Right panel — Comparison:**

Opens on "Compare" click. Fetches `GET /api/friends/compare/{friend_spotify_id}`.

Loading: spinner + "Building comparison..."

**Compatibility score:**
- Large centered number: count up from 0 to final over 1.5s using `setInterval`
- Color: `#1DB954` if >60, `#FFD700` if 30–60, `#DC143C` if <30
- Label: "Taste Match"

**Venn diagram (inline SVG, no library):**
```
Two overlapping circles. 
Left circle: user's top genre color, 50% opacity
Right circle: friend's top genre color, 50% opacity  
Overlap: white, 20% opacity
Overlap width: proportional to compatibility score
Label each section with count
```

**Artist grids (2D CSS grid, not 3D):**
- Two grids side by side, 5 columns × 10 rows = 50 cells each
- Each cell: 32px square, `background-color` = genre color at intensity level
- Shared artists: white 2px border + `box-shadow: 0 0 8px white`
- Hover: tooltip with artist name
- Label above: "Your City" | "{friend_name}'s City"

**Stats row (4 cards):**
- Shared artists: `{shared_artists.length}`
- Your top genre: `{my_artists[0]?.primary_genre}`
- Their top genre: `{friend_artists[0]?.primary_genre}`
- Overlap genre: `{top_shared_genre}`

**Share button:**
- `POST /api/friends/share-comparison` → get share_url
- `navigator.clipboard.writeText(share_url)`
- Button text → "Link copied!" for 2 seconds

**Shared comparison view** (route `/compare/:share_id`, no auth):
- On mount: read share_id from URL (`window.location.pathname`)
- Fetch `GET /api/friends/shared/{share_id}`
- Render same layout, read-only — no buttons except "View Global City"
- Banner: "Shared comparison — Connect Spotify to see your own city"

---

## IMPLEMENTATION SESSIONS

### Session 1 — Supabase setup + auth migration
```
Goals:
- Run schema SQL in Supabase
- Install supabase-py, initialize client in main.py
- Migrate share.py to Supabase
- Update auth.py: upsert users, generate friend codes, return code in login response
- Create useSubscription hook (returns isPremium: true)
- Verify: existing share links still work

TDD focus: test share create → retrieve round-trip
```

### Session 2 — Data layer + city generator
```
Goals:
- Rewrite data.py: 50 artists, map_to_primary_genre, caching, recently played, top tracks
- Rewrite city_generator.py: followers height, genre rank intensity, HSL color, grid layout
- Update /api/city to accept time_range param
- Add /api/city/artist/{id}/tracks endpoint

TDD focus: test genre mapping with edge cases (kpop vs pop priority),
test intensity levels for single-artist genres,
test grid X position centering
```

### Session 3 — My City frontend
```
Goals:
- Update CityView.tsx: auth gate, time toggle, new building geometry spec, click handlers,
  window lighting, fog, genre labels, lighting setup
- Create ArtistPanel.tsx: full component, lazy track loading, all format helpers

TDD focus: test formatFollowers, test formatDuration, test panel opens/closes on click
```

### Session 4 — Global City seeding
```
Goals:
- Write seed_global_artists.py from spec
- Test with 200 rows against Supabase dev
- Run full seed (50K rows)
- Verify: counts per cluster, building_scale range, sample positions

No TDD needed here — it's a one-time script. Verify with print statements.
```

### Session 5 — Global City backend
```
Goals:
- Create global_city.py with all 5 endpoints
- Register in main.py
- Module-level cluster cache

TDD focus: test /search with SQL injection attempt (should fail safely),
test /nearby bounding box returns artists within radius,
test /my-highlights requires auth
```

### Session 6 — Global City frontend (rendering)
```
Goals:
- Create GlobalCityView.tsx: InstancedMesh per cluster, imperative setup in useLayoutEffect
- Cluster lazy loading logic
- LOD visibility toggle (every 30 frames)
- My-artist pulse animation
- Camera start position

TDD focus: unit test camera velocity friction decay, unit test cluster distance calculation
```

### Session 7 — Global City frontend (overlay UI + nav)
```
Goals:
- Search box with 300ms debounce + dropdown + camera fly-to lerp
- Genre filter + cluster legend
- Artist click → raycaster → ArtistPanel reuse
- Login CTA overlay
- Nav view switching in App.tsx with auth guards

TDD focus: test debounce fires after 300ms, test route parsing for /compare/:id
```

### Session 8 — Friends backend
```
Goals:
- Create friends.py with all 6 endpoints
- Update data.py to cache user top artists on every city load
- Register router

TDD focus: test friend code uniqueness (mock collision), test compatibility score calculation,
test /compare returns 404 when friend cache missing
```

### Session 9 — Friends frontend
```
Goals:
- Create FriendsView.tsx: code display + copy, add friend form, friends list
- Comparison view: score animation, Venn SVG, artist grids, stats row
- Share flow: POST → copy URL to clipboard
- Shared comparison route (no auth)

TDD focus: test score count-up animation, test Venn overlap width calculation
```

### Session 10 — Polish + production readiness
```
Goals:
- Error boundaries for all fetch operations
- Skeleton loading states (shimmer CSS) for city, panel, comparison
- Mobile: disable Global City 3D on screens < 768px, show "Best on desktop" message
- /premium route: "Coming soon" page with feature list (teaser for paid tier)
- Upgrade button in nav
- Premium lock icons on gated UI elements (not functional yet)
- Environment variable audit: Railway + Vercel
- End-to-end smoke test: Global → login → My City → Friends → share comparison

TDD focus: test error boundary catches failed fetch and shows retry button
```

---

## CONSTRAINTS — INCLUDE IN EVERY CLAUDE CODE SESSION

Copy-paste this block into the start of every session:

```
HARD CONSTRAINTS FOR THIS SESSION:
1. Never touch token handling in auth.py or App.tsx auth logic
2. Never modify vercel.json or .env.production
3. Global City endpoints (/api/global/*) have NO auth requirement — do not add auth guards
4. /api/global/my-highlights is the ONLY global endpoint that requires auth
5. InstancedMesh must use imperative setMatrixAt/setColorAt in useLayoutEffect
   Do NOT use Drei's <Instances> wrapper — it causes CPU overhead at 50K objects
6. Building size = followers log-normalized in BOTH cities. No other data drives size.
7. No audio playback anywhere. No music preview. Spotify API restriction.
8. All Spotify API calls go through FastAPI backend only. Frontend never calls Spotify.
9. Supabase SERVICE KEY used only in backend. Frontend uses ANON KEY only.
10. map_to_primary_genre lives in data.py and is imported by seed script — do not duplicate
11. isPremium hook always returns true for now — never remove the hook
12. Supabase client initialized once at module level — not per request
13. Artist cache TTL: check cached_at in application layer — not database triggers
14. Friend link inserts are BIDIRECTIONAL: always insert both A→B and B→A rows
15. Use parameterized queries for all user input — never string interpolation in SQL
```

---

## GENRE COLOR PALETTE

```python
GENRE_COLORS = {
    "pop":        "#FF69B4",
    "hiphop":     "#8A2BE2",
    "rock":       "#DC143C",
    "electronic": "#00CED1",
    "rnb":        "#FF8C00",
    "country":    "#228B22",
    "indie":      "#9370DB",
    "metal":      "#2F4F4F",
    "jazz":       "#FFD700",
    "classical":  "#F5F5DC",
    "kpop":       "#FF6B9D",
    "jpop":       "#FF1493",
    "reggaeton":  "#FFD700",
    "default":    "#808080"
}
```

---

## OUT OF SCOPE — DO NOT IMPLEMENT

- Music Passport (geographic world map)
- Audio preview playback
- Real-time WebSocket updates
- Mobile AR/VR
- Screenshot/PNG export (V2)
- Minimap (V2)
- Bookmarks (V2)
- Full flight simulator controls with pitch/yaw (V2 — simplified WASD only for now)
- Artist verification or custom buildings
- Kubernetes, Go, or any backend language other than Python

---

## FEATURE PRIORITY ORDER

```
Phase 1: My City completion (Session 1–3)
Phase 2: Global seeding + backend (Session 4–5)
Phase 3: Global City frontend (Session 6–7)
Phase 4: Friends system (Session 8–9)
Phase 5: Polish (Session 10)
```

---

*Last updated: March 2026*  
*Stack: React + Vite + TypeScript + React Three Fiber + FastAPI + Supabase + Railway + Vercel*  
*All services on free tier. Supabase 500MB limit — 50K artist rows ≈ 30MB, safely within limit.*
