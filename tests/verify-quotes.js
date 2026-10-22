const fs = require('fs');
const path = require('path');
/* 目標檔一律相對解析：預設讀 repo 根的 index.html，也可用 argv[2] 指定別的檔。 */
const TARGET = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const H = fs.readFileSync(TARGET, 'utf8');
let fail = 0;
const chk = (n, a, e) => {
  const ok = String(a) === String(e);
  if (!ok) fail++;
  console.log('   ', n.padEnd(48), '預期', String(e).padStart(12), '實際', String(a).padStart(12), ok ? '✓' : '✗');
};
const grab = (from, to) => { const i = H.indexOf(from); return H.slice(i, H.indexOf(to, i + from.length)); };

const M = eval(grab("    /* 四檔現價自動抓取（FOS 後端唯讀 action etfQuotes", '    // 天平校準要買哪一邊')
  + '; ({ parseEtfQuotes, etfQuoteDateToISO, TICKERS: ETF_QUOTE_TICKERS, FIELD: ETF_QUOTE_FIELD })');

// 模擬「套用到欄位」的那段（與元件內同一邏輯）
const applyToFields = (prev, parsed) => {
  if (!parsed) return { next: { ...prev }, written: [] };
  const updates = {};
  M.TICKERS.forEach(tk => { if (parsed.prices[tk] != null) updates[M.FIELD[tk]] = String(parsed.prices[tk]); });
  // 與元件內同一條守衛：沒有任何價格被套用時不更新日期
  if (parsed.date && Object.keys(updates).length > 0) updates.priceDate = parsed.date;
  return { next: { ...prev, ...updates }, written: Object.keys(updates) };
};
const blankFields = { price0050: '', price00733: '', price00675L: '', price00631L: '', priceDate: '' };

console.log('【對照表】');
chk('四檔順序', M.TICKERS.join(','), '0050,00733,00675L,00631L');
chk('0050 → 欄位', M.FIELD['0050'], 'price0050');
chk('00733 → 欄位', M.FIELD['00733'], 'price00733');
chk('00675L → 欄位', M.FIELD['00675L'], 'price00675L');
chk('00631L → 欄位', M.FIELD['00631L'], 'price00631L');

console.log('');
console.log('【驗證 a】Boss 實測回應 → 四檔自動帶入、日期 2026/10/08');
const real = {"success":true,"quotes":{"0050":114.95,"00733":78.9,"00675L":357.75,"00631L":40.9},"sources":{"0050":"last","00733":"last","00675L":"last","00631L":"last"},"date":"20261008","time":"13:30:00"};
let p = M.parseEtfQuotes(real);
chk('解析成功（非 null）', p !== null, true);
chk('0050', p.prices['0050'], 114.95);
chk('00733', p.prices['00733'], 78.9);
chk('00675L', p.prices['00675L'], 357.75);
chk('00631L', p.prices['00631L'], 40.9);
chk('日期轉成 input[type=date] 格式', p.date, '2026-10-08');
let a = applyToFields(blankFields, p);
chk('四檔＋日期共寫入 5 個欄位', a.written.length, 5);
chk('   └ 欄位名', a.written.join(','), 'price0050,price00733,price00675L,price00631L,priceDate');
chk('   └ 欄位值為字串（input 需要）', typeof a.next.price0050, 'string');
chk('   └ price00733 值', a.next.price00733, '78.9');
chk('四檔皆 last → 無任何標示', M.TICKERS.every(tk => !p.meta[tk].missing && p.meta[tk].source === 'last'), true);
// 過時判定吃自動帶入的日期
const ONE_DAY_MS = 86400000;
const ageOf = (iso, now) => Math.floor((Date.parse(new Date(now - new Date(now).getTimezoneOffset() * 60000).toISOString().slice(0, 10)) - Date.parse(iso)) / ONE_DAY_MS);
chk('自動日期可供過時判定（20261008 → 距 20261011 為 3 天）', ageOf('2026-10-08', Date.parse('2026-10-11T05:00:00Z')), 3);
chk('   └ 距 20261012 為 4 天（> 3 會提示過時）', ageOf('2026-10-08', Date.parse('2026-10-12T05:00:00Z')), 4);

