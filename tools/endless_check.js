// Проходимость участков бесконечного пути: пары соседних площадок с новинкой между ними — мини-уровни для бота.
//   node tools/endless_check.js index.html [сколько] [потоков]
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const [file, N = '40', W = '4'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p0 = await b.newPage(); await p0.goto('file://' + path.resolve(file));
  // набираем участки: площадка A, между ней и B — остров/яма/скала (или B сама остров)
  const segs = await p0.evaluate(N => {
    const out = [];
    for (let run = 0; out.length < N && run < 200; run++) {
      loadEndless(); eg.n = 6; while (cps.length < 40) { const r = egNext(); terrain.push(r); cps.push(r) }
      const P = cps;
      for (let k = 0; k + 1 < P.length && out.length < N; k++) {
        const A = P[k], B = P[k + 1];
        const mid = terrain.filter(r => (r.k === 'pit' || r.k === 'rock') && r.x >= A.x + A.w - 1 && r.x + r.w <= B.x + 1);
        if (!mid.length && B.k !== 'isl') continue;
        const p = [[-600, A.x + A.w, A.y]], o = [];
        for (const r of mid) if (r.k === 'pit') p.push([r.x, r.x + r.w, r.y, { pit: 1 }]); else o.push([r.x, r.x + r.w, r.y + r.h]);
        p.push(B.k === 'isl' ? [B.x, B.x + B.w, B.y, { h: B.h }] : [B.x, B.x + 1600, B.y]);
        // старт — у правого края A: после флажка конструкция стоит посередине A
        out.push({ kind: B.k === 'isl' ? 'isl' : mid[0].k, L: { name: 'e', p, o: o.length ? o : undefined, start: Math.round(A.x + A.w / 2) } });
      }
    }
    return out;
  }, +N);
  await p0.close();
  let next = 0; const res = [];
  async function worker() {
    const p = await b.newPage(); await p.goto('file://' + path.resolve(file)); await p.addScriptTag({ path: path.join(__dirname, 'bot.js') });
    while (next < segs.length) {
      const k = next++, s = segs[k];
      // остров как цель: побеждает шарик на острове (обычная проверка «на цели»)
      const r = await p.evaluate(L => { LEVELS[0] = L; return solveLevel(0, { maxBalls: 40 }) }, s.L);
      res.push({ kind: s.kind, ok: r.ok, balls: r.balls }); console.log(k, s.kind, r.ok ? 'OK ' + r.balls : 'FAIL ' + r.reason);
    }
  }
  await Promise.all(Array.from({ length: +W }, worker));
  const by = {}; for (const r of res) { const o = by[r.kind] || (by[r.kind] = { n: 0, fail: 0, balls: [] }); o.n++; if (!r.ok) o.fail++; else o.balls.push(r.balls) }
  if (res.some(r => !r.ok)) process.exitCode = 1;
  for (const [k, o] of Object.entries(by)) { o.balls.sort((a, b) => a - b); console.log(k, 'всего', o.n, 'провалов', o.fail, 'медиана шариков', o.balls[o.balls.length >> 1], 'макс', o.balls[o.balls.length - 1]) }
  await b.close();
})();
