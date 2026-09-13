"use strict";
/** T-R-01～T-R-17、T-R-22～T-R-24：規格 §5 規則條文（勝負、翻牌、購買、收袋、特殊籌碼、改規則資產）。 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var sel = engine.selectors;
var data = H.loadData();
var B = data.balance;

function tokenValue(id) { return sel.byId(data.tokens.tokens, id).value; }
function card(id) { return sel.byId(data.assets.assets, id); }
function lastLog(s, type) {
  for (var i = s.log.length - 1; i >= 0; i--) if (s.log[i].type === type) return s.log[i];
  return null;
}
function countLog(s, type) { return s.log.filter(function (e) { return e.type === type; }).length; }

/** 人類回合 draw 階段的基準 state（固定 aiJobId 以便對照）。 */
function drawState(patch) {
  var s = H.start(data, { seed: 1 });
  return patch ? H.patchPlayer(s, "human", patch) : s;
}
/** 人類回合 buy 階段的基準 state。 */
function buyState(patch) {
  var s = engine.reduce(H.start(data, { seed: 1 }), { type: "STOP" }, data);
  return patch ? H.patchPlayer(s, "human", patch) : s;
}

/* ---------- 5.1 勝負 ---------- */

test("T-R-01-fixed-rounds", function () {
  [1, 2, 3].forEach(function (seed) {
    var g = H.playGame(data, { seed: seed, aiJobId: null });
    assert.equal(g.state.round, B.rounds, "gameOver 時 round 停在 balance.rounds");
    assert.equal(countLog(g.state, "ROUND_ENDED"), B.rounds, "恰好 rounds 次 ROUND_ENDED");
    assert.equal(countLog(g.state, "GAME_OVER"), 1);
    assert.equal(g.state.phase, "gameOver");
  });
  // 未到最後一回合的 NEXT_ROUND 只加 1，不會提前結束
  var s = H.playGame(data, { seed: 5, aiJobId: null, onStep: function () {} });
  var rounds = s.state.log.filter(function (e) { return e.type === "ROUND_ENDED"; }).map(function (e) { return e.round; });
  assert.deepEqual(rounds, Array.from({ length: B.rounds }, function (_, i) { return i + 1; }));
});

test("T-R-02-winner-by-networth", function () {
  var base = H.start(data, { seed: 1 });
  var re = H.patchState(base, { phase: "roundEnd", currentPlayer: "ai", round: B.rounds });
  var humanWins = H.patchPlayer(re, "human", { cash: 500 });
  var s1 = engine.reduce(humanWins, { type: "NEXT_ROUND" }, data);
  assert.equal(s1.phase, "gameOver");
  assert.equal(s1.winner, "human");
  assert.equal(lastLog(s1, "GAME_OVER").winner, "human");
  // 資產面值算進淨資產：ai 現金少但持有 a12（value 320）
  var aiWins = H.patchPlayer(H.patchPlayer(re, "human", { cash: 300 }), "ai", { cash: 50, assets: ["a12"] });
  var s2 = engine.reduce(aiWins, { type: "NEXT_ROUND" }, data);
  assert.equal(s2.winner, "ai");
  assert.deepEqual(lastLog(s2, "GAME_OVER").netWorth, { human: 300, ai: 50 + card("a12").value });
});

test("T-R-02-tie", function () {
  var base = H.start(data, { seed: 1 });
  var re = H.patchState(base, { phase: "roundEnd", currentPlayer: "ai", round: B.rounds });
  var s = engine.reduce(re, { type: "NEXT_ROUND" }, data);
  assert.equal(s.winner, "tie");
  assert.equal(s.phase, "gameOver");
});

test("T-R-03-networth-formula", function () {
  var s = H.patchPlayer(H.start(data, { seed: 1 }), "human", { cash: 70, assets: ["a01", "a11"], pendingIncome: 999 });
  assert.equal(sel.netWorth(s, "human", data), 70 + card("a01").value + card("a11").value, "pendingIncome 不算");
});

/* ---------- 5.2 翻牌 ---------- */

