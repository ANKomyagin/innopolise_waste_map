# app/config/settings.py
import os
import logging
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

class Settings:
    """Конфигурация приложения с переменных окружения"""
    
    # База данных
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://waste_user:waste_password@postgres:5432/waste_db")
    
    # Telegram
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    TELEGRAM_CHAT_IDS: str = os.getenv("TELEGRAM_CHAT_IDS", "")
    
    # VK (опционально)
    VK_TOKEN: Optional[str] = os.getenv("VK_TOKEN")
    
    # Сервер
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Публичный URL для API (для вебхуков и уведомлений)
    PUBLIC_SERVER_URL: str = os.getenv("PUBLIC_SERVER_URL", f"http://localhost:{PORT}")
    
    # Безопасность (старый API ключ - deprecated)
    ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "")
    
    # JWT Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # Токен живет 7 дней
    
    # Учетные данные пользователей (хардкод для MVP)
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    
    CONTRACTOR_USERNAME: str = os.getenv("CONTRACTOR_USERNAME", "driver")
    CONTRACTOR_PASSWORD: str = os.getenv("CONTRACTOR_PASSWORD", "driver123")
    
    
    # Настройки приложения
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    
    # Координаты Иннополиса (по умолчанию)
    DEFAULT_LAT: float = float(os.getenv("DEFAULT_LAT", "55.753"))
    DEFAULT_LON: float = float(os.getenv("DEFAULT_LON", "48.743"))
    DEFAULT_ZOOM: int = int(os.getenv("DEFAULT_ZOOM", "13"))
    
    # Пороги для уведомлений
    FILL_THRESHOLD_HIGH: int = int(os.getenv("FILL_THRESHOLD_HIGH", "70"))
    FILL_THRESHOLD_MEDIUM: int = int(os.getenv("FILL_THRESHOLD_MEDIUM", "50"))
    
    # Защита от спама (секунды)
    ANTI_SPAM_SECONDS: int = int(os.getenv("ANTI_SPAM_SECONDS", "300"))
    
    @classmethod
    def get_telegram_chat_ids(cls) -> dict:
        """Получить словарь Chat ID для разных ролей"""
        chat_ids = {}
        try:
            if cls.TELEGRAM_CHAT_IDS:
                for pair in cls.TELEGRAM_CHAT_IDS.split(','):
                    if '=' in pair:
                        role, chat_id = pair.strip().split('=', 1)
                        chat_ids[role.strip()] = chat_id.strip()
        except Exception as e:
            logger.error(f"Ошибка парсинга TELEGRAM_CHAT_IDS: {e}")
        
        return chat_ids

# Глобальный объект настроек
settings = Settings()
