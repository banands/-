// Фаззер: случайные ходы во всех режимах, проверка инвариантов и исключений.
//   node tools/fuzz.js [index.html] [раундов]
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const file = path.resolve(process.argv[2] || 'index.html'), ROUNDS = +(process.argv[3] || 60);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()) });
  await p.goto('file://' + file); await p.waitForTimeout(300);
  const res = await p.evaluate(async (ROUNDS) => {
    const bad = []; let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296 };
    const oldErr = console.error; console.error = (...a) => { bad.push('console.error ' + a.map(String).join(' ')); };
    hideScreens(); prog.best = 300; prog.bridge.best = BLEVELS.length; prog.set.sound = false; updCnt();
    const check = (tag) => {
      for (const n of nodes) if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(n.px)) { bad.push(tag + ' NaN node'); break }
      for (const q of bars) if (!(q.a >= 0 && q.a < nodes.length && q.b >= 0 && q.b < nodes.length && q.a !== q.b)) { bad.push(tag + ' bad bar ' + JSON.stringify(q)); break }
      if (bridge) for (let i = 0; i < nPin; i++) if (!nodes[i] || !nodes[i].pin) { bad.push(tag + ' pin order'); break }
      const t = $('cnt').textContent; if (/NaN|undefined/.test(t)) bad.push(tag + ' hud ' + t);
      if (cp > cps.length) bad.push(tag + ' cp>cps');
    };
    const place = () => { // как pointerup: точка рядом со случайным шариком, иногда — сталь
      if (!nodes.length) return; const n = nodes[(rnd() * nodes.length) | 0], a = rnd() * 6.283, d = 40 + rnd() * 110;
      const p = { x: n.x + Math.cos(a) * d, y: n.y + Math.sin(a) * d - 20 };
      if (typeof setMat === 'function') setMat(rnd() < .25 ? 's' : 'w');
      const { c, ok } = candidates(p); if (!ok || won || lost || testing) return; hist.push(snap()); const i = addNode(p.x, p.y), st = typeof mat !== 'undefined' && mat === 's'; used += st ? 2 : 1;
      if (st) { nodes[i].st = 1; nodes[i].m = STEEL_M } c.forEach(o => { addBar(o.i, i); if (st) bars[bars.length - 1].st = 1 }); updCnt();
    };
    const sig = () => JSON.stringify([nodes, bars, used, won, lost, cp, broken, coin, prog.coins]);
    const hint = tag => { // подсказка не должна менять состояние игры
      if (typeof hintGen !== 'function' || bridge || won || lost) return; const before = sig(); const g = hintGen(); let r, k = 0; try { do { r = g.next() } while (!r.done && ++k < 5000) } finally { sim = false }
      if (sig() !== before) bad.push(tag + ' hint changed state');
    };
    const steps = k => { for (let i = 0; i < k; i++) { try { step() } catch (e) { bad.push('step ' + e.message + ' ' + e.stack.split('\n')[1]); return } } try { draw(performance.now()) } catch (e) { bad.push('draw ' + e.message) } };
    for (let r = 0; r < ROUNDS; r++) {
      const mode = r % 3; const tag = ['lv', 'end', 'br'][mode] + r;
      try {
        if (mode === 0) { const x = rnd(); if (x < .15 && typeof dailyLevel === 'function') { const d = 20261001 + ((rnd() * 28) | 0); loadSpecial({ kind: 'daily', day: d, L: dailyLevel(d), title: 'д', seed: d % 997, coinKey: null }) } else if (x < .25 && typeof decLevel === 'function') { const E = decLevel(encLevel({ p: [[-600, 300, 480], [380, 520, 460, { h: 60 }], [540, 680, 560, { pit: 1 }], [700, 2300, 420, { spk: [700, 800] }]], start: 150, o: [[560, 660, 300]], coin: [450, 330] })); prog.custom = [{ n: 'т', c: encLevel(E), b: 0 }]; loadSpecial({ kind: 'custom', idx: 0, L: edLevel(E), title: 'т', seed: 1, coinKey: null }) } else load((rnd() * 200) | 0) }
        else if (mode === 1) loadEndless(); else loadBridge((rnd() * BLEVELS.length) | 0)
      } catch (e) { bad.push(tag + ' load ' + e.message) }
      if (rnd() < .3) { prog.inf = true; limit = Infinity } else prog.inf = false;
      for (let k = 0; k < 40; k++) {
        const x = rnd();
        try {
          if (x < .66) place(); else if (x < .7) hint(tag); else if (x < .8) $('undo').onclick(); else if (x < .85 && bridge) startTest(); else if (x < .87) $('inf').onclick(); else if (x < .88) $('reset').onclick();
        } catch (e) { bad.push(tag + ' action ' + e.message) }
        if (!$('ov').hidden && rnd() < .5) { try { (rnd() < .5 ? $('ovB') : $('ovB2')).onclick?.() } catch (e) { bad.push(tag + ' ov ' + e.message) } }
        steps(5 + ((rnd() * 40) | 0)); check(tag);
        if (bad.length > 20) break;
      }
      if (bridge && !testing && !won) { try { startTest(); steps(900); check(tag + ' test') } catch (e) { bad.push(tag + ' test ' + e.message) } }
    }
    console.error = oldErr; return bad;
  }, ROUNDS);
  const all = [...errs, ...res]; console.log(JSON.stringify(all, null, 1)); if (all.length) process.exitCode = 1; await b.close();
})();
