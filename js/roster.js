// ============================================================
//  NHÂN VIÊN HCM — danh sách chuẩn (mã NV → họ tên, phòng ban, chức vụ, trạng thái) để phân loại OT theo phòng ban / dự án
//  thay vì đọc từ file chấm công (file xuất từ máy chấm công thường KHÔNG có cột Phòng ban).
//  Mỗi NV 1 doc Firestore "emp_<mã>":  { code, name, dept, pos, email, status:'ot'|'excl'|'left', note, lock, src, at }
//    status 'ot' = tính OT · 'excl' = không tính OT (không thuộc HCM / không áp dụng) · 'left' = đã nghỉ việc (giữ dữ liệu cũ)
//    lock = phòng ban do người dùng chọn tay → file upload KHÔNG ghi đè.
// ============================================================
const EMP_KEY = 'ot_manager_emp_v1';
let EMP_DB = {};
function loadEmpDb() { try { const r = localStorage.getItem(EMP_KEY); if (r) EMP_DB = JSON.parse(r) || {}; } catch (e) {} }
function saveEmpDb() { try { localStorage.setItem(EMP_KEY, JSON.stringify(EMP_DB)); } catch (e) {} if (typeof cloudTouch === 'function') cloudTouch(); }
loadEmpDb();
const EMP_DEPTS = ['HCM-EC', 'S-AD', 'S-ED', 'S-QC', 'S-PU', 'S-PD', 'S-AZ'];
const EMP_ST = { ot: ['Tính OT', '#2E7D32'], excl: ['Không tính OT', '#8a8f98'], left: ['Đã nghỉ việc', '#C0392B'] };
const emEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let empQ = '', empFDept = 'all', empFSt = 'ot', empFProj = 'all', empGroup = 'dept';

// ── Cập nhật danh sách (dùng bởi bộ đọc file) ──
function rosterUpsert(code, o, opts) {
  code = String(code || '').trim(); if (!code) return false;
  const cur = EMP_DB[code]; opts = opts || {};
  if (!cur) { EMP_DB[code] = { code, name: o.name || '', dept: o.dept || '', pos: o.pos || '', email: o.email || '', status: o.status || 'ot', note: '', src: o.src || 'file', at: Date.now() }; return true; }
  let ch = false;
  const set = (k, v) => { if (v && cur[k] !== v) { cur[k] = v; ch = true; } };
  set('name', o.name); set('pos', o.pos); set('email', o.email);
  if (o.dept && !cur.lock && cur.dept !== o.dept) { cur.dept = o.dept; ch = true; }
  if (ch) cur.at = Date.now();
  return ch;
}
// Phòng ban theo danh sách: trả '' nếu chưa có
const rosterDept = code => (EMP_DB[code] && EMP_DB[code].dept) || '';
const rosterStatus = code => (EMP_DB[code] && EMP_DB[code].status) || '';

// Lấy từ dữ liệu OT / đi trễ / WLB đã có trong app (mã NV + phòng ban)
function rosterSeed(silent) {
  let n = 0;
  const add = (code, name, dept, pos) => { code = String(code || '').trim(); if (!code || !dept || EMP_DB[code]) return; if (!EMP_DEPTS.includes(dept)) return; EMP_DB[code] = { code, name: String(name || '').replace(/\s*\([^)]*\)\s*$/, ''), dept, pos: pos || '', email: '', status: 'ot', note: '', src: 'ot', at: Date.now() }; n++; };
  Object.keys(DB || {}).sort().forEach(mk => { const m = DB[mk]; Object.keys(m.employees || {}).forEach(k => { const e = m.employees[k]; add(e.staffCode, k, e.dept); }); });
  Object.keys(LATE_DB || {}).forEach(mk => { const m = LATE_DB[mk]; Object.keys(m.employees || {}).forEach(k => { const e = m.employees[k]; add(e.code, k, e.dept); }); });
  try { Object.keys((WLB_XLS && WLB_XLS.employees) || {}).forEach(k => { const e = WLB_XLS.employees[k]; add(e.code, e.name || k, e.dept, e.position); }); } catch (e) {}
  if (n) saveEmpDb(); if (!silent) toast(n ? `✅ Đã lấy ${n} nhân viên từ dữ liệu OT hiện có.` : 'Không có nhân viên mới để lấy từ dữ liệu hiện có.');
  return n;
}

