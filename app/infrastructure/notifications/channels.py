# app/infrastructure/notifications/channels.py
import os
import httpx
import logging
from abc import ABC, abstractmethod

import smtplib
from email.message import EmailMessage

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
        self.role_to_chat_id = {
            "Мэрия": "1530085496",
            "Подрядчик": "473829505"
        }

    async def send(self, message: str, role: str):
        if not self.bot_token:
            return

        chat_id = self.role_to_chat_id.get(role) or os.getenv("DEFAULT_TG_CHAT_ID")
        if not chat_id:
            logger.warning(f"Не найден Chat ID для роли {role} в Telegram")
            return

        map_url = os.getenv("PUBLIC_SERVER_URL", "http://79.137.199.5:8321/")

        payload = {
            "chat_id": chat_id,
            "text": f"<b>[{role}]</b>\n{message}",
            "parse_mode": "HTML",
            "reply_markup": {
                "inline_keyboard": [[
                    {"text": "🗺 Открыть Карту", "url": map_url}
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
        print(f"🔵 [VK API | Роль: {role}] Отправка: {message}")

class EmailChannel(BaseChannel):
    def __init__(self, smtp_server, port, login, password, to_email):
        self.smtp = smtp_server
        self.port = port
        self.login = login
        self.password = password
        self.to_email = to_email

    async def send(self, message: str, role: str):
        if role != "Подрядчик": return

        msg = EmailMessage()
        msg.set_content(message)
        msg['Subject'] = "🚚 Маршрут вывоза мусора на сегодня"
        msg['From'] = self.login
        msg['To'] = self.to_email

        with smtplib.SMTP_SSL(self.smtp, self.port) as server:
            server.login(self.login, self.password)
            server.send_message(msg)