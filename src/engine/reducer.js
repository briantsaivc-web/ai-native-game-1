"use strict";
/**
 * reducer：遊戲狀態機（規格 §3 schema、§4 action、§5 規則；ADR-001 §2.1）。
 * - reduce(state, action, data) → 新 state；不修改輸入（淺層複製＋只替換被改的分支；log 用 concat）。
 * - 前置條件不成立 → throw Error("REJECT:<TYPE>:<reason>")，不回傳原 state、不寫 log。
 * - 所有隨機只透過 rng.nextInt，且狀態隨 state.rng 流動。
 * - engine 內出現的數字只允許 0、1、−1 與索引運算；平衡數值一律從 data 讀。
 */
var rng = require("./rng");
var selectors = require("./selectors");
var ai = require("./ai");

var SPEC_VERSION = "0.1";

/* ---------- 內部工具 ---------- */

function reject(type, reason) {
  throw new Error("REJECT:" + type + ":" + reason);
}

/** 淺層複製物件並套用覆寫欄位。 */
function assign(base, patch) {
  var out = {};
  var k;
  for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
  for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
  return out;
}

/** 回傳替換了某位玩家的新 state。 */
function withPlayer(state, playerId, patch) {
  var players = assign(state.players, {});
  players[playerId] = assign(state.players[playerId], patch);
  return assign(state, { players: players });
}

/** 追加一筆 log 事件（seq 遞增，player 為當時 currentPlayer）。 */
function addLog(state, type, extra) {
  var event = { seq: state.log.length + 1, round: state.round, player: state.currentPlayer, type: type };
  for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) event[k] = extra[k];
  return assign(state, { log: state.log.concat([event]) });
}

/** 建立一位玩家（規格 §3.2 初始值）。startBag 依 tokens.json 順序展開為 tokenId 陣列。 */
function makePlayer(playerId, jobId, data) {
  var job = selectors.byId(data.jobs.jobs, jobId);
  var bag = [];
  // 依 tokens.json 的順序展開，確保展開結果決定性（不依賴物件 key 順序）。
  var tokens = data.tokens.tokens;
  for (var i = 0; i < tokens.length; i++) {
    var count = job.startBag[tokens[i].id] || 0;
    for (var c = 0; c < count; c++) bag.push(tokens[i].id);
  }
  return {
    id: playerId,
    jobId: jobId,
    cash: job.startCash,
    bag: bag,
    drawn: [],
    pendingIncome: 0,
    blackSwanCount: 0,
    assets: [],
    luckyActive: false,
    swanReturnUsed: false,
    busted: false
  };
}

/** 補市場：從 deck 頂端依序取卡直到 market 滿或 deck 空；無 RNG。回傳含 MARKET_REFILLED 事件的新 state。 */
function refillMarket(state, data) {
  var market = state.market.slice();
  var deck = state.deck.slice();
  while (market.length < data.balance.marketSize && deck.length > 0) {
    market.push(deck.shift());
  }
  var s = assign(state, { market: market, deck: deck });
  return addLog(s, "MARKET_REFILLED", { market: market.slice() });
}

/** 結算入帳（STOP 或爆倉共用）：cash += amount，寫 INCOME_SETTLED。 */
function settleIncome(state, playerId, amount) {
  var cashAfter = state.players[playerId].cash + amount;
  var s = withPlayer(state, playerId, { cash: cashAfter });
  return addLog(s, "INCOME_SETTLED", { amount: amount, cashAfter: cashAfter });
}

/** 兩人淨資產快照（ROUND_ENDED／GAME_OVER 用）。 */
function netWorthSnapshot(state, data) {
  return {
    human: selectors.netWorth(state, "human", data),
    ai: selectors.netWorth(state, "ai", data)
  };
}

/* ---------- 初始狀態 ---------- */

/** 大廳狀態：phase="lobby"，其餘為空值；key 集合與規格 §3.1 完全一致。 */
function emptyPlayer(playerId) {
  return {
    id: playerId,
    jobId: null,
    cash: 0,
    bag: [],
    drawn: [],
    pendingIncome: 0,
    blackSwanCount: 0,
    assets: [],
    luckyActive: false,
    swanReturnUsed: false,
    busted: false
  };
}

