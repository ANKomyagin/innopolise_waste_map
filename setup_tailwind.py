import urllib.request
import os
from pathlib import Path

# Скачиваем Tailwind бинарник для Windows
url = "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-windows-x64.exe"
output = "tailwindcss.exe"

print(f"Скачиваем Tailwind для Windows...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        with open(output, 'wb') as f:
            f.write(response.read())
    print(f"[OK] {output} скачан")
except Exception as e:
    print(f"Ошибка при скачивании: {e}")
    exit(1)

# Создаем tailwind.config.js
config = """module.exports = {
  darkMode: 'class',
  content: ["./frontend/**/*.{html,js}"],
  theme: { extend: {} },
  plugins: [],
}
"""

with open("tailwind.config.js", "w") as f:
    f.write(config)
print("[OK] tailwind.config.js создан")

# Создаем frontend/css/input.css
css_dir = Path("frontend/css")
css_dir.mkdir(parents=True, exist_ok=True)

input_css = """@tailwind base;
@tailwind components;
@tailwind utilities;
"""

with open(css_dir / "input.css", "w") as f:
    f.write(input_css)
print("[OK] frontend/css/input.css создан")

print("\nТеперь запусти в терминале:")
print("tailwindcss.exe -i frontend/css/input.css -o frontend/css/tailwind.css --minify")
