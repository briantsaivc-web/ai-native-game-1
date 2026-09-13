"use strict";
/** T-DATA-01～07：資料檔驗證（規格 §9.3、ADR-001 §2.3）。 */
var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");
var H = require("./helpers");
var data = H.loadData();

var DATA_DIR = path.join(__dirname, "..", "..", "src", "data");
var EFFECT_TYPES = ["ADD_TOKENS", "SWAN_RETURN_ONCE", "NTH_INCOME_DOUBLE", "THRESHOLD_PLUS", "STOP_BONUS"];

function tokenIds() { return data.tokens.tokens.map(function (t) { return t.id; }); }

test("T-DATA-00-json-parse", function () {
  ["jobs", "assets", "tokens", "balance"].forEach(function (name) {
    var text = fs.readFileSync(path.join(DATA_DIR, name + ".json"), "utf8");
    assert.doesNotThrow(function () { JSON.parse(text); }, name + ".json 必須是合法 JSON");
  });
  assert.ok(Array.isArray(data.jobs.jobs));
  assert.ok(Array.isArray(data.assets.assets));
  assert.ok(Array.isArray(data.tokens.tokens));
  assert.equal(typeof data.balance.rounds, "number");
});

test("T-DATA-01-asset-ids-unique", function () {
  var ids = data.assets.assets.map(function (a) { return a.id; });
  assert.equal(ids.length, 12, "共 12 張");
  assert.equal(new Set(ids).size, 12, "id 唯一");
  data.assets.assets.forEach(function (a) {
    assert.equal(typeof a.cost, "number");
    assert.equal(typeof a.value, "number");
    assert.ok(Array.isArray(a.tokensAdded));
  });
});

test("T-DATA-02-job-bag-tokens-exist", function () {
  var ids = tokenIds();
  assert.equal(data.jobs.jobs.length, 3);
  data.jobs.jobs.forEach(function (job) {
    Object.keys(job.startBag).forEach(function (k) {
      assert.ok(ids.indexOf(k) >= 0, job.id + " startBag 的 " + k + " 必須存在於 tokens.json");
      assert.ok(Number.isInteger(job.startBag[k]) && job.startBag[k] > 0);
    });
    assert.equal(typeof job.startCash, "number");
  });
  var jobIds = data.jobs.jobs.map(function (j) { return j.id; });
  assert.equal(new Set(jobIds).size, jobIds.length);
  assert.ok(jobIds.indexOf(data.balance.aiDefaultJobId) >= 0, "aiDefaultJobId 必須是既有職業");
});

test("T-DATA-03-tokens-added-exist", function () {
  var ids = tokenIds();
  data.assets.assets.forEach(function (a) {
    a.tokensAdded.forEach(function (t) {
      assert.ok(ids.indexOf(t) >= 0, a.id + " tokensAdded 的 " + t + " 必須存在於 tokens.json");
    });
  });
  // 六種籌碼、id 唯一、kind 合法
  assert.equal(data.tokens.tokens.length, 6);
  assert.equal(new Set(ids).size, 6);
  data.tokens.tokens.forEach(function (t) {
    assert.ok(["income", "blackSwan", "insurance", "lucky"].indexOf(t.kind) >= 0);
    if (t.kind === "blackSwan") assert.ok(Array.isArray(t.eventNames) && t.eventNames.length > 0);
  });
});

test("T-DATA-04-effect-enum", function () {
  data.assets.assets.forEach(function (a) {
    assert.ok(EFFECT_TYPES.indexOf(a.effect.type) >= 0, a.id + " effect.type 不在五種枚舉");
    assert.equal(typeof a.effect.param, "number");
    if (a.effect.type === "ADD_TOKENS") assert.equal(a.effect.param, 0);
  });
});

test("T-DATA-05-ai-difficulties", function () {
  assert.deepEqual(Object.keys(data.balance.ai).sort(), ["easy", "hard", "normal"]);
  Object.keys(data.balance.ai).forEach(function (d) {
    var p = data.balance.ai[d];
    assert.equal(typeof p.swanStopOffset, "number");
    assert.equal(typeof p.incomeStop, "number");
    assert.equal(typeof p.buyInsurance, "boolean");
  });
});

test("T-DATA-06-rule-cards-at-least-3", function () {
  var ruleCards = data.assets.assets.filter(function (a) { return a.effect.type !== "ADD_TOKENS"; });
  assert.ok(ruleCards.length >= 3, "改規則卡 ≥ 3 張，實際 " + ruleCards.length);
});

test("T-DATA-07-engine-never-reads-ui-balance", function () {
  // 以 Proxy 監看 data.balance 的存取；跑完整一局（含 AI_TURN、decideAi、selectors）不得碰到 ui
  var accessed = new Set();
  var spiedBalance = new Proxy(H.clone(data.balance), {
    get: function (target, prop) {
      if (typeof prop === "string") accessed.add(prop);
      return target[prop];
    }
  });
  var spied = { jobs: data.jobs, assets: data.assets, tokens: data.tokens, balance: spiedBalance };
  var g = H.playGame(spied, { seed: 31, aiJobId: null, difficulty: "hard", humanDifficulty: "easy" });
  H.engine.selectors.netWorth(g.state, "human", spied);
  H.engine.selectors.threshold(g.state, "ai", spied);
  H.engine.canApply(g.state, { type: "DRAW" }, spied);
  assert.equal(g.state.phase, "gameOver");
  assert.ok(!accessed.has("ui"), "engine 不得讀 balance.ui；實際存取：" + Array.from(accessed).join(","));
  assert.ok(accessed.has("rounds") && accessed.has("ai"), "監看確實有生效");
});

test("T-DATA-08-no-simplified-chinese", function () {
  // 常見簡體字抽樣表（A-13）；掃 src/data 四檔與 src/engine 全部
  var simplified = "们这为说没时间发现们个应该么见开关门问题产业务营销术语级点线设计车马鸟风电话学习书语";
  var files = ["jobs.json", "assets.json", "tokens.json", "balance.json"].map(function (f) { return path.join(DATA_DIR, f); });
  var engDir = path.join(__dirname, "..", "..", "src", "engine");
  fs.readdirSync(engDir).forEach(function (f) { if (/\.js$/.test(f)) files.push(path.join(engDir, f)); });
  files.forEach(function (file) {
    var text = fs.readFileSync(file, "utf8");
    for (var i = 0; i < simplified.length; i++) {
      assert.equal(text.indexOf(simplified[i]), -1, file + " 含疑似簡體字「" + simplified[i] + "」");
    }
  });
});
