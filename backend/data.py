import httpx
import traceback
from fastapi import APIRouter, Request, HTTPException
from itsdangerous import URLSafeSerializer
import os

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

        # Collect track IDs for audio features
        track_ids = [t["id"] for t in tracks]
        features_resp = await client.get(
            "https://api.spotify.com/v1/audio-features",
            params={"ids": ",".join(track_ids)},
            headers={"Authorization": f"Bearer {token}"},
        )
        features = features_resp.json().get("audio_features", []) if features_resp.is_success else []

        # Assemble payload
        payload = {
            "artists": artists,
            "tracks": tracks,
            "recently_played": recent,
            "audio_features": features,
        }
        return payload
