FROM python:3.10-slim

WORKDIR /app

# Отключаем буферизацию вывода (чтобы логи print появлялись моментально)
ENV PYTHONUNBUFFERED=1
# Устанавливаем PYTHONPATH, чтобы питон видел папку app
ENV PYTHONPATH=/app

# Устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .