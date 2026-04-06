"""
Session 2 - Global City Endpoints
Reads from Supabase artists table (populated by Session 1 scripts)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from database import supabase

router = APIRouter()

class ArtistResponse(BaseModel):
    id: str
    name: str
    genre: Optional[str]
    height: float
    width: float
    city_x: Optional[float]
    city_z: Optional[float]
    image_url: Optional[str]
    lastfm_listeners: int
    track_count: int

class ArtistDetailResponse(ArtistResponse):
    sub_genres: Optional[List[str]]
    claimed: bool = False

class CityResponse(BaseModel):
    artists: List[ArtistResponse]
    total: int
    page: int
    limit: int
    genres: List[str]

@router.get("/city", response_model=CityResponse)
async def get_city(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(500, ge=1, le=10000, description="Items per page"),
    genre: Optional[str] = Query(None, description="Filter by genre")
):
    """
    Get paginated global city data.
    Returns artists with precomputed 3D positions.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        # Build query
        query = supabase.table("artists").select("*", count="exact")

        if genre:
            query = query.ilike("genre", f"%{genre}%")

        # Execute with pagination
        offset = (page - 1) * limit
        result = query.range(offset, offset + limit - 1).execute()

        artists = result.data if hasattr(result, 'data') else []
        total = result.count if hasattr(result, 'count') else len(artists)

        # Get unique genres for filter options
        genre_result = supabase.table("artists").select("genre").execute()
        genres = list(set([a.get("genre") for a in genre_result.data if a.get("genre")])) if hasattr(genre_result, 'data') else []

        return {
            "artists": artists,
            "total": total,
            "page": page,
            "limit": limit,
            "genres": genres
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/artist/{artist_id}", response_model=ArtistDetailResponse)
async def get_artist(artist_id: str):
    """
    Get single artist detail for info panel.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        result = supabase.table("artists").select("*").eq("id", artist_id).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Artist not found")

        artist = result.data[0]

        # Check if claimed (for Session 5)
        claimed_result = supabase.table("artist_claims").select("*").eq("artist_id", artist_id).execute()
        artist["claimed"] = len(claimed_result.data) > 0 if hasattr(claimed_result, 'data') else False

        return artist
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/search")
async def search_artists(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Search artists by name (autocomplete).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        # Fetch all and filter in Python (small dataset)
        result = supabase.table("artists")\
            .select("id, name, genre, image_url")\
            .limit(1000)\
            .execute()

        all_artists = result.data if hasattr(result, 'data') and result.data else []
        # Case-insensitive search
        q_lower = q.lower()
        artists = [a for a in all_artists if q_lower in a.get("name", "").lower()][:limit]

        return {
            "query": q,
            "results": artists,
            "count": len(artists)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/genres")
async def get_genres():
    """
    Get list of all genres with artist counts.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        result = supabase.table("artists").select("genre").execute()

        genres = {}
        if hasattr(result, 'data'):
            for artist in result.data:
                genre = artist.get("genre", "unknown")
                genres[genre] = genres.get(genre, 0) + 1

        return {
            "genres": [{"name": k, "count": v} for k, v in sorted(genres.items(), key=lambda x: x[1], reverse=True)]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# Legacy endpoint - redirect to new /city
@router.get("/city_payload")
async def city_payload_legacy():
    """
    DEPRECATED: Use /city instead
    Returns placeholder for backward compatibility
    """
    raise HTTPException(
        status_code=410,
        detail="This endpoint is deprecated. Use /city for global city data."
    )
