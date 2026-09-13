"use strict";
/**
 * engine 測試共用工具：載入資料、建 state、跑序列、深度凍結、AI 對 AI 自動對局。
 * 測試端可自由 require JSON（engine 不行）。
 */
var path = require("path");
var engine = require(path.join(__dirname, "..", "..", "src", "engine"));

var DATA_DIR = path.join(__dirname, "..", "..", "src", "data");

function loadData() {
  return {
    jobs: require(path.join(DATA_DIR, "jobs.json")),
    assets: require(path.join(DATA_DIR, "assets.json")),
    tokens: require(path.join(DATA_DIR, "tokens.json")),
    balance: require(path.join(DATA_DIR, "balance.json"))
  };
}

/** 深度凍結（含陣列）；回傳同一物件。 */
function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.keys(obj).forEach(function (k) { deepFreeze(obj[k]); });
  }
  return obj;
}

/** JSON 深拷貝（測試用；state 全為可 JSON 化的值）。 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** 開新局。預設固定 aiJobId 以便測試對照；傳 null 可走 seed 隨機三選一。 */
function start(data, opts) {
  opts = opts || {};
  var action = {
    type: "START_GAME",
    seed: opts.seed === undefined ? 20260913 : opts.seed,
    jobId: opts.jobId || "j02",
    difficulty: opts.difficulty || "normal"
  };
  if (opts.aiJobId !== null) action.aiJobId = opts.aiJobId || "j02";
  return engine.reduce(engine.initialState(), action, data);
}

/** 依序套用 action 陣列。 */
function applyAll(state, actions, data) {
  for (var i = 0; i < actions.length; i++) state = engine.reduce(state, actions[i], data);
  return state;
}

/**
 * 以 patch 覆寫玩家欄位，建出特定情境的 state（測試專用，不經 action）。
 * 回傳新物件；不改輸入。
 */
function patchPlayer(state, playerId, patch) {
  var s = clone(state);
  Object.keys(patch).forEach(function (k) { s.players[playerId][k] = clone(patch[k]); });
  return s;
}

function patchState(state, patch) {
  var s = clone(state);
  Object.keys(patch).forEach(function (k) { s[k] = clone(patch[k]); });
  return s;
}

/**
 * 決定「下一個要送的 action」：AI 座位送 AI_TURN；human 座位用 decideFor 依 humanDifficulty 決策；
 * roundEnd 送 NEXT_ROUND。gameOver 回傳 null。
 */
function nextAutoAction(state, data, humanDifficulty) {
  if (state.phase === "gameOver") return null;
  if (state.phase === "roundEnd") return { type: "NEXT_ROUND" };
  if (state.currentPlayer === "ai") return { type: "AI_TURN" };
  var d = engine.ai.decideFor(state, "human", humanDifficulty, data);
  return d.action;
}

/**
 * 跑完整一局（AI 對 AI）。回傳 { state, actions, steps }；
 * steps 為每步 { before, action, after }，onStep 可在每步做斷言（回傳 false 不記錄 steps 以省記憶體）。
 */
function playGame(data, opts) {
  opts = opts || {};
  var humanDifficulty = opts.humanDifficulty || "normal";
  var state = start(data, opts);
  var actions = [];
  var steps = [];
  var guard = 0;
  while (state.phase !== "gameOver") {
    var action = nextAutoAction(state, data, humanDifficulty);
    var before = state;
    state = engine.reduce(state, action, data);
    actions.push(action);
    if (opts.onStep) opts.onStep(before, action, state);
    if (opts.keepSteps) steps.push({ before: before, action: action, after: state });
    if (++guard > 20000) throw new Error("playGame guard: too many steps");
  }
  return { state: state, actions: actions, steps: steps };
}

/** 規格 §3.1 的 key 集合。 */
var STATE_KEYS = ["specVersion", "seed", "rng", "phase", "round", "currentPlayer", "difficulty",
  "purchasedThisTurn", "players", "market", "deck", "winner", "log"].sort();
var PLAYER_KEYS = ["id", "jobId", "cash", "bag", "drawn", "pendingIncome", "blackSwanCount", "assets",
  "luckyActive", "swanReturnUsed", "busted"].sort();

module.exports = {
  engine: engine,
  loadData: loadData,
  deepFreeze: deepFreeze,
  clone: clone,
  start: start,
  applyAll: applyAll,
  patchPlayer: patchPlayer,
  patchState: patchState,
  nextAutoAction: nextAutoAction,
  playGame: playGame,
  STATE_KEYS: STATE_KEYS,
  PLAYER_KEYS: PLAYER_KEYS
};
