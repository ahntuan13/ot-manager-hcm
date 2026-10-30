// ============================================================
//  QUẢN LÝ DỰ ÁN (PM) — danh bạ PM nằm trong "Nhân lực". PM vẫn là nhân viên HCM (EMP_DB), chỉ thêm 1 trường:
//    EMP_DB[mã].pm = { team: ['CS','PB'], projs: [ { k:'<nhóm>::<dự án>', d:'E'|'M'|'' } ] }
//  · team  = nhóm của PM (CS / Project Base / cả hai) — do Quản lý chọn (Boss phân).
//  · projs = các dự án (Action Plan) PM phụ trách; d = mảng Điện (E) / Cơ khí (M) / '' (cả dự án). 1 dự án có thể nhiều PM.
//  Đây là NGUỒN DUY NHẤT: Action Plan, PU Delivery, Tiến độ dự án, OT theo PM… đều đọc từ đây → sửa 1 chỗ, mọi nơi cập nhật.
//  Lưu trong doc Firestore emp_<mã> (cùng danh sách nhân viên) nên tự đồng bộ giữa các máy.
// ============================================================
const PM_TEAMS = { CS: 'CS', PB: 'Project Base' };
const PM_DISC = { '': 'Cả dự án', E: 'E (Điện)', M: 'M (Cơ khí)' };
let pmFTeam = 'all', pmQ = '';

const pmList = () => rosterList().filter(e => e.pm);
const pmIsPm = code => !!(EMP_DB[code] && EMP_DB[code].pm);
const pmTeamsOf = e => ((e && e.pm && e.pm.team) || []).filter(t => PM_TEAMS[t]);
const pmTeamLabel = e => { const t = pmTeamsOf(e); return t.length ? t.map(x => PM_TEAMS[x]).join(' + ') : 'Chưa phân nhóm'; };
const pmProjKey = (g, p) => g + '::' + p;
const pmSplitKey = k => { const i = k.indexOf('::'); return { g: k.slice(0, i), p: k.slice(i + 2) }; };
const pmProjExists = k => { const s = pmSplitKey(k); return !!(PROJECTS_DB && PROJECTS_DB[s.g] && PROJECTS_DB[s.g][s.p]); };
function pmAllProjects() { return puApProjects().map(x => ({ g: x.g, p: x.p, k: pmProjKey(x.g, x.p) })); }

// PM phụ trách 1 dự án (theo nhóm + tên dự án, hoặc chỉ tên dự án) → [{code,name,d,teams}]
function pmOfProject(g, p) {
  const out = [];
  pmList().forEach(e => (e.pm.projs || []).forEach(a => { const s = pmSplitKey(a.k); if (s.p === p && (!g || s.g === g)) out.push({ code: e.code, name: e.name, d: a.d || '', teams: pmTeamsOf(e), left: e.status === 'left' }); }));
  return out;
}
function pmShortName(n) { return String(n || '').trim(); }
// "Nguyen A (E), Tran B (M)" — rỗng nếu chưa gán PM
function pmNames(p, g) {
  const l = pmOfProject(g, p); if (!l.length) return '';
  return l.map(x => pmShortName(x.name) + (x.d ? ` (${x.d})` : '')).join(', ');
}
function pmTeamsOfProject(p, g) { const s = new Set(); pmOfProject(g, p).forEach(x => x.teams.forEach(t => s.add(t))); return [...s]; }
const pmNorm = s => String(s || '').toUpperCase().replace(/^HCM[\s-]+/, '').replace(/[^A-Z0-9]/g, '');
// Tìm PM theo tên dự án "lỏng" (dùng cho Tiến độ dự án, tên không trùng hẳn Action Plan): khớp đúng → khớp bỏ tiền tố HCM
function pmNamesLoose(name) {
  if (!name) return '';
  let r = pmNames(name); if (r) return r;
  const n = pmNorm(name); if (!n) return '';
  const hit = pmAllProjects().find(x => pmNorm(x.p) === n);
  return hit ? pmNames(hit.p, hit.g) : '';
}
function pmBadges(p, g) {
  return pmTeamsOfProject(p, g).map(t => `<span class="pm-tag pm-${t}">${PM_TEAMS[t]}</span>`).join('');
}
function pmProjectsOf(code) { const e = EMP_DB[code]; return (e && e.pm && e.pm.projs) || []; }
function pmProjEmpCount(k) { const s = pmSplitKey(k); const p = PROJECTS_DB && PROJECTS_DB[s.g] && PROJECTS_DB[s.g][s.p]; return p ? (p.employees || []).length : 0; }

