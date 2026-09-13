# 規格書：「見好就收」v0.1（夜市攤主・對 AI）

- 撰寫角色：systems-engineer　- 日期：2026-09-13　- 版本：v0.1　- Gate：G3
- 依據：`docs/design/story-outline.md` v2（含第 9 節製作人拍板）、`CLAUDE.md` 第 3 節五條原則、`docs/spec/ADR-001-engine-architecture.md`
- 對應任務：T-001（分派單 `docs/tickets/T-001/dispatch.md`）
- 數值狀態：本文所有數值皆為**初版建議值，待 G5 playtest 調整**；「一局 10–20 分鐘」與「對 AI 勝率約 50%」為 **UNKNOWN 假設**，尚未驗證。

---

## 1. 範圍宣告

### 1.1 做的事（依 outline 第 9 節拍板）
- 主題：**甲「夜市攤主」**（outline §9 第 1 條）。
- 模式：**只做「對 AI」**，1 位人類玩家對 1 位 AI 玩家，同一台裝置（outline §9 第 2 條）。
- 一局固定 12 回合；每回合兩位玩家各進行一次「翻牌 → 入帳 → 購買」。
- 交付：單一 `index.html`，零依賴、可離線（CLAUDE.md 第 1 節、第 3 節第 5 條）。

### 1.2 不做清單（依 outline 第 8 節，加上第 9 節作廢項）
| # | 不做 | 出處 |
|---|---|---|
| N-1 | 存檔、帳號、連線、排行、成就 | outline §8 |
| N-2 | 真實金融商品名稱與教學文字（不說教） | outline §8 |
| N-3 | 多幕結構、競標、隱藏資訊 | outline §8 |
| N-4 | 超過 12 張資產卡、超過 3 張職業卡、超過 12 回合 | outline §8 |
| N-5 | 主題切換（乙「登山補給站」不做） | outline §8、§9 第 1 條 |
| N-6 | 單人達標模式（目標金額、星等） | outline §9 第 2 條 |
| N-7 | 落後補償（老鼠尾巴） | outline §9 第 3 條 |
| N-8 | 同機輪流（hot-seat，兩位人類） | 本版只做對 AI；留待下一任務 |
| N-9 | 音效、動畫以外的美術資源（圖片檔） | 零依賴；v0.1 只用文字與 CSS |
| N-10 | 難度以外的任何設定選項（音量、語言、主題色） | 範圍控制 |

---

## 2. 名詞表（夜市用語 ↔ 系統名）

| 夜市用語（UI 顯示） | 系統名（程式識別字） | 型別 | 說明 |
|---|---|---|---|
| 機會袋 | `bag` | `string[]`（tokenId 陣列） | 玩家的籌碼袋；翻牌從這裡抽 |
| 籌碼 | `token` | `tokenId` 字串 | 六種之一，見第 6.3 節 |
| 黑天鵝 | `blackSwan` | tokenId | 翻到就讓黑天鵝值 +1；UI 依序顯示「下雨／衛生稽查／跳電…」等事件名 |
| 黑天鵝值 | `blackSwanCount` | `number` | 本回合累積翻到的黑天鵝數（保險籌碼可抵銷） |
| 門檻 | `blackSwanThreshold` | `number` | 黑天鵝值達此數即爆倉；基準值在 `balance.json`，資產可 +1 |
| 暫存收入 | `pendingIncome` | `number` | 本回合翻出但尚未入帳的收入 |
| 爆倉 | `bust` | 事件／布林 | 黑天鵝值 ≥ 門檻；暫存收入減半入帳 |
| 資產卡 | `assetCard` | 物件 | 12 張之一，見第 6.2 節 |
| 保險 | `insurance` | 購買動作／籌碼 | 購買：永久移除袋中 1 顆黑天鵝；籌碼：翻到時抵銷本回合 1 點黑天鵝值 |
| 幸運 | `lucky` | tokenId | 翻到後，下一顆不會是黑天鵝 |
| 市場 | `market` | `string[]`（cardId 陣列） | 公開的資產卡，補到 3 張 |
| 牌庫 | `deck` | `string[]` | 尚未進市場的資產卡 |
| 回合 | `round` | `number` | 1–12 |
| 現金 | `cash` | `number` | 已入帳的錢 |
| 淨資產 | `netWorth` | 導出值 | `cash` ＋ 已購資產卡 `value` 總和；不存進 state，由 `selectors.netWorth(state, playerId)` 算 |
| 職業卡 | `job` | 物件 | 3 張之一，決定起始現金與起始袋 |
| 再翻 | `DRAW` | action | — |
| 停手 | `STOP` | action | — |

