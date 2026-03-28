# app/infrastructure/routing/osrm_router.py
import httpx
import logging
from typing import List
from app.core.interfaces import RoutingProvider
from app.domain.models import RoutePath

logger = logging.getLogger(__name__)


class OSRMRoutingProvider(RoutingProvider):
    def __init__(self):
        # Используем публичный бесплатный сервер OSRM (для хакатона - идеально)
        self.base_url = "http://router.project-osrm.org/trip/v1/driving"

    def build_route(self, origin: str, waypoints: List[str]) -> RoutePath:
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

        # Формируем URL. Параметр source=first гарантирует, что маршрут начнется с Депо
        url = f"{self.base_url}/{osrm_coords}?source=first&geometries=geojson&roundtrip=false"

        logger.info(f"[OSRM] Отправляю запрос на оптимизацию {len(all_points)} точек...")

        response = httpx.get(url)
        if response.status_code != 200:
            logger.error(f"[OSRM ERROR] {response.text}")
            raise Exception("Ошибка построения маршрута")

        data = response.json()

        # OSRM возвращает оптимизированный маршрут (Trip)
        trip = data['trips'][0]

        # Получаем порядок, в котором алгоритм решил объехать точки
        # (Исключаем самую первую точку, так как это Депо)
        ordered_waypoints = []
        for wp in sorted(data['waypoints'], key=lambda x: x['waypoint_index']):
            if wp['waypoint_index'] != 0:
                # Возвращаем в нормальный формат "Широта, Долгота"
                ordered_waypoints.append(f"{wp['location'][1]}, {wp['location'][0]}")

        return RoutePath(
            route_geojson=trip['geometry'],  # Геометрия линии для карты!
            distance_km=round(trip['distance'] / 1000, 2),  # переводим метры в км
            duration_min=round(trip['duration'] / 60, 1),  # переводим секунды в минуты
            optimized_waypoints_order=ordered_waypoints
        )
