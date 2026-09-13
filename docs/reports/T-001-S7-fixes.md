# 回報：T-001 game-engineer（S7 G4.5 裁決後修正批次）

| 欄位 | 內容 |
|---|---|
| 角色 | game-engineer |
| 任務 | T-001 S7：依 `docs/reviews/T-001/triage.md` 裁決修 5 項（製作人拍板全修；翻倍籌碼採 (b) engine `TOKEN_DRAWN` 加 `amount`） |
| 日期 | 2026-09-13 |
| 結論 | 完成 |

## 1. 結論（3 行內）

- 5 項全部修完（Major 2：翻倍籌碼顯示、爆倉提示；P-1 點卡即買；Minor 2：市場預覽語意、seed 解析），另同步規格 §4 START_GAME RNG 欄改「11／12」。
- `npm test` 全過：engine 52/52（含新增 `T-R-26-token-drawn-amount` 與改寫後的 triage 測試）、build 73,116 bytes 零外部資源、Playwright 兩尺寸各 134 步走完一局，且**實際覆蓋購買（第 1 回合點卡買入）與爆倉（第 1 回合翻到爆）路徑**，另加無效 seed 提示不開局的檢查。
- engine 純度 grep 為空；無簡體字；截圖 6 張重拍並已逐張看過。

## 2. 變更檔案清單

| 檔案（相對路徑） | 動作 | 行數 ＋／－ | 備份檔 |
|---|---|---|---|
| `src/engine/reducer.js` | 修改 | +4／−1 | `reducer.js.backup.20260913c` |
| `src/ui/app.js` | 修改 | +80／−43 | `app.js.backup.20260913c` |
| `src/ui/styles.css` | 修改 | +10／−4 | `styles.css.backup.20260913c` |
| `docs/spec/game-spec.md` | 修改 | +4／−3（只動 §4 START_GAME 列、§4.1 TOKEN_DRAWN 列、§5 R-26 與統計句） | `game-spec.md.backup.20260913c` |
| `tests/engine/triage-ui-display.test.js` | 改寫 | +94／−55（由「重現問題」改為「驗證修正後行為」） | `triage-ui-display.test.js.backup.20260913c` |
| `tests/ui/smoke.spec.js` | 修改 | +61／−10 | `smoke.spec.js.backup.20260913c` |
| `index.html` | 重新 build（產物，未手改） | — | — |
| `docs/qa/shots/smoke-{phone,ipad}-{bust-buy,play,gameover}.png` | 重拍（新增 bust-buy 兩張） | — | — |
| `docs/reports/T-001-S7-fixes.md` | 新增 | 本檔 | — |

### 2.1 逐項對照（依嚴重度）