---

## 3. 遊戲狀態 schema

### 3.1 完整 state（JSON，示範值為第 1 回合人類翻了兩顆之後）

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

### 3.2 欄位定義

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

### 3.3 不變式（每個 action 後都成立；測試 `T-INV-*`）
- INV-1：每位玩家 `bag.length + drawn.length` 在回合內不變，除非 BUY_ASSET（＋tokensAdded）、BUY_INSURANCE（−1）。
- INV-2：`market.length + deck.length + human.assets.length + ai.assets.length === 12`。
- INV-3：`cash ≥ 0`、`pendingIncome ≥ 0`、`blackSwanCount ≥ 0`。
- INV-4：`log[i].seq === i + 1`。
- INV-5：`phase === "draw"` 時 `purchasedThisTurn === false`。

---

## 4. Action 清單

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

### 4.1 Log 事件型別

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

---

## 5. 規則條文（每條可打勾，附測試名）

出處：outline §3 第 2、3 條與 §4 全部（§3 第 1 條單人達標、§4 落後補償已依 §9 作廢，不列）。R-11 之後為由 outline §5 元件清單與 §6 AI 推導的細則。

### 5.1 勝負
- [ ] **R-01** 一局固定 `balance.rounds`（＝12）回合，任何事件不改變回合數。→ `T-R-01-fixed-rounds`
- [ ] **R-02** 第 12 回合 AI 回合結束、送出 NEXT_ROUND 後，淨資產較高者勝；相同則 `winner="tie"`。→ `T-R-02-winner-by-networth`、`T-R-02-tie`
- [ ] **R-03** 淨資產 ＝ `cash` ＋ 已購資產卡 `value` 總和（`pendingIncome` 不算）。→ `T-R-03-networth-formula`

### 5.2 翻牌
- [ ] **R-04** `phase==="draw"` 時玩家只能送 DRAW 或 STOP；BUY_*／END_TURN／NEXT_ROUND 一律拒絕。→ `T-R-04-draw-phase-actions`
- [ ] **R-05** 翻出 `income_s／income_m／income_l` 時，`pendingIncome` 加上該籌碼 `value`。→ `T-R-05-income-token`
- [ ] **R-06** 翻出 `blackSwan` 時 `blackSwanCount +1`。→ `T-R-06-blackswan-token`
- [ ] **R-07** `blackSwanCount ≥ 門檻` 即爆倉：自動進入 buy 階段，`cash += floor(pendingIncome × bustKeepRatio)`；既有現金不減。→ `T-R-07-bust-halves`、`T-R-07-bust-never-negative`
- [ ] **R-23** 可抽候選集為空（bag 空，或 `luckyActive` 且 bag 只剩黑天鵝）時 DRAW 被拒絕，UI 只能 STOP。→ `T-R-23-empty-bag-rejects-draw`

### 5.3 購買
- [ ] **R-08** 停手或爆倉後可從市場買 0–1 張資產；`tokensAdded` 立即加入 bag，但本回合已在 buy 階段，故下回合起才可能翻到。→ `T-R-08-buy-asset-adds-tokens`
- [ ] **R-09** 可改買保險：`cash −= insuranceCost`，bag 永久移除 1 顆 blackSwan；bag 無 blackSwan 時拒絕。→ `T-R-09-insurance-removes-swan`、`T-R-09-insurance-reject-no-swan`
- [ ] **R-22** 每人每回合只能購買一次（資產或保險二選一）。→ `T-R-22-one-purchase-per-turn`
- [ ] **R-24** 現金不足時 BUY_ASSET／BUY_INSURANCE 拒絕，現金不變。→ `T-R-24-insufficient-cash`
- [ ] **R-11** 每位玩家回合開始時市場從 deck 補到 3 張；deck 空時允許少於 3 張。→ `T-R-11-market-refill`、`T-R-11-market-short-when-deck-empty`

