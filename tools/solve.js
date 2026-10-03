// Прогон бота-строителя по уровням в несколько потоков.
//   node tools/solve.js index.html 0-149 [out.json] [workers]
//   REROLL_MAX=6 — для непройденных и тяжёлых (> HARD=27 шариков) уровней пробовать другие «соли» генератора
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');
const [file, range, out = '', W = '4'] = process.argv.slice(2);
const VARIANTS = JSON.parse(process.env.VARIANTS || '[{"margin":10,"seed":0},{"margin":25,"seed":1}]');
const REROLL_MAX = +(process.env.REROLL_MAX || 0), HARD = +(process.env.HARD || 27);
const ids = []; for (const part of range.split(',')) { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (b ?? a); i++) ids.push(i) }
(async () => {
  const br = await chromium.launch(); const res = {}; let next = 0, doneN = 0; const t0 = Date.now();
  async function worker() {
    const ctx = await br.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => { console.error('pageerror', e.message); process.exitCode = 1 }); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) { console.error('console', m.text()); process.exitCode = 1 } });
    await p.goto('file://' + path.resolve(file)); await p.addScriptTag({ path: path.join(__dirname, 'bot.js') });
    while (next < ids.length) {
      const i = ids[next++]; const t = Date.now();
      // два варианта бота (разный запас устойчивости и зерно), берём лучший
      const best = async salt => {
        let r = null;
        for (const opt of VARIANTS) { const q = await p.evaluate(([i, o, salt]) => { if (salt != null) REROLL[i] = salt; return solveLevel(i, o) }, [i, opt, salt]); if (!r || (q.ok && (!r.ok || q.balls < r.balls))) r = q }
        return r;
      };
      let salt = await p.evaluate(i => REROLL[i] | 0, i), r = await best(salt);
      // --reroll: не прошёл или слишком тяжёлый (> HARD шариков) — пробуем другую «соль» генератора
      if (REROLL_MAX && (!r.ok || r.balls > HARD)) for (let k = 1; k <= REROLL_MAX; k++) {
        if (k === salt) continue; const q = await best(k); if (q.ok && (!r.ok || q.balls < r.balls)) { r = q; salt = k } if (r.ok && r.balls <= HARD) break;
      }
      res[i] = { ok: r.ok, balls: r.balls, reason: r.reason || '', salt, sec: Math.round((Date.now() - t) / 1000) };
      doneN++; console.log(`${doneN}/${ids.length} ур.${i + 1}: ${r.ok ? 'OK ' + r.balls : 'FAIL ' + r.reason + ' ' + r.balls}${salt ? ' соль ' + salt : ''} (${res[i].sec}s)`);
      if (out) fs.writeFileSync(out, JSON.stringify(res));
    }
    await ctx.close();
  }
  await Promise.all(Array.from({ length: +W }, worker));
  console.log('всего', Math.round((Date.now() - t0) / 1000), 'с'); await br.close();
})();
