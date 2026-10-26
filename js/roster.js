// ============================================================
//  NHÂN VIÊN HCM — nằm trong mục "Nhân lực" (Manpower). Danh sách chuẩn: mã NV → họ tên, phòng ban, chức vụ, trạng thái,
//  dự án. CHỈ là danh sách phân bổ phòng ban / dự án (không hiển thị OT).
//  Nguồn dữ liệu:
//   • Dự án + phòng ban: lấy từ ACTION PLAN (PROJECTS_DB). Action Plan đổi → danh sách NV đổi theo (rosterSyncPlan).
//   • Thiết bị chấm công (file chấm công): NV chấm ở thiết bị "HCM AEON MT" → gợi ý dự án "HCM AEON MT" (thuộc phòng HCM-EC).
//     Không rõ dự án → để người dùng tự nhập tay.
//   • Các mục khác (OT theo dự án, So sánh, WLB dự án, Manpower, Đi trễ…) đọc phòng ban/dự án từ danh sách này
//     (rosterReconcileDB: đồng bộ phòng ban về dữ liệu OT/đi trễ/WLB đã nạp).
//  Mỗi NV 1 doc Firestore "emp_<mã>": { code, name, dept, pos, email, status:'ot'|'excl'|'left', note, lock, src, at,
//     devs:{<tên thiết bị>:<số lần chấm>}, devTo:<ngày cuối của file> }.  Doc đặc biệt "emp___devmap" = bảng gán thiết bị → dự án do người dùng chỉnh.
//    status 'ot' = tính OT · 'excl' = không tính OT (không thuộc HCM) · 'left' = đã nghỉ việc
// ============================================================
const EMP_KEY = 'ot_manager_emp_v1';
let EMP_DB = {};
function loadEmpDb() { try { const r = localStorage.getItem(EMP_KEY); if (r) EMP_DB = JSON.parse(r) || {}; } catch (e) {} }
function saveEmpDb() { try { localStorage.setItem(EMP_KEY, JSON.stringify(EMP_DB)); } catch (e) {} if (typeof cloudTouch === 'function') cloudTouch(); }
loadEmpDb();
const EMP_DEPTS = ['HCM-EC', 'S-AD', 'S-ED', 'S-QC', 'S-PU', 'S-PD', 'S-AZ'];
const EMP_ST = { ot: ['Tính OT', '#2E7D32'], excl: ['Không tính OT', '#8a8f98'], left: ['Đã nghỉ việc', '#C0392B'] };
const emEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const emJs = s => emEsc(s).replace(/\\/g, '\\\\');
let empQ = '', empFDept = 'all', empFSt = 'ot', empFProj = 'all', empGroup = 'dept', rsReconOpen = true, rsDevOpen = false, rsReconF = 'diff';
window.mpTab = window.mpTab || 'main';

const rosterList = () => Object.keys(EMP_DB).filter(k => k.slice(0, 2) !== '__').map(k => EMP_DB[k]).filter(Boolean);
const rosterDept = code => (EMP_DB[code] && EMP_DB[code].dept) || '';
const rosterStatus = code => (EMP_DB[code] && EMP_DB[code].status) || '';
function rosterProjOf(code) {
  const pm = (typeof currentProjectMap === 'function') ? currentProjectMap() : {};
  const k = pm[code]; if (!k) return '';
  const g = k.split('::')[0], p = k.split('::').slice(1).join('::');
  return g === 'HCM-EC' ? p : '';
}

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

// ── Thiết bị chấm công → dự án ───────────────────────────────
const devNorm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const devClean = s => String(s || '').replace(/\s+/g, ' ').trim();
const isHcmDev = s => /^HCM\b/i.test(devClean(s));
const devMapGet = () => (EMP_DB.__devmap && EMP_DB.__devmap.map) || {};
function devMapSet(dev, val) {
  const o = EMP_DB.__devmap || (EMP_DB.__devmap = { code: '__devmap', map: {} }); o.map = o.map || {};
  if (val) o.map[devNorm(dev)] = val; else delete o.map[devNorm(dev)];
  o.at = Date.now(); saveEmpDb();
}
// Loại thiết bị: proj (thiết bị của 1 dự án) · office (văn phòng/đào tạo — không phải dự án) · ignore · none (chưa khớp dự án nào)
function rosterDevKind(dev) {
  const n = devNorm(dev), ov = devMapGet()[n];
  if (ov === '__office__') return { kind: 'office' };
  if (ov === '__ignore__') return { kind: 'ignore' };
  const names = (typeof projectsInGroup === 'function') ? projectsInGroup('HCM-EC') : [];
  if (ov && names.includes(ov)) return { kind: 'proj', proj: ov };
  if (/OFFICE|TRAINING/.test(n)) return { kind: 'office' };
  if (/DANANG/.test(n) && names.includes('HCM-CS3')) return { kind: 'proj', proj: 'HCM-CS3' };   // Murata / Mabuchi Đà Nẵng đã gộp "HCM-CS3"
  const hit = names.find(p => devNorm(p) === n);                                                 // "HCM OLP SMZ" ↔ "HCM OLP_SMZ", "HCM ROK KO" ↔ "HCM ROKKO"
  return hit ? { kind: 'proj', proj: hit } : { kind: 'none' };
}
// Phân tích thiết bị 1 NV: dự án nhiều nhất (bỏ văn phòng), tỉ lệ so với tổng lượt chấm HCM
function rosterDevInfo(e) {
  const devs = (e && e.devs) || {}; let total = 0, office = 0, hn = 0; const per = {};
  Object.keys(devs).forEach(d => {
    const n = devs[d] || 0;
    if (!isHcmDev(d)) { hn += n; return; }
    total += n; const k = rosterDevKind(d);
    if (k.kind === 'office') office += n; else if (k.kind === 'proj') per[k.proj] = (per[k.proj] || 0) + n;
  });
  const ranked = Object.entries(per).sort((a, b) => b[1] - a[1]), best = ranked[0];
  const share = total && best ? best[1] / total : 0;
  return { proj: best ? best[0] : '', share, total, office, hn, clear: !!best && share >= 0.6, has: Object.keys(devs).length > 0,
    top: Object.entries(devs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => devClean(x[0]) + ' (' + x[1] + ')') };
}
const rsSugProjects = () => ((typeof projectsInGroup === 'function') ? projectsInGroup('HCM-EC') : []).filter(p => p !== UNASSIGNED_PROJ && !/^__/.test(p)).sort();