### 5.4 收袋
- [ ] **R-10** END_TURN 時 `drawn` 全部回 bag（保險移除者除外，因移除只作用於 bag），`pendingIncome／blackSwanCount／luckyActive／swanReturnUsed／busted` 歸零。→ `T-R-10-tokens-return`

### 5.5 特殊籌碼
- [ ] **R-12** 翻到 `lucky` 後 `luckyActive=true`；下一次 DRAW 只從非 blackSwan 籌碼中抽，抽完 `luckyActive=false`。→ `T-R-12-lucky-skips-swan`
- [ ] **R-13** 翻到 `insurance` 籌碼時 `blackSwanCount = max(0, blackSwanCount − 1)`。→ `T-R-13-insurance-token-offsets`

### 5.6 改規則資產（效果 type 見第 6.2 節）
- [ ] **R-14** 擁有 `SWAN_RETURN_ONCE` 資產：每回合第一次翻到 blackSwan 時不計數、該籌碼直接放回 bag 尾端（不進 `drawn`），`swanReturnUsed=true`；第二次起正常計數。→ `T-R-14-swan-return-once`
- [ ] **R-15** 擁有 `NTH_INCOME_DOUBLE` 資產：本回合第 `param` 顆收入籌碼（只數 income_*）價值 ×2。→ `T-R-15-nth-income-double`
- [ ] **R-16** 擁有 `THRESHOLD_PLUS` 資產：該玩家門檻 ＝ `balance.blackSwanThreshold + param`；多張可疊加。→ `T-R-16-threshold-plus`
- [ ] **R-17** 擁有 `STOP_BONUS` 資產：主動 STOP 且未爆倉時 `cash += param`；爆倉不給。→ `T-R-17-stop-bonus`

### 5.7 AI
- [ ] **R-19** AI 在 draw 階段的決策：`blackSwanCount ≥ 門檻 − swanStopOffset` 或 `pendingIncome ≥ incomeStop` → STOP；否則 DRAW（候選集為空時 STOP）。→ `T-R-19-ai-stop-rules`
- [ ] **R-20** AI 在 buy 階段：買市場中買得起的最貴資產（同價取 market 索引小者）；買不起任何資產且 `buyInsurance===true` 且可買保險 → BUY_INSURANCE；否則 END_TURN。→ `T-R-20-ai-buy-most-expensive`、`T-R-20-ai-insurance-fallback`
- [ ] **R-18** `decideAi` 為純函數：同 state 同 data 呼叫兩次結果相同，且不修改輸入。→ `T-R-18-ai-pure`

### 5.8 決定性
- [ ] **R-21** 同 seed ＋ 同 action 序列 → 最終 state 深度相等（含 log）。→ `T-R-21-replay-deterministic`
- [ ] **R-25** `reduce` 不修改輸入 state（深度凍結後呼叫不拋錯）。→ `T-R-25-reducer-immutable`

**統計：規則 25 條（R-01～R-25，含 R-18～R-25 細則），對應測試名 30 個。**

---

## 6. 資料檔規格（`src/data/`）

所有數值標 **待 G5 playtest 調整**。文案欄位（`name`、`flavor`、`eventNames`）由 story-editor 可改，數值欄位只有 game-engineer 依製作人指示改。

### 6.1 `jobs.json`（3 張職業卡）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | `j01`～`j03` |
| `name` | string | 夜市攤名 |
| `style` | string | 文案：穩健／平均／賭徒 |
| `startCash` | number | 起始現金 |
| `startBag` | `{ [tokenId]: count }` | 起始袋；key 必須存在於 tokens.json |

```json
{
  "jobs": [
    { "id": "j01", "name": "滷味攤", "style": "穩健", "startCash": 80,
      "startBag": { "income_s": 6, "income_m": 2, "blackSwan": 3 },
      "flavor": "薄利多銷，客人穩，驚喜少。" },
    { "id": "j02", "name": "雞排攤", "style": "平均", "startCash": 100,
      "startBag": { "income_s": 4, "income_m": 3, "income_l": 1, "blackSwan": 4 },
      "flavor": "排隊是常態，油鍋跳電也是。" },
    { "id": "j03", "name": "飲料攤", "style": "賭徒", "startCash": 120,
      "startBag": { "income_s": 2, "income_m": 3, "income_l": 2, "blackSwan": 5 },
      "flavor": "天氣好賺翻，下雨全收攤。" }
  ]
}
```

