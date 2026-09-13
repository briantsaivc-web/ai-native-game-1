"use strict";
/** T-RNG-*：seeded RNG（mulberry32）向量與呼叫次數（ADR-001 §5）。 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var rng = H.engine.rng;
var data = H.loadData();

test("T-RNG-01-mulberry32-vector", function () {
  // seedRng(1) 連續 5 次 next 的值（由 S2 產生並固定，供日後回歸）。
  var expected = [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849];
  var expectedStates = [1831565814, 3663131627, 1199730144, 3031295957, 567894474];
  var s = rng.seedRng(1);
  for (var i = 0; i < expected.length; i++) {
    var o = rng.next(s);
    assert.equal(o.value, expected[i], "第 " + (i + 1) + " 個值");
    assert.equal(o.rng.s, expectedStates[i], "第 " + (i + 1) + " 個狀態");
    s = o.rng;
  }
  // 純函數：同一輸入呼叫兩次結果相同，且不改輸入
  var frozen = H.deepFreeze(rng.seedRng(7));
  assert.deepEqual(rng.next(frozen), rng.next(frozen));
  assert.deepEqual(rng.nextInt(frozen, 5), rng.nextInt(frozen, 5));
  // nextInt 範圍
  var t = rng.seedRng(99);
  for (var k = 0; k < 1000; k++) {
    var q = rng.nextInt(t, 3);
    assert.ok(q.value >= 0 && q.value < 3 && Number.isInteger(q.value));
    t = q.rng;
  }
});

/** 從 rng 狀態 a 走 n 步後的狀態。 */
function advance(s, n) {
  for (var i = 0; i < n; i++) s = rng.next(s).rng;
  return s;
}

test("T-RNG-02-call-count", function () {
  var seed = 12345;
  var n = data.assets.assets.length;
  // START_GAME 帶 aiJobId：只有 Fisher–Yates，n−1 ＝ 11 次
  var s = H.start(data, { seed: seed, aiJobId: "j01" });
  assert.equal(s.rng.s, advance(rng.seedRng(seed), n - 1).s, "START_GAME(含 aiJobId) 消耗 11 次");
  // START_GAME 未帶 aiJobId：附錄 A 第 1 題，先 1 次選職業再洗牌 ＝ 12 次
  var s2 = H.start(data, { seed: seed, aiJobId: null });
  assert.equal(s2.rng.s, advance(rng.seedRng(seed), n).s, "START_GAME(隨機 aiJobId) 消耗 12 次");
  // DRAW 消耗 1 次
  var afterDraw = H.engine.reduce(s, { type: "DRAW" }, data);
  assert.equal(afterDraw.rng.s, advance(s.rng, 1).s, "DRAW 消耗 1 次");
  // STOP / BUY_* / END_TURN / NEXT_ROUND 消耗 0 次
  var afterStop = H.engine.reduce(afterDraw, { type: "STOP" }, data);
  assert.equal(afterStop.rng.s, afterDraw.rng.s, "STOP 0 次");
  var rich = H.patchPlayer(afterStop, "human", { cash: 1000 });
  var afterBuy = H.engine.reduce(rich, { type: "BUY_ASSET", cardId: rich.market[0] }, data);
  assert.equal(afterBuy.rng.s, rich.rng.s, "BUY_ASSET 0 次");
  var afterIns = H.engine.reduce(rich, { type: "BUY_INSURANCE" }, data);
  assert.equal(afterIns.rng.s, rich.rng.s, "BUY_INSURANCE 0 次");
  var afterEnd = H.engine.reduce(afterBuy, { type: "END_TURN" }, data);
  assert.equal(afterEnd.rng.s, afterBuy.rng.s, "END_TURN 0 次");
  var roundEnd = H.patchState(afterEnd, { phase: "roundEnd", currentPlayer: "ai" });
  var afterNext = H.engine.reduce(roundEnd, { type: "NEXT_ROUND" }, data);
  assert.equal(afterNext.rng.s, roundEnd.rng.s, "NEXT_ROUND 0 次");
});
