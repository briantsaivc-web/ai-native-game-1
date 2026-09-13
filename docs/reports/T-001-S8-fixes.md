# 回報：T-001 game-engineer（S8 G5 QA 與 code-review 必修項＋低成本 Minor）

| 欄位 | 內容 |
|---|---|
| 角色 | game-engineer |
| 任務 | T-001 S8：修 QA B-01、B-02、M-01、M-02、M-05 與 reviewer M-1、M-2、m-1、m-4、m-5、m-7，補規格 §3.1 範例 `amount` |
| 日期 | 2026-09-13 |
| 結論 | 完成（8 項全修；不做 M-03、M-04、M-06、m-2、m-3、m-8，列 G7 待辦） |

## 1. 結論（3 行內）

- 兩個 Major 已修：雙擊誤觸改為「換畫面後操作列冷卻 `balance.ui.dockCooldownMs`（350 ms）」並以 Playwright `T-UI-06-double-tap-guard` 兩視圖驗證；AI 規則測試 `tests/engine/ai.test.js` 補齊 `T-R-18`／`T-R-19`／`T-R-20`×2 與正式 `T-AI-selfplay-stats`（50 局 × 3 難度）。
- 6 個 Minor 已修：難度中文改讀 `balance.ai.<level>.label`、roundEnd 平手文案、TRIAGE-E2 改測修正後行為、`START_GAME` 驗 seed（R-27 ＋ `T-R-27`）、`turnSummary.draws` 排除退回顆、規格 §3.1 範例補 `amount`。
- `npm test` 全過：engine **58/58**（原 52 ＋ 6）、build 75,674 bytes 零外部資源、Playwright 兩視圖各 128 步走完一局含 T-UI-06；變異驗證 5 種 `ai.js` 改壞 ＋ 1 種關閉冷卻皆被對應測試抓到；engine 純度 grep 空；無簡體。

## 2. 變更檔案清單

| 檔案 | 動作 | 備份檔 |
|---|---|---|
| `src/ui/app.js` | 修改（冷卻、難度 label、平手、draws、`copyMsg` 宣告） | `app.js.backup.20260913d` |
| `src/ui/styles.css` | 修改（`.dk.cool` 冷卻樣式 1 行） | `styles.css.backup.20260913d` |
| `src/engine/reducer.js` | 修改（`START_GAME` seed 驗證 3 行） | `reducer.js.backup.20260913d` |
| `src/data/balance.json` | 新增欄位 `ai.<level>.label`、`ui.dockCooldownMs` | `balance.json.backup.20260913d` |
| `tests/engine/ai.test.js` | **新增**（5 支測試） | — |
| `tests/engine/rules.test.js` | 新增 `T-R-27` | `rules.test.js.backup.20260913d` |
| `tests/engine/triage-misc.test.js` | 改寫 `TRIAGE-E2` | `triage-misc.test.js.backup.20260913d` |
| `tests/ui/smoke.spec.js` | 新增 `T-UI-06`、`waitDock`／`doubleTap` 工具 | `smoke.spec.js.backup.20260913d` |
| `docs/spec/game-spec.md` | 修改 §3.1 範例、§4 START_GAME 前置條件、§5 新增 R-27 與統計句 | `game-spec.md.backup.20260913d` |
| `index.html` | 重新 build（產物） | — |
| `docs/qa/shots/smoke-*.png`（6 張） | 重拍 | — |
| `docs/qa/shots/s8-phone-dock-cooldown.png` | 新增（冷卻中的操作列證據） | — |

### 2.1 逐項對照