| # | 項目 | 變更檔案:行號 | 測試名 | 前後差異一句話 |
|---|---|---|---|---|
| 1 | Major・翻倍籌碼顯示（裁決第 7 列） | `src/engine/reducer.js:213、240、255`（`TOKEN_DRAWN` 新增 `amount`，`doubled` 保留）；`src/ui/app.js:84-94`（`incomeEvents` 只讀 log）、`:96-124`（chip 顯示 `amount`，`doubled` 時加 `×2` 標記）；`src/ui/styles.css:40-41`；`docs/spec/game-spec.md:178`（§4.1 欄位表）、`:227`（§5 R-26）、`:240`（統計） | `T-R-26-token-drawn-amount`（`tests/engine/triage-ui-display.test.js:47`） | 前：a09 翻倍時籌碼顯示 ＋10、＋10、＋40（合計 60，實際 100）；後：顯示 ＋10、＋10、＋80 ×2，合計恆等於暫存收入，UI 不再用面值自算。 |
| 2 | Major・爆倉提示（第 8 列） | `src/ui/app.js:256-264`、`:268` | `TRIAGE-EXT2-2-bust-hint-uses-points-not-draws`（`tests/engine/triage-ui-display.test.js:110`） | 前：「再翻 N 顆黑天鵝就爆倉」（持 a07 時說 3 顆、實際第 4 顆）；後：「黑天鵝值再增加 N 點即爆倉」（N＝門檻−目前值），持 SWAN_RETURN_ONCE 且未用時另顯示「首次黑天鵝可退回一次（尚未使用）」，UI 不推算第幾顆才爆。 |
| 3 | P-1・點卡即買（第 12 列，順帶消掉第 6 列 S-2） | `src/ui/app.js:219-247`（市場項目改為 `data-act="buyAsset"／"buyInsurance"` 按鈕，移除 `.rad`）、`:316-319`（dock 只留「跳過，不買」／「結束回合」）、`:494-495`（pick 直接 dispatch）；移除 `ui.buySel` 與 `buy`／`pick` 兩個 case；`src/ui/styles.css:99-110`（移除 `.sel`／`.rad` 樣式） | `T-UI-02-full-game`（`tests/ui/smoke.spec.js:171-192`：第一次遇到可買資產就點，斷言 `purchasedThisTurn`、資產數 +1、現金減少、畫面「已買下：<卡名>」、清單不可再點、dock 變「結束回合」） | 前：點卡只設 `buySel`，再按「買入」才送 action；後：點卡即送 `BUY_ASSET`／`BUY_INSURANCE`，畫面立即反映，「買入」鈕與 `buySel` 移除。 |
| 4 | Minor・市場預覽（第 2＋3 列） | `src/ui/app.js:219-247`：預覽保險改 `cash ≥ insuranceCost && bagBlackSwanCount > 0`（`:237`）；interactive 用 `canApply`；兩種語意各自標籤（`買得起`＝虛線灰標、`現在可買`＝綠底白字）與說明句（`:245-247`）；`src/ui/styles.css:104-110` | 既有 `TRIAGE-E2-insurance-preview-cash-only-vs-canApply` 仍通過（bag 無黑天鵝時預覽現改為不可買）；截圖 `smoke-ipad-play.png`（預覽「買得起」＋說明）、`smoke-*-bust-buy.png`（「現在可買」＋說明） | 前：預覽只看現金，bag 無黑天鵝時保險仍顯示可買、且與 buy 階段的「可買」同一樣式；後：預覽補齊黑天鵝條件，「買得起」與「現在可買」樣式與說明分開。 |
| 5 | Minor・seed 解析（第 9 列） | `src/ui/app.js:431-444`（`parseSeed` 回傳 `empty／invalid／ok`）、`:481-487`（invalid → `ui.error`＝「牌局代碼需為 0–4294967295 的整數」且不 dispatch） | `T-UI-05`（`tests/ui/smoke.spec.js:102-113`：輸入 `abc` 按開始 → 有提示、畫面仍在 jobSelect） | 前：空白與無效同路徑，靜默改用 `Date.now()`；後：空白才自動產生，無效顯示提示並不開局。 |
| 另 | 規格 §4 START_GAME RNG 次數（第 5 列） | `docs/spec/game-spec.md:158` | 既有 `TRIAGE-S1-aiJobId-rng-consumption-matches-appendix-A1` | 「11」→「11（帶 aiJobId）／12（不帶：先 1 次選 AI 職業，見附錄 A.1）」。 |

## 3. 測試證據

- 指令：`npm test`（＝ `test:engine` → `build` → `test:ui`；CLAUDE.md 第 4 節）
- 輸出摘要：

```
# tests 52 / pass 52 / fail 0            （含 T-R-26-token-drawn-amount、TRIAGE-* 7 支、T-BUILD-*）
build 完成：index.html（73116 bytes；6 個模組、4 個資料檔；零外部資源）
T-UI-04-no-external：ok
[phone 390×844]  T-UI-01 ok（console 無錯誤）
  T-UI-02-full-game：ok（134 步、到第 12 回合、gameOver 顯示 seed 20260913；第 1 回合爆倉、第 1 回合點卡買入；無效 seed 有提示）
  T-UI-03-touch-size：ok（量測 30 個可點元素；title、jobSelect、humanTurn、humanTurn+market、humanBuy、aiTurn、roundEnd、gameOver）
[ipad 1194×834]  T-UI-01 ok
  T-UI-02-full-game：ok（134 步、…；第 1 回合爆倉、第 1 回合點卡買入；無效 seed 有提示）
  T-UI-03-touch-size：ok（量測 22 個可點元素）
T-UI 全部通過
```

