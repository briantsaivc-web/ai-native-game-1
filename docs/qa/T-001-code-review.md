# 程式審查：T-001 見好就收 v0.1（G5 code-reviewer）

| 欄位 | 內容 |
|---|---|
| 角色 | code-reviewer（唯讀；與工程師不同 session） |
| 任務 | T-001（含 S7 G4.5 裁決後修正批次） |
| 日期 | 2026-09-13 |
| 判定 | **有條件通過**（Blocker 0、Major 2、Minor 8） |

## 1. 結論（3 行內）

- engine（reducer／rng／selectors／ai）逐條對照 CLAUDE.md 第 3 節五條原則與規格 §3–§7，未發現違反；S7 的 `TOKEN_DRAWN.amount` 在收入／翻倍／黑天鵝／保險／幸運／SWAN_RETURN_ONCE 各路徑皆正確，STOP_BONUS 未混入 amount。
- 兩個 Major 都不在 engine：一是觸控層「畫面同步切換 ＋ 底部操作列同位」讓連點會誤觸下一畫面的「再翻／停手」「再來一局」；二是規格 §5.7 的 AI 規則測試（T-R-18～20）與 `T-AI-selfplay-stats` 至今仍缺（K-4 註明「G5 前補」，現已到 G5）。
- 必修項：Major 1、Major 2 修完後可進 G6；Minor 可與 G5 數值調整一併處理。`npm run test:engine` 52/52 已由本人重跑；`index.html` 與目前 `src/` 的 build 產物 byte-identical 已驗。

## 2. Findings（依嚴重度排序）

### Major

**M-1**
- 嚴重度：Major
- 位置：`src/ui/app.js:409-417`（`dispatch` 同步 `render`）、`:470-509`（`onClick`）；`src/ui/styles.css:84-98`（`.dock` 各畫面同位置、單鈕撐滿）
- 問題：畫面切換在第一次 click 內同步完成，底部操作列在所有畫面位於同一位置，且 `touch-action:manipulation` 讓兩次快速點擊各自立即產生 click；連點／雙擊「下一回合」「看結果」「跳過，不買」時，第二下會落在**下一個畫面**的按鈕上。
- 失敗情境：
  - roundEnd 雙擊「下一回合」→ 第二下打在新回合的「停手」（iPad 上「再翻」「停手」各佔半寬）→ 送出 `STOP`，該回合 0 顆入帳直接結束，不可逆。
  - roundEnd 第 12 回合雙擊「看結果」→ 第二下打在 gameOver 的「再來一局」→ `restart` 回到 title，結算與 seed 畫面一閃即逝。
  - buy 階段雙擊「跳過，不買」→ 第二下打在 AI 回合的「加速」（無害，但顯示連點確實會穿透）。
- 建議方向：畫面（`screenName()`）改變後給操作列一段冷卻（例如以 `balance.ui.tokenFlyMs` 為期，在 `.dock` 上加 `pointer-events:none` 或在 `onClick` 忽略），或 `dispatch` 後在同一事件循環內忽略後續 click；不需改 engine。補一條煙霧測試：roundEnd 連點兩次後 `human.drawn.length===0` 且 `phase==="draw"`。
- 註：點卡即買本身**不會**雙買——第一次 `BUY_*` 後 `marketItems(true)` 整段被「本回合購買次數已用完」取代，第二下落在純文字；即使送出也被 `alreadyPurchased` 拒絕（`T-R-22`）。AI 回合的市場項目為 `<div>`（`marketItems(false)`），不可點。

