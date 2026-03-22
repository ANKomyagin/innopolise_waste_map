from fastapi import FastAPI
from app.services.sensor_pipeline import SensorProcessingPipeline

# 🛠 ИМПОРТИРУЕМ НОВЫЙ РОУТЕР
from app.infrastructure.routing.osrm_router import OSRMRoutingProvider
from app.domain.models import WebhookPayload
from app.core.interfaces import NotificationService
from app.infrastructure.database.database import engine, Base
from app.infrastructure.database.postgres_repo import PostgresContainerRepo

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Innopolis Smart Waste API")


class DummyNotifier(NotificationService):
    def send_alert(self, message: str, role: str):
        print(f"🔔 [DUMMY ALERT | Роль: {role}] -> {message}")

# ==========================================
# 🧱 СБОРКА ПАЙПЛАЙНА
# ==========================================
db_repo = PostgresContainerRepo()
notifier = DummyNotifier()
# 🛠 ПОДКЛЮЧИЛИ УМНУЮ ЛОГИСТИКУ!
routing_provider = OSRMRoutingProvider()

sensor_pipeline = SensorProcessingPipeline(
    repo=db_repo,
    notifier=notifier,
    enable_alerts=True
)

# Выдумаем координаты гаража (Депо) где-то возле Универа Иннополиса
DEPOT_COORDS = "55.753, 48.743"

# ==========================================
# 🚀 API ENDPOINTS
# ==========================================
@app.get("/api/logistics/route")
async def get_optimal_route():
    containers = db_repo.get_all()
    # Берем координаты только переполненных контейнеров
    to_collect = [c.coords for c in containers if c.sensor_data and c.sensor_data.fill_percent >= 70]

    if not to_collect:
        return {"message": "Нет контейнеров для вывоза (все < 70%)"}

    # Строим маршрут
    route = routing_provider.build_route(origin=DEPOT_COORDS, waypoints=to_collect)
    return {"route": route}


@app.post("/api/sensors/webhook")
async def receive_sensor_data(payload: WebhookPayload):
    sensor_pipeline.process_new_data(payload)
    return {"status": "ok", "container_id": payload.container_id, "saved_to_db": True}


@app.get("/api/map/geojson")
async def get_map_geojson():
    """
    Эндпоинт для Фронтенда. Отдает все контейнеры в формате GeoJSON.
    """
    containers = db_repo.get_all()
    features = []

    for c in containers:
        # Бот присылает координаты в виде строки: "55.747825, 48.744205" (Широта, Долгота)
        # GeoJSON требует массив чисел: [Долгота, Широта]
        try:
            lat_str, lon_str = c.coords.split(",")
            lat = float(lat_str.strip())
            lon = float(lon_str.strip())
        except (ValueError, AttributeError):
            continue  # Если координаты кривые, пропускаем этот контейнер

        # Определяем статус наполнения (если данных с датчика еще нет, считаем 0%)
        fill = c.sensor_data.fill_percent if c.sensor_data else 0

        # Задаем цвет для карты по условиям кейса
        if fill >= 70:
            color = "red"
        elif fill >= 50:
            color = "yellow"
        else:
            color = "green"

        # Формируем объект (Feature) для карты
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]  # Внимание: сначала долгота, потом широта!
            },
            "properties": {
                "id": c.id,
                "address": c.address,
                "fill_percent": fill,
                "color": color,
                "battery": c.sensor_data.battery_status if c.sensor_data else "неизвестно",
                "temperature": c.sensor_data.temperature_status if c.sensor_data else "неизвестно"
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }
