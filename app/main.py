# app/main.py
import os
import asyncio
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from app.infrastructure.database.database import engine, Base
from app.api.routers import create_api_router
from app.infrastructure.telegram.bot import telegram_bot_service
from app.config.settings import settings

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database setup (only create tables if database is available)
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}")
    print("🔄 Continuing without database - some features may not work")

# FastAPI app initialization
app = FastAPI(title="Innopolis Smart Waste API")

# Include API routes FIRST (before static files)
api_router = create_api_router()
app.include_router(api_router)

# Static files setup (mount after API routes)
os.makedirs("app/frontend", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/frontend"), name="static")

@app.on_event("startup")
async def startup_event():
    """Инициализация сервисов при запуске"""
    # Инициализация Telegram бота
    telegram_initialized = await telegram_bot_service.initialize()
    if telegram_initialized:
        logger.info("✅ Telegram бот успешно инициализирован")
        
        # Установка webhook (если нужно)
        webhook_url = f"{settings.PUBLIC_SERVER_URL}/telegram/webhook"
        webhook_success = await telegram_bot_service.set_webhook(webhook_url)
        if webhook_success:
            logger.info(f"✅ Telegram webhook установлен: {webhook_url}")
        else:
            logger.warning("⚠️ Не удалось установить webhook, используем polling")
            # Запуск polling как fallback
            asyncio.create_task(telegram_bot_service.start_polling())
    else:
        logger.warning("⚠️ Telegram бот не инициализирован")

@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при остановке"""
    logger.info("🔄 Завершение работы приложения...")
