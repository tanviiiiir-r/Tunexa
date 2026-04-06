"""
Bulk import 10K artists from Last.fm
Fetches top artists across multiple genres
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
    print("   Get free API key at: https://www.last.fm/api/account/create")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Extended genres for 10K dataset
GENRES = [
    'pop', 'rock', 'hip-hop', 'electronic', 'rnb', 'indie', 'jazz',
    'classical', 'country', 'metal', 'blues', 'folk', 'reggae',
    'punk', 'soul', 'funk', 'disco', 'gospel', 'latin', 'ambient',
    'world', 'k-pop', 'j-pop', 'ska', 'grunge', 'progressive rock',
    'experimental', 'lo-fi', 'trap', 'afrobeat', 'dancehall', 'dance',
    'synthwave', 'industrial', 'emo', 'post-rock', 'shoegaze',
    'britpop', 'glam rock', 'psychedelic', 'hard rock', 'soft rock'
]

def fetch_top_artists_by_tag(tag, limit=300):
    """Fetch top artists by genre tag from Last.fm"""
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            'method': 'tag.gettopartists',
            'tag': tag,
            'api_key': LASTFM_API_KEY,
            'format': 'json',
            'limit': limit
        }

        response = requests.get(url, params=params, timeout=15)

        if response.status_code == 200:
            data = response.json()
            if 'topartists' in data and 'artist' in data['topartists']:
                return data['topartists']['artist']
        return []
    except Exception as e:
        print(f"  ⚠️  Error fetching {tag}: {e}")
        return []

def fetch_artist_info(artist_name):
    """Fetch detailed artist info from Last.fm"""
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
            if 'artist' in data:
                artist = data['artist']
                stats = artist.get('stats', {})
                tags = [t['name'] for t in artist.get('tags', {}).get('tag', [])]
                return {
                    'listeners': int(stats.get('listeners', 0)),
                    'playcount': int(stats.get('playcount', 0)),
                    'tags': tags
                }
        return None
    except Exception as e:
        print(f"  ⚠️  Error fetching info for {artist_name}: {e}")
        return None

def artist_exists(name):
    """Check if artist already exists in database"""
    try:
        result = supabase.table('artists').select('id').eq('name', name).execute()
        return len(result.data) > 0 if hasattr(result, 'data') else False
    except:
        return False

def main():
    print("=" * 60)
    print("Bulk Import 10K Artists from Last.fm")
    print("=" * 60)
    print(f"Target: 10,000 artists")
    print(f"Genres: {len(GENRES)}")
    print(f"Rate: 5 req/sec (0.2s delay)")
    print("=" * 60)

    total_imported = 0
    total_skipped = 0
    total_failed = 0

    # Check current count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        current_count = result.count if hasattr(result, 'count') else 0
        print(f"\nCurrent database count: {current_count}")
        print(f"Target count: 10,000")
        print(f"Need to import: {max(0, 10000 - current_count)}")
    except Exception as e:
        print(f"Could not check current count: {e}")
        current_count = 0

    if current_count >= 10000:
        print("\n✅ Already have 10K artists!")
        return

    # Import artists by genre
    seen_artists = set()

    for genre_idx, genre in enumerate(GENRES, 1):
        if total_imported >= 10000:
            break

        print(f"\n[{genre_idx}/{len(GENRES)}] Fetching top {genre} artists...")

        # Fetch top artists for this genre
        artists = fetch_top_artists_by_tag(genre, limit=250)

        if not artists:
            print(f"  ⚠️  No artists found for {genre}")
            continue

        print(f"  Found {len(artists)} artists")

        imported_in_genre = 0

        for artist in artists:
            if total_imported >= 10000:
                break

            name = artist.get('name', '')

            # Skip duplicates
            if name in seen_artists:
                continue
            seen_artists.add(name)

            # Check if already in database
            if artist_exists(name):
                total_skipped += 1
                continue

            # Fetch detailed info
            print(f"  [{total_imported + 1}/10000] {name[:40]}...", end=" ")

            info = fetch_artist_info(name)

            if not info:
                print("❌ (no info)")
                total_failed += 1
                time.sleep(0.2)
                continue

            # Determine genre from tags
            tags = [t.lower() for t in info['tags']]
            primary_genre = genre

            # Map tags to our genres
            genre_mapping = {
                'k-pop': 'k-pop', 'korean': 'k-pop', 'kpop': 'k-pop',
                'j-pop': 'j-pop', 'japanese': 'j-pop', 'jpop': 'j-pop',
                'hip hop': 'hip-hop', 'hip-hop': 'hip-hop', 'rap': 'hip-hop',
                'rnb': 'rnb', 'r&b': 'rnb', 'soul': 'rnb',
                'electronic': 'electronic', 'edm': 'electronic', 'house': 'electronic',
                'techno': 'electronic', 'trance': 'electronic', 'dubstep': 'electronic',
                'indie': 'indie', 'indie rock': 'indie', 'alternative': 'indie',
                'rock': 'rock', 'classic rock': 'rock', 'hard rock': 'hard rock',
                'metal': 'metal', 'heavy metal': 'metal', 'death metal': 'metal',
                'pop': 'pop', 'pop rock': 'pop',
                'jazz': 'jazz', 'blues': 'blues',
                'classical': 'classical', 'orchestral': 'classical',
                'country': 'country', 'folk': 'folk',
                'reggae': 'reggae', 'dancehall': 'dancehall',
                'latin': 'latin', 'reggaeton': 'latin', 'salsa': 'latin',
                'funk': 'funk', 'disco': 'disco',
                'ambient': 'ambient', 'new age': 'ambient',
                'trap': 'trap', 'drill': 'trap', 'grime': 'trap',
                'lo-fi': 'lo-fi', 'lofi': 'lo-fi',
                'world': 'world', 'afrobeat': 'afrobeat',
            }

            for tag in tags:
                if tag in genre_mapping:
                    primary_genre = genre_mapping[tag]
                    break

            # Calculate track count from playcount
            track_count = max(10, min(1000, info['playcount'] // 10000))

            # Insert artist
            try:
                artist_record = {
                    'name': name,
                    'genre': primary_genre,
                    'sub_genres': [t for t in info['tags'][:5] if t.lower() != primary_genre],
                    'track_count': track_count,
                    'lastfm_listeners': info['listeners'],
                    'is_active': True
                }

                supabase.table('artists').insert(artist_record).execute()
                print(f"✓ ({info['listeners']:,} listeners)")
                total_imported += 1
                imported_in_genre += 1

            except Exception as e:
                print(f"❌ ({e})")
                total_failed += 1

            # Rate limiting
            time.sleep(0.2)

        print(f"  Imported {imported_in_genre} from {genre}")

    # Summary
    print("\n" + "=" * 60)
    print("✅ Import Complete!")
    print(f"   Imported: {total_imported}")
    print(f"   Skipped (duplicates): {total_skipped}")
    print(f"   Failed: {total_failed}")

    # Final count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        final_count = result.count if hasattr(result, 'count') else 'unknown'
        print(f"   Total in database: {final_count}")
    except Exception as e:
        print(f"   Could not verify: {e}")

    print("=" * 60)

if __name__ == "__main__":
    main()