**M-2**
- 嚴重度：Major（測試品質／驗收缺口）
- 位置：`tests/engine/`（缺 `ai.test.js`）；規格 §5.7、§10 A-01；分派單 S3；審查包 K-4
- 問題：`T-R-18-ai-pure`、`T-R-19-ai-stop-rules`、`T-R-20-ai-buy-most-expensive`、`T-R-20-ai-insurance-fallback`、`T-AI-selfplay-stats` 五個規格測試名在 `tests/` 內不存在；`ai.js` 的三條規則只被 `invariants.test.js`／`replay.test.js` 的自動對局間接經過，沒有任何斷言檢查「該停時停、該買最貴時買最貴、同價取索引小者、買不起才買保險」。
- 失敗情境：`ai.js:150` 把 `>=` 改成 `>`、或 `:170-171` 排序方向寫反、或 `:176` `buyInsurance` 條件漏掉，現有 52 個測試全部仍綠（只有 `T-R-21` 的固定 seed 結果會變，但那條測的是「兩次一樣」，不是「決策正確」）。
- 建議方向：依規格 §7 逐條建 `tests/engine/ai.test.js`：用 `patchPlayer` 造 `blackSwanCount === th − offset`、`pendingIncome === incomeStop` 邊界（含 THRESHOLD_PLUS 讓 th 變 4）、市場同價兩張、現金剛好買不起最貴一張；R-18 用 `deepFreeze` 後呼叫兩次 `deepStrictEqual`。`selfplay.js` 掛進 `node:test` 並 `skip`（分派單允許），讓 `grep -c "T-AI-selfplay-stats" tests/` 對得上。

### Minor

**m-1**
- 位置：`tests/engine/triage-misc.test.js:16-31`（`TRIAGE-E2`）；`docs/reports/T-001-S7-fixes.md` §2.1 第 4 列
- 問題：測試仍複製**修改前**的判斷式（`p.cash >= insuranceCost`，註解寫 `app.js:205`），並斷言 `previewOk === true`；S7 之後 `app.js:237` 已改為 `cash >= insuranceCost && bagSwans > 0`，此測試不論修沒修都通過，S7 報告卻以它作為第 4 列的測試證據。
- 失敗情境：把 `app.js:237` 的 `&& bagSwans > 0` 拿掉，測試不會失敗。
- 建議方向：改為複製新判斷式並斷言 bag 無黑天鵝時 `previewOk === false`；或把此檔標為「G4.5 實證紀錄，非回歸測試」。

**m-2**
- 位置：`tests/engine/triage-ui-display.test.js:34-45、100-108`
- 問題：`uiIncomeChipAmounts`／`uiPointsLeft`／`uiShowsSwanReturn` 是「抄一份 app.js 的邏輯」在測試裡跑，`app.js:96-126`、`:257-264` 改了測試不會跟著壞，兩邊會漂移（m-1 正是已經漂移的例子）。
- 建議方向：把這三段抽成 `app.js` 內不碰 DOM 的純函數並 `module.exports`（`app.js` 已是 CommonJS，Node 可 require；`boot()` 只在 `document` 存在時執行即可），測試直接呼叫真函數。

**m-3**
- 位置：`tests/engine/triage-ui-display.test.js:54、57、60、114、120、126、135`
- 問題：期望值寫死 `10／80／100／3`，未從 `data` 計算（`rules.test.js` 已示範 `tokenValue()`、`B.blackSwanThreshold` 的做法）。
- 失敗情境：G5 playtest 把 `income_l` 改 50 或門檻改 4，`T-R-26`、`TRIAGE-EXT2-2` 誤報失敗。
- 建議方向：改讀 `tokenValue()`、`card("a09").effect.param`、`B.blackSwanThreshold`。

**m-4**
- 位置：`src/ui/app.js:129-141`（`turnSummary.draws` 計所有 `TOKEN_DRAWN`）、`:324`（「停手於第 N 顆」）、`:293、362-363`（「翻 N 顆」）
- 問題：被 `SWAN_RETURN_ONCE` 退回的黑天鵝也有 `TOKEN_DRAWN`，但不進 `drawn`；持 a07 的回合「已翻出 N 顆」（`drawn.length`）與「翻 N 顆／停手於第 N 顆」會差 1。
- 失敗情境：持 a07、第 1 顆黑天鵝退回、再翻 2 顆收入後停手：軌道顯示 2 顆，結算寫「停手於第 3 顆」。
- 建議方向：`turnSummary` 遇 `SWAN_RETURNED` 時 `draws−1`，或文案改為「翻了 N 次」。

