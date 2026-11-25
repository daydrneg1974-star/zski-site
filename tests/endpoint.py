"""HTTP-проверка обработчика без соединения с почтовым сервером."""
from pathlib import Path
import json
import os
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
php=os.environ.get("ZSKI_PHP","php")
with tempfile.TemporaryDirectory(prefix="zski-endpoint-") as private:
    config=Path(private)/"contact.php"
    config.write_text("<?php return "+"""[
      'smtp_host'=>'localhost','smtp_port'=>465,'smtp_encryption'=>'smtps',
      'smtp_username'=>'test','smtp_password'=>'test',
      'from'=>'sender@example.test','to'=>'recipient@example.test',
      'secret'=>'test-secret-at-least-thirty-two-characters',
      'origins'=>['http://127.0.0.1'],
      'state_dir'=>__DIR__.'/state'
    ];""")
    env=os.environ.copy()
    env["ZSKI_CONTACT_CONFIG"]=str(config)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0))
        port=sock.getsockname()[1]
    base="http://127.0.0.1:"+str(port)
    process=subprocess.Popen([php,"-n","-S","127.0.0.1:"+str(port),"-t",str(ROOT)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def request(method="POST",body=b"",accept="application/json",headers=None):
        h={"Accept":accept,"Content-Type":"application/x-www-form-urlencoded","Origin":"http://127.0.0.1"}
        h.update(headers or {})
        req=urllib.request.Request(base+"/api/contact.php",data=body if method!="GET" else None,headers=h,method=method)
        try:
            r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            r=e
        return r.status,r.headers,r.read().decode()
    try:
        for _ in range(50):
            try:
                request("GET")
                break
            except urllib.error.URLError:
                time.sleep(.1)
        cases=[
          ("GET",b"",{},404),("PUT",b"",{},405),
          ("POST",b"name=x"*12000,{},413),
          ("POST",b"{}",{"Content-Type":"application/json"},415),
          ("POST",b"name=Test",{"Origin":"https://evil.test"},403),
          ("POST",b"name=Test",{},422),
        ]
        for method,body,headers,expected in cases:
            code,h,text=request(method,body,headers=headers)
            assert code==expected,(code,text,expected)
            assert "no-store" in h["Cache-Control"]
            print("PASS HTTP "+str(code),flush=True)
        code,h,text=request(body=b"name=Test&phone=123",accept="text/html")
        assert code==422 and "Test" in text and "123" in text
        assert "SMTP" not in text and private not in text
        print("PASS без JS: ошибка сохраняет поля в ответе",flush=True)
        config.unlink()
        code,h,text=request(body=b"name=Test&phone=123",accept="text/html")
        assert code==503 and "Test" in text
        code,h,text=request(body=b"name=Test&phone=123")
        assert code==503 and "Test" not in text and private not in text
        print("PASS нет конфигурации: 503, поля и пути не раскрываются в JSON",flush=True)
    finally:
        process.terminate()
        process.wait()
