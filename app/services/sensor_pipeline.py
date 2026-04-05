from app.core.interfaces import ContainerRepository, NotificationService
from app.domain.models import SensorData, WebhookPayload


class SensorProcessingPipeline:
    def __init__(self, repo: ContainerRepository, notifier: NotificationService, enable_alerts: bool = True):
        self.repo = repo
        self.notifier = notifier
        self.enable_alerts = enable_alerts

    async def process_new_data(self, payload: WebhookPayload):
        sensor_dict = payload.sensor_data.model_dump()
        sensor_dict['timestamp'] = sensor_dict['timestamp'].isoformat()

        await self.repo.upsert_container(
            container_id=payload.container_id,
            address=payload.address,
            coords=payload.coords,
            sensor_data=sensor_dict
        )

        if self.enable_alerts:
            # ИЗМЕНЕНИЕ: добавили await
            await self._check_hardware_alerts(payload.container_id, payload.sensor_data)
            await self._check_fill_level(payload.container_id, payload.sensor_data)

    # ИЗМЕНЕНИЕ: Сделали методы async
    async def _check_hardware_alerts(self, container_id: str, data: SensorData):
        if data.battery_status == "заряд батарейки низкий":
            await self.notifier.send_alert(f"⚠️ Контейнер {container_id}: Низкий заряд!", role="Мэрия")
        if data.tilt_status != "угол наклона норм.":
            await self.notifier.send_alert(f"🚨 Контейнер {container_id}: Опрокинут!", role="Мэрия")

    async def _check_fill_level(self, container_id: str, data: SensorData):
        if data.fill_percent >= 70:
            await self.notifier.send_alert(f"🗑 Контейнер {container_id} переполнен ({data.fill_percent}%)!", role="Подрядчик")
            