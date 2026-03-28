"""
City Generation Logic for Spotify City
Transforms Spotify listening data into 3D city layout
"""
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple

# Language to Country mapping
LANGUAGE_TO_COUNTRY = {
    "eng": "US",
    "kor": "KR",
    "jpn": "JP",
    "spa": "ES",
    "por": "BR",
    "fra": "FR",
    "deu": "DE",
    "hin": "IN",
    "ara": "EG",
    "swe": "SE",
}

# Genre hints for language detection
GENRE_LANGUAGE_HINTS = {
    "k-pop": "kor",
    "k-hip-hop": "kor",
    "k-indie": "kor",
    "j-pop": "jpn",
    "j-rock": "jpn",
    "anime": "jpn",
    "city pop": "jpn",
    "reggaeton": "spa",
    "latin": "spa",
    "samba": "por",
    "bossa nova": "por",
    "afrobeats": "eng",
    "bollywood": "hin",
}

# Genre to District mapping with colors
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

def detect_language(artist_name: str, genres: List[str]) -> str:
    """Detect language from artist name and genres"""
    for genre in genres:
        genre_lower = genre.lower()
        if genre_lower in GENRE_LANGUAGE_HINTS:
            return GENRE_LANGUAGE_HINTS[genre_lower]
    if any(char in artist_name for char in "あいうえおアイウエオ"):
        return "jpn"
    if any(char in artist_name for char in "가나다라마바사아자차카타파하"):
        return "kor"
    if any(char in artist_name for char in "ñáéíóúü"):
        return "spa"
    return "eng"

def get_country_code(language: str) -> str:
    """Map language code to country code"""
    return LANGUAGE_TO_COUNTRY.get(language, "US")

def map_genre_to_district(genres: List[str]) -> Tuple[str, Dict]:
    """Map artist genres to a district"""
    if not genres:
        return "pop", GENRE_DISTRICTS["pop"]
    for genre in genres:
        genre_lower = genre.lower()
        for key in GENRE_DISTRICTS:
            if key in genre_lower:
                return key, GENRE_DISTRICTS[key]
    return "pop", GENRE_DISTRICTS["pop"]

def calculate_building_dimensions(
    listening_minutes: int,
    song_count: int,
    popularity: int
) -> Dict[str, float]:
    """Calculate building dimensions - SQUARE like GitHub contributions"""
    # GitHub-style: Square base, height represents activity
    # Square buildings (width = depth) for grid layout
    base_size = 8  # Uniform square base
    height = min(max(listening_minutes / 30 * 15, 10), 150)  # Height varies by listening time

    return {
        "width": base_size,
        "height": height,
        "depth": base_size  # Square base!
    }

def is_recently_played(last_played: str) -> bool:
    """Check if track was played within last 7 days"""
    if not last_played:
        return False
    try:
        played_date = datetime.fromisoformat(last_played.replace('Z', '+00:00'))
        return (datetime.now(played_date.tzinfo) - played_date) <= timedelta(days=7)
    except:
        return False

def generate_windows(songs: List[Dict]) -> List[Dict]:
    """Generate windows for building (each song = 1-2 windows)"""
    windows = []
    for i, song in enumerate(songs[:20]):
        is_lit = is_recently_played(song.get("played_at", ""))
        windows.append({
            "floor": i,
            "is_lit": is_lit,
            "glow_intensity": 1.0 if is_lit else 0.3,
            "song_id": song.get("id"),
            "song_name": song.get("name")
        })
    return windows

