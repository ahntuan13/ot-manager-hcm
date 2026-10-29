// ============================================================
//  TIẾN ĐỘ DỰ ÁN — lập tiến độ theo form MS Project (WBS nhiều cấp, Duration, Start/Finish, Predecessors FS/SS/FF/SF + lag, % hoàn thành)
//  + biểu đồ Gantt, liên kết với PU Delivery (hàng về site hiện thành mốc trên Gantt).
//  Mỗi dự án 1 doc Firestore "prog_<tên dự án>":  { name, start, tasks:[{u,lvl,name,dur,start,pred:[{u,t,lag}],pct,puLink,note}], at }
//  Lịch: 7 ngày/tuần (đúng như file MS Project mẫu). Ngày bắt đầu/kết thúc của task có predecessor được TỰ TÍNH.
// ============================================================
const PROGRESS_ADMIN_ONLY = false;                      // true = chỉ Admin thấy; Quản lý/User thấy thông báo "đang xây dựng". Mở cho mọi người → đổi thành false.
const canSeeProgress = () => !PROGRESS_ADMIN_ONLY || (typeof isAdmin === 'function' && isAdmin());
const canEditProgress = () => true;                      // mở cho mọi tài khoản đăng nhập (Firestore rules đã cho phép ghi prog_*)
const PROG_KEY = 'ot_manager_prog_v1';
let PROG_DB = {};
function loadProgDb() { try { const r = localStorage.getItem(PROG_KEY); if (r) PROG_DB = JSON.parse(r) || {}; } catch (e) {} }
function saveProgDb() { try { localStorage.setItem(PROG_KEY, JSON.stringify(PROG_DB)); } catch (e) {} if (typeof cloudTouch === 'function') cloudTouch(); }
loadProgDb();


// ── Tiện ích ngày (số nguyên = số ngày kể từ 1970-01-01, không lệch múi giờ) ──
const pgN = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN; };
const pgIso = n => new Date(n * 86400000).toISOString().slice(0, 10);
const pgDow = n => new Date(n * 86400000).getUTCDay();
const PG_DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function pgFmt(n, wd) { const d = new Date(n * 86400000); return (wd ? PG_DOW[d.getUTCDay()] + ' ' : '') + `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`; }
const pgToday = () => pgN(typeof puToday === 'function' ? puToday() : new Date().toISOString().slice(0, 10));
const pgEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let pgUid = 0;
const pgNewUid = () => 't' + Date.now().toString(36) + (pgUid++).toString(36) + Math.random().toString(36).slice(2, 5);

// ── Predecessor: chữ ⇄ cấu trúc ("5", "6SS+3d", "7FF-2d") ──
function pgPredText(pr, t) {
  const idx = {}; pr.tasks.forEach((x, i) => idx[x.u] = i);
  return (t.pred || []).filter(p => idx[p.u] !== undefined).map(p => (idx[p.u] + 1) + (p.t === 'FS' && !p.lag ? '' : p.t) + (p.lag ? (p.lag > 0 ? '+' : '') + p.lag + 'd' : '')).join(',');
}
function pgParsePred(txt, pr, selfIdx) {
  const out = [];
  String(txt || '').split(/[,;]/).forEach(s => {
    s = s.trim(); if (!s) return;
    const m = /^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\s*\d+(?:[.,]\d+)?)?\s*(?:d|ngày|days?)?$/i.exec(s); if (!m) return;
    const i = parseInt(m[1], 10) - 1; if (i < 0 || i >= pr.tasks.length || i === selfIdx) return;
    out.push({ u: pr.tasks[i].u, t: (m[2] || 'FS').toUpperCase(), lag: m[3] ? Math.round(parseFloat(m[3].replace(/\s/g, '').replace(',', '.'))) : 0 });
  });
  return out;
}

// ── Liên kết PU Delivery ──
function pgPuItems(name) {
  if (typeof puItems !== 'function') return [];
  try { return puItems().filter(x => puProjOf(x) === name); } catch (e) { return []; }
}
function pgPuInfo(name) {
  const items = pgPuItems(name), today = puToday(), c = { total: items.length, done: 0, late: 0, soon7: 0, soon30: 0, make: 0, other: 0 };
  let lastEst = '', lastAct = '';
  items.forEach(x => {
    const s = puStatus(x, today);
    if (s.k === 'done') { c.done++; if (x.actual > lastAct) lastAct = x.actual; } else { if (s.k === 'late') c.late++; else if (s.k === 'soon7') c.soon7++; else if (s.k === 'soon30') c.soon30++; else if (s.k === 'make') c.make++; else c.other++; const e = puEst(x); if (e && e > lastEst) lastEst = e; }
  });
  c.items = items; c.lastEst = lastEst;
  c.date = lastEst ? pgN(lastEst) : (c.total && c.done === c.total && lastAct ? pgN(lastAct) : NaN);   // ngày hàng cuối cùng về site
  return c;
}

// % hoàn thành: nhập tay thì giữ nguyên; chưa nhập tay thì tự tính — Finish đã qua / bằng hôm nay = 100%
const pgManual = t => t.pctM === true || (t.pctM === undefined && (+t.pct || 0) > 0);
function pgAutoPct(t, fin, today) {
  const v = Math.max(0, Math.min(100, +t.pct || 0));
  if (pgManual(t) || t.hold) return v;
  return fin <= today ? 100 : v;
}
// ── Tính lịch (forward pass) ──
function progCalc(pr) {
  const T = pr.tasks, n = T.length, idx = {}; T.forEach((t, i) => idx[t.u] = i);
  const P0 = pgN(pr.start) || pgToday();
  const end = T.map((t, i) => { let j = i + 1; while (j < n && T[j].lvl > t.lvl) j++; return j; });
  const C = new Array(n), st = new Array(n).fill(0);
  const puInfo = T.some(t => t.puLink) ? pgPuInfo(pr.name) : null, TD = pgToday();
  function calc(i) {
    if (st[i] === 2) return C[i];
    if (st[i] === 1) return C[i] || { s: P0, f: P0, dur: 0, pct: 0, sum: false, cyc: true };   // vòng lặp predecessor → bỏ qua
    st[i] = 1; const t = T[i], sum = end[i] > i + 1;
    if (sum) {
      let s = Infinity, f = -Infinity, w = 0, pw = 0, pp = 0;
      for (let j = i + 1; j < end[i]; j++) {
        const c = calc(j); if (c.nodata) continue;   // mốc PU chưa có hàng → không kéo giãn nhóm
        s = Math.min(s, c.s); f = Math.max(f, c.f);
        if (!c.sum) { const wt = Math.max(c.dur, 0); w += wt; pw += wt * c.pct; pp += wt * c.plan; }
      }
      C[i] = { s, f, dur: f - s + 1, pct: w ? Math.round(pw / w) : 0, plan: w ? pp / w : (TD >= s ? 1 : 0), sum: true };
    } else {
      const dur = Math.max(0, Math.round(+t.dur || 0)), span = Math.max(dur, 1);
      let s = -Infinity;
      (t.pred || []).forEach(p => {
        const j = idx[p.u]; if (j === undefined || j === i) return;
        const pc = calc(j), lag = +p.lag || 0; let c;
        if (p.t === 'SS') c = pc.s + lag; else if (p.t === 'FF') c = pc.f + lag - (span - 1); else if (p.t === 'SF') c = pc.s + lag - (span - 1); else c = pc.f + 1 + lag;
        if (c > s) s = c;
      });
      if (s === -Infinity) { const m = pgN(t.start); s = isNaN(m) ? P0 : m; }
      if (t.puLink && puInfo && !isNaN(puInfo.date) && puInfo.date > s) s = puInfo.date;   // hàng về site muộn hơn kế hoạch → mốc bị đẩy theo PU
      C[i] = { s, f: s + span - 1, dur, plan: dur > 0 ? Math.max(0, Math.min(1, (TD - s + 1) / dur)) : (TD >= s ? 1 : 0), pct: pgAutoPct(t, s + span - 1, TD), sum: false, ms: dur === 0, nodata: !!(t.puLink && !(t.pred || []).length && puInfo && isNaN(puInfo.date)) };
    }
    st[i] = 2; return C[i];
  }
  for (let i = 0; i < n; i++) calc(i);
  C.end = end; C.idx = idx; return C;
}

// ── Trạng thái công việc ──
const PG_ST = { wait: ['Chưa bắt đầu', '#8fa3c4'], run: ['Đang thực hiện', '#2D6CDF'], done: ['Hoàn thành', '#2E7D32'], late: ['Trễ', '#C0392B'], hold: ['Tạm dừng', '#8a8f98'] };
function progStat(t, c, today) {
  if (c.pct >= 100) return 'done'; if (t.hold) return 'hold'; if (c.f < today) return 'late';
  if (c.pct > 0) return 'run'; if (c.s < today) return 'late'; return c.s <= today ? 'run' : 'wait';
}
const PG_COL = { run: '#2E7D32', near: '#E8A33D', over: '#C0392B', wait: '#2D6CDF', done: '#6b7280' };
// Sức khoẻ dự án: so % thực tế với % kế hoạch (theo thời gian) — như "Tiến độ kế hoạch / thực tế" của FastWork
function progHealth(sm) {
  if (sm.k === 'done') return ['Hoàn thành', '#6b7280', 'done'];
  if (sm.k === 'wait') return ['Chưa bắt đầu', '#2D6CDF', 'wait'];
  if (sm.k === 'over') return ['Quá hạn', '#C0392B', 'late'];
  const gap = sm.plan - sm.root.pct;
  if (gap > 15) return ['Chậm trễ', '#C0392B', 'late'];
  if (gap > 5) return ['Rủi ro', '#E8A33D', 'risk'];
  return ['Đúng tiến độ', '#2E7D32', 'ok'];
}

