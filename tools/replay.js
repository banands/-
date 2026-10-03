// Бот решает уровень, затем его ходы повторяются «по-честному» в свежей странице: проверка победы, флажков, монетки, шипов.
//   node tools/replay.js index.html 13,14,15
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const [file, list] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const lv of list.split(',').map(Number)) {
    const p1 = await b.newPage(); await p1.goto('file://' + path.resolve(file)); await p1.addScriptTag({ path: path.join(__dirname, 'bot.js') });
    const r = await p1.evaluate(i => solveLevel(i), lv - 1); await p1.close();
    const moves = []; for (const m of r.log) { if (Array.isArray(m)) moves.push(m); else if (m && m.back) moves.pop() } // откат бота отменяет предыдущий ход
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()) }); await p.goto('file://' + path.resolve(file));
    const out = await p.evaluate(([i, moves]) => {
      hideScreens(); prog.bonus = {}; prog.seen = {}; const c0 = prog.coins; let msg = ''; show = (t) => { msg = t }; const wm = winMsg;
      load(i); prog.inf = true; limit = Infinity; const ev = { flags: 0, pops: 0 };
      const run = k => { for (let q = 0; q < k && !won && !lost; q++) { const cp0 = cp, n0 = nodes.length; step(); if (cp > cp0) ev.flags++; if (pops.length && nodes.length < n0) ev.pops++ } };
      run(30);
      for (const [x, y] of moves) { const { c, ok } = candidates({ x, y }); if (!ok) return { err: 'bad move ' + x + ',' + y }; const k = addNode(x, y); used++; c.forEach(o => addBar(o.i, k)); run(140) }
      run(200);
      return { won, lost, msg, balls: nodes.length, coinTaken: !!prog.bonus[i], coinsGained: prog.coins - c0, hadCoin: !!L.coin, ...ev, name: L.name };
    }, [lv - 1, moves]);
    console.log('ур.' + lv, r.ok ? 'бот OK ' + r.balls : 'бот FAIL', JSON.stringify(out), errs.join(';')); if (!out.won || out.err || errs.length) process.exitCode = 1;
    await p.close();
  }
  await b.close();
})();
