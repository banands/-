// Уровни дня на N дней вперёд ботом: node tools/daily_check.js index.html [дней] [потоков] [out.json] [--reroll]
// С --reroll для дней, где бот не уложился в 40 шариков, перебираются «соли» 1..5; итог — таблица DAILY_SALT.
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
        r = await p.evaluate(([d, s]) => { DAILY_SALT[d] = s; return solveLevel(0, { maxBalls: 40, setup: () => loadSpecial({ kind: 'daily', day: d, L: dailyLevel(d), title: '', seed: d % 997, coinKey: null }) }) }, [d, salt]);
        if (r.ok && r.balls <= MAXB) break;
      }
      const parV = await p.evaluate(d => parEst(dailyLevel(d)), d);
      res[d] = { ok: r.ok, balls: r.balls, par: parV, salt: r.ok ? salt : -1 }; console.log(d, r.ok ? 'OK ' + r.balls : 'FAIL ' + r.reason + ' ' + r.balls, 'норма', parV, salt ? 'соль ' + salt : '');
      if (out) fs.writeFileSync(out, JSON.stringify(res));
    }
  }
  await Promise.all(Array.from({ length: +W }, worker));
  const v = Object.values(res), ok = v.filter(r => r.ok);
  console.log('итого: прошёл', ok.length, 'из', v.length);
  if (reroll) console.log('const DAILY_SALT=' + JSON.stringify(Object.fromEntries(Object.entries(res).filter(([d, r]) => r.salt > 0).map(([d, r]) => [d, r.salt]))).replace(/"(\d+)":/g, '$1:') + ';');
  await b.close();
})();
