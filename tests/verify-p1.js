/* ============================================================
   verify-p1 — P1 雙向計算卡驗收斷言
   Part 1 設質增貸（calcP1Rebalance）／Part 2 觸價單（calcRescueBudget）
   ＋ 天平判定、錨定、整張捨去、缺值退路、邊界防呆、非範圍確認。

   輸入全為整數假資料（不含真實部位）：
     Part 2  C 10,000,000／L 3,000,000／β 1.2／P1 1,000,000
             （675L 600,000 ＋ 631L 400,000，現價 20／30）
             → MR 333%，落在 YELLOW 帶、觸發跌幅 d > 0
     Part 1  C 15,000,000／L 3,000,000／P1 1,500,000
             （0050 7,000,000 ＋ 00733 8,000,000）
             → MR 500% ≥ 350%、P1 = 50% L ≥ 40%，可賣額 > 微利門檻
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
const near = (n, a, e, tol) => {
  const ok = Number.isFinite(a) && Math.abs(a - e) <= tol;
  if (!ok) fail++;
  console.log('   ', n.padEnd(46), '預期', ('≈' + e).padStart(12), '實際',
    String(typeof a === 'number' ? Math.round(a * 100) / 100 : a).padStart(12), ok ? '✓' : '✗');
};
const grab = (from, to) => { const i = H.indexOf(from); return H.slice(i, H.indexOf(to, i + from.length)); };

// 把模組層那整段（常數＋純函式）連同它依賴的 DEATH_LINE_RATIO / ONE_DAY_MS /
// startOfLocalDayUTC / P1_TARGET_RATIO / calcDeleverageRepayment 一起抽出來實跑
const deps = 'const DEATH_LINE_RATIO = ' + /const DEATH_LINE_RATIO = ([\d.]+);/.exec(H)[1] + ';'
  + 'const ONE_DAY_MS = 86400000;'
  + grab('    function startOfLocalDayUTC(ts) {', '    function parseMrHistory')
  + grab('    const P1_TARGET_RATIO', '    /* ======')
  + grab('    /* ===================================================================\n       P1 雙向計算卡', '    // §4.3 拉回 280% 需償還的本金')
  + grab('    function calcDeleverageRepayment(L, C) {', '    function allocateExternalFunds');

const M = eval(deps + `; ({
  calcP1Rebalance, calcRescueBudget, pickBalanceTarget, isBalanceAnchored,
  splitByMarketValue, amountToLots, priceAgeDays, calcDeleverageRepayment,
  K: { TRIGGER_MR: P1_FUEL_ROD_TRIGGER_MR, UPPER: P1_TRIGGER_UPPER_RATIO,
       RELEND: P1_RELEND_TARGET_MR, FORTRESS: P1_FORTRESS_TARGET_MR,
       MICRO: P1_MICRO_PROFIT_FLOOR, TAX: ETF_SELL_TAX_RATE, LOT: SHARES_PER_LOT,
       STALE: PRICE_STALE_DAYS, ANCHOR: BALANCE_ANCHOR_TOLERANCE,
       DEATH: DEATH_LINE_RATIO, DELEV: DELEVERAGE_TARGET_MR, P1T: P1_TARGET_RATIO }
})`);
const K = M.K;
const RULE = 2.6;                       // = MR_RED_CEILING / 100
const BROKER = 0.001425;                // IPO_BROKER_FEE_RATE
const costRate = K.TAX + BROKER * 1;    // feeDiscount 預設 1

console.log('【常數核對】');
chk('燃料棒觸發 MR', K.TRIGGER_MR, 350);
chk('P1 觸發上緣', K.UPPER, 0.4);
chk('增貸後目標 MR', K.RELEND, 3.8);
chk('築城牆模式（預留）', K.FORTRESS, 4.8);
chk('微利門檻預設', K.MICRO, 100000);
chk('ETF 證交稅 0.1%', K.TAX, 0.001);
chk('1 張股數', K.LOT, 1000);
chk('現價過時天數', K.STALE, 3);
chk('錨定容許帶寬', K.ANCHOR, 0.05);
chk('P1 目標沿用既有 1/3', K.P1T, 1 / 3);
chk('死線沿用既有 7.14%', K.DEATH, 0.0714);
chk('拉回目標沿用既有 2.8', K.DELEV, 2.8);

console.log('');
console.log('【驗證 A】Part 2｜假資料 C=10,000,000 L=3,000,000 β=1.2 P1=1,000,000（675L 60萬／631L 40萬）');
let r = M.calcRescueBudget({
  C: 10000000, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: RULE,
  p1Val675: 600000, p1Val631: 400000, price675: 20, price631: 30
});
chk('status', r.status, 'ok');
near('觸發跌幅 d', r.d * 100, 18.3333, 0.05);
near("C′（屆時擔保品）", r.cAfter, 7800000, 1);
chk("C′ 恆等於 2.6 × L（規則線定義）", Math.round(r.cAfter), Math.round(RULE * 3000000));
near('需償還本金', r.repayNeed, 214285.71, 100);
near('屆時 P1', r.p1After, 633333.33, 150);
near('殘存 P1', r.p1Remain, 419047.62, 200);
near('死線', r.deathLine, 198900, 100);
chk('P1 夠還款', r.canRepay, true);
chk('死線檢核通過', r.deathOk, true);
near('00675L 觸價 = 20 × (1−2d)', r.trigger675, 20 * (1 - 2 * r.d), 0.001);
near('00631L 觸價 = 30 × (1−2d)', r.trigger631, 30 * (1 - 2 * r.d), 0.001);
near('675L 分配 = 需償還 × 60/100（依假輸入市值比）', r.sell675, r.repayNeed * 6 / 10, 1);
near('631L 分配 = 需償還 × 40/100（依假輸入市值比）', r.sell631, r.repayNeed * 4 / 10, 1);
chk('675L 張數（無條件進位）', r.lots675, Math.ceil(r.sell675 / (r.trigger675 * 1000)));
chk('631L 張數（無條件進位）', r.lots631, Math.ceil(r.sell631 / (r.trigger631 * 1000)));
chk('兩檔分配金額相加 = 需償還', Math.round(r.sell675 + r.sell631), Math.round(r.repayNeed));

console.log('');
console.log('【驗證 B】Part 1｜假資料 C=15,000,000 L=3,000,000（MR 500%）P1=1,500,000（50% L）');
let b = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, c0050: 7000000, c00733: 8000000,
  sellCostRate: costRate, microFloor: K.MICRO
});
chk('state', b.state, 'ok');
chk('P1 目標 = L/3', Math.round(b.p1Target), 1000000);
near('可賣出（扣成本前）', b.sellable, 500000, 0.5);
near(`賣出成本（金額 × ${(costRate * 100).toFixed(4)}%）`, b.sellCost, 1212.5, 0.5);
near('設質後新 C', b.newC, 15498787.5, 300);
near('可新增借款 B', b.borrowCap, 1078628.29, 200);
near('借款後 MR = 380%', b.mrAfterBorrow, 380, 0.01);
near('P1 補至 (L＋B)÷3', b.p1TargetAfter, 1359542.76, 150);
near('P1 補額', b.p1TopUp, 359542.76, 150);
near('餘額走 80/20', b.growthRemainder, 719085.53, 150);
near('   └ 美股 80%', b.growthRemainder * 0.8, 575268.42, 150);
near('   └ 加密 20%', b.growthRemainder * 0.2, 143817.11, 150);
chk('買入標的＝市值較低者（0050）', b.buyTarget, '0050');
near('買入金額 = 實際可賣 − 賣出成本', b.buyAmount, 498787.5, 0.5);
chk('買入張數：現價未填 → null', b.buyLots, null);
let b2 = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, c0050: 7000000, c00733: 8000000,
  price0050: 50, sellCostRate: costRate, microFloor: K.MICRO
});
chk('買入張數：0050 現價 50 → 捨去', b2.buyLots, Math.floor(b2.buyAmount / 50000));
chk('買入張數用 buyTarget 那一檔的現價（0050=50）', b2.buyLots, Math.floor(b2.buyAmount / 50000));
let b3 = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, c0050: 8000000, c00733: 7000000,
  price0050: 50, price00733: 25, sellCostRate: costRate, microFloor: K.MICRO
});
chk('00733 較低時買入張數改用 00733 現價 25', b3.buyLots, Math.floor(b3.buyAmount / 25000));
chk('   └ 買入標的也跟著換', b3.buyTarget, '00733');
chk('借款上限用 新C÷3.8−L（非全買擔保品那條）',
  Math.round(b.borrowCap), Math.round(Math.max(0, b.newC / 3.8 - 3000000)));
chk('P1 補額 ＋ 餘額 = 借款上限', Math.round(b.p1TopUp + b.growthRemainder), Math.round(b.borrowCap));
chk('無現價時 P1 賣完剛好停在 L/3', Math.round(b.p1AfterSell), 1000000);
// [P4] 回歸：整張捨去後 P1 停在 L/3 之上，補 P1 必須以實際剩餘為基準
let b4 = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, c0050: 7000000, c00733: 8000000,
  p1Val675: 900000, p1Val631: 600000, price675: 20, price631: 30,
  sellCostRate: costRate, microFloor: K.MICRO
});
near('整張捨去後實際賣出', b4.actualSell, 480000, 0.5);
near('賣完後剩餘 P1', b4.p1AfterSell, 1020000, 0.5);
near('補 P1 = 新目標 − 實際剩餘（非新舊目標之差）', b4.p1TopUp, 337792.63, 0.5);
chk('   └ 不等於舊式的 B/3（會高估）', Math.round(b4.p1TopUp) === Math.round(b4.borrowCap / 3), false);
chk('補 P1 ＋ 餘額 仍 = 借款上限', Math.round(b4.p1TopUp + b4.growthRemainder), Math.round(b4.borrowCap));
chk('補 P1 不超過借款上限（夾限真的有用）', b4.p1TopUp <= b4.borrowCap, true);
/* 夾限何時真的生效：P1 低於目標時（state='none'，Part 1 不顯示但函式可被這樣呼叫），
   補 P1 的缺口 (L+B)/3 − P1 會大於可借額度 B → 全部拿去補，餘額 0 */