起始袋籌碼總數：j01 ＝ 11、j02 ＝ 12、j03 ＝ 12；黑天鵝比例 27%／33%／42%。

### 6.2 `assets.json`（12 張資產卡）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | `a01`～`a12`，唯一 |
| `name` | string | 夜市設備名 |
| `cost` | number | 購買價 |
| `value` | number | 面值，計入淨資產 |
| `effect.type` | 枚舉 | `ADD_TOKENS`｜`SWAN_RETURN_ONCE`｜`NTH_INCOME_DOUBLE`｜`THRESHOLD_PLUS`｜`STOP_BONUS` |
| `effect.param` | number | 效果參數（ADD_TOKENS 為 0） |
| `tokensAdded` | tokenId[] | 購買後加入 bag 的籌碼（可為空） |
| `flavor` | string | 一句文案 |

```json
{
  "assets": [
    { "id": "a01", "name": "第二口鍋", "cost": 60, "value": 40, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_s", "income_s"], "flavor": "一次炸兩份，客人少等一半。" },
    { "id": "a02", "name": "保溫箱", "cost": 70, "value": 50, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_s", "income_m"], "flavor": "涼了也能賣，只是賣得慢。" },
    { "id": "a03", "name": "冷藏櫃", "cost": 100, "value": 70, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_m", "income_m"], "flavor": "食材撐得久，敢進貨了。" },
    { "id": "a04", "name": "招牌燈箱", "cost": 90, "value": 60, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_m", "lucky"], "flavor": "遠遠就看得到，運氣也跟著來。" },
    { "id": "a05", "name": "雨棚", "cost": 110, "value": 80, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["insurance", "income_s"], "flavor": "下雨？照賣。" },
    { "id": "a06", "name": "外送平台", "cost": 140, "value": 100, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_l", "income_s", "blackSwan"], "flavor": "單量暴增，抽成與負評也是。" },
    { "id": "a07", "name": "老闆娘的好人緣", "cost": 150, "value": 100, "effect": { "type": "SWAN_RETURN_ONCE", "param": 1 }, "tokensAdded": [], "flavor": "稽查員來了？先喝杯茶。每回合第一顆黑天鵝放回袋子。" },
    { "id": "a08", "name": "收銀機", "cost": 120, "value": 90, "effect": { "type": "STOP_BONUS", "param": 15 }, "tokensAdded": [], "flavor": "收攤結帳不漏錢。主動停手多拿 15。" },
    { "id": "a09", "name": "第三口鍋", "cost": 160, "value": 110, "effect": { "type": "NTH_INCOME_DOUBLE", "param": 3 }, "tokensAdded": [], "flavor": "翻到第 3 顆收入籌碼時價值翻倍。" },
    { "id": "a10", "name": "發電機", "cost": 180, "value": 130, "effect": { "type": "THRESHOLD_PLUS", "param": 1 }, "tokensAdded": [], "flavor": "跳電不怕。黑天鵝門檻 +1。" },
    { "id": "a11", "name": "常客名單", "cost": 200, "value": 240, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_l", "income_l"], "flavor": "老客人就是資產。" },
    { "id": "a12", "name": "老字號招牌", "cost": 260, "value": 320, "effect": { "type": "ADD_TOKENS", "param": 0 }, "tokensAdded": ["income_m"], "flavor": "三十年老店，名字本身就值錢。" }
  ]
}
```

設計註記：
- 改規則卡 4 張（a07、a08、a09、a10），符合 outline §5「至少 3 張」。
- 引擎型卡（a01–a10）`value < cost`（約 0.65–0.75），買了是為了袋子變好；面值型卡（a11、a12）`value > cost`（1.2×），是第三幕「最後一次翻盤」的來源（outline B 第三幕）。此比例為假設，**待 G5 調整**。
- 價格區間 60–260。

### 6.3 `tokens.json`（6 種籌碼）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | tokenId |
| `name` | string | UI 顯示名 |
| `kind` | 枚舉 | `income`｜`blackSwan`｜`insurance`｜`lucky` |
| `value` | number | 收入籌碼的金額；其他為 0 |
| `eventNames` | string[] | 只有 blackSwan 用：UI 依「本回合第 n 顆黑天鵝」取 `eventNames[(n−1) % length]` 顯示，無 RNG |

