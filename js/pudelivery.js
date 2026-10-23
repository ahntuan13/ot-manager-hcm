// ============================================================
//  PU DELIVERY — theo dõi giao hàng thiết bị (Equipment Order Record), chia theo DỰ ÁN (lấy từ Action Plan).
//  Mỗi dòng 1 doc Firestore "pu_<id>". Mẫu theo file Excel "HCM - Equipment Order Record".
//  Item:  { id, proj, src, pm, disc, job, no, supplier, name, quote, origin, qty, unit, code, pr, prDate, po,
//           ordPlan, ordActual, eff, adv, desired, e0, e1, e2, e3, reason, actual, remarks, ct, at }
//  (e0 = As contract, e1..e3 = 1st..3rd change; ngày lưu ISO yyyy-mm-dd)
//  Doc meta ánh xạ tên dự án trong Excel → dự án Action Plan:  { meta:'map', id, src, proj }
//  Trạng thái được TỰ TÍNH từ các ngày (giống macro trong file Excel gốc) — không nhập tay.
// ============================================================
const PU_KEY = 'ot_manager_pu_v2';
let PU_DB = {};
let puEditId = null, puEditProj = '';

function loadPuDb() { try { const r = localStorage.getItem(PU_KEY) || localStorage.getItem('ot_manager_pu_v1'); if (r) PU_DB = JSON.parse(r) || {}; } catch (e) {} }
function savePuDb() { try { localStorage.setItem(PU_KEY, JSON.stringify(PU_DB)); } catch (e) {} if (typeof cloudTouch === 'function') cloudTouch(); }
loadPuDb();

const puEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const puClean = v => String(v == null ? '' : v).replace(/[ \t]/g, ' ').replace(/\s+/g, ' ').trim();
function puFmt(iso) { if (!iso) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; }
const puFmtS = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}` : ''; };
// Nhận dd/mm/yyyy, yyyy-mm-dd, số serial Excel → ISO ('' nếu không hợp lệ / năm vô lý)
function puParseDate(v) {
  if (v === null || v === undefined || v === '') return '';
  let iso = '';
  if (v instanceof Date) iso = v.toISOString().slice(0, 10);
  else if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); iso = isNaN(d) ? '' : d.toISOString().slice(0, 10); }
  else {
    const s = String(v).trim(); let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    else if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s))) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const y = parseInt(iso.slice(0, 4), 10);
  return (y >= 2000 && y <= 2100) ? iso : '';
}
const puDaysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const puToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const puItems = () => Object.values(PU_DB).filter(x => x && !x.meta && x.name !== undefined).sort((a, b) => (a.ct || 0) - (b.ct || 0));
const puEst = x => x.e3 || x.e2 || x.e1 || x.e0 || '';

// ── Trạng thái tự tính (đối chiếu 100/100 dòng của file Excel gốc ngày 21/10) ──
const PU_STATUS_COLOR = { done: '#2D6CDF', make: '#6b7280', soon30: '#2E7D32', soon7: '#E8A33D', late: '#C0392B', miss: '#7A5FD1', wait: '#8a8f98' };
function puStatus(x, today) {
  today = today || puToday();
  if (x.actual) return { k: 'done', t: 'Đã giao' };
  let est = puEst(x);
  if (!est) {
    if (x.ordPlan) return { k: 'wait', t: 'Chờ NCC báo ngày giao' };
    if (puClean(x.supplier) && x.desired && x.desired >= today) est = x.desired;
    else return { k: 'miss', t: 'Thiếu kế hoạch đặt hàng' };
  }
  const d = puDaysBetween(today, est);
  const base = d <= 7 ? { k: 'soon7', t: 'sắp giao (7 ngày)' } : d <= 30 ? { k: 'soon30', t: 'sắp giao (30 ngày)' } : { k: 'make', t: 'đang sản xuất' };
  // Trễ tiến độ: ngày giao mới muộn hơn ngày "As contract" và lý do KHÔNG phải do yêu cầu của PM
  const late = !!(x.e0 && est > x.e0 && !/\bpm/i.test(x.reason || ''));
  if (late) return { k: 'late', t: 'Trễ tiến độ và ' + base.t };
  return { k: base.k, t: base.t.charAt(0).toUpperCase() + base.t.slice(1) };
}

// ── Dự án lấy từ Action Plan ──
function puApProjects() {
  return Object.keys(PROJECTS_DB || {}).flatMap(g => Object.keys(PROJECTS_DB[g] || {}).filter(p => !p.startsWith('__') && p !== UNASSIGNED_PROJ).map(p => ({ g, p })));
}
// Dự án = Action Plan + dự án thêm riêng trong PU Delivery
const puMeta = name => PU_DB['proj~' + name];
function puProjects() {
  const ap = puApProjects(), names = new Set(ap.map(x => x.p));
  const custom = Object.values(PU_DB).filter(x => x && x.meta === 'proj' && x.custom && !names.has(x.name)).map(x => ({ g: '', p: x.name, custom: true }));
  return [...ap, ...custom.sort((a, b) => a.p.localeCompare(b.p))];
}
function puApPm(proj) {
  for (const g of Object.keys(PROJECTS_DB || {})) {
    const pr = PROJECTS_DB[g] && PROJECTS_DB[g][proj]; if (!pr) continue;
    const ks = Object.keys(pr.plans || {}).sort().reverse();
    for (const k of ks) if (pr.plans[k] && pr.plans[k].pm) return pr.plans[k].pm;
  }
  return '';
}
// "RED DRAGON (E) - MR DAN" → { name:'RED DRAGON', disc:'E', pm:'DAN' }
function puSplitProject(line) {
  let s = puClean(String(line).replace(/^project name\s*:/i, ''));
  let pm = ''; const m = /(?:\s*[-\/]\s*|\s+)(?:mr|mrs|ms)\.?\s*(.*)$/i.exec(s);
  if (m) { pm = puClean(m[1]); s = puClean(s.slice(0, m.index)); }
  let disc = ''; const d = /\(\s*([EM])\s*\)|[-\s]([EM])$/i.exec(s);
  if (d) { disc = (d[1] || d[2]).toUpperCase(); s = puClean(s.replace(d[0], ' ')); }
  return { name: s.replace(/[-\/\s]+$/, ''), disc, pm };
}
const puNorm = s => String(s || '').toUpperCase().replace(/^HCM[\s_-]*/, '').replace(/[^A-Z0-9]/g, '');
function puAutoMatch(name) {
  const n = puNorm(name); if (!n) return '';
  let best = '', score = 0;
  puProjects().forEach(({ p }) => {
    const k = puNorm(p); if (!k) return;
    let sc = 0;
    if (k === n) sc = 100; else if (k.includes(n) || n.includes(k)) sc = 50 + Math.min(k.length, n.length);
    if (sc > score) { score = sc; best = p; }
  });
  return best;
}
function puMapFor(src) { const m = PU_DB['map~' + src]; return (m && m.proj && puProjects().some(x => x.p === m.proj)) ? m.proj : ''; }
// Dự án hiệu lực của 1 dòng: ưu tiên proj gán tay; nếu không → ánh xạ theo tên Excel
function puProjOf(x) {
  if (x.proj && puProjects().some(p => p.p === x.proj)) return x.proj;
  return x.src ? (puMapFor(x.src) || puAutoMatch(x.src)) : '';
}

// ── Chuyển dữ liệu mẫu cũ (v2026.72) sang cấu trúc mới ──
function puMigrate() {
  let ch = false;
  Object.values(PU_DB).forEach(x => {
    if (!x || x.meta || x.name !== undefined || x.desc === undefined) return;
    x.name = x.desc; x.supplier = x.supplier || ''; x.pm = x.pic || ''; x.desired = x.reqDate || ''; x.e0 = x.etaDate || x.finalDate || '';
    x.remarks = x.notes || ''; ch = true;
  });
  if (ch) savePuDb();
}

// ── Vẽ trang ──
let puOpen = {};
function puCtl() {
  return { proj: document.getElementById('puProjFilter')?.value || '__all__', st: document.getElementById('puStatusFilter')?.value || 'all',
    q: (document.getElementById('puSearch')?.value || '').toLowerCase().trim(), hideEmpty: document.getElementById('puHideEmpty')?.checked !== false };
}
const PU_ST_LIST = [['done', 'Đã giao'], ['late', 'Trễ tiến độ'], ['soon7', 'Sắp giao (7 ngày)'], ['soon30', 'Sắp giao (30 ngày)'], ['make', 'Đang sản xuất'], ['wait', 'Chờ NCC báo ngày giao'], ['miss', 'Thiếu kế hoạch đặt hàng']];
function puBadge(s) { return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;color:#fff;background:${PU_STATUS_COLOR[s.k]}">${puEsc(s.t)}</span>`; }

