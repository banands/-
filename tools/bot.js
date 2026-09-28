// Бот-строитель: жадно растит ферму из треугольников к флажку, каждый ход проверяя физикой.
// Подключается на страницу игры (page.addScriptTag) и пользуется её глобальными функциями и переменными.
// solveLevel(i) -> {ok, balls, moves, reason}
(function () {
  const G_STEP = 10; // шаг сетки для геодезического расстояния

  function saveState() {
    return {
      n: nodes.map(o => ({ ...o })), b: bars.map(o => ({ ...o })), used, cp, cpT, cpJ, cpSnap, winT, won, lost, broken,
      cps: cps.slice(), terrain: terrain.slice(), hist: hist.slice(), coin: typeof coin === 'undefined' ? null : coin,
    };
  }
  function loadState(s) {
    nodes = s.n.map(o => ({ ...o })); bars = s.b.map(o => ({ ...o })); used = s.used; cp = s.cp; cpT = s.cpT; cpJ = s.cpJ;
    cpSnap = s.cpSnap; winT = s.winT; won = s.won; lost = s.lost; broken = s.broken; debris = []; toast = null;
    cps = s.cps.slice(); terrain = s.terrain.slice(); hist = s.hist.slice(); if (typeof coin !== 'undefined') { coin = s.coin; pops = [] }
  }
  function run(k) { for (let i = 0; i < k && !lost; i++) { step(); if (won) break } }
  function place(p) {
    const { c, ok } = candidates(p); if (!ok) return false;
    hist.push(snap()); const i = addNode(p.x, p.y); used++; c.forEach(o => addBar(o.i, i)); return true;
  }

  // ---- геодезическое расстояние до цели в обход земли (BFS по сетке, 8 соседей)
  function geoField(T) {
    const x0 = Math.floor((minX - 300) / G_STEP), x1 = Math.ceil((T.x + 400) / G_STEP), y0 = Math.floor(-400 / G_STEP), y1 = Math.ceil((H + 80) / G_STEP);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, D = new Float32Array(w * h).fill(Infinity), solid = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i + x0) * G_STEP, y = (j + y0) * G_STEP;
      for (const r of terrain) if (x > r.x - R + 2 && x < r.x + r.w + R - 2 && y > r.y - R + 2 && y < r.y + r.h + R - 2) { solid[j * w + i] = 1; break }
    }
    const q = []; const ti = Math.round(T.x / G_STEP) - x0, tj = Math.round(T.y / G_STEP) - y0;
    D[tj * w + ti] = 0; q.push(tj * w + ti);
    // Дейкстра на двухуровневой очереди не нужна: сетка мелкая, хватает «ленивого» BFS с перепроверкой
    for (let h0 = 0; h0 < q.length; h0++) {
      const id = q[h0], i = id % w, j = (id / w) | 0, d = D[id];
      for (const [di, dj, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
        const a = i + di, bb = j + dj; if (a < 0 || bb < 0 || a >= w || bb >= h) continue; const k = bb * w + a;
        if (solid[k]) continue; const nd = d + c * G_STEP; if (nd < D[k] - 1e-3) { D[k] = nd; q.push(k) }
      }
    }
    return p => {
      const i = Math.round(p.x / G_STEP) - x0, j = Math.round(p.y / G_STEP) - y0;
      if (i < 0 || j < 0 || i >= w || j >= h) return 1e6;
      let best = D[j * w + i]; if (best < Infinity) return best + Math.hypot(p.x - (i + x0) * G_STEP, p.y - (j + y0) * G_STEP);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < w && b < h) best = Math.min(best, D[b * w + a] + Math.hypot(di, dj) * G_STEP) }
      return best < Infinity ? best : 1e6;
    };
  }

  function metrics(geo) {
    let g = 1e9; for (const n of nodes) g = Math.min(g, geo(n));
    let sx = 0; for (const n of nodes) sx += n.x; const com = sx / Math.max(1, nodes.length);
    let lo = 1e9, hi = -1e9; for (const n of nodes) if (n.g) { lo = Math.min(lo, n.x); hi = Math.max(hi, n.x) }
    const margin = hi < lo ? -100 : Math.min(com - lo, hi - com);
    let st = 0; for (const b of bars) st = Math.max(st, (b.s || 0) / BREAK);
    let v = 0; for (const n of nodes) v = Math.max(v, Math.abs(n.x - n.px) + Math.abs(n.y - n.py));
    return { g, margin, st, v };
  }

  function genCands(geo, rnd) {
    const out = [], seen = new Set();
    const add = p => {
      const k = Math.round(p.x / 12) + ':' + Math.round(p.y / 12); if (seen.has(k)) return; seen.add(k);
      const { c, ok } = candidates(p); if (!ok) return; if (nodes.length > 1 && c.length < 2) return; out.push({ x: p.x, y: p.y, gp: geo(p) });
    };
    const order = nodes.map((n, i) => [geo(n), i]).sort((a, b) => a[0] - b[0]);
    for (const [, i] of order.slice(0, 6)) {
      const n = nodes[i];
      for (let a = 0; a < 24; a++) for (const d of [60, 95, 125, 146]) { const t = a / 24 * Math.PI * 2; add({ x: n.x + Math.cos(t) * d, y: n.y + Math.sin(t) * d }) }
    }
    out.sort((a, b) => a.gp - b.gp);
    const fwd = out.slice(0, 36);
    // противовес и укрепление: случайные точки у остальных шариков
    const rest = out.slice(36); for (let k = rest.length - 1; k > 0; k--) { const j = (rnd() * (k + 1)) | 0; [rest[k], rest[j]] = [rest[j], rest[k]] }
    const back = [];
    for (const n of nodes) if (n.g) for (const dx of [-40, -80, -120]) for (const dy of [0, -30, -60]) back.push({ x: n.x + dx, y: n.y + dy });
    const b2 = []; for (const p of back) { const before = out.length; add(p); if (out.length > before) b2.push(out.pop()) }
    for (let k = b2.length - 1; k > 0; k--) { const j = (rnd() * (k + 1)) | 0; [b2[k], b2[j]] = [b2[j], b2[k]] }
    return fwd.concat(rest.slice(0, 14), b2.slice(0, 12));
  }

  // оценка кандидатов из состояния base: безопасные (не упало, не лопнуло, шарик не пропал) с прогрессом и метриками
  function evalCands(base, cand, geo, EV, bl) {
    const m0g = (loadState(base), metrics(geo).g), res = [];
    for (const p of cand) {
      if (bl && bl.has(key(p))) continue;
      loadState(base); const nb = nodes.length; if (!place(p)) continue; const br = broken; run(EV);
      if (won) { res.length = 0; res.push({ p, win: true, prog: 1e9, score: 1e9 }); break }
      if (lost || broken > br || nodes.length < nb + 1) continue;
      const m = metrics(geo); res.push({ p, prog: m0g - m.g, m });
    }
    loadState(base); return res;
  }
  let MARGIN = 10; // ход вперёд засчитываем, только если центр тяжести остаётся над опорой с запасом
  const fwdOK = r => r.prog > 6 && r.m.margin > MARGIN;
  const key = p => Math.round(p.x / 12) + ':' + Math.round(p.y / 12);
  const score = r => { const mg = Math.max(-60, Math.min(80, r.m.margin)); return r.prog + .15 * mg - 25 * Math.max(0, r.m.st - .6) - 3 * r.m.v };

  window.solveLevel = function (i, opt = {}) {
    const MAXB = opt.maxBalls || 70, EV = opt.evalSteps || 75, SET = opt.settle || 140;
    MARGIN = opt.margin ?? 10;
    let seed = ((i + 1) * 2654435761 + (opt.seed || 0) * 97) >>> 0 || 1; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296 };
    winMsg = () => { }; show = () => { }; hideScreens(); // пока открыт экран меню, step() стоит на паузе
    if (opt.setup) opt.setup(i); else load(i);
    prog.inf = true; limit = Infinity;
    const goal = typeof goalR !== 'undefined' && goalR ? goalR : terrain[terrain.length - 1];
    const T = opt.target ? opt.target() : { x: (goal.spk ? goal.spk[1] : goalX) + 45, y: goal.y - R }; // цель — за шипами
    const geo = geoField(T);
    run(30);
    const log = [], stack = []; let backs = 0, curBL = new Set(); // curBL — запрещённые ходы из текущего состояния (после отката)
    const fail = reason => ({ ok: false, balls: nodes.length, reason, log });
    for (let mv = 0; mv < 250; mv++) {
      if (won) return { ok: true, balls: nodes.length, moves: mv, log, backs };
      if (lost) return fail('lost');
      if (nodes.length >= MAXB) return fail('limit');
      const base = saveState(), bl = curBL;
      const res = evalCands(base, genCands(geo, rnd), geo, EV, bl);
      let pick = null, mode = 'fwd';
      if (res.length && res[0].win) pick = [res[0]];
      else if (res.some(fwdOK)) pick = res.filter(fwdOK).sort((a, b) => score(b) - score(a));
      else if (res.length) { // вперёд не выходит: ставим противовес/укрепление — то, после которого следующий шаг вперёд самый длинный
        mode = 'cw';
        const pre = res.map(r => ({ r, s: Math.min(60, r.m.margin) + 20 * (1 - Math.min(1, r.m.st)) - 3 * r.m.v })).sort((a, b) => b.s - a.s).slice(0, 10);
        for (const o of pre) {
          loadState(base); place(o.r.p); const br = broken; run(SET); if (won) { o.look = 1e9; continue }
          if (lost || broken > br) { o.look = -1e9; continue }
          const s1 = saveState(), r2 = evalCands(s1, genCands(geo, rnd).slice(0, 24), geo, EV);
          o.look = Math.max(0, ...r2.map(q => q.win ? 1e9 : fwdOK(q) ? q.prog : 0)) + .01 * o.s;
        }
        loadState(base); pre.sort((a, b) => b.look - a.look); pick = pre.filter(o => o.look > -1e9).map(o => o.r);
      }
      let done = false;
      for (const r of (pick || []).slice(0, 12)) {
        loadState(base); place(r.p); const br = broken; run(SET);
        if (won) { log.push([Math.round(r.p.x), Math.round(r.p.y)]); return { ok: true, balls: nodes.length, moves: mv + 1, log, backs } }
        if (!lost && broken === br) {
          done = true; stack.push({ state: base, bl, p: r.p }); curBL = new Set();
          const m = metrics(geo); log.push(opt.trace ? { p: [Math.round(r.p.x), Math.round(r.p.y)], mode, prog: Math.round(r.prog), g: Math.round(m.g), mg: Math.round(m.margin), st: +m.st.toFixed(2), nres: res.length } : [Math.round(r.p.x), Math.round(r.p.y)]);
          break;
        }
      }
      if (!done) { // откат: предыдущий ход запрещаем и выбираем заново
        if (!stack.length || ++backs > 12) { loadState(base); return fail(res.length ? 'unstable' : 'stuck') }
        const prev = stack.pop(); prev.bl.add(key(prev.p)); loadState(prev.state); curBL = prev.bl; log.push({ back: true });
        continue;
      }
    }
    return fail('moves');
  };
})();
