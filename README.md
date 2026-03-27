# Tunexa - Spotify City

Transform your Spotify listening data into an interactive 3D world.

## Overview

Tunexa visualizes your music taste as an explorable 3D city where:
- **Buildings** = Artists (height = listening time, color = audio features)
- **Districts** = Genres (arranged radially)
- **Floors** = Songs

## Tech Stack

- **Frontend**: React + Vite, React Three Fiber (3D), Tailwind CSS
- **Backend**: FastAPI (Python), PostgreSQL, Redis
- **Auth**: Spotify OAuth (PKCE)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Spotify Developer account

### Setup

1. **Clone and enter the project**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Tunexa.git
   cd Tunexa
   ```

2. **Backend setup**
   ```bash
   cd backend
   pip install fastapi uvicorn httpx itsdangerous python-dotenv

   # Create .env file
   echo "SPOTIFY_CLIENT_ID=your_client_id" > .env
   echo "SPOTIFY_CLIENT_SECRET=your_client_secret" >> .env
   echo "SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback" >> .env
   echo "SESSION_SECRET=your-secret-key" >> .env

   # Start backend
   uvicorn main:app --reload --port 8000
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Open browser**
   Navigate to `http://127.0.0.1:5173`

## Project Structure

```
Tunexa/
├── backend/           # FastAPI server
│   ├── main.py      # App entry point
│   ├── auth.py      # Spotify OAuth
│   └── data.py      # Spotify API calls
├── frontend/        # React + Three.js
│   ├── src/
│   │   └── App.tsx  # Main component
│   └── vite.config.ts
├── PRODUCT.md       # Product requirements
├── CONTEXT.md       # Technical spec
└── milestone.md     # Development milestones
```

## Current Status

✅ Milestone 1: Project Scaffold
✅ Milestone 2: Spotify OAuth
✅ Milestone 3: Spotify Data Fetch
🔄 Milestone 4: City Generation (Next)

## License

MIT
