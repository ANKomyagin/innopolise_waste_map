#!/usr/bin/env python3
"""
Скрипт для сравнения текущего проекта с документацией
Показывает только измененные файлы, сохраняя структуру проекта
"""

import os
import re
import hashlib
import difflib
from pathlib import Path
from datetime import datetime

# Исключения - файлы и папки, которые не нужно включать в документацию
EXCLUDE_DIRS = {
    '__pycache__', '.git', '.vscode', 'node_modules', '.pytest_cache',
    'venv', 'env', '.env', 'migrations', '.venv', '.idea'
}

EXCLUDE_FILES = {
    '.gitignore', '.dockerignore', '.DS_Store', 'Thumbs.db',
    '*.pyc', '*.pyo', '*.pyd', '.env', '*.log', 'generate_project_docs.py', 'project_documentation.txt',
    'compare_project_docs.py', 'project_documentation_diff.txt'
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
            parent_dirs = item.relative_to(root_path).parts[:-1]
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

def extract_files_from_docs(doc_file):
    """Извлечь содержимое файлов из документации"""
    files_content = {}
    
    try:
        with open(doc_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Найти все секции файлов (### path/to/file)
        pattern = r'### (.*?)\n```\n(.*?)\n```'
        matches = re.finditer(pattern, content, re.DOTALL)
        
        for match in matches:
            file_path = match.group(1).strip()
            file_content = match.group(2)
            files_content[file_path] = file_content
        
        return files_content
    except Exception as e:
        print(f"❌ Ошибка при чтении документации: {e}")
        return {}

def get_file_hash(content):
    """Получить хеш содержимого файла"""
    return hashlib.md5(content.encode('utf-8')).hexdigest()

def compare_files(current_content, doc_content):
    """Сравнить содержимое файла с версией в документации"""
    current_hash = get_file_hash(current_content)
    doc_hash = get_file_hash(doc_content)
    return current_hash != doc_hash

def get_diff_with_context(current_content, doc_content, context_lines=3):
    """Получить diff с контекстом вокруг изменений"""
    current_lines = current_content.splitlines(keepends=True)
    doc_lines = doc_content.splitlines(keepends=True)
    
    # Получить unified diff
    diff = list(difflib.unified_diff(
        doc_lines,
        current_lines,
        lineterm='',
        n=context_lines
    ))
    
    if not diff:
        return None
    
    # Отфильтровать: оставить только строки с контекстом и добавленные (+)
    filtered_diff = []
    for line in diff[3:]:  # Пропустить первые 3 строки (заголовки diff)
        # Оставить строки контекста (начинаются с пробела) и добавленные (начинаются с +)
        if line.startswith(' ') or line.startswith('+'):
            filtered_diff.append(line)
    
    return ''.join(filtered_diff) if filtered_diff else None

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

def compare_documentation():
    """Основная функция сравнения документации"""
    project_root = Path(__file__).parent
    doc_file = project_root / 'project_documentation.txt'
    output_file = project_root / 'project_documentation_diff.txt'
    
    if not doc_file.exists():
        print(f"❌ Файл документации не найден: {doc_file}")
        return
    
    print(f"🔍 Анализ проекта: {project_root}")
    print(f"📄 Чтение документации: {doc_file}")
    
    # Получить текущую структуру проекта
    current_structure = get_project_structure(project_root)
    print(f"📁 Найдено файлов в проекте: {len(current_structure)}")
    
    # Извлечь содержимое файлов из документации
    doc_files = extract_files_from_docs(doc_file)
    print(f"📋 Найдено файлов в документации: {len(doc_files)}")
    
    # Найти измененные файлы
    changed_files = []
    new_files = []
    deleted_files = []
    
    for file_path in current_structure:
        relative_path_str = str(file_path).replace('\\', '/')
        full_path = project_root / file_path
        current_content = read_file_content(full_path)
        
        if relative_path_str in doc_files:
            # Файл существует в документации - проверить изменения
            doc_content = doc_files[relative_path_str]
            if compare_files(current_content, doc_content):
                changed_files.append(file_path)
        else:
            # Новый файл
            new_files.append(file_path)
    
    # Найти удаленные файлы
    for doc_file_path in doc_files.keys():
        if not any(str(f).replace('\\', '/') == doc_file_path for f in current_structure):
            deleted_files.append(doc_file_path)
    
    # Создать отчет
    doc_content = []
    doc_content.append("# Отчет об изменениях проекта")
    doc_content.append(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    doc_content.append("")
    
    # Статистика
    doc_content.append("## Статистика")
    doc_content.append(f"- Измененные файлы: {len(changed_files)}")
    doc_content.append(f"- Новые файлы: {len(new_files)}")
    doc_content.append(f"- Удаленные файлы: {len(deleted_files)}")
    doc_content.append("")
    
    # Структура проекта (только измененные файлы)
    if changed_files or new_files:
        doc_content.append("## Структура проекта (только измененные и новые файлы)")
        doc_content.append("```")
        doc_content.append(generate_tree_structure(project_root, changed_files + new_files))
        doc_content.append("```")
        doc_content.append("")
    
    # Измененные файлы
    if changed_files:
        doc_content.append("## Измененные файлы")
        for file_path in sorted(changed_files):
            relative_path = str(file_path).replace('\\', '/')
            full_path = project_root / file_path
            current_content = read_file_content(full_path)
            doc_file_content = doc_files.get(relative_path, "")
            
            diff = get_diff_with_context(current_content, doc_file_content, context_lines=3)
            
            if diff:
                doc_content.append(f"\n### {relative_path}")
                doc_content.append("```diff")
                doc_content.append(diff)
                doc_content.append("```")
    
    # Новые файлы
    if new_files:
        doc_content.append("\n## Новые файлы")
        for file_path in sorted(new_files):
            relative_path = str(file_path).replace('\\', '/')
            full_path = project_root / file_path
            
            doc_content.append(f"\n### {relative_path}")
            doc_content.append("```")
            content = read_file_content(full_path)
            doc_content.append(content)
            doc_content.append("```")
    
    # Удаленные файлы
    if deleted_files:
        doc_content.append("\n## Удаленные файлы")
        for file_path in sorted(deleted_files):
            doc_content.append(f"- {file_path}")
    
    # Записать в файл
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(doc_content))
        
        print(f"✅ Отчет об изменениях успешно создан: {output_file}")
        print(f"📊 Размер файла: {output_file.stat().st_size} байт")
        print("")
        print(f"📈 Итого:")
        print(f"   Измененные: {len(changed_files)}")
        print(f"   Новые: {len(new_files)}")
        print(f"   Удаленные: {len(deleted_files)}")
        
    except Exception as e:
        print(f"❌ Ошибка при создании файла: {e}")

if __name__ == "__main__":
    compare_documentation()
