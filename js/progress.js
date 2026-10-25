// ============================================================
//  TIẾN ĐỘ DỰ ÁN — lập tiến độ theo form MS Project (WBS nhiều cấp, Duration, Start/Finish, Predecessors FS/SS/FF/SF + lag, % hoàn thành)
//  + biểu đồ Gantt, liên kết với PU Delivery (hàng về site hiện thành mốc trên Gantt).
//  Mỗi dự án 1 doc Firestore "prog_<tên dự án>":  { name, start, tasks:[{u,lvl,name,dur,start,pred:[{u,t,lag}],pct,puLink,note}], at }
//  Lịch: 7 ngày/tuần (đúng như file MS Project mẫu). Ngày bắt đầu/kết thúc của task có predecessor được TỰ TÍNH.
// ============================================================
const PROGRESS_ADMIN_ONLY = true;                       // true = chỉ Admin thấy; Quản lý/User thấy thông báo "đang xây dựng". Mở cho mọi người → đổi thành false.
const canSeeProgress = () => !PROGRESS_ADMIN_ONLY || (typeof isAdmin === 'function' && isAdmin());
const canEditProgress = () => typeof isAdmin === 'function' && isAdmin();
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
  return (t.pred || []).filter(p => idx[p.u] !== undefined).map(p => (idx[p.u] + 1) + (p.t === 'FS' ? '' : p.t) + (p.lag ? (p.lag > 0 ? '+' : '') + p.lag + 'd' : '')).join(',');
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

// ── Tính lịch (forward pass) ──
function progCalc(pr) {
  const T = pr.tasks, n = T.length, idx = {}; T.forEach((t, i) => idx[t.u] = i);
  const P0 = pgN(pr.start) || pgToday();
  const end = T.map((t, i) => { let j = i + 1; while (j < n && T[j].lvl > t.lvl) j++; return j; });
  const C = new Array(n), st = new Array(n).fill(0);
  const puInfo = T.some(t => t.puLink) ? pgPuInfo(pr.name) : null;
  function calc(i) {
    if (st[i] === 2) return C[i];
    if (st[i] === 1) return C[i] || { s: P0, f: P0, dur: 0, pct: 0, sum: false, cyc: true };   // vòng lặp predecessor → bỏ qua
    st[i] = 1; const t = T[i], sum = end[i] > i + 1;
    if (sum) {
      let s = Infinity, f = -Infinity, w = 0, pw = 0;
      for (let j = i + 1; j < end[i]; j++) {
        const c = calc(j); if (c.nodata) continue;   // mốc PU chưa có hàng → không kéo giãn nhóm
        s = Math.min(s, c.s); f = Math.max(f, c.f);
        if (!c.sum) { const wt = Math.max(c.dur, 0); w += wt; pw += wt * c.pct; }
      }
      C[i] = { s, f, dur: f - s + 1, pct: w ? Math.round(pw / w) : 0, sum: true };
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
      C[i] = { s, f: s + span - 1, dur, pct: Math.max(0, Math.min(100, +t.pct || 0)), sum: false, ms: dur === 0, nodata: !!(t.puLink && !(t.pred || []).length && puInfo && isNaN(puInfo.date)) };
    }
    st[i] = 2; return C[i];
  }
  for (let i = 0; i < n; i++) calc(i);
  C.end = end; C.idx = idx; return C;
}

// ── Chỉ số tổng quan 1 dự án ──
function progSummary(pr) {
  const C = progCalc(pr), today = pgToday(), root = C[0] || { s: today, f: today, pct: 0 };
  const total = root.f - root.s + 1, elapsed = Math.max(0, Math.min(total, today - root.s + 1));
  const exp = total > 0 ? Math.round(elapsed * 100 / total) : 0;
  let k = 'run', label = '';
  const remain = root.f - today;
  if (root.pct >= 100) { k = 'done'; label = 'Hoàn thành'; }
  else if (today < root.s) { k = 'wait'; label = 'Bắt đầu sau ' + (root.s - today) + ' ngày'; }
  else if (remain < 0) { k = 'over'; label = 'Quá hạn ' + (-remain) + ' ngày'; }
  else { k = remain <= 14 ? 'near' : 'run'; label = 'Còn ' + (remain + 1) + ' ngày'; }
  const cur = [], overdue = [];
  pr.tasks.forEach((t, i) => { const c = C[i]; if (c.sum || c.dur === 0 && t.puLink) return; if (c.pct < 100 && c.f < today) overdue.push(i); else if (c.pct < 100 && c.s <= today && today <= c.f) cur.push(i); });
  const stages = []; pr.tasks.forEach((t, i) => { if (t.lvl === 1) stages.push(i); });
  return { C, root, remain, total, exp, k, label, cur, overdue, stages, pu: pgPuInfo(pr.name) };
}