| # | 項目 | 檔案:行號 | 測試名 | 一句話 |
|---|---|---|---|---|
| 1 | Major・雙擊誤觸（QA B-01＝reviewer M-1） | `src/ui/app.js:26-27`（`lastScreen`／`coolTimer`）、`:404-427`（`render` 偵測 `screenName` 變化 → `coolDock()`：dock 內原本可用的按鈕 `disabled`＋`.cool`，`dockCooldownMs` 後以 DOM 直接恢復，不重新 render 以免重置 AI 計時器與飛入動畫）；`src/ui/styles.css:71`；`src/data/balance.json:17` | `T-UI-06-double-tap-guard`（`tests/ui/smoke.spec.js:156-166`、`:228-240`；手機＋iPad 皆 ok） | 連點「下一回合」後第二下不再打到新回合的「停手」（pendingIncome 0、drawn 0、本回合無 DRAW/STOP 事件）；連點「停手」後仍停在購買階段。實測冷卻解除約 356 ms、解除後「跳過，不買」可用（`s8-phone-dock-cooldown.png`）。 |
| 2 | Major・AI 規則測試（QA B-02＝reviewer M-2） | `tests/engine/ai.test.js:38`、`:83`、`:137`、`:178`、`:213` | `T-R-18-ai-pure`（rng 兩入口換成拋錯版＋深度凍結＋JSON 快照＋兩次 deepStrictEqual＋非 AI 階段回 null）、`T-R-19-ai-stop-rules`（三難度：停手線＝門檻−offset 的 ±1、incomeStop 的 ±1、袋空／幸運只剩黑天鵝、THRESHOLD_PLUS 後停手線上移）、`T-R-20-ai-buy-most-expensive`（現金剛好／差 1、同價取索引小者（以複製 data 造同價）、買不起→END_TURN、已買→done）、`T-R-20-ai-insurance-fallback`（依 `balance.ai.<level>.buyInsurance` 推期望；現金差 1、袋無黑天鵝、資產優先）、`T-AI-selfplay-stats`（50 局 × 3 難度：每局 gameOver、round＝rounds、winner 與淨資產一致、seq 連續、player 只在 GAME_STARTED 為 null、AI_DECIDED 決策合法、末筆 GAME_OVER） | 期望值全部從 balance／assets 讀，不寫死；`selfplay.js` 200 局矩陣維持為腳本。 |
| 3 | Minor・gameOver 難度中文（QA M-01；順帶 reviewer m-6 難度部分） | `src/data/balance.json:10-12`（`label`）、`src/ui/app.js:45-48`（`diffLabel()` 讀 label，缺欄位退回 key）、`:190`、`:381` | 截圖 `smoke-phone-gameover.png` 顯示「12 回合・難度 普通」 | title 的寫死對照表移除，兩處共用 data 欄位。 |
| 4 | Minor・roundEnd 平手（QA M-02） | `src/ui/app.js:368` | 讀碼（UI 無法固定 seed 強制觸發；`diff === 0` 分支顯示「平手 —」） | 前「領先 $0」→ 後「平手」。 |
| 5 | Minor・TRIAGE-E2（reviewer m-1） | `tests/engine/triage-misc.test.js:16-49` | `TRIAGE-E2-insurance-preview-requires-bag-swan-and-matches-canApply` | 改為斷言修正後的預覽式（`cash ≥ insuranceCost && bagBlackSwanCount > 0`）：袋無黑天鵝／現金不足 → 不可買，且三種情境進 buy 階段後與 `canApply` 一致；UI 判斷無法從 engine 取得，測試名與註解已註明係複製預覽式。 |
| 6 | Minor・seed 驗證（reviewer m-7＋QA M-05） | `src/engine/reducer.js:140-142`（`typeof seed !== "number" || seed !== (seed >>> 0)` → `REJECT:START_GAME:invalidSeed`）；`docs/spec/game-spec.md:158`、`:239`、`:241` | `T-R-27-start-game-seed-validation`（`tests/engine/rules.test.js:398`：0 與 4294967295 可開局；缺漏／undefined／null／字串／負數／小數／超界／NaN／Infinity／布林 11 種拒絕；拒絕不改輸入；unknownJob 先於 seed） | 不再靜默 `>>>0`。 |
| 7 | Minor・`turnSummary.draws`（reviewer m-4） | `src/ui/app.js:136-143`（遇 `SWAN_RETURNED` 則 `draws−1`） | 讀碼（`SWAN_RETURNED` 與 `TOKEN_DRAWN` 同 player／round，`addLog` 保證） | 持 a07 退回一顆後「停手於第 N 顆」／「翻 N 顆」與「已翻出 N 顆」一致。 |
| 8 | 規格 §3.1 範例 `amount` | `docs/spec/game-spec.md:107-108` | — | 兩筆 `TOKEN_DRAWN` 補 `"amount": 10`、`"amount": 20`（income_s／income_m 面值，與 pendingIncome 10→30 相符）。 |
| 附 | reviewer m-5 | `src/ui/app.js:24`（`copyMsg: ""` 宣告）、檔頭註解補齊 UI 狀態清單 | — | 純可維護性。 |

## 3. 測試證據

```
$ npm test
# tests 58 / pass 58 / fail 0                        （原 52 ＋ ai.test.js 5 ＋ T-R-27 1）
# easy：ai 勝 0／human 勝 50／平手 0（50 局）        （T-AI-selfplay-stats 診斷輸出，human 座位＝normal 策略代打）
# normal：ai 勝 22／human 勝 27／平手 1（50 局）
# hard：ai 勝 45／human 勝 5／平手 0（50 局）
build 完成：index.html（75674 bytes；6 個模組、4 個資料檔；零外部資源）
T-UI-04-no-external：ok
[phone 390×844]  T-UI-01 ok／T-UI-02 ok（128 步、第 12 回合、seed 20260913；第 1 回合爆倉、第 1 回合點卡買入；無效 seed 有提示）
                 T-UI-03 ok（30 個可點元素）／T-UI-06-double-tap-guard ok
[ipad 1194×834]  T-UI-01 ok／T-UI-02 ok（128 步）／T-UI-03 ok（22 個）／T-UI-06 ok
T-UI 全部通過
```

