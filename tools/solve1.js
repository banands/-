// Один уровень ботом со снимком итоговой постройки: node tools/solve1.js index.html <номер уровня с 1> out.png
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const [file, lv, png] = process.argv.slice(2);
(async () => {
  const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: 1400, height: 700 } });
  await p.goto('file://' + path.resolve(file)); await p.addScriptTag({ path: path.join(__dirname, 'bot.js') });
  const r = await p.evaluate(i => { const r = solveLevel(i, { trace: true }); lost = false; won = false; camX = null; draw(performance.now()); return r }, lv - 1);
  console.log(JSON.stringify({ ok: r.ok, balls: r.balls, reason: r.reason }));
  for (const l of r.log) console.log(JSON.stringify(l));
  if (png) await p.screenshot({ path: png }); await br.close();
})();
