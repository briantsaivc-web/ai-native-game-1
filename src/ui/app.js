"use strict";
/**
 * UI 層（規格 §8、ADR-001 §2.4）：只做「呈現 state、送出 action」。
 * - 所有規則數字一律讀 state／selectors／GAME_DATA，不在 UI 算規則。
 * - UI 自身狀態（目前畫面、抽屜開關、加速開關、動畫計數、複製提示、操作列冷卻）只存在本模組變數，不寫進 engine state。
 * - setTimeout 只用於 AI 回合的可視化節奏（balance.ui.aiStepDelayMs）與換畫面後的操作列冷卻（balance.ui.dockCooldownMs）；engine 無感。
 * - engine 拋出的錯誤在 dispatch 攔截並顯示橫幅，頁面不會死掉。
 */
var reducer = require("../engine/reducer");
var selectors = require("../engine/selectors");

var data = null;   // GAME_DATA（build 注入）
var root = null;   // <div id="app">
var state = null;  // engine state
var ui = {
  screen: "title",      // title | jobSelect（phase==="lobby" 時由 UI 決定）
  difficulty: "normal",
  seedInput: "",
  jobId: null,
  marketOpen: false,
  fast: false,
  aiTimer: null,
  error: null,
  copyMsg: "",          // gameOver 複製 seed 的結果提示
  flyKey: "",           // 上次渲染的「玩家:已翻顆數」，用來只讓新籌碼做飛入動畫
  lastScreen: null,     // 上次渲染的畫面名（screenName），用來偵測畫面切換
  coolTimer: null       // 操作列冷卻計時器（QA B-01／reviewer M-1：防止連點穿透到下一畫面）
};

/* ---------- 小工具 ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
  });
}
function money(n) { return (n < 0 ? "−$" : "$") + Math.abs(n); }
function signed(n) { return (n < 0 ? "−$" : "＋$") + Math.abs(n); }
function jobOf(pid) { return selectors.byId(data.jobs.jobs, state.players[pid].jobId); }
function tokenOf(id) { return selectors.byId(data.tokens.tokens, id); }
function cardOf(id) { return selectors.byId(data.assets.assets, id); }
function can(action) { return reducer.canApply(state, action, data); }
function isAiTurn() { return state.currentPlayer === "ai" && (state.phase === "draw" || state.phase === "buy"); }
/** 難度中文：讀 balance.ai.<level>.label（文案欄位，不寫在程式）；缺欄位時退回英文 key。 */
function diffLabel(level) {
  var p = data.balance.ai[level];
  return p && p.label ? p.label : String(level);
}

/** 依 tokens.json 順序輸出袋子摘要文字，例如「收入 5・黑天鵝 2」。 */
function bagText(pid) {
  var sum = selectors.bagSummary(state, pid);
  var groups = {};
  var order = [];
  for (var i = 0; i < data.tokens.tokens.length; i++) {
    var t = data.tokens.tokens[i];
    var n = sum[t.id] || 0;
    if (!n) continue;
    var label = t.kind === "income" ? "收入" : t.name;
    if (!groups[label]) { groups[label] = 0; order.push(label); }
    groups[label] += n;
  }
  return order.map(function (k) { return k + " " + groups[k]; }).join("・") || "空";
}

/** 資產卡效果說明（讀 assets.json 的 effect 與 tokensAdded，不寫死數字）。 */
function cardDesc(card) {
  var parts = [];
  if (card.tokensAdded && card.tokensAdded.length) {
    var cnt = {};
    var ord = [];
    card.tokensAdded.forEach(function (id) { if (!cnt[id]) { cnt[id] = 0; ord.push(id); } cnt[id]++; });
    parts.push("袋子加入 " + ord.map(function (id) {
      var t = tokenOf(id);
      var nm = t ? (t.kind === "income" ? "收入＋" + t.value : t.name) : id;
      return nm + " ×" + cnt[id];
    }).join("、"));
  }
  var e = card.effect || {};
  if (e.type === "SWAN_RETURN_ONCE") parts.push("每回合第一顆黑天鵝放回袋子");
  else if (e.type === "STOP_BONUS") parts.push("主動停手多拿 $" + e.param);
  else if (e.type === "NTH_INCOME_DOUBLE") parts.push("本回合第 " + e.param + " 顆收入籌碼價值翻倍");
  else if (e.type === "THRESHOLD_PLUS") parts.push("黑天鵝門檻 ＋" + e.param);
  parts.push("面值 $" + card.value + " 計入淨資產");
  return parts.join("；");
}

