#!/usr/bin/env python3
"""
Монтаж ролика интро «спуск к прокату» с плавными остановками.

Зачем: раньше торможение перед карточками делалось в браузере понижением скорости
воспроизведения (playbackRate до 0,3). Кадр ролика при этом держится на экране по 3 кадра
экрана и дольше — картинка идёт ступеньками. Теперь замедления «зашиты» в сам ролик:
исходник дорисован до 120 кадров/с (ffmpeg minterpolate), и каждый кадр итогового
30-кадрового ролика берётся из нужного момента. Сайт проигрывает ролик всегда на скорости 1
и только ставит паузу на станциях.

Запуск из корня репозитория (нужны ffmpeg и python3):

    python3 tools/retime_intro.py                 # скачает исходник, если его нет в .cache/
    python3 tools/retime_intro.py --src my.mp4    # свой исходник
    python3 src/build.py                          # затем пересобрать сайт

Результат: video/descent.mp4, video/descent.webm, img/photos/intro-poster.{jpg,webp} и блок
TIMELINE в js/intro.js (моменты станций и профиль скорости для спидометра и ветра).
"""
import argparse, json, math, pathlib, shutil, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
SOURCE_URL = "https://v3b.fal.media/files/b/0aadc649/E8onzkDSHsFKFWC8S0H-v_41a023595b5f435394bbacafdf48a90c.mp4"

# ---- Сценарий (скорости — доли скорости исходника; секунды — время итогового ролика) ----
CRUISE = 0.72          # обычный ход между станциями (как в одобренной версии)
FINAL = 0.55           # ход после последней станции: длинный спокойный финальный спуск
ARRIVE = 0.35          # скорость в самом конце, у проката
MIN = 0.20             # скорость в момент остановки на станции
START_FROM = 0.15      # старт с вершины почти с места
ACCEL_FIRST = 1.0      # разгон со старта, с
ACCEL = 0.7            # разгон после станции, с
DECEL = 0.9            # торможение перед станцией, с
FINAL_ACCEL = 0.8      # разгон после последней станции, с
FINAL_DECEL = 1.0      # замедление у проката в конце, с
STATIONS_SRC = [1.12, 2.04, 2.96, 3.88, 4.80]   # где по исходнику стоят станции, с
FPS_OUT = 30
FPS_MASTER = 120
MP4_RATE, MP4_MAX = "2000k", "3000k"     # H.264 для Safari
WEBM_RATE, WEBM_MAX = "1500k", "2400k"   # VP9 для Chrome, Firefox, Android


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd[:6]), "…" if len(cmd) > 6 else "", flush=True)
    return subprocess.run(cmd, check=True, **kw)


def probe(path, entries):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entries,
                          "-of", "json", str(path)], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def plan(src_duration):
    """Сегменты: (t0, t1, s0, s1) в секундах итогового ролика, скорость меняется по smoothstep."""
    segs, t, tau = [], 0.0, 0.0
    last_frame = src_duration - 1.0 / FPS_MASTER
    starts = [(START_FROM, ACCEL_FIRST)] + [(MIN, ACCEL)] * (len(STATIONS_SRC) - 1)
    stations_out = []
    for (s_from, acc), station in zip(starts, STATIONS_SRC):
        dist_ramps = acc * (s_from + CRUISE) / 2 + DECEL * (CRUISE + MIN) / 2
        cruise = (station - tau - dist_ramps) / CRUISE
        if cruise < 0:
            sys.exit(f"Станция {station} слишком близко к предыдущей: не хватает места на разгон и торможение")
        for dur, a, b in ((acc, s_from, CRUISE), (cruise, CRUISE, CRUISE), (DECEL, CRUISE, MIN)):
            segs.append((t, t + dur, a, b)); t += dur
        tau = station; stations_out.append(round(t, 3))
    dist_ramps = FINAL_ACCEL * (MIN + FINAL) / 2 + FINAL_DECEL * (FINAL + ARRIVE) / 2
    cruise = (last_frame - tau - dist_ramps) / FINAL
    for dur, a, b in ((FINAL_ACCEL, MIN, FINAL), (cruise, FINAL, FINAL), (FINAL_DECEL, FINAL, ARRIVE)):
        segs.append((t, t + dur, a, b)); t += dur
    return segs, stations_out, t


