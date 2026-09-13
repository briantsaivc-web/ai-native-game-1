"use strict";
/**
 * engine 匯出總表（方便測試與 UI 一次取得）。
 * 各檔皆為 CommonJS；build 依 ADR-001 §2.4 以迷你模組註冊器包進單一 HTML。
 */
var rng = require("./rng");
var selectors = require("./selectors");
var ai = require("./ai");
var reducer = require("./reducer");

module.exports = {
  rng: rng,
  selectors: selectors,
  ai: ai,
  reducer: reducer,
  initialState: reducer.initialState,
  createInitialState: reducer.createInitialState,
  reduce: reducer.reduce,
  canApply: reducer.canApply,
  decideAi: ai.decideAi,
  SPEC_VERSION: reducer.SPEC_VERSION
};
