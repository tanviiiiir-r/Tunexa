"""
Session 1 - Step 3: Enrich artists with images from TheAudioDB

TheAudioDB provides free artist images
- Sign up: https://www.theaudiodb.com/
- Free tier available
- Alternative: MusicBrainz Cover Art Archive
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
AUDIODB_API_KEY = os.getenv("AUDIODB_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fetch_audiodb_image(artist_name):
    """Fetch artist image from TheAudioDB"""
    if not AUDIODB_API_KEY:
        return None

    try:
        url = f"https://theaudiodb.com/api/v1/json/{AUDIODB_API_KEY}/search.php"
        params = {'s': artist_name}

        response = requests.get(url, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if 'artists' in data and data['artists']:
                artist = data['artists'][0]
                # Get highest quality image
                for field in ['strArtistLogo', 'strArtistLogoWide', 'strArtistFanart', 'strArtistThumb']:
                    if artist.get(field):
                        return artist[field]
        return None
    except Exception as e:
        return None

def fetch_musicbrainz_image(mbid):
    """Fallback: Fetch from MusicBrainz Cover Art Archive"""
    if not mbid:
        return None

    try:
        url = f"http://coverartarchive.org/release-group/?artist={mbid}"
        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if 'images' in data and data['images']:
                return data['images'][0].get('image')
        return None
    except:
        return None

def main():
    print("=" * 60)
    print("Image Enrichment (TheAudioDB + MusicBrainz)")
    print("=" * 60)

    if not AUDIODB_API_KEY:
        print("⚠️  Warning: AUDIODB_API_KEY not set")
        print("   Continuing with MusicBrainz fallback only...")

    # Fetch artists without images
    try:
        result = supabase.table('artists')\
            .select('id, name, mbid, image_url')\
            .is_('image_url', 'null')\
            .execute()

        artists = result.data if hasattr(result, 'data') else []

        if not artists:
            print("✅ All artists already have images!")
            return

        print(f"Found {len(artists)} artists needing images")
        print("=" * 60)

        updated = 0
        failed = 0

        for i, artist in enumerate(artists, 1):
            name = artist['name']
            mbid = artist.get('mbid')

            print(f"[{i}/{len(artists)}] {name}...", end=" ")

            image_url = None

            # Try TheAudioDB first
            if AUDIODB_API_KEY:
                image_url = fetch_audiodb_image(name)

            # Fallback to MusicBrainz
            if not image_url and mbid:
                image_url = fetch_musicbrainz_image(mbid)

            if image_url:
                # Update Supabase
                supabase.table('artists')\
                    .update({'image_url': image_url})\
                    .eq('id', artist['id'])\
                    .execute()
                print(f"✓ Image found")
                updated += 1
            else:
                print("⚠️  No image")
                failed += 1

            # Be nice to APIs
            time.sleep(0.5)

        print("\n" + "=" * 60)
        print(f"✅ Complete!")
        print(f"   Updated: {updated}")
        print(f"   Failed: {failed}")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
