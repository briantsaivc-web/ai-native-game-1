"use strict";
/**
 * G4.5 實證：
 *  - 外部 1 E-2／E-3（市場預覽在 draw 階段繞過 canApply）：S7 已把預覽改為「現金足夠且袋中有黑天鵝」；
 *    本測試改為驗證修正後的預覽式（S8，reviewer m-1）：bag 無黑天鵝時預覽不可買，且與 buy 階段 canApply 一致。
 *  - 外部 1 S-1（aiJobId 帶與不帶 RNG 消耗差）：對照規格附錄 A.1 拍板文字，確認實作符合拍板。
 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var selectors = engine.selectors;
var rng = engine.rng;
var data = H.loadData();

/**
 * 保險預覽判斷（S7 修正後 app.js marketItems 的 !interactive 分支）：
 *   cash >= insuranceCost && bagBlackSwanCount > 0
 * UI 層無法從 engine 直接取得，這裡以同一條式子驗證其與 engine 的 BUY_INSURANCE 拒絕條件一致
 * （bag 無黑天鵝 → 預覽不可買，buy 階段 canApply 亦為 false）。若 app.js 的預覽條件再變動，須同步此式。
 */
function insurancePreviewOk(s, pid) {
  return s.players[pid].cash >= data.balance.insuranceCost && selectors.bagBlackSwanCount(s, pid) > 0;
}

test("TRIAGE-E2-insurance-preview-requires-bag-swan-and-matches-canApply", function () {
  var s = H.start(data, { seed: 1, jobId: "j02" }); // draw 階段、現金 100 ≥ 40、bag 有黑天鵝
  assert.equal(s.phase, "draw");
  assert.ok(selectors.bagBlackSwanCount(s, "human") > 0);
  assert.equal(insurancePreviewOk(s, "human"), true, "現金夠且袋中有黑天鵝：預覽顯示「買得起」");

  // 修正後的重點：bag 無黑天鵝（買了 4 份保險之後的狀態）→ 預覽為不可買（.dim），不再只看現金。
  var noSwan = H.patchPlayer(s, "human", { bag: ["income_s", "income_m"] });
  assert.equal(selectors.bagBlackSwanCount(noSwan, "human"), 0);
  assert.equal(insurancePreviewOk(noSwan, "human"), false, "袋中無黑天鵝：預覽不可買");
  // 現金不足同樣不可買。
  var poor = H.patchPlayer(s, "human", { cash: data.balance.insuranceCost - 1 });
  assert.equal(insurancePreviewOk(poor, "human"), false, "現金不足：預覽不可買");

  // 與 engine 一致：進 buy 階段後 canApply 的結果與預覽式相同（三種情境）。
  [s, noSwan, poor].forEach(function (st, i) {
    var sb = engine.reduce(st, { type: "STOP" }, data);
    assert.equal(sb.phase, "buy");
    assert.equal(engine.canApply(sb, { type: "BUY_INSURANCE" }, data), insurancePreviewOk(sb, "human"), "情境 " + i + "：預覽式與 canApply 一致");
  });
  assert.throws(function () { engine.reduce(engine.reduce(noSwan, { type: "STOP" }, data), { type: "BUY_INSURANCE" }, data); }, /REJECT:BUY_INSURANCE:noBlackSwan/);
  // draw 階段 canApply 一律 false（phase），預覽只是預告、不等於可點。
  assert.equal(engine.canApply(s, { type: "BUY_INSURANCE" }, data), false);
});

test("TRIAGE-S1-aiJobId-rng-consumption-matches-appendix-A1", function () {
  var seed = 20260913;
  var withId = engine.reduce(engine.initialState(), { type: "START_GAME", seed: seed, jobId: "j02", difficulty: "normal", aiJobId: "j02" }, data);
  var without = engine.reduce(engine.initialState(), { type: "START_GAME", seed: seed, jobId: "j02", difficulty: "normal" }, data);

  // 事實 1：帶 aiJobId 洗牌只用 n−1 次；不帶多 1 次（先抽職業）。
  var n = data.assets.assets.length;
  var r = rng.seedRng(seed);
  var i;
  for (i = 0; i < n - 1; i++) r = rng.nextInt(r, 2).rng; // 消耗次數只看 s，參數不影響次數
  assert.deepStrictEqual(withId.rng, r, "帶 aiJobId：START_GAME 消耗 " + (n - 1) + " 次 RNG");
  r = rng.nextInt(r, 2).rng;
  assert.deepStrictEqual(without.rng, r, "不帶 aiJobId：消耗 " + n + " 次 RNG");

  // 事實 2：兩者 deck 不同（外部 S-1 描述為真）。
  assert.notDeepStrictEqual(withId.deck, without.deck);

  // 事實 3：不帶時的職業選擇 ＝ 第 1 次 RNG 的結果（附錄 A.1：「1 次 RNG，在洗牌之前」）。
  var pick = rng.nextInt(rng.seedRng(seed), data.jobs.jobs.length);
  assert.equal(without.players.ai.jobId, data.jobs.jobs[pick.value].id);
  assert.equal(without.log[0].aiJobId, without.players.ai.jobId);

  // 事實 4：兩種呼叫各自可重放（同 seed 同參數 → 同 deck）。
  var again = engine.reduce(engine.initialState(), { type: "START_GAME", seed: seed, jobId: "j02", difficulty: "normal" }, data);
  assert.deepStrictEqual(again.deck, without.deck);
});
