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
    """Calculate building dimensions - exaggerated for visual variety"""
    # More dramatic scaling so differences are visible
    height = min(max(listening_minutes / 30 * 15, 8), 120)  # Taller range, lower min
    width = min(max(song_count * 2.5, 4), 30)  # Wider range
    depth = min(max(popularity / 8, 4), 20)  # More depth variation
    return {
        "width": width,
        "height": height,
        "depth": depth
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

def generate_radial_layout(
    artists: List[Dict],
    tracks: List[Dict],
    recently_played: List[Dict]
) -> tuple[List[Dict], Dict[str, Dict]]:
    """
    Generate radial layout for My City mode
    Returns buildings and district info used
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

    # Process each district
    for genre_key, data in district_artists.items():
        district_artists_list = data["artists"]
        district_info = data["info"]

        # Sort by popularity/listening
        district_artists_list.sort(
            key=lambda a: a.get("popularity", 0),
            reverse=True
        )

        # Calculate district center position
        angle_rad = math.radians(district_info["direction"])
        top_genre_name = top_genres[0][0] if top_genres else "pop"
        distance = 0 if genre_key == top_genre_name else 150

        district_center_x = distance * math.cos(angle_rad)
        district_center_z = distance * math.sin(angle_rad)

        # Position artists within district
        for i, artist in enumerate(district_artists_list):
            artist_angle = (i / max(len(district_artists_list), 1)) * 2 * math.pi
            radius = 40 + (i * 25)

            x = district_center_x + radius * math.cos(artist_angle)
            z = district_center_z + radius * math.sin(artist_angle)

            # Get artist tracks
            artist_tracks = [
                t for t in tracks
                if any(a.get("id") == artist.get("id") for a in t.get("artists", []))
            ]

            # Calculate real listening minutes from tracks
            listening_ms = sum(t.get("duration_ms", 0) for t in artist_tracks)
            listening_minutes = listening_ms / 60000 if listening_ms > 0 else artist.get("popularity", 50) / 100 * 150
            song_count = len(artist_tracks) if artist_tracks else artist.get("popularity", 50) // 5
            popularity = artist.get("popularity", 50)

            dimensions = calculate_building_dimensions(
                listening_minutes,
                song_count,
                popularity
            )

            # Use district color for building
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

def generate_city_payload(
    artists: List[Dict],
    tracks: List[Dict],
    recently_played: List[Dict],
    audio_features: List[Dict]
) -> Dict:
    """
    Main function to generate complete city payload
    """
    # Generate buildings with radial layout (audio_features not used for colors)
    buildings, district_artists = generate_radial_layout(artists, tracks, recently_played)

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
