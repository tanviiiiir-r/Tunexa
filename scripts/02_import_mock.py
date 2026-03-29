"""
Session 1 - Step 1 (Alternative): Import mock artists for testing

MusicBrainz API having SSL issues - using mock data to test pipeline.
For production, use the JSON dump approach instead.
"""
import os
import sys
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Mock artists with realistic data (based on popular artists)
MOCK_ARTISTS = [
    {"name": "The Beatles", "genre": "rock", "track_count": 213},
    {"name": "Radiohead", "genre": "alternative rock", "track_count": 156},
    {"name": "Kanye West", "genre": "hip-hop", "track_count": 245},
    {"name": "Beyoncé", "genre": "pop", "track_count": 178},
    {"name": "Taylor Swift", "genre": "pop", "track_count": 198},
    {"name": "Drake", "genre": "hip-hop", "track_count": 267},
    {"name": "Ed Sheeran", "genre": "pop", "track_count": 134},
    {"name": "Ariana Grande", "genre": "pop", "track_count": 145},
    {"name": "Coldplay", "genre": "rock", "track_count": 167},
    {"name": "Eminem", "genre": "hip-hop", "track_count": 289},
    {"name": "Rihanna", "genre": "pop", "track_count": 123},
    {"name": "Lady Gaga", "genre": "pop", "track_count": 156},
    {"name": "Bruno Mars", "genre": "pop", "track_count": 89},
    {"name": "The Weeknd", "genre": "r&b", "track_count": 134},
    {"name": "Billie Eilish", "genre": "electronic", "track_count": 67},
    {"name": "Post Malone", "genre": "hip-hop", "track_count": 112},
    {"name": "Dua Lipa", "genre": "pop", "track_count": 78},
    {"name": "Justin Bieber", "genre": "pop", "track_count": 156},
    {"name": "SZA", "genre": "r&b", "track_count": 67},
    {"name": "Doja Cat", "genre": "pop", "track_count": 89},
    {"name": "Arctic Monkeys", "genre": "indie", "track_count": 123},
    {"name": "Daft Punk", "genre": "electronic", "track_count": 145},
    {"name": "Jay-Z", "genre": "hip-hop", "track_count": 234},
    {"name": "Adele", "genre": "pop", "track_count": 89},
    {"name": "Nirvana", "genre": "rock", "track_count": 134},
]

def main():
    print("=" * 60)
    print("Mock Artist Import (MusicBrainz API bypass)")
    print("=" * 60)
    print(f"Target: {len(MOCK_ARTISTS)} artists")
    print("=" * 60)

    imported = 0
    failed = 0

    for i, artist in enumerate(MOCK_ARTISTS, 1):
        print(f"\n[{i}/{len(MOCK_ARTISTS)}] {artist['name']}")

        # Generate mock MBID
        import uuid
        mock_mbid = str(uuid.uuid4())

        artist_record = {
            'mbid': mock_mbid,
            'name': artist['name'],
            'track_count': artist['track_count'],
            'genre': artist['genre'],
            'sub_genres': [artist['genre']],
            'is_active': True
        }

        try:
            result = supabase.table('artists').insert(artist_record).execute()
            print(f"  ✅ Imported (genre: {artist['genre']}, tracks: {artist['track_count']})")
            imported += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"✅ Complete!")
    print(f"   Imported: {imported}")
    print(f"   Failed: {failed}")

    # Verify
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        count = result.count if hasattr(result, 'count') else 'unknown'
        print(f"   Total in database: {count}")
    except Exception as e:
        print(f"   Could not verify: {e}")

    print("=" * 60)

if __name__ == "__main__":
    main()
