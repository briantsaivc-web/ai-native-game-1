#!/usr/bin/env node
"use strict";
/**
 * tests/ui/smoke.spec.js：Playwright 煙霧測試（規格 §9.2 T-UI-01～06；A-05～A-07）。
 * 純 Node 腳本：`node tests/ui/smoke.spec.js`（不用 @playwright/test runner，避免額外設定檔）。
 *
 * 兩種視窗各跑一次：手機直向 390×844、iPad 橫向 1194×834。
 * 每種視窗：開 file://index.html → 先輸入無效 seed 驗證提示不開局（T-UI-05）→ 選難度 normal、固定 seed → 選職業 →
 * 第 1 回合一直翻到爆倉（爆倉路徑）、之後每回合翻兩顆就停；buy 階段第一次遇到可買資產就點卡即買（購買路徑）、
 * 其餘跳過；連按「下一回合」直到 gameOver → 斷言 gameOver 出現且顯示 seed；
 * 第 1 回合結束畫面連點兩下「下一回合」、第 2 回合連點兩下「停手」（T-UI-06 雙擊防護，QA B-01）；
 * 沿途量測所有可點元素 ≥ 44×44（再翻／停手 ≥ 88 高）；console 無錯誤；
 * 截圖到 docs/qa/shots/smoke-{phone,ipad}-{play,gameover}.png。
 *
 * 瀏覽器：Chromium（環境變數 PLAYWRIGHT_BROWSERS_PATH 指向已安裝的瀏覽器）。
 * 找不到 playwright 套件或瀏覽器時印出可讀錯誤並以非 0 結束，不 hang。
 */
var path = require("path");
var fs = require("fs");

var ROOT = path.resolve(__dirname, "..", "..");
var INDEX = path.join(ROOT, "index.html");
var SHOTS = path.join(ROOT, "docs", "qa", "shots");
var SEED = 20260913;
var MIN_TAP = 44;
var MIN_BIG = 88;
var MAX_STEPS = 2000;
var BUST_ROUND = 1; // 這一回合人類一直翻到爆倉，覆蓋爆倉路徑
var DOUBLE_TAP_ROUND = 2; // T-UI-06：第 1 回合結束連點「下一回合」、第 2 回合開頭連點「停手」

var VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "ipad", width: 1194, height: 834 }
];

var playwright;
try {
  playwright = require("playwright");
} catch (e) {
  console.error("T-UI：找不到 playwright 套件（" + e.message.split("\n")[0] + "）。");
  console.error("請執行：npm i -D playwright（並設定 PLAYWRIGHT_BROWSERS_PATH 指向已安裝的 Chromium），或標記 UNKNOWN 改用靜態檢查。");
  process.exit(2);
}

function log(s) { console.log(s); }

