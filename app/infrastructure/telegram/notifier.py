from app.core.interfaces import NotificationService


class TelegramNotifier(NotificationService):
    def send_alert(self, message: str, role: str):
        # Логика отправки через бота нужной роли
        print(f"[TG БОТ -> {role}]: {message}")