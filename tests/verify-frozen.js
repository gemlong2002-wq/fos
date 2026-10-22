const fs = require('fs');
const path = require('path');
/* 目標檔一律相對解析：預設讀 repo 根的 index.html，也可用 argv[2] 指定別的檔。 */
const TARGET = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const H = fs.readFileSync(TARGET, 'utf8');
let fail = 0;
const chk = (n, a, e) => {
  const ok = String(a) === String(e);
  if (!ok) fail++;
  console.log('   ', n.padEnd(52), '預期', String(e).padStart(10), '實際', String(a).padStart(10), ok ? '✓' : '✗');
};
const grab = (from, to) => { const i = H.indexOf(from); return H.slice(i, H.indexOf(to, i + from.length)); };

// 抽出 allocateExternalFunds（凍結條件的唯一來源）與 fixedRatioSplit，實跑
const deps = grab('    const P1_TARGET_RATIO', '    /* ======')
  + grab('    function allocateExternalFunds(amount, ctx) {', '    /* ======')
  + grab('      const US_EQUITY_RATIO_QLD_ONLY', '      // 1:1 錨定判定').replace(/^\s*const US_EQUITY_RATIO_QLD_ONLY.*$/m, m => m);
const consts = grab('    const US_EQUITY_RATIO = ', '    const MUSK_TICKERS');
const qldOnlyConst = /const US_EQUITY_RATIO_QLD_ONLY = \{[^}]*\};/.exec(H)[0];
const splitFn = grab('      function fixedRatioSplit(amount, frozen, qldOnly) {', '      function formatNumber');
const M = eval(consts + qldOnlyConst + grab('    const P1_TARGET_RATIO', '    /* ===')
  + grab('    function allocateExternalFunds(amount, ctx) {', '\n    /* ===')
  + splitFn + '; ({ alloc: allocateExternalFunds, split: fixedRatioSplit, R: US_EQUITY_RATIO, Q: US_EQUITY_RATIO_QLD_ONLY })');

// injectionFrozen 的取得方式（與元件內同一寫法）
const frozenOf = (zone, quickDropActive) => M.alloc(0, { zone, quickDropActive }).frozen;

console.log('【凍結判定唯一來源：allocateExternalFunds 的 frozen】');
chk('§4.9 active ＋ 黃燈 → 凍結', frozenOf('YELLOW', true), true);
chk('§4.9 active ＋ 綠燈 → 凍結', frozenOf('GREEN', true), true);
chk('§4.9 active ＋ STANDBY → 凍結', frozenOf('STANDBY', true), true);
chk('純 🔴（含回復帶，zone 已疊加）→ 凍結', frozenOf('RED', false), true);
chk('🔴 ＋ §4.9 → 凍結', frozenOf('RED', true), true);
chk('綠燈、無 4.9 → 不凍結', frozenOf('GREEN', false), false);
chk('黃燈、無 4.9 → 不凍結', frozenOf('YELLOW', false), false);
chk('STANDBY、無 4.9 → 不凍結', frozenOf('STANDBY', false), false);
chk('quickDropActive 為 undefined → 不凍結', frozenOf('GREEN', undefined), false);

console.log('');
console.log('【fixedRatioSplit 吃同一個結果（本次修正重點）】');
const amt = 100000;
let r = M.split(amt, frozenOf('YELLOW', true), false);
chk('§4.9 active ＋ 黃燈 → frozen', r.frozen, true);
chk('   └ 三檔金額皆 0', [r.tsla, r.spcx, r.qld].join(','), '0,0,0');
chk('   └ 訊息', r.msg, '凍結注資，資金償還質押本金');
chk('   └ qldOnly 旗標歸零', r.qldOnly, false);
console.log('      ↑ 修正前此情境 frozen 為 false（只看 mrZone==='+"'RED'"+'），會正常分流');
r = M.split(amt, frozenOf('RED', false), false);
chk('純 🔴 → frozen（迴歸）', r.frozen, true);
chk('   └ 三檔金額皆 0', [r.tsla, r.spcx, r.qld].join(','), '0,0,0');
r = M.split(amt, frozenOf('RED', true), true);
chk('🔴 ＋ 4.9 ＋ 收斂中 → frozen 優先', r.frozen, true);
chk('   └ 不會變成全額 QLD', r.qld, 0);

