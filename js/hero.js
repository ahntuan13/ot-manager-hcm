// ============================================================
//  THẺ TỔNG QUAN (hero) đầu trang Tổng quan OT — kiểu dashboard hiện đại:
//  tổng OT luỹ kế của kỳ, so với kỳ trước, xu hướng các kỳ gần nhất, vòng tròn % NV dưới mốc KPI 45h.
// ============================================================
let _heroChart = null;
function heroMkLabel(mk) { const m = +mk.split('-')[1]; return 'T' + m; }
function heroCompute() {
  if (typeof DB === 'undefined' || !activeMK || !DB[activeMK]) return null;
  const df = (document.getElementById('deptFilterDash') || {}).value || '__all__';
  const sumOf = mk => { const per = buildPeriods(mk); const t = getTotals(mk, df, per.length ? per.length - 1 : null); return { t, sum: t.reduce((a, x) => a + (x.total || 0), 0) }; };
  const mks = Object.keys(DB).sort(), i = mks.indexOf(activeMK), win = mks.slice(Math.max(0, i - 11), i + 1);
  const ser = win.map(mk => ({ mk, v: Math.round(sumOf(mk).sum) }));
  const cur = sumOf(activeMK), prev = i > 0 ? sumOf(mks[i - 1]).sum : null;
  const tot = cur.t.map(x => x.total || 0);
  const withOt = tot.filter(v => v > 0).length, o45 = tot.filter(v => v > 45).length, o70 = tot.filter(v => v > 70).length;
  const safe = tot.length ? Math.round((tot.length - o45) * 100 / tot.length) : 0;
  let running = false; try { const mx = (DB[activeMK].snapshots || []).slice(-1)[0]; running = !!mx && mx < isoDate(cycleEndOf(activeMK)); } catch (e) {}
  return { df, sum: cur.sum, prev, ser, n: tot.length, withOt, o45, o70, safe, running, max: Math.max(0, ...ser.map(x => x.v)) };
}
function heroRender() {
  const box = document.getElementById('dashHero'); if (!box) return;
  const d = heroCompute();
  if (_heroChart) { try { _heroChart.destroy(); } catch (e) {} _heroChart = null; }
  if (!d) { box.innerHTML = ''; return; }
  const fmt = v => Math.round(v).toLocaleString('vi-VN');
  const delta = d.prev ? (d.sum - d.prev) * 100 / d.prev : null;
  const dl = delta == null ? '' : `<span class="hero-delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1).replace('.', ',')}%</span><span class="hero-sub">so với kỳ trước (${fmt(d.prev)}h)${d.running ? ' · kỳ đang chạy' : ''}</span>`;
  const R = 74, C = 2 * Math.PI * R, off = C * (1 - d.safe / 100);
  box.innerHTML = `<div class="hero">
    <div class="hero-l">
      <div class="hero-k">TỔNG OT LUỸ KẾ · ${typeof fmtCompanyMK === 'function' ? fmtCompanyMK(activeMK) : activeMK}${d.df !== '__all__' ? ' · ' + d.df : ''}</div>
      <div class="hero-big">${fmt(d.sum)}<small>h</small></div>
      <div class="hero-row">${dl}</div>
      <div class="hero-stats"><div><b>${d.n}</b><span>NV theo dõi</span></div><div><b>${d.withOt}</b><span>NV có OT</span></div><div><b style="color:#FFC857">${d.o45}</b><span>NV &gt; 45h</span></div><div><b style="color:#FF8A80">${d.o70}</b><span>NV &gt; 70h</span></div></div>
      <div class="hero-btns"><button onclick="goPage('settings')">⬆ Upload chấm công</button><button class="ghost" onclick="goPage('action')">Action Plan</button></div>
    </div>
    <div class="hero-m"><div class="hero-mh"><span>Tổng OT mỗi kỳ (giờ)</span><span>Cao nhất <b>${fmt(d.max)}h</b></span></div><div class="hero-cv"><canvas id="heroCv"></canvas></div></div>
    <div class="hero-r"><div class="hero-ring"><svg viewBox="0 0 180 180"><defs><linearGradient id="hgr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2EE6A8"/><stop offset="1" stop-color="#7CF2C8"/></linearGradient></defs><circle cx="90" cy="90" r="${R}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="13"/><circle cx="90" cy="90" r="${R}" fill="none" stroke="url(#hgr)" stroke-width="13" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 90 90)"/></svg><div class="hero-pct"><b>${d.safe}%</b><span>dưới mốc 45h</span></div></div>
      <div class="hero-rn"><b>${d.n - d.o45}/${d.n} NV</b><span>${d.o45} vượt KPI · ${d.o70} vượt chi trả 70h</span></div></div>
  </div>`;
  const cv = document.getElementById('heroCv'); if (!cv || typeof Chart === 'undefined') return;
  const ctx = cv.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, 'rgba(255,255,255,.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  _heroChart = new Chart(ctx, { type: 'line', data: { labels: d.ser.map(x => heroMkLabel(x.mk)), datasets: [{ data: d.ser.map(x => x.v), borderColor: '#fff', borderDash: [], backgroundColor: g, fill: true, tension: .35, borderWidth: 2.2, pointRadius: d.ser.map((_, i) => i === d.ser.length - 1 ? 5 : 3), pointBackgroundColor: d.ser.map((_, i) => i === d.ser.length - 1 ? '#1769b5' : '#fff'), pointBorderColor: '#fff', pointBorderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 8, right: 6 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) + 'h' } }, dataLabels: false }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: 'rgba(255,255,255,.75)', font: { size: 11 } } }, y: { display: false, beginAtZero: true } } } });
}
(function () {
  if (typeof renderDash !== 'function') return;
  const orig = renderDash;
  renderDash = function () { const r = orig.apply(this, arguments); try { heroRender(); } catch (e) { console.warn('hero', e); } return r; };
})();
try { if (typeof Chart !== 'undefined') Chart.defaults.font.family = "'Plus Jakarta Sans','Inter',-apple-system,'Segoe UI',sans-serif"; } catch (e) {}
