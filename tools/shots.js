// Скриншоты экранов игры: node tools/shots.js index.html outdir [WxH ...]
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright');
const [file, out, ...sizes] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const sz of (sizes.length ? sizes : ['844x390'])) {
    const [w, h] = sz.split('x').map(Number);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(300);
    const snap = async (name, fn) => { if (fn) await p.evaluate(fn); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${sz}-${name}.png` }) };
    await p.evaluate(() => { prog.best = 60; prog.coins = 450; prog.stars = { 0: 3, 1: 2, 2: 1 }; prog.bridge.best = 4; prog.bridge.stars = { 0: 3, 1: 1 }; saveProg(); openMain() });
    await snap('menu');
    await snap('levels', () => openMenu());
    await snap('bridges', () => openBridges());
    await snap('shop', () => openShop());
    await snap('settings', () => openSet());
    await snap('level', () => { hideScreens(); load(6); for (let i = 0; i < 60; i++) step(); toast = { t: 'Флажок 1 из 2 — отсюда можно продолжить', life: 150 } });
    await snap('lost', () => { show('Сорвалось!', 'Можно продолжить с флажка 1 или начать уровень заново.', 'С флажка', () => { }, 'Заново', () => { }) });
    await snap('win', () => { $('ov').hidden = true; show('Мост готов! ★★☆', 'Шариков: 14. На три звезды нужно не больше 12. +15 монет.', 'Дальше →', () => { }) });
    await snap('endless', () => { $('ov').hidden = true; loadEndless(); for (let i = 0; i < 30; i++) step() });
    await snap('bridge', () => { loadBridge(3); for (let i = 0; i < 30; i++) step() });
    await snap('bridgewin', () => { show('Мост выдержал! ★★★', 'Шариков: 8. В норме, отлично! +15 монет.', 'Дальше →', () => { }, 'Улучшить', () => { }) });
    if (errs.length) console.log(sz, errs);
    await p.close();
  }
  await b.close();
})();
