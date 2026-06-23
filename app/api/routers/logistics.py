# app/api/routers/logistics.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from app.api.dependencies import get_db_repo, get_routing_provider
from app.core.auth import verify_contractor  # ✅ Добавлен импорт для проверки прав

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


class RouteRequest(BaseModel):
    container_ids: List[str]
    threshold: int
    origin: str


class ResidentRouteRequest(BaseModel):
    origin: str  # "lat,lon"
    destination: str  # "lat,lon"


def deduplicate_coords(coords_list: List[str], radius_meters: float = 15.0) -> List[str]:
    """Deduplicate coordinates by rounding to a grid (O(N) complexity)"""
    if not coords_list:
        return []

    unique_coords = []
    seen_grid = set()

    for coord in coords_list:
        try:
            lat, lon = map(float, coord.split(','))
        except (ValueError, IndexError):
            continue

        # Rounding to 4 decimal places gives a grid of ~11m x 11m
        grid_lat = round(lat, 4)
        grid_lon = round(lon, 4)
        grid_key = (grid_lat, grid_lon)

        if grid_key not in seen_grid:
            seen_grid.add(grid_key)
            unique_coords.append(coord)

    return unique_coords


@router.post("/route")
async def get_optimal_route(
        request: RouteRequest,
        db_repo=Depends(get_db_repo),
        routing_provider=Depends(get_routing_provider),
        current_user: dict = Depends(verify_contractor)  # ✅ Защита: только подрядчики и админы
):
    """Get optimized route for waste collection (contractor/admin only)"""
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
    route = await routing_provider.build_optimized_trip(origin=request.origin, waypoints=unique_coords)
    return {"route": route}


@router.post("/resident-route")
async def get_resident_route(
        request: ResidentRouteRequest,
        routing_provider=Depends(get_routing_provider)
):
    """Get simple route from A to B for a resident (public)"""
    route = await routing_provider.build_simple_route(
        origin=request.origin,
        waypoints=[request.destination]
    )
    return {"route": route}


@router.get("/geocode")
async def geocode_address(query: str):
    """Simple in-memory geocoder using export.geojson (public)"""
    import json
    import os

    geojson_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "data", "export.geojson")

    try:
        with open(geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        results = []
        query_words = query.lower().split()

        for feature in data.get("features", []):
            props = feature.get("properties", {})
            street = props.get("addr:street", "")
            housenumber = props.get("addr:housenumber", "")
            name = props.get("name", "")

            # Create a searchable string
            search_text = f"{street} {housenumber} {name}".lower()

            # Check if ALL words from query are in the search text
            if all(word in search_text for word in query_words):
                coords = feature.get("geometry", {}).get("coordinates", [])
                if len(coords) >= 2:
                    # GeoJSON is [lon, lat], we want "lat, lon" or similar
                    lon, lat = coords[0], coords[1]
                    display_name = f"{street}, {housenumber}"
                    if name:
                        display_name += f" ({name})"

                    results.append({
                        "address": display_name.strip(", "),
                        "lat": lat,
                        "lon": lon
                    })

                    if len(results) >= 10:  # Limit results
                        break

        return {"results": results}
    except Exception as e:
        return {"error": str(e), "results": []}