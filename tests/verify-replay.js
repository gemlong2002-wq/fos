/* ============================================================
   verify-replay — ASSET「資產回放」斷點事件偵測驗收斷言

   測的是 index.html 模組層的純函式區（ASSET_REPLAY_* 常數、
   toReplaySeries／buildReplayEvents／pickReplayEvent／
   buildReplayGaps／isReplayGap／truncateReplayNote／
   calcReplayDuration），用 grab 把那整段從 index.html 切出來實跑，
   不另寫一份模擬邏輯。

   輸入是人工設計的假序列（整數、不含真實部位），
   預期值全部依下列定義手推後寫入，非取自程式輸出。

   ── 事件定義（出自本次工單） ───────────────────────────────
   ① 整數關卡：首次 ≥ 每 500 萬（ASSET_REPLAY_MILESTONE_STEP）
   ② 大跌：自前高回檔首次跌破 −10% / −20% / −30%，
          每段回檔各觸發一次，創新高後重置；
          同一筆跨越多級取最深者
   ③ 谷底：每段回檔幅度 ≥ 10% 的最低點
   ④ 收復前高：該段回檔後首次 ≥ 前高，N = 前高日→收復日的天數
   ⑤ 跨年：進入新年份的第一筆，比較「剛結束那年」最後一筆
          與「其前一年」最後一筆；前一年無資料則對比第一筆
   ⑥ 備註：非空則顯示，超過 20 字截斷加…
   ⑦ 最後一筆
   優先度：⑦ > ④ > ② > ① > ③ > ⑤ > ⑥
   空檔：兩筆間隔 > 60 天 → 虛線「無紀錄」

   ── 假序列 S1（9 筆，YYYYMMDD／總資產／備註） ──────────────
     i0 20240101   4,800,000  ''
     i1 20240201   5,200,000  '加碼 0050 兩張'（10 字）
     i2 20240301  10,000,000  ''
     i3 20240401  11,000,000  ''
     i4 20240701   9,000,000  ''
     i5 20240801   7,500,000  ''
     i6 20250101  11,500,000  ''
     i7 20250201   7,000,000  ''
     i8 20260101  20,000,000  '年終結算：含質押借款與投入本金，毛資產口徑已確認'（24 字）

   手推過程：
   · 空檔：相鄰間隔 31／29／31／91／31／153／31／334 天
     → > 60 的是 i3→i4、i5→i6、i7→i8，故空檔索引 = [4, 6, 8]
   · 關卡：i0 的 480 萬未達 500 萬 → 無。i1 的 520 萬 → floor/500萬
     = 500 萬，首次 → 觸發 500 萬。i2 的 1000 萬 → 觸發 1000 萬。
     i3 的 1100 萬 → floor 仍是 1000 萬，不高於已觸發 → 無。
     i8 的 2000 萬 → 觸發 2000 萬（跳過 1500 萬，取已達到的最高級）
   · 前高推移：i0 480 萬 → i1 520 萬 → i2 1000 萬 → i3 1100 萬
     （i3 之後進入回檔）→ i6 1150 萬（創新高）→ i8 2000 萬（創新高）
   · 第一段回檔（前高 1100 萬 @20240401）：
       i4 900 萬 → (1100−900)/1100 = 18.1818%，首次跌破 10% → 大跌 −10%
       i5 750 萬 → (1100−750)/1100 = 31.8182%，同一筆跨越 20% 與 30%
                   → 大跌取最深者 −30%
       本段最低點 = i5 的 750 萬，幅度 31.8182% ≥ 10% → i5 有谷底
       i6 1150 萬 ≥ 前高 1100 萬 → 收復前高，
         N = 20240401 → 20250101 = 275 天
   · 第二段回檔（前高 1150 萬 @20250101，級距已因創新高重置）：
       i7 700 萬 → (1150−700)/1150 = 39.1304%，跨越 10/20/30
                   → 大跌 −30%（證明重置生效）
       本段最低點 = i7，幅度 39.1304% ≥ 10% → i7 有谷底
       i8 2000 萬 ≥ 前高 1150 萬 → 收復前高，
         N = 20250101 → 20260101 = 365 天
   · 跨年：
       i6 是 2025 年第一筆 → 剛結束的是 2024 年，其最後一筆 = i5 750 萬；
         2023 年無資料 → 對比第一筆 i0 480 萬 → 增減 = +270 萬
       i8 是 2026 年第一筆 → 剛結束的是 2025 年，其最後一筆 = i7 700 萬；
         2024 年最後一筆 = i5 750 萬 → 增減 = −50 萬
   · 備註：i1 共 10 字 ≤ 20 → 原樣；i8 共 24 字 > 20 → 前 20 字 + …
   · 每筆的事件與勝出者（依優先度）：
       i0 無
       i1 關卡 500 萬 ＋ 備註        → 關卡勝（① > ⑥）
       i2 關卡 1000 萬               → 關卡
       i3 無
       i4 大跌 −10%                  → 大跌
       i5 大跌 −30% ＋ 谷底          → 大跌勝（② > ③）
       i6 收復前高 ＋ 跨年 2025      → 收復前高勝（④ > ⑤）
       i7 大跌 −30% ＋ 谷底          → 大跌勝
       i8 關卡 2000 萬 ＋ 收復前高 ＋ 跨年 2026 ＋ 備註 ＋ 最後一筆
                                     → 最後一筆勝（⑦ 最高）

   ── 假序列 S2（7 筆，測邊界與「淺回檔不觸發」） ────────────
     i0 20260105  10,000,000
     i1 20260205  11,000,000
     i2 20260305   9,900,000
     i3 20260405   9,500,000
     i4 20260505  11,200,000
     i5 20260605  10,800,000
     i6 20260705  11,300,000

   手推過程：
   · 空檔：間隔 31／28／31／30／31／30 天，全部 ≤ 60 → 無空檔
   · i0 的 1000 萬 → 觸發關卡 1000 萬（第一筆也算「首次 ≥」）
   · i1 的 1100 萬 → floor 仍 1000 萬 → 無關卡
   · 第一段回檔（前高 1100 萬 @20260205）：
       i2 990 萬 → (1100−990)/1100 = 10.0000% 正好等於門檻，
                   判定用 ≥ → 大跌 −10%（邊界測試）
       i3 950 萬 → 13.6364%，未跨新級距 → 無大跌；
                   為本段最低點且幅度 ≥ 10% → 只有谷底
                   → 谷底成為勝出者（此序列用來讓 ③ 真的顯示）
       i4 1120 萬 ≥ 前高 → 收復前高，N = 20260205 → 20260505 = 89 天
   · 第二段回檔（前高 1120 萬 @20260505）：
       i5 1080 萬 → (1120−1080)/1120 = 3.5714%，未達 10%
                   → 無大跌、無谷底
       i6 1130 萬 ≥ 前高 1120 萬，但該段最大回檔 3.5714% < 10%
                   → 不觸發收復前高（淺回檔不算收復）
                   i6 是最後一筆 → 只有「最後一筆」
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
  console.log('   ', n.padEnd(52), '預期', String(e).padStart(16), '實際', String(a).padStart(16), ok ? '✓' : '✗');
};
const near = (n, a, e, tol) => {
  const ok = Number.isFinite(a) && Math.abs(a - e) <= tol;
  if (!ok) fail++;
  console.log('   ', n.padEnd(52), '預期', ('≈' + e).padStart(16), '實際',
    String(typeof a === 'number' ? Math.round(a * 1e6) / 1e6 : a).padStart(16), ok ? '✓' : '✗');
};

// 把模組層那整段（回放純函式）連同它依賴的 parseYMD 一起抽出來實跑
const grab = (from, to) => {
  const i = H.indexOf(from);
  if (i < 0) { console.log('GRAB_FAIL', from); process.exit(2); }
  return H.slice(i, H.indexOf(to, i + from.length));
};
const deps = grab('    const parseYMD = (val) => {', '    const formatYMD')
  + grab('    const ASSET_REPLAY_DAY_MS = 86400000;', '    /* ======');

const M = eval(deps + `; ({
  toReplaySeries, buildReplayEvents, pickReplayEvent, buildReplayGaps,
  isReplayGap, truncateReplayNote, calcReplayDuration, replayDayDiff,
  attachMarketExtremes, replaySpawnCount, replayDpr,
  replayLerp, replayProgress, replayBoltSpec, buildLightningPath, buildReplaySummary,
  buildReplayAthCounts, buildReplayMinorMarks, calcReplayStepDurations,
  buildAthStreaks, replayComboTier, replaySegmentUp, replaySegmentColor,
  replayHistoryAlpha, buildCometTrail,
  K: { STEP: ASSET_REPLAY_MILESTONE_STEP, TIERS: ASSET_REPLAY_DRAWDOWN_TIERS,
       MIN_DD: ASSET_REPLAY_SEGMENT_MIN_DRAWDOWN, GAP: ASSET_REPLAY_GAP_DAYS,
       NOTE: ASSET_REPLAY_NOTE_MAX, HOLD: ASSET_REPLAY_EVENT_HOLD_MS,
       MIN_MS: ASSET_REPLAY_MIN_MS, MAX_MS: ASSET_REPLAY_MAX_MS,
       PRIORITY: ASSET_REPLAY_EVENT_PRIORITY,
       AS_OF: TWSE_EXTREME_AS_OF, TWSE: TWSE_EXTREME_DAYS,
       MAX_PARTICLES: ASSET_REPLAY_MAX_PARTICLES, MAX_DPR: ASSET_REPLAY_MAX_DPR,
       SHOW_MARKET: ASSET_REPLAY_SHOW_MARKET, MINOR: ASSET_REPLAY_MINOR_STEP,
       ATH_SPARKS: ASSET_REPLAY_ATH_SPARKS, SLOW: ASSET_REPLAY_SLOW_FACTOR,
       FAST: ASSET_REPLAY_FAST_FACTOR, RADIUS: ASSET_REPLAY_SLOW_RADIUS,
       FLAT: ASSET_REPLAY_FLAT_RATIO, FINAL_MS: ASSET_REPLAY_FINAL_SLOW_MS,
       FINAL_GLOW_MS: ASSET_REPLAY_FINAL_GLOW_MS,
       COMBO: ASSET_REPLAY_COMBO_TIERS, COMBO_MIN: ASSET_REPLAY_COMBO_MIN,
       COMBO_FADE: ASSET_REPLAY_COMBO_FADE_MS,
       BRIGHT: ASSET_REPLAY_BRIGHT_SEGS, HIST: ASSET_REPLAY_HISTORY_ALPHA }
})`);
const K = M.K;

// 取某筆的事件型別序列 / 勝出者型別
const types = (evs, i) => evs[i].map((e) => e.type).join(',');
const winner = (evs, i) => { const w = M.pickReplayEvent(evs[i]); return w ? w.type : 'null'; };
const find = (evs, i, t) => evs[i].filter((e) => e.type === t)[0] || null;

console.log('【常數核對】');
chk('整數關卡級距', K.STEP, 5000000);
chk('大跌級距', JSON.stringify(K.TIERS), '[0.1,0.2,0.3]');
chk('谷底／收復的最小回檔幅度', K.MIN_DD, 0.1);
chk('空檔天數門檻', K.GAP, 60);
chk('備註字數上限', K.NOTE, 20);
chk('斷點字卡停留毫秒', K.HOLD, 600);
chk('播放時間下限（毫秒）', K.MIN_MS, 8000);
chk('播放時間上限（毫秒）', K.MAX_MS, 20000);
chk('優先度：最後一筆最高', K.PRIORITY.final, 8);
chk('優先度：收復前高 > 大跌', K.PRIORITY.recover > K.PRIORITY.crash, true);
chk('優先度：大跌 > 整數關卡', K.PRIORITY.crash > K.PRIORITY.milestone, true);
chk('優先度：整數關卡 > 谷底', K.PRIORITY.milestone > K.PRIORITY.trough, true);
chk('優先度：谷底 > 跨年', K.PRIORITY.trough > K.PRIORITY.year, true);
chk('優先度：跨年 > 台股大漲大跌', K.PRIORITY.year > K.PRIORITY.market, true);
chk('優先度：台股大漲大跌 > 備註', K.PRIORITY.market > K.PRIORITY.note, true);
chk('台股快照資料日期', K.AS_OF, '2026/11/04');
chk('台股快照筆數（漲跌各十）', K.TWSE.length, 20);
chk('   └ 跌點十筆', K.TWSE.filter((r) => r[1] < 0).length, 10);
chk('   └ 漲點十筆', K.TWSE.filter((r) => r[1] > 0).length, 10);
chk('   └ 日期皆為 YYYYMMDD', K.TWSE.every((r) => /^\d{8}$/.test(r[0])), true);
chk('   └ 無重複日期', new Set(K.TWSE.map((r) => r[0])).size, 20);
chk('   └ 跌點榜第一（2026/07/17）', K.TWSE[0].join('|'), '20260717|-2953.71|-6.47|1');
chk('   └ 漲點榜第一（2025/04/10）', K.TWSE.filter((r) => r[1] > 0)[0].join('|'), '20250410|1608.27|9.25|1');

console.log('');
console.log('【假序列 S1】9 筆｜兩段回檔、兩次收復、兩次跨年、3 個空檔');
const S1_ROWS = [
  { 日期: '20240101', 總資產: 4800000, 備註: '' },
  { 日期: '20240201', 總資產: 5200000, 備註: '加碼 0050 兩張' },
  { 日期: '20240301', 總資產: 10000000, 備註: '' },
  { 日期: '20240401', 總資產: 11000000, 備註: '' },
  { 日期: '20240701', 總資產: 9000000, 備註: '' },
  { 日期: '20240801', 總資產: 7500000, 備註: '' },
  { 日期: '20250101', 總資產: 11500000, 備註: '' },
  { 日期: '20250201', 總資產: 7000000, 備註: '' },
  { 日期: '20260101', 總資產: 20000000, 備註: '年終結算：含質押借款與投入本金，毛資產口徑已確認' }
];
const s1 = M.toReplaySeries(S1_ROWS);
const e1 = M.buildReplayEvents(s1, []);   // 注入空清單：這組只驗 ①～⑦

console.log('  — 序列正規化（只讀 日期／總資產／備註）');
chk('筆數', s1.length, 9);
chk('第一筆年份', s1[0].year, 2024);
chk('最後一筆年份', s1[8].year, 2026);
chk('第一筆毛資產', s1[0].value, 4800000);
chk('最後一筆毛資產', s1[8].value, 20000000);
chk('YYYYMMDD 解析後排序未變（仍由舊到新）',
  s1.every((p, i) => i === 0 || p.ts >= s1[i - 1].ts), true);

console.log('  — 空檔（間隔 > 60 天 → 虛線「無紀錄」）');
chk('空檔索引', JSON.stringify(M.buildReplayGaps(s1)), '[4,6,8]');
chk('空檔數', M.buildReplayGaps(s1).length, 3);
chk('i3→i4 間隔天數', M.replayDayDiff(s1[3].ts, s1[4].ts), 91);
chk('i5→i6 間隔天數', M.replayDayDiff(s1[5].ts, s1[6].ts), 153);
chk('i7→i8 間隔天數', M.replayDayDiff(s1[7].ts, s1[8].ts), 334);
chk('i1→i2 間隔天數（閏年 2 月）', M.replayDayDiff(s1[1].ts, s1[2].ts), 29);

console.log('  — 每筆的事件組合與勝出者');
chk('i0 事件', types(e1, 0), '');
chk('i0 勝出者', winner(e1, 0), 'null');
chk('i1 事件（關卡＋備註）', types(e1, 1), 'milestone,note');
chk('i1 勝出者', winner(e1, 1), 'milestone');
chk('i2 事件', types(e1, 2), 'milestone');
chk('i3 事件（1100 萬未達新關卡）', types(e1, 3), '');
chk('i4 事件', types(e1, 4), 'crash');
chk('i5 事件（大跌＋谷底）', types(e1, 5), 'crash,trough');
chk('i5 勝出者（大跌壓過谷底）', winner(e1, 5), 'crash');
chk('i6 事件（收復＋跨年）', types(e1, 6), 'recover,year');
chk('i6 勝出者（收復壓過跨年）', winner(e1, 6), 'recover');
chk('i7 事件（大跌＋谷底）', types(e1, 7), 'crash,trough');
chk('i8 事件（關卡＋收復＋跨年＋備註＋最後一筆）',
  types(e1, 8), 'milestone,recover,year,note,final');
chk('i8 勝出者（最後一筆最高）', winner(e1, 8), 'final');

console.log('  — ① 整數關卡');
chk('i1 關卡金額', find(e1, 1, 'milestone').level, 5000000);
chk('i2 關卡金額', find(e1, 2, 'milestone').level, 10000000);
chk('i8 關卡金額（跳過 1500 萬取最高級）', find(e1, 8, 'milestone').level, 20000000);

console.log('  — ② 大跌（每段一次，創新高後重置，同筆跨多級取最深）');
chk('i4 級距', find(e1, 4, 'crash').tier, 0.1);
near('i4 實際回檔', find(e1, 4, 'crash').drawdown, 0.181818, 1e-5);
chk('i5 級距（跨越 20% 與 30% → 取 30%）', find(e1, 5, 'crash').tier, 0.3);
near('i5 實際回檔', find(e1, 5, 'crash').drawdown, 0.318182, 1e-5);
chk('i7 級距（創新高後重置，再次觸發 30%）', find(e1, 7, 'crash').tier, 0.3);
near('i7 實際回檔', find(e1, 7, 'crash').drawdown, 0.391304, 1e-5);
chk('全序列大跌次數（第一段 −10%／−30% 共 2 次，第二段 1 次）',
  e1.reduce((a, l) => a + l.filter((x) => x.type === 'crash').length, 0), 3);

console.log('  — ③ 谷底（每段回檔 ≥ 10% 的最低點）');
chk('第一段谷底在 i5', find(e1, 5, 'trough').value, 7500000);
near('第一段谷底幅度', find(e1, 5, 'trough').drawdown, 0.318182, 1e-5);
chk('第二段谷底在 i7', find(e1, 7, 'trough').value, 7000000);
near('第二段谷底幅度', find(e1, 7, 'trough').drawdown, 0.391304, 1e-5);
chk('全序列谷底次數',
  e1.reduce((a, l) => a + l.filter((x) => x.type === 'trough').length, 0), 2);

console.log('  — ④ 收復前高（N = 前高日→收復日）');
chk('i6 收復歷時天數', find(e1, 6, 'recover').days, 275);
chk('i6 收復的前高', find(e1, 6, 'recover').peakValue, 11000000);
chk('i8 收復歷時天數', find(e1, 8, 'recover').days, 365);
chk('i8 收復的前高', find(e1, 8, 'recover').peakValue, 11500000);

console.log('  — ⑤ 跨年（剛結束那年 vs 其前一年的最後一筆）');
chk('i6 年份字卡', find(e1, 6, 'year').year, 2025);
chk('i6 結算的年度', find(e1, 6, 'year').closedYear, 2024);
chk('i6 增減（750 萬 − 第一筆 480 萬）', find(e1, 6, 'year').delta, 2700000);
chk('i6 以第一筆為基準', find(e1, 6, 'year').basisIsFirst, true);
chk('i8 年份字卡', find(e1, 8, 'year').year, 2026);
chk('i8 結算的年度', find(e1, 8, 'year').closedYear, 2025);
chk('i8 增減（700 萬 − 750 萬）', find(e1, 8, 'year').delta, -500000);
chk('i8 不以第一筆為基準', find(e1, 8, 'year').basisIsFirst, false);
chk('全序列跨年次數',
  e1.reduce((a, l) => a + l.filter((x) => x.type === 'year').length, 0), 2);

console.log('  — ⑥ 備註（> 20 字截斷加…）');
chk('i1 備註原樣（10 字）', find(e1, 1, 'note').text, '加碼 0050 兩張');
chk('i8 備註截斷為 20 字 + …', find(e1, 8, 'note').text, '年終結算：含質押借款與投入本金，毛資產口…');
chk('i8 備註顯示長度', find(e1, 8, 'note').text.length, 21);
chk('空備註不產生事件',
  e1.reduce((a, l) => a + l.filter((x) => x.type === 'note').length, 0), 2);

console.log('  — ⑦ 最後一筆');
chk('只有最後一筆有 final',
  e1.map((l, i) => l.some((x) => x.type === 'final') ? i : -1).filter((i) => i >= 0).join(','), '8');

console.log('');
console.log('【假序列 S2】7 筆｜10% 整的邊界、谷底單獨勝出、淺回檔不算收復');
const S2_ROWS = [
  { 日期: '20260105', 總資產: 10000000, 備註: '' },
  { 日期: '20260205', 總資產: 11000000, 備註: '' },
  { 日期: '20260305', 總資產: 9900000, 備註: '' },
  { 日期: '20260405', 總資產: 9500000, 備註: '' },
  { 日期: '20260505', 總資產: 11200000, 備註: '' },
  { 日期: '20260605', 總資產: 10800000, 備註: '' },
  { 日期: '20260705', 總資產: 11300000, 備註: '' }
];
const s2 = M.toReplaySeries(S2_ROWS);
const e2 = M.buildReplayEvents(s2, []);   // 同上

chk('無空檔', JSON.stringify(M.buildReplayGaps(s2)), '[]');
chk('i0 事件（第一筆也算首次 ≥ 1000 萬）', types(e2, 0), 'milestone');
chk('i0 關卡金額', find(e2, 0, 'milestone').level, 10000000);
chk('i1 事件（1100 萬未達新關卡）', types(e2, 1), '');
chk('i2 事件（回檔正好 10.0000% → 用 ≥ 判定）', types(e2, 2), 'crash');
chk('i2 級距', find(e2, 2, 'crash').tier, 0.1);
near('i2 實際回檔（正好 10%）', find(e2, 2, 'crash').drawdown, 0.1, 1e-9);
chk('i3 事件（未跨新級距，只有谷底）', types(e2, 3), 'trough');
chk('i3 勝出者（谷底單獨勝出）', winner(e2, 3), 'trough');
chk('i3 谷底金額', find(e2, 3, 'trough').value, 9500000);
near('i3 谷底幅度', find(e2, 3, 'trough').drawdown, 0.136364, 1e-5);
chk('i4 事件（收復前高）', types(e2, 4), 'recover');
chk('i4 收復歷時天數', find(e2, 4, 'recover').days, 89);
chk('i5 事件（回檔 3.57% 未達級距）', types(e2, 5), '');
chk('i6 事件（淺回檔不算收復，只有最後一筆）', types(e2, 6), 'final');
chk('全序列收復次數（淺回檔那次不算）',
  e2.reduce((a, l) => a + l.filter((x) => x.type === 'recover').length, 0), 1);
chk('全序列谷底次數（淺回檔那段無谷底）',
  e2.reduce((a, l) => a + l.filter((x) => x.type === 'trough').length, 0), 1);

console.log('');
console.log('【假序列 S3】台股大漲大跌的掛載規則（注入自訂清單，與寫死快照無關）');
/* 手推：
   資產紀錄 i0 20260301／i1 20260401／i2 20260501／i3 20260601（間隔 31／30／31 天，無空檔）
   注入 6 筆台股紀錄：
     A 20260304 −1494.77 點 → 之後第一筆是 i1（20260401）
     B 20260311 +1342.32 點 → 之後第一筆也是 i1 → 與 A 同格，
                              取漲跌點絕對值較大者 → A 留下、B 捨棄
     C 20260501   +500.00 點 → 與 i2 同日 → 掛 i2
     D 20260215 −9999.00 點 → 早於第一筆 → 區間外，略過
     E 20260701   +888.00 點 → 晚於最後一筆 → 區間外，略過
     F 20260301   −777.00 點 → 與 i0 同日 → 第一筆「只有同日才掛」，成立 → 掛 i0
   其他事件：i0 的 1000 萬觸發關卡；全程遞增無回檔、同年、無備註；i3 是最後一筆。
   故 i0 = 關卡＋台股（關卡勝，⑤ > ②）、i1 = 台股、i2 = 台股、i3 = 最後一筆。 */
