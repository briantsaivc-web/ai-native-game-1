# 裁決表：T-001 見好就收 v0.1（G4.5 外部交叉審查）

> 由 review-packager 填寫。外部回覆原文存於同目錄 `external-1.md`、`external-2.md`（AI 名稱 UNKNOWN，製作人未註明），未節錄。
> 判定依據只能是可回查的東西（讀碼、規格書、測試）。「外部 AI 說」不是證據；「兩個 AI 都說」也不是。
> 製作人指示：「討論，有共識再改」——本表只裁決與實證，**未修改任何 `src/`**。實證測試檔保留於 `tests/engine/triage-*.test.js`。

| 欄位 | 內容 |
|---|---|
| 任務 | T-001 |
| 審查包 | `docs/reviews/T-001/review-pack.md`（1 批） |
| 外部來源 | `external-1.md`（2026-09-13）、`external-2.md`（2026-09-13） |
| 輪次 | 第 1 輪（最多兩輪） |
| 日期 | 2026-09-13 |

## 1. 逐條裁決

| # | 外部意見（來源、外部編號、外部宣稱嚴重度、檔案:行號、問題一句話） | 我方判定 | 理由（可回查） | 派給誰 | 改動範圍 |
|---|---|---|---|---|---|
| 1 | 外部 1 E-1、**Blocker**、`src/engine/reducer.js:32-34`、`withPlayer` 淺層複製未隔離對手物件，違反原則 1 | **需實證 → 實證結果：假（不採納）** | 現象為真（未修改的玩家物件與舊 state 共用參照，`triage-e1.test.js` (b) 斷言 `s1.players.ai === s0.players.ai`），但這是不可變更新的標準結構共享（structural sharing），`reducer.js:4` 明寫「淺層複製＋只替換被改的分支」。原則 1 要求「相同輸入＋相同序列＝相同結果、不 mutate」，不要求每層深拷貝。實證：深度凍結初始 state、data 與每一步輸出，4 個 seed 整局 strict mode 零 TypeError（(a)）；reduce 六步後舊 state 內容不變（(b)）。外部 1 的失敗情境需「外部程式手動 mutate 新 state」才成立，而其建議修法只把共用往下推一層（`ai.bag` 陣列仍共用，(c)），無法消除它自己描述的風險。另：既有 `T-R-25-reducer-immutable`（review-pack §5 已列）已覆蓋同一件事，外部 1 未對照測試清單。 | 無 | — |
| 2 | 外部 1 E-2、Major、`src/ui/app.js:205`、抽屜市場預覽（`interactive=false`）保險只看現金、未看 bag 有無黑天鵝，繞過 `canApply` | **採納，嚴重度降為 Minor** | 讀碼確認 `app.js:205` `!interactive` 分支只比 `p.cash >= insuranceCost`。實證 `triage-misc.test.js` TRIAGE-E2：bag 無黑天鵝、現金足時預覽為「可買」，但 `canApply` 在 draw 階段一律 false、buy 階段為 `noBlackSwan` false，實購一律被 reducer 拒絕。只影響 draw 階段抽屜的預覽外觀（且該抽屜已標「停手後才能購買」`app.js:267`），不影響 state 與實際購買，故不是 Major。原則 1「UI 不得自己算規則」：現金比較是「買不買得起」的預覽，嚴格說仍是 UI 自算，改法很小。 | game-engineer | UI |
| 3 | 外部 1 E-3、Major、`src/ui/app.js:197`、同上，資產項目預覽只看現金 | **採納，嚴重度降為 Minor**（與第 2 列合併修） | 同第 2 列。`app.js:197` 在 `!interactive` 時只比 `p.cash >= c.cost`；`buyAsset` 的其他拒絕條件（phase、alreadyPurchased、notInMarket）在預覽情境下都不會導致錯誤購買。修法方向：預覽改用「以假想 buy 階段 state 呼叫 `canApply`」或明確標示「買得起／不可買」兩種語意（規格 §8 UI 契約可補一句）。 | game-engineer | UI（若要區分語意需補規格一句） |
| 4 | 外部 1 E-4、Minor、`src/ui/app.js:95`、`eventNames` 為空時取模除以 0 顯示 undefined | **不採納** | 讀碼：`app.js:94` `var names = t.eventNames \|\| []`、`:95` `names.length ? names[(swanN − 1) % names.length] : t.name`——外部建議的防呆已經存在，一字不差。外部 1 引用的行號正確但沒讀該行內容。 | 無 | — |
| 5 | 外部 1 S-1（疑似）、`src/engine/reducer.js:144-149`、帶與不帶 `aiJobId` 的 RNG 消耗次數不同，同 seed 洗牌結果不同 | **不採納（符合規格；規格 §4 表未同步）** | 規格附錄 A.1 製作人拍板（2026-09-13）：「未帶 `aiJobId` 時以 rng 隨機取一張，消耗 1 次 RNG，順序在 Fisher–Yates 之前」——實作與拍板一致。實證 `triage-misc.test.js` TRIAGE-S1：帶 aiJobId 消耗 11 次、不帶 12 次、不帶時職業 ＝ 第 1 次 RNG 結果、兩種呼叫各自可重放。差異是規格意圖，非 bug。已知問題 K-9 已記錄「§4 表的 11 尚未同步」，屬規格文件工作。 | 規格：由製作人／spec 維護者把 §4 `START_GAME` RNG 欄改為「11（帶 aiJobId）／12（不帶）」 | 規格 |
| 6 | 外部 1 S-2（疑似）、`src/ui/app.js:284`、「買入」鈕未綁 `can(action)` 的 `disabled` | **不採納（被 P-1 取代）** | 讀碼：`buySel` 只能由 `app.js:202/210` 的 pick 鈕設定，而 pick 鈕在 `!ok` 時已 `disabled`；UI 為單執行緒，人類回合無 AI 計時器（`scheduleAi` 只在 `isAiTurn()` 時排程，`app.js:388`），沒有 race 來源；即使送出非法 action，`dispatch` 捕捉 REJECT 顯示錯誤（`app.js:380`），state 不變。且製作人已拍板改為點卡即買（第 12 列），兩步式「買入」鈕會被移除。 | 無（隨 P-1 消失） | — |
| 7 | 外部 2 第 1 條、Major、`src/ui/app.js:90`、翻倍收入籌碼仍顯示面值（＋10、＋10、＋40 合計 60，實際 100） | **需實證 → 實證結果：真（採納，Major）** | `triage-ui-display.test.js` TRIAGE-EXT2-1：human 持 a09（第三口鍋），依序抽 income_s、income_s、income_l → `pendingIncome=100`，第 3 顆 `TOKEN_DRAWN` 有 `doubled:true`；`app.js:90` 標籤用 `t.value` 面值 → [10,10,40] 合計 60。會誤導玩家對「再翻／停手」的判斷。外部建議「由 engine 事件提供本顆實際收入」：目前 `TOKEN_DRAWN` 無 `amount` 欄位，但有 `pendingIncome` 累計值，相鄰事件差值即為本顆實際收入（80）；UI 可只讀 log 不重算規則（原則 1）。若要加 `amount` 欄位需同步規格 §4.1 事件表（engine 小改）。 | game-engineer | UI（或 engine＋規格：`TOKEN_DRAWN` 加 `amount`） |
| 8 | 外部 2 第 2 條、Major、`src/ui/app.js:221–224`、爆倉提示未考慮 `SWAN_RETURN_ONCE` 首次退回（說再翻 3 顆，實際第 4 顆才爆） | **需實證 → 實證結果：真（採納，Major）** | `triage-ui-display.test.js` TRIAGE-EXT2-2：human 持 a07 且 `swanReturnUsed=false`，連翻黑天鵝第 4 顆才 `busted`；`app.js:221` `left = th − blackSwanCount = 3` → `:224` 「再翻 3 顆黑天鵝就爆倉」。無 a07 時提示與實際一致（3）；a07 用過後也一致。這句提示本身就是 UI 自算規則（原則 1 灰區），外部建議改措辭為「黑天鵝值再增加 N 點即爆倉」並另顯示退回效果是否可用，是最小改法；或 UI 讀 `swanReturnUsed` 與 `assetsWithEffect` 把 left+1。 | game-engineer | UI |
| 9 | 外部 2 第 3 條、Minor、`src/ui/app.js:397–402、441–444`、seed 輸入格式錯誤時靜默改用時間 | **採納（Minor）** | 讀碼確認：`parseSeed` 對非 `^\d{1,10}$` 或 >4294967295 回傳 `null`（`:399-401`），`onClick start` 對 `null` 一律 `Date.now()`（`:442`），空白與格式錯誤同路徑，無提示。輸入框 placeholder 是「留空＝自動產生」（`:162`），使用者輸入錯誤代碼會以為在重放指定牌局。修法：`parseSeed` 區分空字串與無效；無效時 `ui.error` 提示、不開局。 | game-engineer | UI |
| 10 | 外部 2 體驗 1、市場 12 張耗盡無回補，後期購買失去選擇感 | **不採納（設計議題，非 bug）** | 規格 §4 `START_GAME` deck＝12 張、`refillMarket` 只從 deck 補（`reducer.js:70-78`），行為與規格一致。是否回補或加牌是平衡／敘事設計，屬 G5 playtest 範圍（已知問題 K-1、K-2 同類）。 | G5 playtest／story-editor（列入設計待辦） | 設計（可能牽動 data＋規格） |
| 11 | 外部 2 體驗 2、最後一回合 AI 買確定虧分資產（發電機 −180 ＋130） | **不採納（設計議題，非 bug）** | 外部 2 自己註明「符合目前 AI 規格，不是實作 bug」；`ai.js:42-54` R-20 買最貴可負擔卡，規格 §7 未定義末回合例外。是否加「末回合只買 value ≥ cost」規則屬 AI 難度設計，交 G5 playtest 一併看 K-2 的難度差。 | G5 playtest／story-editor（列入設計待辦） | 設計（若採納：engine `ai.js`＋規格 §7） |
| 12 | **P-1**（製作人拍板，非外部意見）、購買改為「點卡即買」，取消兩步式「點選 → 買入」 | **採納** | 製作人另行拍板；對應已知問題 K-13。`app.js:451` pick 只設 `ui.buySel`、`:452-458` buy 才 dispatch；改為 pick 直接 dispatch `BUY_ASSET`／`BUY_INSURANCE`，並移除 `buy` 鈕與 `buySel`（保留「不買／結束回合」）。順帶消掉第 6 列 S-2。 | game-engineer | UI |

