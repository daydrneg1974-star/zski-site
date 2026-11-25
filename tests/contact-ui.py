"""Проверка WhatsApp и получателя формы. Внешние чаты и письма не отправляются."""
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Thread
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def serve(directory):
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(directory)))
    Thread(target=server.serve_forever, daemon=True).start()
    return server, 'http://127.0.0.1:' + str(server.server_port)

with tempfile.TemporaryDirectory(prefix='zski-contact-preview-') as preview, sync_playwright() as p:
    subprocess.run(['python3', 'tools/stage.py', preview, '--preview-url', 'https://example.test'], cwd=ROOT, check=True)
    server, base = serve(ROOT)
    preview_server, preview_base = serve(preview)
    browser = p.chromium.launch(executable_path=os.environ.get('ZSKI_BROWSER'), args=['--no-sandbox','--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width':390,'height':844}, service_workers='block')
    context.route('https://api.open-meteo.com/**', lambda r: r.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def check_dialog(link, expected_message=''):
        link.click()
        dialog = page.get_by_role('dialog', name='Написать в WhatsApp', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.locator('[data-wa-number]')).to_have_text('+7 (991) 937-77-44')
        for attr, scheme, host in [('data-wa-app','whatsapp','send'),('data-wa-web','https','web.whatsapp.com')]:
            url = urlsplit(dialog.locator('[' + attr + ']').get_attribute('href'))
            assert url.scheme == scheme and url.netloc == host
            params = parse_qs(url.query)
            assert params['phone'] == ['79919377744']
            assert params.get('text',[''])[0] == expected_message
        for _ in range(15):
            page.keyboard.press('Tab')
            assert page.evaluate('document.activeElement.closest("dialog") !== null')
        page.keyboard.press('Escape')
        expect(link).to_be_focused()

    page.goto(base)
    visible = page.locator('[data-messenger="whatsapp"]:visible')
    assert visible.count() == 2
    for link in visible.all(): check_dialog(link)
    quiz = page.locator('[data-quiz]')
    for choice in ['ski','new','2']: quiz.locator('[data-v="' + choice + '"]').click()
    prepared = quiz.locator('[data-quiz-message]').input_value()
    assert '7000' in prepared.replace(' ', '').replace('\u00a0', '')
    check_dialog(quiz.locator('[data-messenger="whatsapp"]'), prepared)
    print('PASS все три WhatsApp на главной, приложение/Web, номер и текст квиза',flush=True)

    page.goto(base + '/contacts.html#feedback')
    form = page.get_by_role('form', name='Сообщение в прокат ZSKI')
    expect(form.locator('#contact-recipient')).to_contain_text('z_ski@mail.ru')
    expect(form.locator('[data-contact-submit]')).to_have_text('Отправить в ZSKI')
    expect(form.locator('[data-contact-submit]')).to_be_enabled()
    check_dialog(page.locator('[data-messenger="whatsapp"]'))
    page.locator('[data-messenger="whatsapp"]').click()
    for width in [320,390,768,1440]:
        page.set_viewport_size({'width':width,'height':600})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert page.locator('.whatsapp-dialog').evaluate('(d)=>d.scrollWidth <= d.clientWidth + 1')
    page.set_viewport_size({'width':390,'height':844})
    (ROOT/'test-results').mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT/'test-results/whatsapp.png'))
    page.keyboard.press('Escape')
    print('PASS контакты: получатель, кнопка, WhatsApp, клавиатура и ширины 320–1440',flush=True)

    page.goto(preview_base + '/contacts.html#feedback')
    expect(page.locator('#contact-preview')).to_be_visible()
    expect(page.locator('[data-contact-submit]')).to_be_disabled()
    posted = []
    page.on('request', lambda r: posted.append(r.url) if '/api/contact.php' in r.url else None)
    page.locator('#f-name').fill('Тест')
    page.locator('#f-name').press('Enter')
    page.locator('form.cb').dispatch_event('submit')
    assert not posted
    page.locator('form.cb').screenshot(path=str(ROOT/'test-results/form-preview.png'))
    print('PASS просмотр: предупреждение до заполнения, отправка отключена, POST отсутствует',flush=True)

    nojs = browser.new_context(java_script_enabled=False, viewport={'width':390,'height':844})
    tab = nojs.new_page()
    tab.goto(base + '/contacts.html')
    url = urlsplit(tab.locator('[data-messenger="whatsapp"]').get_attribute('href'))
    assert url.netloc == 'api.whatsapp.com' and parse_qs(url.query)['phone'] == ['79919377744']
    expect(tab.locator('#contact-recipient')).to_contain_text('z_ski@mail.ru')
    tab.goto(preview_base + '/contacts.html')
    expect(tab.locator('[data-contact-submit]')).to_be_disabled()
    print('PASS без JavaScript: ссылка WhatsApp, получатель, запрет отправки в просмотре',flush=True)
    assert not errors,errors
    browser.close()
    server.shutdown()
    preview_server.shutdown()