**m-5**
- 位置：`src/ui/app.js:15-25`（`ui` 初始物件）vs `:378、448-449、485、503`（`ui.copyMsg`）
- 問題：`copyMsg` 未在 `ui` 宣告，靠動態新增；檔頭註解「UI 自身狀態只存在本模組變數」的清單也漏了它。純可維護性。
- 建議方向：在 `ui` 初始物件加 `copyMsg: ""`。

**m-6**
- 位置：`src/ui/app.js:424`（`delay / 4`）、`:176`（`diffLabel`）、`:193`（`icons`）
- 問題：加速倍率、難度中文、職業圖示寫在程式；不是平衡數字（原則 3 不算違反），但 `balance.ui` 已是 UI 參數的既定位置，職業圖示屬內容。
- 建議方向：`balance.ui.fastDivisor`；`jobs.json` 加 `icon` 文案欄位、`balance.ai.<key>` 加 `label`（皆屬 story-editor 可改的文案欄位，需同步規格 §6）。

**m-7**
- 位置：`src/engine/reducer.js:134-141、160`
- 問題：`START_GAME` 驗了 `jobId`、`difficulty`、`aiJobId`，但未驗 `seed`；`seedRng(undefined)`、`seedRng("abc")` 靜默變 0，`state.seed` 也記 0，重放時看不出來源錯誤。UI 端 `parseSeed` 已擋，engine 契約（規格 §4 `seed: uint32`）本身沒擋。
- 建議方向：`typeof seed !== "number" || seed !== (seed >>> 0)` → `reject("START_GAME", "badSeed")`，並在 `T-R-04` 類的拒絕測試加一條。

**m-8**
- 位置：`tests/engine/data.test.js:110-122`（`T-DATA-08`）
- 問題：簡體字掃描只涵蓋 `src/data` 與 `src/engine`，不含 UI 文字最多的 `src/ui/app.js`（A-13 目前靠 S7 的手動 Python 掃描）。
- 建議方向：`files` 加入 `src/ui/app.js`、`src/ui/index.template.html`。

### 已核對、不列 finding 的項目（避免重複裁決表）
- `app.js:230、237`（預覽現金比較）、`:257`（`th − blackSwanCount`）：仍是 UI 自算的灰區，但裁決表第 2、3、8 列已裁為可接受並以「買得起／現在可買」兩種語意標示；本次只驗證修法一致，通過。
- `withPlayer` 結構共享（外部 1 E-1）：`T-R-25` 與 `TRIAGE-E1` 已證明不 mutate；讀碼確認 `assign`／`concat`／`slice` 各路徑皆回新物件，通過。
- `TOKEN_DRAWN.amount`（R-26）：`reducer.js:213、239-241、255` 只在 `kind==="income"` 路徑賦值（翻倍後），黑天鵝／保險／幸運／退回皆 0；`STOP_BONUS` 只進 `STOPPED.bonus` 與 `INCOME_SETTLED.amount`（`:278-284`），未混入 `TOKEN_DRAWN`。`T-R-26` (c) 三個 seed 整局驗「累加＝pendingIncome」，通過。
- build：`bundle.js:255-261` 已改為函式替換，`$&`／`$'` 風險消除；`safeScript` 處理 `</script`；無時間戳、`JSON.stringify` 順序固定，`T-BUILD-02` 與本人 `cmp` 皆證明決定性。
- 零依賴：CSS 只用系統字型堆疊、圖示為 emoji；`index.html` 無 `http(s)://`、`<link`、`src=`（`bundle.check` ＋ `T-UI-04`）。
- 觸控尺寸：`.dk` 64／88／96、`.item` 64、`.seg button` 48、`.err button`／`.sheet .h button`／`.seedrow button` 44、`.job` 44、input 48；無 hover／右鍵／鍵盤依賴。