// ── Action Plan → danh sách (tự cập nhật khi Action Plan đổi) ──
function rosterSyncPlan() {
  if (!isManager() || typeof PROJECTS_DB === 'undefined' || !PROJECTS_DB) return false;
  const pm = currentProjectMap(); let ch = false;
  Object.keys(pm).forEach(code => {
    const g = pm[code].split('::')[0]; if (!EMP_DEPTS.includes(g)) return;
    let e = EMP_DB[code];
    if (!e) { EMP_DB[code] = { code, name: (typeof employeeNameByCode === 'function' ? employeeNameByCode(code) : code), dept: g, pos: '', email: '', status: 'ot', note: '', src: 'plan', at: Date.now() }; ch = true; return; }
    if (!e.name || e.name === code) { const nm = (typeof employeeNameByCode === 'function') ? employeeNameByCode(code) : ''; if (nm && nm !== code) { e.name = nm; ch = true; } }
    if (e.dept !== g) { e.dept = g; e.at = Date.now(); ch = true; }
    if (e.status !== 'ot') { e.status = 'ot'; e.at = Date.now(); ch = true; }
  });
  // Bị xoá khỏi Action Plan (nghỉ việc) → "Đã nghỉ việc"
  rosterList().forEach(e => {
    if (e.status !== 'ot' || pm[e.code]) return;
    const mv = PROJ_MOVES[e.code]; if (!mv) return;
    const last = Object.values(mv).sort((x, y) => (y.at || 0) - (x.at || 0))[0];
    if (last && last.del) { e.status = 'left'; e.at = Date.now(); ch = true; }
  });
  if (ch) saveEmpDb();
  return ch;
}
// Đưa NV vào đúng chỗ trong Action Plan theo phòng ban / dự án
function rosterPlaceInPlan(code, dept, proj, immediate) {
  if (typeof PROJECTS_DB === 'undefined' || !PROJECTS_DB) return false;
  const o = immediate ? { immediate: true } : undefined;
  if (dept === 'HCM-EC') {
    let t = proj || '';
    if (!t) { const cur = currentProjectMap()[code]; if (cur && cur.startsWith('HCM-EC::')) return false; if (!PROJECTS_DB['HCM-EC'] || !PROJECTS_DB['HCM-EC'][UNASSIGNED_PROJ]) addProject('HCM-EC', UNASSIGNED_PROJ); t = UNASSIGNED_PROJ; }
    if (!PROJECTS_DB['HCM-EC'] || !PROJECTS_DB['HCM-EC'][t]) return false;
    return moveEmployeeToProject(code, 'HCM-EC', t, o);
  }
  if (typeof DEPT_TARGETS !== 'undefined' && DEPT_TARGETS.includes(dept)) { ensureDeptEntries(); return moveEmployeeToProject(code, dept, deptEntryKey(dept), o); }
  return false;
}

// ── Danh sách → các mục khác: phòng ban trong dữ liệu OT / đi trễ / WLB luôn theo danh sách NV ──
function rosterReconcileDB() {
  const D = {}; rosterList().forEach(e => { if (e.status !== 'excl' && e.dept) D[e.code] = e.dept; });
  if (!Object.keys(D).length) return 0;
  let n = 0;
  const fix = (M, cf) => Object.keys(M || {}).forEach(mk => {
    const m = M[mk]; if (!m || !m.employees) return;
    Object.keys(m.employees).forEach(k => {
      const e = m.employees[k], d = D[e[cf]]; if (!d || e.dept === d) return;
      const old = e.dept; e.dept = d; n++;
      if (m.depts) {
        if (m.depts[old]) { m.depts[old] = m.depts[old].filter(x => x !== k); if (!m.depts[old].length) delete m.depts[old]; }
        (m.depts[d] = m.depts[d] || []); if (!m.depts[d].includes(k)) m.depts[d].push(k);
      }
    });
  });
  fix(DB, 'staffCode'); const nOt = n; fix(LATE_DB, 'code');
  let w = 0; try { Object.values((WLB_XLS && WLB_XLS.employees) || {}).forEach(e => { const d = D[e.code]; if (d && e.dept !== d) { e.dept = d; w++; } }); } catch (er) {}
  if (nOt) saveDB(false);
  if (n > nOt) { try { saveLateDB(); } catch (er) {} }
  if (w) { try { saveWlbXls(); } catch (er) {} }
  return n + w;
}
function rosterAfterData() { try { rosterSyncPlan(); } catch (e) { console.warn(e); } try { rosterReconcileDB(); } catch (e) { console.warn(e); } }

// ── Lấy từ dữ liệu OT / đi trễ / WLB đã có trong app (mã NV + phòng ban) ──
function rosterSeed(silent) {
  let n = 0;
  const add = (code, name, dept, pos) => { code = String(code || '').trim(); if (!code || !dept || EMP_DB[code]) return; if (!EMP_DEPTS.includes(dept)) return; EMP_DB[code] = { code, name: String(name || '').replace(/\s*\([^)]*\)\s*$/, ''), dept, pos: pos || '', email: '', status: 'ot', note: '', src: 'ot', at: Date.now() }; n++; };
  Object.keys(DB || {}).sort().forEach(mk => { const m = DB[mk]; Object.keys(m.employees || {}).forEach(k => { const e = m.employees[k]; add(e.staffCode, k, e.dept); }); });
  Object.keys(LATE_DB || {}).forEach(mk => { const m = LATE_DB[mk]; Object.keys(m.employees || {}).forEach(k => { const e = m.employees[k]; add(e.code, k, e.dept); }); });
  try { Object.keys((WLB_XLS && WLB_XLS.employees) || {}).forEach(k => { const e = WLB_XLS.employees[k]; add(e.code, e.name || k, e.dept, e.position); }); } catch (e) {}
  if (n) saveEmpDb(); if (!silent) toast(n ? `✅ Đã lấy ${n} nhân viên từ dữ liệu OT hiện có.` : 'Không có nhân viên mới để lấy từ dữ liệu hiện có.');
  return n;
}
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