test("T-R-04-draw-phase-actions", function () {
  var s = drawState();
  assert.equal(s.phase, "draw");
  assert.ok(engine.canApply(s, { type: "DRAW" }, data));
  assert.ok(engine.canApply(s, { type: "STOP" }, data));
  [{ type: "BUY_ASSET", cardId: s.market[0] }, { type: "BUY_INSURANCE" }, { type: "END_TURN" }, { type: "NEXT_ROUND" }]
    .forEach(function (a) {
      assert.equal(engine.canApply(s, a, data), false, a.type + " 在 draw 階段不可用");
      assert.throws(function () { engine.reduce(s, a, data); }, new RegExp("^Error: REJECT:" + a.type + ":"));
    });
  // 人類回合送 AI_TURN 也拒絕
  assert.throws(function () { engine.reduce(s, { type: "AI_TURN" }, data); }, /REJECT:AI_TURN:/);
  // 未知 action
  assert.throws(function () { engine.reduce(s, { type: "FOO" }, data); }, /REJECT:FOO:unknownAction/);
});

test("T-R-05-income-token", function () {
  ["income_s", "income_m", "income_l"].forEach(function (id) {
    var s = engine.reduce(drawState({ bag: [id] }), { type: "DRAW" }, data);
    assert.equal(s.players.human.pendingIncome, tokenValue(id));
    assert.deepEqual(s.players.human.drawn, [id]);
    var ev = lastLog(s, "TOKEN_DRAWN");
    assert.equal(ev.token, id);
    assert.equal(ev.pendingIncome, tokenValue(id));
    assert.equal(ev.blackSwanCount, 0);
    assert.equal(ev.doubled, undefined);
  });
});

test("T-R-06-blackswan-token", function () {
  var s = engine.reduce(drawState({ bag: ["blackSwan"] }), { type: "DRAW" }, data);
  assert.equal(s.players.human.blackSwanCount, 1);
  assert.equal(s.players.human.pendingIncome, 0);
  assert.equal(s.phase, "draw", "未達門檻不爆倉");
  assert.deepEqual(s.players.human.drawn, ["blackSwan"]);
});

test("T-R-07-bust-halves", function () {
  var pending = 50;
  var s0 = drawState({ bag: ["blackSwan"], blackSwanCount: B.blackSwanThreshold - 1, pendingIncome: pending, cash: 100 });
  var s = engine.reduce(s0, { type: "DRAW" }, data);
  assert.equal(s.players.human.busted, true);
  assert.equal(s.phase, "buy");
  assert.equal(s.players.human.cash, 100 + Math.floor(pending * B.bustKeepRatio));
  assert.equal(s.players.human.blackSwanCount, B.blackSwanThreshold);
  var bust = lastLog(s, "BUST");
  assert.deepEqual({ pendingBefore: bust.pendingBefore, settled: bust.settled }, { pendingBefore: pending, settled: Math.floor(pending * B.bustKeepRatio) });
  var settled = lastLog(s, "INCOME_SETTLED");
  assert.equal(settled.amount, Math.floor(pending * B.bustKeepRatio));
  assert.equal(settled.cashAfter, s.players.human.cash);
  // 奇數暫存收入取 floor
  var s2 = engine.reduce(drawState({ bag: ["blackSwan"], blackSwanCount: B.blackSwanThreshold - 1, pendingIncome: 15, cash: 0 }), { type: "DRAW" }, data);
  assert.equal(s2.players.human.cash, Math.floor(15 * B.bustKeepRatio));
});

test("T-R-07-bust-never-negative", function () {
  var s = engine.reduce(drawState({ bag: ["blackSwan"], blackSwanCount: B.blackSwanThreshold - 1, pendingIncome: 0, cash: 100 }), { type: "DRAW" }, data);
  assert.equal(s.players.human.busted, true);
  assert.equal(s.players.human.cash, 100, "既有現金不減");
  assert.ok(s.players.human.cash >= 0);
});

test("T-R-23-empty-bag-rejects-draw", function () {
  var empty = drawState({ bag: [] });
  assert.equal(engine.canApply(empty, { type: "DRAW" }, data), false);
  assert.throws(function () { engine.reduce(empty, { type: "DRAW" }, data); }, /REJECT:DRAW:noCandidates/);
  assert.ok(engine.canApply(empty, { type: "STOP" }, data), "只能 STOP");
  var onlySwan = drawState({ bag: ["blackSwan", "blackSwan"], luckyActive: true });
  assert.equal(engine.canApply(onlySwan, { type: "DRAW" }, data), false, "幸運生效且袋中只剩黑天鵝");
  assert.deepEqual(sel.candidates(onlySwan, "human"), []);
});

/* ---------- 5.3 購買 ---------- */

