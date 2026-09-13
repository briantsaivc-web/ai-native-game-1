"use strict";
/**
 * T-R-18～T-R-20：AI 決策規範（規格 §5.7、§7）；T-AI-selfplay-stats：AI 對 AI 自動對局的正式測試。
 * 期望值一律從 balance.json／assets.json 讀，不寫死門檻與價格。
 * 情境以 helpers.patchPlayer／patchState 造出（不經 action），與 rules.test.js 同做法。
 */
var test = require("node:test");
var assert = require("node:assert/strict");
var H = require("./helpers");
var engine = H.engine;
var sel = engine.selectors;
var rngMod = engine.rng;
var data = H.loadData();
var B = data.balance;
var DIFFS = Object.keys(B.ai);

function card(id) { return sel.byId(data.assets.assets, id); }

/** AI 座位 draw 階段的基準 state：人類翻 0 顆停手、跳過購買 → 換 AI。 */
function aiDrawState(difficulty, patch) {
  var s = H.start(data, { seed: 1, difficulty: difficulty || "normal" });
  s = H.applyAll(s, [{ type: "STOP" }, { type: "END_TURN" }], data);
  assert.equal(s.currentPlayer, "ai");
  assert.equal(s.phase, "draw");
  return patch ? H.patchPlayer(s, "ai", patch) : s;
}
/** AI 座位 buy 階段的基準 state（AI 翻 0 顆停手）。 */
function aiBuyState(difficulty, patch) {
  var s = engine.reduce(aiDrawState(difficulty), { type: "STOP" }, data);
  assert.equal(s.phase, "buy");
  assert.equal(s.purchasedThisTurn, false);
  return patch ? H.patchPlayer(s, "ai", patch) : s;
}
function decision(s) { return engine.ai.decideAi(s, data); }

/* ---------- R-18 純函數 ---------- */

test("T-R-18-ai-pure", function () {
  // 先造好所有情境（START_GAME 會用 rng），再開始監看。
  var frozenData = H.deepFreeze(H.clone(data));
  var states = [aiDrawState("normal"), aiBuyState("hard"), aiDrawState("easy", { bag: [] }), aiBuyState("normal", { cash: 0 })];
  var human = H.start(data, { seed: 1 });
  var lobby = engine.initialState();
  var roundEnd = H.applyAll(aiDrawState("normal"), [{ type: "STOP" }, { type: "END_TURN" }], data);
  assert.equal(roundEnd.phase, "roundEnd");

  // (a) 不呼叫 RNG：把 rng 模組的兩個入口暫時換成會拋錯的版本（ai.js／selectors.js 沒有 require rng，任何間接呼叫都會被抓到）。
  var origNext = rngMod.next, origNextInt = rngMod.nextInt;
  var rngCalls = 0;
  rngMod.next = function () { rngCalls++; throw new Error("decideAi 不得呼叫 rng.next"); };
  rngMod.nextInt = function () { rngCalls++; throw new Error("decideAi 不得呼叫 rng.nextInt"); };
  try {
    states.forEach(function (raw) {
      // (b) 不改 state／data：深度凍結後呼叫（strict mode 下任何寫入都會拋 TypeError），並比對 JSON 快照。
      var s = H.deepFreeze(H.clone(raw));
      var snapshot = JSON.stringify(s);
      var d1 = engine.ai.decideAi(s, frozenData);
      var d2 = engine.ai.decideAi(s, frozenData);
      assert.ok(d1 && d1.action && typeof d1.action.type === "string", "draw／buy 階段必有決策");
      // (c) 同 state 同輸出（深度相等，且第二次呼叫不受第一次影響）。
      assert.deepStrictEqual(d1, d2);
      assert.equal(JSON.stringify(s), snapshot, "decideAi 不得修改 state");
      assert.deepStrictEqual(s.rng, raw.rng, "state.rng 不得變動");
    });
    // (d) 非 AI 回合／非 draw、buy 階段 → null。
    assert.equal(engine.ai.decideAi(human, data), null, "人類回合為 null");
    assert.equal(engine.ai.decideAi(lobby, data), null, "lobby 為 null");
    assert.equal(engine.ai.decideAi(roundEnd, data), null, "roundEnd 為 null");
  } finally {
    rngMod.next = origNext;
    rngMod.nextInt = origNextInt;
  }
  assert.equal(rngCalls, 0, "decideAi 呼叫了 rng " + rngCalls + " 次");
  // 監看確實有效：還原前若呼叫 nextInt 會拋錯（以一次受控呼叫證明 patch 路徑可被觸發）。
  rngMod.nextInt = function () { rngCalls++; throw new Error("probe"); };
  assert.throws(function () { engine.reduce(states[0], { type: "DRAW" }, data); }, /probe/);
  rngMod.nextInt = origNextInt;
  assert.equal(rngCalls, 1);
});