// ── Trạng thái giao diện ──
let progSel = '', progZoom = 'day', progCompact = (typeof innerWidth !== 'undefined' && innerWidth < 1700), progShowPu = true, progPuOpen = null;
const progCollapsed = new Set();
const PG_COL = { run: '#2E7D32', near: '#E8A33D', over: '#C0392B', wait: '#2D6CDF', done: '#6b7280' };

function renderProgress() {
  const box = document.getElementById('progBody'); if (!box) return;
  if (!canSeeProgress()) {
    box.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px"><div style="font-size:46px">🚧</div><div style="font-size:18px;font-weight:800;margin:8px 0 4px">Tính năng này đang được xây dựng</div><div style="color:var(--text2);font-size:13px">Tiến độ dự án sẽ sớm được mở cho Quản lý và Người dùng.<br><i>This feature is under construction.</i></div></div>`;
    return;
  }
  if (progSel && !PROG_DB[progSel]) progSel = '';
  const names = Object.keys(PROG_DB).sort();
  const sums = names.map(n => ({ n, s: progSummary(PROG_DB[n]) }));
  const ord = { over: 0, near: 1, run: 2, wait: 3, done: 4 };
  sums.sort((a, b) => ord[a.s.k] - ord[b.s.k] || a.s.remain - b.s.remain);
  const cnt = k => sums.filter(x => x.s.k === k).length;
  const lateTasks = sums.reduce((a, x) => a + x.s.overdue.length, 0), puLate = sums.reduce((a, x) => a + x.s.pu.late, 0);
  const edit = canEditProgress();
  let h = `<div class="mp-kpi">
    <div class="mk"><b>${names.length}</b><span>Dự án có tiến độ</span></div>
    <div class="mk"><b style="color:${PG_COL.run}">${cnt('run') + cnt('near')}</b><span>Đang thực hiện</span></div>
    <div class="mk"><b style="color:${PG_COL.over}">${cnt('over')}</b><span>Quá hạn hoàn thành</span></div>
    <div class="mk"><b style="color:${PG_COL.near}">${cnt('near')}</b><span>Còn ≤ 14 ngày</span></div>
    <div class="mk"><b style="color:${PG_COL.over}">${lateTasks}</b><span>Công việc trễ hạn</span></div>
    <div class="mk"><b style="color:${PG_COL.over}">${puLate}</b><span>Hàng PU trễ tiến độ</span></div></div>`;
  h += `<div class="card"><div class="action-row">${edit ? `<button class="btn btn-primary" onclick="progNewProject()">＋ Lập tiến độ cho dự án</button>` : ''}
    <select id="progPick" onchange="progOpen(this.value)" style="min-width:260px"><option value="">— Chọn dự án để xem Gantt —</option>${names.map(n => `<option value="${pgEsc(n)}"${n === progSel ? ' selected' : ''}>${pgEsc(n)}</option>`).join('')}</select>
    <span style="font-size:12px;color:var(--text2)">Trang này cho biết thời gian còn lại để hoàn thành từng dự án. Chọn dự án để xem chi tiết tiến độ.</span></div></div>`;
  if (!names.length) h += `<div class="card" style="text-align:center;color:var(--text2);padding:30px">Chưa có dự án nào được lập tiến độ.${edit ? ' Bấm <b>＋ Lập tiến độ cho dự án</b> để bắt đầu.' : ''}</div>`;
  else h += `<div class="pg-cards">${sums.map(({ n, s }) => progCard(n, s)).join('')}</div>`;
  h += `<div id="progGantt">${progSel ? progGanttHtml(progSel) : ''}</div>`;
  box.innerHTML = h;
  if (progSel) progAfterGantt();
}

