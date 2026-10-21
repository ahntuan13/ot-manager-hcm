// ============================================================
//  PU DELIVERY — theo dõi giao hàng của NCC (PU = Purchasing). Mỗi dòng 1 doc Firestore "pu_<id>".
//  PU_DB = { id: { id, desc, qty, supplier, project, pic, reqDate, etaDate, finalDate, status, notes, ct, at } }
//  Ngày lưu dạng ISO yyyy-mm-dd, hiển thị dd/mm/yyyy.
// ============================================================
const PU_KEY = 'ot_manager_pu_v1';
let PU_DB = {};
const PU_STATUS = [
  { k: 'wait',  ic: '⚪', l: 'Chờ NCC phản hồi',     c: '#8a8f98' },
  { k: 'fixed', ic: '🟡', l: 'Đã chốt tiến độ',      c: '#E8A33D' },
  { k: 'ok',    ic: '🟢', l: 'Đạt yêu cầu',          c: '#2E7D32' },
  { k: 'late',  ic: '🔴', l: 'Trễ hạn (Đã Duyệt)',   c: '#C0392B' },
  { k: 'late2', ic: '🔴', l: 'Trễ hạn (Chưa duyệt)', c: '#C0392B' },
  { k: 'done',  ic: '📦', l: 'Đã giao',              c: '#2D6CDF' }
];
const puSt = k => PU_STATUS.find(s => s.k === k) || PU_STATUS[0];
let puEditId = null;

function loadPuDb() { try { const r = localStorage.getItem(PU_KEY); if (r) PU_DB = JSON.parse(r) || {}; } catch (e) {} }
function savePuDb() { try { localStorage.setItem(PU_KEY, JSON.stringify(PU_DB)); } catch (e) {} if (typeof cloudTouch === 'function') cloudTouch(); }
loadPuDb();

const puEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function puFmt(iso) { if (!iso) return '—'; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; }
// Nhận dd/mm/yyyy, yyyy-mm-dd hoặc số serial Excel → ISO
function puParseDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }
  const s = String(v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
const puDays = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 86400000) : null;
function puSorted() { return Object.values(PU_DB).sort((a, b) => (a.ct || 0) - (b.ct || 0)); }

function renderPuDelivery() {
  const body = document.getElementById('puBody'); if (!body) return;
  const all = puSorted();
  const fs = document.getElementById('puStatusFilter')?.value || 'all';
  const q = (document.getElementById('puSearch')?.value || '').toLowerCase().trim();
  const stSel = document.getElementById('puStatusFilter');
  if (stSel && stSel.options.length <= 1) stSel.innerHTML = '<option value="all">Tất cả trạng thái</option>' + PU_STATUS.map(s => `<option value="${s.k}">${s.ic} ${s.l}</option>`).join('');
  if (stSel) stSel.value = fs;
  const kpi = document.getElementById('puKpi');
  if (kpi) kpi.innerHTML = `<div class="mk"><b>${all.length}</b><span>Tổng đơn hàng</span></div>` +
    ['fixed', 'ok', 'late', 'late2'].map(k => { const s = puSt(k); return `<div class="mk"><b style="color:${s.c}">${all.filter(x => x.status === k).length}</b><span>${s.ic} ${s.l}</span></div>`; }).join('');
  const rows = all.map((x, i) => ({ x, no: i + 1 })).filter(({ x }) =>
    (fs === 'all' || x.status === fs) &&
    (!q || [x.desc, x.supplier, x.project, x.pic, x.notes].some(v => String(v || '').toLowerCase().includes(q))));
  const edit = true, canDel = typeof isManager === 'function' && isManager();
  body.innerHTML = rows.map(({ x, no }) => {
    const s = puSt(x.status), d = puDays(x.reqDate, x.finalDate);
    const dl = d === null ? '<span style="color:var(--text3)">—</span>' : `<b style="color:${d > 0 ? '#C0392B' : '#2E7D32'}">${d > 0 ? '+' : ''}${d} ngày</b>`;
    return `<tr>
      <td style="text-align:center;color:var(--text2)">${no}</td>
      <td style="font-weight:600">${puEsc(x.desc)}</td><td>${puEsc(x.qty)}</td><td>${puEsc(x.supplier)}</td><td>${puEsc(x.project)}</td><td>${puEsc(x.pic)}</td>
      <td style="text-align:right">${puFmt(x.reqDate)}</td><td style="text-align:right">${puFmt(x.etaDate)}</td><td style="text-align:right;font-weight:600">${puFmt(x.finalDate)}</td>
      <td style="text-align:center">${dl}</td>
      <td style="white-space:nowrap">${s.ic} ${puEsc(s.l)}</td>
      <td style="max-width:320px;white-space:normal;color:var(--text2)">${puEsc(x.notes)}</td>
      <td style="white-space:nowrap">${edit ? `<button class="btn" style="padding:3px 8px" title="Sửa" onclick="openPuModal('${x.id}')">✎</button>` : ''}${canDel ? ` <button class="btn" style="padding:3px 8px" title="Xoá" onclick="deletePu('${x.id}')">🗑</button>` : ''}</td></tr>`;
  }).join('') || '<tr><td colspan="13" style="text-align:center;padding:20px;color:var(--text2)">Chưa có đơn hàng. Bấm "＋ Thêm" hoặc "Nhập Excel".</td></tr>';
}