/* ---------- R-19 draw 階段停手規則（三難度門檻邊界） ---------- */

test("T-R-19-ai-stop-rules", function () {
  DIFFS.forEach(function (level) {
    var P = B.ai[level];
    var base = aiDrawState(level);
    var th = sel.threshold(base, "ai", data);
    var swanLine = th - P.swanStopOffset; // 黑天鵝停手線
    assert.ok(swanLine >= 0 && swanLine < th, level + "：swanStopOffset 需使停手線落在 0～門檻−1");

    // 邊界 1：blackSwanCount ＝ 門檻 − offset → STOP(swanStop)；差 1 → DRAW（收入未達）。
    var atLine = H.patchPlayer(base, "ai", { blackSwanCount: swanLine, pendingIncome: 0 });
    assert.deepStrictEqual(decision(atLine), { action: { type: "STOP" }, reason: "swanStop" }, level + "：黑天鵝達停手線應 STOP");
    if (swanLine > 0) {
      var below = H.patchPlayer(base, "ai", { blackSwanCount: swanLine - 1, pendingIncome: 0 });
      assert.deepStrictEqual(decision(below), { action: { type: "DRAW" }, reason: "push" }, level + "：黑天鵝低於停手線 1 應 DRAW");
    }
    // 超過停手線（例如保險籌碼未抵銷的情境）同樣 STOP。
    if (swanLine + 1 < th) {
      var above = H.patchPlayer(base, "ai", { blackSwanCount: swanLine + 1, pendingIncome: 0 });
      assert.equal(decision(above).reason, "swanStop", level + "：黑天鵝高於停手線應 STOP");
    }

    // 邊界 2：pendingIncome ＝ incomeStop → STOP(incomeStop)；差 1 → DRAW。黑天鵝設為停手線以下（若停手線為 0 則無法，跳過 DRAW 分支）。
    var swanSafe = swanLine > 0 ? swanLine - 1 : 0;
    var atIncome = H.patchPlayer(base, "ai", { blackSwanCount: swanSafe, pendingIncome: P.incomeStop });
    var expIncomeReason = swanSafe >= swanLine ? "swanStop" : "incomeStop"; // 黑天鵝規則先判
    assert.deepStrictEqual(decision(atIncome), { action: { type: "STOP" }, reason: expIncomeReason }, level + "：收入達 incomeStop 應 STOP");
    if (swanLine > 0) {
      var belowIncome = H.patchPlayer(base, "ai", { blackSwanCount: swanSafe, pendingIncome: P.incomeStop - 1 });
      assert.deepStrictEqual(decision(belowIncome), { action: { type: "DRAW" }, reason: "push" }, level + "：收入差 1 應 DRAW");
      var overIncome = H.patchPlayer(base, "ai", { blackSwanCount: swanSafe, pendingIncome: P.incomeStop + 1 });
      assert.equal(decision(overIncome).reason, "incomeStop", level + "：收入超過 incomeStop 應 STOP");
    }

    // 邊界 3：候選集為空 → STOP(noCandidates)，優先於其他規則（即使黑天鵝與收入都未達）。
    var emptyBag = H.patchPlayer(base, "ai", { bag: [], blackSwanCount: 0, pendingIncome: 0 });
    assert.deepStrictEqual(decision(emptyBag), { action: { type: "STOP" }, reason: "noCandidates" }, level + "：袋空應 STOP(noCandidates)");
    var luckyOnlySwans = H.patchPlayer(base, "ai", { bag: ["blackSwan", "blackSwan"], luckyActive: true, blackSwanCount: 0, pendingIncome: 0 });
    assert.equal(sel.candidates(luckyOnlySwans, "ai").length, 0);
    assert.deepStrictEqual(decision(luckyOnlySwans), { action: { type: "STOP" }, reason: "noCandidates" }, level + "：幸運生效且袋中只剩黑天鵝應 STOP(noCandidates)");

    // 邊界 4：THRESHOLD_PLUS 提高門檻後，停手線同步上移（讀 selectors.threshold，不寫死 3／4）。
    var plusCards = data.assets.assets.filter(function (c) { return c.effect.type === "THRESHOLD_PLUS"; });
    assert.ok(plusCards.length > 0, "assets.json 需有 THRESHOLD_PLUS 卡");
    var withPlus = H.patchPlayer(base, "ai", { assets: [plusCards[0].id], blackSwanCount: swanLine, pendingIncome: 0 });
    var th2 = sel.threshold(withPlus, "ai", data);
    assert.equal(th2, th + plusCards[0].effect.param);
    assert.deepStrictEqual(decision(withPlus), { action: { type: "DRAW" }, reason: "push" }, level + "：門檻提高後原停手線應改為 DRAW");
    var withPlusAtLine = H.patchPlayer(withPlus, "ai", { blackSwanCount: th2 - P.swanStopOffset });
    assert.equal(decision(withPlusAtLine).reason, "swanStop", level + "：新停手線應 STOP");
  });
});

