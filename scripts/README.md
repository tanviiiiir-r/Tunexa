# Session 1: Data Pipeline Scripts

These scripts populate the Supabase database with 50,000 artists for the Tunexa Global City.

## Prerequisites

1. **Supabase Project** (already set up)
2. **Last.fm API Key** (free): https://www.last.fm/api/account/create
3. **TheAudioDB API Key** (free, optional): https://www.theaudiodb.com/api_key.php

## Environment Variables

Create a `.env` file in `/Users/tanvir/CLAUDE CODE/Tunexa/scripts/`:

```bash
# Supabase (same as backend)
SUPABASE_URL=https://tgvwdhgkraozwbdfllpa.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Last.fm (required)
LASTFM_API_KEY=your_lastfm_key

# TheAudioDB (optional, for images)
AUDIODB_API_KEY=your_audiodb_key

# MusicBrainz (required by their ToS)
MUSICBRAINZ_USERAGENT=Tunexa/1.0 (your@email.com)
```

## Installation

```bash
cd scripts
pip3 install -r requirements.txt
```

## Running

### Option 1: Run All Steps

```bash
chmod +x run_session1.sh
./run_session1.sh
```

### Option 2: Run Steps Manually

```bash
# Step 0: Create database schema
python3 01_create_schema.py

# Step 1: Import artists from MusicBrainz
python3 02_import_musicbrainz.py

# Step 2: Enrich with Last.fm listener counts
python3 03_enrich_lastfm.py

# Step 3: Fetch artist images
python3 04_enrich_audiodb.py

# Step 4: Compute 3D layout (height, width, positions)
python3 05_compute_layout.py
```

## What Each Script Does

### 01_create_schema.py
Creates the `artists` table with all required columns and indexes.

### 02_import_musicbrainz.py
**Current version**: Uses MusicBrainz API to import 20 popular artists (for testing).

**For production**: Modify to parse the MusicBrainz JSON dump:
1. Download from: https://data.metabrainz.org/pub/musicbrainz/data/json-dumps/
2. File: `mbdump.tar.zst` (artists + release groups)
3. Parse with `zstd` and `json` modules
4. Target: Top 50,000 artists by release count

### 03_enrich_lastfm.py
Fetches listener counts from Last.fm API for each artist.
- Rate: 5 req/sec (0.2s delay)
- Estimated time for 50k artists: ~2.8 hours

### 04_enrich_audiodb.py
Fetches artist images from TheAudioDB.
- Falls back to MusicBrainz Cover Art if unavailable

### 05_compute_layout.py
Calculates:
- **height** = log_normalize(lastfm_listeners, 1000-10M) → 1.0-20.0
- **width** = log_normalize(track_count, 1-5000) → 0.5-6.0
- **city_x, city_z** = Grid position by genre district

## Verification

After running, verify in Supabase SQL Editor:

```sql
-- Should return ~20+ artists (or 50k in production)
SELECT COUNT(*),
       AVG(height),
       AVG(width),
       COUNT(*) FILTER (WHERE lastfm_listeners > 0) as enriched
FROM artists;

-- Check genre distribution
SELECT genre, COUNT(*)
FROM artists
GROUP BY genre
ORDER BY COUNT(*) DESC;
```

## Expected Results

**Test Run (20 artists)**:
- Import: ~20 artists
- Last.fm: 15-20 enriched (some may fail if not found)
- Images: 10-15 fetched
- Layout: All have height/width/positions

**Production Run (50k artists)**:
- Import: 50,000 artists
- Last.fm: 45,000+ enriched
- Images: 40,000+ fetched
- Layout: All positioned in genre districts
- Total time: ~4-5 hours (mostly Last.fm API calls)

## Troubleshooting

**"Rate limit exceeded" from MusicBrainz**: The script has 1.1s delays. Don't decrease.

**"No Last.fm data"**: Some artists may not be in Last.fm. This is normal.

**"Supabase connection failed"**: Check SUPABASE_SERVICE_KEY (not anon key).

## Next Steps

After Session 1 completes:
1. Verify data in Supabase Dashboard
2. Move to **Session 2**: Backend pivot (create `/city` endpoint)
3. Frontend will fetch from `/city` instead of `/city_payload`

## Architecture Notes

- **Data Flow**: MusicBrainz → Supabase → Last.fm enrich → Layout compute
- **Storage**: All in Supabase PostgreSQL (no files needed)
- **Updates**: Nightly sync will refresh Last.fm data (Session 4)
- **Backup**: `shared_cities` table still works (unchanged from Session 0)
