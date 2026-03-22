# app/main.py
import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from app.services.sensor_pipeline import SensorProcessingPipeline
from app.infrastructure.routing.osrm_router import OSRMRoutingProvider
from app.domain.models import WebhookPayload
from app.infrastructure.database.database import engine, Base
from app.infrastructure.database.postgres_repo import PostgresContainerRepo

# 🛠 ИМПОРТЫ ДЛЯ НОВОЙ СИСТЕМЫ УВЕДОМЛЕНИЙ
from app.infrastructure.notifications.dispatcher import UniversalNotificationDispatcher
from app.infrastructure.notifications.channels import ConsoleChannel, TelegramChannel, VKChannel

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Innopolis Smart Waste API")

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


@app.get("/map", response_class=HTMLResponse)
async def serve_map_html():
    """
    Простой Frontend: интерактивная карта для просмотра результатов!
    """
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Умная карта отходов - Иннополис</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            body { margin: 0; padding: 0; font-family: sans-serif; }
            #map { width: 100vw; height: 100vh; }
            .info-panel { position: absolute; top: 10px; right: 10px; z-index: 1000; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 0 15px rgba(0,0,0,0.2); width: 300px;}
        </style>
    </head>
    <body>
        <div class="info-panel">
            <h3>Иннополис ТКО</h3>
            <button onclick="loadRoute()" style="width: 100%; padding: 10px; background: #8bc34a; border: none; color: white; cursor: pointer; border-radius: 5px;">Сгенерировать маршрут</button>
            <p id="route-stats">Маршрут не построен</p>
        </div>
        <div id="map"></div>

        <script>
            // Инициализация карты (центр на Иннополисе)
            var map = L.map('map').setView([55.753, 48.743], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

            var currentRouteLayer = null;

            // Загружаем точки контейнеров
            fetch('/api/map/geojson')
                .then(res => res.json())
                .then(data => {
                    L.geoJSON(data, {
                        pointToLayer: function (feature, latlng) {
                            // Цвет точки зависит от заполненности
                            var color = feature.properties.color;
                            return L.circleMarker(latlng, {
                                radius: 8, fillColor: color, color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8
                            });
                        },
                        onEachFeature: function (feature, layer) {
                            layer.bindPopup(
                                "<b>Контейнер ID:</b> " + feature.properties.id + "<br>" +
                                "<b>Адрес:</b> " + feature.properties.address + "<br>" +
                                "<b>Заполнение:</b> " + feature.properties.fill_percent + "%<br>" +
                                "<b>Батарея:</b> " + feature.properties.battery
                            );
                        }
                    }).addTo(map);
                });

            // Функция загрузки маршрута
            function loadRoute() {
                document.getElementById('route-stats').innerText = "Строим оптимальный маршрут...";
                fetch('/api/logistics/route')
                    .then(res => res.json())
                    .then(data => {
                        if (data.message) {
                            document.getElementById('route-stats').innerText = data.message;
                            return;
                        }

                        // Удаляем старый маршрут, если был
                        if (currentRouteLayer) { map.removeLayer(currentRouteLayer); }

                        // Рисуем синюю линию маршрута
                        currentRouteLayer = L.geoJSON(data.route.route_geojson, {
                            style: { color: "#2196F3", weight: 5, opacity: 0.7 }
                        }).addTo(map);

                        // Обновляем статистику на панели
                        document.getElementById('route-stats').innerHTML = 
                            "<b>Дистанция:</b> " + data.route.distance_km + " км<br>" +
                            "<b>Время:</b> " + data.route.duration_min + " мин";
                    })
                    .catch(err => {
                        document.getElementById('route-stats').innerText = "Ошибка построения маршрута";
                    });
            }
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