function initialState() {
  return {
    specVersion: SPEC_VERSION,
    seed: null,
    rng: { s: 0 },
    phase: "lobby",
    round: 1,
    currentPlayer: "human",
    difficulty: null,
    purchasedThisTurn: false,
    players: { human: emptyPlayer("human"), ai: emptyPlayer("ai") },
    market: [],
    deck: [],
    winner: null,
    log: []
  };
}

/* ---------- 各 action ---------- */

function startGame(state, action, data) {
  if (state.phase !== "lobby") reject("START_GAME", "phase");
  if (!selectors.byId(data.jobs.jobs, action.jobId)) reject("START_GAME", "unknownJob");
  if (!data.balance.ai[action.difficulty]) reject("START_GAME", "unknownDifficulty");
  if (action.aiJobId !== undefined && action.aiJobId !== null &&
      !selectors.byId(data.jobs.jobs, action.aiJobId)) reject("START_GAME", "unknownAiJob");

  var r = rng.seedRng(action.seed);

  // 規格附錄 A 第 1 題（製作人拍板）：未帶 aiJobId 時，以 rng 從 jobs.json 隨機取一張（1 次 RNG，在洗牌之前）。
  var aiJobId = action.aiJobId;
  if (aiJobId === undefined || aiJobId === null) {
    var pick = rng.nextInt(r, data.jobs.jobs.length);
    r = pick.rng;
    aiJobId = data.jobs.jobs[pick.value].id;
  }

  // deck ＝ 12 張 id 依 assets.json 順序，Fisher–Yates 洗牌（n−1 次 RNG）。
  var deck = data.assets.assets.map(function (card) { return card.id; });
  for (var i = deck.length - 1; i > 0; i--) {
    var o = rng.nextInt(r, i + 1);
    r = o.rng;
    var tmp = deck[i]; deck[i] = deck[o.value]; deck[o.value] = tmp;
  }

  var s = assign(state, {
    seed: action.seed >>> 0,
    rng: r,
    phase: "draw",
    round: 1,
    currentPlayer: "human",
    difficulty: action.difficulty,
    purchasedThisTurn: false,
    players: {
      human: makePlayer("human", action.jobId, data),
      ai: makePlayer("ai", aiJobId, data)
    },
    market: [],
    deck: deck,
    winner: null,
    log: []
  });
  // GAME_STARTED 的 player 為 null（規格 §4.1）。
  var event = { seq: 1, round: 1, player: null, type: "GAME_STARTED",
    seed: s.seed, humanJobId: action.jobId, aiJobId: aiJobId, difficulty: action.difficulty };
  s = assign(s, { log: [event] });
  return refillMarket(s, data);
}

/**
 * DRAW（分派單 X-9 規定的順序）：
 * lucky 過濾 → 抽出 → SWAN_RETURN_ONCE（若為黑天鵝且未用）→ 計數／加收入（含 NTH_INCOME_DOUBLE）
 * → insurance 籌碼抵銷 → 爆倉判定。
 */
