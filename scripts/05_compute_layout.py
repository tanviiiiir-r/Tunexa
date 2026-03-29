"""
Session 1 - Step 4: Compute 3D layout

Calculates:
- height = log_normalize(lastfm_listeners)
- width = log_normalize(track_count)
- city_x, city_z = grid position by genre district
"""
import os
import sys
import math
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Genre to district mapping (from city_generator.py)
GENRE_DISTRICTS = {
    "pop": {"color": "#FF69B4", "direction": 0},
    "hip-hop": {"color": "#8A2BE2", "direction": 90},
    "rock": {"color": "#DC143C", "direction": 180},
    "electronic": {"color": "#00CED1", "direction": 270},
    "r&b": {"color": "#FF8C00", "direction": 45},
    "country": {"color": "#228B22", "direction": 135},
    "indie": {"color": "#9370DB", "direction": 225},
    "metal": {"color": "#2F4F4F", "direction": 315},
    "jazz": {"color": "#FFD700", "direction": 30},
    "classical": {"color": "#F5F5DC", "direction": 60},
    "folk": {"color": "#8B4513", "direction": 120},
    "soul": {"color": "#FF1493", "direction": 150},
    "funk": {"color": "#FF4500", "direction": 210},
    "disco": {"color": "#FF00FF", "direction": 240},
    "house": {"color": "#00FF7F", "direction": 300},
    "techno": {"color": "#1E90FF", "direction": 330},
    "k-pop": {"color": "#FF6B9D", "direction": 0},
    "j-pop": {"color": "#FF1493", "direction": 0},
    "reggaeton": {"color": "#FFD700", "direction": 90},
    "default": {"color": "#808080", "direction": 0},
}

def log_normalize(value, min_val, max_val, out_min, out_max):
    """Log-normalize a value to output range"""
    if value <= 0:
        return out_min

    log_val = math.log10(value)
    log_min = math.log10(min_val)
    log_max = math.log10(max_val)

    # Clamp to range
    log_val = max(log_min, min(log_max, log_val))

    # Normalize to 0-1
    normalized = (log_val - log_min) / (log_max - log_min)

    # Scale to output range
    return out_min + (normalized * (out_max - out_min))

def get_genre_key(genre):
    """Map genre to district key"""
    if not genre:
        return "default"
    genre_lower = genre.lower()
    for key in GENRE_DISTRICTS:
        if key in genre_lower:
            return key
    return "default"

def compute_layout():
    """Compute layout for all artists"""
    print("=" * 60)
    print("Computing 3D Layout")
    print("=" * 60)

    # Fetch all artists
    result = supabase.table('artists')\
        .select('id, name, lastfm_listeners, track_count, genre')\
        .execute()

    artists = result.data if hasattr(result, 'data') else []

    if not artists:
        print("❌ No artists found. Run 02_import_musicbrainz.py first.")
        return

    print(f"Processing {len(artists)} artists...")

    # Group by genre
    genre_groups = {}
    for artist in artists:
        genre_key = get_genre_key(artist.get('genre'))
        if genre_key not in genre_groups:
            genre_groups[genre_key] = []
        genre_groups[genre_key].append(artist)

    print(f"Found {len(genre_groups)} genre districts")

    # Grid layout parameters
    BUILDING_SPACING = 15
    DISTRICT_SPACING = 200
    BUILDINGS_PER_ROW = 7

    updated = 0
    current_row = 0

    for genre_key, district_artists in genre_groups.items():
        print(f"\n📍 {genre_key.title()} District: {len(district_artists)} artists")

        # Sort by listeners (popularity)
        district_artists.sort(key=lambda a: a.get('lastfm_listeners', 0), reverse=True)

        row_z = current_row * DISTRICT_SPACING

        for i, artist in enumerate(district_artists):
            # Grid position
            col = i % BUILDINGS_PER_ROW
            row_in_district = i // BUILDINGS_PER_ROW

            x = (col - BUILDINGS_PER_ROW // 2) * BUILDING_SPACING
            z = row_z + (row_in_district * BUILDING_SPACING)

            # Calculate dimensions
            listeners = artist.get('lastfm_listeners', 1000)
            track_count = artist.get('track_count', 1)

            height = log_normalize(listeners, 1000, 10_000_000, 1.0, 20.0)
            width = log_normalize(track_count, 1, 5000, 0.5, 6.0)

            # Update artist
            supabase.table('artists').update({
                'height': round(height, 2),
                'width': round(width, 2),
                'city_x': round(x, 2),
                'city_z': round(z, 2)
            }).eq('id', artist['id']).execute()

            updated += 1

        # Move to next district row
        district_rows = (len(district_artists) + BUILDINGS_PER_ROW - 1) // BUILDINGS_PER_ROW
        current_row += max(district_rows, 1) + 1

    print("\n" + "=" * 60)
    print(f"✅ Computed layout for {updated} artists")

    # Show stats
    result = supabase.table('artists')\
        .select('height, width')\
        .gt('height', 0)\
        .execute()

    if hasattr(result, 'data') and result.data:
        heights = [a['height'] for a in result.data]
        widths = [a['width'] for a in result.data]
        print(f"\n📊 Statistics:")
        print(f"   Height: {min(heights):.1f} - {max(heights):.1f}")
        print(f"   Width: {min(widths):.1f} - {max(widths):.1f}")
    print("=" * 60)

if __name__ == "__main__":
    compute_layout()
