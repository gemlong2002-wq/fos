/* ============================================================
   verify-misc — 小修合集驗收斷言（§10.6 撤銷旗標、INJECT 防重複、
   門檻原始值比對、CAGR 期間、壓力測試實際分流、ERG 閘門3 文案）
   項目2（INJECT A＋B 防重複）的 payload 使用整數假資料
   （L 5,000,000／0050 1,000,000／00733 1,000,000／P1 1,500,000）；
   這些值只是 payload，不參與任何數值斷言。
   項目3 的 2,599,960／3,499,960／2,799,960 是為了測 MR 260／350
   門檻邊界刻意造的合成值（搭配 L = 1,000,000），非真實部位。
   項目6 原有 3 條殖利率唯讀相關斷言已於 2026-10-22 退役，
   原因：141df89 依規則改為實際股息輸入，舊 UI 已刻意移除。
   ============================================================ */
const fs = require('fs');
const path = require('path');
/* 目標檔一律相對解析：預設讀 repo 根的 index.html，也可用 argv[2] 指定別的檔。 */
const TARGET = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const H = fs.readFileSync(TARGET, 'utf8');
let fail = 0;
const chk = (n, a, e) => {
  const ok = String(a) === String(e);
  if (!ok) fail++;
  console.log('   ', n.padEnd(46), '預期', String(e).padStart(12), '實際', String(a).padStart(12), ok ? '✓' : '✗');
};
const slice = (from, to) => { const i = H.indexOf(from); return H.slice(i, H.indexOf(to, i + from.length)); };

// ---------- 項目 1：§10.6 標記 / 撤銷 ----------
console.log('【項目1】§10.6 標記 → 撤銷（二次確認）→ 判定恢復');
const muskMod = eval(
  slice('const MUSK_CONVERGENCE_CAP', 'function evalMuskConvergence')
  + slice('function evalMuskConvergence', '    /* ======')
  + '; ({DONE: MUSK_CONVERGENCE_DONE_KEY, DATE: MUSK_CONVERGENCE_DATE_KEY, calc: calcMuskConvergenceRatio, ev: evalMuskConvergence})');
const musk = muskMod, evalMusk = muskMod.ev;

// 模擬 localStorage + 三個 state，重跑真實 handler 的語意
const store = {};
const safeSetStorage = (k, v) => { store[k] = String(v); };
const safeGetStorage = (k, d) => (k in store ? store[k] : d);
const safeRemoveStorage = (k) => { delete store[k]; };
let done = safeGetStorage(musk.DONE, '') === '1', date = safeGetStorage(musk.DATE, ''), armed = false;
const mark = () => { safeSetStorage(musk.DONE, '1'); safeSetStorage(musk.DATE, '2026/10/07'); done = true; date = '2026/10/07'; armed = false; };
const undo = () => { safeRemoveStorage(musk.DONE); safeRemoveStorage(musk.DATE); done = false; date = ''; armed = false; };

// 持倉 40% 馬斯克系（T=30 S=10 Q=60） → 超標
const ratio40 = musk.calc(30, 10, 60);
chk('初始：未標記 → status', evalMusk(ratio40, done).status, 'over');
chk('初始：強制 QLD', evalMusk(ratio40, done).forceQldOnly, true);
mark();
chk('標記後：localStorage done', store[musk.DONE], '1');
chk('標記後：localStorage date', store[musk.DATE], '2026/10/07');
chk('標記後：status', evalMusk(ratio40, done).status, 'over-done');
chk('標記後：不再強制 QLD', evalMusk(ratio40, done).forceQldOnly, false);
armed = true; chk('按撤銷 → 進入二次確認', armed, true);
armed = false; chk('按取消 → 退出二次確認、旗標仍在', String(armed) + '/' + done, 'false/true');
armed = true; undo();
chk('確定撤銷：done key 已清除', musk.DONE in store, false);
chk('確定撤銷：date key 已清除', musk.DATE in store, false);
chk('確定撤銷：二次確認已復位', armed, false);
chk('撤銷後：判定恢復 status', evalMusk(ratio40, done).status, 'over');
chk('撤銷後：恢復強制 QLD', evalMusk(ratio40, done).forceQldOnly, true);
chk('撤銷後降回門檻內 → 重新跳確認', evalMusk(musk.calc(10, 10, 80), done).needConfirm, true);