```json
{
  "tokens": [
    { "id": "income_s", "name": "小單", "kind": "income", "value": 10 },
    { "id": "income_m", "name": "中單", "kind": "income", "value": 20 },
    { "id": "income_l", "name": "大單", "kind": "income", "value": 40 },
    { "id": "blackSwan", "name": "黑天鵝", "kind": "blackSwan", "value": 0,
      "eventNames": ["下雨", "衛生稽查", "跳電", "隔壁攤大特價", "瓦斯用完"] },
    { "id": "insurance", "name": "保險籌碼", "kind": "insurance", "value": 0 },
    { "id": "lucky", "name": "幸運籌碼", "kind": "lucky", "value": 0 }
  ]
}
```

註：`insurance` 與 `lucky` 籌碼**不在任何起始袋**，只由資產卡（a04、a05）加入。

### 6.4 `balance.json`

```json
{
  "rounds": 12,
  "blackSwanThreshold": 3,
  "bustKeepRatio": 0.5,
  "marketSize": 3,
  "insuranceCost": 40,
  "purchasesPerTurn": 1,
  "aiDefaultJobId": "j02",
  "ai": {
    "easy":   { "swanStopOffset": 2, "incomeStop": 40,  "buyInsurance": false },
    "normal": { "swanStopOffset": 1, "incomeStop": 80,  "buyInsurance": true },
    "hard":   { "swanStopOffset": 1, "incomeStop": 120, "buyInsurance": true }
  },
  "ui": {
    "aiStepDelayMs": 400,
    "tokenFlyMs": 300
  }
}
```

- `swanStopOffset`：AI 在 `blackSwanCount ≥ 門檻 − offset` 時停手（normal ＝ 門檻 −1，對應 outline §6）。
- `ui.*` 只給 UI 層讀，engine 不讀（純延遲，不影響 state）。
- **UNKNOWN 假設**：以上數值使一局 10–20 分鐘、normal 難度對 AI 勝率約 50%。估算依據：每人每回合翻 4–6 顆、約 30 秒；24 個人類／AI 回合 ≈ 12 分鐘。待 G5 實測。

---

## 7. AI 決策規範

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

---

## 8. 觸控／UI 契約（不是設計；設計由 G3.5 三版決定）

### 8.1 畫面狀態機

```
title → jobSelect → play(humanTurn | aiTurn) → roundEnd → (回到 play 或) gameOver → title
```

| UI 畫面 | 對應 engine 條件 | 從 state 讀 | 可送出的 action |
|---|---|---|---|
| `title` | `phase==="lobby"` 且未選職業 | 無 | 無（UI 內部切到 jobSelect） |
| `jobSelect` | `phase==="lobby"` | `data.jobs`（名稱、起始現金、起始袋摘要）、`data.balance.ai` 的三個 key | `START_GAME { seed, jobId, difficulty }`；seed 由 UI 產生（允許 `Date.now()` 或使用者輸入，**只在 UI 層**），並顯示於畫面供重放 |
| `play.humanTurn` | `currentPlayer==="human"` 且 `phase∈{draw,buy}` | 兩人 `cash`、淨資產（selectors）、`round`、human 的 `bag` 剩餘統計（各籌碼數）、`drawn`、`pendingIncome`、`blackSwanCount`、門檻、`market` 三張卡全欄位、`assets`、`purchasedThisTurn`、`busted` | draw：`DRAW`、`STOP`；buy：`BUY_ASSET`、`BUY_INSURANCE`、`END_TURN` |
| `play.aiTurn` | `currentPlayer==="ai"` 且 `phase∈{draw,buy}` | 同上但主體為 ai；另讀 `log` 尾端的 `AI_DECIDED`／`TOKEN_DRAWN` 以播報 | `AI_TURN`（UI 以 `balance.ui.aiStepDelayMs` 間隔重複送，直到 `currentPlayer!=="ai"`）；人類此時無可點按鈕（可有「加速」鈕，僅縮短 UI 延遲，不改 engine） |
| `roundEnd` | `phase==="roundEnd"` | `round`、兩人淨資產、本回合 log 摘要 | `NEXT_ROUND` |
| `gameOver` | `phase==="gameOver"` | `winner`、兩人淨資產、`assets`、`seed` | 無 engine action；UI「再來一局」重建初始 state |

