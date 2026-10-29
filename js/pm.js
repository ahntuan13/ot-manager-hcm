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
  try { if (window.mpTab === 'pm') renderPmTab(); } catch (e) { console.warn(e); }
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
function pmUnassign(code, i) {
  if (!requireManager('bỏ dự án của PM')) return; const e = EMP_DB[code]; if (!e || !e.pm) return;
  e.pm.projs.splice(i, 1); e.at = Date.now(); pmSave();
}
function pmSetDisc(code, i, d) {
  if (!requireManager('đổi mảng E/M')) return; const e = EMP_DB[code]; if (!e || !e.pm || !e.pm.projs[i]) return;
  const a = e.pm.projs[i];
  if (e.pm.projs.some((b, j) => j !== i && b.k === a.k && (b.d || '') === d)) { toast('⚠️ PM này đã có dự án/mảng đó.'); renderPmTab(); return; }
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

// ── Màn hình: Nhân lực → tab "PM" ──
function pmAddDialog() {
  if (!requireManager('thêm PM')) return;
  const cand = rosterList().filter(e => !e.pm && e.status !== 'excl').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const ov = document.createElement('div'); ov.className = 'pg-modal'; ov.id = 'pmAddModal'; ov.style.display = 'flex';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:6px">Thêm PM</div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px">Chọn nhân viên HCM (đã có trong danh sách Nhân viên). PM vẫn là nhân viên, vẫn tính OT bình thường. Chưa có trong danh sách? Thêm ở tab "Danh sách nhân viên HCM" trước.</div>
    <input id="pmAddQ" list="pmAddList" placeholder="Gõ mã hoặc tên rồi chọn…" style="width:100%;padding:9px 11px"><datalist id="pmAddList">${cand.map(e => `<option value="${emEsc(e.code)} — ${emEsc(e.name)}">`).join('')}</datalist>
    <div class="action-row" style="justify-content:flex-end;margin:14px 0 0"><button class="btn" onclick="document.getElementById('pmAddModal').remove()">Huỷ</button><button class="btn btn-primary" onclick="pmAddDo()">Thêm</button></div></div>`;
  document.body.appendChild(ov); setTimeout(() => document.getElementById('pmAddQ').focus(), 50);
}
function pmAddDo() {
  const v = (document.getElementById('pmAddQ').value || '').trim(), code = v.split('—')[0].trim();
  if (!EMP_DB[code]) { toast('⚠️ Chọn nhân viên trong danh sách gợi ý.'); return; }
  document.getElementById('pmAddModal').remove(); pmAdd(code);
}
function pmCard(e, edit, projs) {
  const teams = pmTeamsOf(e), list = e.pm.projs || [], c = emJs(e.code).replace(/'/g, '&#39;');
  const tbtn = t => `<button class="pm-tb${teams.includes(t) ? ' on pm-' + t : ''}"${edit ? ` onclick="pmToggleTeam('${c}','${t}')"` : ' disabled'}>${PM_TEAMS[t]}</button>`;
  const rows = list.map((a, i) => {
    const ex = pmProjExists(a.k), s = pmSplitKey(a.k);
    return `<tr><td>${ex ? `<b>${emEsc(s.p)}</b> <span style="color:var(--text3);font-size:11px">${emEsc(s.g)}</span>` : `<span style="color:#C0392B">${emEsc(s.p)} (dự án đã xoá)</span>`}</td>
      <td>${edit ? `<select onchange="pmSetDisc('${c}',${i},this.value)">${Object.keys(PM_DISC).map(d => `<option value="${d}"${(a.d || '') === d ? ' selected' : ''}>${PM_DISC[d]}</option>`).join('')}</select>` : `<span class="pg-pill" style="background:#8a8f98">${PM_DISC[a.d || '']}</span>`}</td>
      <td style="text-align:right;color:var(--text2)">${ex ? pmProjEmpCount(a.k) + ' NV' : ''}</td>${edit ? `<td style="width:30px"><button class="pg-ib" title="Bỏ dự án này" onclick="pmUnassign('${c}',${i})">✕</button></td>` : ''}</tr>`;
  }).join('');
  const taken = new Set(list.map(a => a.k + '|' + (a.d || '')));
  return `<div class="card pm-card${e.status === 'left' ? ' pm-left' : ''}"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="font-size:15px;font-weight:800">${emEsc(e.name)}</div><span style="color:var(--text3);font-size:12px">${emEsc(e.code)}${e.dept ? ' · ' + emEsc(e.dept) : ''}${e.status === 'left' ? ' · đã nghỉ việc' : ''}</span>
      <span style="display:flex;gap:6px;margin-left:8px">${tbtn('CS')}${tbtn('PB')}</span>
      ${edit ? `<button class="btn" style="margin-left:auto;padding:3px 10px;color:#C0392B" onclick="pmRemove('${c}')" title="Bỏ khỏi danh bạ PM">Bỏ PM</button>` : ''}</div>
    ${rows ? `<div class="pg-tblw" style="margin-top:8px"><table class="pg-tbl"><thead><tr><th style="text-align:left">Dự án phụ trách</th><th style="text-align:left">Mảng</th><th style="text-align:right">Nhân sự</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>` : `<div style="font-size:12px;color:var(--text2);margin-top:8px">Chưa được gán dự án nào.</div>`}
    ${edit ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select id="pmSel_${emEsc(e.code)}"><option value="">＋ Gán dự án…</option>${projs.map(x => `<option value="${emEsc(x.k)}">${emEsc(x.p)}</option>`).join('')}</select>
      <select id="pmDisc_${emEsc(e.code)}">${Object.keys(PM_DISC).map(d => `<option value="${d}">${PM_DISC[d]}</option>`).join('')}</select>
      <button class="btn" onclick="pmAssignFromUi('${c}')">Gán</button></div>` : ''}</div>`;
}
function pmAssignFromUi(code) {
  const k = document.getElementById('pmSel_' + code)?.value, d = document.getElementById('pmDisc_' + code)?.value || '';
  if (!k) { toast('⚠️ Chọn dự án cần gán.'); return; } pmAssign(code, k, d);
}
function renderPmTab() {
  const box = document.getElementById('pmBody'); if (!box) return;
  const edit = isManager(), q = pmQ.trim().toLowerCase(), all = pmList(), projs = pmAllProjects().filter(x => x.p !== UNASSIGNED_PROJ).sort((a, b) => a.p.localeCompare(b.p));
  const teamOf = e => { const t = pmTeamsOf(e); return t.length === 2 ? 'both' : t[0] || 'none'; };
  const cnt = k => all.filter(e => e.status !== 'left' && (k === 'all' || teamOf(e) === k)).length;
  const rows = all.filter(e => (pmFTeam === 'all' || teamOf(e) === pmFTeam) && (!q || (e.code + ' ' + e.name).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const noPm = projs.filter(x => !pmOfProject(x.g, x.p).length && !x.p.startsWith('__'));
  const chip = (k, l) => `<button class="btn${pmFTeam === k ? ' btn-primary' : ''}" onclick="pmFTeam='${k}';renderPmTab()">${l} (${cnt(k)})</button>`;
  box.innerHTML = `<div class="mp-kpi">
      <div class="mk"><b>${cnt('all')}</b><span>PM đang làm</span></div><div class="mk"><b>${cnt('CS') + cnt('both')}</b><span>Nhóm CS</span></div><div class="mk"><b>${cnt('PB') + cnt('both')}</b><span>Nhóm Project Base</span></div>
      <div class="mk"><b>${cnt('both')}</b><span>Cả CS + Project Base</span></div><div class="mk"><b style="color:${cnt('none') ? '#E8A33D' : 'inherit'}">${cnt('none')}</b><span>Chưa phân nhóm</span></div>
      <div class="mk"><b style="color:${noPm.length ? '#E8A33D' : 'inherit'}">${noPm.length}</b><span>Dự án chưa có PM</span></div></div>
    <div class="card"><div class="action-row">${edit ? '<button class="btn btn-primary" onclick="pmAddDialog()">＋ Thêm PM</button>' : ''}
      ${chip('all', 'Tất cả')}${chip('CS', 'CS')}${chip('PB', 'Project Base')}${chip('both', 'CS + PB')}${chip('none', 'Chưa phân nhóm')}
      <input type="text" placeholder="Tìm PM…" value="${emEsc(pmQ)}" oninput="pmQ=this.value;pmRefocus(this)" style="width:170px"></div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:8px;line-height:1.6">Đây là <b>nguồn duy nhất</b> về PM: Action Plan, PU Delivery, Tiến độ dự án và báo cáo OT theo PM đều đọc từ đây — sửa ở đây thì mọi nơi tự cập nhật. 1 dự án có thể nhiều PM (mảng E / M); 1 PM có thể phụ trách nhiều dự án và thuộc cả CS lẫn Project Base.${edit ? '' : ' (Chỉ Quản lý/Admin được chỉnh sửa.)'}</div></div>
    ${noPm.length ? `<div class="card" style="border-left:4px solid #E8A33D"><div style="font-size:12.5px"><b>Dự án chưa có PM:</b> ${noPm.map(x => emEsc(x.p)).join(' · ')}</div></div>` : ''}
    ${rows.map(e => pmCard(e, edit, projs)).join('') || `<div class="card" style="text-align:center;color:var(--text2)">Chưa có PM. ${edit ? 'Bấm <b>＋ Thêm PM</b> để chọn từ danh sách nhân viên.' : ''}</div>`}`;
}
function pmRefocus(inp) { const pos = inp.selectionStart; renderPmTab(); const ni = document.querySelector('#pmBody input[type=text]'); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} } }

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
