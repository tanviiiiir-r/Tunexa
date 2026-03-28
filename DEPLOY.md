# Deployment Guide - Spotify City

## Backend (Railway)

1. **Create Railway account**: https://railway.app

2. **Create new project**:
   ```bash
   cd backend
   railway login
   railway init
   ```

3. **Set environment variables** in Railway dashboard:
   - `SPOTIFY_CLIENT_ID` - Your Spotify app client ID
   - `SPOTIFY_CLIENT_SECRET` - Your Spotify app client secret
   - `SPOTIFY_REDIRECT_URI` - `https://your-railway-app.up.railway.app/callback`
   - `SESSION_SECRET` - Random secret string
   - `ALLOWED_ORIGINS` - `https://your-vercel-app.vercel.app`

4. **Update Spotify app redirect URIs**:
   - Add: `https://your-railway-app.up.railway.app/callback`

5. **Deploy**:
   ```bash
   railway up
   ```

## Frontend (Vercel)

1. **Create Vercel account**: https://vercel.com

2. **Set environment variables** in Vercel dashboard:
   - `VITE_API_URL` - `https://your-railway-app.up.railway.app`

3. **Deploy**:
   ```bash
   cd frontend
   vercel
   ```

4. **Update backend ALLOWED_ORIGINS** with Vercel URL

## URLs After Deployment

- Frontend: `https://your-project.vercel.app`
- Backend: `https://your-project.up.railway.app`
- Share URLs: `https://your-project.vercel.app/share/{token}`

## Smoke Test

1. Go to frontend URL
2. Login with Spotify
3. Generate city
4. Click Share → Copy link
5. Open share link in incognito → Should see city without login
6. Click buildings → Should show artist info
