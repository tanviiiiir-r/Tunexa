"""
Session 1 Master Runner

Run all data pipeline steps in order:
1. Create schema
2. Import from MusicBrainz
3. Enrich with Last.fm
4. Enrich with images (optional)
5. Compute 3D layout

Usage:
    cd scripts
    pip install -r requirements.txt
    python run_session1.py

Prerequisites:
    - SUPABASE_URL and SUPABASE_SERVICE_KEY env vars set
    - LASTFM_API_KEY env var set (get free at last.fm/api)
    - AUDIODB_API_KEY env var set (optional, get at theaudiodb.com)
"""
import os
import sys
import subprocess

def check_env():
    """Check required environment variables"""
    required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
    missing = [v for v in required if not os.getenv(v)]

    if missing:
        print("❌ Missing required environment variables:")
        for v in missing:
            print(f"   - {v}")
        print("\nSet them with:")
        print("   export SUPABASE_URL=your_url")
        print("   export SUPABASE_SERVICE_KEY=your_service_key")
        sys.exit(1)

def run_step(script_name, description):
    """Run a step and return success status"""
    print("\n" + "=" * 60)
    print(f"Running: {description}")
    print("=" * 60)

    result = subprocess.run([sys.executable, script_name])

    if result.returncode != 0:
        print(f"❌ Step failed: {description}")
        return False
    return True

def main():
    print("=" * 60)
    print("SESSION 1: Data Pipeline")
    print("=" * 60)
    print("\nThis will:")
    print("  1. Create database schema")
    print("  2. Import artists from MusicBrainz")
    print("  3. Enrich with Last.fm listener counts")
    print("  4. Fetch artist images (optional)")
    print("  5. Compute 3D layout positions")
    print("\n" + "=" * 60)

    check_env()

    steps = [
        ('01_create_schema.py', 'Create database schema'),
        ('02_import_musicbrainz.py', 'Import artists from MusicBrainz'),
        ('03_enrich_lastfm.py', 'Enrich with Last.fm data'),
        ('04_enrich_audiodb.py', 'Fetch artist images'),
        ('05_compute_layout.py', 'Compute 3D layout'),
    ]

    for script, desc in steps:
        if not run_step(script, desc):
            print("\n❌ Session 1 failed!")
            sys.exit(1)

    print("\n" + "=" * 60)
    print("✅ SESSION 1 COMPLETE!")
    print("=" * 60)
    print("\nYour database now has:")
    print("  - Artists with MusicBrainz data")
    print("  - Last.fm listener counts")
    print("  - Precomputed 3D positions")
    print("\nNext: Session 2 - Backend pivot")
    print("=" * 60)

if __name__ == "__main__":
    main()
