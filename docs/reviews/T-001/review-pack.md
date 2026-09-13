# 審查包：T-001 見好就收 v0.1 可玩版（單批，第 1／1 批）

> 由 review-packager 填寫（2026-09-13），存於 `docs/reviews/T-001/review-pack.md`。
> 這份檔案是要**整份貼給外部 AI（ChatGPT、Gemini 等）**的：不含我方任何判斷、不含機密、獨立可讀。
> 第 1 節提示詞為固定文字，不得改動四條硬要求（分級、檔案:行號、失敗情境、不重寫整份程式）。
> **本檔總字元數：89872（含本檔頭；UTF-16 字元數；107593 bytes UTF-8）**；分批門檻約 100,000 字元，分批方式見第 9 節。

---

## 1. 審查提示詞（貼給外部 AI 時從這裡開始）

請你擔任獨立程式審查員，審查下面這份單頁網頁遊戲的程式碼。你和寫程式的人不是同一個人，也看不到他們的脈絡；看不懂的地方就是問題。

請遵守以下規則：

1. **每個問題都要附四項**：嚴重度（Blocker／Major／Minor）、位置（檔案:行號，依附上的行號）、失敗情境（什麼輸入或操作會出什麼錯）、建議修法（方向或小片段即可）。
2. **嚴重度定義**：Blocker＝無法進行遊戲、state 損毀、同 seed 結果不一致、違反第 2 節任一條架構原則；Major＝功能可用但規則或判定明顯錯誤（與第 3 節規則條文或第 4 節 schema／action 表不符）；Minor＝可維護性、命名、文案。
3. **不確定是不是問題的，另列「疑似」清單**，不要混進 bug 清單。沒有重現步驟的發現只能列「疑似」。
4. **不要重寫整份程式，只給意見。** 不要輸出完整檔案的替換版本；修法建議以文字描述或十行以內的片段為限。
5. 請逐條對照第 2 節的五條架構原則檢查，違反的要指出是哪一條。
6. 第 7 節「已知問題與刻意取捨」是我們已經知道、暫不處理的，不必重複回報；若你認為它比我們描述的更嚴重，可以另外說明。
7. 第 8 節列了六個特別想請你確認的問題，請逐一回答（有問題就進 bug 清單或疑似清單；沒問題也請寫一句「確認無誤」並附你看的行號）。
8. 請用下面的表格格式回覆，繁體中文。

**回覆格式**

bug 清單：

| 編號 | 嚴重度 | 檔案:行號 | 問題（一句話） | 失敗情境 | 建議修法（方向） |
|---|---|---|---|---|---|
| E-1 | | | | | |

疑似清單（沒有重現步驟、或不確定是否為問題）：

| 編號 | 檔案:行號 | 疑點 | 需要什麼資訊才能確認 |
|---|---|---|---|
| S-1 | | | |

架構原則對照：五條各寫「符合／違反（編號＋位置）／無法判斷」。

第 8 節六個問題：每題一列「Q-n：確認無誤（行號）／有問題（見 E-x 或 S-x）」。

---

## 2. 專案 30 秒簡介與架構原則

- 遊戲：「見好就收」v0.1——桌遊改編的單頁網頁遊戲，主題是夜市攤主。1 位人類玩家對 1 位 AI 玩家，同一台裝置，固定 12 回合；每回合每位玩家各做一次「翻籌碼（推運氣）→ 入帳 → 購買」。翻到的收入籌碼累積為暫存收入，翻到黑天鵝籌碼累積黑天鵝值，黑天鵝值達門檻即「爆倉」，暫存收入只剩一半入帳。最後淨資產（現金＋已購資產卡面值）高者勝。
- 交付：單一 `index.html`（由 `build/bundle.js` 把 `src/` 打包產生），零依賴、可離線；無存檔、無連線、無金流。
- 平台：iPad Safari 橫向為主、手機瀏覽器直向為主；觸控優先。
- 語言：UI、註解、文件皆繁體中文；程式識別字英文。模組格式 CommonJS（`module.exports`／`require`），Node 直接載入測試，打包時用迷你模組註冊器包進單一 `<script>`。
- 分層：`src/engine/`（純函數狀態機、規則、AI）→ `src/ui/app.js`（DOM 渲染與送 action）→ `src/data/*.json`（所有數值與內容）→ `build/bundle.js`（打包）。
- 核心介面：`reduce(state, action, data) → newState`，前置條件不成立時 `throw Error("REJECT:<TYPE>:<reason>")`；`canApply(state, action, data) → boolean` 供 UI 決定按鈕可用性；`decideAi(state, data) → { action, reason }` 每次只回傳一步；隨機數只透過 `rng.nextInt(state.rng, n) → { rng, value }`，RNG 狀態存在 `state.rng.s`（mulberry32，uint32）。

架構原則（違反即 Blocker）：

1. **狀態只能透過 action 前進。** engine 層是 reducer 模式的純函數：相同初始狀態 ＋ 相同 action 序列 ＝ 相同結果。不得在 engine 內讀取時間、DOM、網路、計時器或全域變數。UI 層只「呈現 state、送出 action」，不得自己算規則。
2. **所有隨機數來自 seeded RNG。** 不得使用 `Math.random()`。同 seed ＋ 同 action 序列必須可重放（deterministic replay）。
3. **參數資料驅動。** 數值、機率、卡片與棋盤內容放 `src/data/` 的 JSON；程式碼裡出現寫死的平衡數字就是 bug（engine 內只允許 0、1、−1 與索引運算；`rng.js` 的十六進位常數為演算法常數）。
4. **觸控優先。** 可點元素最小 44×44 px（「再翻」「停手」≥ 88 高）；不依賴 hover、右鍵、鍵盤快捷鍵；版面同時支援 iPad 橫向與手機直向。
5. **零依賴。** 不載入 CDN、不外連字型、不用第三方套件；所有資源打包進單一 `index.html`，斷網可玩。

---

## 3. 規則摘要 R-01～R-25（規格書 §5 原文逐條抄錄）

> 以下為 `docs/spec/game-spec.md` §5 原文（v0.1，2026-09-13），「→ `T-…`」為對應測試名；核取方塊為規格書原有格式。**引文內的「第 n 節／§n」皆指規格書自身的章節**（例如「第 6.2 節」＝ assets.json 規格，內容即本檔 5.2 的 JSON），不是本審查包的章節。

出處：outline §3 第 2、3 條與 §4 全部（§3 第 1 條單人達標、§4 落後補償已依 §9 作廢，不列）。R-11 之後為由 outline §5 元件清單與 §6 AI 推導的細則。

#### 規格 §5.1 勝負
- [ ] **R-01** 一局固定 `balance.rounds`（＝12）回合，任何事件不改變回合數。→ `T-R-01-fixed-rounds`
- [ ] **R-02** 第 12 回合 AI 回合結束、送出 NEXT_ROUND 後，淨資產較高者勝；相同則 `winner="tie"`。→ `T-R-02-winner-by-networth`、`T-R-02-tie`
- [ ] **R-03** 淨資產 ＝ `cash` ＋ 已購資產卡 `value` 總和（`pendingIncome` 不算）。→ `T-R-03-networth-formula`

#### 規格 §5.2 翻牌
- [ ] **R-04** `phase==="draw"` 時玩家只能送 DRAW 或 STOP；BUY_*／END_TURN／NEXT_ROUND 一律拒絕。→ `T-R-04-draw-phase-actions`
- [ ] **R-05** 翻出 `income_s／income_m／income_l` 時，`pendingIncome` 加上該籌碼 `value`。→ `T-R-05-income-token`
- [ ] **R-06** 翻出 `blackSwan` 時 `blackSwanCount +1`。→ `T-R-06-blackswan-token`
- [ ] **R-07** `blackSwanCount ≥ 門檻` 即爆倉：自動進入 buy 階段，`cash += floor(pendingIncome × bustKeepRatio)`；既有現金不減。→ `T-R-07-bust-halves`、`T-R-07-bust-never-negative`
- [ ] **R-23** 可抽候選集為空（bag 空，或 `luckyActive` 且 bag 只剩黑天鵝）時 DRAW 被拒絕，UI 只能 STOP。→ `T-R-23-empty-bag-rejects-draw`

#### 規格 §5.3 購買
- [ ] **R-08** 停手或爆倉後可從市場買 0–1 張資產；`tokensAdded` 立即加入 bag，但本回合已在 buy 階段，故下回合起才可能翻到。→ `T-R-08-buy-asset-adds-tokens`
- [ ] **R-09** 可改買保險：`cash −= insuranceCost`，bag 永久移除 1 顆 blackSwan；bag 無 blackSwan 時拒絕。→ `T-R-09-insurance-removes-swan`、`T-R-09-insurance-reject-no-swan`
- [ ] **R-22** 每人每回合只能購買一次（資產或保險二選一）。→ `T-R-22-one-purchase-per-turn`
- [ ] **R-24** 現金不足時 BUY_ASSET／BUY_INSURANCE 拒絕，現金不變。→ `T-R-24-insufficient-cash`
- [ ] **R-11** 每位玩家回合開始時市場從 deck 補到 3 張；deck 空時允許少於 3 張。→ `T-R-11-market-refill`、`T-R-11-market-short-when-deck-empty`

#### 規格 §5.4 收袋
- [ ] **R-10** END_TURN 時 `drawn` 全部回 bag（保險移除者除外，因移除只作用於 bag），`pendingIncome／blackSwanCount／luckyActive／swanReturnUsed／busted` 歸零。→ `T-R-10-tokens-return`

#### 規格 §5.5 特殊籌碼
- [ ] **R-12** 翻到 `lucky` 後 `luckyActive=true`；下一次 DRAW 只從非 blackSwan 籌碼中抽，抽完 `luckyActive=false`。→ `T-R-12-lucky-skips-swan`
- [ ] **R-13** 翻到 `insurance` 籌碼時 `blackSwanCount = max(0, blackSwanCount − 1)`。→ `T-R-13-insurance-token-offsets`

#### 規格 §5.6 改規則資產（效果 type 見第 6.2 節）
- [ ] **R-14** 擁有 `SWAN_RETURN_ONCE` 資產：每回合第一次翻到 blackSwan 時不計數、該籌碼直接放回 bag 尾端（不進 `drawn`），`swanReturnUsed=true`；第二次起正常計數。→ `T-R-14-swan-return-once`
- [ ] **R-15** 擁有 `NTH_INCOME_DOUBLE` 資產：本回合第 `param` 顆收入籌碼（只數 income_*）價值 ×2。→ `T-R-15-nth-income-double`
- [ ] **R-16** 擁有 `THRESHOLD_PLUS` 資產：該玩家門檻 ＝ `balance.blackSwanThreshold + param`；多張可疊加。→ `T-R-16-threshold-plus`
- [ ] **R-17** 擁有 `STOP_BONUS` 資產：主動 STOP 且未爆倉時 `cash += param`；爆倉不給。→ `T-R-17-stop-bonus`

#### 規格 §5.7 AI
- [ ] **R-19** AI 在 draw 階段的決策：`blackSwanCount ≥ 門檻 − swanStopOffset` 或 `pendingIncome ≥ incomeStop` → STOP；否則 DRAW（候選集為空時 STOP）。→ `T-R-19-ai-stop-rules`
- [ ] **R-20** AI 在 buy 階段：買市場中買得起的最貴資產（同價取 market 索引小者）；買不起任何資產且 `buyInsurance===true` 且可買保險 → BUY_INSURANCE；否則 END_TURN。→ `T-R-20-ai-buy-most-expensive`、`T-R-20-ai-insurance-fallback`
- [ ] **R-18** `decideAi` 為純函數：同 state 同 data 呼叫兩次結果相同，且不修改輸入。→ `T-R-18-ai-pure`

#### 規格 §5.8 決定性
- [ ] **R-21** 同 seed ＋ 同 action 序列 → 最終 state 深度相等（含 log）。→ `T-R-21-replay-deterministic`
- [ ] **R-25** `reduce` 不修改輸入 state（深度凍結後呼叫不拋錯）。→ `T-R-25-reducer-immutable`

**統計：規則 25 條（R-01～R-25，含 R-18～R-25 細則），對應測試名 30 個。**

---

## 4. state schema、action 清單與 AI 決策規範（規格書 §3、§4、§7 原文）

> 引文內的「第 n 節／§n」、「ADR-001」皆指規格書自身與其相關文件的章節，不是本審查包的章節。

### 4.1 遊戲狀態 schema（規格書 §3 原文）

#### 規格 §3.1 完整 state（JSON，示範值為第 1 回合人類翻了兩顆之後）

```json
{
  "specVersion": "0.1",
  "seed": 20260913,
  "rng": { "s": 3735928559 },
  "phase": "draw",
  "round": 1,
  "currentPlayer": "human",
  "difficulty": "normal",
  "purchasedThisTurn": false,
  "players": {
    "human": {
      "id": "human",
      "jobId": "j02",
      "cash": 100,
      "bag": ["income_s", "income_s", "income_s", "income_m", "income_m", "income_l", "blackSwan", "blackSwan", "blackSwan", "blackSwan"],
      "drawn": ["income_s", "income_m"],
      "pendingIncome": 30,
      "blackSwanCount": 0,
      "assets": [],
      "luckyActive": false,
      "swanReturnUsed": false,
      "busted": false
    },
    "ai": {
      "id": "ai",
      "jobId": "j02",
      "cash": 100,
      "bag": ["income_s", "income_s", "income_s", "income_s", "income_m", "income_m", "income_m", "income_l", "blackSwan", "blackSwan", "blackSwan", "blackSwan"],
      "drawn": [],
      "pendingIncome": 0,
      "blackSwanCount": 0,
      "assets": [],
      "luckyActive": false,
      "swanReturnUsed": false,
      "busted": false
    }
  },
  "market": ["a03", "a07", "a11"],
  "deck": ["a01", "a02", "a04", "a05", "a06", "a08", "a09", "a10", "a12"],
  "winner": null,
  "log": [
    { "seq": 1, "round": 1, "player": null, "type": "GAME_STARTED", "seed": 20260913, "humanJobId": "j02", "aiJobId": "j02", "difficulty": "normal" },
    { "seq": 2, "round": 1, "player": "human", "type": "MARKET_REFILLED", "market": ["a03", "a07", "a11"] },
    { "seq": 3, "round": 1, "player": "human", "type": "TOKEN_DRAWN", "token": "income_s", "pendingIncome": 10, "blackSwanCount": 0 },
    { "seq": 4, "round": 1, "player": "human", "type": "TOKEN_DRAWN", "token": "income_m", "pendingIncome": 30, "blackSwanCount": 0 }
  ]
}
```

#### 規格 §3.2 欄位定義