// ── Thao tác (chỉ Quản lý/Admin) ──
function pmSave(msg) {
  saveEmpDb();
  try { const c = document.getElementById('pg-catalog'); if (c && c.classList.contains('show') && typeof renderCatalog === 'function') renderCatalog(); } catch (e) { console.warn(e); }
  try { pmRefreshOthers(); } catch (e) { console.warn(e); }
  if (msg) toast(msg);
}
// Vẽ lại các trang đang dùng thông tin PM (Action Plan, PU Delivery, Tiến độ, Dashboard OT)
function pmRefreshOthers() {
  const vis = id => { const e = document.getElementById(id); return e && e.classList.contains('show'); };
  if (typeof renderActionPlan === 'function' && vis('pg-action')) renderActionPlan();
  if (typeof renderPuDelivery === 'function' && vis('pg-pudelivery')) renderPuDelivery();
  if (typeof renderProgress === 'function' && vis('pg-progress')) renderProgress();
  if (typeof renderDash === 'function' && vis('pg-dash')) renderDash();
}
function pmAdd(code) {
  if (!requireManager('thêm PM')) return; const e = EMP_DB[code]; if (!e) { toast('⚠️ Không tìm thấy nhân viên.'); return; }
  if (!e.pm) e.pm = { team: [], projs: [] }; e.at = Date.now(); pmSave(`✅ Đã thêm ${e.name} vào danh bạ PM.`);
}
function pmRemove(code) {
  if (!requireManager('xoá PM')) return; const e = EMP_DB[code]; if (!e || !e.pm) return;
  if (!confirm(`Bỏ ${e.name} khỏi danh bạ PM?\n(Nhân viên vẫn còn trong danh sách; chỉ bỏ nhóm và các dự án đã gán PM.)`)) return;
  delete e.pm; e.at = Date.now(); pmSave('Đã bỏ khỏi danh bạ PM.');
}
function pmSetGroup(code, t) {
  if (!requireManager('đổi nhóm PM')) return; const e = EMP_DB[code]; if (!e || !e.pm) return;
  e.pm.team = PM_TEAMS[t] ? [t] : []; e.at = Date.now(); pmSave();
}
function pmToggleTeam(code, t) {
  if (!requireManager('đổi nhóm PM')) return; const e = EMP_DB[code]; if (!e || !e.pm) return;
  const s = new Set(e.pm.team || []); s.has(t) ? s.delete(t) : s.add(t); e.pm.team = ['CS', 'PB'].filter(x => s.has(x)); e.at = Date.now(); pmSave();
}
function pmAssign(code, k, d) {
  if (!requireManager('gán dự án cho PM')) return; const e = EMP_DB[code]; if (!e || !e.pm || !k) return;
  d = d || ''; e.pm.projs = e.pm.projs || [];
  if (e.pm.projs.some(a => a.k === k && (a.d || '') === d)) { toast('⚠️ PM này đã được gán dự án/mảng đó.'); return; }
  // Gán "Cả dự án" thay cho E/M riêng và ngược lại: giữ nguyên, để Quản lý tự quyết
  e.pm.projs.push({ k, d }); e.at = Date.now(); pmSave('✅ Đã gán dự án cho ' + e.name + '.');
}
function pmUnassignKey(code, k, d) {
  if (!requireManager('bỏ dự án của PM')) return; const e = EMP_DB[code]; if (!e || !e.pm) return;
  e.pm.projs = (e.pm.projs || []).filter(a => !(a.k === k && (a.d || '') === (d || ''))); e.at = Date.now(); pmSave();
}
function pmUnassign(code, i) {
  if (!requireManager('bỏ dự án của PM')) return; const e = EMP_DB[code]; if (!e || !e.pm) return;
  e.pm.projs.splice(i, 1); e.at = Date.now(); pmSave();
}
function pmSetDisc(code, i, d) {
  if (!requireManager('đổi mảng E/M')) return; const e = EMP_DB[code]; if (!e || !e.pm || !e.pm.projs[i]) return;
  const a = e.pm.projs[i];
  if (e.pm.projs.some((b, j) => j !== i && b.k === a.k && (b.d || '') === d)) { toast('⚠️ PM này đã có dự án/mảng đó.'); if (typeof renderCatalog === 'function') renderCatalog(); return; }
  a.d = d; e.at = Date.now(); pmSave();
}
// Đổi tên / xoá dự án trong Action Plan → cập nhật lại các chỗ PM tham chiếu
function pmOnProjectRename(g, oldName, newName) {
  const ok = pmProjKey(g, oldName), nk = pmProjKey(g, newName); let n = 0;
  pmList().forEach(e => (e.pm.projs || []).forEach(a => { if (a.k === ok) { a.k = nk; n++; } }));
  if (n) saveEmpDb();
}
function pmOnProjectDelete(g, name) {
  const k = pmProjKey(g, name); let n = 0;
  pmList().forEach(e => { const b = e.pm.projs || []; const f = b.filter(a => a.k !== k); if (f.length !== b.length) { e.pm.projs = f; n++; } });
  if (n) saveEmpDb();
}