console.log('');
console.log('【未凍結時的正常分流（迴歸，數字須與 db3fb14 相同）】');
r = M.split(amt, frozenOf('GREEN', false), false);
chk('綠燈：TSLA 20%', r.tsla, amt * M.R.TSLA);
chk('綠燈：SPCX 10%', r.spcx, amt * M.R.SPCX);
chk('綠燈：QLD 70%', r.qld, amt * M.R.QLD);
chk('綠燈：三檔相加 = 投入額', Math.round(r.tsla + r.spcx + r.qld), amt);
chk('綠燈：frozen false', r.frozen, false);
chk('綠燈：qldOnly false', r.qldOnly, false);
r = M.split(amt, frozenOf('YELLOW', false), false);
chk('黃燈：仍照 70/20/10', [r.tsla, r.spcx, r.qld].join(','), [amt * M.R.TSLA, amt * M.R.SPCX, amt * M.R.QLD].join(','));
r = M.split(amt, frozenOf('GREEN', false), true);
chk('§10.6 收斂中：全額 QLD', r.qld, amt);
chk('   └ TSLA／SPCX 為 0', [r.tsla, r.spcx].join(','), '0,0');
chk('   └ qldOnly 旗標 true', r.qldOnly, true);
chk('   └ 相加仍 = 投入額', r.tsla + r.spcx + r.qld, amt);
chk('金額 0 → 不凍結時三檔皆 0', (() => { const x = M.split(0, false, false); return [x.tsla, x.spcx, x.qld].join(','); })(), '0,0,0');

console.log('');
console.log('【原始碼結構：凍結條件只有一個來源】');
chk('allocateExternalFunds 的 defensive 只有一處',
  (H.match(/zone === 'RED'\) \|\| !!\(ctx && ctx\.quickDropActive\)/g) || []).length, 1);
chk('fixedRatioSplit 不再自己判 RED', /function fixedRatioSplit\(amount, frozen, qldOnly\) \{\s*if \(frozen\)/.test(H), true);
chk('   └ 簽名已改為吃 frozen', /function fixedRatioSplit\(amount, frozen, qldOnly\)/.test(H), true);
chk('injectionFrozen 只定義一次', (H.match(/const injectionFrozen = /g) || []).length, 1);
chk('   └ 來源是 allocateExternalFunds', /const injectionFrozen = allocateExternalFunds\(0, \{ zone: mrZoneInfo\.zone, quickDropActive \}\)\.frozen;/.test(H), true);
chk('三個呼叫點都傳 injectionFrozen', (H.match(/fixedRatioSplit\([^,]+, injectionFrozen, muskConv\.forceQldOnly\)/g) || []).length, 3);
chk('   └ 已無呼叫點傳 mrZoneInfo.zone', /fixedRatioSplit\([^,]+, mrZoneInfo\.zone/.test(H), false);
chk('舊名 fiatIsFrozen 零殘留', /fiatIsFrozen/.test(H), false);
chk('allocateExternalFunds 函式體未改（defensive 原樣）',
  /const defensive = \(ctx && ctx\.zone === 'RED'\) \|\| !!\(ctx && ctx\.quickDropActive\);/.test(H), true);
chk('燈號門檻未動', /MR_GREEN_FLOOR = 350;[\s\S]{0,140}MR_RED_CEILING = 260;[\s\S]{0,140}MR_RECOVERY_EXIT = 280;/.test(H), true);
chk('§4.9 判定本身未動', /QUICK_DROP_PCT_POINTS = 30/.test(H), true);
chk('80/20 與 70/20/10 未動', /US_EQUITY_RATIO = \{ QLD: 0\.70, TSLA: 0\.20, SPCX: 0\.10 \}/.test(H), true);

console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
