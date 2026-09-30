# CLAUDE.md

## 環境事實
<!-- 安裝時由第一個 session 依 00-INSTALL.md 校準填入，禁止憑印象填 -->
<!-- 校準時間：2026-07-06｜校準方式：見 ops/00-INSTALL.md 步驟 2 -->
<!-- 2026-09-30 校準：Boss 實跑 /model 與 /effort 截圖核實，見下方 Changelog -->
- 可用模型（【實】2026-09-30 由 Boss 截圖 /model 選單核實；括號內舊 id 字串畫面未顯示，沿用先前記錄，標【推】）：
  - Sonnet 5（中／預設工作馬，目前使用中；`claude-sonnet-5`【推】）——選單另列 Sonnet 5.5 為可升級選項，本環境預設仍為 Sonnet 5
  - Opus 5.5（大／難題除錯、架構決策、第二意見；`claude-opus-5-5`【推】；大級預設一律用此，非 Fable 5.1）
  - Fable 5.1（大／另一頂級選項，需額外 usage credits；`claude-fable-5-1`【推】；**未經 Boss 當次明確同意不得指定**，大級預設一律用 Opus 5.5）
  - Haiku 4.5（小／機械批次；`claude-haiku-4-5-20251001`【推】）
  - 選單另有「More models」子選單未展開，內容未知
- effort 參數：【實】2026-09-30 Boss 截圖 /effort 核實，本環境**有**此參數（UI 為 Low↔Smarter 滑桿），先前版本記載為不支援，此為更新後的正確狀態；目前所在 session（Sonnet 5）預設值為 Low（標示 Recommended）。難題除錯、架構決策、第二意見（對應大級 Opus 5.5）調 high；機械批次（對應小級）可用 low；Opus 5.5 本身的預設值未實測（換模型會導致操作走位，Boss 已避免切換），沿用同一套「Low 為推薦預設」邏輯類推，標【推】。
- Subagent 機制：Agent 工具，`subagent_type` 參數指定類型，可用：`claude` / `general-purpose` / `Explore` / `Plan` / `claude-code-guide` / `statusline-setup`
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
   **【驗收者不修東西】** 執行驗收時（不論是你自己驗收，或你被派去驗收別人的產出）：
   - 你只回報問題，不修問題。
   - 發現錯誤 → 寫進報告 → 交回派工者決定。
   - 禁止「順手」修掉任何發現的錯誤，無論它多微小、多明顯、你多確定改法是對的。
   判定方式：字面比對。看到自己正在「驗收」→ 一律不動手改。
   完整禁令見 `ops/E-delegation-templates.md` 模板5。
4. 同一做法最多重試 2 輪。第 3 次前必須換路或升級模型，規則見 `ops/C-dispatch.md`。
5. 改任何制度檔（本檔與 ops/ 下所有檔）前先備份副本，權限分級見 `ops/F-maintenance.md`。
6. 缺關鍵資料不編造：宣告缺漏，能用合理假設續推就標【推】推進，互斥解讀就停下問使用者，判準見 `ops/D-judgment.md`。
7. 長產物落檔傳路徑，不在對話中貼全文。
8. 一個 session 一個主任務；發現範圍膨脹，先收斂或開新 session。
9. 凡修改 `index.html` 並 commit，必須同步更新 `APP_VERSION` 常數為該次 commit 的實際時間（格式 `YYYY/MM/DD HH:MM`）。此為 Boss 判斷網頁版本新舊的依據，漏更新會顯示錯誤版本時間。

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

## Changelog
2026-09-30 Opus 5.5 校準模型表與 effort 參數（Opus 5.5 上線後更新）
2026-09-30 補註 Fable 5.1 額度限制