let b5 = M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 0, sellCostRate: 0, microFloor: K.MICRO });
near('   夾限情境：借款上限 B', b5.borrowCap, 15000000 / 3.8 - 3000000, 1);
chk('   └ 缺口大於額度', b5.p1TargetAfter - b5.p1AfterSell > b5.borrowCap, true);
chk('   └ 補 P1 被夾到額度上限', Math.round(b5.p1TopUp), Math.round(b5.borrowCap));
chk('   └ 餘額為 0', Math.round(b5.growthRemainder), 0);
chk('   └ （此情境 state 為 none，Part 1 不會顯示）', b5.state, 'none');

console.log('');
console.log('【驗證 C】Part 1 顯示條件（P1 = 38% L／4.9 觸發 → 不顯示並列出原因）');
// 顯示條件在元件內組，這裡直接驗同一組判定式的真值
const fuelOpen = (mrRaw, L, P1, quickDrop) => {
  const unmet = [];
  if (!(L > 0)) unmet.push('L');
  if (!(mrRaw >= K.TRIGGER_MR)) unmet.push('MR');
  if (!(L > 0 && P1 >= L * K.UPPER)) unmet.push('P1上緣');
  if (quickDrop) unmet.push('4.9');
  return { open: unmet.length === 0, unmet };
};
let f = fuelOpen(400, 3000000, 3000000 * 0.38, false);
chk('P1 = 38% L → 不顯示', f.open, false);
chk('   └ 原因', f.unmet.join(','), 'P1上緣');
f = fuelOpen(400, 3000000, 3000000 * 0.45, true);
chk('4.9 觸發 → 不顯示', f.open, false);
chk('   └ 原因', f.unmet.join(','), '4.9');
f = fuelOpen(349.99, 3000000, 3000000 * 0.45, false);
chk('MR 349.99% → 不顯示（吃未四捨五入值）', f.open, false);
chk('   └ 原因', f.unmet.join(','), 'MR');
chk('MR 350 整 + P1 40% 整 + 無 4.9 → 顯示', fuelOpen(350, 3000000, 1200000, false).open, true);
chk('L = 0 → 不顯示', fuelOpen(0, 0, 0, false).open, false);
chk('   └ 原因（三條同時列出）', fuelOpen(0, 0, 0, false).unmet.join(','), 'L,MR,P1上緣');

