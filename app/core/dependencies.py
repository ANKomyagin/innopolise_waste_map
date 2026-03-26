# app/core/dependencies.py
import os
from app.services.sensor_pipeline import SensorProcessingPipeline
from app.infrastructure.routing.osrm_router import OSRMRoutingProvider
from app.infrastructure.database.postgres_repo import PostgresContainerRepo
from app.infrastructure.notifications.dispatcher import UniversalNotificationDispatcher
from app.infrastructure.notifications.channels import ConsoleChannel, TelegramChannel, VKChannel


def setup_notification_channels():
    """Setup and configure notification channels"""
    active_channels = [
        ConsoleChannel(),  # Всегда выводим в консоль для дебага
    ]
    
    # Если в переменных окружения есть токен ТГ - включаем ТГ канал
    tg_token = os.getenv("BOT_TOKEN", "8773001515:AAEe8BsCGPAdZyb_IDf4ZUw3L4fPF8Mqms4")
    if tg_token:
        active_channels.append(TelegramChannel(bot_token=tg_token))
    
    # Если есть токен VK - включаем VK канал
    vk_token = os.getenv("VK_TOKEN")
    if vk_token:
        active_channels.append(VKChannel(vk_token=vk_token))
    
    return active_channels


def setup_services():
    """Setup and configure all application services"""
    # Database repository
    db_repo = PostgresContainerRepo()
    
    # Notification system
    active_channels = setup_notification_channels()
    notifier = UniversalNotificationDispatcher(channels=active_channels)
    
    # Routing service
    routing_provider = OSRMRoutingProvider()
    
    # Sensor processing pipeline
    sensor_pipeline = SensorProcessingPipeline(
        repo=db_repo,
        notifier=notifier,
        enable_alerts=True
    )
    
    return {
        "db_repo": db_repo,
        "notifier": notifier,
        "routing_provider": routing_provider,
        "sensor_pipeline": sensor_pipeline
    }