| 欄位 | 型別 | 初始值來源 | 說明 |
|---|---|---|---|
| `specVersion` | string | 常數 `"0.1"` | 規格版本，供測試比對 |
| `seed` | number（uint32） | `START_GAME.seed` | 只記錄，不參與運算 |
| `rng.s` | number（uint32） | 由 `seed` 初始化 | mulberry32 內部狀態；每次抽亂數後更新（見 ADR-001） |
| `phase` | `"lobby"｜"draw"｜"buy"｜"roundEnd"｜"gameOver"` | `"lobby"` | engine 階段；UI 畫面狀態機見第 8 節 |
| `round` | number | 1 | 1 ～ `balance.rounds` |
| `currentPlayer` | `"human"｜"ai"` | `"human"` | 每回合人類先 |
| `difficulty` | `"easy"｜"normal"｜"hard"` | `START_GAME.difficulty` | 查 `balance.ai[difficulty]` |
| `purchasedThisTurn` | boolean | false | 本回合是否已購買（資產或保險），每人每回合限一次 |
| `players.<id>.jobId` | string | `START_GAME.jobId`／`balance.aiDefaultJobId` | — |
| `players.<id>.cash` | number（整數） | `jobs.json[jobId].startCash` | — |
| `players.<id>.bag` | tokenId[] | `jobs.json[jobId].startBag` 展開 | 順序無意義；抽籌碼用 RNG 選索引 |
| `players.<id>.drawn` | tokenId[] | `[]` | 本回合已翻出，回合結束回袋 |
| `players.<id>.pendingIncome` | number | 0 | — |
| `players.<id>.blackSwanCount` | number | 0 | 最小 0（保險籌碼抵銷不會變負） |
| `players.<id>.assets` | cardId[] | `[]` | 已購資產，依購買順序 |
| `players.<id>.luckyActive` | boolean | false | 翻到幸運籌碼後為 true；下一次 DRAW 消耗 |
| `players.<id>.swanReturnUsed` | boolean | false | 資產效果 `SWAN_RETURN_ONCE` 本回合是否已用 |
| `players.<id>.busted` | boolean | false | 本回合是否爆倉；供 UI 與 STOP_BONUS 判斷 |
| `market` | cardId[] | START_GAME 時從 deck 補滿 | 長度 ≤ `balance.marketSize` |
| `deck` | cardId[] | 12 張洗牌後扣除市場 | — |
| `winner` | `null｜"human"｜"ai"｜"tie"` | null | gameOver 時填 |
| `log` | LogEvent[] | `[]` | 只追加，不修改；`seq` 遞增 |

#### 規格 §3.3 不變式（每個 action 後都成立；測試 `T-INV-*`）
- INV-1：每位玩家 `bag.length + drawn.length` 在回合內不變，除非 BUY_ASSET（＋tokensAdded）、BUY_INSURANCE（−1）。
- INV-2：`market.length + deck.length + human.assets.length + ai.assets.length === 12`。
- INV-3：`cash ≥ 0`、`pendingIncome ≥ 0`、`blackSwanCount ≥ 0`。
- INV-4：`log[i].seq === i + 1`。
- INV-5：`phase === "draw"` 時 `purchasedThisTurn === false`。


### 4.2 Action 清單（規格書 §4 原文）

通用規則：
- 介面：`reduce(state, action, data) → newState`。`data` 為 `{ jobs, assets, tokens, balance }`（`src/data/*.json` 載入後傳入），engine 不自行讀檔。
- 前置條件不成立時 `reduce` **拋出 `Error`**，訊息格式 `"REJECT:<ACTION>:<reason>"`，不回傳原 state、不寫 log（避免無效 action 混進重放序列卻無痕跡；取捨見 ADR-001 §3 方案 G）。UI 層以 `canApply` 只顯示合法按鈕，因此正常操作不會觸發。拒絕路徑由 R-04、R-09、R-22、R-23、R-24 的測試覆蓋。
- 所有隨機需求只透過 `rng.next(state)`（見 ADR-001）；下表「RNG 次數」為每個 action 固定會消耗的次數。

| Action | payload | 前置條件 | 狀態轉移 | log 事件 | RNG 次數 |
|---|---|---|---|---|---|
| `START_GAME` | `{ seed: uint32, jobId, difficulty, aiJobId? }` | `phase === "lobby"`；`jobId` 存在於 jobs.json；`difficulty` 存在於 balance.ai | 以 seed 初始化 rng；建兩位玩家（human 用 jobId，ai 用 `aiJobId ?? balance.aiDefaultJobId`）；deck ＝ 12 張 id 依 assets.json 順序，Fisher–Yates 洗牌；market ＝ 從 deck 頂端取 `marketSize` 張；`round=1`、`currentPlayer="human"`、`phase="draw"` | `GAME_STARTED`、`MARKET_REFILLED` | 11（Fisher–Yates n−1） |
| `DRAW` | `{}` | `phase === "draw"`；當前玩家 `bag` 有可抽籌碼（見 R-23） | 候選集 ＝ `luckyActive ? bag 去除 blackSwan : bag`；以 `rng.nextInt(候選數)` 取一顆移到 `drawn`；若 `luckyActive` 則設 false；依籌碼種類套用（R-05、R-06、R-12、R-13）與資產效果（R-14、R-15）；若 `blackSwanCount ≥ 門檻` → `busted=true`、結算入帳（R-07）、`phase="buy"` | `TOKEN_DRAWN`；爆倉時再加 `BUST`、`INCOME_SETTLED`；`SWAN_RETURN_ONCE` 觸發時加 `SWAN_RETURNED` | 1 |
| `STOP` | `{}` | `phase === "draw"` | 結算：`cash += pendingIncome`（＋`STOP_BONUS`，R-17）；`phase="buy"` | `STOPPED`、`INCOME_SETTLED` | 0 |
| `BUY_ASSET` | `{ cardId }` | `phase === "buy"`；`purchasedThisTurn === false`；`cardId ∈ market`；`cash ≥ card.cost` | `cash −= cost`；`assets.push(cardId)`；`market` 移除該卡（**不立即補**，下一位玩家回合開始才補）；`bag.push(...tokensAdded)`；`purchasedThisTurn=true` | `ASSET_BOUGHT` | 0 |
| `BUY_INSURANCE` | `{}` | `phase === "buy"`；`purchasedThisTurn === false`；`cash ≥ balance.insuranceCost`；`bag` 中至少 1 顆 `blackSwan`（只看 bag，不看 drawn） | `cash −= insuranceCost`；移除 `bag` 中**第一個** `blackSwan`（索引最小者，無 RNG）；`purchasedThisTurn=true` | `INSURANCE_BOUGHT` | 0 |
| `END_TURN` | `{}` | `phase === "buy"` | `drawn` 全部回 `bag`（依 drawn 順序附加到 bag 尾端）；`pendingIncome=0`、`blackSwanCount=0`、`luckyActive=false`、`swanReturnUsed=false`、`busted=false`、`purchasedThisTurn=false`；若 `currentPlayer==="human"` → `currentPlayer="ai"`、補市場、`phase="draw"`；若 `"ai"` → `phase="roundEnd"` | `TURN_ENDED`；換 AI 時 `MARKET_REFILLED`；回合結束時 `ROUND_ENDED`（含兩人淨資產） | 0 |
| `NEXT_ROUND` | `{}` | `phase === "roundEnd"` | 若 `round === balance.rounds` → 計算 winner（R-02）、`phase="gameOver"`；否則 `round += 1`、`currentPlayer="human"`、補市場、`phase="draw"` | `GAME_OVER` 或 `MARKET_REFILLED` | 0 |
| `AI_TURN` | `{}` | `currentPlayer === "ai"` 且 `phase ∈ {"draw","buy"}` | 呼叫 `decideAi(state, data)` 取得**一個**內部 action（DRAW／STOP／BUY_ASSET／BUY_INSURANCE／END_TURN），先追加 `AI_DECIDED` 到 log，再以該 action 呼叫 `reduce` | `AI_DECIDED { decision, reason }` ＋ 該內部 action 的事件 | 同內部 action |

補充：
- `AI_TURN` 每次只走**一步**，UI 以 ≥ 400 ms 間隔重複送出直到 `currentPlayer !== "ai"`（第 8 節）。重放時連續送 AI_TURN 即可，結果決定性不變。
- `NEXT_ROUND` 為本規格新增（outline 未列），理由：回合結束畫面需要一個停點讓玩家看兩人淨資產，engine 不得用計時器自動前進。
- 「補市場」＝從 deck 頂端依序取卡直到 `market.length === marketSize` 或 deck 空；無 RNG。

#### 規格 §4.1 Log 事件型別

| type | 額外欄位 |
|---|---|
| `GAME_STARTED` | `seed, humanJobId, aiJobId, difficulty` |
| `MARKET_REFILLED` | `market` |
| `TOKEN_DRAWN` | `token, pendingIncome, blackSwanCount, doubled?`（NTH_INCOME_DOUBLE 觸發時 `doubled:true`） |
| `SWAN_RETURNED` | `cardId` |
| `BUST` | `pendingBefore, settled` |
| `STOPPED` | `pendingIncome, bonus` |
| `INCOME_SETTLED` | `amount, cashAfter` |
| `ASSET_BOUGHT` | `cardId, cost, tokensAdded` |
| `INSURANCE_BOUGHT` | `cost, bagBlackSwanAfter` |
| `TURN_ENDED` | — |
| `ROUND_ENDED` | `round, netWorth: { human, ai }` |
| `GAME_OVER` | `winner, netWorth: { human, ai }` |
| `AI_DECIDED` | `decision`（action 物件）、`reason`（英文短碼，例如 `"swanStop"`、`"incomeStop"`、`"buyMostExpensive"`） |

每筆事件皆含 `seq, round, player`（`player` 為當時 `currentPlayer`，GAME_STARTED 為 null）。

### 4.3 AI 決策規範（規格書 §7 原文）

```
decideAi(state, data) → action
```
- 純函數：不讀時間、不呼叫 RNG、不修改 `state`／`data`。
- 只在 `state.currentPlayer === "ai"` 且 `phase ∈ {draw, buy}` 有定義；其他 phase 回傳 `null`（AI_TURN 前置條件已擋）。
- 讀取 `data.balance.ai[state.difficulty]` 取三組門檻之一。

```
draw 階段：
  threshold = selectors.threshold(state, "ai")        // 含 THRESHOLD_PLUS
  if candidates(ai) 為空                → STOP   (reason "noCandidates")
  if ai.blackSwanCount >= threshold - swanStopOffset → STOP   (reason "swanStop")
  if ai.pendingIncome >= incomeStop     → STOP   (reason "incomeStop")
  else                                  → DRAW   (reason "push")

buy 階段：
  if purchasedThisTurn                  → END_TURN (reason "done")
  affordable = market 中 cost <= cash 的卡，依 cost 降冪、同價依 market 索引升冪
  if affordable 非空                    → BUY_ASSET { cardId: affordable[0] } (reason "buyMostExpensive")
  if buyInsurance && cash >= insuranceCost && bag 含 blackSwan → BUY_INSURANCE (reason "insuranceFallback")
  else                                  → END_TURN (reason "nothingToBuy")
```

三組門檻的意圖：easy 早停、少買；normal 對應 outline §6 原文；hard 更貪（撐到 120）但同樣門檻 −1 停手。hard 是否真的較強為 **UNKNOWN**，待 G5 用 AI 對 AI 自動對局統計（測試 `T-AI-selfplay-stats`，非通過／失敗型，只輸出勝率）。

### 4.4 規格書附錄 A（製作人拍板，影響 START_GAME 的 RNG 次數）

1. AI 的職業卡：**製作人拍板（2026-09-13）：由 seed 隨機三選一**。`START_GAME` 若未帶 `aiJobId`，以 rng 從 jobs.json 隨機取一張（消耗 1 次 RNG，順序在 Fisher–Yates 洗牌之前）；`aiDefaultJobId` 僅作測試用預設。
2. gameOver 顯示本局 seed：**製作人拍板（2026-09-13）：顯示**，並附「複製 seed」按鈕（UI 層）。

---

## 5. 完整程式碼（有行號；每檔完整貼出，不節錄）

> 行號為本審查包加上的，格式同 `cat -n`；回報位置請用「檔案:行號」。`src/ui/styles.css` 與 `src/ui/index.template.html` 只列檔名與行數，不貼內容（純樣式／注入標記，與規則無關；若你需要，請在疑似清單標「需要 styles.css」）。

### 5.1 `src/data/jobs.json`（28 行，747 bytes）

```
     1	{
     2	  "jobs": [
     3	    {
     4	      "id": "j01",
     5	      "name": "滷味攤",
     6	      "style": "穩健",
     7	      "startCash": 80,
     8	      "startBag": { "income_s": 6, "income_m": 2, "blackSwan": 3 },
     9	      "flavor": "薄利多銷，客人穩，驚喜少。"
    10	    },
    11	    {
    12	      "id": "j02",
    13	      "name": "雞排攤",
    14	      "style": "平均",
    15	      "startCash": 100,
    16	      "startBag": { "income_s": 4, "income_m": 3, "income_l": 1, "blackSwan": 4 },
    17	      "flavor": "排隊是常態，油鍋跳電也是。"
    18	    },
    19	    {
    20	      "id": "j03",
    21	      "name": "飲料攤",
    22	      "style": "賭徒",
    23	      "startCash": 120,
    24	      "startBag": { "income_s": 2, "income_m": 3, "income_l": 2, "blackSwan": 5 },
    25	      "flavor": "天氣好賺翻，下雨全收攤。"
    26	    }
    27	  ]
    28	}
```

### 5.2 `src/data/assets.json`（16 行，2512 bytes）

```
     1	{
     2	  "assets": [
     3	    { "id": "a01", "name": "第二口鍋", "cost": 60, "value": 40, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_s", "income_s"], "flavor": "一次炸兩份，客人少等一半。" },
     4	    { "id": "a02", "name": "保溫箱", "cost": 70, "value": 50, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_s", "income_m"], "flavor": "涼了也能賣，只是賣得慢。" },
     5	    { "id": "a03", "name": "冷藏櫃", "cost": 100, "value": 70, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_m", "income_m"], "flavor": "食材撐得久，敢進貨了。" },
     6	    { "id": "a04", "name": "招牌燈箱", "cost": 90, "value": 60, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_m", "lucky"], "flavor": "遠遠就看得到，運氣也跟著來。" },
     7	    { "id": "a05", "name": "雨棚", "cost": 110, "value": 80, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["insurance", "income_s"], "flavor": "下雨？照賣。" },
     8	    { "id": "a06", "name": "外送平台", "cost": 140, "value": 100, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_l", "income_s", "blackSwan"], "flavor": "單量暴增，抽成與負評也是。" },
     9	    { "id": "a07", "name": "老闆娘的好人緣", "cost": 150, "value": 100, "effect": { "type": "SWAN_RETURN_ONCE", "param": 1 }, "tokensAdded": [], "flavor": "稽查員來了？先喝杯茶。每回合第一顆黑天鵝放回袋子。" },
    10	    { "id": "a08", "name": "收銀機", "cost": 120, "value": 90, "effect": { "type": "STOP_BONUS", "param": 15 }, "tokensAdded": [], "flavor": "收攤結帳不漏錢。主動停手多拿 15。" },
    11	    { "id": "a09", "name": "第三口鍋", "cost": 160, "value": 110, "effect": { "type": "NTH_INCOME_DOUBLE", "param": 3 }, "tokensAdded": [], "flavor": "翻到第 3 顆收入籌碼時價值翻倍。" },
    12	    { "id": "a10", "name": "發電機", "cost": 180, "value": 130, "effect": { "type": "THRESHOLD_PLUS", "param": 1 }, "tokensAdded": [], "flavor": "跳電不怕。黑天鵝門檻 +1。" },
    13	    { "id": "a11", "name": "常客名單", "cost": 200, "value": 240, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_l", "income_l"], "flavor": "老客人就是資產。" },
    14	    { "id": "a12", "name": "老字號招牌", "cost": 260, "value": 320, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_m"], "flavor": "三十年老店，名字本身就值錢。" }
    15	  ]
    16	}
```