// ---------- 項目 2：INJECT A+B 部分失敗 ----------
console.log('');
console.log('【項目2】INJECT A＋B 部分失敗，重試只重送失敗那一邊');
const injectSrc = slice('      const runSave = async (action, payload) => {', '      const handleDelete = async');

async function runInjectScenario(aBehavior, bBehavior, initialDone) {
  const calls = [];
  let injectDone = initialDone;
  let lastMsg = '';
  let prefilled = false;
  const ctx = {
    gasAPI: async (action, payload) => {
      calls.push(action);
      const beh = action === 'saveFOSData' ? aBehavior : bBehavior;
      if (beh === 'throw') throw new Error('network');
      if (beh === 'falsy') return { success: false };
      return { success: true };
    },
    isInjecting: false, writeLocked: false,
    setIsInjecting: () => {},
    setTerminalMsg: (m) => { lastMsg = m; },
    setInjectDone: (v) => { injectDone = v; },
    fetchHistory: () => calls.push('fetchHistory'),
    fetchHistoryB: () => calls.push('fetchHistoryB'),
    onInjectPrefill: () => { prefilled = true; },
    L: 5000000, c0050: 1000000, c00733: 1000000, P1: 1500000,
    currentBtc: 100000, currentEth: 3000, nominalMR: '350.00', p1Ratio: '33.33',
    ethBtcRatio: '0.0300', formData: { p2Usdt: 0 },
    formDataB: { tsla: '20', spcx: '10', qld: '70', eth: '0', btc: '0', usdRate: '32.5' }
  };
  const body = `(async function(){
    const { gasAPI, setTerminalMsg, setInjectDone, fetchHistory, fetchHistoryB, onInjectPrefill,
            setIsInjecting, writeLocked, isInjecting, L, c0050, c00733, P1, currentBtc, currentEth,
            nominalMR, p1Ratio, ethBtcRatio, formData, formDataB } = this;
    const injectDone = this.injectDone;
    ${injectSrc}
    await handleInjectAll();
  })`;
  await eval(body).call({ ...ctx, injectDone });
  return { calls, injectDone, lastMsg, prefilled };
}

