# 外部 AI 審查回覆 1（原文，製作人 2026-09-13 貼回；AI 名稱 UNKNOWN，製作人未註明）

### bug 清單

| 編號 | 嚴重度 | 檔案:行號 | 問題（一句話） | 失敗情境 | 建議修法（方向） |
| --- | --- | --- | --- | --- | --- |
| E-1 | Blocker | `src/engine/reducer.js:32-34` | `withPlayer` 淺層複製未隔離對手物件，違反架構原則 1（狀態不可變） | 呼叫 `reduce(state, action, data)` 後，若傳入被 `Object.freeze` 凍結的 `state`，當 `withPlayer` 更新某一玩家時，回傳物件的 `players` 指向新物件，但未被修改的另一位玩家物件依然直接共用原本的參照；若後續外部修改新 state 該玩家物件，將污染舊 state（未能完全保持各層級隔離）。 | 在 `withPlayer` 中對 `players` 進行淺複製時，確保 `players` 結構與其指針正確解構：`var players = { human: assign(state.players.human, {}), ai: assign(state.players.ai, {}) };`。 |
| E-2 | Major | `src/ui/app.js:205` | 抽屜市場未開時保險項目的判斷邏輯自行計算，繞過 `canApply` | 當 `interactive === false`（即 draw 階段點開抽屜查看市場）時，行 205 僅檢查 `p.cash >= data.balance.insuranceCost`，未檢查 bag 是否含有 `blackSwan`，導致 bag 無黑天鵝時保險仍顯示為可購買狀態（未加上 `.dim`）。 | 統一改用 `can({ type: "BUY_INSURANCE" })`，或補齊 `p.cash >= data.balance.insuranceCost && selectors.bagBlackSwanCount(state, state.currentPlayer) > 0`。 |
| E-3 | Major | `src/ui/app.js:197` | 抽屜市場未開時資產項目可用性自行判斷，繞過 `canApply` | 在 draw 階段玩家點開「市場」時，`interactive === false`，行 197 僅用 `p.cash >= c.cost` 判斷是否有錢買，但在 draw 階段購買本來就不可行，且若之後有其他卡片購買限制會產生不一致。 | 建議即便 `!interactive`，預覽可用性也明確遵循 selector 或 action 前置檢驗，或依規格清楚區分「買得起」與「目前可買」。 |
| E-4 | Minor | `src/ui/app.js:95` | 黑天鵝事件名取模若 `names` 為空時可能顯示 undefined | 若未來擴充 tokens.json 時 `blackSwan` 的 `eventNames` 為空陣列 `[]`，`names[(swanN - 1) % names.length]` 會因除以 0 出現 `NaN`，導致索引查出 `undefined`。 | 加強防呆：`var label = (names && names.length) ? names[(swanN - 1) % names.length] : t.name;`。 |

### 疑似清單

| 編號 | 檔案:行號 | 疑點 | 需要什麼資訊才能確認 |
| --- | --- | --- | --- |
| S-1 | `src/engine/reducer.js:144-149` | `START_GAME` 未傳 `aiJobId` 時會隨機抽選消耗 1 次 RNG，若傳入 `aiJobId` 則不消耗。相同 seed 下，有指定與無指定 `aiJobId` 的洗牌 deck 完全不同。 | 需要確認規格附錄 A.1 的意圖。 |
| S-2 | `src/ui/app.js:284` | `renderPlayBuy` 的「買入」按鈕未綁定 `disabled` 於 `can(action)` | 需要確認是否可能因 race condition 送出非法 action（目前靠 `ui.buySel` 與 dispatch 攔截）。 |

### 架構原則對照
1–5 全部「符合」。

### 第 8 節六個問題
Q-1 確認無誤；Q-2 確認無誤（含 rng 上界 < 1）；Q-3 確認無誤（Math.floor）；Q-4 有問題（見 E-2、E-3）；Q-5 確認無誤（scheduleAi 於 ui.error 時停止）；Q-6 確認無誤。