def generate_grid_layout(
    artists: List[Dict],
    tracks: List[Dict],
    recently_played: List[Dict]
) -> tuple[List[Dict], Dict[str, Dict]]:
    """
    Generate GRID layout like GitHub contributions
    Buildings arranged in neat rows/columns by district
    """
    # Build genre frequency map
    genre_counts = {}
    for artist in artists:
        for genre in artist.get("genres", []):
            if genre:
                genre_counts[genre] = genre_counts.get(genre, 0) + 1

    # Get top genres sorted by count
    top_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)

    # Group artists by genre
    district_artists = {}
    for artist in artists:
        genre_key, district_info = map_genre_to_district(artist.get("genres", []))
        if genre_key not in district_artists:
            district_artists[genre_key] = {
                "artists": [],
                "info": district_info
            }
        district_artists[genre_key]["artists"].append(artist)

    # Create buildings
    buildings = []

    # GitHub-style grid parameters
    BUILDING_SPACING = 15  # Space between buildings
    DISTRICT_SPACING = 200  # Space between districts
    GRID_SIZE = 7  # 7x7 grid per district (like GitHub's 7 days x weeks)

    # Position districts in a larger grid
    district_positions = [
        (0, 0), (1, 0), (2, 0),  # Row 1: 3 districts
        (0, 1), (1, 1), (2, 1),  # Row 2: 3 districts
        (0, 2), (1, 2),          # Row 3: 2 districts
    ]

    district_list = list(district_artists.items())

    for idx, (genre_key, data) in enumerate(district_list):
        district_artists_list = data["artists"]
        district_info = data["info"]

        # Sort by popularity (most popular first = in front)
        district_artists_list.sort(
            key=lambda a: a.get("popularity", 0),
            reverse=True
        )

        # Get district grid position
        if idx < len(district_positions):
            district_col, district_row = district_positions[idx]
        else:
            # Extra districts go to the right
            district_col, district_row = idx % 3, idx // 3

        district_offset_x = district_col * DISTRICT_SPACING
        district_offset_z = district_row * DISTRICT_SPACING

        # Position artists in GRID within district
        for i, artist in enumerate(district_artists_list):
            # Grid position: row and column
            row = i // GRID_SIZE
            col = i % GRID_SIZE

            # Calculate position in grid
            x = district_offset_x + (col * BUILDING_SPACING)
            z = district_offset_z + (row * BUILDING_SPACING)

            # Get artist tracks
            artist_tracks = [
                t for t in tracks
                if any(a.get("id") == artist.get("id") for a in t.get("artists", []))
            ]

            # Calculate listening data
            listening_ms = sum(t.get("duration_ms", 0) for t in artist_tracks)
            listening_minutes = listening_ms / 60000 if listening_ms > 0 else artist.get("popularity", 50) / 100 * 150
            song_count = len(artist_tracks) if artist_tracks else artist.get("popularity", 50) // 5
            popularity = artist.get("popularity", 50)

            dimensions = calculate_building_dimensions(
                listening_minutes,
                song_count,
                popularity
            )

            # Use district color
            building_color = district_info["color"]

            # Check if recently played
            last_played = None
            for rp in recently_played:
                if rp.get("track", {}).get("artists", [{}])[0].get("id") == artist.get("id"):
                    last_played = rp.get("played_at")
                    break

            is_recent = is_recently_played(last_played) if last_played else False

            # Generate windows
            artist_tracks_limited = artist_tracks[:10]
            windows = generate_windows(artist_tracks_limited)

            building = {
                "id": f"building_{artist['id']}",
                "artist_id": artist["id"],
                "artist_name": artist["name"],
                "artist_image_url": artist.get("images", [{}])[0].get("url", ""),
                "position": {
                    "x": round(x, 2),
                    "y": 0,
                    "z": round(z, 2)
                },
                "dimensions": dimensions,
                "style": {
                    "color": building_color,
                    "brightness": popularity / 100,
                    "glow_intensity": 1.0 if is_recent else 0.3,
                    "animation": is_recent,
                    "texture": "glass",
                    "roof_style": "flat"
                },
                "metadata": {
                    "genre": genre_key,
                    "language": detect_language(artist["name"], artist.get("genres", [])),
                    "listening_minutes": listening_minutes,
                    "song_count": song_count,
                    "popularity": popularity,
                    "followers": artist.get("followers", {}).get("total", 0),
                    "last_played": last_played
                },
                "windows": windows,
                "floors": [
                    {
                        "floor_number": j + 1,
                        "track_id": t.get("id"),
                        "track_name": t.get("name"),
                        "album_cover": t.get("album", {}).get("images", [{}])[0].get("url", ""),
                        "duration_ms": t.get("duration_ms", 0),
                        "preview_url": t.get("preview_url"),
                        "is_lit": is_recently_played(t.get("played_at", "")),
                    }
                    for j, t in enumerate(artist_tracks_limited)
                ]
            }
            buildings.append(building)

    return buildings, district_artists


