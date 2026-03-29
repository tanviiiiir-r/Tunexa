"""
Session 1 - Step 2: Enrich artists with Last.fm listener data

Prerequisite: Get a Last.fm API key
- https://www.last.fm/api/account/create
- Free, no approval needed
- Rate limit: 5 requests/second
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

def fetch_lastfm_listeners(artist_name):
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
                listeners = data['artist']['stats'].get('listeners', 0)
                playcount = data['artist']['stats'].get('playcount', 0)
                return int(listeners) if listeners else 0, int(playcount) if playcount else 0
        return 0, 0
    except Exception as e:
        print(f"  ⚠️  Error fetching Last.fm data for {artist_name}: {e}")
        return 0, 0

def main():
    print("=" * 60)
    print("Last.fm Enrichment")
    print("=" * 60)

    # Fetch artists without lastfm_listeners
    try:
        result = supabase.table('artists')\
            .select('id, name, lastfm_listeners')\
            .is_('lastfm_listeners', 0)\
            .execute()

        artists = result.data if hasattr(result, 'data') else []

        if not artists:
            print("✅ All artists already have Last.fm data!")
            return

        print(f"Found {len(artists)} artists to enrich")
        print("Rate: 5 req/sec (0.2s delay between requests)")
        print("=" * 60)

        updated = 0
        failed = 0

        for i, artist in enumerate(artists, 1):
            name = artist['name']
            print(f"[{i}/{len(artists)}] {name}...", end=" ")

            listeners, playcount = fetch_lastfm_listeners(name)

            if listeners > 0:
                # Update Supabase
                supabase.table('artists')\
                    .update({'lastfm_listeners': listeners})\
                    .eq('id', artist['id'])\
                    .execute()
                print(f"✓ {listeners:,} listeners")
                updated += 1
            else:
                print("⚠️  No data")
                failed += 1

            # Rate limiting: 0.2s = 5 req/sec
            time.sleep(0.2)

        print("\n" + "=" * 60)
        print(f"✅ Complete!")
        print(f"   Updated: {updated}")
        print(f"   Failed: {failed}")

        # Show stats
        result = supabase.table('artists')\
            .select('lastfm_listeners')\
            .gt('lastfm_listeners', 0)\
            .execute()
        enriched = len(result.data) if hasattr(result, 'data') else 0
        print(f"   Total enriched: {enriched}")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