/** 量測目前畫面所有可點元素；回傳違規清單。 */
async function measureTaps(page, tag) {
  var boxes = await page.evaluate(function () {
    var els = document.querySelectorAll("button, input, [data-act]");
    var out = [];
    els.forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      var label = (el.textContent || el.id || el.className || el.tagName).trim().slice(0, 20);
      out.push({ label: label, act: el.getAttribute("data-act") || "", cls: el.className, w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out;
  });
  var bad = [];
  boxes.forEach(function (b) {
    if (b.act === "closeMarket" && /scrim/.test(b.cls)) return; // 遮罩整面可點，不是按鈕
    if (b.w < MIN_TAP || b.h < MIN_TAP) bad.push(tag + "：" + b.label + " " + b.w + "×" + b.h + " < " + MIN_TAP);
    if ((b.act === "draw" || b.act === "stop") && b.h < MIN_BIG) bad.push(tag + "：" + b.label + " 高 " + b.h + " < " + MIN_BIG);
  });
  return { count: boxes.length, bad: bad };
}

async function runViewport(browser, vp) {
  var result = { name: vp.name, ok: true, errors: [], consoleErrors: [], tapViolations: [], tapCount: 0, screensMeasured: [], steps: 0, rounds: 0, doubleTap: [] };
  var context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: vp.name === "phone" });
  var page = await context.newPage();
  page.on("console", function (msg) { if (msg.type() === "error") result.consoleErrors.push(msg.text()); });
  page.on("pageerror", function (err) { result.consoleErrors.push("pageerror: " + err.message); });

  var measured = {};
  async function measureOnce(tag) {
    if (measured[tag]) return;
    measured[tag] = true;
    var m = await measureTaps(page, tag);
    result.tapCount += m.count;
    result.tapViolations = result.tapViolations.concat(m.bad);
    result.screensMeasured.push(tag + "(" + m.count + ")");
  }
  async function screen() { return page.evaluate(function () { return window.__game ? window.__game.getScreen() : "none"; }); }
  /** 等操作列冷卻結束（換畫面後 dock 按鈕會短暫 disabled；QA B-01 修法）。 */
  async function waitDock() { await page.waitForFunction(function () { return !document.querySelector(".dock .cool"); }, null, { timeout: 5000 }); }
  /** 在同一座標連點兩下（以 mouse.click 直接打座標，不等待元素可用，模擬拇指雙擊）。 */
  async function doubleTap(selector) {
    var box = await page.locator(selector).boundingBox();
    if (!box) throw new Error("doubleTap：找不到 " + selector);
    var x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await page.waitForTimeout(600); // 大於 dockCooldownMs（350）
  }
  async function stateInfo() {
    return page.evaluate(function () {
      var s = window.__game.getState();
      var humanDrawsThisRound = s.log.filter(function (e) { return e.player === "human" && e.round === s.round && (e.type === "TOKEN_DRAWN" || e.type === "STOPPED"); }).length;
      return { round: s.round, phase: s.phase, cp: s.currentPlayer, drawn: s.players.human.drawn.length, swan: s.players.human.blackSwanCount, seed: s.seed,
        busted: s.players.human.busted, purchased: s.purchasedThisTurn, assets: s.players.human.assets.length, cash: s.players.human.cash,
        pending: s.players.human.pendingIncome, humanDrawsThisRound: humanDrawsThisRound };
    });
  }

  try {
  await page.goto("file://" + INDEX);
  await page.waitForSelector("#app .scr", { timeout: 10000 });

  // T-UI-01：載入無錯誤
  if ((await screen()) !== "title") result.errors.push("開頁後畫面不是 title");
  await measureOnce("title");

  // T-UI-05：無效 seed → 顯示提示且不開局（G4.5 第 9 列）
  await page.click('[data-act="difficulty"][data-v="normal"]');
  await page.fill("#seedInput", "abc");
  await page.click('[data-act="toJobSelect"]');
  if ((await screen()) !== "jobSelect") result.errors.push("按「開始」後未進 jobSelect");
  await measureOnce("jobSelect");
  await page.click('[data-act="job"] >> nth=0');
  await page.click('[data-act="start"]');
  var errText = await page.textContent(".err").catch(function () { return ""; });
  if (!/牌局代碼需為 0–4294967295 的整數/.test(errText || "")) result.errors.push("無效 seed 未顯示提示：" + errText);
  if ((await screen()) !== "jobSelect") result.errors.push("無效 seed 仍開局了：" + (await screen()));
  await page.click('[data-act="dismissError"]');

  // 難度 normal ＋ 固定 seed（回 title 填正確代碼）
  await page.click('[data-act="toTitle"]');
  await page.fill("#seedInput", String(SEED));
  await page.click('[data-act="toJobSelect"]');
  await page.click('[data-act="job"] >> nth=0');
  await page.click('[data-act="start"]');
  var si = await stateInfo();
  if (si.seed !== SEED) result.errors.push("seed 未依輸入固定：" + si.seed);

  // T-UI-02：自動走完一局
  var playShot = false;
  var marketMeasured = false;
  var fastToggled = false;
  var bustSeen = false;
  var boughtOnce = false;
  var doubleNextDone = false;
  var doubleStopDone = false;
  for (var step = 0; step < MAX_STEPS; step++) {
    result.steps = step;
    var sc = await screen();
    await waitDock();
    var info = await stateInfo();
    result.rounds = info.round;
    if (sc === "gameOver") break;
    if (sc === "humanTurn") {
      await measureOnce("humanTurn");
      // T-UI-06（b）：第 2 回合一進人類回合就在「停手」同座標連點兩下 → 第二下不得落到購買畫面的「跳過，不買」。
      if (info.round === DOUBLE_TAP_ROUND && info.drawn === 0 && !doubleStopDone) {
        doubleStopDone = true;
        await doubleTap('[data-act="stop"]');
        var afterStop = await stateInfo();
        var scStop = await screen();
        if (!(scStop === "humanBuy" && afterStop.phase === "buy" && afterStop.cp === "human")) {
          result.doubleTap.push("連點「停手」後未停在購買階段：畫面 " + scStop + "、phase " + afterStop.phase + "、currentPlayer " + afterStop.cp);
        }
        continue;
      }
      if (vp.name === "phone" && !marketMeasured) {
        marketMeasured = true;
        await page.click('[data-act="openMarket"]');
        await page.waitForTimeout(300);
        await measureOnce("humanTurn+market");
        await page.click('.sheet [data-act="closeMarket"]');
        await page.waitForTimeout(300);
      }
      if (!playShot && info.round >= 2 && info.drawn >= 2) {
        playShot = true;
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SHOTS, "smoke-" + vp.name + "-play.png") });
      }
      var drawEnabled = await page.isEnabled('[data-act="draw"]');
      if (info.round === BUST_ROUND) {
        // 爆倉路徑：第 BUST_ROUND 回合一直翻到爆倉（j01 起始袋 3 顆黑天鵝、無保險籌碼，翻完必爆）。
        if (drawEnabled) await page.click('[data-act="draw"]');
        else { result.errors.push("爆倉回合：再翻鈕已停用但未爆倉（drawn " + info.drawn + "、swan " + info.swan + "）"); await page.click('[data-act="stop"]'); }
      } else if (drawEnabled && info.drawn < 2 && info.swan < 2) {
        // 其餘回合翻兩顆就停（黑天鵝已 2 顆時直接停），避免依賴運氣。
        await page.click('[data-act="draw"]');
      } else {
        await page.click('[data-act="stop"]');
      }
      await page.waitForTimeout(50);
    } else if (sc === "humanBuy") {
      await measureOnce("humanBuy");
      if (info.round === BUST_ROUND && !info.busted) result.errors.push("爆倉回合結束於 buy 階段但 busted=false");
      if (info.round === BUST_ROUND && info.busted && !bustSeen) {
        bustSeen = true;
        var bustTitle = await page.textContent(".bar .t");
        if (!/爆倉結算/.test(bustTitle || "")) result.errors.push("爆倉後標題非「爆倉結算」：" + bustTitle);
        await page.screenshot({ path: path.join(SHOTS, "smoke-" + vp.name + "-bust-buy.png") });
      }
      // 購買路徑（P-1 點卡即買）：第一次遇到「現在可買」的資產卡就點它，畫面與 state 必須立即反映。
      var buyable = await page.$('button[data-act="buyAsset"]:not([disabled])');
      if (!info.purchased && !boughtOnce && buyable) {
        boughtOnce = true;
        var cardName = await buyable.$eval(".n", function (el) { return el.firstChild ? el.firstChild.textContent : el.textContent; });
        await buyable.click();
        await page.waitForTimeout(50);
        var after = await stateInfo();
        if (!after.purchased) result.errors.push("點卡後 purchasedThisTurn 仍為 false");
        if (after.assets !== info.assets + 1) result.errors.push("點卡後資產數未 +1：" + info.assets + " → " + after.assets);
        if (after.cash >= info.cash) result.errors.push("點卡後現金未減少：" + info.cash + " → " + after.cash);
        var boughtText = await page.textContent(".card.list .h");
        if (!/已買下/.test(boughtText || "") || boughtText.indexOf(String(cardName).trim()) < 0) result.errors.push("點卡後畫面未顯示「已買下：" + cardName + "」：" + boughtText);
        if (await page.$('button[data-act="buyAsset"]')) result.errors.push("已買後市場清單仍可點");
        var endLabel = await page.textContent('[data-act="endTurn"]');
        if (!/結束回合/.test(endLabel || "")) result.errors.push("已買後 dock 未變為「結束回合」：" + endLabel);
        result.boughtRound = info.round;
        continue;
      }
      await page.click('[data-act="endTurn"]');
      await page.waitForTimeout(50);
    } else if (sc === "aiTurn") {
      await measureOnce("aiTurn");
      if (!fastToggled) { fastToggled = true; await page.click('[data-act="toggleFast"]'); }
      await page.waitForTimeout(150);
    } else if (sc === "roundEnd") {
      await measureOnce("roundEnd");
      // T-UI-06（a）：第 1 回合結束畫面在「下一回合」同座標連點兩下 → 第二下不得打到新回合的「再翻」／「停手」。
      if (info.round === DOUBLE_TAP_ROUND - 1 && !doubleNextDone) {
        doubleNextDone = true;
        await doubleTap('[data-act="nextRound"]');
        var afterNext = await stateInfo();
        var scNext = await screen();
        if (!(scNext === "humanTurn" && afterNext.round === DOUBLE_TAP_ROUND && afterNext.phase === "draw" && afterNext.cp === "human")) {
          result.doubleTap.push("連點「下一回合」後畫面異常：" + scNext + "、第 " + afterNext.round + " 回合、phase " + afterNext.phase);
        }
        if (afterNext.pending !== 0 || afterNext.drawn !== 0 || afterNext.humanDrawsThisRound !== 0) {
          result.doubleTap.push("連點「下一回合」後第二下穿透：pendingIncome " + afterNext.pending + "、drawn " + afterNext.drawn + "、本回合 DRAW/STOP 事件 " + afterNext.humanDrawsThisRound);
        }
        continue;
      }
      await page.click('[data-act="nextRound"]');
      await page.waitForTimeout(50);
    } else {
      result.errors.push("未知畫面：" + sc);
      break;
    }
  }

  var finalScreen = await screen();
  if (finalScreen !== "gameOver") {
    result.errors.push("未在 " + MAX_STEPS + " 步內到達 gameOver（停在 " + finalScreen + "）");
  } else {
    await measureOnce("gameOver");
    var seedShown = await page.textContent("#seedText");
    if (String(seedShown).trim() !== String(SEED)) result.errors.push("gameOver 未顯示 seed：" + seedShown);
    var copyBtn = await page.$('[data-act="copySeed"]');
    if (!copyBtn) result.errors.push("gameOver 缺少複製 seed 按鈕");
    await page.screenshot({ path: path.join(SHOTS, "smoke-" + vp.name + "-gameover.png") });
  }
  if (!playShot) result.errors.push("未取得 play 截圖");
  if (!bustSeen) result.errors.push("未覆蓋爆倉路徑（第 " + BUST_ROUND + " 回合未爆倉）");
  if (!boughtOnce) result.errors.push("未覆蓋購買路徑（整局沒有可買的資產卡）");
  if (!doubleNextDone || !doubleStopDone) result.doubleTap.push("T-UI-06 未執行完整（下一回合 " + doubleNextDone + "、停手 " + doubleStopDone + "）");
  } catch (e) {
    result.errors.push("例外：" + String(e && e.message ? e.message : e).split("\n")[0]);
  }

  await context.close();
  if (result.errors.length || result.consoleErrors.length || result.tapViolations.length || result.doubleTap.length) result.ok = false;
  return result;
}

