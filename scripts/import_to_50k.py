"""
Continue importing artists until we reach 50K total in database
Uses diverse strategies to find unique artists
"""
import os
import sys
import time
import random
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

# Many more genre tags to explore
ADDITIONAL_GENRES = [
    # More electronic
    'techno', 'house', 'trance', 'dubstep', 'electro', 'breakbeat', 'garage',
    'grime', 'hardstyle', 'gabber', 'industrial', 'ebm', 'synthpop', 'electropop',
    # More rock/metal
    'alternative rock', 'grunge', 'progressive metal', 'thrash metal', 'power metal',
    'doom metal', 'sludge metal', 'metalcore', 'deathcore', 'nu metal', 'rap metal',
    'industrial metal', 'glam metal', 'speed metal', 'folk metal', 'viking metal',
    # More pop
    'synthpop', 'electropop', 'indie pop', 'art pop', 'chamber pop', 'baroque pop',
    'sophisti-pop', 'new wave', 'post-punk', 'new romantic', 'synth-pop',
    # More world music
    'flamenco', 'fado', 'tango', 'bossa nova', 'samba', 'mpb', 'forró', 'baile funk',
    'afrobeat', 'highlife', 'mbaqanga', 'soukous', 'rumba', 'raï', 'gnawa',
    'klezmer', 'tuvan throat singing', 'mongolian folk', 'tibetan', 'indian classical',
    'carnatic', 'hindustani', 'ghazal', 'qawwali', 'sufi', 'turkish', 'persian',
    'arabic', 'levantine', 'armenian', 'georgian', 'balkan', 'greek', 'celtic',
    'irish', 'scottish', 'welsh', 'breton', 'galician', 'basque', 'catalan',
    # More jazz
    'bebop', 'cool jazz', 'hard bop', 'fusion', 'jazz fusion', 'smooth jazz',
    'latin jazz', 'bossa nova', 'swing', 'big band', 'dixieland', 'ragtime',
    # More hip-hop/rap
    'underground hip hop', 'alternative hip hop', 'jazz rap', 'conscious hip hop',
    'hardcore hip hop', 'horrorcore', 'cloud rap', 'soundcloud rap', 'mumble rap',
    'drill', 'trap', 'philly club', 'jersey club', 'baltimore club', 'footwork',
    # More r&b/soul
    'neo soul', 'contemporary r&b', 'quiet storm', 'new jack swing', 'go-go',
    'motown', 'northern soul', 'southern soul', 'deep soul', 'blue-eyed soul',
    # More country/folk
    'alt-country', 'americana', 'bluegrass', 'old-time', 'celtic', 'appalachian',
    'texas country', 'red dirt', 'outlaw country', 'country rock', 'country pop',
    'honky tonk', 'bakersfield sound', 'nashville sound', 'new country',
    # More classical
    'baroque', 'classical', 'romantic', 'impressionist', 'expressionist',
    'modern classical', '21st century classical', 'avant-garde', 'experimental',
    # Regional scenes
    'berlin', 'detroit techno', 'chicago house', 'uk garage', 'grime', 'drum and bass',
    'jungle', 'dub', 'reggae', 'dancehall', 'ragga', 'dembow', 'soca', 'calypso',
    'kompa', 'zouk', 'cadence', 'konpa', 'zouglou', 'coupe decale', 'afrobeats',
    'amapiano', 'g qom', 'kwaito', 'shangaan electro', 'zamrock', 'tsonga disco',
    'japanese', 'city pop', 'kayokyoku', 'enka', 'anime', 'j-rock', 'visual kei',
    'korean', 'k-indie', 'k-rock', 'k-hiphop', 'k-r&b', 'trot', 'ppongjjak',
    'chinese', 'c-pop', 'cantopop', 'mandopop', 'taiwanese', 'hokkien pop',
    'vietnamese', 'v-pop', 'thai', 't-pop', 'indonesian', 'dangdut', 'koplo',
    'malaysian', 'philippine', 'pinoy', 'opm', 'bollywood', 'tollywood', 'kollywood',
    # Historical decades
    '50s', '60s', '70s', '80s', '90s', '2000s', '2010s', '2020s',
    'classic rock', 'oldies', 'vintage', 'retro',
]

