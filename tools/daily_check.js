// Уровни дня на N дней вперёд ботом: node tools/daily_check.js index.html [дней] [потоков] [out.json] [--reroll]
// С --reroll для дней, где бот не уложился в 40 шариков, перебираются «соли» 1..5; итог — строка DAILY (норма + соль на день).
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');
const args = process.argv.slice(2), reroll = args.includes('--reroll'), [file, N = '60', W = '4', out = ''] = args.filter(a => a !== '--reroll');
const days = []; for (let k = 0; k < +N; k++) { const t = new Date(); t.setDate(t.getDate() + k); days.push(t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate()) }
const MAXB = 40;
(async () => {
  const b = await chromium.launch(); let next = 0; const res = {};
  async function worker() {
    const p = await b.newPage(); await p.goto('file://' + path.resolve(file)); await p.addScriptTag({ path: path.join(__dirname, 'bot.js') });
    while (next < days.length) {
      const d = days[next++]; let r, salt = 0;
      for (; salt <= (reroll ? 5 : 0); salt++) {
        r = await p.evaluate(([d, s]) => solveLevel(0, { maxBalls: 40, setup: () => loadSpecial({ kind: 'daily', day: d, L: dailyLevel(d, s), title: '', seed: d % 997, coinKey: null }) }), [d, salt]);
        if (r.ok && r.balls <= MAXB) break;
      }
      const parV = await p.evaluate(([d, s]) => parEst(dailyLevel(d, s)), [d, salt]);
      res[d] = { ok: r.ok, balls: r.balls, par: parV, salt: r.ok ? salt : -1 }; console.log(d, r.ok ? 'OK ' + r.balls : 'FAIL ' + r.reason + ' ' + r.balls, 'норма', parV, salt ? 'соль ' + salt : '');
      if (out) fs.writeFileSync(out, JSON.stringify(res));
    }
  }
  await Promise.all(Array.from({ length: +W }, worker));
  const v = Object.values(res), ok = v.filter(r => r.ok);
  console.log('итого: прошёл', ok.length, 'из', v.length);
  // строка DAILY для index.html: норма = бот ×1.1 (не больше 30) в base36 + соль; день без решения — «00»
  if (reroll) console.log('DAILY=' + days.map(d => { const r = res[d]; return r && r.ok ? Math.min(30, Math.round(r.balls * 1.1)).toString(36) + Math.max(0, r.salt) : '00' }).join(''));
  await b.close();
})();
