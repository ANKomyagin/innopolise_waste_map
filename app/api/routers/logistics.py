# app/api/routers/logistics.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from app.api.dependencies import get_db_repo, get_routing_provider

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


class RouteRequest(BaseModel):
    container_ids: List[str]
    threshold: int
    origin: str


class ResidentRouteRequest(BaseModel):
    origin: str  # "lat,lon"
    destination: str  # "lat,lon"


def deduplicate_coords(coords_list: List[str], radius_meters: float = 15.0) -> List[str]:
    """Deduplicate coordinates within a given radius (in meters)"""
    if not coords_list:
        return []
    
    unique_coords = []
    
    for coord in coords_list:
        try:
            lat, lon = map(float, coord.split(','))
        except (ValueError, IndexError):
            continue
        
        # Check if this coordinate is close to any existing unique coordinate
        is_duplicate = False
        for unique_coord in unique_coords:
            try:
                u_lat, u_lon = map(float, unique_coord.split(','))
            except (ValueError, IndexError):
                continue
            
            # Calculate distance using Haversine formula
            from math import radians, cos, sin, asin, sqrt
            R = 6371000  # Earth radius in meters
            dLat = radians(lat - u_lat)
            dLon = radians(lon - u_lon)
            a = sin(dLat/2)**2 + cos(radians(u_lat)) * cos(radians(lat)) * sin(dLon/2)**2
            c = 2 * asin(sqrt(a))
            distance = R * c
            
            if distance <= radius_meters:
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique_coords.append(coord)
    
    return unique_coords


@router.post("/route")
async def get_optimal_route(
    request: RouteRequest,
    db_repo = Depends(get_db_repo),
    routing_provider = Depends(get_routing_provider)
):
    """Get optimized route for waste collection"""
    containers = await db_repo.get_all()
    
    # Filter containers by IDs and threshold
    to_collect = [
        c.coords for c in containers
        if c.id in request.container_ids and c.sensor_data and c.sensor_data.fill_percent >= request.threshold
    ]
    
    if not to_collect:
        return {"message": "Нет контейнеров для вывоза"}
    
    # Deduplicate coordinates within 15 meters
    unique_coords = deduplicate_coords(to_collect, radius_meters=15.0)
    
    if not unique_coords:
        return {"message": "Нет уникальных точек для маршрута"}
    
    # Build route asynchronously
    route = await routing_provider.build_route(origin=request.origin, waypoints=unique_coords)
    return {"route": route}


@router.post("/resident-route")
async def get_resident_route(
    request: ResidentRouteRequest,
    routing_provider = Depends(get_routing_provider)
):
    """Get simple route from A to B for a resident"""
    route = await routing_provider.build_route(
        origin=request.origin,
        waypoints=[request.destination]
    )
    return {"route": route}
