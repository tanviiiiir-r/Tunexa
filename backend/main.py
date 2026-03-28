from dotenv import load_dotenv
import os

# Load environment variables early so routers see the same values
load_dotenv(dotenv_path="backend/.env")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth import router as auth_router
from .data import router as data_router
from .share import router as share_router, init_db

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
