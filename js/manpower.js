// ============================================================
//  MANPOWER — nhân sự theo dự án HCM-EC (đang khoá Admin: xem MANPOWER_ADMIN_ONLY trong app.js)
// ============================================================
const MP_GROUP = 'HCM-EC';
const MP_KPI_H = 45, MP_PAY_H = 70;
const MP_C = { blue:'#2a78d6', orange:'#eb6834', aqua:'#1baf7a', yellow:'#eda100', red:'#e34948' };

function mpProjects() { return projectsInGroup(MP_GROUP).filter(p => p !== UNASSIGNED_PROJ).sort(); }
function mpShort(p) { return p.replace(/^HCM[\s-]+/i, ''); }

// Tổng OT từng NV của 1 chu kỳ (cùng nguồn getTotals với toàn app)
function mpTotalsMap(mk, cache) {
  if (cache[mk]) return cache[mk];
  const m = {};
  if (DB[mk]) {
    const periods = buildPeriods(mk);
    getTotals(mk, '__all__', periods.length ? periods.length - 1 : null).forEach(t => { if (t.staffCode) m[t.staffCode] = t.total || 0; });
  }
  return (cache[mk] = m);
}
// Chỉ số 1 dự án trong 1 chu kỳ
function mpMetric(proj, mk, cache) {
  const codes = projectEmployeesForMonth(MP_GROUP, proj, mk);
  const tm = mpTotalsMap(mk, cache);
  let ot = 0, o45 = 0, o70 = 0;
  codes.forEach(c => { const v = tm[c] || 0; ot += v; if (v > MP_KPI_H) o45++; if (v > MP_PAY_H) o70++; });
  const hc = codes.length;
  return { hc, ot: Math.round(ot * 10) / 10, per: hc ? ot / hc : 0, o45, o70, has: !!DB[mk] };
}
function mpPlanFor(proj, mk) {
  const o = HC_PLAN[MP_GROUP + '::' + proj]; if (!o) return null;
  const ks = Object.keys(o).sort().filter(k => k <= mk);
  return ks.length ? o[ks[ks.length - 1]].n : null;
}
function mpPeriodList() {
  const mks = Object.keys(DB).sort();
  const opts = [];
  const years = [...new Set(mks.map(m => m.slice(0, 4)))];
  [...mks].reverse().forEach(m => opts.push({ v: 'M:' + m, l: 'Tháng ' + fmtMK(m) }));
  [...new Set(mks.map(quarterKeyOf))].sort().reverse().forEach(q => opts.push({ v: 'Q:' + q, l: 'Quý ' + q.replace('-', ' ') }));
  years.sort().reverse().forEach(y => opts.push({ v: 'Y:' + y, l: 'Năm ' + y }));
  return opts;
}
function mpPeriodMks(v) {
  const all = Object.keys(DB).sort();
  const [t, k] = (v || '').split(':');
  if (t === 'M') return all.filter(m => m === k);
  if (t === 'Q') return all.filter(m => quarterKeyOf(m) === k);
  if (t === 'Y') return all.filter(m => m.slice(0, 4) === k);
  return [];
}
function mpAgg(proj, mks, cache) {
  let hcSum = 0, ot = 0, n = 0, last = null;
  mks.forEach(mk => { const m = mpMetric(proj, mk, cache); if (!m.has) return; hcSum += m.hc; ot += m.ot; n++; last = m; });
  return { hc: n ? hcSum / n : 0, ot: Math.round(ot * 10) / 10, per: hcSum ? ot / hcSum : 0, o45: last ? last.o45 : 0, o70: last ? last.o70 : 0, n };
}
const mpR1 = v => Math.round(v * 10) / 10;

function mpSavePlan(proj, mk, val) {
  if (!isManager()) { toast('⚠️ Chỉ Admin/Quản lý được nhập kế hoạch.'); return; }
  const key = MP_GROUP + '::' + proj;
  if (val === '' || val === null) { if (HC_PLAN[key]) { delete HC_PLAN[key][mk]; if (!Object.keys(HC_PLAN[key]).length) delete HC_PLAN[key]; } }
  else { const n = Math.max(0, parseFloat(val) || 0); (HC_PLAN[key] = HC_PLAN[key] || {})[mk] = { n, at: Date.now() }; }
  saveHcPlan();
  toast('💾 Đã lưu tạm kế hoạch nhân sự — bấm Lưu & đồng bộ để người khác thấy.');
  renderManpower();
}