function puRow(x, no) {
  const s = puStatus(x), canDel = typeof isManager === 'function' && isManager();
  const T = v => `<td style="white-space:nowrap">${puEsc(v)}</td>`, D = v => `<td style="white-space:nowrap;text-align:center">${puFmt(v)}</td>`;
  return `<tr>
    <td style="white-space:nowrap;text-align:center"><button class="btn" style="padding:3px 8px" title="Sửa" onclick="openPuModal('${x.id}')">✎</button>${canDel ? ` <button class="btn" style="padding:3px 8px" title="Xoá" onclick="deletePu('${x.id}')">🗑</button>` : ''}</td>
    <td style="text-align:center;color:var(--text2)">${puEsc(no)}</td>${T(x.supplier)}<td title="${puEsc(s.t)}" style="white-space:nowrap"><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff;background:${PU_STATUS_COLOR[s.k]}">${puEsc(x.name)}</span></td>${T(x.quote)}${T(x.origin)}${T(x.qty)}${T(x.unit)}${T(x.code)}
    ${T(x.pr)}${D(x.prDate)}${T(x.po)}${D(x.ordPlan)}${D(x.ordActual)}${D(x.eff)}${D(x.adv)}${D(x.desired)}
    ${D(x.e0)}${D(x.e1)}${D(x.e2)}${D(x.e3)}<td style="min-width:150px;white-space:nowrap">${puEsc(x.reason)}</td>${D(x.actual)}
    <td style="min-width:260px;white-space:normal;font-size:11.5px;color:var(--text2)">${puEsc(x.remarks)}</td></tr>`;
}
const PU_HEAD = `<thead>
  <tr><th rowspan="2" class="pu-act"></th><th rowspan="2">No.</th><th rowspan="2">Supplier Name</th><th rowspan="2">Name of Items</th><th rowspan="2">Quotation No.</th><th rowspan="2">Origin Country</th><th rowspan="2">Q'ty</th><th rowspan="2">Unit</th><th rowspan="2">Code No.</th>
  <th colspan="2">PR</th><th rowspan="2">PO/CO No.</th><th colspan="2">Order Date</th><th rowspan="2" class="pu-d">PO/Contract Effective Date</th><th rowspan="2" class="pu-d">Advance Payment Date</th><th rowspan="2" class="pu-d">Desired date to be on site (SITE CONFIRM)</th>
  <th colspan="4">Estimate date on Site (SUPPLIER CONFIRM)</th><th rowspan="2">Reason for The Schedule Change</th><th rowspan="2" class="pu-d">Actual date on Site</th><th rowspan="2">Remarks</th></tr>
  <tr><th>No.</th><th class="pu-d">Approved Date</th><th class="pu-d">Plan</th><th class="pu-d">Actual</th><th class="pu-d">As contract</th><th class="pu-d">1st Change</th><th class="pu-d">2nd Change</th><th class="pu-d">3rd Change</th></tr></thead>`;
const puTable = rows => `<div class="pu-scroll"><table class="pu-tbl">${PU_HEAD}<tbody>${rows}</tbody></table></div>`;