// ── Đối chiếu Action Plan ↔ thiết bị chấm công ──
// st: ok (khớp) · diff (Action Plan khác thiết bị) · add (chưa có dự án, thiết bị rõ) · manual (chưa rõ → nhập tay) · hn (Action Plan HCM-EC nhưng chỉ chấm ở thiết bị HN) · weak (đã có dự án, thiết bị không đủ căn cứ)
function rosterRecon() {
  const pm = currentProjectMap(), rows = [];
  rosterList().forEach(e => {
    if (e.status !== 'ot' || !e.devs) return;
    const k = pm[e.code] || '', g = k.split('::')[0], p = k.split('::').slice(1).join('::');
    if (g && g !== 'HCM-EC') return;                                    // thuộc phòng khác → không đối chiếu theo dự án
    if (!g && e.dept && e.dept !== 'HCM-EC') return;
    const plan = g === 'HCM-EC' && p !== UNASSIGNED_PROJ ? p : '', info = rosterDevInfo(e);
    let st;
    if (plan) st = info.proj && info.proj === plan && info.clear ? 'ok' : info.clear && info.proj !== plan ? 'diff' : (!info.total && info.hn ? 'hn' : (info.proj === plan ? 'ok' : 'weak'));
    else st = info.clear ? 'add' : 'manual';
    rows.push({ e, st, plan, sug: info.proj, info });
  });
  return rows;
}
const RS_RECON = { ok: ['Khớp', '#2E7D32'], diff: ['Lệch dự án', '#C0392B'], add: ['Chưa có dự án — gợi ý', '#E8A33D'], manual: ['Chưa rõ — nhập tay', '#8a8f98'], hn: ['Chỉ chấm ở HN', '#7E57C2'], weak: ['Chưa đủ căn cứ', '#8a8f98'] };
function rosterReconApply(code) {
  if (!requireManager('đổi dự án')) return;
  const r = rosterRecon().find(x => x.e.code === code); if (!r || !r.sug) return;
  if (rosterPlaceInPlan(code, 'HCM-EC', r.sug, true)) { const e = EMP_DB[code]; if (e && e.dept !== 'HCM-EC') { e.dept = 'HCM-EC'; e.at = Date.now(); saveEmpDb(); } try { rebuildUI(); } catch (er) {} renderRoster(); toast(`✅ ${code} → ${r.sug}`); }
}
function rosterReconApplyAll(kind) {
  if (!requireManager('đổi dự án')) return;
  const rows = rosterRecon().filter(r => r.st === kind && r.sug); if (!rows.length) return;
  const msg = kind === 'diff' ? `Chuyển ${rows.length} nhân viên sang dự án theo thiết bị chấm công? (Action Plan sẽ đổi — có hiệu lực từ chu kỳ OT hiện tại, tháng cũ giữ nguyên.)` : `Đưa ${rows.length} nhân viên vào dự án theo thiết bị chấm công?`;
  if (!confirm(msg)) return;
  let n = 0; rows.forEach(r => { if (rosterPlaceInPlan(r.e.code, 'HCM-EC', r.sug, true)) { n++; if (r.e.dept !== 'HCM-EC') { r.e.dept = 'HCM-EC'; r.e.at = Date.now(); } } });
  saveEmpDb(); try { rebuildUI(); } catch (er) {} renderRoster(); toast(`✅ Đã cập nhật ${n} nhân viên.`);
}

