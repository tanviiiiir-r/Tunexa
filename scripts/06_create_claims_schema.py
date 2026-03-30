"""
Session 5 - Step 1: Create artist_claims table schema

Run this in Supabase SQL Editor:
https://supabase.com/dashboard/project/tgvwdhgkraozwbdfllpa/sql/new
"""

SQL_COMMANDS = """
-- Create artist_claims table
CREATE TABLE IF NOT EXISTS artist_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    proof_url TEXT,
    proof_description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    claimed_by UUID REFERENCES auth.users(id),
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_artist_claims_artist_id ON artist_claims(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_claims_status ON artist_claims(status);
CREATE INDEX IF NOT EXISTS idx_artist_claims_email ON artist_claims(email);

-- Enable RLS
ALTER TABLE artist_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own claims
DROP POLICY IF EXISTS "Users can view own claims" ON artist_claims;
CREATE POLICY "Users can view own claims" ON artist_claims
    FOR SELECT USING (claimed_by = auth.uid());

-- Policy: Users can create claims
DROP POLICY IF EXISTS "Users can create claims" ON artist_claims;
CREATE POLICY "Users can create claims" ON artist_claims
    FOR INSERT WITH CHECK (true);

-- Policy: Service role can update claims
DROP POLICY IF EXISTS "Service role can update claims" ON artist_claims;
CREATE POLICY "Service role can update claims" ON artist_claims
    FOR UPDATE USING (true);

-- Add claimed flag to artists table
ALTER TABLE artists ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
"""

def main():
    print("=" * 60)
    print("Session 5: Artist Claims Schema")
    print("=" * 60)
    print()
    print("Copy and paste the following SQL into Supabase SQL Editor:")
    print("https://supabase.com/dashboard/project/tgvwdhgkraozwbdfllpa/sql/new")
    print()
    print("=" * 60)
    print(SQL_COMMANDS)
    print("=" * 60)
    print()
    print("After running, the following will be created:")
    print("  - artist_claims table with fields:")
    print("    * id, artist_id, email, name")
    print("    * proof_url, proof_description")
    print("    * status (pending/approved/rejected)")
    print("    * admin_notes, claimed_by, claimed_at")
    print("  - RLS policies for security")
    print("  - claimed fields added to artists table")

if __name__ == "__main__":
    main()
