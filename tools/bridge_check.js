// Проверка мостов: строим типовые фермы (дорога + треугольники над/под ней) по правилам игры — шарик цепляется
// к двум ближайшим и болту, между установками идёт физика — и пускаем тележку. Ищем ферму с наименьшим числом шариков.
//   node tools/bridge_check.js index.html [номера мостов с 1, через запятую] [потоков]
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const [file, list = '', W = '4'] = process.argv.slice(2);
const PATTERNS = [];
for (const s of [95, 115, 135]) for (const h of [-85, -65, 65, 85]) for (const steel of ['none', 'deck', 'all']) for (const order of ['lr', 'both']) PATTERNS.push({ s, h, steel, order });

function attempt(bi, P) { // выполняется на странице игры
  bridgeWin = () => { }; let why = ''; show = t => { why = t };
  hideScreens(); prog.bridge.best = BLEVELS.length; loadBridge(bi); prog.inf = true; limit = Infinity; // без «открыт ли мост»
  const A = BL.anc, tops = [A[0]]; for (let k = 2; k < BL.p.length; k++) tops.push(A[k]); tops.push(A[1]);
  const run = k => { for (let q = 0; q < k && !lost && !won; q++) step() };
  const seq = []; // [{x,y,steel}]
  for (let g = 0; g + 1 < tops.length; g++) {
    const a = tops[g], b = tops[g + 1], n = Math.max(1, Math.round((b[0] - a[0]) / P.s)), dx = (b[0] - a[0]) / n, dy = (b[1] - a[1]) / n;
    const L = [], Rr = [];
    for (let k = 0; k < n; k++) {
      const c = { x: a[0] + dx * (k + .5), y: a[1] + dy * (k + .5) + P.h, steel: P.steel === 'all' };
      const d = k < n - 1 ? { x: a[0] + dx * (k + 1), y: a[1] + dy * (k + 1), steel: P.steel !== 'none' } : null;
      if (P.order === 'lr' || k < n / 2) { L.push(c); if (d) L.push(d) } else { Rr.unshift(c); if (d) Rr.unshift(d) }
    }
    // «both»: с левого и правого болта навстречу — справа порядок от болта к середине
    if (P.order === 'lr') seq.push(...L);
    else { const R2 = Rr.slice().reverse(); let i = 0, j = 0; while (i < L.length || j < R2.length) { if (i < L.length) seq.push(L[i++]); if (j < R2.length) seq.push(R2[j++]) } }
  }
  let skipped = 0;
  for (const q0 of seq) {
    setMat(q0.steel ? 's' : 'w');
    // точка у стены столба может попасть в скалу — пробуем чуть сдвинуть, иначе пропускаем
    let q = null, c = null;
    for (const [ddx, ddy] of [[0, 0], [0, -15], [15, 0], [-15, 0], [0, 15], [20, -20], [-20, -20], [0, -30]]) { const t = { x: q0.x + ddx, y: q0.y + ddy, steel: q0.steel }, r = candidates(t); if (r.ok) { q = t; c = r.c; break } }
    if (!q) { skipped++; continue }
    const i = addNode(q.x, q.y); used += matCost(); if (q.steel) { nodes[i].st = 1; nodes[i].m = STEEL_M } c.forEach(o => { addBar(o.i, i); if (q.steel) bars[bars.length - 1].st = 1 });
    run(30); if (lost) return { ok: false, why: 'упало при стройке' };
  }
  run(150); if (broken) return { ok: false, why: 'лопнуло при стройке' };
  const balls = used; startTest(); for (let q = 0; q < 3000 && !won && !lost; q++) step();
  return { ok: won, balls, why: won ? '' : lost ? 'тележка: ' + why : 'не доехала' };
}

(async () => {
  const b = await chromium.launch(); const p0 = await b.newPage(); await p0.goto('file://' + path.resolve(file));
  const nB = await p0.evaluate(() => BLEVELS.length); await p0.close();
  const ids = list ? list.split(',').map(x => +x - 1) : Array.from({ length: nB }, (_, i) => i);
  let next = 0; const out = {};
  async function worker() {
    const p = await b.newPage(); p.on('pageerror', e => { console.error('pageerror', e.message); process.exitCode = 1 }); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) { console.error('console', m.text()); process.exitCode = 1 } }); await p.goto('file://' + path.resolve(file));
    while (next < ids.length) {
      const bi = ids[next++]; let best = null, fails = {};
      for (const P of PATTERNS) {
        const r = await p.evaluate(([bi, P, src]) => (0, eval)('(' + src + ')')(bi, P), [bi, P, attempt.toString()]);
        if (r.ok && (!best || r.balls < best.balls)) best = { ...r, P }; else if (!r.ok) fails[r.why] = (fails[r.why] || 0) + 1;
      }
      const info = await p.evaluate(bi => ({ name: BLEVELS[bi].name, par: BLEVELS[bi].par }), bi);
      out[bi] = best; if (!best) process.exitCode = 1; console.log(`мост ${bi + 1} «${info.name}» (норма ${info.par}):`, best ? `OK ${best.balls} шариков · шаг ${best.P.s}, ${best.P.h < 0 ? 'сверху' : 'снизу'} ${Math.abs(best.P.h)}, сталь ${best.P.steel}, ${best.P.order}` : 'НЕ ПРОШЁЛ', best ? '' : JSON.stringify(fails));
    }
  }
  await Promise.all(Array.from({ length: +W }, worker)); await b.close();
})();