## 3. 審查範圍

無 git 歷史可 diff，依分派單審查全部檔案（逐行讀）：
- `src/data/assets.json`、`balance.json`、`jobs.json`、`tokens.json`（經 `T-DATA-*` 對照規格 §6）
- `src/engine/rng.js`、`selectors.js`、`ai.js`、`reducer.js`、`index.js`
- `src/ui/app.js`、`styles.css`、`index.template.html`
- `build/bundle.js`
- `tests/engine/helpers.js`、`rules.test.js`、`invariants.test.js`、`replay.test.js`、`rng.test.js`、`data.test.js`、`build.test.js`、`triage-e1.test.js`、`triage-misc.test.js`、`triage-ui-display.test.js`、`selfplay.js`（只看結構）
- `tests/ui/smoke.spec.js`
- 文件：CLAUDE.md §3、規格 §3–§7、§11（附錄）、分派單、裁決表、S7 回報、S2／S3 回報中的 AI 測試段落

執行過的唯讀指令：`npm run test:engine`（52/52 pass）；`node build/bundle.js --out <scratchpad>` 後 `cmp` 根目錄 `index.html`（一致）；engine 禁字 grep（空）；`$` 樣式與寫死數字 grep。

## 4. 未審查到的部分

- `npm run test:ui`：審查環境無 `playwright` 套件與 Chromium，未重跑；T-UI-01～05 結果與 6 張截圖以 S7 回報為準。
- M-1 的連點行為只由程式碼與 CSS 版面推導，未在真機或 headless 重現；建議 QA 用 Playwright `tap` 兩次驗證。
- 真機 iPad Safari／手機瀏覽器的觸控與 `navigator.clipboard` 在 `file://` 下的行為（K-13、K-14，製作人本機驗）。
- `docs/ui/` 三版靜態稿、`README.md`、`CHANGELOG.md`、`.claude/` 設定：不在分派範圍。
- `selfplay.js` 的統計數值正確性（非通過／失敗型）。

## 5. 未預期發現

- `index.html` 與目前 `src/` 的 build 產物 byte-identical（已驗），release-manager 可直接使用。
- `balance.purchasesPerTurn` engine 未讀、UI 讀來顯示「0–1 張」（K-3 已知）；若 G5 改成 2，UI 文案會先變、規則不變，會誤導。建議 K-3 在 G5 前定案：engine 讀它或從 `balance.json` 移除。
- 規格 §3.1 範例 JSON 的兩筆 `TOKEN_DRAWN` 仍無 `amount`（S7 §4 已提，尚未補）。
- `T-AI-selfplay-stats` 在 `selfplay.js` 檔頭註解出現 3 次，但不是 `test()` 名稱，`grep -c` 對帳會誤判為存在（與 M-2 相關）。
- `smoke.spec.js:153` 的爆倉走法依賴 `nth=0` 職業為 j01 且起始袋 3 顆黑天鵝＝門檻；G5 若改 j01 起始袋或門檻，煙霧測試會以「再翻鈕已停用但未爆倉」失敗，訊息清楚，不算 bug，先記下。
- `app.js:362-363` 對 `(cardOf(...)||{}).name` 未 `esc()`；來源是 `assets.json` 文案欄位，目前無 `<`，story-editor 改文案時請避免 HTML 字元（或工程師順手補 `esc`）。

## 6. 需要製作人決定的事

- M-1 的處置方式：加冷卻（最小改，UI 層 `Date.now()`／`setTimeout` 皆允許）或改版面（下一畫面的操作列與上一畫面錯開）。建議前者。
- M-2 是否在 G6 前補齊（本審查建議必補；分派單與 K-4 原本承諾「G5 前」）。