// ── Chỉ số tổng quan 1 dự án ──
function progSummary(pr) {
  const C = progCalc(pr), today = pgToday(), root = C[0] || { s: today, f: today, pct: 0, plan: 0 };
  const total = root.f - root.s + 1, elapsed = Math.max(0, Math.min(total, today - root.s + 1));
  const exp = total > 0 ? Math.round(elapsed * 100 / total) : 0, plan = Math.round((root.plan || 0) * 100);
  let k = 'run', label = '';
  const remain = root.f - today;
  if (root.pct >= 100) { k = 'done'; label = 'Hoàn thành'; }
  else if (today < root.s) { k = 'wait'; label = 'Bắt đầu sau ' + (root.s - today) + ' ngày'; }
  else if (remain < 0) { k = 'over'; label = 'Quá hạn ' + (-remain) + ' ngày'; }
  else { k = remain <= 14 ? 'near' : 'run'; label = 'Còn ' + (remain + 1) + ' ngày'; }
  const cur = [], overdue = [], cnt = { wait: 0, run: 0, done: 0, late: 0, hold: 0 };
  pr.tasks.forEach((t, i) => {
    const c = C[i]; if (c.sum || c.nodata) return;
    const st = progStat(t, c, today); cnt[st]++;
    if (st === 'late') overdue.push(i); else if (st === 'run') cur.push(i);
  });
  const stages = []; pr.tasks.forEach((t, i) => { if (t.lvl === 1) stages.push(i); });
  const sm = { C, root, remain, total, exp, plan, k, label, cur, overdue, cnt, stages, pu: pgPuInfo(pr.name) };
  sm.health = progHealth(sm); return sm;
}
// Cập nhật tiến độ 1 việc: tự ghi ngày thực tế + nhật ký (như hộp "Cập nhật tiến độ" của FastWork)
function progApply(pr, i, o) {
  const t = pr.tasks[i], old = t.pct || 0, today = typeof puToday === 'function' ? puToday() : pgIso(pgToday());
  if (o.pct != null) { t.pct = Math.max(0, Math.min(100, Math.round(+o.pct) || 0)); t.pctM = true; }
  if (o.hold != null) t.hold = !!o.hold; if (!t.hold) delete t.hold;
  if (t.pct > 0 && !t.as) t.as = today;
  if (t.pct >= 100 && !t.af) t.af = today; if (t.pct < 100 && o.pct != null && old >= 100) t.af = '';
  if (o.pct != null && t.pct === 0 && old > 0) t.as = '';
  if ((o.pct != null && t.pct !== old) || o.note) {
    (t.log = t.log || []).push({ at: Date.now(), by: (window.CLOUD_USER && window.CLOUD_USER.name) || (typeof isAdmin === 'function' && isAdmin() ? 'Admin' : 'User'), pct: t.pct, hold: !!t.hold, note: String(o.note || '').slice(0, 200) });
    if (t.log.length > 20) t.log.splice(0, t.log.length - 20);
  }
}

// ── Trạng thái giao diện ──
const pgHash = () => { const m = /[#&]prog=([^&]+)/.exec(location.hash || ''); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } };
let progSel = '', progView = 'dash', progZoom = 'day', progCompact = (typeof innerWidth !== 'undefined' && innerWidth < 1700), progShowPu = true, progPuOpen = null;
let progSolo = !!pgHash(), progQ = '', progFilter = 'all', progSort = 'remain', progStF = 'all', progCalM = '';
const progCollapsed = new Set();
if (progSolo && document.body) document.body.classList.add('prog-solo');
document.addEventListener('DOMContentLoaded', () => { if (pgHash()) document.body.classList.add('prog-solo'); });
const PG_VIEWS = [['dash', '📊 Tổng quan'], ['list', '📋 Danh sách'], ['gantt', '📅 Tiến độ (Gantt)'], ['kanban', '🗂 Bảng'], ['res', '👥 Nguồn lực'], ['cal', '🗓 Lịch biểu'], ['pu', '🚚 Giao hàng PU']];

// Gọi sau khi dữ liệu Cloud tải xong: nếu tab được mở bằng đường dẫn #prog=<tên dự án> thì vào thẳng dự án đó.
function progBoot() {
  const n = pgHash(); if (!n) return;
  document.body.classList.add('prog-solo'); progSolo = true; progCompact = innerWidth < 1280;
  if (!canSeeProgress()) { goPage('progress'); return; }
  if (PROG_DB[n]) { progSel = n; document.title = n + ' — Tiến độ'; } else toast('⚠️ Không thấy tiến độ của dự án "' + n + '".');
  goPage('progress');
}
function progOpenTab(name) {
  if (!PROG_DB[name]) return;
  const url = location.href.split('#')[0] + '#prog=' + encodeURIComponent(name);
  const w = window.open(url, '_blank');
  if (!w) { progSel = name; progSolo = true; document.body.classList.add('prog-solo'); renderProgress(); }   // trình duyệt chặn cửa sổ mới → mở ngay trong trang
}
// Lưu lên cloud xong mới đóng tab (đóng ngay thì dữ liệu chưa kịp gửi → mất thay đổi)
async function progSaveClose() {
  try { if (typeof cloudFlushNow === 'function') await cloudFlushNow(false); await new Promise(r => setTimeout(r, 700)); if (typeof cloudFlushNow === 'function') await cloudFlushNow(false); } catch (e) {}
  progBack();
}
function progBack() {
  if (window.opener && pgHash()) { window.close(); if (!window.closed) return; }
  history.replaceState(null, '', location.pathname + location.search); progSolo = false; progSel = ''; document.body.classList.remove('prog-solo'); document.title = 'HCM-MD'; renderProgress();
}
function progSwitch(name) { progSel = PROG_DB[name] ? name : ''; if (pgHash()) history.replaceState(null, '', '#prog=' + encodeURIComponent(name)); document.title = name + ' — Tiến độ'; progPuOpen = null; renderProgress(); }
function progSetView(v) { progView = v; renderProgress(); }

function renderProgress() {
  const box = document.getElementById('progBody'); if (!box) return;
  document.body.classList.toggle('prog-solo', progSolo && canSeeProgress());
  if (!canSeeProgress()) {
    box.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px"><div style="font-size:46px">🚧</div><div style="font-size:18px;font-weight:800;margin:8px 0 4px">Tính năng này đang được xây dựng</div><div style="color:var(--text2);font-size:13px">Tiến độ dự án sẽ sớm được mở cho Quản lý và Người dùng.<br><i>This feature is under construction.</i></div></div>`;
    return;
  }
  if (progSel && !PROG_DB[progSel]) progSel = '';
  if (progSolo && progSel) { progDestroyCharts(); box.innerHTML = progSoloHtml(progSel); progAfterView(); return; }
  progSolo = false; document.body.classList.remove('prog-solo');
  box.innerHTML = progMainHtml();
}

// ── Trang chính: thẻ từng dự án (giống "Quản lý tiến độ đa dự án") ──
function progMainHtml() {
  const names = Object.keys(PROG_DB).sort(), edit = canEditProgress();
  let sums = names.map(n => ({ n, s: progSummary(PROG_DB[n]) }));
  const cnt = k => sums.filter(x => x.s.health[2] === k).length;
  const lateTasks = sums.reduce((a, x) => a + x.s.overdue.length, 0), puLate = sums.reduce((a, x) => a + x.s.pu.late, 0);
  const q = progQ.trim().toLowerCase();
  let list = sums.filter(x => (progFilter === 'all' || x.s.health[2] === progFilter) && (!q || x.n.toLowerCase().includes(q)));
  const ord = { late: 0, risk: 1, ok: 2, wait: 3, done: 4 };
  list.sort((a, b) => progSort === 'name' ? a.n.localeCompare(b.n) : progSort === 'health' ? ord[a.s.health[2]] - ord[b.s.health[2]] || a.s.remain - b.s.remain : (a.s.k === 'done') - (b.s.k === 'done') || a.s.remain - b.s.remain);
  let h = `<div class="mp-kpi">
    <div class="mk"><b>${names.length}</b><span>Dự án có tiến độ</span></div>
    <div class="mk"><b style="color:#2E7D32">${cnt('ok')}</b><span>Đúng tiến độ</span></div>
    <div class="mk"><b style="color:#E8A33D">${cnt('risk')}</b><span>Rủi ro</span></div>
    <div class="mk"><b style="color:#C0392B">${cnt('late')}</b><span>Chậm trễ / quá hạn</span></div>
    <div class="mk"><b style="color:#C0392B">${lateTasks}</b><span>Công việc trễ hạn</span></div>
    <div class="mk"><b style="color:#C0392B">${puLate}</b><span>Hàng PU trễ tiến độ</span></div></div>`;
  h += `<div class="card"><div class="action-row">${edit ? `<button class="btn btn-primary" onclick="progNewProject()">＋ Lập tiến độ cho dự án</button>` : ''}
    <input type="text" placeholder="Tìm dự án…" value="${pgEsc(progQ)}" oninput="progQ=this.value;progRerenderCards(this)" style="width:200px">
    <select onchange="progFilter=this.value;renderProgress()"><option value="all">Tất cả tình trạng</option><option value="late"${progFilter === 'late' ? ' selected' : ''}>Chậm trễ / quá hạn</option><option value="risk"${progFilter === 'risk' ? ' selected' : ''}>Rủi ro</option><option value="ok"${progFilter === 'ok' ? ' selected' : ''}>Đúng tiến độ</option><option value="wait"${progFilter === 'wait' ? ' selected' : ''}>Chưa bắt đầu</option><option value="done"${progFilter === 'done' ? ' selected' : ''}>Hoàn thành</option></select>
    <select onchange="progSort=this.value;renderProgress()"><option value="remain">Sắp xếp: còn ít ngày nhất</option><option value="health"${progSort === 'health' ? ' selected' : ''}>Sắp xếp: chậm nhất</option><option value="name"${progSort === 'name' ? ' selected' : ''}>Sắp xếp: tên dự án</option></select>
    <span style="font-size:12px;color:var(--text2)">Bấm vào dự án để mở trong tab mới.</span></div></div>`;
  if (!names.length) h += `<div class="card" style="text-align:center;color:var(--text2);padding:30px">Chưa có dự án nào được lập tiến độ.${edit ? ' Bấm <b>＋ Lập tiến độ cho dự án</b> để bắt đầu.' : ''}</div>`;
  else h += `<div class="pg-pcs" id="progCards">${list.map(({ n, s }) => progCard(n, s)).join('') || '<div class="card" style="color:var(--text2)">Không có dự án phù hợp.</div>'}</div>`;
  return h;
}
function progRerenderCards(inp) {   // gõ tìm kiếm: chỉ vẽ lại phần thẻ, giữ nguyên ô đang gõ
  const box = document.getElementById('progBody'); if (!box) return;
  const pos = inp.selectionStart; renderProgress(); const ni = box.querySelector('input[type=text]'); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} }
}
function pgDonut(pct, col, big, small) {
  const r = 38, C = 2 * Math.PI * r, d = Math.max(0, Math.min(100, pct)) * C / 100;
  return `<div class="pg-donut"><svg viewBox="0 0 96 96" width="104" height="104"><circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${d} ${C}" transform="rotate(-90 48 48)"/></svg><div><b>${big}</b><span>${small}</span></div></div>`;
}
function progCard(n, s) {
  const pr = PROG_DB[n], root = s.root, hl = s.health, pm = pmNamesLoose(n) || pr.pm || (typeof puApPm === 'function' ? puApPm(n) : '') || '';
  const span = Math.max(1, root.f - root.s + 1), today = pgToday();
  const lanes = s.stages.slice(0, 5).map(i => {
    const c = s.C[i], l = (c.s - root.s) * 100 / span, w = Math.max(1.5, (c.f - c.s + 1) * 100 / span);
    return `<div class="pg-lane" title="${pgEsc(pr.tasks[i].name)} · ${pgFmt(c.s)} → ${pgFmt(c.f)} · ${c.pct}%"><span class="pg-lane-n">${pgEsc(pr.tasks[i].name)}</span><div class="pg-lane-t"><i style="left:${l}%;width:${w}%"><b style="width:${c.pct}%"></b></i></div></div>`;
  }).join('');
  const p = s.pu, cn = s.cnt;
  const pu = p.total ? `<span class="pg-chip" style="${p.late ? 'background:#fdecea;color:#C0392B' : ''}">🚚 PU ${p.done}/${p.total} đã giao${p.late ? ' · ' + p.late + ' trễ' : ''}${p.soon7 ? ' · ' + p.soon7 + ' sắp giao' : ''}</span>` : '';
  const updated = pr.at ? new Date(pr.at) : null, pad = x => String(x).padStart(2, '0');
  return `<div class="pg-pc" data-p="${pgEsc(n)}" onclick="progOpenTab(this.dataset.p)" title="Bấm để mở trong tab mới">
    <div class="pg-pc-l">
      <div class="pg-pc-t"><b>${pgEsc(n)}</b><span class="pg-open">↗ Mở tab mới</span></div>
      <div class="pg-pc-sub"><i style="background:${hl[1]}"></i>${pgEsc(hl[0])}${pm ? ` · PM: ${pgEsc(pm)}` : ''}${pr.code ? ` · Mã: ${pgEsc(pr.code)}` : ''}</div>
      <div class="pg-pc-f">
        <div><u>Bắt đầu</u><em style="background:#e3edff;color:#2D6CDF">${pgFmt(root.s)}</em></div>
        <div><u>Kết thúc</u><em style="background:#fde3e3;color:#C0392B">${pgFmt(root.f)}</em></div>
        <div><u>Thời gian</u><em>${s.total} ngày</em></div>
        <div><u>Tình trạng</u><em style="background:${hl[1]}22;color:${hl[1]}">${pgEsc(hl[0])}</em></div>
      </div>
      <div class="pg-lanes">${lanes}</div>
      <div class="pg-chips"><span class="pg-chip">Việc: ${cn.done}/${cn.wait + cn.run + cn.done + cn.late + cn.hold} xong</span>${cn.run ? `<span class="pg-chip" style="background:#e3edff;color:#2D6CDF">${cn.run} đang làm</span>` : ''}${cn.late ? `<span class="pg-chip" style="background:#fdecea;color:#C0392B">⚠ ${cn.late} trễ hạn</span>` : ''}${pu}</div>
      ${updated ? `<div class="pg-pc-up">Cập nhật lúc ${pad(updated.getHours())}:${pad(updated.getMinutes())} ${pad(updated.getDate())}/${pad(updated.getMonth() + 1)}/${updated.getFullYear()}</div>` : ''}
    </div>
    <div class="pg-pc-r">
      ${pgDonut(root.pct, hl[1], s.k === 'done' ? '✔' : (s.k === 'over' ? s.remain : s.k === 'wait' ? '—' : s.remain + 1), s.k === 'done' ? 'xong' : s.k === 'over' ? 'ngày trễ' : s.k === 'wait' ? 'chưa bắt đầu' : 'ngày còn lại')}
      <div class="pg-2bar"><div><span>Tiến độ kế hoạch</span><b>${s.plan}%</b></div><div class="pg-bb"><i style="width:${s.plan}%;background:#2D6CDF"></i></div>
        <div><span>Tiến độ thực tế</span><b>${root.pct}%</b></div><div class="pg-bb"><i style="width:${root.pct}%;background:#F0A020"></i></div></div>
    </div></div>`;
}