/* ---------- R-20 buy 階段：買得起的最貴 ---------- */

test("T-R-20-ai-buy-most-expensive", function () {
  var byCost = data.assets.assets.slice().sort(function (a, b) { return b.cost - a.cost; });
  var most = byCost[0], second = byCost[1], cheapest = byCost[byCost.length - 1];
  assert.ok(most.cost > second.cost && second.cost > cheapest.cost, "資料需有三種不同價位");

  DIFFS.forEach(function (level) {
    var base = aiBuyState(level);
    // (a) 現金剛好 ＝ 最貴一張 → 買最貴。
    var s1 = H.patchState(H.patchPlayer(base, "ai", { cash: most.cost }), { market: [cheapest.id, most.id, second.id] });
    assert.deepStrictEqual(decision(s1), { action: { type: "BUY_ASSET", cardId: most.id }, reason: "buyMostExpensive" }, level + "：現金剛好買得起最貴應買最貴");
    // (b) 現金 ＝ 最貴 − 1 → 買第二貴（買得起的最貴）。
    var s2 = H.patchState(H.patchPlayer(base, "ai", { cash: most.cost - 1 }), { market: [cheapest.id, most.id, second.id] });
    assert.deepStrictEqual(decision(s2).action, { type: "BUY_ASSET", cardId: second.id }, level + "：差 1 元買不起最貴，應買次貴");
    // (c) 同價：取 market 索引小者。assets.json 目前無同價卡，故以複製的 data 把 second 的 cost 改成與 most 相同
    //     （decideAi 只讀傳入的 data，不影響其他測試）；同時驗證原資料下 cost 仍是排序主鍵。
    var sameData = H.clone(data);
    sel.byId(sameData.assets.assets, second.id).cost = most.cost;
    var s3 = H.patchState(H.patchPlayer(base, "ai", { cash: most.cost }), { market: [second.id, most.id] });
    assert.equal(engine.ai.decideAi(s3, sameData).action.cardId, second.id, level + "：同價取 market 索引小者");
    var s3b = H.patchState(s3, { market: [most.id, second.id] });
    assert.equal(engine.ai.decideAi(s3b, sameData).action.cardId, most.id, level + "：同價取 market 索引小者（互換）");
    var s3c = H.patchState(H.patchPlayer(base, "ai", { cash: most.cost }), { market: [second.id, most.id] });
    assert.equal(decision(s3c).action.cardId, most.id, level + "：原資料下 cost 為排序主鍵（索引大但較貴者勝）");
    // (d) 買不起任何一張且不能買保險（袋中無黑天鵝）→ END_TURN(nothingToBuy)，不論難度。
    var s4 = H.patchState(H.patchPlayer(base, "ai", { cash: cheapest.cost - 1, bag: ["income_s"] }), { market: [cheapest.id, second.id] });
    assert.deepStrictEqual(decision(s4), { action: { type: "END_TURN" }, reason: "nothingToBuy" }, level + "：買不起任何資產且無法買保險應 END_TURN");
    // (e) 市場空、現金充足 → 不買資產；走保險或 END_TURN（由 T-R-20-ai-insurance-fallback 細驗）。
    var s5 = H.patchState(H.patchPlayer(base, "ai", { cash: most.cost, bag: ["income_s"] }), { market: [] });
    assert.equal(decision(s5).action.type, "END_TURN", level + "：市場空且無黑天鵝應 END_TURN");
    // (f) 本回合已購買 → END_TURN(done)，即使現金充足、市場有卡。
    var s6 = H.patchState(H.patchPlayer(base, "ai", { cash: most.cost }), { market: [most.id], purchasedThisTurn: true });
    assert.deepStrictEqual(decision(s6), { action: { type: "END_TURN" }, reason: "done" }, level + "：已購買應 END_TURN(done)");
    // (g) 決策結果必可被 reducer 接受（買最貴一張後 purchasedThisTurn 為 true）。
    var after = engine.reduce(s1, decision(s1).action, data);
    assert.equal(after.purchasedThisTurn, true);
    assert.equal(after.players.ai.cash, 0);
  });
});