function checkNoExternal(html) {
  var shell = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  var bad = [];
  if (/https?:\/\//i.test(shell)) bad.push("HTML 標籤層含 http(s)://");
  if (/<link\b/i.test(shell)) bad.push("含 <link");
  if (/\bsrc\s*=/i.test(shell)) bad.push("含 src=");
  if (/@import/i.test(html)) bad.push("含 @import");
  return bad;
}

(async function main() {
  if (!fs.existsSync(INDEX)) {
    console.error("T-UI：找不到 " + INDEX + "，請先 npm run build。");
    process.exit(1);
  }
  fs.mkdirSync(SHOTS, { recursive: true });

  // T-UI-04：零外部資源（靜態）
  var ext = checkNoExternal(fs.readFileSync(INDEX, "utf8"));
  log("T-UI-04-no-external：" + (ext.length ? "FAIL " + ext.join("；") : "ok"));

  var browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (e) {
    console.error("T-UI：無法啟動 Chromium：" + e.message.split("\n")[0]);
    console.error("請確認 PLAYWRIGHT_BROWSERS_PATH（目前：" + (process.env.PLAYWRIGHT_BROWSERS_PATH || "未設定") + "）或執行 npx playwright install chromium。");
    process.exit(2);
  }

  var allOk = ext.length === 0;
  for (var i = 0; i < VIEWPORTS.length; i++) {
    var vp = VIEWPORTS[i];
    var r = await runViewport(browser, vp);
    log("");
    log("[" + vp.name + " " + vp.width + "×" + vp.height + "]");
    log("T-UI-01-loads：" + (r.consoleErrors.length ? "FAIL（console/page 錯誤 " + r.consoleErrors.length + "）" : "ok（console 無錯誤）"));
    log("T-UI-02-full-game：" + (r.errors.length ? "FAIL" : "ok") + "（" + r.steps + " 步、到第 " + r.rounds + " 回合、gameOver 顯示 seed " + SEED + "；第 " + BUST_ROUND + " 回合爆倉、第 " + (r.boughtRound || "—") + " 回合點卡買入；無效 seed 有提示）");
    log("T-UI-03-touch-size：" + (r.tapViolations.length ? "FAIL（" + r.tapViolations.length + " 項）" : "ok") + "（量測 " + r.tapCount + " 個可點元素；畫面：" + r.screensMeasured.join("、") + "）");
    log("T-UI-06-double-tap-guard：" + (r.doubleTap.length ? "FAIL（" + r.doubleTap.length + " 項）" : "ok（連點「下一回合」未穿透到新回合、連點「停手」仍停在購買階段）"));
    r.errors.forEach(function (m) { log("  - 錯誤：" + m); });
    r.doubleTap.forEach(function (m) { log("  - 雙擊：" + m); });
    r.consoleErrors.slice(0, 5).forEach(function (m) { log("  - console：" + m); });
    r.tapViolations.slice(0, 20).forEach(function (m) { log("  - 觸控：" + m); });
    if (!r.ok) allOk = false;
  }
  await browser.close();
  log("");
  log("截圖：" + VIEWPORTS.map(function (v) { return "docs/qa/shots/smoke-" + v.name + "-{bust-buy,play,gameover}.png"; }).join("、"));
  log(allOk ? "T-UI 全部通過" : "T-UI 有失敗項");
  process.exit(allOk ? 0 : 1);
})();
