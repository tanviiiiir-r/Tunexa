-- Session 1: Create new artists table for Global City
-- Run this in Supabase SQL Editor before importing data

-- Core artist table (populated from MusicBrainz dump + enriched)
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mbid TEXT UNIQUE,                    -- MusicBrainz ID
    name TEXT NOT NULL,
    lastfm_listeners INTEGER DEFAULT 0,  -- building height source
    track_count INTEGER DEFAULT 0,       -- building width source
    height FLOAT DEFAULT 1.0,            -- precomputed normalized
    width FLOAT DEFAULT 1.0,             -- precomputed normalized
    genre TEXT,
    sub_genres TEXT[],
    image_url TEXT,
    city_x FLOAT,                        -- precomputed grid position
    city_z FLOAT,
    last_updated TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    claimed BOOLEAN DEFAULT FALSE        -- for artist claim feature
);

-- Artist claim table (for Session 5 - artist dashboard)
CREATE TABLE IF NOT EXISTS artist_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID REFERENCES artists(id),
    user_id UUID REFERENCES auth.users(id),
    verified BOOLEAN DEFAULT FALSE,
    tier TEXT DEFAULT 'free',            -- 'free' | 'premium'
    custom_color TEXT,
    bio_link TEXT,
    banner_text TEXT,
    stripe_subscription_id TEXT,
    claimed_at TIMESTAMP DEFAULT NOW()
);

-- User profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'fan',             -- 'fan' | 'artist'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_artists_genre ON artists(genre);
CREATE INDEX IF NOT EXISTS idx_artists_height ON artists(height DESC);
CREATE INDEX IF NOT EXISTS idx_artists_last_updated ON artists(last_updated);
CREATE INDEX IF NOT EXISTS idx_artists_claimed ON artists(claimed);

-- Verify
SELECT 'Schema created successfully' as status;
