# T-001 發布準備回報（release-manager，G6）

- 日期：2026-09-13　- 版本：**v0.1.0**　- 包含任務：T-001 S1–S8
- 註：release-manager 子代理於作業中途因 API 額度中斷，版本注入（bundle.js／template／app.js／build.test）已由其完成；changelog、本回報與檢查清單由幕僚長依其未完成事項接手補齊，全部依既有回報與 QA 文件如實記錄。

## 1. 版本號一致性
| 位置 | 值 | 說明 |
|---|---|---|
| package.json `version` | 0.1.0 | 唯一來源 |
| build/bundle.js | 讀 package.json 注入 `window.GAME_VERSION`，格式不符即失敗 | T-BUILD 測試覆蓋 |
| src/ui/app.js:185 | title 畫面顯示 `v0.1.0`（由 GAME_VERSION） | 不寫死 |
| index.html | 含 `GAME_VERSION = "0.1.0"` | build 產物 |
| docs/changelog/CHANGELOG.md | v0.1.0 條目 | 本次新增 |
| README.md | 狀態行改 v0.1.0 | 本次修改 |

## 2. Build 與測試
- `npm run build`：index.html v0.1.0，76,024 bytes，6 模組、4 資料檔，零外部資源。
- `npm test`：engine 59／59 通過；Playwright 手機直向與 iPad 橫向各走完一局（含購買、爆倉、無效 seed、雙擊防護），console 零錯誤。

## 3. 發布前檢查清單
- [x] 全部測試通過（59 engine ＋ T-UI-01～06 兩視圖）
- [x] 版本號在所有位置一致（見 §1）
- [x] changelog 已寫（v0.1.0）
- [x] src 與 index.html 無殘留 TODO／【待補】（grep 為空）
- [x] 備份檔（*.backup.*）在 .gitignore，不進 build
- [x] index.html 零外部資源（grep http 為 0）
- [x] 簡體掃描：engine／UI 由 S7／S8 以字元集掃描零命中（tests/engine/data.test.js 內含刻意簡體字表，掃描時排除）
- [ ] 製作人真機驗收（見 §6）——硬停點

## 4. GitHub Pages 設定（製作人，3 步）
1. GitHub repo → Settings → 左側 Pages。
2. Build and deployment → Source 選「Deploy from a branch」→ Branch 選 `main`、資料夾 `/(root)` → Save。
3. 等 1–2 分鐘，網址：`https://briantsaivc-web.github.io/ai-native-game-1/`（首頁即 index.html）。

## 5. 建議 commit 訊息
```
release: v0.1.0 見好就收第一個可玩版（T-001 S1–S8；G4.5 交叉審查裁決、G5 QA／審查修正；engine 59 測試、Playwright 煙霧測試）
```
VS Code：Source Control → 訊息框貼上 → Commit → Sync Changes。
命令列：
```
cd "C:\Users\Carrie\ai-native game-1"
git add .
git commit -m "release: v0.1.0 見好就收第一個可玩版（T-001 S1–S8；G4.5 交叉審查裁決、G5 QA／審查修正；engine 59 測試、Playwright 煙霧測試）"
git push
```

## 6. 製作人真機驗收清單（iPad Safari 與手機 Chrome 各跑一次）
- [ ] 打開 GitHub Pages 網址（或本機 index.html），title 畫面右下角看到 `v0.1.0`。
- [ ] 選 normal、留空 seed、選職業，從第 1 回合玩到 gameOver，過程無卡死；結束畫面 seed 可「複製」（Safari 若不支援請記下）。
- [ ] 快速連點兩下「停手」：仍停在購買畫面，沒有跳過購買。
- [ ] 購買階段點一下資產卡即買入，畫面立刻反映；「現在可買」綠標與「買得起」灰標可辨。
- [ ] 手機直向：網址列收合後底部操作列仍完整可見；iPad 橫向：右側市場面板可點。
- [ ] 飛航模式（斷網）重新整理仍可玩（零依賴）。

## 7. 未預期發現
- 一局實測時長請製作人順手計時（QA 模擬 3–6 分鐘，規格假設 10–20 分鐘偏高）。
