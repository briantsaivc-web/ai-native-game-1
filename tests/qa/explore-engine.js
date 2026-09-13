#!/usr/bin/env node
"use strict";
/**
 * tests/qa/explore-engine.js：QA 探索測試（engine 層邊界）。
 * 執行：node tests/qa/explore-engine.js
 * 每項印出 [E-xx] 名稱 → 結果；不是 node:test，只是證據產生器（qa-tester 只回報不修）。
 */
var path = require("path");
var assert = require("assert");
var H = require(path.join(__dirname, "..", "engine", "helpers"));
var engine = H.engine;
var data = H.loadData();
var reduce = engine.reduce;

var results = [];
function check(id, name, fn) {
  var r = { id: id, name: name, ok: true, note: "" };
  try { r.note = fn() || ""; }
  catch (e) { r.ok = false; r.note = (e && e.message) ? e.message.split("\n")[0] : String(e); }
  results.push(r);
  console.log("[" + id + "] " + (r.ok ? "OK  " : "FAIL") + " " + name + (r.note ? " → " + r.note : ""));
}
function expectReject(fn, prefix) {
  try { fn(); } catch (e) { if (String(e.message).indexOf(prefix) === 0) return e.message; throw e; }
  throw new Error("預期被拒絕（" + prefix + "）但未拋錯");
}
/** 強制把玩家 bag 設成指定內容（測試建情境，不經 action）。 */
function withBag(s, pid, bag) { return H.patchPlayer(s, pid, { bag: bag }); }

// E-01 seed=0
check("E-01", "seed=0 可開局且可重放", function () {
  var a = H.playGame(data, { seed: 0, aiJobId: null });
  var b = H.playGame(data, { seed: 0, aiJobId: null });
  assert.deepStrictEqual(a.state, b.state);
  assert.strictEqual(a.state.seed, 0);
  return "winner=" + a.state.winner + "、actions=" + a.actions.length + "、log=" + a.state.log.length;
});

// E-02 seed=4294967295
check("E-02", "seed=4294967295（uint32 上限）可開局且可重放", function () {
  var a = H.playGame(data, { seed: 4294967295, aiJobId: null });
  var b = H.playGame(data, { seed: 4294967295, aiJobId: null });
  assert.deepStrictEqual(a.state, b.state);
  assert.strictEqual(a.state.seed, 4294967295);
  return "winner=" + a.state.winner + "、actions=" + a.actions.length;
});

// E-03 seed 超界／非數字：engine 是否靜默轉換
check("E-03", "seed=4294967296／-1／'abc'／undefined 時 engine 行為（>>>0 轉換）", function () {
  var s0 = H.start(data, { seed: 4294967296 });
  var s1 = H.start(data, { seed: 0 });
  var sNeg = H.start(data, { seed: -1 });
  var sStr = H.start(data, { seed: "abc" });
  var sUndef = H.start(data, { seed: undefined });
  var notes = [];
  notes.push("4294967296→seed=" + s0.seed + (JSON.stringify(s0.deck) === JSON.stringify(s1.deck) ? "（deck 同 seed 0）" : ""));
  notes.push("-1→seed=" + sNeg.seed);
  notes.push("'abc'→seed=" + sStr.seed);
  notes.push("undefined→seed=" + sUndef.seed);
  return notes.join("；") + "。engine 不驗證 seed 範圍，靜默轉 uint32（UI 層已擋，engine 直接呼叫時無提示）";
});

// E-04 袋子只剩黑天鵝 ＋ 幸運生效 → DRAW 被拒；袋子完全空 → DRAW 被拒
check("E-04", "袋子只剩黑天鵝且幸運生效／袋子全空時 DRAW 被拒、STOP 可用", function () {
  var s = H.start(data, { seed: 1 });
  s = H.patchPlayer(s, "human", { bag: ["blackSwan", "blackSwan"], luckyActive: true });
  var m1 = expectReject(function () { reduce(s, { type: "DRAW" }, data); }, "REJECT:DRAW:noCandidates");
  assert.strictEqual(engine.canApply(s, { type: "STOP" }, data), true);
  var s2 = H.patchPlayer(s, "human", { bag: [], luckyActive: false, drawn: ["income_s"] });
  var m2 = expectReject(function () { reduce(s2, { type: "DRAW" }, data); }, "REJECT:DRAW:noCandidates");
  assert.strictEqual(engine.canApply(s2, { type: "STOP" }, data), true);
  // AI 同情境：decideAi 回 STOP noCandidates
  var sa = H.patchState(s2, { currentPlayer: "ai" });
  sa = H.patchPlayer(sa, "ai", { bag: [], drawn: ["income_s"] });
  var d = engine.decideAi(sa, data);
  assert.strictEqual(d.action.type, "STOP");
  assert.strictEqual(d.reason, "noCandidates");
  return m1 + "；" + m2 + "；AI→STOP(noCandidates)";
});

