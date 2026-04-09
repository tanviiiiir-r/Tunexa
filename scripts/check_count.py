"""Check artist count in database"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

result = supabase.table('artists').select('count', count='exact').limit(0).execute()
print(f'Total artists: {result.count}')

# Get breakdown
result2 = supabase.table('artists').select('genre').limit(10000).execute()
genres = {}
for row in result2.data:
    g = row.get('genre', 'unknown')
    genres[g] = genres.get(g, 0) + 1

print(f'\nGenres: {len(genres)}')
for g, c in sorted(genres.items(), key=lambda x: -x[1])[:20]:
    print(f'  {g}: {c}')

# Check for Bengali artists
result3 = supabase.table('artists').select('name,sub_genres').ilike('sub_genres::text', '%bengali%').execute()
print(f'\nBengali artists: {len(result3.data)}')
