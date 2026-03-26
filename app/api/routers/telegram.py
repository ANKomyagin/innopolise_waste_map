# app/api/routers/telegram.py
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from app.infrastructure.telegram.bot import telegram_bot_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telegram"])


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Webhook для Telegram бота"""
    try:
        # Проверяем, что сервис инициализирован
        if not telegram_bot_service.get_dispatcher():
            logger.warning("Telegram бот не инициализирован")
            raise HTTPException(status_code=503, detail="Telegram бот не доступен")
        
        # Получаем данные от Telegram
        update_data = await request.json()
        
        # Обновляем секретный токен (если нужен)
        # if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != "waste_map_secret":
        #     raise HTTPException(status_code=403, detail="Invalid secret token")
        
        # Обрабатываем обновление
        from aiogram import types
        update = types.Update.model_validate(update_data, context={"bot": telegram_bot_service.get_bot()})
        
        await telegram_bot_service.get_dispatcher().feed_update(
            bot=telegram_bot_service.get_bot(),
            update=update
        )
        
        return JSONResponse(content={"status": "ok"})
        
    except Exception as e:
        logger.error(f"Ошибка обработки webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/info")
async def telegram_info():
    """Информация о Telegram боте"""
    bot = telegram_bot_service.get_bot()
    if not bot:
        return {"status": "not_initialized", "message": "Telegram бот не настроен"}
    
    try:
        bot_info = await bot.get_me()
        return {
            "status": "initialized",
            "bot": {
                "id": bot_info.id,
                "username": bot_info.username,
                "first_name": bot_info.first_name,
                "is_bot": bot_info.is_bot
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@router.post("/set-webhook")
async def set_webhook(request: Request):
    """Установка webhook для Telegram бота"""
    try:
        # Получаем URL webhook из запроса
        data = await request.json()
        webhook_url = data.get("webhook_url")
        
        if not webhook_url:
            raise HTTPException(status_code=400, detail="webhook_url required")
        
        # Устанавливаем webhook
        success = await telegram_bot_service.set_webhook(webhook_url)
        
        if success:
            return {"status": "success", "webhook_url": webhook_url}
        else:
            raise HTTPException(status_code=500, detail="Failed to set webhook")
            
    except Exception as e:
        logger.error(f"Ошибка установки webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))
