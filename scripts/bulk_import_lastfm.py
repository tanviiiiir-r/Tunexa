"""
Bulk import 10K artists from Last.fm API

Fetches top artists by genre from Last.fm and imports to Supabase.
Rate limit: 5 requests/second
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
LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

if not LASTFM_API_KEY:
    print("❌ Error: LASTFM_API_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Extended genres to fetch
GENRES = [
    'pop', 'rock', 'hip-hop', 'electronic', 'r&b', 'indie', 'jazz',
    'classical', 'country', 'metal', 'blues', 'folk', 'reggae',
    'punk', 'soul', 'funk', 'disco', 'gospel', 'latin', 'ambient',
    'k-pop', 'j-pop', 'afrobeat', 'trap', 'lo-fi', 'synthwave',
    'industrial', 'emo', 'grunge', 'ska', 'progressive rock',
    'hard rock', 'soft rock', 'alternative', 'dance', 'dubstep',
    'house', 'techno', 'trance', 'world'
]

def get_top_artists_by_genre(genre, limit=250):
    """Fetch top artists for a genre from Last.fm"""
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            'method': 'tag.gettopartists',
            'tag': genre,
            'api_key': LASTFM_API_KEY,
            'format': 'json',
            'limit': limit
        }

        response = requests.get(url, params=params, timeout=30)

        if response.status_code == 200:
            data = response.json()
            artists = data.get('topartists', {}).get('artist', [])
            return [
                {
                    'name': a['name'],
                    'listeners': int(a.get('listeners', 0)),
                    'mbid': a.get('mbid', ''),
                    'image': a.get('image', [{}])[-1].get('#text', '') if a.get('image') else ''
                }
                for a in artists
            ]
        return []
    except Exception as e:
        print(f"  ⚠️ Error fetching {genre}: {e}")
        return []

def get_artist_info(artist_name):
    """Get detailed artist info from Last.fm"""
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            'method': 'artist.getInfo',
            'artist': artist_name,
            'api_key': LASTFM_API_KEY,
            'format': 'json'
        }

        response = requests.get(url, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            artist = data.get('artist', {})
            tags = [t['name'] for t in artist.get('tags', {}).get('tag', [])[:5]]
            stats = artist.get('stats', {})
            return {
                'listeners': int(stats.get('listeners', 0)),
                'playcount': int(stats.get('playcount', 0)),
                'tags': tags
            }
        return None
    except Exception as e:
        return None

def artist_exists(name):
    """Check if artist already exists in database"""
    try:
        result = supabase.table('artists')\
            .select('id')\
            .ilike('name', name)\
            .execute()
        return len(result.data) > 0 if hasattr(result, 'data') else False
    except:
        return False

def main():
    print("=" * 60)
    print("Bulk Import: 10K Artists from Last.fm")
    print("=" * 60)
    print(f"Genres: {len(GENRES)}")
    print(f"Target: ~250 artists per genre = ~10K total")
    print(f"Rate: 5 req/sec (0.2s delay)")
    print("=" * 60)

    imported = 0
    skipped = 0
    failed = 0
    all_artists = {}

    # Phase 1: Collect artists from all genres
    print("\n📥 Phase 1: Collecting artists from Last.fm...")
    for i, genre in enumerate(GENRES, 1):
        print(f"\n[{i}/{len(GENRES)}] Fetching {genre}...", end=" ")

        artists = get_top_artists_by_genre(genre, limit=250)
        print(f"{len(artists)} found")

        for artist in artists:
            name = artist['name']
            if name not in all_artists:
                all_artists[name] = {
                    'name': name,
                    'listeners': artist['listeners'],
                    'mbid': artist['mbid'],
                    'image_url': artist['image'],
                    'genres': [genre]
                }
            else:
                if genre not in all_artists[name]['genres']:
                    all_artists[name]['genres'].append(genre)

        time.sleep(0.2)  # Rate limit

    print(f"\n📊 Collected {len(all_artists)} unique artists")

    # Phase 2: Enrich and insert
    print("\n📥 Phase 2: Enriching and inserting to database...")

    artist_list = sorted(all_artists.values(), key=lambda x: x['listeners'], reverse=True)[:10000]

    for i, artist in enumerate(artist_list, 1):
        name = artist['name']
        print(f"[{i}/{len(artist_list)}] {name}...", end=" ")

        # Skip if exists
        if artist_exists(name):
            print("SKIP (exists)")
            skipped += 1
            continue

        # Get detailed info
        info = get_artist_info(name)
        if info:
            artist['listeners'] = max(artist['listeners'], info['listeners'])
            artist['playcount'] = info['playcount']
            artist['genres'] = list(set(artist['genres'] + info['tags']))[:5]

        # Determine primary genre
        primary_genre = artist['genres'][0] if artist['genres'] else 'pop'

        # Estimate track count from playcount (rough approximation)
        estimated_tracks = max(artist['playcount'] // 10000, 10)

        # Insert to database
        try:
            record = {
                'name': name,
                'mbid': artist['mbid'] or None,
                'lastfm_listeners': artist['listeners'],
                'track_count': estimated_tracks,
                'genre': primary_genre.lower(),
                'sub_genres': artist['genres'][1:] if len(artist['genres']) > 1 else [],
                'image_url': artist['image_url'] if artist['image_url'] else None,
                'is_active': True
            }

            supabase.table('artists').insert(record).execute()
            print(f"✓ {artist['listeners']:,} listeners")
            imported += 1
        except Exception as e:
            print(f"❌ {e}")
            failed += 1

        time.sleep(0.2)  # Rate limit

    print("\n" + "=" * 60)
    print("✅ Import Complete!")
    print(f"   Imported: {imported}")
    print(f"   Skipped: {skipped}")
    print(f"   Failed: {failed}")

    # Final count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        total = result.count if hasattr(result, 'count') else 'unknown'
        print(f"   Total in database: {total}")
    except Exception as e:
        print(f"   Could not verify: {e}")

    print("=" * 60)

if __name__ == "__main__":
    main()