function renderPuDelivery() {
  const host = document.getElementById('puSections'); if (!host) return;
  puMigrate();
  const c = puCtl(), today = puToday();
  const pSel = document.getElementById('puProjFilter');
  const projs = puProjects();
  if (pSel) { const prev = pSel.value; pSel.innerHTML = '<option value="__all__">Tất cả dự án</option>' + projs.map(x => `<option value="${puEsc(x.p)}">${puEsc(x.p)}</option>`).join(''); if ([...pSel.options].some(o => o.value === prev)) pSel.value = prev; }
  const stSel = document.getElementById('puStatusFilter');
  if (stSel && stSel.options.length <= 1) stSel.innerHTML = '<option value="all">Tất cả trạng thái</option>' + PU_ST_LIST.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('');
  if (stSel) stSel.value = c.st;
  const all = puItems().map(x => ({ x, proj: puProjOf(x), s: puStatus(x, today) }));
  const cnt = k => all.filter(a => a.s.k === k).length;
  const kpi = document.getElementById('puKpi');
  if (kpi) kpi.innerHTML = `<div class="mk"><b>${all.length}</b><span>Tổng hàng hóa</span></div>` +
    [['late', 'Trễ tiến độ'], ['soon7', 'Sắp giao (7 ngày)'], ['soon30', 'Sắp giao (30 ngày)'], ['miss', 'Thiếu KH đặt hàng'], ['done', 'Đã giao']].map(([k, l]) => `<div class="mk"><b style="color:${PU_STATUS_COLOR[k]}">${cnt(k)}</b><span>${l}</span></div>`).join('');
  renderPuChart(all);
  const match = a => (c.st === 'all' || a.s.k === c.st) && (!c.q || [a.x.name, a.x.supplier, a.x.po, a.x.pm, a.x.remarks, a.x.reason].some(v => String(v || '').toLowerCase().includes(c.q)));
  let html = '';
  // Dòng chưa gán được dự án Action Plan → gom theo tên dự án trong Excel, cho phép gán hàng loạt
  const orphans = all.filter(a => !a.proj && match(a));
  if (orphans.length && c.proj === '__all__') {
    const bySrc = {}; orphans.forEach(a => (bySrc[a.x.src || '(không rõ dự án)'] = bySrc[a.x.src || '(không rõ dự án)'] || []).push(a));
    html += `<div class="card" style="border-left:4px solid #E8A33D"><div class="card-title" style="margin-bottom:6px">⚠️ Chưa gán dự án Action Plan <span style="font-weight:400;font-size:11.5px;color:var(--text2)">— ${orphans.length} hàng. Chọn dự án tương ứng cho từng nhóm (lưu lại cho lần nhập sau).</span></div>` +
      Object.keys(bySrc).map(src => `<div style="margin:10px 0 4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${puEsc(src)}</b> <span style="color:var(--text2);font-size:11.5px">(${bySrc[src].length} hàng)</span>
        <select onchange="puAssignSrc('${encodeURIComponent(src)}', this.value)" style="padding:4px 8px"><option value="">Gán vào dự án…</option>${projs.map(x => `<option value="${puEsc(x.p)}">${puEsc(x.p)}</option>`).join('')}</select></div>
        ${puTable(bySrc[src].map((a, i) => puRow(a.x, a.x.no || i + 1)).join(''))}`).join('') + '</div>';
  }
  projs.filter(x => c.proj === '__all__' || x.p === c.proj).forEach(({ p }) => {
    const rows = all.filter(a => a.proj === p), shown = rows.filter(match);
    if (!rows.length && c.hideEmpty && c.proj === '__all__') return;
    if (rows.length && !shown.length && (c.st !== 'all' || c.q)) return;
    const pms = [...new Set(rows.map(a => a.x.pm ? (a.x.pm + (a.x.disc ? ` (${a.x.disc})` : '')) : '').filter(Boolean))];
    const apPm = puApPm(p), mt = puMeta(p);
    const jobs = [...new Set(rows.flatMap(a => String(a.x.job || '').split(',').map(puClean).filter(Boolean)))];
    const chips = PU_ST_LIST.map(([k, l]) => { const n = rows.filter(a => a.s.k === k).length; return n ? `<span style="font-size:11px;color:#fff;background:${PU_STATUS_COLOR[k]};padding:1px 8px;border-radius:999px" title="${l}">${n} ${l}</span>` : ''; }).join(' ');
    const open = puOpen[p] !== undefined ? puOpen[p] : (rows.length > 0 && (c.q || c.st !== 'all' || rows.some(a => ['late', 'soon7', 'miss'].includes(a.s.k))));
    puLast[p] = !!open;
    html += `<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;cursor:pointer" onclick="puToggle('${encodeURIComponent(p)}')">
      <span style="font-size:15px">${open ? '▾' : '▸'}</span>
      <div style="font-size:15px;font-weight:800">${puEsc(p)}</div>
      <div style="font-size:12.5px;color:var(--text2)">👤 PM: <b>${puEsc((mt && mt.pm) ? mt.pm : (pms.length ? pms.join(', ') : (apPm || '—')))}</b>${jobs.length ? ` · Job: ${puEsc(jobs.join(', '))}` : ''}</div>
      <div style="font-size:12px;color:var(--text2)">${rows.length} hàng hóa</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">${chips}</div>
      <span style="margin-left:auto;display:flex;gap:6px"><button class="btn" style="padding:3px 10px" title="Sửa tên PM / dự án" onclick="event.stopPropagation();openPuProj('${encodeURIComponent(p)}')">✎ Dự án</button><button class="btn" style="padding:3px 10px" onclick="event.stopPropagation();openPuModal(null,'${encodeURIComponent(p)}')">＋ Thêm hàng</button></span></div>
      ${open ? (shown.length ? `<div style="margin-top:10px">${puTable(shown.map((a, i) => puRow(a.x, a.x.no || i + 1)).join(''))}</div>` : '<div style="padding:10px;color:var(--text2);font-size:12px">Chưa có hàng hóa.</div>') : ''}</div>`;
  });
  host.innerHTML = html || '<div class="card" style="text-align:center;color:var(--text2)">Chưa có dữ liệu. Bấm "Nhập Excel" để nạp file Equipment Order Record, hoặc "＋ Thêm hàng" trong từng dự án.</div>';
}

