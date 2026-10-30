// ============================================================
//  DANH MỤC (Catalog) — thư viện chính: PM · Nhóm (CS / Project Base) · Dự án · Nhân viên.
//  Dữ liệu nằm ở: EMP_DB[mã].pm (PM, nhóm, dự án phụ trách + mảng E/M) và PROJECTS_DB (dự án, nhân sự — Action Plan).
//  Mọi trang khác (Action Plan, Nhân lực, PU Delivery, Tiến độ, OT) đọc từ đây qua các hàm trong pm.js.
// ============================================================
let catTab = 'pm', catFGroup = 'all', catQ = '';
// Danh sách PM do công ty cung cấp (không dấu) — dùng để gợi ý/ưu tiên khi khớp tên
const CAT_PM_HINT = ['Bui Quang Phuc', 'Bui Quang Thien An', 'Chu Ngoc Dan', 'Do Si Tuong', 'Doan Vu', 'Huynh Quoc Trung', 'Le Anh Khoa', 'Ngo Bao Vu', 'Nguyen Khanh Ha', 'Nguyen Ly Oai', 'Nguyen Quoc Hung', 'Nguyen Tat Dai', 'Nguyen Thanh Vinh', 'Pham Quang Hung', 'Pham Tri Dat', 'Pham Van Hien', 'Phan Thanh Long', 'Phan Van Cong', 'Tu Chi Hieu', 'Vo Van Luan', 'Vu The Anh', 'Vuong Minh Chau'];
const catNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const CAT_HINT_SET = new Set(CAT_PM_HINT.map(catNorm));
const cE = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cJ = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
const catGroupOf = e => { const t = pmTeamsOf(e); return t[0] || ''; };
const catProjLabel = k => { const s = pmSplitKey(k); return s.p; };

function catSetTab(t) { catTab = t; renderCatalog(); }
function catReload() { renderCatalog(); try { pmRefreshOthers(); } catch (e) {} }

// ── Chọn nhiều thao tác ──
function catAddProjectToPm(code) {
  const k = document.getElementById('catSel_' + code)?.value, d = document.getElementById('catDisc_' + code)?.value || '';
  if (!k) { toast('⚠️ Chọn dự án cần gán.'); return; } pmAssign(code, k, d);
}
function catAddPmToProject(k) {
  const id = k.replace(/[^A-Za-z0-9]/g, '_'), c = document.getElementById('catPmSel_' + id)?.value, d = document.getElementById('catPmDisc_' + id)?.value || '';
  if (!c) { toast('⚠️ Chọn PM cần gán.'); return; } pmAssign(c, k, d);
}
function catPromptAddProject() {
  if (!requireManager('thêm dự án')) return;
  const name = prompt('Tên dự án mới (HCM-EC):'); if (!name || !name.trim()) return;
  if (addProject('HCM-EC', name.trim())) { toast(`✅ Đã thêm dự án "${name.trim()}".`); catReload(); } else toast('Tên dự án đã tồn tại hoặc không hợp lệ');
}
function catRenameProject(g, p) { if (!requireManager('đổi tên dự án')) return; renameProjectPrompt(g, p); catReload(); }
function catDeleteProject(g, p) { if (!requireManager('xoá dự án')) return; deleteProjectConfirm(g, p); catReload(); }

