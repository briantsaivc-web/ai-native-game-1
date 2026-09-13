"use strict";
/**
 * AI 對 AI 自動對局統計（T-AI-selfplay-stats 使用；也可手動執行：node tests/engine/selfplay.js）。
 * 注意：這是 AI 對 AI 的數據，不是人類玩家數據，只作 G5 平衡參考。
 *
 * 設計：
 * - 「ai 座位」用 START_GAME.difficulty 的參數（正式 AI）；「human 座位」用 decideFor 以指定難度代打。
 * - 3×3 難度矩陣，每格 seed 1～N（預設 200）；human 座位職業依 seed 輪替 j01/j02/j03，ai 座位職業由 seed 隨機三選一（附錄 A）。
 */
var H = require("./helpers");
var engine = H.engine;

var DIFFS = ["easy", "normal", "hard"];

function runCell(data, humanDifficulty, aiDifficulty, games) {
  var jobs = data.jobs.jobs;
  var stat = {
    humanDifficulty: humanDifficulty, aiDifficulty: aiDifficulty, games: games,
    humanWins: 0, aiWins: 0, ties: 0,
    totalActions: 0, totalRounds: 0, totalDraws: 0, totalTurns: 0, totalBusts: 0,
    totalNetWorthHuman: 0, totalNetWorthAi: 0, totalAssetsHuman: 0, totalAssetsAi: 0
  };
  for (var seed = 1; seed <= games; seed++) {
    var g = H.playGame(data, {
      seed: seed, aiJobId: null,
      jobId: jobs[(seed - 1) % jobs.length].id,
      difficulty: aiDifficulty,
      humanDifficulty: humanDifficulty
    });
    var s = g.state;
    if (s.winner === "human") stat.humanWins++;
    else if (s.winner === "ai") stat.aiWins++;
    else stat.ties++;
    stat.totalActions += g.actions.length;
    stat.totalRounds += s.round;
    for (var i = 0; i < s.log.length; i++) {
      var t = s.log[i].type;
      if (t === "TOKEN_DRAWN") stat.totalDraws++;
      else if (t === "TURN_ENDED") stat.totalTurns++;
      else if (t === "BUST") stat.totalBusts++;
    }
    stat.totalNetWorthHuman += engine.selectors.netWorth(s, "human", data);
    stat.totalNetWorthAi += engine.selectors.netWorth(s, "ai", data);
    stat.totalAssetsHuman += s.players.human.assets.length;
    stat.totalAssetsAi += s.players.ai.assets.length;
  }
  return stat;
}

function runMatrix(data, games) {
  var cells = [];
  DIFFS.forEach(function (hd) {
    DIFFS.forEach(function (ad) { cells.push(runCell(data, hd, ad, games)); });
  });
  return cells;
}

function pct(n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "—"; }
function avg(n, d) { return d ? (n / d).toFixed(1) : "—"; }