const S3_ROWS = [
  { 日期: '20260301', 總資產: 10000000, 備註: '' },
  { 日期: '20260401', 總資產: 10200000, 備註: '' },
  { 日期: '20260501', 總資產: 10400000, 備註: '' },
  { 日期: '20260601', 總資產: 10600000, 備註: '' }
];
const S3_DAYS = [
  ['20260304', -1494.77, -4.35, 6],
  ['20260311', 1342.32, 4.10, 4],
  ['20260501', 500.00, 1.00, 9],
  ['20260215', -9999.00, -9.00, 1],
  ['20260701', 888.00, 2.00, 3],
  ['20260301', -777.00, -1.00, 5]
];
const s3 = M.toReplaySeries(S3_ROWS);
const e3 = M.buildReplayEvents(s3, S3_DAYS);

chk('i0 事件（關卡＋同日台股）', types(e3, 0), 'milestone,market');
chk('i0 勝出者（關卡壓過台股）', winner(e3, 0), 'milestone');
chk('i0 掛的是同日那筆', find(e3, 0, 'market').date, '20260301');
chk('i1 事件', types(e3, 1), 'market');
chk('i1 勝出者', winner(e3, 1), 'market');
chk('i1 掛到「之後第一筆」（3/04 → 4/01）', find(e3, 1, 'market').date, '20260304');
chk('   └ 同格取絕對值較大者（捨棄 3/11 的 +1342）', find(e3, 1, 'market').points, -1494.77);
chk('   └ 跌幅%', find(e3, 1, 'market').pct, -4.35);
chk('   └ 排名', find(e3, 1, 'market').rank, 6);
chk('i2 事件（與資產紀錄同日）', types(e3, 2), 'market');
chk('i2 掛的是 5/01', find(e3, 2, 'market').date, '20260501');
chk('i3 事件（最後一筆，無台股）', types(e3, 3), 'final');
chk('區間外的兩筆被略過（總數 3 不是 5）',
  e3.reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 3);
