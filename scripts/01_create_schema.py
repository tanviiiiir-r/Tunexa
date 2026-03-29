"""
Session 1 - Step 0: Create database schema
Run this first to set up the artists table
"""
import os
import sys
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Create artists table
schema_sql = """
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mbid TEXT UNIQUE,
    name TEXT NOT NULL,
    lastfm_listeners INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    height FLOAT DEFAULT 1.0,
    width FLOAT DEFAULT 1.0,
    genre TEXT,
    sub_genres TEXT[],
    image_url TEXT,
    city_x FLOAT,
    city_z FLOAT,
    last_updated TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_artists_genre ON artists(genre);
CREATE INDEX IF NOT EXISTS idx_artists_height ON artists(height DESC);
CREATE INDEX IF NOT EXISTS idx_artists_last_updated ON artists(last_updated);
"""

try:
    # Execute SQL
    result = supabase.rpc('exec_sql', {'sql': schema_sql}).execute()
    print("✅ Artists table created successfully")
except Exception as e:
    print(f"⚠️  Note: {e}")
    print("Table may already exist or use Supabase Dashboard SQL Editor to run:")
    print(schema_sql)

# Verify table exists
try:
    result = supabase.table('artists').select('count', count='exact').limit(0).execute()
    count = result.count if hasattr(result, 'count') else 0
    print(f"✅ Table verified. Current artist count: {count}")
except Exception as e:
    print(f"❌ Error verifying table: {e}")
