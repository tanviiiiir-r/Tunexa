"""
Bulk import 50K artists with specific composition:
- Top 100 global artists (downtown)
- 20% small/niche artists (10K)
- Top 1000 Bengali artists
- 2000 Indian artists
- Remaining: diverse genres
"""
import os
import sys
import time
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
LASTFM_API_KEY = os.getenv("LASTFM_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

if not LASTFM_API_KEY:
    print("❌ Error: LASTFM_API_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Top 100 global artists for downtown
TOP_100_GLOBAL = [
    "The Beatles", "Michael Jackson", "Elvis Presley", "Madonna", "Elton John",
    "Queen", "Led Zeppelin", "Pink Floyd", "The Rolling Stones", "Taylor Swift",
    "Drake", "Ariana Grande", "Ed Sheeran", "Rihanna", "Beyoncé", "Kanye West",
    "Bruno Mars", "Billie Eilish", "Post Malone", "Dua Lipa", "The Weeknd",
    "Justin Bieber", "Coldplay", "Eminem", "Lady Gaga", "Maroon 5", "Adele",
    "Katy Perry", "Shakira", "Sam Smith", "Miley Cyrus", "Harry Styles",
    "Doja Cat", "SZA", "Lizzo", "Olivia Rodrigo", "Bad Bunny", "Lil Nas X",
    "Travis Scott", "Kendrick Lamar", "J. Cole", "Future", "Metro Boomin",
    "Nicki Minaj", "Cardi B", "Megan Thee Stallion", "Doja Cat", "Tyler, The Creator",
    "Frank Ocean", "Kid Cudi", "Juice WRLD", "XXXTentacion", "Pop Smoke",
    "Lil Baby", "DaBaby", "Migos", "Drake", "21 Savage", "Roddy Ricch",
    "The Weeknd", "Bruno Mars", "Justin Timberlake", "Usher", "Chris Brown",
    "Alicia Keys", "John Legend", "Jason Derulo", "Pitbull", "Enrique Iglesias",
    "Shawn Mendes", "Charlie Puth", "James Arthur", "Lewis Capaldi", "Sam Smith",
    "George Michael", "Elton John", "Billy Joel", "Phil Collins", "Peter Gabriel",
    "Paul McCartney", "John Lennon", "George Harrison", "Ringo Starr", "Bob Dylan",
    "David Bowie", "Prince", "Freddie Mercury", "Kurt Cobain", "Jimi Hendrix",
    "Whitney Houston", "Mariah Carey", "Celine Dion", "Aretha Franklin", "Stevie Wonder",
    "Ray Charles", "James Brown", "Marvin Gaye", "Al Green", "Otis Redding",
    "B.B. King", "Muddy Waters", "Howlin' Wolf", "Robert Johnson", "John Lee Hooker"
]

BENGALI_ARTISTS = [
    "Arijit Singh", "Shreya Ghoshal", "Lata Mangeshkar", "Kishore Kumar",
    "Mohammed Rafi", "Manna Dey", "Hemanta Mukherjee", "Nachiketa Chakraborty",
    "Anupam Roy", "Rupam Islam", "Kabir Suman", "Nachiketa",
    "Silajit Majumder", "Srikanto Acharya", "Indranil Sen", "Raghab Chatterjee",
    "Shaan", "KK", "Sonu Nigam", "Kumar Sanu", "Udit Narayan",
    "Abhijeet Bhattacharya", "Babul Supriyo", "Hariharan", "Shankar Mahadevan",
    "Shantanu Moitra", "Jeet Gannguli", "Anupam Roy", "Arijit Singh",
    "Shreya Ghoshal", "Sunidhi Chauhan", "Neha Kakkar", "Tulsi Kumar",
    "Palak Muchhal", "Monali Thakur", "Shalmali Kholgade", "Jonita Gandhi",
    "Nikhita Gandhi", "Antara Mitra", "Anwesha Datta Gupta", "Iman Chakraborty",
    "Somlata Acharyya Chowdhury", "Ujjaini Mukherjee", "Madhubanti Bagchi",
    "Lagnajita Chakraborty", "Ishaan", "Debraj", "Shovan", "Ganesh",
    "Pritam", "Amit Trivedi", "Vishal-Shekhar", "Sajid-Wajid", "Shankar-Ehsaan-Loy",
    "Salim-Sulaiman", "Vishal Bhardwaj", "Himesh Reshammiya", "Meet Bros",
    "Rochak Kohli", "Tanishk Bagchi", "Arko", "Tony Kakkar",
    "Ankit Tiwari", "Mithoon", "Amaal Mallik", "Armaan Malik",
    "Jubin Nautiyal", "Darshan Raval", "Guru Randhawa", "Badshah",
    "Yo Yo Honey Singh", "Raftaar", "DIVINE", "Naezy",
    "Emiway Bantai", "Kr$na", "Seedhe Maut"
]

INDIAN_ARTISTS = [
    "A.R. Rahman", "Ilaiyaraaja", "Zakir Hussain", "Ravi Shankar", "Lata Mangeshkar",
    "Mohammed Rafi", "Kishore Kumar", "Asha Bhosle", "Sonu Nigam", "Shreya Ghoshal",
    "Hariharan", "Shankar Mahadevan", "Sunidhi Chauhan", "Arijit Singh",
    "Atif Aslam", "Rahat Fateh Ali Khan", "Nusrat Fateh Ali Khan",
    "Jagjit Singh", "Ghulam Ali", "Mehdi Hassan",
    "Kumar Sanu", "Udit Narayan", "Alka Yagnik", "Kavita Krishnamurthy",
    "Anuradha Paudwal", "Sadhana Sargam", "Shaan", "KK",
    "Mohit Chauhan", "Adnan Sami", "Lucky Ali", "Vishal Dadlani",
    "Amit Trivedi", "Pritam", "Vishal-Shekhar", "Salim-Sulaiman",
    "Shankar-Ehsaan-Loy", "A.R. Rahman", "Ilaiyaraaja", "Harris Jayaraj",
    "Yuvan Shankar Raja", "Anirudh Ravichander", "G.V. Prakash Kumar",
    "Devi Sri Prasad", "Thaman S", "Mani Sharma", "Keeravani",
    "Badshah", "Yo Yo Honey Singh", "Raftaar", "DIVINE",
    "Emiway Bantai", "KR$NA", "Seedhe Maut", "Prabh Deep",
    "Raja Kumari", "Hard Kaur", "Brodha V", "Naezy",
    "Ranveer Singh", "Ayushmann Khurrana", "Parineeti Chopra", "Alia Bhatt",
    "Shraddha Kapoor", "Tiger Shroff", "Varun Dhawan", "Sidharth Malhotra",
    "Arjun Kapoor", "Aditya Roy Kapur", "Sushant Singh Rajput", "Rajkummar Rao",
    "Vicky Kaushal", "Kartik Aaryan", "Ishaan Khatter"
]

# Genre tags for small artists
NICHE_GENRES = [
    'ambient', 'drone', 'noise', 'experimental', 'avant-garde', 'minimal', 'field recordings',
    'dark ambient', 'industrial ambient', 'noise rock', 'post-rock', 'math rock',
    'shoegaze', 'dream pop', 'slowcore', 'lo-fi', 'bedroom pop', 'hypnagogic pop',
    'witch house', 'vaporwave', 'synthwave', 'chillwave', 'outrun', 'retrowave',
    'dungeon synth', 'blackgaze', 'depressive suicidal black metal', 'atmospheric black metal',
    'funeral doom', 'drone doom', 'sludge', 'stoner rock', 'desert rock',
    'neofolk', 'martial industrial', 'dark folk', 'apocalyptic folk',
    'free jazz', 'avant-garde jazz', 'spiritual jazz', 'modal jazz',
    'contemporary classical', 'minimalism', 'serialism', 'spectralism',
    'musique concrète', 'electroacoustic', 'tape music', 'glitch', 'microsound',
    'idm', 'braindance', 'skweee', 'chiptune', 'bitpop', 'nintendocore'
]

def fetch_artist_info(artist_name):
    """Fetch artist info from Last.fm"""
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            'method': 'artist.getInfo',
            'artist': artist_name,
            'api_key': LASTFM_API_KEY,
            'format': 'json'
        }
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            artist = data.get('artist', {})
            if artist:
                listeners = int(artist.get('stats', {}).get('listeners', 0))
                playcount = int(artist.get('stats', {}).get('playcount', 0))
                tags = [t['name'] for t in artist.get('tags', {}).get('tag', [])[:5]]
                mbid = artist.get('mbid', '')
                image = artist.get('image', [{}])[-1].get('#text', '')
                return {
                    'name': artist_name,
                    'listeners': listeners,
                    'playcount': playcount,
                    'tags': tags,
                    'mbid': mbid,
                    'image': image
                }
        return None
    except Exception as e:
        print(f"  ⚠️ Error fetching {artist_name}: {e}")
        return None

def get_top_artists_by_genre(genre, limit=100):
    """Fetch top artists for a genre"""
    try:
        url = "http://ws.audioscrobbler.com/2.0/"
        params = {
            'method': 'tag.gettopartists',
            'tag': genre,
            'api_key': LASTFM_API_KEY,
            'format': 'json',
            'limit': limit
        }
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            artists = data.get('topartists', {}).get('artist', [])
            return [
                {
                    'name': a['name'],
                    'listeners': int(a.get('listeners', 0)),
                    'mbid': a.get('mbid', ''),
                    'image': a.get('image', [{}])[-1].get('#text', '') if a.get('image') else ''
                }
                for a in artists
            ]
        return []
    except Exception as e:
        print(f"  ⚠️ Error fetching {genre}: {e}")
        return []

def artist_exists(name):
    """Check if artist exists"""
    try:
        result = supabase.table('artists').select('id').ilike('name', name).execute()
        return len(result.data) > 0 if hasattr(result, 'data') else False
    except:
        return False

def insert_artist(artist_data, category='regular'):
    """Insert artist to database"""
    try:
        tags = artist_data.get('tags', [])
        primary_genre = tags[0].lower() if tags else 'pop'

        # Determine custom color for Bengali artists
        custom_color = None
        if category == 'bengali':
            # Alternate between red and green
            import random
            custom_color = '#E63946' if random.random() > 0.5 else '#2A9D8F'

        # Add color hint to sub_genres for Bengali artists
        sub_genres = tags[1:] if len(tags) > 1 else []
        if category == 'bengali':
            sub_genres = ['bengali_color_' + ('red' if custom_color == '#E63946' else 'green')] + sub_genres

        record = {
            'name': artist_data['name'],
            'mbid': artist_data.get('mbid') or None,
            'lastfm_listeners': artist_data.get('listeners', 0),
            'track_count': max(artist_data.get('playcount', 0) // 10000, 10),
            'genre': category if category != 'regular' else primary_genre,
            'sub_genres': sub_genres,
            'image_url': artist_data.get('image') if artist_data.get('image') else None,
            'is_active': True
        }

        supabase.table('artists').insert(record).execute()
        return True
    except Exception as e:
        print(f"  ❌ Insert failed: {e}")
        return False

def main():
    print("=" * 60)
    print("Bulk Import: 50K Artists")
    print("=" * 60)
    print("Composition:")
    print("  - Top 100 Global (Downtown)")
    print("  - Top 1000 Bengali artists")
    print("  - 2000 Indian artists")
    print("  - 10K Small/niche artists (20%)")
    print("  - ~37K Mixed genre artists")
    print("=" * 60)

    imported = 0
    skipped = 0
    failed = 0
    all_artists = {}

    # Phase 1: Top 100 Global (Downtown)
    print("\n📥 Phase 1: Top 100 Global Artists...")
    for i, name in enumerate(TOP_100_GLOBAL[:100], 1):
        if artist_exists(name):
            skipped += 1
            continue

        info = fetch_artist_info(name)
        if info:
            if insert_artist(info, 'downtown'):
                print(f"[{i}/100] ✓ {name}")
                imported += 1
            else:
                failed += 1
        else:
            failed += 1
        time.sleep(0.2)

    # Phase 2: Bengali Artists (with colors)
    print("\n📥 Phase 2: Bengali Artists (Red/Green colored)...")
    for i, name in enumerate(BENGALI_ARTISTS[:1000], 1):
        if artist_exists(name):
            skipped += 1
            continue

        info = fetch_artist_info(name)
        if info:
            if insert_artist(info, 'bengali'):
                print(f"[{i}/1000] ✓ {name} (Bengali)")
                imported += 1
            else:
                failed += 1
        else:
            failed += 1
        time.sleep(0.2)

    # Phase 3: Indian Artists
    print("\n📥 Phase 3: Indian Artists...")
    for i, name in enumerate(INDIAN_ARTISTS[:2000], 1):
        if artist_exists(name):
            skipped += 1
            continue

        info = fetch_artist_info(name)
        if info:
            if insert_artist(info, 'indian'):
                print(f"[{i}/2000] ✓ {name} (Indian)")
                imported += 1
            else:
                failed += 1
        else:
            failed += 1
        time.sleep(0.2)

    # Phase 4: Small/Niche Artists (20% = 10K)
    print("\n📥 Phase 4: Small/Niche Artists...")
    niche_count = 0
    niche_target = 10000

    for genre in NICHE_GENRES:
        if niche_count >= niche_target:
            break
        print(f"  Fetching {genre}...")
        artists = get_top_artists_by_genre(genre, limit=250)

        for artist in artists:
            if niche_count >= niche_target:
                break
            if artist['listeners'] > 50000:  # Skip if too popular
                continue
            if artist_exists(artist['name']):
                skipped += 1
                continue

            info = fetch_artist_info(artist['name'])
            if info:
                if insert_artist(info, 'niche'):
                    niche_count += 1
                    imported += 1
                    if niche_count % 100 == 0:
                        print(f"    [{niche_count}/{niche_target}] ✓")
            time.sleep(0.2)

    # Phase 5: Mixed Genres (fill to 50K)
    print("\n📥 Phase 5: Mixed Genres (filling to 50K)...")
    major_genres = [
        'pop', 'rock', 'hip-hop', 'electronic', 'rnb', 'indie', 'jazz',
        'classical', 'country', 'metal', 'blues', 'folk', 'reggae',
        'punk', 'soul', 'funk', 'disco', 'gospel', 'latin', 'ambient',
        'k-pop', 'j-pop', 'afrobeat', 'trap', 'lo-fi', 'synthwave'
    ]

    current_total = imported + skipped
    remaining = 50000 - current_total

    if remaining > 0:
        per_genre = remaining // len(major_genres)
        for genre in major_genres:
            print(f"  Fetching {genre}...")
            artists = get_top_artists_by_genre(genre, limit=per_genre + 50)

            for artist in artists:
                if artist_exists(artist['name']):
                    skipped += 1
                    continue

                info = fetch_artist_info(artist['name'])
                if info:
                    if insert_artist(info, 'regular'):
                        imported += 1
                        if imported % 500 == 0:
                            print(f"    Total: {imported} imported")
                time.sleep(0.2)

    print("\n" + "=" * 60)
    print("✅ Import Complete!")
    print(f"   Imported: {imported}")
    print(f"   Skipped: {skipped}")
    print(f"   Failed: {failed}")

    # Final count
    try:
        result = supabase.table('artists').select('count', count='exact').limit(0).execute()
        total = result.count if hasattr(result, 'count') else 'unknown'
        print(f"   Total in database: {total}")
    except Exception as e:
        print(f"   Could not verify: {e}")

    print("=" * 60)

if __name__ == "__main__":
    main()
