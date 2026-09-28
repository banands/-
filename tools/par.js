// Нормы на три звезды из результатов бота: node tools/par.js index.html res1.json [res2.json …]
// Уровни 1–12 (ручные) сохраняют прежние нормы. Для уровней с 13-го норма = бот × 1.1 (бот расходует
// в среднем на ~12% меньше шариков, чем бот, по которому считалась старая таблица), не больше 30.
// Печатает новые строки PAR=… и REROLL=… для index.html; с флагом --write вставляет их сами.
const fs = require('fs');
const [file, ...rest] = process.argv.slice(2);
const write = rest.includes('--write'), files = rest.filter(a => a !== '--write');
const src = fs.readFileSync(file, 'utf8');
const oldPar = JSON.parse(src.match(/^const PAR=(\[[^\]]*\]);/m)[1]);
const res = {}; for (const f of files) Object.assign(res, JSON.parse(fs.readFileSync(f, 'utf8'))); // поздние файлы перекрывают ранние
const n = Math.max(oldPar.length, ...Object.keys(res).map(k => +k + 1));
const par = [], reroll = {}, bad = [];
for (let i = 0; i < n; i++) {
  if (i < 12) { par.push(oldPar[i]); continue }
  const r = res[i];
  if (!r || !r.ok) { par.push(0); bad.push(i + 1); continue } // 0 — в игре норма считается по формуле
  par.push(Math.min(30, Math.round(r.balls * 1.1)));
  if (r.salt) reroll[i] = r.salt;
}
const parLine = 'const PAR=' + JSON.stringify(par) + ';';
const rrLine = 'const REROLL=' + JSON.stringify(reroll).replace(/"(\d+)":/g, '$1:') + ';';
console.log(parLine); console.log(rrLine);
if (bad.length) console.log('без решения (норма по формуле):', bad.join(', '));
if (write) {
  let out = src.replace(/^const PAR=\[[^\]]*\];/m, parLine).replace(/^const REROLL=\{[^}]*\};/m, rrLine);
  fs.writeFileSync(file, out); console.log('записано в', file);
}
