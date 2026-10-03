// Сценарий через настоящие касания/клики: node tools/ui.js index.html
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()) });
  await p.goto('file://' + path.resolve(process.argv[2])); await p.waitForTimeout(300);
  let fails = 0; const log = (...a) => { if (a.includes(false)) fails++; console.log(...a) }; const ev = (f, a) => p.evaluate(f, a);
  const tap = async sel => { await p.tap(sel); await p.waitForTimeout(150) };
  // касание в мировых координатах: палец ставится ниже точки на TOUCH_UP (призрак выше пальца)
  const touchAt = async (x, y) => {
    const s = await ev(([x, y]) => { const r = cv.getBoundingClientRect(); return { cx: r.left + x * sc + ox, cy: r.top + y * sc + oy + TOUCH_UP } }, [x, y]);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.cx, y: s.cy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s.cx + 1, y: s.cy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
  };
  log('меню видно:', await ev(() => !$('mm').hidden));
  await tap('#mmLevels'); log('список уровней:', await ev(() => !$('lvOv').hidden && $('lvList').children.length));
  await tap('#lvList button'); log('уровень 1 загружен:', await ev(() => lvlIdx === 0 && anyScreen() === false));
  const n0 = await ev(() => nodes.length);
  const st = await ev(() => ({ x: nodes[0].x, y: nodes[0].y }));
  await touchAt(st.x + 90, st.y - 60); await touchAt(st.x + 150, st.y - 10);
  log('после двух касаний шариков:', await ev(() => nodes.length), '(было', n0 + ')', 'палок:', await ev(() => bars.length), 'счётчик:', await ev(() => $('cnt').textContent));
  await tap('#undo'); log('после «Отменить»:', await ev(() => nodes.length));
  await tap('#reset'); log('после «Заново»:', await ev(() => nodes.length));
  await tap('#menu'); await tap('#mmSkins'); log('магазин:', await ev(() => !$('shop').hidden && $('shopList').children.length));
  await ev(() => { prog.coins = 100; openShop() });
  await p.tap('#shopList .item:nth-child(2) button'); await p.waitForTimeout(150);
  log('купили «Брёвна»:', await ev(() => prog.owned.includes('wood') && prog.skin === 'wood' && prog.coins === 20));
  await tap('#shopBack'); await tap('#mmSet'); await tap('#stZone'); log('зона выкл:', await ev(() => prog.set.zone === false));
  await tap('#stZone'); await tap('#setBack'); await tap('#mmEndless'); log('бесконечный путь:', await ev(() => endless && !anyScreen()));
  await tap('#menu'); await tap('#mmBridges'); await tap('#brList button'); log('мост 1:', await ev(() => bridge && bIdx === 0));
  await tap('#test'); await p.waitForTimeout(2500); log('проверка без моста — провал:', await ev(() => lost), await ev(() => $('ovT').textContent));
  await tap('#ovB'); log('«Ещё раз» — тележка убрана:', await ev(() => !testing && !cart && $('ov').hidden));
  // перезапуск: прогресс и режим сохраняются
  await p.reload(); await p.waitForTimeout(300);
  log('после перезапуска — мост, скин:', await ev(() => bridge && prog.skin === 'wood'));
  console.log('ошибки:', errs.length ? errs : 'нет', fails ? '· проваленных проверок: ' + fails : ''); if (errs.length || fails) process.exitCode = 1; await b.close();
})();
