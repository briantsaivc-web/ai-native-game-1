# 熱門輕量桌遊元素拆解與第一款遊戲方向建議

- 撰寫角色：market-researcher（市場研究員）
- 日期：2026-09-13
- 批准人：製作人 Brian
- 目標邊界：單機（對電腦 AI）或同一台裝置輪流／單一 index.html／iPad 與手機觸控／不連線、不存檔／規模不超過「約 15 回合、幾張職業卡、十幾張事件卡」的簡單財商桌遊數位版。

---

## 1. 調研範圍與方法

### 1.1 篩選條件
- 規則 15 分鐘內學會；一局 20–40 分鐘（上限 60 分鐘）；支援 2–4 人。
- 排除：實體操作技巧類（疊疊樂）、隱藏身分靠對話類（狼人）、需 5 人以上、一局超過 60 分鐘。
- 候選池：BoardGameGeek（BGG）排名前段、Spiel des Jahres（SdJ）近 10 年得獎與入圍、台灣桌遊店常見暢銷款。

### 1.2 實際使用的來源（全部為批准網域或出版社官網／零售站）
| 用途 | 來源 | 狀態 |
|---|---|---|
| SdJ 歷年得獎／入圍總表 | https://en.wikipedia.org/wiki/Spiel_des_Jahres | 可讀 |
| SdJ 官方 2014 年度檔案 | https://www.spiel-des-jahres.de/erjahr/2014/ | 可讀 |
| SdJ 官方 2015 年度檔案 | https://www.spiel-des-jahres.de/erjahr/2015/ | 可讀 |
| SdJ 官方 2017 年度檔案 | https://www.spiel-des-jahres.de/erjahr/2017/ | 可讀 |
| SdJ 官方 2018 年度檔案（第 1、2 頁） | https://www.spiel-des-jahres.de/erjahr/2018/ 、 https://www.spiel-des-jahres.de/erjahr/2018/page/2/ | 可讀 |
| SdJ 官方得獎分類頁 | https://www.spiel-des-jahres.de/preiskat/spiel-des-jahres/ | 可讀 |
| SdJ 官方遊戲頁（Quacksalber） | https://www.spiel-des-jahres.de/spiele/die-quacksalber-von-quedlinburg/ | 可讀 |
| 各遊戲基本資料 | 英文 Wikipedia 各遊戲條目（見附錄） | 可讀 |
| Splendor 銷量 | https://www.spacecowboys-games.com/universe/splendor/ （出版社官網） | 可讀 |
| Azul 官方規格 | https://www.nextmove-games.com/en/azul/azul-game/ （出版社官網） | 可讀 |
| Sushi Go! 官方規格 | https://gamewright.com/product/Sushi-Go （出版社官網） | 可讀 |
| For Sale 官方規格 | https://iellogames.com/games/for-sale/ （出版社官網） | 可讀 |
| 台灣代理商獲獎經典目錄 | https://www.swanpanasia.com/catalog/award （新天鵝堡官網） | 可讀 |
| 台灣代理商推薦組合 | https://boardgamer.org/product-category/天鵝推薦 （新天鵝堡官方網店） | 可讀 |
| 台灣論壇推薦討論 | https://www.ptt.cc/bbs/BoardGame/M.1672805013.A.2A8.html （PTT BoardGame，2023-01-04） | 可讀 |
| 台灣消費者排行（參考 PTT／Dcard 評價） | https://tw.my-best.com/71831 （更新日期 2025-09-22） | 可讀（非批准網域，僅作旁證，不引用其數字） |