// ── Hộp thoại gán dự án / gán PM (dùng cả từ Action Plan) ──
function catAssignDialog(code, k) {
  if (!requireManager('gán dự án / PM')) return;
  const byPm = !!code;
  const projs = pmAllProjects().filter(x => x.p !== UNASSIGNED_PROJ).sort((a, b) => a.p.localeCompare(b.p));
  const pms = pmList().filter(e => e.status !== 'left').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  if (byPm && !pms.length) { toast('⚠️ Chưa có PM. Vào Danh mục → thêm PM trước.'); return; }
  const mine = new Set(byPm ? pmProjectsOf(code).map(a => a.k) : []);
  const ov = document.createElement('div'); ov.className = 'pg-modal'; ov.id = 'catAsgModal'; ov.style.display = 'flex';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:480px"><div style="font-size:18px;font-weight:800;margin-bottom:6px">${byPm ? 'Gán thêm dự án cho ' + cE((EMP_DB[code] || {}).name || code) : 'Gán PM cho dự án ' + cE(catProjLabel(k))}</div>
    <div style="display:grid;gap:10px;margin:10px 0">
    ${byPm ? `<label style="font-size:12.5px">Dự án<select id="catAsgVal" style="width:100%;padding:8px;margin-top:3px">${projs.map(x => `<option value="${cE(x.k)}"${mine.has(x.k) ? ' disabled' : ''}>${cE(x.p)}${mine.has(x.k) ? ' (đã gán)' : ''}</option>`).join('')}</select></label>`
      : `<label style="font-size:12.5px">PM<select id="catAsgVal" style="width:100%;padding:8px;margin-top:3px">${pms.map(e => `<option value="${cE(e.code)}">${cE(e.name)} — ${cE(pmTeamLabel(e))}</option>`).join('')}</select></label>`}
    <label style="font-size:12.5px">Mảng phụ trách<select id="catAsgDisc" style="width:100%;padding:8px;margin-top:3px">${Object.keys(PM_DISC).map(d => `<option value="${d}">${PM_DISC[d]}</option>`).join('')}</select></label></div>
    <div class="action-row" style="justify-content:flex-end;margin:0"><button class="btn" onclick="document.getElementById('catAsgModal').remove()">Huỷ</button><button class="btn btn-primary" onclick="catAssignDo('${cJ(code || '')}','${cJ(k || '')}')">Gán</button></div></div>`;
  document.body.appendChild(ov);
}
function catAssignDo(code, k) {
  const v = document.getElementById('catAsgVal').value, d = document.getElementById('catAsgDisc').value;
  document.getElementById('catAsgModal').remove();
  if (code) pmAssign(code, v, d); else pmAssign(v, k, d);
}

// ── Thêm PM ──
function catAddPmDialog() {
  if (!requireManager('thêm PM')) return;
  const cand = rosterList().filter(e => !e.pm && e.status !== 'excl').sort((a, b) => (CAT_HINT_SET.has(catNorm(b.name)) - CAT_HINT_SET.has(catNorm(a.name))) || a.name.localeCompare(b.name, 'vi'));
  const ov = document.createElement('div'); ov.className = 'pg-modal'; ov.id = 'catAddModal'; ov.style.display = 'flex';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:6px">Thêm PM</div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:10px">Chọn từ danh sách nhân viên HCM (PM vẫn là nhân viên, vẫn tính OT). Người trong danh sách PM của công ty được xếp lên đầu. Chưa có trong danh sách? Thêm ở Nhân lực → Danh sách nhân viên trước.</div>
    <input id="catAddQ" list="catAddList" placeholder="Gõ mã hoặc tên rồi chọn…" style="width:100%;padding:9px 11px"><datalist id="catAddList">${cand.map(e => `<option value="${cE(e.code)} — ${cE(e.name)}">`).join('')}</datalist>
    <div class="action-row" style="justify-content:space-between;margin:14px 0 0"><button class="btn" onclick="catAddHint()" title="Thêm cùng lúc những người trùng tên với danh sách 22 PM của công ty">＋ Thêm nhanh theo danh sách 22 PM</button><span style="display:flex;gap:8px"><button class="btn" onclick="document.getElementById('catAddModal').remove()">Huỷ</button><button class="btn btn-primary" onclick="catAddDo()">Thêm</button></span></div></div>`;
  document.body.appendChild(ov); setTimeout(() => document.getElementById('catAddQ').focus(), 50);
}
function catAddDo() {
  const code = (document.getElementById('catAddQ').value || '').split('—')[0].trim();
  if (!EMP_DB[code]) { toast('⚠️ Chọn nhân viên trong danh sách gợi ý.'); return; }
  document.getElementById('catAddModal').remove(); pmAdd(code);
}
function catAddHint() {
  const by = {}; rosterList().filter(e => e.status !== 'excl').forEach(e => { (by[catNorm(e.name)] = by[catNorm(e.name)] || []).push(e); });
  const found = [], miss = [];
  CAT_PM_HINT.forEach(n => { const l = (by[catNorm(n)] || []).filter(e => !e.pm); const all = by[catNorm(n)] || []; if (l.length) found.push(l[0]); else if (!all.length) miss.push(n); });
  if (!found.length) { toast(miss.length ? '⚠️ Không thấy ai trong danh sách nhân viên. Thêm nhân viên trước.' : 'Tất cả đã là PM.'); return; }
  if (!confirm(`Thêm ${found.length} người làm PM?\n\n${found.map(e => e.name + ' (' + e.code + ')').join('\n')}${miss.length ? '\n\nChưa có trong danh sách nhân viên (bỏ qua): ' + miss.join(', ') : ''}`)) return;
  found.forEach(e => { e.pm = { team: [], projs: [] }; e.at = Date.now(); });
  const m = document.getElementById('catAddModal'); if (m) m.remove();
  pmSave(`✅ Đã thêm ${found.length} PM. Chọn nhóm CS / Project Base cho từng người.`);
}