def fetch_artist_info(artist_name):
    """Fetch artist info from Last.fm"""
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
            if artist:
                listeners = int(artist.get('stats', {}).get('listeners', 0))
                playcount = int(artist.get('stats', {}).get('playcount', 0))
                tags = [t['name'] for t in artist.get('tags', {}).get('tag', [])[:5]]
                mbid = artist.get('mbid', '')
                image = artist.get('image', [{}])[-1].get('#text', '')
                return {
                    'name': artist_name,
                    'listeners': listeners,
                    'playcount': playcount,
                    'tags': tags,
                    'mbid': mbid,
                    'image': image
                }
        return None
    except Exception as e:
        return None

def get_top_artists_by_genre(genre, limit=500):
    """Fetch top artists for a genre"""
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
        return []

def get_chart_top_artists(page=1, limit=1000):
    """Fetch global top artists from Last.fm chart"""
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            'method': 'chart.getTopArtists',
            'api_key': LASTFM_API_KEY,
            'format': 'json',
            'page': page,
            'limit': limit
        }
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            artists = data.get('artists', {}).get('artist', [])
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
        return []

def artist_exists(name):
    """Check if artist exists by name"""
    try:
        result = supabase.table('artists').select('id').ilike('name', name).limit(1).execute()
        return len(result.data) > 0 if hasattr(result, 'data') else False
    except:
        return False

def artist_exists_by_mbid(mbid):
    """Check if artist exists by MBID"""
    if not mbid:
        return False
    try:
        result = supabase.table('artists').select('id').eq('mbid', mbid).limit(1).execute()
        return len(result.data) > 0 if hasattr(result, 'data') else False
    except:
        return False

def get_current_count():
    """Get current artist count"""
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        return result.count if hasattr(result, 'count') else 0
    except:
        return 0

