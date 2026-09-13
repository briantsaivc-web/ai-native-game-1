"use strict";
/**
 * G4.5 實證：外部 1 E-1（Blocker：withPlayer 未隔離對手物件，違反原則 1）
 *          vs 外部 2 Q-1（深度凍結整局通過）。
 * 兩方說法對決：
 *   A（外部 1）：withPlayer 讓「未被修改的另一位玩家」與舊 state 共用參照 → 違反不可變。
 *   B（我方讀碼）：共用參照是結構共享（structural sharing）；只要 reduce 從不 mutate，
 *                  深度凍結輸入跑整局不會拋 TypeError，舊 state 也不會被污染。
 * 判準：在 strict mode 下對凍結物件賦值會拋 TypeError；整局零 TypeError ＝ 沒有任何 mutation。
 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var data = H.loadData();

test("TRIAGE-E1-a-deep-frozen-full-game-no-mutation", function () {
  var frozenData = H.deepFreeze(H.clone(data));
  var seeds = [1, 7, 20260913, 424242];
  var jobs = ["j01", "j02", "j03"];
  var diffs = ["easy", "normal", "hard"];
  var totalSteps = 0;
  seeds.forEach(function (seed, i) {
    var init = H.deepFreeze(engine.initialState());
    var state = engine.reduce(init, {
      type: "START_GAME", seed: seed, jobId: jobs[i % 3], difficulty: diffs[i % 3]
    }, frozenData);
    H.deepFreeze(state);
    var guard = 0;
    while (state.phase !== "gameOver") {
      var action = H.nextAutoAction(state, frozenData, diffs[(i + 1) % 3]);
      var before = state;
      // 若 reduce 內任何路徑 mutate 凍結的輸入，這裡會拋 TypeError（非 REJECT），測試失敗。
      state = engine.reduce(before, action, frozenData);
      H.deepFreeze(state); // 下一步的輸入也是凍結的
      totalSteps++;
      if (++guard > 20000) throw new Error("guard");
    }
    assert.equal(state.phase, "gameOver");
  });
  assert.ok(totalSteps > 100, "整局至少百餘步；實際步數 " + totalSteps);
});

test("TRIAGE-E1-b-structural-sharing-does-not-pollute-old-state", function () {
  // 外部 1 的失敗情境：「若後續外部修改新 state 該玩家物件，將污染舊 state」。
  // 先確認共用參照確實存在（外部 1 讀碼正確），再確認這是否構成違反原則 1。
  var s0 = H.start(data, { seed: 5 });
  var s1 = engine.reduce(s0, { type: "DRAW" }, data); // 只動 human
  assert.equal(s1.players.ai, s0.players.ai, "未修改的 ai 物件與舊 state 共用參照（外部 1 描述的現象為真）");
  assert.notEqual(s1.players.human, s0.players.human, "被修改的 human 是新物件");
  assert.notEqual(s1.players, s0.players, "players 容器是新物件");
  assert.notEqual(s1, s0, "state 是新物件");

  // 關鍵：舊 state 是否會被「engine 自己」污染？把 s0 深度凍結後再 reduce 多步，s0 內容不變。
  var snapshot = H.clone(s0);
  H.deepFreeze(s0);
  var s = s0;
  var acts = [{ type: "DRAW" }, { type: "STOP" }, { type: "END_TURN" }, { type: "AI_TURN" }, { type: "AI_TURN" }, { type: "AI_TURN" }];
  for (var i = 0; i < acts.length; i++) {
    s = engine.reduce(s, acts[i], data);
    assert.deepStrictEqual(H.clone(s0), snapshot, "第 " + (i + 1) + " 步後舊 state 內容不變");
  }
  // 外部 1 情境需要「外部程式手動 mutate 新 state 的玩家物件」才會污染舊 state；
  // 這與 withPlayer 是否複製對手物件無關——即使照外部 1 的修法複製了 ai，
  // 外部程式 mutate s1.players.human.bag（本來就是新物件內的舊陣列參照）一樣會污染。
  // 結論：外部 1 的修法無法消除它所描述的風險；真正的防線是「沒有人 mutate」，而 (a) 已證明 engine 不 mutate。
});

test("TRIAGE-E1-c-external-fix-does-not-remove-described-risk", function () {
  // 模擬外部 1 建議的修法：對 players.human／ai 各做一次淺複製。證明淺複製後陣列仍共用。
  function assign(base, patch) {
    var out = {}; var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
    return out;
  }
  var s0 = H.start(data, { seed: 5 });
  var players = { human: assign(s0.players.human, {}), ai: assign(s0.players.ai, {}) };
  assert.notEqual(players.ai, s0.players.ai, "外部修法：ai 物件確實變新物件");
  assert.equal(players.ai.bag, s0.players.ai.bag, "但 ai.bag 陣列仍與舊 state 共用參照");
  assert.equal(players.ai.assets, s0.players.ai.assets, "ai.assets 亦共用");
  // 即：外部 1 的修法只把共用往下推一層，不是「各層級隔離」；要真正隔離得深拷貝整棵樹，代價是每步 O(state) 且違反本專案「淺層複製＋只替換被改分支」的設計（reducer.js:4）。
});