// ── Nhập từ Action Plan / PU Delivery: gom tên PM đã gõ tay, ghép với nhân viên ──
function catLegacyPmText(g, p) {
  const out = [];
  const pl = (PROJECTS_DB[g] && PROJECTS_DB[g][p] && PROJECTS_DB[g][p].plans) || {};
  Object.keys(pl).sort().reverse().some(mk => { if (pl[mk] && pl[mk].pm) { out.push(pl[mk].pm); return true; } return false; });
  const m = (typeof puMeta === 'function') ? puMeta(p) : null; if (m && m.pm) out.push(m.pm);
  try { puItems().filter(x => puProjOf(x) === p && x.pm).slice(0, 5).forEach(x => out.push(x.pm)); } catch (e) {}
  return out;
}
function catTokens(txt) {
  return String(txt || '').split(/[\/,&;+]|\s-\s|\bva\b|\band\b/i).map(t => t.replace(/\(.*?\)/g, ' ').replace(/\b(mr|mrs|ms|mister|anh|chi)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim()).filter(t => t.length >= 2);
}
function catImportScan() {
  const map = {};   // token chuẩn hoá → { label, projs:Set(k) }
  pmAllProjects().filter(x => x.p !== UNASSIGNED_PROJ).forEach(x => {
    if (pmOfProject(x.g, x.p).length) return;   // dự án đã có PM → bỏ qua
    new Set(catLegacyPmText(x.g, x.p).flatMap(catTokens)).forEach(t => { const n = catNorm(t); if (!n) return; const o = map[n] = map[n] || { label: t, projs: new Set() }; o.projs.add(x.k); });
  });
  const emps = rosterList().filter(e => e.status !== 'excl');
  return Object.keys(map).sort().map(n => {
    const cands = emps.filter(e => { const en = catNorm(e.name); return en === n || en.endsWith(' ' + n); })
      .sort((a, b) => (!!b.pm - !!a.pm) || (CAT_HINT_SET.has(catNorm(b.name)) - CAT_HINT_SET.has(catNorm(a.name))) || a.name.localeCompare(b.name, 'vi'));
    const pref = cands.filter(e => e.pm || CAT_HINT_SET.has(catNorm(e.name)));
    const pick = pref.length === 1 ? pref[0] : cands.length === 1 ? cands[0] : null;
    return { n, label: map[n].label, projs: [...map[n].projs], cands, pick };
  });
}
let catImp = null;
function catImportDialog() {
  if (!requireManager('nhập PM từ Action Plan')) return;
  catImp = catImportScan();
  if (!catImp.length) { toast('Không có tên PM nào cần nhập (dự án đã có PM, hoặc Action Plan / PU chưa có tên PM).'); return; }
  const ov = document.createElement('div'); ov.className = 'pg-modal'; ov.id = 'catImpModal'; ov.style.display = 'flex';
  const rows = catImp.map((r, i) => `<tr><td style="vertical-align:top"><b>${cE(r.label)}</b><div style="font-size:11px;color:var(--text3)">${r.projs.map(k => cE(catProjLabel(k))).join(', ')}</div></td>
    <td><select id="catImpEmp${i}" style="max-width:230px"><option value="">— bỏ qua —</option>${r.cands.map(e => `<option value="${cE(e.code)}"${r.pick && r.pick.code === e.code ? ' selected' : ''}>${cE(e.name)} (${cE(e.code)}${e.dept ? ' · ' + cE(e.dept) : ''})${e.pm ? ' · đã là PM' : ''}</option>`).join('')}</select>${r.cands.length ? '' : '<div style="font-size:11px;color:#C0392B">không thấy nhân viên nào trùng tên</div>'}</td>
    <td><select id="catImpGrp${i}"><option value="">Chưa phân nhóm</option><option value="CS">CS</option><option value="PB">Project Base</option></select></td></tr>`).join('');
  ov.innerHTML = `<div class="pg-mbox" style="max-width:820px;max-height:90vh;display:flex;flex-direction:column"><div style="font-size:18px;font-weight:800;margin-bottom:4px">Nhập PM từ Action Plan / PU Delivery</div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:8px">App gom tên PM đã gõ tay ở các dự án chưa có PM và gợi ý nhân viên trùng tên. Chọn đúng người (hoặc bỏ qua) và chọn nhóm; sau khi nhập vẫn sửa được trong Danh mục.</div>
    <div style="overflow:auto;flex:1"><table class="pg-tbl"><thead><tr><th style="text-align:left">Tên đã gõ → dự án</th><th style="text-align:left">Là nhân viên</th><th style="text-align:left">Nhóm</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="action-row" style="justify-content:flex-end;margin:12px 0 0"><button class="btn" onclick="document.getElementById('catImpModal').remove()">Huỷ</button><button class="btn btn-primary" onclick="catImportApply()">Nhập</button></div></div>`;
  document.body.appendChild(ov);
}
function catImportApply() {
  let np = 0, na = 0; const now = Date.now();
  catImp.forEach((r, i) => {
    const code = document.getElementById('catImpEmp' + i).value; if (!code || !EMP_DB[code]) return;
    const grp = document.getElementById('catImpGrp' + i).value, e = EMP_DB[code];
    if (!e.pm) { e.pm = { team: [], projs: [] }; np++; }
    if (grp && !pmTeamsOf(e).length) e.pm.team = [grp];
    r.projs.forEach(k => { if (!e.pm.projs.some(a => a.k === k)) { e.pm.projs.push({ k, d: '' }); na++; } });
    e.at = now;
  });
  document.getElementById('catImpModal').remove(); catImp = null;
  pmSave(`✅ Đã nhập: ${np} PM mới, ${na} lượt gán dự án. Kiểm tra lại nhóm và mảng E/M.`);
}

// ── Vẽ trang ──
function catTabs() {
  const t = [['pm', '🧑‍💼 PM — Nhóm — Dự án'], ['proj', '🏗️ Dự án'], ['staff', '👥 Nhân viên']];
  return `<div class="mp-tabs">${t.map(([k, l]) => `<button class="${catTab === k ? 'on' : ''}" onclick="catSetTab('${k}')">${l}</button>`).join('')}</div>`;
}
function catDiscSel(code, a, i) {
  return `<select onchange="pmSetDisc('${cJ(code)}',${i},this.value)" style="font-size:11px;padding:1px 3px">${Object.keys(PM_DISC).map(d => `<option value="${d}"${(a.d || '') === d ? ' selected' : ''}>${PM_DISC[d]}</option>`).join('')}</select>`;
}
function catPmTab(edit) {
  const q = catQ.trim().toLowerCase(), all = pmList(), projs = pmAllProjects().filter(x => x.p !== UNASSIGNED_PROJ).sort((a, b) => a.p.localeCompare(b.p));
  const cnt = k => all.filter(e => e.status !== 'left' && (k === 'all' || (catGroupOf(e) || 'none') === k)).length;
  const noPm = projs.filter(x => !pmOfProject(x.g, x.p).length);
  const rows = all.filter(e => (catFGroup === 'all' || (catGroupOf(e) || 'none') === catFGroup) && (!q || (e.code + ' ' + e.name).toLowerCase().includes(q)))
    .sort((a, b) => ({ CS: 0, PB: 1, '': 2 }[catGroupOf(a)] - { CS: 0, PB: 1, '': 2 }[catGroupOf(b)]) || a.name.localeCompare(b.name, 'vi'));
  const chip = (k, l) => `<button class="btn${catFGroup === k ? ' btn-primary' : ''}" onclick="catFGroup='${k}';renderCatalog()">${l} (${cnt(k)})</button>`;
  const tr = rows.map((e, n) => {
    const c = cJ(e.code), list = e.pm.projs || [];
    const chips = list.map((a, i) => { const ex = pmProjExists(a.k);
      return `<span class="cat-chip${ex ? '' : ' cat-bad'}" title="${ex ? '' : 'Dự án đã xoá'}">${cE(catProjLabel(a.k))}${edit ? ' ' + catDiscSel(e.code, a, i) : ` <span class="pm-tag" style="background:#8a8f98;color:#fff;margin-left:2px">${(a.d || 'E+M')}</span>`}${edit ? `<button class="cat-x" title="Bỏ dự án này" onclick="pmUnassign('${c}',${i})">✕</button>` : ''}</span>`; }).join('');
    const set = new Set(); list.filter(a => pmProjExists(a.k)).forEach(a => { const s = pmSplitKey(a.k); projectEmployeesForMonth(s.g, s.p, (typeof latestOtMk === 'function' ? latestOtMk() : '')).forEach(x => set.add(x)); });
    const gsel = edit ? `<select onchange="pmSetGroup('${c}',this.value)"><option value="">Chưa phân nhóm</option><option value="CS"${catGroupOf(e) === 'CS' ? ' selected' : ''}>CS</option><option value="PB"${catGroupOf(e) === 'PB' ? ' selected' : ''}>Project Base</option></select>` : `<span class="pm-tag pm-${catGroupOf(e) || 'x'}" style="margin-left:0">${cE(pmTeamLabel(e))}</span>`;
    return `<tr${e.status === 'left' ? ' style="opacity:.55"' : ''}><td style="color:var(--text3)">${n + 1}</td><td><b>${cE(e.name)}</b><div style="font-size:11px;color:var(--text3)">${cE(e.code)}${e.dept ? ' · ' + cE(e.dept) : ''}${e.status === 'left' ? ' · đã nghỉ việc' : ''}</div></td><td>${gsel}</td>
      <td>${chips || '<span style="color:var(--text3);font-size:12px">Chưa gán dự án</span>'}${edit ? `<div style="margin-top:6px"><button class="btn" style="padding:3px 10px;font-size:12px" onclick="catAssignDialog('${c}')">＋ Gán dự án</button></div>` : ''}</td>
      <td style="text-align:right">${set.size}</td>${edit ? `<td><button class="btn" style="padding:3px 9px;color:#C0392B" onclick="pmRemove('${c}')" title="Bỏ khỏi danh bạ PM">Bỏ PM</button></td>` : ''}</tr>`;
  }).join('');
  return `<div class="card"><div class="action-row">${edit ? '<button class="btn btn-primary" onclick="catAddPmDialog()">＋ Thêm PM</button><button class="btn" onclick="catImportDialog()" title="Gom tên PM đang gõ tay ở Action Plan / PU Delivery">⬇ Nhập từ Action Plan / PU</button>' : ''}
      ${chip('all', 'Tất cả')}${chip('CS', 'CS')}${chip('PB', 'Project Base')}${chip('none', 'Chưa phân nhóm')}
      <input type="text" placeholder="Tìm PM…" value="${cE(catQ)}" oninput="catQ=this.value;catRefocus(this)" style="width:160px"></div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:8px;line-height:1.6">Mỗi PM thuộc <b>1 nhóm</b> (CS hoặc Project Base). Một PM nắm nhiều dự án; một dự án có thể nhiều PM (mảng <b>E</b> / <b>M</b>). Sửa ở đây thì Action Plan, Nhân lực, PU Delivery, Tiến độ, OT tự cập nhật.${edit ? '' : ' (Chỉ Quản lý/Admin chỉnh sửa.)'}</div></div>
    ${noPm.length ? `<div class="card" style="border-left:4px solid #E8A33D;font-size:12.5px"><b>${noPm.length} dự án chưa có PM:</b> ${noPm.map(x => cE(x.p)).join(' · ')}</div>` : ''}
    <div class="card"><div class="pg-tblw"><table class="pg-tbl"><thead><tr><th>#</th><th style="text-align:left">Tên PM</th><th style="text-align:left">Nhóm</th><th style="text-align:left">Project name</th><th style="text-align:right">Nhân sự</th>${edit ? '<th></th>' : ''}</tr></thead>
      <tbody>${tr || `<tr><td colspan="${edit ? 6 : 5}" style="text-align:center;padding:24px;color:var(--text2)">Chưa có PM. ${edit ? 'Bấm <b>＋ Thêm PM</b> hoặc <b>⬇ Nhập từ Action Plan / PU</b>.' : ''}</td></tr>`}</tbody></table></div></div>`;
}
function catProjTab(edit) {
  const projs = pmAllProjects().filter(x => x.p !== UNASSIGNED_PROJ).sort((a, b) => a.p.localeCompare(b.p));
  const pms = pmList().filter(e => e.status !== 'left').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const mk = (typeof latestOtMk === 'function') ? latestOtMk() : '';
  const tr = projs.map((x, n) => {
    const who = pmOfProject(x.g, x.p), id = x.k.replace(/[^A-Za-z0-9]/g, '_');
    const chips = who.map(w => `<span class="cat-chip">${cE(w.name)} <span class="pm-tag" style="background:#8a8f98;color:#fff;margin-left:2px">${w.d || 'E+M'}</span> ${w.teams.map(t => `<span class="pm-tag pm-${t}" style="margin-left:2px">${PM_TEAMS[t]}</span>`).join('')}${edit ? `<button class="cat-x" title="Bỏ PM khỏi dự án" onclick="pmUnassignKey('${cJ(w.code)}','${cJ(x.k)}','${w.d}')">✕</button>` : ''}</span>`).join('');
    return `<tr><td style="color:var(--text3)">${n + 1}</td><td><b>${cE(x.p)}</b><div style="font-size:11px;color:var(--text3)">${cE(x.g)}</div></td>
      <td>${chips || '<span style="color:#E8A33D;font-size:12px">Chưa có PM</span>'}${edit && pms.length ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap"><select id="catPmSel_${id}" style="max-width:170px"><option value="">＋ Gán PM…</option>${pms.map(e => `<option value="${cE(e.code)}">${cE(e.name)}</option>`).join('')}</select><select id="catPmDisc_${id}">${Object.keys(PM_DISC).map(d => `<option value="${d}">${PM_DISC[d]}</option>`).join('')}</select><button class="btn" style="padding:3px 10px" onclick="catAddPmToProject('${cJ(x.k)}')">Gán</button></div>` : ''}</td>
      <td style="text-align:right">${projectEmployeesForMonth(x.g, x.p, mk).length}</td>${edit ? `<td style="white-space:nowrap"><button class="btn" style="padding:2px 8px;font-size:11px" onclick="catRenameProject('${cJ(x.g)}','${cJ(x.p)}')">Đổi tên</button> <button class="btn btn-danger" style="padding:2px 8px;font-size:11px" onclick="catDeleteProject('${cJ(x.g)}','${cJ(x.p)}')">Xoá</button></td>` : ''}</tr>`;
  }).join('');
  return `<div class="card"><div class="action-row">${edit ? '<button class="btn btn-primary" onclick="catPromptAddProject()">＋ Thêm dự án</button>' : ''}<span style="font-size:12px;color:var(--text2)">${projs.length} dự án (HCM-EC). Đổi tên / xoá dự án ở đây thì mọi trang khác đổi theo.</span></div></div>
    <div class="card"><div class="pg-tblw"><table class="pg-tbl"><thead><tr><th>#</th><th style="text-align:left">Project name</th><th style="text-align:left">PM — Nhóm</th><th style="text-align:right">Nhân sự</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${tr}</tbody></table></div></div>`;
}
function catStaffTab(edit) {
  const all = rosterList(), ot = all.filter(e => e.status === 'ot').length, pms = pmList().length;
  return `<div class="card"><div style="font-size:13px;line-height:1.8">Danh sách nhân viên HCM (mã, họ tên, phòng ban, dự án) quản lý ở <b>Nhân lực → Danh sách nhân viên HCM</b> — đây là nguồn chung về nhân viên.<br>
    Hiện có <b>${ot}</b> nhân viên đang tính OT, trong đó <b>${pms}</b> người là PM. Nhân sự của từng dự án (và lịch sử chuyển dự án theo chu kỳ OT) quản lý ở <b>Action Plan → Kế hoạch nhân sự</b>.</div>
    <div class="action-row" style="margin-top:10px"><button class="btn btn-primary" onclick="goPage('roster')">Mở danh sách nhân viên</button><button class="btn" onclick="goPage('action')">Mở Action Plan</button></div></div>`;
}
function renderCatalog() {
  const box = document.getElementById('catBody'); if (!box) return;
  const edit = isManager();
  box.innerHTML = catTabs() + (catTab === 'proj' ? catProjTab(edit) : catTab === 'staff' ? catStaffTab(edit) : catPmTab(edit));
}
function catRefocus(inp) { const pos = inp.selectionStart; renderCatalog(); const ni = document.querySelector('#catBody input[type=text]'); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} } }

// Nhân lực → danh sách NV: thêm PM / nhóm vào ô "Dự án"
function catRosterExtra(e, proj) {
  const bits = [];
  if (e.pm) bits.push(`<span class="pm-tag pm-${catGroupOf(e) || 'x'}" style="margin-left:0">PM${catGroupOf(e) ? ' · ' + PM_TEAMS[catGroupOf(e)] : ''}</span>`);
  const n = proj ? pmNames(proj) : ''; if (n) bits.push(`<div style="font-size:10.5px;color:var(--text2)">PM: ${cE(n)}</div>`);
  return bits.join('');
}