function draw(state, data) {
  if (state.phase !== "draw") reject("DRAW", "phase");
  var pid = state.currentPlayer;
  var p = state.players[pid];
  var cands = selectors.candidates(state, pid);
  if (cands.length === 0) reject("DRAW", "noCandidates");

  // 抽出：以 nextInt(候選數) 選一個候選，對應回 bag 索引。
  var o = rng.nextInt(state.rng, cands.length);
  var bagIndex = cands[o.value];
  var tokenId = p.bag[bagIndex];
  var token = selectors.byId(data.tokens.tokens, tokenId);
  var bag = p.bag.slice(0, bagIndex).concat(p.bag.slice(bagIndex + 1));

  var patch = {
    bag: bag,
    drawn: p.drawn,
    pendingIncome: p.pendingIncome,
    blackSwanCount: p.blackSwanCount,
    luckyActive: false, // R-12：一次 DRAW 消耗幸運
    swanReturnUsed: p.swanReturnUsed
  };
  var s = assign(state, { rng: o.rng });
  var doubled = false;
  var swanReturnedBy = null;

  if (token.kind === "blackSwan") {
    var returners = selectors.assetsWithEffect(state, pid, data, "SWAN_RETURN_ONCE");
    if (returners.length > 0 && !p.swanReturnUsed) {
      // R-14：不計數、直接放回 bag 尾端（不進 drawn），不消耗 RNG。
      patch.bag = bag.concat([tokenId]);
      patch.swanReturnUsed = true;
      swanReturnedBy = returners[0].id;
    } else {
      patch.drawn = p.drawn.concat([tokenId]);
      patch.blackSwanCount = p.blackSwanCount + 1; // R-06
    }
  } else if (token.kind === "income") {
    patch.drawn = p.drawn.concat([tokenId]);
    // R-15：本回合第 n 顆收入籌碼（只數 drawn 中 kind==="income"，含本顆）。
    var nth = 0;
    for (var i = 0; i < patch.drawn.length; i++) {
      var t = selectors.byId(data.tokens.tokens, patch.drawn[i]);
      if (t && t.kind === "income") nth++;
    }
    var value = token.value;
    var doublers = selectors.assetsWithEffect(state, pid, data, "NTH_INCOME_DOUBLE");
    for (var d = 0; d < doublers.length; d++) {
      if (doublers[d].effect.param === nth) { doubled = true; break; }
    }
    if (doubled) value = value + value;
    patch.pendingIncome = p.pendingIncome + value; // R-05
  } else if (token.kind === "insurance") {
    patch.drawn = p.drawn.concat([tokenId]);
    // R-13：抵銷 1 點，不低於 0。
    patch.blackSwanCount = p.blackSwanCount > 0 ? p.blackSwanCount - 1 : 0;
  } else if (token.kind === "lucky") {
    patch.drawn = p.drawn.concat([tokenId]);
    patch.luckyActive = true; // R-12
  } else {
    patch.drawn = p.drawn.concat([tokenId]);
  }

  s = withPlayer(s, pid, patch);
  var drawnEvent = { token: tokenId, pendingIncome: patch.pendingIncome, blackSwanCount: patch.blackSwanCount };
  if (doubled) drawnEvent.doubled = true;
  s = addLog(s, "TOKEN_DRAWN", drawnEvent);
  if (swanReturnedBy) s = addLog(s, "SWAN_RETURNED", { cardId: swanReturnedBy });

  // R-07：爆倉判定。
  var th = selectors.threshold(s, pid, data);
  if (patch.blackSwanCount >= th) {
    var pendingBefore = patch.pendingIncome;
    var settled = Math.floor(pendingBefore * data.balance.bustKeepRatio);
    s = withPlayer(s, pid, { busted: true });
    s = addLog(s, "BUST", { pendingBefore: pendingBefore, settled: settled });
    s = settleIncome(s, pid, settled);
    s = assign(s, { phase: "buy", purchasedThisTurn: false });
  }
  return s;
}

function stop(state, data) {
  if (state.phase !== "draw") reject("STOP", "phase");
  var pid = state.currentPlayer;
  var p = state.players[pid];
  // R-17：主動 STOP 且未爆倉時加 STOP_BONUS（draw 階段不可能已爆倉，仍依規則判斷）。
  var bonus = 0;
  if (!p.busted) {
    var cards = selectors.assetsWithEffect(state, pid, data, "STOP_BONUS");
    for (var i = 0; i < cards.length; i++) bonus += cards[i].effect.param;
  }
  var s = addLog(state, "STOPPED", { pendingIncome: p.pendingIncome, bonus: bonus });
  s = settleIncome(s, pid, p.pendingIncome + bonus);
  return assign(s, { phase: "buy", purchasedThisTurn: false });
}

function buyAsset(state, action, data) {
  if (state.phase !== "buy") reject("BUY_ASSET", "phase");
  if (state.purchasedThisTurn) reject("BUY_ASSET", "alreadyPurchased");
  var idx = state.market.indexOf(action.cardId);
  if (idx < 0) reject("BUY_ASSET", "notInMarket");
  var card = selectors.byId(data.assets.assets, action.cardId);
  if (!card) reject("BUY_ASSET", "unknownCard");
  var pid = state.currentPlayer;
  var p = state.players[pid];
  if (p.cash < card.cost) reject("BUY_ASSET", "insufficientCash");

  // market 移除該卡但不立即補（下一位玩家回合開始才補）；tokensAdded 立即加入 bag 尾端。
  var market = state.market.slice(0, idx).concat(state.market.slice(idx + 1));
  var s = withPlayer(state, pid, {
    cash: p.cash - card.cost,
    assets: p.assets.concat([card.id]),
    bag: p.bag.concat(card.tokensAdded)
  });
  s = assign(s, { market: market, purchasedThisTurn: true });
  return addLog(s, "ASSET_BOUGHT", { cardId: card.id, cost: card.cost, tokensAdded: card.tokensAdded.slice() });
}