// E-05 市場 12 張全買光
check("E-05", "12 張全買光後：market/deck 皆空、BUY_ASSET 拒絕、AI 走 END_TURN 或保險、補市場不炸", function () {
  var s = H.start(data, { seed: 1 });
  // 兩人輪流把牌買光：直接建情境（不經 action）——human 持 6 張、ai 持 6 張。
  var ids = data.assets.assets.map(function (c) { return c.id; });
  s = H.patchState(s, { market: [], deck: [], phase: "buy" });
  s = H.patchPlayer(s, "human", { assets: ids.slice(0, 6), cash: 999 });
  s = H.patchPlayer(s, "ai", { assets: ids.slice(6), cash: 999 });
  var m = expectReject(function () { reduce(s, { type: "BUY_ASSET", cardId: "a01" }, data); }, "REJECT:BUY_ASSET:notInMarket");
  var s2 = reduce(s, { type: "END_TURN" }, data); // human → ai，補市場（空）
  assert.deepStrictEqual(s2.market, []);
  assert.strictEqual(s2.log[s2.log.length - 1].type, "MARKET_REFILLED");
  var s3 = reduce(s2, { type: "STOP" }, data);
  var d = engine.decideAi(s3, data);
  assert.ok(d.action.type === "END_TURN" || d.action.type === "BUY_INSURANCE");
  var inv2 = s3.market.length + s3.deck.length + s3.players.human.assets.length + s3.players.ai.assets.length;
  assert.strictEqual(inv2, 12);
  return m + "；AI 決策=" + d.action.type + "(" + d.reason + ")；INV-2=" + inv2;
});

// E-06 現金剛好等於卡價
check("E-06", "現金剛好等於卡價可買，買後現金 0；少 1 元則拒絕", function () {
  var s = H.start(data, { seed: 1 });
  s = reduce(s, { type: "STOP" }, data);
  var cardId = s.market[0];
  var card = engine.selectors.byId(data.assets.assets, cardId);
  var sx = H.patchPlayer(s, "human", { cash: card.cost });
  var s2 = reduce(sx, { type: "BUY_ASSET", cardId: cardId }, data);
  assert.strictEqual(s2.players.human.cash, 0);
  var sy = H.patchPlayer(s, "human", { cash: card.cost - 1 });
  var m = expectReject(function () { reduce(sy, { type: "BUY_ASSET", cardId: cardId }, data); }, "REJECT:BUY_ASSET:insufficientCash");
  // 保險：現金剛好 40
  var sz = H.patchPlayer(s, "human", { cash: data.balance.insuranceCost });
  var s3 = reduce(sz, { type: "BUY_INSURANCE" }, data);
  assert.strictEqual(s3.players.human.cash, 0);
  return card.id + " cost=" + card.cost + " → cash 0；" + m + "；保險剛好 40 → cash 0";
});

// E-07 連按兩次 STOP／NEXT_ROUND／END_TURN
check("E-07", "重複送 STOP／END_TURN／NEXT_ROUND／START_GAME 第二次一律拒絕且 state 不變", function () {
  var s = H.start(data, { seed: 1 });
  var s1 = reduce(s, { type: "STOP" }, data);
  var m1 = expectReject(function () { reduce(s1, { type: "STOP" }, data); }, "REJECT:STOP:phase");
  var s2 = reduce(s1, { type: "END_TURN" }, data);
  var m2 = expectReject(function () { reduce(s2, { type: "END_TURN" }, data); }, "REJECT:END_TURN:phase");
  var m3 = expectReject(function () { reduce(s2, { type: "NEXT_ROUND" }, data); }, "REJECT:NEXT_ROUND:phase");
  var m4 = expectReject(function () { reduce(s2, { type: "START_GAME", seed: 1, jobId: "j01", difficulty: "easy" }, data); }, "REJECT:START_GAME:phase");
  var m5 = expectReject(function () { reduce(s, { type: "AI_TURN" }, data); }, "REJECT:AI_TURN:notAiTurn");
  var m6 = expectReject(function () { reduce(s, { type: "NOPE" }, data); }, "REJECT:NOPE:unknownAction");
  var m7 = expectReject(function () { reduce(s, null, data); }, "REJECT:UNKNOWN:noType");
  return [m1, m2, m3, m4, m5, m6, m7].join("；");
});