function toMarkdown(cells, games, meta) {
  var lines = [];
  lines.push("# T-001 S3 AI 對 AI 自動對局統計（T-AI-selfplay-stats）");
  lines.push("");
  lines.push("> **這是 AI 對 AI 的數據，不是人類玩家數據**，只作 G5 平衡調整的參考。");
  lines.push("> 產生方式：`npm run test:engine`（測試 `T-AI-selfplay-stats`）或 `node tests/engine/selfplay.js`；每格 seed 1～" + games + "，決定性可重現。");
  lines.push("> 「human 座位」由測試以 `decideFor(state, \"human\", 難度)` 代打，走與 AI 相同的策略；「ai 座位」為正式 `decideAi`。");
  lines.push("> human 座位職業依 seed 輪替 j01→j02→j03；ai 座位職業由 seed 隨機三選一（規格附錄 A 第 1 題）。");
  lines.push("");
  if (meta) lines.push("- 產生環境：" + meta);
  lines.push("- 每局固定 " + cells[0].totalRounds / cells[0].games + " 回合（R-01），故「平均回合數」恆為此值；可比較的節奏指標為每回合翻牌數與每局 action 數。");
  lines.push("");
  lines.push("## 1. 主表：ai 座位各難度 vs human 座位（normal 策略代打）");
  lines.push("");
  lines.push("| ai 難度 | 局數 | ai 座位勝率 | human 座位勝率 | 平手 | 平均回合數 | 平均 action 數／局 | 平均翻牌數／人回合 | 爆倉率／人回合 | 平均淨資產 human／ai | 平均購卡數 human／ai |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  cells.filter(function (c) { return c.humanDifficulty === "normal"; }).forEach(function (c) {
    lines.push("| " + c.aiDifficulty + " | " + c.games + " | " + pct(c.aiWins, c.games) + " | " + pct(c.humanWins, c.games) + " | " + pct(c.ties, c.games) +
      " | " + avg(c.totalRounds, c.games) + " | " + avg(c.totalActions, c.games) + " | " + avg(c.totalDraws, c.totalTurns) + " | " + pct(c.totalBusts, c.totalTurns) +
      " | " + avg(c.totalNetWorthHuman, c.games) + "／" + avg(c.totalNetWorthAi, c.games) +
      " | " + avg(c.totalAssetsHuman, c.games) + "／" + avg(c.totalAssetsAi, c.games) + " |");
  });
  lines.push("");
  lines.push("## 2. 全矩陣：human 座位策略 × ai 座位難度（ai 座位勝率）");
  lines.push("");
  lines.push("| human 座位策略 ＼ ai 難度 | easy | normal | hard |");
  lines.push("|---|---|---|---|");
  DIFFS.forEach(function (hd) {
    var row = "| " + hd;
    DIFFS.forEach(function (ad) {
      var c = cells.filter(function (x) { return x.humanDifficulty === hd && x.aiDifficulty === ad; })[0];
      row += " | " + pct(c.aiWins, c.games) + "（平手 " + pct(c.ties, c.games) + "）";
    });
    lines.push(row + " |");
  });
  lines.push("");
  lines.push("## 3. 全矩陣明細");
  lines.push("");
  lines.push("| human 策略 | ai 難度 | ai 勝 | human 勝 | 平手 | 平均 action／局 | 翻牌／人回合 | 爆倉率 | 淨資產 human／ai |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  cells.forEach(function (c) {
    lines.push("| " + c.humanDifficulty + " | " + c.aiDifficulty + " | " + c.aiWins + " | " + c.humanWins + " | " + c.ties +
      " | " + avg(c.totalActions, c.games) + " | " + avg(c.totalDraws, c.totalTurns) + " | " + pct(c.totalBusts, c.totalTurns) +
      " | " + avg(c.totalNetWorthHuman, c.games) + "／" + avg(c.totalNetWorthAi, c.games) + " |");
  });
  lines.push("");
  lines.push("## 4. 讀法提醒");
  lines.push("");
  lines.push("- 同策略對打（對角線）理論上應接近 50%，偏差來自先手（human 座位每回合先翻、先買）與職業差異。");
  lines.push("- ai 座位「先看到已被 human 買走後的市場」：兩座位並非完全對稱，勝率不宜直接解讀為難度強弱，只作相對參考。");
  lines.push("- 規格 §7 標明「hard 是否真的較強為 UNKNOWN」；本表是第一份實證，最終由 G5 人類 playtest 決定。");
  lines.push("");
  return lines.join("\n");
}

module.exports = { runCell: runCell, runMatrix: runMatrix, toMarkdown: toMarkdown, DIFFS: DIFFS };

if (require.main === module) {
  var data = H.loadData();
  var games = parseInt(process.argv[2], 10) || 200;
  var cells = runMatrix(data, games);
  process.stdout.write(toMarkdown(cells, games, "node " + process.version) + "\n");
}
