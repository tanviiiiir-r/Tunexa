import httpx
import traceback
from fastapi import APIRouter, Request, HTTPException
from itsdangerous import URLSafeSerializer
import os
from .city_generator import generate_city_payload

router = APIRouter()

serializer = URLSafeSerializer(os.getenv("SESSION_SECRET", "super-secret-key"), salt="session")

async def get_access_token(request: Request) -> str:
    signed = request.cookies.get("spotify_token")
    if not signed:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_data = serializer.loads(signed)
    return token_data["access_token"]

@router.get("/city_payload")
async def city_payload(request: Request):
    token = await get_access_token(request)
    async with httpx.AsyncClient() as client:
        # Top artists (limit 20, medium_term)
        artists_resp = await client.get(
            "https://api.spotify.com/v1/me/top/artists",
            params={"limit": 20, "time_range": "medium_term"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Top tracks (limit 50)
        tracks_resp = await client.get(
            "https://api.spotify.com/v1/me/top/tracks",
            params={"limit": 50},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Recently played (limit 50)
        recent_resp = await client.get(
            "https://api.spotify.com/v1/me/player/recently-played",
            params={"limit": 50},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Debug logging
        print(f"Artists status: {artists_resp.status_code}")
        print(f"Tracks status: {tracks_resp.status_code}")
        print(f"Recent status: {recent_resp.status_code}")

        # httpx uses is_success, not ok
        if not artists_resp.is_success:
            print(f"Artists error: {artists_resp.text}")
            raise HTTPException(status_code=502, detail=f"Spotify artists error: {artists_resp.status_code}")
        if not tracks_resp.is_success:
            print(f"Tracks error: {tracks_resp.text}")
            raise HTTPException(status_code=502, detail=f"Spotify tracks error: {tracks_resp.status_code}")
        if not recent_resp.is_success:
            print(f"Recent error: {recent_resp.text}")
            raise HTTPException(status_code=502, detail=f"Spotify recent error: {recent_resp.status_code}")

        try:
            artists = artists_resp.json()["items"]
            tracks = tracks_resp.json()["items"]
            recent = recent_resp.json()["items"]
        except (KeyError, ValueError) as e:
            print(f"Parse error: {e}")
            raise HTTPException(status_code=502, detail="Failed to parse Spotify response")

        print(f"Got {len(artists)} artists, {len(tracks)} tracks, {len(recent)} recent plays")

        # Fetch audio features for tracks
        track_ids = [t["id"] for t in tracks if t.get("id")]
        audio_features = []
        if track_ids:
            features_resp = await client.get(
                "https://api.spotify.com/v1/audio-features",
                params={"ids": ",".join(track_ids[:100])},  # API limit is 100
                headers={"Authorization": f"Bearer {token}"},
            )
            if features_resp.is_success:
                audio_features = features_resp.json().get("audio_features", [])
                # Filter out None values
                audio_features = [f for f in audio_features if f]
            print(f"Fetched {len(audio_features)} audio features")

        # Generate the city layout using our generator
        city_data = generate_city_payload(artists, tracks, recent, audio_features)

        print(f"Generated city with {len(city_data['buildings'])} buildings and {len(city_data['districts'])} districts")

        return city_data