console.log('');
console.log('【驗證 b】00631L 為 null → 其他三檔帶入，該檔標示未抓到');
p = M.parseEtfQuotes({ ...real, quotes: { ...real.quotes, '00631L': null }, sources: { ...real.sources, '00631L': null } });
chk('00631L 不在 prices 內（不覆蓋原值）', p.prices['00631L'] === undefined, true);
chk('00631L missing', p.meta['00631L'].missing, true);
chk('00631L 無來源標示', p.meta['00631L'].source, null);
chk('其他三檔照常帶入', [p.prices['0050'], p.prices['00733'], p.prices['00675L']].join(','), '114.95,78.9,357.75');
chk('其他三檔不是 missing', ['0050', '00733', '00675L'].every(tk => !p.meta[tk].missing), true);
a = applyToFields({ ...blankFields, price00631L: '40.9' }, p);
chk('原有手填值被保留', a.next.price00631L, '40.9');
chk('只寫入 4 個欄位（三檔＋日期）', a.written.length, 4);

console.log('');
console.log('【驗證 c】source = prevClose → 顯示昨收');
p = M.parseEtfQuotes({ ...real, sources: { ...real.sources, '00675L': 'prevClose' } });
chk('00675L source', p.meta['00675L'].source, 'prevClose');
chk('   └ 不是 missing（有價就帶入）', p.meta['00675L'].missing, false);
chk('   └ 價格照常帶入', p.prices['00675L'], 357.75);
chk('其他檔仍為 last', p.meta['0050'].source, 'last');
p = M.parseEtfQuotes({ ...real, sources: { ...real.sources, '0050': 'weird' } });
chk('未知 source 字串 → 不顯示來源標示', p.meta['0050'].source, null);
chk('   └ 但價格仍帶入', p.prices['0050'], 114.95);
p = M.parseEtfQuotes({ ...real, sources: undefined });
chk('整個 sources 缺失 → 來源皆 null、價格照常', String(p.meta['0050'].source) + '/' + p.prices['0050'], 'null/114.95');

console.log('');
console.log('【驗證 d】整體失敗 → 回 null，呼叫端保留手動輸入');
chk('success: false', M.parseEtfQuotes({ success: false }), null);
chk('success 缺失', M.parseEtfQuotes({ quotes: { '0050': 100 } }), null);
chk('success 為字串 "true"（非嚴格 true）', M.parseEtfQuotes({ success: 'true', quotes: {} }), null);
chk('quotes 缺失', M.parseEtfQuotes({ success: true }), null);
chk('quotes 不是物件', M.parseEtfQuotes({ success: true, quotes: 'oops' }), null);
chk('整個回應為 null（非 JSON 解析後）', M.parseEtfQuotes(null), null);
chk('整個回應為 undefined', M.parseEtfQuotes(undefined), null);
chk('回應為字串', M.parseEtfQuotes('<html>error</html>'), null);
const kept = { price0050: '100', price00733: '50', price00675L: '300', price00631L: '40', priceDate: '2026-10-01' };
a = applyToFields(kept, M.parseEtfQuotes({ success: false }));
chk('失敗時欄位完全不動', JSON.stringify(a.next), JSON.stringify(kept));
chk('   └ 不寫入任何欄位', a.written.length, 0);

console.log('');
console.log('【驗證 e】手動值不被覆蓋；按 🔄 才更新');
// 模擬：抓到一次 → 手動改 0050 → 再按 🔄
let fields = applyToFields(blankFields, M.parseEtfQuotes(real)).next;
chk('第一次抓取後 0050', fields.price0050, '114.95');
fields = { ...fields, price0050: '120' };            // 手動覆蓋
chk('手動改成 120', fields.price0050, '120');
// 手動改價後該檔標示要清掉（元件內 handleP1CalcChange 的行為）
const clearMeta = (meta, fieldName) => {
  const tk = M.TICKERS.find(t => M.FIELD[t] === fieldName);
  return tk && meta && meta[tk] ? { ...meta, [tk]: null } : meta;
};
let meta = M.parseEtfQuotes({ ...real, sources: { ...real.sources, '0050': 'prevClose' } }).meta;
chk('改價前 0050 標示為 prevClose', meta['0050'].source, 'prevClose');
meta = clearMeta(meta, 'price0050');
chk('改價後 0050 標示被清掉（不再說昨收）', meta['0050'], null);
chk('   └ 其他檔標示保留', meta['00733'].source, 'last');
chk('   └ 非價格欄位（日期）不影響標示', clearMeta(meta, 'priceDate')['00733'].source, 'last');
// 按 🔄 重抓才覆蓋
fields = applyToFields(fields, M.parseEtfQuotes(real)).next;
chk('按 🔄 後 0050 被新值覆蓋', fields.price0050, '114.95');