// ── Áp phòng ban / loại NV khỏi dữ liệu OT đã nạp ──
function rosterApplyDept(code, dept) {
  let n = 0;
  const mv = (M, codeField) => Object.keys(M || {}).forEach(mk => {
    const m = M[mk]; Object.keys(m.employees || {}).forEach(k => {
      const e = m.employees[k]; if ((e[codeField] || '') !== code || e.dept === dept) return;
      const old = e.dept; e.dept = dept; n++;
      if (m.depts && m.depts[old]) { m.depts[old] = m.depts[old].filter(x => x !== k); if (!m.depts[old].length) delete m.depts[old]; }
      if (m.depts) { (m.depts[dept] = m.depts[dept] || []); if (!m.depts[dept].includes(k)) m.depts[dept].push(k); }
    });
  });
  mv(DB, 'staffCode'); mv(LATE_DB, 'code');
  if (n) { saveDB(false); try { saveLateDB(); } catch (e) {} }
  return n;
}
function rosterPurge(code) {
  let n = 0;
  const rm = M => Object.keys(M || {}).forEach(mk => { const m = M[mk]; Object.keys(m.employees || {}).forEach(k => { const e = m.employees[k]; if ((e.staffCode || e.code || '') === code) { delete m.employees[k]; m.names = (m.names || []).filter(x => x !== k); Object.keys(m.depts || {}).forEach(d => { m.depts[d] = m.depts[d].filter(x => x !== k); if (!m.depts[d].length) delete m.depts[d]; }); n++; } }); });
  rm(DB); rm(LATE_DB); if (n) { saveDB(false); try { saveLateDB(); } catch (e) {} }
  return n;
}

