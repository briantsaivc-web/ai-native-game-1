# ai-native-game-1

「AI native games」系列的第一款遊戲，也是**可複製到未來每一款遊戲的團隊骨架**。

- 類型：桌遊改編的單頁網頁遊戲（遊戲名稱待 G1 市場調研後由製作人拍板）
- 玩法：單機（對 AI）或同一台裝置輪流；無連線、無金流
- 交付：單一 `index.html`，零依賴、可離線
- 平台：iPad 橫向、手機直向，觸控優先；繁體中文
- 目前狀態：v0.0.1 骨架建立，尚無遊戲程式碼

## 這個 repo 裡有什麼

| 路徑 | 說明 |
|---|---|
| `CLAUDE.md` | 專案憲法：架構原則、工作紀律、角色權限、Gate 流程。所有 AI 角色的最高規範。 |
| `.claude/agents/` | 10 個角色檔：market-researcher、story-editor、systems-engineer、ui-designer、game-engineer、review-packager、qa-tester、code-reviewer、release-manager、course-recorder |
| `.claude/skills/` | 7 個流程技能，對應 Gate：`/research`（G1）、`/plan-story`（G2）、`/spec`（G3＋G3.5）、`/build`（G4）、`/cross-review`（G4.5）、`/qa-gate`（G5）、`/release`（G6） |
| `.claude/hooks/` | `block-push.sh`（擋 AI 自行 push）、`check-forbidden.sh`（擋 engine 層的 Math.random／Date／DOM） |
| `docs/templates/` | 任務單、ADR、回報、UI 三版對照表範本 |
| `docs/` 其餘 | 各 Gate 產物（research、design、spec、ui、tickets、qa、reports、changelog） |
| `src/`、`tests/`、`build/` | 遊戲程式（G4 起才有內容） |

## 怎麼開始

1. 製作人填妥 `CLAUDE.md` 第 1 節（特別是「課程 repo」路徑）。
2. 在 Claude Code 中執行 `/research <調研方向>`，依序走 G1 → G7。
3. 每個硬停點（G1、G2、G3.5、G6）流程會停下來等製作人在對話中拍板；AI 不會自行往下走。
4. push 一律由製作人本機執行；AI 只會給 commit 訊息與指令。

## 如何把這個團隊複製到下一款遊戲

1. 建新 repo（例如 `ai-native-game-2`）。
2. 複製以下內容到新 repo：
   - `CLAUDE.md`
   - 整個 `.claude/` 目錄（agents、skills、hooks、settings.json）
   - `docs/templates/`
   - `.gitignore`
   - 空目錄骨架：`docs/{research,design,spec,ui,tickets,qa,reports,changelog}`、`src/{engine,ui,data}`、`tests/`、`build/`（各放 `.gitkeep`）
3. **只改 `CLAUDE.md` 第 1 節**的表格（repo 名稱、遊戲類型、玩法模式、平台、課程 repo 路徑）。其餘章節是通用規範，除非新遊戲的限制不同（例如需要連線），否則不動。
4. 若新遊戲有不同限制，在第 3 節增刪原則，並同步檢查 `check-forbidden.sh` 的檢查清單與各角色檔的「自我檢查清單」是否需對應調整。
5. 重設 `docs/changelog/CHANGELOG.md` 為 v0.0.1，清空 `.claude/hooks/forbidden-allowlist.txt`。
6. 不要複製：`docs/research/`、`docs/design/`、`docs/spec/`、`docs/ui/`、`docs/tickets/`、`docs/qa/`、`docs/reports/` 的內容，以及 `src/`、`index.html`。

## 版本

見 `docs/changelog/CHANGELOG.md`。
