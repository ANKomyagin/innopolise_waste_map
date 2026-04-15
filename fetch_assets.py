import os
import urllib.request
from pathlib import Path

# Структура директорий
BASE_DIR = Path("frontend/vendor")
DIRS = {
    "css": BASE_DIR / "css",
    "js": BASE_DIR / "js",
    "webfonts": BASE_DIR / "webfonts"
}

# Ссылки на ресурсы
ASSETS = {
    "css/maplibre-gl.css": "https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.css",
    "css/fontawesome.min.css": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    "js/maplibre-gl.js": "https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.js",
    "js/alpine.min.js": "https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js",
    # FontAwesome ищет шрифты в папке ../webfonts/
    "webfonts/fa-solid-900.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2",
    "webfonts/fa-regular-400.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2",
    "webfonts/fa-brands-400.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2",
}

def main():
    print("Начинаем скачивание ассетов...")
    for d in DIRS.values():
        d.mkdir(parents=True, exist_ok=True)

    for local_path, url in ASSETS.items():
        file_path = BASE_DIR / local_path
        if not file_path.exists():
            print(f"Скачивание {local_path}...")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                file_path.write_bytes(response.read())
        else:
            print(f"Файл {local_path} уже существует.")
    
    print("✅ Все библиотеки успешно скачаны в frontend/vendor/")

if __name__ == "__main__":
    main()