/**
 * 本回合某玩家收入籌碼的實際入帳序列（只讀 log 的 TOKEN_DRAWN.amount／doubled，規格 §4.1、R-26）。
 * 只取 kind==="income" 的事件；被 SWAN_RETURN_ONCE 退回的黑天鵝不是收入，故與 drawn 內收入籌碼順序一一對應。
 */
function incomeEvents(pid) {
  var out = [];
  for (var i = 0; i < state.log.length; i++) {
    var e = state.log[i];
    if (e.type !== "TOKEN_DRAWN" || e.player !== pid || e.round !== state.round) continue;
    var t = tokenOf(e.token);
    if (t && t.kind === "income") out.push(e);
  }
  return out;
}

/** 已翻出籌碼 → chip HTML。黑天鵝事件名依規格 §6.3：第 n 顆取 eventNames[(n−1) % length]。 */
function chipsHtml(pid, animateFrom) {
  var drawn = state.players[pid].drawn;
  if (!drawn.length) return '<span class="empty">還沒翻</span>';
  var swanN = 0, incomeN = 0;
  var incomes = incomeEvents(pid);
  var out = "";
  for (var i = 0; i < drawn.length; i++) {
    var t = tokenOf(drawn[i]);
    var cls = "chip", label = t ? t.name : drawn[i];
    if (t && t.kind === "income") {
      cls += " in";
      // 顯示 engine 事件的實際入帳 amount（翻倍後的值），不用面值自算；找不到事件時退回面值。
      var ev = incomes[incomeN++];
      var amt = ev && typeof ev.amount === "number" ? ev.amount : t.value;
      label = "＋" + amt;
      if (ev && ev.doubled) { cls += " x2"; }
    }
    else if (t && t.kind === "blackSwan") {
      swanN++;
      cls += " bs";
      var names = t.eventNames || [];
      label = names.length ? names[(swanN - 1) % names.length] : t.name;
    }
    else if (t && t.kind === "insurance") { cls += " ins"; label = "保險"; }
    else if (t && t.kind === "lucky") { cls += " lk"; label = "幸運"; }
    if (i >= animateFrom) cls += " fly";
    var mark = cls.indexOf(" x2") >= 0 ? '<small class="x2m">×2</small>' : "";
    out += '<span class="' + cls + '" style="animation-duration:' + data.balance.ui.tokenFlyMs + 'ms">' + esc(label) + mark + "</span>";
  }
  return out;
}

/** 從 log 讀某玩家某回合的摘要（只讀事件做播報，不算規則）。draws ＝ 實際進入 drawn 的顆數（退回的黑天鵝不計）。 */
function turnSummary(pid, round) {
  var s = { draws: 0, stopped: false, busted: false, income: null, cashBefore: null, cashAfter: null, bonus: 0, bought: null, insurance: false };
  for (var i = 0; i < state.log.length; i++) {
    var e = state.log[i];
    if (e.player !== pid || e.round !== round) continue;
    if (e.type === "TOKEN_DRAWN") s.draws++;
    else if (e.type === "SWAN_RETURNED") s.draws--; // 被 SWAN_RETURN_ONCE 退回的顆不進 drawn，與「已翻出 N 顆」一致（reviewer m-4）
    else if (e.type === "STOPPED") { s.stopped = true; s.bonus = e.bonus || 0; }
    else if (e.type === "BUST") s.busted = true;
    else if (e.type === "INCOME_SETTLED") { s.income = e.amount; s.cashAfter = e.cashAfter; s.cashBefore = e.cashAfter - e.amount; }
    else if (e.type === "ASSET_BOUGHT") s.bought = e.cardId;
    else if (e.type === "INSURANCE_BOUGHT") s.insurance = true;
  }
  return s;
}

/** AI 最近一次決策的中文播報（讀 log 尾端 AI_DECIDED）。 */
function aiNarration() {
  var last = null;
  for (var i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i].type === "AI_DECIDED" && state.log[i].round === state.round) { last = state.log[i]; break; }
    if (state.log[i].type === "TURN_ENDED" && state.log[i].player === "human" && state.log[i].round === state.round) break;
  }
  if (!last) return "AI 準備翻牌…";
  var d = last.decision || {};
  var r = last.reason;
  if (d.type === "DRAW") return "AI 再翻一顆";
  if (d.type === "STOP") {
    if (r === "swanStop") return "AI 停手：黑天鵝逼近門檻";
    if (r === "incomeStop") return "AI 停手：收入夠了";
    if (r === "noCandidates") return "AI 停手：袋子翻完了";
    return "AI 停手";
  }
  if (d.type === "BUY_ASSET") { var c = cardOf(d.cardId); return "AI 買下「" + (c ? c.name : d.cardId) + "」"; }
  if (d.type === "BUY_INSURANCE") return "AI 買了保險";
  if (d.type === "END_TURN") return "AI 結束回合";
  return "AI 行動中";
}

