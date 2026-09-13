# UI 決策紀錄（decision-log）

| 編號 | 日期 | 決策問題 | 選項 | 製作人裁決 | 附帶決定 | 依據檔案 |
|---|---|---|---|---|---|---|
| v1 | 2026-09-13 | 主畫面整體取向 | A 極簡文字卡／B 夜市桌面／C 手機 App 式 | **C 手機 App 式**（底部固定操作列＋市場抽屜；iPad 橫向為左資訊卡＋右側市場面板） | 1. AI 對手的職業卡由 seed 隨機三選一；2. gameOver 畫面顯示本局 seed 供回報 bug | `docs/ui/v1-C.html`、`docs/ui/v1-compare.md`、`docs/spec/game-spec.md` |

## 對 G4 的指示
- S4 UI 綁定以 `docs/ui/v1-C.html` 的版面、色彩、元件尺寸為準；規則與數字一律讀 state，不得沿用 v1-C 內的假資料。
- ui-designer 在 v1-C 記錄的已知風險（iPad 橫向利用率低、翻牌時看不到市場）列入 G5 playtest 觀察項，不在 v0.1 修。
- 規格書需依附帶決定更新：AI 職業卡隨機（`START_GAME` 由 rng 決定 ai jobId）、gameOver 顯示 seed。
