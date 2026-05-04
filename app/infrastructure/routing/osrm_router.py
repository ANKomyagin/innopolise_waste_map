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
        self.driving_url = "http://osrm-driving:5000/trip/v1/driving"
        self.foot_url = "http://osrm-foot:5000/route/v1/foot"

    async def build_optimized_trip(self, origin: str, waypoints: List[str]) -> RoutePath:
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

        url = f"{self.driving_url}/{osrm_coords}?source=first&roundtrip=false&overview=full&geometries=geojson"

        logger.info(f"[OSRM] Отправляю запрос на оптимизацию маршрута (TSP) {len(all_points)} точек...")

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

        # OSRM /trip возвращает объект trips
        trip = data['trips'][0]

        # Собираем точки маршрута
        ordered_waypoints = []
        waypoints_data = data.get('waypoints', [])
        
        # Сортируем по waypoint_index
        if waypoints_data and 'waypoint_index' in waypoints_data[0]:
            sorted_wps = sorted(waypoints_data, key=lambda x: x['waypoint_index'])
            for wp in sorted_wps:
                if wp['waypoint_index'] != 0:
                    ordered_waypoints.append(f"{wp['location'][1]}, {wp['location'][0]}")

        return RoutePath(
            route_geojson=trip['geometry'],  # Геометрия линии для карты!
            distance_km=round(trip['distance'] / 1000, 2),  # переводим метры в км
            duration_min=round(trip['duration'] / 60, 1),  # переводим секунды в минуты
            optimized_waypoints_order=ordered_waypoints
        )

    async def build_simple_route(self, origin: str, waypoints: List[str]) -> RoutePath:
        """
        origin: "Широта,Долгота"
        waypoints: ["Широта,Долгота", ...]
        """

        def flip_coords(coord_str: str) -> str:
            lat, lon = coord_str.split(',')
            return f"{lon.strip()},{lat.strip()}"

        all_points = [origin] + waypoints
        osrm_coords = ";".join([flip_coords(p) for p in all_points])

        url = f"{self.foot_url}/{osrm_coords}?overview=full&geometries=geojson"

        logger.info(f"[OSRM] Отправляю запрос на простую маршрутизацию {len(all_points)} точек...")

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

        route = data['routes'][0]

        ordered_waypoints = []
        waypoints_data = data.get('waypoints', [])
        
        for wp in waypoints_data[1:]:
            ordered_waypoints.append(f"{wp['location'][1]}, {wp['location'][0]}")

        return RoutePath(
            route_geojson=route['geometry'],
            distance_km=round(route['distance'] / 1000, 2),
            duration_min=round(route['duration'] / 60, 1),
            optimized_waypoints_order=ordered_waypoints
        )
