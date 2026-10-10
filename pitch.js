// Tecmo World Cup '98 Online - the hero's pitch: a bird's-eye floodlit pitch, two small teams passing the ball about.
// Every attack ends in a low shot; most of them the keeper catches and - unlike MAME before the fix - throws straight
// back out. Now and then one goes in, and the scoreboard counts it. The board's clock runs 120 -> 0.
(() => {
  const cv = document.getElementById('pitch');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const g1 = document.getElementById('g1'), g2 = document.getElementById('g2'), clockEl = document.getElementById('clock');

  let W = 0, H = 0, dpr = 1, F = null;          // F = the pitch rectangle in canvas pixels
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the pitch keeps 105:68 and covers the hero (it may run off the edges on a phone)
    const fw = Math.max(W * 1.04, H * 1.04 * 105 / 68), fh = fw * 68 / 105;
    F = { x: (W - fw) / 2, y: (H - fh) / 2 + H * 0.04, w: fw, h: fh };
  }
  // pitch metres (0..105, 0..68) -> canvas
  const px = m => F.x + m / 105 * F.w, py = m => F.y + m / 68 * F.h, pm = m => m / 105 * F.w;

  function drawPitch() {
    ctx.fillStyle = '#0d331c'; ctx.fillRect(0, 0, W, H);
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? '#124526' : '#0f3c21';
      ctx.fillRect(px(i * 105 / bands), py(0), pm(105 / bands) + 1, pm(68) * 1);
    }
    ctx.strokeStyle = 'rgba(241,244,236,.55)'; ctx.lineWidth = Math.max(1.5, pm(0.18));
    ctx.strokeRect(px(0), py(0), pm(105), py(68) - py(0));
    ctx.beginPath(); ctx.moveTo(px(52.5), py(0)); ctx.lineTo(px(52.5), py(68)); ctx.stroke();
    ctx.beginPath(); ctx.arc(px(52.5), py(34), pm(9.15), 0, Math.PI * 2); ctx.stroke();
    for (const s of [0, 1]) {
      const x0 = s ? 105 - 16.5 : 0, x1 = s ? 105 - 5.5 : 0;
      ctx.strokeRect(px(x0), py(13.84), pm(16.5), py(54.16) - py(13.84));
      ctx.strokeRect(px(x1), py(24.84), pm(5.5), py(43.16) - py(24.84));
      const gx = s ? 105 : -2.4;
      ctx.fillStyle = 'rgba(241,244,236,.18)'; ctx.fillRect(px(gx), py(30.34), pm(2.4), py(37.66) - py(30.34));
      ctx.strokeRect(px(gx), py(30.34), pm(2.4), py(37.66) - py(30.34));
    }
    ctx.fillStyle = 'rgba(241,244,236,.6)';
    ctx.beginPath(); ctx.arc(px(52.5), py(34), Math.max(2, pm(0.3)), 0, Math.PI * 2); ctx.fill();
    // floodlight pools
    const lg = ctx.createRadialGradient(W * 0.5, -H * 0.2, 0, W * 0.5, -H * 0.2, H * 1.2);
    lg.addColorStop(0, 'rgba(255,255,230,.10)'); lg.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- the teams
  const HOME = { kit: '#f4d33d', trim: '#1f8f3a', dir: 1 }, AWAY = { kit: '#eef3ff', trim: '#2a5bd7', dir: -1 };
  const SHAPE = [[30, 18], [30, 50], [42, 34], [24, 34], [46, 14]];   // outfield home spots, attacking right (metres)
  const players = [];
  for (const t of [HOME, AWAY]) {
    for (const [x, y] of SHAPE) {
      const hx = t.dir > 0 ? x : 105 - x;
      players.push({ t, hx, hy: y, x: hx, y, vx: 0, vy: 0, keeper: false });
    }
    players.push({ t, hx: t.dir > 0 ? 3 : 102, hy: 34, x: t.dir > 0 ? 3 : 102, y: 34, vx: 0, vy: 0, keeper: true });
  }
  const keeperOf = t => players.find(p => p.t === t && p.keeper);
  const mates = (t, not) => players.filter(p => p.t === t && !p.keeper && p !== not);

  const ball = { x: 52.5, y: 34, from: null, to: null, tx: 0, ty: 0, t: 0, dur: 1, holder: null, kind: 'pass' };
  let attack = HOME, passes = 0, hold = 0, score = [0, 0], pause = 0;

  function passTo(from, to, speed) {
    ball.holder = null; ball.from = { x: ball.x, y: ball.y }; ball.to = to;
    ball.tx = to.x + (to.t.dir) * 2; ball.ty = to.y; ball.t = 0;
    ball.dur = Math.max(0.35, Math.hypot(ball.tx - ball.x, ball.ty - ball.y) / speed); ball.kind = 'pass';
  }
  function shoot(from) {
    const k = keeperOf(from.t === HOME ? AWAY : HOME);
    const goal = Math.random() < 0.28;
    ball.holder = null; ball.from = { x: ball.x, y: ball.y }; ball.to = goal ? null : k;
    ball.tx = from.t === HOME ? (goal ? 106.5 : k.x - 0.4) : (goal ? -1.5 : k.x + 0.4);
    ball.ty = goal ? 30.8 + Math.random() * 6.4 : 30 + Math.random() * 8;
    if (!goal) k.ty = ball.ty;                       // the keeper steps across to meet the low shot
    ball.t = 0; ball.dur = Math.hypot(ball.tx - ball.x, ball.ty - ball.y) / 34; ball.kind = goal ? 'goal' : 'shot';
  }
  function kickoff() {
    for (const p of players) { p.x = p.hx; p.y = p.hy; p.ty = undefined; }
    ball.x = 52.5; ball.y = 34; passes = 0;
    const c = mates(attack)[2]; c.x = 51 - 0 * attack.dir; c.y = 34; ball.holder = c; hold = 0.6;
  }

  function step(dt) {
    if (pause > 0) { pause -= dt; if (pause <= 0) kickoff(); return; }
    // the ball
    if (ball.holder) {
      const h = ball.holder; ball.x = h.x + h.t.dir * 1.1; ball.y = h.y + 0.4;
      hold -= dt;
      if (hold <= 0) {
        if (h.keeper) {                                // the keeper throws it out to a team-mate: never frozen here
          attack = h.t; passes = 0;
          const m = mates(h.t).sort((a, b) => Math.abs(a.y - 34) - Math.abs(b.y - 34))[0];
          passTo(h, m, 26);
        } else if (passes >= 3 + Math.floor(Math.random() * 3) && Math.abs(h.x - (h.t.dir > 0 ? 105 : 0)) < 40) {
          shoot(h);
        } else {
          const ahead = mates(h.t, h).filter(m => (m.x - h.x) * h.t.dir > -6);
          const pool = ahead.length ? ahead : mates(h.t, h);
          passTo(h, pool[Math.floor(Math.random() * pool.length)], 22); passes++;
        }
      }
    } else if (ball.from) {
      ball.t += dt / ball.dur;
      const u = Math.min(1, ball.t), e = 1 - Math.pow(1 - u, 2);
      ball.x = ball.from.x + (ball.tx - ball.from.x) * e; ball.y = ball.from.y + (ball.ty - ball.from.y) * e;
      if (u >= 1) {
        if (ball.kind === 'goal') {
          const s = ball.tx > 52 ? 0 : 1; score[s]++;
          if (g1) g1.textContent = score[0]; if (g2) g2.textContent = score[1];
          ball.from = null; attack = s === 0 ? AWAY : HOME; pause = 1.6;
        } else {
          ball.holder = ball.to; ball.from = null;
          hold = ball.kind === 'shot' ? 1.1 : 0.35 + Math.random() * 0.35;
          if (ball.kind === 'shot') { ball.holder.ty = undefined; }
        }
      }
    }
    // the players: each team shifts with the ball, the receiver runs onto it, the keepers track it across their goal
    const bx = ball.x, by = ball.y;
    for (const p of players) {
      let tx, ty;
      if (p.keeper) { tx = p.hx + p.t.dir * Math.min(5, Math.max(0, (p.t.dir > 0 ? 30 - bx : bx - 75) / 6)); ty = p.ty !== undefined ? p.ty : 34 + (by - 34) * 0.25; }
      else if (ball.to === p && ball.from) { tx = ball.tx - p.t.dir * 1.2; ty = ball.ty; }
      else {
        const shift = (bx - 52.5) * 0.55, att = p.t === attack ? p.t.dir * 7 : -p.t.dir * 3;
        tx = p.hx + shift + att; ty = p.hy + (by - 34) * 0.3;
      }
      const ax = (tx - p.x) * 2.2 - p.vx * 1.6, ay = (ty - p.y) * 2.2 - p.vy * 1.6;
      p.vx += ax * dt; p.vy += ay * dt;
      const sp = Math.hypot(p.vx, p.vy), max = p.keeper ? 6 : 8;
      if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
      if (ball.holder !== p) { p.x += p.vx * dt; p.y += p.vy * dt; }
      p.x = Math.max(-1, Math.min(106, p.x)); p.y = Math.max(1, Math.min(67, p.y));
    }
  }

  function drawPlayers() {
    const r = Math.max(4, pm(0.95));
    for (const p of players) {
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(px(p.x) + r * 0.35, py(p.y) + r * 0.45, r * 1.05, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.keeper ? (p.t === HOME ? '#ff8a2a' : '#c2332f') : p.t.kit;
      ctx.beginPath(); ctx.arc(px(p.x), py(p.y), r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.t.trim; ctx.lineWidth = Math.max(1.4, r * 0.32); ctx.stroke();
    }
    const br = Math.max(2.6, pm(0.5));
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(px(ball.x) + br * 0.6, py(ball.y) + br * 0.7, br, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px(ball.x), py(ball.y), br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1; ctx.stroke();
  }

  // the board's clock: 120 -> 0, then a new match
  let clock = 120, clockAcc = 0;
  function tickClock(dt) {
    clockAcc += dt;
    if (clockAcc >= 0.75) {
      clockAcc = 0; clock--;
      if (clock < 0) { clock = 120; score = [0, 0]; if (g1) g1.textContent = 0; if (g2) g2.textContent = 0; attack = HOME; kickoff(); }
      if (clockEl) clockEl.textContent = clock;
    }
  }

  resize(); kickoff();
  addEventListener('resize', () => { resize(); if (reduce) frame(0); });
  let visible = true, last = performance.now();
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce && visible && !document.hidden) { step(dt); tickClock(dt); }
    drawPitch(); drawPlayers();
    if (!reduce) requestAnimationFrame(frame);
  }
  if (reduce) { for (let i = 0; i < 90; i++) step(1 / 30); frame(performance.now()); }
  else requestAnimationFrame(frame);
})();