判定定義：
- **採納**：讀碼或對照規格書即可確認為真，且修法方向明確。
- **不採納**：讀碼或對照規格書即可確認為假，或屬已知問題／刻意不處理。
- **需實證**：兩方說法都有可能，讀碼無法定案；寫最小測試對決（本輪已實跑，結果填於上表）。

## 2. 需實證項目的實證方法與結果

執行指令：`node --test tests/engine/triage-*.test.js`（Node 內建 test runner，零依賴）。

輸出摘要（2026-09-13）：

```
ok 1 - TRIAGE-E1-a-deep-frozen-full-game-no-mutation
ok 2 - TRIAGE-E1-b-structural-sharing-does-not-pollute-old-state
ok 3 - TRIAGE-E1-c-external-fix-does-not-remove-described-risk
ok 4 - TRIAGE-E2-insurance-preview-cash-only-vs-canApply
ok 5 - TRIAGE-S1-aiJobId-rng-consumption-matches-appendix-A1
ok 6 - TRIAGE-EXT2-1-doubled-income-chip-shows-face-value
ok 7 - TRIAGE-EXT2-2-bust-hint-ignores-swan-return-once
# tests 7 / pass 7 / fail 0
```

### 2.1 對應第 1 列（E-1 withPlayer 隔離）

