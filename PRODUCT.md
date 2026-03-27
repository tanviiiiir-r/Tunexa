# Spotify City — Product Document

## Core Concept

Spotify City transforms a user's Spotify listening data into an interactive, explorable 3D world. The world is geography-based — countries represent music languages/cultures, cities within countries represent genres, and buildings represent artists.

---

## World Hierarchy

```
GLOBAL MUSIC WORLD
│
├── COUNTRIES (Language/Culture-based, positioned on real world map)
│   ├── CITIES (Genre-based, within each country)
│   │   ├── DISTRICTS (Sub-genres, optional — only for large genre cities)
│   │   │   └── BUILDINGS (Artists)
│   │   │       └── FLOORS (Songs)
│   │   └── BUILDINGS (Artists without districts)
│   │       └── FLOORS (Songs)
```

### Level 1 — Countries
- Positioned on a real world map using lat/lng → 3D coordinates
- Based on the primary language of artists, not strict geography
- Size reflects total artist count from that country
- Each country has a color theme and flag

### Level 2 — Cities (Genres)
- Each country contains multiple genre cities
- Cities are positioned within country boundaries
- Examples: USA → Pop City, Hip-Hop City, Rock City, Country City, R&B City
- Examples: South Korea → K-Pop City, K-Hip-Hop City, K-Indie City
- Examples: Japan → J-Pop City, City Pop City, J-Rock City, Anime City

### Level 3 — Districts (Sub-genres, optional)
- Only for large genre cities (e.g. K-Pop City → Boy Group / Girl Group / Solo districts)
- Examples: Hip-Hop City → Trap District, Old School District, Conscious District

### Level 4 — Buildings (Artists)
- Height = listening time / popularity
- Width/depth = song count
- Color = audio features (energy + valence)
- Brightness = popularity score
- Animation/glow = recently played

### Level 5 — Floors (Songs)
- Each floor = one song
- Color = energy + valence from Spotify audio features
- Lit up = played within last 7 days

---

## Data → Visual Mapping

| Spotify Data | Visual Element | Method |
|---|---|---|
| Artist language/origin | Country placement | Language detection (franc library) + genre hints |
| Artist primary genre | City placement | Genre → city mapping per country |
| Listening time | Building height | Normalize to height units |
| Popularity (0–100) | Brightness | Linear map to emissive intensity |
| Recently played (7 days) | Glow animation | Boolean pulse shader |
| Audio energy (0–1) | Building shape | High = sharp/angular, Low = soft |
| Audio valence (0–1) | Color temperature | High = warm, Low = cool/dark |
| Song count | Building width/depth | Normalized |
| Play count per song | Floor brightness | Lit vs dim |

---

## Personal City — Two Modes

### Mode 1: My City (MVP — Build First)
All user's artists in one consolidated city, organized by genre districts. Radial layout — user's top genre at center, other genres fan out around it.

```
Center = Top genre
Inner ring = Top 10 artists (tallest buildings)
Middle ring = Next 20 artists
Outer ring = Remaining artists
Districts fan radially by genre
```

**Why build first:** Simpler, faster, better daily-use experience. Proven pattern (similar to Git City).

### Mode 2: Music Passport (Post-MVP)
User's artists positioned on the real world map. Only countries the user listens to are highlighted — others are greyed out. Includes animated flight paths between countries.

```
Stats: "You listen to music from 8 countries"
Airplane paths connecting countries
Glow intensity = listening percentage per country
```

**Why build later:** Needs world map assets, more complex positioning, polish-heavy.

---

## Global City

A shared world containing all ~50K artists, explorable by anyone. Users see their own artists highlighted (glowing) while others appear dim. Enables music discovery by exploring countries and cities.

Expected distribution:
- USA (English): ~15,000 artists
- South Korea (Korean): ~4,500 artists
- UK (English): ~3,500 artists
- Japan (Japanese): ~3,200 artists
- Spain/Latin (Spanish): ~5,000 artists
- Brazil (Portuguese): ~2,300 artists
- France (French): ~1,800 artists
- India (Hindi+): ~1,500 artists
- Nigeria (English/Afrobeats): ~1,200 artists
- 30+ more countries

---

## User Experience Flow

### MVP Flow
1. User lands on homepage
2. Connects Spotify via OAuth
3. System fetches: top artists, top tracks, audio features, recently played
4. Language detection assigns each artist to a country + genre city
5. "My City" renders — radial layout, genre districts, artist buildings
6. User explores: click building → artist info panel + 30s preview
7. User shares city via unique link

### Full Flow (Post-MVP)
1. Same as above, plus:
2. Dashboard offers: "My City" | "Music Passport" | "Explore Global"
3. Music Passport: world map with user's countries highlighted, flight paths
4. Global City: full world map, discover new artists, user's artists glow
5. Social: compare cities with friends, see music overlap

---

## Key Features

### MVP
- Spotify OAuth login
- Personal city generation (My City — radial, genre districts)
- 3D rendering with React Three Fiber
- Building click → artist info + 30s audio preview
- Share city via unique URL

### V2
- Music Passport view (world map, personal)
- Global City (50K artists, shared world)
- City evolution over time (how your city changed)
- Animated flythrough export
- Friend comparison / music compatibility

### Future
- Artist/label tools (custom building designs)
- In-world ads (billboards in districts)
- Premium themes
- Album launch experiences

---

## Monetization

### Free
- Full My City exploration
- Basic share link
- Standard themes

### Premium
- HD/animated export
- Music Passport view
- Historical city evolution
- Custom themes (cyberpunk, nature, minimal)

### In-World (Future)
- Billboard ads in genre districts
- Promoted artist buildings
- Sponsored city events (album launches)

### Artist Tools (Future)
- Custom building design for verified artists
- Fan engagement analytics

---

## Emotional Goals

- Make users feel seen — their taste has a physical, beautiful form
- Create shareable identity artifacts (interactive Spotify Wrapped)
- Enable discovery through spatial exploration of music cultures
- Build social layer around taste compatibility
