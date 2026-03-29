from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from auth import router as auth_router
from data import router as data_router
from share import router as share_router, init_db

# Initialize Supabase client (module level - reused across requests)
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")

supabase = None
supabase_init_error = None

if supabase_url and supabase_service_key:
    try:
        supabase = create_client(supabase_url, supabase_service_key)
        print(f"✅ Supabase connected: {supabase_url[:30]}...")
    except Exception as e:
        supabase = None
        supabase_init_error = str(e)
        print(f"❌ Supabase connection failed: {e}")
else:
    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not supabase_service_key:
        missing.append("SUPABASE_SERVICE_KEY")
    print(f"WARNING: Missing env vars: {', '.join(missing)}. Supabase features disabled.")

app = FastAPI()

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    await init_db()

# CORS - allow frontend origins
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(data_router)
app.include_router(share_router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Spotify City API connected ✅"}

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to verify environment config (no secrets exposed)"""
    frontend_url = os.getenv("FRONTEND_URL", "NOT_SET")
    return {
        "frontend_url_configured": frontend_url != "NOT_SET",
        "frontend_url": frontend_url if frontend_url != "NOT_SET" else None,
        "redirect_uri": os.getenv("SPOTIFY_REDIRECT_URI", "NOT_SET"),
        "allowed_origins": os.getenv("ALLOWED_ORIGINS", "NOT_SET"),
        "client_id_set": bool(os.getenv("SPOTIFY_CLIENT_ID")),
        "client_secret_set": bool(os.getenv("SPOTIFY_CLIENT_SECRET")),
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "supabase_key_set": bool(os.getenv("SUPABASE_SERVICE_KEY")),
        "supabase_connected": supabase is not None,
        "supabase_error": supabase_init_error,
    }