function progCard(n, s) {
  const pr = PROG_DB[n], col = PG_COL[s.k], root = s.root, pm = typeof puApPm === 'function' ? puApPm(n) : '';
  const span = Math.max(1, root.f - root.s + 1), today = pgToday(), tp = Math.max(0, Math.min(100, (today - root.s) * 100 / span));
  const lanes = s.stages.slice(0, 6).map(i => {
    const c = s.C[i], l = (c.s - root.s) * 100 / span, w = Math.max(1.5, (c.f - c.s + 1) * 100 / span);
    return `<div class="pg-lane" title="${pgEsc(pr.tasks[i].name)} · ${pgFmt(c.s)} → ${pgFmt(c.f)} · ${c.pct}%"><span class="pg-lane-n">${pgEsc(pr.tasks[i].name)}</span><div class="pg-lane-t"><i style="left:${l}%;width:${w}%"><b style="width:${c.pct}%"></b></i></div></div>`;
  }).join('');
  const cur = s.cur.slice(0, 3).map(i => `<li>${pgEsc(pr.tasks[i].name)} <i>${s.C[i].pct}%</i></li>`).join('');
  const p = s.pu;
  const pu = p.total ? `<span class="pg-chip" style="${p.late ? 'background:#fdecea;color:#C0392B' : ''}">🚚 PU ${p.done}/${p.total} đã giao${p.late ? ' · ' + p.late + ' trễ' : ''}${p.soon7 ? ' · ' + p.soon7 + ' sắp giao' : ''}</span>` : '';
  return `<div class="pg-card" data-p="${pgEsc(n)}" onclick="progOpen(this.dataset.p)" style="border-top:4px solid ${col}">
    <div class="pg-ct"><b>${pgEsc(n)}</b>${pm ? `<span>PM: ${pgEsc(pm)}</span>` : ''}</div>
    <div class="pg-big" style="color:${col}">${pgEsc(s.label)}</div>
    <div class="pg-dates">${pgFmt(root.s)} → ${pgFmt(root.f)} · ${s.total} ngày</div>
    <div class="pg-bar" title="Thực tế ${root.pct}% · Theo thời gian ${s.exp}%"><i style="width:${root.pct}%;background:${col}"></i><u style="left:${tp}%"></u></div>
    <div class="pg-pct"><b>${root.pct}%</b> hoàn thành <span>· theo kế hoạch thời gian: ${Math.min(100, s.exp)}%</span></div>
    <div class="pg-lanes">${lanes}</div>
    ${cur ? `<div class="pg-cur">Đang thực hiện:<ul>${cur}</ul></div>` : ''}
    <div class="pg-chips">${s.overdue.length ? `<span class="pg-chip" style="background:#fdecea;color:#C0392B">⚠ ${s.overdue.length} việc trễ hạn</span>` : ''}${pu}</div></div>`;
}

