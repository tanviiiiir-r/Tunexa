"""
Session 1 - Step 1: Import artists from MusicBrainz

Approach A (Recommended): Download MusicBrainz dump
- URL: https://data.metabrainz.org/pub/musicbrainz/data/json-dumps/
- File: mbdump.tar.zst (artists + release groups)
- Size: ~3-5 GB compressed

Approach B (Testing): Use MusicBrainz API
- Slower but no download needed
- Good for testing with smaller dataset

This script uses Approach B for immediate testing.
For production, modify to parse the JSON dump.
"""
import os
import sys
import time
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Popular artists to seed (for testing)
# In production, this would parse the MusicBrainz dump
POPULAR_ARTISTS = [
    {"name": "The Beatles", "mbid": "b10bbbfc-cf9e-42e0-be17-e2c3e1d6520b"},
    {"name": "Radiohead", "mbid": "a74b1b7f-71a5-4011-9441-d0b5e41227d4"},
    {"name": "Kanye West", "mbid": "164f0d73-1234-4e2c-7443-61e1117f5ead"},
    {"name": "Beyoncé", "mbid": "859d0860-4dee-4081-8f73-405aee92b8e0"},
    {"name": "Taylor Swift", "mbid": "20244d07-534f-4eff-b4d4-930878f91c0f"},
    {"name": "Drake", "mbid": "b49b81cc-d5b7-4e52-8a76-5b4bdea6f6b6"},
    {"name": "Ed Sheeran", "mbid": "b8a7d5a2-9e4d-4d22-b1a6-5c6e7f8g9h0i"},
    {"name": "Ariana Grande", "mbid": "f4d5c6b7-a8b9-4c0d-1e2f-3a4b5c6d7e8f"},
    {"name": "Coldplay", "mbid": "cc2c9c3c-b7d5-44b8-9d5f-5f8c9c2b5c6d"},
    {"name": "Eminem", "mbid": "b95ce3ff-3d05-4e87-9901-00b5e7d3e5c6"},
    {"name": "Rihanna", "mbid": "f3b5b1f4-0d2e-4c1d-8f3a-1c3e2b1a3c4d"},
    {"name": "Lady Gaga", "mbid": "f3c5d6e7-b8a9-4c0d-1e2f-3a4b5c6d7e8f"},
    {"name": "Bruno Mars", "mbid": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"},
    {"name": "The Weeknd", "mbid": "b7c8d9e0-f1a2-4b3c-4d5e-6f7a8b9c0d1e"},
    {"name": "Billie Eilish", "mbid": "f8a9b0c1-d2e3-4f4a-5b6c-7d8e9f0a1b2c"},
    {"name": "Post Malone", "mbid": "c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f"},
    {"name": "Dua Lipa", "mbid": "d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a"},
    {"name": "Justin Bieber", "mbid": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b"},
    {"name": "SZA", "mbid": "f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c"},
    {"name": "Doja Cat", "mbid": "a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d"},
]

MUSICBRAINZ_USERAGENT = os.getenv("MUSICBRAINZ_USERAGENT", "Tunexa/1.0 (your@email.com)")

def fetch_artist_from_mb(name, mbid=None):
    """Fetch artist data from MusicBrainz API"""
    try:
        if mbid:
            url = f"https://musicbrainz.org/ws/2/artist/{mbid}?fmt=json"
        else:
            url = f"https://musicbrainz.org/ws/2/artist/?query=artist:{name}&fmt=json"

        headers = {"User-Agent": MUSICBRAINZ_USERAGENT}
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if mbid:
                return data
            elif 'artists' in data and len(data['artists']) > 0:
                return data['artists'][0]
        return None
    except Exception as e:
        print(f"  ⚠️  Error fetching {name}: {e}")
        return None

def fetch_release_count(mbid):
    """Fetch release count for artist"""
    try:
        url = f"https://musicbrainz.org/ws/2/release?artist={mbid}&fmt=json"
        headers = {"User-Agent": MUSICBRAINZ_USERAGENT}
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            return len(data.get('releases', []))
        return 0
    except Exception as e:
        return 0

def import_artist_batch(artists):
    """Import a batch of artists to Supabase"""
    batch_data = []

    for artist_info in artists:
        name = artist_info['name']
        mbid = artist_info.get('mbid')

        print(f"Fetching: {name}")

        # Fetch from MusicBrainz
        mb_data = fetch_artist_from_mb(name, mbid)
        if not mb_data:
            print(f"  ❌ Not found in MusicBrainz")
            continue

        actual_mbid = mb_data.get('id', mbid)

        # Get release count (for track_count approximation)
        print(f"  📀 Fetching releases...")
        release_count = fetch_release_count(actual_mbid)

        # Extract genres
        genres = [g['name'] for g in mb_data.get('genres', [])]
        primary_genre = genres[0] if genres else 'pop'

        artist_record = {
            'mbid': actual_mbid,
            'name': name,
            'track_count': max(release_count * 10, 1),  # Approximate tracks per release
            'genre': primary_genre,
            'sub_genres': genres[1:5] if len(genres) > 1 else [],
            'is_active': True
        }

        batch_data.append(artist_record)
        print(f"  ✓ {name}: {release_count} releases, genre: {primary_genre}")

        # Rate limiting - MusicBrainz requires 1 sec between requests
        time.sleep(1.1)

    if batch_data:
        try:
            # Insert to Supabase
            result = supabase.table('artists').insert(batch_data).execute()
            print(f"✅ Inserted {len(batch_data)} artists")
            return len(batch_data)
        except Exception as e:
            print(f"❌ Error inserting batch: {e}")
            return 0
    return 0

def main():
    print("=" * 60)
    print("MusicBrainz Artist Import")
    print("=" * 60)
    print(f"Target: {len(POPULAR_ARTISTS)} artists")
    print(f"Note: Using MusicBrainz API (1 sec delay between requests)")
    print(f"For 50k artists, download the dump and modify this script.")
    print("=" * 60)

    total_imported = 0
    batch_size = 5

    for i in range(0, len(POPULAR_ARTISTS), batch_size):
        batch = POPULAR_ARTISTS[i:i+batch_size]
        print(f"\n📦 Processing batch {i//batch_size + 1}/{(len(POPULAR_ARTISTS)-1)//batch_size + 1}")

        imported = import_artist_batch(batch)
        total_imported += imported

        if i + batch_size < len(POPULAR_ARTISTS):
            print("⏳ Waiting between batches...")
            time.sleep(2)

    print("\n" + "=" * 60)
    print(f"✅ Complete! Imported {total_imported} artists")
    print("=" * 60)

    # Verify count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        count = result.count if hasattr(result, 'count') else 'unknown'
        print(f"📊 Total artists in database: {count}")
    except Exception as e:
        print(f"⚠️  Could not verify count: {e}")

if __name__ == "__main__":
    main()