### 5.3 `src/data/tokens.json`（11 行，583 bytes）

```
     1	{
     2	  "tokens": [
     3	    { "id": "income_s", "name": "小單", "kind": "income", "value": 10 },
     4	    { "id": "income_m", "name": "中單", "kind": "income", "value": 20 },
     5	    { "id": "income_l", "name": "大單", "kind": "income", "value": 40 },
     6	    { "id": "blackSwan", "name": "黑天鵝", "kind": "blackSwan", "value": 0,
     7	      "eventNames": ["下雨", "衛生稽查", "跳電", "隔壁攤大特價", "瓦斯用完"] },
     8	    { "id": "insurance", "name": "保險籌碼", "kind": "insurance", "value": 0 },
     9	    { "id": "lucky", "name": "幸運籌碼", "kind": "lucky", "value": 0 }
    10	  ]
    11	}
```

### 5.4 `src/data/balance.json`（18 行，482 bytes）

```
     1	{
     2	  "rounds": 12,
     3	  "blackSwanThreshold": 3,
     4	  "bustKeepRatio": 0.5,
     5	  "marketSize": 3,
     6	  "insuranceCost": 40,
     7	  "purchasesPerTurn": 1,
     8	  "aiDefaultJobId": "j02",
     9	  "ai": {
    10	    "easy":   { "swanStopOffset": 2, "incomeStop": 40,  "buyInsurance": false },
    11	    "normal": { "swanStopOffset": 1, "incomeStop": 80,  "buyInsurance": true },
    12	    "hard":   { "swanStopOffset": 1, "incomeStop": 120, "buyInsurance": true }
    13	  },
    14	  "ui": {
    15	    "aiStepDelayMs": 400,
    16	    "tokenFlyMs": 300
    17	  }
    18	}
```

### 5.5 `src/engine/rng.js`（29 行，1099 bytes）

```
     1	"use strict";
     2	/**
     3	 * seeded RNG：mulberry32（依 ADR-001 §2.2）。
     4	 * - 狀態只有一個 uint32（`{ s }`），直接放進 state.rng，重放只需記 seed。
     5	 * - 每次呼叫回傳「新狀態 ＋ 值」，不使用閉包或可變內部狀態（純函數）。
     6	 * - 只用 Math.imul 與 >>>，Node 與 iPad Safari 行為一致。
     7	 * 下列十六進位常數為演算法常數，不是遊戲平衡數值。
     8	 */
     9	
    10	/** 以 seed 建立 RNG 狀態；seed 會被強制轉成 uint32。 */
    11	function seedRng(seed) {
    12	  return { s: seed >>> 0 };
    13	}
    14	
    15	/** 取下一個亂數。回傳 { rng: 新狀態, value: [0,1) 浮點 }。 */
    16	function next(rng) {
    17	  var t = (rng.s + 0x6D2B79F5) >>> 0;
    18	  var r = Math.imul(t ^ (t >>> 15), 1 | t);
    19	  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    20	  return { rng: { s: t }, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
    21	}
    22	
    23	/** 取 0..n-1 的整數（n ≥ 1）。回傳 { rng, value }。 */
    24	function nextInt(rng, n) {
    25	  var o = next(rng);
    26	  return { rng: o.rng, value: Math.floor(o.value * n) };
    27	}
    28	
    29	module.exports = { seedRng: seedRng, next: next, nextInt: nextInt };
```

### 5.6 `src/engine/reducer.js`（405 行，15142 bytes）

```
     1	"use strict";
     2	/**
     3	 * reducer：遊戲狀態機（規格 §3 schema、§4 action、§5 規則；ADR-001 §2.1）。
     4	 * - reduce(state, action, data) → 新 state；不修改輸入（淺層複製＋只替換被改的分支；log 用 concat）。
     5	 * - 前置條件不成立 → throw Error("REJECT:<TYPE>:<reason>")，不回傳原 state、不寫 log。
     6	 * - 所有隨機只透過 rng.nextInt，且狀態隨 state.rng 流動。
     7	 * - engine 內出現的數字只允許 0、1、−1 與索引運算；平衡數值一律從 data 讀。
     8	 */
     9	var rng = require("./rng");
    10	var selectors = require("./selectors");
    11	var ai = require("./ai");
    12	
    13	var SPEC_VERSION = "0.1";
    14	
    15	/* ---------- 內部工具 ---------- */
    16	
    17	function reject(type, reason) {
    18	  throw new Error("REJECT:" + type + ":" + reason);
    19	}
    20	
    21	/** 淺層複製物件並套用覆寫欄位。 */
    22	function assign(base, patch) {
    23	  var out = {};
    24	  var k;
    25	  for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    26	  for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
    27	  return out;
    28	}
    29	
    30	/** 回傳替換了某位玩家的新 state。 */
    31	function withPlayer(state, playerId, patch) {
    32	  var players = assign(state.players, {});
    33	  players[playerId] = assign(state.players[playerId], patch);
    34	  return assign(state, { players: players });
    35	}
    36	
    37	/** 追加一筆 log 事件（seq 遞增，player 為當時 currentPlayer）。 */
    38	function addLog(state, type, extra) {
    39	  var event = { seq: state.log.length + 1, round: state.round, player: state.currentPlayer, type: type };
    40	  for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) event[k] = extra[k];
    41	  return assign(state, { log: state.log.concat([event]) });
    42	}
    43	
    44	/** 建立一位玩家（規格 §3.2 初始值）。startBag 依 tokens.json 順序展開為 tokenId 陣列。 */
    45	function makePlayer(playerId, jobId, data) {
    46	  var job = selectors.byId(data.jobs.jobs, jobId);
    47	  var bag = [];
    48	  // 依 tokens.json 的順序展開，確保展開結果決定性（不依賴物件 key 順序）。
    49	  var tokens = data.tokens.tokens;
    50	  for (var i = 0; i < tokens.length; i++) {
    51	    var count = job.startBag[tokens[i].id] || 0;
    52	    for (var c = 0; c < count; c++) bag.push(tokens[i].id);
    53	  }
    54	  return {
    55	    id: playerId,
    56	    jobId: jobId,
    57	    cash: job.startCash,
    58	    bag: bag,
    59	    drawn: [],
    60	    pendingIncome: 0,
    61	    blackSwanCount: 0,
    62	    assets: [],
    63	    luckyActive: false,
    64	    swanReturnUsed: false,
    65	    busted: false
    66	  };
    67	}
    68	
    69	/** 補市場：從 deck 頂端依序取卡直到 market 滿或 deck 空；無 RNG。回傳含 MARKET_REFILLED 事件的新 state。 */
    70	function refillMarket(state, data) {
    71	  var market = state.market.slice();
    72	  var deck = state.deck.slice();
    73	  while (market.length < data.balance.marketSize && deck.length > 0) {
    74	    market.push(deck.shift());
    75	  }
    76	  var s = assign(state, { market: market, deck: deck });
    77	  return addLog(s, "MARKET_REFILLED", { market: market.slice() });
    78	}
    79	
    80	/** 結算入帳（STOP 或爆倉共用）：cash += amount，寫 INCOME_SETTLED。 */
    81	function settleIncome(state, playerId, amount) {
    82	  var cashAfter = state.players[playerId].cash + amount;
    83	  var s = withPlayer(state, playerId, { cash: cashAfter });
    84	  return addLog(s, "INCOME_SETTLED", { amount: amount, cashAfter: cashAfter });
    85	}
    86	
    87	/** 兩人淨資產快照（ROUND_ENDED／GAME_OVER 用）。 */
    88	function netWorthSnapshot(state, data) {
    89	  return {
    90	    human: selectors.netWorth(state, "human", data),
    91	    ai: selectors.netWorth(state, "ai", data)
    92	  };
    93	}
    94	
    95	/* ---------- 初始狀態 ---------- */
    96	
    97	/** 大廳狀態：phase="lobby"，其餘為空值；key 集合與規格 §3.1 完全一致。 */
    98	function emptyPlayer(playerId) {
    99	  return {
   100	    id: playerId,
   101	    jobId: null,
   102	    cash: 0,
   103	    bag: [],
   104	    drawn: [],
   105	    pendingIncome: 0,
   106	    blackSwanCount: 0,
   107	    assets: [],
   108	    luckyActive: false,
   109	    swanReturnUsed: false,
   110	    busted: false
   111	  };
   112	}
   113	
   114	function initialState() {
   115	  return {
   116	    specVersion: SPEC_VERSION,
   117	    seed: null,
   118	    rng: { s: 0 },
   119	    phase: "lobby",
   120	    round: 1,
   121	    currentPlayer: "human",
   122	    difficulty: null,
   123	    purchasedThisTurn: false,
   124	    players: { human: emptyPlayer("human"), ai: emptyPlayer("ai") },
   125	    market: [],
   126	    deck: [],
   127	    winner: null,
   128	    log: []
   129	  };
   130	}
   131	
   132	/* ---------- 各 action ---------- */
   133	
   134	function startGame(state, action, data) {
   135	  if (state.phase !== "lobby") reject("START_GAME", "phase");
   136	  if (!selectors.byId(data.jobs.jobs, action.jobId)) reject("START_GAME", "unknownJob");
   137	  if (!data.balance.ai[action.difficulty]) reject("START_GAME", "unknownDifficulty");
   138	  if (action.aiJobId !== undefined && action.aiJobId !== null &&
   139	      !selectors.byId(data.jobs.jobs, action.aiJobId)) reject("START_GAME", "unknownAiJob");
   140	
   141	  var r = rng.seedRng(action.seed);
   142	
   143	  // 規格附錄 A 第 1 題（製作人拍板）：未帶 aiJobId 時，以 rng 從 jobs.json 隨機取一張（1 次 RNG，在洗牌之前）。
   144	  var aiJobId = action.aiJobId;
   145	  if (aiJobId === undefined || aiJobId === null) {
   146	    var pick = rng.nextInt(r, data.jobs.jobs.length);
   147	    r = pick.rng;
   148	    aiJobId = data.jobs.jobs[pick.value].id;
   149	  }
   150	
   151	  // deck ＝ 12 張 id 依 assets.json 順序，Fisher–Yates 洗牌（n−1 次 RNG）。
   152	  var deck = data.assets.assets.map(function (card) { return card.id; });
   153	  for (var i = deck.length - 1; i > 0; i--) {
   154	    var o = rng.nextInt(r, i + 1);
   155	    r = o.rng;
   156	    var tmp = deck[i]; deck[i] = deck[o.value]; deck[o.value] = tmp;
   157	  }
   158	
   159	  var s = assign(state, {
   160	    seed: action.seed >>> 0,
   161	    rng: r,
   162	    phase: "draw",
   163	    round: 1,
   164	    currentPlayer: "human",
   165	    difficulty: action.difficulty,
   166	    purchasedThisTurn: false,
   167	    players: {
   168	      human: makePlayer("human", action.jobId, data),
   169	      ai: makePlayer("ai", aiJobId, data)
   170	    },
   171	    market: [],
   172	    deck: deck,
   173	    winner: null,
   174	    log: []
   175	  });
   176	  // GAME_STARTED 的 player 為 null（規格 §4.1）。
   177	  var event = { seq: 1, round: 1, player: null, type: "GAME_STARTED",
   178	    seed: s.seed, humanJobId: action.jobId, aiJobId: aiJobId, difficulty: action.difficulty };
   179	  s = assign(s, { log: [event] });
   180	  return refillMarket(s, data);
   181	}
   182	
   183	/**
   184	 * DRAW（分派單 X-9 規定的順序）：
   185	 * lucky 過濾 → 抽出 → SWAN_RETURN_ONCE（若為黑天鵝且未用）→ 計數／加收入（含 NTH_INCOME_DOUBLE）
   186	 * → insurance 籌碼抵銷 → 爆倉判定。
   187	 */
   188	function draw(state, data) {
   189	  if (state.phase !== "draw") reject("DRAW", "phase");
   190	  var pid = state.currentPlayer;
   191	  var p = state.players[pid];
   192	  var cands = selectors.candidates(state, pid);
   193	  if (cands.length === 0) reject("DRAW", "noCandidates");
   194	
   195	  // 抽出：以 nextInt(候選數) 選一個候選，對應回 bag 索引。
   196	  var o = rng.nextInt(state.rng, cands.length);
   197	  var bagIndex = cands[o.value];
   198	  var tokenId = p.bag[bagIndex];
   199	  var token = selectors.byId(data.tokens.tokens, tokenId);
   200	  var bag = p.bag.slice(0, bagIndex).concat(p.bag.slice(bagIndex + 1));
   201	
   202	  var patch = {
   203	    bag: bag,
   204	    drawn: p.drawn,
   205	    pendingIncome: p.pendingIncome,
   206	    blackSwanCount: p.blackSwanCount,
   207	    luckyActive: false, // R-12：一次 DRAW 消耗幸運
   208	    swanReturnUsed: p.swanReturnUsed
   209	  };
   210	  var s = assign(state, { rng: o.rng });
   211	  var doubled = false;
   212	  var swanReturnedBy = null;
   213	
   214	  if (token.kind === "blackSwan") {
   215	    var returners = selectors.assetsWithEffect(state, pid, data, "SWAN_RETURN_ONCE");
   216	    if (returners.length > 0 && !p.swanReturnUsed) {
   217	      // R-14：不計數、直接放回 bag 尾端（不進 drawn），不消耗 RNG。
   218	      patch.bag = bag.concat([tokenId]);
   219	      patch.swanReturnUsed = true;
   220	      swanReturnedBy = returners[0].id;
   221	    } else {
   222	      patch.drawn = p.drawn.concat([tokenId]);
   223	      patch.blackSwanCount = p.blackSwanCount + 1; // R-06
   224	    }
   225	  } else if (token.kind === "income") {
   226	    patch.drawn = p.drawn.concat([tokenId]);
   227	    // R-15：本回合第 n 顆收入籌碼（只數 drawn 中 kind==="income"，含本顆）。
   228	    var nth = 0;
   229	    for (var i = 0; i < patch.drawn.length; i++) {
   230	      var t = selectors.byId(data.tokens.tokens, patch.drawn[i]);
   231	      if (t && t.kind === "income") nth++;
   232	    }
   233	    var value = token.value;
   234	    var doublers = selectors.assetsWithEffect(state, pid, data, "NTH_INCOME_DOUBLE");
   235	    for (var d = 0; d < doublers.length; d++) {
   236	      if (doublers[d].effect.param === nth) { doubled = true; break; }
   237	    }
   238	    if (doubled) value = value + value;
   239	    patch.pendingIncome = p.pendingIncome + value; // R-05
   240	  } else if (token.kind === "insurance") {
   241	    patch.drawn = p.drawn.concat([tokenId]);
   242	    // R-13：抵銷 1 點，不低於 0。
   243	    patch.blackSwanCount = p.blackSwanCount > 0 ? p.blackSwanCount - 1 : 0;
   244	  } else if (token.kind === "lucky") {
   245	    patch.drawn = p.drawn.concat([tokenId]);
   246	    patch.luckyActive = true; // R-12
   247	  } else {
   248	    patch.drawn = p.drawn.concat([tokenId]);
   249	  }
   250	
   251	  s = withPlayer(s, pid, patch);
   252	  var drawnEvent = { token: tokenId, pendingIncome: patch.pendingIncome, blackSwanCount: patch.blackSwanCount };
   253	  if (doubled) drawnEvent.doubled = true;
   254	  s = addLog(s, "TOKEN_DRAWN", drawnEvent);
   255	  if (swanReturnedBy) s = addLog(s, "SWAN_RETURNED", { cardId: swanReturnedBy });
   256	
   257	  // R-07：爆倉判定。
   258	  var th = selectors.threshold(s, pid, data);
   259	  if (patch.blackSwanCount >= th) {
   260	    var pendingBefore = patch.pendingIncome;
   261	    var settled = Math.floor(pendingBefore * data.balance.bustKeepRatio);
   262	    s = withPlayer(s, pid, { busted: true });
   263	    s = addLog(s, "BUST", { pendingBefore: pendingBefore, settled: settled });
   264	    s = settleIncome(s, pid, settled);
   265	    s = assign(s, { phase: "buy", purchasedThisTurn: false });
   266	  }
   267	  return s;
   268	}
   269	
   270	function stop(state, data) {
   271	  if (state.phase !== "draw") reject("STOP", "phase");
   272	  var pid = state.currentPlayer;
   273	  var p = state.players[pid];
   274	  // R-17：主動 STOP 且未爆倉時加 STOP_BONUS（draw 階段不可能已爆倉，仍依規則判斷）。
   275	  var bonus = 0;
   276	  if (!p.busted) {
   277	    var cards = selectors.assetsWithEffect(state, pid, data, "STOP_BONUS");
   278	    for (var i = 0; i < cards.length; i++) bonus += cards[i].effect.param;
   279	  }
   280	  var s = addLog(state, "STOPPED", { pendingIncome: p.pendingIncome, bonus: bonus });
   281	  s = settleIncome(s, pid, p.pendingIncome + bonus);
   282	  return assign(s, { phase: "buy", purchasedThisTurn: false });
   283	}
   284	
   285	function buyAsset(state, action, data) {
   286	  if (state.phase !== "buy") reject("BUY_ASSET", "phase");
   287	  if (state.purchasedThisTurn) reject("BUY_ASSET", "alreadyPurchased");
   288	  var idx = state.market.indexOf(action.cardId);
   289	  if (idx < 0) reject("BUY_ASSET", "notInMarket");
   290	  var card = selectors.byId(data.assets.assets, action.cardId);
   291	  if (!card) reject("BUY_ASSET", "unknownCard");
   292	  var pid = state.currentPlayer;
   293	  var p = state.players[pid];
   294	  if (p.cash < card.cost) reject("BUY_ASSET", "insufficientCash");
   295	
   296	  // market 移除該卡但不立即補（下一位玩家回合開始才補）；tokensAdded 立即加入 bag 尾端。
   297	  var market = state.market.slice(0, idx).concat(state.market.slice(idx + 1));
   298	  var s = withPlayer(state, pid, {
   299	    cash: p.cash - card.cost,
   300	    assets: p.assets.concat([card.id]),
   301	    bag: p.bag.concat(card.tokensAdded)
   302	  });
   303	  s = assign(s, { market: market, purchasedThisTurn: true });
   304	  return addLog(s, "ASSET_BOUGHT", { cardId: card.id, cost: card.cost, tokensAdded: card.tokensAdded.slice() });
   305	}
   306	
   307	function buyInsurance(state, data) {
   308	  if (state.phase !== "buy") reject("BUY_INSURANCE", "phase");
   309	  if (state.purchasedThisTurn) reject("BUY_INSURANCE", "alreadyPurchased");
   310	  var pid = state.currentPlayer;
   311	  var p = state.players[pid];
   312	  if (p.cash < data.balance.insuranceCost) reject("BUY_INSURANCE", "insufficientCash");
   313	  var idx = p.bag.indexOf("blackSwan"); // 只看 bag，不看 drawn；移除索引最小者，無 RNG
   314	  if (idx < 0) reject("BUY_INSURANCE", "noBlackSwan");
   315	
   316	  var bag = p.bag.slice(0, idx).concat(p.bag.slice(idx + 1));
   317	  var s = withPlayer(state, pid, { cash: p.cash - data.balance.insuranceCost, bag: bag });
   318	  s = assign(s, { purchasedThisTurn: true });
   319	  return addLog(s, "INSURANCE_BOUGHT", {
   320	    cost: data.balance.insuranceCost,
   321	    bagBlackSwanAfter: selectors.bagBlackSwanCount(s, pid)
   322	  });
   323	}
   324	
   325	function endTurn(state, data) {
   326	  if (state.phase !== "buy") reject("END_TURN", "phase");
   327	  var pid = state.currentPlayer;
   328	  var p = state.players[pid];
   329	  // R-10：drawn 依順序附加到 bag 尾端；回合暫存欄位歸零。
   330	  var s = withPlayer(state, pid, {
   331	    bag: p.bag.concat(p.drawn),
   332	    drawn: [],
   333	    pendingIncome: 0,
   334	    blackSwanCount: 0,
   335	    luckyActive: false,
   336	    swanReturnUsed: false,
   337	    busted: false
   338	  });
   339	  s = assign(s, { purchasedThisTurn: false });
   340	  s = addLog(s, "TURN_ENDED", {});
   341	  if (pid === "human") {
   342	    s = assign(s, { currentPlayer: "ai", phase: "draw" });
   343	    return refillMarket(s, data);
   344	  }
   345	  s = assign(s, { phase: "roundEnd" });
   346	  return addLog(s, "ROUND_ENDED", { round: s.round, netWorth: netWorthSnapshot(s, data) });
   347	}
   348	
   349	function nextRound(state, data) {
   350	  if (state.phase !== "roundEnd") reject("NEXT_ROUND", "phase");
   351	  if (state.round === data.balance.rounds) {
   352	    // R-02：淨資產較高者勝；相同為 tie。
   353	    var nw = netWorthSnapshot(state, data);
   354	    var winner = nw.human > nw.ai ? "human" : (nw.ai > nw.human ? "ai" : "tie");
   355	    var s = assign(state, { phase: "gameOver", winner: winner });
   356	    return addLog(s, "GAME_OVER", { winner: winner, netWorth: nw });
   357	  }
   358	  var s2 = assign(state, { round: state.round + 1, currentPlayer: "human", phase: "draw" });
   359	  return refillMarket(s2, data);
   360	}
   361	
   362	function aiTurn(state, data) {
   363	  if (state.currentPlayer !== "ai") reject("AI_TURN", "notAiTurn");
   364	  if (state.phase !== "draw" && state.phase !== "buy") reject("AI_TURN", "phase");
   365	  var decision = ai.decideAi(state, data);
   366	  if (!decision) reject("AI_TURN", "noDecision");
   367	  var s = addLog(state, "AI_DECIDED", { decision: decision.action, reason: decision.reason });
   368	  return reduce(s, decision.action, data);
   369	}
   370	
   371	/* ---------- 對外介面 ---------- */
   372	
   373	function reduce(state, action, data) {
   374	  if (!action || typeof action.type !== "string") reject("UNKNOWN", "noType");
   375	  switch (action.type) {
   376	    case "START_GAME": return startGame(state, action, data);
   377	    case "DRAW": return draw(state, data);
   378	    case "STOP": return stop(state, data);
   379	    case "BUY_ASSET": return buyAsset(state, action, data);
   380	    case "BUY_INSURANCE": return buyInsurance(state, data);
   381	    case "END_TURN": return endTurn(state, data);
   382	    case "NEXT_ROUND": return nextRound(state, data);
   383	    case "AI_TURN": return aiTurn(state, data);
   384	    default: reject(action.type, "unknownAction");
   385	  }
   386	}
   387	
   388	/** UI 用：該 action 是否可套用。以 try/reduce 判斷，與 reduce 的拒絕條件必然一致。 */
   389	function canApply(state, action, data) {
   390	  try {
   391	    reduce(state, action, data);
   392	    return true;
   393	  } catch (e) {
   394	    if (e && typeof e.message === "string" && e.message.indexOf("REJECT:") === 0) return false;
   395	    throw e;
   396	  }
   397	}
   398	
   399	module.exports = {
   400	  initialState: initialState,
   401	  createInitialState: initialState,
   402	  reduce: reduce,
   403	  canApply: canApply,
   404	  SPEC_VERSION: SPEC_VERSION
   405	};
```