console.log('');
console.log('【驗證 D】可賣金額三態');
let d1 = M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 1050000, sellCostRate: costRate, microFloor: K.MICRO });
chk('可賣 50,000 → micro（不建議執行）', d1.state, 'micro');
near('   └ 金額', d1.sellable, 50000, 0.5);
let d2 = M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 1000000, sellCostRate: costRate, microFloor: K.MICRO });
chk('P1 = L/3 → none（無可賣出金額）', d2.state, 'none');
chk('   └ 金額為 0', Math.round(d2.sellable), 0);
chk('P1 < L/3 → none', M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 900000, sellCostRate: costRate, microFloor: K.MICRO }).state, 'none');
chk('可賣 100,000 整 → ok（門檻含等於）',
  M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 1100000, sellCostRate: costRate, microFloor: K.MICRO }).state, 'ok');
chk('門檻改 30,000 → 50,000 變 ok',
  M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 1050000, sellCostRate: costRate, microFloor: 30000 }).state, 'ok');

console.log('');
console.log('【驗證 E】現價未填 → 張數需輸入現價，金額照常');
let e1 = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, c0050: 7000000, c00733: 8000000,
  p1Val675: 900000, p1Val631: 600000, price675: '', price631: '',
  sellCostRate: costRate, microFloor: K.MICRO
});
chk('兩檔市值有填、現價空 → lotsKnown false', e1.lotsKnown, false);
chk('現價空 → lots675 為 null', e1.lots675, null);
chk('現價空 → lots631 為 null', e1.lots631, null);
chk('lotsKnown = false', e1.lotsKnown, false);
near('金額照常（退回理論可賣額）', e1.actualSell, 500000, 0.5);
near('後續試算照常（新 C）', e1.newC, 15498787.5, 300);
let e2 = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, p1Val675: '', p1Val631: '',
  price675: 20, price631: 30, sellCostRate: costRate, microFloor: K.MICRO
});
chk('兩檔市值未填 → 張數拿不到', e2.lotsKnown, false);
chk('   └ 張數也拿不到', String(e2.lots675) + '/' + String(e2.lots631), 'null/null');
near('   └ 金額仍照常', e2.actualSell, 500000, 0.5);
let e3 = M.calcP1Rebalance({
  C: 15000000, L: 3000000, P1: 1500000, p1Val675: 900000, p1Val631: 600000,
  price675: 20, price631: 30, sellCostRate: costRate, microFloor: K.MICRO
});
chk('現價＋市值都有 → 換算整張', e3.lotsKnown, true);
chk('   └ 675L 張數（捨去）', e3.lots675, 15);
chk('   └ 631L 張數（捨去）', e3.lots631, 6);
chk('   └ 實際可賣 ≤ 理論可賣（捨去後變小）', e3.actualSell <= e3.sellable, true);

