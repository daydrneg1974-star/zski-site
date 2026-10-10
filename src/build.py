#!/usr/bin/env python3
"""
Сборка сайта ZSKI. Запуск из корня репозитория:

    python3 src/build.py            # собрать страницы
    python3 src/build.py --check    # только проверить, что HTML в корне совпадает с исходниками

Что делает:
  * из src/layout/*.html (шапка <head>, меню, подвал) и src/pages/*.html (содержимое <main>
    с заголовком-описанием в начале файла) собирает index.html, prices.html, service.html,
    slopes.html, contacts.html в корне;
  * прайс проката и таблицу SKI-сервиса предрендерит из js/data.js (src/render.mjs, нужен node);
  * проставляет штамп сборки BUILD (ГГГГММДДЧЧММ, UTC) в ?v=BUILD у css/js/шрифтов и
    в VERSION сервис-воркера sw.js — так браузеры и сервис-воркер не держат старые файлы;
  * src/pages/intro.html копируется в intro.html как есть, только с подстановкой BUILD;
    его разметка также вставляется на главную вместо {{INTRO_MARKUP}} (слой интро при открытии сайта).

Правила: правьте src/, потом запускайте сборку и коммитьте вместе с собранным HTML
(GitHub Pages публикует корень репозитория без сборки).
"""
import argparse, json, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PAGES = ["index", "prices", "service", "slopes", "contacts"]  # собираются в шаблон
RAW = ["intro"]                                               # копируются с подстановкой BUILD


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def front_matter(text: str):
    """'---\\nключ: значение\\n---\\n' в начале файла -> (dict, остальной текст)."""
    if not text.startswith("---\n"):
        return {}, text
    head, body = text[4:].split("\n---\n", 1)
    meta = {}
    for line in head.splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, body


def prerender():
    out = subprocess.run(["node", str(SRC / "render.mjs")], capture_output=True, text=True, cwd=ROOT)
    if out.returncode:
        sys.exit("render.mjs: " + out.stderr)
    return json.loads(out.stdout)


def fill_data(html: str, data) -> str:
    def ul(m):
        key = m.group(2)
        if key not in data["pricelist"]:
            sys.exit(f'data-pricelist="{key}": нет такого раздела в js/data.js')
        return m.group(1) + data["pricelist"][key] + m.group(4)
    html = re.sub(r'(<ul[^>]*data-pricelist="([a-z]+)"[^>]*>)(.*?)(</ul>)', ul, html, flags=re.S)
    html = re.sub(r'(<div[^>]*\bdata-service\b[^>]*>)(.*?)(</div>)(?=\n)',
                  lambda m: m.group(1) + data["service"] + m.group(3), html, flags=re.S)
    return html


def intro_markup() -> str:
    """Разметка интро из src/pages/intro.html (между <body> и <noscript>) — для слоя на главной."""
    src = read(SRC / "pages" / "intro.html")
    inner = src.split("<body>\n", 1)[1].split("<noscript>", 1)[0]
    return inner.strip("\n")


def build_page(name: str, layout: dict, data, build: str) -> str:
    meta, body = front_matter(read(SRC / "pages" / f"{name}.html"))
    for k in ("title", "description", "canonical"):
        if k not in meta:
            sys.exit(f"src/pages/{name}.html: в заголовке нет поля {k}")
    head = (layout["head"]
            .replace("{{TITLE}}", meta["title"])
            .replace("{{DESCRIPTION}}", meta["description"])
            .replace("{{CANONICAL}}", meta["canonical"])
            .replace("{{SCHEMA}}", layout["schema"].rstrip("\n") if meta.get("schema") == "yes" else "")
            .replace("{{PRELOAD}}", f'<link rel="preload" as="image" href="{meta["preload"]}" type="image/webp">' if meta.get("preload") else ""))
    if "{{INTRO_MARKUP}}" in body:
        body = body.replace("{{INTRO_MARKUP}}", intro_markup())
    html = head + layout["header"] + body.rstrip("\n") + "\n" + layout["footer"]
    html = fill_data(html, data)
    return html.replace("{{BUILD}}", build)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="не писать файлы, а сравнить с текущими")
    ap.add_argument("--build", help="штамп сборки вместо текущего времени (ГГГГММДДЧЧММ)")
    args = ap.parse_args()

    layout = {k: read(SRC / "layout" / f"{k}.html") for k in ("head", "header", "footer", "schema")}
    data = prerender()
    sw = read(ROOT / "sw.js")
    current = re.search(r'const VERSION = "zski-(\d{12})"', sw)
    if args.check:
        build = current.group(1) if current else "000000000000"
    else:
        build = args.build or datetime.now(timezone.utc).strftime("%Y%m%d%H%M")

    outputs = {f"{n}.html": build_page(n, layout, data, build) for n in PAGES}
    for n in RAW:
        outputs[f"{n}.html"] = read(SRC / "pages" / f"{n}.html").replace("{{BUILD}}", build)
    outputs["sw.js"] = re.sub(r'const VERSION = "zski-\d{12}"', f'const VERSION = "zski-{build}"', sw)

    stale = [f for f, text in outputs.items() if not (ROOT / f).exists() or read(ROOT / f) != text]
    if args.check:
        if stale:
            print("Не совпадают с исходниками: " + ", ".join(stale) + "\nЗапустите: python3 src/build.py")
            sys.exit(1)
        print("Все страницы собраны из актуальных исходников.")
        return
    for f, text in outputs.items():
        (ROOT / f).write_text(text, encoding="utf-8")
    print(f"BUILD={build}: " + ", ".join(outputs))


if __name__ == "__main__":
    main()
