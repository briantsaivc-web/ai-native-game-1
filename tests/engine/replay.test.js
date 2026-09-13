"use strict";
/** T-R-21 決定性重放、T-R-25 reducer 不變性（規格 §5.8、ADR-001 §5）。 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var data = H.loadData();

test("T-R-21-replay-deterministic", function () {
  // 第一次：自動對局（含 AI_TURN），記下 action 序列
  var g1 = H.playGame(data, { seed: 424242, jobId: "j03", difficulty: "hard", aiJobId: null, humanDifficulty: "normal" });
  // 第二次：以同 seed 從 initialState 重放同一序列
  var startAction = { type: "START_GAME", seed: 424242, jobId: "j03", difficulty: "hard" };
  var s2 = H.applyAll(engine.initialState(), [startAction].concat(g1.actions), data);
  assert.deepStrictEqual(s2, g1.state, "同 seed ＋ 同序列 → 最終 state 深度相等（含 log）");
  assert.equal(s2.phase, "gameOver");
  // 不同 seed 應得到不同結果（避免測試因 RNG 未生效而空通過）
  var g3 = H.playGame(data, { seed: 424243, jobId: "j03", difficulty: "hard", aiJobId: null });
  assert.notDeepStrictEqual(g3.state.log, g1.state.log);
});

test("T-R-25-reducer-immutable", function () {
  // 深度凍結 data 與每一步的輸入 state；任何修改輸入的路徑都會在 strict mode 下拋 TypeError
  var frozenData = H.deepFreeze(H.clone(data));
  var g = H.playGame(frozenData, {
    seed: 777, jobId: "j01", difficulty: "normal", aiJobId: null,
    onStep: function (before, action, after) {
      H.deepFreeze(after);
      assert.notEqual(before, after, "reduce 必須回傳新物件");
    }
  });
  H.deepFreeze(engine.initialState());
  assert.equal(g.state.phase, "gameOver");
  // 凍結的輸入在被拒絕的 action 下也不被修改
  var frozen = H.deepFreeze(H.start(frozenData, { seed: 1 }));
  assert.throws(function () { engine.reduce(frozen, { type: "END_TURN" }, frozenData); }, /REJECT:END_TURN:phase/);
  assert.equal(frozen.phase, "draw");
});