/* ---------- 各畫面 ---------- */

function errHtml() {
  if (!ui.error) return "";
  return '<div class="err"><span>' + esc(ui.error) + '</span><button type="button" data-act="dismissError">知道了</button></div>';
}

function renderTitle() {
  var diffs = Object.keys(data.balance.ai);
  var ver = (typeof window !== "undefined" && window.GAME_VERSION) ? "v" + window.GAME_VERSION : ""; // build 由 package.json 注入
  return '<section class="scr"><div class="bar"><span class="t">見好就收</span><span class="s">夜市攤主・' + data.balance.rounds + ' 回合' + (ver ? '<span class="ver">' + esc(ver) + '</span>' : '') + '</span></div>' +
    '<div class="full"><div class="body">' + errHtml() +
    '<div class="title-hero"><h1>見好就收</h1><p>翻籌碼賺錢，黑天鵝翻到 ' + data.balance.blackSwanThreshold + ' 顆就爆倉。' + data.balance.rounds + ' 回合後淨資產高者勝。</p></div>' +
    '<div class="card"><div class="h"><span>AI 難度</span></div><div class="seg">' +
    diffs.map(function (d) {
      return '<button type="button" data-act="difficulty" data-v="' + d + '" class="' + (ui.difficulty === d ? "on" : "") + '">' + esc(diffLabel(d)) + "</button>";
    }).join("") + "</div></div>" +
    '<div class="card"><div class="field"><label for="seedInput">牌局代碼（seed）</label>' +
    '<input id="seedInput" inputmode="numeric" pattern="[0-9]*" placeholder="留空＝自動產生" value="' + esc(ui.seedInput) + '">' +
    '<span class="hint">輸入同一組代碼可重玩同一局；結束畫面會顯示本局代碼。</span></div></div>' +
    '</div><div class="dock"><button type="button" class="dk go" data-act="toJobSelect">開始</button></div></div></section>';
}

function renderJobSelect() {
  var jobs = data.jobs.jobs;
  var th = data.balance.blackSwanThreshold;
  var icons = ["🍢", "🍗", "🧋"];
  return '<section class="scr"><div class="bar"><span class="t">見好就收</span><span class="s">夜市攤主・' + data.balance.rounds + ' 回合</span></div>' +
    '<div class="full"><div class="body">' + errHtml() +
    '<div class="hero"><h1>選擇你的攤位</h1><p>職業決定起始現金與袋子裡的籌碼。</p></div><div class="jobs">' +
    jobs.map(function (j, idx) {
      var total = 0, dots = "";
      data.tokens.tokens.forEach(function (t) {
        var n = j.startBag[t.id] || 0;
        total += n;
        var cls = t.kind === "blackSwan" ? "b" : (t.id === "income_m" ? "m" : (t.id === "income_l" ? "l" : ""));
        for (var k = 0; k < n; k++) dots += "<i" + (cls ? ' class="' + cls + '"' : "") + "></i>";
      });
      return '<button type="button" class="job ' + (ui.jobId === j.id ? "sel" : "") + '" data-act="job" data-v="' + j.id + '">' +
        '<div class="ic">' + icons[idx % icons.length] + '</div><div><div class="nm">' + esc(j.name) + " <small>" + esc(j.style) + "</small></div>" +
        '<div class="meta">起始 $' + j.startCash + "・門檻 " + th + "・袋子 " + total + " 顆</div>" +
        '<div class="fl">' + esc(j.flavor || "") + '</div><div class="dots">' + dots + '</div></div><div class="chk"></div></button>';
    }).join("") + "</div></div>" +
    '<div class="dock"><button type="button" class="dk ghost" data-act="toTitle">返回</button>' +
    '<button type="button" class="dk go" data-act="start" ' + (ui.jobId ? "" : "disabled") + ">開始這一季</button></div></div></section>";
}

/**
 * 市場清單。兩種語意、兩種樣式（規格 §8.3；G4.5 第 2、3 列）：
 * - interactive（buy 階段）：「現在可買」＝ `canApply` 為真，點卡即送出 BUY_*（P-1 點卡即買）；否則淡色停用。
 * - 預覽（draw 階段抽屜／AI 回合）：「買得起」＝ 現金足夠（保險另需袋中還有黑天鵝），只是預告，停手後才能購買。
 */