// ── Trang "Nhân viên HCM" (tab trong Nhân lực) ──
function mpSetTab(t) {
  if (t === 'roster' && !isManager()) { toast('🔒 Danh sách nhân viên HCM chỉ dành cho Quản lý và Admin.'); t = 'main'; }
  window.mpTab = t;
  const a = document.getElementById('mpMain'), b = document.getElementById('mpRoster'); if (a) a.style.display = t === 'main' ? '' : 'none'; if (b) b.style.display = t === 'roster' ? '' : 'none';
  document.querySelectorAll('#mpTabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t));
  if (t === 'roster') renderRoster(); else if (typeof renderManpower === 'function') renderManpower();
}
function rsTr(e, edit, pm, recon) {
  const pr = rosterProjOf(e.code), st = EMP_ST[e.status] || EMP_ST.ot, info = rosterDevInfo(e), rc = recon[e.code];
  const warn = rc && rc.st === 'diff' ? `<span title="Action Plan: ${emEsc(rc.plan)} — thiết bị chấm công: ${emEsc(rc.sug)}" style="color:#C0392B;cursor:help"> ⚠</span>` : rc && rc.st === 'add' ? `<span title="Gợi ý dự án theo thiết bị: ${emEsc(rc.sug)}" style="color:#E8A33D;cursor:help"> ●</span>` : '';
  const projCell = e.dept && e.dept !== 'HCM-EC' ? `<span style="color:var(--text3);font-size:12px">${emEsc(e.dept)}</span>` : pr ? emEsc(pr) : (pm[e.code] ? '<span style="color:#E8A33D">Chưa gán dự án</span>' : '<span style="color:var(--text3)">—</span>');
  return `<tr${e.status !== 'ot' ? ' style="opacity:.6"' : ''}><td style="white-space:nowrap">${emEsc(e.code)}</td><td><b>${emEsc(e.name)}</b>${e.note ? `<div style="font-size:10.5px;color:var(--text2)">${emEsc(e.note)}</div>` : ''}</td>
    <td>${e.dept ? `<span class="rs-dept">${emEsc(e.dept)}</span>` : '<span style="color:#C0392B;font-size:12px">chưa có</span>'}</td><td style="font-size:12px;color:var(--text2)">${emEsc(e.pos || '')}</td>
    <td>${projCell}${warn}</td>
    <td style="font-size:11.5px;color:var(--text2)">${info.has ? emEsc(info.top.join(', ')) : '<span style="color:var(--text3)">—</span>'}</td>
    <td><span class="pg-pill" style="background:${st[1]}">${st[0]}</span></td>${edit ? `<td style="white-space:nowrap"><button class="pg-ib" onclick="rosterEdit('${emJs(e.code).replace(/'/g, '&#39;')}')" title="Sửa">✎</button></td>` : ''}</tr>`;
}
function renderRoster() {
  const box = document.getElementById('rosterBody'); if (!box) return;
  if (isManager()) rosterSyncPlan();
  if (!rosterList().length && Object.keys(DB || {}).length && isManager()) { rosterSeed(true); }
  const edit = isManager(), q = empQ.trim().toLowerCase(), pm = currentProjectMap();
  const all = rosterList(), projs = [...new Set(all.map(e => rosterProjOf(e.code)).filter(Boolean))].sort();
  const recon = {}; const reconRows = rosterRecon(); reconRows.forEach(r => { recon[r.e.code] = r; });
  const rows = all.filter(e => (empFSt === 'all' || e.status === empFSt) && (empFDept === 'all' || e.dept === empFDept) && (empFProj === 'all' || (empFProj === '__none__' ? (e.dept === 'HCM-EC' && !rosterProjOf(e.code)) : rosterProjOf(e.code) === empFProj)) &&
    (!q || (e.code + ' ' + e.name + ' ' + (e.pos || '') + ' ' + (e.email || '')).toLowerCase().includes(q)));
  const cntDept = d => all.filter(e => e.status === 'ot' && e.dept === d).length, noDept = all.filter(e => e.status === 'ot' && !e.dept).length;
  const noProj = all.filter(e => e.status === 'ot' && e.dept === 'HCM-EC' && !rosterProjOf(e.code)).length;
  const keyOf = e => empGroup === 'dept' ? (e.dept || '(Chưa có phòng ban)') : empGroup === 'proj' ? (e.dept && e.dept !== 'HCM-EC' ? e.dept + ' (không theo dự án)' : (rosterProjOf(e.code) || '(Chưa gán dự án)')) : '';
  rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || a.name.localeCompare(b.name, 'vi'));
  const ncol = edit ? 8 : 7; let body = '', last = null, cnt = 0, hdrIdx = -1;
  const hdr = k => `<tr class="rs-grp"><td colspan="${ncol}"><b>${emEsc(k)}</b> <span class="rs-n">0</span></td></tr>`;
  const parts = []; rows.forEach(e => { const k = keyOf(e); if (empGroup !== 'none' && k !== last) { parts.push({ h: k, rows: [] }); last = k; } if (!parts.length) parts.push({ h: null, rows: [] }); parts[parts.length - 1].rows.push(rsTr(e, edit, pm, recon)); });
  parts.forEach(p => { if (p.h !== null) body += `<tr class="rs-grp"><td colspan="${ncol}"><b>${emEsc(p.h)}</b> <span>${p.rows.length} NV</span></td></tr>`; body += p.rows.join(''); });
  // Đối chiếu
  const cnt2 = {}; reconRows.forEach(r => { cnt2[r.st] = (cnt2[r.st] || 0) + 1; });
  const hasDev = all.some(e => e.devs);
  const reconShow = reconRows.filter(r => rsReconF === 'all' ? true : r.st === rsReconF);
  const reconBox = !edit ? '' : `<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="rsReconOpen=!rsReconOpen;renderRoster()"><span>🔎 Đối chiếu Action Plan (HCM-EC) ↔ thiết bị chấm công</span><span style="font-size:12px;color:var(--text2)">${rsReconOpen ? '▾ thu gọn' : '▸ mở'}</span></div>
    ${!rsReconOpen ? '' : !hasDev ? `<div style="font-size:12.5px;color:var(--text2)">Chưa có dữ liệu thiết bị. Hãy <b>upload file chấm công</b> (Cài đặt → Upload) — app sẽ ghi lại mỗi NV chấm công ở thiết bị nào (VD "HCM AEON MT") rồi đối chiếu với Action Plan tại đây.</div>` : `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${['diff', 'add', 'manual', 'hn', 'weak', 'ok', 'all'].map(k => `<button class="btn${rsReconF === k ? ' btn-primary' : ''}" onclick="rsReconF='${k}';renderRoster()">${k === 'all' ? 'Tất cả' : RS_RECON[k][0]} (${k === 'all' ? reconRows.length : cnt2[k] || 0})</button>`).join('')}</div>
    <div style="font-size:11.5px;color:var(--text2);margin-bottom:8px">Quy tắc: NV chấm ở thiết bị "HCM &lt;tên dự án&gt;" ≥ 60% lượt chấm → thuộc dự án đó (trong phòng HCM-EC). Thiết bị Văn phòng/Đào tạo không phải dự án. Chưa rõ → bạn tự nhập tay. <b>Không tự đổi Action Plan</b> — bạn bấm áp dụng từng người hoặc cả nhóm.</div>
    ${rsReconF === 'diff' && cnt2.diff ? `<button class="btn" style="margin-bottom:8px" onclick="rosterReconApplyAll('diff')">Chuyển cả ${cnt2.diff} NV theo thiết bị</button>` : ''}${rsReconF === 'add' && cnt2.add ? `<button class="btn btn-primary" style="margin-bottom:8px" onclick="rosterReconApplyAll('add')">Đưa cả ${cnt2.add} NV vào dự án theo thiết bị</button>` : ''}
    <div class="pg-tblw" style="max-height:340px"><table class="pg-tbl"><thead><tr><th style="text-align:left">Mã NV</th><th style="text-align:left">Họ và tên</th><th style="text-align:left">Action Plan</th><th style="text-align:left">Theo thiết bị</th><th style="text-align:left">Thiết bị chấm công</th><th>Kết quả</th><th></th></tr></thead><tbody>${reconShow.length ? reconShow.slice(0, 300).map(r => `<tr><td>${emEsc(r.e.code)}</td><td><b>${emEsc(r.e.name)}</b></td><td>${r.plan ? emEsc(r.plan) : '<span style="color:var(--text3)">chưa gán</span>'}</td><td>${r.sug ? emEsc(r.sug) + ` <span style="font-size:10.5px;color:var(--text3)">${Math.round(r.info.share * 100)}%</span>` : '—'}</td><td style="font-size:11.5px;color:var(--text2)">${emEsc(r.info.top.join(', '))}</td><td><span class="pg-pill" style="background:${RS_RECON[r.st][1]}">${RS_RECON[r.st][0]}</span></td><td>${(r.st === 'diff' || r.st === 'add') && r.sug ? `<button class="btn" onclick="rosterReconApply('${emJs(r.e.code).replace(/'/g, '&#39;')}')">Áp dụng</button>` : `<button class="pg-ib" onclick="rosterEdit('${emJs(r.e.code).replace(/'/g, '&#39;')}')" title="Nhập tay">✎</button>`}</td></tr>`).join('') + (reconShow.length > 300 ? `<tr><td colspan="7" style="text-align:center;color:var(--text2)">… còn ${reconShow.length - 300} dòng, hãy lọc theo kết quả.</td></tr>` : '') : `<tr><td colspan="7" style="text-align:center;padding:14px;color:var(--text2)">Không có dòng nào.</td></tr>`}</tbody></table></div>`}</div>`;
  box.innerHTML = `<div class="mp-kpi">
      <div class="mk"><b>${all.filter(e => e.status === 'ot').length}</b><span>NV đang tính OT</span></div>
      ${EMP_DEPTS.map(d => `<div class="mk" style="cursor:pointer" onclick="empFDept='${d}';empFSt='ot';renderRoster()"><b>${cntDept(d)}</b><span>${d}</span></div>`).join('')}
      <div class="mk" style="cursor:pointer" onclick="empFDept='HCM-EC';empFProj='__none__';empFSt='ot';renderRoster()"><b style="color:${noProj ? '#E8A33D' : 'inherit'}">${noProj}</b><span>HCM-EC chưa gán dự án</span></div>
      ${noDept ? `<div class="mk"><b style="color:#C0392B">${noDept}</b><span>Chưa có phòng ban</span></div>` : ''}
      <div class="mk"><b>${all.filter(e => e.status === 'left').length}</b><span>Đã nghỉ việc</span></div></div>
    ${reconBox}
    <div class="card"><div class="action-row">
      ${edit ? `<button class="btn btn-primary" onclick="rosterEdit('')">＋ Thêm nhân viên</button><label class="btn" style="cursor:pointer">⬆ Nhập từ file<input type="file" accept=".xlsx,.xls" style="display:none" onchange="rosterImportFile(this)"></label><button class="btn" onclick="rosterSeed()" title="Lấy mã NV + phòng ban từ dữ liệu OT/đi trễ/WLB đã nạp">↻ Lấy từ dữ liệu OT</button>` : ''}
      <button class="btn" onclick="rosterExport()">⬇ Excel</button>
      <input type="text" placeholder="Tìm mã, tên, chức vụ…" value="${emEsc(empQ)}" oninput="empQ=this.value;rosterRefocus(this)" style="width:200px">
      <select onchange="empFDept=this.value;renderRoster()"><option value="all">Tất cả phòng ban</option>${EMP_DEPTS.map(d => `<option${empFDept === d ? ' selected' : ''}>${d}</option>`).join('')}</select>
      <select onchange="empFProj=this.value;renderRoster()"><option value="all">Tất cả dự án</option><option value="__none__"${empFProj === '__none__' ? ' selected' : ''}>(HCM-EC chưa gán dự án)</option>${projs.map(p => `<option value="${emEsc(p)}"${empFProj === p ? ' selected' : ''}>${emEsc(p)}</option>`).join('')}</select>
      <select onchange="empFSt=this.value;renderRoster()"><option value="all">Mọi trạng thái</option>${Object.keys(EMP_ST).map(k => `<option value="${k}"${empFSt === k ? ' selected' : ''}>${EMP_ST[k][0]}</option>`).join('')}</select>
      <select onchange="empGroup=this.value;renderRoster()"><option value="dept"${empGroup === 'dept' ? ' selected' : ''}>Nhóm theo phòng ban</option><option value="proj"${empGroup === 'proj' ? ' selected' : ''}>Nhóm theo dự án</option><option value="none"${empGroup === 'none' ? ' selected' : ''}>Không nhóm</option></select>
      <span style="font-size:12px;color:var(--text2)">${rows.length} NV${(empFDept !== 'all' || empFProj !== 'all' || empFSt !== 'ot' || q) ? ' (đang lọc) ' : ''}<a href="javascript:void 0" onclick="empFDept='all';empFProj='all';empFSt='ot';empQ='';renderRoster()">đặt lại bộ lọc</a></span></div>
    <div class="pg-tblw"><table class="pg-tbl"><thead><tr><th style="text-align:left">Mã NV</th><th style="text-align:left">Họ và tên</th><th style="text-align:left">Phòng ban</th><th style="text-align:left">Chức vụ</th><th style="text-align:left">Dự án (Action Plan)</th><th style="text-align:left">Thiết bị chấm công</th><th>Trạng thái</th>${edit ? '<th></th>' : ''}</tr></thead>
      <tbody>${body || `<tr><td colspan="${ncol}" style="text-align:center;padding:24px;color:var(--text2)">Chưa có nhân viên. Bấm <b>↻ Lấy từ dữ liệu OT</b>, <b>⬆ Nhập từ file</b> hoặc upload file chấm công — app sẽ hỏi các NV HCM mới.</td></tr>`}</tbody></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">Dự án và phòng ban đồng bộ 2 chiều với <b>Action Plan</b>; các mục OT theo dự án, So sánh, WLB dự án, Manpower, Đi trễ… đều đọc từ danh sách này. ● = gợi ý dự án theo thiết bị chấm công · ⚠ = Action Plan khác thiết bị chấm công.</div></div>
    ${edit ? rsDevCard() : ''}`;
}
// Bảng gán thiết bị → dự án
function rsDevList() {
  const m = {};
  rosterList().forEach(e => Object.keys(e.devs || {}).forEach(d => { if (!isHcmDev(d)) return; const c = devClean(d), k = devNorm(c); (m[k] = m[k] || { name: c, n: 0, emp: 0 }); m[k].n += e.devs[d]; m[k].emp++; }));
  return Object.values(m).sort((a, b) => b.n - a.n);
}
function rsDevCard() {
  const list = rsDevList(); if (!list.length) return '';
  const projs = rsSugProjects(), ov = devMapGet();
  window._rsDevs = list;
  const row = (d, i) => { const k = rosterDevKind(d.name), o = ov[devNorm(d.name)] || '';
    const res = k.kind === 'proj' ? `→ <b>${emEsc(k.proj)}</b>` : k.kind === 'office' ? '<span style="color:var(--text2)">Văn phòng (không phải dự án)</span>' : k.kind === 'ignore' ? '<span style="color:var(--text3)">Bỏ qua</span>' : '<span style="color:#E8A33D">Chưa khớp dự án nào</span>';
    return `<tr><td><b>${emEsc(d.name)}</b></td><td style="text-align:right">${d.emp}</td><td style="text-align:right">${d.n}</td><td>${res}</td><td><select onchange="rsDevSet(${i},this.value)"><option value="">Tự động</option><option value="__office__"${o === '__office__' ? ' selected' : ''}>Văn phòng (không gán dự án)</option><option value="__ignore__"${o === '__ignore__' ? ' selected' : ''}>Bỏ qua</option>${projs.map(p => `<option value="${emEsc(p)}"${o === p ? ' selected' : ''}>${emEsc(p)}</option>`).join('')}<option value="__new__">＋ Tạo dự án mới "${emEsc(d.name.toUpperCase())}"</option></select></td></tr>`; };
  return `<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;cursor:pointer" onclick="rsDevOpen=!rsDevOpen;renderRoster()"><span>🛰️ Thiết bị chấm công ↔ dự án (${list.length} thiết bị HCM)</span><span style="font-size:12px;color:var(--text2)">${rsDevOpen ? '▾ thu gọn' : '▸ mở'}</span></div>
    ${rsDevOpen ? `<div style="font-size:11.5px;color:var(--text2);margin-bottom:8px">Tự khớp theo tên (VD thiết bị "HCM AEON MT" → dự án "HCM AEON MT"; Murata/Mabuchi Đà Nẵng → HCM-CS3). Thiết bị chưa khớp (VD dự án mới) → chọn dự án hoặc tạo mới.</div><div class="pg-tblw" style="max-height:340px"><table class="pg-tbl"><thead><tr><th style="text-align:left">Thiết bị</th><th>Số NV</th><th>Lượt chấm</th><th style="text-align:left">Hiện đang gán</th><th style="text-align:left">Chỉnh</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>` : ''}</div>`;
}
function rsDevSet(i, val) {
  if (!requireManager('đổi bảng thiết bị')) return; const d = (window._rsDevs || [])[i]; if (!d) return;
  if (val === '__new__') { const nm = d.name.toUpperCase(); if (!PROJECTS_DB['HCM-EC'][nm]) addProject('HCM-EC', nm); val = nm; }
  devMapSet(d.name, val); renderRoster(); toast('✅ Đã lưu cách gán thiết bị.');
}
function rosterRefocus(inp) { const pos = inp.selectionStart; renderRoster(); const ni = document.querySelector('#rosterBody input[type=text]'); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} } }

