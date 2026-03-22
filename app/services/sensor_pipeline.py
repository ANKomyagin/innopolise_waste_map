from app.core.interfaces import ContainerRepository, NotificationService
from app.domain.models import SensorData, WebhookPayload # <-- Добавлен импорт


class SensorProcessingPipeline:
    def __init__(self, repo: ContainerRepository, notifier: NotificationService, enable_alerts: bool = True):
        self.repo = repo
        self.notifier = notifier
        self.enable_alerts = enable_alerts

    # ИЗМЕНЕНИЯ ЗДЕСЬ:
    def process_new_data(self, payload: WebhookPayload):
        # 1. Сохраняем/Обновляем данные в базе
        self.repo.upsert_container(
            container_id=payload.container_id,
            address=payload.address,
            coords=payload.coords,
            sensor_data=payload.sensor_data.dict() # Конвертируем Pydantic в dict для JSON
        )

        # 2. Проверяем бизнес-правила
        if self.enable_alerts:
            self._check_hardware_alerts(payload.container_id, payload.sensor_data)
            self._check_fill_level(payload.container_id, payload.sensor_data)

    def _check_hardware_alerts(self, container_id: str, data: SensorData):
        if data.battery_status == "заряд батарейки низкий":
            self.notifier.send_alert(f"Контейнер {container_id}: Низкий заряд!", role="Мэрия")
        if data.tilt_status != "угол наклона норм.":
            self.notifier.send_alert(f"Контейнер {container_id}: Опрокинут!", role="Мэрия")

    def _check_fill_level(self, container_id: str, data: SensorData):
        if data.fill_percent >= 70: # Снизил до 70 для тестов
            self.notifier.send_alert(f"Контейнер {container_id} переполнен ({data.fill_percent}%)!", role="Подрядчик")
