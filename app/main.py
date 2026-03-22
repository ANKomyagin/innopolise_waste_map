# app/main.py
from fastapi import FastAPI
from app.services.sensor_pipeline import SensorProcessingPipeline
from app.infrastructure.routing.yandex_router import DummyRoutingProvider
from app.infrastructure.telegram.notifier import TelegramNotifier # Возвращаем
from app.domain.models import WebhookPayload

from app.infrastructure.database.database import engine, Base
from app.infrastructure.database.postgres_repo import PostgresContainerRepo

# Создаем таблицы в БД при старте
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Innopolis Smart Waste API")

# ==========================================
# 🧱 СБОРКА ПАЙПЛАЙНА
# ==========================================
db_repo = PostgresContainerRepo()
notifier = TelegramNotifier() # Возвращаем
routing_provider = DummyRoutingProvider()

sensor_pipeline = SensorProcessingPipeline(
    repo=db_repo,
    notifier=notifier, # Передаем аргумент!
    enable_alerts=True
)

# ==========================================
# 🚀 API ENDPOINTS
# ==========================================
@app.get("/api/logistics/route")
async def get_optimal_route():
    containers = db_repo.get_all()
    to_collect = [c.coords for c in containers if c.sensor_data and c.sensor_data.fill_percent >= 70]

    if not to_collect:
        return {"message": "Нет контейнеров для вывоза (все < 70%)"}

    route = routing_provider.build_route(origin="Депо", waypoints=to_collect)
    return {"route": route}

@app.post("/api/sensors/webhook")
async def receive_sensor_data(payload: WebhookPayload):
    sensor_pipeline.process_new_data(payload)
    return {"status": "ok", "container_id": payload.container_id, "saved_to_db": True}