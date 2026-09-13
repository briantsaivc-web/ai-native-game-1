"use strict";
/**
 * G4.5 裁決第 7、8 列（外部 2 第 1、2 條）修正後的正式測試（S7）。
 * 原本這裡是「重現問題」的實證測試；修正後改為驗證：
 * - R-26：`TOKEN_DRAWN.amount` ＝ 本顆實際入帳（翻倍後），累加恆等於 pendingIncome；UI 只讀 amount 就能顯示正確金額。
 * - 爆倉提示改為「黑天鵝值再增加 N 點即爆倉」：N ＝ 門檻 − blackSwanCount 在有無 SWAN_RETURN_ONCE 時都成立；
 *   「首次黑天鵝可退回一次（尚未使用）」的顯示條件與 engine 的 swanReturnUsed 一致。
 * 這裡「抄」的只是 app.js 的判斷式本身（純字串／數值運算，不碰 DOM），行號註明，讓第三者可回查是否一致。
 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var selectors = engine.selectors;
var data = H.loadData();

/** 讓 human 在 draw 階段依序「必抽」指定籌碼：每次把 bag 換成只剩該顆再 DRAW（rng 只剩一個候選）。 */
function forceDraws(state, tokenIds) {
  var s = state;
  for (var i = 0; i < tokenIds.length; i++) {
    s = H.patchPlayer(s, "human", { bag: [tokenIds[i]] });
    s = engine.reduce(s, { type: "DRAW" }, data);
  }
  return s;
}

function drawnEvents(state, pid) {
  return state.log.filter(function (e) { return e.type === "TOKEN_DRAWN" && e.player === pid && e.round === state.round; });
}

/* ---- R-26：TOKEN_DRAWN.amount ---- */

/** app.js chipsHtml 的收入籌碼標籤演算法（修正後）：只讀本回合 income 事件的 amount，依序對應 drawn 中的收入籌碼。 */
function uiIncomeChipAmounts(state) {
  var incomes = drawnEvents(state, "human").filter(function (e) {
    var t = selectors.byId(data.tokens.tokens, e.token);
    return t && t.kind === "income";
  });
  var n = 0;
  return state.players.human.drawn.map(function (id) {
    var t = selectors.byId(data.tokens.tokens, id);
    if (t.kind !== "income") return null;
    return { amount: incomes[n].amount, doubled: !!incomes[n++].doubled };
  }).filter(function (v) { return v !== null; });
}

test("T-R-26-token-drawn-amount", function () {
  // (a) 翻倍情境：a09（第三口鍋，NTH_INCOME_DOUBLE param=3），依序抽 income_s、income_s、income_l。
  var s = H.start(data, { seed: 1 });
  s = H.patchPlayer(s, "human", { assets: ["a09"] });
  s = forceDraws(s, ["income_s", "income_s", "income_l"]);
  var ev = drawnEvents(s, "human");
  assert.equal(ev.length, 3);
  assert.deepStrictEqual(ev.map(function (e) { return e.amount; }), [10, 10, 80], "第 3 顆 amount 為翻倍後的 80");
  assert.equal(ev[2].doubled, true, "doubled 欄位保留");
  assert.equal(ev[0].doubled, undefined);
  assert.equal(s.players.human.pendingIncome, 100);
  // UI 顯示：＋10、＋10、＋80（×2），合計 ＝ pendingIncome
  var shown = uiIncomeChipAmounts(s);
  assert.deepStrictEqual(shown, [{ amount: 10, doubled: false }, { amount: 10, doubled: false }, { amount: 80, doubled: true }]);
  var sum = shown.reduce(function (a, b) { return a + b.amount; }, 0);
  assert.equal(sum, s.players.human.pendingIncome, "籌碼顯示合計與暫存收入一致");

  // (b) 非收入籌碼 amount 為 0：黑天鵝、保險籌碼、幸運籌碼、被 SWAN_RETURN_ONCE 退回的黑天鵝。
  var s2 = H.start(data, { seed: 1 });
  s2 = H.patchPlayer(s2, "human", { assets: ["a07"] }); // 老闆娘的好人緣：SWAN_RETURN_ONCE
  s2 = forceDraws(s2, ["blackSwan", "blackSwan", "insurance", "lucky"]); // lucky 放最後：幸運生效時黑天鵝不在候選集
  var ev2 = drawnEvents(s2, "human");
  assert.equal(ev2.length, 4);
  ev2.forEach(function (e) { assert.equal(e.amount, 0, e.token + " 的 amount 應為 0"); });
  assert.equal(s2.players.human.swanReturnUsed, true, "第 1 顆黑天鵝被退回");
  assert.equal(s2.players.human.blackSwanCount, 0, "第 2 顆黑天鵝 +1、保險籌碼 −1");

  // (c) 不變式：整局（AI 對 AI）每筆 TOKEN_DRAWN 都有數值型 amount，且每回合每人 amount 累加 ＝ 該事件的 pendingIncome。
  var seeds = [1, 7, 20260913];
  seeds.forEach(function (seed) {
    var g = H.playGame(data, { seed: seed, aiJobId: null });
    var running = {};
    var seen = 0;
    g.state.log.forEach(function (e) {
      if (e.type === "TOKEN_DRAWN") {
        assert.equal(typeof e.amount, "number", "seed " + seed + " seq " + e.seq + " 缺 amount");
        var key = e.player + ":" + e.round;
        running[key] = (running[key] || 0) + e.amount;
        assert.equal(running[key], e.pendingIncome, "seed " + seed + " seq " + e.seq + " amount 累加 ≠ pendingIncome");
        if (e.doubled) {
          var t = selectors.byId(data.tokens.tokens, e.token);
          assert.equal(e.amount, t.value + t.value, "doubled 時 amount ＝ 面值 ×2");
        }
        seen++;
      }
    });
    assert.ok(seen > 0);
  });
});

