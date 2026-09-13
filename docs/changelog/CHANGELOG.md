# CHANGELOG

> 格式：每版一節，由 release-manager 撰寫；內容來自任務單與工程師回報。版本號規則見 CLAUDE.md 第 6 節。

## v0.1.0 — 2026-09-13 — 第一個可玩版「見好就收」（夜市攤主・對 AI）

> 由 release-manager 彙整；內容來源：docs/reports/T-001-S1～S8、docs/qa/T-001-qa.md、docs/qa/T-001-code-review.md、docs/reviews/T-001/triage.md。

### 包含的任務
- T-001「見好就收 v0.1 可玩版」全部子任務 S1–S8。

### 新增
- 遊戲：12 回合推運氣型現金流挑戰，玩家對 AI（三難度）；3 張職業卡、12 張資產卡、6 種籌碼、保險；固定 seed 可重放，gameOver 顯示 seed 與複製鈕；AI 職業卡由 seed 隨機（製作人拍板）。
- engine（`src/engine/`）：純函數 reducer、mulberry32 seeded RNG、`decideAi`、selectors；`TOKEN_DRAWN` 事件含 `amount`（本顆實際入帳）。
- 資料（`src/data/`）：jobs／assets／tokens／balance 四個 JSON，所有數值標「待 G5 playtest 調整」。
- UI（`src/ui/`）：依 G3.5 製作人選定的 C 版（手機 App 式：底部固定操作列＋市場抽屜；iPad 橫向為左資訊卡＋右市場面板）；點卡即買；雙擊誤觸冷卻（`balance.ui.dockCooldownMs`）；爆倉提示以「黑天鵝值再增加 N 點」表述；seed 輸入無效時提示且不開局；版本號由 build 從 package.json 注入顯示於 title 畫面。
- build（`build/bundle.js`）：`src/` → 單檔 `index.html`（76,024 bytes，零外部資源，決定性輸出）。
- 測試：engine 59 個（規則 R-01～R-27、不變式、資料、RNG、AI 規則 T-R-18～20、selfplay、build、G4.5 實證 triage-*）；Playwright 煙霧測試 T-UI-01～06（手機直向 390×844、iPad 橫向 1194×834，各走完一局含購買與爆倉路徑，可點元素 ≥ 44×44，console 零錯誤）。

### G4.5 外部 AI 交叉審查結果
- 兩份外部回覆共 11 條意見：採納 6（全部 UI 層）、不採納 5；唯一 Blocker 主張（withPlayer 未隔離）經深度凍結整局實證為假。詳見 `docs/reviews/T-001/triage.md`。

### G5 QA 與程式審查
- QA 判定「有條件通過」→ Major 2 項（雙擊誤觸、缺 AI 規則測試）已於 S8 修復；code-review 判定「有條件通過」→ Major 2 項同上已修。

### 已知問題與 G7 待辦（本版不修）
- 設計議題：市場 12 張售罄後購買階段只剩保險／跳過；AI 末回合會買穩賠資產；爆倉當回合保險必不可買；翻 0 顆停手仍拿收銀機加成；一局時長模擬約 3–6 分鐘，規格假設「10–20 分鐘」偏高。
- 平衡：AI 對 AI 200 局 easy 勝率 ≈0%、normal ≈44%、hard ≈90–92%；AI 爆倉率 0%（策略性必停）。
- Minor 未修：iPad AI 回合右側面板語意（QA M-03）、iPad 部分文字 11–13 px（M-04）、加速倍率寫死 `/4`（M-06）、triage 測試複製 UI 邏輯（m-2）、測試期望值寫死（m-3）、簡體掃描未含 src/ui（m-8）。
- 規格 §6.4 balance.json 範例未含 `dockCooldownMs`／`label`；§10 A-01 測試數字待同步。

### 需製作人真機驗收（G6 硬停點）
- 見 `docs/reports/T-001-release.md`。

## v0.0.2 — 2026-09-13 — 新增 G4.5 外部 AI 交叉審查

> 本條由 systems-engineer 依製作人指示代填流程變更；版本號正式生效與否由 release-manager 於 G6 確認。

### 新增
- `CLAUDE.md`：第 8 節 Gate 表新增 **G4.5 外部 AI 交叉審查**（負責：review-packager ＋ 製作人；產物：`docs/reviews/T-<編號>/review-pack.md`、`external-<AI名>.md`、`triage.md`；硬停點：製作人貼給外部 AI 並貼回）；第 7 節權限表新增 review-packager；第 2 節目錄地圖新增 `docs/reviews/`；技能對應新增 `/cross-review`。
- `.claude/agents/review-packager.md`：新角色，產審查包、寫裁決表；不修程式、不替外部 AI 背書。
- `.claude/skills/cross-review/SKILL.md`：G4.5 流程技能，兩個硬停點。
- `.claude/skills/build/SKILL.md` 末尾、`.claude/skills/qa-gate/SKILL.md` 開頭：加入 G4.5 步驟與前置檢查；沒有 `triage.md` 不得進 `/qa-gate`。
- `docs/templates/審查包.md`、`docs/templates/裁決表.md` 範本。
- `docs/reviews/.gitkeep`。

### 來源
- 製作人上一個專案（FinFlow）的做法，見課程章節《讓 AI 互相抓錯：交叉審查與實證裁決》。

## v0.0.1 — 2026-09-13 — 骨架建立

### 新增
- `CLAUDE.md` 專案憲法（8 節：專案欄位、目錄地圖、五條架構原則、指令 UNKNOWN、工作紀律、版本與發布、角色權限、G0–G7 Gate 流程）。
- `.claude/agents/` 9 個角色檔：market-researcher、story-editor、systems-engineer、ui-designer、game-engineer、qa-tester、code-reviewer、release-manager、course-recorder。
- `.claude/skills/` 6 個流程技能：research、plan-story、spec、build、qa-gate、release。
- `.claude/hooks/` block-push.sh、check-forbidden.sh、forbidden-allowlist.txt；`.claude/settings.json`。
- `docs/templates/` 任務單、ADR、回報、UI 三版對照表。
- `README.md`、`.gitignore`、各目錄 `.gitkeep`。

### 未包含
- 任何遊戲程式碼、`package.json`、`index.html`（G4 起）。
- `docs/research/board-game-elements.md`（由另一位角色另行撰寫）。