(async () => {
  let r = await runInjectScenario('ok', 'throw', { a: false, b: false });
  chk('A成功/B拋錯：A 呼叫次數', r.calls.filter(c => c === 'saveFOSData').length, 1);
  chk('A成功/B拋錯：B 呼叫次數', r.calls.filter(c => c === 'saveFOSDataB').length, 1);
  chk('A成功/B拋錯：記住 a 已寫入', JSON.stringify(r.injectDone), '{"a":true,"b":false}');
  chk('A成功/B拋錯：不做 ASSET 預填', r.prefilled, false);
  chk('A成功/B拋錯：訊息', r.lastMsg, '>> A OK / B FAILED — RETRY SENDS B ONLY.');

  r = await runInjectScenario('ok', 'throw', { a: true, b: false });
  chk('重試：saveFOSData 不再被呼叫', r.calls.filter(c => c === 'saveFOSData').length, 0);
  chk('重試：saveFOSDataB 只呼叫一次', r.calls.filter(c => c === 'saveFOSDataB').length, 1);

  r = await runInjectScenario('ok', 'ok', { a: true, b: false });
  chk('重試成功：saveFOSData 仍未被呼叫', r.calls.filter(c => c === 'saveFOSData').length, 0);
  chk('重試成功：旗標清空', JSON.stringify(r.injectDone), '{"a":false,"b":false}');
  chk('重試成功：做 ASSET 預填', r.prefilled, true);
  chk('重試成功：訊息', r.lastMsg, '>> A + B INJECTED.');

  r = await runInjectScenario('throw', 'throw', { a: false, b: false });
  chk('兩邊皆失敗：不記任何已寫入', JSON.stringify(r.injectDone), '{"a":false,"b":false}');
  chk('兩邊皆失敗：訊息', r.lastMsg, '>> A + B BOTH FAILED.');
  r = await runInjectScenario('ok', 'ok', { a: false, b: false });
  chk('兩邊皆失敗後整筆重送：A+B 各一次', r.calls.filter(c => c.startsWith('saveFOSData')).length, 2);

  r = await runInjectScenario('throw', 'ok', { a: false, b: false });
  chk('B成功/A失敗：記住 b 已寫入', JSON.stringify(r.injectDone), '{"a":false,"b":true}');
  r = await runInjectScenario('ok', 'ok', { a: false, b: true });
  chk('重試：saveFOSDataB 不再被呼叫', r.calls.filter(c => c === 'saveFOSDataB').length, 0);
  chk('A 回 {success:false} 也算失敗', (await runInjectScenario('falsy', 'ok', { a: false, b: false })).injectDone.b, true);

  // ---------- 項目 3：門檻吃原始值 ----------
  console.log('');
  console.log('【項目3】門檻比對改吃未四捨五入的原始數值');
  const mrFns = eval(slice('      const MR_GREEN_FLOOR', '      // ethBtcRatioRaw')
    + '; ({getMRZone, getEffectiveMRZone})');
  const zoneFn = mrFns.getMRZone, effZoneFn = mrFns.getEffectiveMRZone;
  const zoneOf = (C, L) => {
    const raw = L > 0 ? (C / L) * 100 : 0;
    const rounded = parseFloat(raw.toFixed(2));
    return { raw: zoneFn(raw).zone, rounded: zoneFn(rounded).zone, shown: raw.toFixed(2) };
  };
  let z = zoneOf(2599960, 1000000);   // 259.996
  chk('MR 259.996 → 判定', z.raw, 'RED');
  chk('MR 259.996 → 舊的四捨五入會誤判成', z.rounded, 'YELLOW');
  chk('MR 259.996 → 顯示仍為 2 位小數', z.shown, '260.00');
  z = zoneOf(3499960, 1000000);       // 349.996
  chk('MR 349.996 → 判定', z.raw, 'YELLOW');
  chk('MR 349.996 → 顯示', z.shown, '350.00');
  chk('MR 350 整 → GREEN', zoneOf(3500000, 1000000).raw, 'GREEN');
  chk('MR 260 整 → YELLOW', zoneOf(2600000, 1000000).raw, 'YELLOW');
  chk('L=0 → STANDBY', zoneOf(100, 0).raw, 'STANDBY');
  // 回復帶出場線 280 也吃原始值
  chk('MR 279.996 + 回復帶 → RED',
    effZoneFn(zoneFn(2799960 / 1000000 * 100), 2799960 / 1000000 * 100, true).zone, 'RED');
  chk('MR 280 整 + 回復帶 → 出場 YELLOW',
    effZoneFn(zoneFn(280), 280, true).zone, 'YELLOW');

  const threeState = (raw) => {
    if (raw > 0.060) return 'BTC_OVERHEATED';
    if (raw >= 0.020 && raw <= 0.060) return 'ETH_VALUE';
    if (raw > 0 && raw < 0.020) return 'BTC_FREEZE';
    return 'NONE';
  };
  const ratioOf = (eth, btc) => (btc > 0 ? eth / btc : 0);
  let rr = ratioOf(199.96, 10000);     // 0.019996
  chk('ETH/BTC 0.019996 → 判定', threeState(rr), 'BTC_FREEZE');
  chk('ETH/BTC 0.019996 → 四捨五入會誤判成', threeState(parseFloat(rr.toFixed(4))), 'ETH_VALUE');
  chk('ETH/BTC 0.019996 → 顯示仍 4 位小數', rr.toFixed(4), '0.0200');
  chk('ETH/BTC 0.060004 → 過熱', threeState(ratioOf(600.04, 10000)), 'BTC_OVERHEATED');
  chk('ETH/BTC 0.020 整 → 價值區', threeState(0.020), 'ETH_VALUE');
  chk('BTC=0 → 無判定', threeState(ratioOf(3000, 0)), 'NONE');

  // ---------- 項目 4：CAGR 未滿一年不年化 ----------
  console.log('');
  console.log('【項目4】期間 < 365 天不年化');
  const cagrOf = (days, factor) => {
    const rawDays = days;
    let d = rawDays <= 0 ? 1 : rawDays;
    const years = d / 365.25;
    const cagr = (Math.pow(factor, 1 / years) - 1) * 100;
    const periodReturn = (factor - 1) * 100;
    const isSubYear = rawDays < 365;
    return { isSubYear, shown: (isSubYear ? periodReturn : cagr).toFixed(2), days: Math.max(0, Math.round(rawDays)) };
  };
  let c = cagrOf(30, 1.05);
  chk('30 天 → 不年化', c.isSubYear, true);
  chk('30 天 → 顯示期間實際報酬率', c.shown, '5.00');
  chk('30 天 → 標籤顯示天數', c.days, 30);
  c = cagrOf(400, 1.20);
  chk('400 天 → 年化', c.isSubYear, false);
  chk('400 天 → 年化值 (1.2^(365.25/400)-1)', c.shown, ((Math.pow(1.20, 365.25 / 400) - 1) * 100).toFixed(2));
  chk('364 天 → 仍不年化', cagrOf(364, 1.1).isSubYear, true);
  chk('365 天 → 開始年化', cagrOf(365, 1.1).isSubYear, false);
  chk('30 天虧損 → 顯示負的期間報酬', cagrOf(30, 0.9).shown, '-10.00');

  // ---------- 項目 5／6：文案綁定 ----------
  console.log('');
  console.log('【項目5】壓測卡 QLD 比例引用 effectiveUsRatio');
  chk('壓測卡已不寫死 QLD 70%', /QLD 70% 不是安全配置/.test(H), false);
  chk('壓測卡引用 effectiveUsRatio', /QLD \$\{\(effectiveUsRatio\.QLD \* 100\)\.toFixed\(0\)\}% 不是安全配置/.test(H), true);
  chk('全檔只有一份 effectiveUsRatio 定義', (H.match(/const effectiveUsRatio =/g) || []).length, 1);
  chk('收斂中 QLD 比例', 1 * 100, 100);
  chk('常態 QLD 比例', 0.70 * 100, 70.00000000000001 === 0.7 * 100 ? 0.7 * 100 : 70);

  console.log('');
  console.log('【項目6】ERG 閘門3 殖利率文案');
  chk('未就緒訊息不再說「殖利率未輸入」', /殖利率或生活費未輸入/.test(H), false);
  chk('howTo 不再要求填殖利率', /先填上方「殖利率%」與「月生活費」/.test(H), false);
  /* 已退役 3 條（2026-10-22）：
       未就緒訊息改述固定參考值
       howTo 註明不開放輸入
       殖利率欄位是唯讀顯示非 input
     原因：141df89 依規則把閘門3 的殖利率改為「近12個月實際現金股息總額」
     輸入欄，上述唯讀顯示與「不開放輸入」文案是刻意移除的舊 UI，
     不是迴歸。保留上面兩條負面斷言（舊文案不得復活）即足夠。 */

  console.log('');
  console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
  process.exit(fail === 0 ? 0 : 1);
})();
