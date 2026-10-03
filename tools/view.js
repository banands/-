// Снимок уровней без игры: node tools/view.js index.html out.png 13,14,15  (номера с 1; e — бесконечный путь)
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const [file, out, list, size = '1000x600'] = process.argv.slice(2);
(async () => {
  const [w, h] = size.split('x').map(Number);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()) });
  await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(200);
  const ids = list.split(',');
  for (const id of ids) {
    await p.evaluate(id => { hideScreens(); prog.seen = {}; prog.bonus = {}; if (id === 'e') { loadEndless(); } else load(+id - 1); camX = null; minX = -400; maxX = 9e9;
      // кадр на весь уровень: сдвигаем камеру так, чтобы видно было от старта до цели
      for (let k = 0; k < 40; k++) step(); }, id);
    await p.evaluate(() => { const vis = cw / sc; const x0 = L.start - 120, x1 = (goalX < 1e8 ? goalX : L.start + 1400) + 260; const s2 = Math.min(cw / (x1 - x0), ch / H); sc = s2; camX = x0; draw(performance.now()) });
    // draw() сам пересчитывает камеру — переопределяем cam на время снимка
    await p.evaluate(() => { const c0 = cam; cam = () => { const x0 = L.start - 120, x1 = (goalX < 1e8 ? goalX : L.start + 1400) + 260; sc = Math.min(cw / (x1 - x0), ch / H); camX = x0; ox = -x0 * sc; oy = (ch - H * sc) / 2 }; draw(performance.now()); cam = c0 });
    await p.screenshot({ path: out.replace('.png', '-' + id + '.png') });
  }
  if (errs.length) console.log(errs); await b.close();
})();
