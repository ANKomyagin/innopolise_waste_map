from app.core.interfaces import ContainerRepository, NotificationService
from app.domain.models import SensorData


class SensorProcessingPipeline:
    def __init__(
        self,
        repo: ContainerRepository,
        notifier: NotificationService,
        enable_alerts: bool = True # Флаг для включения/отключения фичи
    ):
        self.repo = repo
        self.notifier = notifier
        self.enable_alerts = enable_alerts

    def process_new_data(self, container_id: str, data: SensorData):
        # 1. Сохраняем данные (Кирпичик 1)
        self.repo.update_sensor_data(container_id, data.dict())

        # 2. Проверяем бизнес-правила (Кирпичик 2: Анализ аномалий)
        if self.enable_alerts:
            self._check_hardware_alerts(container_id, data)
            self._check_fill_level(container_id, data)

    def _check_hardware_alerts(self, container_id: str, data: SensorData):
        if data.battery_status == "заряд батарейки низкий":
            self.notifier.send_alert(f"Контейнер {container_id}: Низкий заряд!", role="Мэрия")
        if data.tilt_status != "угол наклона норм.":
            self.notifier.send_alert(f"Контейнер {container_id}: Опрокинут!", role="Мэрия")

    def _check_fill_level(self, container_id: str, data: SensorData):
        if data.fill_percent >= 90:
            self.notifier.send_alert(f"Контейнер {container_id} переполнен ({data.fill_percent}%)!", role="Подрядчик")
