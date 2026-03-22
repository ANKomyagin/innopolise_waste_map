# app/infrastructure/routing/yandex_router.py
from app.core.interfaces import RoutingProvider


class YandexRoutingProvider(RoutingProvider):
    def build_route(self, origin, waypoints):
        # Здесь будет реальный HTTP запрос к API Яндекс.Маршрутизации
        print(f"[Yandex API] Строю маршрут от {origin} через {len(waypoints)} точек...")
        return {"path": [origin] + waypoints, "distance_km": 15.5}


# Если у Яндекса упали сервера, мы можем быстро поднять Dummy:
class DummyRoutingProvider(RoutingProvider):
    def build_route(self, origin, waypoints):
        print("[Dummy API] Строю прямой маршрут по координатам...")
        return {"path": waypoints, "distance_km": 10.0}


# app/infrastructure/telegram/notifier.py
from app.core.interfaces import NotificationService


class TelegramNotifier(NotificationService):
    def send_alert(self, message: str, role: str):
        # Логика отправки через бота нужной роли
        print(f"[TG БОТ -> {role}]: {message}")
