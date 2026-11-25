#!/usr/bin/env python3
"""Создать каталог публикации или закрытую от индексации версию просмотра."""
import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
preview = parser.add_mutually_exclusive_group()
preview.add_argument("--preview-url", help="Статический просмотр без PHP")
preview.add_argument("--server-preview-url", help="Просмотр на PHP-хостинге; форма отключена до настройки почты")
args = parser.parse_args()
preview_url = args.preview_url or args.server_preview_url
destination = args.destination.resolve()
if destination == ROOT or ROOT in destination.parents:
    raise SystemExit("Каталог публикации должен находиться за пределами репозитория.")
if destination.exists() and any(destination.iterdir()):
    raise SystemExit("Используйте новый пустой каталог, чтобы не опубликовать посторонние файлы.")
destination.mkdir(parents=True, exist_ok=True)
pages = ("index", "prices", "service", "slopes", "contacts", "clients", "intro", "intro-3d")
for name in pages:
    html = (ROOT / (name + ".html")).read_text()
    if preview_url:
        html = re.sub(r'<meta\s+name="robots"[^>]*>\s*', "", html)
        html = html.replace("<head>", '<head>\n<meta name="robots" content="noindex,nofollow">', 1)
        html = html.replace("https://zski.ru", preview_url.rstrip("/"))
        html = html.replace('<form class="cb card"', '<form data-preview class="cb card"')
        html = html.replace('data-contact-submit>', 'data-contact-submit disabled aria-describedby="contact-preview">')
        html = html.replace('<!-- CONTACT_PREVIEW_NOTICE -->',
            '<p class="form-preview" id="contact-preview">Это версия для просмотра. Отправка формы здесь отключена. '
            'Чтобы связаться с прокатом, <a href="mailto:z_ski@mail.ru">напишите на z_ski@mail.ru</a> '
            'или <a href="tel:+79919377744">позвоните</a>.</p>')
    (destination / (name + ".html")).write_text(html)
for name in ("css", "fonts", "img", "js", "video"):
    shutil.copytree(ROOT / name, destination / name, dirs_exist_ok=True)
for name in (".nojekyll", "sw.js"):
    shutil.copyfile(ROOT / name, destination / name)
if preview_url:
    (destination / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    # Пустая карта заменяет старую при обновлении временного хостинга поверх файлов.
    if args.server_preview_url:
        (destination / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>\n')
else:
    for name in ("robots.txt", "sitemap.xml"):
        shutil.copyfile(ROOT / name, destination / name)
if not args.preview_url:
    for name in ("api", "lib"):
        shutil.copytree(ROOT / name, destination / name, dirs_exist_ok=True)
print(destination)