function marketItems(interactive) {
  var p = state.players[state.currentPlayer];
  var bagSwans = selectors.bagBlackSwanCount(state, state.currentPlayer);
  var html = "";
  function tag(ok) {
    if (!ok) return "";
    return interactive ? '<span class="tag now">現在可買</span>' : '<span class="tag afford">買得起</span>';
  }
  state.market.forEach(function (id) {
    var c = cardOf(id);
    if (!c) return;
    var ok = interactive ? can({ type: "BUY_ASSET", cardId: id }) : p.cash >= c.cost;
    var cls = "item" + (ok ? (interactive ? " now" : " afford") : " dim");
    var inner = '<div class="ic">🏪</div><div class="tx"><div class="n">' + esc(c.name) + tag(ok) + '</div><div class="d">' + esc(cardDesc(c)) + '</div></div><div class="p">$' + c.cost + "</div>";
    html += interactive
      ? '<button type="button" class="' + cls + '" data-act="buyAsset" data-v="' + id + '" ' + (ok ? "" : "disabled") + ">" + inner + "</button>"
      : '<div class="' + cls + '">' + inner + "</div>";
  });
  var insOk = interactive ? can({ type: "BUY_INSURANCE" }) : (p.cash >= data.balance.insuranceCost && bagSwans > 0);
  var insCls = "item" + (insOk ? (interactive ? " now" : " afford") : " dim");
  var insInner = '<div class="ic ins">🛡️</div><div class="tx"><div class="n">保險' + tag(insOk) + '</div><div class="d">從袋子永久移除 1 顆黑天鵝（袋中剩 ' + bagSwans + " 顆）</div></div>" +
    '<div class="p">$' + data.balance.insuranceCost + "</div>";
  html += interactive
    ? '<button type="button" class="' + insCls + '" data-act="buyInsurance" ' + (insOk ? "" : "disabled") + ">" + insInner + "</button>"
    : '<div class="' + insCls + '">' + insInner + "</div>";
  if (!state.market.length) html += '<div class="mrow">市場已空</div>';
  html += '<div class="mrow legend">' + (interactive
    ? "「現在可買」＝點一下立即買入；淡色＝現金不足或不可買"
    : "「買得起」＝現金足夠、停手後才能購買；淡色＝現金不足或不可買") + "</div>";
  return html;
}

function statusCard(pid, animateFrom) {
  var p = state.players[pid];
  var th = selectors.threshold(state, pid, data);
  var meter = "";
  for (var i = 0; i < th; i++) meter += "<i class=\"" + (i < p.blackSwanCount ? "f" : "") + (i === th - 1 ? " last" : "") + "\"></i>";
  // G4.5 第 8 列：只說「黑天鵝值再增加 N 點即爆倉」（N ＝ 門檻 − 目前值，兩者皆 engine 提供），不推算「第幾顆才爆」。
  var left = th - p.blackSwanCount;
  var bagSwans = selectors.bagBlackSwanCount(state, pid);
  var who = pid === "human" ? "" : "AI ";
  var hint = p.busted ? "已爆倉：收入減半入帳" : ("黑天鵝值再增加 " + left + " 點即爆倉");
  var lucky = p.luckyActive ? "・幸運生效：下一顆不會是黑天鵝" : "";
  var swanReturn = "";
  if (!p.busted && !p.swanReturnUsed && selectors.assetsWithEffect(state, pid, data, "SWAN_RETURN_ONCE").length > 0) {
    swanReturn = '<div class="mrow"><span>首次黑天鵝可退回一次（尚未使用）</span></div>';
  }
  return '<div class="card"><div class="h"><span>' + who + "暫存收入（本回合）</span><span>袋子剩 <b>" + p.bag.length + "</b> 顆（" + esc(bagText(pid)) + "）</span></div>" +
    '<div class="kv"><div class="big">' + money(p.pendingIncome) + '</div><div class="side">黑天鵝<br><b>' + p.blackSwanCount + " / " + th + "</b></div></div>" +
    '<div class="meter">' + meter + '</div><div class="mrow"><span>' + esc(hint) + esc(lucky) + "</span><b>爆倉：收入減半（袋中黑天鵝 " + bagSwans + " 顆）</b></div>" + swanReturn + "</div>" +
    '<div class="card"><div class="h"><span>' + who + "已翻出</span><span><b>" + p.drawn.length + "</b> 顆</span></div><div class=\"chips\">" + chipsHtml(pid, animateFrom) + "</div></div>";
}

