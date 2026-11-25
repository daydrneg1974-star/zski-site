import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../js/hours.js", import.meta.url), "utf8");
const data = {};
vm.runInNewContext(fs.readFileSync(new URL("../js/data.js", import.meta.url), "utf8"), { window: data });
function status(at) {
  const badge = {
    dataset: {}, textContent: "", hidden: true,
    replaceChildren(dot, label) { this.textContent = label.textContent; }
  };
  const RealDate = Date;
  class Clock extends RealDate {
    constructor(value) { super(value ?? Date.parse(at)); }
    static now() { return Date.parse(at); }
  }
  vm.runInNewContext(source, {
    window: data, Date: Clock, setTimeout() {}, addEventListener() {},
    document: {
      hidden: false, addEventListener() {}, querySelector() { return null; },
      querySelectorAll(selector) { return selector === "[data-status]" ? [badge] : []; },
      createElement() { return { textContent: "", setAttribute() {} }; }
    }
  });
  return badge.textContent;
}
test("ночные часы используют московское время", () => {
  assert.match(status("2026-12-04T22:30:00Z"), /открыто.*02:00/);
  assert.match(status("2026-12-04T23:01:00Z"), /закрыто.*09:00/);
  assert.match(status("2026-12-05T22:30:00Z"), /открыто.*02:00/);
  assert.match(status("2026-12-06T22:30:00Z"), /закрыто.*10:00/);
});
test("границы сезона", () => {
  assert.match(status("2026-11-30T20:59:00Z"), /Межсезонье/);
  assert.match(status("2026-12-01T07:00:00Z"), /открыто/);
  assert.match(status("2027-04-15T21:00:00Z"), /Межсезонье/);
});
test("отсутствующие данные не дают исключение", () => {
  vm.runInNewContext(source, { window: {} });
});
