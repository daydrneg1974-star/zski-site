// Предрендер прайса проката и таблицы SKI-сервиса из js/data.js.
// Вызывается из build.py; печатает JSON { pricelist: {ski, snowboard, extras}, service }.
// Разметка должна совпадать с renderPriceList и [data-service] в js/main.js —
// main.js потом перерисовывает те же блоки теми же данными.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(join(root, "js/data.js"), "utf8"))(win);
const D = win.ZSKI;

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const tight = (s) => s.replace(/>\s+</g, "><").trim();

const priceList = (group) => tight(group.items.map((it) => `
      <li class="price-row">
        <div><span class="name">${it.name}${it.popular ? '<span class="pill">хит</span>' : ""}</span>
          ${it.note ? `<span class="note">${it.note}</span>` : ""}</div>
        <div class="price">${fmt(it.price)} <small>/ день</small></div>
      </li>`).join(""));

const service = tight(D.service.map((g) => `
      <div>
        <h3 style="margin-bottom:10px">${g.title}</h3>
        <table class="price-table service"><thead><tr><th>Услуга</th><th>Лыжи</th><th>Сноуборд</th></tr></thead>
        <tbody>${g.rows.map((r) => `<tr><td>${r.name}</td><td>${r.ski}</td><td>${r.sb}</td></tr>`).join("")}</tbody></table>
      </div>`).join(""));

const pricelist = Object.fromEntries(Object.entries(D.rental).map(([k, g]) => [k, priceList(g)]));
process.stdout.write(JSON.stringify({ pricelist, service }));
