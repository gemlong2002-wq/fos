# 00. 安裝與適配協議

> 執行者：你環境裡的第一個 session（Sonnet 級即可）。逐步執行，全程遵守本套制度自身的規則（備份、read-back、驗證不自驗）。

## 步驟 1：放檔

```
mkdir -p .claude/ops
# 將 A/C/D/E/F/G 六個檔放入 .claude/ops/（B 與本檔留在手邊，用完可歸檔）
```
路由表中 `ops/xxx.md` 均指 `.claude/ops/xxx.md`。若你的 harness 慣例不同（如全域 ~/.claude/），統一改路徑並全域 grep `ops/` 校正引用。

## 步驟 2：校準環境事實（禁止憑印象）

1. 查實際可用模型與 subagent 機制：Claude Code 用 `/model`、`/agents` 或查設定檔；其他 harness 查各自文件。
2. 將結果填入新 CLAUDE.md 的「環境事實」區，並替換 `C-dispatch.md` §3 表格的範例名。
3. 確認是否支援 effort/thinking 參數；不支援則在 C §3 註記「本環境無此參數，忽略相關指示」。

## 步驟 3：遷移 CLAUDE.md

1. `cp CLAUDE.md CLAUDE.md.bak-$(date +%Y%m%d)`
2. 按 `B-CLAUDE.template.md` 的四關判定逐條遷移舊規則，套用模板產出新 CLAUDE.md。
3. 建立空的 `.claude/ops/lessons.md` 與 `.claude/ops/graveyard.md`。

## 步驟 4：補跑對抗審查（建檔 session 欠下的債）

派一個 fresh-context subagent（中級模型），prompt 用 `E-delegation-templates.md` 模板 5，產出物 = 全部制度檔，驗收條件如下：
- 找出互相矛盾的規則（例：兩檔對同一情境給不同門檻）。
- 找出不存在的路徑、指令、工具名（逐一實際驗證）。
- 找出弱模型會誤讀的模糊語句（判準：一個 Haiku 級模型讀後能否唯一地決定動作）。
- 回報格式：問題清單（檔案:行號 + 問題 + 建議修法），只判定不動手。
主對話依回報修正（遵守 F 的修改程序），修完再派一輪，直到回報為空或僅剩使用者裁決項。

## 步驟 5：向使用者回報

一頁：校準結果（模型清單等）、遷移摘要（刪了幾條/併了幾條/抽出幾檔）、對抗審查發現與修正、待使用者裁決事項。

## 完成判定

- [ ] 新 CLAUDE.md ≤ 60 行且路由可達（每個引用檔 read-back 存在）
- [ ] C §3 模型表為實查結果
- [ ] 對抗審查至少跑滿一輪且發現已處理
- [ ] 舊 CLAUDE.md 備份存在
