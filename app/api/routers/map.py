# app/api/routers/map.py
from fastapi import APIRouter, Depends
from app.api.dependencies import get_db_repo
from collections import defaultdict
from math import radians, cos, sin, asin, sqrt

router = APIRouter(prefix="/api/map", tags=["map"])


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth radius in meters
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c


@router.get("/geojson")
async def get_map_geojson(db_repo = Depends(get_db_repo)):
    """Get all containers in GeoJSON format with clustering by location"""
    containers = await db_repo.get_all()
    
    # Group containers by address or proximity (within 20 meters)
    location_groups = defaultdict(list)
    
    for c in containers:
        try:
            lat, lon = c.lat_lon
        except (ValueError, AttributeError):
            continue
        
        fill = c.sensor_data.fill_percent if c.sensor_data else 0
        
        # Try to find existing group at same location
        found_group = False
        for group_key in location_groups.keys():
            group_lat, group_lon = group_key
            if haversine_distance(lat, lon, group_lat, group_lon) < 20:  # 20 meters threshold
                location_groups[group_key].append({
                    "id": c.id,
                    "address": c.address,
                    "fill_percent": fill,
                    "battery": c.sensor_data.battery_status if c.sensor_data else "неизвестно",
                    "temperature": c.sensor_data.temperature_status if c.sensor_data else "неизвестно",
                    "lat": lat,
                    "lon": lon
                })
                found_group = True
                break
        
        if not found_group:
            location_groups[(lat, lon)].append({
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
    for (group_lat, group_lon), group_containers in location_groups.items():
        total_fill = sum(c["fill_percent"] for c in group_containers)
        max_capacity = len(group_containers) * 100
        avg_fill = total_fill / len(group_containers) if group_containers else 0
        
        # Determine color based on average fill percentage
        if avg_fill >= 70:
            color = "red"
        elif avg_fill >= 50:
            color = "yellow"
        else:
            color = "green"
        
        # Use first container's address as group address
        address = group_containers[0]["address"]
        
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
                "total_fill": total_fill,
                "max_capacity": max_capacity,
                "avg_fill_percent": round(avg_fill, 1),
                "color": color
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