// ── Báo cáo OT theo PM / nhóm (Dashboard) — dùng `totals` đã tính cho kỳ đang xem ──
function renderDashPmCard(totals) {
  const card = document.getElementById('dashPmCard'); if (!card) return;
  if (typeof dashTab === 'undefined' || dashTab !== 'month' || !pmList().length) { card.style.display = 'none'; return; }
  card.style.display = '';
  const byCode = {}; totals.forEach(t => { if (t.staffCode) byCode[t.staffCode] = (byCode[t.staffCode] || 0) + t.total; });
  const cur = currentProjectMap(), otOfProj = {}, nvOfProj = {};
  Object.keys(cur).forEach(code => { const k = cur[code]; (nvOfProj[k] = nvOfProj[k] || []).push(code); otOfProj[k] = (otOfProj[k] || 0) + (byCode[code] || 0); });
  const rows = pmList().filter(e => e.status !== 'left').map(e => {
    const ks = [...new Set((e.pm.projs || []).map(a => a.k).filter(pmProjExists))];
    const ot = ks.reduce((s, k) => s + (otOfProj[k] || 0), 0), nv = ks.reduce((s, k) => s + (nvOfProj[k] || []).length, 0);
    return { e, ks, ot, nv, own: byCode[e.code] || 0 };
  }).sort((a, b) => b.ot - a.ot);
  const grp = k => { const ks = new Set(); rows.forEach(r => { const t = pmTeamsOf(r.e); if (t.includes(k)) r.ks.forEach(x => ks.add(x)); });
    return { n: ks.size, nv: [...ks].reduce((s, x) => s + (nvOfProj[x] || []).length, 0), ot: [...ks].reduce((s, x) => s + (otOfProj[x] || 0), 0), pm: rows.filter(r => pmTeamsOf(r.e).includes(k)).length }; };
  const g = { CS: grp('CS'), PB: grp('PB') };
  const fmt = v => fmtH(Math.round(v * 60) / 60);
  document.getElementById('dashPmBody').innerHTML = `<div class="mp-kpi" style="margin-bottom:10px">${['CS', 'PB'].map(k => `<div class="mk"><b>${fmt(g[k].ot)}</b><span>${PM_TEAMS[k]} — ${g[k].pm} PM · ${g[k].n} dự án · ${g[k].nv} NV</span></div>`).join('')}</div>
    <div class="pg-tblw"><table class="pg-tbl"><thead><tr><th style="text-align:left">PM</th><th style="text-align:left">Nhóm</th><th style="text-align:right">Dự án</th><th style="text-align:right">Nhân sự</th><th style="text-align:right">OT các dự án phụ trách</th><th style="text-align:right">OT của PM</th></tr></thead><tbody>${
    rows.map(r => `<tr><td><b>${emEsc(r.e.name)}</b><div style="font-size:11px;color:var(--text3)">${r.ks.map(k => emEsc(pmSplitKey(k).p.replace(/^HCM[\s-]+/i, ''))).join(', ') || '—'}</div></td><td>${emEsc(pmTeamLabel(r.e))}</td><td style="text-align:right">${r.ks.length}</td><td style="text-align:right">${r.nv}</td><td style="text-align:right"><b>${fmt(r.ot)}</b></td><td style="text-align:right">${fmt(r.own)}</td></tr>`).join('')}</tbody></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">OT các dự án phụ trách = tổng OT của toàn bộ nhân sự trong dự án (không tách riêng mảng E/M; dự án có nhiều PM thì mỗi PM đều thấy đủ OT dự án). Dòng nhóm CS / Project Base chỉ tính mỗi dự án 1 lần.</div>`;
}

