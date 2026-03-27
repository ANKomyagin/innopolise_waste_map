# app/infrastructure/telegram/tg_parser.py
import re
import os
import asyncio
import httpx
from datetime import datetime
from aiogram import Bot, Dispatcher, types
from app.config.settings import settings

# ==========================================
# ⚙️ НАСТРОЙКИ
# ==========================================
BOT_TOKEN = settings.BOT_TOKEN
API_WEBHOOK_URL = os.getenv("API_WEBHOOK_URL", f"http://api:{settings.PORT}/api/sensors/webhook")

# ==========================================
# 🧩 РЕГУЛЯРНОЕ ВЫРАЖЕНИЕ ДЛЯ ПАРСИНГА
# ==========================================
MESSAGE_PATTERN = re.compile(
    r'Контейнер "(?P<container_id>[^"]+)",\s*'
    r'площадка "(?P<address>[^"]+?)\s*",\s*'
    r'заполнение "(?P<fill_percent>\d+)%",\s*'
    r'координаты "(?P<coords>[^"]+)",\s*'
    r'температура (?P<temperature>[^,]+),\s*'
    r'угол наклона (?P<tilt>[^,]+),\s*'
    r'заряд батарейки (?P<battery>[^,]+),\s*'
    r'время отправки (?P<timestamp>\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})'
)

# Инициализируем бота и диспетчер
bot = Bot(token=BOT_TOKEN) if BOT_TOKEN else None
dp = Dispatcher()


async def send_to_api(payload: dict):
    """Отправляет распарсенные данные в наше ядро FastAPI"""
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.post(API_WEBHOOK_URL, json=payload)
            response.raise_for_status()
            print(f"✅ Успешно отправлено в API: Контейнер {payload['container_id']}")
        except httpx.HTTPError as e:
            print(f"❌ Ошибка отправки в API: {e}")


# Этот хэндлер будет ловить ВСЕ текстовые сообщения, которые видит бот
@dp.message()
async def handle_new_message(message: types.Message):
    """Слушатель новых сообщений в чате"""
    # Сообщение может быть просто текстом, а может быть с картинкой (caption)
    text = message.text or message.caption

    if not text:
        return

    match = MESSAGE_PATTERN.search(text)

    if match:
        data = match.groupdict()

        # Преобразуем строку времени (15.03.2026 12:00) в стандартный ISO формат
        dt_obj = datetime.strptime(data['timestamp'], "%d.%m.%Y %H:%M")
        iso_timestamp = dt_obj.isoformat()

        # Формируем JSON точно по структуре WebhookPayload
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

        print(f"🔍 Распарсены данные для {payload['container_id']}. Отправляю в API...")
        await send_to_api(payload)
    else:
        # Сообщение не подошло под формат датчика
        pass


async def main():
    print("🚀 Запуск Telegram Парсера (через Bot API)...")
    if not bot:
        print("❌ BOT_TOKEN не задан. Парсер не может быть запущен.")
        return
    # Запускаем поллинг (бот будет постоянно опрашивать сервера ТГ на наличие новых сообщений)
    await dp.start_polling(bot)


if __name__ == '__main__':
    asyncio.run(main())
