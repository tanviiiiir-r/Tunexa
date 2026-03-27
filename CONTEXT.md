# Spotify City — Project Context & Constraints

## Developer
- Solo developer, final-year ICT student
- Strong: Python, FastAPI, Docker, Linux, AI agents
- Learning: React Three Fiber, Three.js
- Goal: Ship MVP fast, iterate after

---

## MVP Scope (Build This First)

**Personal City — "My City" mode only (radial layout, genre districts)**

### In Scope
- Spotify OAuth (PKCE flow via backend)
- Fetch: top 20 artists, top 50 tracks, audio features, recently played
- Language detection per artist (assign to country)
- Genre → city assignment per artist
- My City rendering: radial layout, genre districts, artist buildings
- Building click → artist info panel + 30s audio preview
- Share via unique URL (static snapshot)

### Out of Scope for MVP
- Global City (50K artists)
- Music Passport view (world map)
- Districts (sub-genres) — skip unless trivially easy
- City evolution over time
- Friend comparison
- Monetization
- Mobile optimization

---

## MVP Timeline (10 Days)

| Day | Task |
|-----|------|
| 1 | Spotify OAuth + data fetching (FastAPI) |
| 2 | Language detection + country/city assignment logic |
| 3–4 | My City rendering: radial layout, genre districts |
| 5 | Building geometry: height/color/animation from data |
| 6 | Click interaction: artist info panel + audio preview |
| 7 | Share link (save snapshot to DB, unique URL) |
| 8–9 | UI polish, loading states, error handling |
| 10 | Deploy + smoke test |

---

## Tech Stack

### Frontend
- React (Vite)
- React Three Fiber + Drei (3D rendering, WebGL)
- Zustand (state management)
- Tailwind CSS (UI overlays, panels)
- React Router (routing: /city, /share/:token, /global)

### Backend
- FastAPI (Python)
- Redis (Spotify API response caching, TTL 1hr)
- PostgreSQL (sessions, city snapshots, share tokens)
- httpx or Spotipy for Spotify API calls
- `franc` (JS) or `langdetect` (Python) for language detection

### Deployment
- Frontend → Vercel
- Backend → Railway or Fly.io
- DB → Railway PostgreSQL or Supabase

---

## Data Models

### Country
```
id, name, code (ISO), language
lat, lng, bounds (geographic)
position_x, position_z (3D)
bounds_3d (3D bounding box)
color, flag
artist_count, city_count, top_genres
```

### City (Genre City)
```
id, name, genre, country_code
position_x, position_z (absolute 3D)
relative_x, relative_z (relative to country center)
radius, bounds (3D)
color, skyline_height
artist_count, top_artists[]
description
```

### District (Sub-genre, optional)
```
id, name, subgenre, city_id
position_x, position_z, radius
color, pattern
artist_count
```

### Building (Artist)
```
id, artist_id (Spotify), artist_name, artist_image_url
country_code, city_id, district_id (optional)
position_x, position_y, position_z
dimensions: { width, height, depth }
style: { color, brightness, glow_intensity, animation, texture, roof_style }
metadata: { genre, language, listening_minutes, song_count, popularity, followers, last_played, play_count }
floors: Floor[]
```

### Floor (Song)
```
id, building_id
floor_number, track_id, track_name, album_cover
duration_ms, preview_url
color, is_lit, glow_intensity
audio_features: { energy, valence, danceability, tempo, loudness }
play_count, last_played
```

---

## Database Tables

```
countries          — static, seeded once
cities             — static, seeded once (genre cities per country)
districts          — static, optional sub-genre zones
global_artists     — seeded with ~50K artists (post-MVP)
users              — Spotify user profiles
user_cities        — generated city per user (city_data JSON + passport_data JSON)
user_buildings     — artist buildings for each user city
user_songs         — song floors for each building
activity_log       — recently played events (for trending/glow)
```

---

## Data → City Mapping Rules

| Spotify Data | City Element | Rule |
|---|---|---|
| Artist name + genres | Country | Language detection (franc) + genre hints |
| Artist primary genre | City (genre city) | Genre → predefined city mapping per country |
| Listening time | Building height | Normalize 0–max → height units |
| Popularity (0–100) | Brightness | Linear → emissive intensity |
| Recently played (7d) | Glow/pulse animation | Boolean flag |
| Audio energy (0–1) | Building shape style | High = angular, Low = rounded |
| Audio valence (0–1) | Color temperature | High = warm, Low = cool |
| Song count | Building width/depth | Normalized |

---

## My City Layout (Radial — MVP)

```
User's top genre → center of city
Other genres → fan out radially (like compass directions)
Each district: circular zone, radius proportional to artist count
Artists within district: positioned by listening time (closer to center = more listened)
```

Genre → direction mapping example:
- Top genre → center
- 2nd genre → North
- 3rd genre → East
- 4th genre → South
- 5th genre → West
- Remaining → outer ring

---

## Spotify API Endpoints

| Endpoint | Data |
|---|---|
| `/me` | User profile |
| `/me/top/artists?limit=20&time_range=medium_term` | Top artists |
| `/me/top/tracks?limit=50` | Top tracks |
| `/me/player/recently-played?limit=50` | Recently played |
| `/audio-features?ids=...` | Energy, valence, danceability per track |
| `/artists?ids=...` | Genres, followers per artist |

---

## Language Detection Strategy

Priority order per artist:
1. Genre hints (k-pop → Korean, j-pop → Japanese, reggaeton → Spanish)
2. Artist name language detection (franc library)
3. Fallback → English (US)

Language → Country mapping:
```
English (default) → US
Korean            → KR
Japanese          → JP
Spanish (default) → MX (or ES depending on genre)
Portuguese        → BR
French            → FR
German            → DE
Hindi             → IN
Arabic            → EG
Swedish           → SE
Nigerian genres   → NG
```

---

## Hard Constraints

- No GPU backend — all 3D in browser (WebGL/Three.js only)
- No AI/ML in MVP — all logic is deterministic math
- No real-time updates — data fetched once per session
- Spotify rate limits → cache all responses in Redis (TTL 1hr)
- No mobile-first — desktop priority, mobile is degraded fallback
- Performance: top 20 artists only in MVP → instanced meshes if needed

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Three.js perf with many buildings | Limit to 20 artists MVP, use InstancedMesh |
| Spotify OAuth complexity | Backend-only PKCE, proven flow |
| Language detection accuracy | Genre hints take priority over text detection |
| Scope creep | Strictly follow MVP boundary |
| Cold start on Railway | Use Fly.io if too slow |

---

## Post-MVP Roadmap

### V2 — Music Passport
- World map view (personal)
- User's countries highlighted, others greyed
- Flight path animations between countries
- Stats: "You listen to music from N countries"

### V3 — Global City
- Seed 50K artists into DB
- Lazy load buildings by viewport/country
- User's artists highlighted in global view
- Discovery: explore countries to find new music

### V4 — Social
- Visit other users' cities
- Music compatibility score
- Shared city links with comparison overlay

### V5 — Monetization
- Premium themes
- HD/animated export
- In-world billboards
- Artist tools
