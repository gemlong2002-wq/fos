/* ============================================================
   verify-rescue — v15.3 §4.3.1 救火雙路徑／§4.3.2 160% 保證執行線／
   §4.3.3 斷頭線 130% 與追繳面板／§4.8 崩盤抵抗 β 1.3 主數字
   全部使用合成假資料（非真實部位），預期值依公式手推，見各段註解。
   ============================================================ */
const fs = require('fs');
const path = require('path');
const TARGET = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const H = fs.readFileSync(TARGET, 'utf8');
let fail = 0;
const chk = (n, a, e) => {
  const ok = String(a) === String(e);
  if (!ok) fail++;
  console.log('   ', n.padEnd(46), '預期', String(e).padStart(14), '實際', String(a).padStart(14), ok ? '✓' : '✗');
};
const near = (n, a, e, tol) => {
  const ok = Number.isFinite(a) && Math.abs(a - e) <= tol;
  if (!ok) fail++;
  console.log('   ', n.padEnd(46), '預期', String(e).padStart(14), '實際', String(a).padStart(14), ok ? '✓' : '✗');
};
const slice = (from, to) => { const i = H.indexOf(from); if (i < 0) throw new Error('找不到 ' + from); return H.slice(i, H.indexOf(to, i + from.length)); };

const M = eval(slice('    const LIQUIDATION_MR = 130;', '    function allocateExternalFunds')
  + '; ({ LIQUIDATION_MR, GUARANTEE_LINE_MR, CRASH_BETA_MAIN, CRASH_BETA_MEASURED, MR_COMPARE_LEVELS, calcLineDrop, calcRescuePaths, calcGuaranteeLine160, calcCrashResistance, needsMarginCallPanel })');

/* 假資料 S：C = 6,000,000（0050 3,000,000／00733 3,000,000）、L = 3,000,000、P1 = 600,000、大盤 20,000
   β = (3,000,000×1.0 + 3,000,000×1.35) ÷ 6,000,000 = 1.175
   MR = 6,000,000 ÷ 3,000,000 = 200%（🔴，已低於 260%） */
const C = 6000000, L = 3000000, P1 = 600000, IDX = 20000;
const beta = (3000000 * 1.0 + 3000000 * 1.35) / C;
const base = { C, L, P1, beta, redMR: 260, targetMR: 280 };

console.log('【A】組合 β 與常數');
near('β = 1.175', beta, 1.175, 1e-9);
chk('斷頭線常數 130', M.LIQUIDATION_MR, 130);
chk('保證執行線 160', M.GUARANTEE_LINE_MR, 160);

console.log('');
console.log('【B／C／D／E】260% 應執行線（已在線下 → d 取 0）');
/* d 原值 = (1 − 2.6 × 0.5) ÷ 1.175 < 0 → below、d = 0；C′ = 6,000,000、P1′ = 600,000
   死線 = 3,000,000 × (1 − 260/280) = 3,000,000 × 20/280 = 214,285.714
   可動用 = 600,000 − 214,285.714 = 385,714.286
   甲：X = 2.8×3,000,000 − 6,000,000 = 2,400,000；執行 385,714.286；MR = 6,385,714.286 ÷ 3,000,000 = 212.857%
   乙：R = 3,000,000 − 6,000,000/2.8 = 857,142.857；執行 385,714.286；MR = 6,000,000 ÷ 2,614,285.714 = 229.508% */
const r260 = M.calcRescuePaths({ ...base, lineMR: 260, fullP1: false });
chk('已低於 260%', r260.below, true);
chk('d 取 0', r260.d, 0);
near('C′ = C', r260.cAfter, 6000000, 1e-6);
near('P1′ = P1', r260.p1After, 600000, 1e-6);
near('死線 214,285.71', r260.deathLine, 214285.714, 0.01);
near('可動用 385,714.29', r260.available, 385714.286, 0.01);
near('甲 所需 2,400,000', r260.a.need, 2400000, 0.01);
near('甲 實際執行 = 可動用', r260.a.exec, 385714.286, 0.01);
near('甲 執行後 MR 212.857%', r260.a.mrAfter, 212.857, 0.001);
chk('甲 仍 < 280% → 已完成提示', r260.a.done, true);
near('乙 所需 857,142.86', r260.b.need, 857142.857, 0.01);
near('乙 執行後 MR 229.508%', r260.b.mrAfter, 229.508, 0.001);
chk('乙 仍 < 280% → 已完成提示', r260.b.done, true);

console.log('');
console.log('【F／G／H】160% 保證執行線');
/* d₁₆₀ = (1 − 1.6 × 3,000,000 ÷ 6,000,000) ÷ 1.175 = 0.2 ÷ 1.175 = 0.170213
   大盤 = 20,000 × (1 − 0.170213) = 16,595.74；倍數 = 1 − 2 × 0.170213 = 0.659574
   C′ = 1.6L = 4,800,000；P1′ = 600,000 × 0.659574 = 395,744.68（160% 情境全數可動用）
   甲：X = 8,400,000 − 4,800,000 = 3,600,000；MR = 5,195,744.68 ÷ 3,000,000 = 173.191%
   乙：R = 3,000,000 − 4,800,000/2.8 = 1,285,714.29；MR = 4,800,000 ÷ 2,604,255.32 = 184.314% */
