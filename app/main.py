# app/main.py
import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.services.sensor_pipeline import SensorProcessingPipeline
from app.infrastructure.routing.osrm_router import OSRMRoutingProvider
from app.domain.models import WebhookPayload
from app.infrastructure.database.database import engine, Base
from app.infrastructure.database.postgres_repo import PostgresContainerRepo

# 🛠 ИМПОРТЫ ДЛЯ НОВОЙ СИСТЕМЫ УВЕДОМЛЕНИЙ
from app.infrastructure.notifications.dispatcher import UniversalNotificationDispatcher
from app.infrastructure.notifications.channels import ConsoleChannel, TelegramChannel, VKChannel

from fastapi.staticfiles import StaticFiles
import os

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Innopolis Smart Waste API")

# 🛠 МОНТИРУЕМ СТАТИКУ ФРОНТЕНДА
# Мы скажем FastAPI отдавать файлы из папки app/frontend
os.makedirs("app/frontend", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/frontend"), name="static")


# Модель для ручного добавления мусорки админом
class NewContainer(BaseModel):
    id: str
    address: str
    coords: str

# ==========================================
# 🧱 СБОРКА УВЕДОМЛЕНИЙ (Подключаем каналы)
# ==========================================
active_channels = [
    ConsoleChannel(), # Всегда выводим в консоль для дебага
]

# Если в переменных окружения есть токен ТГ - включаем ТГ канал
tg_token = os.getenv("BOT_TOKEN", "8773001515:AAEe8BsCGPAdZyb_IDf4ZUw3L4fPF8Mqms4")
if tg_token:
    active_channels.append(TelegramChannel(bot_token=tg_token))

# Если есть токен VK - включаем VK канал
vk_token = os.getenv("VK_TOKEN")
if vk_token:
    active_channels.append(VKChannel(vk_token=vk_token))

# Создаем Диспетчер и передаем ему список активных каналов
notifier = UniversalNotificationDispatcher(channels=active_channels)

# ==========================================
# 🧱 СБОРКА ПАЙПЛАЙНА
# ==========================================
db_repo = PostgresContainerRepo()
routing_provider = OSRMRoutingProvider()

sensor_pipeline = SensorProcessingPipeline(
    repo=db_repo,
    notifier=notifier,
    enable_alerts=True
)

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
    await sensor_pipeline.process_new_data(payload)
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


@app.get("/api/analytics/dashboard")
async def get_dashboard():
    """
    Эндпоинт Дашборда: статистика для Мэрии.
    """
    containers = db_repo.get_all()

    # Фильтруем только те, у которых есть данные датчиков
    active_containers = [c for c in containers if c.sensor_data]

    if not active_containers:
        return {"message": "Нет данных для аналитики"}

    # Сортируем: от самых заполненных к самым пустым
    sorted_by_fill = sorted(active_containers, key=lambda x: x.sensor_data.fill_percent, reverse=True)

    top_3_full = [{"id": c.id, "fill": c.sensor_data.fill_percent, "address": c.address} for c in sorted_by_fill[:3]]
    top_3_empty = [{"id": c.id, "fill": c.sensor_data.fill_percent, "address": c.address} for c in
                   reversed(sorted_by_fill[-3:])]

    # Считаем контейнеры с проблемами (села батарейка, упали, возгорание)
    alerts = [c.id for c in active_containers if
              c.sensor_data.battery_status != "норм." or c.sensor_data.tilt_status != "норм."]

    return {
        "total_containers": len(containers),
        "needs_collection_now": len([c for c in active_containers if c.sensor_data.fill_percent >= 70]),
        "top_fastest_filling": top_3_full,
        "least_used": top_3_empty,
        "hardware_alerts_count": len(alerts),
        "problematic_containers": alerts
    }


@app.post("/api/containers")
async def add_container_manual(container: NewContainer):
    """Эндпоинт для Админки: ручное добавление пустой мусорки"""
    db_repo.upsert_container(
        container_id=container.id,
        address=container.address,
        coords=container.coords,
        sensor_data=None # Пустая мусорка, датчик еще ничего не прислал
    )
    return {"status": "ok", "message": "Контейнер добавлен"}

@app.delete("/api/containers/{container_id}")
async def delete_container(container_id: str):
    """Эндпоинт для Админки: удаление мусорки"""
    success = db_repo.delete_container(container_id)
    return {"status": "ok" if success else "error"}

@app.get("/")
async def serve_frontend():
    """Отдаем главную страницу сайта"""
    with open("app/frontend/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
