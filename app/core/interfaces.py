from abc import ABC, abstractmethod
from typing import List
from app.domain.models import Container, RoutePath


# Интерфейс для работы с базой данных
class ContainerRepository(ABC):
    @abstractmethod
    def get_all(self) -> List[Container]: pass

    @abstractmethod
    def upsert_container(self, container_id: str, address: str, coords: str, sensor_data: dict): pass

    @abstractmethod
    def update_sensor_data(self, container_id: str, sensor_data: dict): pass


# Интерфейс для построителя маршрутов (можно будет подключать разные)
class RoutingProvider(ABC):
    @abstractmethod
    async def build_route(self, origin: str, waypoints: List[str]) -> RoutePath: pass


# Интерфейс для уведомлений
class NotificationService(ABC):
    @abstractmethod
    async def send_alert(self, message: str, role: str): pass
