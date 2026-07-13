# B. CLAUDE.md 重寫：模板 + 遷移規則

> 【實】我沒有你的原始 CLAUDE.md，無法直接重寫。本檔提供：
> (1) 可直接使用的新 CLAUDE.md 模板（下方分隔線之後，整段複製即可用）
> (2) 遷移舊內容的判定規則
> 遷移前先備份：`cp CLAUDE.md CLAUDE.md.bak-$(date +%Y%m%d)`

## 遷移規則（舊 CLAUDE.md 的每一條規則過這四關）

1. **過時？** 指涉已不存在的檔案、工具、模型 → 刪。不確定是否過時 → 移入 `ops/graveyard.md` 附日期，不直接刪。
2. **重複？** 同義規則只留寫得最具體的那條（有觸發條件 + 動作 + 判準的優先）。
3. **抽象？**「保持高品質」「小心謹慎」這類無法判定遵守與否的 → 刪，或改寫成可判定形式（範例：「小心改動」→「改超過 3 個檔前，先列出檔案清單與各檔改動一句話摘要」）。
4. **太長？** 超過 10 行的主題內容 → 抽成 `ops/` 下獨立檔，CLAUDE.md 只留一行路由。

**寫法原則（弱模型需要明確，強模型需要留白）**：每條規則 = 觸發條件 + 動作 + 判準。禁止只有形容詞的規則。CLAUDE.md 本體目標 ≤ 60 行：它每個 session 都載入，每多一行是永久稅。

---

# CLAUDE.md（模板：以下整段可直接作為新 CLAUDE.md）

## 環境事實
<!-- 安裝時由第一個 session 依 00-INSTALL.md 校準填入，禁止憑印象填 -->
- 可用模型：{{校準後填入，例如 opus / sonnet / haiku 別名或完整 model string}}
- Subagent 機制：{{Task tool？自訂 agents？填實際名稱}}
- 作業檔案根目錄：`.claude/ops/`

## 鐵律 0｜最高優先，絕對禁止，無例外

以下操作，無論任何情況，一律禁止自行執行，必須由 Boss 本人拍板：
1. `git push`（**任何分支**，不只 main——staging/preview/功能分支同樣禁止）
2. **任何部署操作**——不限「正式環境」：staging、preview、測試環境的部署動作（`vercel deploy`、`wrangler deploy`、任何會把程式碼送上任何伺服器/CDN/平台的指令）一樣禁止
3. `git reset --hard` / `git push --force`（含 `--force-with-lease`）/ `git push origin --delete`（刪遠端分支）/ `git clean -fd` / `git filter-branch` / 任何會丟失 commit 歷史、或刪除遠端分支的操作
4. 修改、刪除、或覆寫任何後端——**不限 GAS**，包含但不限於 Supabase、Cloudflare Workers、Vercel Functions、資料庫 schema、任何雲端服務設定
5. 實作任何 Boss「沒有明確要求」的功能——即使你認為它有用、順手、或是必要的前置

判定方式：字面比對，不做推論。
- 看到 `git push`（任何分支）→ 停下，問 Boss。
- 看到「部署」「deploy」，不管目標是不是正式環境 → 停下，問 Boss。
- 看到任何 force / reset / clean / filter-branch / 刪遠端分支的指令 → 停下，問 Boss。
- 要改任何後端（不管是不是 GAS）→ 停下，問 Boss。
- 想加一個 Boss 沒說要的功能 → 停下，問 Boss。

**本鐵律0五項不適用鐵律6的「合理假設續推」**：鐵律6處理一般任務中的資訊缺口，鐵律0處理這五類高風險動作——五項一律停下問，不得用「合理假設」代替拍板。

**這不是判斷題。** 以下理由一律無效：
- 「這個 push 很安全」
- 「Boss 應該會希望我這樣做」
- 「這是完成任務的必要步驟」
- 「我已經驗證過沒問題了」
- 「前一個 session 說可以」

**允許的**：`git commit`（本機）、本機測試、產出報告。
**commit 完就停。push 由 Boss 本人做。**

歷史事故：曾有 session 在無關任務中擅自實作前端密碼閘門並 push，已 revert。此鐵律因該事故而立。

## 鐵律（違反即為錯誤，上限 10 條）
1. 主對話不下場，依類型派工：
   - 讀檔：預估 >3 個檔或 >300 行 → `Explore`（純定位/讀取）或 `general-purpose`（需綜合判斷）
   - 掃 repo / 搜尋程式碼：任何全域搜尋 → `Explore`
   - 抓網頁 / 查文件：任何需要讀回全文的查詢 → `general-purpose`
   - 批次改檔：≥2 個檔的同型修改 → `general-purpose`
   - 跑測試 / build：輸出可能超過 50 行者 → `general-purpose`
   - 架構規劃 / 方案設計：需產出實作計畫或多方案比較 → `Plan`
   門檻以下的小操作主對話可自己做。主對話只進結論，細節見 `ops/C-dispatch.md` §1。
2. 派工必附三件套：目標與動機、驗收條件、回報格式。缺一不派。模板見 `ops/E-delegation-templates.md`。
3. 驗證不自驗：宣稱完成前，驗收由 fresh-context agent 執行，依產物類型分派：
   - 檔案類產物（寫入/修改）→ fresh-context read-back，**優先 `Explore`**（`Explore` 並非唯讀，見 `ops/C-dispatch.md` §6 說明，靠派工指令明文約束不得寫入）
   - 程式碼類產物 → 跑測試或實跑，中級模型執行
   - 高風險判斷（架構、對外承諾、不可逆操作）→ 第二意見或多方案評審，中或大級模型
   「優先 `Explore`」只適用於檔案類產物，不適用於程式碼或高風險判斷。
4. 同一做法最多重試 2 輪。第 3 次前必須換路或升級模型，規則見 `ops/C-dispatch.md`。
5. 改任何制度檔（本檔與 ops/ 下所有檔）前先備份副本，權限分級見 `ops/F-maintenance.md`。
6. 缺關鍵資料不編造：宣告缺漏，能用合理假設續推就標【推】推進，互斥解讀就停下問使用者，判準見 `ops/D-judgment.md`。
7. 長產物落檔傳路徑，不在對話中貼全文。
8. 一個 session 一個主任務；發現範圍膨脹，先收斂或開新 session。

## 路由表（做 X 之前，先讀 Y）
| 情境 | 讀 |
|---|---|
| 要派工 / 選模型 / 決定 subagent_type | `ops/C-dispatch.md` |
| 不確定該升級、該問人、還是算完成 | `ops/D-judgment.md` |
| 要寫派工 prompt | `ops/E-delegation-templates.md` |
| 要修改制度檔 / 踩坑後記教訓 | `ops/F-maintenance.md` |
| Session 開始，任務複雜或不熟 | `ops/G-letter.md`（一次即可） |

## 教訓登記
踩坑後，一行式追加到 `ops/lessons.md`，格式見 `ops/F-maintenance.md`。開始高風險任務前先掃該檔標題。
