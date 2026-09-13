#!/usr/bin/env node
"use strict";
/**
 * tests/qa/sim-duration.js：以「人類節奏」模擬一局，估算時長（Playwright 真實等待；模擬非實測）。
 * 人類每個操作：等 UI 動畫（翻牌後等 tokenFlyMs）＋ THINK_MS 思考後才點；AI 回合不加速（aiStepDelayMs=400 真實等待）。
 * 人類策略：黑天鵝 <2 且暫存 <60 就再翻，否則停手；購買階段買最貴可買的資產，否則跳過。
 * 執行：node tests/qa/sim-duration.js [thinkMs] [seed]
 */
var path = require("path");
var playwright = require("playwright");
var INDEX = "file://" + path.join(path.resolve(__dirname, "..", ".."), "index.html");
var THINK = Number(process.argv[2] || 1500);
var SEED = Number(process.argv[3] || 20260913);
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var browser = await playwright.chromium.launch({ headless: true });
  var ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  var page = await ctx.newPage();
  await page.goto(INDEX); await page.waitForSelector("#app .scr");
  var fly = await page.evaluate(function () { return window.GAME_DATA.balance.ui.tokenFlyMs; });
  var t0 = Date.now(), taps = 0, aiMs = 0, humanMs = 0, draws = 0;
  async function tap(sel) { await sleep(THINK); taps++; await page.click(sel); }
  await page.fill("#seedInput", String(SEED));
  await tap('[data-act="toJobSelect"]');
  await tap('[data-act="job"] >> nth=1');
  await tap('[data-act="start"]');
  var rounds = {};
  for (var step = 0; step < 3000; step++) {
    var s = await page.evaluate(function () { var st = window.__game.getState(); return { screen: window.__game.getScreen(), round: st.round, drawn: st.players.human.drawn.length, swan: st.players.human.blackSwanCount, pending: st.players.human.pendingIncome, purchased: st.purchasedThisTurn }; });
    if (s.screen === "gameOver") break;
    if (!rounds[s.round]) rounds[s.round] = Date.now();
    if (s.screen === "humanTurn") {
      var hs = Date.now();
      if (s.swan < 2 && s.pending < 60 && await page.isEnabled('[data-act="draw"]')) { await sleep(fly); await tap('[data-act="draw"]'); draws++; }
      else await tap('[data-act="stop"]');
      humanMs += Date.now() - hs;
    } else if (s.screen === "humanBuy") {
      var hs2 = Date.now();
      var buyable = await page.$$('button[data-act="buyAsset"]:not([disabled])');
      if (!s.purchased && buyable.length) {
        // 最貴：價格文字最大者
        var best = null, bestCost = -1;
        for (var i = 0; i < buyable.length; i++) { var c = Number((await buyable[i].$eval(".p", function (e) { return e.textContent; })).replace(/\D/g, "")); if (c > bestCost) { bestCost = c; best = buyable[i]; } }
        await sleep(THINK); taps++; await best.click();
      } else await tap('[data-act="endTurn"]');
      humanMs += Date.now() - hs2;
    } else if (s.screen === "aiTurn") {
      var as = Date.now();
      while ((await page.evaluate(function () { return window.__game.getScreen(); })) === "aiTurn") await sleep(50);
      aiMs += Date.now() - as;
    } else if (s.screen === "roundEnd") {
      await tap('[data-act="nextRound"]');
    }
  }
  var total = Date.now() - t0;
  var fin = await page.evaluate(function () { var st = window.__game.getState(); return { winner: st.winner, round: st.round, hAssets: st.players.human.assets.length, aAssets: st.players.ai.assets.length, log: st.log.length, aiDecided: st.log.filter(function (e) { return e.type === "AI_DECIDED"; }).length }; });
  console.log(JSON.stringify({ thinkMs: THINK, seed: SEED, totalSec: Math.round(total / 1000), totalMin: +(total / 60000).toFixed(1), humanTaps: taps, humanDraws: draws, humanSec: Math.round(humanMs / 1000), aiSec: Math.round(aiMs / 1000), aiSteps: fin.aiDecided, winner: fin.winner, rounds: fin.round, logEvents: fin.log, assets: fin.hAssets + "/" + fin.aAssets }));
  await browser.close();
})().catch(function (e) { console.error(e.stack); process.exit(2); });