### 8.2 觸控契約（CLAUDE.md 第 3 節第 4 條）
- 所有可點元素 ≥ 44×44 px；「再翻」「停手」兩鈕 ≥ 88×88 px（outline §7）。
- 不依賴 hover／右鍵／鍵盤；卡片說明用「長按放大」或「點一下展開」（由 G3.5 決定），不用 hover。
- 兩種視圖：手機直向 390×844、iPad 橫向 1194×834，兩者都要能完成一整回合。
- AI 回合每步 ≥ `aiStepDelayMs`（400 ms）讓人看得懂；此延遲只在 UI（`setTimeout` 只允許出現在 `src/ui/`）。
- 籌碼翻出時飛進軌道（CSS transition ≥ `tokenFlyMs`），engine 無感。
- 黑天鵝事件名依第 6.3 節規則顯示，UI 不得用 `Math.random()`。

### 8.3 UI 不得做的事
- 不得自行計算淨資產、門檻、可否購買——一律呼叫 `selectors.*`／以 `canApply(state, action, data)` 判斷按鈕可用性（engine 提供）。
- 不得新增 state 欄位；UI 自身狀態（目前畫面、動畫進度、加速開關）存在 UI 模組內。
- 不得直接改 `index.html`（打包產物）。

---

## 9. 建置與測試契約

### 9.1 目錄與模組格式
```
src/data/{jobs,assets,tokens,balance}.json
src/engine/rng.js        mulberry32 + nextInt
src/engine/selectors.js  netWorth、threshold、candidates、canApply
src/engine/ai.js         decideAi
src/engine/reducer.js    reduce、initialState
src/ui/app.js            畫面狀態機、渲染、送 action
src/ui/styles.css
src/ui/index.template.html   含 <!-- INJECT:DATA -->、<!-- INJECT:CSS -->、<!-- INJECT:JS --> 三個標記
build/bundle.js          Node 腳本，產生 index.html
tests/engine/*.test.js   node:test
tests/ui/smoke.spec.js   Playwright
```
- 模組格式：CommonJS（`module.exports`／`require`），Node 測試直接載入；`build/bundle.js` 用迷你模組註冊器（見 ADR-001）把 CommonJS 檔包進單一 `<script>`。
- engine 檔案**不得**含 hook 禁止的字串（`Math.random`、`Date`、`window`、`document`、`setTimeout` 等；`.claude/hooks/check-forbidden.sh`）。

### 9.2 npm scripts（`package.json` 由 game-engineer 建立；release-manager 回填 CLAUDE.md 第 4 節）

| script | 指令（建議） | 說明 |
|---|---|---|
| `build` | `node build/bundle.js` | 產生 `index.html` |
| `test:engine` | `node --test tests/engine/` | 純 Node，零套件 |
| `test:ui` | `playwright test tests/ui/` | 需 `devDependencies: @playwright/test`；**不進 build 產物** |
| `test` | `npm run test:engine && npm run test:ui` | — |

- Playwright 做法「沿用 finflow」：本 repo 內查無 finflow 的 `playwright.config` 或設定檔，具體設定 **UNKNOWN**；game-engineer 依以下最低要求自行建立並在回報中列出：兩個 project（手機直向 390×844、iPad 橫向 1194×834）、以 `file://` 或 Node 內建 `http` 靜態伺服器開 `index.html`、`npm run test:ui` 在未安裝瀏覽器時給出明確錯誤訊息而非 hang。
- 煙霧測試最低內容（`T-UI-*`）：`T-UI-01-loads`（開啟無 console error）、`T-UI-02-full-round`（選職業→翻兩顆→停手→結束回合→AI 回合自動跑完→roundEnd 出現）、`T-UI-03-touch-size`（掃描所有 `button,[role=button]` 的 boundingBox ≥ 44×44）、`T-UI-04-no-external`（HTML 內無 `http://`／`https://` 資源引用）。

