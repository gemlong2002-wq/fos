/* ============================================================
   verify-engine — v15.3 §9.2 B 帳戶雙引擎分流（取代固定 80/20）
   decideEngineSplit 判定＋allocateExternalFunds 套用＋凍結不變。
   全部為合成假資料（非真實部位），預期值依規則手推。
   ============================================================ */
const fs = require('fs');
const path = require('path');
const TARGET = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const H = fs.readFileSync(TARGET, 'utf8');
let fail = 0;
const chk = (n, a, e) => {
  const ok = String(a) === String(e);
  if (!ok) fail++;
  console.log('   ', n.padEnd(46), '預期', String(e).padStart(16), '實際', String(a).padStart(16), ok ? '✓' : '✗');
};
const grab = (from, to) => { const i = H.indexOf(from); if (i < 0) throw new Error('找不到 ' + from); return H.slice(i, H.indexOf(to, i + from.length)); };

const M = eval(grab('    const P1_TARGET_RATIO', '    /* ===')
  + grab('    function splitByMarketValue', '    // 價格更新日')
  + grab('    function decideEngineSplit', '    function allocateExternalFunds')
  + grab('    function allocateExternalFunds(amount, ctx) {', '\n    /* ===')
  + '; ({ decide: decideEngineSplit, alloc: allocateExternalFunds, GS: GROWTH_STOCK_RATIO, GC: GROWTH_CRYPTO_RATIO })');
const pair = (r) => r.stock + '/' + r.crypto + '/' + r.mode;

console.log('【J】美股成本 200 萬、現值 180 萬（−10%）；加密成本 200 萬、現值 140 萬（−30%）');
// 加密報酬較差 → 加密 80%／美股 20%
chk('J：加密落後 → 美股 20%／加密 80%', pair(M.decide(1800000, 2000000, 1400000, 2000000)), '0.2/0.8/crypto-behind');

console.log('');
console.log('【K】預設情境 → 美股 80%／加密 20%');
// K1：美股 180/200 = −10%、加密 90/100 = −10%，報酬相同
chk('K1：報酬率相同', pair(M.decide(1800000, 2000000, 900000, 1000000)), '0.8/0.2/default');
chk('K1：理由 tie', M.decide(1800000, 2000000, 900000, 1000000).reason, 'tie');
chk('K2：加密成本 0', pair(M.decide(1800000, 2000000, 1400000, 0)), '0.8/0.2/default');
chk('K2：加密成本空白', pair(M.decide(1800000, 2000000, 1400000, '')), '0.8/0.2/default');
chk('K2：美股成本空白', pair(M.decide(1800000, '', 1400000, 2000000)), '0.8/0.2/default');
chk('K2：成本負數', pair(M.decide(1800000, -5, 1400000, 2000000)), '0.8/0.2/default');
chk('全部未提供 → 預設', pair(M.decide()), '0.8/0.2/default');

console.log('');
console.log('【美股較差】美股 200 萬 → 140 萬（−30%）；加密 200 萬 → 180 萬（−10%）');
chk('美股落後 → 美股 80%／加密 20%', pair(M.decide(1400000, 2000000, 1800000, 2000000)), '0.8/0.2/us-behind');
// 字串輸入（後端回傳字串）也要能判定
chk('字串成本照常判定', pair(M.decide('1800000', '2000000', '1400000', '2000000')), '0.2/0.8/crypto-behind');

console.log('');
console.log('【套用】allocateExternalFunds 成長分流（🟡、護城河已滿、P1 已達 1/3 L）');
/* 100 萬全數進成長：L 300 萬、P1 100 萬（＝1/3 L）、護城河 12 萬已滿
   J 方向 → 美股 1,000,000 × 0.2 = 200,000、加密 × 0.8 = 800,000
   未提供 engineSplit → 預設 800,000／200,000（與既有 B-8／B-9 美股 80%／加密 20% 一致） */
const ctx = { zone: 'YELLOW', quickDropActive: false, cmTarget: 120000, cmCash: 120000, L: 3000000, P1: 1000000, c0050: 0, c00733: 0 };
const jSplit = M.decide(1800000, 2000000, 1400000, 2000000);
const aJ = M.alloc(1000000, { ...ctx, engineSplit: jSplit });
chk('J：美股 200,000', Math.round(aJ.stock), 200000);
chk('J：加密 800,000', Math.round(aJ.crypto), 800000);
const aDef = M.alloc(1000000, ctx);
chk('未提供成本：美股 800,000', Math.round(aDef.stock), 800000);
chk('未提供成本：加密 200,000', Math.round(aDef.crypto), 200000);
chk('預設常數仍為 0.8／0.2（只作預設）', M.GS + '/' + M.GC, '0.8/0.2');

