import os
import requests
import mercantile
from pathlib import Path
from typing import Tuple
import time

# Bounding box for Innopolis
# Latitude: 55.73 - 55.77, Longitude: 48.71 - 48.77
BBOX = (48.71, 55.73, 48.77, 55.77)  # (west, south, east, north)
ZOOM_LEVELS = range(12, 19)  # 12 to 18 inclusive
TILE_URL_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
OUTPUT_DIR = "frontend/tiles"

# User-Agent header to be respectful to OSM servers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def create_output_directory(z: int, x: int, y: int) -> Path:
    """Create the directory structure for tile storage."""
    tile_dir = Path(OUTPUT_DIR) / str(z) / str(x)
    tile_dir.mkdir(parents=True, exist_ok=True)
    return tile_dir

def download_tile(z: int, x: int, y: int, output_path: Path) -> bool:
    """Download a single tile from OSM."""
    url = TILE_URL_TEMPLATE.format(z=z, x=x, y=y)
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error downloading tile {z}/{x}/{y}: {e}")
        return False

def download_tiles_for_zoom(zoom: int) -> Tuple[int, int]:
    """Download all tiles for a specific zoom level within the bounding box."""
    tiles = list(mercantile.tiles(*BBOX, zoom))
    downloaded = 0
    failed = 0
    
    print(f"\nZoom level {zoom}: Found {len(tiles)} tiles")
    
    for i, tile in enumerate(tiles, 1):
        z, x, y = tile.z, tile.x, tile.y
        
        # Create directory structure
        tile_dir = create_output_directory(z, x, y)
        output_path = tile_dir / f"{y}.png"
        
        # Skip if already downloaded
        if output_path.exists():
            print(f"  [{i}/{len(tiles)}] Tile {z}/{x}/{y} already exists, skipping")
            continue
        
        # Download the tile
        if download_tile(z, x, y, output_path):
            print(f"  [{i}/{len(tiles)}] Downloaded tile {z}/{x}/{y}")
            downloaded += 1
        else:
            failed += 1
        
        # Be respectful to OSM servers - add a small delay
        time.sleep(0.3)
    
    return downloaded, failed

def main():
    """Main function to download all tiles."""
    print("Starting OSM tile download...")
    print(f"Bounding box: {BBOX}")
    print(f"Zoom levels: {list(ZOOM_LEVELS)}")
    print(f"Output directory: {OUTPUT_DIR}")
    
    total_downloaded = 0
    total_failed = 0
    
    try:
        for zoom in ZOOM_LEVELS:
            downloaded, failed = download_tiles_for_zoom(zoom)
            total_downloaded += downloaded
            total_failed += failed
    except KeyboardInterrupt:
        print("\n\nDownload interrupted by user")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
    
    print(f"\n{'='*50}")
    print(f"Download complete!")
    print(f"Total downloaded: {total_downloaded}")
    print(f"Total failed: {total_failed}")
    print(f"Output directory: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
