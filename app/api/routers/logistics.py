# app/api/routers/logistics.py
from fastapi import APIRouter, Depends
from app.api.dependencies import get_db_repo, get_routing_provider

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


@router.get("/route")
async def get_optimal_route(db_repo = Depends(get_db_repo), routing_provider = Depends(get_routing_provider)):
    """Get optimized route for waste collection"""
    containers = await db_repo.get_all()
    # Берем координаты только переполненных контейнеров
    to_collect = [c.coords for c in containers if c.sensor_data and c.sensor_data.fill_percent >= 70]
    
    if not to_collect:
        return {"message": "Нет контейнеров для вывоза (все < 70%)"}
    
    # Строим маршрут
    DEPOT_COORDS = "55.753, 48.743"
    route = routing_provider.build_route(origin=DEPOT_COORDS, waypoints=to_collect)
    return {"route": route}
