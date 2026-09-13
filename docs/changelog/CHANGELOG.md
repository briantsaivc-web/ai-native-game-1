# CHANGELOG

> 格式：每版一節，由 release-manager 撰寫；內容來自任務單與工程師回報。版本號規則見 CLAUDE.md 第 6 節。

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
