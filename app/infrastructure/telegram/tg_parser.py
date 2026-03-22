# app/infrastructure/telegram/tg_parser.py
import re
import os
import asyncio
import httpx
from datetime import datetime
from telethon import TelegramClient, events

# ==========================================
# ⚙️ НАСТРОЙКИ (Лучше вынести в .env файл)
# ==========================================
# Получить можно на https://my.telegram.org/
API_ID = 'ТВОЙ_API_ID'
API_HASH = 'ТВОЙ_API_HASH'
# Ссылка или ID группы/канала с ботом Иннополиса
CHAT_URL = 'ССЫЛКА_НА_ЧАТ_С_ДАТЧИКАМИ'  # например 't.me/innopolis_waste_test'
# Адрес нашего локального API
API_WEBHOOK_URL = 'http://api:8000/api/sensors/webhook'

# ==========================================
# 🧩 РЕГУЛЯРНОЕ ВЫРАЖЕНИЕ ДЛЯ ПАРСИНГА
# ==========================================
# Оно идеально разбирает текст, который ты прислал в ТЗ
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

client = TelegramClient('waste_parser_session', API_ID, API_HASH)


async def send_to_api(payload: dict):
    """Отправляет распарсенные данные в наше ядро FastAPI"""
    async with httpx.AsyncClient() as http_client:
        try:
            response = await http_client.post(API_WEBHOOK_URL, json=payload)
            response.raise_for_status()
            print(f"✅ Успешно отправлено в API: Контейнер {payload['container_id']}")
        except httpx.HTTPError as e:
            print(f"❌ Ошибка отправки в API: {e}")


@client.on(events.NewMessage(chats=CHAT_URL))
async def handle_new_message(event):
    """Слушатель новых сообщений в чате"""
    text = event.raw_text
    match = MESSAGE_PATTERN.search(text)

    if match:
        data = match.groupdict()

        # Преобразуем строку времени (15.03.2026 12:00) в стандартный ISO формат
        # Это нужно, чтобы Pydantic в FastAPI не ругался
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

        print(f"🔍 Распарсены данные для контейнера {payload['container_id']}. Отправляю...")
        await send_to_api(payload)
    else:
        # Если бот написал что-то другое (не сводку)
        pass


async def main():
    print("🚀 Запуск Telegram Парсера...")
    await client.start()
    print(f"🎧 Слушаю чат: {CHAT_URL}")
    await client.run_until_disconnected()


if __name__ == '__main__':
    asyncio.run(main())