/* ---- 第 8 列：爆倉提示改措辭 ---- */

/** app.js statusCard 的提示演算法（修正後）：N ＝ th − blackSwanCount，只說「黑天鵝值再增加 N 點即爆倉」。 */
function uiPointsLeft(state, pid) {
  var th = selectors.threshold(state, pid, data);
  return th - state.players[pid].blackSwanCount;
}
/** app.js statusCard 的退回提示條件（修正後）：持 SWAN_RETURN_ONCE 且 !swanReturnUsed 且未爆倉。 */
function uiShowsSwanReturn(state, pid) {
  var p = state.players[pid];
  return !p.busted && !p.swanReturnUsed && selectors.assetsWithEffect(state, pid, data, "SWAN_RETURN_ONCE").length > 0;
}

test("TRIAGE-EXT2-2-bust-hint-uses-points-not-draws", function () {
  // 持 a07 且未用：提示「再增加 3 點」，並顯示退回可用；第 1 顆黑天鵝退回後 blackSwanCount 仍 0、退回提示消失。
  var s = H.start(data, { seed: 1 });
  s = H.patchPlayer(s, "human", { assets: ["a07"] });
  assert.equal(uiPointsLeft(s, "human"), 3);
  assert.equal(uiShowsSwanReturn(s, "human"), true, "尚未使用 → 顯示「首次黑天鵝可退回一次（尚未使用）」");

  s = forceDraws(s, ["blackSwan"]);
  assert.equal(s.players.human.swanReturnUsed, true);
  assert.equal(s.players.human.blackSwanCount, 0);
  assert.equal(uiPointsLeft(s, "human"), 3, "退回不計數，仍差 3 點");
  assert.equal(uiShowsSwanReturn(s, "human"), false, "用過即不再顯示");

  // 之後每顆黑天鵝 +1 點；提示的 N 每次遞減 1，減到 0 時恰好 busted → 「再增加 N 點即爆倉」的敘述一直為真。
  for (var i = 1; i <= 3; i++) {
    s = forceDraws(s, ["blackSwan"]);
    assert.equal(uiPointsLeft(s, "human"), 3 - i);
    assert.equal(s.players.human.busted, i === 3, "第 " + i + " 顆計數黑天鵝");
  }

  // 對照：無 a07 時不顯示退回提示，點數敘述同樣成立。
  var s2 = H.start(data, { seed: 1 });
  assert.equal(uiShowsSwanReturn(s2, "human"), false);
  for (var j = 1; j <= 3; j++) {
    s2 = forceDraws(s2, ["blackSwan"]);
    assert.equal(uiPointsLeft(s2, "human"), 3 - j);
    assert.equal(s2.players.human.busted, j === 3);
  }
});
