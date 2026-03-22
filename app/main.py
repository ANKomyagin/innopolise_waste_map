# app/main.py
from fastapi import FastAPI
from app.services.sensor_pipeline import SensorProcessingPipeline
from app.infrastructure.routing.yandex_router import DummyRoutingProvider
from app.infrastructure.telegram.notifier import TelegramNotifier
from app.domain.models import SensorData, WebhookPayload
from app.core.interfaces import ContainerRepository

# ВРЕМЕННАЯ ЗАГЛУШКА БАЗЫ ДАННЫХ, чтобы код не падал
class DummyRepo(ContainerRepository):
    def get_all(self): return []
    def update_sensor_data(self, container_id: str, data: dict):
        print(f"[DB MOCK] Данные контейнера {container_id} сохранены в базу!")

app = FastAPI(title="Innopolis Smart Waste API")

# ==========================================
# 🧱 СБОРКА ПАЙПЛАЙНА (Dependency Injection)
# ==========================================
db_repo = DummyRepo() # Используем заглушку вместо Postgres
notifier = TelegramNotifier()
routing_provider = DummyRoutingProvider()

sensor_pipeline = SensorProcessingPipeline(
    repo=db_repo,
    notifier=notifier,
    enable_alerts=True
)

# ==========================================
# 🚀 API ENDPOINTS
# ==========================================
@app.get("/api/logistics/route")
async def get_optimal_route():
    containers = db_repo.get_all()
    to_collect = [c.coords for c in containers if c.sensor_data and c.sensor_data.fill_percent >= 70]
    route = routing_provider.build_route(origin="Депо", waypoints=to_collect)
    return {"route": route}

@app.post("/api/sensors/webhook")
async def receive_sensor_data(payload: WebhookPayload):
    sensor_pipeline.process_new_data(payload.container_id, payload.sensor_data)
    return {"status": "ok", "container_id": payload.container_id, "pipeline_executed": True}