// E-08 保險買到袋中黑天鵝為 0
check("E-08", "連續買保險直到袋中黑天鵝 0，再買被拒；INV-1 bag 每次 −1", function () {
  var s = H.start(data, { seed: 1, jobId: "j01" }); // j01 有 3 顆黑天鵝
  s = H.patchPlayer(s, "human", { cash: 1000 });
  var n = 0;
  while (true) {
    s = reduce(s, { type: "STOP" }, data);
    if (!engine.canApply(s, { type: "BUY_INSURANCE" }, data)) break;
    var before = s.players.human.bag.length;
    s = reduce(s, { type: "BUY_INSURANCE" }, data);
    assert.strictEqual(s.players.human.bag.length, before - 1);
    n++;
    s = reduce(s, { type: "END_TURN" }, data);
    while (s.currentPlayer === "ai" && (s.phase === "draw" || s.phase === "buy")) s = reduce(s, { type: "AI_TURN" }, data);
    s = reduce(s, { type: "NEXT_ROUND" }, data);
  }
  var m = expectReject(function () { reduce(s, { type: "BUY_INSURANCE" }, data); }, "REJECT:BUY_INSURANCE:noBlackSwan");
  assert.strictEqual(engine.selectors.bagBlackSwanCount(s, "human"), 0);
  return "買了 " + n + " 次後袋中黑天鵝 0；" + m;
});

// E-09 爆倉後（黑天鵝都在 drawn）保險不可買
check("E-09", "爆倉當回合：黑天鵝全在 drawn，BUY_INSURANCE 因只看 bag 而被拒（規格 R-09 行為，設計待辦）", function () {
  var s = H.start(data, { seed: 1, jobId: "j01" });
  s = H.patchPlayer(s, "human", { bag: ["blackSwan", "blackSwan", "blackSwan"], cash: 1000 });
  s = reduce(s, { type: "DRAW" }, data); s = reduce(s, { type: "DRAW" }, data); s = reduce(s, { type: "DRAW" }, data);
  assert.strictEqual(s.players.human.busted, true);
  assert.strictEqual(s.phase, "buy");
  var m = expectReject(function () { reduce(s, { type: "BUY_INSURANCE" }, data); }, "REJECT:BUY_INSURANCE:noBlackSwan");
  return m + "（drawn 含 3 顆黑天鵝、bag 0 顆）";
});

// E-10 完整重放（含 AI 隨機職業）三難度三職業
check("E-10", "同 seed 完整重放（aiJobId 隨機、三難度×三職業×5 seed）最終 state deepStrictEqual", function () {
  var n = 0;
  ["easy", "normal", "hard"].forEach(function (d) {
    ["j01", "j02", "j03"].forEach(function (j) {
      for (var seed = 100; seed < 105; seed++) {
        var a = H.playGame(data, { seed: seed, jobId: j, difficulty: d, aiJobId: null });
        var b = H.applyAll(H.start(data, { seed: seed, jobId: j, difficulty: d, aiJobId: null }), a.actions, data);
        assert.deepStrictEqual(a.state, b);
        n++;
      }
    });
  });
  return n + " 局全部一致";
});

// E-11 gameOver 後任何 action 皆拒
check("E-11", "gameOver 後 DRAW/STOP/NEXT_ROUND/AI_TURN/END_TURN 全拒絕", function () {
  var g = H.playGame(data, { seed: 7 });
  var s = g.state;
  assert.strictEqual(s.phase, "gameOver");
  var out = ["DRAW", "STOP", "NEXT_ROUND", "AI_TURN", "END_TURN", "BUY_INSURANCE"].map(function (t) {
    return expectReject(function () { reduce(s, { type: t }, data); }, "REJECT:" + t);
  });
  assert.strictEqual(s.round, data.balance.rounds);
  return out.join("；");
});

// E-12 門檻 +1 疊加 ＋ 黑天鵝退回 ＋ 保險籌碼在 0 時抵銷不變負
check("E-12", "THRESHOLD_PLUS 疊加（假設兩張）、SWAN_RETURN_ONCE 後第二顆計數、insurance 籌碼在 0 時不變負", function () {
  var s = H.start(data, { seed: 1 });
  s = H.patchPlayer(s, "human", { assets: ["a10", "a10", "a07"], bag: ["blackSwan", "blackSwan", "blackSwan", "blackSwan", "blackSwan"] });
  assert.strictEqual(engine.selectors.threshold(s, "human", data), data.balance.blackSwanThreshold + 2);
  s = reduce(s, { type: "DRAW" }, data); // 第 1 顆退回
  assert.strictEqual(s.players.human.blackSwanCount, 0);
  assert.strictEqual(s.players.human.swanReturnUsed, true);
  assert.strictEqual(s.players.human.bag.length, 5);
  s = reduce(s, { type: "DRAW" }, data);
  assert.strictEqual(s.players.human.blackSwanCount, 1);
  // insurance 籌碼在 0 時
  var t = H.start(data, { seed: 1 });
  t = H.patchPlayer(t, "human", { bag: ["insurance"] });
  t = reduce(t, { type: "DRAW" }, data);
  assert.strictEqual(t.players.human.blackSwanCount, 0);
  return "門檻=5、退回後 count 0/bag 5、第二顆 count 1；insurance 在 0 → 0";
});