### 5.7 `src/engine/ai.js`（72 行，3011 bytes）

```
     1	"use strict";
     2	/**
     3	 * AI 對手決策（規格 §7、R-18～R-20）。
     4	 * 純函數：不讀時間、不呼叫 RNG、不修改 state／data。
     5	 * 每次只回傳「一個」action；AI_TURN 由 reducer 逐步套用。
     6	 */
     7	var selectors = require("./selectors");
     8	
     9	/**
    10	 * 以指定座位（playerId）與難度參數決策。
    11	 * decideAi 只是 playerId="ai"、difficulty=state.difficulty 的特例；
    12	 * 拆出 decideFor 是為了讓測試能用同一套策略驅動 human 座位做 AI 對 AI 自動對局，
    13	 * 不必在測試裡複製決策邏輯。
    14	 * 回傳 { action, reason }；不在 draw／buy 階段回傳 null。
    15	 */
    16	function decideFor(state, playerId, difficulty, data) {
    17	  if (state.phase !== "draw" && state.phase !== "buy") return null;
    18	  if (state.currentPlayer !== playerId) return null;
    19	  var params = data.balance.ai[difficulty];
    20	  if (!params) return null;
    21	  var p = state.players[playerId];
    22	
    23	  if (state.phase === "draw") {
    24	    // R-19：候選集為空 → STOP；黑天鵝值達（門檻 − offset）→ STOP；暫存收入達 incomeStop → STOP；否則 DRAW。
    25	    if (selectors.candidates(state, playerId).length === 0) {
    26	      return { action: { type: "STOP" }, reason: "noCandidates" };
    27	    }
    28	    var th = selectors.threshold(state, playerId, data);
    29	    if (p.blackSwanCount >= th - params.swanStopOffset) {
    30	      return { action: { type: "STOP" }, reason: "swanStop" };
    31	    }
    32	    if (p.pendingIncome >= params.incomeStop) {
    33	      return { action: { type: "STOP" }, reason: "incomeStop" };
    34	    }
    35	    return { action: { type: "DRAW" }, reason: "push" };
    36	  }
    37	
    38	  // buy 階段（R-20）
    39	  if (state.purchasedThisTurn) {
    40	    return { action: { type: "END_TURN" }, reason: "done" };
    41	  }
    42	  // 買得起的卡，依 cost 降冪、同價依 market 索引升冪（排序穩定：先建索引再比較）。
    43	  var affordable = [];
    44	  for (var i = 0; i < state.market.length; i++) {
    45	    var card = selectors.byId(data.assets.assets, state.market[i]);
    46	    if (card && card.cost <= p.cash) affordable.push({ idx: i, card: card });
    47	  }
    48	  affordable.sort(function (a, b) {
    49	    if (b.card.cost !== a.card.cost) return b.card.cost - a.card.cost;
    50	    return a.idx - b.idx;
    51	  });
    52	  if (affordable.length > 0) {
    53	    return { action: { type: "BUY_ASSET", cardId: affordable[0].card.id }, reason: "buyMostExpensive" };
    54	  }
    55	  if (params.buyInsurance === true &&
    56	      p.cash >= data.balance.insuranceCost &&
    57	      selectors.bagBlackSwanCount(state, playerId) > 0) {
    58	    return { action: { type: "BUY_INSURANCE" }, reason: "insuranceFallback" };
    59	  }
    60	  return { action: { type: "END_TURN" }, reason: "nothingToBuy" };
    61	}
    62	
    63	/**
    64	 * 規格 §7 介面：decideAi(state, data) → { action, reason }。
    65	 * 只在 currentPlayer==="ai" 且 phase ∈ {draw, buy} 有定義，否則回傳 null。
    66	 * 難度讀 state.difficulty → data.balance.ai[difficulty]。
    67	 */
    68	function decideAi(state, data) {
    69	  return decideFor(state, "ai", state.difficulty, data);
    70	}
    71	
    72	module.exports = { decideAi: decideAi, decideFor: decideFor };
```

### 5.8 `src/engine/selectors.js`（92 行，2960 bytes）

```
     1	"use strict";
     2	/**
     3	 * selectors：由 state ＋ data 導出的唯讀值（規格 §2「淨資產」、§7、§8.3）。
     4	 * 全部為純函數，不修改輸入。UI 不得自行計算這些值。
     5	 */
     6	
     7	/** 在 list 中依 id 查表；找不到回傳 undefined。 */
     8	function byId(list, id) {
     9	  for (var i = 0; i < list.length; i++) {
    10	    if (list[i].id === id) return list[i];
    11	  }
    12	  return undefined;
    13	}
    14	
    15	/** 玩家已購資產卡的物件陣列（依購買順序）。 */
    16	function ownedAssets(state, playerId, data) {
    17	  var ids = state.players[playerId].assets;
    18	  var out = [];
    19	  for (var i = 0; i < ids.length; i++) {
    20	    var card = byId(data.assets.assets, ids[i]);
    21	    if (card) out.push(card);
    22	  }
    23	  return out;
    24	}
    25	
    26	/** 玩家擁有的、指定效果型別的資產卡。 */
    27	function assetsWithEffect(state, playerId, data, effectType) {
    28	  return ownedAssets(state, playerId, data).filter(function (card) {
    29	    return card.effect && card.effect.type === effectType;
    30	  });
    31	}
    32	
    33	/** R-03：淨資產 ＝ cash ＋ 已購資產 value 總和（pendingIncome 不算）。 */
    34	function netWorth(state, playerId, data) {
    35	  var p = state.players[playerId];
    36	  var total = p.cash;
    37	  var cards = ownedAssets(state, playerId, data);
    38	  for (var i = 0; i < cards.length; i++) total += cards[i].value;
    39	  return total;
    40	}
    41	
    42	/** R-16：門檻 ＝ balance.blackSwanThreshold ＋ 所有 THRESHOLD_PLUS 的 param（可疊加）。 */
    43	function threshold(state, playerId, data) {
    44	  var base = data.balance.blackSwanThreshold;
    45	  var cards = assetsWithEffect(state, playerId, data, "THRESHOLD_PLUS");
    46	  for (var i = 0; i < cards.length; i++) base += cards[i].effect.param;
    47	  return base;
    48	}
    49	
    50	/**
    51	 * R-12／R-23：可抽候選集。回傳「bag 索引」陣列（依 bag 順序）。
    52	 * luckyActive 時排除 blackSwan；否則整個 bag。
    53	 * 回傳索引而非 tokenId，讓 reducer 能以 nextInt(候選數) 直接定位要移出的籌碼。
    54	 */
    55	function candidates(state, playerId) {
    56	  var p = state.players[playerId];
    57	  var out = [];
    58	  for (var i = 0; i < p.bag.length; i++) {
    59	    if (p.luckyActive && p.bag[i] === "blackSwan") continue;
    60	    out.push(i);
    61	  }
    62	  return out;
    63	}
    64	
    65	/** 袋中各籌碼數量統計 `{ [tokenId]: count }`，供 UI 顯示剩餘。 */
    66	function bagSummary(state, playerId) {
    67	  var bag = state.players[playerId].bag;
    68	  var out = {};
    69	  for (var i = 0; i < bag.length; i++) {
    70	    out[bag[i]] = (out[bag[i]] || 0) + 1;
    71	  }
    72	  return out;
    73	}
    74	
    75	/** bag 中 blackSwan 的數量（只看 bag，不看 drawn；BUY_INSURANCE 前置條件用）。 */
    76	function bagBlackSwanCount(state, playerId) {
    77	  var bag = state.players[playerId].bag;
    78	  var n = 0;
    79	  for (var i = 0; i < bag.length; i++) if (bag[i] === "blackSwan") n++;
    80	  return n;
    81	}
    82	
    83	module.exports = {
    84	  byId: byId,
    85	  ownedAssets: ownedAssets,
    86	  assetsWithEffect: assetsWithEffect,
    87	  netWorth: netWorth,
    88	  threshold: threshold,
    89	  candidates: candidates,
    90	  bagSummary: bagSummary,
    91	  bagBlackSwanCount: bagBlackSwanCount
    92	};
```

