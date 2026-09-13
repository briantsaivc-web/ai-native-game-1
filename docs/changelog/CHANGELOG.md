# CHANGELOG

> 格式：每版一節，由 release-manager 撰寫；內容來自任務單與工程師回報。版本號規則見 CLAUDE.md 第 6 節。

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