test("T-R-08-buy-asset-adds-tokens", function () {
  var s0 = buyState({ cash: 500 });
  var id = s0.market[0];
  var c = card(id);
  var bagBefore = s0.players.human.bag;
  var s = engine.reduce(s0, { type: "BUY_ASSET", cardId: id }, data);
  assert.equal(s.players.human.cash, 500 - c.cost);
  assert.deepEqual(s.players.human.assets, [id]);
  assert.deepEqual(s.players.human.bag, bagBefore.concat(c.tokensAdded), "tokensAdded 立即加入 bag 尾端");
  assert.equal(s.market.indexOf(id), -1);
  assert.equal(s.market.length, B.marketSize - 1, "不立即補市場");
  assert.equal(s.deck.length, s0.deck.length);
  assert.equal(s.purchasedThisTurn, true);
  var ev = lastLog(s, "ASSET_BOUGHT");
  assert.deepEqual({ cardId: ev.cardId, cost: ev.cost, tokensAdded: ev.tokensAdded }, { cardId: id, cost: c.cost, tokensAdded: c.tokensAdded });
  // 本回合仍在 buy 階段，tokensAdded 不會被翻到（無法 DRAW）
  assert.equal(engine.canApply(s, { type: "DRAW" }, data), false);
  // 不在市場的卡拒絕
  var notInMarket = s0.deck[0];
  assert.throws(function () { engine.reduce(s0, { type: "BUY_ASSET", cardId: notInMarket }, data); }, /REJECT:BUY_ASSET:notInMarket/);
});

test("T-R-09-insurance-removes-swan", function () {
  var s0 = buyState({ cash: 100, bag: ["income_s", "blackSwan", "income_m", "blackSwan"], drawn: ["blackSwan"] });
  var s = engine.reduce(s0, { type: "BUY_INSURANCE" }, data);
  assert.equal(s.players.human.cash, 100 - B.insuranceCost);
  assert.deepEqual(s.players.human.bag, ["income_s", "income_m", "blackSwan"], "移除索引最小的 blackSwan");
  assert.deepEqual(s.players.human.drawn, ["blackSwan"], "drawn 不受影響");
  assert.equal(s.purchasedThisTurn, true);
  var ev = lastLog(s, "INSURANCE_BOUGHT");
  assert.deepEqual({ cost: ev.cost, bagBlackSwanAfter: ev.bagBlackSwanAfter }, { cost: B.insuranceCost, bagBlackSwanAfter: 1 });
  // 永久：END_TURN 後 bag 只剩 drawn 回來的那顆黑天鵝與原有一顆
  var after = engine.reduce(s, { type: "END_TURN" }, data);
  assert.equal(sel.bagBlackSwanCount(after, "human"), 2);
});

test("T-R-09-insurance-reject-no-swan", function () {
  // bag 無 blackSwan（drawn 有也不算）
  var s0 = buyState({ cash: 100, bag: ["income_s", "income_m"], drawn: ["blackSwan", "blackSwan"] });
  assert.equal(engine.canApply(s0, { type: "BUY_INSURANCE" }, data), false);
  assert.throws(function () { engine.reduce(s0, { type: "BUY_INSURANCE" }, data); }, /REJECT:BUY_INSURANCE:noBlackSwan/);
});

test("T-R-22-one-purchase-per-turn", function () {
  var s0 = buyState({ cash: 1000 });
  var afterAsset = engine.reduce(s0, { type: "BUY_ASSET", cardId: s0.market[0] }, data);
  assert.throws(function () { engine.reduce(afterAsset, { type: "BUY_ASSET", cardId: afterAsset.market[0] }, data); }, /REJECT:BUY_ASSET:alreadyPurchased/);
  assert.throws(function () { engine.reduce(afterAsset, { type: "BUY_INSURANCE" }, data); }, /REJECT:BUY_INSURANCE:alreadyPurchased/);
  var afterIns = engine.reduce(s0, { type: "BUY_INSURANCE" }, data);
  assert.throws(function () { engine.reduce(afterIns, { type: "BUY_ASSET", cardId: afterIns.market[0] }, data); }, /REJECT:BUY_ASSET:alreadyPurchased/);
  assert.throws(function () { engine.reduce(afterIns, { type: "BUY_INSURANCE" }, data); }, /REJECT:BUY_INSURANCE:alreadyPurchased/);
  // END_TURN 後旗標歸零
  assert.equal(engine.reduce(afterIns, { type: "END_TURN" }, data).purchasedThisTurn, false);
});