// ============================================================
//  ACTION PLAN theo PM — mỗi dòng 1 PM (tên + nhóm CS/PB), nhiều dự án, OT từng dự án, nhân sự tổng, Lý do/Kế hoạch.
//  Lý do/Kế hoạch/Duyệt/Ghi chú của PM lưu theo THÁNG trong PROJECTS_DB['HCM-EC']['__PM_<mã PM>'].plans[tháng]
//  (cùng cơ chế với hàng "S-ED (tất cả)") → dùng lại toàn bộ lưu/đồng bộ/duyệt có sẵn.
// ============================================================
const AP_PM_PREFIX = '__PM_';
const apPmKey = code => AP_PM_PREFIX + code;
const apIsPmKey = p => String(p || '').startsWith(AP_PM_PREFIX);
function apPmEmp(proj) { return apIsPmKey(proj) ? EMP_DB[proj.slice(AP_PM_PREFIX.length)] : null; }
// Tên hiển thị của "dự án" trong popup/thông báo (hàng PM → "PM Tên (CS)")
function apDisp(proj) {
  if (proj === '__SED_ALL__') return 'S-ED (tất cả)';
  const e = apPmEmp(proj); if (e) return `PM ${e.name} — ${pmTeamLabel(e)}`;
  return proj;
}
const apEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const apJs = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
const AP_EYE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const AP_PEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';

