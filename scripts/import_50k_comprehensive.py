"""
Comprehensive import: 50K artists with specific composition
- Top 100 global artists (downtown)
- 20% small/niche artists
- Top 1000 Bengali artists
- 2000 Indian artists
- Mixed genres throughout
"""
import os
import sys
import time
import requests
import random
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

# Target composition
TARGETS = {
    'global_top': 100,      # Top 100 for downtown
    'bengali': 1000,        # Bengali artists
    'indian': 2000,         # Indian artists
    'niche': 8000,          # 20% small/niche artists (rest will be general)
    'total': 50000
}

# Bengali music tags/tags to search
BENGALI_TAGS = ['bengali', 'bangla', 'bengali rock', 'rabindra sangeet', 'nazrul geeti', 'adhunik']
INDIAN_TAGS = ['indian', 'bollywood', 'hindi', 'tamil', 'telugu', 'marathi', 'punjabi', 'malayalam', 'kannada']

# Priority Bengali artists (manually curated top tier)
PRIORITY_BENGALI = [
    "Rabindranath Tagore", "Kazi Nazrul Islam", "Lata Mangeshkar", "Asha Bhosle",
    "Kishore Kumar", "Manna Dey", "Hemanta Mukherjee", "Sandhya Mukhopadhyay",
    "Shreya Ghoshal", "Arijit Singh", "Anupam Roy", "Rupam Islam",
    "Nachiketa Chakraborty", "Srikanto Acharya", "Kumar Sanu", "Bappi Lahiri",
    "RD Burman", "SD Burman", "Salil Chowdhury", "Hridoy Khan",
    "Tahsan Rahman Khan", "Minar Rahman", "Pritam", "Jeet Gannguli"
]

# Priority Indian artists
PRIORITY_INDIAN = [
    "A.R. Rahman", "Sonu Nigam", "Sunidhi Chauhan", "Alka Yagnik", "Udit Narayan",
    "Mohammed Rafi", "Kishore Kumar", "Lata Mangeshkar", "Asha Bhosle",
    "Nusrat Fateh Ali Khan", "Jagjit Singh", "Ghulam Ali", "Hariharan",
    "Shankar Mahadevan", "Lucky Ali", "Vishal Dadlani", "KK",
    "Atif Aslam", "Rahat Fateh Ali Khan", "Mohit Chauhan", "Papon",
    "Amit Trivedi", "Vishal-Shekhar", "Sajid-Wajid", "Nadeem-Shravan"
]

NICH_GENRES = [
    'ambient', 'experimental', 'noise', 'drone', 'minimal', 'avant-garde',
    'field recordings', 'sound art', 'lo-fi', 'bedroom pop', 'indie folk',
    'math rock', 'post-rock', 'shoegaze', 'dream pop', 'slowcore',
    'dark ambient', ' dungeon synth', 'blackgaze', 'post-metal'
]

def lastfm_api(method, **params):
    """Call Last.fm API"""
    url = "http://ws.audioscrobbler.com/2.0/"
    params.update({
        'method': method,
        'api_key': LASTFM_API_KEY,
        'format': 'json'
    })
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"API Error: {e}")
        return None

def get_top_artists_global(limit=100):
    """Fetch top global artists"""
    data = lastfm_api('chart.getTopArtists', limit=limit)
    if data and 'artists' in data:
        return data['artists'].get('artist', [])
    return []

def search_artists_by_tag(tag, limit=250):
    """Search artists by tag"""
    data = lastfm_api('tag.getTopArtists', tag=tag, limit=limit)
    if data and 'topartists' in data:
        return data['topartists'].get('artist', [])
    return []

def get_artist_info(name):
    """Get detailed artist info"""
    data = lastfm_api('artist.getInfo', artist=name)
    if data and 'artist' in data:
        artist = data['artist']
        tags = [t['name'].lower() for t in artist.get('tags', {}).get('tag', [])]
        stats = artist.get('stats', {})
        return {
            'listeners': int(stats.get('listeners', 0)),
            'playcount': int(stats.get('playcount', 0)),
            'tags': tags,
            'image': artist.get('image', [{}])[-1].get('#text', '') if artist.get('image') else ''
        }
    return None