- 外部說法（A，外部 1）：`withPlayer` 未複製未被修改的玩家物件，違反原則 1；傳入凍結 state 會「未能完全保持各層級隔離」。
- 外部說法（A′，外部 2）：深度凍結整局 199 個 action 通過，未發現問題。
- 我方讀碼判斷（B）：共用參照是結構共享，只要 engine 不 mutate 就不違反原則 1；`T-R-25` 已證明不 mutate。
- 最小測試：`tests/engine/triage-e1.test.js`
  - (a) seeds 1、7、20260913、424242 × 三職業三難度，深度凍結 data、初始 state 與每步輸出，AI 對 AI 跑到 gameOver。A 為真時：strict mode 賦值凍結物件拋 TypeError；B 為真時：零 TypeError。
  - (b) seed 5，DRAW 後斷言 `s1.players.ai === s0.players.ai`（外部描述的現象），再深度凍結 s0 跑 DRAW/STOP/END_TURN/AI_TURN×3，斷言 s0 內容深度相等於快照。
  - (c) 模擬外部 1 建議修法，斷言複製後 `ai.bag`、`ai.assets` 仍與舊 state 共用。
- 實跑結果：**假**（A 的現象為真，但結論「違反原則 1」為假；A′ 為真）。
- 機制描述：外部 1 對「共用參照」的描述對；對「違反不可變」的推論錯。正確機制：不可變更新＝不修改輸入、回傳新物件，被改分支複製、未改分支共享（`reducer.js:4`）。
- 外部附的修法能否直接用：**不能**——只多複製一層，陣列仍共享，且每步多兩次無意義複製；要「各層級隔離」得整棵深拷貝，違反本專案設計並拖慢 `canApply`（每次 render 呼叫多次 `reduce`）。

