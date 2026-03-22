from abc import ABC, abstractmethod
from typing import List
from app.domain.models import Container, RoutePath


# Интерфейс для работы с базой данных
class ContainerRepository(ABC):
    @abstractmethod
    def get_all(self) -> List[Container]: pass

    @abstractmethod
    def update_sensor_data(self, container_id: str, data: dict): pass


# Интерфейс для построителя маршрутов (можно будет подключать разные)
class RoutingProvider(ABC):
    @abstractmethod
    def build_route(self, origin: str, waypoints: List[str]) -> RoutePath: pass


# Интерфейс для уведомлений
class NotificationService(ABC):
    @abstractmethod
    def send_alert(self, message: str, role: str): pass
