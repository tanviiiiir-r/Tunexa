"""
Session 4 - Nightly Sync Job
Updates artist data daily at 3 AM
- Refresh existing artists with new Last.fm data
- Add new top artists from Last.fm
- Recompute layout positions
"""
import os
import sys
import time
import requests
import math
from datetime import datetime
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

# Top artists to fetch from Last.fm (to add new ones)
TOP_ARTISTS_SEED = [
    "The Beatles", "Radiohead", "Kanye West", "Beyoncé", "Taylor Swift",
    "Drake", "Ed Sheeran", "Ariana Grande", "Coldplay", "Eminem",
    "Rihanna", "Lady Gaga", "Bruno Mars", "The Weeknd", "Billie Eilish",
    "Post Malone", "Dua Lipa", "Justin Bieber", "SZA", "Doja Cat",
    "Arctic Monkeys", "Daft Punk", "Jay-Z", "Adele", "Nirvana",
    "Metallica", "Queen", "Michael Jackson", "Madonna", "Prince",
    "David Bowie", "Bob Dylan", "Elvis Presley", "The Rolling Stones",
    "Pink Floyd", "Led Zeppelin", "The Who", "U2", "Oasis",
    "Red Hot Chili Peppers", "Nirvana", "Guns N' Roses", "AC/DC",
    "Black Sabbath", "Deep Purple", "Iron Maiden", "Muse", "Kings of Leon",
    "The Strokes", "Vampire Weekend", "Tame Impala", "Arctic Monkeys",
    "Foo Fighters", "Green Day", "The Killers", "Panic! At The Disco",
    "Twenty One Pilots", "Imagine Dragons", "Maroon 5", "Linkin Park",
    "System of a Down", "Slipknot", "Rammstein", "Korn", "Limp Bizkit"
]

def log_normalize(value, min_out=10, max_out=100):
    """Log normalize value to output range"""
    if value <= 0:
        return min_out
    log_val = math.log10(value)
    # Scale: 100 listeners -> 10, 10M listeners -> 100
    normalized = min_out + (log_val / 7) * (max_out - min_out)
    return min(max_out, max(normalized, min_out))