chk('   └ 早於第一筆的 2/15 沒掛上',
  JSON.stringify(e3).indexOf('20260215'), -1);
chk('   └ 晚於最後一筆的 7/01 沒掛上',
  JSON.stringify(e3).indexOf('20260701'), -1);
chk('第一筆非同日則不掛',
  M.buildReplayEvents(s3, [['20260215', -9999, -9, 1]])
    .reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 0);
chk('注入空清單 → 完全沒有台股事件',
  M.buildReplayEvents(s3, []).reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 0);
chk('注入 null → 當作沒有，不得炸掉',
  M.buildReplayEvents(s3, null).reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 0);
chk('單筆序列不掛台股',
  M.attachMarketExtremes(M.toReplaySeries([S3_ROWS[0]]), [[]], S3_DAYS)[0].length, 0);

console.log('');
console.log('【假序列 S4】顯式傳入寫死的 TWSE 快照（第 3 輪起預設不掛台股，見下方 A）');
/* 手推：資產紀錄 i0 20240701／i1 20240901／i2 20250501
   落在 20240701～20250501 區間內的寫死紀錄：
     20240805 −1807.21、20240807 +794.26 → 之後第一筆都是 i1（20240901）
       → 同格取絕對值較大者 → 20240805
     20250407 −2065.87、20250409 −1068.19、20250410 +1608.27、20250423 +845.71
       → 之後第一筆都是 i2（20250501）→ 取 20250407
     20210518 早於區間、20251120 及之後的全部晚於區間 → 略過
   其他事件：間隔 62／242 天 → 兩段都是空檔；
     i2 是 2025 第一筆 → 跨年，剛結束的 2024 最後一筆 = i1 110 萬，
     2023 無資料 → 對比第一筆 100 萬 → 增減 +10 萬；
     全部 < 500 萬 → 無關卡；i2 是最後一筆。 */
const s4 = M.toReplaySeries([
  { 日期: '20240701', 總資產: 1000000, 備註: '' },
  { 日期: '20240901', 總資產: 1100000, 備註: '' },
  { 日期: '20250501', 總資產: 1200000, 備註: '' }
]);
/* 第 3 輪結構調整：原本靠「不帶第二引數」吃預設快照；預設已改為不掛台股，
   改成顯式傳入 K.TWSE，手推過程與預期值完全不變。 */
const e4 = M.buildReplayEvents(s4, K.TWSE);

chk('空檔索引（62 天與 242 天）', JSON.stringify(M.buildReplayGaps(s4)), '[1,2]');
chk('i0 事件', types(e4, 0), '');
chk('i1 事件', types(e4, 1), 'market');
chk('i1 掛到 2024/08/05（史上第 3 大跌點）', find(e4, 1, 'market').date, '20240805');
chk('   └ 跌點', find(e4, 1, 'market').points, -1807.21);
chk('   └ 跌幅%', find(e4, 1, 'market').pct, -8.35);
chk('   └ 同格的 08/07 漲點被蓋掉', JSON.stringify(e4).indexOf('20240807'), -1);
chk('i2 事件（跨年＋台股＋最後一筆）', types(e4, 2), 'year,market,final');
chk('i2 勝出者（最後一筆最高）', winner(e4, 2), 'final');
chk('i2 掛到 2025/04/07（史上第 2 大跌點）', find(e4, 2, 'market').date, '20250407');
chk('   └ 跌點', find(e4, 2, 'market').points, -2065.87);
chk('   └ 同格另外三筆被蓋掉',
  ['20250409', '20250410', '20250423'].every((d) => JSON.stringify(e4).indexOf(d) < 0), true);
chk('i2 跨年增減仍正確（110 萬 − 100 萬）', find(e4, 2, 'year').delta, 100000);
chk('全序列台股事件數', e4.reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 2);

console.log('');
console.log('【空檔判定邊界】');
const ts = (ymd) => M.toReplaySeries([{ 日期: ymd, 總資產: 0, 備註: '' }])[0].ts;
chk('正好 60 天 → 不是空檔', M.isReplayGap(ts('20260101'), ts('20260302')), false);
chk('   └ 確認是 60 天', M.replayDayDiff(ts('20260101'), ts('20260302')), 60);
chk('61 天 → 是空檔', M.isReplayGap(ts('20260101'), ts('20260303')), true);
chk('   └ 確認是 61 天', M.replayDayDiff(ts('20260101'), ts('20260303')), 61);
chk('同一天 → 不是空檔', M.isReplayGap(ts('20260101'), ts('20260101')), false);

console.log('');
console.log('【備註截斷】');
chk('空字串 → 無備註', M.truncateReplayNote(''), '');
chk('null → 無備註', M.truncateReplayNote(null), '');
chk('純空白 → 無備註', M.truncateReplayNote('   '), '');
chk('正好 20 字 → 原樣', M.truncateReplayNote('一二三四五六七八九十一二三四五六七八九十'), '一二三四五六七八九十一二三四五六七八九十');
chk('21 字 → 前 20 字 + …', M.truncateReplayNote('一二三四五六七八九十一二三四五六七八九十壹'), '一二三四五六七八九十一二三四五六七八九十…');
chk('前後空白會去掉', M.truncateReplayNote('  加碼  '), '加碼');

console.log('');
console.log('【播放時間：依筆數線性調整，夾在 8～20 秒】');
chk('9 筆 → 夾到下限', M.calcReplayDuration(9), 8000);
chk('36 筆（7,920ms）→ 夾到下限', M.calcReplayDuration(36), 8000);
chk('37 筆 → 8,140ms（未被夾）', M.calcReplayDuration(37), 8140);
chk('90 筆 → 19,800ms（未被夾）', M.calcReplayDuration(90), 19800);
chk('91 筆（20,020ms）→ 夾到上限', M.calcReplayDuration(91), 20000);
chk('300 筆 → 夾到上限', M.calcReplayDuration(300), 20000);
chk('0 筆 → 下限（不得為 0 或 NaN）', M.calcReplayDuration(0), 8000);
chk('空值 → 下限（不得為 NaN）', M.calcReplayDuration(null), 8000);

console.log('');
console.log('【優先度：同一筆多事件只顯示最高者】');
const ALL = [
  { type: 'note' }, { type: 'market' }, { type: 'year' }, { type: 'trough' },
  { type: 'milestone' }, { type: 'crash' }, { type: 'recover' }, { type: 'final' }
];
chk('八種齊發 → 最後一筆', M.pickReplayEvent(ALL).type, 'final');
chk('去掉最後一筆 → 收復前高', M.pickReplayEvent(ALL.slice(0, 7)).type, 'recover');
chk('去掉收復 → 大跌', M.pickReplayEvent(ALL.slice(0, 6)).type, 'crash');
chk('去掉大跌 → 整數關卡', M.pickReplayEvent(ALL.slice(0, 5)).type, 'milestone');
chk('去掉關卡 → 谷底', M.pickReplayEvent(ALL.slice(0, 4)).type, 'trough');
chk('去掉谷底 → 跨年', M.pickReplayEvent(ALL.slice(0, 3)).type, 'year');
chk('去掉跨年 → 台股大漲大跌', M.pickReplayEvent(ALL.slice(0, 2)).type, 'market');
chk('只剩備註 → 備註', M.pickReplayEvent(ALL.slice(0, 1)).type, 'note');
chk('空清單 → null', M.pickReplayEvent([]), null);
chk('非陣列 → null', M.pickReplayEvent(undefined), null);

console.log('');
console.log('【邊界防呆：0／空值／單筆／亂序欄位】');
chk('空陣列 → 無序列', M.toReplaySeries([]).length, 0);
chk('非陣列 → 無序列', M.toReplaySeries(null).length, 0);
chk('空陣列 → 無事件', M.buildReplayEvents([]).length, 0);
chk('單筆 → 不產生任何事件（含 final）',
  JSON.stringify(M.buildReplayEvents(M.toReplaySeries([S1_ROWS[0]]), [])), '[[]]');
chk('單筆 → 無空檔', M.buildReplayGaps(M.toReplaySeries([S1_ROWS[0]])).length, 0);
chk('總資產為空字串 → 當 0 不當 NaN',
  M.toReplaySeries([{ 日期: '20260101', 總資產: '', 備註: '' }])[0].value, 0);
chk('總資產為字串數字 → 轉成數字',
  M.toReplaySeries([{ 日期: '20260101', 總資產: '12345', 備註: '' }])[0].value, 12345);
chk('備註為 undefined → 空字串',
  M.toReplaySeries([{ 日期: '20260101', 總資產: 1 }])[0].note, '');
chk('全程 0 資產不觸發關卡或大跌',
  JSON.stringify(M.buildReplayEvents(M.toReplaySeries([
    { 日期: '20260101', 總資產: 0, 備註: '' },
    { 日期: '20260201', 總資產: 0, 備註: '' }
  ]), []).map((l) => l.map((x) => x.type).join('|'))), '["","final"]');