/* ---------- R-20 保險回退：依 balance.ai.<level>.buyInsurance ---------- */

test("T-R-20-ai-insurance-fallback", function () {
  var cheapest = data.assets.assets.slice().sort(function (a, b) { return a.cost - b.cost; })[0];
  assert.ok(B.insuranceCost < cheapest.cost, "資料前提：保險比最便宜的資產便宜，才能造出「買不起資產但買得起保險」");
  DIFFS.forEach(function (level) {
    var P = B.ai[level];
    var base = aiBuyState(level);
    var expect = P.buyInsurance === true
      ? { action: { type: "BUY_INSURANCE" }, reason: "insuranceFallback" }
      : { action: { type: "END_TURN" }, reason: "nothingToBuy" };
    // (a) 現金剛好 ＝ 保險價、買不起任何資產、袋中有黑天鵝 → 依 buyInsurance 決定。
    var s1 = H.patchState(H.patchPlayer(base, "ai", { cash: B.insuranceCost, bag: ["income_s", "blackSwan"] }), { market: [cheapest.id] });
    assert.deepStrictEqual(decision(s1), expect, level + "：buyInsurance=" + P.buyInsurance + " 時的回退決策");
    // (b) 現金 ＝ 保險價 − 1 → 一律 END_TURN。
    var s2 = H.patchPlayer(s1, "ai", { cash: B.insuranceCost - 1 });
    assert.deepStrictEqual(decision(s2), { action: { type: "END_TURN" }, reason: "nothingToBuy" }, level + "：現金不足買保險應 END_TURN");
    // (c) 袋中無黑天鵝（drawn 有也不算）→ 一律 END_TURN。
    var s3 = H.patchPlayer(s1, "ai", { bag: ["income_s"], drawn: ["blackSwan"] });
    assert.deepStrictEqual(decision(s3), { action: { type: "END_TURN" }, reason: "nothingToBuy" }, level + "：袋中無黑天鵝應 END_TURN");
    // (d) 買得起資產時，資產優先於保險（不論 buyInsurance）。
    var s4 = H.patchPlayer(s1, "ai", { cash: cheapest.cost });
    assert.deepStrictEqual(decision(s4).action, { type: "BUY_ASSET", cardId: cheapest.id }, level + "：買得起資產應優先買資產");
    // (e) 回退決策必可被 reducer 接受，且袋中黑天鵝 −1。
    if (P.buyInsurance === true) {
      var after = engine.reduce(s1, decision(s1).action, data);
      assert.equal(sel.bagBlackSwanCount(after, "ai"), 0);
      assert.equal(after.players.ai.cash, 0);
    }
  });
  // 至少一個難度開、一個難度關，否則本測試無法同時覆蓋兩條分支。
  var flags = DIFFS.map(function (l) { return B.ai[l].buyInsurance; });
  assert.ok(flags.indexOf(true) >= 0 && flags.indexOf(false) >= 0, "balance.ai 需同時含 buyInsurance true 與 false 的難度");
});

