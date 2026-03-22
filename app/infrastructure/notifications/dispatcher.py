# app/infrastructure/notifications/dispatcher.py
import asyncio
from typing import List
from app.core.interfaces import NotificationService
from app.infrastructure.notifications.channels import BaseChannel


class UniversalNotificationDispatcher(NotificationService):
    def __init__(self, channels: List[BaseChannel]):
        self.channels = channels

    async def send_alert(self, message: str, role: str):
        """
        Берет сообщение и асинхронно рассылает его по всем подключенным каналам.
        """
        # Создаем список задач (чтобы отправка в VK не ждала отправку в ТГ)
        tasks = []
        for channel in self.channels:
            tasks.append(channel.send(message, role))

        # Запускаем все задачи параллельно (Fire and Forget)
        if tasks:
            asyncio.create_task(self._gather_tasks(tasks))

    async def _gather_tasks(self, tasks):
        # Выполняем рассылку без блокировки основного потока API
        await asyncio.gather(*tasks, return_exceptions=True)
        