### 2.2 對應第 7 列（外部 2 第 1 條 翻倍收入顯示）

- 外部說法（A）：`app.js:90` 用籌碼面值，翻倍時顯示 ＋40 而非 ＋80。
- 我方讀碼判斷（B）：同意讀碼結果，需實跑確認 engine 事件是否提供可用資訊。
- 最小測試：`tests/engine/triage-ui-display.test.js` TRIAGE-EXT2-1；human 持 a09，強制依序抽 income_s、income_s、income_l（每次 bag 只剩該顆，rng 只有一個候選）。
- 實跑結果：**真**。`pendingIncome=100`；UI 面值 [10,10,40]＝60。`TOKEN_DRAWN` 有 `pendingIncome`、`doubled`，無 `amount`；相鄰事件差值＝80 可供 UI 顯示。
- 機制描述：對。
- 外部附的修法能否直接用：**部分能**——「不要在 UI 重算效果」對；「由 engine 事件提供本顆實際收入」需加欄位並同步規格 §4.1，或改為 UI 讀相鄰 `TOKEN_DRAWN.pendingIncome` 差值（不改 engine）。哪一種由 game-engineer 提、製作人選。

### 2.3 對應第 8 列（外部 2 第 2 條 爆倉提示）

- 外部說法（A）：持 a07 未用時提示「再翻 3 顆」，實際第 4 顆才爆。
- 我方讀碼判斷（B）：同意；`app.js:221` 只算 `th − blackSwanCount`。
- 最小測試：`tests/engine/triage-ui-display.test.js` TRIAGE-EXT2-2；human 持 a07，連續強制抽 blackSwan 數到 busted；對照無 a07 與已用過 a07 兩組。
- 實跑結果：**真**。有 a07 且未用：第 4 顆爆；提示 3。無 a07：第 3 顆爆；提示 3。a07 已用：提示 3、實際 3。
- 機制描述：對。
- 外部附的修法能否直接用：**能**（改措辭「黑天鵝值再增加 N 點即爆倉」＋顯示退回效果可用與否，只改 UI 字串）。

### 2.4 對應第 2、3 列（E-2／E-3 預覽繞過 canApply）

- 外部說法（A）：Major；bag 無黑天鵝時保險預覽仍顯示可買。
- 我方讀碼判斷（B）：現象為真，但只在 draw 階段抽屜預覽，實購被 reducer 擋，應為 Minor。
- 最小測試：`tests/engine/triage-misc.test.js` TRIAGE-E2；seed 1、j02、bag 改為無黑天鵝，比較 `cash-only` 判斷與 `canApply`（draw 與 buy 兩階段）。
- 實跑結果：**半真**（現象真、嚴重度不成立）。
- 外部附的修法能否直接用：**能**（`p.cash >= insuranceCost && bagBlackSwanCount > 0` 一行；資產側同理）。

### 2.5 對應第 5 列（S-1 aiJobId RNG）

- 最小測試：`tests/engine/triage-misc.test.js` TRIAGE-S1；seed 20260913，帶／不帶 aiJobId 各開一局，對照 rng 狀態、deck、職業。
- 實跑結果：外部描述的現象**真**，但**符合規格附錄 A.1**；非 bug。規格 §4 表「11」需更新為「11／12」。

## 3. 統計與下一步

