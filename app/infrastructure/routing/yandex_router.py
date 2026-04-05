# app/infrastructure/routing/yandex_router.py
import logging
from app.core.interfaces import RoutingProvider

logger = logging.getLogger(__name__)


class YandexRoutingProvider(RoutingProvider):
    async def build_route(self, origin, waypoints):
        # Здесь будет реальный HTTP запрос к API Яндекс.Маршрутизации
        logger.info(f"[Yandex API] Строю маршрут от {origin} через {len(waypoints)} точек...")
        return {"path": [origin] + waypoints, "distance_km": 15.5}


# Если у Яндекса упали сервера, мы можем быстро поднять Dummy:
class DummyRoutingProvider(RoutingProvider):
    async def build_route(self, origin, waypoints):
        logger.info("[Dummy API] Строю прямой маршрут по координатам...")
        return {"path": waypoints, "distance_km": 10.0}

