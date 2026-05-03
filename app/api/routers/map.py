# app/api/routers/map.py
from fastapi import APIRouter, Depends
from app.api.dependencies import get_db_repo
from collections import defaultdict

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/geojson")
async def get_map_geojson(db_repo = Depends(get_db_repo)):
    """Get all containers in GeoJSON format with clustering by location"""
    containers = await db_repo.get_all()
    
    # Group containers by address instead of coordinates to avoid O(N^2) distance calculations
    location_groups = defaultdict(list)
    
    for c in containers:
        try:
            lat, lon = c.lat_lon
        except (ValueError, AttributeError):
            continue
        
        fill = c.sensor_data.fill_percent if c.sensor_data else 0
        
        # Group by exact address string
        group_key = c.address
        
        location_groups[group_key].append({
            "id": c.id,
            "address": c.address,
            "fill_percent": fill,
            "battery": c.sensor_data.battery_status if c.sensor_data else "неизвестно",
            "temperature": c.sensor_data.temperature_status if c.sensor_data else "неизвестно",
            "lat": lat,
            "lon": lon
        })
    
    # Create features from grouped containers
    features = []
    for address, group_containers in location_groups.items():
        # All containers in this group should have the same fill_percent now,
        # but we'll take the max just to be safe and ensure it turns red if any is full
        max_fill = max(c["fill_percent"] for c in group_containers) if group_containers else 0
        
        # Determine color based on max fill percentage
        if max_fill >= 70:
            color = "red"
        elif max_fill >= 50:
            color = "yellow"
        else:
            color = "green"
        
        # Use first container's coordinates for the group
        group_lat = group_containers[0]["lat"]
        group_lon = group_containers[0]["lon"]
        
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [group_lon, group_lat]
            },
            "properties": {
                "is_cluster": len(group_containers) > 1,
                "container_count": len(group_containers),
                "containers": group_containers,
                "address": address,
                "avg_fill_percent": max_fill, # Used max_fill instead of average for safety
                "color": color
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