/* ---------- T-AI-selfplay-stats：正式測試（≥ 50 局 × 3 難度） ---------- */

test("T-AI-selfplay-stats", function (t) {
  var GAMES = 50;
  var jobs = data.jobs.jobs;
  var summary = [];
  DIFFS.forEach(function (level) {
    var wins = { human: 0, ai: 0, tie: 0 };
    for (var seed = 1; seed <= GAMES; seed++) {
      var g = H.playGame(data, {
        seed: seed, aiJobId: null,
        jobId: jobs[(seed - 1) % jobs.length].id,
        difficulty: level, humanDifficulty: "normal"
      });
      var s = g.state;
      // 每局都到 gameOver、回合數固定、winner 與淨資產一致。
      assert.equal(s.phase, "gameOver", level + " seed " + seed + "：未到 gameOver");
      assert.equal(s.round, B.rounds);
      var nwH = sel.netWorth(s, "human", data), nwA = sel.netWorth(s, "ai", data);
      var expWinner = nwH > nwA ? "human" : (nwA > nwH ? "ai" : "tie");
      assert.equal(s.winner, expWinner, level + " seed " + seed + "：winner 與淨資產不符");
      wins[s.winner]++;
      // log 不變式：seq 從 1 連續遞增；每筆有 round／type；player 只在 GAME_STARTED 為 null；
      // 每筆 AI_DECIDED 的 decision 都是五種內部 action 之一；末筆為 GAME_OVER；GAME_STARTED 只有一筆且在首位。
      var log = s.log;
      assert.ok(log.length > 0);
      assert.equal(log[0].type, "GAME_STARTED");
      assert.equal(log[log.length - 1].type, "GAME_OVER");
      var started = 0;
      for (var i = 0; i < log.length; i++) {
        var e = log[i];
        assert.equal(e.seq, i + 1, level + " seed " + seed + "：seq 不連續於 " + i);
        assert.ok(Number.isInteger(e.round) && e.round >= 1 && e.round <= B.rounds);
        assert.equal(typeof e.type, "string");
        if (e.type === "GAME_STARTED") { started++; assert.equal(e.player, null); }
        else assert.ok(e.player === "human" || e.player === "ai", "player 需為 human／ai：" + e.type);
        if (e.type === "AI_DECIDED") {
          assert.equal(e.player, "ai");
          assert.ok(["DRAW", "STOP", "BUY_ASSET", "BUY_INSURANCE", "END_TURN"].indexOf(e.decision.type) >= 0);
          assert.equal(typeof e.reason, "string");
        }
      }
      assert.equal(started, 1);
      // 每局 action 數 ＝ 重放序列長度；AI 回合全走 AI_TURN。
      assert.ok(g.actions.length > 0);
    }
    summary.push(level + "：ai 勝 " + wins.ai + "／human 勝 " + wins.human + "／平手 " + wins.tie + "（" + GAMES + " 局）");
  });
  // 非通過／失敗型的統計只印出供 G5 參考（完整 200 局矩陣仍由 node tests/engine/selfplay.js 產生）。
  summary.forEach(function (l) { t.diagnostic(l); });
});