function playerCard(pid, statusText) {
  var p = state.players[pid];
  var job = jobOf(pid);
  var isMe = pid === "human";
  return '<div class="card"><div class="ai"><div class="av' + (isMe ? " me" : "") + '">' + (isMe ? "你" : "AI") + '</div><div><div class="nm">' +
    (isMe ? "你" : "AI 對手") + "（" + esc(job ? job.name : "") + ")</div><div class=\"st\">" + esc(statusText) + "</div></div>" +
    '<div class="num">現金 ' + money(p.cash) + "<b>淨資產 " + money(selectors.netWorth(state, pid, data)) + "</b></div></div></div>";
}

function assetsCard(pid) {
  var cards = selectors.ownedAssets(state, pid, data);
  var who = pid === "human" ? "你的資產" : "AI 的資產";
  return '<div class="card"><div class="h"><span>' + who + "</span><span><b>" + cards.length + "</b> 張</span></div><div class=\"assets\">" +
    (cards.length ? cards.map(function (c) { return "<span>" + esc(c.name) + " $" + c.value + "</span>"; }).join("") : '<span class="empty">尚無</span>') + "</div></div>";
}

function lastTurnText(pid) {
  var round = pid === "ai" ? state.round - 1 : state.round;
  if (round < 1) return "尚未行動";
  var s = turnSummary(pid, round);
  if (s.income === null) return "尚未行動";
  return "上回合翻 " + s.draws + " 顆・" + (s.busted ? "爆倉" : "停手") + "・入帳 " + signed(s.income);
}

function renderPlayDraw() {
  var round = state.round, job = jobOf("human");
  var animateFrom = ui.flyKey === "human:" + (state.players.human.drawn.length - 1) ? state.players.human.drawn.length - 1 : state.players.human.drawn.length;
  ui.flyKey = "human:" + state.players.human.drawn.length;
  return '<section class="scr' + (ui.marketOpen ? " mkopen" : "") + '"><div class="bar"><div><div class="t">第 ' + round + " / " + data.balance.rounds + ' 回合</div><div class="s">你的回合・' + esc(job.name) + "</div></div>" +
    '<span class="pill">現金 ' + money(state.players.human.cash) + "</span></div>" +
    '<div class="col"><div class="body">' + errHtml() + statusCard("human", animateFrom) + playerCard("ai", lastTurnText("ai")) + assetsCard("human") + "</div>" +
    '<div class="dock"><button type="button" class="dk draw" data-act="draw" ' + (can({ type: "DRAW" }) ? "" : "disabled") + ">再翻</button>" +
    '<button type="button" class="dk stop" data-act="stop" ' + (can({ type: "STOP" }) ? "" : "disabled") + ">停手</button>" +
    '<button type="button" class="dk mk" data-act="openMarket">🏪 市場<span class="cnt">' + state.market.length + "</span></button></div></div>" +
    '<div class="scrim" data-act="closeMarket"></div><div class="sheet"><div class="grab"></div><div class="h"><b>市場・先買先得</b><button type="button" data-act="closeMarket">關閉</button></div>' +
    marketItems(false) + '<div class="mrow" style="margin-top:10px">停手後才能購買，每回合 0–' + data.balance.purchasesPerTurn + " 張</div></div></section>";
}

function renderPlayBuy() {
  var round = state.round, job = jobOf("human");
  var s = turnSummary("human", round);
  var th = selectors.threshold(state, "human", data);
  var p = state.players.human;
  var boughtCard = s.bought ? cardOf(s.bought) : null;
  // P-1 點卡即買：市場項目本身就是購買鈕；dock 只留「跳過」（未買）或「結束回合」（已買）。
  var buyBtn = state.purchasedThisTurn
    ? '<button type="button" class="dk go" data-act="endTurn">結束回合</button>'
    : '<button type="button" class="dk ghost" data-act="endTurn">跳過，不買</button>';
  return '<section class="scr"><div class="bar"><div><div class="t">' + (p.busted ? "爆倉結算" : "回合結算") + '</div><div class="s">第 ' + round + " / " + data.balance.rounds + " 回合・" + esc(job.name) + "</div></div>" +
    '<span class="pill">現金 ' + money(p.cash) + "</span></div>" +
    '<div class="full"><div class="body">' + errHtml() +
    '<div class="sum"><div class="h">本回合入帳</div><div class="big">' + signed(s.income || 0) + '</div><div class="rows">' +
    "<span>" + (p.busted ? "爆倉於" : "停手於") + "<b>第 " + s.draws + " 顆</b></span><span>黑天鵝<b>" + p.blackSwanCount + " / " + th + "</b></span>" +
    "<span>爆倉減半<b>" + (p.busted ? "有" : "無") + "</b></span>" + (s.bonus ? "<span>停手加成<b>＋$" + s.bonus + "</b></span>" : "") +
    "<span>現金<b>" + money(s.cashBefore === null ? p.cash : s.cashBefore) + " → " + money(s.cashAfter === null ? p.cash : s.cashAfter) + "</b></span></div></div>" +
    '<div class="card list"><div class="h" style="margin:8px 0 2px"><span>' +
    (state.purchasedThisTurn ? ("已買下：" + esc(boughtCard ? boughtCard.name : (s.insurance ? "保險" : ""))) : ("點一下即買：用 " + money(p.cash) + " 買 0–" + data.balance.purchasesPerTurn + " 張，或一份保險")) +
    "</span></div>" + (state.purchasedThisTurn ? '<div class="mrow" style="margin:8px 0">本回合購買次數已用完。</div>' : marketItems(true)) + "</div>" +
    assetsCard("human") + '</div><div class="dock">' + buyBtn + "</div></div></section>";
}

