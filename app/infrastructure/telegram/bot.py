# app/infrastructure/telegram/bot.py
import asyncio
import logging
from typing import Optional
from aiogram import Bot, Dispatcher, types
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from app.config.settings import settings

logger = logging.getLogger(__name__)

class TelegramBotService:
    """Сервис Telegram бота с поддержкой webhook"""
    
    def __init__(self):
        self.bot: Optional[Bot] = None
        self.dp: Optional[Dispatcher] = None
        self.webhook_url: Optional[str] = None
        
    async def initialize(self):
        """Инициализация бота"""
        if not settings.BOT_TOKEN:
            logger.warning("BOT_TOKEN не найден, Telegram бот не будет запущен")
            return False
            
        try:
            # Создаем бота с правильной конфигурацией
            self.bot = Bot(
                token=settings.BOT_TOKEN,
                session=AiohttpSession(),
                default=DefaultBotProperties(
                    parse_mode=ParseMode.HTML,
                    disable_web_page_preview=True
                )
            )
            
            self.dp = Dispatcher()
            self._setup_handlers()
            
            logger.info("Telegram бот успешно инициализирован")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка инициализации Telegram бота: {e}")
            return False
    
    def _setup_handlers(self):
        """Настройка обработчиков сообщений"""
        
        @self.dp.message()
        async def handle_message(message: types.Message):
            """Обработчик всех текстовых сообщений"""
            await self._process_sensor_message(message)
        
        @self.dp.channel_post()
        async def handle_channel_post(message: types.Message):
            """Обработчик сообщений в канале"""
            await self._process_sensor_message(message)
        
        @self.dp.my_chat_member()
        async def handle_my_chat_member(event: types.ChatMemberUpdated):
            """Обработчик добавления/удаления бота из чата"""
            logger.info(f"Бот {event.new_chat_member.status} в чате {event.chat.id}")
    
    async def _process_sensor_message(self, message: types.Message):
        """Обработка сообщений от датчиков"""
        import re
        import httpx
        from datetime import datetime
        
        # Паттерн для парсинга сообщений от датчиков
        pattern = re.compile(
            r'Контейнер "(?P<container_id>[^"]+)",\s*'
            r'площадка "(?P<address>[^"]+?)\s*",\s*'
            r'заполнение "(?P<fill_percent>\d+)%",\s*'
            r'координаты "(?P<coords>[^"]+)",\s*'
            r'температура (?P<temperature>[^,]+),\s*'
            r'угол наклона (?P<tilt>[^,]+),\s*'
            r'заряд батарейки (?P<battery>[^,]+),\s*'
            r'время отправки (?P<timestamp>\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})'
        )
        
        text = message.text or message.caption
        if not text:
            return
        
        match = pattern.search(text)
        if not match:
            logger.info(f"Сообщение не соответствует формату датчика: {text[:50]}...")
            return
        
        data = match.groupdict()
        
        try:
            # Конвертация времени
            dt_obj = datetime.strptime(data['timestamp'], "%d.%m.%Y %H:%M")
            iso_timestamp = dt_obj.isoformat()
            
            # Формирование payload для API
            payload = {
                "container_id": data['container_id'],
                "address": data['address'],
                "coords": data['coords'],
                "sensor_data": {
                    "fill_percent": int(data['fill_percent']),
                    "temperature_status": data['temperature'].strip(),
                    "tilt_status": data['tilt'].strip(),
                    "battery_status": data['battery'].strip(),
                    "timestamp": iso_timestamp
                }
            }
            
            # Отправка в API
            api_url = f"http://api:{settings.PORT}/api/sensors/webhook"
            async with httpx.AsyncClient() as client:
                response = await client.post(api_url, json=payload, timeout=10.0)
                response.raise_for_status()
                
            logger.info(f"✅ Данные от контейнера {data['container_id']} отправлены в API")
            
            # Отправка подтверждения
            await message.answer(
                f"📡 Данные контейнера {data['container_id']} получены и обработаны"
            )
            
        except Exception as e:
            logger.error(f"Ошибка обработки сообщения от датчика: {e}")
            await message.answer("❌ Ошибка обработки данных")
    
    async def set_webhook(self, webhook_url: str):
        """Установка webhook"""
        if not self.bot:
            return False
            
        try:
            await self.bot.delete_webhook(drop_pending_updates=True)
            await self.bot.set_webhook(
                url=webhook_url,
                secret_token="waste_map_secret",
                drop_pending_updates=True
            )
            self.webhook_url = webhook_url
            logger.info(f"Webhook установлен: {webhook_url}")
            return True
        except Exception as e:
            logger.error(f"Ошибка установки webhook: {e}")
            return False
    
    async def start_polling(self):
        """Запуск поллинга (fallback)"""
        if not self.dp:
            return False
            
        try:
            await self.dp.start_polling(
                self.bot,
                handle_signals=False,
                close_bot_session=True
            )
            logger.info("Telegram бот запущен в режиме polling")
            return True
        except Exception as e:
            logger.error(f"Ошибка запуска polling: {e}")
            return False
    
    def get_dispatcher(self) -> Optional[Dispatcher]:
        """Получить диспетчер для webhook"""
        return self.dp
    
    def get_bot(self) -> Optional[Bot]:
        """Получить бота"""
        return self.bot

# Глобальный экземпляр бота
telegram_bot_service = TelegramBotService()
