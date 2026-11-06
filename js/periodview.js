// ── Xem theo QUÝ / NĂM cho Tổng quan OT, OT phòng ban, Danh sách NV OT ──────────────────────────
// Dùng chung 1 bộ vẽ: chọn quý hoặc năm → hiện KPI, biểu đồ OT theo từng tháng (Năm = T1…T12) và bảng chi tiết.
// Khung tab "Theo tuần / Theo tháng" cũ giữ nguyên; khi sang Quý/Năm thì ẩn các khối cũ và hiện khối này.
const PV = { sel: { dash: '', dept: '', emp: '' } };
const PV_ROOT = { dash: 'pg-dash', dept: 'pg-dept', emp: 'pg-employees' };
const pvTab = k => (k === 'dash' ? dashTab : k === 'dept' ? deptTab : empTab);
const pvOn = k => { const t = pvTab(k); return t === 'quarter' || t === 'year'; };
function pvKeep(k) {
  if (k === 'dash') return document.querySelector('#pg-dash .dash-controls');
  if (k === 'dept') return document.querySelector('#pg-dept .dept-bar');
  const b = document.getElementById('empTabWeek'); return b && b.parentElement.parentElement.parentElement;
}
function pvBox(k) {
  let b = document.getElementById('pvBox_' + k);
  if (!b) { b = document.createElement('div'); b.id = 'pvBox_' + k; b.className = 'pv-box'; document.getElementById(PV_ROOT[k]).appendChild(b); }
  return b;
}
function pvLeave(k) {
  const root = document.getElementById(PV_ROOT[k]); if (!root) return;
  [...root.children].forEach(c => c.classList.remove('pv-hide'));
  const b = document.getElementById('pvBox_' + k); if (b) b.style.display = 'none';
  ['pvCh_' + k + '_a', 'pvCh_' + k + '_b'].forEach(id => { try { killChart(id); } catch (e) {} });
}
function pvEnter(k) {
  const root = document.getElementById(PV_ROOT[k]), keep = pvKeep(k), box = pvBox(k);
  [...root.children].forEach(c => {
    const stay = c === box || c === keep || (keep && c.contains(keep)) || c.classList.contains('page-title');
    c.classList.toggle('pv-hide', !stay);
  });
  box.style.display = '';
  const wb = { dash: 'dashWeekBar', dept: 'deptWeekBar', emp: 'empWeekBar' }[k]; const w = document.getElementById(wb); if (w) w.classList.add('pv-hide');
  return box;
}
const pvMonthsOf = (mode, sel) => {
  if (mode === 'year') return Array.from({ length: 12 }, (_, i) => `${sel}-${String(i + 1).padStart(2, '0')}`);
  const [y, q] = sel.split('-Q').map(Number); return [1, 2, 3].map(i => `${y}-${String((q - 1) * 3 + i).padStart(2, '0')}`);
};
function pvOptions(mode, keys) {
  const ys = [...new Set(keys.map(m => m.slice(0, 4)))].sort();
  if (mode === 'year') return ys.map(y => [y, `Năm ${y} (T1–T12)`]);
  const qs = [...new Set(keys.map(quarterKeyOf))].sort();
  return qs.map(q => [q, fmtQK(q)]);
}
function pvRender(k) {
  const mode = pvTab(k), box = pvEnter(k), keys = Object.keys(DB).sort();
  if (!keys.length) { box.innerHTML = '<div class="card" style="padding:20px;color:var(--text2)">Chưa có dữ liệu. Vào tab Upload để bắt đầu.</div>'; return; }
  const opts = pvOptions(mode, keys);
  if (!opts.some(o => o[0] === PV.sel[k])) PV.sel[k] = opts.length ? opts[opts.length - 1][0] : '';
  const sel = PV.sel[k], months = pvMonthsOf(mode, sel);
  const deptEl = document.getElementById(k === 'dash' ? 'deptFilterDash' : k === 'dept' ? 'deptSel' : 'empDeptFilter');
  const dept = (deptEl && deptEl.value) || '__all__';
  const lbl = m => (mode === 'year' ? 'T' + (+m.slice(5)) : 'T' + (+m.slice(5)) + '/' + m.slice(0, 4));
  const namesOf = (mk, d) => { const D = DB[mk]; if (!D) return []; return d === '__all__' ? (D.names || []) : ((D.depts && D.depts[d]) || []); };
  const depts = dept === '__all__' ? (typeof getAllDepts === 'function' ? getAllDepts() : []) : [dept];
  const empTot = (mk, n) => { const e = DB[mk] && DB[mk].employees[n]; return e ? totalOf(e) : 0; };
  // dữ liệu từng tháng
  const per = months.map(mk => {
    const has = !!DB[mk], names = namesOf(mk, dept);
    const tots = names.map(n => empTot(mk, n)), total = tots.reduce((a, b) => a + b, 0);
    return { mk, has, n: names.length, total: Math.round(total * 60) / 60, over: tots.filter(t => t > 70).length, warn: tots.filter(t => t > 60 && t <= 70).length };
  });
  const have = per.filter(p => p.has);
  const sum = have.reduce((a, p) => a + p.total, 0), nvAll = new Set(); have.forEach(p => namesOf(p.mk, dept).forEach(n => nvAll.add(n)));
  const peak = have.length ? have.reduce((a, p) => (p.total > a.total ? p : a), have[0]) : null;
  const overSum = have.reduce((a, p) => a + p.over, 0);
  const card = (t, v, s) => `<div class="mc"><div class="ml">${t}</div><div class="mv">${v}</div><div class="ms">${s}</div></div>`;
  const kpi = card('Tổng OT', fmtH(Math.round(sum * 60) / 60), `${have.length}/${months.length} tháng có dữ liệu`)
    + card('Số NV', nvAll.size, 'NV có mặt trong kỳ')
    + card('TB OT / tháng', have.length ? fmtH(Math.round(sum / have.length * 60) / 60) : '—', 'trên các tháng có dữ liệu')
    + card('Lượt NV vượt 70h', overSum, 'cộng dồn các tháng', '')
    + card('Tháng cao nhất', peak ? lbl(peak.mk) : '—', peak ? fmtH(peak.total) : '');
  // bảng
  let thead, tbody;
  const byEmp = k === 'emp' || dept !== '__all__';
  if (!byEmp) {
    thead = `<tr><th>Phòng ban</th>${months.map(m => `<th>${lbl(m)}</th>`).join('')}<th>Tổng</th><th>Lượt vượt 70h</th></tr>`;
    tbody = depts.map(d => {
      const vals = months.map(mk => DB[mk] && DB[mk].depts && DB[mk].depts[d] ? Math.round(namesOf(mk, d).reduce((a, n) => a + empTot(mk, n), 0) * 60) / 60 : null);
      const ov = months.reduce((a, mk) => a + namesOf(mk, d).filter(n => empTot(mk, n) > 70).length, 0);
      const t = vals.reduce((a, v) => a + (v || 0), 0);
      return `<tr><td><b>${d}</b></td>${vals.map(v => `<td>${v === null ? '<span style="color:var(--text3)">—</span>' : fmtH(v)}</td>`).join('')}<td style="font-weight:700;color:var(--accent)">${fmtH(Math.round(t * 60) / 60)}</td><td>${ov ? `<span class="badge bd">${ov}</span>` : 0}</td></tr>`;
    }).join('');
  } else {
    const q = ((document.getElementById('nvSearch') || {}).value || '').trim().toLowerCase();
    const all = new Map(); months.forEach(mk => namesOf(mk, dept).forEach(n => { if (!all.has(n)) all.set(n, null); }));
    const rows = [...all.keys()].map(n => {
      const vals = months.map(mk => (DB[mk] && DB[mk].employees[n]) ? Math.round(empTot(mk, n) * 60) / 60 : null);
      const t = vals.reduce((a, v) => a + (v || 0), 0), ov = vals.filter(v => v > 70).length;
      let dp = ''; for (const mk of months) { const D = DB[mk]; if (D && D.depts) { const f = Object.keys(D.depts).find(x => D.depts[x].includes(n)); if (f) dp = f; } }
      return { n, vals, t, ov, dp, label: (typeof nvLabelByName === 'function' ? nvLabelByName(n, DB, keys) : n) };
    }).filter(r => !q || r.label.toLowerCase().includes(q)).sort((a, b) => b.t - a.t);
    thead = `<tr><th>Nhân viên</th><th>Phòng ban</th>${months.map(m => `<th>${lbl(m)}</th>`).join('')}<th>Tổng</th><th>Tháng vượt 70h</th></tr>`;
    tbody = rows.map(r => `<tr><td>${r.label}</td><td>${r.dp}</td>${r.vals.map(v => `<td${v > 70 ? ' style="color:#C0392B;font-weight:600"' : ''}>${v === null ? '<span style="color:var(--text3)">—</span>' : fmtH(v)}</td>`).join('')}<td style="font-weight:700;color:var(--accent)">${fmtH(Math.round(r.t * 60) / 60)}</td><td>${r.ov ? `<span class="badge bd">${r.ov}</span>` : 0}</td></tr>`).join('') || `<tr><td colspan="${months.length + 4}" style="text-align:center;padding:16px;color:var(--text2)">Không có dữ liệu.</td></tr>`;
  }
  const title = mode === 'year' ? 'Tổng OT từng tháng trong năm' : 'Tổng OT từng tháng trong quý';
  box.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin:2px 0 12px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--text2)">${mode === 'year' ? 'Năm' : 'Quý'}:</span>
      <select id="pvSel_${k}" onchange="PV.sel['${k}']=this.value;pvRender('${k}')" style="min-width:170px">${opts.map(o => `<option value="${o[0]}"${o[0] === sel ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>
      <span style="font-size:12px;color:var(--text2)">${dept === '__all__' ? 'Tất cả phòng ban' : dept}${mode === 'year' ? ' · dữ liệu theo chu kỳ OT từng tháng (T1 → T12)' : ''}</span></div>
    <div class="metrics">${kpi}</div>
    <div class="grid2">
      <div class="card"><div class="card-title">${title}</div><div style="position:relative;width:100%;height:260px"><canvas id="pvCh_${k}_a"></canvas></div></div>
      <div class="card"><div class="card-title">Số NV vượt mức theo tháng <i style="font-weight:400;font-size:11px;color:var(--text3)">/ Employees over limit</i></div>
        <div class="legend"><span><span class="ldot" style="background:#E8A33D"></span>Cảnh báo 60–70h</span><span><span class="ldot" style="background:#C0392B"></span>Vượt 70h</span></div>
        <div style="position:relative;width:100%;height:240px"><canvas id="pvCh_${k}_b"></canvas></div></div>
    </div>
    <div class="card"><div class="card-title" style="margin-bottom:8px">${byEmp ? 'Chi tiết nhân viên' : 'Tổng hợp theo phòng ban'} — ${opts.find(o => o[0] === sel)?.[1] || ''}</div>
      <div class="tbl-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div></div>`;
  const labels = months.map(lbl), ax = { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { font: { size: 10 } }, beginAtZero: true } };
  killChart('pvCh_' + k + '_a'); killChart('pvCh_' + k + '_b');
  let ds;
  if (dept === '__all__' && depts.length > 1) {
    ds = depts.map((d, i) => ({ label: d, backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length], borderWidth: 0, borderRadius: 2,
      data: months.map(mk => DB[mk] && DB[mk].depts && DB[mk].depts[d] ? Math.round(namesOf(mk, d).reduce((a, n) => a + empTot(mk, n), 0) * 60) / 60 : 0) }));
    CH['pvCh_' + k + '_a'] = new Chart(document.getElementById('pvCh_' + k + '_a'), { type: 'bar', data: { labels, datasets: ds },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 10 }, boxWidth: 10 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtH(c.raw)}` } } }, scales: { x: { ...ax.x, stacked: true }, y: { ...ax.y, stacked: true } } } });
  } else {
    CH['pvCh_' + k + '_a'] = new Chart(document.getElementById('pvCh_' + k + '_a'), { type: 'bar',
      data: { labels, datasets: [{ label: 'Tổng OT', data: per.map(p => (p.has ? p.total : null)), backgroundColor: '#2D6CDF', borderWidth: 0, borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtH(c.raw)}` } } }, scales: ax } });
  }
  CH['pvCh_' + k + '_b'] = new Chart(document.getElementById('pvCh_' + k + '_b'), { type: 'bar',
    data: { labels, datasets: [
      { label: 'Cảnh báo 60–70h', data: per.map(p => (p.has ? p.warn : null)), backgroundColor: '#E8A33D', borderWidth: 0, borderRadius: 2 },
      { label: 'Vượt 70h', data: per.map(p => (p.has ? p.over : null)), backgroundColor: '#C0392B', borderWidth: 0, borderRadius: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: ax.x, y: { ...ax.y, ticks: { font: { size: 10 }, stepSize: 1 } } } } });
}
