# 現金護城河（CASH MOAT）後端遷移 — 給 Boss 的操作手冊

這份文件是給**非工程師**看的操作步驟。前端（index.html）已經改好、已經 commit 在本機，
但**後端（GAS）這次完全沒有動、也還沒部署**——GAS 那邊要 Boss 自己貼、自己部署。

在 GAS 還沒部署新程式碼之前，現金護城河功能會照常運作（用瀏覽器本機儲存），
不會壞、不會白畫面，只是還沒開始存到後端而已。

---

## 【貼之前的核對】—— 一定要先做這一步

打開你平常編輯 GAS（Google Apps Script）的編輯器，確認兩件事：

1. **有沒有一個叫 `saveCryptoMatrix` 的函式？**（在左側檔案列表裡搜尋 `saveCryptoMatrix` 這個字）
2. **`doPost` 這個函式裡面，有沒有一長串 `case 'xxx':` 這樣的程式碼？**（像是 `case 'getCryptoMatrix': ...`、`case 'saveFOSData': ...` 這種）

- **兩個都找得到** → 可以放心照下面步驟貼上去。
- **只要有一個找不到** → **請先停下來，不要貼**，把畫面截圖回報給負責這件事的人（不要自己猜著貼，貼錯位置可能讓整個後端壞掉）。

---

## 【貼什麼、貼哪裡】

總共要貼兩塊東西：**兩個新函式**、**兩行新的 case**。

### 第一塊：兩個新函式，貼在 `getCryptoMatrix` 函式的正下方

找到 `getCryptoMatrix` 這個函式的**結尾**（它會有自己的一對大括號 `{ ... }`，找到最後那個 `}`），
在那個 `}` 的下面，直接貼上以下這一整段（**照抄，不要改任何字**）：

```js
// === 現金護城河 (Cash Moat) ===
function saveCashMoat(cash, monthlyDebt, months) {
  PropertiesService.getUserProperties().setProperties({
    'fos_cash': String(cash),
    'fos_monthlyDebt': String(monthlyDebt),
    'fos_moatMonths': String(months)
  });
  return { success: true };
}

function getCashMoat() {
  const props = PropertiesService.getUserProperties();
  return {
    success: true,
    cash: props.getProperty('fos_cash') || '0',
    monthlyDebt: props.getProperty('fos_monthlyDebt') || '0',
    moatMonths: props.getProperty('fos_moatMonths') || '6'
  };
}
```

**示意（貼之前 → 貼之後）：**

貼之前，你會看到類似這樣（示意，實際內容以你畫面上的為準）：

```
function getCryptoMatrix() {
  ...（既有內容，不要動）...
}

function 下一個函式(...) {
```

貼之後，中間會多出剛剛那一整段：

```
function getCryptoMatrix() {
  ...（既有內容，不要動）...
}

// === 現金護城河 (Cash Moat) ===
function saveCashMoat(cash, monthlyDebt, months) {
  ...
}

function getCashMoat() {
  ...
}

function 下一個函式(...) {
```

### 第二塊：兩行 case，貼在 `doPost` 裡 `case 'getCryptoMatrix':` 那一行的下面

在 `doPost` 函式裡面，找到這一行（文字要一模一樣，或非常接近）：

```
case 'getCryptoMatrix': result = getCryptoMatrix(); break;
```

在**它的正下方**，插入這兩行（**照抄，不要改任何字**）：

```js
case 'saveCashMoat': result = saveCashMoat(args[0], args[1], args[2]); break;
case 'getCashMoat': result = getCashMoat(); break;
```

**示意（貼之前 → 貼之後）：**

貼之前：
```
    case 'getCryptoMatrix': result = getCryptoMatrix(); break;
    case 'saveCryptoMatrix': result = saveCryptoMatrix(args[0], args[1], args[2]); break;
```

貼之後：
```
    case 'getCryptoMatrix': result = getCryptoMatrix(); break;
    case 'saveCashMoat': result = saveCashMoat(args[0], args[1], args[2]); break;
    case 'getCashMoat': result = getCashMoat(); break;
    case 'saveCryptoMatrix': result = saveCryptoMatrix(args[0], args[1], args[2]); break;
```

（放的位置不用完全精確在哪一行下面，重點是要放在 `switch` 裡面、跟其他 `case` 同一層，不要放到 `switch` 外面。）

---

## 【怎麼部署】

貼完、存檔之後，GAS 程式碼要「重新部署」才會真的生效（只存檔不算，網址還是跑舊版程式碼）。

我不確定你目前 GAS 專案精確的部署選單位置跟按鈕名稱（不同帳號/介面可能長得不太一樣），
保守建議依照 Apps Script 一般部署流程操作：

1. 存檔（Ctrl+S / Cmd+S，或編輯器裡的存檔圖示）。
2. 找「管理部署」（Manage deployments）或「部署」（Deploy）選單。
3. 選擇「編輯」現有的部署（不要建立全新的部署，網址要保持不變，前端目前打的網址是固定寫死在 index.html 裡的）。
4. 版本選「新版本」（New version），然後部署。

如果你在畫面上找不到對應的選單字樣，先截圖回報，不要亂點，避免建立出一個新網址導致前端打不到。

---

## 【怎麼驗證成功】

1. 打開現金護城河（CASH MOAT）卡片，隨便輸入一組數字，例如 CASH 填 `100000`、MONTHLY_DEBT 填 `5000`。
2. **重新整理頁面**（F5），確認數字還在——這一步只能證明本機儲存有效，還不能證明後端真的存到了。
3. **關鍵驗證：換一個瀏覽器，或用「無痕視窗 / InPrivate」打開同一個網址**，看剛剛輸入的數字**是不是也在**。
   - 如果無痕視窗/另一個瀏覽器**也看得到**你剛輸入的數字 → 代表真的是後端 GAS 存的，遷移成功。
   - 如果無痕視窗/另一個瀏覽器**是空的、或是舊的預設值** → 代表現在還是只有本機瀏覽器的 localStorage 在生效，GAS 那邊沒有真的存進去（可能是還沒部署成功、或程式碼貼錯位置），需要回頭檢查。

這個「換瀏覽器測試」是唯一能區分「本機儲存」跟「後端真的存了」的方法，一定要做這一步。

---

## 【出問題怎麼退】

前端這次改成「雙寫」機制：每次你在畫面上輸入數字，**永遠會先存一份到瀏覽器本機**，
然後才「順便」試著存一份到 GAS 後端。這代表：

- 如果 GAS 那邊部署後發現有問題（例如畫面出現奇怪的錯誤、或存的數字跑掉），
  你可以直接到 GAS 的「管理部署」裡面，把版本**回滾（rollback）到貼這段程式碼之前的舊版本**。
- 前端完全不需要跟著改、不需要重新部署前端。只要 GAS 那邊呼叫 `saveCashMoat`/`getCashMoat`
  失敗（因為舊版本沒有這兩個 action 了），前端會自動偵測失敗，安靜地退回去用瀏覽器本機儲存，
  現金護城河功能照常可以用，不會壞、不會白畫面、也不會跳錯誤訊息干擾你。

簡單說：這次的改動是「能加分但不會扣分」——GAS 沒部署、部署錯、之後要退版，
現金護城河這個功能本身都不會受影響，最多就是「數字換瀏覽器看不到」而已。
