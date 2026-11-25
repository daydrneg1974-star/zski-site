"""Локальные проверки Chromium. Запуск с установленным Playwright, ZSKI_BROWSER задаёт браузер."""
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
import os
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results"
OUTPUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    version = None
    def log_message(self, *args):
        pass
    def do_GET(self):
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:" + str(server.server_port)
def passed(name):
    print("PASS " + name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("ZSKI_BROWSER"), args=["--no-sandbox", "--disable-dev-shm-usage"])
    context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    context.route("https://api.open-meteo.com/**", lambda r: r.fulfill(json={"current":{"temperature_2m":-3,"weather_code":1},"daily":{"snowfall_sum":[0]}}))
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    expect(page.locator("main")).to_be_visible()
    assert page.locator(".intro-host").count() == 0
    assert page.locator('a[href="intro.html"]').count() >= 1
    passed("главная доступна сразу, интро по ссылке")
    # Клавиатурное открытие, Tab, стрелки, Escape и возврат фокуса.
    opener = page.locator(".gallery-open").first
    opener.scroll_into_view_if_needed()
    opener.focus()
    y = page.evaluate("scrollY")
    page.keyboard.press("Space")
    expect(page.locator("dialog.lightbox")).to_be_visible()
    for _ in range(8):
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement.closest('dialog') !== null")
    initial = page.locator(".lightbox img").get_attribute("src")
    page.keyboard.press("ArrowRight")
    assert page.locator(".lightbox img").get_attribute("src") != initial
    page.keyboard.press("Escape")
    expect(opener).to_be_focused()
    assert abs(page.evaluate("scrollY") - y) <= 1
    passed("галерея, Tab, Space, стрелки, Escape, фокус и прокрутка")
    page.locator("[data-route-video]").first.click()
    expect(page.locator("dialog.route-dialog")).to_be_visible()
    page.keyboard.press("Escape")
    assert page.evaluate("document.activeElement.hasAttribute('data-route-video')")
    passed("модальное видео и возврат фокуса")

    page.goto(URL + "/prices.html#calc")
    total = page.locator("[data-total]")
    expect(total).to_have_text("2 000 ₽")
    page.locator('[data-id="helmet"] [data-d="1"]').click()
    page.locator('[data-calc] input[type="range"]').fill("2")
    expect(total).to_have_text("5 000 ₽")
    items = page.evaluate("Object.values(ZSKI.rental).flatMap(g=>g.items)")
    for item in items:
        plus = page.locator('[data-id="' + item['id'] + '"] [data-d="1"]')
        assert item["name"] in plus.get_attribute("aria-label")
        for _ in range(12):
            plus.click()
        expect(page.locator('[data-id="' + item['id'] + '"] output')).to_have_text("10")
    assert "NaN" not in total.inner_text()
    passed("калькулятор, все позиции, лимит 10 и сумма")

    page.goto(URL)
    for kind in ["ski","snowboard"]:
        for level, daily in [("new",3500),("mid",3000),("pro",2500)]:
            for days in ["1","2","3"]:
                q = page.locator("[data-quiz]")
                q.locator('[data-v="' + kind + '"]').click()
                q.locator('[data-v="' + level + '"]').click()
                q.locator('[data-v="' + days + '"]').click()
                assert str(daily * int(days)) in q.locator(".res-total").inner_text().replace("\u00a0","").replace(" ","")
                assert "?text=" not in q.locator('[data-messenger="telegram"]').get_attribute("href")
                assert "?text=" not in q.locator('[data-messenger="max"]').get_attribute("href")
                q.locator("[data-copy-quiz]").click()
                assert "ZSKI" in q.locator("[data-quiz-message]").input_value()
                q.locator(".quiz-again").click()
    passed("18 сочетаний квиза, перезапуск и копирование")

    requests = []
    response = {"status":200,"message":"Почтовый сервер принял сообщение.","reference":"test-reference"}
    def api(route):
        requests.append(route.request.post_data)
        route.fulfill(status=response["status"], json=response)
    context.route("**/api/contact.php", api)
    page.goto(URL + "/contacts.html")
    form = page.locator("form.cb")
    form.locator('[name="name"]').fill("Тест")
    form.locator('[name="phone"]').fill("+79991234567")
    form.locator('button[type="submit"]').dblclick()
    expect(page.locator("[data-form-status]")).to_contain_text("принял")
    assert len(requests) == 1
    expect(form.locator('[name="name"]')).to_have_value("")
    for status in [422,429,502]:
        response = {"status":status,"message":"Тестовая ошибка"}
        if status == 422:
            response["errors"] = {"name":"Проверьте имя"}
        form.locator('[name="name"]').fill("Сохранить")
        form.locator('[name="phone"]').fill("+79991234567")
        form.locator('button[type="submit"]').click()
        expect(page.locator("[data-form-status]")).to_contain_text("Тестовая ошибка")
        expect(form.locator('[name="name"]')).to_have_value("Сохранить")
    context.unroute("**/api/contact.php", api)
    context.route("**/api/contact.php", lambda r: r.abort())
    form.locator('button[type="submit"]').click()
    expect(page.locator("[data-form-status]")).to_contain_text("не подтверждён")
    expect(form.locator('[name="name"]')).to_have_value("Сохранить")
    context.set_offline(True)
    form.locator('button[type="submit"]').click()
    expect(page.locator("[data-form-status]")).to_contain_text("Нет соединения")
    context.set_offline(False)
    passed("форма, двойное нажатие, 422/429/502, сеть и сохранение полей")

    for width in [320,375,390,768,900,1024,1440]:
        page.set_viewport_size({"width":width,"height":740})
        for path in ["/","/prices.html","/contacts.html","/service.html","/slopes.html","/clients.html"]:
            page.goto(URL + path)
            page.evaluate("document.fonts.ready")
            overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            assert not overflow, (width,path,page.evaluate("document.documentElement.scrollWidth"),page.evaluate("innerWidth"))
        passed("все страницы без переполнения, " + str(width) + " px")
    page.set_viewport_size({"width":740,"height":360})
    page.goto(URL + "/contacts.html")
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    page.set_viewport_size({"width":390,"height":844})
    page.evaluate("document.documentElement.style.fontSize='200%'")
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    assert page.locator(".actionbar .btn").evaluate_all("buttons=>buttons.every(b=>b.scrollWidth<=b.clientWidth)"), "подпись панели действий обрезана"
    page.screenshot(path=str(OUTPUT/"contacts-200.png"))
    passed("альбомный и невысокий экран, текст 200%")
    assert not errors, errors
    context.close()

    # Отказ данных и локального хранилища не отключает меню, галерею или форму.
    broken = browser.new_context(viewport={"width":375,"height":812}, service_workers="block")
    broken.route("**/js/data.js?*", lambda r:r.abort())
    tab = broken.new_page()
    tab.goto(URL)
    tab.locator(".burger").click()
    expect(tab.locator(".drawer")).to_have_class("drawer open")
    tab.keyboard.press("Escape")
    tab.locator(".gallery-open").first.click()
    expect(tab.locator("dialog.lightbox")).to_be_visible()
    tab.keyboard.press("Escape")
    tab.goto(URL+"/contacts.html")
    expect(tab.locator("form.cb")).to_be_visible()
    passed("отказ data.js: меню, статический прайс, галерея и форма")
    broken.close()
    isolated = browser.new_context(viewport={"width":375,"height":812}, service_workers="block")
    data_source = (ROOT / "js/data.js").read_text() + "\nObject.defineProperty(ZSKI,'rental',{get(){throw Error('test widget failure')}})"
    isolated.route("**/js/data.js?*", lambda route: route.fulfill(body=data_source,content_type="text/javascript"))
    tab=isolated.new_page();tab.goto(URL)
    tab.locator(".burger").click()
    expect(tab.locator(".drawer")).to_have_class("drawer open")
    tab.keyboard.press("Escape")
    tab.locator(".gallery-open").first.click()
    expect(tab.locator("dialog.lightbox")).to_be_visible()
    isolated.close()
    passed("исключение прайса изолировано от меню и галереи")
    for setup in [
        "localStorage.setItem('zski-weather:56.269875,37.490032','broken')",
        "Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}})"
    ]:
        clean = browser.new_context(service_workers="block")
        clean.add_init_script(setup)
        clean.route("https://api.open-meteo.com/**",lambda r:r.fulfill(json={"current":{"temperature_2m":-5,"weather_code":1},"daily":{"snowfall_sum":[0]}}))
        tab=clean.new_page();tab.goto(URL)
        expect(tab.locator("[data-weather]")).to_contain_text("-5°")
        clean.close()
    passed("повреждённый кеш и запрещённый localStorage: свежая погода")
    nojs=browser.new_context(java_script_enabled=False)
    tab=nojs.new_page();tab.goto(URL+"/contacts.html")
    assert tab.locator("form.cb").get_attribute("method") == "post"
    expect(tab.locator("form.cb")).to_be_visible()
    nojs.close()
    passed("форма и прямые контакты без JavaScript")
    browser.close()
server.shutdown()