function renderPlayAi() {
  var round = state.round, job = jobOf("ai");
  var animateFrom = ui.flyKey === "ai:" + (state.players.ai.drawn.length - 1) ? state.players.ai.drawn.length - 1 : state.players.ai.drawn.length;
  ui.flyKey = "ai:" + state.players.ai.drawn.length;
  var narr = aiNarration();
  var lastBought = turnSummary("ai", round);
  var boughtText = lastBought.bought ? ("本回合買下：" + (cardOf(lastBought.bought) || {}).name) : (lastBought.insurance ? "本回合買了保險" : "");
  return '<section class="scr"><div class="bar"><div><div class="t">第 ' + round + " / " + data.balance.rounds + ' 回合</div><div class="s">AI 的回合・' + esc(job.name) + "</div></div>" +
    '<span class="pill ai">AI 現金 ' + money(state.players.ai.cash) + "</span></div>" +
    '<div class="col"><div class="body">' + errHtml() + statusCard("ai", animateFrom) +
    '<div class="card"><div class="note ai">' + esc(narr) + (boughtText ? "<br>" + esc(boughtText) : "") + "</div></div>" +
    playerCard("human", "等 AI 翻完就輪到你") + "</div>" +
    '<div class="dock"><button type="button" class="dk wait" disabled>' + esc(narr) + "</button>" +
    '<button type="button" class="dk fast' + (ui.fast ? " on" : "") + '" data-act="toggleFast">' + (ui.fast ? "加速中" : "加速") + "</button></div></div>" +
    '<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="h"><b>市場</b></div>' + marketItems(false) + "</div></section>";
}

function renderRoundEnd() {
  var round = state.round;
  var last = state.round === data.balance.rounds;
  var nwH = selectors.netWorth(state, "human", data), nwA = selectors.netWorth(state, "ai", data);
  var sh = turnSummary("human", round), sa = turnSummary("ai", round);
  var diff = nwH - nwA;
  return '<section class="scr"><div class="bar"><div><div class="t">第 ' + round + " 回合結束</div><div class=\"s\">" + (last ? "最後一回合" : "還有 " + (data.balance.rounds - round) + " 回合") + "</div></div>" +
    '<span class="pill lite">seed ' + state.seed + "</span></div>" +
    '<div class="full"><div class="body">' + errHtml() +
    '<div class="sum"><div class="h">你的淨資產</div><div class="big">' + money(nwH) + '</div><div class="rows">' +
    "<span>AI 淨資產<b>" + money(nwA) + "</b></span><span>" + (diff === 0 ? "平手<b>—</b>" : ((diff > 0 ? "領先" : "落後") + "<b>" + money(Math.abs(diff)) + "</b>")) + "</span>" +
    "<span>你本回合入帳<b>" + signed(sh.income || 0) + (sh.busted ? "（爆倉）" : "") + "</b></span><span>AI 本回合入帳<b>" + signed(sa.income || 0) + (sa.busted ? "（爆倉）" : "") + "</b></span></div></div>" +
    playerCard("human", "翻 " + sh.draws + " 顆・" + (sh.busted ? "爆倉" : "停手") + (sh.bought ? "・買下" + (cardOf(sh.bought) || {}).name : (sh.insurance ? "・買保險" : ""))) +
    playerCard("ai", "翻 " + sa.draws + " 顆・" + (sa.busted ? "爆倉" : "停手") + (sa.bought ? "・買下" + (cardOf(sa.bought) || {}).name : (sa.insurance ? "・買保險" : ""))) +
    assetsCard("human") + assetsCard("ai") +
    '</div><div class="dock"><button type="button" class="dk go" data-act="nextRound">' + (last ? "看結果" : "下一回合") + "</button></div></div></section>";
}

