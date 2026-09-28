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
    hideScreens(); prog.best = 300; prog.bridge.best = BLEVELS.length; updCnt();
    const check = (tag) => {
      for (const n of nodes) if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(n.px)) { bad.push(tag + ' NaN node'); break }
      for (const q of bars) if (!(q.a >= 0 && q.a < nodes.length && q.b >= 0 && q.b < nodes.length && q.a !== q.b)) { bad.push(tag + ' bad bar ' + JSON.stringify(q)); break }
      if (bridge) for (let i = 0; i < nPin; i++) if (!nodes[i] || !nodes[i].pin) { bad.push(tag + ' pin order'); break }
      const t = $('cnt').textContent; if (/NaN|undefined/.test(t)) bad.push(tag + ' hud ' + t);
      if (cp > cps.length) bad.push(tag + ' cp>cps');
    };
    const place = () => { // как pointerup: точка рядом со случайным шариком
      if (!nodes.length) return; const n = nodes[(rnd() * nodes.length) | 0], a = rnd() * 6.283, d = 40 + rnd() * 110;
      const p = { x: n.x + Math.cos(a) * d, y: n.y + Math.sin(a) * d - 20 };
      const { c, ok } = candidates(p); if (!ok || won || lost || testing) return; hist.push(snap()); const i = addNode(p.x, p.y); used++; c.forEach(o => addBar(o.i, i)); updCnt();
    };
    const steps = k => { for (let i = 0; i < k; i++) { try { step() } catch (e) { bad.push('step ' + e.message + ' ' + e.stack.split('\n')[1]); return } } try { draw(performance.now()) } catch (e) { bad.push('draw ' + e.message) } };
    for (let r = 0; r < ROUNDS; r++) {
      const mode = r % 3; const tag = ['lv', 'end', 'br'][mode] + r;
      try { if (mode === 0) load((rnd() * 200) | 0); else if (mode === 1) loadEndless(); else loadBridge((rnd() * BLEVELS.length) | 0) } catch (e) { bad.push(tag + ' load ' + e.message) }
      if (rnd() < .3) { prog.inf = true; limit = Infinity } else prog.inf = false;
      for (let k = 0; k < 40; k++) {
        const x = rnd();
        try {
          if (x < .7) place(); else if (x < .8) $('undo').onclick(); else if (x < .85 && bridge) startTest(); else if (x < .87) $('inf').onclick(); else if (x < .88) $('reset').onclick();
        } catch (e) { bad.push(tag + ' action ' + e.message) }
        if (!$('ov').hidden && rnd() < .5) { try { (rnd() < .5 ? $('ovB') : $('ovB2')).onclick?.() } catch (e) { bad.push(tag + ' ov ' + e.message) } }
        steps(5 + ((rnd() * 40) | 0)); check(tag);
        if (bad.length > 20) break;
      }
      if (bridge && !testing && !won) { try { startTest(); steps(900); check(tag + ' test') } catch (e) { bad.push(tag + ' test ' + e.message) } }
    }
    console.error = oldErr; return bad;
  }, ROUNDS);
  console.log(JSON.stringify([...errs, ...res], null, 1)); await b.close();
})();
