# app/infrastructure/notifications/channels.py
import os
import httpx
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("Notifications")


class BaseChannel(ABC):
    """Базовый класс для всех мессенджеров"""

    @abstractmethod
    async def send(self, message: str, role: str):
        pass


class ConsoleChannel(BaseChannel):
    """Канал для отладки (выводит в консоль Docker)"""

    async def send(self, message: str, role: str):
        print(f"🖥 [CONSOLE | Роль: {role}] -> {message}")


class TelegramChannel(BaseChannel):
    """Интеграция с Telegram Bot API (С кнопкой Mini App)"""

    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

        # В реальной системе здесь будет маппинг ролей на ID чатов.
        # Пока шлем все в одну группу для тестов (замени на свой ID, если нужно)
        self.role_to_chat_id = {
            "Мэрия": "1530085496",  # Замени на ID группы Мэрии
            "Подрядчик": "473829505"  # Замени на ID группы Подрядчика
        }

    async def send(self, message: str, role: str):
        if not self.bot_token:
            return

        chat_id = self.role_to_chat_id.get(role) or os.getenv("DEFAULT_TG_CHAT_ID")
        if not chat_id:
            logger.warning(f"Не найден Chat ID для роли {role} в Telegram")
            return

        # Добавляем крутую кнопку (Inline Keyboard), которая открывает карту
        # Для Mini App нужно использовать 'web_app', но для тестов подойдет обычный 'url'
        map_url = os.getenv("PUBLIC_SERVER_URL", "http://твой_ip:8321/map")

        payload = {
            "chat_id": chat_id,
            "text": f"<b>[{role}]</b>\n{message}",
            "parse_mode": "HTML",
            "reply_markup": {
                "inline_keyboard": [[
                    {"text": "🗺 Открыть Карту (Mini App)", "url": map_url}
                ]]
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.api_url, json=payload)
                if response.status_code != 200:
                    logger.error(f"TG Error: {response.text}")
            except Exception as e:
                logger.error(f"TG Connection Error: {e}")


class VKChannel(BaseChannel):
    """Заготовка для ВКонтакте"""

    def __init__(self, vk_token: str):
        self.vk_token = vk_token

    async def send(self, message: str, role: str):
        if not self.vk_token:
            return
        # Здесь в будущем будет httpx запрос к api.vk.com/method/messages.send
        print(f"🔵 [VK API | Роль: {role}] Отправка: {message}")