// ── Thêm / sửa dự án (tên PM; dự án riêng của PU Delivery cho phép đổi tên / xoá) ──
let puProjEdit = null;
function openPuProj(encName) {
  const name = encName ? decodeURIComponent(encName) : '';
  const mt = name ? puMeta(name) : null, isAp = !!name && puApProjects().some(x => x.p === name);
  puProjEdit = { name, isAp, isNew: !name };
  document.getElementById('puPName').value = name; document.getElementById('puPName').disabled = isAp;
  document.getElementById('puPPm').value = (mt && mt.pm) || (name ? puApPm(name) : '') || '';
  document.getElementById('puPTitle').textContent = !name ? 'Thêm dự án' : 'Sửa dự án';
  document.getElementById('puPNote').textContent = isAp ? 'Tên dự án lấy từ Action Plan nên không đổi ở đây; chỉ gán/sửa tên PM.' : (name ? 'Dự án riêng của PU Delivery (không có trong Action Plan).' : 'Dự án mới chỉ có trong PU Delivery. Dự án của Action Plan đã có sẵn, không cần thêm lại.');
  const canDel = !!name && !isAp && typeof isManager === 'function' && isManager();
  document.getElementById('puPDel').style.display = canDel ? '' : 'none';
  document.getElementById('puProjModal').style.display = 'flex';
}
function closePuProj() { document.getElementById('puProjModal').style.display = 'none'; puProjEdit = null; }
function savePuProj() {
  if (!puProjEdit) return;
  const name = document.getElementById('puPName').value.trim(), pm = document.getElementById('puPPm').value.trim();
  if (!name) { toast('⚠️ Nhập tên dự án.'); return; }
  const old = puProjEdit.name, now = Date.now();
  if (puProjEdit.isNew && puProjects().some(x => x.p.toLowerCase() === name.toLowerCase())) { toast('⚠️ Dự án này đã có.'); return; }
  if (old && !puProjEdit.isAp && old !== name) {
    if (puProjects().some(x => x.p.toLowerCase() === name.toLowerCase())) { toast('⚠️ Tên này đã có dự án khác.'); return; }
    delete PU_DB['proj~' + old];
    Object.values(PU_DB).forEach(x => { if (x && !x.meta && x.proj === old) { x.proj = name; x.at = now; } if (x && x.meta === 'map' && x.proj === old) { x.proj = name; x.at = now; } });
  }
  PU_DB['proj~' + name] = { meta: 'proj', id: 'proj~' + name, name, pm, custom: !puProjEdit.isAp, at: now };
  savePuDb(); closePuProj(); renderPuDelivery(); toast('💾 Đã lưu dự án.');
}
function deletePuProj() {
  if (!puProjEdit || puProjEdit.isAp) return;
  if (typeof requireManager === 'function' && !requireManager('xoá dự án PU Delivery')) return;
  const n = puItems().filter(x => x.proj === puProjEdit.name).length;
  if (!confirm(`Xoá dự án "${puProjEdit.name}"?${n ? `\n${n} hàng hóa trong dự án sẽ chuyển về mục "Chưa gán dự án".` : ''}`)) return;
  delete PU_DB['proj~' + puProjEdit.name];
  Object.values(PU_DB).forEach(x => { if (x && !x.meta && x.proj === puProjEdit.name) { x.proj = ''; x.at = Date.now(); } });
  savePuDb(); closePuProj(); renderPuDelivery();
}