### 1.3 來源不可得清單（網址＋原因）
| 網址 | 原因 | 影響 |
|---|---|---|
| https://boardgamegeek.com/boardgame/148228/splendor | HTTP 403 | BGG 排名、評分、評分人數全部標 UNKNOWN |
| https://boardgamegeek.com/boardgame/204583/kingdomino | 連線錯誤（fetch 失敗） | 同上 |
| https://boardgamegeek.com/boardgame/230802/azul | HTTP 403 | 同上 |
| https://boardgamegeek.com/xmlapi2/thing?id=…&stats=1 | HTTP 401（API 現需授權 token） | 同上 |
| https://boardgamegeek.com/browse/boardgame | HTTP 403 | 無法取得 BGG 排名總表 |
| https://www.spiel-des-jahres.de/en/award-winners/ | HTTP 404（頁面不存在） | 改用 /erjahr/ 年度檔案與 /preiskat/ 分類頁 |
| https://en.wikipedia.org/wiki/For_Sale_(card_game) | 網域快取層回報「cache-only，無法抓取」 | For Sale 改用 IELLO 官網與規則 PDF |
| https://zh.wikipedia.org/wiki/年度遊戲獎 | 同上（cache-only） | 中文譯名改由台灣代理商網站與 PTT 討論串佐證 |
| https://boardgametogo.com/boardgame-billboard/ （桌遊好地方 2025 排行） | HTTP 403 | 台灣零售排行僅剩新天鵝堡目錄與 PTT |
| https://ktla.com/…/blue-orange-partners-with-meeple-corp… （Kingdomino 新聞稿） | HTTP 403 | Kingdomino 銷量 UNKNOWN |
| https://wobgames.net/bestseller-boardgame-21-12/ | 可讀，但內容為香港店（含「廣東話版」），不屬台灣零售，僅記錄不引用 | — |
| reddit.com/r/boardgames（限定網域搜尋） | 搜尋代理回 HTTP 400；不限網域再搜時未回傳 reddit 結果 | 未使用 reddit 證據 |
| https://en.wikipedia.org/wiki/Kennerspiel_des_Jahres | 可讀，但摘要工具回傳明顯錯誤內容（年份與遊戲對不上），判定不可信，整段捨棄 | Kennerspiel 資料改用 SdJ 官網 |

### 1.4 方法
1. 以 SdJ 官方檔案與 Wikipedia 總表建立 2014–2025 得獎／入圍清單，篩出符合人數與時長者。
2. 以出版社官網或 Wikipedia 條目取得年份、設計師、人數、時長。
3. 以台灣代理商（新天鵝堡）目錄與 PTT BoardGame 討論串佐證台灣市場能見度。
4. 每款拆解：核心決策、可搬用元素、單機改編可行性、觸控適配。
5. 統計元素頻率，據此提出 3 個彼此不同的第一款遊戲方向。

**BGG 排名全部 UNKNOWN**：BGG 網頁與 XML API 皆被擋（403／401），本文件不使用任何 BGG 排名或評分數字。

---

## 2. 候選遊戲表（共 12 款）

> 欄位說明：「為什麼紅」只列有來源的事實；「單機改編可行性」評估 AI 對手難易與同機輪流是否漏資訊；「觸控適配」評估元件數量與拖拉需求。台灣中文譯名若無來源佐證，標「譯名 UNKNOWN」。

### 2.1 璀璨寶石 Splendor
- **年份／設計師／人數／時長**：2014／Marc André／2–4 人／30 分鐘
- **來源**：https://en.wikipedia.org/wiki/Splendor_(game) ；https://www.spacecowboys-games.com/universe/splendor/
- **核心機制**：每回合三選一——拿寶石、保留一張卡、或用寶石買一張發展卡；買到的卡給永久折扣，越買越便宜（引擎構築）。
- **為什麼紅**：2014 SdJ 入圍（https://www.spiel-des-jahres.de/erjahr/2014/ ）；出版社官網稱「Over 3 million games sold worldwide」（https://www.spacecowboys-games.com/universe/splendor/ ，未註明統計年份）；2014 Golden Geek 年度遊戲、Origins 年度遊戲（Wikipedia）。台灣：香港店 2021-11 策略類第 7 名為漫威版（非台灣，僅參考）；台灣中文譯名「璀璨寶石」見 https://andyventure.com/boardgame-splendor/ （非批准網域，僅作譯名佐證）。
- **有趣元素**：(1) 一回合只做一件事的極簡動作選單；(2) 引擎構築：買下的資產給永久折扣；(3) 公開市場搶卡（先搶先贏）；(4) 15 分達標即觸發終局的競速結束條件。
- **單機改編可行性：高**——全資訊公開、AI 可用「距離目標卡最近」的貪婪法即可像樣；同機輪流無隱藏資訊（保留卡可改為公開）。
- **觸控適配：高**——元件只有 3 排卡＋6 種寶石籌碼，全部可用點擊完成，無拖拉。