// ── Thêm / sửa ──
function rosterEdit(code) {
  if (!requireManager('sửa danh sách nhân viên')) return;
  const e = EMP_DB[code] || { code: '', name: '', dept: '', pos: '', email: '', status: 'ot', note: '' }, isNew = !EMP_DB[code];
  const curProj = rosterProjOf(e.code), info = rosterDevInfo(e), projs = rsSugProjects();
  const ov = document.createElement('div'); ov.id = 'rosterModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:540px"><div style="font-size:18px;font-weight:800;margin-bottom:8px">${isNew ? 'Thêm nhân viên HCM' : 'Sửa nhân viên'}</div>
    <div class="pg-g2"><label>Mã nhân viên<input id="rsCode" value="${emEsc(e.code)}" ${isNew ? '' : 'disabled'}></label><label>Họ và tên<input id="rsName" value="${emEsc(e.name)}"></label>
    <label>Phòng ban<select id="rsDept" onchange="document.getElementById('rsProjW').style.display=this.value==='HCM-EC'?'':'none'"><option value="">— chọn —</option>${EMP_DEPTS.map(d => `<option${e.dept === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label><label>Chức vụ<input id="rsPos" value="${emEsc(e.pos || '')}"></label>
    <label id="rsProjW" style="${e.dept === 'HCM-EC' || isNew ? '' : 'display:none'}">Dự án (trong HCM-EC)<select id="rsProj"><option value="">— chưa gán —</option>${projs.map(p => `<option${curProj === p ? ' selected' : ''}>${emEsc(p)}</option>`).join('')}</select></label>
    <label>Email<input id="rsMail" value="${emEsc(e.email || '')}"></label><label>Trạng thái<select id="rsSt">${Object.keys(EMP_ST).map(k => `<option value="${k}"${e.status === k ? ' selected' : ''}>${EMP_ST[k][0]}</option>`).join('')}</select></label></div>
    <label>Ghi chú<input id="rsNote" value="${emEsc(e.note || '')}"></label>
    ${info.has ? `<div style="font-size:12px;margin:8px 0;padding:8px 10px;background:var(--bg2,#f3f6fa);border-radius:8px">Thiết bị chấm công: <b>${emEsc(info.top.join(', '))}</b>${info.proj ? ` → gợi ý dự án <b>${emEsc(info.proj)}</b>${info.clear ? '' : ' (chưa chắc)'} <a href="javascript:void 0" onclick="document.getElementById('rsDept').value='HCM-EC';document.getElementById('rsProjW').style.display='';document.getElementById('rsProj').value='${emJs(info.proj).replace(/'/g, '&#39;')}'">dùng gợi ý</a>` : ''}</div>` : ''}
    <div style="font-size:11px;color:var(--text3);margin:8px 0">Dự án và phòng ban lưu thẳng vào <b>Action Plan</b> (đổi dự án có hiệu lực từ chu kỳ OT sau, giống Action Plan). Phòng ban chọn tay sẽ được khoá — file upload không ghi đè. "Đã nghỉ việc" / "Không tính OT" sẽ gỡ NV khỏi Action Plan.</div>
    <div class="action-row" style="justify-content:space-between;margin:0">${isNew ? '<span></span>' : `<button class="btn" style="color:#C0392B" onclick="rosterDelete('${emJs(e.code).replace(/'/g, '&#39;')}')">Xoá khỏi danh sách</button>`}<span style="display:flex;gap:8px"><button class="btn" onclick="rosterClose()">Huỷ</button><button class="btn btn-primary" onclick="rosterSave(${isNew})">Lưu</button></span></div></div>`;
  document.body.appendChild(ov);
}
function rosterClose() { const m = document.getElementById('rosterModal'); if (m) m.remove(); }
function rosterSave(isNew) {
  const g = id => document.getElementById(id), code = (g('rsCode').value || '').trim(), name = (g('rsName').value || '').trim();
  if (!code || !name) { toast('⚠️ Nhập mã nhân viên và họ tên.'); return; }
  if (isNew && EMP_DB[code]) { toast('⚠️ Mã nhân viên này đã có trong danh sách.'); return; }
  const dept = g('rsDept').value, st = g('rsSt').value, proj = dept === 'HCM-EC' ? g('rsProj').value : '';
  if (st === 'ot' && !dept) { toast('⚠️ Chọn phòng ban cho NV tính OT.'); return; }
  const old = EMP_DB[code], e = old || { code, src: 'manual' };
  const deptChanged = old && old.dept !== dept, projChanged = proj !== rosterProjOf(code);
  Object.assign(e, { name, dept, pos: (g('rsPos').value || '').trim(), email: (g('rsMail').value || '').trim(), status: st, note: (g('rsNote').value || '').trim(), at: Date.now() });
  if (dept && (isNew || deptChanged)) e.lock = true;
  EMP_DB[code] = e;
  let msg = 'Đã lưu.';
  const inPlan = !!currentProjectMap()[code];
  if (st !== 'ot') {
    if (inPlan) deleteEmployeeFromProjects(code);
    if (st === 'excl' && confirm(`"Không tính OT": xoá dữ liệu OT/đi trễ của ${name} (${code}) khỏi các tháng đã nạp và bỏ qua ở các lần upload sau?`)) { const n = rosterPurge(code); msg = `Đã lưu · xoá ${n} bản ghi OT của NV này.`; }
  } else {
    if (dept && (isNew || deptChanged)) { const n = rosterApplyDept(code, dept); if (n) msg = `Đã lưu · cập nhật phòng ban cho ${n} bản ghi OT đã nạp.`; }
    if (dept && (isNew || deptChanged || projChanged || !inPlan)) rosterPlaceInPlan(code, dept, proj, false);
  }
  saveEmpDb(); rosterClose(); try { rebuildUI(); } catch (er) {} renderRoster(); toast('✅ ' + msg);
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
      const cC = ix(/mã (nv|nhân viên)|staff code/), cN = ix(/họ/), cD = ix(/phòng ban|dept|department/), cP = ix(/chức vụ|position/), cE = ix(/email/), cS = ix(/trạng thái/), cNo = ix(/ghi chú/), cPr = ix(/dự án/);
      let add = 0, upd = 0, skip = 0, pj = 0; const seen = new Set();
      aoa.slice(h + 1).forEach(r => {
        const code = String(r[cC] || '').trim(); if (!code || seen.has(code)) return; seen.add(code);
        const name = String(r[cN] || '').trim(); if (!name) return;
        const dept = cD >= 0 ? mapNewDept(r[cD]) : null;
        if (cD >= 0 && !dept) { skip++; return; }   // phòng không thuộc HCM (Tổng vụ, Kế toán…) → bỏ
        const had = !!EMP_DB[code];
        const ch = rosterUpsert(code, { name, dept: dept || '', pos: cP >= 0 ? String(r[cP] || '').trim() : '', email: cE >= 0 ? String(r[cE] || '').trim() : '', src: 'import' });
        if (cS >= 0) { const s = String(r[cS] || ''); const st = /không tính/i.test(s) ? 'excl' : /nghỉ/i.test(s) ? 'left' : /tính/i.test(s) ? 'ot' : ''; if (st && EMP_DB[code].status !== st) { EMP_DB[code].status = st; EMP_DB[code].at = Date.now(); } }
        if (cNo >= 0 && r[cNo]) EMP_DB[code].note = String(r[cNo]).trim();
        if (cPr >= 0 && r[cPr] && dept === 'HCM-EC') { const pn = String(r[cPr]).trim(); if (PROJECTS_DB['HCM-EC'] && PROJECTS_DB['HCM-EC'][pn] && rosterProjOf(code) !== pn) { rosterPlaceInPlan(code, 'HCM-EC', pn, true); pj++; } }
        if (!had) add++; else if (ch) upd++;
      });
      saveEmpDb(); try { rebuildUI(); } catch (er) {} renderRoster(); toast(`✅ Nhập xong: thêm ${add}, cập nhật ${upd}${pj ? `, gán dự án ${pj}` : ''}${skip ? `, bỏ ${skip} NV phòng không thuộc HCM` : ''}.`);
    } catch (e) { toast('⚠️ Không đọc được file: ' + (e.message || e)); }
  };
  rd.readAsArrayBuffer(f);
}
function rosterExport() {
  if (typeof XLSX === 'undefined') return;
  const rows = [['Mã NV', 'Họ và tên', 'Phòng ban', 'Chức vụ', 'Email', 'Dự án (Action Plan)', 'Thiết bị chấm công', 'Trạng thái', 'Ghi chú']];
  rosterList().sort((a, b) => (a.dept || '').localeCompare(b.dept || '') || a.name.localeCompare(b.name, 'vi')).forEach(e => rows.push([e.code, e.name, e.dept, e.pos || '', e.email || '', rosterProjOf(e.code), rosterDevInfo(e).top.join(', '), EMP_ST[e.status][0], e.note || '']));
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [10, 28, 10, 24, 28, 24, 30, 14, 24].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Nhân viên HCM'); XLSX.writeFile(wb, `Nhan-vien-HCM-${(typeof puToday === 'function' ? puToday() : '')}.xlsx`);
}