// ── Trang dự án (mở ở tab riêng): thanh tiêu đề + các giao diện ──
function progSoloHtml(name) {
  const pr = PROG_DB[name], sm = progSummary(pr), hl = sm.health, names = Object.keys(PROG_DB).sort(), edit = canEditProgress();
  const tabs = PG_VIEWS.map(([k, l]) => `<button class="pg-tab${progView === k ? ' on' : ''}" onclick="progSetView('${k}')">${l}</button>`).join('');
  let body = '';
  try {
    body = progView === 'list' ? progViewList(name, sm) : progView === 'gantt' ? progGanttHtml(name) : progView === 'kanban' ? progViewKanban(name, sm)
      : progView === 'res' ? progViewRes(name, sm) : progView === 'cal' ? progViewCal(name, sm) : progView === 'pu' ? progViewPu(name, sm) : progViewDash(name, sm);
  } catch (e) { console.error(e); body = '<div class="card">Lỗi hiển thị: ' + pgEsc(e.message || e) + '</div>'; }
  return `<div class="pg-solo">
    <div class="pg-solo-h">
      <button class="btn" onclick="progBack()">← ${pgHash() ? 'Đóng tab' : 'Danh sách dự án'}</button>
      <div class="pg-solo-t"><b>${pgEsc(name)}</b><span class="pg-badge" style="background:${hl[1]}22;color:${hl[1]}">${pgEsc(hl[0])}</span><span class="pg-solo-d">${pgFmt(sm.root.s)} → ${pgFmt(sm.root.f)} · ${pgEsc(sm.label)} · ${sm.root.pct}% (kế hoạch ${sm.plan}%)</span></div>
      <select onchange="progSwitch(this.value)" title="Đổi sang dự án khác">${names.map(n => `<option value="${pgEsc(n)}"${n === name ? ' selected' : ''}>${pgEsc(n)}</option>`).join('')}</select>
      <button class="btn" onclick="progExportXlsx()">⬇ Excel</button><button class="btn" onclick="progExportXml()" title="Mở bằng MS Project">⬇ XML</button><button class="btn" onclick="progPdfDialog()" title="Xuất PDF khổ ngang, đầy đủ chi tiết">⬇ PDF</button>
      ${edit ? `<label class="btn" style="cursor:pointer" title="Nhập từ MS Project (.mpp), XML hoặc Excel — thay toàn bộ tiến độ hiện tại">⬆ Nhập MPP<input type="file" accept=".mpp,.xml,.xlsx,.xls" style="display:none" onchange="progImportFile(this)"></label><button class="btn" onclick="progTemplateXlsx()">⬇ File mẫu</button><button class="btn" onclick="progRename()">Đổi ngày khởi công</button><button class="btn" onclick="progProjInfo()">⚙ Thông tin</button><button class="btn" onclick="progMergeDialog()" title="Đưa dự án nhỏ này vào làm một nhóm trong dự án lớn (vd WSE → CS1)">🔗 Gán vào dự án lớn</button><button class="btn" style="color:#C0392B" onclick="progDelete()">🗑</button>` : ''}
    </div>
    <div class="pg-tabs">${tabs}</div>
    <div id="progView">${body}</div></div>`;
}
function progMergeDialog() {
  const pr = PROG_DB[progSel]; if (!pr || !canEditProgress()) return;
  const others = Object.keys(PROG_DB).filter(n => n !== progSel).sort();
  if (!others.length) { toast('⚠️ Chưa có dự án lớn nào để gán vào. Hãy tạo/upload dự án lớn trước.'); return; }
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:6px">Gán vào dự án lớn</div>
    <div style="font-size:12.5px;color:#6b7280;margin-bottom:10px">Toàn bộ ${pr.tasks.length} công việc của <b>${pgEsc(pr.name)}</b> sẽ thành một nhóm con trong dự án lớn. Dự án nhỏ này sẽ không còn là dự án riêng.</div>
    <label>Dự án lớn<select id="pgmTo">${others.map(n => `<option>${pgEsc(n)}</option>`).join('')}</select></label>
    <label>Tên nhóm trong dự án lớn<input id="pgmName" value="${pgEsc(pr.name)}"></label>
    <div class="action-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" onclick="progMergeRun()">Gán</button></div></div>`;
  document.body.appendChild(ov);
}
function progMergeRun() {
  const pr = PROG_DB[progSel], g = id => document.getElementById(id), to = PROG_DB[g('pgmTo').value]; if (!pr || !to) return;
  const gname = g('pgmName').value.trim() || pr.name, from = pr.name;
  const sub = pr.tasks.map(t => Object.assign({}, t, { lvl: t.lvl + 1 })); sub[0].name = gname;   // dòng gốc dự án nhỏ → nhóm con
  to.tasks = to.tasks.concat(sub); to.at = Date.now();
  delete PROG_DB[from]; progCloseModal(); saveProgDb(); toast(`✅ Đã gán "${gname}" vào dự án ${to.name}.`);
  progSwitch(to.name);
}
function progProjInfo() {
  const pr = PROG_DB[progSel]; if (!pr || !canEditProgress()) return;
  const have = new Set(Object.keys(PROG_DB)), avail = (typeof puProjects === 'function' ? puProjects().map(x => x.p) : []).filter(p => !have.has(p));
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:12px">Thông tin dự án</div>
    <label>Gán vào dự án (Action Plan / PU Delivery)<select id="pgiProj"><option value="${pgEsc(pr.name)}">${pgEsc(pr.name)} (hiện tại)</option>${avail.map(p => `<option>${pgEsc(p)}</option>`).join('')}<option value="__new__">＋ Đổi sang tên khác…</option></select></label>
    <label id="pgiNameL" style="display:none">Tên dự án<input id="pgiName" value="${pgEsc(pr.name)}"></label>
    <label>Quản lý dự án (PM)${pmNamesLoose(progSel) ? '<span style="font-weight:400;font-size:11px;color:var(--text3)"> — lấy từ Nhân lực → PM</span>' : ''}<input id="pgiPm" value="${pgEsc(pmNamesLoose(progSel) || pr.pm || (typeof puApPm === 'function' ? puApPm(progSel) : ''))}"${pmNamesLoose(progSel) ? ' disabled' : ''}></label>
    <label>Mã dự án<input id="pgiCode" value="${pgEsc(pr.code || '')}"></label>
    <div class="action-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" onclick="progInfoSave()">Lưu</button></div></div>`;
  document.body.appendChild(ov);
  const sel = document.getElementById('pgiProj'); sel.onchange = () => { document.getElementById('pgiNameL').style.display = sel.value === '__new__' ? 'flex' : 'none'; };
}
function progInfoSave() {
  const pr = PROG_DB[progSel], g = id => document.getElementById(id); if (!pr) return;
  let nn = g('pgiProj').value; if (nn === '__new__') nn = g('pgiName').value.trim();
  if (!nn) { toast('⚠️ Nhập tên dự án.'); return; }
  if (nn !== pr.name && PROG_DB[nn]) { toast('⚠️ Dự án "' + nn + '" đã có tiến độ.'); return; }
  if (!g('pgiPm').disabled) pr.pm = g('pgiPm').value.trim(); pr.code = g('pgiCode').value.trim();
  if (nn !== pr.name) { delete PROG_DB[pr.name]; pr.name = nn; PROG_DB[nn] = pr; }
  pr.at = Date.now(); progCloseModal(); saveProgDb(); toast('✅ Đã lưu thông tin dự án.'); progSaveClose();   // lưu xong tự đóng tab
}
function progOpen(name) { progSwitch(name); }


