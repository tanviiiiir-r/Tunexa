-- Spotify City Schema
-- Run this in Supabase SQL Editor

-- Enable trigram extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id text UNIQUE NOT NULL,
  display_name text,
  image_url text,
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Friend codes
CREATE TABLE friend_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(spotify_id),
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_friend_codes_code ON friend_codes(code);

-- Friend links (bidirectional)
CREATE TABLE friend_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a text NOT NULL,
  user_id_b text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id_a, user_id_b)
);
CREATE INDEX idx_friend_links_a ON friend_links(user_id_a);
CREATE INDEX idx_friend_links_b ON friend_links(user_id_b);

-- Shared cities (migrated from SQLite)
CREATE TABLE shared_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text UNIQUE NOT NULL,
  user_id text,
  city_data jsonb NOT NULL,
  time_range text,
  created_at timestamptz DEFAULT now()
);

-- Comparison shares
CREATE TABLE comparison_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Artist cache (Spotify API responses)
CREATE TABLE artist_cache (
  cache_key text PRIMARY KEY,
  data jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

-- Global artists (seeded once from dataset)
CREATE TABLE global_artists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spotify_id text UNIQUE NOT NULL,
  name text NOT NULL,
  genres text[] DEFAULT '{}',
  primary_genre text NOT NULL DEFAULT 'default',
  popularity int DEFAULT 0,
  followers bigint DEFAULT 0,
  image_url text,
  pos_x float NOT NULL,
  pos_y float NOT NULL,
  pos_z float NOT NULL,
  cluster_id int NOT NULL,
  building_scale float NOT NULL
);
CREATE INDEX idx_global_artists_cluster ON global_artists(cluster_id);
CREATE INDEX idx_global_artists_pos ON global_artists(pos_x, pos_z);
CREATE INDEX idx_global_artists_name_trgm ON global_artists USING gin(name gin_trgm_ops);

-- Genre clusters
CREATE TABLE genre_clusters (
  id int PRIMARY KEY,
  genre_name text UNIQUE NOT NULL,
  color text NOT NULL,
  center_x float NOT NULL,
  center_y float NOT NULL,
  center_z float NOT NULL,
  radius float NOT NULL
);

-- RLS Policies

-- global_artists: public read, no client writes
ALTER TABLE global_artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read global_artists" ON global_artists FOR SELECT TO anon, authenticated USING (true);

-- genre_clusters: public read
ALTER TABLE genre_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read genre_clusters" ON genre_clusters FOR SELECT TO anon, authenticated USING (true);

-- All other tables: RLS on, backend service key only (no client policies needed)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_cache ENABLE ROW LEVEL SECURITY;