function buyInsurance(state, data) {
  if (state.phase !== "buy") reject("BUY_INSURANCE", "phase");
  if (state.purchasedThisTurn) reject("BUY_INSURANCE", "alreadyPurchased");
  var pid = state.currentPlayer;
  var p = state.players[pid];
  if (p.cash < data.balance.insuranceCost) reject("BUY_INSURANCE", "insufficientCash");
  var idx = p.bag.indexOf("blackSwan"); // 只看 bag，不看 drawn；移除索引最小者，無 RNG
  if (idx < 0) reject("BUY_INSURANCE", "noBlackSwan");

  var bag = p.bag.slice(0, idx).concat(p.bag.slice(idx + 1));
  var s = withPlayer(state, pid, { cash: p.cash - data.balance.insuranceCost, bag: bag });
  s = assign(s, { purchasedThisTurn: true });
  return addLog(s, "INSURANCE_BOUGHT", {
    cost: data.balance.insuranceCost,
    bagBlackSwanAfter: selectors.bagBlackSwanCount(s, pid)
  });
}

function endTurn(state, data) {
  if (state.phase !== "buy") reject("END_TURN", "phase");
  var pid = state.currentPlayer;
  var p = state.players[pid];
  // R-10：drawn 依順序附加到 bag 尾端；回合暫存欄位歸零。
  var s = withPlayer(state, pid, {
    bag: p.bag.concat(p.drawn),
    drawn: [],
    pendingIncome: 0,
    blackSwanCount: 0,
    luckyActive: false,
    swanReturnUsed: false,
    busted: false
  });
  s = assign(s, { purchasedThisTurn: false });
  s = addLog(s, "TURN_ENDED", {});
  if (pid === "human") {
    s = assign(s, { currentPlayer: "ai", phase: "draw" });
    return refillMarket(s, data);
  }
  s = assign(s, { phase: "roundEnd" });
  return addLog(s, "ROUND_ENDED", { round: s.round, netWorth: netWorthSnapshot(s, data) });
}

function nextRound(state, data) {
  if (state.phase !== "roundEnd") reject("NEXT_ROUND", "phase");
  if (state.round === data.balance.rounds) {
    // R-02：淨資產較高者勝；相同為 tie。
    var nw = netWorthSnapshot(state, data);
    var winner = nw.human > nw.ai ? "human" : (nw.ai > nw.human ? "ai" : "tie");
    var s = assign(state, { phase: "gameOver", winner: winner });
    return addLog(s, "GAME_OVER", { winner: winner, netWorth: nw });
  }
  var s2 = assign(state, { round: state.round + 1, currentPlayer: "human", phase: "draw" });
  return refillMarket(s2, data);
}

function aiTurn(state, data) {
  if (state.currentPlayer !== "ai") reject("AI_TURN", "notAiTurn");
  if (state.phase !== "draw" && state.phase !== "buy") reject("AI_TURN", "phase");
  var decision = ai.decideAi(state, data);
  if (!decision) reject("AI_TURN", "noDecision");
  var s = addLog(state, "AI_DECIDED", { decision: decision.action, reason: decision.reason });
  return reduce(s, decision.action, data);
}

/* ---------- 對外介面 ---------- */

function reduce(state, action, data) {
  if (!action || typeof action.type !== "string") reject("UNKNOWN", "noType");
  switch (action.type) {
    case "START_GAME": return startGame(state, action, data);
    case "DRAW": return draw(state, data);
    case "STOP": return stop(state, data);
    case "BUY_ASSET": return buyAsset(state, action, data);
    case "BUY_INSURANCE": return buyInsurance(state, data);
    case "END_TURN": return endTurn(state, data);
    case "NEXT_ROUND": return nextRound(state, data);
    case "AI_TURN": return aiTurn(state, data);
    default: reject(action.type, "unknownAction");
  }
}

/** UI 用：該 action 是否可套用。以 try/reduce 判斷，與 reduce 的拒絕條件必然一致。 */
function canApply(state, action, data) {
  try {
    reduce(state, action, data);
    return true;
  } catch (e) {
    if (e && typeof e.message === "string" && e.message.indexOf("REJECT:") === 0) return false;
    throw e;
  }
}

module.exports = {
  initialState: initialState,
  createInitialState: initialState,
  reduce: reduce,
  canApply: canApply,
  SPEC_VERSION: SPEC_VERSION
};
