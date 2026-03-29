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

# Supabase client - imported at runtime via get_supabase() to avoid circular imports

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

# Import supabase from main module (circular import handling)
def get_supabase():
    from main import supabase
    return supabase

def generate_friend_code() -> str:
    """Generate 6-char alphanumeric code (no 0/O/1/I)"""
    charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(charset) for _ in range(6))

@router.get("/callback")
async def callback(request: Request, code: str = None, state: str = None, error: str = None):
    logger.info(f"=== OAUTH CALLBACK ===")
    logger.info(f"Callback received: code present={bool(code)}, state={state}")
    logger.info(f"Query params: code={code is not None}, state={state is not None}, error={error}")

    if error:
        logger.error(f"OAuth error from Spotify: {error}")
        raise HTTPException(status_code=400, detail=f"Spotify error: {error}")

    if not code:
        logger.error("Missing authorization code")
        raise HTTPException(status_code=400, detail="Missing authorization code")

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
    access_token = token_data["access_token"]
    logger.info(f"Token exchange successful")

    # Fetch user profile from Spotify
    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            "https://api.spotify.com/v1/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if profile_resp.status_code != 200:
            logger.error(f"Failed to fetch profile: {profile_resp.text}")
            raise HTTPException(status_code=400, detail="Failed to fetch user profile")

        user = profile_resp.json()
        spotify_id = user["id"]
        display_name = user.get("display_name", "")
        image_url = user.get("images", [{}])[0].get("url") if user.get("images") else None

    # Upsert user to Supabase
    logger.info(f"Starting Supabase upsert for user: {spotify_id}")
    supabase = get_supabase()
    friend_code = None
    if supabase:
        logger.info("Supabase client is available")
        try:
            # Try to insert, update on conflict
            try:
                result = supabase.table("users").insert({
                    "spotify_id": spotify_id,
                    "display_name": display_name,
                    "image_url": image_url
                }).execute()
                logger.info(f"User inserted: {spotify_id}")
            except Exception as insert_err:
                # User exists, update instead
                logger.info(f"Insert failed (user exists?), trying update: {insert_err}")
                result = supabase.table("users").update({
                    "display_name": display_name,
                    "image_url": image_url
                }).eq("spotify_id", spotify_id).execute()
                logger.info(f"User updated: {spotify_id}")

            # Check if friend code exists
            existing = supabase.table("friend_codes").select("code").eq("user_id", spotify_id).execute()
            logger.info(f"Friend code check: {existing.data}")

            if not existing.data:
                # Generate unique friend code (retry up to 3x)
                for attempt in range(3):
                    try:
                        code = generate_friend_code()
                        supabase.table("friend_codes").insert({
                            "user_id": spotify_id,
                            "code": code
                        }).execute()
                        friend_code = code
                        logger.info(f"Friend code generated: {code}")
                        break
                    except Exception as e:
                        logger.warning(f"Friend code attempt {attempt+1} failed: {e}")
                        if attempt == 2:
                            logger.error(f"Failed to generate friend code after 3 attempts: {e}")
                        continue
            else:
                friend_code = existing.data[0]["code"]
                logger.info(f"Existing friend code: {friend_code}")
        except Exception as e:
            logger.error(f"Supabase error during user upsert: {e}", exc_info=True)
            friend_code = None
    else:
        logger.warning("Supabase not configured, skipping user upsert")

    # Redirect to frontend with token and friend code
    token_cookie = serializer.dumps({"access_token": access_token})
    redirect_url = f"{FRONTEND_URL}?token={token_cookie}"
    if friend_code:
        redirect_url += f"&friend_code={friend_code}"

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
