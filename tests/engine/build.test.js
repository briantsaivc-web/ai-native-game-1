"use strict";
/**
 * T-BUILD-*：build/bundle.js 的產物檢查（分派單 S5；規格 A-05）。
 * 用 child_process 跑真正的 build 指令，輸出到暫存目錄，不動根目錄的 index.html。
 */
var test = require("node:test");
var assert = require("node:assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.resolve(__dirname, "..", "..");
var BUNDLE = path.join(ROOT, "build", "bundle.js");

function buildTo(file) {
  var r = cp.spawnSync(process.execPath, [BUNDLE, "--out", file], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, "build 失敗：" + r.stderr + r.stdout);
  return fs.readFileSync(file, "utf8");
}

test("T-BUILD-01-single-file", function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "jhjs-build-"));
  var html = buildTo(path.join(dir, "index.html"));
  var shell = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  assert.ok(!/https?:\/\//i.test(shell), "HTML 標籤層不得含 http(s)://");
  assert.ok(!/<link\b/i.test(shell), "不得含 <link");
  assert.ok(!/\bsrc\s*=/i.test(shell), "不得含外部 src=");
  assert.ok(!/@import/i.test(html), "不得含 @import");
  assert.ok(html.indexOf("window.GAME_DATA") >= 0, "須內嵌 GAME_DATA");
  assert.ok(html.indexOf("__define(\"engine/reducer.js\"") >= 0, "須內嵌 engine");
  assert.ok(html.indexOf("__define(\"ui/app.js\"") >= 0, "須內嵌 UI");
  assert.ok(html.indexOf("<!-- INJECT:") < 0, "注入標記須全部被替換");
  assert.ok(Buffer.byteLength(html, "utf8") < 300 * 1024, "檔案須 < 300 KB");
  // 內嵌資料須與 src/data 相同
  var m = html.match(/window\.GAME_DATA = (\{[\s\S]*?\});\n<\/script>/);
  assert.ok(m, "找得到 GAME_DATA");
  var embedded = JSON.parse(m[1]);
  ["jobs", "assets", "tokens", "balance"].forEach(function (k) {
    assert.deepStrictEqual(embedded[k], JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", k + ".json"), "utf8")), k + ".json 內嵌不一致");
  });
});

test("T-BUILD-02-idempotent", function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "jhjs-build-"));
  var a = buildTo(path.join(dir, "a.html"));
  var b = buildTo(path.join(dir, "b.html"));
  assert.strictEqual(a, b, "兩次 build 須 byte-identical");
});