console.log('');
console.log('【資源上限】粒子總數與 devicePixelRatio');
chk('粒子總數上限', K.MAX_PARTICLES, 400);
chk('devicePixelRatio 上限', K.MAX_DPR, 2);
/* 手推：還能生的數量 = min(想生的, 上限 − 現有)，再夾到 0 以上。 */
chk('空的時候想生 40 → 生 40', M.replaySpawnCount(0, 40), 40);
chk('已有 100 想生 40 → 生 40', M.replaySpawnCount(100, 40), 40);
chk('已有 380 想生 40 → 只生 20（補到 400）', M.replaySpawnCount(380, 40), 20);
chk('已有 400 想生 40 → 一顆都不生', M.replaySpawnCount(400, 40), 0);
chk('已有 500（超量）→ 不生，且不得回負數', M.replaySpawnCount(500, 40), 0);
chk('想生 0 → 0', M.replaySpawnCount(100, 0), 0);
chk('想生負數 → 0', M.replaySpawnCount(100, -5), 0);
chk('現有為空值 → 當 0 不當 NaN', M.replaySpawnCount(null, 40), 40);
chk('結尾一次想生 120，空的時候全給', M.replaySpawnCount(0, 120), 120);
/* 手推：dpr 夾在 1～2；小於 1、非數字、空值一律當 1。 */
chk('dpr 1 → 1', M.replayDpr(1), 1);
chk('dpr 2 → 2', M.replayDpr(2), 2);
chk('dpr 3（高 DPI）→ 夾到 2', M.replayDpr(3), 2);
chk('dpr 1.5 → 1.5（未被夾）', M.replayDpr(1.5), 1.5);
chk('dpr 0.75 → 1', M.replayDpr(0.75), 1);
chk('dpr 0 → 1', M.replayDpr(0), 1);
chk('dpr undefined → 1', M.replayDpr(undefined), 1);
chk('dpr NaN → 1', M.replayDpr(NaN), 1);

console.log('');
console.log('【配色：紅漲綠跌】');
chk('較第一筆 正值紅、負值綠',
  /color: pct >= 0 \? REPLAY_RED : REPLAY_GREEN/.test(H), true);
chk('台股字卡 漲紅跌綠', /tone: up \? REPLAY_RED : REPLAY_GREEN,/.test(H), true);
chk('大跌字卡 主字為閃電色', /tone: REPLAY_BOLT, glow: REPLAY_BOLT_GLOW, subTone: REPLAY_GREEN/.test(H), true);
chk('   └ 閃電核心色 #BFD8FF', /const REPLAY_BOLT = '#BFD8FF';/.test(H), true);
chk('   └ 閃電外暈色 #7AA2FF', /const REPLAY_BOLT_GLOW = '#7AA2FF';/.test(H), true);
chk('谷底仍為綠', /type: 'trough'[\s\S]{0,120}?tone: REPLAY_GREEN|tone: REPLAY_GREEN, main: '谷底'/.test(H), true);
chk('金色用途未變（關卡／收復／跨年／結束）',
  (H.match(/tone: REPLAY_GOLD/g) || []).length, 4);
chk('字卡渲染吃 glow 與 subTone',
  /textShadow: '0 0 20px ' \+ \(ct\.glow \|\| ct\.tone\)/.test(H)
  && /color: ct\.subTone \|\| 'rgba\(255,255,255,0\.75\)'/.test(H), true);

console.log('');
console.log('【卸載清理】');
/* 第 2 輪把震動改成分級（−10／−20／−30 各自的 shakeMs），
   登記 timeout 的寫法改為 addTimer；判定的性質與預期值不變。 */
chk('震動的 timeout 有被記下來',
  /const addTimer = \(fn, ms\) => \{ timers\.push\(window\.setTimeout\(fn, ms\)\); \}/.test(H), true);
chk('   └ 震動復原走 addTimer（依級距時間）',
  /addTimer\(\(\) => setShakeLv\(0\), spec\.shakeMs\)/.test(H), true);
chk('   └ 清理時全部 clearTimeout', /timers\.forEach\(\(id\) => window\.clearTimeout\(id\)\)/.test(H), true);
chk('   └ 清理時歸零震動（不殘留到下次開啟）',
  /cancelAnimationFrame\(raf\);[\s\S]{0,900}?setShakeLv\(0\);/.test(H), true);
chk('粒子生成有套上限', /const room = replaySpawnCount\(partsRef\.current\.length, count\);/.test(H), true);
/* 第 2 輪多了一處畫布（reduced 的靜態畫面），三處改成共用一個尺寸函式，
   斷言從「數有幾處」改為「只有那個共用函式讀得到 devicePixelRatio」。 */
