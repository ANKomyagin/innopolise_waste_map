# app/frontend/template.py
import os
from app.config.settings import settings

def render_template(template_path: str, **kwargs) -> str:
    """Простой шаблонизатор для подстановки переменных"""
    with open(template_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Подстановка переменных
    replacements = {
        'YANDEX_API_KEY': settings.YANDEX_API_KEY,
        'PUBLIC_SERVER_URL': settings.PUBLIC_SERVER_URL,
        'DEFAULT_LAT': settings.DEFAULT_LAT,
        'DEFAULT_LON': settings.DEFAULT_LON,
        'DEFAULT_ZOOM': settings.DEFAULT_ZOOM,
    }
    
    # Добавляем пользовательские переменные
    replacements.update(kwargs)
    
    # Заменяем {{ VARIABLE }} на значения
    for key, value in replacements.items():
        content = content.replace('{{ ' + key + ' }}', str(value))
        content = content.replace('{{' + key + '}}', str(value))
    
    return content