// ── Gantt ──
const PG_RH = 26;
function progVisible(pr) {
  const T = pr.tasks, vis = []; let hideBelow = Infinity;
  T.forEach((t, i) => {
    if (t.lvl > hideBelow) return; hideBelow = Infinity;
    vis.push(i);
    if (progCollapsed.has(t.u)) hideBelow = t.lvl;
  });
  return vis;
}
function progGanttHtml(name) {
  const pr = PROG_DB[name], sm = progSummary(pr), C = sm.C, today = pgToday(), edit = canEditProgress();
  const vis = progVisible(pr), T = pr.tasks;
  const pu = progShowPu ? sm.pu : null;
  const puRows = (pu && pu.total) ? pu.items.sort((a, b) => (puEst(a) || '9').localeCompare(puEst(b) || '9')) : [];
  const puExpanded = progPuOpen === null ? puRows.length <= 40 : progPuOpen;
  // phạm vi thời gian
  let minN = Infinity, maxN = -Infinity;
  vis.forEach(i => { minN = Math.min(minN, C[i].s); maxN = Math.max(maxN, C[i].f); });
  puRows.forEach(x => { [puEst(x), x.e0, x.actual].forEach(d => { const n = pgN(d); if (!isNaN(n)) { minN = Math.min(minN, n); maxN = Math.max(maxN, n); } }); });
  if (today >= minN - 30 && today <= maxN + 30) { minN = Math.min(minN, today); maxN = Math.max(maxN, today); }
  minN -= 3; maxN += 10;
  const pxd = progZoom === 'day' ? 24 : progZoom === 'week' ? 9 : 3, days = maxN - minN + 1, W = days * pxd;
  const X = n => (n - minN) * pxd;
  const cols = progCompact ? { id: 34, nm: 300, wh: 0, du: 0, st: 0, fn: 82, pc: 0, pd: 0, ac: edit ? 56 : 0 } : { id: 34, nm: 290, wh: 110, du: 58, st: 82, fn: 82, pc: 50, pd: 0, ac: edit ? 56 : 0 };
  const LW = Object.values(cols).reduce((a, b) => a + b, 0), HH = 46;
  const nrows = vis.length + (puRows.length ? 1 + (puExpanded ? puRows.length : 0) : 0), H = nrows * PG_RH;
  // header
  let hm = '', hd = '';
  for (let n = minN, last = -1; n <= maxN;) {
    const d = new Date(n * 86400000), y = d.getUTCFullYear(), m = d.getUTCMonth(), ms = Date.UTC(y, m, 1) / 86400000, me = Date.UTC(y, m + 1, 1) / 86400000 - 1;
    const a = Math.max(n, ms), b = Math.min(maxN, me);
    hm += `<div class="pg-hm" style="left:${X(a)}px;width:${(b - a + 1) * pxd}px">${pxd >= 9 ? `Tháng ${m + 1}/${y}` : `T${m + 1}/${String(y).slice(2)}`}</div>`; n = me + 1;
  }
  let grid = '';
  for (let n = minN; n <= maxN; n++) {
    const dw = pgDow(n), x = X(n);
    if (progZoom === 'day') {
      hd += `<div class="pg-hd1${dw === 0 || dw === 6 ? ' we' : ''}" style="left:${x}px;width:${pxd}px">${new Date(n * 86400000).getUTCDate()}</div>`;
      if (dw === 0 || dw === 6) grid += `<div class="pg-we" style="left:${x}px;width:${pxd}px"></div>`;
    } else if (progZoom === 'week' && dw === 1) hd += `<div class="pg-hd1" style="left:${x}px;width:${7 * pxd}px">${new Date(n * 86400000).getUTCDate()}</div>`;
    if (new Date(n * 86400000).getUTCDate() === 1) grid += `<div class="pg-ml" style="left:${x}px"></div>`;
  }
  const todayLine = (today >= minN && today <= maxN) ? `<div class="pg-today" style="left:${X(today) + pxd / 2}px"></div>` : '';
  // hàng
  const lc = (w, s, st) => w ? `<div class="pg-c" style="width:${w}px;${st || ''}">${s}</div>` : '';
  let rows = '', ri = 0; const rowOf = {};
  vis.forEach(i => {
    const t = T[i], c = C[i], sum = c.sum, stt = progStat(t, c, today), late = stt === 'late', done = stt === 'done';
    rowOf[i] = ri++;
    const toggle = sum ? `<span class="pg-tg" data-u="${pgEsc(t.u)}" onclick="progToggle(this.dataset.u)">${progCollapsed.has(t.u) ? '▸' : '▾'}</span>` : '<span class="pg-tg"></span>';
    const nm = `<div class="pg-c pg-nm${sum ? ' pg-sumrow' : ''}" style="width:${cols.nm}px;padding-left:${6 + t.lvl * 14}px" title="${pgEsc(t.name)}">${toggle}${t.puLink ? '🚚 ' : ''}<span ${edit ? `class="pg-edit" data-i="${i}" onclick="progEdit(+this.dataset.i)"` : ''}>${pgEsc(t.name)}</span></div>`;
    const pcCell = (!sum && edit) ? `<input type="number" min="0" max="100" value="${c.pct}" class="pg-pcin" data-i="${i}" onchange="progSetPct(+this.dataset.i,this.value)">` : c.pct + '%';
    const act = edit ? `<div class="pg-c" style="width:${cols.ac}px;gap:2px"><button class="pg-ib" title="Sửa / cấu trúc" data-i="${i}" onclick="progEdit(+this.dataset.i)">✎</button><button class="pg-ib" title="Thêm công việc bên dưới" data-i="${i}" onclick="progInsert(+this.dataset.i)">＋</button></div>` : '';
    rows += `<div class="pg-row${sum ? ' pg-sum' : ''}"><div class="pg-left" style="width:${LW}px">${lc(cols.id, i + 1, 'justify-content:center;color:var(--text3)')}${nm}${lc(cols.wh, pgEsc(t.who || ''), 'font-size:11px;color:var(--text2)')}${lc(cols.du, c.dur + (c.dur === 1 ? ' day' : ' days'))}${lc(cols.st, pgFmt(c.s, true))}${lc(cols.fn, pgFmt(c.f, true))}${lc(cols.pc, pcCell, 'justify-content:center')}${lc(cols.pd, pgEsc(pgPredText(pr, t)), 'font-size:11px;color:var(--text2)')}${act}</div>
      <div class="pg-tl" style="width:${W}px">${progBar(t, c, X(c.s), pxd, stt)}</div></div>`;
  });
  // đã biết hàng của mọi task → dựng đường mũi tên
  let svg = '';
  const pathFor = (j, i, x1, x2, ty) => {
    const rj = rowOf[j], ri2 = rowOf[i]; if (rj === undefined || ri2 === undefined) return '';
    const y1 = rj * PG_RH + PG_RH / 2, y2 = ri2 * PG_RH + PG_RH / 2, back = (ty === 'SS' || ty === 'SF') ? -7 : 7;
    const xm = ty === 'FS' ? (x2 >= x1 + 12 ? x1 + 6 : x2 - 8) : (ty === 'FF' ? Math.max(x1, x2) + 7 : Math.min(x1, x2) - 7);
    if (ty === 'FS' && x2 < x1 + 12) { const ym = (y1 + y2) / 2 + (y2 > y1 ? -PG_RH / 2 + 4 : PG_RH / 2 - 4); return `M${x1},${y1}H${x1 + 6}V${ym}H${x2 - 8}V${y2}H${x2}`; }
    return `M${x1},${y1}H${xm}V${y2}H${x2}`;
  };
  vis.forEach(i => (T[i].pred || []).forEach(p => {
    const j = C.idx[p.u]; if (j === undefined || rowOf[j] === undefined) return;
    const pj = C[j], c = C[i]; let x1, x2;
    if (p.t === 'SS') { x1 = X(pj.s); x2 = X(c.s); } else if (p.t === 'FF') { x1 = X(pj.f) + pxd; x2 = X(c.f) + pxd; } else if (p.t === 'SF') { x1 = X(pj.s); x2 = X(c.f) + pxd; } else { x1 = X(pj.f) + pxd; x2 = X(c.s); }
    svg += `<path d="${pathFor(j, i, x1, x2, p.t)}" marker-end="url(#pgar)"/>`;
  }));
  // PU lane
  let puHtml = '';
  if (puRows.length) {
    const lateN = puRows.filter(x => puStatus(x).k === 'late').length, doneN = puRows.filter(x => puStatus(x).k === 'done').length;
    const ests = puRows.map(x => pgN(puEst(x) || x.actual)).filter(n => !isNaN(n));
    const mn = Math.min(...ests), mx = Math.max(...ests);
    puHtml += `<div class="pg-row pg-sum pg-puh"><div class="pg-left" style="width:${LW}px">${lc(cols.id, '🚚', 'justify-content:center')}<div class="pg-c pg-nm pg-sumrow" style="width:${cols.nm}px;cursor:pointer" onclick="progTogglePu()"><span class="pg-tg">${puExpanded ? '▾' : '▸'}</span>PU Delivery — hàng về site (${doneN}/${puRows.length} đã giao${lateN ? ', ' + lateN + ' trễ' : ''})</div>${lc(cols.wh, '')}${lc(cols.du, '')}${lc(cols.st, ests.length ? pgFmt(mn) : '')}${lc(cols.fn, ests.length ? pgFmt(mx) : '')}${lc(cols.pc, Math.round(doneN * 100 / puRows.length) + '%', 'justify-content:center')}${lc(cols.pd, '')}${lc(cols.ac, '')}</div>
      <div class="pg-tl" style="width:${W}px">${ests.length ? `<div class="pg-sbar" style="left:${X(mn)}px;width:${Math.max(4, (mx - mn + 1) * pxd)}px;background:#7A5FD1"></div>` : ''}</div></div>`;
    if (puExpanded) puRows.forEach((x, k) => {
      const s = puStatus(x), col = PU_STATUS_COLOR[s.k], est = pgN(puEst(x)), act = pgN(x.actual), e0 = pgN(x.e0);
      let b = '';
      if (!isNaN(e0) && !isNaN(est) && est > e0) b += `<div class="pg-pugap" style="left:${X(e0) + pxd / 2}px;width:${(est - e0) * pxd}px;background:${PG_COL.over}" title="Trễ ${est - e0} ngày so với As contract"></div>`;
      const dn = !isNaN(act) ? act : est;
      if (!isNaN(dn)) b += `<div class="pg-ms" style="left:${X(dn) + pxd / 2 - 6}px;background:${col}" title="${pgEsc(x.name)} · ${pgEsc(s.t)} · ${pgFmt(dn)}"></div><span class="pg-bl" style="left:${X(dn) + pxd / 2 + 10}px">${pgEsc(puFmtS(!isNaN(act) ? x.actual : puEst(x)))}</span>`;
      puHtml += `<div class="pg-row"><div class="pg-left" style="width:${LW}px">${lc(cols.id, k + 1, 'justify-content:center;color:var(--text3);font-size:11px')}<div class="pg-c pg-nm" style="width:${cols.nm}px;padding-left:24px" title="${pgEsc(x.name)}"><span class="pg-pill" style="background:${col}">${pgEsc(x.name)}</span></div>${lc(cols.wh, pgEsc(x.supplier || ''), 'font-size:10.5px;color:var(--text2)')}${lc(cols.du, '')}${lc(cols.st, x.e0 ? puFmt(x.e0).slice(0, 5) + '/' + puFmt(x.e0).slice(8) : '', 'font-size:11px;color:var(--text2)')}${lc(cols.fn, !isNaN(dn) ? pgFmt(dn) : '')}${lc(cols.pc, '')}${lc(cols.pd, '')}${lc(cols.ac, '')}</div><div class="pg-tl" style="width:${W}px">${b}</div></div>`;
    });
  }
  const hdLeft = `<div class="pg-left pg-hl" style="width:${LW}px;height:${HH}px">${lc(cols.id, 'ID', 'justify-content:center')}${lc(cols.nm, 'Task Name')}${lc(cols.wh, 'Người thực hiện')}${lc(cols.du, 'Duration')}${lc(cols.st, 'Start')}${lc(cols.fn, 'Finish')}${lc(cols.pc, '%', 'justify-content:center')}${lc(cols.pd, '<span title="Việc phải làm TRƯỚC: số = ID dòng. FS = xong việc trước mới bắt đầu (mặc định, không ghi) · SS = cùng bắt đầu · FF = cùng kết thúc · SF = bắt đầu việc trước thì mới được kết thúc. +Nd = chờ thêm N ngày; -Nd = được làm gối đầu N ngày.">Predecessors ⓘ</span>')}${lc(cols.ac, '')}</div>`;
  const totalH = H;
  const root = sm.root;
  return `<div class="card">
    <div class="action-row" style="margin-bottom:8px">
      <select onchange="progZoom=this.value;renderProgress()" title="Thang thời gian"><option value="day"${progZoom === 'day' ? ' selected' : ''}>Theo ngày</option><option value="week"${progZoom === 'week' ? ' selected' : ''}>Theo tuần</option><option value="month"${progZoom === 'month' ? ' selected' : ''}>Theo tháng</option></select>
      <button class="btn" onclick="progToToday()">Hôm nay</button>
      <button class="btn" onclick="progCollapseAll(true)">Thu gọn</button><button class="btn" onclick="progCollapseAll(false)">Mở rộng</button>
      <label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" ${progCompact ? 'checked' : ''} onchange="progCompact=this.checked;renderProgress()"> Cột gọn</label>
      <label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" ${progShowPu ? 'checked' : ''} onchange="progShowPu=this.checked;renderProgress()"> Hiện hàng PU</label>
      ${edit ? `<button class="btn btn-primary" onclick="progInsert(${T.length - 1})">＋ Công việc</button>` : ''}
    </div>
    <div class="pg-legend"><i style="background:#8fa3c4"></i>Chưa bắt đầu <i class="lg-b"></i>Đang thực hiện <i class="lg-p"></i>Hoàn thành <i class="lg-r"></i>Trễ hạn <i style="background:#8a8f98"></i>Tạm dừng <i class="lg-s"></i>Nhóm (summary) <i class="lg-m"></i>Mốc (milestone) <i class="lg-t"></i>Hôm nay</div>
    <div class="pg-scroll" id="progScroll" style="max-height:${progSolo ? "78vh" : "74vh"}" data-min="${minN}" data-px="${pxd}" data-today="${today}">
      <div class="pg-inner" style="width:${LW + W}px">
        <div class="pg-hdr" style="height:${HH}px">${hdLeft}<div class="pg-tl pg-htl" style="width:${W}px;height:${HH}px"><div class="pg-hmrow">${hm}</div><div class="pg-hdrow">${hd}</div></div></div>
        <div class="pg-body" style="height:${totalH}px">
          <div class="pg-grid" style="left:${LW}px;width:${W}px;height:${totalH}px">${grid}${todayLine}</div>
          ${rows}${puHtml}
          <svg class="pg-svg" style="left:${LW}px;width:${W}px;height:${totalH}px" width="${W}" height="${totalH}"><defs><marker id="pgar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6z" fill="#F0A020"/></marker></defs><g fill="none" stroke="#F0A020" stroke-width="1.3">${svg}</g></svg>
        </div>
      </div></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Lịch 7 ngày/tuần (theo file MS Project mẫu). Ngày Start/Finish của công việc có Predecessor được tự tính; hàng PU thay đổi → mốc "hàng về site" tự dời theo.</div></div>`;
}
function progBar(t, c, x, pxd, stt) {
  const w = Math.max(3, (c.f - c.s + 1) * pxd);
  if (c.sum) return `<div class="pg-sbar" style="left:${x}px;width:${w}px"><b></b><em></em><div class="pg-sfill" style="width:${c.pct}%"></div></div><span class="pg-bl" style="left:${x + w + 6}px">${c.pct}%</span>`;
  if (c.nodata) return `<span class="pg-bl" style="left:6px;font-style:italic">chưa có hàng PU của dự án này</span>`;
  if (c.ms || c.dur === 0) return `<div class="pg-ms" style="left:${x + pxd / 2 - 6}px;${t.puLink ? 'background:#7A5FD1' : ''}" title="${pgEsc(t.name)} · ${pgFmt(c.s, true)}"></div><span class="pg-bl" style="left:${x + pxd / 2 + 10}px">${pgFmt(c.s)}</span>`;
  const bg = PG_ST[stt][1];
  return `<div class="pg-bar1" style="left:${x}px;width:${w}px;background:${bg}" title="${pgEsc(t.name)}&#10;${pgEsc(PG_ST[stt][0])} · ${pgFmt(c.s, true)} → ${pgFmt(c.f, true)} · ${c.dur} ngày · ${c.pct}%${t.who ? '&#10;' + pgEsc(t.who) : ''}"><div class="pg-fill" style="width:${c.pct}%"></div>${w > 70 ? `<span class="pg-bin">${pgEsc(t.name)}</span>` : ''}</div>${w > 70 ? '' : `<span class="pg-bl" style="left:${x + w + 5}px">${pgEsc(t.name.length > 26 ? t.name.slice(0, 25) + '…' : t.name)}</span>`}`;
}
function progAfterGantt() {
  const sc = document.getElementById('progScroll'); if (!sc) return;
  if (sc.dataset.fresh !== '1') { sc.dataset.fresh = '1'; progToToday(true); }
}
function progToToday(quiet) {
  const sc = document.getElementById('progScroll'); if (!sc) return;
  const min = +sc.dataset.min, px = +sc.dataset.px, td = +sc.dataset.today;
  const left = sc.querySelector('.pg-left'), lw = left ? left.offsetWidth : 600;
  sc.scrollLeft = Math.max(0, (td - min) * px - (sc.clientWidth - lw) / 3);
}
function progToggle(u) { if (progCollapsed.has(u)) progCollapsed.delete(u); else progCollapsed.add(u); keepScroll(); }
function progTogglePu() { progPuOpen = !(progPuOpen === null ? (pgPuItems(progSel).length <= 40) : progPuOpen); keepScroll(); }
function progCollapseAll(on) { const pr = PROG_DB[progSel]; if (!pr) return; progCollapsed.clear(); if (on) pr.tasks.forEach((t, i) => { if (i > 0 && pr.tasks[i + 1] && pr.tasks[i + 1].lvl > t.lvl && t.lvl >= 1) progCollapsed.add(t.u); }); keepScroll(); }
function keepScroll() {
  const sc = document.getElementById('progScroll'), l = sc ? sc.scrollLeft : 0, t = sc ? sc.scrollTop : 0;
  renderProgress(); const n = document.getElementById('progScroll'); if (n) { n.dataset.fresh = '1'; n.scrollLeft = l; n.scrollTop = t; }
}

