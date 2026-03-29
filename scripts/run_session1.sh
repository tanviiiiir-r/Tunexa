#!/bin/bash
# Session 1 Master Runner
# Run all steps in sequence

echo "============================================"
echo "TUNEXA SESSION 1: Data Pipeline"
echo "============================================"
echo ""

# Check for required env vars
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
    echo "   Create a .env file or export them in your shell"
    exit 1
fi

echo "Step 1: Create Database Schema"
python3 01_create_schema.py
if [ $? -ne 0 ]; then
    echo "❌ Schema creation failed"
    exit 1
fi
echo ""

echo "Step 2: Import Artists from MusicBrainz"
python3 02_import_musicbrainz.py
if [ $? -ne 0 ]; then
    echo "❌ Import failed"
    exit 1
fi
echo ""

echo "Step 3: Enrich with Last.fm Data"
python3 03_enrich_lastfm.py
if [ $? -ne 0 ]; then
    echo "⚠️  Last.fm enrichment had issues (non-critical)"
fi
echo ""

echo "Step 4: Fetch Artist Images"
python3 04_enrich_audiodb.py
if [ $? -ne 0 ]; then
    echo "⚠️  Image enrichment had issues (non-critical)"
fi
echo ""

echo "Step 5: Compute 3D Layout"
python3 05_compute_layout.py
if [ $? -ne 0 ]; then
    echo "❌ Layout computation failed"
    exit 1
fi
echo ""

echo "============================================"
echo "✅ SESSION 1 COMPLETE!"
echo "============================================"
echo ""
echo "Verify in Supabase:"
echo "  SELECT COUNT(*), AVG(height), AVG(width) FROM artists;"