function renderGameOver() {
  var nwH = selectors.netWorth(state, "human", data), nwA = selectors.netWorth(state, "ai", data);
  var w = state.winner;
  var title = w === "human" ? "你贏了" : (w === "ai" ? "AI 贏了" : "平手");
  var cls = w === "human" ? "win" : (w === "ai" ? "lose" : "");
  return '<section class="scr"><div class="bar"><div><div class="t">本局結束</div><div class="s">' + data.balance.rounds + " 回合・難度 " + esc(diffLabel(state.difficulty)) + "</div></div></div>" +
    '<div class="full"><div class="body">' + errHtml() +
    '<div class="sum ' + cls + '"><div class="h">結果</div><div class="big">' + title + '</div><div class="rows"><span>你的淨資產<b>' + money(nwH) + "</b></span><span>AI 淨資產<b>" + money(nwA) + "</b></span>" +
    "<span>差距<b>" + money(Math.abs(nwH - nwA)) + "</b></span></div></div>" +
    '<div class="card"><div class="h"><span>本局牌局代碼（seed）</span></div><div class="seedrow"><code id="seedText">' + state.seed + '</code><button type="button" data-act="copySeed">複製</button></div>' +
    '<div class="mrow" style="margin-top:8px"><span>' + esc(ui.copyMsg || "回報問題時附上這組代碼，就能重現同一局。") + "</span></div></div>" +
    playerCard("human", "現金 " + money(state.players.human.cash)) + playerCard("ai", "現金 " + money(state.players.ai.cash)) +
    assetsCard("human") + assetsCard("ai") +
    '</div><div class="dock"><button type="button" class="dk go" data-act="restart">再來一局</button></div></div></section>';
}

/* ---------- 主渲染與事件 ---------- */

function render() {
  var html;
  if (state.phase === "lobby") html = ui.screen === "jobSelect" ? renderJobSelect() : renderTitle();
  else if (state.phase === "roundEnd") html = renderRoundEnd();
  else if (state.phase === "gameOver") html = renderGameOver();
  else if (state.currentPlayer === "ai") html = renderPlayAi();
  else if (state.phase === "buy") html = renderPlayBuy();
  else html = renderPlayDraw();
  root.innerHTML = html;
  root.setAttribute("data-phase", state.phase);
  var sc = screenName();
  root.setAttribute("data-screen", sc);
  if (sc !== ui.lastScreen) coolDock();
  ui.lastScreen = sc;
  scheduleAi();
}

/**
 * 操作列冷卻（QA B-01／reviewer M-1）：畫面切換後，各畫面的底部操作列位置重疊，
 * 連點第二下會落在「下一個畫面」的按鈕上（例如停手 → 跳過不買、下一回合 → 停手）。
 * 修法：換畫面後把 dock 內原本可用的按鈕停用 balance.ui.dockCooldownMs，再以 DOM 直接恢復
 * （不重新 render，以免重置 AI 節奏計時器與飛入動畫）。onClick 本就忽略 disabled 元素。
 */
function coolDock() {
  if (ui.coolTimer) { clearTimeout(ui.coolTimer); ui.coolTimer = null; }
  var btns = root.querySelectorAll(".dock button:not([disabled])");
  if (!btns.length) return;
  for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].classList.add("cool"); }
  ui.coolTimer = setTimeout(function () {
    ui.coolTimer = null;
    var cooled = root.querySelectorAll(".dock button.cool");
    for (var j = 0; j < cooled.length; j++) { cooled[j].disabled = false; cooled[j].classList.remove("cool"); }
  }, data.balance.ui.dockCooldownMs);
}

function screenName() {
  if (state.phase === "lobby") return ui.screen;
  if (state.phase === "roundEnd") return "roundEnd";
  if (state.phase === "gameOver") return "gameOver";
  if (state.currentPlayer === "ai") return "aiTurn";
  return state.phase === "buy" ? "humanBuy" : "humanTurn";
}

/** 送 action 給 engine；engine 拒絕或例外時只顯示橫幅，不讓頁面死掉。 */
function dispatch(action) {
  try {
    state = reducer.reduce(state, action, data);
    ui.error = null;
  } catch (e) {
    ui.error = "動作未被接受：" + (e && e.message ? e.message : String(e));
  }
  render();
}

