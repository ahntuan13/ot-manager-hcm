// ============================================================
//  Đếm ngược 3 mốc (Giáng Sinh · Năm mới · Tết Nguyên Đán) + hiệu ứng nền ở thẻ tổng quan (hero):
//  tuyết rơi (Giáng Sinh) · pháo hoa (Năm mới) · hoa đào/hoa mai rơi (Tết). Hiệu ứng chạy cho mốc gần nhất khi còn ≤ 60 ngày.
// ============================================================
const FEST_LUNAR = { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23', 2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08' };
const FEST_DEFS = [
  { k: 'xmas', icon: '🎄', name: 'Giáng Sinh', en: 'Christmas', date: y => `${y}-12-25` },
  { k: 'ny', icon: '🎆', name: 'Năm mới', en: 'New Year', date: y => `${y}-01-01` },
  { k: 'tet', icon: '🌸', name: 'Tết', en: 'Lunar New Year', date: y => FEST_LUNAR[y] || '' }
];
const festDay = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
function festList(now) {
  const t = now || new Date(), today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5, GRACE = 3;
  return FEST_DEFS.map(f => {
    let best = null;
    for (let y = t.getFullYear() - 1; y <= t.getFullYear() + 2; y++) { const s = f.date(y); if (!s) continue; const dd = festDay(s) - today; if (dd >= -GRACE && (best === null || dd < best)) best = dd; }
    return { ...f, days: best === null ? 999 : best };
  });
}
function festCountdownHtml(list, near) {
  return '<div class="fest-cd">' + list.map(f => `<div class="fest-i${f === near ? ' on' : ''}" title="${f.name} / ${f.en}"><span class="fest-ic">${f.icon}</span><b>${f.days <= 0 ? '🎉' : f.days + '<em> ngày</em>'}</b><small>${f.days <= 0 ? 'Chúc mừng ' + f.name : f.name}</small></div>`).join('') + '</div>';
}
let _festRaf = 0;
function festStop() { if (_festRaf) cancelAnimationFrame(_festRaf); _festRaf = 0; }
function festRun(cv, kind) {
  festStop();
  const host = cv.parentElement, ctx = cv.getContext('2d'), DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const size = () => { const r = host.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
  size();
  const rnd = (a, b) => a + Math.random() * (b - a);
  let items = [], rockets = [], sparks = [], last = performance.now(), nextRocket = 0;
  const N = Math.round(Math.max(40, Math.min(110, W * H / 5200)));
  if (kind === 'xmas') items = Array.from({ length: N }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.2, 3.6), v: rnd(18, 48), ph: rnd(0, 6.28), a: rnd(.35, .9) }));
  if (kind === 'tet') items = Array.from({ length: Math.round(N * .55) }, () => ({ x: rnd(0, W), y: rnd(-H, H), s: rnd(5, 10), v: rnd(22, 46), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-1.4, 1.4), c: Math.random() < .55 ? ['#ff8fb1', '#ffc2d4'] : ['#ffd23f', '#ffe48a'] }));
  const flower = (x, y, s, rot, c) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    for (let i = 0; i < 5; i++) { ctx.rotate(1.2566); ctx.beginPath(); ctx.ellipse(0, -s * .55, s * .42, s * .6, 0, 0, 6.2832); ctx.fillStyle = c[0]; ctx.globalAlpha = .88; ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, s * .2, 0, 6.2832); ctx.fillStyle = c[1]; ctx.globalAlpha = 1; ctx.fill(); ctx.restore();
  };
  const burst = (x, y) => { const hue = rnd(0, 360), n = 46; for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + rnd(-.05, .05), v = rnd(60, 150); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, h: hue + rnd(-25, 25) }); } };
  function frame(now) {
    if (!cv.isConnected) { _festRaf = 0; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (host.getBoundingClientRect().width !== W) size();
    ctx.clearRect(0, 0, W, H);
    if (kind === 'xmas') {
      ctx.fillStyle = '#fff';
      items.forEach(f => { f.y += f.v * dt; f.ph += dt; f.x += Math.sin(f.ph) * 12 * dt; if (f.y > H + 5) { f.y = -5; f.x = rnd(0, W); } ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill(); });
    } else if (kind === 'tet') {
      items.forEach(f => { f.y += f.v * dt; f.ph += dt * 1.3; f.x += Math.sin(f.ph) * 22 * dt; f.rot += f.vr * dt; if (f.y > H + 12) { f.y = -12; f.x = rnd(0, W); } flower(f.x, f.y, f.s, f.rot, f.c); });
    } else {
      nextRocket -= dt;
      if (nextRocket <= 0) { rockets.push({ x: rnd(W * .08, W * .92), y: H, ty: rnd(H * .12, H * .5), vy: -rnd(190, 260) }); nextRocket = rnd(.45, 1.1); }
      rockets = rockets.filter(r => { r.y += r.vy * dt; ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(r.x - 1, r.y, 2, 7); if (r.y <= r.ty) { burst(r.x, r.y); return false; } return true; });
      sparks = sparks.filter(s => {
        s.vy += 70 * dt; s.vx *= .985; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * .65; if (s.life <= 0) return false;
        ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = `hsl(${s.h},100%,${60 + 20 * s.life}%)`; ctx.beginPath(); ctx.arc(s.x, s.y, 1.9, 0, 6.2832); ctx.fill(); return true;
      });
    }
    ctx.globalAlpha = 1; _festRaf = requestAnimationFrame(frame);
  }
  _festRaf = requestAnimationFrame(frame);
}
(function () {
  if (typeof heroRender !== 'function') return;
  const orig = heroRender;
  heroRender = function () {
    const r = orig.apply(this, arguments);
    try {
      festStop();
      const hero = document.querySelector('#dashHero .hero'), right = hero && hero.querySelector('.hero-r'); if (!hero) return r;
      const list = festList(), near = list.filter(f => f.days >= 0).sort((a, b) => a.days - b.days)[0] || list[0];
      if (right) right.insertAdjacentHTML('beforeend', festCountdownHtml(list, near));
      if (near && near.days <= 60) {
        const cv = document.createElement('canvas'); cv.className = 'hero-fx'; hero.insertBefore(cv, hero.firstChild);
        festRun(cv, near.k === 'xmas' ? 'xmas' : near.k === 'ny' ? 'ny' : 'tet');
      }
    } catch (e) { console.warn('festive', e); }
    return r;
  };
})();
