"""Проверка реального обновления и офлайна в одном профиле Chromium."""
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VERSION = "209901010001"
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        if self.path == "/sw.js":
            text = (ROOT / "sw.js").read_text()
            import re
            text = re.sub(r'zski-\d{12}', 'zski-' + VERSION, text)
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(text.encode())
        else:
            try:
                super().do_GET()
            except (BrokenPipeError, ConnectionResetError):
                pass
server = ThreadingHTTPServer(("127.0.0.1",0), functools.partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url="http://127.0.0.1:"+str(server.server_port)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get("ZSKI_BROWSER"),args=["--no-sandbox","--disable-dev-shm-usage"])
    context=browser.new_context()
    page=context.new_page()
    page.goto(url)
    page.evaluate("navigator.serviceWorker.ready.then(()=>true)")
    page.reload()
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    page.goto(url+"/prices.html")
    page.evaluate("caches.keys().then(a=>a.length)")
    VERSION="209901010002"
    page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
    page.wait_for_function("navigator.serviceWorker.getRegistration().then(r=>r.waiting!==null)")
    # Старая вкладка продолжает работать под старым воркером.
    assert page.evaluate("caches.keys().then(a=>a.includes('zski-209901010001'))")
    page.goto(url+"/contacts.html")
    page.reload()
    assert page.locator("form.cb").count()==1
    print("PASS обновление: старая вкладка, новая версия, переход и перезагрузка",flush=True)
    page.close()
    page=context.new_page()
    page.goto(url+"/contacts.html")
    page.wait_for_function("navigator.serviceWorker.getRegistration().then(r=>r.active && !r.waiting)")
    page.reload()
    page.wait_for_function("caches.keys().then(a=>a.includes('zski-209901010002'))")
    context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    page.locator("#offline-notice").wait_for()
    assert "могли измениться" in page.locator("#offline-notice").inner_text()
    assert page.evaluate("fetch('api/contact.php',{method:'POST',body:'name=test'}).then(()=>false,()=>true)")
    context.set_offline(False)
    page.locator("#offline-notice").get_by_text("Соединение восстановлено.",exact=False).wait_for()
    page.reload()
    assert page.locator("#offline-notice").count()==0
    print("PASS офлайн: сохранённая страница, честная отметка, POST не кешируется, сеть вернулась",flush=True)
    context.close()
    browser.close()
server.shutdown()