test("T-R-24-insufficient-cash", function () {
  var s0 = buyState({ cash: 0 });
  var id = s0.market[0];
  assert.throws(function () { engine.reduce(s0, { type: "BUY_ASSET", cardId: id }, data); }, /REJECT:BUY_ASSET:insufficientCash/);
  assert.throws(function () { engine.reduce(s0, { type: "BUY_INSURANCE" }, data); }, /REJECT:BUY_INSURANCE:insufficientCash/);
  assert.equal(s0.players.human.cash, 0, "現金不變");
  // 剛好等於價格可買
  var exact = H.patchPlayer(s0, "human", { cash: card(id).cost });
  assert.equal(engine.reduce(exact, { type: "BUY_ASSET", cardId: id }, data).players.human.cash, 0);
  var exactIns = H.patchPlayer(s0, "human", { cash: B.insuranceCost });
  assert.equal(engine.reduce(exactIns, { type: "BUY_INSURANCE" }, data).players.human.cash, 0);
});

test("T-R-11-market-refill", function () {
  var s0 = H.start(data, { seed: 3 });
  assert.equal(s0.market.length, B.marketSize, "開局補滿");
  assert.equal(s0.deck.length, data.assets.assets.length - B.marketSize);
  // 人類買一張 → 市場 2 張 → END_TURN 換 AI 時補回 3 張，且來自 deck 頂端
  var s1 = engine.reduce(H.patchPlayer(engine.reduce(s0, { type: "STOP" }, data), "human", { cash: 1000 }), { type: "BUY_ASSET", cardId: s0.market[1] }, data);
  assert.equal(s1.market.length, B.marketSize - 1);
  var top = s1.deck[0];
  var s2 = engine.reduce(s1, { type: "END_TURN" }, data);
  assert.equal(s2.currentPlayer, "ai");
  assert.equal(s2.market.length, B.marketSize);
  assert.equal(s2.market[B.marketSize - 1], top, "補進來的是 deck 頂端");
  assert.equal(s2.deck.length, s1.deck.length - 1);
  var ev = lastLog(s2, "MARKET_REFILLED");
  assert.deepEqual(ev.market, s2.market);
  assert.equal(ev.player, "ai");
  // AI 買一張 → roundEnd → NEXT_ROUND 時補回
  var s3 = engine.reduce(engine.reduce(H.patchPlayer(s2, "ai", { cash: 1000 }), { type: "STOP" }, data), { type: "BUY_ASSET", cardId: s2.market[0] }, data);
  var s4 = engine.reduce(s3, { type: "END_TURN" }, data);
  assert.equal(s4.phase, "roundEnd");
  assert.equal(s4.market.length, B.marketSize - 1, "roundEnd 前不補");
  var s5 = engine.reduce(s4, { type: "NEXT_ROUND" }, data);
  assert.equal(s5.market.length, B.marketSize);
  assert.equal(s5.round, 2);
  assert.equal(s5.currentPlayer, "human");
});

test("T-R-11-market-short-when-deck-empty", function () {
  var s0 = engine.reduce(H.start(data, { seed: 3 }), { type: "STOP" }, data);
  var s1 = H.patchState(H.patchPlayer(s0, "human", { cash: 1000 }), { deck: [] });
  var s2 = engine.reduce(s1, { type: "BUY_ASSET", cardId: s1.market[0] }, data);
  var s3 = engine.reduce(s2, { type: "END_TURN" }, data);
  assert.equal(s3.market.length, B.marketSize - 1, "deck 空時允許少於 marketSize");
  assert.deepEqual(s3.deck, []);
  // 市場全空也能正常進行：AI 回合 STOP 後只能 END_TURN
  var s4 = H.patchState(s3, { market: [] });
  var s5 = engine.reduce(s4, { type: "STOP" }, data);
  assert.equal(engine.canApply(s5, { type: "END_TURN" }, data), true);
});

/* ---------- 5.4 收袋 ---------- */