### 2.2 多米諾王國 Kingdomino
- **年份／設計師／人數／時長**：2016／Bruno Cathala／2–4 人／15–20 分鐘
- **來源**：https://en.wikipedia.org/wiki/Kingdomino ；https://www.spiel-des-jahres.de/erjahr/2017/
- **核心機制**：每回合先選下一張板塊（選好的板塊決定下輪順位：拿好板塊就排後面），再把手上板塊放進 5×5 王國，同地形連成一片 × 皇冠數計分。
- **為什麼紅**：2017 SdJ 年度遊戲（https://www.spiel-des-jahres.de/erjahr/2017/ ）；台灣代理商新天鵝堡以「Domino Kingdom 多米諾王國」收入「全家齊動腦」推薦組合（https://boardgamer.org/product-category/天鵝推薦 ）；PTT 3–4 人推薦串有人提及（https://www.ptt.cc/bbs/BoardGame/M.1672805013.A.2A8.html ）。銷量 UNKNOWN（新聞稿頁 403）。
- **有趣元素**：(1) 「拿好貨就排後面」的選擇即順位交換；(2) 5×5 空間限制下的拼版；(3) 面積 × 加乘的計分結構；(4) 固定回合數（板塊用完即結束）。
- **單機改編可行性：高**——全公開資訊；AI 可用「放置後得分增量」評估；同機輪流無漏資訊問題。
- **觸控適配：中**——需要拖拉並旋轉板塊到格子上，觸控可行但要做吸附與旋轉鈕；元件量小。

### 2.3 花磚物語 Azul
- **年份／設計師／人數／時長**：2017／Michael Kiesling／2–4 人／30–45 分鐘
- **來源**：https://en.wikipedia.org/wiki/Azul_(board_game) ；https://www.nextmove-games.com/en/azul/azul-game/ ；https://www.spiel-des-jahres.de/preiskat/spiel-des-jahres/
- **核心機制**：每回合從某個展示盤拿走一種顏色的全部磁磚（其餘推到中央），放進自己的準備列；列滿才能貼上牆，拿太多會掉到地板扣分。
- **為什麼紅**：2018 SdJ 年度遊戲（https://www.spiel-des-jahres.de/erjahr/2018/ ）；2018 As d'Or、Origins、2017 Golden Geek（出版社官網）；台灣譯名「花磚物語」見香港店排行與部落格（https://wobgames.net/bestseller-boardgame-21-12/ ，2021-11 策略類第 1 名，香港市場）。台灣零售排名 UNKNOWN。
- **有趣元素**：(1) 「拿一種顏色的全部」——拿多不一定好，溢出就扣分；(2) 公開共池：我拿走什麼會決定對手剩什麼（互動不必攻擊）；(3) 列滿才結算的延遲滿足；(4) 先手標記的懲罰換順位。
- **單機改編可行性：高**——全公開資訊；AI 用「本次拿取的淨得分」一步貪婪即可；同機輪流無漏資訊。
- **觸控適配：高**——點展示盤選色、點目標列放入，兩次點擊完成一回合，無拖拉。

### 2.4 骰子街 Machi Koro
- **年份／設計師／人數／時長**：2012（日本）／Masao Suganuma／2–4 人／30 分鐘
- **來源**：https://en.wikipedia.org/wiki/Machi_Koro ；https://www.spiel-des-jahres.de/erjahr/2015/
- **核心機制**：每回合擲骰→所有人依骰數領取自己建築的收入→用錢買一張新建築或地標；先蓋完四座地標者勝。
- **為什麼紅**：2015 SdJ 入圍（https://www.spiel-des-jahres.de/erjahr/2015/ ）；2015 Geekie Award 最佳桌遊（Wikipedia）；PTT 3–4 人推薦串有人提及「骰子街」（https://www.ptt.cc/bbs/BoardGame/M.1672805013.A.2A8.html ）。銷量 UNKNOWN。
- **有趣元素**：(1) 擲骰觸發收入：每張建築對應骰數，別人擲骰我也可能賺（無等待感）；(2) 一骰或兩骰的選擇（蓋了車站才能擲兩顆）；(3) 用收入買更多收入的資產累積；(4) 地標＝里程碑式勝利條件。
- **單機改編可行性：高**——全公開資訊、每回合一個購買決策；AI 用「期望收入／成本」排序即可；同機輪流無漏資訊。
- **觸控適配：高**——一個擲骰鈕＋點卡購買；元件為商店卡列，數量可控。
- **與財商主題的相關性**：最高——本質就是「用現金流買資產、資產再生現金流」。

### 2.5 駱駝大賽 Camel Up
- **年份／設計師／人數／時長**：2014／Steffen Bogen／2–8 人（2–4 完全適用）／30 分鐘
- **來源**：https://en.wikipedia.org/wiki/Camel_Up ；https://www.spiel-des-jahres.de/erjahr/2014/ ；https://www.swanpanasia.com/catalog/award
- **核心機制**：每回合四選一——擲一顆駱駝骰讓賽況推進（拿 1 元）、押這一段誰領先（越早押賠率越高）、押全場冠軍／墊底、或放路障。
- **為什麼紅**：2014 SdJ 年度遊戲（https://www.spiel-des-jahres.de/erjahr/2014/ ）；台灣代理商新天鵝堡列入「獲獎經典」目錄，中文名「駱駝大賽」（https://www.swanpanasia.com/catalog/award ）。銷量 UNKNOWN。
- **有趣元素**：(1) 押注時機：早押賠率高但資訊少；(2) 疊駱駝的連鎖隨機（隨機但可估）；(3) 公開賠率牌逐張減少的稀缺感；(4) 段落結算（每段五顆骰擲完就發錢）。
- **單機改編可行性：高**——資訊幾乎全公開（僅冠軍押注蓋住）；AI 可用蒙地卡羅模擬剩餘骰序估機率；同機輪流時「冠軍押注」須改成隱藏或改公開。
- **觸控適配：高**——全部是點擊（押注牌、擲骰鈕）；元件少。

