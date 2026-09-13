# T-001 見好就收 v0.1 可玩版 — 工程執行書（分派單）

> 由 systems-engineer 填寫（2026-09-13）。本檔同時涵蓋 `docs/templates/任務單.md` 四個必填區塊（目標、驗收、回報格式、交叉影響），故本任務不另出 `ticket.md`。
> 狀態：草稿（等 G3.5 製作人選定 UI 版型後，S4 才可開工；S1–S3 可先行）
> 依據：`docs/spec/game-spec.md` v0.1、`docs/spec/ADR-001-engine-architecture.md`、`docs/design/story-outline.md` v2 §9、`CLAUDE.md`

---

## 0. 目標與驗收（任務單必填區塊）

- **一句話**：製作人在 iPad／手機上打開單一 `index.html`，選一張夜市職業卡，與 AI 對戰 12 回合到分出勝負，全程斷網可玩。
- **對應 Gate**：G4（製作），交 G4.5（外部交叉審查）。
- **來源**：outline v2 §9 製作人拍板（2026-09-13：夜市攤主／只做對 AI／不做落後補償）。
- **驗收條件**：以規格書第 10 節 A-01～A-14 為準，不在此重複；每個子任務下方列出該子任務負責的驗收編號。
- **回報格式**：每個子任務寫 `docs/reports/T-001-S<n>.md`，依 `docs/templates/回報.md`；對話中只放結論 3 行、檔案路徑、需製作人決定的事。
- **範圍外**：規格書 §1.2 N-1～N-10；另外本任務不做 hot-seat、不做音效、不做教學關卡。

---

## 1. 子任務總覽

| 子任務 | 名稱 | 負責 | 依賴 | 並行／序列 | 預估 session |
|---|---|---|---|---|---|
| S1 | 資料檔 | game-engineer | 無 | 起點 | 0.5 |
| S2 | engine：reducer ＋ seeded RNG ＋ AI（含先寫的核心測試） | game-engineer | S1 | 序列（S1 後） | 1.5 |
| S3 | engine 測試補齊（全部 T-R／T-INV／T-DATA／T-RNG） | game-engineer | S2 | 序列（S2 後）；**可與 S4 並行** | 1 |
| S4 | UI 綁定 | game-engineer | S2 ＋ **G3.5 decision-log** | 序列（等硬停點）；與 S3 並行 | 1.5 |
| S5 | build 腳本 ＋ Playwright 煙霧測試 | game-engineer | S4 | 序列（S4 後） | 1 |
| S6 | 審查包 | review-packager | S1–S5 全部回報 ＋ systems-engineer 架構審查通過 | 序列（G4.5） | 0.5 |

依賴圖：`S1 → S2 → { S3 ∥ S4 } → S5 → 架構審查 → S6`。
S4 的硬性前提：`docs/ui/decision-log.md` 存在且涵蓋第 8 節 UI 三版需求單的三個決策 D1–D3；缺一不得開工。

---

## 2. 子任務細目

### S1 資料檔（game-engineer）

- **要改的檔案**：`src/data/jobs.json`、`src/data/assets.json`、`src/data/tokens.json`、`src/data/balance.json`（四檔皆為新增；`src/data/.gitkeep` 可留）。
- **不可碰**：`src/engine/`、`src/ui/`、`build/`、`docs/spec/`、任何數值（必須與規格書 §6 逐字一致；覺得數值有問題寫進「未預期發現」，不自改）。
- **輸入**：規格書 §6.1–6.4 的四個 JSON 區塊。
- **輸出契約**：四檔為合法 JSON；頂層 key 分別為 `jobs`、`assets`、`tokens`，`balance.json` 頂層即物件；`node -e 'require("./src/data/assets.json")'` 四檔皆可載入。
- **要新增的測試**：無（資料驗證測試由 S3 寫；S1 只需在回報貼 `node -e` 載入成功輸出與 `T-DATA-01`～`06` 的手算結果：12 張 id 唯一、startBag key ∈ tokens、tokensAdded ∈ tokens、effect.type ∈ 五枚舉、ai 三難度、改規則卡 ≥ 3）。
- **負責驗收**：A-13（無簡體）部分、A-14 部分。
- **回報**：`docs/reports/T-001-S1.md`。

### S2 engine：reducer ＋ seeded RNG ＋ AI（game-engineer）

