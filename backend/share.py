import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import aiosqlite
import os

router = APIRouter()

DB_PATH = os.getenv("DB_PATH", "spotify_city.db")

# Import supabase from main
def get_supabase():
    from main import supabase
    return supabase


async def init_db():
    """Initialize SQLite database with city_snapshots table (legacy - keeping for compatibility)"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS city_snapshots (
                token TEXT PRIMARY KEY,
                city_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        """)
        await db.commit()


async def get_db():
    """Get database connection (legacy)"""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


@router.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()


@router.post("/api/share")
async def create_share(city_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Save a city snapshot and return a shareable token.
    Token expires after 30 days.
    """
    token = str(uuid.uuid4())[:8]  # Short 8-char token for easy sharing
    expires_at = datetime.utcnow() + timedelta(days=30)

    supabase = get_supabase()
    if supabase:
        try:
            # Insert into Supabase
            supabase.table("shared_cities").insert({
                "share_id": token,
                "city_data": city_data,
                "time_range": city_data.get("time_range", "medium"),
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            print(f"Supabase error, falling back to SQLite: {e}")
            # Fallback to SQLite
            async with aiosqlite.connect(DB_PATH) as db:
                await db.execute(
                    "INSERT INTO city_snapshots (token, city_data, expires_at) VALUES (?, ?, ?)",
                    (token, json.dumps(city_data), expires_at.isoformat())
                )
                await db.commit()
    else:
        # Fallback to SQLite if Supabase not configured
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO city_snapshots (token, city_data, expires_at) VALUES (?, ?, ?)",
                (token, json.dumps(city_data), expires_at.isoformat())
            )
            await db.commit()

    return {
        "token": token,
        "share_url": f"/share/{token}",
        "expires_at": expires_at.isoformat()
    }


@router.get("/api/share/{token}")
async def get_shared_city(token: str) -> Dict[str, Any]:
    """
    Retrieve a city snapshot by token.
    Public endpoint - no authentication required.
    """
    supabase = get_supabase()

    if supabase:
        try:
            # Query Supabase
            result = supabase.table("shared_cities")\
                .select("*")\
                .eq("share_id", token)\
                .execute()

            if result.data and len(result.data) > 0:
                row = result.data[0]
                city_data = row["city_data"]
                return {
                    "city_data": city_data,
                    "read_only": True
                }
        except Exception as e:
            print(f"Supabase error, trying SQLite: {e}")

    # Fallback to SQLite
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT city_data, expires_at FROM city_snapshots WHERE token = ?",
            (token,)
        ) as cursor:
            row = await cursor.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="City not found")

            # Check expiration
            expires_at = datetime.fromisoformat(row["expires_at"])
            if datetime.utcnow() > expires_at:
                raise HTTPException(status_code=410, detail="City share link expired")

            city_data = json.loads(row["city_data"])
            return {
                "city_data": city_data,
                "read_only": True
            }


@router.get("/api/share/{token}/exists")
async def check_share_exists(token: str) -> Dict[str, bool]:
    """
    Check if a share token exists and is valid.
    """
    supabase = get_supabase()

    if supabase:
        try:
            result = supabase.table("shared_cities")\
                .select("created_at")\
                .eq("share_id", token)\
                .execute()

            if result.data and len(result.data) > 0:
                return {"exists": True}
        except Exception as e:
            print(f"Supabase error, trying SQLite: {e}")

    # Fallback to SQLite
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT expires_at FROM city_snapshots WHERE token = ?",
            (token,)
        ) as cursor:
            row = await cursor.fetchone()

            if not row:
                return {"exists": False}

            expires_at = datetime.fromisoformat(row["expires_at"])
            if datetime.utcnow() > expires_at:
                return {"exists": False}

            return {"exists": True}