// E-13 爆倉時 pendingIncome 為奇數／0
check("E-13", "爆倉 pendingIncome=0 → 入帳 0；pendingIncome=30 → floor(15)；現金不減", function () {
  var s = H.start(data, { seed: 1, jobId: "j01" });
  s = H.patchPlayer(s, "human", { bag: ["blackSwan", "blackSwan", "blackSwan"], cash: 80 });
  s = H.applyAll(s, [{ type: "DRAW" }, { type: "DRAW" }, { type: "DRAW" }], data);
  assert.strictEqual(s.players.human.cash, 80);
  var t = H.start(data, { seed: 1, jobId: "j01" });
  t = H.patchPlayer(t, "human", { bag: ["blackSwan", "blackSwan", "blackSwan"], pendingIncome: 30, cash: 80 });
  t = H.applyAll(t, [{ type: "DRAW" }, { type: "DRAW" }, { type: "DRAW" }], data);
  assert.strictEqual(t.players.human.cash, 95);
  return "0→cash 80；30→cash 95（+15）";
});

// E-14 0 顆就停手（含 STOP_BONUS）
check("E-14", "翻 0 顆直接 STOP 合法；持 a08 時仍拿 +15（規格 R-17 未排除，設計待辦）", function () {
  var s = H.start(data, { seed: 1 });
  var s1 = reduce(s, { type: "STOP" }, data);
  assert.strictEqual(s1.phase, "buy");
  var t = H.patchPlayer(s, "human", { assets: ["a08"], cash: 100 });
  var t1 = reduce(t, { type: "STOP" }, data);
  return "0 顆 STOP 可行；持收銀機 0 顆停手 cash 100→" + t1.players.human.cash;
});

// E-15 R-18～R-20 補驗（規格測試名缺席，QA 自驗）
check("E-15", "R-18 decideAi 純函數：同 state 兩次結果 deepEqual、不修改輸入（deepFreeze）", function () {
  var s = H.start(data, { seed: 3 });
  s = H.applyAll(s, [{ type: "STOP" }, { type: "END_TURN" }], data);
  H.deepFreeze(s); H.deepFreeze(data);
  var a = engine.decideAi(s, data), b = engine.decideAi(s, data);
  assert.deepStrictEqual(a, b);
  return JSON.stringify(a);
});
check("E-16", "R-19 AI 停手規則：swanStop（門檻−offset）／incomeStop／push，三難度", function () {
  var out = [];
  ["easy", "normal", "hard"].forEach(function (d) {
    var p = data.balance.ai[d];
    var s = H.start(data, { seed: 3, difficulty: d });
    s = H.applyAll(s, [{ type: "STOP" }, { type: "END_TURN" }], data);
    var th = engine.selectors.threshold(s, "ai", data);
    var sw = H.patchPlayer(s, "ai", { blackSwanCount: th - p.swanStopOffset, pendingIncome: 0 });
    assert.strictEqual(engine.decideAi(sw, data).reason, "swanStop");
    var sw2 = H.patchPlayer(s, "ai", { blackSwanCount: th - p.swanStopOffset - 1, pendingIncome: p.incomeStop });
    assert.strictEqual(engine.decideAi(sw2, data).reason, "incomeStop");
    var sw3 = H.patchPlayer(s, "ai", { blackSwanCount: th - p.swanStopOffset - 1, pendingIncome: p.incomeStop - 1 });
    assert.strictEqual(engine.decideAi(sw3, data).reason, "push");
    out.push(d + " ok");
  });
  return out.join("、");
});
check("E-17", "R-20 AI 購買：買得起最貴（同價取索引小）；買不起→normal/hard 買保險、easy 不買；無黑天鵝→END_TURN", function () {
  var s = H.start(data, { seed: 3 });
  s = H.applyAll(s, [{ type: "STOP" }, { type: "END_TURN" }, { type: "AI_TURN" }], data);
  // 讓 AI 進 buy：強制 phase
  s = H.patchState(s, { phase: "buy", market: ["a06", "a11", "a02"] }); // cost 140, 200, 70
  var s1 = H.patchPlayer(s, "ai", { cash: 150 });
  assert.strictEqual(engine.decideAi(s1, data).action.cardId, "a06");
  var s2 = H.patchState(s1, { market: ["a07", "a06"] }); // a07 150, a06 140
  assert.strictEqual(engine.decideAi(s2, data).action.cardId, "a07");
  var s2b = H.patchState(s1, { market: ["a06", "a07"] }); s2b = H.patchPlayer(s2b, "ai", { cash: 150 });
  assert.strictEqual(engine.decideAi(s2b, data).action.cardId, "a07"); // 最貴
  var s2c = H.patchState(s1, { market: ["a11", "a11"] }); // 同價（人工），取索引 0
  var d2c = engine.decideAi(H.patchPlayer(s2c, "ai", { cash: 200 }), data);
  assert.strictEqual(d2c.action.cardId, "a11");
  var s3 = H.patchPlayer(s, "ai", { cash: 50 });
  assert.strictEqual(engine.decideAi(s3, data).reason, "insuranceFallback");
  var s4 = H.patchState(s3, { difficulty: "easy" });
  assert.strictEqual(engine.decideAi(s4, data).reason, "nothingToBuy");
  var s5 = H.patchPlayer(s3, "ai", { bag: ["income_s"] });
  assert.strictEqual(engine.decideAi(s5, data).reason, "nothingToBuy");
  var s6 = H.patchState(s3, { purchasedThisTurn: true });
  assert.strictEqual(engine.decideAi(s6, data).reason, "done");
  return "全部符合 §7";
});

