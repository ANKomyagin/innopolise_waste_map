import logging
from app.core.interfaces import NotificationService

logger = logging.getLogger(__name__)


class TelegramNotifier(NotificationService):
    async def send_alert(self, message: str, role: str):
        # Логика отправки через бота нужной роли
        logger.info(f"[TG БОТ -> {role}]: {message}")