### 2.6 女巫的佳釀 Die Quacksalber von Quedlinburg（The Quacks of Quedlinburg）
- **年份／設計師／人數／時長**：2018／Wolfgang Warsch／2–4 人／約 45 分鐘
- **來源**：https://en.wikipedia.org/wiki/The_Quacks_of_Quedlinburg ；https://www.spiel-des-jahres.de/spiele/die-quacksalber-von-quedlinburg/ ；https://www.spiel-des-jahres.de/erjahr/2018/page/2/
- **核心機制**：每回合從自己的袋子抽籌碼放到鍋子軌道上，白籌碼總值超過 7 就爆鍋；隨時可停；停下後用抵達位置的錢買新籌碼放進袋子（下回合更強）。九回合後比分。
- **為什麼紅**：2018 Kennerspiel des Jahres（https://www.spiel-des-jahres.de/erjahr/2018/page/2/ ）；2019 UK Games Expo 人氣獎、2020 Origins 最佳家庭遊戲（Wikipedia）；PTT 3–4 人推薦串提及「女巫的佳釀」（https://www.ptt.cc/bbs/BoardGame/M.1672805013.A.2A8.html ）。銷量 UNKNOWN。
- **有趣元素**：(1) 推運氣：抽到爆為止還是見好就收；(2) 袋子構築：買進的籌碼改變下回合機率（風險自己塑造）；(3) 爆鍋仍有部分獎勵（失敗不歸零）；(4) 落後補償（老鼠尾巴：落後者起步加成）。
- **單機改編可行性：高**——所有人同時抽、互不干擾，AI 只需一個「停止門檻」策略；同機輪流無漏資訊（各自袋子公開亦無妨）。
- **觸控適配：高**——一個「再抽一顆」鈕與一個「停」鈕即可；購買為點卡。

### 2.7 欲罷不能 Can't Stop
- **年份／設計師／人數／時長**：1980／Sid Sackson／2–4 人／Wikipedia 標 3–45 分鐘（實務約 30 分鐘，UNKNOWN 無官方值）
- **來源**：https://en.wikipedia.org/wiki/Can%27t_Stop_(board_game) ；https://www.swanpanasia.com/catalog/award
- **核心機制**：擲四顆骰分成兩對，把三個臨時標記往 2–12 的欄位推；每次擲後決定「再擲」或「停下鎖定進度」；擲出無法推進的組合就本回合全部歸零。
- **為什麼紅**：SdJ 評審團 1982 年推薦（Wikipedia）；台灣代理商新天鵝堡「獲獎經典」目錄有售，中文名「欲罷不能」（https://www.swanpanasia.com/catalog/award ）。銷量 UNKNOWN。
- **有趣元素**：(1) 純推運氣：再擲或停的二元決策；(2) 只有三個臨時標記——資源有限的「押哪幾條」；(3) 機率梯度（7 最短、2 與 12 最長）讓風險可計算；(4) 歸零懲罰但已鎖定的進度永久保留。
- **單機改編可行性：高**——全公開；AI 可用固定停止規則（例如「三標記都出且推進 ≥ 3 就停」）；同機輪流無隱藏資訊。
- **觸控適配：高**——擲骰鈕＋點選骰對組合＋「停」鈕，三種操作而已。

