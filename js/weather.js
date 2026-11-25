/* Повреждённый или недоступный кеш не мешает сетевому запросу и другим блокам. */
(async function () {
  const el = document.querySelector("[data-weather]"), address = window.ZSKI?.address;
  if (!el || !Number.isFinite(address?.lat) || !Number.isFinite(address?.lng)) return;
  const key = "zski-weather:" + address.lat + "," + address.lng;
  const valid = (weather) => weather && Number.isFinite(weather.t) && Number.isFinite(weather.code) && Number.isFinite(weather.snow);
  let weather = null;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() >= cached.t && Date.now() - cached.t < 3600000 && valid(cached.v)) weather = cached.v;
  } catch { /* Кеш необязателен. */ }
  if (!weather) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + address.lat + "&longitude=" + address.lng + "&current=temperature_2m,snowfall,weather_code&daily=snowfall_sum&timezone=Europe%2FMoscow&forecast_days=1", { signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      weather = { t: Math.round(data.current?.temperature_2m), code: data.current?.weather_code, snow: data.daily?.snowfall_sum?.[0] ?? 0 };
      if (!valid(weather)) return;
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: weather })); } catch { /* Показываем свежие данные без сохранения. */ }
    } catch { return; } finally { clearTimeout(timer); }
  }
  const icon = weather.code >= 71 && weather.code <= 77 ? "🌨" : weather.code >= 61 ? "🌧" : weather.code >= 45 ? "🌫" : weather.code >= 2 ? "⛅" : "☀";
  el.textContent = icon + " Яхрома сейчас: " + (weather.t > 0 ? "+" : "") + weather.t + "°" +
    (weather.snow > 0 ? " · снег " + weather.snow + " см за день" : "");
  el.hidden = false;
})();