- **要改的檔案**：`src/engine/rng.js`、`src/engine/selectors.js`、`src/engine/ai.js`、`src/engine/reducer.js`（新增）；`tests/engine/rng.test.js`、`tests/engine/replay.test.js`（先寫測試再實作，至少含 `T-RNG-01`、`T-RNG-02`、`T-R-21`、`T-R-25`）；`package.json`（新增，只放 `test:engine` script 與 `"private": true`，不放任何 dependency）。
- **不可碰**：`src/data/*.json`（只讀）、`src/ui/`、`build/`、`index.html`、`docs/spec/`。engine 檔內不得出現 hook 禁止字串；不得 `require` JSON。
- **輸入**：規格書 §3（schema）、§4（action 表、log 事件）、§5（規則）、§7（AI）；ADR-001 §2.1–2.3 的介面。
- **輸出契約**：
  - `reducer.js` 匯出 `{ initialState, reduce, canApply }`；`rng.js` 匯出 `{ seedRng, next, nextInt }`；`ai.js` 匯出 `{ decideAi }`；`selectors.js` 匯出 `{ netWorth, threshold, candidates, byId, bagSummary }`（`bagSummary(state, playerId) → { [tokenId]: count }` 供 UI 顯示剩餘）。
  - `reduce` 對前置條件不成立的 action 拋 `Error("REJECT:<TYPE>:<reason>")`。
  - state 形狀與規格書 §3.1 完全一致，**不得多欄位、不得少欄位**（`T-INV-schema-keys` 會比對 key 集合）。
  - `AI_TURN` 一次只走一步。
- **要新增的測試**（S2 最少）：`T-RNG-01-mulberry32-vector`、`T-RNG-02-call-count`、`T-R-21-replay-deterministic`、`T-R-25-reducer-immutable`、`T-R-07-bust-halves`、`T-R-19-ai-stop-rules`、`T-R-20-ai-buy-most-expensive`。其餘留給 S3。
- **實作備註**：
  - 本回合第 n 顆收入籌碼（R-15）以 `drawn` 中 `kind==="income"` 的計數判定，`SWAN_RETURN_ONCE` 放回的黑天鵝不進 `drawn`。
  - R-14 放回：把該顆推回 `bag` 尾端（不消耗 RNG）。
  - 補市場、移除保險黑天鵝、drawn 回袋皆為決定性順序操作，寫清楚註解。
- **負責驗收**：A-01 部分、A-02、A-03、A-04。
- **回報**：`docs/reports/T-001-S2.md`，須列出實際建立的 `package.json` 內容與 `npm run test:engine` 輸出。

### S3 engine 測試補齊（game-engineer；可與 S4 並行）

- **要改的檔案**：`tests/engine/rules.test.js`（R-01～R-17、R-22～R-24）、`tests/engine/ai.test.js`（R-18～R-20、`T-AI-selfplay-stats`）、`tests/engine/invariants.test.js`（`T-INV-1`～`T-INV-5`、`T-INV-schema-keys`）、`tests/engine/data.test.js`（`T-DATA-01`～`07`）；`tests/engine/helpers.js`（建 state、跑序列的共用工具）。
- **不可碰**：`src/engine/`（發現 bug 只回報，附失敗測試輸出，由 S2 負責人修；同一人也要走「回報 → 修」兩步，不可在測試檔裡繞過）、`src/data/`、`src/ui/`、`build/`。
- **輸入**：規格書 §5 的 30 個測試名、§3.3、§9.3；ADR-001 §5。
- **輸出契約**：`npm run test:engine` 全綠；每個規格書測試名在測試檔中以**同名字串**出現（`grep -c "T-R-" tests/engine/` 可對帳）；`T-AI-selfplay-stats` 跑 easy／normal／hard 各 200 局 AI 對 AI（seed 1–200），只輸出勝率與平均回合時間（無 assert，標 `skip` 也可，但要能手動跑）。
- **要新增的測試**：規格書 §5 全部 30 個減去 S2 已寫的 7 個 ＝ 23 個，加 T-INV 6 個、T-DATA 7 個、T-AI-selfplay-stats 1 個。
- **負責驗收**：A-01。
- **回報**：`docs/reports/T-001-S3.md`，附測試總數與通過數。

### S4 UI 綁定（game-engineer；**等 G3.5 decision-log 後開工**）