console.log('');
console.log('【日期轉換邊界】');
chk('20261008 → 2026-10-08', M.etfQuoteDateToISO('20261008'), '2026-10-08');
chk('數字型 20261008', M.etfQuoteDateToISO(20261008), '2026-10-08');
chk('前後空白', M.etfQuoteDateToISO(' 20261008 '), '2026-10-08');
chk('null → 空字串', M.etfQuoteDateToISO(null), '');
chk('undefined → 空字串', M.etfQuoteDateToISO(undefined), '');
chk('空字串 → 空字串', M.etfQuoteDateToISO(''), '');
chk('位數不足 → 空字串', M.etfQuoteDateToISO('202610'), '');
chk('已是 ISO 格式 → 空字串（不是 8 位數字）', M.etfQuoteDateToISO('2026-10-08'), '');
chk('非數字 → 空字串', M.etfQuoteDateToISO('abcdefgh'), '');
chk('不存在的日期 20261332 → 空字串', M.etfQuoteDateToISO('20261332'), '');
chk('日期缺失時不覆蓋日期欄', applyToFields(kept, M.parseEtfQuotes({ ...real, date: 'bad' })).written.includes('priceDate'), false);
chk('日越界 20260230 → 空字串（不可滾成 3/2）', M.etfQuoteDateToISO('20260230'), '');
chk('月越界 20261332 → 空字串', M.etfQuoteDateToISO('20261332'), '');
chk('閏年 20240229 → 有效', M.etfQuoteDateToISO('20240229'), '2024-02-29');
chk('非閏年 20260229 → 空字串', M.etfQuoteDateToISO('20260229'), '');
chk('日為 00 → 空字串', M.etfQuoteDateToISO('20261000'), '');
chk('月為 00 → 空字串', M.etfQuoteDateToISO('20260015'), '');

console.log('');
console.log('【必修回歸】四檔全抓不到時不可更新價格日期');
{
  const stale = { ...kept, priceDate: '2026-10-01' };
  const allNull = M.parseEtfQuotes({ success: true, quotes: { '0050': null, '00733': null, '00675L': null, '00631L': null }, sources: {}, date: '20261010' });
  chk('解析仍成功（success 為 true）', allNull !== null, true);
  const r1 = applyToFields(stale, allNull);
  chk('沒有任何欄位被寫入', r1.written.length, 0);
  chk('   └ 價格日期維持舊值（過時警告不被消掉）', r1.next.priceDate, '2026-10-01');
  // 只要有一檔抓到就該更新日期
  const oneOk = M.parseEtfQuotes({ success: true, quotes: { '0050': 114.95, '00733': null, '00675L': null, '00631L': null }, sources: { '0050': 'last' }, date: '20261010' });
  const r2 = applyToFields(stale, oneOk);
  chk('有一檔抓到 → 日期更新', r2.next.priceDate, '2026-10-10');
  chk('   └ 寫入 2 個欄位（該檔＋日期）', r2.written.join(','), 'price0050,priceDate');
  chk('   └ 其他三檔維持原值', [r2.next.price00733, r2.next.price00675L, r2.next.price00631L].join(','), '50,300,40');
}

console.log('');
console.log('【價格邊界】null／0／負數／字串／NaN');
const q = (v) => M.parseEtfQuotes({ success: true, quotes: { '0050': v }, sources: {}, date: '20261008' });
chk('null → missing', q(null).meta['0050'].missing, true);
chk('0 → missing（0 元不是有效報價）', q(0).meta['0050'].missing, true);
chk('負數 → missing', q(-5).meta['0050'].missing, true);
chk('NaN → missing', q(NaN).meta['0050'].missing, true);
chk('空字串 → missing', q('').meta['0050'].missing, true);
chk('字串數字 "114.95" → 可用', q('114.95').prices['0050'], 114.95);
chk('缺少該檔欄位 → missing', M.parseEtfQuotes({ success: true, quotes: {}, date: '20261008' }).meta['0050'].missing, true);
chk('四檔全 null → 仍回物件（不是 null），但無任何價格',
  Object.keys(M.parseEtfQuotes({ success: true, quotes: { '0050': null, '00733': null, '00675L': null, '00631L': null } }).prices).length, 0);