- 採納：6（Major 2：第 7、8 列；Minor 3：第 2、3、9 列；製作人拍板 1：第 12 列 P-1）
- 不採納：6（第 1、4、5、6、10、11 列；其中第 5 列轉規格文件更新、第 10、11 列轉 G5 設計待辦）
- 需實證：5（第 1、2、5、7、8 列）——本輪已全部實跑完畢，結果併入上表
- **Blocker 級採納項：0**。外部 1 唯一的 Blocker（E-1）實證為假。

**建議的修改批次（一次派給 game-engineer，依嚴重度排序；「有共識再改」——請製作人確認後才派）**

| 順序 | 對應列 | 檔案:行號 | 修法方向 | 範圍 |
|---|---|---|---|---|
| 1 | 7（Major） | `src/ui/app.js:90` | 收入籌碼標籤改讀 log：本顆 ＝ 該 `TOKEN_DRAWN.pendingIncome` − 前一顆；`doubled` 時加「×2」標記。若製作人偏好 engine 加 `amount` 欄位，需同步規格 §4.1 與 `tests/engine/rules.test.js` 的事件斷言 | UI（或 engine＋規格） |
| 2 | 8（Major） | `src/ui/app.js:221-224` | 提示改「黑天鵝值再增加 N 點即爆倉」；持 `SWAN_RETURN_ONCE` 且 `!swanReturnUsed` 時加一句「首顆黑天鵝可退回」 | UI |
| 3 | 12（P-1） | `src/ui/app.js:202、210、276-284、451-458` | 點卡即買：pick 直接 dispatch；移除 buy 鈕與 `ui.buySel`；保留「不買」；同步 `tests/ui/smoke.spec.js` 走法與 K-13 | UI |
| 4 | 2＋3（Minor） | `src/ui/app.js:197、205` | 預覽判斷補齊：保險加 `bagBlackSwanCount > 0`；或整體改為對假想 buy 階段 state 呼叫 `canApply` | UI |
| 5 | 9（Minor） | `src/ui/app.js:397-402、441-444` | `parseSeed` 區分空白／無效；無效時顯示提示不開局 | UI |

**規格文件更新（非 game-engineer）**
- 第 5 列：規格 §4 `START_GAME` RNG 次數欄改為「11（帶 aiJobId）／12（不帶：先 1 次選職業）」，與附錄 A.1、K-9 一致。

**需製作人決定**
- 上表 5 項全部本版修，或只修 Major（1、2）＋P-1（3），Minor（4、5）下版修。
- 第 7 列修法選擇：UI 讀 log 差值（不動 engine）或 engine 事件加 `amount`（動 engine＋規格）。
- 第 10、11 列是否列入 G5 playtest 設計待辦（市場回補；AI 末回合購買規則）。
- 是否進行第二輪反向質詢：**建議否**。理由：唯一分歧（E-1）已由測試定案且兩個外部 AI 立場本就相反；其餘採納項外部與我方一致，不採納項（E-4、S-1、S-2）是讀碼即可回查的事實，不需再問。若製作人想要，第二輪固定問法：「這是我方對你報告的覆驗結論。不要告訴我你同不同意。請核對原始碼，逐條說它對或不對，附行數和理由；對的就明說對，漏掉的補上。」
- 兩輪後仍無共識的項目：無（第 1 輪）。

## 4. 未預期發現

- `TOKEN_DRAWN` 事件沒有「本顆實際收入」欄位；UI 要正確顯示翻倍只能靠相鄰事件差值。這不是 bug，但規格 §4.1 事件欄位若要讓 UI「只讀 log 不算規則」更乾淨，可考慮加 `amount`。
- `app.js:224` 爆倉提示與 `app.js:197/205` 預覽，本質都是 UI 自算規則（原則 1 灰區）；第 7、8 列修完後建議 systems-engineer 在 G5 前掃一次 UI 還有哪些「用 state 欄位自算」的句子。
- 外部 1 的 E-4 建議修法與現行程式碼一字不差、E-1 未對照審查包 §5 的 `T-R-25`——顯示外部 1 讀碼有跳行；其意見的行號可信、內容需逐條核對。外部 2 自述「擷取程式跑 199 個 action」但審查包無該腳本，依本角色原則仍視為未驗（本表已自行實跑取代）。
- 外部 2 註明 CSS／HTML 模板不在附件內，觸控尺寸與響應式（原則 4）本輪外部未審；仍靠 K-14 製作人真機驗。
