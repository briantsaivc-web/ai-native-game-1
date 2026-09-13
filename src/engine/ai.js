"use strict";
/**
 * AI 對手決策（規格 §7、R-18～R-20）。
 * 純函數：不讀時間、不呼叫 RNG、不修改 state／data。
 * 每次只回傳「一個」action；AI_TURN 由 reducer 逐步套用。
 */
var selectors = require("./selectors");

/**
 * 以指定座位（playerId）與難度參數決策。
 * decideAi 只是 playerId="ai"、difficulty=state.difficulty 的特例；
 * 拆出 decideFor 是為了讓測試能用同一套策略驅動 human 座位做 AI 對 AI 自動對局，
 * 不必在測試裡複製決策邏輯。
 * 回傳 { action, reason }；不在 draw／buy 階段回傳 null。
 */
function decideFor(state, playerId, difficulty, data) {
  if (state.phase !== "draw" && state.phase !== "buy") return null;
  if (state.currentPlayer !== playerId) return null;
  var params = data.balance.ai[difficulty];
  if (!params) return null;
  var p = state.players[playerId];

  if (state.phase === "draw") {
    // R-19：候選集為空 → STOP；黑天鵝值達（門檻 − offset）→ STOP；暫存收入達 incomeStop → STOP；否則 DRAW。
    if (selectors.candidates(state, playerId).length === 0) {
      return { action: { type: "STOP" }, reason: "noCandidates" };
    }
    var th = selectors.threshold(state, playerId, data);
    if (p.blackSwanCount >= th - params.swanStopOffset) {
      return { action: { type: "STOP" }, reason: "swanStop" };
    }
    if (p.pendingIncome >= params.incomeStop) {
      return { action: { type: "STOP" }, reason: "incomeStop" };
    }
    return { action: { type: "DRAW" }, reason: "push" };
  }

  // buy 階段（R-20）
  if (state.purchasedThisTurn) {
    return { action: { type: "END_TURN" }, reason: "done" };
  }
  // 買得起的卡，依 cost 降冪、同價依 market 索引升冪（排序穩定：先建索引再比較）。
  var affordable = [];
  for (var i = 0; i < state.market.length; i++) {
    var card = selectors.byId(data.assets.assets, state.market[i]);
    if (card && card.cost <= p.cash) affordable.push({ idx: i, card: card });
  }
  affordable.sort(function (a, b) {
    if (b.card.cost !== a.card.cost) return b.card.cost - a.card.cost;
    return a.idx - b.idx;
  });
  if (affordable.length > 0) {
    return { action: { type: "BUY_ASSET", cardId: affordable[0].card.id }, reason: "buyMostExpensive" };
  }
  if (params.buyInsurance === true &&
      p.cash >= data.balance.insuranceCost &&
      selectors.bagBlackSwanCount(state, playerId) > 0) {
    return { action: { type: "BUY_INSURANCE" }, reason: "insuranceFallback" };
  }
  return { action: { type: "END_TURN" }, reason: "nothingToBuy" };
}

/**
 * 規格 §7 介面：decideAi(state, data) → { action, reason }。
 * 只在 currentPlayer==="ai" 且 phase ∈ {draw, buy} 有定義，否則回傳 null。
 * 難度讀 state.difficulty → data.balance.ai[difficulty]。
 */
function decideAi(state, data) {
  return decideFor(state, "ai", state.difficulty, data);
}

module.exports = { decideAi: decideAi, decideFor: decideFor };