def insert_artist(artist_data, source='regular'):
    """Insert artist to database"""
    try:
        tags = artist_data.get('tags', [])
        primary_genre = tags[0].lower() if tags else source

        # Check for MBID duplicate
        if artist_data.get('mbid') and artist_exists_by_mbid(artist_data['mbid']):
            return 'skipped'

        # Check for name duplicate
        if artist_exists(artist_data['name']):
            return 'skipped'

        record = {
            'name': artist_data['name'],
            'mbid': artist_data.get('mbid') or None,
            'lastfm_listeners': artist_data.get('listeners', 0),
            'track_count': max(artist_data.get('playcount', 0) // 10000, 10),
            'genre': primary_genre if primary_genre else 'pop',
            'sub_genres': tags[1:] if len(tags) > 1 else [],
            'image_url': artist_data.get('image') if artist_data.get('image') else None,
            'is_active': True
        }

        supabase.table('artists').insert(record).execute()
        return 'imported'
    except Exception as e:
        if 'mbid' in str(e).lower():
            return 'mbid_dup'
        return 'failed'

def main():
    print("=" * 60)
    print("Continue Import: Reaching 50K Artists")
    print("=" * 60)

    current = get_current_count()
    print(f"Current database count: {current}")
    target = 50000

    if current >= target:
        print(f"✅ Already at {current} artists! Target reached.")
        return

    needed = target - current
    print(f"Need {needed} more artists to reach {target}")
    print("=" * 60)

    imported = 0
    skipped = 0
    failed = 0
    seen_names = set()

    # Strategy 1: Fetch from chart top artists (pages 2-50)
    print("\n📥 Strategy 1: Global Chart Artists...")
    for page in range(2, 51):
        if current + imported >= target:
            break

        artists = get_chart_top_artists(page=page, limit=1000)
        print(f"  Page {page}: {len(artists)} artists fetched")

        for artist in artists:
            if current + imported >= target:
                break
            if artist['name'] in seen_names:
                continue
            seen_names.add(artist['name'])

            # Skip if too many listeners (we already have popular ones)
            if artist['listeners'] > 5000000:
                continue

            info = fetch_artist_info(artist['name'])
            if info:
                result = insert_artist(info, 'chart')
                if result == 'imported':
                    imported += 1
                    if imported % 100 == 0:
                        print(f"    ✓ {imported} imported (total: {current + imported})")
                elif result == 'skipped':
                    skipped += 1
                else:
                    failed += 1
            time.sleep(0.15)

    # Strategy 2: Additional genres
    print("\n📥 Strategy 2: Additional Genre Tags...")
    random.shuffle(ADDITIONAL_GENRES)

    for genre in ADDITIONAL_GENRES:
        if current + imported >= target:
            break

        print(f"  Fetching {genre}...")
        artists = get_top_artists_by_genre(genre, limit=500)

        for artist in artists:
            if current + imported >= target:
                break
            if artist['name'] in seen_names:
                continue
            seen_names.add(artist['name'])

            # Skip if too popular (we have those)
            if artist['listeners'] > 3000000:
                continue

            info = fetch_artist_info(artist['name'])
            if info:
                result = insert_artist(info, genre)
                if result == 'imported':
                    imported += 1
                    if imported % 200 == 0:
                        print(f"    ✓ {imported} imported (total: {current + imported})")
                elif result == 'skipped':
                    skipped += 1
                else:
                    failed += 1
            time.sleep(0.15)

    # Strategy 3: Country-based scenes (guaranteed unique artists)
    print("\n📥 Strategy 3: Regional Music Scenes...")
    countries = [
        'brazilian', 'argentine', 'mexican', 'colombian', 'peruvian', 'chilean',
        'spanish', 'french', 'italian', 'german', 'dutch', 'belgian', 'swedish',
        'norwegian', 'danish', 'finnish', 'polish', 'czech', 'hungarian', 'austrian',
        'swiss', 'portuguese', 'greek', 'turkish', 'israeli', 'lebanese', 'egyptian',
        'moroccan', 'nigerian', 'ghanaian', 'kenyan', 'ethiopian', 'congolese',
        'russian', 'ukrainian', 'estonian', 'latvian', 'lithuanian', 'romanian',
        'bulgarian', 'serbian', 'croatian', 'slovenian', 'bosnian', 'albanian',
        'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'indonesian',
        'malaysian', 'philippine', 'indian', 'pakistani', 'bangladeshi', 'sri lankan',
        'australian', 'new zealand', 'canadian', 'american', 'british', 'irish',
    ]

    for country in countries:
        if current + imported >= target:
            break

        print(f"  Fetching {country}...")
        artists = get_top_artists_by_genre(country, limit=400)

        for artist in artists:
            if current + imported >= target:
                break
            if artist['name'] in seen_names:
                continue
            seen_names.add(artist['name'])

            info = fetch_artist_info(artist['name'])
            if info:
                result = insert_artist(info, country)
                if result == 'imported':
                    imported += 1
                    if imported % 500 == 0:
                        print(f"    ✓ {imported} imported (total: {current + imported})")
                elif result == 'skipped':
                    skipped += 1
                else:
                    failed += 1
            time.sleep(0.15)

    # Final summary
    print("\n" + "=" * 60)
    print("✅ Import Batch Complete!")
    print(f"   New imported: {imported}")
    print(f"   Skipped: {skipped}")
    print(f"   Failed: {failed}")

    final_count = get_current_count()
    print(f"   Total in database: {final_count}")

    if final_count >= target:
        print(f"   🎉 TARGET REACHED: {final_count} >= {target}")
    else:
        print(f"   Still need: {target - final_count} more artists")
    print("=" * 60)

if __name__ == "__main__":
    main()
