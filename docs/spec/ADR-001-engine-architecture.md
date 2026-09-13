# ADR-001 engine-architecture（reducer 純函數、seeded RNG、資料驅動、單檔打包）

> 架構決策紀錄。由 systems-engineer 填寫。一個 ADR 只記一個決策叢：本份記「engine 層與打包的四項基礎取捨」，因四者互相依賴（打包方式決定模組格式，模組格式決定 engine 如何被測試）。

| 欄位 | 內容 |
|---|---|
| 狀態 | 已採納（G3，2026-09-13） |
| 日期 | 2026-09-13 |
| 相關任務 | T-001 |
| 製作人核准 | 不需要（全部為 CLAUDE.md 第 3 節既定原則的具體化，未引入例外）；若製作人反對任一細節，於 G3.5 停點一併提出 |

## 1. 背景

- 規格書 `docs/spec/game-spec.md` 定義了 state、action、資料檔，但沒有說「程式怎麼組」。game-engineer 需要四個明確答案：（a）reducer 的簽名與不變性要求、（b）用哪個 seeded RNG、（c）資料如何進 engine、（d）CommonJS 檔案如何變成零依賴的單一 `index.html` 又能在 Node 直接測。
- 受影響的原則：CLAUDE.md 第 3 節第 1 條（純函數 reducer）、第 2 條（seeded RNG）、第 3 條（資料驅動）、第 5 條（零依賴、單檔）。

## 2. 決策

### 2.1 reducer 純函數
- 一句話：engine 對外只有 `reduce(state, action, data) → newState`、`initialState()`、`decideAi(state, data) → action`、`selectors.*`、`canApply(state, action, data) → boolean`；全部為純函數，回傳新物件，不修改輸入。
- 介面：

```js
// src/engine/reducer.js
function initialState() { /* phase:"lobby"，其餘空值，見規格 §3 */ }
function reduce(state, action, data) {
  // 前置條件不成立：throw new Error("REJECT:" + action.type + ":" + reason)
  // 成立：回傳新 state（淺層複製 + 只替換被改的分支；log 用 concat）
}
function canApply(state, action, data) { /* try { reduce } catch → false；或獨立判斷，兩者結果必須一致 */ }
module.exports = { initialState, reduce, canApply };

// action 形狀（全部）
{ type: "START_GAME", seed: 20260913, jobId: "j02", difficulty: "normal", aiJobId: undefined }
{ type: "DRAW" }  { type: "STOP" }  { type: "BUY_ASSET", cardId: "a03" }
{ type: "BUY_INSURANCE" }  { type: "END_TURN" }  { type: "NEXT_ROUND" }  { type: "AI_TURN" }
```

- 深拷貝策略：不用 `structuredClone`（iPad 舊版 Safari 支援度 UNKNOWN），用手寫淺層複製；測試 `T-R-25-reducer-immutable` 以 `Object.freeze` 深度凍結輸入後呼叫，拋錯即失敗。
- `data` 由呼叫端傳入（UI 從打包進來的全域 `GAME_DATA` 取，測試從 `require("../../src/data/*.json")` 取）；engine 不 `require` JSON，避免 Node 與瀏覽器路徑差異。

### 2.2 seeded RNG：mulberry32
- 一句話：採用 mulberry32（32-bit 狀態、一行核心、公有領域），狀態存在 `state.rng.s`，每次呼叫回傳新狀態，**不使用閉包或物件內部可變狀態**。
- 介面：

```js
// src/engine/rng.js
function seedRng(seed) { return { s: seed >>> 0 }; }
function next(rng) {            // 回傳 { rng: 新狀態, value: [0,1) 浮點 }
  let t = (rng.s + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { rng: { s: t }, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
}
function nextInt(rng, n) {      // 回傳 { rng, value: 0..n-1 }；n ≥ 1
  const o = next(rng); return { rng: o.rng, value: Math.floor(o.value * n) };
}
module.exports = { seedRng, next, nextInt };
```

- 為何 mulberry32：（1）狀態只有一個 uint32，可直接放進 state JSON，重放只要記 seed；（2）實作 5 行、無依賴、無 BigInt，iPad Safari 與 Node 行為一致（只用 `Math.imul` 與 `>>>`）；（3）品質對桌遊抽籤足夠（通過 PractRand 至 2^32 級的常見說法，本案不需密碼學等級）；（4）已在 FinFlow 類的單檔網頁遊戲廣泛使用（**UNKNOWN**：FinFlow 實際採用的 RNG 未查證，此為一般經驗）。
- `Math.floor(value * n)` 的取模偏差在 n ≤ 20 時 < 10⁻⁸，忽略。
- RNG 呼叫點只有兩處：`START_GAME` 洗牌（Fisher–Yates，n−1 ＝ 11 次）、`DRAW` 抽索引（1 次）。其餘 action 零次。此清單寫進規格 §4 表格「RNG 次數」欄，測試 `T-RNG-call-count` 驗證。

### 2.3 資料驅動
- 一句話：所有平衡數值、卡片、籌碼在 `src/data/*.json`；engine 內出現的數字只允許 0、1、−1 與索引運算。
- `data` 物件形狀：`{ jobs: jobs.json, assets: assets.json, tokens: tokens.json, balance: balance.json }`（各為 JSON 檔頂層物件）。engine 內用 `data.assets.assets.find(...)` 等查表；建議 S2 建 `src/engine/selectors.js` 的 `byId(list, id)` 輔助函數，避免到處 find。
- `balance.ui.*` 為 UI 專用；engine 不得讀（測試以 Proxy 監看 `data.balance.ui` 是否被存取：`T-DATA-07-engine-never-reads-ui-balance`）。