const g = M.calcGuaranteeLine160({ C, L, beta, index: IDX });
near('d₁₆₀ 17.0213%', g.d * 100, 17.0213, 0.0001);
near('大盤點位 16,595.74', g.indexLevel, 16595.74, 0.01);
near('P1 觸價倍數 0.659574', g.p1Mult, 0.659574, 1e-6);
const r160 = M.calcRescuePaths({ ...base, lineMR: 160, fullP1: true });
near('C′ = 4,800,000', r160.cAfter, 4800000, 0.01);
near('P1′ 395,744.68', r160.p1After, 395744.68, 0.01);
near('可動用 = P1′ 全數', r160.available, r160.p1After, 1e-9);
near('甲 所需 3,600,000', r160.a.need, 3600000, 0.01);
near('甲 執行後 MR 173.191%', r160.a.mrAfter, 173.191, 0.001);
near('乙 所需 1,285,714.29', r160.b.need, 1285714.29, 0.01);
near('乙 執行後 MR 184.314%', r160.b.mrAfter, 184.314, 0.001);
chk('大盤點位缺 → null', M.calcGuaranteeLine160({ C, L, beta, index: 0 }).indexLevel, null);

console.log('');
console.log('【線上情境】C = 10,000,000、L = 3,000,000、P1 = 1,000,000、β = 1.2');
/* d₂₆₀ = (1 − 2.6 × 0.3) ÷ 1.2 = 0.22 ÷ 1.2 = 0.183333；C′ = 10,000,000 × (1 − 0.22) = 7,800,000
   P1′ = 1,000,000 × (1 − 0.366667) = 633,333.33；可動用 = 633,333.33 − 214,285.71 = 419,047.62
   甲：X = 8,400,000 − 7,800,000 = 600,000 → 執行 419,047.62 → MR = 8,219,047.62 ÷ 3,000,000 = 273.968%
   乙：R = 3,000,000 − 7,800,000/2.8 = 214,285.71 → 足額執行 → MR = 7,800,000 ÷ 2,785,714.29 = 280% */
const up = M.calcRescuePaths({ C: 10000000, L: 3000000, P1: 1000000, beta: 1.2, redMR: 260, targetMR: 280, lineMR: 260, fullP1: false });
chk('尚未觸發', up.below, false);
near('d 18.3333%', up.d * 100, 18.3333, 0.0001);
near('C′ 7,800,000', up.cAfter, 7800000, 0.01);
near('可動用 419,047.62', up.available, 419047.62, 0.01);
near('甲 執行後 MR 273.968%', up.a.mrAfter, 273.968, 0.001);
near('乙 足額執行 = 所需', up.b.exec, up.b.need, 1e-9);
near('乙 執行後 MR 280%', up.b.mrAfter, 280, 1e-6);
chk('資料不足 → unknown', M.calcRescuePaths({ C: 0, L, P1, beta, redMR: 260, targetMR: 280, lineMR: 260 }).status, 'unknown');

console.log('');
console.log('【E】崩盤抵抗：到 130% 的可承受跌幅');
/* 擔保品可跌 = 1 − 1.3 × 3,000,000 ÷ 6,000,000 = 0.35；β 1.3 → 26.923%；β 1.15 → 30.435% */
const cr = M.calcCrashResistance(C, L);
near('主數字（β 1.3）26.923%', cr.main, 26.923, 0.001);
near('實測參考（β 1.15）30.435%', cr.measured, 30.435, 0.001);
chk('已低於斷頭線 → safe false', M.calcCrashResistance(3800000, 3000000).safe, false);
chk('對照數字 450／370', M.MR_COMPARE_LEVELS.join('/'), '450/370');

console.log('');
console.log('【I】追繳面板門檻（MR < 130%）');
chk('MR 125 → 顯示', M.needsMarginCallPanel(125), true);
chk('MR 129.99 → 顯示', M.needsMarginCallPanel(129.99), true);
chk('MR 130 整 → 不顯示', M.needsMarginCallPanel(130), false);
chk('MR 0（未輸入）→ 不顯示', M.needsMarginCallPanel(0), false);
const panel = slice('const marginCallPanel = marginCallActive', ') : null;');
chk('兩選項：4.10 失業準備金', panel.includes("'4.10 失業準備金（追繳例外）'"), true);
chk('兩選項：5.5 主動賣出核心擔保品', panel.includes("'5.5 主動賣出核心擔保品還款（自行選擇標的與數量）'"), true);
chk('面板不加推薦／排序字樣', /推薦|建議|優先|第一|首選/.test(panel), false);

console.log('');
console.log('【C／D／L】靜態檢查');
chk('mrLimit 已移除', /mrLimit/.test(H), false);
chk('LIMIT 改顯示常數', H.includes('{LIQUIDATION_MR}%</div>'), true);
chk('救火流程不再引用 §5.5 防禦轉換', /5\.5 防禦轉換/.test(H), false);
chk('不再「嚴禁買入擔保品」（與路徑甲衝突）', /嚴禁買入擔保品/.test(H), false);
chk('全檔不以 120% 為 MR 計算基準', /120\s*\/\s*100|1\.2\s*\*\s*L\b|MR[^\n]{0,6}120\s*%/.test(H), false);
chk('路徑選擇記在 localStorage', H.includes("safeSetStorage('fos_rescuePath', rescuePath)"), true);
chk('路徑甲待辦兩步', H.includes("'今日手動買入 0050'") && H.includes("'T+2 入帳後申請增加擔保品'"), true);
chk('成交後回報秘書', H.includes('成交後回報秘書，記入衝動日誌。'), true);
chk('乙註明不得全額清償', H.includes('不得全額清償單筆借款，否則退券'), true);

console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