test("T-R-10-tokens-return", function () {
  var s0 = buyState({
    bag: ["income_s", "blackSwan"],
    drawn: ["income_m", "blackSwan", "lucky"],
    pendingIncome: 20, blackSwanCount: 1, luckyActive: true, swanReturnUsed: true, busted: true
  });
  var s = engine.reduce(s0, { type: "END_TURN" }, data);
  var p = s.players.human;
  assert.deepEqual(p.bag, ["income_s", "blackSwan", "income_m", "blackSwan", "lucky"], "drawn 依順序附加到 bag 尾端");
  assert.deepEqual(p.drawn, []);
  assert.equal(p.pendingIncome, 0);
  assert.equal(p.blackSwanCount, 0);
  assert.equal(p.luckyActive, false);
  assert.equal(p.swanReturnUsed, false);
  assert.equal(p.busted, false);
  assert.equal(s.purchasedThisTurn, false);
  assert.equal(lastLog(s, "TURN_ENDED").player, "human");
  // AI 端 END_TURN → roundEnd 並記兩人淨資產
  var sa = engine.reduce(engine.reduce(s, { type: "STOP" }, data), { type: "END_TURN" }, data);
  assert.equal(sa.phase, "roundEnd");
  var ev = lastLog(sa, "ROUND_ENDED");
  assert.equal(ev.round, 1);
  assert.deepEqual(ev.netWorth, { human: sel.netWorth(sa, "human", data), ai: sel.netWorth(sa, "ai", data) });
});

/* ---------- 5.5 特殊籌碼 ---------- */

test("T-R-12-lucky-skips-swan", function () {
  // 翻到 lucky → luckyActive
  var s1 = engine.reduce(drawState({ bag: ["lucky"] }), { type: "DRAW" }, data);
  assert.equal(s1.players.human.luckyActive, true);
  // 幸運生效時，不論 seed 為何都不會抽到 blackSwan；抽完 luckyActive=false
  for (var seed = 1; seed <= 200; seed++) {
    var s = H.patchPlayer(H.start(data, { seed: seed }), "human", { bag: ["blackSwan", "blackSwan", "blackSwan", "income_s", "blackSwan"], luckyActive: true });
    var t = engine.reduce(s, { type: "DRAW" }, data);
    assert.equal(t.players.human.drawn[0], "income_s");
    assert.equal(t.players.human.luckyActive, false);
    assert.equal(t.players.human.blackSwanCount, 0);
  }
  // 幸運未生效時，同一袋子在多個 seed 下會抽到 blackSwan（證明過濾確實有效）
  var swanSeen = false;
  for (var k = 1; k <= 50 && !swanSeen; k++) {
    var u = engine.reduce(H.patchPlayer(H.start(data, { seed: k }), "human", { bag: ["blackSwan", "blackSwan", "blackSwan", "income_s", "blackSwan"] }), { type: "DRAW" }, data);
    if (u.players.human.drawn[0] === "blackSwan") swanSeen = true;
  }
  assert.ok(swanSeen);
  // 連續兩顆 lucky：第二顆消耗第一顆的幸運後再度啟用
  var s2 = engine.reduce(drawState({ bag: ["lucky"], luckyActive: true }), { type: "DRAW" }, data);
  assert.equal(s2.players.human.luckyActive, true);
});

test("T-R-13-insurance-token-offsets", function () {
  var s = engine.reduce(drawState({ bag: ["insurance"], blackSwanCount: 2 }), { type: "DRAW" }, data);
  assert.equal(s.players.human.blackSwanCount, 1);
  assert.deepEqual(s.players.human.drawn, ["insurance"]);
  var z = engine.reduce(drawState({ bag: ["insurance"], blackSwanCount: 0 }), { type: "DRAW" }, data);
  assert.equal(z.players.human.blackSwanCount, 0, "不會變負");
});

/* ---------- 5.6 改規則資產 ---------- */

test("T-R-14-swan-return-once", function () {
  var s0 = drawState({ bag: ["blackSwan"], assets: ["a07"] });
  var s1 = engine.reduce(s0, { type: "DRAW" }, data);
  var p1 = s1.players.human;
  assert.equal(p1.blackSwanCount, 0, "第一顆不計數");
  assert.deepEqual(p1.drawn, [], "不進 drawn");
  assert.deepEqual(p1.bag, ["blackSwan"], "放回 bag 尾端");
  assert.equal(p1.swanReturnUsed, true);
  assert.equal(lastLog(s1, "SWAN_RETURNED").cardId, "a07");
  assert.equal(lastLog(s1, "TOKEN_DRAWN").token, "blackSwan");
  // 第二次正常計數
  var s2 = engine.reduce(s1, { type: "DRAW" }, data);
  assert.equal(s2.players.human.blackSwanCount, 1);
  assert.deepEqual(s2.players.human.drawn, ["blackSwan"]);
  assert.equal(countLog(s2, "SWAN_RETURNED"), 1);
  // 放回不消耗 RNG（只有抽籤那 1 次）
  assert.equal(s1.rng.s, engine.rng.next(s0.rng).rng.s);
  // 放回的黑天鵝不算收入籌碼：a07＋a09 同時擁有時，第 3 顆收入仍正確判定
  var s3 = drawState({ bag: ["blackSwan"], assets: ["a07"], drawn: ["income_s", "income_s"] });
  var s4 = engine.reduce(H.patchPlayer(engine.reduce(s3, { type: "DRAW" }, data), "human", { bag: ["income_s"], assets: ["a07", "a09"] }), { type: "DRAW" }, data);
  assert.equal(lastLog(s4, "TOKEN_DRAWN").doubled, true);
});