### 5.9 `src/engine/index.js`（22 行，606 bytes）

```
     1	"use strict";
     2	/**
     3	 * engine 匯出總表（方便測試與 UI 一次取得）。
     4	 * 各檔皆為 CommonJS；build 依 ADR-001 §2.4 以迷你模組註冊器包進單一 HTML。
     5	 */
     6	var rng = require("./rng");
     7	var selectors = require("./selectors");
     8	var ai = require("./ai");
     9	var reducer = require("./reducer");
    10	
    11	module.exports = {
    12	  rng: rng,
    13	  selectors: selectors,
    14	  ai: ai,
    15	  reducer: reducer,
    16	  initialState: reducer.initialState,
    17	  createInitialState: reducer.createInitialState,
    18	  reduce: reducer.reduce,
    19	  canApply: reducer.canApply,
    20	  decideAi: ai.decideAi,
    21	  SPEC_VERSION: reducer.SPEC_VERSION
    22	};
```

### 5.10 `src/ui/app.js`（500 行，28640 bytes）

執行環境：由 `build/bundle.js` 打包後在瀏覽器執行；`require` 由打包時的迷你註冊器解析；`GAME_DATA` 為打包時注入的四個 JSON。

```
     1	"use strict";
     2	/**
     3	 * UI 層（規格 §8、ADR-001 §2.4）：只做「呈現 state、送出 action」。
     4	 * - 所有規則數字一律讀 state／selectors／GAME_DATA，不在 UI 算規則。
     5	 * - UI 自身狀態（目前畫面、抽屜開關、選取項、加速開關、動畫計數）只存在本模組變數，不寫進 engine state。
     6	 * - setTimeout 只用於 AI 回合的可視化節奏（balance.ui.aiStepDelayMs）；engine 無感。
     7	 * - engine 拋出的錯誤在 dispatch 攔截並顯示橫幅，頁面不會死掉。
     8	 */
     9	var reducer = require("../engine/reducer");
    10	var selectors = require("../engine/selectors");
    11	
    12	var data = null;   // GAME_DATA（build 注入）
    13	var root = null;   // <div id="app">
    14	var state = null;  // engine state
    15	var ui = {
    16	  screen: "title",      // title | jobSelect（phase==="lobby" 時由 UI 決定）
    17	  difficulty: "normal",
    18	  seedInput: "",
    19	  jobId: null,
    20	  marketOpen: false,
    21	  buySel: null,         // "card:<id>" | "insurance" | null
    22	  fast: false,
    23	  aiTimer: null,
    24	  error: null,
    25	  flyKey: ""            // 上次渲染的「玩家:已翻顆數」，用來只讓新籌碼做飛入動畫
    26	};
    27	
    28	/* ---------- 小工具 ---------- */
    29	
    30	function esc(s) {
    31	  return String(s).replace(/[&<>"']/g, function (c) {
    32	    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    33	  });
    34	}
    35	function money(n) { return (n < 0 ? "−$" : "$") + Math.abs(n); }
    36	function signed(n) { return (n < 0 ? "−$" : "＋$") + Math.abs(n); }
    37	function jobOf(pid) { return selectors.byId(data.jobs.jobs, state.players[pid].jobId); }
    38	function tokenOf(id) { return selectors.byId(data.tokens.tokens, id); }
    39	function cardOf(id) { return selectors.byId(data.assets.assets, id); }
    40	function can(action) { return reducer.canApply(state, action, data); }
    41	function isAiTurn() { return state.currentPlayer === "ai" && (state.phase === "draw" || state.phase === "buy"); }
    42	
    43	/** 依 tokens.json 順序輸出袋子摘要文字，例如「收入 5・黑天鵝 2」。 */
    44	function bagText(pid) {
    45	  var sum = selectors.bagSummary(state, pid);
    46	  var groups = {};
    47	  var order = [];
    48	  for (var i = 0; i < data.tokens.tokens.length; i++) {
    49	    var t = data.tokens.tokens[i];
    50	    var n = sum[t.id] || 0;
    51	    if (!n) continue;
    52	    var label = t.kind === "income" ? "收入" : t.name;
    53	    if (!groups[label]) { groups[label] = 0; order.push(label); }
    54	    groups[label] += n;
    55	  }
    56	  return order.map(function (k) { return k + " " + groups[k]; }).join("・") || "空";
    57	}
    58	
    59	/** 資產卡效果說明（讀 assets.json 的 effect 與 tokensAdded，不寫死數字）。 */
    60	function cardDesc(card) {
    61	  var parts = [];
    62	  if (card.tokensAdded && card.tokensAdded.length) {
    63	    var cnt = {};
    64	    var ord = [];
    65	    card.tokensAdded.forEach(function (id) { if (!cnt[id]) { cnt[id] = 0; ord.push(id); } cnt[id]++; });
    66	    parts.push("袋子加入 " + ord.map(function (id) {
    67	      var t = tokenOf(id);
    68	      var nm = t ? (t.kind === "income" ? "收入＋" + t.value : t.name) : id;
    69	      return nm + " ×" + cnt[id];
    70	    }).join("、"));
    71	  }
    72	  var e = card.effect || {};
    73	  if (e.type === "SWAN_RETURN_ONCE") parts.push("每回合第一顆黑天鵝放回袋子");
    74	  else if (e.type === "STOP_BONUS") parts.push("主動停手多拿 $" + e.param);
    75	  else if (e.type === "NTH_INCOME_DOUBLE") parts.push("本回合第 " + e.param + " 顆收入籌碼價值翻倍");
    76	  else if (e.type === "THRESHOLD_PLUS") parts.push("黑天鵝門檻 ＋" + e.param);
    77	  parts.push("面值 $" + card.value + " 計入淨資產");
    78	  return parts.join("；");
    79	}
    80	
    81	/** 已翻出籌碼 → chip HTML。黑天鵝事件名依規格 §6.3：第 n 顆取 eventNames[(n−1) % length]。 */
    82	function chipsHtml(pid, animateFrom) {
    83	  var drawn = state.players[pid].drawn;
    84	  if (!drawn.length) return '<span class="empty">還沒翻</span>';
    85	  var swanN = 0;
    86	  var out = "";
    87	  for (var i = 0; i < drawn.length; i++) {
    88	    var t = tokenOf(drawn[i]);
    89	    var cls = "chip", label = t ? t.name : drawn[i];
    90	    if (t && t.kind === "income") { cls += " in"; label = "＋" + t.value; }
    91	    else if (t && t.kind === "blackSwan") {
    92	      swanN++;
    93	      cls += " bs";
    94	      var names = t.eventNames || [];
    95	      label = names.length ? names[(swanN - 1) % names.length] : t.name;
    96	    }
    97	    else if (t && t.kind === "insurance") { cls += " ins"; label = "保險"; }
    98	    else if (t && t.kind === "lucky") { cls += " lk"; label = "幸運"; }
    99	    if (i >= animateFrom) cls += " fly";
   100	    out += '<span class="' + cls + '" style="animation-duration:' + data.balance.ui.tokenFlyMs + 'ms">' + esc(label) + "</span>";
   101	  }
   102	  return out;
   103	}
   104	
   105	/** 從 log 讀某玩家某回合的摘要（只讀尾端事件做播報，不算規則）。 */
   106	function turnSummary(pid, round) {
   107	  var s = { draws: 0, stopped: false, busted: false, income: null, cashBefore: null, cashAfter: null, bonus: 0, bought: null, insurance: false };
   108	  for (var i = 0; i < state.log.length; i++) {
   109	    var e = state.log[i];
   110	    if (e.player !== pid || e.round !== round) continue;
   111	    if (e.type === "TOKEN_DRAWN") s.draws++;
   112	    else if (e.type === "STOPPED") { s.stopped = true; s.bonus = e.bonus || 0; }
   113	    else if (e.type === "BUST") s.busted = true;
   114	    else if (e.type === "INCOME_SETTLED") { s.income = e.amount; s.cashAfter = e.cashAfter; s.cashBefore = e.cashAfter - e.amount; }
   115	    else if (e.type === "ASSET_BOUGHT") s.bought = e.cardId;
   116	    else if (e.type === "INSURANCE_BOUGHT") s.insurance = true;
   117	  }
   118	  return s;
   119	}
   120	
   121	/** AI 最近一次決策的中文播報（讀 log 尾端 AI_DECIDED）。 */
   122	function aiNarration() {
   123	  var last = null;
   124	  for (var i = state.log.length - 1; i >= 0; i--) {
   125	    if (state.log[i].type === "AI_DECIDED" && state.log[i].round === state.round) { last = state.log[i]; break; }
   126	    if (state.log[i].type === "TURN_ENDED" && state.log[i].player === "human" && state.log[i].round === state.round) break;
   127	  }
   128	  if (!last) return "AI 準備翻牌…";
   129	  var d = last.decision || {};
   130	  var r = last.reason;
   131	  if (d.type === "DRAW") return "AI 再翻一顆";
   132	  if (d.type === "STOP") {
   133	    if (r === "swanStop") return "AI 停手：黑天鵝逼近門檻";
   134	    if (r === "incomeStop") return "AI 停手：收入夠了";
   135	    if (r === "noCandidates") return "AI 停手：袋子翻完了";
   136	    return "AI 停手";
   137	  }
   138	  if (d.type === "BUY_ASSET") { var c = cardOf(d.cardId); return "AI 買下「" + (c ? c.name : d.cardId) + "」"; }
   139	  if (d.type === "BUY_INSURANCE") return "AI 買了保險";
   140	  if (d.type === "END_TURN") return "AI 結束回合";
   141	  return "AI 行動中";
   142	}
   143	
   144	/* ---------- 各畫面 ---------- */
   145	
   146	function errHtml() {
   147	  if (!ui.error) return "";
   148	  return '<div class="err"><span>' + esc(ui.error) + '</span><button type="button" data-act="dismissError">知道了</button></div>';
   149	}
   150	
   151	function renderTitle() {
   152	  var diffs = Object.keys(data.balance.ai);
   153	  var diffLabel = { easy: "簡單", normal: "普通", hard: "困難" };
   154	  return '<section class="scr"><div class="bar"><span class="t">見好就收</span><span class="s">夜市攤主・' + data.balance.rounds + ' 回合</span></div>' +
   155	    '<div class="full"><div class="body">' + errHtml() +
   156	    '<div class="title-hero"><h1>見好就收</h1><p>翻籌碼賺錢，黑天鵝翻到 ' + data.balance.blackSwanThreshold + ' 顆就爆倉。' + data.balance.rounds + ' 回合後淨資產高者勝。</p></div>' +
   157	    '<div class="card"><div class="h"><span>AI 難度</span></div><div class="seg">' +
   158	    diffs.map(function (d) {
   159	      return '<button type="button" data-act="difficulty" data-v="' + d + '" class="' + (ui.difficulty === d ? "on" : "") + '">' + esc(diffLabel[d] || d) + "</button>";
   160	    }).join("") + "</div></div>" +
   161	    '<div class="card"><div class="field"><label for="seedInput">牌局代碼（seed）</label>' +
   162	    '<input id="seedInput" inputmode="numeric" pattern="[0-9]*" placeholder="留空＝自動產生" value="' + esc(ui.seedInput) + '">' +
   163	    '<span class="hint">輸入同一組代碼可重玩同一局；結束畫面會顯示本局代碼。</span></div></div>' +
   164	    '</div><div class="dock"><button type="button" class="dk go" data-act="toJobSelect">開始</button></div></div></section>';
   165	}
   166	
   167	function renderJobSelect() {
   168	  var jobs = data.jobs.jobs;
   169	  var th = data.balance.blackSwanThreshold;
   170	  var icons = ["🍢", "🍗", "🧋"];
   171	  return '<section class="scr"><div class="bar"><span class="t">見好就收</span><span class="s">夜市攤主・' + data.balance.rounds + ' 回合</span></div>' +
   172	    '<div class="full"><div class="body">' + errHtml() +
   173	    '<div class="hero"><h1>選擇你的攤位</h1><p>職業決定起始現金與袋子裡的籌碼。</p></div><div class="jobs">' +
   174	    jobs.map(function (j, idx) {
   175	      var total = 0, dots = "";
   176	      data.tokens.tokens.forEach(function (t) {
   177	        var n = j.startBag[t.id] || 0;
   178	        total += n;
   179	        var cls = t.kind === "blackSwan" ? "b" : (t.id === "income_m" ? "m" : (t.id === "income_l" ? "l" : ""));
   180	        for (var k = 0; k < n; k++) dots += "<i" + (cls ? ' class="' + cls + '"' : "") + "></i>";
   181	      });
   182	      return '<button type="button" class="job ' + (ui.jobId === j.id ? "sel" : "") + '" data-act="job" data-v="' + j.id + '">' +
   183	        '<div class="ic">' + icons[idx % icons.length] + '</div><div><div class="nm">' + esc(j.name) + " <small>" + esc(j.style) + "</small></div>" +
   184	        '<div class="meta">起始 $' + j.startCash + "・門檻 " + th + "・袋子 " + total + " 顆</div>" +
   185	        '<div class="fl">' + esc(j.flavor || "") + '</div><div class="dots">' + dots + '</div></div><div class="chk"></div></button>';
   186	    }).join("") + "</div></div>" +
   187	    '<div class="dock"><button type="button" class="dk ghost" data-act="toTitle">返回</button>' +
   188	    '<button type="button" class="dk go" data-act="start" ' + (ui.jobId ? "" : "disabled") + ">開始這一季</button></div></div></section>";
   189	}
   190	
   191	function marketItems(interactive) {
   192	  var p = state.players[state.currentPlayer];
   193	  var html = "";
   194	  state.market.forEach(function (id) {
   195	    var c = cardOf(id);
   196	    if (!c) return;
   197	    var ok = interactive ? can({ type: "BUY_ASSET", cardId: id }) : p.cash >= c.cost;
   198	    var sel = ui.buySel === "card:" + id;
   199	    var cls = "item" + (ok ? "" : " dim") + (sel ? " sel" : "");
   200	    var inner = '<div class="ic">🏪</div><div class="tx"><div class="n">' + esc(c.name) + '</div><div class="d">' + esc(cardDesc(c)) + '</div></div><div class="p">$' + c.cost + "</div>";
   201	    html += interactive
   202	      ? '<button type="button" class="' + cls + '" data-act="pick" data-v="card:' + id + '" ' + (ok ? "" : "disabled") + ">" + inner + '<div class="rad"></div></button>'
   203	      : '<div class="' + cls + '">' + inner + "</div>";
   204	  });
   205	  var insOk = interactive ? can({ type: "BUY_INSURANCE" }) : p.cash >= data.balance.insuranceCost;
   206	  var insSel = ui.buySel === "insurance";
   207	  var insInner = '<div class="ic ins">🛡️</div><div class="tx"><div class="n">保險</div><div class="d">從袋子永久移除 1 顆黑天鵝（袋中剩 ' + selectors.bagBlackSwanCount(state, state.currentPlayer) + " 顆）</div></div>" +
   208	    '<div class="p">$' + data.balance.insuranceCost + "</div>";
   209	  html += interactive
   210	    ? '<button type="button" class="item' + (insOk ? "" : " dim") + (insSel ? " sel" : "") + '" data-act="pick" data-v="insurance" ' + (insOk ? "" : "disabled") + ">" + insInner + '<div class="rad"></div></button>'
   211	    : '<div class="item' + (insOk ? "" : " dim") + '">' + insInner + "</div>";
   212	  if (!state.market.length) html += '<div class="mrow">市場已空</div>';
   213	  return html;
   214	}
   215	
   216	function statusCard(pid, animateFrom) {
   217	  var p = state.players[pid];
   218	  var th = selectors.threshold(state, pid, data);
   219	  var meter = "";
   220	  for (var i = 0; i < th; i++) meter += "<i class=\"" + (i < p.blackSwanCount ? "f" : "") + (i === th - 1 ? " last" : "") + "\"></i>";
   221	  var left = th - p.blackSwanCount;
   222	  var bagSwans = selectors.bagBlackSwanCount(state, pid);
   223	  var who = pid === "human" ? "" : "AI ";
   224	  var hint = p.busted ? "已爆倉：收入減半入帳" : ("再翻 " + left + " 顆黑天鵝就爆倉");
   225	  var lucky = p.luckyActive ? "・幸運生效：下一顆不會是黑天鵝" : "";
   226	  return '<div class="card"><div class="h"><span>' + who + "暫存收入（本回合）</span><span>袋子剩 <b>" + p.bag.length + "</b> 顆（" + esc(bagText(pid)) + "）</span></div>" +
   227	    '<div class="kv"><div class="big">' + money(p.pendingIncome) + '</div><div class="side">黑天鵝<br><b>' + p.blackSwanCount + " / " + th + "</b></div></div>" +
   228	    '<div class="meter">' + meter + '</div><div class="mrow"><span>' + esc(hint) + esc(lucky) + "</span><b>爆倉：收入減半（袋中黑天鵝 " + bagSwans + " 顆）</b></div></div>" +
   229	    '<div class="card"><div class="h"><span>' + who + "已翻出</span><span><b>" + p.drawn.length + "</b> 顆</span></div><div class=\"chips\">" + chipsHtml(pid, animateFrom) + "</div></div>";
   230	}
   231	
   232	function playerCard(pid, statusText) {
   233	  var p = state.players[pid];
   234	  var job = jobOf(pid);
   235	  var isMe = pid === "human";
   236	  return '<div class="card"><div class="ai"><div class="av' + (isMe ? " me" : "") + '">' + (isMe ? "你" : "AI") + '</div><div><div class="nm">' +
   237	    (isMe ? "你" : "AI 對手") + "（" + esc(job ? job.name : "") + ")</div><div class=\"st\">" + esc(statusText) + "</div></div>" +
   238	    '<div class="num">現金 ' + money(p.cash) + "<b>淨資產 " + money(selectors.netWorth(state, pid, data)) + "</b></div></div></div>";
   239	}
   240	
   241	function assetsCard(pid) {
   242	  var cards = selectors.ownedAssets(state, pid, data);
   243	  var who = pid === "human" ? "你的資產" : "AI 的資產";
   244	  return '<div class="card"><div class="h"><span>' + who + "</span><span><b>" + cards.length + "</b> 張</span></div><div class=\"assets\">" +
   245	    (cards.length ? cards.map(function (c) { return "<span>" + esc(c.name) + " $" + c.value + "</span>"; }).join("") : '<span class="empty">尚無</span>') + "</div></div>";
   246	}
   247	
   248	function lastTurnText(pid) {
   249	  var round = pid === "ai" ? state.round - 1 : state.round;
   250	  if (round < 1) return "尚未行動";
   251	  var s = turnSummary(pid, round);
   252	  if (s.income === null) return "尚未行動";
   253	  return "上回合翻 " + s.draws + " 顆・" + (s.busted ? "爆倉" : "停手") + "・入帳 " + signed(s.income);
   254	}
   255	
   256	function renderPlayDraw() {
   257	  var round = state.round, job = jobOf("human");
   258	  var animateFrom = ui.flyKey === "human:" + (state.players.human.drawn.length - 1) ? state.players.human.drawn.length - 1 : state.players.human.drawn.length;
   259	  ui.flyKey = "human:" + state.players.human.drawn.length;
   260	  return '<section class="scr' + (ui.marketOpen ? " mkopen" : "") + '"><div class="bar"><div><div class="t">第 ' + round + " / " + data.balance.rounds + ' 回合</div><div class="s">你的回合・' + esc(job.name) + "</div></div>" +
   261	    '<span class="pill">現金 ' + money(state.players.human.cash) + "</span></div>" +
   262	    '<div class="col"><div class="body">' + errHtml() + statusCard("human", animateFrom) + playerCard("ai", lastTurnText("ai")) + assetsCard("human") + "</div>" +
   263	    '<div class="dock"><button type="button" class="dk draw" data-act="draw" ' + (can({ type: "DRAW" }) ? "" : "disabled") + ">再翻</button>" +
   264	    '<button type="button" class="dk stop" data-act="stop" ' + (can({ type: "STOP" }) ? "" : "disabled") + ">停手</button>" +
   265	    '<button type="button" class="dk mk" data-act="openMarket">🏪 市場<span class="cnt">' + state.market.length + "</span></button></div></div>" +
   266	    '<div class="scrim" data-act="closeMarket"></div><div class="sheet"><div class="grab"></div><div class="h"><b>市場・先買先得</b><button type="button" data-act="closeMarket">關閉</button></div>' +
   267	    marketItems(false) + '<div class="mrow" style="margin-top:10px">停手後才能購買，每回合 0–' + data.balance.purchasesPerTurn + " 張</div></div></section>";
   268	}
   269	
   270	function renderPlayBuy() {
   271	  var round = state.round, job = jobOf("human");
   272	  var s = turnSummary("human", round);
   273	  var th = selectors.threshold(state, "human", data);
   274	  var p = state.players.human;
   275	  var boughtCard = s.bought ? cardOf(s.bought) : null;
   276	  var buyBtn;
   277	  if (state.purchasedThisTurn) {
   278	    buyBtn = '<button type="button" class="dk go" data-act="endTurn">結束回合</button>';
   279	  } else {
   280	    var label = "買入";
   281	    if (ui.buySel === "insurance") label = "買保險 $" + data.balance.insuranceCost;
   282	    else if (ui.buySel && ui.buySel.indexOf("card:") === 0) { var c = cardOf(ui.buySel.slice(5)); if (c) label = "買入 $" + c.cost; }
   283	    buyBtn = '<button type="button" class="dk ghost" data-act="endTurn">不買</button>' +
   284	      '<button type="button" class="dk go" data-act="buy" ' + (ui.buySel ? "" : "disabled") + ">" + esc(label) + "</button>";
   285	  }
   286	  return '<section class="scr"><div class="bar"><div><div class="t">' + (p.busted ? "爆倉結算" : "回合結算") + '</div><div class="s">第 ' + round + " / " + data.balance.rounds + " 回合・" + esc(job.name) + "</div></div>" +
   287	    '<span class="pill">現金 ' + money(p.cash) + "</span></div>" +
   288	    '<div class="full"><div class="body">' + errHtml() +
   289	    '<div class="sum"><div class="h">本回合入帳</div><div class="big">' + signed(s.income || 0) + '</div><div class="rows">' +
   290	    "<span>" + (p.busted ? "爆倉於" : "停手於") + "<b>第 " + s.draws + " 顆</b></span><span>黑天鵝<b>" + p.blackSwanCount + " / " + th + "</b></span>" +
   291	    "<span>爆倉減半<b>" + (p.busted ? "有" : "無") + "</b></span>" + (s.bonus ? "<span>停手加成<b>＋$" + s.bonus + "</b></span>" : "") +
   292	    "<span>現金<b>" + money(s.cashBefore === null ? p.cash : s.cashBefore) + " → " + money(s.cashAfter === null ? p.cash : s.cashAfter) + "</b></span></div></div>" +
   293	    '<div class="card list"><div class="h" style="margin:8px 0 2px"><span>' +
   294	    (state.purchasedThisTurn ? ("已買下：" + esc(boughtCard ? boughtCard.name : (s.insurance ? "保險" : ""))) : ("用 " + money(p.cash) + " 買 0–" + data.balance.purchasesPerTurn + " 張，或一份保險")) +
   295	    "</span></div>" + (state.purchasedThisTurn ? '<div class="mrow" style="margin:8px 0">本回合購買次數已用完。</div>' : marketItems(true)) + "</div>" +
   296	    assetsCard("human") + '</div><div class="dock">' + buyBtn + "</div></div></section>";
   297	}
   298	
   299	function renderPlayAi() {
   300	  var round = state.round, job = jobOf("ai");
   301	  var animateFrom = ui.flyKey === "ai:" + (state.players.ai.drawn.length - 1) ? state.players.ai.drawn.length - 1 : state.players.ai.drawn.length;
   302	  ui.flyKey = "ai:" + state.players.ai.drawn.length;
   303	  var narr = aiNarration();
   304	  var lastBought = turnSummary("ai", round);
   305	  var boughtText = lastBought.bought ? ("本回合買下：" + (cardOf(lastBought.bought) || {}).name) : (lastBought.insurance ? "本回合買了保險" : "");
   306	  return '<section class="scr"><div class="bar"><div><div class="t">第 ' + round + " / " + data.balance.rounds + ' 回合</div><div class="s">AI 的回合・' + esc(job.name) + "</div></div>" +
   307	    '<span class="pill ai">AI 現金 ' + money(state.players.ai.cash) + "</span></div>" +
   308	    '<div class="col"><div class="body">' + errHtml() + statusCard("ai", animateFrom) +
   309	    '<div class="card"><div class="note ai">' + esc(narr) + (boughtText ? "<br>" + esc(boughtText) : "") + "</div></div>" +
   310	    playerCard("human", "等 AI 翻完就輪到你") + "</div>" +
   311	    '<div class="dock"><button type="button" class="dk wait" disabled>' + esc(narr) + "</button>" +
   312	    '<button type="button" class="dk fast' + (ui.fast ? " on" : "") + '" data-act="toggleFast">' + (ui.fast ? "加速中" : "加速") + "</button></div></div>" +
   313	    '<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="h"><b>市場</b></div>' + marketItems(false) + "</div></section>";
   314	}
   315	
   316	function renderRoundEnd() {
   317	  var round = state.round;
   318	  var last = state.round === data.balance.rounds;
   319	  var nwH = selectors.netWorth(state, "human", data), nwA = selectors.netWorth(state, "ai", data);
   320	  var sh = turnSummary("human", round), sa = turnSummary("ai", round);
   321	  var diff = nwH - nwA;
   322	  return '<section class="scr"><div class="bar"><div><div class="t">第 ' + round + " 回合結束</div><div class=\"s\">" + (last ? "最後一回合" : "還有 " + (data.balance.rounds - round) + " 回合") + "</div></div>" +
   323	    '<span class="pill lite">seed ' + state.seed + "</span></div>" +
   324	    '<div class="full"><div class="body">' + errHtml() +
   325	    '<div class="sum"><div class="h">你的淨資產</div><div class="big">' + money(nwH) + '</div><div class="rows">' +
   326	    "<span>AI 淨資產<b>" + money(nwA) + "</b></span><span>" + (diff >= 0 ? "領先" : "落後") + "<b>" + money(Math.abs(diff)) + "</b></span>" +
   327	    "<span>你本回合入帳<b>" + signed(sh.income || 0) + (sh.busted ? "（爆倉）" : "") + "</b></span><span>AI 本回合入帳<b>" + signed(sa.income || 0) + (sa.busted ? "（爆倉）" : "") + "</b></span></div></div>" +
   328	    playerCard("human", "翻 " + sh.draws + " 顆・" + (sh.busted ? "爆倉" : "停手") + (sh.bought ? "・買下" + (cardOf(sh.bought) || {}).name : (sh.insurance ? "・買保險" : ""))) +
   329	    playerCard("ai", "翻 " + sa.draws + " 顆・" + (sa.busted ? "爆倉" : "停手") + (sa.bought ? "・買下" + (cardOf(sa.bought) || {}).name : (sa.insurance ? "・買保險" : ""))) +
   330	    assetsCard("human") + assetsCard("ai") +
   331	    '</div><div class="dock"><button type="button" class="dk go" data-act="nextRound">' + (last ? "看結果" : "下一回合") + "</button></div></div></section>";
   332	}
   333	
   334	function renderGameOver() {
   335	  var nwH = selectors.netWorth(state, "human", data), nwA = selectors.netWorth(state, "ai", data);
   336	  var w = state.winner;
   337	  var title = w === "human" ? "你贏了" : (w === "ai" ? "AI 贏了" : "平手");
   338	  var cls = w === "human" ? "win" : (w === "ai" ? "lose" : "");
   339	  return '<section class="scr"><div class="bar"><div><div class="t">本局結束</div><div class="s">' + data.balance.rounds + " 回合・難度 " + esc(state.difficulty) + "</div></div></div>" +
   340	    '<div class="full"><div class="body">' + errHtml() +
   341	    '<div class="sum ' + cls + '"><div class="h">結果</div><div class="big">' + title + '</div><div class="rows"><span>你的淨資產<b>' + money(nwH) + "</b></span><span>AI 淨資產<b>" + money(nwA) + "</b></span>" +
   342	    "<span>差距<b>" + money(Math.abs(nwH - nwA)) + "</b></span></div></div>" +
   343	    '<div class="card"><div class="h"><span>本局牌局代碼（seed）</span></div><div class="seedrow"><code id="seedText">' + state.seed + '</code><button type="button" data-act="copySeed">複製</button></div>' +
   344	    '<div class="mrow" style="margin-top:8px"><span>' + esc(ui.copyMsg || "回報問題時附上這組代碼，就能重現同一局。") + "</span></div></div>" +
   345	    playerCard("human", "現金 " + money(state.players.human.cash)) + playerCard("ai", "現金 " + money(state.players.ai.cash)) +
   346	    assetsCard("human") + assetsCard("ai") +
   347	    '</div><div class="dock"><button type="button" class="dk go" data-act="restart">再來一局</button></div></div></section>';
   348	}
   349	
   350	/* ---------- 主渲染與事件 ---------- */
   351	
   352	function render() {
   353	  var html;
   354	  if (state.phase === "lobby") html = ui.screen === "jobSelect" ? renderJobSelect() : renderTitle();
   355	  else if (state.phase === "roundEnd") html = renderRoundEnd();
   356	  else if (state.phase === "gameOver") html = renderGameOver();
   357	  else if (state.currentPlayer === "ai") html = renderPlayAi();
   358	  else if (state.phase === "buy") html = renderPlayBuy();
   359	  else html = renderPlayDraw();
   360	  root.innerHTML = html;
   361	  root.setAttribute("data-phase", state.phase);
   362	  root.setAttribute("data-screen", screenName());
   363	  scheduleAi();
   364	}
   365	
   366	function screenName() {
   367	  if (state.phase === "lobby") return ui.screen;
   368	  if (state.phase === "roundEnd") return "roundEnd";
   369	  if (state.phase === "gameOver") return "gameOver";
   370	  if (state.currentPlayer === "ai") return "aiTurn";
   371	  return state.phase === "buy" ? "humanBuy" : "humanTurn";
   372	}
   373	
   374	/** 送 action 給 engine；engine 拒絕或例外時只顯示橫幅，不讓頁面死掉。 */
   375	function dispatch(action) {
   376	  try {
   377	    state = reducer.reduce(state, action, data);
   378	    ui.error = null;
   379	  } catch (e) {
   380	    ui.error = "動作未被接受：" + (e && e.message ? e.message : String(e));
   381	  }
   382	  render();
   383	}
   384	
   385	/** AI 回合節奏：每步 ≥ aiStepDelayMs（加速時縮短，仍只在 UI 層）。 */
   386	function scheduleAi() {
   387	  if (ui.aiTimer) { clearTimeout(ui.aiTimer); ui.aiTimer = null; }
   388	  if (!isAiTurn() || ui.error) return;
   389	  var delay = data.balance.ui.aiStepDelayMs;
   390	  if (ui.fast) delay = Math.floor(delay / 4);
   391	  ui.aiTimer = setTimeout(function () {
   392	    ui.aiTimer = null;
   393	    if (isAiTurn()) dispatch({ type: "AI_TURN" });
   394	  }, delay);
   395	}
   396	
   397	function parseSeed(text) {
   398	  var t = String(text || "").trim();
   399	  if (!/^\d{1,10}$/.test(t)) return null;
   400	  var n = Number(t);
   401	  if (n > 4294967295) return null;
   402	  return n >>> 0;
   403	}
   404	
   405	function copySeed() {
   406	  var text = String(state.seed);
   407	  var done = function () { ui.copyMsg = "已複製 " + text; render(); };
   408	  var fail = function () { ui.copyMsg = "無法自動複製，請手動長按選取代碼。"; render(); };
   409	  try {
   410	    if (navigator.clipboard && navigator.clipboard.writeText) {
   411	      navigator.clipboard.writeText(text).then(done, fail);
   412	      return;
   413	    }
   414	  } catch (e) { /* 走備援 */ }
   415	  try {
   416	    var ta = document.createElement("textarea");
   417	    ta.value = text;
   418	    ta.setAttribute("readonly", "");
   419	    ta.style.position = "absolute";
   420	    ta.style.left = "-9999px";
   421	    document.body.appendChild(ta);
   422	    ta.select();
   423	    var ok = document.execCommand && document.execCommand("copy");
   424	    document.body.removeChild(ta);
   425	    if (ok) done(); else fail();
   426	  } catch (e2) { fail(); }
   427	}
   428	
   429	function onClick(ev) {
   430	  var el = ev.target;
   431	  while (el && el !== root && !(el.getAttribute && el.getAttribute("data-act"))) el = el.parentNode;
   432	  if (!el || el === root) return;
   433	  if (el.disabled) return;
   434	  var act = el.getAttribute("data-act"), v = el.getAttribute("data-v");
   435	  switch (act) {
   436	    case "difficulty": ui.difficulty = v; render(); break;
   437	    case "toJobSelect": ui.screen = "jobSelect"; render(); break;
   438	    case "toTitle": ui.screen = "title"; render(); break;
   439	    case "job": ui.jobId = v; render(); break;
   440	    case "start": {
   441	      var seed = parseSeed(ui.seedInput);
   442	      if (seed === null) seed = Date.now() >>> 0; // 只在 UI 層產生 seed（規格 §8.1）
   443	      ui.buySel = null; ui.marketOpen = false; ui.copyMsg = ""; ui.flyKey = "";
   444	      dispatch({ type: "START_GAME", seed: seed, jobId: ui.jobId, difficulty: ui.difficulty });
   445	      break;
   446	    }
   447	    case "draw": dispatch({ type: "DRAW" }); break;
   448	    case "stop": ui.buySel = null; ui.marketOpen = false; dispatch({ type: "STOP" }); break;
   449	    case "openMarket": ui.marketOpen = true; render(); break;
   450	    case "closeMarket": ui.marketOpen = false; render(); break;
   451	    case "pick": ui.buySel = (ui.buySel === v) ? null : v; render(); break;
   452	    case "buy": {
   453	      if (!ui.buySel) return;
   454	      var action = ui.buySel === "insurance" ? { type: "BUY_INSURANCE" } : { type: "BUY_ASSET", cardId: ui.buySel.slice(5) };
   455	      ui.buySel = null;
   456	      dispatch(action);
   457	      break;
   458	    }
   459	    case "endTurn": ui.buySel = null; ui.flyKey = ""; dispatch({ type: "END_TURN" }); break;
   460	    case "toggleFast": ui.fast = !ui.fast; render(); break;
   461	    case "nextRound": ui.flyKey = ""; dispatch({ type: "NEXT_ROUND" }); break;
   462	    case "copySeed": copySeed(); break;
   463	    case "restart":
   464	      if (ui.aiTimer) { clearTimeout(ui.aiTimer); ui.aiTimer = null; }
   465	      state = reducer.initialState();
   466	      ui.screen = "title"; ui.error = null; ui.buySel = null; ui.copyMsg = ""; ui.flyKey = "";
   467	      render();
   468	      break;
   469	    case "dismissError": ui.error = null; render(); break;
   470	    default: break;
   471	  }
   472	}
   473	
   474	function onInput(ev) {
   475	  if (ev.target && ev.target.id === "seedInput") ui.seedInput = ev.target.value;
   476	}
   477	
   478	function boot() {
   479	  data = window.GAME_DATA;
   480	  root = document.getElementById("app");
   481	  if (!data || !root) {
   482	    if (root) root.textContent = "載入失敗：找不到遊戲資料（GAME_DATA）。";
   483	    return;
   484	  }
   485	  state = reducer.initialState();
   486	  root.addEventListener("click", onClick);
   487	  root.addEventListener("input", onInput);
   488	  window.addEventListener("error", function (e) {
   489	    ui.error = "頁面錯誤：" + (e && e.message ? e.message : "未知");
   490	    try { render(); } catch (e2) { /* 已盡力 */ }
   491	  });
   492	  render();
   493	  // 供煙霧測試讀取畫面狀態（唯讀）。
   494	  window.__game = { getState: function () { return state; }, getScreen: screenName };
   495	}
   496	
   497	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
   498	else boot();
   499	
   500	module.exports = { boot: boot };
```