function apPmProjects(code) {   // các dự án (còn tồn tại) của PM, gộp mảng E/M theo dự án
  const m = new Map();
  pmProjectsOf(code).filter(a => pmProjExists(a.k)).forEach(a => { const s = pmSplitKey(a.k); const o = m.get(a.k) || { k: a.k, g: s.g, p: s.p, d: [] }; o.d.push(a.d || ''); m.set(a.k, o); });
  return [...m.values()].map(o => Object.assign(o, { dLabel: o.d.includes('') || (o.d.includes('E') && o.d.includes('M')) ? 'E+M' : o.d[0] })).sort((a, b) => a.p.localeCompare(b.p));
}
function apLegacyText(projs, mk) {   // Lý do/Kế hoạch cũ nhập theo từng dự án (trước khi chuyển sang theo PM) — hiện mờ nếu PM chưa nhập
  return projs.map(x => { const mp = (PROJECTS_DB[x.g] && PROJECTS_DB[x.g][x.p] && PROJECTS_DB[x.g][x.p].plans || {})[mk]; if (!mp) return ''; const t = [mp.reason, mp.plan].filter(Boolean).join(' / '); return t ? `${x.p.replace(/^HCM[\s-]+/i, '')}: ${t}` : ''; }).filter(Boolean).join(' · ');
}
function apOtLines(projs, mk) {
  return projs.map(x => {
    const s = getProjectOTStats(x.g, x.p, mk), nm = apEsc(x.p.replace(/^HCM[\s-]+/i, ''));
    return `<div style="margin-bottom:6px"><b>${nm}</b>${x.dLabel && x.dLabel !== 'E+M' ? ` <span class="pm-tag" style="background:#8a8f98;color:#fff">${x.dLabel}</span>` : ''}<br>
      OT thường: <b>${fmtH(s.otNormal)}</b> · OT đêm: <b style="color:#C0392B">${fmtH(s.otNight)}</b><br>
      Số NV OT: <b style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="viewProjectEmployees('${apJs(x.g)}','${apJs(x.p)}','${mk}')" title="Xem các NV này ở Danh sách NV OT">${s.nvCount}</b> người${s.overPay > 0 ? ` · <span style="color:#C0392B">vượt 70h: ${s.overPay}</span>` : ''}</div>`;
  }).join('');
}
function apStaffCellPm(code, projs, mk) {
  const set = new Set(); projs.forEach(x => projectEmployeesForMonth(x.g, x.p, mk).forEach(c => set.add(c)));
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90px;gap:6px"><div style="font-size:12.5px"><strong style="font-size:16px">${set.size}</strong> NV<div style="font-size:10.5px;color:var(--text3)">${projs.length} dự án</div></div>
    <button class="btn" style="padding:6px 12px;line-height:1;display:inline-flex;align-items:center" onclick="apStaffView('${apJs(code)}','${mk}')" title="Xem nhân sự từng dự án của PM">${AP_EYE}</button></div>`;
}
function apPlanBtns(group, proj, mk, hasContent) {
  const g = apJs(group), p = apJs(proj);
  return `<div style="display:flex;gap:6px;margin-top:4px">${hasContent ? `<button class="btn" style="padding:5px 9px;line-height:1" onclick="openPlanViewModal('${g}','${p}','${mk}')" title="Xem đầy đủ">${AP_EYE}</button>` : ''}<button class="btn" style="padding:5px 9px;line-height:1" onclick="openPlanEditModal('${g}','${p}','${mk}')" title="Sửa Lý do / Kế hoạch">${AP_PEN}</button></div>`;
}
function apRowHtml(i, mk, o) {
  const mp = getMonthPlan(o.pg, o.pp, mk), rej = (mp.approvedBy || '').startsWith('REJECTED|');
  const noteTa = `<textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="Ghi chú..." onchange="saveProjectField('${apJs(o.pg)}','${apJs(o.pp)}','note',this.value,'${mk}')">${apEsc(mp.note || '')}</textarea>`;
  return `<tr class="${rej ? 'row-rejected' : ''}"><td style="text-align:center;color:var(--text2)">${i}</td><td>${o.pmCell}</td><td>${o.projCell}</td>
    <td style="font-size:12px;line-height:1.6">${o.otCell}</td><td>${o.staffCell}</td><td>${planCellHtml(o.pg, o.pp, mk, mp, o.legacy)}</td><td>${approvalBoxHtml(o.pg, o.pp, mp, mk)}</td><td>${noteTa}</td></tr>`;
}
function apBuildPmTable(group, tbodyId, mk) {
  const tbody = document.getElementById(tbodyId); if (!tbody) return;
  const edit = isManager(), rows = [];
  let n = 0;
  // 1) NV chưa gán dự án (như trước): chờ PM xác nhận
  const curM = currentProjectMap(), unKey = group + '::' + UNASSIGNED_PROJ;
  if (PROJECTS_DB[group] && PROJECTS_DB[group][UNASSIGNED_PROJ] && Object.keys(curM).some(c => curM[c] === unKey) && projectEmployeesForMonth(group, UNASSIGNED_PROJ, mk).length) {
    rows.push(apRowHtml(++n, mk, { pg: group, pp: UNASSIGNED_PROJ, pmCell: '<span style="color:#B8730F;font-weight:700">⚠️ Chờ xác nhận</span>', projCell: projNameCellHtml(group, UNASSIGNED_PROJ, mk), otCell: apOtLines([{ g: group, p: UNASSIGNED_PROJ, dLabel: '' }], mk), staffCell: staffCellHtml(group, UNASSIGNED_PROJ, mk) }));
  }
  // 2) Mỗi PM 1 dòng (CS trước, rồi Project Base)
  const ord = e => { const t = pmTeamsOf(e); return t[0] === 'CS' ? 0 : t[0] === 'PB' ? 1 : 2; };
  const pms = pmList().filter(e => e.status !== 'left').sort((a, b) => ord(a) - ord(b) || a.name.localeCompare(b.name, 'vi'));
  const inPm = new Set();
  pms.forEach(e => {
    const projs = apPmProjects(e.code); projs.forEach(x => inPm.add(x.k));
    const key = apPmKey(e.code);
    if (!PROJECTS_DB[group]) PROJECTS_DB[group] = {};
    if (!PROJECTS_DB[group][key]) PROJECTS_DB[group][key] = { employees: [], plans: {} };
    const mp = getMonthPlan(group, key, mk), legacy = (mp.reason || mp.plan) ? '' : apLegacyText(projs, mk);
    const tm = pmTeamsOf(e);
    const pmCell = `<div style="font-weight:700;font-size:13.5px">${apEsc(e.name)}</div><div style="margin-top:3px">${tm.length ? tm.map(t => `<span class="pm-tag pm-${t}" style="margin-left:0;margin-right:4px">${PM_TEAMS[t]}</span>`).join('') : '<span style="font-size:11px;color:#E8A33D">Chưa phân nhóm</span>'}</div><div style="font-size:10.5px;color:var(--text3);margin-top:2px">${apEsc(e.code)}</div>`;
    const projCell0 = projs.length ? projs.map(x => `<div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-weight:600">${apEsc(x.p)}</span>${x.dLabel !== 'E+M' ? `<span class="pm-tag" style="background:#8a8f98;color:#fff;margin-left:0">${x.dLabel}</span>` : ''}${edit ? `<button class="btn" style="padding:1px 6px;font-size:10.5px" onclick="renameProjectPrompt('${apJs(x.g)}','${apJs(x.p)}')" title="Đổi tên dự án">Đổi tên</button><button class="btn btn-danger" style="padding:1px 6px;font-size:10.5px" onclick="deleteProjectConfirm('${apJs(x.g)}','${apJs(x.p)}')" title="Xoá dự án">Xoá</button>` : ''}</div>`).join('') : '<span style="font-size:12px;color:var(--text3)">Chưa gán dự án</span>';
    const addBtn = edit ? `<button class="btn" style="padding:3px 10px;font-size:12px;margin-top:2px" onclick="catAssignDialog('${apJs(e.code)}')" title="Gán thêm dự án cho PM này">＋ Gán dự án</button>` : '';
    const projCell = projCell0 + addBtn;
    rows.push(apRowHtml(++n, mk, { pg: group, pp: key, pmCell, projCell, otCell: projs.length ? apOtLines(projs, mk) : '<span style="color:var(--text3)">—</span>', staffCell: apStaffCellPm(e.code, projs, mk), legacy }));
  });
  // 3) Dự án chưa có PM: giữ hàng riêng từng dự án (như bản cũ) để không mất dữ liệu
  projectsInGroup(group).filter(p => p !== UNASSIGNED_PROJ && !p.startsWith('__') && !inPm.has(pmProjKey(group, p))).sort().forEach(proj => {
    rows.push(apRowHtml(++n, mk, { pg: group, pp: proj, pmCell: '<span style="font-size:12px;color:var(--text3)">Chưa có PM</span>' + (edit ? `<div style="margin-top:4px"><button class="btn" style="padding:3px 10px;font-size:12px" onclick="catAssignDialog('','${apJs(pmProjKey(group, proj))}')" title="Gán PM cho dự án này">＋ Gán PM</button></div>` : ''), projCell: projNameCellHtml(group, proj, mk), otCell: apOtLines([{ g: group, p: proj, dLabel: '' }], mk), staffCell: staffCellHtml(group, proj, mk) }));
  });
  tbody.innerHTML = rows.join('') || `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">Chưa có dự án / PM. Bấm "+ Thêm dự án" hoặc vào Nhân lực → PM.</td></tr>`;
}