function openPuModal(id) {
  puEditId = id || null;
  const x = id ? PU_DB[id] : { status: 'wait' };
  if (!x) return;
  const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; };
  set('puFDesc', x.desc); set('puFQty', x.qty); set('puFSup', x.supplier); set('puFProj', x.project); set('puFPic', x.pic);
  set('puFReq', x.reqDate); set('puFEta', x.etaDate); set('puFFinal', x.finalDate); set('puFNotes', x.notes);
  document.getElementById('puFStatus').innerHTML = PU_STATUS.map(s => `<option value="${s.k}">${s.ic} ${s.l}</option>`).join('');
  document.getElementById('puFStatus').value = x.status || 'wait';
  document.getElementById('puModalTitle').textContent = id ? 'Sửa đơn hàng' : 'Thêm đơn hàng';
  // gợi ý dự án từ Action Plan
  const dl = document.getElementById('puProjList');
  if (dl) dl.innerHTML = Object.keys(PROJECTS_DB || {}).flatMap(g => Object.keys(PROJECTS_DB[g] || {}).filter(p => !p.startsWith('__') && p !== UNASSIGNED_PROJ)).map(p => `<option value="${puEsc(p)}">`).join('');
  document.getElementById('puModal').style.display = 'flex';
}
function closePuModal() { document.getElementById('puModal').style.display = 'none'; puEditId = null; }
function savePuModal() {
  const g = i => (document.getElementById(i)?.value || '').trim();
  if (!g('puFDesc')) { toast('⚠️ Nhập mô tả sản phẩm.'); return; }
  const now = Date.now(), id = puEditId || ('p' + now.toString(36) + Math.random().toString(36).slice(2, 5));
  const old = PU_DB[id] || {};
  PU_DB[id] = { ...old, id, desc: g('puFDesc'), qty: g('puFQty'), supplier: g('puFSup'), project: g('puFProj'), pic: g('puFPic'),
    reqDate: g('puFReq'), etaDate: g('puFEta'), finalDate: g('puFFinal'), status: g('puFStatus') || 'wait', notes: g('puFNotes'), ct: old.ct || now, at: now };
  savePuDb(); closePuModal(); renderPuDelivery(); toast('💾 Đã lưu đơn hàng.');
}
function deletePu(id) {
  if (typeof requireManager === 'function' && !requireManager('xoá đơn hàng')) return;
  if (!confirm('Xoá đơn hàng này?')) return;
  delete PU_DB[id]; savePuDb(); renderPuDelivery();
}
function exportPuExcel() {
  const aoa = [['STT', 'Mô Tả Sản Phẩm', 'Số Lượng', 'Nhà Cung Cấp (Supplier)', 'Dự Án / Dept Yêu Cầu', 'PIC', 'Ngày Yêu Cầu Giao Hàng', 'Ngày Giao Hàng Dự Kiến (Sup/PU)', 'Ngày Giao Hàng Chốt Cuối Cùng', 'Trạng Thái', 'Ghi Chú']];
  puSorted().forEach((x, i) => aoa.push([i + 1, x.desc, x.qty, x.supplier, x.project, x.pic, puFmt(x.reqDate).replace('—', ''), puFmt(x.etaDate).replace('—', ''), puFmt(x.finalDate).replace('—', ''), puSt(x.status).ic + ' ' + puSt(x.status).l, x.notes || '']));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'PU Delivery');
  XLSX.writeFile(wb, `PU_Delivery_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
// Nhập Excel/CSV đúng thứ tự cột như Google Sheet (dòng 1 là tiêu đề)
async function importPuExcel(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    let added = 0; const base = Date.now();
    rows.slice(1).forEach((r, i) => {
      if (!String(r[1] || '').trim()) return;
      const t = String(r[9] || '').toLowerCase();
      const status = /chưa duyệt/.test(t) ? 'late2' : /trễ/.test(t) ? 'late' : /đạt/.test(t) ? 'ok' : /chốt/.test(t) ? 'fixed' : /đã giao/.test(t) ? 'done' : 'wait';
      const id = 'p' + (base + i).toString(36) + Math.random().toString(36).slice(2, 5);
      PU_DB[id] = { id, desc: String(r[1]).trim(), qty: String(r[2] ?? '').trim(), supplier: String(r[3] ?? '').trim(), project: String(r[4] ?? '').trim(), pic: String(r[5] ?? '').trim(),
        reqDate: puParseDate(r[6]), etaDate: puParseDate(r[7]), finalDate: puParseDate(r[8]), status, notes: String(r[10] ?? '').trim(), ct: base + i, at: base + i };
      added++;
    });
    savePuDb(); renderPuDelivery(); toast(`✅ Đã nhập ${added} dòng.`);
  } catch (e) { toast('⚠️ Không đọc được file: ' + e.message); }
  inp.value = '';
}
