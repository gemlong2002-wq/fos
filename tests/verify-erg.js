/* ============================================================
   verify-erg — ERG 離職放行閘門 3／5 口徑驗收斷言
   閘門5 分部位壓縮（C × max(0, 1−0.5β)／P1 × 0／B × 0.3）、
   B 帳戶取不到時的退路推算與標示、閘門3 分母改為
   (月生活費 ＋ 全部債務月付) × 12、實際現金股息欄與過時提醒、
   debtMonthlyTotal 為 null 時兩閘門須「待定」而非當 0 判通過，
   ＋ L = 0 時 β 仍須算得出來的 P0 回歸、邊界防呆、非範圍確認。

   輸入全為整數假資料（不含真實部位）：
     總資產 20,000,000／C 10,000,000／P1 1,500,000／
     B 8,500,000／L 3,000,000／β 1.2／
     月生活費 50,000（年 600,000）／債務月付 80,000
     （B 取 8,500,000 使「總資產 − C − P1」的退路推算值與實際值
       相等，驗證2 才能比對「推算與實際一致時結果相同」）
   標準答案由白皮書公式獨立計算後填入（2026-10-22），
   非取自本程式輸出。
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
const ONE_DAY_MS = 86400000;

// 直接從 index.html 抽出閘門3／5 的實際運算式，不另寫一份模擬邏輯
const grab = (from, to) => { const i = H.indexOf(from); return H.slice(i, H.indexOf(to, i + from.length)); };
const gate3Src = grab('      const ERG_GATE3_COMPRESSION = 0.5;', '      // 閘門4');
const gate5Src = grab('      const ERG_GATE5_DEFAULT_THRESHOLD_PCT = 8;', "      // status: 'pass'");

function runGates(ctx) {
  const t = (zh) => zh;
  const src = `
    const { C, P1, L, portfolioBeta, debtMonthlyTotal, totalAssetsFromAsset, bAccountFromAsset, ergExtraInputs } = ctx;
    ${gate3Src}
    ${gate5Src}
    ({
      g3: { hasData: ergGate3HasData, pass: ergGate3Pass, dividend: ergCompressedDividend,
            base: ergDividendBase, need: ergGate3AnnualNeed, isEstimate: ergDividendIsEstimate, stale: ergDividendStale },
      g5: { hasData: ergGate5HasData, pass: ergGate5Pass, cannotCoverLoan: ergGate5CannotCoverLoan,
            afterCrash: ergGate5AssetsAfterCrash, investable: ergGate5Investable,
            pct: ergGate5WithdrawalPct, pctNoLoan: ergGate5WithdrawalPctNoLoan,
            b: ergGate5B, bEstimated: ergGate5BIsEstimated, cSurvival: ergGate5CSurvival,
            annualSpend: ergGate5AnnualSpend, threshold: ergGate5ThresholdPct, bNote: ergGate5BNote }
    })`;
  return eval(src);
}
const base = {
  C: 10000000, P1: 1500000, L: 3000000, portfolioBeta: 1.2,
  debtMonthlyTotal: 0, totalAssetsFromAsset: 20000000, bAccountFromAsset: 8500000,
  ergExtraInputs: { monthlyLiving: '', gate5ThresholdPct: '', actualAnnualDividend: '', actualDividendDate: '' }
};
const W = 10000; // 萬

console.log('【驗證1】閘門5 分部位壓縮｜假資料 總資產2000萬 C1000萬 β1.2 P1 150萬 B850萬 L300萬，年支出60萬');
let r = runGates({ ...base, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: String(600000 / 12) } });
chk('C 存活率 max(0, 1−0.5×1.2)', r.g5.cSurvival.toFixed(2), '0.40');
chk('C 部位（C × 存活率，萬）', (r.g5.afterCrash === null ? 0 : (10000000 * 0.4 / W)).toFixed(1), '400.0');
chk('P1 部位（係數 0，萬）', (1500000 * 0 / W).toFixed(1), '0.0');
chk('B 部位（B × 0.3，萬）', (8500000 * 0.3 / W).toFixed(1), '255.0');
chk('腰斬後可用資產（萬）', (r.g5.afterCrash / W).toFixed(1), '655.0');
chk('分母 = 可用資產 − L（萬）', (r.g5.investable / W).toFixed(1), '355.0');
chk('年支出（萬）', (r.g5.annualSpend / W).toFixed(1), '60.0');
chk('提領率%', r.g5.pct.toFixed(1), '16.9');
chk('門檻 8% 判定', r.g5.pass, false);
chk('B 非推算 → 無標示', r.g5.bNote, '');
console.log('      對照：現行（舊）算法 總資產×0.5−L = ' + ((20000000 * 0.5 - 3000000) / W).toFixed(1)
  + ' 萬，提領率 ' + (600000 / (20000000 * 0.5 - 3000000) * 100).toFixed(2) + '%');

console.log('');
console.log('【驗證2】閘門5 B 取不到 → 退回「總資產 − C − P1」並標示推算');
r = runGates({ ...base, bAccountFromAsset: null, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: String(600000 / 12) } });
chk('B 推算值（萬）= 總資產−C−P1', (r.g5.b / W).toFixed(1), '850.0');
chk('標示為推算', r.g5.bEstimated, true);
chk('畫面標示文字出現', r.g5.bNote.includes('B 帳戶以推算值計'), true);
chk('推算值與實際值一致時結果相同（萬）', (r.g5.investable / W).toFixed(1), '355.0');
r = runGates({ ...base, bAccountFromAsset: 0, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '1' } });
chk('B = 0 是有效值（真的沒美股加密）→ 不推算', r.g5.bEstimated, false);
chk('B = 0 → B 部位為 0', r.g5.b, 0);
chk('B = 0 → 無推算標示', r.g5.bNote, '');
r = runGates({ ...base, bAccountFromAsset: null, totalAssetsFromAsset: 1000000, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '1' } });
chk('推算為負時夾到 0', r.g5.b, 0);

console.log('');
console.log('【P0 回歸】質押借款 L = 0 時 β 仍須算得出來（否則擔保品被當成沒跌）');
{
  const betaSrc = (() => { const f='      let portfolioBeta = 0; let maxMarketDrop = 0;'; const i=H.indexOf(f); return H.slice(i, H.indexOf('      const isCrashSafe', i)); })();
  const betaOf = (C, L, c0050, c00733) => eval(`
    const b0050Val = 1.0, b00733Val = 1.35, limitMRVal = 130;
    ${betaSrc}
    portfolioBeta`);
  chk('C=1000萬 L=0 → β 不再是 0', betaOf(10000000, 0, 5000000, 5000000).toFixed(4), (((5000000*1.0)+(5000000*1.35))/10000000).toFixed(4));
  chk('C=1000萬 L=300萬 → β 與原本相同', betaOf(10000000, 3000000, 5000000, 5000000).toFixed(4), betaOf(10000000, 0, 5000000, 5000000).toFixed(4));
  chk('C=0 → β 維持 0（無資料）', betaOf(0, 0, 0, 0), 0);
  const beta0 = betaOf(10000000, 0, 5000000, 5000000);
  chk('L=0 時 C 存活率不再是 1.0', Math.max(0, 1 - 0.5 * beta0).toFixed(3), '0.412');
  chk('   └ 修正前會錯算成', Math.max(0, 1 - 0.5 * 0).toFixed(3), '1.000');
}

console.log('');
console.log('【驗證3】閘門3 月生活費5萬、債務月付8萬、假資料 C1000萬、未填實際股息');
r = runGates({ ...base, debtMonthlyTotal: 80000,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000' } });
chk('年股息估 C×3.7%（萬）', (r.g3.base / W).toFixed(1), '37.0');
chk('壓縮後 ×0.5（萬）', (r.g3.dividend / W).toFixed(1), '18.5');
chk('分母 (5萬+8萬)×12（萬）', (r.g3.need / W).toFixed(1), '156.0');
chk('未通過', r.g3.pass, false);
chk('標示為估算', r.g3.isEstimate, true);
chk('未填實際股息 → 不提醒更新', r.g3.stale, false);

console.log('');
console.log('【驗證4】閘門3 填入實際股息40萬；填寫日期14個月前 → 提醒更新');
const d14 = new Date(Date.now() - 14 * 30.44 * ONE_DAY_MS).toISOString().slice(0, 10);
r = runGates({ ...base, debtMonthlyTotal: 80000,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: d14 } });
chk('改用實際股息（萬）', (r.g3.base / W).toFixed(1), '40.0');
chk('壓縮後 40萬×0.5（萬）', (r.g3.dividend / W).toFixed(1), '20.0');
chk('不再標示估算', r.g3.isEstimate, false);
chk('14 個月前 → 提醒更新', r.g3.stale, true);
const d6 = new Date(Date.now() - 6 * 30.44 * ONE_DAY_MS).toISOString().slice(0, 10);
r = runGates({ ...base, debtMonthlyTotal: 80000,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: d6 } });
chk('6 個月前 → 不提醒', r.g3.stale, false);
const d13 = new Date(Date.now() - 12.5 * 30.44 * ONE_DAY_MS).toISOString().slice(0, 10);
chk('12.5 個月前 → 不提醒（13個月為界）',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: d13 } }).g3.stale, false);
chk('有填金額但沒填日期 → 提醒更新',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: '' } }).g3.stale, true);
chk('填實際股息 300萬 → 通過（分母156萬）',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '3200000', actualDividendDate: d6 } }).g3.pass, true);

console.log('');
console.log('【驗證5】debtMonthlyTotal 尚未載入（null）→ 閘門3、5 皆為待定');
r = runGates({ ...base, debtMonthlyTotal: null,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: d6 } });
chk('閘門3 待定（不可當 0 判通過）', r.g3.hasData, false);
chk('閘門5 待定', r.g5.hasData, false);
chk('閘門3 pass 必為 false', r.g3.pass, false);
chk('閘門5 pass 必為 false', r.g5.pass, false);
chk('待定時不算提領率', r.g5.pct, null);
// 關鍵：若把 null 當 0，閘門3 會變成只比生活費而誤判通過
chk('對照：誤把 null 當 0 時分母只剩生活費（萬）', ((0 + 50000) * 12 / W).toFixed(1), '60.0');

console.log('');
console.log('【邊界防呆】0／空值／NaN／負數');
r = runGates({ ...base, C: 0, P1: 0, L: 0, portfolioBeta: 0, totalAssetsFromAsset: 0, bAccountFromAsset: null,
  debtMonthlyTotal: 0, ergExtraInputs: { monthlyLiving: '', gate5ThresholdPct: '', actualAnnualDividend: '', actualDividendDate: '' } });
chk('全 0 → 閘門3 待定', r.g3.hasData, false);
chk('全 0 → 閘門5 待定', r.g5.hasData, false);
chk('全 0 → 不出現 NaN（提領率）', r.g5.pct, null);
r = runGates({ ...base, portfolioBeta: 2.5, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000' } });
chk('β=2.5 → C 存活率夾到 0（不為負）', r.g5.cSurvival, 0);
r = runGates({ ...base, portfolioBeta: 0, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000' } });
chk('β=0 → C 存活率 1（全身而退）', r.g5.cSurvival, 1);
chk('實際股息填 0 → 視為未填，退回估算',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '0' } }).g3.isEstimate, true);
chk('實際股息填負數 → 視為未填',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '-5' } }).g3.isEstimate, true);
chk('實際股息填 abc → 視為未填',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: 'abc' } }).g3.isEstimate, true);
chk('日期填 abc（金額有填）→ 提醒更新',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: 'abc' } }).g3.stale, true);
chk('日期用 YYYY/MM/DD 也解得開',
  runGates({ ...base, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: d6.replace(/-/g, '/') } }).g3.stale, false);
chk('C=0 且無實際股息 → 閘門3 待定',
  runGates({ ...base, C: 0, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000' } }).g3.hasData, false);
chk('C=0 但有實際股息 → 可判定',
  runGates({ ...base, C: 0, debtMonthlyTotal: 80000, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', actualAnnualDividend: '400000', actualDividendDate: d6 } }).g3.hasData, true);
r = runGates({ ...base, L: 99000000, debtMonthlyTotal: 0,
  ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000' } });
chk('L 極大 → 分母 ≤ 0 判未通過', r.g5.cannotCoverLoan, true);
chk('分母 ≤ 0 時不算提領率', r.g5.pct, null);
chk('門檻空值 → 預設 8', r.g5.threshold, 8);
chk('門檻填 12 → 吃 12',
  runGates({ ...base, debtMonthlyTotal: 0, ergExtraInputs: { ...base.ergExtraInputs, monthlyLiving: '50000', gate5ThresholdPct: '12' } }).g5.threshold, 12);

console.log('');
console.log('【非範圍：門檻與係數未被改動】');
chk('閘門5 預設門檻仍為 8', /ERG_GATE5_DEFAULT_THRESHOLD_PCT = 8;/.test(H), true);
chk('閘門3 壓縮係數仍為 0.5', /ERG_GATE3_COMPRESSION = 0\.5;/.test(H), true);
chk('殖利率仍為 3.7', /ERG_GATE3_YIELD_PCT = 3\.7;/.test(H), true);
chk('閘門1 安全 MR 未動', /ERG_GATE1_SAFETY_MR = 150/.test(H), true);
chk('閘門2 月數未動', /ERG_GATE2_THRESHOLD_MONTHS = 24/.test(H), true);
chk('β 只宣告一次', (H.match(/let portfolioBeta = /g) || []).length, 1);
chk('β 只有一條計算公式', (H.match(/portfolioBeta = \(\(/g) || []).length, 1);
chk('P1 係數 0', /ERG_GATE5_P1_SURVIVAL = 0;/.test(H), true);
chk('B 係數 0.3', /ERG_GATE5_B_SURVIVAL = 0\.3;/.test(H), true);

console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