### 5.11 `src/ui/styles.css`（182 行，13093 bytes）

不貼內容：純 CSS（含手機直向／iPad 橫向 `@media (min-width:900px) and (min-aspect-ratio:1/1)` 切換、`min-height:88px` 的再翻／停手鈕）。

### 5.12 `src/ui/index.template.html`（17 行，598 bytes）

不貼內容：只含 `<!-- INJECT:CSS -->`、`<!-- INJECT:DATA -->`、`<!-- INJECT:JS -->` 三個注入標記與 `<div id="app">`，無 `<script src>`／`<link href>`。

### 5.13 `build/bundle.js`（131 行，6048 bytes）

執行環境：Node ≥ 18，`node build/bundle.js`，只用內建 `fs`／`path`。

```
     1	#!/usr/bin/env node
     2	"use strict";
     3	/**
     4	 * build/bundle.js：把 src/ 打包成單一 index.html（ADR-001 §2.4；規格 §9）。
     5	 * - 只用 Node 內建 fs／path，零套件；不壓縮、不做 source map。
     6	 * - 決定性：同樣的 src/ 產生 byte-identical 的 index.html（不寫時間戳）。
     7	 * - 注入順序：<!-- INJECT:CSS -->（styles.css）→ <!-- INJECT:DATA -->（window.GAME_DATA）→ <!-- INJECT:JS -->（迷你模組註冊器＋各檔）。
     8	 * - 檔案清單寫死於 FILES（S4 新增檔案必須同步改這裡，見分派單 X-4）。
     9	 * - 輸出後自檢：無 http://、https://、<link、@import、外部 src=；檔案 < 300 KB。
    10	 *
    11	 * 用法：node build/bundle.js [--out <path>]（預設輸出到 repo 根目錄 index.html）
    12	 */
    13	var fs = require("fs");
    14	var path = require("path");
    15	
    16	var ROOT = path.resolve(__dirname, "..");
    17	var SRC = path.join(ROOT, "src");
    18	
    19	/** 依賴順序：被 require 的檔先註冊（註冊器為惰性求值，順序其實無關，但依 ADR 固定）。 */
    20	var FILES = [
    21	  "engine/rng.js",
    22	  "engine/selectors.js",
    23	  "engine/ai.js",
    24	  "engine/reducer.js",
    25	  "engine/index.js",
    26	  "ui/app.js"
    27	];
    28	var ENTRY = "ui/app.js";
    29	var DATA_FILES = ["jobs", "assets", "tokens", "balance"];
    30	var MAX_BYTES = 300 * 1024;
    31	
    32	function read(rel) { return fs.readFileSync(path.join(SRC, rel), "utf8"); }
    33	
    34	/** 迷你 CommonJS 註冊器（瀏覽器端）；require 只支援相對路徑與 ./x、../x、x/index.js。 */
    35	var REGISTRY = [
    36	  "var __mods = {}, __cache = {};",
    37	  "function __define(k, f) { __mods[k] = f; }",
    38	  "function __resolve(from, req) {",
    39	  "  var base = from.split('/'); base.pop();",
    40	  "  var parts = req.split('/');",
    41	  "  for (var i = 0; i < parts.length; i++) {",
    42	  "    if (parts[i] === '.' || parts[i] === '') continue;",
    43	  "    if (parts[i] === '..') base.pop(); else base.push(parts[i]);",
    44	  "  }",
    45	  "  var k = base.join('/');",
    46	  "  if (__mods[k]) return k;",
    47	  "  if (__mods[k + '.js']) return k + '.js';",
    48	  "  if (__mods[k + '/index.js']) return k + '/index.js';",
    49	  "  throw new Error('module not found: ' + req + ' (from ' + from + ')');",
    50	  "}",
    51	  "function __require(k) {",
    52	  "  if (__cache[k]) return __cache[k].exports;",
    53	  "  var m = { exports: {} }; __cache[k] = m;",
    54	  "  __mods[k](m, m.exports, function (req) { return __require(__resolve(k, req)); });",
    55	  "  return m.exports;",
    56	  "}"
    57	].join("\n");
    58	
    59	/** 讓字串可安全放進 <script>：避免 </script> 提前結束。 */
    60	function safeScript(s) { return s.replace(/<\/script/gi, "<\\/script"); }
    61	
    62	function build(outPath) {
    63	  var template = read("ui/index.template.html");
    64	  ["<!-- INJECT:CSS -->", "<!-- INJECT:DATA -->", "<!-- INJECT:JS -->"].forEach(function (mark) {
    65	    if (template.indexOf(mark) < 0) throw new Error("template 缺少標記 " + mark);
    66	  });
    67	
    68	  var css = read("ui/styles.css").replace(/<\/style/gi, "<\\/style");
    69	
    70	  var dataObj = {};
    71	  DATA_FILES.forEach(function (name) { dataObj[name] = JSON.parse(read("data/" + name + ".json")); });
    72	  var dataScript = "<script>\nwindow.GAME_DATA = " + safeScript(JSON.stringify(dataObj)) + ";\n</script>";
    73	
    74	  var js = ["<script>", "(function () {", '"use strict";', REGISTRY];
    75	  FILES.forEach(function (rel) {
    76	    js.push("__define(" + JSON.stringify(rel) + ", function (module, exports, require) {");
    77	    js.push(safeScript(read(rel)));
    78	    js.push("});");
    79	  });
    80	  js.push("__require(" + JSON.stringify(ENTRY) + ");");
    81	  js.push("})();");
    82	  js.push("</script>");
    83	
    84	  // 用函式替換：字串替換會把原始碼裡的 $&、$' 等當成特殊樣式，導致產物語法錯誤。
    85	  var cssBlock = "<style>\n" + css + "\n</style>";
    86	  var jsBlock = js.join("\n");
    87	  var html = template
    88	    .replace("<!-- INJECT:CSS -->", function () { return cssBlock; })
    89	    .replace("<!-- INJECT:DATA -->", function () { return dataScript; })
    90	    .replace("<!-- INJECT:JS -->", function () { return jsBlock; });
    91	
    92	  var problems = check(html);
    93	  if (problems.length) throw new Error("產物自檢失敗：\n- " + problems.join("\n- "));
    94	
    95	  fs.writeFileSync(outPath, html, "utf8");
    96	  return { bytes: Buffer.byteLength(html, "utf8"), files: FILES.length, data: DATA_FILES.length };
    97	}
    98	
    99	/** 零外部資源與大小檢查（規格 A-05、T-UI-04）。 */
   100	function check(html) {
   101	  var problems = [];
   102	  // 只掃描 HTML 標籤層級的外連（JS／CSS 原始碼裡的字串不算資源引用），故先移除 <script>／<style> 內容再掃。
   103	  var shell = html.replace(/<script[\s\S]*?<\/script>/gi, "<script></script>").replace(/<style[\s\S]*?<\/style>/gi, "<style></style>");
   104	  if (/https?:\/\//i.test(shell)) problems.push("HTML 標籤層出現 http:// 或 https://");
   105	  if (/<link\b/i.test(shell)) problems.push("出現 <link");
   106	  if (/\bsrc\s*=\s*["'][^"']+["']/i.test(shell)) problems.push("出現外部 src=");
   107	  if (/@import/i.test(html)) problems.push("出現 @import");
   108	  if (/url\(\s*["']?https?:/i.test(html)) problems.push("CSS 出現外部 url(http…)");
   109	  // 程式碼層也不得引用網址（憲法第 3 節第 5 條：斷網可玩）。
   110	  var codeHits = html.match(/https?:\/\/[^\s"')]+/gi) || [];
   111	  codeHits = codeHits.filter(function (u) { return !/^https?:\/\/(www\.)?w3\.org\//i.test(u); }); // SVG 命名空間 URI 不是資源
   112	  if (codeHits.length) problems.push("原始碼出現網址：" + codeHits.slice(0, 3).join(", "));
   113	  var bytes = Buffer.byteLength(html, "utf8");
   114	  if (bytes >= MAX_BYTES) problems.push("檔案 " + bytes + " bytes ≥ " + MAX_BYTES);
   115	  return problems;
   116	}
   117	
   118	if (require.main === module) {
   119	  var out = path.join(ROOT, "index.html");
   120	  var idx = process.argv.indexOf("--out");
   121	  if (idx > 0 && process.argv[idx + 1]) out = path.resolve(process.argv[idx + 1]);
   122	  try {
   123	    var r = build(out);
   124	    console.log("build 完成：" + path.relative(ROOT, out) + "（" + r.bytes + " bytes；" + r.files + " 個模組、" + r.data + " 個資料檔；零外部資源）");
   125	  } catch (e) {
   126	    console.error("build 失敗：" + e.message);
   127	    process.exit(1);
   128	  }
   129	}
   130	
   131	module.exports = { build: build, check: check, FILES: FILES };
```

