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
function puProjects() {
  return Object.keys(PROJECTS_DB || {}).flatMap(g => Object.keys(PROJECTS_DB[g] || {}).filter(p => !p.startsWith('__') && p !== UNASSIGNED_PROJ).map(p => ({ g, p })));
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
  const s = puStatus(x), est = puEst(x), canDel = typeof isManager === 'function' && isManager();
  const chg = [['HĐ', x.e0], ['1st', x.e1], ['2nd', x.e2], ['3rd', x.e3]].filter(c => c[1]).map(c => `${c[0]} ${puFmtS(c[1])}`).join(' → ');
  const dd = (est && x.desired) ? puDaysBetween(x.desired, est) : null;
  const dl = dd === null ? '' : `<div style="font-size:10.5px;color:${dd > 0 ? '#C0392B' : '#2E7D32'}">${dd > 0 ? '+' : ''}${dd} ngày so với yêu cầu</div>`;
  return `<tr>
    <td style="text-align:center;color:var(--text2)">${no}</td>
    <td style="white-space:nowrap">${puEsc(x.supplier)}</td>
    <td style="font-weight:600;min-width:170px">${puEsc(x.name)}${x.quote ? `<div style="font-size:10.5px;font-weight:400;color:var(--text3)">Quot. ${puEsc(x.quote)}</div>` : ''}</td>
    <td style="white-space:nowrap">${puEsc(x.qty)} ${puEsc(x.unit)}</td>
    <td style="font-size:11px;color:var(--text2)">${puEsc(x.po || '')}${x.pr ? `<div>${puEsc(x.pr)}</div>` : ''}</td>
    <td style="font-size:11.5px;white-space:nowrap">${x.ordPlan ? `Plan ${puFmt(x.ordPlan)}` : ''}${x.ordActual ? `<div>Actual ${puFmt(x.ordActual)}</div>` : ''}</td>
    <td style="white-space:nowrap">${puFmt(x.desired)}</td>
    <td style="white-space:nowrap" title="${puEsc(chg)}"><b>${puFmt(est)}</b>${chg && (x.e1 || x.e2 || x.e3) ? `<div style="font-size:10.5px;color:var(--text3)">${puEsc(chg)}</div>` : ''}${dl}</td>
    <td style="max-width:150px;font-size:11.5px;color:var(--text2)">${puEsc(x.reason)}</td>
    <td style="white-space:nowrap">${puFmt(x.actual)}</td>
    <td>${puBadge(s)}</td>
    <td style="max-width:260px;white-space:normal;font-size:11.5px;color:var(--text2)">${puEsc(x.remarks)}</td>
    <td style="white-space:nowrap"><button class="btn" style="padding:3px 8px" title="Sửa" onclick="openPuModal('${x.id}')">✎</button>${canDel ? ` <button class="btn" style="padding:3px 8px" title="Xoá" onclick="deletePu('${x.id}')">🗑</button>` : ''}</td></tr>`;
}
const PU_HEAD = '<thead><tr><th>No.</th><th>Supplier</th><th>Name of Items</th><th>Q\'ty</th><th>PO/CO · PR</th><th>Order</th><th>Desired on site</th><th>Estimate on site</th><th>Reason for change</th><th>Actual on site</th><th>Status</th><th>Remarks</th><th></th></tr></thead>';

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
  const match = a => (c.st === 'all' || a.s.k === c.st) && (!c.q || [a.x.name, a.x.supplier, a.x.po, a.x.pm, a.x.remarks, a.x.reason].some(v => String(v || '').toLowerCase().includes(c.q)));
  let html = '';
  // Dòng chưa gán được dự án Action Plan → gom theo tên dự án trong Excel, cho phép gán hàng loạt
  const orphans = all.filter(a => !a.proj && match(a));
  if (orphans.length && c.proj === '__all__') {
    const bySrc = {}; orphans.forEach(a => (bySrc[a.x.src || '(không rõ dự án)'] = bySrc[a.x.src || '(không rõ dự án)'] || []).push(a));
    html += `<div class="card" style="border-left:4px solid #E8A33D"><div class="card-title" style="margin-bottom:6px">⚠️ Chưa gán dự án Action Plan <span style="font-weight:400;font-size:11.5px;color:var(--text2)">— ${orphans.length} hàng. Chọn dự án tương ứng cho từng nhóm (lưu lại cho lần nhập sau).</span></div>` +
      Object.keys(bySrc).map(src => `<div style="margin:10px 0 4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${puEsc(src)}</b> <span style="color:var(--text2);font-size:11.5px">(${bySrc[src].length} hàng)</span>
        <select onchange="puAssignSrc('${encodeURIComponent(src)}', this.value)" style="padding:4px 8px"><option value="">Gán vào dự án…</option>${projs.map(x => `<option value="${puEsc(x.p)}">${puEsc(x.p)}</option>`).join('')}</select></div>
        <div class="tbl-wrap"><table>${PU_HEAD}<tbody>${bySrc[src].map((a, i) => puRow(a.x, a.x.no || i + 1)).join('')}</tbody></table></div>`).join('') + '</div>';
  }
  projs.filter(x => c.proj === '__all__' || x.p === c.proj).forEach(({ p }) => {
    const rows = all.filter(a => a.proj === p), shown = rows.filter(match);
    if (!rows.length && c.hideEmpty && c.proj === '__all__') return;
    if (rows.length && !shown.length && (c.st !== 'all' || c.q)) return;
    const pms = [...new Set(rows.map(a => a.x.pm ? (a.x.pm + (a.x.disc ? ` (${a.x.disc})` : '')) : '').filter(Boolean))];
    const apPm = puApPm(p);
    const jobs = [...new Set(rows.flatMap(a => String(a.x.job || '').split(',').map(puClean).filter(Boolean)))];
    const chips = PU_ST_LIST.map(([k, l]) => { const n = rows.filter(a => a.s.k === k).length; return n ? `<span style="font-size:11px;color:#fff;background:${PU_STATUS_COLOR[k]};padding:1px 8px;border-radius:999px" title="${l}">${n} ${l}</span>` : ''; }).join(' ');
    const open = puOpen[p] !== undefined ? puOpen[p] : (rows.length > 0 && (c.q || c.st !== 'all' || rows.some(a => ['late', 'soon7', 'miss'].includes(a.s.k))));
    puLast[p] = !!open;
    html += `<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;cursor:pointer" onclick="puToggle('${encodeURIComponent(p)}')">
      <span style="font-size:15px">${open ? '▾' : '▸'}</span>
      <div style="font-size:15px;font-weight:800">${puEsc(p)}</div>
      <div style="font-size:12.5px;color:var(--text2)">👤 PM: <b>${puEsc(pms.length ? pms.join(', ') : (apPm || '—'))}</b>${jobs.length ? ` · Job: ${puEsc(jobs.join(', '))}` : ''}</div>
      <div style="font-size:12px;color:var(--text2)">${rows.length} hàng hóa</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">${chips}</div>
      <button class="btn" style="padding:3px 10px;margin-left:auto" onclick="event.stopPropagation();openPuModal(null,'${encodeURIComponent(p)}')">＋ Thêm hàng</button></div>
      ${open ? (shown.length ? `<div class="tbl-wrap" style="margin-top:10px"><table>${PU_HEAD}<tbody>${shown.map((a, i) => puRow(a.x, a.x.no || i + 1)).join('')}</tbody></table></div>` : '<div style="padding:10px;color:var(--text2);font-size:12px">Chưa có hàng hóa.</div>') : ''}</div>`;
  });
  host.innerHTML = html || '<div class="card" style="text-align:center;color:var(--text2)">Chưa có dữ liệu. Bấm "Nhập Excel" để nạp file Equipment Order Record, hoặc "＋ Thêm hàng" trong từng dự án.</div>';
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
    aoa.push([`Project Name: ${p}${pms.length ? ' - ' + pms.join(' / ') : puApPm(p) ? ' - ' + puApPm(p) : ''}`]);
    groups[p].forEach((x, i) => aoa.push([x.no || i + 1, x.supplier, x.name, x.quote, x.origin, x.qty, x.unit, x.code, x.pr, puFmt(x.prDate), x.po, puFmt(x.ordPlan), puFmt(x.ordActual), puFmt(x.eff), puFmt(x.adv), puFmt(x.desired), puFmt(x.e0), puFmt(x.e1), puFmt(x.e2), puFmt(x.e3), x.reason, puFmt(x.actual), puStatus(x).t, x.remarks]));
  });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Weekly Report');
  XLSX.writeFile(wb, `PU_Delivery_${puToday()}.xlsx`);
}