// ── Popup nhân sự theo dự án của 1 PM (chia cột đều, phóng to được) ──
let apStaffCtx = null;
function apStaffView(code, mk, zoom) {
  apStaffCtx = { code, mk, zoom: !!zoom };
  let ov = document.getElementById('apStaffModal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'apStaffModal'; ov.className = 'pg-modal'; ov.style.display = 'flex'; ov.onclick = ev => { if (ev.target === ov) apStaffClose(); }; document.body.appendChild(ov); }
  const e = EMP_DB[code] || { name: code }, projs = apPmProjects(code), z = apStaffCtx.zoom;
  const cols = projs.map(x => {
    const codes = projectEmployeesForMonth(x.g, x.p, mk);
    return `<div style="border:1px solid var(--border2);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;min-height:0"><div style="padding:8px 12px;background:var(--bg2);display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${apEsc(x.p)}</b><span style="font-size:12px;color:var(--text2)">${codes.length} NV</span>
      <button class="btn" style="margin-left:auto;padding:2px 9px;font-size:11.5px" onclick="apStaffEdit('${apJs(x.g)}','${apJs(x.p)}','${mk}')" title="Thêm / chuyển nhân sự dự án này">Thêm / chuyển</button></div>
      <div style="padding:6px 12px;overflow:auto;flex:1;font-size:12.5px;line-height:1.9">${codes.length ? codes.map(c => `<div><span style="color:var(--text3)">${apEsc(c)}</span> · ${apEsc(employeeNameByCode(c))}</div>`).join('') : '<span style="color:var(--text3)">Chưa có nhân sự</span>'}</div></div>`;
  }).join('');
  ov.innerHTML = `<div class="pg-mbox" style="max-width:none;width:${z ? '98vw' : 'min(1180px,94vw)'};height:${z ? '94vh' : 'min(720px,86vh)'};display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div style="font-size:17px;font-weight:800">Nhân sự theo dự án — ${apEsc(e.name)}</div><span style="font-size:12px;color:var(--text2)">Tháng ${fmtMK(mk)} · ${projs.length} dự án</span>
      <span style="margin-left:auto;display:flex;gap:6px"><button class="btn" onclick="apStaffView('${apJs(code)}','${mk}',${!z})">${z ? '⤡ Thu nhỏ' : '⤢ Phóng to'}</button><button class="btn" onclick="apStaffClose()">✕ Đóng</button></span></div>
    <div style="flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(${z ? 260 : 230}px,1fr));gap:10px;align-content:start">${cols || '<div style="color:var(--text2)">PM này chưa được gán dự án.</div>'}</div></div>`;
}
function apStaffClose() { const o = document.getElementById('apStaffModal'); if (o) o.remove(); apStaffCtx = null; }
function apStaffEdit(g, p, mk) { apStaffClose(); openStaffEditModal(g, p, mk); }
