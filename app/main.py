from fastapi import FastAPI
from app.services.sensor_pipeline import SensorProcessingPipeline
from app.infrastructure.routing.yandex_router import YandexRoutingProvider
from app.infrastructure.routing.yandex_router import DummyRoutingProvider
from app.infrastructure.telegram.notifier import TelegramNotifier
from app.infrastructure.database.postgres_repo import PostgresContainerRepo  # Допустим, он есть
from app.domain.models import SensorData, WebhookPayload  # Не забудь добавить импорты!


app = FastAPI(title="Innopolis Smart Waste API")

# ==========================================
# 🧱 СБОРКА ПАЙПЛАЙНА (Dependency Injection)
# ==========================================

# 1. Выбираем инфраструктуру
db_repo = PostgresContainerRepo()
notifier = TelegramNotifier()

# Хотим протестировать без платного API Яндекса?
# Просто меняем YandexRoutingProvider() на DummyRoutingProvider()!
routing_provider = DummyRoutingProvider()

# 2. Собираем бизнес-сервисы
sensor_pipeline = SensorProcessingPipeline(
    repo=db_repo,
    notifier=notifier,
    enable_alerts=True  # Можно отключить алерты на время тестов
)


# ==========================================
# 🚀 API ENDPOINTS
# ==========================================

@app.post("/api/sensors/webhook")
async def receive_sensor_data(container_id: str, raw_data: dict):
    """
    Эндпоинт, куда парсер (или сами датчики) кидают данные.
    """
    # Преобразуем сырые данные в доменную модель (валидация)
    sensor_data = SensorData(**raw_data)

    # Запускаем наш независимый пайплайн
    sensor_pipeline.process_new_data(container_id, sensor_data)

    return {"status": "ok", "pipeline_executed": True}


@app.get("/api/logistics/route")
async def get_optimal_route():
    """
    Эндпоинт для роли 'Подрядчик' - получить маршрут.
    """
    containers = db_repo.get_all()
    # Фильтруем только те, где мусора > 70%
    to_collect = [c.coords for c in containers if c.sensor_data.fill_percent >= 70]

    # Делегируем расчет нашему провайдеру (Яндекс или Dummy)
    route = routing_provider.build_route(origin="Депо", waypoints=to_collect)

    return {"route": route}


@app.post("/api/sensors/webhook")
async def receive_sensor_data(payload: WebhookPayload):
    """
    Эндпоинт, куда парсер (или сами датчики) кидают данные.
    """
    # Здесь в будущем мы будем обновлять координаты и адрес контейнера,
    # если его еще нет в БД, или если он "переехал".

    # Запускаем наш независимый пайплайн обработки датчика
    sensor_pipeline.process_new_data(payload.container_id, payload.sensor_data)

    return {"status": "ok", "container_id": payload.container_id, "pipeline_executed": True}
