#!/usr/bin/env python3
"""Создать каталог публикации. --preview-url формирует статическую версию просмотра."""
import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
parser.add_argument("--preview-url")
args = parser.parse_args()
destination = args.destination.resolve()
if destination == ROOT or ROOT in destination.parents:
    raise SystemExit("Каталог публикации должен находиться за пределами репозитория.")
if destination.exists() and any(destination.iterdir()):
    raise SystemExit("Используйте новый пустой каталог, чтобы не опубликовать посторонние файлы.")
destination.mkdir(parents=True, exist_ok=True)
pages = ("index", "prices", "service", "slopes", "contacts", "clients", "intro", "intro-3d")
for name in pages:
    html = (ROOT / (name + ".html")).read_text()
    if args.preview_url:
        html = re.sub(r'<meta\s+name="robots"[^>]*>\s*', "", html)
        html = html.replace("<head>", '<head>\n<meta name="robots" content="noindex,nofollow">', 1)
        html = html.replace("https://zski.ru", args.preview_url.rstrip("/"))
    (destination / (name + ".html")).write_text(html)
for name in ("css", "fonts", "img", "js", "video"):
    shutil.copytree(ROOT / name, destination / name, dirs_exist_ok=True)
for name in (".nojekyll", "sw.js"):
    shutil.copyfile(ROOT / name, destination / name)
if args.preview_url:
    (destination / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    (destination / "sitemap.xml").unlink(missing_ok=True)
else:
    for name in ("robots.txt", "sitemap.xml"):
        shutil.copyfile(ROOT / name, destination / name)
    for name in ("api", "lib"):
        shutil.copytree(ROOT / name, destination / name, dirs_exist_ok=True)
print(destination)