// ── Hộp "Nhân viên mới" khi upload file chấm công ──
// list: [{code,name,days,dev,devs}]; onDone(): gọi sau khi đã lưu vào danh sách (để đọc lại file).
function rosterReviewNew(list, onDone) {
  if (!list.length) return;
  const old = document.getElementById('rosterNew'); if (old) old.remove();
  const ov = document.createElement('div'); ov.id = 'rosterNew'; ov.className = 'pg-modal';
  const projs = rsSugProjects();
  list.forEach(e => { e._info = rosterDevInfo({ devs: e.devs || {} }); });
  const rows = list.map((e, i) => { const sug = e._info.clear ? e._info.proj : '';
    return `<tr><td><input type="checkbox" class="rn-ck" data-i="${i}" checked></td><td>${emEsc(e.code)}</td><td><b>${emEsc(e.name)}</b></td><td style="font-size:11.5px;color:var(--text2)">${emEsc(e.dev || '')}</td><td style="text-align:center">${e.days}</td>
    <td><select class="rn-d" data-i="${i}"><option value="">— chọn —</option>${EMP_DEPTS.map(d => `<option${sug && d === 'HCM-EC' ? ' selected' : ''}>${d}</option>`).join('')}</select></td>
    <td><select class="rn-p" data-i="${i}" onchange="if(this.value)document.querySelector('#rosterNew .rn-d[data-i=&quot;${i}&quot;]').value='HCM-EC'"><option value="">— nhập tay sau —</option>${projs.map(p => `<option${p === sug ? ' selected' : ''}>${emEsc(p)}</option>`).join('')}</select></td></tr>`; }).join('');
  ov.innerHTML = `<div class="pg-mbox" style="max-width:980px"><div style="font-size:18px;font-weight:800;margin-bottom:4px">Phát hiện ${list.length} nhân viên HCM mới</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Các mã này chấm công ở thiết bị "HCM …" nhưng chưa có trong danh sách. <b>Dự án được gợi ý theo thiết bị chấm công</b> (VD thiết bị "HCM AEON MT" → dự án HCM AEON MT, phòng HCM-EC); không rõ dự án thì để trống, bạn nhập tay sau. Bỏ tích = <b>không tính OT</b> (không thuộc HCM) và sẽ không hỏi lại.</div>
    <div class="action-row"><span style="font-size:12px">Gán phòng ban cho các dòng đang tích:</span><select id="rnAll"><option value="">— chọn —</option>${EMP_DEPTS.map(d => `<option>${d}</option>`).join('')}</select><button class="btn" onclick="rosterNewApplyAll()">Gán</button></div>
    <div class="pg-tblw" style="max-height:50vh"><table class="pg-tbl"><thead><tr><th></th><th style="text-align:left">Mã NV</th><th style="text-align:left">Họ và tên</th><th style="text-align:left">Thiết bị chấm công</th><th>Số ngày</th><th>Phòng ban</th><th>Dự án (HCM-EC)</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="action-row" style="justify-content:flex-end;margin-top:10px"><button class="btn" onclick="document.getElementById('rosterNew').remove()">Để sau</button><button class="btn btn-primary" onclick="rosterNewConfirm()">Lưu vào danh sách &amp; tính OT</button></div></div>`;
  document.body.appendChild(ov); window._rosterNewList = list; window._rosterNewDone = onDone;
}
function rosterNewApplyAll() { const v = document.getElementById('rnAll').value; if (!v) return; document.querySelectorAll('#rosterNew .rn-ck').forEach(ck => { if (ck.checked) document.querySelector(`#rosterNew .rn-d[data-i="${ck.dataset.i}"]`).value = v; }); }
function rosterNewConfirm() {
  const list = window._rosterNewList || []; let ok = 0, ex = 0, miss = 0, pj = 0; const place = [];
  document.querySelectorAll('#rosterNew .rn-ck').forEach(ck => {
    const e = list[+ck.dataset.i], dept = document.querySelector(`#rosterNew .rn-d[data-i="${ck.dataset.i}"]`).value, proj = document.querySelector(`#rosterNew .rn-p[data-i="${ck.dataset.i}"]`).value;
    if (ck.checked) { if (!dept) { miss++; return; } EMP_DB[e.code] = { code: e.code, name: e.name, dept, pos: '', email: '', status: 'ot', note: '', lock: true, src: 'upload', at: Date.now(), devs: e.devs || {}, devTo: e.devTo || '' }; ok++; place.push([e.code, dept, dept === 'HCM-EC' ? proj : '']); }
    else { EMP_DB[e.code] = { code: e.code, name: e.name, dept: '', pos: '', email: '', status: 'excl', note: 'Không thuộc HCM / không tính OT', src: 'upload', at: Date.now() }; ex++; }
  });
  if (miss) { toast(`⚠️ Còn ${miss} nhân viên được tích nhưng chưa chọn phòng ban.`); return; }
  place.forEach(p => { if (rosterPlaceInPlan(p[0], p[1], p[2], true) && p[2]) pj++; });
  saveEmpDb(); document.getElementById('rosterNew').remove();
  toast(`✅ Đã thêm ${ok} nhân viên${pj ? `, gán dự án cho ${pj} người` : ''}${ex ? `, loại ${ex} người khỏi OT` : ''}.`);
  if (typeof window._rosterNewDone === 'function') window._rosterNewDone();
  if (window.mpTab === 'roster') renderRoster();
}
// Ghi lại thiết bị chấm công của từng NV sau khi đọc file (gọi từ bộ đọc file). devAll: {mã:{tên thiết bị:số lần}}, maxIso: ngày cuối của file
function rosterRecordDevices(devAll, maxIso) {
  let n = 0;
  Object.keys(devAll || {}).forEach(code => {
    const e = EMP_DB[code]; if (!e || e.status === 'excl') return;
    if (e.devTo && maxIso && e.devTo > maxIso) return;       // file cũ hơn dữ liệu đang có → không ghi đè
    e.devs = devAll[code]; e.devTo = maxIso || e.devTo || ''; n++;
  });
  return n;
}