### 2.8 迴轉壽司 Sushi Go!
- **年份／設計師／人數／時長**：2013／Phil Walker-Harding／2–5 人／15 分鐘
- **來源**：https://en.wikipedia.org/wiki/Sushi_Go! ；https://gamewright.com/product/Sushi-Go
- **核心機制**：每回合從手牌選一張留下、其餘傳給左手邊；三輪結束後依套牌（三張生魚片、握壽司配芥末、餃子遞增）計分。
- **為什麼紅**：Oppenheim Toy Portfolio 白金獎、Parents' Choice 推薦（出版社官網）；SdJ 獎項無（UNKNOWN 是否曾入推薦名單）。台灣譯名「迴轉壽司」UNKNOWN（未在批准來源找到）。銷量 UNKNOWN。
- **有趣元素**：(1) 選一傳一的輪抽：你留什麼就是給對手什麼；(2) 遞增套牌（餃子 1/3/6/10/15）；(3) 條件加成（芥末 × 下一張握壽司）；(4) 多數決計分（布丁最多加分、最少扣分）。
- **單機改編可行性：中**——手牌隱藏；AI 好做（每張牌計期望值），但同機輪流時傳牌會漏資訊，需改成「同時暗選、翻開」或「公開市場輪抽」。
- **觸控適配：高**——點一張牌即可；卡牌數約 108 張但每人手上最多 10 張。

### 2.9 情書 Love Letter
- **年份／設計師／人數／時長**：2012／Seiji Kanai／2–4 人（初版）／20 分鐘
- **來源**：https://en.wikipedia.org/wiki/Love_Letter_(card_game) ；https://www.spiel-des-jahres.de/erjahr/2014/
- **核心機制**：手上永遠只有一張牌，抽一張後二選一打出，打出的牌效果是猜牌、比大小、看牌、交換等；被淘汰或牌庫抽完後手上最高者贏該回合。
- **為什麼紅**：2014 SdJ 推薦名單（https://www.spiel-des-jahres.de/erjahr/2014/ ）；2014 Deutscher Spiele Preis 第 4 名、多項 2013 Golden Geek（Wikipedia）。銷量 UNKNOWN。
- **有趣元素**：(1) 「二選一」的極簡手牌；(2) 靠已打出牌推理剩餘牌（公開棄牌堆＝資訊）；(3) 多回合短局累積籌碼；(4) 16 張牌就是一款完整遊戲的極低內容量。
- **單機改編可行性：中**——AI 需簡單推理但可行；同機輪流時手牌與被看牌的資訊會漏，需「遮蔽畫面／交接畫面」處理。
- **觸控適配：高**——只有 16 張牌，每回合點一張。

### 2.10 For Sale（拍賣房產；台灣譯名 UNKNOWN）
- **年份／設計師／人數／時長**：1997（Ravensburger）／Stefan Dorra／3–6 人（**注意：不支援 2 人，屬邊界案例**）／30 分鐘
- **來源**：https://iellogames.com/games/for-sale/ ；http://www.gamecabinet.com/rulesText/ForSale.txt （1997 原版規則）
- **核心機制**：前半段輪流出價競標房產卡（喊價或棄權，棄權拿當前最低卡並退回一半錢）；後半段每回合同時暗選一張房產卡賣出，房子越高分拿越貴的支票。
- **為什麼紅**：長年重印（1997 Ravensburger → 2020 IELLO Mini Games，出版社官網）；獎項 UNKNOWN；銷量 UNKNOWN；台灣零售 UNKNOWN。
- **有趣元素**：(1) 公開遞增競標（棄權退一半錢的軟著陸）；(2) 兩階段結構：先買資產再賣資產；(3) 同時暗選出牌的賣出階段（我押什麼取決於猜對手）；(4) 現金即分數，沒有換算。
- **單機改編可行性：中**——AI 競標可用「卡片價值 vs 出價」估值；賣出階段的同時暗選在同機輪流會漏資訊，須改成逐人遮蔽輸入或改公開順序出牌。人數 3 起是硬限制，2 人版需自設變體。
- **觸控適配：高**——加價鈕／棄權鈕與點選一張卡。

### 2.11 鐵道任務 Ticket to Ride
- **年份／設計師／人數／時長**：2004／Alan R. Moon／2–5 人／30–60 分鐘
- **來源**：https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game)
- **核心機制**：每回合三選一——抽兩張火車卡、抽目的地卡、或打出同色卡佔一段路線；路線越長分越高，目的地達成加分、未達成扣分。
- **為什麼紅**：2004 SdJ 年度遊戲、2005 Diana Jones Award（Wikipedia）；Wikipedia 引述銷量 250,000 套（2004）→ 18,000,000 套（2024）（https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game) ）。
- **有趣元素**：(1) 集合套牌後一次兌換（湊齊才能佔）；(2) 隱藏目標卡（未完成倒扣）；(3) 公開市場五張＋盲抽的取牌選擇；(4) 佔位卡住對手的溫和衝突。
- **單機改編可行性：中**——AI 需路徑規劃（最短路），可做但比其他款重；同機輪流時手牌與目的地卡會漏資訊。
- **觸控適配：中**——地圖與大量路線需要縮放與精準點擊，手機小螢幕吃力；卡片 110 張。

