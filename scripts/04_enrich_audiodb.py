"""
Session 1 - Step 3: Fetch artist images from TheAudioDB

TheAudioDB provides free artist images.
Alternative: MusicBrainz Cover Art Archive

Prerequisite: Get TheAudioDB API key
- https://www.theaudiodb.com/api_key.php
- Free, instant approval
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

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fetch_audiodb_image(artist_name):
    """Fetch artist image from TheAudioDB"""
    if not AUDIODB_API_KEY:
        return None

    try:
        url = f"https://www.theaudiodb.com/api/v1/json/{AUDIODB_API_KEY}/search.php?s={artist_name}"
        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if 'artists' in data and data['artists']:
                artist_data = data['artists'][0]
                # Get large artist image
                image_url = artist_data.get('strArtistThumb') or artist_data.get('strArtistLogo')
                return image_url
        return None
    except Exception as e:
        print(f"  ⚠️  Error: {e}")
        return None

def main():
    print("=" * 60)
    print("TheAudioDB Image Enrichment")
    print("=" * 60)

    if not AUDIODB_API_KEY:
        print("⚠️  AUDIODB_API_KEY not set")
        print("   Get free key at: https://www.theaudiodb.com/api_key.php")
        print("   Continuing without images...")
        return

    # Fetch artists without images
    try:
        result = supabase.table('artists')\
            .select('id, name')\
            .is_('image_url', 'null')\
            .execute()

        artists = result.data if hasattr(result, 'data') else []

        if not artists:
            print("✅ All artists have images!")
            return

        print(f"Found {len(artists)} artists needing images")

        updated = 0

        for i, artist in enumerate(artists, 1):
            name = artist['name']
            print(f"[{i}/{len(artists)}] {name}...", end=" ")

            image_url = fetch_audiodb_image(name)

            if image_url:
                supabase.table('artists')\
                    .update({'image_url': image_url})\
                    .eq('id', artist['id'])\
                    .execute()
                print(f"✓ Got image")
                updated += 1
            else:
                print("⚠️  No image")

            time.sleep(0.5)  # Be nice to the API

        print(f"\n✅ Updated {updated} artists with images")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