- **要改的檔案**：`src/ui/app.js`、`src/ui/styles.css`、`src/ui/index.template.html`（三檔新增；檔名固定，不得增減——見 X-4）。
- **不可碰**：`src/engine/`（需要新 selector 時回報 systems-engineer，不自加）、`src/data/` 數值（UI 用 `balance.ui.*` 讀延遲）、`build/`、`index.html`（打包產物，不手改）、`tests/engine/`。
- **輸入**：規格書 §8（畫面狀態機、讀什麼、送什麼、觸控契約）、`docs/ui/decision-log.md`（D1–D3 選定版型與實作備註）、ADR-001 §2.4（`GAME_DATA`、`__require`）。
- **輸出契約**：
  - `app.js` 以 `require("../engine/reducer")` 等取得 engine；啟動時建 `initialState()`；所有按鈕可用性由 `canApply` 決定；`AI_TURN` 以 `setTimeout(…, GAME_DATA.balance.ui.aiStepDelayMs)` 迴圈送出，直到 `currentPlayer !== "ai"`。
  - UI 自身狀態（目前畫面、加速開關、動畫佇列）存在 `app.js` 的模組變數，**不得寫入 engine state**。
  - `index.template.html` 含三個注入標記 `<!-- INJECT:DATA -->`、`<!-- INJECT:CSS -->`、`<!-- INJECT:JS -->`，且不含任何 `<script src>`／`<link href>`。
  - 文案：正式文案未提供時用 `【文案待補：<用途>】`，並在回報列清單。
  - 觸控：所有可點元素 ≥ 44×44；「再翻」「停手」≥ 88×88；兩種視圖。
- **要新增的測試**：無（UI 自動測試由 S5 寫）；回報須附兩種視圖的檢查清單（手動或 DOM 掃描腳本）。
- **負責驗收**：A-07 部分、A-08、A-09（製作人驗）、A-13 UI 文字部分。
- **回報**：`docs/reports/T-001-S4.md`，含待補文案清單。

### S5 build 腳本 ＋ Playwright 煙霧測試（game-engineer）

- **要改的檔案**：`build/bundle.js`（新增）、`tests/ui/smoke.spec.js`、`playwright.config.js`（新增）、`package.json`（追加 `build`、`test:ui`、`test` scripts 與 `devDependencies["@playwright/test"]`）、`.gitignore`（追加 `node_modules/`、`test-results/`、`playwright-report/` 若尚未有）、`index.html`（由 build 產生，可 commit）。
- **不可碰**：`src/engine/`、`src/data/`、`src/ui/`（若 template 標記缺失，回報 S4 補，不自改）。
- **輸入**：ADR-001 §2.4（打包順序、迷你註冊器）、規格書 §9。
- **輸出契約**：
  - `npm run build` 只用 Node 內建模組，產生 `index.html`；再跑一次結果 byte-identical（決定性打包，`T-BUILD-02-idempotent`）。
  - `npm run test:ui` 在兩個 project（`mobile-portrait` 390×844、`ipad-landscape` 1194×834）跑 `T-UI-01`～`T-UI-04`；未安裝瀏覽器時輸出可讀錯誤（不 hang）。
  - `npm test` ＝ engine ＋ ui。
  - Playwright「沿用 finflow 做法」：repo 內查無 finflow 設定，**UNKNOWN**；依規格書 §9.2 最低要求建立，並在回報標明「自建，非沿用」。
- **要新增的測試**：`T-BUILD-01-single-file`、`T-BUILD-02-idempotent`（放 `tests/engine/build.test.js`，用 `child_process` 跑 build 再檢查）、`T-UI-01-loads`、`T-UI-02-full-round`、`T-UI-03-touch-size`、`T-UI-04-no-external`。
- **負責驗收**：A-05、A-06、A-07、A-10（製作人驗）。
- **回報**：`docs/reports/T-001-S5.md`，須列出最終 `package.json` 全部 scripts 供 release-manager 回填 CLAUDE.md 第 4 節。

### S6 審查包（review-packager；G4.5）

- **前提**：S1–S5 回報皆為「完成」，且 systems-engineer 架構審查回報「通過」（`docs/reports/T-001-arch-review.md`）。
- **要改的檔案**：`docs/reviews/T-001/review-pack.md`（超長則分批）；製作人貼回後 `docs/reviews/T-001/external-<ai>.md`、`docs/reviews/T-001/triage.md`。
- **不可碰**：`src/`、`tests/`、`build/`、`docs/spec/`。
- **輸入**：本分派單、規格書 §3–§7、S1–S5 回報、架構審查回報、變更檔案完整內容（`cat -n`）。
- **輸出契約**：依 `docs/templates/審查包.md`；審查提示詞須要求外部 AI 對照 CLAUDE.md 第 3 節五條逐條檢查，並特別點名兩個高風險點：（1）`reduce` 是否有任何路徑修改輸入、（2）`AI_TURN` 重放是否決定性。
- **回報**：`docs/reports/T-001-S6.md`。

---

## 3. 交叉影響檢查（逐對）

