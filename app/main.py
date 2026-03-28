# app/main.py
import os
import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.database.database import engine, Base
from app.api.routers import create_api_router
from app.infrastructure.telegram.bot import telegram_bot_service
from app.config.settings import settings

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app initialization
app = FastAPI(title="Innopolis Smart Waste API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене укажите конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Глобальный обработчик ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Critical Error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500, 
        content={"message": "Внутренняя ошибка сервера. Инженеры уже уведомлены."}
    )

# Include API routes FIRST (before static files)
api_router = create_api_router()
app.include_router(api_router)

# Static files setup (mount after API routes)
os.makedirs("app/frontend", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/frontend"), name="static")

@app.on_event("startup")
async def startup_event():
    """Инициализация сервисов при запуске"""
    # Database setup (async)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created successfully")
    except Exception as e:
        logger.warning(f"⚠️ Database connection failed: {e}")
        logger.warning("🔄 Continuing without database - some features may not work")
    
    try:
        # Инициализация Telegram бота с таймаутом
        telegram_initialized = await asyncio.wait_for(
            telegram_bot_service.initialize(), timeout=10
        )
        if telegram_initialized:
            logger.info("✅ Telegram бот успешно инициализирован")
            
            # Установка webhook с таймаутом
            webhook_url = f"{settings.PUBLIC_SERVER_URL}/telegram/webhook"
            try:
                webhook_success = await asyncio.wait_for(
                    telegram_bot_service.set_webhook(webhook_url), timeout=10
                )
                if webhook_success:
                    logger.info(f"✅ Telegram webhook установлен: {webhook_url}")
                else:
                    logger.warning("⚠️ Не удалось установить webhook, используем polling")
                    asyncio.create_task(telegram_bot_service.start_polling())
            except asyncio.TimeoutError:
                logger.warning("⚠️ Таймаут установки webhook, используем polling")
                asyncio.create_task(telegram_bot_service.start_polling())
        else:
            logger.warning("⚠️ Telegram бот не инициализирован")
    except asyncio.TimeoutError:
        logger.warning("⚠️ Таймаут инициализации Telegram бота")
    except Exception as e:
        logger.warning(f"⚠️ Ошибка инициализации Telegram: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Очистка при остановке"""
    logger.info("🔄 Завершение работы приложения...")