test("T-R-15-nth-income-double", function () {
  var n = card("a09").effect.param;
  var drawn = [];
  for (var i = 0; i < n - 1; i++) drawn.push("income_s");
  drawn.push("blackSwan"); // 黑天鵝不算收入籌碼
  var pending = (n - 1) * tokenValue("income_s");
  var s0 = drawState({ bag: ["income_m"], assets: ["a09"], drawn: drawn, pendingIncome: pending, blackSwanCount: 1 });
  var s = engine.reduce(s0, { type: "DRAW" }, data);
  assert.equal(s.players.human.pendingIncome, pending + tokenValue("income_m") * 2, "第 n 顆收入 ×2");
  assert.equal(lastLog(s, "TOKEN_DRAWN").doubled, true);
  // 第 n+1 顆不翻倍
  var s2 = engine.reduce(H.patchPlayer(s, "human", { bag: ["income_l"] }), { type: "DRAW" }, data);
  assert.equal(s2.players.human.pendingIncome, s.players.human.pendingIncome + tokenValue("income_l"));
  assert.equal(lastLog(s2, "TOKEN_DRAWN").doubled, undefined);
  // 沒有 a09 時第 n 顆不翻倍
  var s3 = engine.reduce(H.patchPlayer(s0, "human", { assets: [] }), { type: "DRAW" }, data);
  assert.equal(s3.players.human.pendingIncome, pending + tokenValue("income_m"));
});

test("T-R-16-threshold-plus", function () {
  var plus = card("a10").effect.param;
  var base = H.start(data, { seed: 1 });
  assert.equal(sel.threshold(base, "human", data), B.blackSwanThreshold);
  assert.equal(sel.threshold(H.patchPlayer(base, "human", { assets: ["a10"] }), "human", data), B.blackSwanThreshold + plus);
  assert.equal(sel.threshold(H.patchPlayer(base, "human", { assets: ["a10", "a10"] }), "human", data), B.blackSwanThreshold + plus + plus, "可疊加");
  // 有 a10 時，黑天鵝值達基準門檻不爆倉，達門檻＋param 才爆
  var s = engine.reduce(drawState({ bag: ["blackSwan"], assets: ["a10"], blackSwanCount: B.blackSwanThreshold - 1 }), { type: "DRAW" }, data);
  assert.equal(s.players.human.busted, false);
  assert.equal(s.phase, "draw");
  var s2 = engine.reduce(H.patchPlayer(s, "human", { bag: ["blackSwan"], blackSwanCount: B.blackSwanThreshold + plus - 1 }), { type: "DRAW" }, data);
  assert.equal(s2.players.human.busted, true);
});

test("T-R-17-stop-bonus", function () {
  var bonus = card("a08").effect.param;
  var s0 = drawState({ assets: ["a08"], pendingIncome: 30, cash: 100 });
  var s = engine.reduce(s0, { type: "STOP" }, data);
  assert.equal(s.players.human.cash, 100 + 30 + bonus);
  var st = lastLog(s, "STOPPED");
  assert.deepEqual({ pendingIncome: st.pendingIncome, bonus: st.bonus }, { pendingIncome: 30, bonus: bonus });
  assert.equal(lastLog(s, "INCOME_SETTLED").amount, 30 + bonus);
  // 沒有 a08：bonus 0
  var s2 = engine.reduce(drawState({ pendingIncome: 30, cash: 100 }), { type: "STOP" }, data);
  assert.equal(s2.players.human.cash, 130);
  assert.equal(lastLog(s2, "STOPPED").bonus, 0);
  // 爆倉不給
  var s3 = engine.reduce(drawState({ assets: ["a08"], bag: ["blackSwan"], blackSwanCount: B.blackSwanThreshold - 1, pendingIncome: 30, cash: 100 }), { type: "DRAW" }, data);
  assert.equal(s3.players.human.busted, true);
  assert.equal(s3.players.human.cash, 100 + Math.floor(30 * B.bustKeepRatio));
  assert.equal(lastLog(s3, "STOPPED"), null);
});