console.log('');
console.log('【輔助函式】');
chk('天平：0050 較低 → 買 0050', M.pickBalanceTarget(100, 200), '0050');
chk('天平：00733 較低 → 買 00733', M.pickBalanceTarget(200, 100), '00733');
chk('天平：相等 → 買 00733（與 v15 同一判定）', M.pickBalanceTarget(100, 100), '00733');
chk('錨定：500萬 vs 500萬 → 已錨定', M.isBalanceAnchored(5000000, 5000000), true);
chk('錨定：500萬 vs 525萬（5%）→ 已錨定', M.isBalanceAnchored(5000000, 5250000), true);
chk('錨定：500萬 vs 530萬（>5%）→ 未錨定', M.isBalanceAnchored(5000000, 5300000), false);
chk('錨定：皆 0 → 未錨定', M.isBalanceAnchored(0, 0), false);
chk('錨定：空字串 → 未錨定', M.isBalanceAnchored('', ''), false);
chk('張數：現價 0 → null', M.amountToLots(100000, 0, 'floor'), null);
chk('張數：金額 0 → 0 張', M.amountToLots(0, 20, 'floor'), 0);
chk('張數：19,999 / 20 元 → 捨去 0 張', M.amountToLots(19999, 20, 'floor'), 0);
chk('張數：20,001 / 20 元 → 進位 2 張', M.amountToLots(20001, 20, 'ceil'), 2);
chk('拆分：市值相加 0 → ok:false', M.splitByMarketValue(1000, 0, 0).ok, false);
chk('拆分：金額 0 → ok:false', M.splitByMarketValue(0, 100, 100).ok, false);
chk('拆分：負市值視為 0', M.splitByMarketValue(1000, -5, 100).v631, 1000);
chk('現價日期：未填 → null', M.priceAgeDays('', Date.now()), null);
chk('現價日期：亂填 → null', M.priceAgeDays('abc', Date.now()), null);
chk('現價日期：今天 → 0 天', M.priceAgeDays(new Date().toISOString().slice(0, 10), Date.now()), 0);
chk('現價日期：4 天前 → 4 天（> 3 會提示）',
  M.priceAgeDays(new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), Date.now()), 4);