// ── Sửa dữ liệu ──
function progTouch(pr) { pr.at = Date.now(); saveProgDb(); keepScroll(); }
function progSetPct(i, v) {
  const pr = PROG_DB[progSel]; if (!pr || !canEditProgress()) return;
  progApply(pr, i, { pct: v }); progTouch(pr);
}
function progMkTask(lvl, name) { return { u: pgNewUid(), lvl, name: name || 'Công việc mới', dur: 1, start: '', pred: [], pct: 0 }; }
function progInsert(i) {
  const pr = PROG_DB[progSel]; if (!pr || !canEditProgress()) return;
  const C = progCalc(pr), ref = pr.tasks[i]; const t = progMkTask(ref ? (C.end[i] > i + 1 || ref.lvl === 0 ? ref.lvl + 1 : ref.lvl) : 1);
  t.start = pgIso(ref ? C[i].f + 1 : pgN(pr.start));
  pr.tasks.splice(C.end[i] || pr.tasks.length, 0, t); if (ref && C.end[i] > i + 1) { /* chèn cuối nhóm */ }
  const idx = pr.tasks.indexOf(t); progTouch(pr); progEdit(idx);
}
function progEdit(i) {
  const pr = PROG_DB[progSel]; if (!pr || !canEditProgress()) return;
  const t = pr.tasks[i], C = progCalc(pr), c = C[i], sum = c.sum, hasPred = (t.pred || []).length > 0, today = pgToday(), stt = progStat(t, c, today);
  const logs = (t.log || []).slice(-6).reverse().map(l => { const d = new Date(l.at); return `<li><b>${l.pct}%</b>${l.hold ? ' · tạm dừng' : ''} — ${pgEsc(l.note || '')} <i>${pgEsc(l.by || '')} · ${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</i></li>`; }).join('');
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox"><div style="font-size:18px;font-weight:800;margin-bottom:4px">Công việc #${i + 1}${sum ? ' (nhóm)' : ''} <span class="pg-badge" style="background:${PG_ST[stt][1]}22;color:${PG_ST[stt][1]}">${PG_ST[stt][0]}</span></div>
    <label>Tên công việc<input id="pgfName" value="${pgEsc(t.name)}"></label>
    <div class="pg-g2">
      <label>Người thực hiện (cách nhau dấu phẩy)<input id="pgfWho" value="${pgEsc(t.who || '')}" placeholder="vd: Nhơn, Khánh" ${sum ? 'disabled' : ''}></label>
      <label>Predecessors<input id="pgfPred" value="${pgEsc(pgPredText(pr, t))}" placeholder="vd: 5, 6SS+3d, 7FF-2d" ${sum ? 'disabled' : ''}></label>
      <label>Duration (ngày)<input id="pgfDur" type="number" min="0" value="${sum ? c.dur : t.dur}" ${sum ? 'disabled' : ''}></label>
      <label>Ngày bắt đầu KH${hasPred ? ' (tự tính từ Predecessor)' : ''}<input id="pgfStart" type="date" value="${pgIso(c.s)}" ${sum || hasPred ? 'disabled' : ''}></label>
      <label>Bắt đầu thực tế<input id="pgfAs" type="date" value="${pgEsc(t.as || '')}" ${sum ? 'disabled' : ''}></label>
      <label>Kết thúc thực tế<input id="pgfAf" type="date" value="${pgEsc(t.af || '')}" ${sum ? 'disabled' : ''}></label>
    </div>
    ${sum ? '' : `<div class="pg-upd"><div style="font-weight:700;margin-bottom:6px">Cập nhật tiến độ</div>
      <div style="display:flex;align-items:center;gap:10px"><input id="pgfPct" type="range" min="0" max="100" step="5" value="${c.pct}" style="flex:1;padding:0" oninput="document.getElementById('pgfPctV').textContent=this.value+'%';document.getElementById('pgfAuto').checked=false"><b id="pgfPctV" style="min-width:42px">${c.pct}%</b></div>
      <label class="pg-perm" style="margin:4px 0 8px"><input type="checkbox" id="pgfAuto"${pgManual(t) ? '' : ' checked'}> Tự tính % theo ngày (Finish đã qua hôm nay = 100%). Kéo thanh trượt để nhập tay.</label>
      <div class="pg-g2"><label>Trạng thái<select id="pgfHold"><option value="0">Tự động theo tiến độ / ngày</option><option value="1"${t.hold ? ' selected' : ''}>Tạm dừng</option></select></label>
        <label>Khối lượng (đã làm / dự toán / đơn vị)<span style="display:flex;gap:4px"><input id="pgfQd" type="number" min="0" step="any" value="${t.qtyDone || ''}" placeholder="đã làm"><input id="pgfQty" type="number" min="0" step="any" value="${t.qty || ''}" placeholder="dự toán"><input id="pgfUnit" value="${pgEsc(t.unit || '')}" placeholder="m2, bộ…" style="width:70px"></span></label></div>
      <label>Ghi chú cập nhật<input id="pgfNote" placeholder="vd: Tiến độ chậm do nhà cung cấp"></label></div>
      <label style="flex-direction:row;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="pgfPu" ${t.puLink ? 'checked' : ''} style="width:auto"> 🚚 Liên kết PU Delivery: ngày của mốc = ngày hàng cuối cùng về site (đặt Duration = 0)</label>`}
    ${logs ? `<div class="pg-logs"><b>Lịch sử cập nhật</b><ul>${logs}</ul></div>` : ''}
    <div class="pg-g2" style="margin-top:10px"><div class="action-row" style="margin:0"><button class="btn" onclick="progMove(${i},-1)">▲ Lên</button><button class="btn" onclick="progMove(${i},1)">▼ Xuống</button><button class="btn" onclick="progIndent(${i},-1)">⇤ Lên cấp</button><button class="btn" onclick="progIndent(${i},1)">⇥ Xuống cấp</button></div>
    <div class="action-row" style="margin:0;justify-content:flex-end"><button class="btn" style="color:#C0392B" onclick="progDelTask(${i})">Xoá</button><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" onclick="progSaveTask(${i})">Lưu</button></div></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">Predecessors: số ID (mặc định FS) kèm loại FS/SS/FF/SF và độ trễ, cách nhau dấu phẩy. Nhập khối lượng đã làm + dự toán thì % tự tính theo khối lượng.</div></div>`;
  document.body.appendChild(ov); const f = document.getElementById('pgfName'); if (f) f.focus();
}
function progCloseModal() { const m = document.getElementById('progModal'); if (m) m.remove(); }
function progSaveTask(i) {
  const pr = PROG_DB[progSel], t = pr.tasks[i], g = id => document.getElementById(id), C = progCalc(pr), sum = C[i].sum;
  const nm = (g('pgfName').value || '').trim(); if (!nm) { toast('⚠️ Nhập tên công việc.'); return; }
  t.name = nm;
  if (!sum) {
    t.who = (g('pgfWho').value || '').trim(); if (!t.who) delete t.who;
    t.dur = Math.max(0, parseInt(g('pgfDur').value, 10) || 0);
    t.pred = pgParsePred(g('pgfPred').value, pr, i); t.puLink = !!g('pgfPu').checked; if (!t.puLink) delete t.puLink;
    if (!t.pred.length && g('pgfStart').value) t.start = g('pgfStart').value;
    if (progHasCycle(pr)) { toast('⚠️ Predecessor tạo vòng lặp — đã bỏ phần Predecessor vừa nhập.'); t.pred = []; }
    t.as = g('pgfAs').value || ''; t.af = g('pgfAf').value || '';
    const q = parseFloat(g('pgfQty').value), qd = parseFloat(g('pgfQd').value);
    t.qty = q > 0 ? q : 0; t.qtyDone = qd >= 0 ? qd : 0; t.unit = (g('pgfUnit').value || '').trim();
    if (!t.qty) { delete t.qty; delete t.qtyDone; } if (!t.unit) delete t.unit;
    let pct = parseInt(g('pgfPct').value, 10) || 0;
    if (t.qty && g('pgfQd').value !== '') pct = Math.round(Math.min(1, t.qtyDone / t.qty) * 100);
    const asUser = t.as, afUser = t.af;
    if (g('pgfAuto').checked && !(t.qty && g('pgfQd').value !== '')) { progApply(pr, i, { hold: g('pgfHold').value === '1', note: (g('pgfNote').value || '').trim() }); t.pctM = false; }
    else progApply(pr, i, { pct, hold: g('pgfHold').value === '1', note: (g('pgfNote').value || '').trim() });
    if (asUser) t.as = asUser; if (afUser) t.af = afUser; if (!t.as) delete t.as; if (!t.af) delete t.af;
  }
  progCloseModal(); progTouch(pr);
}
function progHasCycle(pr) {
  const idx = {}; pr.tasks.forEach((t, i) => idx[t.u] = i); const st = {};
  const dfs = i => { if (st[i] === 1) return true; if (st[i] === 2) return false; st[i] = 1; for (const p of (pr.tasks[i].pred || [])) { const j = idx[p.u]; if (j !== undefined && dfs(j)) return true; } st[i] = 2; return false; };
  return pr.tasks.some((t, i) => dfs(i));
}
function progBlock(pr, i) { const C = progCalc(pr); return [i, C.end[i]]; }
function progMove(i, dir) {
  const pr = PROG_DB[progSel], T = pr.tasks, C = progCalc(pr), [a, b] = [i, C.end[i]];
  if (dir < 0) {
    let j = i - 1; while (j >= 0 && T[j].lvl > T[i].lvl) j--; if (j < 0 || T[j].lvl < T[i].lvl) return;
    const blk = T.splice(a, b - a); T.splice(j, 0, ...blk); progCloseModal(); progTouch(pr); progEdit(j);
  } else {
    if (b >= T.length || T[b].lvl < T[i].lvl) return; const nb = C.end[b];
    const blk = T.splice(a, b - a); T.splice(a + (nb - b), 0, ...blk); progCloseModal(); progTouch(pr); progEdit(a + (nb - b));
  }
}
function progIndent(i, d) {
  const pr = PROG_DB[progSel], T = pr.tasks, C = progCalc(pr), e = C.end[i];
  if (i === 0) return;
  if (d > 0 && (i === 0 || T[i].lvl > T[i - 1].lvl)) { toast('Không thể xuống cấp thêm.'); return; }
  if (d < 0 && T[i].lvl <= 1) return;
  for (let j = i; j < e; j++) T[j].lvl += d; progCloseModal(); progTouch(pr); progEdit(i);
}
function progDelTask(i) {
  const pr = PROG_DB[progSel], C = progCalc(pr); if (i === 0) { toast('Không xoá được dòng gốc của dự án (dùng "Xoá tiến độ").'); return; }
  const n = C.end[i] - i; if (!confirm(`Xoá công việc "${pr.tasks[i].name}"${n > 1 ? ` và ${n - 1} việc con` : ''}?`)) return;
  const gone = new Set(pr.tasks.slice(i, C.end[i]).map(t => t.u)); pr.tasks.splice(i, n);
  pr.tasks.forEach(t => { t.pred = (t.pred || []).filter(p => !gone.has(p.u)); }); progCloseModal(); progTouch(pr);
}

// ── Tạo / xoá / đổi ngày khởi công ──
function progNewProject() {
  if (!canEditProgress()) return; pgnTasks = null;
  const have = new Set(Object.keys(PROG_DB)), avail = (typeof puProjects === 'function' ? puProjects().map(x => x.p) : []).filter(p => !have.has(p));
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:12px">Lập tiến độ cho dự án</div>
    <div id="pgnManual">
    <label>Dự án (Action Plan / PU Delivery)<select id="pgnProj">${avail.map(p => `<option>${pgEsc(p)}</option>`).join('')}<option value="__new__">＋ Dự án khác (nhập tên)…</option></select></label>
    <label id="pgnNameL" style="display:${avail.length ? 'none' : 'flex'}">Tên dự án<input id="pgnName" placeholder="Tên dự án"></label>
    <label>Ngày khởi công / bắt đầu<input id="pgnStart" type="date" value="${puToday()}"></label>
    </div>
    <div class="pg-mpp" id="pgnMpp"><div class="pg-mpp-t">Hoặc tạo nhanh từ file tiến độ có sẵn</div>
      <label class="btn pg-mpp-btn">📂 Upload MPP<input type="file" id="pgnFile" accept=".mpp,.xml,.xlsx,.xls" style="display:none" onchange="progPickFile(this)"></label>
      <span id="pgnFileInfo" class="pg-mpp-i">MS Project (.mpp) — hoặc .xml / Excel</span>
      <div id="pgnFileNote" class="pg-mpp-n" style="display:none">Dự án sẽ lấy <b>tên và ngày bắt đầu theo file</b>. Xem chi tiết xong, bấm <b>⚙ Thông tin</b> để gán vào dự án Action Plan/PU Delivery hoặc đổi tên; <b>Đổi ngày khởi công</b> để chỉnh ngày.</div></div>
    <div class="action-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" onclick="progCreate()">Tạo</button></div></div>`;
  document.body.appendChild(ov);
  const sel = document.getElementById('pgnProj'); sel.onchange = () => { document.getElementById('pgnNameL').style.display = sel.value === '__new__' ? 'flex' : 'none'; };
}
let pgnTasks = null;   // công việc đọc từ file upload (dùng khi bấm Tạo)
// Đọc file .mpp / .xml / Excel → mảng công việc của app
function progReadFile(f, cb) {
  const rd = new FileReader();
  if (/\.xml$/i.test(f.name)) { rd.onload = () => { try { cb(null, progParseXml(String(rd.result))); } catch (e) { cb('File XML không hợp lệ: ' + (e.message || e)); } }; rd.readAsText(f); return; }
  rd.onload = () => {
    try {
      const u8 = new Uint8Array(rd.result);
      if (/\.mpp$/i.test(f.name) || (u8[0] === 0xD0 && u8[1] === 0xCF && !/\.xls$/i.test(f.name))) cb(null, progMppTasks(u8)); else cb(null, progParseSheet(u8));
    } catch (e) { cb(e.message || String(e)); }
  };
  rd.readAsArrayBuffer(f);
}
function progMppTasks(u8) {
  if (typeof mppParse !== 'function') throw new Error('Thiếu bộ đọc .mpp — hãy tải lại trang.');
  const raw = mppParse(u8); if (!raw.length) throw new Error('Không tìm thấy công việc nào trong file .mpp.');
  const minLvl = Math.min(...raw.map(t => t.lvl)), byUid = {}, tasks = [];
  raw.forEach(t => { const job = { u: pgNewUid(), lvl: Math.max(0, t.lvl - minLvl), name: t.name, dur: t.dur > 0 ? Math.max(1, Math.round(t.dur)) : 0, start: t.start, pred: [], pct: t.pct, ...(t.pct > 0 ? { pctM: true } : {}), ...(t.who ? { who: t.who } : {}) }; byUid[t.uid] = job; tasks.push(job); });
  raw.forEach(t => { const job = byUid[t.uid]; t.preds.forEach(p => { const q = byUid[p.uid]; if (q) job.pred.push({ u: q.u, t: p.t, lag: p.lag }); }); });
  const p0 = raw[0].start;   // việc không có Predecessor mà ngày cũ hơn ngày bắt đầu dự án (dữ liệu tồn trong file) → đưa về ngày bắt đầu dự án
  tasks.forEach(t => { if (!t.pred.length && t.start && t.start < p0) t.start = p0; });
  return tasks;
}
// Bảo đảm dòng đầu là dòng gốc duy nhất của dự án
function progEnsureRoot(tasks, name) {
  const n0 = tasks.filter(t => t.lvl === 0).length;
  if (tasks[0].lvl === 0 && n0 === 1) return tasks;
  tasks.forEach(t => t.lvl++); tasks.unshift(progMkTask(0, name)); return tasks;
}
function progPickFile(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  const info = document.getElementById('pgnFileInfo'); info.style.color = ''; info.textContent = '⏳ Đang đọc ' + f.name + '…';
  progReadFile(f, (err, tasks) => {
    if (err || !tasks || !tasks.length) { pgnTasks = null; info.style.color = '#C0392B'; info.textContent = '⚠️ ' + (err || 'Không đọc được công việc nào.'); return; }
    pgnTasks = tasks; document.getElementById('pgnManual').style.display = 'none'; document.getElementById('pgnFileNote').style.display = 'block';
    info.style.color = '#2E7D32'; info.textContent = '✅ ' + f.name + ' — ' + tasks.length + ' công việc';
  });
}
function progCreate() {
  const g = id => document.getElementById(id);
  if (pgnTasks) {   // tạo từ file: tên + ngày bắt đầu lấy theo file
    const base = (pgnTasks[0].name || 'Dự án mới').trim(); let name = base, k = 2; while (PROG_DB[name]) name = base + ' (' + (k++) + ')';
    const ds = pgnTasks.map(t => pgN(t.start)).filter(x => !isNaN(x)), tasks = progEnsureRoot(pgnTasks, name); pgnTasks = null;
    PROG_DB[name] = { name, start: ds.length ? pgIso(Math.min(...ds)) : puToday(), tasks, at: Date.now() };
    progCloseModal(); progSel = name; saveProgDb(); renderProgress(); progOpen(name); return;
  } let name = g('pgnProj').value; if (name === '__new__' || !name) name = (g('pgnName').value || '').trim();
  if (!name) { toast('⚠️ Chọn hoặc nhập tên dự án.'); return; } if (PROG_DB[name]) { toast('⚠️ Dự án này đã có tiến độ.'); return; }
  const st = g('pgnStart').value; if (isNaN(pgN(st))) { toast('⚠️ Chọn ngày bắt đầu.'); return; }
  const tasks = pgnTasks ? progEnsureRoot(pgnTasks, name) : [progMkTask(0, name)]; pgnTasks = null;
  PROG_DB[name] = { name, start: st, tasks, at: Date.now() };
  progCloseModal(); progSel = name; saveProgDb(); renderProgress(); progOpen(name);
}
function progRename() {
  const pr = PROG_DB[progSel]; if (!pr) return;
  const v = prompt('Ngày khởi công mới (yyyy-mm-dd). Các công việc chưa có Predecessor sẽ dời theo:', pr.start); if (!v) return;
  const n = pgN(v), o = pgN(pr.start); if (isNaN(n)) { toast('⚠️ Ngày không hợp lệ.'); return; }
  pr.tasks.forEach(t => { const s = pgN(t.start); if (!isNaN(s)) t.start = pgIso(s + (n - o)); }); pr.start = pgIso(n); progTouch(pr);
}
function progDelete() {
  if (!progSel || !confirm(`Xoá toàn bộ tiến độ của dự án "${progSel}"? (Có thể khôi phục từ bản lưu cũ trong Cài đặt.)`)) return;
  delete PROG_DB[progSel]; saveProgDb(); progSaveClose();   // xoá xong tự đóng tab / về danh sách
}