---

## 6. 測試清單與目前結果

測試指令：`npm test`（＝ `npm run test:engine && npm run build && npm run test:ui`）。engine 測試用 Node 內建 `node:test`，零套件；UI 煙霧測試用 Playwright Chromium（純 Node 腳本 `node tests/ui/smoke.spec.js`）。

目前結果（2026-09-13）：

```
> npm run test:engine
# tests 45  # pass 45  # fail 0  # skipped 0

> npm run build
build 完成：index.html（70067 bytes；6 個模組、4 個資料檔；零外部資源）

> npm run test:ui
T-UI-04-no-external：ok
[phone 390×844]  T-UI-01-loads ok   T-UI-02-full-game ok（123 步、到第 12 回合、gameOver 顯示 seed 20260913）   T-UI-03-touch-size ok（31 個可點元素）
[ipad 1194×834]  T-UI-01-loads ok   T-UI-02-full-game ok（123 步、到第 12 回合、gameOver 顯示 seed 20260913）   T-UI-03-touch-size ok（23 個可點元素）
```

### 6.1 `tests/engine/*.test.js` 測試名（45 個，全部通過；內容不貼）

| 測試檔 | 測試名稱 |
|---|---|
| `tests/engine/rng.test.js` | T-RNG-01-mulberry32-vector、T-RNG-02-call-count |
| `tests/engine/replay.test.js` | T-R-21-replay-deterministic、T-R-25-reducer-immutable |
| `tests/engine/rules.test.js` | T-R-01-fixed-rounds、T-R-02-winner-by-networth、T-R-02-tie、T-R-03-networth-formula、T-R-04-draw-phase-actions、T-R-05-income-token、T-R-06-blackswan-token、T-R-07-bust-halves、T-R-07-bust-never-negative、T-R-23-empty-bag-rejects-draw、T-R-08-buy-asset-adds-tokens、T-R-09-insurance-removes-swan、T-R-09-insurance-reject-no-swan、T-R-22-one-purchase-per-turn、T-R-24-insufficient-cash、T-R-11-market-refill、T-R-11-market-short-when-deck-empty、T-R-10-tokens-return、T-R-12-lucky-skips-swan、T-R-13-insurance-token-offsets、T-R-14-swan-return-once、T-R-15-nth-income-double、T-R-16-threshold-plus、T-R-17-stop-bonus |
| `tests/engine/invariants.test.js` | T-INV-1-bag-plus-drawn-constant、T-INV-2-card-total-constant、T-INV-3-non-negative、T-INV-4-log-seq、T-INV-5-draw-phase-no-purchase、T-INV-schema-keys |
| `tests/engine/data.test.js` | T-DATA-00-json-parse、T-DATA-01-asset-ids-unique、T-DATA-02-job-bag-tokens-exist、T-DATA-03-tokens-added-exist、T-DATA-04-effect-enum、T-DATA-05-ai-difficulties、T-DATA-06-rule-cards-at-least-3、T-DATA-07-engine-never-reads-ui-balance、T-DATA-08-no-simplified-chinese |
| `tests/engine/build.test.js` | T-BUILD-01-single-file、T-BUILD-02-idempotent |

