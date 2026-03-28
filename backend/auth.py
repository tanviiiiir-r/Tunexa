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

# Serializer for signed cookies
serializer = URLSafeSerializer(os.getenv("SESSION_SECRET", "super-secret-key"), salt="session")

# Simple in-memory store for PKCE verifiers (for local dev only - use Redis in production)
# Key: state parameter, Value: pkce_verifier
pkce_store = {}

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")

def generate_pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    return verifier, challenge

@router.get("/login")
async def login(request: Request):
    verifier, challenge = generate_pkce_pair()

    # Generate a state parameter to track this auth request
    state = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
    pkce_store[state] = verifier

    # Spotify auth URL
    auth_url = "https://accounts.spotify.com/authorize?" + urlencode({
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "code_challenge_method": "S256",
        "code_challenge": challenge,
        "state": state,
        "scope": "user-read-email user-read-private user-top-read user-read-recently-played",
    })

    resp = RedirectResponse(url=auth_url)
    logger.info(f"Login: Stored PKCE for state={state[:8]}..., redirecting to Spotify")
    return resp

@router.get("/callback")
async def callback(request: Request, code: str, state: str = None, error: str = None):
    logger.info(f"Callback received: code present={bool(code)}, state={state}")

    if error:
        raise HTTPException(status_code=400, detail=f"Spotify error: {error}")

    if not state:
        logger.error("Missing state parameter")
        raise HTTPException(status_code=400, detail="Missing state parameter")

    # Retrieve verifier from store
    verifier = pkce_store.pop(state, None)
    if not verifier:
        logger.error(f"No PKCE verifier found for state={state[:8]}...")
        raise HTTPException(status_code=400, detail="Session expired - try logging in again")

    logger.info(f"Exchanging code for token")

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

    # Redirect to frontend with token in URL (for cross-domain)
    # Token is encrypted so it's safe in URL
    token_cookie = serializer.dumps({"access_token": token_data["access_token"]})
    redirect_url = f"{FRONTEND_URL}?token={token_cookie}"
    resp = RedirectResponse(url=redirect_url)
    return resp

@router.get("/me")
async def get_me(request: Request):
    # Try cookie first, then Authorization header
    signed = request.cookies.get("spotify_token")
    auth_header = request.headers.get("Authorization", "")

    if auth_header.startswith("Bearer "):
        signed = auth_header.replace("Bearer ", "")

    if not signed:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        token_data = serializer.loads(signed)
        access_token = token_data["access_token"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

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
    """Clear auth - frontend handles token removal"""
    return {"message": "Logged out"}