chk('   └ 四檔皆 missing', M.TICKERS.every(tk => M.parseEtfQuotes({ success: true, quotes: {} }).meta[tk].missing), true);

console.log('');
console.log('【接線與非範圍】');
chk('呼叫的是 etfQuotes 唯讀端點', /GAS_URL_FOS \+ '\?action=etfQuotes'/.test(H), true);
chk('比照 fetchMarketIndex 的寫法（GET + .json）', /action=etfQuotes'\)\s*\n\s*\.then\(res => res\.json\(\)\)/.test(H), true);
chk('載入時打一次', /useEffect\(\(\) => \{ fetchEtfQuotes\(\); \}, \[\]\);/.test(H), true);
chk('失敗只 console.warn 不擋畫面', (H.match(/\[EtfQuotes\]/g) || []).length, 2);
chk('沒有用 gasAPI（不碰授權計數）', /gasAPI\(['"]etfQuotes/.test(H), false);
// fetch 呼叫本身必須是純 GET：沒有第二個 options 參數、沒有帶任何 secret
chk('fetch 為純 GET（無 options 參數）', /fetch\(GAS_URL_FOS \+ '\?action=etfQuotes'\)\s*\n/.test(H), true);
{
  const i = H.indexOf("fetch(GAS_URL_FOS + '?action=etfQuotes')");
  const body = H.slice(i, H.indexOf('.finally(', i));
  chk('fetch 到 finally 之間不含 WRITE_SECRET', /WRITE_SECRET/.test(body), false);
  chk('   └ 也不含 POST／body', /POST|body:/.test(body), false);
}
chk('🔄 按鈕沿用大盤指數同一組 svg path', (H.match(/d="M4 4v5h\.582m15\.356 2A8\.001 8\.001 0 004\.582 9m0 0H9m11 11v-5h-\.581m0 0a8\.003 8\.003 0 01-15\.357-2m15\.357 2H15"/g) || []).length, 2);
chk('舊標籤「v15.1 條文起草中」已移除', /v15\.1 條文起草中/.test(H), false);
chk('舊標籤「秘書裁定」已移除', /秘書裁定/.test(H), false);
chk('Part 1 標 §5.7（必做）', /PART 1｜§5\.7 P1 上限再平衡（必做）/.test(H), true);
chk('⑤ 標 §6.1.2', /§6\.1\.2 增貸目標 MR 380%/.test(H), true);
chk('Part 2 標 §4.3.1', /PART 2｜§4\.3\.1 救火執行機制（觸價單預掛）/.test(H), true);
chk('「實際下單由 Boss 執行」維持', /實際下單由 Boss 執行/.test(H), true);
chk('計算公式未動：借款上限仍 ÷ 3.8', /newC \/ P1_RELEND_TARGET_MR - L/.test(H), true);
chk('計算公式未動：d 仍 (1 − 2.6L/C)/β', /const d = \(1 - ruleLineRatio \* L \/ C\) \/ beta;/.test(H), true);
chk('過時天數門檻未動（3 天）', /PRICE_STALE_DAYS = 3;/.test(H), true);
chk('過時判定仍讀 priceDate', /priceAgeDays\(p1CalcInputs\.priceDate, Date\.now\(\)\)/.test(H), true);
chk('未新增任何後端寫入', /action=etfQuotes'[^)]*method:\s*'POST'/.test(H), false);
// 確認模擬用的 helper 與原始碼同一條守衛（避免測試與程式各走各的）
chk('原始碼有「無價格就不更新日期」的守衛',
  /if \(parsed\.date && Object\.keys\(updates\)\.length > 0\) updates\.priceDate = parsed\.date;/.test(H), true);
chk('日期驗證用來回比對（非只靠 Date.parse）',
  /parsed\.toISOString\(\)\.slice\(0, 10\) !== iso/.test(H), true);
chk('prevClose 標示已移除恆真 conjunct', /meta && !meta\.missing && meta\.source === 'prevClose'/.test(H), false);

console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