- 其他驗收：
  - `grep -RnE 'Math\.random|Date\.now|new Date\(|setTimeout|document\.|window\.|fetch\(' src/engine` → 空。
  - `index.html` 零外部資源（`T-UI-04` 靜態檢查 ok）。
  - 簡體字掃描（Python 逐字比對常見簡體字表）：命中僅 入／值／示／束 等繁簡共用字，無簡體專用字。
  - 截圖已用 Read 逐張看過：`smoke-phone-bust-buy.png`（爆倉結算＋「現在可買」綠標＋說明句＋「跳過，不買」）、`smoke-ipad-bust-buy.png`（同上，雙欄）、`smoke-phone-play.png`／`smoke-ipad-play.png`（「黑天鵝值再增加 3 點即爆倉」；iPad 側欄預覽「買得起」虛線標＋說明句）、`smoke-*-gameover.png`（seed 與複製鈕）。
- 過程中錯一次（未達兩次）：`T-R-26` 子測 (b) 原本把 `lucky` 排在黑天鵝之前強制抽，幸運生效時黑天鵝不在候選集 → `REJECT:DRAW:noCandidates`；改為 lucky 放最後即過。屬測試序列錯誤，非程式問題。
- 未測試的項目與原因：
  - `×2` 標記的**視覺**只在 CSS 與 chip HTML 層改，煙霧測試固定 seed 走法不會持有 a09，故無截圖；金額正確性由 `T-R-26`（含 3 個 seed 整局不變式）覆蓋。
  - 「首次黑天鵝可退回一次（尚未使用）」同理無截圖（走法不會買到 a07）；顯示條件由 `TRIAGE-EXT2-2` 對照 engine `swanReturnUsed` 驗證。
  - 真機觸控（iPad／手機）仍為 K-14 製作人本機驗。

## 4. 未預期發現

- 規格 §3.1 的 state 範例 JSON（`docs/spec/game-spec.md:107-108`）內的兩筆 `TOKEN_DRAWN` 示例尚未加 `amount` 欄位；不在本次指定的三處，未改，請 spec 維護者補（`amount: 10`、`amount: 20`）。
- `tests/engine/rules.test.js` 對 `TOKEN_DRAWN` 的既有斷言只查個別欄位（`token`、`doubled`），未用 `deepStrictEqual` 比整筆事件，故加 `amount` 不需改動該檔（裁決表第 3 節原預期要同步）。
- 爆倉後 buy 階段保險一律不可買（截圖 `smoke-*-bust-buy.png` 顯示「袋中剩 0 顆」）：因爆倉時黑天鵝都在 `drawn`，而 `BUY_INSURANCE` 依規格只看 `bag`。行為符合規格 §4／R-09，但玩家最需要保險的時刻反而買不到，建議列入 G5 playtest 設計待辦（與 K-1、K-2、第 10、11 列同類）。
- 舊的 `.item.sel`／`.item .rad` 樣式已隨 P-1 移除；`.item.bought` 樣式原本就無人使用，一併移除。
- 「跳過」鈕文案採「跳過，不買」（原為「不買」）；`data-act="endTurn"` 不變，K-13 的敘述可據此更新。

## 5. 需要製作人決定的事

- 無（本批 5 項與規格 §4 RNG 欄皆依拍板完成）。

## 6.（選填）需要其他角色配合的事

- spec 維護者：補 §3.1 範例 JSON 的 `amount`（見第 4 節第 1 點）；並把 K-9（§4 RNG 欄）與 K-13（點卡即買）標為已處理。
- review-packager／qa-tester：`triage-ui-display.test.js` 已由「重現」改為「驗證」，第二輪反向質詢（若做）請以本檔第 2.1 表為對照。