### 2.4 單檔打包：CommonJS ＋ 迷你模組註冊器
- 一句話：原始碼用 CommonJS 寫（Node 測試零設定），`build/bundle.js` 把每個檔案包成 `__define("路徑", function(module, exports, require){...})`，並在瀏覽器端提供 20 行內的 `__require`，最後把 JSON、CSS、JS 依標記注入 `src/ui/index.template.html` 產生 `index.html`。
- 打包順序（固定寫在 `build/bundle.js` 的陣列，S4 不得新增檔案而不改此陣列——見分派單交叉影響 X-4）：

```
1. <!-- INJECT:DATA --> → <script>window.GAME_DATA = {jobs:…, assets:…, tokens:…, balance:…};</script>
2. <!-- INJECT:CSS -->  → <style>src/ui/styles.css</style>
3. <!-- INJECT:JS -->   → <script>
     迷你註冊器
     __define("engine/rng.js", …)  __define("engine/selectors.js", …)
     __define("engine/ai.js", …)   __define("engine/reducer.js", …)
     __define("ui/app.js", …)
     __require("ui/app.js");   // app.js 自行在 DOMContentLoaded 後啟動
   </script>
```

- `require` 路徑規則：原始碼一律用相對路徑（`require("./rng")`），註冊器把 `./x` 解析成同目錄 key；不支援 `node_modules`、不支援 JSON require（資料由 `GAME_DATA` 或測試端傳入）。
- `build/bundle.js` 只用 Node 內建 `fs`、`path`；不做壓縮、不做 source map。

## 3. 替代方案

| 方案 | 優點 | 缺點 | 為何不選 |
|---|---|---|---|
| A. ES modules ＋ 直接在瀏覽器用 `<script type=module>` | 不需打包 | 多檔＝非單檔；`file://` 開啟時 ESM 受 CORS 限制，iPad 離線無法玩 | 違反單檔、可離線 |
| B. ES modules ＋ esbuild／rollup 打包 | 業界標準、tree-shaking | 引入第三方套件到建置鏈；製作人本機需 npm install 才能 build | CLAUDE.md 零依賴精神雖只限產物，但建置鏈越簡單越適合課程示範；Playwright 已是唯一例外，不再加第二個 |
| C. 全域命名空間（每檔 `window.NM.xxx = …`，測試用 `vm` 載入） | 打包最簡單（直接串接） | Node 測試要模擬 `window`；engine 檔出現 `window.` 會被 hook 擋 | 與 `check-forbidden.sh` 直接衝突 |
| D. RNG 用 xorshift128+ 或 PCG | 週期更長、品質更好 | 需 64-bit 運算（BigInt 或兩個 uint32），state 序列化較麻煩 | 抽籤規模小（袋子 ≤ 30 顆），mulberry32 足夠 |
| E. RNG 用 `seedrandom` 套件 | 成熟 | 第三方依賴 | 違反零依賴 |
| F. reducer 內部用 `structuredClone` 深拷貝 | 程式最短 | Safari 15.4 以前不支援，製作人 iPad 版本 UNKNOWN；效能在 log 變長後下降 | 改用淺層複製＋只換改動分支 |
| G. 拒絕 action 時回傳原 state 而非拋錯 | UI 不用 try/catch | 重放序列會混入無效 action 卻無痕跡；測試難分辨「被拒」與「無效果」 | 拋錯＋`canApply` 讓 UI 事前判斷 |

## 4. 影響

- engine：全部檔案 CommonJS、零 I/O；`rng` 狀態在 state 內流動；新增 `canApply` 給 UI 用。
- ui：只能透過 `__require("engine/reducer.js")` 等取得 engine；seed 由 UI 產生（允許 `Date.now()`，只在 UI）；AI 回合節奏用 `setTimeout` 重複送 `AI_TURN`。
- data：四個 JSON 由打包器內嵌為 `GAME_DATA`；測試端直接 `require`。
- tests：engine 測試 `node --test`，不需任何套件；UI 煙霧測試需 Playwright（devDependency，唯一例外，不進產物）。
- 對決定性（seed 重放）的影響：**有（正面）**——rng 狀態隨 state 走，`JSON.stringify(state)` 即完整快照；重放只需 seed ＋ action 序列。
- 對觸控與零依賴的影響：無（打包產物零外連；建置鏈只用 Node 內建模組）。

## 5. 驗證方式

| 測試名 | 驗證 |
|---|---|
| `T-R-21-replay-deterministic` | 同 seed ＋ 同序列（含 AI_TURN）兩次 → `assert.deepStrictEqual` |
| `T-R-25-reducer-immutable` | 深度 freeze 輸入後跑完整一局不拋錯 |
| `T-RNG-01-mulberry32-vector` | `seedRng(1)` 連續 5 次 `next` 的值與已知向量相符（S2 產生向量並寫進測試，供日後回歸） |
| `T-RNG-02-call-count` | START_GAME 消耗 11 次、DRAW 消耗 1 次、其他 0 次（比對 `rng.s` 變化次數） |
| `T-DATA-07-engine-never-reads-ui-balance` | Proxy 監看 |
| `T-BUILD-01-single-file` | `npm run build` 後 `index.html` 含 `GAME_DATA`、無 `src=`／`href=` 指向外部 |
| hook `check-forbidden.sh` | 每次 Write/Edit `src/engine/` 自動掃 |

## 6. 未決事項

- UNKNOWN：製作人 iPad 的 Safari 版本；影響是否可用 `structuredClone`（已決定不用，故不阻塞）。
- UNKNOWN：FinFlow 專案的 Playwright 設定內容；S5 自行建立最低設定並回報。
- 需製作人決定：無（附錄見規格書附錄 A）。