另有 `tests/engine/helpers.js`（建 state、跑 action 序列的共用工具）與 `tests/engine/selfplay.js`（AI 對 AI 自動對局統計腳本，非 node:test，手動執行 `node tests/engine/selfplay.js`）。

### 6.2 `tests/ui/smoke.spec.js`（Playwright，兩種視窗各跑一次，全部通過）

T-UI-01-loads（開啟後 console 無錯誤）、T-UI-02-full-game（選職業 → 反覆「再翻／停手／不買／下一回合」直到 gameOver，驗 seed 顯示與複製鈕）、T-UI-03-touch-size（掃描所有可點元素 ≥ 44×44，「再翻」「停手」≥ 88 高）、T-UI-04-no-external（`index.html` 內無 `http://`／`https://`／`<link`／外部 `src=`）。

### 6.3 AI 對 AI 自動對局統計（`node tests/engine/selfplay.js`，每格 200 局，seed 1～200）

human 座位由測試以同一套策略（`decideFor`）代打 normal 難度；ai 座位為正式 `decideAi`。

| ai 難度 | ai 座位勝率 | human 座位勝率 | 平手 | 平均 action 數／局 | 平均翻牌數／人回合 | 爆倉率／人回合 | 平均淨資產 human／ai |
|---|---|---|---|---|---|---|---|
| easy | 0.5% | 99.5% | 0.0% | 162.9 | 3.7 | 0.0% | 732.0／336.2 |
| normal | 44.0% | 55.0% | 1.0% | 204.6 | 5.2 | 0.0% | 759.0／766.6 |
| hard | 92.0% | 8.0% | 0.0% | 225.8 | 6.1 | 0.0% | 740.4／1109.7 |

---

## 7. 已知問題與刻意取捨（不必重複回報）

| # | 來源 | 內容 | 目前處置 |
|---|---|---|---|
| K-1 | S3 自動對局統計 | AI 對 AI 200 局 × 9 組合，爆倉率皆為 0%。工程師回報指出原因為 `balance.ai.*.swanStopOffset ≥ 1`，AI 在黑天鵝值達「門檻 − offset」時即停手。 | 留 G5 playtest 調整數值；本版不改 |
| K-2 | S3 自動對局統計 | 對 normal 策略代打的 human 座位，easy AI 勝率 0.5%、hard AI 勝率 92.0%，難度差距極大；hard 是否「較強」在規格中標為 UNKNOWN。 | 留 G5 playtest；本版不改 |
| K-3 | S1 回報 | `balance.json` 有 `purchasesPerTurn: 1`，但 engine 以 `purchasedThisTurn` 布林實作「每回合限購一次」，未讀取此欄位；UI 有讀它來顯示「0–1 張」。 | 已知；若未來要可買多張，engine 需同步改 |
| K-4 | S3 回報 | 規格 §5 的 `T-R-18-ai-pure`、`T-R-19-ai-stop-rules`、`T-R-20-ai-buy-most-expensive`、`T-R-20-ai-insurance-fallback` 四個測試與 `tests/engine/ai.test.js` 尚未建立；`T-AI-selfplay-stats` 未掛在 node:test 下，只有手動腳本 `selfplay.js`。AI 決策目前只由自動對局間接覆蓋。 | 待補（G5 前）；本次審查請仍檢查 `ai.js` |
| K-5 | S5 回報 | Playwright 煙霧測試走法為「翻兩顆就停、不買」，未覆蓋購買與爆倉路徑；購買與爆倉只由 engine 測試覆蓋。 | 建議 G5 補固定 seed 的爆倉／購買腳本 |
| K-6 | S5 回報 | build 曾因 `String.prototype.replace` 以字串當替換值、原始碼中的 `$'` 被當成特殊樣式而產生語法錯誤的 `index.html`；已改為函式替換並加 `T-BUILD-01` 注入一致性檢查。 | 已修 |
| K-7 | S5 回報 | 分派單要求 `playwright.config.js` ＋ `@playwright/test`，實作改為純 Node 腳本 `require("playwright")`；兩個「project」以腳本內 `VIEWPORTS` 陣列實作。`npm test` 在 engine 與 ui 之間插入 `build`。 | 刻意取捨（少一份設定檔）；待製作人確認 |
| K-8 | S2 回報 | 實際匯出比分派單多：`selectors` 多 `ownedAssets`、`assetsWithEffect`、`bagBlackSwanCount`；`ai` 多 `decideFor`（供測試以同策略代打 human 座位）；`reducer` 多 `createInitialState`（與 `initialState` 同一函數）與 `SPEC_VERSION`。 | 刻意取捨 |
| K-9 | S2 回報 | 規格附錄 A 拍板：`START_GAME` 未帶 `aiJobId` 時，以 rng 從 jobs.json 隨機三選一，消耗 1 次 RNG，順序在 Fisher–Yates 洗牌之前（所以 START_GAME 實際 RNG 次數為 12，而非 §4 表中的 11）；`aiDefaultJobId` 僅測試用預設。 | 規格附錄 A 已定，§4 表的「11」尚未同步更新 |
| K-10 | S3 回報 | `T-DATA-07`（engine 不讀 `balance.ui`）與 `T-DATA-08`（簡體字掃描）是規格 §9.3 未列的額外測試。 | 保留 |
| K-11 | S4 回報 | `balance.ui.aiStepDelayMs = 400`：正常速度下 AI 一回合約 6～9 步 ≈ 3～4 秒，12 回合累計約 40～50 秒；UI 有「加速」鈕（延遲 ÷4）。體感留 G5。 | 留 G5 |
| K-12 | S4 回報 | 正式文案未提供，UI 使用暫定文案（title 副標、AI 對手名稱、AI 播報 6 句、難度中文、gameOver 標題），未用 `【文案待補】` 佔位以免破版。 | 待 story-editor |
| K-13 | S4 回報 | 購買為兩步式「點選 → 買入」；圖示用 emoji 取代 SVG；`navigator.clipboard` 在 `file://` 下的行為未驗（有 `execCommand` 與手動長按備援）。 | 刻意取捨／待製作人決定 |
| K-14 | S4 回報 | 未在真機 iPad Safari／手機瀏覽器驗證（只有 Chromium headless）；規格 A-08～A-12 由製作人真機驗。 | 製作人本機驗 |

---

## 8. 特別請你檢查的六個問題

請逐一回答（格式見第 1 節）。這些是我們自己最不放心的地方，但**我們沒有把自己的判斷寫在這裡**，請你獨立看程式碼下結論。

- **Q-1 reducer 是否有任何路徑修改輸入 state？** `src/engine/reducer.js` 採「淺層複製＋只替換被改的分支」；請追每一個 action 分支（含 `AI_TURN` 內部再呼叫 `reduce`、`refillMarket`、`END_TURN` 的 drawn 回袋、`BUY_INSURANCE` 移除黑天鵝、`BUY_ASSET` 的 `bag.push(...tokensAdded)`），確認沒有任何 `push`／`splice`／直接賦值作用在傳入的 state 或其子物件、陣列上。也請看 `canApply` 是否可能改到 state。
- **Q-2 RNG 消耗順序是否一致、AI_TURN 重放是否決定性？** `START_GAME` 的 RNG 消耗順序為「AI 職業隨機（未帶 `aiJobId` 時 1 次）→ Fisher–Yates 洗牌（11 次）」；`DRAW` 消耗 1 次；其餘 action 不消耗。請確認：(a) 帶與不帶 `aiJobId` 兩種情況下，後續洗牌結果是否會因 RNG 序列偏移而不同（這是否符合規格意圖）；(b) `decideAi` 是否真的不消耗 RNG、不讀任何非 state／data 的東西；(c) 同 seed 連續送 `AI_TURN` 的結果是否只取決於 state；(d) `rng.nextInt` 以 `Math.floor(value * n)` 取整，是否有 `value * n` 落到 `n` 的邊界風險。
- **Q-3 爆倉減半是否整數處理？** 規格 R-07：`cash += floor(pendingIncome × bustKeepRatio)`，`bustKeepRatio = 0.5` 來自 `balance.json`。請確認 `reducer.js` 的爆倉結算是否使用 `Math.floor`（或等價整數化）、`pendingIncome` 為奇數時結果是否為整數、`cash` 是否可能變成浮點數；並確認 `NTH_INCOME_DOUBLE` 的 `value + value` 與 `STOP_BONUS` 的加法是否有讓 `cash`／`pendingIncome` 脫離整數的路徑。
- **Q-4 UI 是否有把規則算在 UI 層？** `src/ui/app.js` 應只讀 state／`selectors.*`／`GAME_DATA`，按鈕可用性只用 `reducer.canApply`。請找出任何在 UI 內自行推導規則的地方：例如自行比較 `blackSwanCount` 與門檻、自行算淨資產、自行判斷可否購買、自行判斷 `phase` 轉換、`buySel` 的購買流程是否可能繞過 `canApply`、黑天鵝事件名 `eventNames[(n−1) % length]` 的 n 是怎麼算的。也請確認 UI 沒有寫入 engine state 的任何欄位。
- **Q-5 AI 決策是否可能無限迴圈？** UI 以 `setTimeout` 反覆送 `AI_TURN` 直到 `currentPlayer !== "ai"`。請確認 `decideAi` 在每個可能的 state 下都會回傳一個 `reduce` 必定接受的 action（例如：候選集為空時回 STOP 而非 DRAW；`purchasedThisTurn` 為 true 時回 END_TURN；市場為空、現金為 0、bag 無黑天鵝等邊界），以及若 `reduce` 對 AI 的決策拋出 `REJECT`，`app.js` 的迴圈會停止還是持續重送。
- **Q-6 黑天鵝門檻與保險籌碼的邊界。** 請檢查：(a) `THRESHOLD_PLUS` 多張疊加後 `selectors.threshold` 的算法；(b) `insurance` 籌碼抵銷（`blackSwanCount − 1`，最低 0）與 `SWAN_RETURN_ONCE`（第一顆黑天鵝放回袋尾、不進 drawn）在同一回合交錯時，`blackSwanCount` 與 `bag.length + drawn.length` 不變式是否仍成立；(c) 爆倉判定用 `>=` 還是 `>`；(d) `luckyActive` 為 true 而 bag 只剩黑天鵝時 `candidates` 是否為空、`DRAW` 是否被拒絕、AI 是否會因此 STOP；(e) `BUY_INSURANCE` 只看 `bag`（不看 `drawn`）移除第一顆黑天鵝，若當回合黑天鵝全在 `drawn` 中，前置條件的判定與 `INSURANCE_BOUGHT.bagBlackSwanAfter` 的值。

---

## 9. 分批指引

- 本檔總字元數見檔頭。本專案以**約 100,000 字元**為單次貼上的分批門檻；本檔 89872 字元，未超過門檻，可單批整份貼上；下表為備用的分批方式。
- 若你使用的 AI 版本單次貼上限制較小，請依下表拆成兩批，**每批都要獨立可讀**：兩批都從第 1 節提示詞與第 2 節簡介開始，然後放該批的內容，結尾註明「本批為第 n／2 批，其餘檔案在其他批次，若某問題需要跨批的脈絡請標『需跨批確認』」。以「檔案」為單位切，不把一個檔案切成兩半。

| 批次 | 內容 | 約略字元數 |
|---|---|---|
| 批 1：engine | 第 1、2 節 ＋ 第 3 節規則 ＋ 第 4 節 schema／action／AI ＋ 第 5.1～5.9（`src/data/*.json`、`src/engine/*.js`）＋ 第 6 節測試清單 ＋ 第 7 節已知問題 ＋ 第 8 節 Q-1、Q-2、Q-3、Q-5、Q-6 | 約 53000 |
| 批 2：UI 與 build | 第 1、2 節 ＋ 第 4.1 節 state schema（UI 讀哪些欄位）＋ 第 5.10～5.13（`src/ui/app.js`、`build/bundle.js`，`styles.css` 與 template 只列檔名）＋ 第 7 節已知問題 K-5～K-7、K-11～K-14 ＋ 第 8 節 Q-4、Q-5 | 約 50000 |

批 2 審 UI 時若需要 engine 的 `canApply`／`selectors` 簽章，請在建議修法欄標「需跨批確認」，不要猜。

---

（本審查包結束。回覆請依第 1 節「回覆格式」。）