// E-18 平手
check("E-18", "平手：兩人淨資產相同 → winner=tie", function () {
  var s = H.start(data, { seed: 1 });
  s = H.patchState(s, { round: data.balance.rounds, phase: "roundEnd" });
  s = H.patchPlayer(s, "human", { cash: 100, assets: [] });
  s = H.patchPlayer(s, "ai", { cash: 100, assets: [] });
  var g = reduce(s, { type: "NEXT_ROUND" }, data);
  assert.strictEqual(g.winner, "tie");
  return "winner=tie";
});

// E-19 大量回合 stress：seed 1..300 三難度，每步檢查不變式
check("E-19", "seed 1–300 × 三難度 AI 對 AI，每步驗 INV-2／INV-3／INV-4，無例外", function () {
  var games = 0, steps = 0;
  ["easy", "normal", "hard"].forEach(function (d) {
    for (var seed = 1; seed <= 300; seed++) {
      H.playGame(data, { seed: seed, difficulty: d, aiJobId: null, jobId: ["j01", "j02", "j03"][seed % 3], onStep: function (b, a, s) {
        steps++;
        var inv2 = s.market.length + s.deck.length + s.players.human.assets.length + s.players.ai.assets.length;
        if (inv2 !== 12) throw new Error("INV-2 破：" + inv2);
        ["human", "ai"].forEach(function (p) {
          if (s.players[p].cash < 0 || s.players[p].pendingIncome < 0 || s.players[p].blackSwanCount < 0) throw new Error("INV-3 破");
        });
        for (var i = 0; i < s.log.length; i++) if (s.log[i].seq !== i + 1) throw new Error("INV-4 破");
        if (s.phase === "draw" && s.purchasedThisTurn) throw new Error("INV-5 破");
      } });
      games++;
    }
  });
  return games + " 局、" + steps + " 步";
});

// E-20 R-26：amount 累加 = pendingIncome（隨機 50 局）
check("E-20", "R-26 每回合 TOKEN_DRAWN.amount 累加 ＝ 該回合最後 pendingIncome（seed 1–50）", function () {
  var checked = 0;
  for (var seed = 1; seed <= 50; seed++) {
    var g = H.playGame(data, { seed: seed, aiJobId: null });
    var sum = {}, last = {};
    g.state.log.forEach(function (e) {
      if (e.type !== "TOKEN_DRAWN") return;
      var k = e.round + ":" + e.player;
      sum[k] = (sum[k] || 0) + e.amount;
      last[k] = e.pendingIncome;
    });
    Object.keys(sum).forEach(function (k) { if (sum[k] !== last[k]) throw new Error(k + " sum " + sum[k] + " ≠ " + last[k]); checked++; });
  }
  return checked + " 個玩家回合一致";
});

var fails = results.filter(function (r) { return !r.ok; });
console.log("\n合計 " + results.length + " 項，失敗 " + fails.length + " 項");
process.exit(fails.length ? 1 : 0);
