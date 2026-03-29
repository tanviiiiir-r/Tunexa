"""
Session 1 - Step 1: Import artists from MusicBrainz

This uses the MusicBrainz API to search for artists.
For production, download the dump from:
https://data.metabrainz.org/pub/musicbrainz/data/json-dumps/
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

MUSICBRAINZ_USERAGENT = os.getenv("MUSICBRAINZ_USERAGENT", "Tunexa/1.0 (your@email.com)")

# Popular artists to seed
POPULAR_ARTISTS = [
    "The Beatles",
    "Radiohead",
    "Kanye West",
    "Beyoncé",
    "Taylor Swift",
    "Drake",
    "Ed Sheeran",
    "Ariana Grande",
    "Coldplay",
    "Eminem",
    "Rihanna",
    "Lady Gaga",
    "Bruno Mars",
    "The Weeknd",
    "Billie Eilish",
    "Post Malone",
    "Dua Lipa",
    "Justin Bieber",
    "SZA",
    "Doja Cat",
]

def search_artist(name):
    """Search for artist on MusicBrainz"""
    try:
        url = "https://musicbrainz.org/ws/2/artist"
        params = {
            'query': name,
            'fmt': 'json',
            'limit': 1
        }
        headers = {"User-Agent": MUSICBRAINZ_USERAGENT}

        response = requests.get(url, params=params, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if 'artists' in data and len(data['artists']) > 0:
                return data['artists'][0]
        return None
    except Exception as e:
        print(f"  ⚠️  Error searching {name}: {e}")
        return None

def fetch_release_count(mbid):
    """Fetch release count for artist"""
    try:
        url = f"https://musicbrainz.org/ws/2/release"
        params = {
            'artist': mbid,
            'fmt': 'json',
            'limit': 100
        }
        headers = {"User-Agent": MUSICBRAINZ_USERAGENT}
        response = requests.get(url, params=params, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            return len(data.get('releases', []))
        return 0
    except Exception as e:
        return 0

def main():
    print("=" * 60)
    print("MusicBrainz Artist Import")
    print("=" * 60)
    print(f"Target: {len(POPULAR_ARTISTS)} artists")
    print(f"User-Agent: {MUSICBRAINZ_USERAGENT}")
    print("Rate: 1 second delay between requests")
    print("=" * 60)

    imported = 0
    failed = 0

    for i, name in enumerate(POPULAR_ARTISTS, 1):
        print(f"\n[{i}/{len(POPULAR_ARTISTS)}] {name}")

        # Search for artist
        artist_data = search_artist(name)
        if not artist_data:
            print(f"  ❌ Not found")
            failed += 1
            time.sleep(1.1)
            continue

        mbid = artist_data.get('id')
        actual_name = artist_data.get('name', name)

        print(f"  ✓ Found: {actual_name} (ID: {mbid[:8]}...)")

        # Get release count
        print(f"  📀 Fetching releases...")
        release_count = fetch_release_count(mbid)
        print(f"    {release_count} releases")

        # Extract genres
        genres = [g['name'] for g in artist_data.get('tags', [])]
        if not genres:
            # Try to guess from disambiguation
            disambiguation = artist_data.get('disambiguation', '').lower()
            if 'rock' in disambiguation:
                genres = ['rock']
            elif 'pop' in disambiguation:
                genres = ['pop']
            elif 'hip hop' in disambiguation or 'hip-hop' in disambiguation:
                genres = ['hip-hop']
            else:
                genres = ['pop']  # default

        primary_genre = genres[0] if genres else 'pop'

        # Insert to database
        try:
            artist_record = {
                'mbid': mbid,
                'name': actual_name,
                'track_count': max(release_count * 10, 10),  # Approximate tracks
                'genre': primary_genre,
                'sub_genres': genres[1:5] if len(genres) > 1 else [],
                'is_active': True
            }

            result = supabase.table('artists').insert(artist_record).execute()
            print(f"  ✅ Imported")
            imported += 1
        except Exception as e:
            print(f"  ❌ Insert failed: {e}")
            failed += 1

        # Rate limiting
        time.sleep(1.1)

    print("\n" + "=" * 60)
    print(f"✅ Complete!")
    print(f"   Imported: {imported}")
    print(f"   Failed: {failed}")

    # Verify count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        count = result.count if hasattr(result, 'count') else 'unknown'
        print(f"   Total in database: {count}")
    except Exception as e:
        print(f"   Could not verify: {e}")

    print("=" * 60)

if __name__ == "__main__":
    main()
