"use strict";
/** T-INV-1～5、T-INV-schema-keys：規格 §3.3 不變式，於自動對局的每個 action 後檢查。 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var data = H.loadData();
var TOTAL_CARDS = data.assets.assets.length;

var SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
var DIFFS = ["easy", "normal", "hard"];

/** 對所有 seed／難度跑自動對局，每步呼叫 check(before, action, after)。 */
function forEachStep(check) {
  SEEDS.forEach(function (seed, i) {
    var g = H.playGame(data, {
      seed: seed, aiJobId: null,
      jobId: data.jobs.jobs[i % data.jobs.jobs.length].id,
      difficulty: DIFFS[i % DIFFS.length],
      humanDifficulty: DIFFS[(i + 1) % DIFFS.length],
      onStep: check
    });
    assert.equal(g.state.phase, "gameOver");
  });
}

/** AI_TURN 的實際內部 action 由 after.log 尾端的 AI_DECIDED 取得。 */
function effectiveAction(action, after) {
  if (action.type !== "AI_TURN") return action;
  for (var i = after.log.length - 1; i >= 0; i--) {
    if (after.log[i].type === "AI_DECIDED") return after.log[i].decision;
  }
  throw new Error("AI_TURN 未寫 AI_DECIDED");
}

test("T-INV-1-bag-plus-drawn-constant", function () {
  var steps = 0;
  forEachStep(function (before, action, after) {
    var eff = effectiveAction(action, after);
    ["human", "ai"].forEach(function (pid) {
      var b = before.players[pid].bag.length + before.players[pid].drawn.length;
      var a = after.players[pid].bag.length + after.players[pid].drawn.length;
      var expectedDelta = 0;
      if (before.currentPlayer === pid && eff.type === "BUY_ASSET") {
        expectedDelta = engine.selectors.byId(data.assets.assets, eff.cardId).tokensAdded.length;
      } else if (before.currentPlayer === pid && eff.type === "BUY_INSURANCE") {
        expectedDelta = -1;
      }
      assert.equal(a - b, expectedDelta, pid + " 在 " + eff.type + " 後 bag+drawn 變化不符");
    });
    steps++;
  });
  assert.ok(steps > 0);
});

test("T-INV-2-card-total-constant", function () {
  forEachStep(function (before, action, after) {
    var n = after.market.length + after.deck.length + after.players.human.assets.length + after.players.ai.assets.length;
    assert.equal(n, TOTAL_CARDS);
    // 且無重複
    var all = after.market.concat(after.deck, after.players.human.assets, after.players.ai.assets);
    assert.equal(new Set(all).size, TOTAL_CARDS);
  });
});

test("T-INV-3-non-negative", function () {
  forEachStep(function (before, action, after) {
    ["human", "ai"].forEach(function (pid) {
      var p = after.players[pid];
      assert.ok(p.cash >= 0, "cash ≥ 0");
      assert.ok(p.pendingIncome >= 0, "pendingIncome ≥ 0");
      assert.ok(p.blackSwanCount >= 0, "blackSwanCount ≥ 0");
      assert.ok(Number.isInteger(p.cash));
    });
  });
});

test("T-INV-4-log-seq", function () {
  forEachStep(function (before, action, after) {
    // 只追加：前綴不變
    assert.ok(after.log.length > before.log.length, "每個 action 至少寫一筆 log");
    for (var i = 0; i < before.log.length; i++) assert.equal(after.log[i], before.log[i], "log 只追加不修改");
    for (var j = 0; j < after.log.length; j++) {
      assert.equal(after.log[j].seq, j + 1);
      assert.equal(typeof after.log[j].round, "number");
      assert.ok("player" in after.log[j]);
      assert.equal(typeof after.log[j].type, "string");
    }
  });
});

test("T-INV-5-draw-phase-no-purchase", function () {
  forEachStep(function (before, action, after) {
    if (after.phase === "draw") assert.equal(after.purchasedThisTurn, false);
    // 附帶：AI 回合時 AI_TURN 每次只走一步（恰一筆 AI_DECIDED）
    if (action.type === "AI_TURN") {
      var n = after.log.slice(before.log.length).filter(function (e) { return e.type === "AI_DECIDED"; }).length;
      assert.equal(n, 1, "AI_TURN 一次只走一步");
    }
  });
});

test("T-INV-schema-keys", function () {
  function checkKeys(s) {
    assert.deepEqual(Object.keys(s).sort(), H.STATE_KEYS, "state 頂層 key 集合必須與規格 §3.1 一致");
    assert.deepEqual(Object.keys(s.players).sort(), ["ai", "human"]);
    ["human", "ai"].forEach(function (pid) {
      assert.deepEqual(Object.keys(s.players[pid]).sort(), H.PLAYER_KEYS, pid + " 的 key 集合必須與規格 §3.1 一致");
      assert.equal(s.players[pid].id, pid);
    });
    assert.deepEqual(Object.keys(s.rng), ["s"]);
    assert.equal(s.specVersion, "0.1");
    assert.ok(["lobby", "draw", "buy", "roundEnd", "gameOver"].indexOf(s.phase) >= 0);
    assert.ok(["human", "ai"].indexOf(s.currentPlayer) >= 0);
    assert.ok([null, "human", "ai", "tie"].indexOf(s.winner) >= 0);
  }
  checkKeys(engine.initialState());
  forEachStep(function (before, action, after) { checkKeys(after); });
  // state 可完整 JSON 序列化再還原（快照即 state）
  var g = H.playGame(data, { seed: 11, aiJobId: null });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g.state)), g.state);
});