def fetch_lastfm_data(artist_name):
    """Fetch listener count from Last.fm API"""
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
            if 'artist' in data and 'stats' in data['artist']:
                listeners = int(data['artist']['stats'].get('listeners', 0))
                playcount = int(data['artist']['stats'].get('playcount', 0))
                # Estimate track count from playcount (rough approximation)
                track_count = max(playcount // 1000, 10)
                return listeners, track_count
        return 0, 0
    except Exception as e:
        print(f"  ⚠️  Error fetching Last.fm data for {artist_name}: {e}")
        return 0, 0

def compute_layout(artists):
    """Compute city_x, city_z positions by genre district"""
    # Group by genre
    genre_groups = {}
    for artist in artists:
        genre = artist.get('genre', 'unknown').lower()
        if genre not in genre_groups:
            genre_groups[genre] = []
        genre_groups[genre].append(artist)

    # District positions (compass directions)
    district_centers = {
        'pop': {'angle': 0, 'distance': 60},
        'rock': {'angle': 60, 'distance': 60},
        'hip-hop': {'angle': 120, 'distance': 60},
        'hip hop': {'angle': 120, 'distance': 60},
        'electronic': {'angle': 180, 'distance': 60},
        'r&b': {'angle': 240, 'distance': 60},
        'indie': {'angle': 300, 'distance': 60},
    }

    updated_artists = []
    for genre, group in genre_groups.items():
        center = district_centers.get(genre, {'angle': 0, 'distance': 60})
        base_angle = center['angle']
        base_distance = center['distance']

        for i, artist in enumerate(group):
            # Spiral placement within district
            angle_offset = (i % 5) * 15  # 0, 15, 30, 45, 60 degrees
            distance_offset = (i // 5) * 20  # 0, 20, 40, ... units

            angle_rad = math.radians(base_angle + angle_offset)
            distance = base_distance + distance_offset

            city_x = math.cos(angle_rad) * distance
            city_z = math.sin(angle_rad) * distance

            # Compute dimensions from listeners/track_count
            height = log_normalize(artist.get('lastfm_listeners', 1000))
            width = log_normalize(artist.get('track_count', 100))

            updated_artists.append({
                **artist,
                'city_x': city_x,
                'city_z': city_z,
                'height': height,
                'width': width
            })

    return updated_artists

def refresh_existing_artists():
    """Update listener/track counts for existing artists"""
    print("\n" + "=" * 60)
    print("Phase 1: Refresh Existing Artists")
    print("=" * 60)

    # Get all active artists
    result = supabase.table('artists').select('*').eq('is_active', True).execute()
    artists = result.data if hasattr(result, 'data') else []

    if not artists:
        print("No existing artists found")
        return 0

    print(f"Found {len(artists)} existing artists")
    print("Rate: 5 req/sec (0.2s delay)")
    print("=" * 60)

    updated = 0
    failed = 0

    for i, artist in enumerate(artists, 1):
        name = artist['name']
        print(f"[{i}/{len(artists)}] {name}...", end=" ", flush=True)

        listeners, track_count = fetch_lastfm_data(name)

        if listeners > 0:
            try:
                supabase.table('artists').update({
                    'lastfm_listeners': listeners,
                    'track_count': track_count,
                    'last_updated': datetime.now().isoformat()
                }).eq('id', artist['id']).execute()
                print(f"✓ {listeners:,} listeners")
                updated += 1
            except Exception as e:
                print(f"✗ Update failed: {e}")
                failed += 1
        else:
            print("⚠ No data")
            failed += 1

        time.sleep(0.2)

    print(f"\n✅ Refreshed: {updated}, Failed: {failed}")
    return updated

def add_new_artists():
    """Add new top artists from Last.fm"""
    print("\n" + "=" * 60)
    print("Phase 2: Add New Artists")
    print("=" * 60)

    # Get existing artist names
    result = supabase.table('artists').select('name').execute()
    existing_names = {a['name'].lower() for a in result.data} if hasattr(result, 'data') else set()

    new_artists = []
    for name in TOP_ARTISTS_SEED:
        if name.lower() not in existing_names:
            new_artists.append(name)

    if not new_artists:
        print("No new artists to add")
        return 0

    print(f"Found {len(new_artists)} potential new artists")
    print("Rate: 5 req/sec (0.2s delay)")
    print("=" * 60)

    added = 0
    failed = 0

    for i, name in enumerate(new_artists[:50], 1):  # Limit to 50 new artists per run
        print(f"[{i}/{min(len(new_artists), 50)}] {name}...", end=" ", flush=True)

        listeners, track_count = fetch_lastfm_data(name)

        if listeners > 100000:  # Only add if has significant listeners
            try:
                # Generate UUID for new artist
                import uuid
                artist_id = str(uuid.uuid4())

                # Guess genre from name (simple heuristic)
                genre = 'pop'  # default
                if any(word in name.lower() for word in ['rock', 'metal', 'punk']):
                    genre = 'rock'
                elif any(word in name.lower() for word in ['rap', 'hip', 'jay']):
                    genre = 'hip-hop'
                elif any(word in name.lower() for word in ['electronic', 'daft']):
                    genre = 'electronic'

                supabase.table('artists').insert({
                    'id': artist_id,
                    'mbid': str(uuid.uuid4()),
                    'name': name,
                    'lastfm_listeners': listeners,
                    'track_count': track_count,
                    'genre': genre,
                    'sub_genres': [genre],
                    'is_active': True,
                    'last_updated': datetime.now().isoformat()
                }).execute()
                print(f"✓ Added ({listeners:,} listeners)")
                added += 1
            except Exception as e:
                print(f"✗ Failed: {e}")
                failed += 1
        else:
            print(f"⚠ Too few listeners ({listeners:,})")

        time.sleep(0.2)

    print(f"\n✅ Added: {added}, Failed: {failed}")
    return added

def recompute_layout():
    """Recompute 3D positions for all artists"""
    print("\n" + "=" * 60)
    print("Phase 3: Recompute Layout")
    print("=" * 60)

    result = supabase.table('artists').select('*').eq('is_active', True).execute()
    artists = result.data if hasattr(result, 'data') else []

    if not artists:
        print("No artists found")
        return 0

    print(f"Computing layout for {len(artists)} artists...")

    updated = compute_layout(artists)

    # Update each artist
    print("Updating database...")
    for artist in updated:
        try:
            supabase.table('artists').update({
                'city_x': artist['city_x'],
                'city_z': artist['city_z'],
                'height': artist['height'],
                'width': artist['width']
            }).eq('id', artist['id']).execute()
        except Exception as e:
            print(f"  ✗ Failed to update {artist['name']}: {e}")

    print(f"✅ Layout updated for {len(updated)} artists")
    return len(updated)

def main():
    print("=" * 60)
    print("TUNEXA NIGHTLY SYNC")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        # Phase 1: Refresh existing
        refreshed = refresh_existing_artists()

        # Phase 2: Add new
        added = add_new_artists()

        # Phase 3: Recompute layout
        updated_layout = recompute_layout()

        # Summary
        print("\n" + "=" * 60)
        print("SYNC COMPLETE")
        print("=" * 60)
        print(f"Refreshed: {refreshed}")
        print(f"Added: {added}")
        print(f"Layout updated: {updated_layout}")
        print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