/** AI 回合節奏：每步 ≥ aiStepDelayMs（加速時縮短，仍只在 UI 層）。 */
function scheduleAi() {
  if (ui.aiTimer) { clearTimeout(ui.aiTimer); ui.aiTimer = null; }
  if (!isAiTurn() || ui.error) return;
  var delay = data.balance.ui.aiStepDelayMs;
  if (ui.fast) delay = Math.floor(delay / 4);
  ui.aiTimer = setTimeout(function () {
    ui.aiTimer = null;
    if (isAiTurn()) dispatch({ type: "AI_TURN" });
  }, delay);
}

/**
 * 解析牌局代碼（G4.5 第 9 列）：區分「空白」與「無效」。
 * 回傳 { kind: "empty" }（UI 自動產生）、{ kind: "invalid" }（提示且不開局）或 { kind: "ok", value: uint32 }。
 */
var SEED_MAX = 4294967295;
var SEED_ERROR = "牌局代碼需為 0–" + SEED_MAX + " 的整數";
function parseSeed(text) {
  var t = String(text || "").trim();
  if (t === "") return { kind: "empty" };
  if (!/^\d{1,10}$/.test(t)) return { kind: "invalid" };
  var n = Number(t);
  if (n > SEED_MAX) return { kind: "invalid" };
  return { kind: "ok", value: n >>> 0 };
}

function copySeed() {
  var text = String(state.seed);
  var done = function () { ui.copyMsg = "已複製 " + text; render(); };
  var fail = function () { ui.copyMsg = "無法自動複製，請手動長按選取代碼。"; render(); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
      return;
    }
  } catch (e) { /* 走備援 */ }
  try {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand && document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) done(); else fail();
  } catch (e2) { fail(); }
}

function onClick(ev) {
  var el = ev.target;
  while (el && el !== root && !(el.getAttribute && el.getAttribute("data-act"))) el = el.parentNode;
  if (!el || el === root) return;
  if (el.disabled) return;
  var act = el.getAttribute("data-act"), v = el.getAttribute("data-v");
  switch (act) {
    case "difficulty": ui.difficulty = v; render(); break;
    case "toJobSelect": ui.screen = "jobSelect"; render(); break;
    case "toTitle": ui.screen = "title"; render(); break;
    case "job": ui.jobId = v; render(); break;
    case "start": {
      var parsed = parseSeed(ui.seedInput);
      if (parsed.kind === "invalid") { ui.error = SEED_ERROR; render(); break; } // 無效：提示、不開局
      var seed = parsed.kind === "ok" ? parsed.value : (Date.now() >>> 0); // 空白：只在 UI 層產生 seed（規格 §8.1）
      ui.marketOpen = false; ui.copyMsg = ""; ui.flyKey = "";
      dispatch({ type: "START_GAME", seed: seed, jobId: ui.jobId, difficulty: ui.difficulty });
      break;
    }
    case "draw": dispatch({ type: "DRAW" }); break;
    case "stop": ui.marketOpen = false; dispatch({ type: "STOP" }); break;
    case "openMarket": ui.marketOpen = true; render(); break;
    case "closeMarket": ui.marketOpen = false; render(); break;
    // P-1 點卡即買：點資產卡／保險直接送 action，畫面由 dispatch → render 立即反映。
    case "buyAsset": dispatch({ type: "BUY_ASSET", cardId: v }); break;
    case "buyInsurance": dispatch({ type: "BUY_INSURANCE" }); break;
    case "endTurn": ui.flyKey = ""; dispatch({ type: "END_TURN" }); break;
    case "toggleFast": ui.fast = !ui.fast; render(); break;
    case "nextRound": ui.flyKey = ""; dispatch({ type: "NEXT_ROUND" }); break;
    case "copySeed": copySeed(); break;
    case "restart":
      if (ui.aiTimer) { clearTimeout(ui.aiTimer); ui.aiTimer = null; }
      state = reducer.initialState();
      ui.screen = "title"; ui.error = null; ui.copyMsg = ""; ui.flyKey = "";
      render();
      break;
    case "dismissError": ui.error = null; render(); break;
    default: break;
  }
}

function onInput(ev) {
  if (ev.target && ev.target.id === "seedInput") ui.seedInput = ev.target.value;
}

function boot() {
  data = window.GAME_DATA;
  root = document.getElementById("app");
  if (!data || !root) {
    if (root) root.textContent = "載入失敗：找不到遊戲資料（GAME_DATA）。";
    return;
  }
  state = reducer.initialState();
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  window.addEventListener("error", function (e) {
    ui.error = "頁面錯誤：" + (e && e.message ? e.message : "未知");
    try { render(); } catch (e2) { /* 已盡力 */ }
  });
  render();
  // 供煙霧測試讀取畫面狀態（唯讀）。
  window.__game = { getState: function () { return state; }, getScreen: screenName };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

module.exports = { boot: boot };
