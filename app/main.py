import os
import asyncio
import logging
import jwt
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

from app.infrastructure.database.database import engine, Base
from app.api.routers import create_api_router
from app.infrastructure.telegram.bot import telegram_bot_service
from app.config.settings import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

is_prod = settings.ENVIRONMENT == "production"

# 1. Инициализация FastAPI
app = FastAPI(
    title="Innopolis Smart Waste API",
    description="API для управления системой умных мусорных контейнеров",
    version="1.0.0",
    openapi_version="3.1.0",
    docs_url=None if is_prod else "/docs",
    redoc_url=None,
    openapi_url=None if is_prod else "/openapi.json"
)


# Фейковый эндпоинт для Docker Healthcheck
@app.get("/docs", include_in_schema=False)
async def docker_healthcheck_fallback():
    return HTMLResponse("OK")


# 2. CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.PUBLIC_SERVER_URL,
        "http://localhost",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 3. Security middleware
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    path = request.url.path

    protected_paths = {
        "/admin.html": "admin",
        "/js/admin.js": "admin",
        "/truck.html": "contractor"
    }

    if path in protected_paths:
        token = request.cookies.get("auth_token")
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            role = payload.get("role")
            req_role = protected_paths[path]
            if req_role == "admin" and role != "admin":
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
            if req_role == "contractor" and role not in ["admin", "contractor"]:
                return JSONResponse(status_code=403, content={"detail": "Forbidden"})
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    response = await call_next(request)

    # CSP - публичный (разрешаем картинки карт и внешние API)
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com; "
        "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://cdn.jsdelivr.net https://use.fontawesome.com; "
        "img-src * data: blob:; "
        "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com https://use.fontawesome.com https://fonts.googleapis.com; "
        "connect-src *;"
    )

    # CSP - строгий (только для админки)
    if path.startswith("/admin"):
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://cdn.jsdelivr.net https://use.fontawesome.com; "
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org; "
            "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com https://use.fontawesome.com; "
            "connect-src 'self' https://*.openstreetmap.org;"
        )

    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    return response


# 4. Исправленный обработчик ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Пропускаем штатные HTTP-ошибки FastAPI (например, 404 Not Found или 422 Ошибка валидации формы логина)
    if isinstance(exc, (StarletteHTTPException, RequestValidationError)):
        raise exc

    logger.error(f"Critical Error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Внутренняя ошибка сервера. Инженеры уже уведомлены."}
    )

# ----------------------
# 5. Подключение API-роутов (до статики)
# ----------------------
api_router = create_api_router()
app.include_router(api_router)

# ----------------------
# 6. Статические файлы (catch‑all для фронтенда)
# ----------------------
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

# ----------------------
# 7. События запуска и остановки
# ----------------------
@app.on_event("startup")
async def startup_event():
    """Инициализация сервисов при запуске"""
    # Database migrations are managed by Alembic
    # Run: alembic upgrade head
    # NOTE: We no longer use Base.metadata.create_all() to avoid data loss
    # when schema changes. Use Alembic migrations instead.
    logger.info("✅ Database ready (migrations managed by Alembic)")

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