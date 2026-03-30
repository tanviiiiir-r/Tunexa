"""
Session 5 - Artist Claim Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from database import supabase

router = APIRouter()

# Request/Response Models
class ClaimRequest(BaseModel):
    artist_id: str
    email: str
    name: str
    proof_url: Optional[str] = None
    proof_description: Optional[str] = None

class ClaimResponse(BaseModel):
    id: str
    artist_id: str
    artist_name: str
    email: str
    name: str
    proof_url: Optional[str]
    proof_description: Optional[str]
    status: str
    claimed_at: datetime

class ClaimReviewRequest(BaseModel):
    claim_id: str
    status: str  # approved or rejected
    admin_notes: Optional[str] = None

@router.post("/claim", response_model=dict)
async def create_claim(request: ClaimRequest):
    """
    Create a claim request for an artist profile.
    Artist must provide proof of ownership.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        # Check if artist exists
        artist_result = supabase.table("artists").select("id, name, claimed").eq("id", request.artist_id).execute()

        if not artist_result.data or len(artist_result.data) == 0:
            raise HTTPException(status_code=404, detail="Artist not found")

        artist = artist_result.data[0]

        # Check if already claimed
        if artist.get("claimed"):
            raise HTTPException(status_code=400, detail="This artist profile is already claimed")

        # Check for existing pending claim
        existing_claim = supabase.table("artist_claims")\
            .select("id")\
            .eq("artist_id", request.artist_id)\
            .eq("status", "pending")\
            .execute()

        if existing_claim.data and len(existing_claim.data) > 0:
            raise HTTPException(status_code=400, detail="A pending claim already exists for this artist")

        # Create claim
        claim_data = {
            "artist_id": request.artist_id,
            "email": request.email,
            "name": request.name,
            "proof_url": request.proof_url,
            "proof_description": request.proof_description,
            "status": "pending"
        }

        result = supabase.table("artist_claims").insert(claim_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create claim")

        claim = result.data[0]

        # TODO: Send email notification to admin
        # For now, just log it
        print(f"📧 New claim submitted for {artist['name']} ({request.email})")

        return {
            "success": True,
            "message": "Claim submitted successfully. Admin will review within 24-48 hours.",
            "claim_id": claim["id"],
            "artist_name": artist["name"],
            "status": "pending"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create claim: {str(e)}")

@router.get("/claims/pending", response_model=List[ClaimResponse])
async def get_pending_claims():
    """
    Get all pending claims (admin only).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        result = supabase.table("artist_claims")\
            .select("*, artists(name)")\
            .eq("status", "pending")\
            .order("created_at", desc=True)\
            .execute()

        claims = []
        if result.data:
            for claim in result.data:
                claims.append({
                    "id": claim["id"],
                    "artist_id": claim["artist_id"],
                    "artist_name": claim.get("artists", {}).get("name", "Unknown"),
                    "email": claim["email"],
                    "name": claim["name"],
                    "proof_url": claim.get("proof_url"),
                    "proof_description": claim.get("proof_description"),
                    "status": claim["status"],
                    "claimed_at": claim["claimed_at"]
                })

        return claims

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch claims: {str(e)}")

@router.post("/claims/review", response_model=dict)
async def review_claim(request: ClaimReviewRequest):
    """
    Approve or reject a claim (admin only).
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    if request.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    try:
        # Get claim details
        claim_result = supabase.table("artist_claims")\
            .select("*")\
            .eq("id", request.claim_id)\
            .execute()

        if not claim_result.data or len(claim_result.data) == 0:
            raise HTTPException(status_code=404, detail="Claim not found")

        claim = claim_result.data[0]

        if claim["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Claim is already {claim['status']}")

        # Update claim status
        update_data = {
            "status": request.status,
            "admin_notes": request.admin_notes,
            "reviewed_at": datetime.now().isoformat()
        }

        supabase.table("artist_claims")\
            .update(update_data)\
            .eq("id", request.claim_id)\
            .execute()

        # If approved, mark artist as claimed
        if request.status == "approved":
            supabase.table("artists")\
                .update({
                    "claimed": True,
                    "claimed_at": datetime.now().isoformat()
                })\
                .eq("id", claim["artist_id"])\
                .execute()

            # TODO: Send approval email to claimant
            print(f"✅ Claim approved for artist {claim['artist_id']}")
        else:
            # TODO: Send rejection email
            print(f"❌ Claim rejected for artist {claim['artist_id']}")

        return {
            "success": True,
            "message": f"Claim {request.status} successfully",
            "claim_id": request.claim_id,
            "status": request.status
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to review claim: {str(e)}")

@router.get("/artist/{artist_id}/claim-status", response_model=dict)
async def get_claim_status(artist_id: str):
    """
    Check if an artist has a pending or approved claim.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        # Check artist claimed status
        artist_result = supabase.table("artists")\
            .select("claimed, claimed_by")\
            .eq("id", artist_id)\
            .execute()

        if not artist_result.data or len(artist_result.data) == 0:
            raise HTTPException(status_code=404, detail="Artist not found")

        artist = artist_result.data[0]

        # Check for pending claim
        claim_result = supabase.table("artist_claims")\
            .select("id, status, created_at")\
            .eq("artist_id", artist_id)\
            .eq("status", "pending")\
            .execute()

        pending_claim = claim_result.data[0] if claim_result.data else None

        return {
            "artist_id": artist_id,
            "claimed": artist.get("claimed", False),
            "has_pending_claim": pending_claim is not None,
            "pending_claim": pending_claim if pending_claim else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get claim status: {str(e)}")
