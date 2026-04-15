import urllib.request
from pathlib import Path

# Качаем только базовую латиницу, кириллицу и цифры (этого хватит для процентов и названий)
fonts = ["Open Sans Bold", "Open Sans Regular"]
ranges = ["0-255", "256-511", "1024-1279", "8192-8447"]

for font in fonts:
    dir_path = Path(f"frontend/fonts/{font}")
    dir_path.mkdir(parents=True, exist_ok=True)
    for r in ranges:
        url = f"https://basemaps.cartocdn.com/fonts/{font.replace(' ', '%20')}/{r}.pbf"
        filepath = dir_path / f"{r}.pbf"
        if not filepath.exists():
            print(f"Скачиваем шрифт: {font} ({r})...")
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    filepath.write_bytes(response.read())
            except Exception as e:
                print(f"Ошибка скачивания {url}: {e}")

print("✅ Шрифты успешно скачаны в frontend/fonts/")