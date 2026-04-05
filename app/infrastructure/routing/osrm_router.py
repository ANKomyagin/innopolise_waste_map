# app/infrastructure/routing/osrm_router.py
import httpx
import logging
from typing import List
from fastapi import HTTPException
from app.core.interfaces import RoutingProvider
from app.domain.models import RoutePath

logger = logging.getLogger(__name__)


class OSRMRoutingProvider(RoutingProvider):
    def __init__(self):
        # Используем публичный бесплатный сервер OSRM (для хакатона - идеально)
        self.base_url = "http://router.project-osrm.org/route/v1/driving"

    async def build_route(self, origin: str, waypoints: List[str]) -> RoutePath:
        """
        origin: "Широта,Долгота"
        waypoints: ["Широта,Долгота", ...]
        """

        # OSRM требует координаты в формате "Долгота,Широта" (Внимание: перевернуто!)
        def flip_coords(coord_str: str) -> str:
            lat, lon = coord_str.split(',')
            return f"{lon.strip()},{lat.strip()}"

        # Собираем все точки в один список: Депо + Контейнеры
        all_points = [origin] + waypoints
        osrm_coords = ";".join([flip_coords(p) for p in all_points])

        # Формируем URL для простой маршрутизации (не оптимизация)
        url = f"{self.base_url}/{osrm_coords}?overview=full&geometries=geojson"

        logger.info(f"[OSRM] Отправляю запрос на маршрутизацию {len(all_points)} точек...")

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url)
                if response.status_code != 200:
                    logger.error(f"[OSRM ERROR] {response.text}")
                    raise HTTPException(status_code=503, detail="Сервер маршрутизации недоступен")
            except httpx.ReadTimeout:
                logger.error("[OSRM ERROR] Таймаут ожидания ответа от сервера OSRM")
                raise HTTPException(status_code=504, detail="Таймаут построения маршрута")
            except Exception as e:
                logger.error(f"[OSRM ERROR] Ошибка: {e}")
                raise HTTPException(status_code=500, detail="Ошибка при построении маршрута")

        data = response.json()

        # OSRM /route возвращает маршрут (Route вместо Trip)
        route = data['routes'][0]

        # Собираем точки маршрута
        ordered_waypoints = []
        waypoints_data = data.get('waypoints', [])
        
        # Если есть waypoint_index (например, мы вернулись к /trip для машин)
        if waypoints_data and 'waypoint_index' in waypoints_data[0]:
            sorted_wps = sorted(waypoints_data, key=lambda x: x['waypoint_index'])
            for wp in sorted_wps:
                if wp['waypoint_index'] != 0:
                    ordered_waypoints.append(f"{wp['location'][1]}, {wp['location'][0]}")
        else:
            # Для простого /route (житель) берем все точки, кроме первой (origin)
            for wp in waypoints_data[1:]:
                ordered_waypoints.append(f"{wp['location'][1]}, {wp['location'][0]}")

        return RoutePath(
            route_geojson=route['geometry'],  # Геометрия линии для карты!
            distance_km=round(route['distance'] / 1000, 2),  # переводим метры в км
            duration_min=round(route['duration'] / 60, 1),  # переводим секунды в минуты
            optimized_waypoints_order=ordered_waypoints
        )
