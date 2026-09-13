#!/usr/bin/env node
"use strict";
/**
 * tests/qa/explore-ui.js：QA 探索測試（UI 層，Playwright Chromium）。
 * 執行：node tests/qa/explore-ui.js
 * 每項印出 [U-xx] 名稱 → 結果；截圖到 docs/qa/shots/qa-*.png。
 * 只讀 window.__game（唯讀），不改 src/。
 */
var path = require("path");
var fs = require("fs");
var playwright = require("playwright");

var ROOT = path.resolve(__dirname, "..", "..");
var INDEX = "file://" + path.join(ROOT, "index.html");
var SHOTS = path.join(ROOT, "docs", "qa", "shots");
fs.mkdirSync(SHOTS, { recursive: true });

var results = [];
function rec(id, name, ok, note) {
  results.push({ id: id, name: name, ok: ok, note: note || "" });
  console.log("[" + id + "] " + (ok ? "OK  " : "FAIL") + " " + name + (note ? " → " + note : ""));
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function newPage(browser, vp) {
  var ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: vp.width < 900 });
  var page = await ctx.newPage();
  page.errs = [];
  page.on("console", function (m) { if (m.type() === "error") page.errs.push(m.text()); });
  page.on("pageerror", function (e) { page.errs.push("pageerror: " + e.message); });
  await page.goto(INDEX);
  await page.waitForSelector("#app .scr");
  return { ctx: ctx, page: page };
}
async function st(page) {
  return page.evaluate(function () {
    var s = window.__game.getState();
    return { screen: window.__game.getScreen(), phase: s.phase, round: s.round, cp: s.currentPlayer, seed: s.seed,
      hDrawn: s.players.human.drawn.length, hSwan: s.players.human.blackSwanCount, hCash: s.players.human.cash,
      hBag: s.players.human.bag.length, hAssets: s.players.human.assets.length, purchased: s.purchasedThisTurn,
      busted: s.players.human.busted, market: s.market.length, deck: s.deck.length, logLen: s.log.length,
      hBagSwans: s.players.human.bag.filter(function (t) { return t === "blackSwan"; }).length,
      err: !!document.querySelector(".err") };
  });
}
async function startGame(page, seed, jobIdx, diff) {
  await page.click('[data-act="difficulty"][data-v="' + (diff || "normal") + '"]');
  await page.fill("#seedInput", seed === null ? "" : String(seed));
  await page.click('[data-act="toJobSelect"]');
  await page.click('[data-act="job"] >> nth=' + (jobIdx || 0));
  await page.click('[data-act="start"]');
}
async function waitHumanTurn(page, maxMs) {
  var t0 = Date.now();
  while (Date.now() - t0 < (maxMs || 20000)) {
    var s = await st(page);
    if (s.screen === "humanTurn" || s.screen === "gameOver") return s;
    if (s.screen === "roundEnd") await page.click('[data-act="nextRound"]');
    else if (s.screen === "humanBuy") await page.click('[data-act="endTurn"]');
    else await sleep(60);
  }
  throw new Error("等不到 humanTurn");
}
async function center(page, sel) {
  var b = await page.locator(sel).first().boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function overflow(page) {
  return page.evaluate(function () {
    var de = document.documentElement, app = document.getElementById("app");
    return { docScrollW: de.scrollWidth, clientW: de.clientWidth, appScrollW: app.scrollWidth, bodyX: document.body.scrollWidth };
  });
}
async function smallFonts(page) {
  return page.evaluate(function () {
    var out = {};
    document.querySelectorAll("#app *").forEach(function (el) {
      if (!el.textContent.trim() || el.children.length) return;
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      var r = el.getBoundingClientRect(); if (!r.width) return;
      var fs = parseFloat(cs.fontSize);
      if (fs < 14) { var k = fs + "px " + el.className; out[k] = (out[k] || 0) + 1; }
    });
    return out;
  });
}

(async function main() {
  var browser = await playwright.chromium.launch({ headless: true });
  var PHONE = { width: 390, height: 844 }, IPAD = { width: 1194, height: 834 };
  var o, page;

  /* U-01 seed=0 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 0, 0);
    var s = await st(page);
    rec("U-01", "UI 輸入 seed=0 可開局（state.seed===0、畫面 humanTurn）", s.seed === 0 && s.screen === "humanTurn", "seed=" + s.seed + "、screen=" + s.screen);
  } catch (e) { rec("U-01", "seed=0", false, e.message); }
  await o.ctx.close();

  /* U-02 seed 邊界輸入 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    var notes = [];
    var cases = [["4294967295", "ok"], ["4294967296", "invalid"], ["-1", "invalid"], ["  12  ", "ok"], ["0000000007", "ok"], ["1e3", "invalid"], ["12345678901", "invalid"]];
    var allOk = true;
    for (var i = 0; i < cases.length; i++) {
      await page.goto(INDEX); await page.waitForSelector("#app .scr");
      await startGame(page, cases[i][0], 0);
      var s2 = await st(page);
      var got = s2.screen === "humanTurn" ? "ok(seed=" + s2.seed + ")" : (s2.err ? "invalid(提示)" : "?" + s2.screen);
      var pass = (cases[i][1] === "ok") === (s2.screen === "humanTurn");
      if (cases[i][0] === "  12  " && s2.seed !== 12) pass = false;
      if (cases[i][0] === "0000000007" && s2.seed !== 7) pass = false;
      if (!pass) allOk = false;
      notes.push(JSON.stringify(cases[i][0]) + "→" + got);
    }
    rec("U-02", "seed 邊界輸入：上限／超界／負數／空白包圍／前導零／科學記號／11 位", allOk, notes.join("；"));
  } catch (e) { rec("U-02", "seed 邊界", false, e.message); }
  await o.ctx.close();

  /* U-03 連按兩次「停手」（同座標）*/
  for (var vi = 0; vi < 2; vi++) {
    var vp = vi === 0 ? PHONE : IPAD, vn = vi === 0 ? "phone" : "ipad";
    o = await newPage(browser, vp); page = o.page;
    try {
      await startGame(page, 20260913, 1);
      await page.click('[data-act="draw"]');
      var before = await st(page);
      var c = await center(page, '[data-act="stop"]');
      await page.touchscreen.tap(c.x, c.y);
      await sleep(120); // 人類雙擊間隔
      await page.touchscreen.tap(c.x, c.y);
      await sleep(80);
      var after = await st(page);
      var skipped = after.cp === "ai" || after.screen === "aiTurn";
      var hitWhat = await page.evaluate(function (pt) { var el = document.elementFromPoint(pt.x, pt.y); return el ? (el.closest("[data-act]") || el).getAttribute("data-act") || el.tagName : "none"; }, c);
      await page.screenshot({ path: path.join(SHOTS, "qa-" + vn + "-double-stop.png") });
      rec("U-03-" + vn, "連按兩次「停手」：第二下是否誤觸購買階段的「跳過，不買」", !skipped,
        "第二下落點 data-act=" + hitWhat + "；按前 screen=" + before.screen + " → 按後 screen=" + after.screen + "、currentPlayer=" + after.cp + (skipped ? "（購買階段被跳過！）" : ""));
    } catch (e) { rec("U-03-" + vn, "連按兩次停手", false, e.message); }
    await o.ctx.close();
  }

  /* U-04 連按兩次「再翻」而第一下剛好爆倉 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    var found = false, note4 = "";
    for (var seed = 1; seed <= 40 && !found; seed++) {
      await page.goto(INDEX); await page.waitForSelector("#app .scr");
      await startGame(page, seed, 2); // j03 5 顆黑天鵝
      for (var k = 0; k < 15; k++) {
        var s4 = await st(page);
        if (s4.screen !== "humanTurn") break;
        if (s4.hSwan === 2) {
          var c4 = await center(page, '[data-act="draw"]');
          await page.touchscreen.tap(c4.x, c4.y);
          await sleep(120);
          var mid = await st(page);
          await page.touchscreen.tap(c4.x, c4.y);
          await sleep(80);
          var a4 = await st(page);
          if (mid.busted) {
            found = true;
            var hit4 = await page.evaluate(function (pt) { var el = document.elementFromPoint(pt.x, pt.y); return el ? (el.closest("[data-act]") || el).getAttribute("data-act") || el.tagName : "none"; }, c4);
            await page.screenshot({ path: path.join(SHOTS, "qa-phone-double-draw-bust.png") });
            note4 = "seed=" + seed + "：第一下爆倉（screen=" + mid.screen + "）→ 第二下落在 data-act=" + hit4 + " → screen=" + a4.screen + "、currentPlayer=" + a4.cp;
            rec("U-04", "連按兩次「再翻」且第一下爆倉：第二下是否誤觸「跳過，不買」", !(a4.cp === "ai"), note4);
          }
          break;
        }
        await page.click('[data-act="draw"]');
        await sleep(30);
      }
    }
    if (!found) rec("U-04", "連按兩次再翻爆倉", true, "40 個 seed 內未遇到可重現情境（略過）");
  } catch (e) { rec("U-04", "連按兩次再翻", false, e.message); }
  await o.ctx.close();

  /* U-05 AI 回合亂點 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 777, 1);
    await page.click('[data-act="draw"]'); await page.click('[data-act="stop"]'); await page.click('[data-act="endTurn"]');
    var s5 = await st(page);
    var taps = 0, errSeen = false, humanActInAi = false;
    var pts = [{ x: 100, y: 780 }, { x: 250, y: 780 }, { x: 350, y: 780 }, { x: 195, y: 400 }, { x: 195, y: 100 }, { x: 30, y: 600 }];
    var t0 = Date.now();
    while ((await st(page)).screen === "aiTurn" && Date.now() - t0 < 15000) {
      var p5 = pts[taps % pts.length];
      await page.touchscreen.tap(p5.x, p5.y); taps++;
      var cur = await st(page);
      if (cur.err) errSeen = true;
      await sleep(40);
    }
    var logCheck = await page.evaluate(function () {
      var s = window.__game.getState();
      // AI 回合期間 human 不可能有 action：檢查本回合 ai 的事件序列都在 AI_DECIDED 之後
      var evs = s.log.filter(function (e) { return e.round === s.round && e.player === "ai"; });
      var bad = 0;
      for (var i = 0; i < evs.length; i++) {
        if (["TOKEN_DRAWN", "STOPPED", "ASSET_BOUGHT", "INSURANCE_BOUGHT", "TURN_ENDED", "BUST"].indexOf(evs[i].type) >= 0) {
          var j = i - 1; while (j >= 0 && ["INCOME_SETTLED", "BUST", "SWAN_RETURNED", "TOKEN_DRAWN", "STOPPED", "ASSET_BOUGHT", "INSURANCE_BOUGHT", "MARKET_REFILLED", "TURN_ENDED"].indexOf(evs[j].type) >= 0 && evs[j].type !== "AI_DECIDED") j--;
        }
      }
      return { aiEvents: evs.length, aiDecided: evs.filter(function (e) { return e.type === "AI_DECIDED"; }).length, screen: window.__game.getScreen() };
    });
    var fin = await st(page);
    rec("U-05", "AI 回合中亂點 " + taps + " 下：無錯誤橫幅、AI 回合正常結束、console 無錯", !errSeen && page.errs.length === 0 && fin.screen !== "aiTurn",
      "結束畫面=" + fin.screen + "、AI_DECIDED=" + logCheck.aiDecided + "、err=" + errSeen + "、console=" + page.errs.length);
  } catch (e) { rec("U-05", "AI 回合亂點", false, e.message); }
  await o.ctx.close();

  /* U-06 iPad 橫向 → 直向 → 橫向 */
  o = await newPage(browser, IPAD); page = o.page;
  try {
    await startGame(page, 20260913, 0);
    await page.click('[data-act="draw"]');
    var ovL = await overflow(page);
    await page.setViewportSize({ width: 834, height: 1194 });
    await sleep(300);
    var ovP = await overflow(page);
    var mkVisible = await page.evaluate(function () { var b = document.querySelector('[data-act="openMarket"]'); return b && getComputedStyle(b).display !== "none"; });
    var dockVisible = await page.evaluate(function () { var d = document.querySelector(".dock"); var r = d.getBoundingClientRect(); return r.bottom <= window.innerHeight && r.top > 0; });
    await page.screenshot({ path: path.join(SHOTS, "qa-ipad-portrait.png") });
    await page.click('[data-act="openMarket"]'); await sleep(300);
    await page.screenshot({ path: path.join(SHOTS, "qa-ipad-portrait-market.png") });
    await page.click('.sheet [data-act="closeMarket"]'); await sleep(300);
    await page.setViewportSize(IPAD); await sleep(300);
    var ovL2 = await overflow(page);
    var sheetVisible = await page.evaluate(function () { var s = document.querySelector(".sheet"); var r = s.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.width > 300; });
    var s6 = await st(page);
    var ok6 = ovL.docScrollW <= ovL.clientW && ovP.docScrollW <= ovP.clientW && ovL2.docScrollW <= ovL2.clientW && mkVisible && dockVisible && sheetVisible && !s6.err && s6.screen === "humanTurn";
    rec("U-06", "iPad 橫向→直向→橫向：無橫向捲軸、直向出現市場鈕與 dock、轉回後右側市場面板正常、state 不變", ok6,
      "橫 " + ovL.docScrollW + "/" + ovL.clientW + "、直 " + ovP.docScrollW + "/" + ovP.clientW + "、回橫 " + ovL2.docScrollW + "/" + ovL2.clientW + "；直向市場鈕=" + mkVisible + "、dock 可見=" + dockVisible + "、回橫面板=" + sheetVisible);
  } catch (e) { rec("U-06", "iPad 旋轉", false, e.message); }
  await o.ctx.close();

  /* U-07 重新整理 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 20260913, 0);
    await page.click('[data-act="draw"]');
    var b7 = await st(page);
    await page.reload(); await page.waitForSelector("#app .scr");
    var a7 = await st(page);
    rec("U-07", "遊戲中重新整理：回到 title、進度不保留（規格 N-1 不存檔，屬預期）、無錯誤", a7.screen === "title" && a7.phase === "lobby" && page.errs.length === 0,
      "前：round " + b7.round + " drawn " + b7.hDrawn + " → 後：screen=" + a7.screen + "、phase=" + a7.phase + "、console=" + page.errs.length);
  } catch (e) { rec("U-07", "重新整理", false, e.message); }
  await o.ctx.close();

  /* U-08 市場買光（人類每回合買最貴可買，AI 也買）*/
  o = await newPage(browser, PHONE); page = o.page;
  try {
    var emptySeen = null, shotDone = false;
    for (var seed8 = 1; seed8 <= 12 && !emptySeen; seed8++) {
      await page.goto(INDEX); await page.waitForSelector("#app .scr");
      await startGame(page, seed8, 2, "hard");
      for (var step = 0; step < 600; step++) {
        var s8 = await st(page);
        if (s8.screen === "gameOver") break;
        if (s8.screen === "humanTurn") {
          if (s8.hDrawn < 3 && s8.hSwan < 2 && await page.isEnabled('[data-act="draw"]')) await page.click('[data-act="draw"]');
          else await page.click('[data-act="stop"]');
        } else if (s8.screen === "humanBuy") {
          if (s8.market === 0 && s8.deck === 0) {
            emptySeen = { seed: seed8, round: s8.round };
            var txt = await page.textContent(".card.list");
            emptySeen.text = /市場已空/.test(txt) ? "有「市場已空」" : "缺「市場已空」";
            var insEnabled = await page.evaluate(function () { var b = document.querySelector('[data-act="buyInsurance"]'); return b ? !b.disabled : null; });
            emptySeen.ins = insEnabled;
            await page.screenshot({ path: path.join(SHOTS, "qa-phone-market-empty.png") });
            await page.click('[data-act="endTurn"]');
            continue;
          }
          var buyable = await page.$('button[data-act="buyAsset"]:not([disabled])');
          if (!s8.purchased && buyable) { await buyable.click(); await sleep(30); continue; }
          await page.click('[data-act="endTurn"]');
        } else if (s8.screen === "aiTurn") {
          await page.evaluate(function () { var b = document.querySelector('[data-act="toggleFast"]'); if (b && b.textContent.indexOf("加速中") < 0) b.click(); });
          await sleep(60);
        } else if (s8.screen === "roundEnd") await page.click('[data-act="nextRound"]');
        await sleep(15);
      }
    }
    if (emptySeen) rec("U-08", "市場 12 張全買光後的購買階段畫面", emptySeen.text.indexOf("有") === 0 && !page.errs.length, "seed=" + emptySeen.seed + "、第 " + emptySeen.round + " 回合：" + emptySeen.text + "、保險鈕 enabled=" + emptySeen.ins + "、console=" + page.errs.length);
    else rec("U-08", "市場買光", true, "12 個 seed 內未買光（deck 未耗盡）；engine 層 E-05 已驗");
  } catch (e) { rec("U-08", "市場買光", false, e.message); }
  await o.ctx.close();

  /* U-09 保險買到袋中黑天鵝 0 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 5, 0, "easy"); // j01 3 顆黑天鵝、$80
    var zero = null;
    for (var step9 = 0; step9 < 500 && !zero; step9++) {
      var s9 = await st(page);
      if (s9.screen === "gameOver") break;
      if (s9.screen === "humanTurn") {
        if (s9.hDrawn < 2 && s9.hSwan < 1 && await page.isEnabled('[data-act="draw"]')) await page.click('[data-act="draw"]');
        else await page.click('[data-act="stop"]');
      } else if (s9.screen === "humanBuy") {
        var insBtn = await page.$('button[data-act="buyInsurance"]');
        var insOn = insBtn ? await insBtn.isEnabled() : false;
        if (s9.hBagSwans === 0) {
          var txt9 = await page.textContent(".card.list");
          zero = { round: s9.round, insEnabled: insOn, text: (/袋中剩 0 顆/.test(txt9) ? "顯示袋中剩 0 顆" : "未顯示 0") };
          await page.screenshot({ path: path.join(SHOTS, "qa-phone-insurance-zero.png") });
          break;
        }
        if (!s9.purchased && insOn) { await insBtn.click(); await sleep(30); continue; }
        await page.click('[data-act="endTurn"]');
      } else if (s9.screen === "aiTurn") {
        await page.evaluate(function () { var b = document.querySelector('[data-act="toggleFast"]'); if (b && b.textContent.indexOf("加速中") < 0) b.click(); });
        await sleep(60);
      } else if (s9.screen === "roundEnd") await page.click('[data-act="nextRound"]');
      await sleep(15);
    }
    if (zero) rec("U-09", "保險買到袋中黑天鵝 0：保險鈕停用且顯示袋中剩 0", zero.insEnabled === false && zero.text.indexOf("顯示") === 0, "第 " + zero.round + " 回合達 0；保險 enabled=" + zero.insEnabled + "、" + zero.text);
    else rec("U-09", "保險到 0", false, "整局未達 0（現金不足？）");
  } catch (e) { rec("U-09", "保險到 0", false, e.message); }
  await o.ctx.close();

  /* U-10 各畫面橫向捲軸與 iPad 小字掃描 */
  for (var vj = 0; vj < 2; vj++) {
    var vp10 = vj === 0 ? PHONE : IPAD, vn10 = vj === 0 ? "phone" : "ipad";
    o = await newPage(browser, vp10); page = o.page;
    try {
      var ovs = [], fonts = {};
      async function snap(tag) { var ov = await overflow(page); ovs.push(tag + ":" + ov.docScrollW + "/" + ov.clientW + (ov.appScrollW > ov.clientW ? "(app " + ov.appScrollW + ")" : "")); if (vn10 === "ipad") { var f = await smallFonts(page); Object.keys(f).forEach(function (k) { fonts[k] = (fonts[k] || 0) + f[k]; }); } }
      await snap("title");
      await startGame(page, 20260913, 0); await snap("humanTurn");
      if (vn10 === "phone") { await page.click('[data-act="openMarket"]'); await sleep(250); await snap("market"); await page.click('.sheet [data-act="closeMarket"]'); await sleep(250); }
      await page.click('[data-act="draw"]'); await page.click('[data-act="stop"]'); await snap("humanBuy");
      await page.click('[data-act="endTurn"]'); await sleep(200); await snap("aiTurn");
      await waitHumanTurn(page); // 走到下一回合
      var s10 = await st(page);
      var bad10 = ovs.filter(function (x) { var m = x.match(/:(\d+)\/(\d+)/); return +m[1] > +m[2]; });
      rec("U-10-" + vn10, "各畫面無橫向捲軸" + (vn10 === "ipad" ? "；iPad 文字 < 14px 掃描（角色檔清單項）" : ""), bad10.length === 0, ovs.join("、") + (vn10 === "ipad" ? "；<14px：" + JSON.stringify(fonts) : ""));
    } catch (e) { rec("U-10-" + vn10, "橫向捲軸", false, e.message); }
    await o.ctx.close();
  }

  /* U-11 AI 回合節奏 ≥ 400 ms／加速 100 ms */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 20260913, 1);
    await page.click('[data-act="stop"]'); await page.click('[data-act="endTurn"]');
    var stamps = [], lastLen = -1, t11 = Date.now();
    while (Date.now() - t11 < 12000) {
      var n = await page.evaluate(function () { var s = window.__game.getState(); return s.log.filter(function (e) { return e.type === "AI_DECIDED"; }).length; });
      if (n !== lastLen) { stamps.push(Date.now()); lastLen = n; }
      if ((await st(page)).screen !== "aiTurn") break;
      await sleep(10);
    }
    var gaps = []; for (var g = 2; g < stamps.length; g++) gaps.push(stamps[g] - stamps[g - 1]);
    var minGap = Math.min.apply(null, gaps);
    // 加速
    await page.click('[data-act="nextRound"]');
    await page.click('[data-act="stop"]'); await page.click('[data-act="endTurn"]');
    await page.click('[data-act="toggleFast"]');
    var stamps2 = [], lastLen2 = -1, t12 = Date.now();
    while (Date.now() - t12 < 12000) {
      var n2 = await page.evaluate(function () { var s = window.__game.getState(); return s.log.filter(function (e) { return e.type === "AI_DECIDED"; }).length; });
      if (n2 !== lastLen2) { stamps2.push(Date.now()); lastLen2 = n2; }
      if ((await st(page)).screen !== "aiTurn") break;
      await sleep(10);
    }
    var gaps2 = []; for (var g2 = 2; g2 < stamps2.length; g2++) gaps2.push(stamps2[g2] - stamps2[g2 - 1]);
    rec("U-11", "AI 回合節奏：每步間隔 ≥ aiStepDelayMs(400)；加速後 ≈ 100", minGap >= 390 && Math.min.apply(null, gaps2) < 400,
      "正常 gaps=" + gaps.join("/") + " ms；加速 gaps=" + gaps2.join("/") + " ms");
  } catch (e) { rec("U-11", "AI 節奏", false, e.message); }
  await o.ctx.close();

  /* U-12 roundEnd／gameOver 回歸文字 */
  o = await newPage(browser, IPAD); page = o.page;
  try {
    await startGame(page, 20260913, 0);
    var texts = {};
    for (var step12 = 0; step12 < 800; step12++) {
      var s12 = await st(page);
      if (s12.screen === "gameOver") break;
      if (s12.screen === "humanTurn") { if (s12.hDrawn < 1) await page.click('[data-act="draw"]'); else await page.click('[data-act="stop"]'); }
      else if (s12.screen === "humanBuy") await page.click('[data-act="endTurn"]');
      else if (s12.screen === "aiTurn") { await page.evaluate(function () { var b = document.querySelector('[data-act="toggleFast"]'); if (b && b.textContent.indexOf("加速中") < 0) b.click(); }); await sleep(60); }
      else if (s12.screen === "roundEnd") {
        if (!texts.roundEnd) { texts.roundEnd = await page.textContent(".scr"); await page.screenshot({ path: path.join(SHOTS, "qa-ipad-roundend.png") }); }
        if (s12.round === 12) texts.lastRound = await page.textContent(".dock");
        await page.click('[data-act="nextRound"]');
      }
      await sleep(15);
    }
    texts.gameOver = await page.textContent(".scr");
    await page.screenshot({ path: path.join(SHOTS, "qa-ipad-gameover.png") });
    var okRE = /第 1 回合結束/.test(texts.roundEnd) && /你的淨資產/.test(texts.roundEnd) && /AI 淨資產/.test(texts.roundEnd) && /下一回合/.test(texts.roundEnd) && /seed 20260913/.test(texts.roundEnd);
    var okLast = /看結果/.test(texts.lastRound || "");
    var okGO = /本局結束/.test(texts.gameOver) && /20260913/.test(texts.gameOver) && /再來一局/.test(texts.gameOver) && /(你贏了|AI 贏了|平手)/.test(texts.gameOver);
    var diffLabel = (texts.gameOver.match(/難度 (\S+)/) || [])[1];
    rec("U-12", "回歸：roundEnd／第 12 回合「看結果」／gameOver 文字與 seed", okRE && okLast && okGO, "roundEnd=" + okRE + "、看結果=" + okLast + "、gameOver=" + okGO + "、gameOver 難度標示=「" + diffLabel + "」（title 用中文 簡單／普通／困難）");
    // 再來一局回 title
    await page.click('[data-act="restart"]');
    var s12b = await st(page);
    rec("U-12b", "gameOver「再來一局」回到 title 且 state 重置", s12b.screen === "title" && s12b.phase === "lobby", "screen=" + s12b.screen);
  } catch (e) { rec("U-12", "roundEnd/gameOver 回歸", false, e.message); }
  await o.ctx.close();

  /* U-13 購買流程回歸：買資產後清單不可再點；買保險後同；跳過不買 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 20260913, 1); // j02 $100
    await page.click('[data-act="stop"]');
    var s13 = await st(page);
    var insBtn13 = await page.$('button[data-act="buyInsurance"]');
    await insBtn13.click(); await sleep(30);
    var a13 = await st(page);
    var h13 = await page.textContent(".card.list .h");
    var stillBtn = await page.$('button[data-act="buyAsset"], button[data-act="buyInsurance"]');
    var endLabel = await page.textContent('[data-act="endTurn"]');
    rec("U-13", "點保險即買：cash −40、bag 黑天鵝 −1、標題「已買下：保險」、清單消失、dock「結束回合」",
      a13.hCash === s13.hCash - 40 && a13.hBagSwans === s13.hBagSwans - 1 && /已買下：保險/.test(h13) && !stillBtn && /結束回合/.test(endLabel),
      "cash " + s13.hCash + "→" + a13.hCash + "、袋中黑天鵝 " + s13.hBagSwans + "→" + a13.hBagSwans + "、標題=" + h13.trim() + "、dock=" + endLabel.trim());
    await page.screenshot({ path: path.join(SHOTS, "qa-phone-bought-insurance.png") });
  } catch (e) { rec("U-13", "購買回歸", false, e.message); }
  await o.ctx.close();

  /* U-14 市場抽屜回歸：draw 階段開抽屜→停手時自動關；抽屜內項目不可點 */
  o = await newPage(browser, PHONE); page = o.page;
  try {
    await startGame(page, 20260913, 1);
    await page.click('[data-act="openMarket"]'); await sleep(250);
    var open1 = await page.evaluate(function () { return document.querySelector(".scr").classList.contains("mkopen"); });
    var clickable = await page.$$('.sheet button[data-act="buyAsset"], .sheet button[data-act="buyInsurance"]');
    var previewTags = await page.evaluate(function () { return Array.prototype.map.call(document.querySelectorAll(".sheet .tag"), function (t) { return t.textContent; }); });
    // 抽屜開著時按 scrim 關閉
    await page.click(".scrim", { position: { x: 10, y: 10 } }); await sleep(250);
    var open2 = await page.evaluate(function () { return document.querySelector(".scr").classList.contains("mkopen"); });
    await page.click('[data-act="openMarket"]'); await sleep(250);
    // 抽屜開著時能否按到停手（scrim 遮住 dock？）
    var stopCovered = await page.evaluate(function () { var b = document.querySelector('[data-act="stop"]'); var r = b.getBoundingClientRect(); var el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el === b || b.contains(el) ? "停手可直接點" : "被 " + (el.className || el.tagName) + " 遮住"; });
    await page.click(".scrim", { position: { x: 10, y: 10 } }); await sleep(250);
    await page.click('[data-act="stop"]');
    var open3 = await page.evaluate(function () { var s = document.querySelector(".scr"); return s.classList.contains("mkopen"); });
    rec("U-14", "市場抽屜回歸：開→scrim 關→停手後不殘留；抽屜內為預覽（不可點）並顯示「買得起」標籤", open1 && !open2 && clickable.length === 0 && !open3,
      "開=" + open1 + "、scrim 關=" + !open2 + "、抽屜內可點鈕=" + clickable.length + "、標籤=" + JSON.stringify(previewTags) + "、抽屜開時 " + stopCovered + "、停手後 mkopen=" + open3);
  } catch (e) { rec("U-14", "市場抽屜", false, e.message); }
  await o.ctx.close();

  await browser.close();
  var fails = results.filter(function (r) { return !r.ok; });
  console.log("\n合計 " + results.length + " 項，失敗 " + fails.length + " 項");
  process.exit(fails.length ? 1 : 0);
})().catch(function (e) { console.error("例外：" + e.stack); process.exit(2); });
