from dotenv import load_dotenv

# Load environment variables early so routers see the same values
load_dotenv(dotenv_path="backend/.env")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth import router as auth_router
from .data import router as data_router

app = FastAPI()

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(data_router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Spotify City API connected ✅"}