### 2.12 卡斯卡迪亞 Cascadia（台灣譯名 UNKNOWN）
- **年份／設計師／人數／時長**：2021／Randy Flynn／1–4 人／30–45 分鐘
- **來源**：https://en.wikipedia.org/wiki/Cascadia_(board_game) ；https://www.spiel-des-jahres.de/preiskat/spiel-des-jahres/
- **核心機制**：每回合從四組「地形板塊＋動物指示物」配對中選一組，板塊接到自己的地圖上、動物放到相符地形上；終局依動物計分卡（熊要成對、狐狸看鄰居）與最大連續地形計分。
- **為什麼紅**：2022 SdJ 年度遊戲（https://www.spiel-des-jahres.de/preiskat/spiel-des-jahres/ ）；2022 Deutscher Spiele Preis 第 2 名（Wikipedia）；銷量 UNKNOWN；台灣零售 UNKNOWN。
- **有趣元素**：(1) 配對選擇：想要的板塊綁著不想要的動物；(2) 可變計分卡（每局規則微調）；(3) 自建棋盤（不與他人棋盤互動的並行拼版）；(4) 松果代幣付費解綁配對。
- **單機改編可行性：高**——全公開、玩家間幾乎不互動，AI 只需評估自己棋盤；同機輪流無漏資訊；原生支援單人模式。
- **觸控適配：中**——六角板塊拖放與旋轉，加上動物指示物放置，操作步驟比 Azul 多。

---

## 3. 元素頻率表

| 元素 | 出現於（款數） | 說明 |
|---|---|---|
| **一回合只做 1 個決定（極簡動作選單）** | Splendor、Azul、Kingdomino、Machi Koro、Sushi Go!、Love Letter、Ticket to Ride、Cascadia（8） | 熱門輕量遊戲的共同骨架：三選一或二選一，回合秒級完成 |
| **公開共池／市場搶奪（我拿走什麼決定對手剩什麼）** | Splendor、Azul、Kingdomino、Camel Up、Cascadia、Ticket to Ride（6） | 不用攻擊也有互動；同機輪流零漏資訊 |
| **集合套牌／湊齊才兌換** | Splendor、Sushi Go!、Ticket to Ride、Azul、Cascadia（5） | 延遲滿足帶來「差一張」的張力 |
| **推運氣（再一次或停）** | Quacks、Can't Stop、Camel Up（擲骰即推進）、For Sale（喊價）（4） | 決策簡單但情緒濃；AI 只要一個門檻 |
| **引擎構築／資產生資產** | Splendor、Machi Koro、Quacks（袋子）（3） | 與財商主題天然吻合 |
| **選擇即順位／拿好貨付出代價** | Kingdomino、Azul（先手標記）、Cascadia（松果解綁）（3） | 平衡機制不靠額外規則 |
| **押注時機／賠率遞減** | Camel Up、For Sale（4 款中的 2 款有明確賠率）（2） | 資訊越多回報越低的經典曲線 |
| **失敗不歸零（軟著陸）** | Quacks（爆鍋仍得部分）、For Sale（棄權退半）、Can't Stop（已鎖定進度保留）（3） | 降低挫折，讓新手敢冒險 |
| **固定回合數／板塊用完即終局** | Kingdomino、Azul、Quacks（9 回合）、Cascadia、Sushi Go!（3 輪）（5） | 一局長度可預測，適合 15 回合規模 |
| **隱藏目標／暗選** | Ticket to Ride、Love Letter、For Sale、Sushi Go!、Camel Up（冠軍注）（5） | 同機輪流的主要風險來源，需遮蔽或改公開 |
| **里程碑式勝利條件** | Machi Koro（四地標）、Splendor（15 分）、Can't Stop（三欄）（3） | 明確「衝線」目標感 |

**觀察**：出現 ≥5 款的元素（極簡動作選單、公開共池、集合套牌、固定回合數）都對單機／同機輪流／觸控完全友善；隱藏資訊元素雖常見但是同機輪流的主要坑，第一款遊戲應避開或降級為「公開資訊」。

---

## 4. 推薦 3 個第一款遊戲方向

三個方向刻意分屬不同機制家族：**A 推運氣、B 資產引擎（集合／構築）、C 押注與競標**。全部在單機／單頁／觸控／不連線／不存檔邊界內。