- 步數由 134 → 128：T-UI-06 讓第 2 回合人類翻 0 顆即停手，少 6 步；購買與爆倉路徑覆蓋不變。
- engine 純度：`grep -RnE 'Math\.random|Date\.now|new Date\(|setTimeout|document\.|window\.|fetch\(|require\(.*\.json' src/engine` → 空；`.claude/hooks/check-forbidden.sh` exit 0。
- `index.html`：`grep -cE '<script src|<link href|https?://'` → 0；75,674 bytes（＋2,558，主要為 ai 測試無關的 app.js 冷卻邏輯與 balance 欄位）。
- 簡體掃描（Python 簡體專用字表，掃 `src/ tests/ docs/spec/game-spec.md` 與本報告，排除 `data.test.js` 的測試字表與備份檔）→ 無。
- 截圖：`smoke-{phone,ipad}-{play,bust-buy,gameover}.png` 重拍並看過 gameOver（難度中文正確）；`s8-phone-dock-cooldown.png` 為停手後立即截圖，「跳過，不買」灰掉停用。

## 4. 變異驗證（改壞 → 哪些測試紅 → 還原）

| 變異 | 紅掉的測試 | 其餘 |
|---|---|---|
| `ai.js:29` 黑天鵝停手 `>=` → `>` | `T-R-19-ai-stop-rules` | 57 綠 |
| `ai.js:32` 收入停手 `>=` → `>` | `T-R-19-ai-stop-rules` | 57 綠 |
| `ai.js:49` 排序反向（買最便宜） | `T-R-20-ai-buy-most-expensive` | 57 綠 |
| `ai.js:55` 移除 `buyInsurance === true` 條件 | `T-R-20-ai-insurance-fallback` | 57 綠 |
| `ai.js:50` 同價取索引大者 | 第一版測試**未抓到**（assets.json 無同價卡）→ 改以複製 data 造同價後抓到：`T-R-20-ai-buy-most-expensive` | 57 綠 |
| `app.js:406` 註解掉 `coolDock()` 呼叫（關閉冷卻） | `T-UI-06-double-tap-guard` FAIL（手機＋iPad）：連點「下一回合」第二下穿透到新回合「停手」，本回合出現 1 筆 STOPPED、畫面落到 humanBuy | 其餘 T-UI 綠 |

每次變異後皆 `diff` 確認還原，最終 58/58 與 T-UI 全綠為還原後的結果。

## 5. 未預期發現

- `tests/qa/explore-engine.js` E-03（QA 探索腳本，不在 `npm test`）原本記錄「engine 靜默 `>>>0`」為事實；R-27 之後該項會改為拋 `invalidSeed`。屬 QA 檔案，未動，請 qa-tester 更新。
- 規格 §6.4 的 `balance.json` 範例未含新欄位 `ai.<level>.label`、`ui.dockCooldownMs`（任務只授權 §3.1／§5，未動 §6.4）；§10 A-01 的「30 個 `T-R-*`」數字原本就與 §5 統計句不一致（現為 32 個測試名），一併請 systems-engineer 同步。
- `T-AI-selfplay-stats` 50 局的 easy 難度 AI 勝率 0%、hard 90%，與 S3 的 200 局統計（0.5%／92%）方向一致；只作參考，不是通過／失敗條件。
- 冷卻只作用於 `.dock` 內按鈕；市場清單（點卡即買）與「知道了」、「關閉」等不冷卻。點卡後的 dock 由「跳過」變「結束回合」屬同畫面，不觸發冷卻（第一下已把清單換成文字，reviewer 已核對不會雙買）。
- 同畫面內若在冷卻期間發生重新 render（例如點卡即買），新 dock 直接可用、計時器空轉；這是刻意的（該互動不是雙擊穿透情境）。
- `dockCooldownMs` 與 `tokenFlyMs`（300）接近；若製作人希望「冷卻＝籌碼飛入結束」可直接改數值，不需改程式。

## 6. 需要製作人決定的事

1. `dockCooldownMs` 初值 350 ms 是否合適（真機拇指雙擊常見 150–300 ms；過長會讓「再翻」連按手感變鈍——注意冷卻只在**換畫面**時觸發，同畫面連續「再翻」不受影響）。
2. 規格 §6.4 範例與 §10 A-01 數字的同步是否交 systems-engineer 在 G6 前處理。
3. G7 待辦確認：M-03（AI 回合面板語意）、M-04（最小字級）、M-06（`fastDivisor`）、m-2（UI 純函數抽出）、m-3（測試期望值改讀 data）、m-8（簡體掃描納入 UI 檔）。
