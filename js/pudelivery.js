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
  // Trễ tiến độ: đã QUÁ ngày dự kiến giao (hôm nay > ngày dự kiến) mà chưa giao.
  if (d < 0) return { k: 'late', t: 'Trễ tiến độ' };
  // Sắp giao: còn ≤ 2 ngày nữa là tới ngày giao (hôm nay, +1, +2).
  if (d <= 2) return { k: 'soon7', t: 'Sắp giao (còn ' + d + ' ngày)' };
  return { k: 'make', t: 'Đang đặt hàng' };
}

// "Còn lại" đúng theo từng trạng thái: đã giao → so NGÀY GIAO THỰC TẾ với ngày dự kiến (sớm/đúng hẹn/trễ); chưa giao → so HÔM NAY với ngày dự kiến
function puRemain(x, today) {
  today = today || puToday(); const est = puEst(x);
  if (x.actual) {
    const ref = est || x.desired; if (!ref) return { t: '', c: 'inherit' };
    const d = puDaysBetween(x.actual, ref);
    return d > 0 ? { t: 'sớm ' + d + ' ngày', c: '#2E7D32' } : d === 0 ? { t: 'đúng hẹn', c: '#2E7D32' } : { t: 'trễ ' + (-d) + ' ngày', c: '#C0392B' };
  }
  if (!est) return { t: '', c: 'inherit' };
  const d = puDaysBetween(today, est);
  return d < 0 ? { t: 'trễ ' + (-d) + ' ngày', c: '#C0392B' } : d === 0 ? { t: 'giao hôm nay', c: '#E8A33D' } : { t: 'còn ' + d + ' ngày', c: d <= 2 ? '#E8A33D' : 'inherit' };
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
    q: (document.getElementById('puSearch')?.value || '').toLowerCase().trim(), hideEmpty: document.getElementById('puHideEmpty')?.checked !== false, showDone: !!document.getElementById('puShowDone')?.checked };
}
const PU_ST_LIST = [['done', 'Đã giao'], ['late', 'Trễ tiến độ'], ['soon7', 'Sắp giao (≤ 2 ngày)'], ['make', 'Đang đặt hàng'], ['wait', 'Chờ NCC báo ngày giao'], ['miss', 'Thiếu kế hoạch đặt hàng']];
function puBadge(s) { return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;color:#fff;background:${PU_STATUS_COLOR[s.k]}">${puEsc(s.t)}</span>`; }

function puRow(x, no) {
  const s = puStatus(x), canDel = typeof isManager === 'function' && isManager();
  const T = v => `<td style="white-space:nowrap">${puEsc(v)}</td>`, D = v => `<td style="white-space:nowrap;text-align:center">${puFmt(v)}</td>`;
  return `<tr>
    <td style="white-space:nowrap;text-align:center"><button class="btn" style="padding:3px 8px" title="Sửa" onclick="openPuModal('${x.id}')">✎</button>${canDel ? ` <button class="btn" style="padding:3px 8px" title="Xoá" onclick="deletePu('${x.id}')">🗑</button>` : ''}</td>
    ${T(x.supplier)}<td title="${puEsc(s.t)}" style="white-space:nowrap"><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff;background:${PU_STATUS_COLOR[s.k]}">${puEsc(x.name)}</span></td>${T(x.quote)}${T(x.origin)}<td class="pu-q" style="white-space:nowrap">${puEsc(x.qty)}</td>${T(x.unit)}${T(x.code)}
    ${T(x.pr)}${D(x.prDate)}${T(x.po)}${D(x.ordPlan)}${D(x.ordActual)}${D(x.eff)}${D(x.adv)}${D(x.desired)}
    ${D(x.e0)}${D(x.e1)}${D(x.e2)}${D(x.e3)}<td style="min-width:150px;white-space:nowrap">${puEsc(x.reason)}</td>${D(x.actual)}
    <td style="min-width:260px;white-space:normal;font-size:11.5px;color:var(--text2)">${puEsc(x.remarks)}</td></tr>`;
}
const PU_HEAD = `<thead>
  <tr><th rowspan="2" class="pu-act"></th><th rowspan="2">Supplier Name</th><th rowspan="2">Name of Items</th><th rowspan="2">Quotation No.</th><th rowspan="2">Origin Country</th><th rowspan="2" class="pu-q">Q'ty</th><th rowspan="2">Unit</th><th rowspan="2">Code No.</th>
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
  if (kpi) kpi.innerHTML = `<div class="mk pu-tile" onclick="openPuDetail('all')" title="Bấm để xem chi tiết"><b>${all.length}</b><span>Tổng hàng hóa</span></div>` +
    [['late', 'Trễ tiến độ'], ['soon7', 'Sắp giao (≤ 2 ngày)'], ['miss', 'Thiếu KH đặt hàng'], ['done', 'Đã giao']].map(([k, l]) => `<div class="mk pu-tile" onclick="openPuDetail('${k}')" title="Bấm để xem chi tiết"><b style="color:${PU_STATUS_COLOR[k]}">${cnt(k)}</b><span>${l}</span></div>`).join('');
  renderPuChart(all);
  const match = a => (c.showDone || c.st === 'done' || a.s.k !== 'done') && (c.st === 'all' || a.s.k === c.st) && (!c.q || [a.x.name, a.x.supplier, a.x.po, a.x.pm, a.x.remarks, a.x.reason].some(v => String(v || '').toLowerCase().includes(c.q)));
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
  const order = ['done', 'make', 'soon7', 'late', 'wait', 'miss'], label = Object.fromEntries(PU_ST_LIST);
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
  Object.keys(PU_DATES).concat(['puFSup','puFReason']).forEach(el => { const e = document.getElementById(el); if (e) e.oninput = e.onchange = puModalStatus; });
  puModalStatus();
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

// ── Xuất Excel đúng mẫu file Equipment Order Record (nhập lại được bằng chính nút "Nhập Excel") ──
function exportPuExcel() {
  const serial = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569 : null; };
  const N = 24, blank = () => Array(N).fill(null);
  const aoa = [], merges = [], dateCells = [];
  const r0 = blank(); r0[0] = 'DELIVERY SCHEDULE OF EQUIPMENTS'; aoa.push(r0); aoa.push(blank());
  const h1 = blank(), h2 = blank();
  ['No.', 'Supplier Name', 'Name of Items', 'Quotation\nNo.', 'Origin\nCountry', "Q'ty", 'Unit', 'Code\nNo.'].forEach((t, i) => h1[i] = t);
  h1[8] = 'PR'; h2[8] = 'No.'; h2[9] = 'Approved Date'; h1[10] = 'PO/CO No.'; h1[11] = 'Order Date'; h2[11] = 'Plan'; h2[12] = 'Actual';
  h1[13] = 'PO/Contract Effective\nDate'; h1[14] = 'Advance Payment Date'; h1[15] = 'Desired date to\nbe on site\n(SITE COFIRM)';
  h1[16] = 'Estimate date on Site (SUPPLIER CONFIRM)'; h2[16] = 'As contract'; h2[17] = '1st\nChange'; h2[18] = '2nd\nChange'; h2[19] = '3rd\nChange';
  h1[20] = 'Reason for The\nSchedule Change'; h1[21] = 'Actual date on Site'; h1[22] = 'Status'; h1[23] = 'Remarks';
  aoa.push(h1, h2);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } });
  [0, 1, 2, 3, 4, 5, 6, 7, 10, 13, 14, 15, 20, 21, 22, 23].forEach(c => merges.push({ s: { r: 2, c }, e: { r: 3, c } }));
  [[8, 9], [11, 12], [16, 19]].forEach(([a, b]) => merges.push({ s: { r: 2, c: a }, e: { r: 2, c: b } }));
  const all = puItems().map(x => ({ x, proj: puProjOf(x) || '(Chưa gán dự án)' })).sort((m, n) => (m.x.ct || 0) - (n.x.ct || 0));
  const groups = {}; all.forEach(a => { const k = a.proj + '\u0001' + (a.x.disc || ''); (groups[k] = groups[k] || { p: a.proj, disc: a.x.disc || '', rows: [] }).rows.push(a.x); });
  const projIdx = new Map(puProjects().map((x, i) => [x.p, i]));
  Object.values(groups).sort((m, n) => (projIdx.has(m.p) ? projIdx.get(m.p) : 9999) - (projIdx.has(n.p) ? projIdx.get(n.p) : 9999) || m.disc.localeCompare(n.disc)).forEach(({ p, disc, rows }) => {
    let acc = null; // danh sách Job đang áp dụng trong khối hiện tại
    rows.forEach((x, i) => {
      const jl = String(x.job || '').split(',').map(puClean).filter(Boolean);
      const ext = acc && acc.every((j, k) => jl[k] === j);
      if (!ext || i === 0) {
        const meta = puMeta(p), mp = (meta && meta.pm) || x.pm || puApPm(p) || '';
        const pm = mp && !/^\s*(mr|mrs|ms)\b/i.test(mp) ? 'Mr. ' + mp : mp;
        const pr = blank(); pr[0] = `Project Name: ${p}${disc ? ` (${disc})` : ''}${pm ? ' - ' + pm : ''}`; aoa.push(pr);
        acc = [];
      }
      jl.slice(acc.length).forEach(j => { const jr = blank(); jr[0] = `Job No. : ${j}`; aoa.push(jr); });
      acc = jl.length > acc.length ? jl : acc;
      const r = blank(), st = puStatus(x);
      const num = v => (v !== '' && v !== null && !isNaN(Number(v)) && String(v).trim() !== '') ? Number(v) : (v || null);
      r[0] = x.no || i + 1; r[1] = x.supplier || null; r[2] = x.name || null; r[3] = x.quote || null; r[4] = x.origin || null; r[5] = num(x.qty); r[6] = x.unit || null; r[7] = x.code || null;
      r[8] = x.pr || null; r[10] = x.po || null; r[20] = x.reason || null; r[22] = st.t; r[23] = x.remarks || null;
      [[9, x.prDate], [11, x.ordPlan], [12, x.ordActual], [13, x.eff], [14, x.adv], [15, x.desired], [16, x.e0], [17, x.e1], [18, x.e2], [19, x.e3], [21, x.actual]].forEach(([c, v]) => { const sv = serial(v); if (sv !== null) { r[c] = sv; dateCells.push([aoa.length, c]); } });
      aoa.push(r);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  dateCells.forEach(([r, c]) => { const a = XLSX.utils.encode_cell({ r, c }); if (ws[a]) { ws[a].t = 'n'; ws[a].z = 'dd/mm/yyyy'; } });
  ws['!merges'] = merges;
  ws['!cols'] = [4, 20, 26, 14, 14, 6, 7, 11, 16, 12, 16, 12, 12, 14, 13, 15, 12, 10, 10, 10, 20, 12, 26, 34].map(w => ({ wch: w }));
  ws['!rows'] = [{ hpt: 22 }, {}, { hpt: 30 }, { hpt: 30 }];
  ws['!freeze'] = { xSplit: 3, ySplit: 4 }; ws['!views'] = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Weekly Report');
  XLSX.writeFile(wb, `PU_Delivery_${puToday()}.xlsx`);
}

// ── Bấm ô KPI → danh sách chi tiết các hạng mục theo trạng thái ──
function openPuDetail(k) {
  const today = puToday(), lab = { all: 'Tổng hàng hóa', late: 'Trễ tiến độ', soon7: 'Sắp giao (≤ 2 ngày)', miss: 'Thiếu kế hoạch đặt hàng', done: 'Đã giao' };
  const rows = puItems().map(x => ({ x, proj: puProjOf(x) || x.src || '(chưa gán)', s: puStatus(x, today) })).filter(a => k === 'all' || a.s.k === k)
    .sort((a, b) => a.proj.localeCompare(b.proj) || (puEst(a.x) || '9').localeCompare(puEst(b.x) || '9'));
  const col = k === 'all' ? '#1f2937' : PU_STATUS_COLOR[k];
  document.getElementById('puDTitle').innerHTML = `<span style="color:${col}">${puEsc(lab[k])}</span> <span style="font-weight:400;font-size:13px;color:var(--text2)">· ${rows.length} hạng mục</span>`;
  const T = v => `<td style="padding:6px 10px;white-space:nowrap">${puEsc(v)}</td>`, D = v => `<td style="padding:6px 10px;text-align:center;white-space:nowrap">${puFmt(v)}</td>`;
  const body = rows.map(a => { const x = a.x, est = puEst(x), rm = puRemain(x, today);
    return `<tr style="border-top:1px solid var(--border2,#eee);cursor:pointer" onclick="closePuDetail();openPuModal('${x.id}')" title="Bấm để sửa">${T(a.proj)}${T(x.pm)}
      <td style="padding:6px 10px;white-space:nowrap"><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff;background:${PU_STATUS_COLOR[a.s.k]}">${puEsc(x.name)}</span></td>
      ${T(x.supplier)}${T(x.po)}${D(x.desired)}${D(est)}${D(x.actual)}<td style="padding:6px 10px;text-align:center;white-space:nowrap;font-weight:700;color:${rm.c}">${rm.t}</td>
      <td style="padding:6px 10px;min-width:160px">${puEsc(x.reason)}</td><td style="padding:6px 10px;min-width:200px;font-size:11.5px;color:var(--text2)">${puEsc(x.remarks)}</td></tr>`; }).join('');
  document.getElementById('puDBody').innerHTML = rows.length ? `<table style="border-collapse:collapse;font-size:12px;width:100%"><thead><tr style="background:var(--bg2,#f3f5fa);position:sticky;top:0">${['Dự án', 'PM', 'Hạng mục', 'Supplier', 'PO/CO No.', 'Desired date', 'Ngày dự kiến', 'Giao thực tế', 'Còn lại / lệch', 'Lý do đổi lịch', 'Remarks'].map(h => `<th style="padding:8px 10px;text-align:left;white-space:nowrap">${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>` : '<div style="padding:20px;color:var(--text2)">Không có hạng mục nào.</div>';
  document.getElementById('puDetail').style.display = 'flex';
}
function closePuDetail() { document.getElementById('puDetail').style.display = 'none'; }

// Ô trạng thái trong form thêm/sửa: tính lại ngay khi đổi ngày
function puModalStatus() {
  const g = id => (document.getElementById(id)?.value || '').trim(), o = {};
  Object.entries(PU_DATES).forEach(([el, f]) => { o[f] = g(el); });
  o.supplier = g('puFSup'); o.reason = g('puFReason');
  const s = puStatus(o), rm = puRemain(o);
  const e = document.getElementById('puFStatus');
  if (e) e.innerHTML = puBadge(s) + (rm.t ? ` <span style="color:${rm.c === 'inherit' ? 'var(--text2)' : rm.c};font-size:12px">${s.k === 'done' ? 'giao ' + rm.t + ' so với ngày dự kiến' : rm.t.replace(/^trễ (\d+) ngày/, 'quá $1 ngày so với ngày dự kiến')}</span>` : '');
}