def generate_grid_layout(
    artists: List[Dict],
    tracks: List[Dict],
    recently_played: List[Dict]
) -> tuple[List[Dict], Dict[str, Dict]]:
    """
    Generate GRID layout like GitHub contribution graph
    Buildings organized in rows by district, columns by popularity
    """
    # Build genre frequency map
    genre_counts = {}
    for artist in artists:
        for genre in artist.get("genres", []):
            if genre:
                genre_counts[genre] = genre_counts.get(genre, 0) + 1

    # Group artists by genre (district)
    district_artists = {}
    for artist in artists:
        genre_key, district_info = map_genre_to_district(artist.get("genres", []))
        if genre_key not in district_artists:
            district_artists[genre_key] = {
                "artists": [],
                "info": district_info
            }
        district_artists[genre_key]["artists"].append(artist)

    buildings = []

    # Sort districts by number of artists (most popular first)
    sorted_districts = sorted(
        district_artists.items(),
        key=lambda x: len(x[1]["artists"]),
        reverse=True
    )

    # GRID layout parameters
    BUILDING_SPACING = 15  # Space between buildings
    ROW_SPACING = 50  # Space between district rows
    BUILDINGS_PER_ROW = 7  # Buildings per row (like GitHub's 7 days)

    current_row = 0

    for genre_key, data in sorted_districts:
        district_artists_list = data["artists"]
        district_info = data["info"]

        # Sort by popularity within district
        district_artists_list.sort(
            key=lambda a: a.get("popularity", 0),
            reverse=True
        )

        # Calculate row position for this district
        row_z = current_row * ROW_SPACING

        # Place buildings in grid within district
        for i, artist in enumerate(district_artists_list):
            # Grid position calculation
            col = i % BUILDINGS_PER_ROW
            row_in_district = i // BUILDINGS_PER_ROW

            # Position in grid
            x = (col - BUILDINGS_PER_ROW // 2) * BUILDING_SPACING
            z = row_z + (row_in_district * BUILDING_SPACING)

            # Get artist tracks
            artist_tracks = [
                t for t in tracks
                if any(a.get("id") == artist.get("id") for a in t.get("artists", []))
            ]

            # Calculate metrics
            listening_ms = sum(t.get("duration_ms", 0) for t in artist_tracks)
            listening_minutes = listening_ms / 60000 if listening_ms > 0 else artist.get("popularity", 50) / 100 * 150
            song_count = len(artist_tracks) if artist_tracks else artist.get("popularity", 50) // 5
            popularity = artist.get("popularity", 50)

            dimensions = calculate_building_dimensions(
                listening_minutes,
                song_count,
                popularity
            )

            # Check if recently played
            last_played = None
            for rp in recently_played:
                if rp.get("track", {}).get("artists", [{}])[0].get("id") == artist.get("id"):
                    last_played = rp.get("played_at")
                    break

            is_recent = is_recently_played(last_played) if last_played else False

            # Generate windows
            artist_tracks_limited = artist_tracks[:10]
            windows = generate_windows(artist_tracks_limited)

            building = {
                "id": f"building_{artist['id']}",
                "artist_id": artist["id"],
                "artist_name": artist["name"],
                "artist_image_url": artist.get("images", [{}])[0].get("url", ""),
                "position": {
                    "x": round(x, 2),
                    "y": 0,
                    "z": round(z, 2)
                },
                "dimensions": dimensions,
                "style": {
                    "color": district_info["color"],
                    "brightness": popularity / 100,
                    "glow_intensity": 1.0 if is_recent else 0.3,
                    "animation": is_recent,
                    "texture": "glass",
                    "roof_style": "flat"
                },
                "metadata": {
                    "genre": genre_key,
                    "language": detect_language(artist["name"], artist.get("genres", [])),
                    "listening_minutes": listening_minutes,
                    "song_count": song_count,
                    "popularity": popularity,
                    "followers": artist.get("followers", {}).get("total", 0),
                    "last_played": last_played
                },
                "windows": windows,
                "floors": [
                    {
                        "floor_number": j + 1,
                        "track_id": t.get("id"),
                        "track_name": t.get("name"),
                        "album_cover": t.get("album", {}).get("images", [{}])[0].get("url", ""),
                        "duration_ms": t.get("duration_ms", 0),
                        "preview_url": t.get("preview_url"),
                        "is_lit": is_recently_played(t.get("played_at", "")),
                    }
                    for j, t in enumerate(artist_tracks_limited)
                ]
            }
            buildings.append(building)

        # Move to next row for next district
        district_rows = (len(district_artists_list) + BUILDINGS_PER_ROW - 1) // BUILDINGS_PER_ROW
        current_row += max(district_rows, 1) + 1  # +1 for gap between districts

    return buildings, district_artists

def generate_radial_layout(
    artists: List[Dict],
    tracks: List[Dict],
    recently_played: List[Dict]
) -> tuple[List[Dict], Dict[str, Dict]]:
    """
    [LEGACY] Generate radial layout for My City mode
    Kept for backwards compatibility, but grid is now default
    """
    return generate_grid_layout(artists, tracks, recently_played)

def generate_city_payload(
    artists: List[Dict],
    tracks: List[Dict],
    recently_played: List[Dict],
    audio_features: List[Dict]
) -> Dict:
    """
    Main function to generate complete city payload
    """
    # Generate buildings with GRID layout (GitHub-style)
    buildings, district_artists = generate_grid_layout(artists, tracks, recently_played)

    # Create district info from actual districts used
    districts = []
    for genre_key, data in district_artists.items():
        info = data["info"]
        districts.append({
            "name": f"{genre_key.title()} District",
            "genre": genre_key,
            "color": info["color"],
            "direction": info["direction"]
        })

    return {
        "buildings": buildings,
        "districts": districts,
        "stats": {
            "total_artists": len(artists),
            "total_tracks": len(tracks),
            "total_buildings": len(buildings),
            "genres": list(district_artists.keys())[:10]
        }
    }