// ── Xuất ──
function progExportXlsx() {
  const pr = PROG_DB[progSel]; if (!pr || typeof XLSX === 'undefined') return;
  const C = progCalc(pr), td = pgToday(), rows = [['ID', 'Task Name', 'Người thực hiện', 'Duration', 'Start', 'Finish', 'Bắt đầu TT', 'Kết thúc TT', '% Complete', 'Trạng thái', 'Predecessors']];
  pr.tasks.forEach((t, i) => rows.push([i + 1, '    '.repeat(t.lvl) + t.name, t.who || '', C[i].dur + (C[i].dur === 1 ? ' day' : ' days'), pgFmt(C[i].s, true), pgFmt(C[i].f, true), t.as ? puFmt(t.as) : '', t.af ? puFmt(t.af) : '', C[i].pct / 100, PG_ST[progStat(t, C[i], td)][0], pgPredText(pr, t)]));
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [5, 60, 18, 10, 14, 14, 12, 12, 11, 14, 16].map(w => ({ wch: w }));
  for (let r = 2; r <= rows.length; r++) if (ws['I' + r]) ws['I' + r].z = '0%';
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
  const items = pgPuItems(pr.name);
  if (items.length) {
    const pr2 = [['No.', 'Name of Items', 'Supplier', 'As contract', 'Estimate on site', 'Actual on site', 'Status']];
    items.forEach((x, k) => pr2.push([k + 1, x.name, x.supplier, puFmt(x.e0), puFmt(puEst(x)), puFmt(x.actual), puStatus(x).t]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pr2), 'PU Delivery');
  }
  XLSX.writeFile(wb, `Tien-do-${pr.name.replace(/[^\w-]+/g, '_')}-${puToday()}.xlsx`);
}
function progTemplateXlsx() {
  if (typeof XLSX === 'undefined') return;
  const rows = [['ID', 'Task Name', 'Duration', 'Start', 'Predecessors', '% Complete', 'Người thực hiện', 'Khối lượng', 'Đơn vị', 'Outline Level'],
    [1, 'TÊN DỰ ÁN', '', '', '', 0, '', '', '', 1], [2, 'Giai đoạn chuẩn bị', '', '', '', 0, '', '', '', 2],
    [3, 'Duyệt bản vẽ shop', '7 days', '2026-11-01', '', 0, 'Nhơn', '', '', 3], [4, 'Đặt hàng thiết bị', '5 days', '', '3', 0, 'Khánh', 10, 'bộ', 3], [5, 'Giai đoạn thi công', '', '', '', 0, '', '', '', 2],
    [6, 'Lắp đặt ống gió', '20 days', '', '4SS+3d', 0, 'Vũ', 250, 'm', 3]];
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [5, 40, 10, 12, 14, 11, 18, 11, 9, 12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Hướng dẫn'], ['Dòng 1 = tên dự án (Outline Level 1); giai đoạn = Level 2; công việc = Level 3…'], ['Duration: số ngày (vd "7 days"). Start: yyyy-mm-dd — chỉ cần với việc chưa có Predecessors.'], ['Predecessors: số ID, kèm FS/SS/FF/SF và độ trễ, vd "3", "4SS+3d". % Complete: 0–1 hoặc 0–100.'], ['Người thực hiện: nhiều người cách nhau dấu phẩy. Khối lượng + Đơn vị: tuỳ chọn.']]), 'Hướng dẫn');
  XLSX.writeFile(wb, 'Mau-nhap-tien-do.xlsx');
}
function progExportXml() {
  const pr = PROG_DB[progSel]; if (!pr) return; const C = progCalc(pr), x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = pr.tasks, tp = { FF: 0, FS: 1, SF: 2, SS: 3 };
  const wd = [1, 2, 3, 4, 5, 6, 7].map(d => `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`).join('');
  let o = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project"><Name>${x(pr.name)}</Name><Title>${x(pr.name)}</Title><ScheduleFromStart>1</ScheduleFromStart><StartDate>${pgIso(C[0].s)}T08:00:00</StartDate><FinishDate>${pgIso(C[0].f)}T17:00:00</FinishDate><CalendarUID>1</CalendarUID><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>3360</MinutesPerWeek><DaysPerMonth>30</DaysPerMonth><DurationFormat>7</DurationFormat>
<Calendars><Calendar><UID>1</UID><Name>7 days</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${wd}</WeekDays></Calendar></Calendars><Tasks>`;
  T.forEach((t, i) => {
    const c = C[i], dur = c.sum || c.dur > 0 ? c.dur : 0;
    o += `<Task><UID>${i + 1}</UID><ID>${i + 1}</ID><Name>${x(t.name)}</Name><Type>0</Type><OutlineLevel>${t.lvl + 1}</OutlineLevel><Start>${pgIso(c.s)}T08:00:00</Start><Finish>${pgIso(c.f)}T17:00:00</Finish><Duration>PT${dur * 8}H0M0S</Duration><DurationFormat>7</DurationFormat><PercentComplete>${c.pct}</PercentComplete><Summary>${c.sum ? 1 : 0}</Summary><Milestone>${!c.sum && dur === 0 ? 1 : 0}</Milestone>`;
    (t.pred || []).forEach(p => { const j = C.idx[p.u]; if (j !== undefined) o += `<PredecessorLink><PredecessorUID>${j + 1}</PredecessorUID><Type>${tp[p.t]}</Type><LinkLag>${(p.lag || 0) * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`; });
    o += '</Task>';
  });
  o += '</Tasks></Project>';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([o], { type: 'application/xml' })); a.download = `Tien-do-${pr.name.replace(/[^\w-]+/g, '_')}.xml`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ── Nhập MS Project XML / Excel ──
function progImportFile(inp) {
  const f = inp.files && inp.files[0]; inp.value = ''; if (!f || !progSel) return;
  const pr = PROG_DB[progSel];
  progReadFile(f, (err, tasks) => {
    if (err) { toast('⚠️ ' + err); return; }
    if (!tasks.length) { toast('⚠️ Không đọc được công việc nào trong file.'); return; }
    if (!confirm(`Thay toàn bộ tiến độ của "${pr.name}" bằng ${tasks.length} công việc từ ${f.name}?`)) return;
    pr.tasks = progEnsureRoot(tasks, pr.name); const mn = Math.min(...progCalc(pr).slice(0, 1).map(c => c.s)); if (!isNaN(mn)) pr.start = pgIso(mn);
    progTouch(pr); toast('✅ Đã nhập ' + tasks.length + ' công việc.');
  });
}
function progParseXml(txt) {
  const doc = new DOMParser().parseFromString(txt, 'application/xml'); if (doc.querySelector('parsererror')) throw new Error('XML lỗi');
  const g = (el, tag) => { const n = [...el.children].find(c => c.localName === tag); return n ? n.textContent : ''; };
  const list = [...doc.getElementsByTagNameNS('*', 'Task')].filter(t => t.parentNode.localName === 'Tasks' && g(t, 'UID') !== '0' && g(t, 'Name'));
  const minLvl = Math.min(...list.map(t => +g(t, 'OutlineLevel') || 1)), byUid = {}, tasks = [];
  list.forEach(t => {
    const dm = /PT(\d+)H/.exec(g(t, 'Duration')), job = { u: pgNewUid(), lvl: Math.max(0, (+g(t, 'OutlineLevel') || 1) - minLvl), name: g(t, 'Name').trim(), dur: dm ? Math.round(+dm[1] / 8) : 0, start: g(t, 'Start').slice(0, 10), pred: [], pct: +g(t, 'PercentComplete') || 0 };
    byUid[g(t, 'UID')] = job; tasks.push(job);
  });
  const TY = ['FF', 'FS', 'SF', 'SS'];
  list.forEach(t => { const job = byUid[g(t, 'UID')]; [...t.children].filter(c => c.localName === 'PredecessorLink').forEach(l => { const p = byUid[g(l, 'PredecessorUID')]; if (p) job.pred.push({ u: p.u, t: TY[+g(l, 'Type')] || 'FS', lag: Math.round((+g(l, 'LinkLag') || 0) / 4800) }); }); });
  return tasks;
}
function progParseSheet(buf) {
  const wb = XLSX.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]], rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const hi = rows.findIndex(r => r.some(c => /task name/i.test(String(c)))); if (hi < 0) throw new Error('Không thấy cột "Task Name"');
  const H = rows[hi].map(c => String(c).toLowerCase().trim()), ix = k => H.findIndex(c => k.test(c));
  const cN = ix(/task name/), cD = ix(/duration/), cS = ix(/^start/), cP = ix(/predecessor/), cC = ix(/%/), cL = ix(/outline/), cW = ix(/người thực hiện|resource|assignee/), cQ = ix(/khối lượng|quantity/), cU = ix(/đơn vị|unit/), tasks = [];
  rows.slice(hi + 1).forEach(r => {
    const raw = String(r[cN] == null ? '' : r[cN]); if (!raw.trim()) return;
    const sp = raw.match(/^\s*/)[0].length, d = parseFloat(String(r[cD]).replace(',', '.')) || 0;
    let s = r[cS]; if (typeof s === 'string') { const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s); if (m) s = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; else s = ''; } else if (typeof s === 'number') s = pgIso(Math.round(s - 25569));
    tasks.push({ u: pgNewUid(), lvl: cL >= 0 ? Math.max(0, (+r[cL] || 1) - 1) : Math.floor(sp / 4), name: raw.trim(), dur: Math.round(d), start: s || '', pred: [], pct: cC >= 0 ? Math.round((+r[cC] || 0) * (+r[cC] <= 1 ? 100 : 1)) : 0, _p: cP >= 0 ? String(r[cP] || '') : '', ...(cW >= 0 && r[cW] ? { who: String(r[cW]).trim() } : {}), ...(cQ >= 0 && +r[cQ] > 0 ? { qty: +r[cQ], qtyDone: 0, unit: cU >= 0 ? String(r[cU] || '') : '' } : {}) });
  });
  const pr = { tasks }; tasks.forEach((t, i) => { t.pred = pgParsePred(t._p, pr, i); delete t._p; });
  return tasks;
}