// ── Trang "Nhân viên HCM" ──
function rosterLatestMk() { return Object.keys(DB || {}).sort().pop() || null; }
function rosterOtMap() {
  const mk = rosterLatestMk(), map = {}; if (!mk) return { mk, map };
  try { getTotals(mk).forEach(t => { if (t.staffCode) map[t.staffCode] = t; }); } catch (e) {}
  return { mk, map };
}
function rosterProjOf(code) {
  const pm = (typeof currentProjectMap === 'function') ? currentProjectMap() : {};
  const k = pm[code]; return k ? k.split('::').slice(1).join('::') : '';
}
function renderRoster() {
  const box = document.getElementById('rosterBody'); if (!box) return;
  if (!Object.keys(EMP_DB).length && Object.keys(DB || {}).length && isManager()) { rosterSeed(true); }
  const edit = isManager(), { mk, map } = rosterOtMap(), q = empQ.trim().toLowerCase();
  const all = Object.values(EMP_DB), projs = [...new Set(all.map(e => rosterProjOf(e.code)).filter(Boolean))].sort();
  const rows = all.filter(e => (empFSt === 'all' || e.status === empFSt) && (empFDept === 'all' || e.dept === empFDept) && (empFProj === 'all' || (empFProj === '__none__' ? !rosterProjOf(e.code) : rosterProjOf(e.code) === empFProj)) &&
    (!q || (e.code + ' ' + e.name + ' ' + (e.pos || '') + ' ' + (e.email || '')).toLowerCase().includes(q)));
  const cntDept = d => all.filter(e => e.status === 'ot' && e.dept === d).length, noDept = all.filter(e => e.status === 'ot' && !e.dept).length;
  const noProj = all.filter(e => e.status === 'ot' && !rosterProjOf(e.code)).length;
  const keyOf = e => empGroup === 'dept' ? (e.dept || '(Chưa có phòng ban)') : empGroup === 'proj' ? (rosterProjOf(e.code) || '(Chưa gán dự án)') : '';
  rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || a.name.localeCompare(b.name, 'vi'));
  const mkLabel = mk ? (typeof fmtMK === 'function' ? fmtMK(mk) : mk) : '';
  const tr = e => { const t = map[e.code], pr = rosterProjOf(e.code), st = EMP_ST[e.status] || EMP_ST.ot, tot = t ? t.total : null;
    const pct = tot != null ? Math.round(tot * 100 / 70) : null, col = tot == null ? '' : tot > 70 ? '#C0392B' : tot >= 60 ? '#E8A33D' : 'inherit';
    return `<tr${e.status !== 'ot' ? ' style="opacity:.6"' : ''}><td style="white-space:nowrap">${emEsc(e.code)}</td><td><b>${emEsc(e.name)}</b>${e.note ? `<div style="font-size:10.5px;color:var(--text2)">${emEsc(e.note)}</div>` : ''}</td>
      <td>${e.dept ? `<span class="rs-dept">${emEsc(e.dept)}</span>` : '<span style="color:#C0392B;font-size:12px">chưa có</span>'}</td><td style="font-size:12px;color:var(--text2)">${emEsc(e.pos || '')}</td>
      <td>${pr ? emEsc(pr) : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="text-align:right;color:${col};font-weight:${tot > 60 ? 700 : 400}">${tot != null ? tot.toFixed(1) : '—'}</td><td style="text-align:right;color:${col}">${pct != null ? pct + '%' : ''}</td>
      <td><span class="pg-pill" style="background:${st[1]}">${st[0]}</span></td>${edit ? `<td style="white-space:nowrap"><button class="pg-ib" onclick="rosterEdit('${emEsc(e.code).replace(/'/g, '&#39;')}')" title="Sửa">✎</button></td>` : ''}</tr>`; };
  let body = '', last = null, grp = [];
  const flush = () => { if (grp.length && empGroup !== 'none') { const s = grp.reduce((a, e) => a + ((map[e.code] && map[e.code].total) || 0), 0); body = body.replace('<!--GS-->', `${grp.length} NV · OT ${s.toFixed(1)}h`); } grp = []; };
  rows.forEach(e => { const k = keyOf(e); if (empGroup !== 'none' && k !== last) { flush(); body += `<tr class="rs-grp"><td colspan="${edit ? 9 : 8}"><b>${emEsc(k)}</b> <span><!--GS--></span></td></tr>`; last = k; } grp.push(e); body += tr(e); });
  flush();
  box.innerHTML = `<div class="mp-kpi">
      <div class="mk"><b>${all.filter(e => e.status === 'ot').length}</b><span>NV đang tính OT</span></div>
      ${EMP_DEPTS.map(d => `<div class="mk" style="cursor:pointer" onclick="empFDept='${d}';empFSt='ot';renderRoster()"><b>${cntDept(d)}</b><span>${d}</span></div>`).join('')}
      <div class="mk" style="cursor:pointer" onclick="empFProj='__none__';empFSt='ot';renderRoster()"><b style="color:${noProj ? '#E8A33D' : 'inherit'}">${noProj}</b><span>Chưa gán dự án</span></div>
      ${noDept ? `<div class="mk"><b style="color:#C0392B">${noDept}</b><span>Chưa có phòng ban</span></div>` : ''}
      <div class="mk"><b>${all.filter(e => e.status === 'left').length}</b><span>Đã nghỉ việc</span></div></div>
    <div class="card"><div class="action-row">
      ${edit ? `<button class="btn btn-primary" onclick="rosterEdit('')">＋ Thêm nhân viên</button><label class="btn" style="cursor:pointer">⬆ Nhập từ file<input type="file" accept=".xlsx,.xls" style="display:none" onchange="rosterImportFile(this)"></label><button class="btn" onclick="rosterSeed()" title="Lấy mã NV + phòng ban từ dữ liệu OT/đi trễ/WLB đã nạp">↻ Lấy từ dữ liệu OT</button>` : ''}
      <button class="btn" onclick="rosterExport()">⬇ Excel</button>
      <input type="text" placeholder="Tìm mã, tên, chức vụ…" value="${emEsc(empQ)}" oninput="empQ=this.value;rosterRefocus(this)" style="width:200px">
      <select onchange="empFDept=this.value;renderRoster()"><option value="all">Tất cả phòng ban</option>${EMP_DEPTS.map(d => `<option${empFDept === d ? ' selected' : ''}>${d}</option>`).join('')}</select>
      <select onchange="empFProj=this.value;renderRoster()"><option value="all">Tất cả dự án</option><option value="__none__"${empFProj === '__none__' ? ' selected' : ''}>(Chưa gán dự án)</option>${projs.map(p => `<option value="${emEsc(p)}"${empFProj === p ? ' selected' : ''}>${emEsc(p)}</option>`).join('')}</select>
      <select onchange="empFSt=this.value;renderRoster()"><option value="all">Mọi trạng thái</option>${Object.keys(EMP_ST).map(k => `<option value="${k}"${empFSt === k ? ' selected' : ''}>${EMP_ST[k][0]}</option>`).join('')}</select>
      <select onchange="empGroup=this.value;renderRoster()"><option value="dept"${empGroup === 'dept' ? ' selected' : ''}>Nhóm theo phòng ban</option><option value="proj"${empGroup === 'proj' ? ' selected' : ''}>Nhóm theo dự án</option><option value="none"${empGroup === 'none' ? ' selected' : ''}>Không nhóm</option></select>
      <span style="font-size:12px;color:var(--text2)">${rows.length} NV${(empFDept !== 'all' || empFProj !== 'all' || empFSt !== 'ot' || q) ? ' (đang lọc) ' : ''}<a href="javascript:void 0" onclick="empFDept='all';empFProj='all';empFSt='ot';empQ='';renderRoster()">đặt lại bộ lọc</a></span></div>
    <div class="pg-tblw"><table class="pg-tbl"><thead><tr><th style="text-align:left">Mã NV</th><th style="text-align:left">Họ và tên</th><th style="text-align:left">Phòng ban</th><th style="text-align:left">Chức vụ</th><th style="text-align:left">Dự án (Action Plan)</th><th>OT ${emEsc(mkLabel)} (h)</th><th>% hạn mức 70h</th><th>Trạng thái</th>${edit ? '<th></th>' : ''}</tr></thead>
      <tbody>${body || `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text2)">Chưa có nhân viên. Bấm <b>↻ Lấy từ dữ liệu OT</b>, <b>⬆ Nhập từ file</b> hoặc upload file chấm công — app sẽ hỏi các NV HCM mới.</td></tr>`}</tbody></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">Danh sách này là nguồn chuẩn để phân loại: file chấm công không có cột Phòng ban vẫn được xếp đúng phòng. NV chấm công ở thiết bị "HCM …" mà chưa có trong danh sách sẽ được hỏi khi upload; NV Hà Nội tự bỏ qua. Dự án lấy từ Action Plan.</div></div>`;
}
function rosterRefocus(inp) { const pos = inp.selectionStart; renderRoster(); const ni = document.querySelector('#rosterBody input[type=text]'); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} } }

// ── Thêm / sửa ──
function rosterEdit(code) {
  if (!requireManager('sửa danh sách nhân viên')) return;
  const e = EMP_DB[code] || { code: '', name: '', dept: '', pos: '', email: '', status: 'ot', note: '' }, isNew = !EMP_DB[code];
  const ov = document.createElement('div'); ov.id = 'rosterModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:8px">${isNew ? 'Thêm nhân viên HCM' : 'Sửa nhân viên'}</div>
    <div class="pg-g2"><label>Mã nhân viên<input id="rsCode" value="${emEsc(e.code)}" ${isNew ? '' : 'disabled'}></label><label>Họ và tên<input id="rsName" value="${emEsc(e.name)}"></label>
    <label>Phòng ban<select id="rsDept"><option value="">— chọn —</option>${EMP_DEPTS.map(d => `<option${e.dept === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label><label>Chức vụ<input id="rsPos" value="${emEsc(e.pos || '')}"></label>
    <label>Email<input id="rsMail" value="${emEsc(e.email || '')}"></label><label>Trạng thái<select id="rsSt">${Object.keys(EMP_ST).map(k => `<option value="${k}"${e.status === k ? ' selected' : ''}>${EMP_ST[k][0]}</option>`).join('')}</select></label></div>
    <label>Ghi chú<input id="rsNote" value="${emEsc(e.note || '')}"></label>
    <div style="font-size:11px;color:var(--text3);margin:8px 0">Phòng ban chọn tay sẽ được <b>khoá</b> — file upload không ghi đè. Đổi phòng ban sẽ cập nhật luôn dữ liệu OT/đi trễ của NV đã nạp. "Không tính OT" xoá NV khỏi dữ liệu OT đã nạp và bỏ qua ở các lần upload sau. Dự án gán ở mục Action Plan.</div>
    <div class="action-row" style="justify-content:space-between;margin:0">${isNew ? '<span></span>' : `<button class="btn" style="color:#C0392B" onclick="rosterDelete('${emEsc(e.code).replace(/'/g, '&#39;')}')">Xoá khỏi danh sách</button>`}<span style="display:flex;gap:8px"><button class="btn" onclick="rosterClose()">Huỷ</button><button class="btn btn-primary" onclick="rosterSave(${isNew})">Lưu</button></span></div></div>`;
  document.body.appendChild(ov);
}
function rosterClose() { const m = document.getElementById('rosterModal'); if (m) m.remove(); }
function rosterSave(isNew) {
  const g = id => document.getElementById(id), code = (g('rsCode').value || '').trim(), name = (g('rsName').value || '').trim();
  if (!code || !name) { toast('⚠️ Nhập mã nhân viên và họ tên.'); return; }
  if (isNew && EMP_DB[code]) { toast('⚠️ Mã nhân viên này đã có trong danh sách.'); return; }
  const dept = g('rsDept').value, st = g('rsSt').value;
  if (st === 'ot' && !dept) { toast('⚠️ Chọn phòng ban cho NV tính OT.'); return; }
  const old = EMP_DB[code], e = old || { code, src: 'manual' };
  const deptChanged = old && old.dept !== dept;
  Object.assign(e, { name, dept, pos: (g('rsPos').value || '').trim(), email: (g('rsMail').value || '').trim(), status: st, note: (g('rsNote').value || '').trim(), at: Date.now() });
  if (dept && (isNew || deptChanged)) e.lock = true;
  EMP_DB[code] = e;
  let msg = 'Đã lưu.';
  if (st === 'excl') {
    if (confirm(`"Không tính OT": xoá dữ liệu OT/đi trễ của ${name} (${code}) khỏi các tháng đã nạp và bỏ qua ở các lần upload sau?`)) { const n = rosterPurge(code); msg = `Đã lưu · xoá ${n} bản ghi OT của NV này.`; }
  } else if (dept && (isNew || deptChanged)) { const n = rosterApplyDept(code, dept); if (n) msg = `Đã lưu · cập nhật phòng ban cho ${n} bản ghi OT đã nạp.`; }
  saveEmpDb(); rosterClose(); renderRoster(); try { rebuildUI(); } catch (er) {} toast('✅ ' + msg);
}
function rosterDelete(code) {
  if (!requireManager('xoá nhân viên') || !confirm('Xoá ' + code + ' khỏi danh sách? (Dữ liệu OT đã nạp không bị xoá; lần upload sau NV này sẽ được hỏi lại nếu chấm công ở HCM.)')) return;
  delete EMP_DB[code]; saveEmpDb(); rosterClose(); renderRoster();
}

// ── Nhập từ file Excel (file chấm công có cột Phòng ban, hoặc file danh sách tự xuất ra) ──
function rosterImportFile(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f || !requireManager('nhập danh sách nhân viên')) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const wb = XLSX.read(new Uint8Array(rd.result), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]], aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      let h = -1; for (let i = 0; i < Math.min(aoa.length, 15); i++) { const t = (aoa[i] || []).map(c => String(c).toLowerCase()); if (t.some(c => /mã (nv|nhân viên)|staff code/.test(c)) && t.some(c => /họ/.test(c))) { h = i; break; } }
      if (h < 0) throw new Error('không thấy cột "Mã nhân viên" và "Họ và tên"');
      const H = aoa[h].map(c => String(c).toLowerCase()), ix = re => H.findIndex(c => re.test(c));
      const cC = ix(/mã (nv|nhân viên)|staff code/), cN = ix(/họ/), cD = ix(/phòng ban|dept|department/), cP = ix(/chức vụ|position/), cE = ix(/email/), cS = ix(/trạng thái/), cNo = ix(/ghi chú/);
      let add = 0, upd = 0, skip = 0; const seen = new Set();
      aoa.slice(h + 1).forEach(r => {
        const code = String(r[cC] || '').trim(); if (!code || seen.has(code)) return; seen.add(code);
        const name = String(r[cN] || '').trim(); if (!name) return;
        const dept = cD >= 0 ? mapNewDept(r[cD]) : null;
        if (cD >= 0 && !dept) { skip++; return; }   // phòng không thuộc HCM (Tổng vụ, Kế toán…) → bỏ
        const had = !!EMP_DB[code];
        const ch = rosterUpsert(code, { name, dept: dept || '', pos: cP >= 0 ? String(r[cP] || '').trim() : '', email: cE >= 0 ? String(r[cE] || '').trim() : '', src: 'import' });
        if (cS >= 0) { const s = String(r[cS] || ''); const st = /không tính/i.test(s) ? 'excl' : /nghỉ/i.test(s) ? 'left' : /tính/i.test(s) ? 'ot' : ''; if (st && EMP_DB[code].status !== st) { EMP_DB[code].status = st; EMP_DB[code].at = Date.now(); } }
        if (cNo >= 0 && r[cNo]) EMP_DB[code].note = String(r[cNo]).trim();
        if (!had) add++; else if (ch) upd++;
      });
      saveEmpDb(); renderRoster(); toast(`✅ Nhập xong: thêm ${add}, cập nhật ${upd}${skip ? `, bỏ ${skip} NV phòng không thuộc HCM` : ''}.`);
    } catch (e) { toast('⚠️ Không đọc được file: ' + (e.message || e)); }
  };
  rd.readAsArrayBuffer(f);
}
function rosterExport() {
  if (typeof XLSX === 'undefined') return; const { mk, map } = rosterOtMap();
  const rows = [['Mã NV', 'Họ và tên', 'Phòng ban', 'Chức vụ', 'Email', 'Dự án (Action Plan)', 'Trạng thái', 'Ghi chú', 'OT ' + (mk || '') + ' (h)']];
  Object.values(EMP_DB).sort((a, b) => (a.dept || '').localeCompare(b.dept || '') || a.name.localeCompare(b.name, 'vi')).forEach(e => rows.push([e.code, e.name, e.dept, e.pos || '', e.email || '', rosterProjOf(e.code), EMP_ST[e.status][0], e.note || '', map[e.code] ? Math.round(map[e.code].total * 10) / 10 : '']));
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [10, 28, 10, 24, 28, 24, 14, 24, 12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên HCM'); XLSX.writeFile(wb, `Nhan-vien-HCM-${(typeof puToday === 'function' ? puToday() : '')}.xlsx`);
}

// ── Hộp "Nhân viên mới" khi upload file chấm công ──
// list: [{code,name,days,dev}]; onDone(): gọi sau khi đã lưu vào danh sách (để đọc lại file).
function rosterReviewNew(list, onDone) {
  if (!list.length) return;
  const old = document.getElementById('rosterNew'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'rosterNew'; ov.className = 'pg-modal';
  const rows = list.map((e, i) => `<tr><td><input type="checkbox" class="rn-ck" data-i="${i}" checked></td><td>${emEsc(e.code)}</td><td><b>${emEsc(e.name)}</b></td><td style="font-size:11.5px;color:var(--text2)">${emEsc(e.dev || '')}</td><td style="text-align:center">${e.days}</td><td><select class="rn-d" data-i="${i}"><option value="">— chọn —</option>${EMP_DEPTS.map(d => `<option>${d}</option>`).join('')}</select></td></tr>`).join('');
  ov.innerHTML = `<div class="pg-mbox" style="max-width:860px"><div style="font-size:18px;font-weight:800;margin-bottom:4px">Phát hiện ${list.length} nhân viên HCM mới</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Các mã này có chấm công ở thiết bị "HCM …" nhưng chưa có trong danh sách (file không có cột Phòng ban). Chọn phòng ban để tính OT. Bỏ tích = <b>không tính OT</b> (không thuộc HCM) và sẽ không hỏi lại.</div>
    <div class="action-row"><span style="font-size:12px">Gán phòng ban cho các dòng đang tích:</span><select id="rnAll"><option value="">— chọn —</option>${EMP_DEPTS.map(d => `<option>${d}</option>`).join('')}</select><button class="btn" onclick="rosterNewApplyAll()">Gán</button></div>
    <div class="pg-tblw" style="max-height:50vh"><table class="pg-tbl"><thead><tr><th></th><th style="text-align:left">Mã NV</th><th style="text-align:left">Họ và tên</th><th style="text-align:left">Thiết bị chấm công</th><th>Số ngày</th><th>Phòng ban</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="action-row" style="justify-content:flex-end;margin-top:10px"><button class="btn" onclick="document.getElementById('rosterNew').remove()">Để sau</button><button class="btn btn-primary" onclick="rosterNewConfirm()">Lưu vào danh sách &amp; tính OT</button></div></div>`;
  document.body.appendChild(ov); window._rosterNewList = list; window._rosterNewDone = onDone;
}
function rosterNewApplyAll() { const v = document.getElementById('rnAll').value; if (!v) return; document.querySelectorAll('#rosterNew .rn-ck').forEach(ck => { if (ck.checked) document.querySelector(`#rosterNew .rn-d[data-i="${ck.dataset.i}"]`).value = v; }); }
function rosterNewConfirm() {
  const list = window._rosterNewList || []; let ok = 0, ex = 0, miss = 0;
  document.querySelectorAll('#rosterNew .rn-ck').forEach(ck => {
    const e = list[+ck.dataset.i], dept = document.querySelector(`#rosterNew .rn-d[data-i="${ck.dataset.i}"]`).value;
    if (ck.checked) { if (!dept) { miss++; return; } EMP_DB[e.code] = { code: e.code, name: e.name, dept, pos: '', email: '', status: 'ot', note: '', lock: true, src: 'upload', at: Date.now() }; ok++; }
    else { EMP_DB[e.code] = { code: e.code, name: e.name, dept: '', pos: '', email: '', status: 'excl', note: 'Không thuộc HCM / không tính OT', src: 'upload', at: Date.now() }; ex++; }
  });
  if (miss) { toast(`⚠️ Còn ${miss} nhân viên được tích nhưng chưa chọn phòng ban.`); return; }
  saveEmpDb(); document.getElementById('rosterNew').remove();
  toast(`✅ Đã thêm ${ok} nhân viên${ex ? `, loại ${ex} người khỏi OT` : ''}.`);
  if (typeof window._rosterNewDone === 'function') window._rosterNewDone();
  if (document.getElementById('pg-roster')?.classList.contains('show')) renderRoster();
}
