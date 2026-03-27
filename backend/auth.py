import os
import secrets
import base64
import hashlib
from urllib.parse import urlencode
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from itsdangerous import URLSafeSerializer
import httpx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Serializer for signed cookies (replace secret with env var in prod)
serializer = URLSafeSerializer(os.getenv("SESSION_SECRET", "super-secret-key"), salt="session")

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI")

def generate_pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    return verifier, challenge

@router.get("/login")
async def login(request: Request):
    verifier, challenge = generate_pkce_pair()

    # Spotify auth URL
    auth_url = "https://accounts.spotify.com/authorize?" + urlencode({
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "code_challenge_method": "S256",
        "code_challenge": challenge,
        "scope": "user-read-email user-read-private user-top-read user-read-recently-played",
    })

    resp = RedirectResponse(url=auth_url)
    signed = serializer.dumps({"pkce_verifier": verifier})

    # Cookie settings: secure=False for local dev, samesite=lax for OAuth redirect
    resp.set_cookie(
        key="spotify_pkce",
        value=signed,
        httponly=True,
        samesite="lax",
        secure=False,  # Local dev only
        max_age=600    # 10 minutes
    )
    logger.info(f"Login: Set PKCE cookie, redirecting to Spotify")
    return resp

@router.get("/callback")
async def callback(request: Request, code: str, error: str = None):
    logger.info(f"Callback received: code present={bool(code)}, cookies={request.cookies.keys()}")

    if error:
        raise HTTPException(status_code=400, detail=f"Spotify error: {error}")

    signed = request.cookies.get("spotify_pkce")
    if not signed:
        logger.error("Missing PKCE cookie in callback")
        raise HTTPException(status_code=400, detail="Missing PKCE cookie - try logging in again")

    try:
        data = serializer.loads(signed)
        verifier = data["pkce_verifier"]
    except Exception as e:
        logger.error(f"Failed to deserialize PKCE cookie: {e}")
        raise HTTPException(status_code=400, detail="Invalid PKCE cookie")

    logger.info(f"Exchanging code for token with verifier present")

    token_resp = await httpx.AsyncClient().post(
        "https://accounts.spotify.com/api/token",
        data={
            "client_id": SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    if token_resp.status_code != 200:
        logger.error(f"Token exchange failed: {token_resp.text}")
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {token_resp.text}")

    token_data = token_resp.json()
    logger.info(f"Token exchange successful")

    # Store access token in signed cookie
    token_cookie = serializer.dumps({"access_token": token_data["access_token"]})
    resp = RedirectResponse(url="/")
    resp.set_cookie(
        key="spotify_token",
        value=token_cookie,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=3600  # 1 hour
    )
    # Clean up PKCE cookie
    resp.delete_cookie("spotify_pkce")
    return resp

@router.get("/me")
async def get_me(request: Request):
    signed = request.cookies.get("spotify_token")
    if not signed:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_data = serializer.loads(signed)
    access_token = token_data["access_token"]
    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            "https://api.spotify.com/v1/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if profile_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch profile")
        return profile_resp.json()

@router.get("/logout")
async def logout():
    """Clear auth cookies"""
    resp = RedirectResponse(url="/")
    resp.delete_cookie("spotify_token")
    resp.delete_cookie("spotify_pkce")
    return resp