console.log('');
console.log('【邊界防呆】0／空值／NaN／L=0／P1=0');
chk('Part1 全 0 → none', M.calcP1Rebalance({ C: 0, L: 0, P1: 0, sellCostRate: costRate }).state, 'none');
chk('Part1 L=0 → 借款上限 0', M.calcP1Rebalance({ C: 0, L: 0, P1: 0, sellCostRate: costRate }).borrowCap, 0);
chk('Part1 L=0 → 新 MR 不為 NaN', M.calcP1Rebalance({ C: 100, L: 0, P1: 0, sellCostRate: costRate }).newMR, 0);
chk('Part1 ctx 全空不崩潰', M.calcP1Rebalance({}).state, 'none');
chk('Part1 P1=0 → none', M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 0, sellCostRate: costRate }).state, 'none');
chk('Part1 NaN 輸入 → none', M.calcP1Rebalance({ C: NaN, L: NaN, P1: NaN, sellCostRate: NaN }).state, 'none');
chk('Part1 成本率空 → 視為 0，不產生 NaN',
  Math.round(M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 1500000, sellCostRate: '' }).newC), 15500000);
chk('Part1 微利門檻填負數 → 回預設 10 萬',
  M.calcP1Rebalance({ C: 15000000, L: 3000000, P1: 1050000, sellCostRate: costRate, microFloor: -5 }).state, 'micro');