### 9.3 資料驗證測試（`T-DATA-*`，屬 engine 測試）
- `T-DATA-01-asset-ids-unique`：12 張 id 唯一、共 12 張。
- `T-DATA-02-job-bag-tokens-exist`：每張職業卡 startBag 的 key 都存在於 tokens.json。
- `T-DATA-03-tokens-added-exist`：每張資產卡 tokensAdded 都存在於 tokens.json。
- `T-DATA-04-effect-enum`：effect.type 屬於五種枚舉。
- `T-DATA-05-ai-difficulties`：balance.ai 恰有 easy／normal／hard。
- `T-DATA-06-rule-cards-at-least-3`：非 ADD_TOKENS 的卡 ≥ 3 張。

---

## 10. 驗收條件（G4 完成定義）

| # | 驗收條件（可打勾） | 驗證方式 | 驗證者 |
|---|---|---|---|
| A-01 | `npm run test:engine` 全綠，含第 5 節全部 30 個 `T-R-*`、第 3.3 節 `T-INV-*`、第 9.3 節 `T-DATA-*` | 測試輸出 | AI 自驗 |
| A-02 | 同 seed ＋ 同 action 序列（含 AI_TURN）重放，兩次最終 state `deepStrictEqual` | `T-R-21-replay-deterministic` | AI 自驗 |
| A-03 | `src/engine/` 經 `check-forbidden.sh` 掃描零命中 | hook 輸出 | AI 自驗 |
| A-04 | `src/` 內無寫死平衡數字：grep 12、3、0.5、40 等常數只出現在 `src/data/` | grep 清單附回報 | AI 自驗 |
| A-05 | `npm run build` 產生單一 `index.html`，檔內無 `http://`／`https://`／`<script src`／`<link href` 外連 | `T-UI-04-no-external` ＋ grep | AI 自驗 |
| A-06 | `npm run test:ui` 四個煙霧測試在兩個視圖 project 皆通過 | Playwright 輸出 | AI 自驗 |
| A-07 | 手機直向與 iPad 橫向下所有可點元素 ≥ 44×44，「再翻」「停手」≥ 88×88 | `T-UI-03-touch-size` | AI 自驗 |
| A-08 | 一局從 title 到 gameOver 可完整走完，UI 未出現 `【文案待補】` 以外的佔位符 | 手動 | 製作人本機驗（iPad／手機） |
| A-09 | AI 回合每一步肉眼可辨（籌碼逐顆出現、停手／購買有提示） | 手動 | 製作人本機驗（iPad／手機） |
| A-10 | 斷網（飛航模式）開啟 `index.html` 可玩 | 手動 | 製作人本機驗 |
| A-11 | 一局時間落在 10–20 分鐘（UNKNOWN 假設，記錄實測值供 G5） | 手動計時 | 製作人本機驗 |
| A-12 | 三個難度各至少一局，回報勝負與感受（供 G5 調整） | 手動 | 製作人本機驗 |
| A-13 | 全部文件、註解、UI 文字為繁體中文，無簡體 | grep 常見簡體字表 | AI 自驗 |
| A-14 | 未出現不做清單 N-1～N-10 的任何功能（尤其單人達標、落後補償、存檔、連線） | grep `localStorage`、`fetch`、`目標金額`、`落後` | AI 自驗 |

---

## 附錄 A：需製作人決定的事（不影響 G3.5 UI 決策，可延後）
1. AI 的職業卡：目前固定 `j02` 雞排攤（`aiDefaultJobId`）。替代方案：由 seed 隨機三選一（多消耗 1 次 RNG）。建議固定，讓玩家好比較。
2. 第 12 回合結束後是否顯示「本局 seed」讓製作人回報 bug 時可重放：建議顯示（已寫入 8.1 gameOver 讀取欄位），若不想露技術資訊請告知。

## 附錄 B：與 outline 的差異（供 story-editor 核對）
- 新增 `NEXT_ROUND` action 與 `roundEnd` 畫面（outline 步驟表無此停點）。
- 「保險」在 outline §5 同時是籌碼與購買項；本規格拆成 `BUY_INSURANCE`（購買，移除黑天鵝）與 `insurance` 籌碼（由雨棚加入，翻到時抵銷 1 點）。
- 幸運籌碼的「下一顆不會是黑天鵝」實作為「下一次抽籤排除黑天鵝」；若袋中只剩黑天鵝則無法再翻，只能停手（R-23）。