chk('畫布尺寸一律走夾過 dpr 的共用函式',
  /const replayFitCanvas = \(cv\) => \{[\s\S]{0,160}?const dpr = replayDpr\(window\.devicePixelRatio\);/.test(H), true);
chk('   └ 全檔只有共用函式讀 devicePixelRatio',
  (H.match(/window\.devicePixelRatio/g) || []).length, 1);
chk('已無未夾的 devicePixelRatio', /devicePixelRatio \|\| 1/.test(H), false);

console.log('');
console.log('【非範圍：沒有動到既有內容】');
chk('沒有新增任何後端寫入動作', /ASSET_REPLAY[\s\S]{0,4000}?gasRouter/.test(
  H.slice(H.indexOf('const ASSET_REPLAY_DAY_MS'), H.indexOf('const AssetTerminal'))), false);
chk('回放只讀 總資產 欄位（未改 FIELD_MAP）',
  /const FIELD_MAP = \{ total: '總資產', tw: '台股', us: '美股', crypto: '加密貨幣' \};/.test(H), true);
chk('未引入任何煙火／動畫函式庫',
  /confetti|fireworks|party-js|canvas-confetti/i.test(H), false);
chk('回放元件以 portal 掛到 body（不影響既有版型）',
  /ReactDOM\.createPortal\(\s*<AssetReplayModal/.test(H), true);
chk('prefers-reduced-motion 有被處理', /prefers-reduced-motion/.test(H), true);
chk('開啟時鎖背景捲動', /document\.body\.style\.overflow = 'hidden'/.test(H), true);
chk('關閉時還原背景捲動（不是寫死成 auto）',
  /const prev = document\.body\.style\.overflow;[\s\S]{0,200}?document\.body\.style\.overflow = prev;/.test(H), true);
/* 迴歸：開啟當下要把 data 快照起來。
   若直接把 data 傳進去，資料載入後的第二次更新會換掉 series 的身分，
   播放 effect 重跑 → 從頭重播。實跑時確實重現過。 */
chk('回放吃的是開啟當下的快照，不是即時的 data',
  /rows=\{replaySnapshot\}/.test(H), true);
chk('   └ 快照在按下按鈕時取得', /onClick=\{\(\) => setReplaySnapshot\(data\)\}/.test(H), true);
chk('   └ 關閉時清掉快照', /onClose=\{\(\) => setReplaySnapshot\(null\)\}/.test(H), true);
chk('台股資料是寫死快照，未新增任何抓取請求',
  /TWSE_EXTREME_DAYS[\s\S]{0,1500}?(fetch\(|gasRouter)/.test(H), false);
chk('畫面會標註台股快照的資料日期',
  /資料截至 ' \+ TWSE_EXTREME_AS_OF/.test(H), true);

console.log('');
console.log('【第 2 輪 B｜滑順補間】replayLerp / replayProgress');
/* 手推：lerp = a + (b−a)×t，t 夾在 0～1。 */
chk('t=0 → 起點', M.replayLerp(0, 100, 0), 0);
chk('t=0.5 → 中點', M.replayLerp(0, 100, 0.5), 50);
chk('t=1 → 終點', M.replayLerp(0, 100, 1), 100);
chk('反向 t=0.25：100→0 取 75', M.replayLerp(100, 0, 0.25), 75);
chk('兩筆資產值取中點（480萬→520萬）', M.replayLerp(4800000, 5200000, 0.5), 5000000);
chk('t=−1（越界）→ 夾成 0 → 起點', M.replayLerp(0, 100, -1), 0);
chk('t=2（越界）→ 夾成 1 → 終點', M.replayLerp(0, 100, 2), 100);
chk('t 非數值 → 回傳起點', M.replayLerp(7, 100, NaN), 7);
chk('端點非數值 → 0（不回 NaN）', M.replayLerp(NaN, 100, 0.5), 0);
chk('兩端相同 → 不管 t 都是該值', M.replayLerp(5, 5, 0.37), 5);

/* 手推：i = floor(prog)、frac = prog − i；
   prog ≥ 最後一筆索引時沒有「下一筆」可補間 → frac 固定 0。 */
const pg = (p, n) => { const r = M.replayProgress(p, n); return r.i + '|' + r.frac; };
chk('prog 0（9 筆）→ i=0 frac=0', pg(0, 9), '0|0');
chk('prog 0.5 → i=0 frac=0.5', pg(0.5, 9), '0|0.5');
chk('prog 3.25 → i=3 frac=0.25', pg(3.25, 9), '3|0.25');
chk('prog 8（最後一筆）→ i=8 frac=0', pg(8, 9), '8|0');
chk('prog 8.9（越界）→ 夾回 i=8 frac=0', pg(8.9, 9), '8|0');
chk('prog 負數 → i=0 frac=0', pg(-2, 9), '0|0');
chk('prog NaN → i=0 frac=0', pg(NaN, 9), '0|0');
chk('只有 1 筆 → i=0 frac=0', pg(4, 1), '0|0');
chk('0 筆 → i=0 frac=0', pg(4, 0), '0|0');

console.log('');
console.log('【第 2 輪 D｜閃電】replayBoltSpec / buildLightningPath');
/* 手推（出自工單 D）：
   −10% → 1 道、無分岔、輕震；−20% → 2 道、間隔 150ms、震動加強；
   −30% → 3 道、1～2 條分岔、殘留電弧 400ms、長震動。 */
const spec = (t) => { const o = M.replayBoltSpec(t); return [o.bolts, o.branches, o.gapMs, o.shakeMs, o.arcMs].join('|'); };
chk('−10% 級距', spec(0.10), '1|0|0|260|0');
chk('−20% 級距', spec(0.20), '2|0|150|420|0');
chk('−30% 級距', spec(0.30), '3|2|150|700|400');
chk('比 −30% 更深（0.45）→ 仍套 −30% 規格', spec(0.45), '3|2|150|700|400');
chk('未達 −20%（0.15）→ 套 −10% 規格', spec(0.15), '1|0|0|260|0');
chk('0 → 套最輕規格', spec(0), '1|0|0|260|0');
chk('級距 3 的道數 > 級距 1', M.replayBoltSpec(0.30).bolts > M.replayBoltSpec(0.10).bolts, true);
chk('只有級距 3 有分岔', M.replayBoltSpec(0.20).branches, 0);
chk('只有級距 3 有殘留電弧', M.replayBoltSpec(0.20).arcMs, 0);

/* 手推：rnd 固定回 0.5 → 位移 = (0.5−0.5)×2×amp = 0 → 中點不偏移，
   路徑退化成等分的直線。深度 d 的點數 = 2^d + 1。
   由 (0,0) 劈到 (100,200)、depth=2：
     d=0 → (0,0) (50,100) (100,200)
     d=1 → (0,0) (25,50) (50,100) (75,150) (100,200) */
const mid = () => 0.5;
const L2 = M.buildLightningPath(0, 0, 100, 200, { w: 100, h: 200, depth: 2, spread: 40, branches: 0 }, mid);
chk('depth=2 → 5 個點（2^2+1）', L2.points.length, 5);
chk('起點釘在頂端 (0,0)', L2.points[0].x + ',' + L2.points[0].y, '0,0');
chk('終點等於目標座標 (100,200)', L2.points[4].x + ',' + L2.points[4].y, '100,200');
chk('rnd=0.5 → 中間點不偏移（等分直線）',
  L2.points.map((p) => p.x + ',' + p.y).join(' '), '0,0 25,50 50,100 75,150 100,200');
chk('depth=0 → 只有起終點 2 個', M.buildLightningPath(0, 0, 100, 200, { depth: 0 }, mid).points.length, 2);
chk('depth=3 → 9 個點', M.buildLightningPath(0, 0, 100, 200, { depth: 3, spread: 40 }, mid).points.length, 9);
chk('無分岔設定 → 0 條', L2.branches.length, 0);
/* 手推：branches 為上限，實際 = max(1, min(上限, 1+floor(rnd×上限)))。
   rnd=0.5、上限 2 → 1+floor(1) = 2 條；rnd=0、上限 2 → 1+0 = 1 條。 */
chk('級距 3（上限 2）rnd=0.5 → 2 條分岔',
  M.buildLightningPath(0, 0, 100, 200, { w: 100, h: 200, depth: 3, spread: 40, branches: 2 }, mid).branches.length, 2);
chk('級距 3（上限 2）rnd=0 → 1 條分岔',
  M.buildLightningPath(0, 0, 100, 200, { w: 100, h: 200, depth: 3, spread: 40, branches: 2 }, () => 0).branches.length, 1);
chk('上限 1 → 1 條',
  M.buildLightningPath(0, 0, 100, 200, { w: 100, h: 200, depth: 3, spread: 40, branches: 1 }, mid).branches.length, 1);
/* 手推：rnd 固定回 1 → 位移 = (1−0.5)×2×amp = amp。
   由 (50,0) 垂直劈到 (50,200)、depth=1、spread=1000：
   dx=0 dy=200 len=200 → 中點 x = 50 + (−200/200)×1000 = −950 → 夾到 0。 */
const LC = M.buildLightningPath(50, 0, 50, 200, { w: 100, h: 200, depth: 1, spread: 1000, branches: 0 }, () => 1);
chk('超出畫布的中間點被夾到左緣 0', LC.points[1].x, 0);
chk('所有點都落在畫布範圍內',
  LC.points.every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 200), true);
chk('   └ 起終點不受夾擠影響',
  LC.points[0].x + ',' + LC.points[0].y + ' ' + LC.points[2].x + ',' + LC.points[2].y, '50,0 50,200');

console.log('');
console.log('【第 2 輪 G｜結尾總結】buildReplaySummary');
/* 手推 S1（9 筆，20240101 → 20260101，480 萬 → 2000 萬）：
   · 歷時：2024/01→2026/01 = 24 個月，訖日的「日」= 起日的「日」→ 不扣
           → 2 年 0 個月；天數 = 366（2024 閏年）+ 365 = 731 天
   · 累積 = (2000−480) 萬 = +1520 萬；% = 1520/480 = 316.666667%
   · 最深回檔：前高 1150 萬（i6）→ i7 700 萬
       = (1150−700)/1150 = 39.130435%（深於第一段的 31.818182%）
   · 創歷史新高次數（第一筆不算）：i1 520、i2 1000、i3 1100、i6 1150、
       i8 2000 → 5 次
   · 撐過 ≥10% 回檔 = recover 事件數 = i6、i8 → 2 次 */
const sum1 = M.buildReplaySummary(s1, e1);
chk('S1 起日 ts 等於第一筆', sum1.fromTs, s1[0].ts);
chk('S1 訖日 ts 等於最後一筆', sum1.toTs, s1[8].ts);
chk('S1 歷時 年', sum1.years, 2);
chk('S1 歷時 月', sum1.months, 0);
chk('S1 歷時 天', sum1.days, 731);
chk('S1 累積萬數', sum1.deltaWan, 1520);
near('S1 累積 %', sum1.pct, 316.666667, 1e-5);
near('S1 最深回檔', sum1.deepestDd, 0.391304, 1e-5);
chk('S1 創歷史新高次數', sum1.peakCount, 5);
chk('S1 撐過 ≥10% 回檔次數', sum1.survivedCount, 2);

/* 手推 S2（7 筆，20260105 → 20260705，1000 萬 → 1130 萬）：
   · 歷時：2026/01→2026/07 = 6 個月，日相同不扣 → 0 年 6 個月
           天數：1/5 是第 5 天、7/5 是第 186 天（31+28+31+30+31+30+5）
           → 181 天
   · 累積 = +130 萬；% = 130/1000 = 13.0%
   · 最深回檔：前高 1100 萬（i1）→ i3 950 萬
       = (1100−950)/1100 = 13.636364%
   · 創歷史新高：i1 1100、i4 1120、i6 1130 → 3 次
   · 撐過 ≥10% 回檔 = recover 事件數 = 只有 i4（i6 的淺回檔不算）→ 1 次 */
const sum2 = M.buildReplaySummary(s2, e2);
chk('S2 歷時 年', sum2.years, 0);
chk('S2 歷時 月', sum2.months, 6);
chk('S2 歷時 天', sum2.days, 181);
chk('S2 累積萬數', sum2.deltaWan, 130);
near('S2 累積 %', sum2.pct, 13, 1e-9);
near('S2 最深回檔', sum2.deepestDd, 0.136364, 1e-5);
chk('S2 創歷史新高次數', sum2.peakCount, 3);
chk('S2 撐過 ≥10% 回檔次數（淺回檔的收復不算）', sum2.survivedCount, 1);
chk('不足兩筆 → 全部歸零', JSON.stringify(M.buildReplaySummary([], [])),
  JSON.stringify({ fromTs: 0, toTs: 0, years: 0, months: 0, days: 0,
    firstValue: 0, lastValue: 0, deltaWan: 0, pct: 0,
    deepestDd: 0, peakCount: 0, survivedCount: 0 }));
chk('   └ 只有 1 筆也歸零', M.buildReplaySummary([s1[0]], [[]]).days, 0);
chk('events 給 null 也不炸', M.buildReplaySummary(s1, null).survivedCount, 0);

console.log('');
console.log('【第 2 輪 B～H 佈線】');
chk('B 折線頭依時間內插座標',
  /const headTs = replayLerp\(series\[i\]\.ts, nextP\.ts, pr\.frac\);/.test(H)
  && /const headVal = replayLerp\(series\[i\]\.value, nextP\.value, pr\.frac\);/.test(H), true);
chk('B 大字／％／累積萬數改走內插後直接寫 DOM',
  /const writeHead = \(val\) => \{/.test(H) && /writeHead\(headVal\);/.test(H), true);
chk('B 日期只在抵達該筆時切換（吃 idx，不吃內插值）',
  /const cur = series\[idx\];/.test(H) && /formatYMD\(new Date\(cur\.ts\)\)/.test(H), true);
chk('B 歷史高點／最深回檔只算已抵達的紀錄',
  /for \(let k = 0; k <= idx; k\+\+\) \{/.test(H), true);
chk('B 空檔段照樣畫虛線（含補間中的那一段）',
  /const isGap = gaps\.indexOf\(i \+ 1\) >= 0;/.test(H), true);
chk('C 特效錨點＝折線頭換算到特效畫布的座標',
  /headRef\.current = \{ x: head\.x \+ \(a\.left - b\.left\), y: head\.y \+ \(a\.top - b\.top\), ok: true \};/.test(H), true);
chk('D 閃電由頂端隨機 X 劈到折線頭',
  /buildLightningPath\(x0, 0, hd\.x, hd\.y, \{/.test(H), true);
chk('D 白色核心＋藍紫外暈',
  /strokePath\(ctx, bl\.path\.points, 7, REPLAY_BOLT_GLOW, 26\);/.test(H)
  && /strokePath\(ctx, bl\.path\.points, 2\.2, '#FFFFFF', 14\);/.test(H), true);
chk('D 白閃約 80ms 後接短暫壓暗',
  /flashUntilRef\.current, now \+ 80\)/.test(H) && /dimUntilRef\.current, now \+ 80 \+ 240\)/.test(H), true);
chk('D 連劈依級距排程（gapMs）',
  /pendingBoltsRef\.current\.push\(\{ at: now \+ k \* spec\.gapMs, spec: spec \}\);/.test(H), true);
chk('D 台股跌點只畫遠方閃電，不震動不白閃',
  /ev\.type === 'market' && ev\.points < 0/.test(H), true);
chk('E 前高畫成金色水平虛線並標字',
  /ctx\.fillText\('前高 ' \+ Math\.round\(peakRef\.current \/ 10000\)\.toLocaleString\(\) \+ ' 萬'/.test(H), true);
chk('E 暗角與雨絲依回檔濃度漸變',
  /kind: 'rain'/.test(H) && /createRadialGradient/.test(H), true);
chk('E 收復前高時雨停', /rainRef\.current = false;/.test(H), true);
chk('F 煙火由底部升空，到定點才炸開',
  /x: r\.x, y: h, vy: -7\.5 - Math\.random\(\) \* 2, targetY: r\.targetY/.test(H), true);
chk('F 折線頭擴散金色光環',
  /ringsRef\.current\.push\(\{ x: hd\.x, y: hd\.y, born: now, ttl: 760 \}\);/.test(H), true);
chk('F 關卡金額畫短暫金線',
  /goldLineRef\.current = \{ value: ev\.level, until: now \+ 1400 \};/.test(H), true);
chk('G 結尾 3～5 發不同位置的煙火',
  /const shots = 3 \+ Math\.floor\(Math\.random\(\) \* 3\);/.test(H), true);
chk('G 結尾紙屑雨 1.5 秒', /paperUntilRef\.current = now \+ 1500;/.test(H), true);
chk('G 結尾改顯示總結面板', /setShowSummary\(true\);/.test(H) && /回放總結/.test(H), true);
chk('G reduced-motion 也顯示總結面板', /useState\(reduced && enough\)/.test(H), true);
chk('H 點畫面暫停／繼續（播放中才作用）',
  /onClick=\{\(\) => \{ if \(playing\) setPaused\(\(v\) => !v\); \}\}/.test(H), true);
chk('H ✕ 與重播鈕不會誤觸暫停',
  (H.match(/e\.stopPropagation\(\);/g) || []).length >= 2, true);
chk('H 暫停時顯示「已暫停」標示', /❙❙ 已暫停/.test(H), true);
chk('H 暫停只凍結折線與計時，粒子照畫',
  /if \(!pausedRef\.current && !done\) \{/.test(H), true);
chk('I 新特效的粒子一律經過上限檢查',
  /const room = replaySpawnCount\(partsRef\.current\.length, count\);/.test(H)
  && (H.match(/pushParts\(/g) || []).length >= 4, true);
chk('I 卸載時清掉所有特效佇列',
  /boltsRef\.current = \[\];[\s\S]{0,400}?rainAlphaRef\.current = 0;/.test(H), true);
chk('I 卸載時歸零白閃與壓暗的 opacity',
  /if \(flashElRef\.current\) flashElRef\.current\.style\.opacity = '0';/.test(H), true);
chk('未新增任何函式庫（閃電／煙火全自繪）',
  (H.match(/<script src=/g) || []).length, 5);

console.log('');
console.log('【第 3 輪 A｜關閉台股大漲大跌】');
chk('A 常數 ASSET_REPLAY_SHOW_MARKET = false', K.SHOW_MARKET, false);
/* 手推：s4 與上方 S4 相同。預設（不帶第二引數）在旗標為 false 時不掛任何台股事件，
   其餘事件不受影響：i1 原本只有 market → 變空；i2 原本 year,market,final → year,final */
const e4d = M.buildReplayEvents(s4);
chk('A 預設不產生 market 事件',
  e4d.reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 0);
chk('A   └ i1 事件（台股拿掉後為空）', types(e4d, 1), '');
chk('A   └ i2 事件（跨年＋最後一筆不受影響）', types(e4d, 2), 'year,final');
chk('A 顯式傳入清單仍會掛（S4 傳 K.TWSE → 2 筆）',
  e4.reduce((a, l) => a + l.filter((x) => x.type === 'market').length, 0), 2);
chk('A 台股快照與 attachMarketExtremes 保留未刪', K.TWSE.length === 20 && typeof M.attachMarketExtremes === 'function', true);
chk('A 遠方閃電也受旗標控制',
  /ASSET_REPLAY_SHOW_MARKET && ev\.type === 'market' && ev\.points < 0/.test(H), true);

console.log('');
console.log('【第 3 輪 B｜創歷史新高 buildReplayAthCounts】');
/* 定義：第 2 筆起「嚴格大於它之前所有紀錄的最高值」才算創高，回傳累計次數，否則 0。
   S1 值（萬）：480 520 1000 1100 900 750 1150 700 2000
     i1 520>480 → 1；i2 1000>520 → 2；i3 1100>1000 → 3；
     i4 900、i5 750 未超過 1100 → 0；i6 1150>1100 → 4；i7 700 → 0；i8 2000>1150 → 5
   → [0,1,2,3,0,0,4,0,5]，最後一個非 0 的數字 5 ＝ 總結面板的創高次數（上方已手推 5） */
chk('B S1 每筆累計創高', JSON.stringify(M.buildReplayAthCounts(s1)), '[0,1,2,3,0,0,4,0,5]');
chk('B   └ 最終次數與總結面板一致', Math.max.apply(null, M.buildReplayAthCounts(s1)), sum1.peakCount);
/* 持平不算創高：100、100、100 → 只有「大於」才算 → 全 0 */
chk('B 持平不算創高',
  JSON.stringify(M.buildReplayAthCounts(M.toReplaySeries([
    { 日期: '20260101', 總資產: 1000000 }, { 日期: '20260201', 總資產: 1000000 },
    { 日期: '20260301', 總資產: 1000000 }]))), '[0,0,0]');
chk('B 第一筆不算創高（單筆 → [0]）',
  JSON.stringify(M.buildReplayAthCounts(M.toReplaySeries([S1_ROWS[0]]))), '[0]');
chk('B 空／非陣列 → 空陣列', JSON.stringify(M.buildReplayAthCounts(null)), '[]');
chk('B 火花上限 12', K.ATH_SPARKS, 12);
chk('B 火花走 pushParts（受 replaySpawnCount 上限）',
  /pushParts\(ASSET_REPLAY_ATH_SPARKS,/.test(H), true);
chk('B 不放進事件清單（不停留、不搶字卡）',
  JSON.stringify(e1).indexOf('"ath"'), -1);
chk('B 優先度最低', Object.keys(K.PRIORITY).every((k) => k === 'ath' || K.PRIORITY[k] > K.PRIORITY.ath), true);
chk('B 同筆有收復／大關卡／結尾時不另閃金光',
  /ev\.type === 'recover' \|\| ev\.type === 'milestone' \|\| ev\.type === 'final'/.test(H)
  && /if \(!big\) \{\s*athGlowUntilRef\.current = now \+ 300;/.test(H), true);
chk('B 計數取累計值（同筆不重複計）', /setAthN\(athCounts\[j\]\);/.test(H), true);
chk('B 畫面有 NEW HIGH ×N', /NEW HIGH ×\{athN\}/.test(H), true);

console.log('');
console.log('【第 3 輪 C｜小關卡 buildReplayMinorMarks】');
chk('C 小關卡級距 100 萬', K.MINOR, 1000000);
/* 定義：首次達到的最高 100 萬倍數；同一筆已觸發大關卡（事件內有 milestone）→ 該筆記 0，
   但已達到的等級照樣往上記。S1 大關卡在 i1（500 萬）、i2（1000 萬）、i8（2000 萬）。
     i0 480 萬 → 400 萬，首次且無大關卡 → 4,000,000
     i1 520 萬 → 500 萬 > 400 萬，但同筆有大關卡 → 0（等級記到 500 萬）
     i2 1000 萬 → 1000 萬，同筆有大關卡 → 0（記到 1000 萬）
     i3 1100 萬 → 1100 萬 > 1000 萬，無大關卡 → 11,000,000
     i4 900、i5 750 → 900／700 萬，未高於 1100 萬 → 0
     i6 1150 萬 → 1100 萬，未高於已達的 1100 萬 → 0
     i7 700 萬 → 0
     i8 2000 萬 → 2000 萬，同筆有大關卡 → 0 */
chk('C S1 每筆小關卡', JSON.stringify(M.buildReplayMinorMarks(s1, e1)),
  '[4000000,0,0,11000000,0,0,0,0,0]');
/* 不給事件清單（全部視為無大關卡）：i1 500 萬、i2 1000 萬 也會變成小關卡；
   i8 2000 萬 也是 → [4000000,5000000,10000000,11000000,0,0,0,0,20000000] */
chk('C 無事件清單時全部算小關卡', JSON.stringify(M.buildReplayMinorMarks(s1, null)),
  '[4000000,5000000,10000000,11000000,0,0,0,0,20000000]');
/* 未滿 100 萬：99 萬 → 0 */
chk('C 未滿 100 萬不觸發', JSON.stringify(M.buildReplayMinorMarks(M.toReplaySeries([
  { 日期: '20260101', 總資產: 990000 }, { 日期: '20260201', 總資產: 999999 }]), [[], []])), '[0,0]');
chk('C 小關卡不停留、不出字卡（不在事件清單）', JSON.stringify(e1).indexOf('minor'), -1);
chk('C 小關卡：小煙火＋線頭光環',
  /ringsRef\.current\.push\(\{ x: hd\.x, y: hd\.y, born: now, ttl: 520, small: true \}\);/.test(H)
  && /spawnBurst\(r\.small \? 18 : 50,/.test(H), true);

console.log('');
console.log('【第 3 輪 D｜不等速節奏 calcReplayStepDurations】');
chk('D 常數：放慢 1.6／加速 0.6／前後 2 筆／平淡 1%／最後一段 1 秒',
  [K.SLOW, K.FAST, K.RADIUS, K.FLAT, K.FINAL_MS].join('|'), '1.6|0.6|2|0.01|1000');
/* 假序列 S5（14 筆，事件只放在 i4 備註、i13 最後一筆，用手填的事件清單）
   值：i0 100萬 i1 100.5萬 i2 110萬 i3 110萬 i4 120萬 i5 120萬 i6 130萬
       i7 140萬 i8 140萬 i9 141.4萬 i10 142萬 i11 200萬 i12 210萬 i13 220萬
   總長 = calcReplayDuration(14) = max(8000, 14×220=3080) = 8000
   最後一段 d13 = 1000，其餘預算 = 7000，依權重分配給 s=1..12：
     事件附近（與 4 或 13 相距 ≤ 2）：s=2,3,4,5,6（近 4）、s=11,12（近 13）→ 1.6
     s1：(100.5−100)/100 = 0.5% < 1% → 0.6
     s7：(140−130)/130 = 7.69% → 1
     s8：0% → 0.6
     s9：(141.4−140)/140 = 1.0%，不小於 1% → 1（邊界）
     s10：(142−141.4)/141.4 = 0.42% → 0.6
   權重和 = 0.6 + 1.6×5 + 1 + 0.6 + 1 + 0.6 + 1.6×2 = 15
   單位 = 7000 / 15 = 466.6667
     0.6 → 280；1.6 → 746.6667；1 → 466.6667 */
const S5 = M.toReplaySeries([
  1000000, 1005000, 1100000, 1100000, 1200000, 1200000, 1300000,
  1400000, 1400000, 1414000, 1420000, 2000000, 2100000, 2200000
].map((v, k) => ({ 日期: String((2025 + Math.floor(k / 12)) * 10000 + (k % 12 + 1) * 100 + 1), 總資產: v, 備註: '' })));
const E5 = S5.map(() => []);
E5[4] = [{ type: 'note', text: 'x' }];
E5[13] = [{ type: 'final' }];
const D5 = M.calcReplayStepDurations(S5, E5);
chk('D S5 長度', D5.length, 14);
chk('D d0 固定 0', D5[0], 0);
near('D s1 平淡 0.5% → 0.6 倍', D5[1], 280, 1e-6);
near('D s2 事件附近 → 1.6 倍', D5[2], 746.6666667, 1e-6);
near('D s4 事件本身 → 1.6 倍', D5[4], 746.6666667, 1e-6);
near('D s6 事件後第 2 筆 → 1.6 倍', D5[6], 746.6666667, 1e-6);
near('D s7 變動 7.69% → 1 倍', D5[7], 466.6666667, 1e-6);
near('D s8 持平 → 0.6 倍', D5[8], 280, 1e-6);
near('D s9 剛好 1%（不算平淡）→ 1 倍', D5[9], 466.6666667, 1e-6);
near('D s10 0.42% → 0.6 倍', D5[10], 280, 1e-6);
near('D s11 結尾前第 2 筆 → 1.6 倍', D5[11], 746.6666667, 1e-6);
chk('D 最後一段慢動作 1 秒', D5[13], 1000);
near('D 總長仍為 8000', D5.reduce((a, b) => a + b, 0), 8000, 1e-6);
near('D 事件附近 ÷ 平淡 = 1.6 / 0.6', D5[2] / D5[1], 1.6 / 0.6, 1e-9);
/* 假序列 S6（100 筆全部 100 萬持平，只有最後一筆有事件）
   總長 = calcReplayDuration(100) = min(20000, 22000) = 20000；最後一段 1000，預算 19000
   s=97,98 近最後一筆 → 1.6；s=1..96 持平 → 0.6
   權重和 = 96×0.6 + 2×1.6 = 60.8；單位 = 19000 / 60.8 = 312.5
   → 平淡段 187.5、近結尾 500、最後一段 1000；總和 96×187.5 + 2×500 + 1000 = 20000 */
// 每 7 天一筆的真實日期
const S6 = M.toReplaySeries(Array.from({ length: 100 }, (_, k) => {
  const d = new Date(2020, 0, 1 + k * 7);
  return { 日期: String(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()), 總資產: 1000000, 備註: '' };
}));
const E6 = S6.map(() => []);
E6[99] = [{ type: 'final' }];
const D6 = M.calcReplayStepDurations(S6, E6);
chk('D S6 筆數', S6.length, 100);
near('D S6 平淡段 187.5', D6[1], 187.5, 1e-9);
near('D S6 s96 仍是平淡', D6[96], 187.5, 1e-9);
near('D S6 s97 近結尾 500', D6[97], 500, 1e-9);
chk('D S6 最後一段 1000', D6[99], 1000);
near('D S6 總長 20000（上限）', D6.reduce((a, b) => a + b, 0), 20000, 1e-6);
/* 2 筆：唯一一段就是最後一段 → [0, 8000]；1 筆 → [0]；空 → [] */
chk('D 2 筆 → [0,8000]', JSON.stringify(M.calcReplayStepDurations(M.toReplaySeries([
  { 日期: '20260101', 總資產: 1 }, { 日期: '20260201', 總資產: 2 }]), [[], [{ type: 'final' }]])), '[0,8000]');
chk('D 1 筆 → [0]', JSON.stringify(M.calcReplayStepDurations(M.toReplaySeries([S1_ROWS[0]]), [[]])), '[0]');
chk('D 空 → []', JSON.stringify(M.calcReplayStepDurations([], [])), '[]');
chk('D 播放迴圈依段查時長', /const segMs = Math\.max\(1, stepDurs\[Math\.min\(n - 1, fired \+ 1\)\] \|\| 1\);/.test(H), true);

console.log('');
console.log('【第 3 輪 E／F｜結尾不蓋線、電腦版橫式】');
chk('E 結尾曲線先發光 1 秒再出總結面板',
  /finalGlowUntilRef\.current = now \+ ASSET_REPLAY_FINAL_GLOW_MS;/.test(H)
  && /addTimer\(\(\) => \{ setShowSummary\(true\); \}, ASSET_REPLAY_FINAL_GLOW_MS\);/.test(H), true);
chk('E 結尾發光時間 1 秒', K.FINAL_GLOW_MS, 1000);
chk('E 手機總結面板放在曲線區塊之外（不覆蓋 canvas）',
  /\{showSummary && \(\s*<div className="shrink-0 mt-3 pointer-events-none">\{summaryNode\}<\/div>/.test(H), true);
chk('F 電腦版以 900px 為界', /const wideQuery = '\(min-width: 900px\)';/.test(H), true);
chk('F 電腦版折線約 70%／右側欄約 30%',
  /flex: '7 1 0%'/.test(H) && /flex: '3 1 0%'/.test(H), true);
chk('F 電腦版大字以 clamp 隨寬度放大', /fontSize: 'clamp\(48px, 6\.2vw, 120px\)'/.test(H), true);
chk('F 電腦版移除 max-w-md（無兩側大黑邊）',
  /<div className="relative h-full w-full flex flex-col px-10 pt-16 pb-6"/.test(H), true);

console.log('');
console.log('【第 3 輪 G｜回放區所有 canvas 的尺寸都經 replayFitCanvas】');
/* 範圍：回放視窗區塊（REPLAY_BG 宣告到 AssetTerminal 之前）。
   · 尺寸只能在 replayFitCanvas 裡設定：全區塊的 .width = ／.height = 指派只有那一處
   · getContext('2d') 也只有那一處（其他地方拿不到未經 dpr 夾擠的畫布）
   · 兩張回放畫布（lineRef／fxRef）都經 replayFitCanvas 取得繪圖環境 */
const RZ = H.slice(H.indexOf("const REPLAY_BG = '#0D0D0D';"), H.indexOf('    const AssetTerminal = ({ theme'));
const FIT = RZ.slice(RZ.indexOf('const replayFitCanvas = (cv) => {'), RZ.indexOf('const replayGeom = '));
chk('G 回放區有找到 replayFitCanvas', FIT.length > 0, true);
chk('G 尺寸指派只出現在 replayFitCanvas',
  (RZ.match(/\.(width|height) = /g) || []).length === (FIT.match(/\.(width|height) = /g) || []).length
  && (FIT.match(/\.(width|height) = /g) || []).length === 2, true);
chk('G getContext 只出現在 replayFitCanvas',
  (RZ.match(/getContext\(/g) || []).length === 1 && /getContext\(/.test(FIT), true);
chk('G 折線畫布經 replayFitCanvas', /replayFitCanvas\(lineRef\.current\)|const cv = lineRef\.current;\s*const fit = replayFitCanvas\(cv\);/.test(RZ), true);
chk('G 特效畫布經 replayFitCanvas', /replayFitCanvas\(fxRef\.current\)/.test(RZ), true);
/* 寬窄兩版各渲染一次 lineRef（同時只會掛一個），fxRef 在共用外層一次 → 原始碼共 3 處，全部都是這兩個 ref */
chk('G 回放區所有 canvas 都是 lineRef／fxRef（無其他畫布）', (RZ.match(/<canvas ref=\{(lineRef|fxRef)\}/g) || []).length,
  (RZ.match(/<canvas /g) || []).length);
console.log('');
console.log('【第 4 輪｜總結面板：每次收復前高的歷程（buildReplaySummary.recoveries／ongoing）】');
/* 定義（沿用既有事件，不另寫判定）：
   · 每個 recover 事件一段；谷底＝該段的 trough 事件；前高＝收復當下生效的前高筆
   · daysDown＝前高日→谷底日、daysUp＝谷底日→收復日、daysTotal＝前高日→收復日
   · ongoing：最後一個 trough 之後沒有 recover 才有，否則 null

   S1（見檔頭）：
   第 1 段：前高 i3 20240401（1100 萬）、谷底 i5 20240801（750 萬）、收復 i6 20250101
     depth = (1100−750)/1100 = 31.8182%
     daysDown 20240401→20240801 = 30(4月)+31(5月)+30(6月)+31(7月) = 122
     daysUp   20240801→20250101 = 31+30+31+30+31（8～12 月）= 153
     daysTotal = 122 + 153 = 275（＝檔頭手推的 recover N = 275）
   第 2 段：前高 i6 20250101（1150 萬）、谷底 i7 20250201（700 萬）、收復 i8 20260101
     depth = (1150−700)/1150 = 39.1304%
     daysDown 20250101→20250201 = 31
     daysUp   20250201→20260101 = 365 − 31 = 334
     daysTotal = 365（＝檔頭手推的 N = 365）
   最後一筆 i8 為創新高 → 沒有未收復的段 → ongoing = null */
const rec1 = sum1.recoveries || [];
const d8 = (ts) => { const d = new Date(ts); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
chk('S1 收復段數', rec1.length, 2);
chk('S1 段1 前高／谷底／收復日', [rec1[0].peakDate, rec1[0].troughDate, rec1[0].recoverDate].map(d8).join('|'), '20240401|20240801|20250101');
near('S1 段1 回檔深度', rec1[0].depth, 0.318182, 1e-5);
chk('S1 段1 跌到谷底／爬回前高／合計', [rec1[0].daysDown, rec1[0].daysUp, rec1[0].daysTotal].join('|'), '122|153|275');
chk('S1 段2 前高／谷底／收復日', [rec1[1].peakDate, rec1[1].troughDate, rec1[1].recoverDate].map(d8).join('|'), '20250101|20250201|20260101');
near('S1 段2 回檔深度', rec1[1].depth, 0.391304, 1e-5);
chk('S1 段2 跌到谷底／爬回前高／合計', [rec1[1].daysDown, rec1[1].daysUp, rec1[1].daysTotal].join('|'), '31|334|365');
chk('S1 每段 daysDown + daysUp = daysTotal', rec1.every((r) => r.daysDown + r.daysUp === r.daysTotal), true);
chk('S1 daysTotal 等於 recover 字卡的天數',
  [find(e1, 6, 'recover').days, find(e1, 8, 'recover').days].join('|'), rec1.map((r) => r.daysTotal).join('|'));
chk('S1 段數＝撐過次數', rec1.length, sum1.survivedCount);
chk('S1 無未收復段 → ongoing = null', sum1.ongoing, null);

/* S2（見檔頭）：
   第 1 段：前高 i1 20260205（1100 萬）、谷底 i3 20260405（950 萬）、收復 i4 20260505
     depth = (1100−950)/1100 = 13.6364%
     daysDown 20260205→20260405：2/05→3/05 = 28（2026 年 2 月非閏）、3/05→4/05 = 31 → 59
     daysUp   20260405→20260505 = 30
     daysTotal = 89（＝檔頭手推 N = 89）
   第 2 段 i5 只回檔 3.5714% < 10% → 沒有 trough／recover，不列入；
   i6 回到前高之上 → 最後沒有未收復段 → ongoing = null */
const rec2 = sum2.recoveries || [];
chk('S2 收復段數（淺回檔不列）', rec2.length, 1);
chk('S2 段1 前高／谷底／收復日', [rec2[0].peakDate, rec2[0].troughDate, rec2[0].recoverDate].map(d8).join('|'), '20260205|20260405|20260505');
near('S2 段1 回檔深度', rec2[0].depth, 0.136364, 1e-5);
chk('S2 段1 跌到谷底／爬回前高／合計', [rec2[0].daysDown, rec2[0].daysUp, rec2[0].daysTotal].join('|'), '59|30|89');
chk('S2 daysTotal 等於 recover 字卡的天數', find(e2, 4, 'recover').days, rec2[0].daysTotal);
chk('S2 ongoing = null', sum2.ongoing, null);

/* ongoing 有值：取 S1 前 6 筆（i0～i5，停在第 1 段谷底）
   前高 i3 20240401（1100 萬）、谷底 i5 20240801（750 萬，也是最後一筆）
     depth = currentDepth = (1100−750)/1100 = 31.8182%
     daysSincePeak = 20240401→20240801 = 122
   沒有任何收復 → recoveries = [] */
const s1h = s1.slice(0, 6);
const sum1h = M.buildReplaySummary(s1h, M.buildReplayEvents(s1h, []));
chk('S1 前 6 筆：無收復段', (sum1h.recoveries || []).length, 0);
chk('S1 前 6 筆：ongoing 前高日／谷底日', [sum1h.ongoing.peakDate, sum1h.ongoing.troughDate].map(d8).join('|'), '20240401|20240801');
near('S1 前 6 筆：ongoing 最深', sum1h.ongoing.depth, 0.318182, 1e-5);
near('S1 前 6 筆：ongoing 目前回檔', sum1h.ongoing.currentDepth, 0.318182, 1e-5);
chk('S1 前 6 筆：ongoing 已過天數', sum1h.ongoing.daysSincePeak, 122);

/* ongoing 有值且「目前回檔」淺於「最深」：S2 前 4 筆＋一筆 20260505 1050 萬
   前高 i1 20260205（1100 萬）、谷底 i3 20260405（950 萬）、最後一筆 1050 萬仍低於前高 → 未收復
     depth = (1100−950)/1100 = 13.6364%
     currentDepth = (1100−1050)/1100 = 4.5455%
     daysSincePeak = 20260205→20260505 = 28 + 31 + 30 = 89 */
const s2o = M.toReplaySeries(S2_ROWS.slice(0, 4).concat([{ 日期: '20260505', 總資產: 10500000, 備註: '' }]));
const sum2o = M.buildReplaySummary(s2o, M.buildReplayEvents(s2o, []));
chk('S2 變體：無收復段', (sum2o.recoveries || []).length, 0);
chk('S2 變體：ongoing 前高日／谷底日', [sum2o.ongoing.peakDate, sum2o.ongoing.troughDate].map(d8).join('|'), '20260205|20260405');
near('S2 變體：ongoing 最深', sum2o.ongoing.depth, 0.136364, 1e-5);
near('S2 變體：ongoing 目前回檔', sum2o.ongoing.currentDepth, 0.0454545, 1e-5);
chk('S2 變體：ongoing 已過天數', sum2o.ongoing.daysSincePeak, 89);

chk('events 給 null 也不炸（明細為空）',
  JSON.stringify([M.buildReplaySummary(s1, null).recoveries, M.buildReplaySummary(s1, null).ongoing]), '[[],null]');
chk('畫面：明細區可內部捲動（overflow-y-auto＋maxHeight）',
  /className="overflow-y-auto overscroll-contain pr-1" style=\{\{ maxHeight: wide \? '11rem' : '7\.5rem', pointerEvents: 'auto' \}\}/.test(H), true);
chk('畫面：電腦版表格欄位',
  /前高 → 收復<\/th>[\s\S]{0,200}?回檔深度<\/th>[\s\S]{0,200}?跌到谷底<\/th>[\s\S]{0,200}?爬回前高<\/th>[\s\S]{0,200}?合計<\/th>/.test(H), true);
chk('畫面：進行中列', (H.match(/進行中/g) || []).length >= 2, true);
console.log('');
console.log('【第 5 輪｜連續創新高（連擊）buildAthStreaks／replayComboTier】');
/* 定義：沿用 buildReplayAthCounts 的創高判定（第 2 筆起嚴格大於之前最高值）。
   連擊數 combo[i]＝到第 i 筆為止連續「每一筆都創新高」的筆數，該筆未創高則 0；
   最長段＝combo 最大值那段，同長度取最早；起日＝段首筆、迄日＝段末筆。

   S1 值（萬）：480 520 1000 1100 900 750 1150 700 2000
     創高：i1、i2、i3、i6、i8（上方 B 已手推 [0,1,2,3,0,0,4,0,5]）
     連擊：i0 0；i1 1；i2 2；i3 3；i4 900 未創高 → 斷（0）；i5 0；
           i6 創高、前一筆 0 → 1；i7 斷 → 0；i8 → 1
     → [0,1,2,3,0,0,1,0,1]，斷點 i4、i7
     最長段 = 3 筆，i1～i3 → 20240201 → 20240401 */
const st1 = M.buildAthStreaks(s1);
chk('S1 每筆連擊數', JSON.stringify(st1.combo), '[0,1,2,3,0,0,1,0,1]');
chk('S1 斷點（連擊由 >0 變 0 的筆）',
  JSON.stringify(st1.combo.map((k, i) => (i > 0 && st1.combo[i - 1] > 0 && k === 0) ? i : -1).filter((i) => i >= 0)), '[4,7]');
chk('S1 最長連續創新高 筆數', st1.longest.length, 3);
chk('S1 最長段 起訖索引', st1.longest.startIndex + '|' + st1.longest.endIndex, '1|3');
chk('S1 最長段 起迄日', d8(st1.longest.startTs) + '|' + d8(st1.longest.endTs), '20240201|20240401');
chk('S1 總結面板帶最長段', sum1.longestStreak.length + '|' + d8(sum1.longestStreak.startTs) + '|' + d8(sum1.longestStreak.endTs),
  '3|20240201|20240401');

/* S2 值（萬）：1000 1100 990 950 1120 1080 1130
     創高：i1（1100>1000）、i4（1120>1100）、i6（1130>1120）；其餘皆未超過前最高
     連擊：[0,1,0,0,1,0,1]，斷點 i2、i5
     最長段 = 1 筆，三段同長 → 取最早 i1 → 20260205 → 20260205 */
const st2 = M.buildAthStreaks(s2);
chk('S2 每筆連擊數', JSON.stringify(st2.combo), '[0,1,0,0,1,0,1]');
chk('S2 斷點', JSON.stringify(st2.combo.map((k, i) => (i > 0 && st2.combo[i - 1] > 0 && k === 0) ? i : -1).filter((i) => i >= 0)), '[2,5]');
chk('S2 最長段 1 筆（同長取最早）', st2.longest.length + '|' + st2.longest.startIndex + '|' + st2.longest.endIndex, '1|1|1');
chk('S2 最長段 起迄日', d8(st2.longest.startTs) + '|' + d8(st2.longest.endTs), '20260205|20260205');
chk('S2 總結面板帶最長段', sum2.longestStreak.length, 1);

/* 完全沒有創高（持平）→ 連擊全 0、最長段 null；單筆、空序列同理 */
const flat3 = M.toReplaySeries([
  { 日期: '20260101', 總資產: 1000000 }, { 日期: '20260201', 總資產: 1000000 }, { 日期: '20260301', 總資產: 900000 }]);
chk('無創高 → 連擊全 0', JSON.stringify(M.buildAthStreaks(flat3).combo), '[0,0,0]');
chk('無創高 → 最長段 null', M.buildAthStreaks(flat3).longest, null);
chk('空序列 → 空連擊、null', JSON.stringify(M.buildAthStreaks([])), '{"combo":[],"longest":null}');

/* 分級（常數集中於 ASSET_REPLAY_COMBO_TIERS）：<2 不顯示；2～3 金；4～6 橘；≥7 紅＋火焰 */
chk('分級：0、1 不顯示', [0, 1].map(M.replayComboTier).join(','), '0,0');
chk('分級：2、3 → 1（金）', [2, 3].map(M.replayComboTier).join(','), '1,1');
chk('分級：4、6 → 2（橘）', [4, 6].map(M.replayComboTier).join(','), '2,2');
chk('分級：7、20 → 3（紅）', [7, 20].map(M.replayComboTier).join(','), '3,3');
chk('分級顏色：金／橘 #FF9F2E／紅 #FF3B47', K.COMBO.map((t) => t.color).join(','), '#F5C542,#FF9F2E,#FF3B47');
chk('分級字級遞增、只有最高級有火焰',
  K.COMBO[0].size < K.COMBO[1].size && K.COMBO[1].size < K.COMBO[2].size
  && K.COMBO.map((t) => t.flame).join(',') === 'false,false,true', true);
chk('連擊 ≥2 才顯示', K.COMBO_MIN, 2);
chk('斷連擊淡出 400ms', K.COMBO_FADE, 400);
chk('畫面：×K COMBO 字樣', /×\{combo\.k\} COMBO/.test(H), true);
chk('畫面：斷連擊縮小淡出、總數不歸零（只清 combo，不動 athN）',
  /setCombo\(\{ k: was, out: true \}\);/.test(H) && !/if \(!\(athCounts\[j\] > 0\) && comboRef\.current > 0\) \{[\s\S]{0,400}?setAthN/.test(H), true);
chk('畫面：連擊不觸發停留／震動（fire 內未對 combo 呼叫 setShakeLv 或 hold）',
  !/setCombo[\s\S]{0,200}?setShakeLv/.test(H), true);
chk('畫面：彈跳 1.3 倍', /50% \{ transform: scale\(1\.3\); \}/.test(H), true);
chk('畫面：reduced-motion 停用彈跳／淡出／火焰',
  /\.replay-pop, \.replay-combo-out, \.replay-flame \{ animation: none; \}/.test(H), true);
chk('畫面：總結面板「最長連續創新高」', /sumRow\('最長連續創新高'/.test(H), true);
console.log('');
console.log('【第 6 輪｜折線紅漲綠跌 replaySegmentUp／replaySegmentColor】');
/* 定義：終點 ≥ 起點（含持平）算漲 → 紅 #FF3B47；低於起點算跌 → 綠 #2BD47D；
   空檔段同色但半透明（紅 rgba(255,59,71,0.45)、綠 rgba(43,212,125,0.45)）。
   S1：480→520 漲、520→1000 漲、1000→1100 漲、1100→900 跌、900→750 跌、
       750→1150 漲、1150→700 跌、700→2000 漲 → 漲漲漲跌跌漲跌漲
   S2：1000→1100 漲、1100→990 跌、990→950 跌、950→1120 漲、1120→1080 跌、1080→1130 漲 */
const dirs = (ser) => ser.slice(1).map((p, k) => M.replaySegmentUp(ser[k].value, p.value) ? '漲' : '跌').join('');
chk('S1 逐段漲跌', dirs(s1), '漲漲漲跌跌漲跌漲');
chk('S2 逐段漲跌', dirs(s2), '漲跌跌漲跌漲');
chk('持平算漲（紅）', M.replaySegmentUp(1000000, 1000000), true);
chk('漲 → 紅', M.replaySegmentColor(true, false), '#FF3B47');
chk('跌 → 綠', M.replaySegmentColor(false, false), '#2BD47D');
chk('漲＋空檔 → 半透明紅', M.replaySegmentColor(true, true), 'rgba(255,59,71,0.45)');
chk('跌＋空檔 → 半透明綠', M.replaySegmentColor(false, true), 'rgba(43,212,125,0.45)');
chk('畫面：已抵達的線段逐段上色', H.includes('const up = replaySegmentUp(series[k - 1].value, series[k].value);'), true);
chk('畫面：折線頭顏色跟著當前段', H.includes('ctx.fillStyle = headUp ? REPLAY_RED : REPLAY_GREEN;'), true);
/* replaySegmentColor( 的呼叫處（定義寫成 `replaySegmentColor = (` 不計）：
   已抵達段 1＋補間段 1＋reduced 靜態圖 1 = 3 */
chk('畫面：播放中與 reduced-motion 靜態圖都逐段上色',
  H.split('replaySegmentColor(').length - 1, 3);
chk('畫面：下方漸層維持淡紅', H.includes("grad.addColorStop(0, 'rgba(255,59,71,0.34)');"), true);
console.log('');
console.log('【第 7 輪｜霓虹燈管線＋彗星尾巴 replayHistoryAlpha／buildCometTrail】');
/* 亮度：最近 3 段全亮（k > i − 3），更早的 0.4；結尾後整條全亮。
   i = 10：k = 8、9、10 全亮；k = 7 → 0.4；k = 1 → 0.4
   i = 2：k = 1、2 皆 > −1 → 全亮（不足 3 段時全部亮） */
chk('亮度常數：最近 3 段、歷史 0.4', [K.BRIGHT, K.HIST].join('|'), '3|0.4');
chk('i=10：k=8/9/10 全亮', [8, 9, 10].map((k) => M.replayHistoryAlpha(k, 10, false)).join(','), '1,1,1');
chk('i=10：k=7、k=1 變暗 0.4', [7, 1].map((k) => M.replayHistoryAlpha(k, 10, false)).join(','), '0.4,0.4');
chk('i=2：不足 3 段全亮', [1, 2].map((k) => M.replayHistoryAlpha(k, 2, false)).join(','), '1,1');
chk('結尾後整條恢復全亮', M.replayHistoryAlpha(1, 10, true), 1);
/* 彗星取點（由頭往回，每 step 一點，取到 len 為止；f＝距離／len）
   直線 (0,0)→(100,0)，頭在 (100,0)，len 9、step 3：
     距離 0、3、6、9 → x = 100、97、94、91；f = 0、1/3、2/3、1 */
const tr = (pts, len, step) => M.buildCometTrail(pts, len, step).map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.f * 1000) / 1000].join(':')).join(' ');
chk('直線取點', tr([{ x: 0, y: 0 }, { x: 100, y: 0 }], 9, 3), '100:0:0 97:0:0.333 94:0:0.667 91:0:1');
/* 轉角：(0,0)→(0,4)→(3,4)，頭在 (3,4)，len 6、step 2：
     距離 0 → (3,4)；距離 2 → 沿 (3,4)→(0,4) 走 2 → (1,4)；
     距離 4 → 該段長 3 用完，再沿 (0,4)→(0,0) 走 1 → (0,3)；距離 6 → 再走 2 → (0,1) */
chk('轉角沿折線取點', tr([{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 3, y: 4 }], 6, 2), '3:4:0 1:4:0.333 0:3:0.667 0:1:1');
/* 路徑比尾巴短：(0,0)→(4,0)，len 10、step 2 → 距離 0、2、4 取到起點為止，共 3 點 */
chk('路徑比尾巴短：取到起點為止', tr([{ x: 0, y: 0 }, { x: 4, y: 0 }], 10, 2), '4:0:0 2:0:0.2 0:0:0.4');
chk('空路徑 → 無點', M.buildCometTrail([], 90, 3).length, 0);
chk('畫面：霓虹亮芯層', H.includes('ctx.strokeStyle = replaySegmentCore(up);'), true);
chk('畫面：彗星尾巴使用 buildCometTrail', H.includes('buildCometTrail(pathPts, ASSET_REPLAY_COMET_PX, ASSET_REPLAY_COMET_STEP)'), true);
chk('畫面：歷史線依 replayHistoryAlpha 變暗', H.includes('const alpha = replayHistoryAlpha(k, i, ended);'), true);
console.log('');
console.log(fail === 0 ? '>>> 全部通過' : '>>> ' + fail + ' 組失敗');
process.exit(fail === 0 ? 0 : 1);