chk('Part2 C=0 → unknown', M.calcRescueBudget({ C: 0, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: RULE }).status, 'unknown');
chk('Part2 L=0 → unknown', M.calcRescueBudget({ C: 10000000, L: 0, P1: 1000000, beta: 1.2, ruleLineRatio: RULE }).status, 'unknown');
chk('Part2 β=0 → unknown（不除以 0）', M.calcRescueBudget({ C: 10000000, L: 3000000, P1: 1000000, beta: 0, ruleLineRatio: RULE }).status, 'unknown');
chk('Part2 ruleLine=0 → unknown', M.calcRescueBudget({ C: 10000000, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: 0 }).status, 'unknown');
chk('Part2 ctx 全空 → unknown', M.calcRescueBudget({}).status, 'unknown');
chk('Part2 unknown 時 d 為 null（不印 NaN）', M.calcRescueBudget({}).d, null);
// MR 已低於 260%：C/L = 2.5 < 2.6
let below = M.calcRescueBudget({ C: 7500000, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: RULE });
chk('Part2 MR 250% → below（立即執行）', below.status, 'below');
chk('   └ d ≤ 0', below.d <= 0, true);
chk('   └ 不輸出還款金額', below.repayNeed, null);
// d > 50% → 正2 歸零
let deep = M.calcRescueBudget({ C: 30000000, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: RULE });
chk('d > 50% → 屆時 P1 夾到 0（不為負）', deep.p1After, 0);
{
  const z = M.calcRescueBudget({ C: 30000000, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: RULE, price675: 20, p1Val675: 600000, p1Val631: 400000 });
  chk('   └ zeroed 旗標為 true', z.zeroed, true);
  chk('   └ 觸價不輸出 0.00 而是 null', z.trigger675, null);
  chk('   └ 張數也不輸出（避免誤導成缺現價）', z.lots675, null);
  chk('跌幅 < 50% → zeroed 為 false',
    M.calcRescueBudget({ C: 10000000, L: 3000000, P1: 1000000, beta: 1.2, ruleLineRatio: RULE, price675: 20 }).zeroed, false);
}
chk('   └ P1 不夠還 → canRepay false', deep.canRepay, false);
chk('   └ 死線檢核不通過', deep.deathOk, false);
chk('Part2 P1=0 → canRepay false（需償還 > 0）',
  M.calcRescueBudget({ C: 10000000, L: 3000000, P1: 0, beta: 1.2, ruleLineRatio: RULE }).canRepay, false);

console.log('');
console.log('【非範圍：既有門檻與分流未被改動】');
chk('MR 燈號 350／260／280 未動', /MR_GREEN_FLOOR = 350;[\s\S]{0,120}MR_RED_CEILING = 260;[\s\S]{0,120}MR_RECOVERY_EXIT = 280;/.test(H), true);
chk('死線 7.14% 未動', /DEATH_LINE_RATIO = 0\.0714;/.test(H), true);
chk('P1 目標 1/3 未動', /P1_TARGET_RATIO = 1 \/ 3;/.test(H), true);
chk('80/20 未動', /GROWTH_STOCK_RATIO = 0\.8;[\s\S]{0,80}GROWTH_CRYPTO_RATIO = 0\.2;/.test(H), true);
chk('拉回 280% 未動', /DELEVERAGE_TARGET_MR = 2\.8;/.test(H), true);
chk('10.6 門檻 30% 未動', /MUSK_CONVERGENCE_CAP = 0\.30;/.test(H), true);
chk('護城河 12 萬未動', /CASH_MOAT_TARGET = 120000;/.test(H), true);
chk('天平判定收斂為單一來源', (H.match(/function pickBalanceTarget/g) || []).length, 1);
chk('   └ 舊的行內三元已改為呼叫它', /c0050 < c00733 \? '0050' : '00733'/.test(H), false);
chk('美股分流沿用 fixedRatioSplit（未另寫）', (H.match(/function fixedRatioSplit/g) || []).length, 1);
chk('IPO 折扣沿用既有參數（未另存一份）', /fos_p1calc_feeDiscount/.test(H), false);
chk('   └ 讀的是 ipoParamNum', /ETF_SELL_TAX_RATE \+ IPO_BROKER_FEE_RATE \* ipoParamNum\('feeDiscount'\)/.test(H), true);
chk('未新增任何後端寫入動作', /gasAPI\([^)]*p1calc/i.test(H), false);
chk('§4.8 築城牆未實作開關', /fortressMode|FORTRESS_MODE|築城牆模式開關/.test(H), false);

console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
