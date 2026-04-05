#!/usr/bin/env python3
"""
Генератор документации проекта Innopolis Smart Waste Management System
Создает текстовый файл с полной структурой и содержимым проекта
"""

import os
from pathlib import Path
from datetime import datetime

# Исключения - файлы и папки, которые не нужно включать в документацию
EXCLUDE_DIRS = {
    '__pycache__', '.git', '.vscode', 'node_modules', '.pytest_cache',
    'venv', 'env', '.env', 'migrations', '.venv', '.idea'
}

EXCLUDE_FILES = {
    '.gitignore', '.dockerignore', '.DS_Store', 'Thumbs.db',
    '*.pyc', '*.pyo', '*.pyd', '.env', '*.log', 'generate_project_docs.py', 'project_documentation.txt'
}

# Расширения файлов, которые нужно включать в документацию
INCLUDE_EXTENSIONS = {
    '.py', '.html', '.css', '.js', '.yml', '.yaml', '.txt', '.md',
    '.sql', '.conf', '.sh', '.json', '.xml'
}

def should_include_file(file_path):
    """Проверить, нужно ли включать файл в документацию"""
    file_name = os.path.basename(file_path)
    
    # Проверить исключения по имени
    for exclude in EXCLUDE_FILES:
        if exclude.startswith('*'):
            if file_name.endswith(exclude[1:]):
                return False
        elif file_name == exclude:
            return False
    
    # Проверить расширение
    ext = os.path.splitext(file_name)[1].lower()
    return ext in INCLUDE_EXTENSIONS

def should_include_dir(dir_name):
    """Проверить, нужно ли включать директорию в документацию"""
    return dir_name not in EXCLUDE_DIRS

def get_project_structure(root_path):
    """Получить структуру проекта"""
    structure = []
    root_path = Path(root_path)
    
    for item in sorted(root_path.rglob('*')):
        if item.is_file():
            # Проверить, что ни один из родительских каталогов не исключен
            parent_dirs = item.relative_to(root_path).parts[:-1]  # все родительские директории
            should_exclude = any(parent_dir in EXCLUDE_DIRS for parent_dir in parent_dirs)
            
            if not should_exclude and should_include_file(item):
                relative_path = item.relative_to(root_path)
                structure.append(relative_path)
    
    return structure

def read_file_content(file_path, max_lines=500):
    """Прочитать содержимое файла с ограничением по строкам"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            if len(lines) > max_lines:
                lines = lines[:max_lines] + [f"\n... (пропущено {len(lines) - max_lines} строк)\n"]
            return ''.join(lines)
    except Exception as e:
        return f"[Ошибка чтения файла: {e}]"

def generate_tree_structure(root_path, structure):
    """Сгенерировать текстовое представление дерева структуры"""
    tree_lines = []
    path_dict = {}
    
    # Построить словарь путей
    for file_path in structure:
        parts = file_path.parts
        current = path_dict
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = None
    
    # Рекурсивная функция для построения дерева
    def build_tree(d, prefix='', is_last=True):
        items = list(d.items())
        for i, (name, subdict) in enumerate(items):
            is_last_item = i == len(items) - 1
            current_prefix = '└── ' if is_last_item else '├── '
            tree_lines.append(f"{prefix}{current_prefix}{name}")
            
            if subdict is not None:  # Это директория
                next_prefix = prefix + ('    ' if is_last_item else '│   ')
                build_tree(subdict, next_prefix)
    
    tree_lines.append(root_path.name + '/')
    build_tree(path_dict)
    return '\n'.join(tree_lines)

def generate_documentation():
    """Основная функция генерации документации"""
    project_root = Path(__file__).parent
    output_file = project_root / 'project_documentation.txt'
    
    print(f"🔍 Анализ проекта: {project_root}")
    
    # Получить структуру проекта
    structure = get_project_structure(project_root)
    print(f"📁 Найдено файлов: {len(structure)}")
    
    # Создать документацию
    doc_content = []

    # Структура проекта
    doc_content.append("\n## Структура проекта")
    doc_content.append("```\n" + generate_tree_structure(project_root, structure) + "\n```")
    
    # Содержимое файлов
    doc_content.append("\n## Содержимое файлов")
    
    for file_path in sorted(structure):
        full_path = project_root / file_path
        relative_path = str(file_path).replace('\\', '/')
        
        doc_content.append(f"\n### {relative_path}")
        doc_content.append("```")
        
        content = read_file_content(full_path)
        doc_content.append(content)
        doc_content.append("```")
    
    
    # Записать в файл
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(doc_content))
        
        print(f"✅ Документация успешно создана: {output_file}")
        print(f"📊 Размер файла: {output_file.stat().st_size} байт")
        
    except Exception as e:
        print(f"❌ Ошибка при создании файла: {e}")

if __name__ == "__main__":
    generate_documentation()
