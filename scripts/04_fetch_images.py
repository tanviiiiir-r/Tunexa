"""
Session 1 - Step 4: Fetch artist images from TheAudioDB

TheAudioDB provides free artist images
No API key required for non-commercial use
Rate limit: Be respectful, ~1 sec between requests
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

def fetch_artist_image(artist_name):
    """Fetch artist image from TheAudioDB"""
    try:
        # TheAudioDB search endpoint (no API key needed for search)
        url = f"https://www.theaudiodb.com/api/v1/json/2/search.php?s={artist_name.replace(' ', '%20')}"

        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if 'artists' in data and data['artists']:
                artist = data['artists'][0]
                # Get the artist thumbnail or fanart
                image_url = artist.get('strArtistThumb') or artist.get('strArtistFanart')
                return image_url
        return None
    except Exception as e:
        print(f"  ⚠️  Error fetching image for {artist_name}: {e}")
        return None

def main():
    print("=" * 60)
    print("TheAudioDB Image Fetch")
    print("=" * 60)

    # Fetch artists without images
    try:
        result = supabase.table('artists')\
            .select('id, name, image_url')\
            .is_('image_url', 'null')\
            .execute()

        artists = result.data if hasattr(result, 'data') else []

        if not artists:
            print("✅ All artists already have images!")
            return

        print(f"Found {len(artists)} artists without images")
        print("Rate: 1 sec delay between requests")
        print("=" * 60)

        updated = 0
        failed = 0

        for i, artist in enumerate(artists, 1):
            name = artist['name']
            print(f"[{i}/{len(artists)}] {name}...", end=" ", flush=True)

            image_url = fetch_artist_image(name)

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

            # Rate limiting
            time.sleep(1.1)

        print("\n" + "=" * 60)
        print(f"✅ Complete!")
        print(f"   Updated: {updated}")
        print(f"   Failed: {failed}")

        # Show stats
        result = supabase.table('artists')\
            .select('image_url')\
            .not_.is_('image_url', 'null')\
            .execute()
        with_images = len(result.data) if hasattr(result, 'data') else 0
        print(f"   Total with images: {with_images}")
        print("=" * 60)

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