def insert_artist_to_db(artist_data, source='general'):
    """Insert artist to database"""
    try:
        # Check if exists by name
        result = supabase.table('artists').select('id').ilike('name', artist_data['name']).execute()
        if hasattr(result, 'data') and len(result.data) > 0:
            return False, 'exists'

        # Determine genre
        tags = artist_data.get('tags', [])
        genre = 'pop'  # default

        # Map tags to genres
        for tag in tags:
            tag_lower = tag.lower()
            if 'rock' in tag_lower:
                genre = 'rock'
                break
            elif 'hip hop' in tag_lower or 'rap' in tag_lower:
                genre = 'hip-hop'
                break
            elif 'electronic' in tag_lower or 'edm' in tag_lower:
                genre = 'electronic'
                break
            elif 'jazz' in tag_lower:
                genre = 'jazz'
                break
            elif 'classical' in tag_lower:
                genre = 'classical'
                break
            elif 'bengali' in tag_lower or 'bangla' in tag_lower:
                genre = 'bengali'
                break
            elif 'indian' in tag_lower or 'bollywood' in tag_lower or 'hindi' in tag_lower:
                genre = 'indian'
                break

        # Set custom color for Bengali artists
        custom_color = None
        if genre == 'bengali' or source == 'bengali':
            # 50% red, 50% green
            custom_color = '#DC2626' if random.random() < 0.5 else '#16A34A'
            genre = 'bengali'

        record = {
            'name': artist_data['name'],
            'mbid': artist_data.get('mbid') or None,
            'lastfm_listeners': artist_data.get('listeners', 0),
            'track_count': artist_data.get('playcount', 0) // 10000,  # Estimate
            'genre': genre,
            'sub_genres': tags[:5],
            'image_url': artist_data.get('image', '') or None,
            'is_active': True,
            'custom_color': custom_color
        }

        supabase.table('artists').insert(record).execute()
        return True, 'success'
    except Exception as e:
        return False, str(e)