### 方向 A：「見好就收」——推運氣型現金流挑戰（借 Quacks + Can't Stop + Machi Koro）
- **借用元素**：推運氣（再抽或停）、袋子構築（買進籌碼改變下回合機率）、失敗不歸零、擲骰觸發收入、固定回合數。
- **一局長怎樣**：12 回合。每回合玩家：(1) 從自己的「機會袋」逐張抽事件籌碼（收入／支出／黑天鵝），隨時可停；累積黑天鵝值超過門檻即「爆倉」，本回合只拿一半收入；(2) 用本回合所得現金從 3 張公開「資產卡」中買 0–1 張放進袋子（下回合更容易抽到收入）或買「保險」（移除一顆黑天鵝）。勝負：12 回合後淨資產最高者勝；落後者每回合起步加成（老鼠尾巴）。
- **規模對比**：12 回合 ＜ 15 回合；資產卡約 12–15 種、事件籌碼 6 種、職業卡 3 張（決定起始袋子內容）——與「15 回合＋十幾張卡」等級相當或更小。
- **AI 對手**：一個停止門檻（例如「黑天鵝值 ≥ 5 或本回合收入 ≥ 目標就停」）加「買最貴負擔得起的資產」的貪婪購買即可有像樣對手；三個門檻＝三種難度。
- **觸控介面重點**：畫面中央一個大「再抽」鈕與一個「停」鈕，抽出籌碼以動畫飛進軌道；購買為點卡；無拖拉。同機輪流時所有資訊公開，無需遮蔽。
- **最大風險**：純推運氣若袋子構築深度不足，5 局後會覺得「都一樣」；需在 12–15 種資產卡中放入至少 3 種改變抽取規則的卡（如「抽到支出可重抽一次」）。

### 方向 B：「資產拼圖」——集合套牌與引擎構築（借 Splendor + Machi Koro + Azul）
- **借用元素**：一回合只做一件事的三選一、公開市場搶卡、引擎構築（買下的資產給永久折扣或每回合收入）、湊齊才兌換、里程碑式終局。
- **一局長怎樣**：約 15 回合（或先達成 3 個里程碑者觸發終局）。每回合玩家三選一：(1) 拿 3 種不同「資源代幣」（時間／人脈／現金）；(2) 用代幣買公開市場 12 張中的 1 張資產卡（股票／房產／副業），卡片提供永久折扣或每回合固定收入；(3) 用現金完成 1 張里程碑卡（買房、創業、退休金到位）得分。勝負：第一位完成 3 個里程碑者觸發最後一輪，總分最高者勝。
- **規模對比**：15 回合；資產卡 3 階 × 6 張＝18 張（略多於「十幾張」，可砍到 12）、里程碑卡 6 張、職業卡 4 張（起始資源不同）。等級相當。
- **AI 對手**：對每張市場卡計算「還差幾個代幣就能買」與「買了後對里程碑的貢獻」，選最小距離者；不需搜尋樹。
- **觸控介面重點**：三排市場卡＋一排代幣＋自己的資產區，全部點擊；卡片放大預覽用長按；同機輪流時全公開（保留卡改為公開）。
- **最大風險**：Splendor 型引擎在 15 回合內可能「還沒起飛就結束」，需以里程碑觸發終局而非固定回合，並把早期資產的收入調高；平衡數值須放 `src/data/` JSON 反覆調整。

### 方向 C：「機會競標」——押注時機與公開競標（借 Camel Up + For Sale + Kingdomino）
- **借用元素**：押注時機與遞減賠率、公開遞增競標與棄權軟著陸、兩階段「先買後賣」、選擇即順位。
- **一局長怎樣**：15 回合，分兩幕。第一幕（8 回合）：每回合翻開 1 張「機會卡」（一檔標的：房產／股票／事業），玩家輪流喊價或棄權，棄權者退回一半出價並拿一張較差的備選卡；同時每回合有一格「市場趨勢骰」推進，早押「本幕漲最多的類別」賠率高、晚押低。第二幕（7 回合）：每回合翻開一組「買家出價支票」，玩家依「上回合出價最低者先選」的順位挑一張手中標的賣出，支票由高到低分配給標的分數最高者。勝負：現金即分數，總額最高者勝。
- **規模對比**：15 回合；機會卡 15 張、支票卡 15 張、趨勢押注牌 4 類 × 3 張＝12 張、職業卡 3 張（起始現金不同）。等級相當。
- **AI 對手**：出價上限＝「卡片基礎價值 × 趨勢押注後的預期倍數 × 隨機保守係數」，超過就棄權；賣出階段選「當前支票最高與手中最佳標的匹配」；三種保守係數＝三種難度。
- **觸控介面重點**：「+1 加價」「棄權」兩個大按鈕，押注牌用點擊；賣出階段改為公開順序選卡（避免 For Sale 的同時暗選在同機輪流時漏資訊）。
- **最大風險**：競標對 2 人局張力不足（For Sale 原版最低 3 人）；需設計「莊家假想出價」或讓 AI 補位到 3 人；另外「趨勢押注」若賠率設計不當會讓押注比競標更賺，需模擬測試。