console.log('');
console.log('【v4 凍結不變】🔴／4.9 → 不放行、全數還本金（分流比例不影響）');
const aRed = M.alloc(1000000, { ...ctx, zone: 'RED', engineSplit: jSplit });
chk('🔴：frozen', aRed.frozen, true);
chk('🔴：美股／加密皆 0、還本金 1,000,000', [aRed.stock, aRed.crypto, aRed.repay].join('/'), '0/0/1000000');
const aQd = M.alloc(1000000, { ...ctx, quickDropActive: true, engineSplit: jSplit });
chk('§4.9：還本金 1,000,000', aQd.repay + '/' + aQd.stock, '1000000/0');

console.log('');
console.log('【靜態檢查】單一來源與單位');
chk('全檔無獨立 * 0.8／* 0.2 分流', /escapeVal \* 0\.[82]|growthRemainder \* (0\.[82]|GROWTH_)|left \* GROWTH_/.test(H), false);
chk('美股現值＝USD × 匯率', H.includes("const bUsValueTwd = ((parseFloat(formDataB.tsla) || 0) + (parseFloat(formDataB.qld) || 0) + (parseFloat(formDataB.spcx) || 0)) * bUsdRate;"), true);
chk('加密現值＝台幣直接加總', H.includes('const bCryptoValueTwd = (parseFloat(formDataB.eth) || 0) + (parseFloat(formDataB.btc) || 0);'), true);
chk('FIAT 與指令卡都傳 engineSplit', (H.match(/c0050, c00733, engineSplit\n/g) || []).length, 2);
chk('成本不存 localStorage', /fos_usCost|fos_cryptoCost|safeSetStorage\('fos_(us|crypto)Cost/.test(H), false);
chk('讀取帶回 usCost／cryptoCost', H.includes('usCost: res.data.usCost !== undefined') && H.includes('cryptoCost: res.data.cryptoCost !== undefined'), true);
chk('預設文案', H.includes('（預設：成本未填或報酬相同）'), true);
chk('落後文案', H.includes('（加密落後）') && H.includes('（美股落後）'), true);

console.log('');
console.log('【成本防呆】逐欄：該欄後端未帶回（缺欄／null）且未手動輸入 → 存檔不送該欄（後端保留原值）');
{
  const src = grab('      const bCostReadyRef = useRef(', '        return out;') + '        return out;\n      };';
  const run = (ready) => {
    const useRef = (v) => ({ current: v });
    const formDataB = { tsla: '1', btc: '2', usCost: '', cryptoCost: '' };
    return eval(src + '; bCostReadyRef.current = ' + JSON.stringify(ready) + '; bPayload()');
  };
  const keys = (o) => ['usCost', 'cryptoCost'].filter(k => k in o).join(',') || '(無)';
  chk('兩欄都未帶回 → 都不送', keys(run({ usCost: false, cryptoCost: false })), '(無)');
  chk('只有美股成本就緒 → 只送 usCost', keys(run({ usCost: true, cryptoCost: false })), 'usCost');
  chk('只有加密成本就緒 → 只送 cryptoCost', keys(run({ usCost: false, cryptoCost: true })), 'cryptoCost');
  chk('兩欄就緒 → 都送（空字串＝無成本）', JSON.stringify(run({ usCost: true, cryptoCost: true })), JSON.stringify({ tsla: '1', btc: '2', usCost: '', cryptoCost: '' }));
  chk('其他欄位照送', run({ usCost: false, cryptoCost: false }).btc, '2');
  chk('兩個存檔路徑都用 bPayload', (H.match(/'saveFOSDataB', bPayload\(\)/g) || []).length, 2);
  chk('後端回傳逐欄判定（排除 undefined／null）', H.includes('if (res.data[k] !== undefined && res.data[k] !== null) bCostReadyRef.current[k] = true;'), true);
  chk('手動輸入只標記該欄', H.includes('bCostReadyRef.current[e.target.name] = true;'), true);
}

console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
