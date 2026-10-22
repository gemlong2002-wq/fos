const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');
/* 目標檔一律相對解析：預設讀 repo 根的 index.html，也可用 argv[2] 指定別的檔。 */
const TARGET = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(__dirname, '..', 'index.html');
const h = fs.readFileSync(TARGET, 'utf8');
const m = h.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.log('NO_BABEL_SCRIPT_FOUND'); process.exit(2); }
try {
  babel.transform(m[1], { presets: ['react', ['env', { targets: { chrome: '90' } }]] });
  console.log('BABEL_PARSE_OK', m[1].length);
} catch (e) {
  console.log('BABEL_FAIL', e.message);
  process.exit(1);
}
