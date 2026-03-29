"""
Database module - initializes Supabase client
Shared across all routers to avoid circular imports
"""
from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")

supabase = None
supabase_init_error = None

if supabase_url and supabase_service_key:
    try:
        supabase = create_client(supabase_url, supabase_service_key)
        print(f"✅ Supabase connected: {supabase_url[:30]}...")
    except Exception as e:
        supabase = None
        supabase_init_error = str(e)
        print(f"❌ Supabase connection failed: {e}")
else:
    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not supabase_service_key:
        missing.append("SUPABASE_SERVICE_KEY")
    print(f"WARNING: Missing env vars: {', '.join(missing)}. Supabase features disabled.")
