"""
Simple script to continue importing until we reach 50K artists
Uses chart.getTopArtists which gives the most artists with least duplicates
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

def get_current_count():
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        return result.count if hasattr(result, 'count') else 0
    except Exception as e:
        print(f"Error getting count: {e}")
        return 0

def get_chart_artists(page, limit=1000):
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
        print(f"  Error: {e}")
        return []

def insert_artist(artist):
    try:
        # Check if exists by name
        result = supabase.table('artists').select('id').ilike('name', artist['name']).limit(1).execute()
        if hasattr(result, 'data') and len(result.data) > 0:
            return 'exists'

        # Check if exists by MBID
        if artist.get('mbid'):
            result = supabase.table('artists').select('id').eq('mbid', artist['mbid']).limit(1).execute()
            if hasattr(result, 'data') and len(result.data) > 0:
                return 'mbid_dup'

        record = {
            'name': artist['name'],
            'mbid': artist.get('mbid') or None,
            'lastfm_listeners': artist.get('listeners', 0),
            'track_count': max(artist.get('listeners', 0) // 5000, 10),  # Estimate
            'genre': 'pop',  # Default, will be updated by other processes
            'sub_genres': [],
            'image_url': artist.get('image') if artist.get('image') else None,
            'is_active': True
        }

        supabase.table('artists').insert(record).execute()
        return 'success'
    except Exception as e:
        if 'mbid' in str(e).lower():
            return 'mbid_dup'
        return 'failed'

def main():
    TARGET = 50000
    current = get_current_count()

    print(f"=" * 60)
    print(f"Fill to 50K Artists")
    print(f"=" * 60)
    print(f"Current: {current}")
    print(f"Target: {TARGET}")
    print(f"Need: {TARGET - current}")
    print(f"=" * 60)

    if current >= TARGET:
        print(f"✅ Already at {current} artists!")
        return

    imported = 0
    skipped = 0
    failed = 0

    # Start from page 6 (we already got pages 1-5 in previous import)
    for page in range(6, 100):
        current = get_current_count()
        if current >= TARGET:
            break

        print(f"\n📥 Page {page}: Fetching chart artists...")
        artists = get_chart_artists(page, limit=1000)
        print(f"   Got {len(artists)} artists")

        for artist in artists:
            current = get_current_count()
            if current >= TARGET:
                break

            result = insert_artist(artist)
            if result == 'success':
                imported += 1
                if imported % 100 == 0:
                    print(f"   ✓ {imported} imported (total: {current + 1})")
            elif result in ['exists', 'mbid_dup']:
                skipped += 1
            else:
                failed += 1

            time.sleep(0.1)

    final = get_current_count()
    print(f"\n{'=' * 60}")
    print(f"✅ Import Complete!")
    print(f"   New imported: {imported}")
    print(f"   Skipped: {skipped}")
    print(f"   Failed: {failed}")
    print(f"   Total: {final}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