### 方向比較（快速看）
| | A 推運氣 | B 資產引擎 | C 競標押注 |
|---|---|---|---|
| 主要情緒 | 刺激、賭一把 | 規劃、越滾越大 | 讀人、搶時機 |
| 與財商主題契合 | 高（風險與保險） | 最高（現金流買資產） | 高（估值與出價） |
| AI 難度 | 最低 | 低 | 中 |
| 同機輪流漏資訊 | 無 | 無 | 低（改公開後） |
| 2 人可玩 | 佳 | 佳 | 弱（需 AI 補位） |
| 卡片內容量 | 最少 | 中 | 中 |

---

## 5. 附錄：完整來源清單

### 5.1 得獎資料（官方與百科）
- Spiel des Jahres 官方 2014 年度檔案：https://www.spiel-des-jahres.de/erjahr/2014/
- Spiel des Jahres 官方 2015 年度檔案：https://www.spiel-des-jahres.de/erjahr/2015/
- Spiel des Jahres 官方 2017 年度檔案：https://www.spiel-des-jahres.de/erjahr/2017/
- Spiel des Jahres 官方 2018 年度檔案：https://www.spiel-des-jahres.de/erjahr/2018/ 、 https://www.spiel-des-jahres.de/erjahr/2018/page/2/
- Spiel des Jahres 官方年度遊戲分類頁：https://www.spiel-des-jahres.de/preiskat/spiel-des-jahres/
- Spiel des Jahres 官方 Quacksalber 遊戲頁：https://www.spiel-des-jahres.de/spiele/die-quacksalber-von-quedlinburg/
- Wikipedia（英）Spiel des Jahres：https://en.wikipedia.org/wiki/Spiel_des_Jahres

### 5.2 各遊戲條目與出版社官網
- Splendor：https://en.wikipedia.org/wiki/Splendor_(game) ；https://www.spacecowboys-games.com/universe/splendor/
- Kingdomino：https://en.wikipedia.org/wiki/Kingdomino
- Azul：https://en.wikipedia.org/wiki/Azul_(board_game) ；https://www.nextmove-games.com/en/azul/azul-game/
- Machi Koro：https://en.wikipedia.org/wiki/Machi_Koro
- Camel Up：https://en.wikipedia.org/wiki/Camel_Up
- The Quacks of Quedlinburg：https://en.wikipedia.org/wiki/The_Quacks_of_Quedlinburg
- Can't Stop：https://en.wikipedia.org/wiki/Can%27t_Stop_(board_game)
- Sushi Go!：https://en.wikipedia.org/wiki/Sushi_Go! ；https://gamewright.com/product/Sushi-Go
- Love Letter：https://en.wikipedia.org/wiki/Love_Letter_(card_game)
- For Sale：https://iellogames.com/games/for-sale/ ；http://www.gamecabinet.com/rulesText/ForSale.txt
- Ticket to Ride：https://en.wikipedia.org/wiki/Ticket_to_Ride_(board_game)
- Cascadia：https://en.wikipedia.org/wiki/Cascadia_(board_game)

### 5.3 台灣市場能見度
- 新天鵝堡官網「獲獎經典」目錄：https://www.swanpanasia.com/catalog/award
- 新天鵝堡官方網店「天鵝推薦」組合：https://boardgamer.org/product-category/天鵝推薦
- PTT BoardGame「[問題] 求推薦3-4人桌遊」（2023-01-04）：https://www.ptt.cc/bbs/BoardGame/M.1672805013.A.2A8.html
- mybest 台灣 20 大桌遊排行（2025-09-22，參考 PTT／Dcard 評價；非批准網域，僅作旁證）：https://tw.my-best.com/71831
- 冒險安迪 Splendor 中文介紹（非批准網域，僅作譯名佐證）：https://andyventure.com/boardgame-splendor/
- Welcome On Board 桌遊天地 2021-11 熱賣榜（香港店，非台灣，僅記錄）：https://wobgames.net/bestseller-boardgame-21-12/

### 5.4 嘗試但不可得（見 1.3）
- BGG 各遊戲頁與 XML API、BGG browse、SdJ /en/award-winners/、Wikipedia For Sale 條目、中文 Wikipedia 年度遊戲獎、桌遊好地方排行、KTLA Kingdomino 新聞稿、reddit r/boardgames。
