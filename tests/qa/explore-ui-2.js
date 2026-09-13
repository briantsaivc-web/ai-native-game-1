#!/usr/bin/env node
"use strict";
/** tests/qa/explore-ui-2.js：U-03 落點精確化、U-09 重驗、平手顯示、AI 回合右側面板語意。 */
var path = require("path");
var fs = require("fs");
var playwright = require("playwright");
var ROOT = path.resolve(__dirname, "..", "..");
var INDEX = "file://" + path.join(ROOT, "index.html");
var SHOTS = path.join(ROOT, "docs", "qa", "shots");
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var browser = await playwright.chromium.launch({ headless: true });
  async function open(vp) {
    var ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: vp.width < 900 });
    var page = await ctx.newPage(); await page.goto(INDEX); await page.waitForSelector("#app .scr"); return { ctx: ctx, page: page };
  }
  async function start(page, seed, job, diff) {
    await page.click('[data-act="difficulty"][data-v="' + (diff || "normal") + '"]');
    await page.fill("#seedInput", String(seed)); await page.click('[data-act="toJobSelect"]');
    await page.click('[data-act="job"] >> nth=' + job); await page.click('[data-act="start"]');
  }
  var elAt = function (pt) { var el = document.elementFromPoint(pt.x, pt.y); var b = el && el.closest("[data-act]"); return b ? b.getAttribute("data-act") + "「" + b.textContent.trim().slice(0, 12) + "」" : (el ? el.tagName + "." + el.className : "none"); };

  /* U-03 精確：第一下後同座標是什麼 */
  for (var i = 0; i < 2; i++) {
    var vp = i === 0 ? { width: 390, height: 844 } : { width: 1194, height: 834 };
    var o = await open(vp), page = o.page;
    await start(page, 20260913, 1);
    await page.click('[data-act="draw"]');
    var b = await page.locator('[data-act="stop"]').boundingBox();
    var c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.touchscreen.tap(c.x, c.y);
    var after1 = await page.evaluate(elAt, c);
    var scr1 = await page.evaluate(function () { return window.__game.getScreen(); });
    await page.screenshot({ path: path.join(SHOTS, "qa-" + (i === 0 ? "phone" : "ipad") + "-after-first-stop.png") });
    await page.touchscreen.tap(c.x, c.y);
    var scr2 = await page.evaluate(function () { return window.__game.getScreen(); });
    console.log("[U-03-" + (i === 0 ? "phone" : "ipad") + "] 停手鈕中心 (" + Math.round(c.x) + "," + Math.round(c.y) + ")：第一下後畫面=" + scr1 + "、同座標元素=" + after1 + "；第二下後畫面=" + scr2);
    // 再翻鈕中心同理（第一下未爆倉時第二下只是再翻一顆；爆倉時落點如下）
    var bd = await page.locator('[data-act="draw"]').boundingBox().catch(function () { return null; });
    await o.ctx.close();
  }
  // 再翻鈕在 buy 畫面同座標是什麼（用 STOP 進 buy 後量測 draw 鈕原座標）
  {
    var o2 = await open({ width: 390, height: 844 }), page2 = o2.page;
    await start(page2, 20260913, 1);
    var bd2 = await page2.locator('[data-act="draw"]').boundingBox();
    var cd = { x: bd2.x + bd2.width / 2, y: bd2.y + bd2.height / 2 };
    await page2.click('[data-act="stop"]');
    console.log("[U-04-phone] 再翻鈕中心 (" + Math.round(cd.x) + "," + Math.round(cd.y) + ") 在購買畫面對應元素=" + (await page2.evaluate(elAt, cd)));
    await o2.ctx.close();
    var o3 = await open({ width: 1194, height: 834 }), page3 = o3.page;
    await start(page3, 20260913, 1);
    var bd3 = await page3.locator('[data-act="draw"]').boundingBox();
    var cd3 = { x: bd3.x + bd3.width / 2, y: bd3.y + bd3.height / 2 };
    await page3.click('[data-act="stop"]');
    console.log("[U-04-ipad] 再翻鈕中心 (" + Math.round(cd3.x) + "," + Math.round(cd3.y) + ") 在購買畫面對應元素=" + (await page3.evaluate(elAt, cd3)));
    await o3.ctx.close();
  }

  /* U-09 重驗：達 0 後下一次未購買的 buy 畫面 */
  {
    var o4 = await open({ width: 390, height: 844 }), page4 = o4.page;
    await start(page4, 5, 0, "easy");
    var done = false;
    for (var step = 0; step < 600 && !done; step++) {
      var s = await page4.evaluate(function () { var st = window.__game.getState(); return { screen: window.__game.getScreen(), swans: st.players.human.bag.filter(function (t) { return t === "blackSwan"; }).length, purchased: st.purchasedThisTurn, drawn: st.players.human.drawn.length, count: st.players.human.blackSwanCount, round: st.round }; });
      if (s.screen === "gameOver") break;
      if (s.screen === "humanTurn") {
        if (s.swans === 0 && s.drawn === 0) {
          var statusTxt = await page4.textContent(".body .card");
          console.log("[U-09] 翻牌畫面（袋中黑天鵝 0）狀態卡文字：" + statusTxt.replace(/\s+/g, " ").slice(0, 160));
        }
        if (s.drawn < 2 && s.count < 1 && await page4.isEnabled('[data-act="draw"]')) await page4.click('[data-act="draw"]'); else await page4.click('[data-act="stop"]');
      } else if (s.screen === "humanBuy") {
        if (s.swans === 0 && !s.purchased) {
          var listTxt = await page4.textContent(".card.list");
          var insOn = await page4.evaluate(function () { var b = document.querySelector('[data-act="buyInsurance"]'); return b ? !b.disabled : null; });
          var insCls = await page4.evaluate(function () { var b = document.querySelector('[data-act="buyInsurance"]'); return b ? b.className : null; });
          await page4.screenshot({ path: path.join(SHOTS, "qa-phone-insurance-zero.png") });
          console.log("[U-09] 第 " + s.round + " 回合購買畫面：保險 enabled=" + insOn + "、class=" + insCls + "、含「袋中剩 0 顆」=" + /袋中剩 0 顆/.test(listTxt));
          done = true;
        }
        var ib = await page4.$('button[data-act="buyInsurance"]:not([disabled])');
        if (!s.purchased && ib) { await ib.click(); await sleep(20); continue; }
        await page4.click('[data-act="endTurn"]');
      } else if (s.screen === "aiTurn") { await page4.evaluate(function () { var b = document.querySelector('[data-act="toggleFast"]'); if (b && b.textContent.indexOf("加速中") < 0) b.click(); }); await sleep(60); }
      else if (s.screen === "roundEnd") await page4.click('[data-act="nextRound"]');
      await sleep(10);
    }
    await o4.ctx.close();
  }

  /* U-15 AI 回合 iPad 右側面板：顯示的是 AI 的「買得起」與 AI 的袋子 */
  {
    var o5 = await open({ width: 1194, height: 834 }), page5 = o5.page;
    await start(page5, 20260913, 1);
    await page5.click('[data-act="stop"]'); await page5.click('[data-act="endTurn"]');
    await sleep(100);
    var sheet = await page5.evaluate(function () { var s = document.querySelector(".sheet"); var r = s.getBoundingClientRect(); return { visible: r.width > 0 && getComputedStyle(s).display !== "none", text: s.textContent.replace(/\s+/g, " ").slice(0, 300) }; });
    var st5 = await page5.evaluate(function () { var s = window.__game.getState(); return { hCash: s.players.human.cash, aCash: s.players.ai.cash, hSwans: s.players.human.bag.filter(function (t) { return t === "blackSwan"; }).length, aSwans: s.players.ai.bag.filter(function (t) { return t === "blackSwan"; }).length }; });
    await page5.screenshot({ path: path.join(SHOTS, "qa-ipad-aiturn-panel.png") });
    console.log("[U-15] AI 回合 iPad 右側面板 visible=" + sheet.visible + "；human cash=" + st5.hCash + "/袋中黑天鵝 " + st5.hSwans + "，ai cash=" + st5.aCash + "/袋中黑天鵝 " + st5.aSwans + "；面板文字：" + sheet.text);
    await o5.ctx.close();
  }

  /* U-16 roundEnd 平手文字（用程式路徑：無法在 UI 強制，改讀 renderRoundEnd 邏輯以 evaluate 模擬）*/
  {
    var o6 = await open({ width: 390, height: 844 }), page6 = o6.page;
    await start(page6, 20260913, 1);
    var txt = await page6.evaluate(function () {
      // 模擬 diff=0 時的顯示字串（app.js renderRoundEnd：diff >= 0 ? "領先" : "落後"）
      var diff = 0; return (diff >= 0 ? "領先" : "落後") + " $" + Math.abs(diff);
    });
    console.log("[U-16] roundEnd 兩人淨資產相同時顯示（依 app.js:360 邏輯）：「" + txt + "」");
    await o6.ctx.close();
  }

  await browser.close();
})().catch(function (e) { console.error(e.stack); process.exit(2); });