| 編號 | 子任務對 | 會碰到的檔案／state 欄位 | 裁決 |
|---|---|---|---|
| X-1 | S1 ↔ S2 | `src/data/*.json` 的形狀與數值 | **序列**：S1 先完成並回報，S2 只 `require` 不改。S2 若發現資料形狀不便（例如想把 startBag 改成陣列），回報 systems-engineer 改規格 §6 後才能改，不得在 engine 內「順便轉換」成另一種形狀存進 state（state.bag 必須是展開後的 tokenId 陣列，這是規格）。 |
| X-2 | S2 ↔ S4 | state schema（規格 §3）、`log[]`、`selectors` | **schema 以規格書 §3 為準，S4 不得新增欄位**；UI 自身狀態留在 `app.js`。S4 需要的讀取（剩餘籌碼統計、淨資產、門檻、可否按鈕）一律用 S2 提供的 `selectors.*`／`canApply`；若缺 selector，S4 回報 systems-engineer，由 S2 負責人加，並補測試。`log[]` 只有 engine 寫，S4 只讀尾端事件做播報。 |
| X-3 | S2 ↔ S3 | `src/engine/*`、`tests/engine/*` | **隔離**：S3 只加測試檔，不改 engine；測試揭露的 bug 回到 S2 修（同一 engineer 也要留兩份回報紀錄：S3 回報「發現」，S2 補充回報「修正」）。測試名以規格書 §5 字串為準，S2 已寫的 7 個 S3 不重寫，只補其餘。 |
| X-4 | S4 ↔ S5 | `build/bundle.js` 的檔案清單、`src/ui/index.template.html` 的注入標記、`index.html` | **隔離＋固定契約**：S4 只能產出三個固定檔名（`app.js`、`styles.css`、`index.template.html`）並放好三個標記；S5 的 `bundle.js` 檔案陣列寫死這三個加四個 engine 檔。S4 想拆多檔（例如 `render.js`）→ 先回報 systems-engineer 更新 ADR-001 §2.4 順序表，S5 再改陣列。`index.html` 只有 S5 的 build 產生，S4 用本機 `node build/bundle.js` 前不存在時，允許 S4 暫以直接開 template 方式開發（把 JSON 暫貼進 template 的做法禁止，改用最簡陋的暫用 `build/bundle.js` 草稿也由 S5 負責人接手）。 |
| X-5 | S2 ↔ S5 | `package.json` | **序列＋分工**：S2 建立檔案，只放 `test:engine`；S5 追加 `build`、`test:ui`、`test` 與 `devDependencies`。S5 不得改 S2 的 script 字串。 |
| X-6 | S3 ↔ S5 | `tests/` 目錄、`npm test` 匯總 | **隔離**：S3 只在 `tests/engine/`，S5 只在 `tests/ui/` 與 `tests/engine/build.test.js`（唯一例外，因 build 測試用 node:test 跑）。`T-BUILD-*` 名稱由 S5 擁有。 |
| X-7 | S4 ↔ S1 | `balance.ui.aiStepDelayMs`、`tokenFlyMs`；`tokens.eventNames` | **只讀**：S4 讀這些值，不改；覺得 400 ms 太快／太慢寫進未預期發現，由製作人在 G5 決定。 |
| X-8 | S1 ↔ story-editor（本任務未派工） | `name`、`flavor`、`eventNames` 文案欄位 | **序列**：S1 先依規格書 §6 建檔（含文案初稿）；story-editor 之後若要潤飾，只改文案欄位、不改 id 與數值，另開子任務。本任務不派。 |
| X-9 | 全部 ↔ systems-engineer | `docs/spec/game-spec.md` | 任何子任務發現規格矛盾（例如 R-14 與 R-13 同時觸發的順序）→ 停下回報，systems-engineer 改規格並改版號（v0.1 → v0.1.1），不由 engineer 自行解讀。已知需先定義的順序：DRAW 時效果套用順序為 **lucky 過濾 → 抽出 → SWAN_RETURN_ONCE（若為黑天鵝且未用）→ 計數／加收入（含 NTH_INCOME_DOUBLE）→ insurance 籌碼抵銷 → 爆倉判定**。此順序視為規格 §4 DRAW 列的補充，S2 依此實作。 |

---

## 4. 未預期發現處理規則

1. **範圍外的問題**（別的檔案有 bug、文案怪、數值疑似失衡）：寫進回報 §4「未預期發現」，附檔案路徑與一句話；**不修**。
2. **會影響 state schema、資料形狀、RNG 呼叫次數的發現**：立刻停止該子任務，回報 systems-engineer；等規格更新後再繼續。不得先做再補規格。
3. **同一子任務錯兩次**（測試連續失敗兩次找不到原因、build 兩次不成）：停止，回報並附失敗輸出，不做第三次。
4. **hook 擋下 engine 寫入**：不得把字串加進 `forbidden-allowlist.txt`；改寫成由 action／data 傳入。真的需要例外 → 回報 systems-engineer 寫 ADR。
5. **需要新依賴**（任何 npm 套件）：一律拒絕，除 Playwright 外；回報製作人。
6. **發現規格書自身矛盾**：依 X-9 處理；回報中引用規格條號（R-xx／§n）。
7. **順手改到範圍外檔案**：還原，並在未預期發現註明「曾誤改、已還原」。