def main():
    print("=" * 70)
    print("TUNEXA: 50K Artist Import")
    print("=" * 70)
    print(f"Target: {TARGETS['total']:,} artists")
    print(f"  - Global Top: {TARGETS['global_top']}")
    print(f"  - Bengali: {TARGETS['bengali']}")
    print(f"  - Indian: {TARGETS['indian']}")
    print(f"  - Niche/Small: {TARGETS['niche']}")
    print("=" * 70)

    all_artists = {}
    stats = {'imported': 0, 'skipped': 0, 'failed': 0}

    # Phase 1: Top 100 Global (Downtown)
    print("\n📥 Phase 1: Importing Top 100 Global Artists...")
    top_artists = get_top_artists_global(100)
    for artist in top_artists:
        name = artist['name']
        if name not in all_artists:
            info = get_artist_info(name)
            if info:
                all_artists[name] = {**artist, **info, 'source': 'global_top'}
    time.sleep(0.2)
    print(f"   ✓ Found {len([a for a in all_artists.values() if a.get('source') == 'global_top'])} global top artists")

    # Phase 2: Bengali Artists
    print("\n📥 Phase 2: Importing Bengali Artists...")
    bengali_count = 0

    # Priority Bengali artists first
    for name in PRIORITY_BENGALI[:100]:
        if bengali_count >= TARGETS['bengali']:
            break
        info = get_artist_info(name)
        if info:
            all_artists[name] = {
                'name': name,
                'listeners': info['listeners'],
                'playcount': info['playcount'],
                'tags': info['tags'] + ['bengali'],
                'image': info['image'],
                'source': 'bengali'
            }
            bengali_count += 1
        time.sleep(0.2)

    # Search by Bengali tags
    for tag in BENGALI_TAGS:
        if bengali_count >= TARGETS['bengali']:
            break
        artists = search_artists_by_tag(tag, limit=100)
        for artist in artists:
            if bengali_count >= TARGETS['bengali']:
                break
            name = artist['name']
            if name not in all_artists:
                info = get_artist_info(name)
                if info:
                    all_artists[name] = {**artist, **info, 'source': 'bengali'}
                    bengali_count += 1
            time.sleep(0.2)
    print(f"   ✓ Found {bengali_count} Bengali artists")

    # Phase 3: Indian Artists
    print("\n📥 Phase 3: Importing Indian Artists...")
    indian_count = 0

    # Priority Indian artists
    for name in PRIORITY_INDIAN[:200]:
        if indian_count >= TARGETS['indian']:
            break
        if name not in all_artists:
            info = get_artist_info(name)
            if info:
                all_artists[name] = {
                    'name': name,
                    'listeners': info['listeners'],
                    'playcount': info['playcount'],
                    'tags': info['tags'] + ['indian'],
                    'image': info['image'],
                    'source': 'indian'
                }
                indian_count += 1
        time.sleep(0.2)

    # Search by Indian tags
    for tag in INDIAN_TAGS:
        if indian_count >= TARGETS['indian']:
            break
        artists = search_artists_by_tag(tag, limit=150)
        for artist in artists:
            if indian_count >= TARGETS['indian']:
                break
            name = artist['name']
            if name not in all_artists:
                info = get_artist_info(name)
                if info:
                    all_artists[name] = {**artist, **info, 'source': 'indian'}
                    indian_count += 1
            time.sleep(0.2)
    print(f"   ✓ Found {indian_count} Indian artists")

    # Phase 4: Niche/Small Artists
    print("\n📥 Phase 4: Importing Niche/Small Artists...")
    niche_count = 0

    for genre in NICH_GENRES:
        if niche_count >= TARGETS['niche']:
            break
        artists = search_artists_by_tag(genre, limit=500)
        for artist in artists:
            if niche_count >= TARGETS['niche']:
                break
            name = artist['name']
            if name not in all_artists:
                # Only add if low listeners (niche)
                listeners = int(artist.get('listeners', 999999))
                if listeners < 100000:  # Niche threshold
                    info = get_artist_info(name)
                    if info and info['listeners'] < 100000:
                        all_artists[name] = {**artist, **info, 'source': 'niche'}
                        niche_count += 1
            time.sleep(0.2)
    print(f"   ✓ Found {niche_count} niche artists")

    # Phase 5: Fill remaining with diverse global artists
    print("\n📥 Phase 5: Filling remaining with diverse global artists...")

    diverse_genres = [
        'pop', 'rock', 'electronic', 'hip-hop', 'r&b', 'indie', 'jazz',
        'classical', 'country', 'metal', 'folk', 'reggae', 'punk', 'soul',
        'funk', 'disco', 'gospel', 'latin', 'ambient', 'k-pop', 'j-pop',
        'afrobeat', 'trap', 'lo-fi', 'synthwave', 'industrial', 'emo',
        'grunge', 'ska', 'progressive rock', 'hard rock', 'soft rock'
    ]

    for genre in diverse_genres:
        if len(all_artists) >= TARGETS['total']:
            break
        artists = search_artists_by_tag(genre, limit=200)
        for artist in artists:
            if len(all_artists) >= TARGETS['total']:
                break
            name = artist['name']
            if name not in all_artists:
                info = get_artist_info(name)
                if info:
                    all_artists[name] = {**artist, **info, 'source': 'general'}
            time.sleep(0.2)

    print(f"\n📊 Total collected: {len(all_artists)} unique artists")

    # Phase 6: Insert to database
    print("\n📥 Phase 6: Inserting to database...")

    for i, (name, data) in enumerate(all_artists.items(), 1):
        if i % 100 == 0:
            print(f"   [{i}/{len(all_artists)}] Processing...")

        success, status = insert_artist_to_db(data, data.get('source', 'general'))
        if success:
            stats['imported'] += 1
        elif status == 'exists':
            stats['skipped'] += 1
        else:
            stats['failed'] += 1

        time.sleep(0.1)

    # Summary
    print("\n" + "=" * 70)
    print("✅ Import Complete!")
    print(f"   Imported: {stats['imported']}")
    print(f"   Skipped (exists): {stats['skipped']}")
    print(f"   Failed: {stats['failed']}")

    # Final count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        total = result.count if hasattr(result, 'count') else 'unknown'
        print(f"   Total in database: {total}")

        # Breakdown by source
        print("\n📊 Breakdown by source:")
        result = supabase.table('artists').select('genre, count').group('genre').execute()
        if hasattr(result, 'data'):
            for row in result.data:
                print(f"   {row['genre']}: {row['count']}")
    except Exception as e:
        print(f"   Could not get stats: {e}")

    print("=" * 70)

if __name__ == "__main__":
    main()