function progOpen(name) {
  progSel = PROG_DB[name] ? name : ''; progPuOpen = null; renderProgress();
  if (progSel) setTimeout(() => { const g = document.getElementById('progGantt'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
}

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
  const cols = progCompact ? { id: 34, nm: 300, du: 0, st: 0, fn: 82, pc: 0, pd: 0, ac: edit ? 56 : 0 } : { id: 34, nm: 290, du: 58, st: 82, fn: 82, pc: 50, pd: 78, ac: edit ? 56 : 0 };
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
    const t = T[i], c = C[i], sum = c.sum, late = !sum && c.pct < 100 && c.f < today, done = c.pct >= 100;
    rowOf[i] = ri++;
    const toggle = sum ? `<span class="pg-tg" data-u="${pgEsc(t.u)}" onclick="progToggle(this.dataset.u)">${progCollapsed.has(t.u) ? '▸' : '▾'}</span>` : '<span class="pg-tg"></span>';
    const nm = `<div class="pg-c pg-nm${sum ? ' pg-sumrow' : ''}" style="width:${cols.nm}px;padding-left:${6 + t.lvl * 14}px" title="${pgEsc(t.name)}">${toggle}${t.puLink ? '🚚 ' : ''}<span ${edit ? `class="pg-edit" data-i="${i}" onclick="progEdit(+this.dataset.i)"` : ''}>${pgEsc(t.name)}</span></div>`;
    const pcCell = (!sum && edit) ? `<input type="number" min="0" max="100" value="${c.pct}" class="pg-pcin" data-i="${i}" onchange="progSetPct(+this.dataset.i,this.value)">` : c.pct + '%';
    const act = edit ? `<div class="pg-c" style="width:${cols.ac}px;gap:2px"><button class="pg-ib" title="Sửa / cấu trúc" data-i="${i}" onclick="progEdit(+this.dataset.i)">✎</button><button class="pg-ib" title="Thêm công việc bên dưới" data-i="${i}" onclick="progInsert(+this.dataset.i)">＋</button></div>` : '';
    rows += `<div class="pg-row${sum ? ' pg-sum' : ''}"><div class="pg-left" style="width:${LW}px">${lc(cols.id, i + 1, 'justify-content:center;color:var(--text3)')}${nm}${lc(cols.du, c.dur + (c.dur === 1 ? ' day' : ' days'))}${lc(cols.st, pgFmt(c.s, true))}${lc(cols.fn, pgFmt(c.f, true))}${lc(cols.pc, pcCell, 'justify-content:center')}${lc(cols.pd, pgEsc(pgPredText(pr, t)), 'font-size:11px;color:var(--text2)')}${act}</div>
      <div class="pg-tl" style="width:${W}px">${progBar(t, c, X(c.s), pxd, late, done)}</div></div>`;
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
    puHtml += `<div class="pg-row pg-sum pg-puh"><div class="pg-left" style="width:${LW}px">${lc(cols.id, '🚚', 'justify-content:center')}<div class="pg-c pg-nm pg-sumrow" style="width:${cols.nm}px;cursor:pointer" onclick="progTogglePu()"><span class="pg-tg">${puExpanded ? '▾' : '▸'}</span>PU Delivery — hàng về site (${doneN}/${puRows.length} đã giao${lateN ? ', ' + lateN + ' trễ' : ''})</div>${lc(cols.du, '')}${lc(cols.st, ests.length ? pgFmt(mn) : '')}${lc(cols.fn, ests.length ? pgFmt(mx) : '')}${lc(cols.pc, Math.round(doneN * 100 / puRows.length) + '%', 'justify-content:center')}${lc(cols.pd, '')}${lc(cols.ac, '')}</div>
      <div class="pg-tl" style="width:${W}px">${ests.length ? `<div class="pg-sbar" style="left:${X(mn)}px;width:${Math.max(4, (mx - mn + 1) * pxd)}px;background:#7A5FD1"></div>` : ''}</div></div>`;
    if (puExpanded) puRows.forEach((x, k) => {
      const s = puStatus(x), col = PU_STATUS_COLOR[s.k], est = pgN(puEst(x)), act = pgN(x.actual), e0 = pgN(x.e0);
      let b = '';
      if (!isNaN(e0) && !isNaN(est) && est > e0) b += `<div class="pg-pugap" style="left:${X(e0) + pxd / 2}px;width:${(est - e0) * pxd}px;background:${PG_COL.over}" title="Trễ ${est - e0} ngày so với As contract"></div>`;
      const dn = !isNaN(act) ? act : est;
      if (!isNaN(dn)) b += `<div class="pg-ms" style="left:${X(dn) + pxd / 2 - 6}px;background:${col}" title="${pgEsc(x.name)} · ${pgEsc(s.t)} · ${pgFmt(dn)}"></div><span class="pg-bl" style="left:${X(dn) + pxd / 2 + 10}px">${pgEsc(puFmtS(!isNaN(act) ? x.actual : puEst(x)))}</span>`;
      puHtml += `<div class="pg-row"><div class="pg-left" style="width:${LW}px">${lc(cols.id, k + 1, 'justify-content:center;color:var(--text3);font-size:11px')}<div class="pg-c pg-nm" style="width:${cols.nm}px;padding-left:24px" title="${pgEsc(x.name)}"><span class="pg-pill" style="background:${col}">${pgEsc(x.name)}</span></div>${lc(cols.du, '')}${lc(cols.st, x.e0 ? puFmt(x.e0).slice(0, 5) + '/' + puFmt(x.e0).slice(8) : '', 'font-size:11px;color:var(--text2)')}${lc(cols.fn, !isNaN(dn) ? pgFmt(dn) : '')}${lc(cols.pc, '')}${lc(cols.pd, pgEsc(x.supplier || ''), 'font-size:10.5px;color:var(--text2);overflow:hidden')}${lc(cols.ac, '')}</div><div class="pg-tl" style="width:${W}px">${b}</div></div>`;
    });
  }
  const hdLeft = `<div class="pg-left pg-hl" style="width:${LW}px;height:${HH}px">${lc(cols.id, 'ID', 'justify-content:center')}${lc(cols.nm, 'Task Name')}${lc(cols.du, 'Duration')}${lc(cols.st, 'Start')}${lc(cols.fn, 'Finish')}${lc(cols.pc, '%', 'justify-content:center')}${lc(cols.pd, 'Predecessors')}${lc(cols.ac, '')}</div>`;
  const totalH = H;
  const root = sm.root;
  return `<div class="card" style="margin-top:14px">
    <div class="card-title" style="margin-bottom:4px">📅 ${pgEsc(name)} <span style="font-size:12px;font-weight:600;color:${PG_COL[sm.k]}">· ${pgEsc(sm.label)}</span><span style="font-size:12px;font-weight:400;color:var(--text2)"> · ${pgFmt(root.s)} → ${pgFmt(root.f)} · ${root.pct}% hoàn thành</span></div>
    <div class="action-row" style="margin-bottom:8px">
      <select onchange="progZoom=this.value;renderProgress()" title="Thang thời gian"><option value="day"${progZoom === 'day' ? ' selected' : ''}>Theo ngày</option><option value="week"${progZoom === 'week' ? ' selected' : ''}>Theo tuần</option><option value="month"${progZoom === 'month' ? ' selected' : ''}>Theo tháng</option></select>
      <button class="btn" onclick="progToToday()">Hôm nay</button>
      <button class="btn" onclick="progCollapseAll(true)">Thu gọn</button><button class="btn" onclick="progCollapseAll(false)">Mở rộng</button>
      <label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" ${progCompact ? 'checked' : ''} onchange="progCompact=this.checked;renderProgress()"> Cột gọn</label>
      <label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" ${progShowPu ? 'checked' : ''} onchange="progShowPu=this.checked;renderProgress()"> Hiện hàng PU</label>
      <button class="btn" onclick="progExportXlsx()">⬇ Excel</button><button class="btn" onclick="progExportXml()" title="Mở bằng MS Project">⬇ MS Project XML</button>
      ${edit ? `<button class="btn btn-primary" onclick="progInsert(${T.length - 1})">＋ Công việc</button><label class="btn" style="cursor:pointer">⬆ Nhập XML/Excel<input type="file" accept=".xml,.xlsx,.xls" style="display:none" onchange="progImportFile(this)"></label><button class="btn" onclick="progRename()">Đổi ngày khởi công</button><button class="btn" style="color:#C0392B" onclick="progDelete()">🗑 Xoá tiến độ</button>` : ''}
    </div>
    <div class="pg-legend"><i class="lg-b"></i>Công việc <i class="lg-p"></i>Đã hoàn thành (phần %) <i class="lg-r"></i>Trễ hạn <i class="lg-s"></i>Nhóm (summary) <i class="lg-m"></i>Mốc (milestone) <i class="lg-t"></i>Hôm nay</div>
    <div class="pg-scroll" id="progScroll" data-min="${minN}" data-px="${pxd}" data-today="${today}">
      <div class="pg-inner" style="width:${LW + W}px">
        <div class="pg-hdr" style="height:${HH}px">${hdLeft}<div class="pg-tl pg-htl" style="width:${W}px;height:${HH}px"><div class="pg-hmrow">${hm}</div><div class="pg-hdrow">${hd}</div></div></div>
        <div class="pg-body" style="height:${totalH}px">
          <div class="pg-grid" style="left:${LW}px;width:${W}px;height:${totalH}px">${grid}${todayLine}</div>
          ${rows}${puHtml}
          <svg class="pg-svg" style="left:${LW}px;width:${W}px;height:${totalH}px" width="${W}" height="${totalH}"><defs><marker id="pgar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6z" fill="#555"/></marker></defs><g fill="none" stroke="#555" stroke-width="1">${svg}</g></svg>
        </div>
      </div></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Lịch 7 ngày/tuần (theo file MS Project mẫu). Ngày Start/Finish của công việc có Predecessor được tự tính; hàng PU thay đổi → mốc "hàng về site" tự dời theo.</div></div>`;
}
function progBar(t, c, x, pxd, late, done) {
  const w = Math.max(3, (c.f - c.s + 1) * pxd);
  if (c.sum) return `<div class="pg-sbar" style="left:${x}px;width:${w}px"><b></b><em></em><div class="pg-sfill" style="width:${c.pct}%"></div></div><span class="pg-bl" style="left:${x + w + 6}px">${c.pct}%</span>`;
  if (c.nodata) return `<span class="pg-bl" style="left:6px;font-style:italic">chưa có hàng PU của dự án này</span>`;
  if (c.ms || c.dur === 0) return `<div class="pg-ms" style="left:${x + pxd / 2 - 6}px;${t.puLink ? 'background:#7A5FD1' : ''}" title="${pgEsc(t.name)} · ${pgFmt(c.s, true)}"></div><span class="pg-bl" style="left:${x + pxd / 2 + 10}px">${pgFmt(c.s)}</span>`;
  const bg = late ? '#C0392B' : done ? '#2E7D32' : '#2D6CDF';
  return `<div class="pg-bar1" style="left:${x}px;width:${w}px;background:${bg}${late ? '' : ''}" title="${pgEsc(t.name)}&#10;${pgFmt(c.s, true)} → ${pgFmt(c.f, true)} · ${c.dur} ngày · ${c.pct}%"><div class="pg-fill" style="width:${c.pct}%"></div></div><span class="pg-bl" style="left:${x + w + 5}px">${c.pct}%</span>`;
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
  pr.tasks[i].pct = Math.max(0, Math.min(100, parseInt(v, 10) || 0)); progTouch(pr);
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
  const t = pr.tasks[i], C = progCalc(pr), c = C[i], sum = c.sum, hasPred = (t.pred || []).length > 0;
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox"><div style="font-size:18px;font-weight:800;margin-bottom:12px">Công việc #${i + 1}${sum ? ' (nhóm)' : ''}</div>
    <label>Tên công việc<input id="pgfName" value="${pgEsc(t.name)}"></label>
    <div class="pg-g2">
      <label>Duration (ngày)<input id="pgfDur" type="number" min="0" value="${sum ? c.dur : t.dur}" ${sum ? 'disabled' : ''}></label>
      <label>% hoàn thành<input id="pgfPct" type="number" min="0" max="100" value="${c.pct}" ${sum ? 'disabled' : ''}></label>
      <label>Ngày bắt đầu${hasPred ? ' (tự tính từ Predecessor)' : ''}<input id="pgfStart" type="date" value="${pgIso(c.s)}" ${sum || hasPred ? 'disabled' : ''}></label>
      <label>Predecessors<input id="pgfPred" value="${pgEsc(pgPredText(pr, t))}" placeholder="vd: 5, 6SS+3d, 7FF-2d" ${sum ? 'disabled' : ''}></label>
    </div>
    ${sum ? '' : `<label style="flex-direction:row;align-items:center;gap:8px;margin-top:6px"><input type="checkbox" id="pgfPu" ${t.puLink ? 'checked' : ''} style="width:auto"> 🚚 Liên kết PU Delivery: ngày của mốc = ngày hàng cuối cùng về site (nên đặt Duration = 0)</label>`}
    <label>Ghi chú<input id="pgfNote" value="${pgEsc(t.note || '')}"></label>
    <div class="pg-g2" style="margin-top:8px"><div class="action-row" style="margin:0"><button class="btn" onclick="progMove(${i},-1)">▲ Lên</button><button class="btn" onclick="progMove(${i},1)">▼ Xuống</button><button class="btn" onclick="progIndent(${i},-1)">⇤ Lên cấp</button><button class="btn" onclick="progIndent(${i},1)">⇥ Xuống cấp</button></div>
    <div class="action-row" style="margin:0;justify-content:flex-end"><button class="btn" style="color:#C0392B" onclick="progDelTask(${i})">Xoá</button><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" onclick="progSaveTask(${i})">Lưu</button></div></div>
    <div style="font-size:11px;color:var(--text3);margin-top:8px">Predecessors: số ID (mặc định FS) kèm loại FS/SS/FF/SF và độ trễ, cách nhau bằng dấu phẩy. Bắt đầu = ngày sau khi việc trước kết thúc (FS).</div></div>`;
  document.body.appendChild(ov); const f = document.getElementById('pgfName'); if (f) f.focus();
}
function progCloseModal() { const m = document.getElementById('progModal'); if (m) m.remove(); }
function progSaveTask(i) {
  const pr = PROG_DB[progSel], t = pr.tasks[i], g = id => document.getElementById(id), C = progCalc(pr), sum = C[i].sum;
  const nm = (g('pgfName').value || '').trim(); if (!nm) { toast('⚠️ Nhập tên công việc.'); return; }
  t.name = nm; t.note = (g('pgfNote').value || '').trim();
  if (!sum) {
    t.dur = Math.max(0, parseInt(g('pgfDur').value, 10) || 0); t.pct = Math.max(0, Math.min(100, parseInt(g('pgfPct').value, 10) || 0));
    t.pred = pgParsePred(g('pgfPred').value, pr, i); t.puLink = !!g('pgfPu').checked;
    if (!t.pred.length && g('pgfStart').value) t.start = g('pgfStart').value;
    if (progHasCycle(pr)) { toast('⚠️ Predecessor tạo vòng lặp — đã bỏ phần Predecessor vừa nhập.'); t.pred = []; }
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
  if (!canEditProgress()) return;
  const have = new Set(Object.keys(PROG_DB)), avail = (typeof puProjects === 'function' ? puProjects().map(x => x.p) : []).filter(p => !have.has(p));
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:520px"><div style="font-size:18px;font-weight:800;margin-bottom:12px">Lập tiến độ cho dự án</div>
    <label>Dự án (Action Plan / PU Delivery)<select id="pgnProj">${avail.map(p => `<option>${pgEsc(p)}</option>`).join('')}<option value="__new__">＋ Dự án khác (nhập tên)…</option></select></label>
    <label id="pgnNameL" style="display:${avail.length ? 'none' : 'flex'}">Tên dự án<input id="pgnName" placeholder="Tên dự án"></label>
    <label>Ngày khởi công / bắt đầu<input id="pgnStart" type="date" value="${puToday()}"></label>
    <div class="action-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" onclick="progCreate()">Tạo</button></div></div>`;
  document.body.appendChild(ov);
  const sel = document.getElementById('pgnProj'); sel.onchange = () => { document.getElementById('pgnNameL').style.display = sel.value === '__new__' ? 'flex' : 'none'; };
}
function progCreate() {
  const g = id => document.getElementById(id); let name = g('pgnProj').value; if (name === '__new__' || !name) name = (g('pgnName').value || '').trim();
  if (!name) { toast('⚠️ Chọn hoặc nhập tên dự án.'); return; } if (PROG_DB[name]) { toast('⚠️ Dự án này đã có tiến độ.'); return; }
  const st = g('pgnStart').value; if (isNaN(pgN(st))) { toast('⚠️ Chọn ngày bắt đầu.'); return; }
  PROG_DB[name] = { name, start: st, tasks: [progMkTask(0, name)], at: Date.now() };
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
  delete PROG_DB[progSel]; progSel = ''; saveProgDb(); renderProgress();
}

// ── Xuất ──
function progExportXlsx() {
  const pr = PROG_DB[progSel]; if (!pr || typeof XLSX === 'undefined') return;
  const C = progCalc(pr), rows = [['ID', 'Task Name', 'Duration', 'Start', 'Finish', '% Complete', 'Predecessors']];
  pr.tasks.forEach((t, i) => rows.push([i + 1, '    '.repeat(t.lvl) + t.name, C[i].dur + (C[i].dur === 1 ? ' day' : ' days'), pgFmt(C[i].s, true), pgFmt(C[i].f, true), C[i].pct / 100, pgPredText(pr, t)]));
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 5 }, { wch: 60 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 11 }, { wch: 16 }];
  for (let r = 2; r <= rows.length; r++) if (ws['F' + r]) ws['F' + r].z = '0%';
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
  const items = pgPuItems(pr.name);
  if (items.length) {
    const pr2 = [['No.', 'Name of Items', 'Supplier', 'As contract', 'Estimate on site', 'Actual on site', 'Status']];
    items.forEach((x, k) => pr2.push([k + 1, x.name, x.supplier, puFmt(x.e0), puFmt(puEst(x)), puFmt(x.actual), puStatus(x).t]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pr2), 'PU Delivery');
  }
  XLSX.writeFile(wb, `Tien-do-${pr.name.replace(/[^\w-]+/g, '_')}-${puToday()}.xlsx`);
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
  const fin = (tasks, label) => {
    if (!tasks.length) { toast('⚠️ Không đọc được công việc nào trong file.'); return; }
    if (!confirm(`Thay toàn bộ tiến độ của "${pr.name}" bằng ${tasks.length} công việc từ ${label}?`)) return;
    pr.tasks = tasks; pr.tasks[0].lvl = 0; const mn = Math.min(...progCalc(pr).slice(0, 1).map(c => c.s)); if (!isNaN(mn)) pr.start = pgIso(mn);
    progTouch(pr); toast('✅ Đã nhập ' + tasks.length + ' công việc.');
  };
  if (/\.xml$/i.test(f.name)) {
    const rd = new FileReader(); rd.onload = () => { try { fin(progParseXml(String(rd.result)), f.name); } catch (e) { toast('⚠️ File XML không hợp lệ: ' + (e.message || e)); } }; rd.readAsText(f);
  } else {
    const rd = new FileReader(); rd.onload = () => { try { fin(progParseSheet(new Uint8Array(rd.result)), f.name); } catch (e) { toast('⚠️ Không đọc được Excel: ' + (e.message || e)); } }; rd.readAsArrayBuffer(f);
  }
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
  const cN = ix(/task name/), cD = ix(/duration/), cS = ix(/^start/), cP = ix(/predecessor/), cC = ix(/%/), cL = ix(/outline/), tasks = [];
  rows.slice(hi + 1).forEach(r => {
    const raw = String(r[cN] == null ? '' : r[cN]); if (!raw.trim()) return;
    const sp = raw.match(/^\s*/)[0].length, d = parseFloat(String(r[cD]).replace(',', '.')) || 0;
    let s = r[cS]; if (typeof s === 'string') { const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s); if (m) s = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; else s = ''; } else if (typeof s === 'number') s = pgIso(Math.round(s - 25569));
    tasks.push({ u: pgNewUid(), lvl: cL >= 0 ? Math.max(0, (+r[cL] || 1) - 1) : Math.floor(sp / 4), name: raw.trim(), dur: Math.round(d), start: s || '', pred: [], pct: cC >= 0 ? Math.round((+r[cC] || 0) * (+r[cC] <= 1 ? 100 : 1)) : 0, _p: cP >= 0 ? String(r[cP] || '') : '' });
  });
  const pr = { tasks }; tasks.forEach((t, i) => { t.pred = pgParsePred(t._p, pr, i); delete t._p; });
  return tasks;
}