// ── Biểu đồ tiến độ giao hàng theo dự án (cột chồng theo trạng thái) ──
function renderPuChart(all) {
  const card = document.getElementById('puChartCard'), box = document.getElementById('puChartBox'), cv = document.getElementById('cPuProg');
  if (!card || !cv || typeof Chart === 'undefined') return;
  if (typeof killChart === 'function') killChart('cPuProg');
  const groups = {}; all.forEach(a => { const k = a.proj || 'Chưa gán dự án'; (groups[k] = groups[k] || []).push(a); });
  const names = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  card.style.display = names.length ? '' : 'none'; if (!names.length) return;
  box.style.height = Math.max(240, names.length * 34 + 90) + 'px';
  const order = ['done', 'make', 'soon30', 'soon7', 'late', 'wait', 'miss'], label = Object.fromEntries(PU_ST_LIST);
  const ds = order.map(k => ({ label: label[k], data: names.map(n => groups[n].filter(a => a.s.k === k).length), backgroundColor: PU_STATUS_COLOR[k], borderWidth: 0, borderDash: [], maxBarThickness: 24 }));
  CH['cPuProg'] = new Chart(cv, { type: 'bar', data: { labels: names.map(n => n.replace(/^HCM[\s-]+/i, '') + ` (${groups[n].length})`), datasets: ds },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { mode: 'index', intersect: false } },
      scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(128,128,128,.12)' }, title: { display: true, text: 'Số hàng hóa', font: { size: 11 } } }, y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } } } },
    plugins: [{ id: 'puVal', afterDatasetsDraw(c) { const g = c.ctx; g.save(); g.fillStyle = '#fff'; g.font = '600 10.5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      c.data.datasets.forEach((d, i) => c.getDatasetMeta(i).data.forEach((el, j) => { const v = d.data[j]; if (v > 0 && el.width > 14) g.fillText(v, el.x - el.width / 2, el.y); })); g.restore(); } }] });
}

const puLast = {};
function puToggle(encP) { const p = decodeURIComponent(encP); puOpen[p] = !puLast[p]; renderPuDelivery(); }
function puAssignSrc(encSrc, proj) {
  if (!proj) return; const src = decodeURIComponent(encSrc);
  PU_DB['map~' + src] = { meta: 'map', id: 'map~' + src, src, proj, at: Date.now() };
  savePuDb(); renderPuDelivery(); toast(`Đã gán "${src}" → ${proj}`);
}

// ── Thêm / sửa ──
const PU_FIELDS = { puFSup: 'supplier', puFName: 'name', puFQuote: 'quote', puFOrigin: 'origin', puFQty: 'qty', puFUnit: 'unit', puFCode: 'code', puFPr: 'pr', puFPo: 'po', puFPm: 'pm', puFJob: 'job', puFReason: 'reason', puFRemarks: 'remarks' };
const PU_DATES = { puFPrDate: 'prDate', puFOrdPlan: 'ordPlan', puFOrdAct: 'ordActual', puFEff: 'eff', puFAdv: 'adv', puFDesired: 'desired', puFE0: 'e0', puFE1: 'e1', puFE2: 'e2', puFE3: 'e3', puFActual: 'actual' };
function openPuModal(id, encProj) {
  puEditId = id || null;
  const x = id ? PU_DB[id] : {}; if (id && !x) return;
  puEditProj = id ? (puProjOf(x) || x.proj || '') : (encProj ? decodeURIComponent(encProj) : '');
  Object.entries(PU_FIELDS).forEach(([el, f]) => { document.getElementById(el).value = x[f] || ''; });
  Object.entries(PU_DATES).forEach(([el, f]) => { document.getElementById(el).value = x[f] || ''; });
  const sel = document.getElementById('puFProj');
  sel.innerHTML = '<option value="">— Chưa gán —</option>' + puProjects().map(p => `<option value="${puEsc(p.p)}">${puEsc(p.p)}</option>`).join('');
  sel.value = puEditProj;
  if (!id && puEditProj && !document.getElementById('puFPm').value) document.getElementById('puFPm').value = puApPm(puEditProj);
  document.getElementById('puModalTitle').textContent = id ? 'Sửa hàng hóa' : 'Thêm hàng hóa';
  document.getElementById('puModal').style.display = 'flex';
}
function closePuModal() { document.getElementById('puModal').style.display = 'none'; puEditId = null; }
function savePuModal() {
  const v = i => (document.getElementById(i)?.value || '').trim();
  if (!v('puFName')) { toast('⚠️ Nhập tên hàng hóa (Name of Items).'); return; }
  const now = Date.now(), id = puEditId || ('p' + now.toString(36) + Math.random().toString(36).slice(2, 5)), old = PU_DB[id] || {};
  const o = { ...old, id, proj: v('puFProj'), ct: old.ct || now, at: now };
  Object.entries(PU_FIELDS).forEach(([el, f]) => { o[f] = v(el); });
  Object.entries(PU_DATES).forEach(([el, f]) => { o[f] = v(el); });
  PU_DB[id] = o; savePuDb(); closePuModal(); renderPuDelivery(); toast('💾 Đã lưu.');
}
function deletePu(id) {
  if (typeof requireManager === 'function' && !requireManager('xoá hàng hóa')) return;
  if (!confirm('Xoá hàng hóa này?')) return;
  delete PU_DB[id]; savePuDb(); renderPuDelivery();
}

// ── Nhập Excel theo mẫu "Equipment Order Record" ──
async function importPuExcel(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  if (typeof requireManager === 'function' && !requireManager('nhập PU Delivery từ Excel')) { inp.value = ''; return; }
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const head = rows.slice(0, 6).find(r => r && /supplier/i.test(String(r[1] || '')));
    if (!head) { toast('⚠️ Không đúng mẫu: không thấy cột "Supplier Name".'); inp.value = ''; return; }
    const list = []; let cur = null, jobs = [];
    const base = Date.now();
    rows.forEach(r => {
      if (!r) return; const a = r[0];
      if (typeof a === 'string' && /^\s*project name/i.test(a)) { cur = puSplitProject(a); cur.src = cur.name + (cur.disc ? ` (${cur.disc})` : ''); jobs = []; return; }
      if (typeof a === 'string' && /^\s*job no/i.test(a)) { jobs.push(puClean(a.replace(/^\s*job no\.?\s*:?/i, ''))); return; }
      if (!cur || (typeof a !== 'number' && !(a === null && (puClean(r[1]) || puClean(r[2]))))) return;
      const name = puClean(r[2]); if (!name && !puClean(r[1])) return;
      list.push({ src: cur.name, pm: cur.pm, disc: cur.disc, job: jobs.join(', '), no: typeof a === 'number' ? a : '', supplier: puClean(r[1]), name, quote: puClean(r[3]), origin: puClean(r[4]), qty: puClean(r[5]), unit: puClean(r[6]),
        code: puClean(r[7]), pr: puClean(r[8]), prDate: puParseDate(r[9]), po: puClean(r[10]), ordPlan: puParseDate(r[11]), ordActual: puParseDate(r[12]), eff: puParseDate(r[13]), adv: puParseDate(r[14]),
        desired: puParseDate(r[15]), e0: puParseDate(r[16]), e1: puParseDate(r[17]), e2: puParseDate(r[18]), e3: puParseDate(r[19]), reason: puClean(r[20]), actual: puParseDate(r[21]), remarks: String(r[23] || '').trim() });
    });
    if (!list.length) { toast('⚠️ Không đọc được hàng hóa nào.'); inp.value = ''; return; }
    const old = puItems().filter(x => x.src);
    if (!confirm(`Nhập ${list.length} hàng hóa từ file "${f.name}".\nDanh sách cũ nhập từ Excel (${old.length} hàng) sẽ được THAY THẾ bằng file này. Hàng thêm tay giữ nguyên. Tiếp tục?`)) { inp.value = ''; return; }
    old.forEach(x => delete PU_DB[x.id]);
    list.forEach((x, i) => { const id = 'p' + (base + i).toString(36) + Math.random().toString(36).slice(2, 5); PU_DB[id] = { ...x, id, proj: '', ct: base + i, at: base + i }; });
    savePuDb(); renderPuDelivery();
    const unm = [...new Set(puItems().filter(x => x.src && !puProjOf(x)).map(x => x.src))];
    toast(`✅ Đã nhập ${list.length} hàng hóa.${unm.length ? ` ${unm.length} nhóm chưa khớp dự án Action Plan — hãy gán ở mục cảnh báo vàng.` : ''}`);
  } catch (e) { console.error(e); toast('⚠️ Không đọc được file: ' + e.message); }
  inp.value = '';
}

// ── Xuất Excel theo đúng mẫu (nhóm theo dự án) ──
function exportPuExcel() {
  const aoa = [['DELIVERY SCHEDULE OF EQUIPMENTS'], [], ['No.', 'Supplier Name', 'Name of Items', 'Quotation No.', 'Origin Country', "Q'ty", 'Unit', 'Code No.', 'PR No.', 'PR Approved Date', 'PO/CO No.', 'Order Date (Plan)', 'Order Date (Actual)', 'PO/Contract Effective Date', 'Advance Payment Date', 'Desired date to be on site', 'Estimate date (As contract)', '1st Change', '2nd Change', '3rd Change', 'Reason for The Schedule Change', 'Actual date on Site', 'Status', 'Remarks']];
  const all = puItems().map(x => ({ x, proj: puProjOf(x) || '(Chưa gán dự án)' }));
  const groups = {}; all.forEach(a => (groups[a.proj] = groups[a.proj] || []).push(a.x));
  Object.keys(groups).forEach(p => {
    const pms = [...new Set(groups[p].map(x => x.pm ? x.pm + (x.disc ? ` (${x.disc})` : '') : '').filter(Boolean))];
    const mp = puMeta(p) && puMeta(p).pm; aoa.push([`Project Name: ${p}${mp ? ' - ' + mp : pms.length ? ' - ' + pms.join(' / ') : puApPm(p) ? ' - ' + puApPm(p) : ''}`]);
    groups[p].forEach((x, i) => aoa.push([x.no || i + 1, x.supplier, x.name, x.quote, x.origin, x.qty, x.unit, x.code, x.pr, puFmt(x.prDate), x.po, puFmt(x.ordPlan), puFmt(x.ordActual), puFmt(x.eff), puFmt(x.adv), puFmt(x.desired), puFmt(x.e0), puFmt(x.e1), puFmt(x.e2), puFmt(x.e3), x.reason, puFmt(x.actual), puStatus(x).t, x.remarks]));
  });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Weekly Report');
  XLSX.writeFile(wb, `PU_Delivery_${puToday()}.xlsx`);
}