---

## 5. 風險（對照 CLAUDE.md 第 3 節）

| 原則 | 本任務可能碰到 | 避免方式 |
|---|---|---|
| 1 純函數 | AI 回合節奏誘使工程師把 `setTimeout` 放進 engine | AI_TURN 一步一 action，延遲在 UI；hook 擋 |
| 2 seeded RNG | UI 產 seed 用 `Date.now()` 被誤放進 engine | 規格 §8.1 明定 seed 由 UI 產生後傳進 START_GAME |
| 3 資料驅動 | 「3 張市場」「減半」在 engine 寫死 | A-04 grep 驗收；S2 只能寫 0／1／−1 |
| 4 觸控 | 卡片說明用 hover | 規格 §8.2 禁止；T-UI-03 掃尺寸 |
| 5 零依賴 | Playwright 被誤加進 dependencies | S5 只放 devDependencies；T-UI-04 掃產物 |

---

## 6. 素材需求

| 素材 | 由誰產 | 狀態 |
|---|---|---|
| 3 職業、12 資產、6 籌碼、5 黑天鵝事件的名稱與一句文案 | systems-engineer 已在規格 §6 給初稿；story-editor 可後續潤飾（X-8） | 初稿已有 |
| UI 文案（按鈕、提示、回合結束、結算） | story-editor（本任務未派）；S4 先用 `【文案待補】` | 待產 |
| 圖片／音效 | 不需要（v0.1 純文字＋CSS） | — |

---

## 7. 需製作人決定的事

- 規格書附錄 A 兩項（AI 固定用雞排攤；gameOver 顯示 seed）。皆不影響 G3.5 UI 決策，可在 G4 前任一時點回覆；未回覆則依建議值執行。

---

## 8. UI 三版需求單（給 ui-designer，G3.5）

每個決策出 A／B／C 三版靜態 HTML（`docs/ui/v<n>-{A,B,C}.html`），每版同時含手機直向 390×844 與 iPad 橫向 1194×834；三版必須是真正不同的方案。共同底線：零依賴、可點元素 ≥ 44×44、無 hover 依賴。

| 決策 | 必須呈現的資訊（皆來自規格 §8.1） | 必須可觸控完成的操作 | 三版差異方向建議 |
|---|---|---|---|
| **D1 主畫面（翻牌階段）** | 回合 n/12、兩人現金與淨資產、我方袋子剩餘各籌碼數、本回合已翻出的籌碼軌道、暫存收入、黑天鵝值／門檻、對手已購資產縮圖 | 「再翻」「停手」兩鈕 ≥ 88×88 | A：兩鈕置中、資訊環繞（outline §7 原意）；B：籌碼軌道為主視覺、兩鈕在底部拇指區；C：左右分欄（我方／對手），兩鈕在我方欄 |
| **D2 購買階段** | 市場 3 張卡（名稱、價格、面值、效果一句話、會加入的籌碼）、保險（價格、袋中黑天鵝數）、我方現金、已買／未買狀態、「結束回合」鈕 | 點卡購買、點保險購買、看卡片說明（長按或點展開）、結束回合 | A：三卡橫排＋保險為第四格；B：卡片直向清單可捲動；C：先選卡後出現確認面板（兩步式，防誤觸） |
| **D3 AI 回合與回合結束** | AI 每一步（翻到什麼、停手理由、買了什麼）逐步顯示；回合結束：兩人淨資產對比、本回合入帳；第 12 回合後：勝負、seed | 「加速」鈕（只縮短 UI 延遲）、「下一回合」鈕、「再來一局」鈕 | A：AI 回合沿用主畫面，只換頂部標題與播報條；B：AI 回合用半透明覆蓋層逐條播報；C：AI 回合壓縮成對手欄的小動畫，人類仍看得到自己的畫面 |

補充給 ui-designer：
- 黑天鵝籌碼顯示事件名（下雨／衛生稽查／跳電…），依規格 §6.3 的固定輪替規則，稿中可直接用假資料。
- 職業選擇畫面（jobSelect）與標題畫面不列入三版決策，由 ui-designer 依 D1 選定風格附帶提供單一版本即可。