def speed(segs, t):
    for t0, t1, a, b in segs:
        if t < t1:
            u = 0.0 if t1 == t0 else max(0.0, (t - t0) / (t1 - t0))
            return a + (b - a) * u * u * (3 - 2 * u)
    return segs[-1][3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="исходный ролик (по умолчанию скачивается в .cache/)")
    ap.add_argument("--keep-master", action="store_true", help="не удалять 120-кадровый промежуточный файл")
    args = ap.parse_args()
    CACHE.mkdir(exist_ok=True)
    src = pathlib.Path(args.src) if args.src else CACHE / "intro-original.mp4"
    if not src.exists():
        print("Скачиваю исходник…"); urllib.request.urlretrieve(SOURCE_URL, src)
    info = probe(src, "stream=width,height:format=duration")
    W, H = info["streams"][0]["width"], info["streams"][0]["height"]
    src_dur = float(info["format"]["duration"])

    master = CACHE / "intro-master120.mkv"
    if not master.exists():
        print("Дорисовываю кадры до 120/с (несколько минут)…")
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-vf",
             f"minterpolate=fps={FPS_MASTER}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
             "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10", "-pix_fmt", "yuv420p", master])

    src_dur = float(probe(master, "format=duration")["format"]["duration"])  # мастер чуть короче исходника
    segs, stations_out, total = plan(src_dur)
    n_out = int(math.floor(total * FPS_OUT))
    # для каждого кадра итогового ролика — номер кадра мастера (монотонно)
    idx, tau = [], 0.0
    for k in range(n_out):
        idx.append(min(int(round(tau * FPS_MASTER)), int(src_dur * FPS_MASTER) - 1))
        tau += speed(segs, (k + 0.5) / FPS_OUT) / FPS_OUT

    frame_bytes = W * H * 3 // 2
    retimed = CACHE / "intro-retimed.mkv"
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(master), "-f", "rawvideo", "-pix_fmt", "yuv420p", "-"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{W}x{H}",
                            "-r", str(FPS_OUT), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "8",
                            "-pix_fmt", "yuv420p", str(retimed)], stdin=subprocess.PIPE)
    cur_i, cur = -1, None
    for want in idx:
        while cur_i < want:
            buf = dec.stdout.read(frame_bytes)
            if len(buf) < frame_bytes: break
            cur, cur_i = buf, cur_i + 1
        enc.stdin.write(cur)
    enc.stdin.close(); enc.wait(); dec.stdout.close(); dec.wait()

    out_mp4, out_webm = ROOT / "video/descent.mp4", ROOT / "video/descent.webm"
    # Двухпроходное кодирование с ограничением битрейта: ролик ~3–4 МБ, чтобы на 4G он успевал
    # догружаться, пока посетитель смотрит стартовый экран и первые остановки.
    log = str(CACHE / "x264pass")
    common264 = ["-an", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-b:v", MP4_RATE,
                 "-maxrate", MP4_MAX, "-bufsize", MP4_MAX, "-pix_fmt", "yuv420p", "-g", "60", "-passlogfile", log]
    run(["ffmpeg", "-v", "error", "-y", "-i", retimed, *common264, "-pass", "1", "-f", "null", "-"])
    run(["ffmpeg", "-v", "error", "-y", "-i", retimed, *common264, "-pass", "2", "-movflags", "+faststart", out_mp4])
    log = str(CACHE / "vp9pass")
    commonvp9 = ["-an", "-c:v", "libvpx-vp9", "-b:v", WEBM_RATE, "-maxrate", WEBM_MAX, "-row-mt", "1",
                 "-deadline", "good", "-cpu-used", "2", "-g", "60", "-passlogfile", log]
    run(["ffmpeg", "-v", "error", "-y", "-i", retimed, *commonvp9, "-pass", "1", "-f", "null", "-"])
    run(["ffmpeg", "-v", "error", "-y", "-i", retimed, *commonvp9, "-pass", "2", out_webm])
    run(["ffmpeg", "-v", "error", "-y", "-i", retimed, "-frames:v", "1", "-q:v", "4", ROOT / "img/photos/intro-poster.jpg"])
    run(["ffmpeg", "-v", "error", "-y", "-i", retimed, "-frames:v", "1", "-c:v", "libwebp", "-quality", "70",
         ROOT / "img/photos/intro-poster.webp"])

    # блок TIMELINE в js/intro.js
    timeline = {"duration": round(n_out / FPS_OUT, 3), "cruise": CRUISE, "stations": stations_out,
                "segments": [[round(a, 3), round(b, 3), round(c, 3), round(d, 3)] for a, b, c, d in segs]}
    js = ROOT / "js/intro.js"; s = js.read_text(encoding="utf-8")
    begin, end = "/* TIMELINE:BEGIN", "/* TIMELINE:END */"
    i, j = s.index(begin), s.index(end)
    block = (begin + " — генерируется tools/retime_intro.py, не править руками */\n"
             "const TIMELINE = " + json.dumps(timeline, ensure_ascii=False) + ";\n")
    js.write_text(s[:i] + block + s[j:], encoding="utf-8")
    if not args.keep_master:
        retimed.unlink(missing_ok=True)
    print(f"Готово: {n_out} кадров, {n_out / FPS_OUT:.2f} с; станции {stations_out}; "
          f"финальный спуск {n_out / FPS_OUT - stations_out[-1]:.2f} с; "
          f"mp4 {out_mp4.stat().st_size // 1024} КБ, webm {out_webm.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    main()