function renderManpower() {
  if (!canSeeManpower()) return;
  const sel = document.getElementById('mpPeriod'); if (!sel) return;
  const prev = sel.value, opts = mpPeriodList();
  sel.innerHTML = opts.map(o => `<option value="${o.v}">${o.l}</option>`).join('') || '<option value="">— Chưa có dữ liệu OT —</option>';
  if (opts.some(o => o.v === prev)) sel.value = prev; else if (opts.length) sel.value = opts[0].v;
  const mks = mpPeriodMks(sel.value);
  const isMonth = (sel.value || '').startsWith('M:');
  const lastMk = mks[mks.length - 1];
  const cache = {}, projs = mpProjects();
  const agg = projs.map(p => ({ p, ...mpAgg(p, mks, cache) }));
  const planOf = p => lastMk ? mpPlanFor(p, lastMk) : null;

  // ── KPI tiles
  const totHc = agg.reduce((s, a) => s + a.hc, 0), totOt = agg.reduce((s, a) => s + a.ot, 0);
  const hcSum = agg.reduce((s, a) => s + a.hc * a.n, 0);
  const unHc = lastMk ? projectEmployeesForMonth(MP_GROUP, UNASSIGNED_PROJ, lastMk).length : 0;
  const planTot = agg.reduce((s, a) => s + (planOf(a.p) || 0), 0), hasPlan = agg.some(a => planOf(a.p) !== null);
  const mv = mpMovement(); const mvLast = mv.find(r => r.mk === lastMk) || { inn: 0, out: 0, res: 0 };
  const tile = (v, l, c) => `<div class="mk"><b style="color:${c || 'inherit'}">${v}</b><span>${l}</span></div>`;
  document.getElementById('mpKpi').innerHTML =
    tile(mpR1(totHc), 'Tổng nhân sự (TB kỳ) / Headcount') +
    tile(hasPlan ? (totHc - planTot >= 0 ? '+' : '') + mpR1(totHc - planTot) : '—', 'Chênh so với kế hoạch / vs plan', hasPlan && totHc > planTot ? MP_C.red : MP_C.aqua) +
    tile(hcSum ? mpR1(totOt / hcSum) + 'h' : '—', 'OT TB / người / tháng') +
    tile(agg.reduce((s, a) => s + a.o45, 0), 'NV > 45h (tháng cuối kỳ)', MP_C.orange) +
    tile(agg.reduce((s, a) => s + a.o70, 0), 'NV > 70h (tháng cuối kỳ)', MP_C.red) +
    tile(unHc, 'Chưa gán dự án', unHc ? MP_C.yellow : 'inherit') +
    tile(`+${mvLast.inn} / −${mvLast.out + mvLast.res}`, 'Vào / Ra (tháng cuối kỳ)');

  // ── 1. Overview charts
  const labels = agg.map(a => mpShort(a.p));
  const mk2 = (id, cfg) => { killChart(id); const el = document.getElementById(id); if (el) CH[id] = new Chart(el, cfg); };
  const noGrid = { grid: { display: false }, ticks: { font: { size: 10 }, autoSkip: false } };
  // Chiều cao theo số dự án để hiện ĐỦ tên (không bị Chart.js tự ẩn bớt nhãn)
  const hBox = Math.max(300, labels.length * 34 + 70);
  ['cMpHeadBox', 'cMpOtBox'].forEach(i => { const b = document.getElementById(i); if (b) b.style.height = hBox + 'px'; });
  mk2('cMpHead', { type: 'bar', data: { labels, datasets: [
    { label: 'Thực tế', data: agg.map(a => mpR1(a.hc)), backgroundColor: MP_C.blue, maxBarThickness: 22 },
    { label: 'Kế hoạch', data: agg.map(a => planOf(a.p)), backgroundColor: '#c9ced6', maxBarThickness: 22 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(128,128,128,.12)' } }, y: noGrid } } });
  mk2('cMpOt', { type: 'bar', data: { labels, datasets: [
    { label: 'OT/người (h)', data: agg.map(a => mpR1(a.per)), backgroundColor: agg.map(a => a.per > MP_KPI_H ? MP_C.red : MP_C.blue), maxBarThickness: 22 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, suggestedMax: 50, grid: { color: 'rgba(128,128,128,.12)' } }, y: noGrid } },
    plugins: [{ id: 'mpLine45', afterDraw(c) { const x = c.scales.x.getPixelForValue(MP_KPI_H); if (x < c.chartArea.left || x > c.chartArea.right) return; const g = c.ctx; g.save(); g.strokeStyle = MP_C.red; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x, c.chartArea.top); g.lineTo(x, c.chartArea.bottom); g.stroke(); g.fillStyle = MP_C.red; g.font = '10px sans-serif'; g.fillText('45h', x + 3, c.chartArea.top + 10); g.restore(); } }] });

  // plan table (nhập kế hoạch)
  const canEdit = isManager() && isMonth;
  document.getElementById('mpPlanTable').innerHTML =
    `<thead><tr><th>Dự án</th><th>Thực tế</th><th>Kế hoạch</th><th>Chênh</th><th>OT/người</th><th>NV&gt;45h</th><th>NV&gt;70h</th></tr></thead><tbody>` +
    agg.map(a => { const pl = planOf(a.p), d = pl === null ? null : mpR1(a.hc - pl);
      return `<tr><td>${a.p}</td><td>${mpR1(a.hc)}</td><td>${canEdit ? `<input type="number" min="0" value="${pl ?? ''}" onchange="mpSavePlan('${a.p.replace(/'/g, "\\'")}','${lastMk}',this.value)">` : (pl ?? '—')}</td>
      <td style="color:${d === null ? 'inherit' : d > 0 ? MP_C.red : d < 0 ? MP_C.yellow : MP_C.aqua}">${d === null ? '—' : (d > 0 ? '+' : '') + d}</td><td>${mpR1(a.per)}h</td><td>${a.o45}</td><td>${a.o70}</td></tr>`; }).join('') + '</tbody>';
  document.getElementById('mpPlanNote').textContent = isMonth
    ? (isManager() ? 'Nhập số người theo kế hoạch cho tháng đang chọn — áp dụng từ tháng này trở đi cho tới khi nhập mốc mới. Sau đó bấm Lưu & đồng bộ.' : 'Kế hoạch do Admin/Quản lý nhập.')
    : 'Chọn một THÁNG cụ thể để nhập/sửa kế hoạch nhân sự.';

  // ── 2. Biến động
  const mvShow = mv.slice(-12);
  mk2('cMpMove', { type: 'bar', data: { labels: mvShow.map(r => fmtMK(r.mk)), datasets: [
    { label: 'Vào mới / chuyển vào', data: mvShow.map(r => r.inn), backgroundColor: MP_C.aqua, maxBarThickness: 20 },
    { label: 'Nghỉ việc', data: mvShow.map(r => -r.res), backgroundColor: MP_C.red, maxBarThickness: 20 },
    { label: 'Chuyển ra phòng ban khác', data: mvShow.map(r => -r.out), backgroundColor: MP_C.orange, maxBarThickness: 20 },
    { label: 'Chuyển giữa dự án', data: mvShow.map(r => r.between), backgroundColor: MP_C.blue, maxBarThickness: 20 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { x: noGrid, y: { grid: { color: 'rgba(128,128,128,.12)' } } } } });
  document.getElementById('mpMoveTable').innerHTML = `<thead><tr><th>Chu kỳ</th><th>Tổng nhân sự</th><th>Vào</th><th>Nghỉ việc</th><th>Chuyển ra</th><th>Chuyển giữa dự án</th></tr></thead><tbody>` +
    mvShow.map(r => `<tr><td>${fmtMK(r.mk)}</td><td>${r.head}</td><td>${r.inn}</td><td>${r.res}</td><td>${r.out}</td><td>${r.between}</td></tr>`).join('') + '</tbody>';

  // ── 3. Heatmap
  const allMks = Object.keys(DB).sort();
  const years = [...new Set(allMks.map(m => m.slice(0, 4)))];
  const cols = [];
  allMks.forEach(m => cols.push({ l: 'T' + parseInt(m.slice(5), 10), mks: [m] }));
  [...new Set(allMks.map(quarterKeyOf))].sort().forEach(q => cols.push({ l: q.slice(-2), mks: allMks.filter(m => quarterKeyOf(m) === q), sep: true }));
  years.forEach(y => cols.push({ l: y, mks: allMks.filter(m => m.slice(0, 4) === y), sep: true }));
  const shade = v => { const t = Math.max(0, Math.min(1, (v - 12) / 36)); const a = [235, 243, 252], b = [42, 120, 214]; return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`; };
  document.getElementById('mpHeat').innerHTML = `<thead><tr><th style="text-align:left">Dự án</th>${cols.map(c => `<th class="${c.sep ? 'sep' : ''}">${c.l}</th>`).join('')}</tr></thead><tbody>` +
    projs.map(p => `<tr><td style="text-align:left">${mpShort(p)}</td>${cols.map(c => { const a = mpAgg(p, c.mks, cache); if (!a.n || !a.hc) return `<td class="${c.sep ? 'sep' : ''}" style="color:#aaa">—</td>`;
      return `<td class="${c.sep ? 'sep' : ''} ${a.per > MP_KPI_H ? 'hc' : ''}" style="background:${shade(a.per)};color:${a.per > 32 ? '#fff' : 'inherit'}">${mpR1(a.per)}</td>`; }).join('')}</tr>`).join('') + '</tbody>';

  // ── 4. Quadrant
  const withHc = agg.filter(a => a.hc > 0);
  const avgHc = withHc.length ? withHc.reduce((s, a) => s + a.hc, 0) / withHc.length : 0;
  const maxOt = Math.max(1, ...withHc.map(a => a.ot));
  const pts = (arr) => arr.map(a => ({ x: mpR1(a.hc), y: mpR1(a.per), r: 6 + 20 * Math.sqrt(a.ot / maxOt), name: mpShort(a.p) }));
  const over = withHc.filter(a => a.per > MP_KPI_H), ok = withHc.filter(a => a.per <= MP_KPI_H);
  mk2('cMpQuad', { type: 'bubble', data: { datasets: [
    { label: 'Quá tải (>45h/người)', data: pts(over), backgroundColor: 'rgba(227,73,72,.55)', borderColor: MP_C.red },
    { label: 'Trong mức', data: pts(ok), backgroundColor: 'rgba(42,120,214,.5)', borderColor: MP_C.blue }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: c => ` ${c.raw.name}: ${c.raw.x} người · ${c.raw.y}h/người` } } },
      scales: { x: { title: { display: true, text: 'Số người', font: { size: 11 } }, beginAtZero: true, grid: { color: 'rgba(128,128,128,.12)' } }, y: { title: { display: true, text: 'OT / người (h)', font: { size: 11 } }, beginAtZero: true, suggestedMax: 60, grid: { color: 'rgba(128,128,128,.12)' } } } },
    plugins: [{ id: 'mpQuadDraw', afterDatasetsDraw(c) { const g = c.ctx, y = c.scales.y.getPixelForValue(MP_KPI_H); g.save(); g.strokeStyle = MP_C.red; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(c.chartArea.left, y); g.lineTo(c.chartArea.right, y); g.stroke(); g.fillStyle = MP_C.red; g.font = '10px sans-serif'; g.fillText('45h', c.chartArea.left + 4, y - 4); g.setLineDash([]); g.fillStyle = '#444'; g.font = '11px sans-serif';
      c.data.datasets.forEach((d, i) => c.getDatasetMeta(i).data.forEach((el, j) => { const r = d.data[j]; g.fillText(r.name, el.x + el.options.radius + 3, el.y + 4); })); g.restore(); } }] });
  document.getElementById('mpQuadNote').innerHTML =
    (over.length ? `⚠️ <b>Quá tải</b> (OT/người > 45h): ${over.map(a => `${mpShort(a.p)} (${mpR1(a.per)}h)`).join(', ')} — cân nhắc bổ sung người hoặc rà lại kế hoạch OT.<br>` : '✅ Không dự án nào vượt 45h/người.<br>') +
    (ok.filter(a => a.per < 25).length ? `💡 <b>Còn năng lực</b> (OT/người < 25h): ${ok.filter(a => a.per < 25).map(a => `${mpShort(a.p)} (${mpR1(a.per)}h)`).join(', ')} — có thể điều phối hỗ trợ dự án quá tải.` : '') +
    (withHc.length ? `<br><span style="color:var(--text3)">Số người TB giữa các dự án: ${mpR1(avgHc)}. Kích thước bong bóng = tổng OT của dự án.</span>` : '');
}

// Biến động nhân sự HCM-EC theo chu kỳ, dựng từ PROJ_MOVES + danh sách thành viên từng tháng
function mpMovement() {
  const mks = Object.keys(DB).sort(), unK = MP_GROUP + '::' + UNASSIGNED_PROJ;
  const inEC = k => !!k && k.startsWith(MP_GROUP + '::');
  const rows = mks.map(mk => ({ mk, head: 0, inn: 0, out: 0, res: 0, between: 0 }));
  const idx = {}; rows.forEach(r => idx[r.mk] = r);
  const projAll = projectsInGroup(MP_GROUP);
  rows.forEach(r => { r.head = projAll.reduce((s, p) => s + projectEmployeesForMonth(MP_GROUP, p, r.mk).length, 0); });
  Object.keys(PROJ_MOVES).forEach(code => Object.keys(PROJ_MOVES[code]).forEach(mk => {
    const r = idx[mk]; if (!r) return;
    const e = PROJ_MOVES[code][mk], from = e.prev || null, to = e.key || null;
    if (e.del) { if (inEC(from)) r.res++; return; }
    if (inEC(to) && !inEC(from)) r.inn++;
    else if (inEC(from) && !inEC(to)) r.out++;
    else if (inEC(from) && inEC(to) && from !== to && from !== unK) r.between++;
  }));
  return rows;
}
